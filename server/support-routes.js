// Support Routes for Photography Platform
const express = require('express');
const router = express.Router();

function createSupportRoutes(supportSystem, isAuthenticated) {
    
    // Create support ticket
    router.post('/tickets', isAuthenticated, async (req, res) => {
        try {
            const {
                subject,
                category,
                priority,
                description,
                sessionId,
                clientAffected
            } = req.body;

            if (!subject || !category || !description) {
                return res.status(400).json({
                    success: false,
                    error: 'Subject, category, and description are required'
                });
            }

            const ticketData = {
                userEmail: req.user.email,
                photographerEmail: req.user.email,
                subject,
                category,
                priority: priority || 'medium',
                description,
                sessionId,
                clientAffected: clientAffected || false,
                userAgent: req.get('User-Agent'),
                ipAddress: req.ip
            };

            const result = await supportSystem.createSupportTicket(ticketData);

            res.json({
                success: true,
                ticketId: result.ticketId,
                estimatedResponse: result.estimatedResponse,
                message: 'Support ticket created successfully'
            });

        } catch (error) {
            console.error('Error creating support ticket:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create support ticket'
            });
        }
    });

    // Handle client issues automatically
    router.post('/client-issue', isAuthenticated, async (req, res) => {
        try {
            const { issueType, sessionId } = req.body;

            if (!issueType || !sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Issue type and session ID are required'
                });
            }

            const result = await supportSystem.handleClientIssue(
                issueType, 
                sessionId, 
                req.user.email
            );

            if (result.resolved) {
                res.json({
                    success: true,
                    resolved: true,
                    message: result.message,
                    details: result
                });
            } else {
                // Create support ticket if auto-resolution failed
                const ticketData = {
                    userEmail: req.user.email,
                    photographerEmail: req.user.email,
                    subject: `Client Issue: ${issueType}`,
                    category: 'client_support',
                    priority: 'high',
                    description: `Automatic resolution failed for ${issueType} on session ${sessionId}. ${result.message || result.error}`,
                    sessionId,
                    clientAffected: true,
                    userAgent: req.get('User-Agent'),
                    ipAddress: req.ip
                };

                const ticket = await supportSystem.createSupportTicket(ticketData);

                res.json({
                    success: true,
                    resolved: false,
                    ticketCreated: true,
                    ticketId: ticket.ticketId,
                    message: 'Issue escalated to support team',
                    estimatedResponse: ticket.estimatedResponse
                });
            }

        } catch (error) {
            console.error('Error handling client issue:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to handle client issue'
            });
        }
    });

    // Get user's support tickets
    router.get('/tickets', isAuthenticated, async (req, res) => {
        try {
            const result = await supportSystem.pool.query(`
                SELECT ticket_id, subject, category, priority, status, 
                       client_affected, created_at, resolved_at
                FROM support_tickets 
                WHERE photographer_email = $1 
                ORDER BY created_at DESC 
                LIMIT 50
            `, [req.user.email]);

            res.json({
                success: true,
                tickets: result.rows
            });

        } catch (error) {
            console.error('Error fetching support tickets:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch support tickets'
            });
        }
    });

    // Get specific ticket details
    router.get('/tickets/:ticketId', isAuthenticated, async (req, res) => {
        try {
            const { ticketId } = req.params;

            const result = await supportSystem.pool.query(`
                SELECT * FROM support_tickets 
                WHERE ticket_id = $1 AND photographer_email = $2
            `, [ticketId, req.user.email]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Ticket not found'
                });
            }

            res.json({
                success: true,
                ticket: result.rows[0]
            });

        } catch (error) {
            console.error('Error fetching ticket details:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch ticket details'
            });
        }
    });

    // Quick help for common issues
    router.post('/quick-help', isAuthenticated, async (req, res) => {
        try {
            const { issue, sessionId } = req.body;

            const quickSolutions = {
                'gallery_not_loading': {
                    steps: [
                        'Check that the gallery link is correct and complete',
                        'Try opening the link in a private/incognito browser window',
                        'Clear browser cache and cookies',
                        'Ensure the session has photos uploaded',
                        'Verify the gallery is published and not in draft mode'
                    ],
                    autoFix: sessionId ? await supportSystem.handleClientIssue('gallery_not_loading', sessionId, req.user.email) : null
                },
                'download_failed': {
                    steps: [
                        'Right-click the download button and select "Save link as"',
                        'Check available storage space on device',
                        'Try downloading one photo at a time instead of all',
                        'Disable browser extensions that might block downloads',
                        'Try a different browser or device'
                    ],
                    autoFix: sessionId ? await supportSystem.handleClientIssue('download_failed', sessionId, req.user.email) : null
                },
                'payment_failed': {
                    steps: [
                        'Verify card details are correct (number, expiry, CVV)',
                        'Check that billing address matches card address',
                        'Ensure sufficient funds are available',
                        'Try a different payment method',
                        'Contact your bank if the card is being declined'
                    ],
                    autoFix: null
                },
                'client_cant_access': {
                    steps: [
                        'Verify the gallery link was sent correctly',
                        'Check if gallery password is required and share it',
                        'Ensure gallery is published (not in draft)',
                        'Ask client to try different browser or device',
                        'Check if gallery has expiration date that passed'
                    ],
                    autoFix: sessionId ? await supportSystem.handleClientIssue('gallery_not_loading', sessionId, req.user.email) : null
                }
            };

            const solution = quickSolutions[issue];
            if (!solution) {
                return res.status(400).json({
                    success: false,
                    error: 'Unknown issue type'
                });
            }

            res.json({
                success: true,
                issue,
                steps: solution.steps,
                autoFix: solution.autoFix,
                resolved: solution.autoFix?.resolved || false
            });

        } catch (error) {
            console.error('Error providing quick help:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to provide quick help'
            });
        }
    });

    return router;
}

module.exports = createSupportRoutes;