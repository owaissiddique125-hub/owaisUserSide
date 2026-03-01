
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const clerkAuth = require('../middleware/clerkAuth');
const supabase = require('../config/supabase');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * GET /api/items
 * Get all food items
 */
router.get('/', clerkAuth, async (req, res, next) => {
  try {
    // 1. Query se page aur limit uthayein
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // 2. Supabase ki range calculate karein
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('items')
      .select('*', { count: 'exact' }) // Exact count se total ka pata chalta hai
      .eq('available', true)
      .order('created_at', { ascending: false })
      .range(from, to); // Sirf makhsoos range uthao
    
    if (req.query.category) {
      // 🔥 Handle category with/without spaces - case insensitive
      const searchCategory = req.query.category.trim();
      query = query.ilike('category', `%${searchCategory}%`);
    }

    const { data: items, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      items: items.map(item => ({
        id: item.id,
        Name: item.name, // Frontend ke variable se match karne ke liye 'Name'
        price: parseFloat(item.price),
        category: item.category,
        imageUrl: item.cover_image_url,
        description: item.description,
        detail_image_url: item.detail_image_url,
        sizes: item.sizes 
      })),
      totalCount: count, // Total items in DB
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    next(error);
  }
});
/**
 * POST /api/items
 * Add new food item (Admin only) - accepts base64 image
 */
router.post('/',
  clerkAuth,
  [
    body('Name').trim().notEmpty().withMessage('Item name is required'),
    body('price')
      .trim()
      .notEmpty().withMessage('Price is required')
      .isNumeric().withMessage('Price must be a number')
      .custom(value => parseFloat(value) >= 0).withMessage('Price must be positive'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('imageBase64').notEmpty().withMessage('Image is required'),
  ],
  async (req, res, next) => {
    try {
      console.log('📦 Received item data:', {
        Name: req.body.Name,
        price: req.body.price,
        category: req.body.category,
        hasImage: !!req.body.imageBase64,
        sizes: req.body.sizes,

      });
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array()
          }
        });
      }

      const { Name, price, category, description, imageBase64,sizes, detailImagesBase64} = req.body;

      console.log('📤 Uploading to Cloudinary...');
      
      // Upload base64 image to Cloudinary
      const cloudinaryResult = await cloudinary.uploader.upload(imageBase64, {
        folder: 'food-items',
        resource_type: 'image',
      });

      // detail images
      let detailImageUrls = [];
    if (Array.isArray(detailImagesBase64)) {
     for (let img of detailImagesBase64) {
       const result = await cloudinary.uploader.upload(img, {
        folder: 'food-items/details',
        resource_type: 'image',
       });
        detailImageUrls.push(result.secure_url);
      }
}     


      console.log('✅ Cloudinary upload success:', cloudinaryResult.secure_url);
      const imageUrl = cloudinaryResult.secure_url;

      console.log('💾 Saving to Supabase...');
      
      // Insert into Supabase
      const { data: item, error } = await supabase
        .from('items')
        .insert({
          name: Name,
          price: parseFloat(price),
          category: category,
          cover_image_url: imageUrl, 
          description: description || null,
          available: true,
          sizes: sizes,
          detail_image_url: detailImageUrls


        })
        .select()
        .single();

      if (error) {
        console.log('❌ Supabase error:', error);
        throw error;
      }
      
      console.log('✅ Item saved successfully:', item.id);

      res.status(201).json({
        success: true,
        message: 'Item added successfully',
        item: {
          id: item.id,
          name: item.name,
          price: parseFloat(item.price),
          category: item.category,
          imageUrl: item.cover_image_url,
          description: item.description,
          available: item.available,
          createdAt: item.created_at,
          detail_image_url:item.detailImageUrls,
          sizes:item.sizes,
        }
      });
    } catch (error) {
      console.error('Error adding item:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/items/:id
 * Delete food item (Admin only)
 */
router.delete('/:id', clerkAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: item, error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Item not found'
        }
      });
    }

    if (error) throw error;

    res.json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/items/:id
 * Get specific food item by ID
 */
router.get('/:id', clerkAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: item, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Item not found'
        }
      });
    }

    if (error) throw error;

    res.json({
      success: true,
      item: {
        id: item.id,
        name: item.name,
        price: parseFloat(item.price),
        category: item.category,
       imageUrl: item.cover_image_url, 
        description: item.description,
        detail_image_url:item.detailImageUrls||item.detail_image_url,
        available: item.available,
        createdAt: item.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
