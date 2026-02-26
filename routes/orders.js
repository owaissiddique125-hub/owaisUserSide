const express = require('express');
const router = express.Router();
const clerkAuth = require('../middleware/clerkAuth');
const supabase = require('../config/supabase');

// 1. TEST ROUTE (Sirf check karne ke liye ke rasta khula hai)
router.get('/', (req, res) => {
    res.json({ success: true, message: "Orders route is LIVE! Now try sending a POST request." });
});

// 2. MAIN ORDER ROUTE
router.post('/', clerkAuth, async (req, res, next) => {
  try {
    const { firstName, lastName, PhoneNumber, items, total, street, city, mapsLink, latitude, longitude } = req.body;

    // Supabase insert
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: req.auth.userId,
        first_name: firstName,
        last_name: lastName,
        phone_number: PhoneNumber,
        street: street,
        city: city,
        maps_link: mapsLink,
        latitude: latitude,
        longitude: longitude,
        total: total,
        status: 'pending'
      })
      .select()
      .single();

    if (orderError) throw orderError;

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      order: order
    });

  } catch (error) {
    console.error("❌ Order Error:", error);
    next(error);
  }
});

module.exports = router;