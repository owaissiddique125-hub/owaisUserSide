const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const clerkAuth = require('../middleware/clerkAuth');
const supabase = require('../config/supabase');

// --- GET PROFILE ---
router.get('/profile', clerkAuth, async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', req.auth.userId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User profile not found' }
      });
    }

    res.json({
      success: true,
      user: {
        id: user.clerk_id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phone_number,
        profileImage: user.profile_image,
        address: user.address_formatted || "",
        location: user.location_lat && user.location_lng ? {
          lat: parseFloat(user.location_lat),
          lng: parseFloat(user.location_lng)
        } : null,
      }
    });
  } catch (error) {
    next(error);
  }
});

// --- UPDATE/UPSERT PROFILE ---
router.put('/profile',
  clerkAuth,
  [
    body('name').optional().trim().isLength({ min: 1 }),
    body('profileImage').optional() // Validation hatayi thori taake issue na kare
  ],
  async (req, res, next) => {
    try {
      console.log("📥 Incoming PUT Request:", JSON.stringify(req.body, null, 2));
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
        
      // ✅ 1. Important: Start with clerk_id for UPSERT
      const updates = {
        clerk_id: req.auth.userId,
        updated_at: new Date()
      };
      
      // ✅ 2. Basic Info Mapping
      if (req.body.name) updates.name = req.body.name;
      if (req.body.phoneNumber !== undefined) updates.phone_number = req.body.phoneNumber;
      if (req.body.profileImage) updates.profile_image = req.body.profileImage;

      // ✅ 3. Address Handling
      if (req.body.address) {
        updates.address_formatted = typeof req.body.address === 'string' 
          ? req.body.address 
          : req.body.address.formatted;
      }
      
      // ✅ 4. Location Parsing (Supporting both lat/lng and GeoJSON)
      if (req.body.location) {
        if (req.body.location.coordinates) {
          updates.location_lng = req.body.location.coordinates[0];
          updates.location_lat = req.body.location.coordinates[1];
        } else if (req.body.location.lat && req.body.location.lng) {
          updates.location_lat = req.body.location.lat;
          updates.location_lng = req.body.location.lng;
        }
      }

      console.log("💾 DB Updates Object:", updates);

      // 🔥 Step 5: Use UPSERT (This is the real fix)
      // onConflict means: if clerk_id exists, update it. If not, insert it.
      const { data, error } = await supabase
        .from('users')
        .upsert(updates, { onConflict: 'clerk_id' })
        .select()
        .maybeSingle();

      if (error) {
        console.error("❌ Supabase Error:", error);
        return res.status(400).json({ success: false, message: error.message });
      }

      res.json({
        success: true,
        message: 'Profile saved successfully',
        user: data
      });
    } catch (error) {
      console.error("💥 Critical Update Error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
);

module.exports = router;