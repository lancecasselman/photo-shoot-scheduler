// Community Platform Database Schema and Operations
const { Pool } = require('pg');

class CommunityDatabase {
    constructor(pool) {
        this.pool = pool;
    }

    async initializeTables() {
        const client = await this.pool.connect();
        try {
            // Create posts table
            await client.query(`
                CREATE TABLE IF NOT EXISTS community_posts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id VARCHAR(255) NOT NULL,
                    user_name VARCHAR(255),
                    user_avatar TEXT,
                    type VARCHAR(50) CHECK (type IN ('photo', 'video', 'text', 'help', 'tip', 'marketplace', 'before_after')),
                    title TEXT,
                    content TEXT,
                    image_urls JSONB,
                    video_url TEXT,
                    camera_settings JSONB,
                    location TEXT,
                    price DECIMAL(10, 2),
                    tags TEXT[],
                    likes_count INT DEFAULT 0,
                    comments_count INT DEFAULT 0,
                    saves_count INT DEFAULT 0,
                    views_count INT DEFAULT 0,
                    is_featured BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create comments table
            await client.query(`
                CREATE TABLE IF NOT EXISTS community_comments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
                    user_id VARCHAR(255) NOT NULL,
                    user_name VARCHAR(255),
                    user_avatar TEXT,
                    parent_comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    likes_count INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create messages table
            await client.query(`
                CREATE TABLE IF NOT EXISTS community_messages (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    sender_id VARCHAR(255) NOT NULL,
                    sender_name VARCHAR(255),
                    receiver_id VARCHAR(255) NOT NULL,
                    receiver_name VARCHAR(255),
                    message TEXT NOT NULL,
                    is_read BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create likes table (junction table)
            await client.query(`
                CREATE TABLE IF NOT EXISTS community_likes (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id VARCHAR(255) NOT NULL,
                    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, post_id)
                )
            `);

            // Create saves table (junction table)
            await client.query(`
                CREATE TABLE IF NOT EXISTS community_saves (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id VARCHAR(255) NOT NULL,
                    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, post_id)
                )
            `);

            // Create follows table
            await client.query(`
                CREATE TABLE IF NOT EXISTS community_follows (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    follower_id VARCHAR(255) NOT NULL,
                    following_id VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(follower_id, following_id)
                )
            `);

            // Create user profiles table
            await client.query(`
                CREATE TABLE IF NOT EXISTS community_profiles (
                    user_id VARCHAR(255) PRIMARY KEY,
                    display_name VARCHAR(255),
                    bio TEXT,
                    avatar_url TEXT,
                    skill_badges TEXT[],
                    reputation_points INT DEFAULT 0,
                    portfolio_link TEXT,
                    followers_count INT DEFAULT 0,
                    following_count INT DEFAULT 0,
                    posts_count INT DEFAULT 0,
                    is_mentor BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create challenges table
            await client.query(`
                CREATE TABLE IF NOT EXISTS community_challenges (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    start_date DATE,
                    end_date DATE,
                    winner_id VARCHAR(255),
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create indexes for performance
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_posts_user_id ON community_posts(user_id);
                CREATE INDEX IF NOT EXISTS idx_posts_type ON community_posts(type);
                CREATE INDEX IF NOT EXISTS idx_posts_created_at ON community_posts(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_comments_post_id ON community_comments(post_id);
                CREATE INDEX IF NOT EXISTS idx_messages_receiver ON community_messages(receiver_id, is_read);
                CREATE INDEX IF NOT EXISTS idx_likes_post_id ON community_likes(post_id);
            `);

            console.log(' Community database tables initialized successfully');
        } catch (error) {
            console.error('Error initializing community database:', error);
            throw error;
        } finally {
            client.release();
        }
        }
    }

