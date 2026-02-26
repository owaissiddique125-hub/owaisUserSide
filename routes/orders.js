const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");
const clerkAuth = require("../middleware/clerkAuth");

// ✅ Use router.post instead of app.post
router.post("/", clerkAuth, async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      zip,
      street,
      city,
      PhoneNumber,
      mapsLink,
      latitude,
      longitude,
      items,
      total,
      userId,
    } = req.body;

    if (!firstName || !lastName || !city || !street || !PhoneNumber || !items) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          zip,
          street,
          city,
          PhoneNumber,
          maps_link: mapsLink || null,
          latitude: latitude || null,
          longitude: longitude || null,
          items,
          total,
        },
      ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ success: false, message: "Failed to place order" });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error("Order route error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;