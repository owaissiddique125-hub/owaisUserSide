const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const clerkAuth = require('../middleware/clerkAuth');
const supabase = require('../config/supabase');

/**
 * GET /api/cart
 * Get user's cart with items
 */
router.get('/', clerkAuth, async (req, res, next) => {
  try {
    // Get or create cart
    let { data: cart, error: cartError } = await supabase
      .from('cart')
      .select('id')
      .eq('user_id', req.auth.userId)
      .single();

    if (cartError && cartError.code === 'PGRST116') {
      // Create cart if doesn't exist
      const { data: newCart, error: createError } = await supabase
        .from('cart')
        .insert({ user_id: req.auth.userId })
        .select()
        .single();

      if (createError) throw createError;
      cart = newCart;
    } else if (cartError) {
      throw cartError;
    }

    // Get cart items with details
    const { data: cartItems, error: itemsError } = await supabase
      .from('cart_with_items')
      .select('*')
      .eq('user_id', req.auth.userId);

    if (itemsError) throw itemsError;

    const items = cartItems
      .filter(item => item.item_id) // Filter out null items
      .map(item => ({
        id: item.cart_item_id,
        itemId: item.item_id,
        name: item.item_name,
        price: parseFloat(item.item_price),
        category: item.item_category,
        imageUrl: item.item_image,
        quantity: item.quantity,
        subtotal: parseFloat(item.subtotal),
        addedAt: item.added_at
      }));

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    res.json({
      success: true,
      cart: {
        id: cart.id,
        items,
        itemCount: items.length,
        total: total.toFixed(2)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/cart
 * Add item to cart
 */
router.post('/',
  clerkAuth,
  [
    body('itemId').isUUID().withMessage('Invalid item ID'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
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

      const { itemId, quantity } = req.body;

      // Check if item exists
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('id, available')
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

      if (!item.available) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ITEM_UNAVAILABLE',
            message: 'Item is not available'
          }
        });
      }

      // Get or create cart
      let { data: cart, error: cartError } = await supabase
        .from('cart')
        .select('id')
        .eq('user_id', req.auth.userId)
        .single();

      if (cartError && cartError.code === 'PGRST116') {
        const { data: newCart, error: createError } = await supabase
          .from('cart')
          .insert({ user_id: req.auth.userId })
          .select()
          .single();

        if (createError) throw createError;
        cart = newCart;
      } else if (cartError) {
        throw cartError;
      }

      // Check if item already in cart
      const { data: existingItem } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cart.id)
        .eq('item_id', itemId)
        .single();

      if (existingItem) {
        // Update quantity
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id);

        if (updateError) throw updateError;
      } else {
        // Add new item
        const { error: insertError } = await supabase
          .from('cart_items')
          .insert({
            cart_id: cart.id,
            item_id: itemId,
            quantity
          });

        if (insertError) throw insertError;
      }

      // Update cart timestamp
      await supabase
        .from('cart')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', cart.id);

      res.json({
        success: true,
        message: 'Item added to cart'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/cart/:id
 * Update cart item quantity
 */
router.put('/:id',
  clerkAuth,
  [
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
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

      const { id } = req.params;
      const { quantity } = req.body;

      // Get user's cart
      const { data: cart } = await supabase
        .from('cart')
        .select('id')
        .eq('user_id', req.auth.userId)
        .single();

      if (!cart) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CART_NOT_FOUND',
            message: 'Cart not found'
          }
        });
      }

      // Update cart item
      const { data: cartItem, error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', id)
        .eq('cart_id', cart.id)
        .select()
        .single();

      if (error && error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Cart item not found'
          }
        });
      }

      if (error) throw error;

      res.json({
        success: true,
        message: 'Cart item updated'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/cart/:id
 * Remove item from cart
 */
router.delete('/:id', clerkAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get user's cart
    const { data: cart } = await supabase
      .from('cart')
      .select('id')
      .eq('user_id', req.auth.userId)
      .single();

    if (!cart) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CART_NOT_FOUND',
          message: 'Cart not found'
        }
      });
    }

    // Delete cart item
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', id)
      .eq('cart_id', cart.id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Item removed from cart'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