    // Post operations
    async createPost(postData) {
        const query = `
            INSERT INTO community_posts (
                user_id, user_name, user_avatar, type, title, content, 
                image_urls, video_url, camera_settings, location, price, tags
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `;
        const values = [
            postData.userId,
            postData.userName,
            postData.userAvatar,
            postData.type,
            postData.title,
            postData.content,
            JSON.stringify(postData.imageUrls || {}),
            postData.videoUrl,
            JSON.stringify(postData.cameraSettings || {}),
            postData.location,
            postData.price,
            postData.tags || []
        ];
        const result = await this.pool.query(query, values);
        return result.rows[0];
    }

    async getPosts(options = {}) {
        const { type, userId, limit = 20, offset = 0, sortBy = 'created_at' } = options;
        let query = 'SELECT * FROM community_posts WHERE 1=1';
        const values = [];
        let paramCount = 1;

        if (type) {
            query += ` AND type = $${paramCount}`;
            values.push(type);
            paramCount++;
        }

        if (userId) {
            query += ` AND user_id = $${paramCount}`;
            values.push(userId);
            paramCount++;
        }

        query += ` ORDER BY ${sortBy} DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        values.push(limit, offset);

        const result = await this.pool.query(query, values);
        
        // Parse JSON fields
        return result.rows.map(row => ({
            ...row,
            imageUrls: typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : row.image_urls,
            cameraSettings: typeof row.camera_settings === 'string' ? JSON.parse(row.camera_settings) : row.camera_settings
        }));
    }

    async getPostById(postId) {
        const result = await this.pool.query(
            'SELECT * FROM community_posts WHERE id = $1',
            [postId]
        );
        
        if (result.rows[0]) {
            const row = result.rows[0];
            return {
                ...row,
                imageUrls: typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : row.image_urls,
                cameraSettings: typeof row.camera_settings === 'string' ? JSON.parse(row.camera_settings) : row.camera_settings
            };
        }
        return null;
    }

    async updatePostStats(postId, field, increment = 1) {
        const query = `
            UPDATE community_posts 
            SET ${field} = ${field} + $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;
        const result = await this.pool.query(query, [increment, postId]);
        return result.rows[0];
    }

