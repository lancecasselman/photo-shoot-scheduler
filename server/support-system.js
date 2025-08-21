// Client Support System for Photography Platform
const nodemailer = require('nodemailer');

class SupportSystem {
    constructor(pool, emailConfig) {
        this.pool = pool;
        this.emailConfig = emailConfig;
        this.supportEmail = process.env.SUPPORT_EMAIL || 'support@photographyplatform.com';
        this.setupEmailTransporter();
    }

    setupEmailTransporter() {
        if (process.env.SENDGRID_API_KEY) {
            this.transporter = nodemailer.createTransporter({
                service: 'SendGrid',
                auth: {
                    user: 'apikey',
                    pass: process.env.SENDGRID_API_KEY
                }
            });
        }
    }

    // Create support ticket
    async createSupportTicket(ticketData) {
        const {
            userEmail,
            photographerEmail,
            subject,
            category,
            priority,
            description,
            sessionId,
            clientAffected,
            userAgent,
            ipAddress
        } = ticketData;

        try {
            const ticketId = `PHOTO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            
            // Store ticket in database
            const result = await this.pool.query(`
                INSERT INTO support_tickets 
                (ticket_id, user_email, photographer_email, subject, category, priority, 
                 description, session_id, client_affected, status, user_agent, ip_address, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', $10, $11, NOW())
                RETURNING id
            `, [ticketId, userEmail, photographerEmail, subject, category, priority, 
                description, sessionId, clientAffected, userAgent, ipAddress]);

            // Send confirmation email to user
            await this.sendTicketConfirmation(userEmail, ticketId, subject);

            // Send notification to support team
            await this.notifySupportTeam(ticketData, ticketId);

            // Auto-escalate high priority tickets
            if (priority === 'urgent' || priority === 'high') {
                await this.escalateTicket(ticketId, priority);
            }

            return {
                success: true,
                ticketId,
                estimatedResponse: this.getEstimatedResponseTime(priority)
            };

        } catch (error) {
            console.error('Error creating support ticket:', error);
            throw error;
        }
    }

    // Handle common client issues automatically
    async handleClientIssue(issueType, sessionId, photographerEmail) {
        try {
            switch (issueType) {
                case 'gallery_not_loading':
                    return await this.fixGalleryAccess(sessionId);
                
                case 'download_failed':
                    return await this.regenerateDownloadLinks(sessionId);
                
                case 'password_reset':
                    return await this.resetGalleryPassword(sessionId);
                
                case 'missing_photos':
                    return await this.verifyPhotoIntegrity(sessionId);
                
                default:
                    return { resolved: false, message: 'Issue requires manual review' };
            }
        } catch (error) {
            console.error(`Error handling client issue ${issueType}:`, error);
            return { resolved: false, error: error.message };
        }
    }

    // Fix gallery access issues
    async fixGalleryAccess(sessionId) {
        try {
            // Verify session exists
            const session = await this.pool.query(
                'SELECT * FROM sessions WHERE id = $1', [sessionId]
            );

            if (session.rows.length === 0) {
                return { resolved: false, message: 'Session not found' };
            }

            // Regenerate gallery access token
            const newToken = Math.random().toString(36).substr(2, 15);
            await this.pool.query(
                'UPDATE sessions SET gallery_token = $1, updated_at = NOW() WHERE id = $2',
                [newToken, sessionId]
            );

            // Clear any cached gallery data
            await this.clearGalleryCache(sessionId);

            return {
                resolved: true,
                message: 'Gallery access restored',
                newGalleryUrl: `/gallery/${sessionId}?token=${newToken}`
            };

        } catch (error) {
            return { resolved: false, error: error.message };
        }
    }

    // Regenerate download links
    async regenerateDownloadLinks(sessionId) {
        try {
            // Get all photos for session
            const photos = await this.pool.query(
                'SELECT * FROM session_photos WHERE session_id = $1', [sessionId]
            );

            if (photos.rows.length === 0) {
                return { resolved: false, message: 'No photos found for session' };
            }

            // Generate new secure download tokens
            const updatePromises = photos.rows.map(photo => {
                const newToken = Math.random().toString(36).substr(2, 20);
                return this.pool.query(
                    'UPDATE session_photos SET download_token = $1 WHERE id = $2',
                    [newToken, photo.id]
                );
            });

            await Promise.all(updatePromises);

            return {
                resolved: true,
                message: 'Download links regenerated successfully',
                photosUpdated: photos.rows.length
            };

        } catch (error) {
            return { resolved: false, error: error.message };
        }
    }

    // Send ticket confirmation
    async sendTicketConfirmation(userEmail, ticketId, subject) {
        if (!this.transporter) return;

        const emailContent = `
            <h2>Support Ticket Created</h2>
            <p>Hi there,</p>
            <p>We've received your support request and our team is on it!</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <strong>Ticket ID:</strong> ${ticketId}<br>
                <strong>Subject:</strong> ${subject}<br>
                <strong>Status:</strong> Open
            </div>
            
            <p>Our support team will respond within 24 hours. For urgent issues, please call our priority support line.</p>
            
            <p>You can reply to this email to add more details to your ticket.</p>
            
            <p>Best regards,<br>
            Photography Platform Support Team</p>
        `;

        try {
            await this.transporter.sendMail({
                from: this.supportEmail,
                to: userEmail,
                subject: `Support Ticket Created: ${ticketId}`,
                html: emailContent
            });
        } catch (error) {
            console.error('Error sending ticket confirmation:', error);
        }
    }

    // Notify support team
    async notifySupportTeam(ticketData, ticketId) {
        if (!this.transporter) return;

        const urgencyFlag = ticketData.priority === 'urgent' ? '🚨 URGENT' : '';
        const clientImpact = ticketData.clientAffected ? '👥 CLIENT AFFECTED' : '';

        const emailContent = `
            <h2>${urgencyFlag} New Support Ticket: ${ticketId}</h2>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
                <strong>Photographer:</strong> ${ticketData.photographerEmail}<br>
                <strong>Category:</strong> ${ticketData.category}<br>
                <strong>Priority:</strong> ${ticketData.priority}<br>
                <strong>Session ID:</strong> ${ticketData.sessionId || 'N/A'}<br>
                ${clientImpact ? `<strong style="color: red;">Client Impact:</strong> Yes<br>` : ''}
            </div>
            
            <h3>Description:</h3>
            <p>${ticketData.description}</p>
            
            <h3>Technical Details:</h3>
            <p><strong>User Agent:</strong> ${ticketData.userAgent}</p>
            <p><strong>IP Address:</strong> ${ticketData.ipAddress}</p>
            
            <p><a href="/admin/tickets/${ticketId}">View Full Ticket</a></p>
        `;

        try {
            await this.transporter.sendMail({
                from: this.supportEmail,
                to: this.supportEmail,
                subject: `${urgencyFlag} New Support Ticket: ${ticketData.subject}`,
                html: emailContent
            });
        } catch (error) {
            console.error('Error notifying support team:', error);
        }
    }

    // Get estimated response time based on priority
    getEstimatedResponseTime(priority) {
        const responseTimes = {
            'urgent': '1-2 hours',
            'high': '4-8 hours',
            'medium': '12-24 hours',
            'low': '24-48 hours'
        };
        return responseTimes[priority] || '24-48 hours';
    }

    // Escalate urgent tickets
    async escalateTicket(ticketId, priority) {
        try {
            // Mark as escalated in database
            await this.pool.query(
                'UPDATE support_tickets SET escalated = true, escalated_at = NOW() WHERE ticket_id = $1',
                [ticketId]
            );

            // Send urgent notification
            if (priority === 'urgent') {
                await this.sendUrgentNotification(ticketId);
            }

        } catch (error) {
            console.error('Error escalating ticket:', error);
        }
    }

    // Send urgent notification (SMS, Slack, etc.)
    async sendUrgentNotification(ticketId) {
        // Integration with SMS service for urgent tickets
        console.log(`🚨 URGENT TICKET ESCALATED: ${ticketId}`);
        // TODO: Add SMS/Slack integration for urgent tickets
    }

    // Initialize support database tables
    async initializeTables() {
        try {
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS support_tickets (
                    id SERIAL PRIMARY KEY,
                    ticket_id VARCHAR(50) UNIQUE NOT NULL,
                    user_email VARCHAR(255) NOT NULL,
                    photographer_email VARCHAR(255),
                    subject VARCHAR(500) NOT NULL,
                    category VARCHAR(100) NOT NULL,
                    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
                    description TEXT NOT NULL,
                    session_id VARCHAR(255),
                    client_affected BOOLEAN DEFAULT false,
                    status VARCHAR(50) DEFAULT 'open',
                    escalated BOOLEAN DEFAULT false,
                    escalated_at TIMESTAMP,
                    resolved_at TIMESTAMP,
                    user_agent TEXT,
                    ip_address VARCHAR(45),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
            `);

            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
            `);

            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_support_tickets_photographer ON support_tickets(photographer_email);
            `);

            console.log(' Support system tables initialized');

        } catch (error) {
            console.error('Error initializing support tables:', error);
        }
    }

    // Helper methods
    async clearGalleryCache(sessionId) {
        // Clear any cached gallery data
        console.log(`Clearing gallery cache for session ${sessionId}`);
    }

    async verifyPhotoIntegrity(sessionId) {
        try {
            const photos = await this.pool.query(
                'SELECT * FROM session_photos WHERE session_id = $1', [sessionId]
            );

            // Check if all photos have valid file references
            const issues = [];
            for (const photo of photos.rows) {
                if (!photo.file_path || !photo.file_size) {
                    issues.push(`Photo ${photo.id} missing file data`);
                }
            }

            return {
                resolved: issues.length === 0,
                message: issues.length === 0 ? 'All photos verified' : 'Photo integrity issues found',
                issues: issues
            };

        } catch (error) {
            return { resolved: false, error: error.message };
        }
    }
}

module.exports = SupportSystem;