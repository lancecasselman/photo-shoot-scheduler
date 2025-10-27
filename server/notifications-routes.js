const express = require('express');
const { v4: uuidv4 } = require('uuid');

function createNotificationRoutes(pool) {
  const router = express.Router();

  router.get('/notifications', async (req, res) => {
    try {
      console.log('🔔 NOTIFICATIONS API CALLED - Session:', req.session?.user);
      const userId = req.session?.user?.uid;
      
      if (!userId) {
        console.log('❌ No userId found in session');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const result = await pool.query(
        `SELECT * FROM notifications 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [userId]
      );

      console.log(`📬 Fetched ${result.rows.length} notifications for user ${userId}`);
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  router.get('/notifications/unread-count', async (req, res) => {
    try {
      console.log('🔔 UNREAD COUNT API CALLED - Session:', req.session?.user);
      const userId = req.session?.user?.uid;
      
      if (!userId) {
        console.log('❌ No userId found in session for unread count');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const result = await pool.query(
        `SELECT COUNT(*)::int as count 
         FROM notifications 
         WHERE user_id = $1 AND is_read = false`,
        [userId]
      );

      const unreadCount = result.rows[0]?.count || 0;
      console.log(`🔔 Unread count for user ${userId}: ${unreadCount}`);
      res.json({ unreadCount });
    } catch (error) {
      console.error('❌ Error fetching unread count:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  router.post('/notifications/:id/read', async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session?.user?.uid;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const result = await pool.query(
        `UPDATE notifications 
         SET is_read = true 
         WHERE id = $1 AND user_id = $2 
         RETURNING *`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      console.log(`✅ Marked notification ${id} as read for user ${userId}`);
      res.json({ success: true, notification: result.rows[0] });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  router.post('/notifications/read-all', async (req, res) => {
    try {
      const userId = req.session?.user?.uid;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const result = await pool.query(
        `UPDATE notifications 
         SET is_read = true 
         WHERE user_id = $1 AND is_read = false 
         RETURNING *`,
        [userId]
      );

      console.log(`✅ Marked ${result.rows.length} notifications as read for user ${userId}`);
      res.json({ success: true, count: result.rows.length });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  return router;
}

async function createNotification(userId, type, title, message, metadata = {}, pool) {
  try {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, message, metadata, is_read, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, false, NOW()) 
       RETURNING *`,
      [id, userId, type, title, message, JSON.stringify(metadata)]
    );

    console.log(`🔔 Created notification for user ${userId}: ${title}`);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

module.exports = { createNotificationRoutes, createNotification };