    // Like operations
    async toggleLike(userId, postId) {
        try {
            // Check if like exists
            const existingLike = await this.pool.query(
                'SELECT * FROM community_likes WHERE user_id = $1 AND post_id = $2',
                [userId, postId]
            );

            if (existingLike.rows.length > 0) {
                // Unlike
                await this.pool.query(
                    'DELETE FROM community_likes WHERE user_id = $1 AND post_id = $2',
                    [userId, postId]
                );
                await this.updatePostStats(postId, 'likes_count', -1);
                return { liked: false };
            } else {
                // Like
                await this.pool.query(
                    'INSERT INTO community_likes (user_id, post_id) VALUES ($1, $2)',
                    [userId, postId]
                );
                await this.updatePostStats(postId, 'likes_count', 1);
                return { liked: true };
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            throw error;
        }
    }

    // Comment operations
    async createComment(commentData) {
        const query = `
            INSERT INTO community_comments (
                post_id, user_id, user_name, user_avatar, parent_comment_id, content
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const values = [
            commentData.postId,
            commentData.userId,
            commentData.userName,
            commentData.userAvatar,
            commentData.parentCommentId || null,
            commentData.content
        ];
        const result = await this.pool.query(query, values);
        
        // Update comment count on post
        await this.updatePostStats(commentData.postId, 'comments_count', 1);
        
        return result.rows[0];
    }

    async getComments(postId) {
        const result = await this.pool.query(
            'SELECT * FROM community_comments WHERE post_id = $1 ORDER BY created_at ASC',
            [postId]
        );
        return result.rows;
    }

    // Message operations
    async sendMessage(messageData) {
        const query = `
            INSERT INTO community_messages (
                sender_id, sender_name, receiver_id, receiver_name, message
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const values = [
            messageData.senderId,
            messageData.senderName,
            messageData.receiverId,
            messageData.receiverName,
            messageData.message
        ];
        const result = await this.pool.query(query, values);
        return result.rows[0];
    }

    async getMessages(userId1, userId2) {
        const query = `
            SELECT * FROM community_messages 
            WHERE (sender_id = $1 AND receiver_id = $2) 
               OR (sender_id = $2 AND receiver_id = $1)
            ORDER BY created_at ASC
        `;
        const result = await this.pool.query(query, [userId1, userId2]);
        return result.rows;
    }

    async markMessagesAsRead(receiverId, senderId) {
        const query = `
            UPDATE community_messages 
            SET is_read = true 
            WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false
        `;
        await this.pool.query(query, [receiverId, senderId]);
    }

    // Profile operations
    async getOrCreateProfile(userId, displayName) {
        // Try to get existing profile
        let result = await this.pool.query(
            'SELECT * FROM community_profiles WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            // Create new profile
            const insertQuery = `
                INSERT INTO community_profiles (user_id, display_name)
                VALUES ($1, $2)
                RETURNING *
            `;
            result = await this.pool.query(insertQuery, [userId, displayName]);
        }

        return result.rows[0];
    }

    async updateProfile(userId, updates) {
        const fields = [];
        const values = [];
        let paramCount = 1;

        Object.keys(updates).forEach(key => {
            fields.push(`${key} = $${paramCount}`);
            values.push(updates[key]);
            paramCount++;
        });

        values.push(userId);
        const query = `
            UPDATE community_profiles 
            SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $${paramCount}
            RETURNING *
        `;

        const result = await this.pool.query(query, values);
        return result.rows[0];
    }

    // Save operations
    async toggleSave(userId, postId) {
        try {
            // Check if save exists
            const existingSave = await this.pool.query(
                'SELECT * FROM community_saves WHERE user_id = $1 AND post_id = $2',
                [userId, postId]
            );

            if (existingSave.rows.length > 0) {
                // Unsave
                await this.pool.query(
                    'DELETE FROM community_saves WHERE user_id = $1 AND post_id = $2',
                    [userId, postId]
                );
                await this.updatePostStats(postId, 'saves_count', -1);
                return { saved: false };
            } else {
                // Save
                await this.pool.query(
                    'INSERT INTO community_saves (user_id, post_id) VALUES ($1, $2)',
                    [userId, postId]
                );
                await this.updatePostStats(postId, 'saves_count', 1);
                return { saved: true };
            }
        } catch (error) {
            console.error('Error toggling save:', error);
            throw error;
        }
    }

    // Follow operations
    async toggleFollow(followerId, followingId) {
        try {
            // Check if follow exists
            const existingFollow = await this.pool.query(
                'SELECT * FROM community_follows WHERE follower_id = $1 AND following_id = $2',
                [followerId, followingId]
            );

            if (existingFollow.rows.length > 0) {
                // Unfollow
                await this.pool.query(
                    'DELETE FROM community_follows WHERE follower_id = $1 AND following_id = $2',
                    [followerId, followingId]
                );
                return { following: false };
            } else {
                // Follow
                await this.pool.query(
                    'INSERT INTO community_follows (follower_id, following_id) VALUES ($1, $2)',
                    [followerId, followingId]
                );
                return { following: true };
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
            throw error;
        }
    }

    // Delete post
    async deletePost(postId) {
        try {
            const query = 'DELETE FROM community_posts WHERE id = $1 RETURNING *';
            const result = await this.pool.query(query, [postId]);
            return result.rows[0];
        } catch (error) {
            console.error('Error deleting post:', error);
            throw error;
        }
    }

    // Search operations
    async searchPosts(searchTerm, filters = {}) {
        let query = `
            SELECT * FROM community_posts 
            WHERE (title ILIKE $1 OR content ILIKE $1 OR $1 = ANY(tags))
        `;
        const values = [`%${searchTerm}%`];
        let paramCount = 2;

        if (filters.type) {
            query += ` AND type = $${paramCount}`;
            values.push(filters.type);
            paramCount++;
        }

        query += ' ORDER BY created_at DESC LIMIT 50';
        
        const result = await this.pool.query(query, values);
        return result.rows;
    }
}

module.exports = CommunityDatabase;