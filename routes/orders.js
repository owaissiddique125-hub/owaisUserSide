const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const clerkAuth = require('../middleware/clerkAuth');
const supabase = require('../config/supabase');

/**
 * GET /api/users/profile
 * Get current user's profile
 */
router.get('/profile', clerkAuth, async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', req.auth.userId)
      .eq('is_deleted', false)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found'
        }
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
        address: {
          street: user.address_street,
          city: user.address_city,
          state: user.address_state,
          zipCode: user.address_zip_code,
          formatted: user.address_formatted
        },
        location: user.location_lat && user.location_lng ? {
          lat: parseFloat(user.location_lat),
          lng: parseFloat(user.location_lng)
        } : null,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
router.put('/profile',
  clerkAuth,
  [
    body('name').optional().trim().isLength({ min: 1 }).withMessage('Name cannot be empty'),
    body('phoneNumber').optional().trim(),
    body('address.street').optional().trim(),
    body('address.city').optional().trim(),
    body('address.state').optional().trim(),
    body('address.zipCode').optional().trim(),
    body('address.formatted').optional().trim(),
    body('location.lat').optional().isFloat({ min: -90, max: 90 }),
    body('location.lng').optional().isFloat({ min: -180, max: 180 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array()
          }
        });
      }

      const updates = {};
      
      if (req.body.name) updates.name = req.body.name;
      if (req.body.phoneNumber !== undefined) updates.phone_number = req.body.phoneNumber;
      
      if (req.body.address) {
        if (req.body.address.street !== undefined) updates.address_street = req.body.address.street;
        if (req.body.address.city !== undefined) updates.address_city = req.body.address.city;
        if (req.body.address.state !== undefined) updates.address_state = req.body.address.state;
        if (req.body.address.zipCode !== undefined) updates.address_zip_code = req.body.address.zipCode;
        if (req.body.address.formatted !== undefined) updates.address_formatted = req.body.address.formatted;
      }
      
      if (req.body.location) {
        if (req.body.location.lat !== undefined) updates.location_lat = req.body.location.lat;
        if (req.body.location.lng !== undefined) updates.location_lng = req.body.location.lng;
      }

      const { data: user, error } = await supabase
        .from('users')
        .update(updates)
        .eq('clerk_id', req.auth.userId)
        .select()
        .maybesingle();

      if (error) throw error;

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: user.clerk_id,
          email: user.email,
          name: user.name,
          phoneNumber: user.phone_number,
          profileImage: user.profile_image,
          address: {
            street: user.address_street,
            city: user.address_city,
            state: user.address_state,
            zipCode: user.address_zip_code,
            formatted: user.address_formatted
          },
          location: user.location_lat && user.location_lng ? {
            lat: parseFloat(user.location_lat),
            lng: parseFloat(user.location_lng)
          } : null,
          updatedAt: user.updated_at
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/users/profile/image
 * Update user's profile image
 */

module.exports = router;
