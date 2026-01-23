const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const clerkAuth = require('../middleware/clerkAuth');
const supabase = require('../config/supabase');

/**
 * GET /api/favorites
 * Get user's favorite items with item details
 */
router.get('/', clerkAuth, async (req, res, next) => {
  try {
    const { data: favorites, error } = await supabase
      .from('favorites_with_items')
      .select('*')
      .eq('user_id', req.auth.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      favorites: favorites.map(fav => ({
        id: fav.favorite_id,
        itemId: fav.item_id,
        name: fav.item_name,
        price: parseFloat(fav.item_price),
        category: fav.item_category,
        imageUrl: fav.item_image,
        description: fav.item_description,
        createdAt: fav.created_at
      })),
      count: favorites.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/favorites
 * Add item to favorites
 */
router.post('/',
  clerkAuth,
  [
    body('itemId').isUUID().withMessage('Invalid item ID')
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

      const { itemId } = req.body;

      // Check if item exists
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('id')
        .eq('id', itemId)
        .single();

      if (itemError || !item) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ITEM_NOT_FOUND',
            message: 'Item not found'
          }
        });
      }

      // Check if already favorited
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', req.auth.userId)
        .eq('item_id', itemId)
        .single();

      if (existing) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_ENTRY',
            message: 'Item already in favorites'
          }
        });
      }

      // Add to favorites
      const { data: favorite, error } = await supabase
        .from('favorites')
        .insert({
          user_id: req.auth.userId,
          item_id: itemId
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        success: true,
        message: 'Item added to favorites',
        favorite: {
          id: favorite.id,
          itemId: favorite.item_id,
          createdAt: favorite.created_at
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/favorites/:id
 * Remove item from favorites
 */
router.delete('/:id', clerkAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: favorite, error } = await supabase
      .from('favorites')
      .delete()
      .eq('id', id)
      .eq('user_id', req.auth.userId)
      .select()
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Favorite not found'
        }
      });
    }

    if (error) throw error;

    res.json({
      success: true,
      message: 'Item removed from favorites'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
