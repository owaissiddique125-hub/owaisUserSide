const express = require('express');
const router = express.Router();
const { Webhook } = require('svix');
const supabase = require('../config/supabase');

/**
 * POST /api/webhooks/sync-user
 * Manual endpoint to sync current user to Supabase (for development)
 * This must come BEFORE the /clerk route to avoid raw body parser
 */
router.post('/sync-user', async (req, res) => {
  try {
    console.log('📨 Sync user request received');
    console.log('Request body:', req.body);
    
    const { clerk_id, email, name, profile_image } = req.body;

    if (!clerk_id || !email) {
      console.log('❌ Missing required fields:', { clerk_id, email });
      return res.status(400).json({
        success: false,
        error: 'clerk_id and email are required'
      });
    }

    // Check if user exists
    const { data, error} = await supabase
      .from('users')
      .upsert({
        clerk_id,
        email,
        name:name||"user",
        profile_image:profile_image||'https://www.w3schools.com/howto/img_avatar.png',
        is_deleted:false,
      },
    {onConflict:"email"}
    )
      .select()
      .single();

    if (error) {
      return res.json({
        success: false,
        message: 'Something Eroor in webhook',
        user: error
      });
    }

    // Create new user
  

    console.log(`✅ User synced manually: ${email}`);
    res.json({
      success: true,
      message: 'User synced successfully',
      user: data
    });
  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/webhooks/clerk
 * Handles user.created, user.updated, and user.deleted events
 */
router.post('/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Get webhook signature headers
    const svix_id = req.headers['svix-id'];
    const svix_timestamp = req.headers['svix-timestamp'];
    const svix_signature = req.headers['svix-signature'];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing svix headers'
      });
    }

    // Verify webhook signature
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('❌ CLERK_WEBHOOK_SECRET not configured');
      return res.status(500).json({
        success: false,
        error: 'Webhook secret not configured'
      });
    }

    const wh = new Webhook(webhookSecret);
    let evt;

    try {
      evt = wh.verify(req.body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('❌ Webhook verification failed:', err.message);
      return res.status(400).json({
        success: false,
        error: 'Webhook verification failed'
      });
    }

    const eventType = evt.type;
    const userData = evt.data;

    console.log(`📨 Webhook received: ${eventType}`);

    // Handle different event types
    switch (eventType) {
      case 'user.created':
        await handleUserCreated(userData);
        break;
      
      case 'user.updated':
        await handleUserUpdated(userData);
        break;
      
      case 'user.deleted':
        await handleUserDeleted(userData);
        break;
      
      default:
        console.log(`⚠️  Unhandled webhook event: ${eventType}`);
    }

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

async function handleUserCreated(userData) {
  const email = userData.email_addresses?.[0]?.email_address;
  const name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'User';
  
  const { error } = await supabase
    .from('users')
    .upsert({
      clerk_id: userData.id,
      email: email,
      name: name,
      profile_image: userData.image_url || 'https://www.w3schools.com/howto/img_avatar.png',
      is_deleted:false,
    },
    {onConflict:"email"}
  );

  if (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  }

  console.log(`✅ User created: ${email}`);
}

async function handleUserUpdated(userData) {
  const email = userData.email_addresses?.[0]?.email_address;
  const name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'User';
  
  const { error } = await supabase
    .from('users')
    .update({
      email: email,
      name: name,
      profile_image: userData.image_url || 'https://www.w3schools.com/howto/img_avatar.png'
    })
    .eq('clerk_id', userData.id);

  if (error) {
    console.error('❌ Error updating user:', error);
    throw error;
  }

  console.log(`✅ User updated: ${email}`);
}

async function handleUserDeleted(userData) {
  const { error } = await supabase
    .from('users')
    .update({ is_deleted: true })
    .eq('clerk_id', userData.id);

  if (error) {
    console.error('❌ Error deleting user:', error);
    throw error;
  }

  console.log(`✅ User soft-deleted: ${userData.id}`);
}

module.exports = router;
