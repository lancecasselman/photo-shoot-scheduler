const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db.ts');
const { notifications } = require('../shared/schema');
const { eq, and, desc, sql } = require('drizzle-orm');

function createNotificationRoutes() {
  const router = express.Router();

  router.get('/notifications', async (req, res) => {
    try {
      const userId = req.session?.user?.uid;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userNotifications = await db.select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(50);

      console.log(`📬 Fetched ${userNotifications.length} notifications for user ${userId}`);
      res.json(userNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  router.get('/notifications/unread-count', async (req, res) => {
    try {
      const userId = req.session?.user?.uid;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const result = await db.select({
        count: sql`COUNT(*)::int`
      })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));

      const unreadCount = result[0]?.count || 0;
      console.log(`🔔 Unread count for user ${userId}: ${unreadCount}`);
      res.json({ unreadCount });
    } catch (error) {
      console.error('Error fetching unread count:', error);
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

      const [updated] = await db.update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.id, id),
          eq(notifications.userId, userId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      console.log(`✅ Marked notification ${id} as read for user ${userId}`);
      res.json({ success: true, notification: updated });
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

      const result = await db.update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ))
        .returning();

      console.log(`✅ Marked ${result.length} notifications as read for user ${userId}`);
      res.json({ success: true, count: result.length });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  return router;
}

async function createNotification(userId, type, title, message, metadata = {}) {
  try {
    const [notification] = await db.insert(notifications).values({
      id: uuidv4(),
      userId,
      type,
      title,
      message,
      metadata,
      isRead: false
    }).returning();

    console.log(`🔔 Created notification for user ${userId}: ${title}`);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

module.exports = { createNotificationRoutes, createNotification };
