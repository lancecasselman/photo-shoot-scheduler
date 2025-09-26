const { Pool } = require('pg');
const EventEmitter = require('events');

/**
 * Real-Time Gallery Update System
 * Handles Server-Side Events (SSE) for live gallery updates when photos are added
 * Integrates with existing gallery access token authentication
 */
class RealTimeGalleryUpdates extends EventEmitter {
  constructor(pool) {
    super();
    this.pool = pool;
    this.clients = new Map(); // Store SSE clients by gallery token
    this.sessionTokenMap = new Map(); // Map session IDs to tokens for quick lookup
    
    console.log(' Real-time gallery updates system initialized');
    
    // Clean up disconnected clients periodically
    setInterval(() => this.cleanupDisconnectedClients(), 30000); // Every 30 seconds
  }

  /**
   * Get gallery token for session ID (cached for performance)
   */
  async getGalleryTokenForSession(sessionId) {
    // Check cache first
    if (this.sessionTokenMap.has(sessionId)) {
      return this.sessionTokenMap.get(sessionId);
    }

    let client;
    try {
      client = await this.pool.connect();
      const result = await client.query(
        'SELECT gallery_access_token FROM photography_sessions WHERE id = $1',
        [sessionId]
      );

      if (result.rows.length > 0) {
        const token = result.rows[0].gallery_access_token;
        // Cache for 5 minutes
        this.sessionTokenMap.set(sessionId, token);
        setTimeout(() => this.sessionTokenMap.delete(sessionId), 5 * 60 * 1000);
        return token;
      }
      return null;
    } catch (error) {
      console.error('Error getting gallery token for session:', error);
      return null;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Validate gallery access token and get session info
   */
  async validateGalleryToken(token) {
    let client;
    try {
      client = await this.pool.connect();
      const result = await client.query(
        'SELECT id, client_name, session_type, gallery_expires_at FROM photography_sessions WHERE gallery_access_token = $1',
        [token]
      );

      if (result.rows.length === 0) {
        return { valid: false, reason: 'Invalid gallery token' };
      }

      const session = result.rows[0];
      const now = new Date();
      const expiresAt = new Date(session.gallery_expires_at);

      if (now > expiresAt) {
        return { valid: false, reason: 'Gallery access has expired' };
      }

      return {
        valid: true,
        sessionId: session.id,
        clientName: session.client_name,
        sessionType: session.session_type,
        expiresAt: session.gallery_expires_at
      };
    } catch (error) {
      console.error('Error validating gallery token:', error);
      return { valid: false, reason: 'Database error' };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Add SSE client for a specific gallery token
   */
  addClient(galleryToken, res) {
    if (!this.clients.has(galleryToken)) {
      this.clients.set(galleryToken, new Set());
    }

    const clientSet = this.clients.get(galleryToken);
    clientSet.add(res);

    console.log(`📡 SSE client connected for gallery token: ${galleryToken}. Total clients: ${clientSet.size}`);

    // Setup client cleanup when connection closes
    res.on('close', () => {
      this.removeClient(galleryToken, res);
    });

    res.on('error', (error) => {
      console.error('SSE client error:', error);
      this.removeClient(galleryToken, res);
    });

    // Send initial connection confirmation
    this.sendToClient(res, 'connected', {
      message: 'Real-time gallery updates connected',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Remove SSE client
   */
  removeClient(galleryToken, res) {
    const clientSet = this.clients.get(galleryToken);
    if (clientSet) {
      clientSet.delete(res);
      if (clientSet.size === 0) {
        this.clients.delete(galleryToken);
      }
      console.log(`📡 SSE client disconnected from gallery token: ${galleryToken}. Remaining clients: ${clientSet.size}`);
    }
  }

  /**
   * Send data to a specific SSE client
   */
  sendToClient(res, eventType, data) {
    try {
      const eventData = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(eventData);
    } catch (error) {
      console.error('Error sending SSE data to client:', error);
      // Client likely disconnected, let the cleanup handle it
    }
  }

  /**
   * Broadcast photo update to all clients for a specific gallery token
   */
  async broadcastPhotoUpdate(sessionId, photoData) {
    try {
      const galleryToken = await this.getGalleryTokenForSession(sessionId);
      if (!galleryToken) {
        console.log('❌ Could not find gallery token for session:', sessionId);
        return;
      }

      const clientSet = this.clients.get(galleryToken);
      if (!clientSet || clientSet.size === 0) {
        console.log(`📡 No connected clients for gallery token: ${galleryToken}`);
        return;
      }

      const updateData = {
        sessionId,
        photos: photoData.photos || [],
        newPhotosCount: photoData.newPhotosCount || 0,
        timestamp: new Date().toISOString()
      };

      console.log(`📡 Broadcasting photo update to ${clientSet.size} clients for session: ${sessionId}`);

      // Send to all clients for this gallery token
      clientSet.forEach((res) => {
        this.sendToClient(res, 'photos_updated', updateData);
      });

      // Emit event for other parts of the system
      this.emit('photosUpdated', { sessionId, galleryToken, updateData });

    } catch (error) {
      console.error('Error broadcasting photo update:', error);
    }
  }

  /**
   * Broadcast gallery refresh signal
   */
  async broadcastGalleryRefresh(sessionId) {
    try {
      const galleryToken = await this.getGalleryTokenForSession(sessionId);
      if (!galleryToken) {
        console.log('❌ Could not find gallery token for session:', sessionId);
        return;
      }

      const clientSet = this.clients.get(galleryToken);
      if (!clientSet || clientSet.size === 0) {
        console.log(`📡 No connected clients for gallery token: ${galleryToken}`);
        return;
      }

      const refreshData = {
        sessionId,
        action: 'refresh',
        timestamp: new Date().toISOString()
      };

      console.log(`📡 Broadcasting gallery refresh to ${clientSet.size} clients for session: ${sessionId}`);

      clientSet.forEach((res) => {
        this.sendToClient(res, 'gallery_refresh', refreshData);
      });

    } catch (error) {
      console.error('Error broadcasting gallery refresh:', error);
    }
  }

  /**
   * Clean up disconnected clients
   */
  cleanupDisconnectedClients() {
    let totalDisconnected = 0;
    
    this.clients.forEach((clientSet, galleryToken) => {
      const disconnectedClients = [];
      
      clientSet.forEach((res) => {
        // Check if response is still writable
        if (res.destroyed || !res.writable) {
          disconnectedClients.push(res);
        }
      });

      // Remove disconnected clients
      disconnectedClients.forEach((res) => {
        clientSet.delete(res);
        totalDisconnected++;
      });

      // Remove empty client sets
      if (clientSet.size === 0) {
        this.clients.delete(galleryToken);
      }
    });

    if (totalDisconnected > 0) {
      console.log(`🧹 Cleaned up ${totalDisconnected} disconnected SSE clients`);
    }
  }

  /**
   * Get statistics about connected clients
   */
  getStats() {
    const totalClients = Array.from(this.clients.values()).reduce((sum, clientSet) => sum + clientSet.size, 0);
    const totalGalleries = this.clients.size;
    
    return {
      totalClients,
      totalGalleries,
      galleries: Array.from(this.clients.entries()).map(([token, clientSet]) => ({
        token,
        clientCount: clientSet.size
      }))
    };
  }

  /**
   * Express middleware for SSE endpoint
   */
  createSSEEndpoint() {
    return async (req, res) => {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ error: 'Gallery access token is required' });
      }

      // Validate the gallery token
      const validation = await this.validateGalleryToken(token);
      if (!validation.valid) {
        return res.status(401).json({ error: validation.reason });
      }

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'Access-Control-Expose-Headers': 'Content-Type'
      });

      // Add client to the notification system
      this.addClient(token, res);

      // Keep connection alive with periodic heartbeat
      const heartbeat = setInterval(() => {
        this.sendToClient(res, 'heartbeat', {
          timestamp: new Date().toISOString()
        });
      }, 30000); // Every 30 seconds

      // Cleanup on client disconnect
      res.on('close', () => {
        clearInterval(heartbeat);
      });
    };
  }
}

module.exports = RealTimeGalleryUpdates;