// Community Platform API Routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const CommunityDatabase = require('./community-database');
const CommunityImageProcessor = require('./community-image-processor');

// Initialize multer for file uploads (accept any size)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max per file
        files: 10 // Max 10 files at once
    }
});

// Initialize services
let db = null;
let imageProcessor = null;

function initializeCommunityServices(pool, r2Config) {
    db = new CommunityDatabase(pool);
    imageProcessor = new CommunityImageProcessor(r2Config);
    
    // Initialize database tables
    db.initializeTables().catch(console.error);
    
    return router;
}

// Middleware to check authentication
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

// Get user profile
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.uid || req.session.user.id;
        const displayName = req.session.user.displayName || req.session.user.email || 'Anonymous';
        
        const profile = await db.getOrCreateProfile(userId, displayName);
        res.json(profile);
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Update user profile
router.put('/profile', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.uid || req.session.user.id;
        const updates = req.body;
        
        const profile = await db.updateProfile(userId, updates);
        res.json(profile);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Get posts
router.get('/posts', async (req, res) => {
    try {
        const { type, userId, limit = 20, offset = 0, sortBy = 'created_at' } = req.query;
        
        const posts = await db.getPosts({
            type,
            userId,
            limit: parseInt(limit),
            offset: parseInt(offset),
            sortBy
        });
        
        res.json(posts);
    } catch (error) {
        console.error('Error getting posts:', error);
        res.status(500).json({ error: 'Failed to get posts' });
    }
});

// Get single post
router.get('/posts/:postId', async (req, res) => {
    try {
        const post = await db.getPostById(req.params.postId);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Increment view count
        await db.updatePostStats(req.params.postId, 'views_count');
        
        res.json(post);
    } catch (error) {
        console.error('Error getting post:', error);
        res.status(500).json({ error: 'Failed to get post' });
    }
});

// Create post
router.post('/posts', requireAuth, upload.array('images', 10), async (req, res) => {
    try {
        const userId = req.session.user.uid || req.session.user.id;
        const userName = req.session.user.displayName || req.session.user.email || 'Anonymous';
        
        const postData = {
            userId,
            userName,
            userAvatar: req.session.user.photoURL || null,
            type: req.body.type || 'text',
            title: req.body.title,
            content: req.body.content,
            location: req.body.location,
            price: req.body.price ? parseFloat(req.body.price) : null,
            tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : []
        };
        
        // Process images if uploaded
        if (req.files && req.files.length > 0) {
            console.log(`Processing ${req.files.length} images for post`);
            
            if (req.body.type === 'before_after' && req.files.length >= 2) {
                // Handle before/after comparison
                const comparison = await imageProcessor.createBeforeAfterComparison(
                    req.files[0].buffer,
                    req.files[1].buffer,
                    userId
                );
                postData.imageUrls = comparison;
            } else {
                // Process regular images (just use first image for now)
                const processedImage = await imageProcessor.processImage(
                    req.files[0].buffer,
                    req.files[0].originalname,
                    userId
                );
                
                postData.imageUrls = processedImage;
                
                // Extract camera settings from EXIF
                const cameraSettings = await imageProcessor.extractCameraSettings(req.files[0].buffer);
                if (cameraSettings) {
                    postData.cameraSettings = cameraSettings;
                }
            }
        }
        
        // Parse camera settings if provided manually
        if (req.body.cameraSettings) {
            try {
                postData.cameraSettings = JSON.parse(req.body.cameraSettings);
            } catch (e) {
                console.error('Error parsing camera settings:', e);
            }
        }
        
        const post = await db.createPost(postData);
        
        // Update user's post count
        await db.updateProfile(userId, { 
            posts_count: db.pool.query.raw('posts_count + 1') 
        });
        
        res.json(post);
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// Update post
router.put('/posts/:postId', requireAuth, async (req, res) => {
    try {
        const post = await db.getPostById(req.params.postId);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        const userId = req.session.user.uid || req.session.user.id;
        if (post.user_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to edit this post' });
        }
        
        // Update post (implementation needed in database)
        res.json({ message: 'Post update not yet implemented' });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ error: 'Failed to update post' });
    }
});

// Delete post
router.delete('/posts/:postId', requireAuth, async (req, res) => {
    try {
        const post = await db.getPostById(req.params.postId);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        const userId = req.session.user.uid || req.session.user.id;
        if (post.user_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to delete this post' });
        }
        
        // Delete post (implementation needed in database)
        res.json({ message: 'Post deletion not yet implemented' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// Toggle like on post
router.post('/posts/:postId/like', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.uid || req.session.user.id;
        const result = await db.toggleLike(userId, req.params.postId);
        res.json(result);
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
});

// Toggle save on post
router.post('/posts/:postId/save', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.uid || req.session.user.id;
        const result = await db.toggleSave(userId, req.params.postId);
        res.json(result);
    } catch (error) {
        console.error('Error toggling save:', error);
        res.status(500).json({ error: 'Failed to toggle save' });
    }
});

// Get comments for post
router.get('/posts/:postId/comments', async (req, res) => {
    try {
        const comments = await db.getComments(req.params.postId);
        res.json(comments);
    } catch (error) {
        console.error('Error getting comments:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
});

// Add comment to post
router.post('/posts/:postId/comments', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.uid || req.session.user.id;
        const userName = req.session.user.displayName || req.session.user.email || 'Anonymous';
        
        const commentData = {
            postId: req.params.postId,
            userId,
            userName,
            userAvatar: req.session.user.photoURL || null,
            parentCommentId: req.body.parentCommentId || null,
            content: req.body.content
        };
        
        const comment = await db.createComment(commentData);
        res.json(comment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

// Search posts
router.get('/search', async (req, res) => {
    try {
        const { q, type } = req.query;
        
        if (!q) {
            return res.status(400).json({ error: 'Search query required' });
        }
        
        const posts = await db.searchPosts(q, { type });
        res.json(posts);
    } catch (error) {
        console.error('Error searching posts:', error);
        res.status(500).json({ error: 'Failed to search posts' });
    }
});

// Get trending tags
router.get('/trending/tags', async (req, res) => {
    try {
        // Get trending tags from database
        const query = `
            SELECT unnest(tags) as tag, COUNT(*) as count
            FROM community_posts
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY tag
            ORDER BY count DESC
            LIMIT 10
        `;
        
        const result = await db.pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting trending tags:', error);
        res.status(500).json({ error: 'Failed to get trending tags' });
    }
});

// Get top contributors
router.get('/trending/contributors', async (req, res) => {
    try {
        const query = `
            SELECT user_id, user_name, COUNT(*) as posts_count,
                   SUM(likes_count) as total_likes
            FROM community_posts
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY user_id, user_name
            ORDER BY total_likes DESC
            LIMIT 10
        `;
        
        const result = await db.pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting top contributors:', error);
        res.status(500).json({ error: 'Failed to get top contributors' });
    }
});

// Follow/unfollow user
router.post('/users/:userId/follow', requireAuth, async (req, res) => {
    try {
        const followerId = req.session.user.uid || req.session.user.id;
        const followingId = req.params.userId;
        
        if (followerId === followingId) {
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }
        
        const result = await db.toggleFollow(followerId, followingId);
        res.json(result);
    } catch (error) {
        console.error('Error toggling follow:', error);
        res.status(500).json({ error: 'Failed to toggle follow' });
    }
});

// Get followers
router.get('/users/:userId/followers', async (req, res) => {
    try {
        const query = `
            SELECT follower_id, p.display_name, p.avatar_url
            FROM community_follows f
            LEFT JOIN community_profiles p ON f.follower_id = p.user_id
            WHERE f.following_id = $1
            ORDER BY f.created_at DESC
        `;
        
        const result = await db.pool.query(query, [req.params.userId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting followers:', error);
        res.status(500).json({ error: 'Failed to get followers' });
    }
});

// Get following
router.get('/users/:userId/following', async (req, res) => {
    try {
        const query = `
            SELECT following_id, p.display_name, p.avatar_url
            FROM community_follows f
            LEFT JOIN community_profiles p ON f.following_id = p.user_id
            WHERE f.follower_id = $1
            ORDER BY f.created_at DESC
        `;
        
        const result = await db.pool.query(query, [req.params.userId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting following:', error);
        res.status(500).json({ error: 'Failed to get following' });
    }
});

// Send message
router.post('/messages', requireAuth, async (req, res) => {
    try {
        const senderId = req.session.user.uid || req.session.user.id;
        const senderName = req.session.user.displayName || req.session.user.email || 'Anonymous';
        
        const messageData = {
            senderId,
            senderName,
            receiverId: req.body.receiverId,
            receiverName: req.body.receiverName,
            message: req.body.message
        };
        
        const message = await db.sendMessage(messageData);
        res.json(message);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Get messages between users
router.get('/messages/:userId', requireAuth, async (req, res) => {
    try {
        const currentUserId = req.session.user.uid || req.session.user.id;
        const otherUserId = req.params.userId;
        
        const messages = await db.getMessages(currentUserId, otherUserId);
        
        // Mark messages as read
        await db.markMessagesAsRead(currentUserId, otherUserId);
        
        res.json(messages);
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Get unread message count
router.get('/messages/unread/count', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.uid || req.session.user.id;
        
        const query = `
            SELECT COUNT(*) as count
            FROM community_messages
            WHERE receiver_id = $1 AND is_read = false
        `;
        
        const result = await db.pool.query(query, [userId]);
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});

// Get saved posts
router.get('/saved', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.uid || req.session.user.id;
        
        const query = `
            SELECT p.*
            FROM community_saves s
            JOIN community_posts p ON s.post_id = p.id
            WHERE s.user_id = $1
            ORDER BY s.created_at DESC
        `;
        
        const result = await db.pool.query(query, [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting saved posts:', error);
        res.status(500).json({ error: 'Failed to get saved posts' });
    }
});

// Get weekly challenge
router.get('/challenges/current', async (req, res) => {
    try {
        const query = `
            SELECT * FROM community_challenges
            WHERE is_active = true AND end_date >= CURRENT_DATE
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        const result = await db.pool.query(query);
        res.json(result.rows[0] || null);
    } catch (error) {
        console.error('Error getting challenge:', error);
        res.status(500).json({ error: 'Failed to get challenge' });
    }
});

// Submit to challenge
router.post('/challenges/:challengeId/submit', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const userId = req.session.user.uid || req.session.user.id;
        const userName = req.session.user.displayName || req.session.user.email || 'Anonymous';
        
        // Create a post for the challenge submission
        const postData = {
            userId,
            userName,
            userAvatar: req.session.user.photoURL || null,
            type: 'photo',
            title: `Challenge Submission: ${req.body.title}`,
            content: req.body.description,
            tags: ['challenge', req.params.challengeId]
        };
        
        // Process image
        if (req.file) {
            const processedImage = await imageProcessor.processImage(
                req.file.buffer,
                req.file.originalname,
                userId
            );
            postData.imageUrls = processedImage;
        }
        
        const post = await db.createPost(postData);
        res.json(post);
    } catch (error) {
        console.error('Error submitting to challenge:', error);
        res.status(500).json({ error: 'Failed to submit to challenge' });
    }
});

// Export initialization function
module.exports = initializeCommunityServices;