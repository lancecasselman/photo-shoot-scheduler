const express = require('express');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

function createBookingAgreementRoutes(pool) {
    const router = express.Router();

    // Initialize database tables
    async function initializeTables() {
        const client = await pool.connect();
        try {
            // Create booking agreement templates table
            await client.query(`
                CREATE TABLE IF NOT EXISTS booking_agreement_templates (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL,
                    category VARCHAR(100),
                    content TEXT NOT NULL,
                    is_default BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Create booking agreements table
            await client.query(`
                CREATE TABLE IF NOT EXISTS booking_agreements (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    session_id UUID NOT NULL,
                    user_id VARCHAR(255) NOT NULL,
                    template_id UUID REFERENCES booking_agreement_templates(id),
                    content TEXT NOT NULL,
                    status VARCHAR(50) DEFAULT 'draft',
                    access_token VARCHAR(255) UNIQUE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    sent_at TIMESTAMP,
                    viewed_at TIMESTAMP,
                    signed_at TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Create booking agreement signatures table
            await client.query(`
                CREATE TABLE IF NOT EXISTS booking_agreement_signatures (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    agreement_id UUID REFERENCES booking_agreements(id),
                    signer_name VARCHAR(255),
                    signer_email VARCHAR(255),
                    signature_data TEXT,
                    signature_type VARCHAR(50),
                    signed_at TIMESTAMP DEFAULT NOW(),
                    ip_address VARCHAR(45),
                    user_agent TEXT
                )
            `);

            // Create indexes
            await client.query('CREATE INDEX IF NOT EXISTS idx_agreements_session ON booking_agreements(session_id)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_agreements_user ON booking_agreements(user_id)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_agreements_token ON booking_agreements(access_token)');

            console.log(' Booking agreement tables initialized');
        } catch (error) {
            console.error('Error initializing booking agreement tables:', error);
        } finally {
            client.release();
        }
    }

    // Initialize tables on startup
    initializeTables();

    // Get all templates
    router.get('/templates', async (req, res) => {
        try {
            console.log('Fetching booking agreement templates...');
            const client = await pool.connect();
            try {
                const result = await client.query(
                    'SELECT * FROM booking_agreement_templates ORDER BY category, name'
                );
                console.log(`Found ${result.rows.length} booking agreement templates`);
                res.json(result.rows);
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching booking agreement templates:', error);
            res.status(500).json({ error: 'Failed to fetch templates', details: error.message });
        }
    });

    // Create or update agreement
    router.post('/agreements', async (req, res) => {
        try {
            const { sessionId, templateId, content, agreementId } = req.body;
            const userId = req.session?.user?.uid || '44735007';

            const client = await pool.connect();
            try {
                if (agreementId) {
                    // Update existing agreement
                    const result = await client.query(
                        `UPDATE booking_agreements 
                         SET content = $1, template_id = $2, updated_at = NOW()
                         WHERE id = $3 AND user_id = $4
                         RETURNING *`,
                        [content, templateId, agreementId, userId]
                    );
                    res.json(result.rows[0]);
                } else {
                    // Create new agreement
                    const accessToken = uuidv4();
                    const result = await client.query(
                        `INSERT INTO booking_agreements 
                         (session_id, user_id, template_id, content, access_token, status)
                         VALUES ($1, $2, $3, $4, $5, 'draft')
                         RETURNING *`,
                        [sessionId, userId, templateId, content, accessToken]
                    );
                    res.json(result.rows[0]);
                }
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error saving agreement:', error);
            res.status(500).json({ error: 'Failed to save agreement' });
        }
    });

    // Get all agreements for the current user (for signed/pending contracts view)
    router.get('/agreements/all', async (req, res) => {
        try {
            const userId = req.session?.user?.normalized_uid || req.session?.user?.uid;
            
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const client = await pool.connect();
            try {
                const result = await client.query(
                    `SELECT 
                        a.*,
                        s.client_name as session_client_name,
                        s.session_type,
                        s.date_time as session_date
                     FROM booking_agreements a
                     INNER JOIN photography_sessions s ON a.session_id::text = s.id::text
                     WHERE a.user_id = $1 AND s.user_id = $1
                     ORDER BY a.created_at DESC`,
                    [userId]
                );
                
                console.log(`📄 Found ${result.rows.length} agreements for user ${userId}`);
                // Log agreement statuses for debugging
                result.rows.forEach(agreement => {
                    console.log(`  - ${agreement.session_client_name}: ${agreement.status} (Session: ${agreement.session_id})`);
                });
                res.json(result.rows);
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching all agreements:', error);
            res.status(500).json({ error: 'Failed to fetch agreements' });
        }
    });

    // Get agreement by session ID
    router.get('/agreements/session/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const userId = req.session?.user?.uid || '44735007';

            const client = await pool.connect();
            try {
                const result = await client.query(
                    `SELECT a.*, t.name as template_name, s.signature_data, s.signer_name, s.signed_at as signature_date
                     FROM booking_agreements a
                     LEFT JOIN booking_agreement_templates t ON a.template_id = t.id
                     LEFT JOIN booking_agreement_signatures s ON a.id = s.agreement_id
                     WHERE a.session_id = $1 AND a.user_id = $2
                     ORDER BY a.created_at DESC
                     LIMIT 1`,
                    [sessionId, userId]
                );
                res.json(result.rows[0] || null);
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching agreement:', error);
            res.status(500).json({ error: 'Failed to fetch agreement' });
        }
    });

    // Send agreement for signature
    router.post('/agreements/:id/send', async (req, res) => {
        try {
            const { id } = req.params;
            const { clientEmail, clientPhone, clientName, sessionType, sessionDate, sendMethod } = req.body;
            const userId = req.session?.user?.uid || '44735007';

            const client = await pool.connect();
            try {
                // Get photographer details for the email
                const photographerResult = await client.query(
                    `SELECT business_name, email FROM users WHERE id = $1`,
                    [userId]
                );
                
                const photographer = photographerResult.rows[0] || {
                    business_name: 'Photography Studio',
                    email: 'noreply@photomanagementsystem.com'
                };

                // Update agreement status
                const result = await client.query(
                    `UPDATE booking_agreements 
                     SET status = 'sent', sent_at = NOW(), updated_at = NOW()
                     WHERE id = $1 AND user_id = $2
                     RETURNING *`,
                    [id, userId]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Agreement not found' });
                }

                const agreement = result.rows[0];
                
                // Generate the full signing URL
                const baseUrl = process.env.NODE_ENV === 'production' 
                    ? 'https://photomanagementsystem.com' 
                    : `https://${req.get('host')}`;
                const signingUrl = `${baseUrl}/sign/${agreement.access_token}`;

                // Send based on method
                const { sendContractForSignature, sendContractViaSMS } = require('./notifications');
                
                if (sendMethod === 'sms' && clientPhone) {
                    // Prepare SMS using default SMS app
                    const smsResult = await sendContractViaSMS(
                        clientPhone,
                        clientName,
                        sessionType || 'Photography',
                        photographer.business_name,
                        signingUrl
                    );

                    if (smsResult.success) {
                        console.log(`📱 Contract SMS prepared for ${clientPhone}`);
                        res.json({ 
                            success: true, 
                            message: 'Open your default SMS app to send the contract',
                            signingUrl: signingUrl,
                            sendMethod: 'sms',
                            smsUrl: smsResult.smsUrl,
                            requiresUserAction: true
                        });
                    } else {
                        console.error('❌ Failed to prepare SMS:', smsResult.error);
                        res.json({ 
                            success: true, 
                            message: 'Agreement ready. Share the link manually.',
                            signingUrl: signingUrl,
                            sendMethod: 'manual',
                            smsError: smsResult.error
                        });
                    }
                } else {
                    // Prepare email using default email app
                    const emailResult = await sendContractForSignature(
                        clientEmail,
                        clientName,
                        sessionType || 'Photography',
                        sessionDate || 'TBD',
                        photographer.business_name,
                        photographer.email,
                        signingUrl
                    );

                    if (emailResult.success) {
                        console.log(`📧 Contract email prepared for ${clientEmail}`);
                        res.json({ 
                            success: true, 
                            message: 'Open your default email app to send the contract',
                            signingUrl: signingUrl,
                            sendMethod: 'email',
                            mailtoUrl: emailResult.mailtoUrl,
                            requiresUserAction: true
                        });
                    } else {
                        console.error('❌ Failed to prepare email:', emailResult.error);
                        res.json({ 
                            success: true, 
                            message: 'Agreement ready. Share the link manually.',
                            signingUrl: signingUrl,
                            sendMethod: 'manual',
                            emailError: emailResult.error
                        });
                    }
                }
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error sending agreement:', error);
            res.status(500).json({ error: 'Failed to send agreement' });
        }
    });

    // Get agreement for signing (public endpoint)
    router.get('/sign/:token', async (req, res) => {
        try {
            const { token } = req.params;

            const client = await pool.connect();
            try {
                // Mark as viewed
                await client.query(
                    `UPDATE booking_agreements 
                     SET viewed_at = COALESCE(viewed_at, NOW()), status = 
                     CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
                     WHERE access_token = $1`,
                    [token]
                );

                const result = await client.query(
                    'SELECT * FROM booking_agreements WHERE access_token = $1',
                    [token]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Agreement not found' });
                }

                res.json(result.rows[0]);
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching agreement for signing:', error);
            res.status(500).json({ error: 'Failed to fetch agreement' });
        }
    });

    // Submit signature
    router.post('/sign/:token', async (req, res) => {
        try {
            const { token } = req.params;
            const { signerName, signerEmail, signatureData, signatureType, ipAddress, userAgent } = req.body;

            console.log('🖊️ SIGNATURE SUBMISSION DEBUG:', {
                token: token,
                signerName: signerName,
                signerEmail: signerEmail,
                hasSignatureData: !!signatureData,
                signatureType: signatureType,
                ipAddress: ipAddress,
                userAgent: userAgent?.substring(0, 50) + '...'
            });

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Get agreement
                const agreementResult = await client.query(
                    'SELECT * FROM booking_agreements WHERE access_token = $1',
                    [token]
                );

                if (agreementResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Agreement not found' });
                }

                const agreement = agreementResult.rows[0];

                // Save signature
                await client.query(
                    `INSERT INTO booking_agreement_signatures 
                     (agreement_id, signer_name, signer_email, signature_data, signature_type, ip_address, user_agent)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [agreement.id, signerName, signerEmail, signatureData, signatureType, ipAddress, userAgent]
                );

                // Update agreement status
                await client.query(
                    `UPDATE booking_agreements 
                     SET status = 'signed', signed_at = NOW(), updated_at = NOW()
                     WHERE id = $1`,
                    [agreement.id]
                );

                // Update session contract status  
                await client.query(
                    `UPDATE photography_sessions 
                     SET contract_signed = true, updated_at = NOW()
                     WHERE id = $1::text`,
                    [agreement.session_id]
                );

                await client.query('COMMIT');

                console.log('✅ SIGNATURE SAVED SUCCESSFULLY:', {
                    agreementId: agreement.id,
                    sessionId: agreement.session_id,
                    signerName: signerName,
                    timestamp: new Date().toISOString()
                });

                res.json({ 
                    success: true, 
                    message: 'Agreement signed successfully',
                    agreementId: agreement.id,
                    sessionId: agreement.session_id
                });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error signing agreement:', error);
            res.status(500).json({ error: 'Failed to sign agreement' });
        }
    });

    // Get signatures for a specific agreement
    router.get('/agreements/:agreementId/signatures', async (req, res) => {
        try {
            const { agreementId } = req.params;

            const client = await pool.connect();
            try {
                const result = await client.query(
                    `SELECT * FROM booking_agreement_signatures 
                     WHERE agreement_id = $1 
                     ORDER BY created_at DESC`,
                    [agreementId]
                );

                res.json(result.rows);
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching agreement signatures:', error);
            res.status(500).json({ error: 'Failed to fetch signatures' });
        }
    });

    // Get agreement status for multiple sessions
    router.post('/agreements/status', async (req, res) => {
        try {
            const { sessionIds } = req.body;
            console.log('Fetching agreement statuses for sessions:', sessionIds);
            
            // Get user ID from session with fallback
            const userId = req.session?.user?.normalized_uid || req.session?.user?.uid || '44735007';
            console.log('Using user ID for agreement status:', userId);

            if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
                return res.json({});
            }

            const client = await pool.connect();
            try {
                const result = await client.query(
                    `SELECT session_id, status, signed_at 
                     FROM booking_agreements 
                     WHERE session_id = ANY($1) AND user_id = $2`,
                    [sessionIds, userId]
                );

                console.log(`Found ${result.rows.length} booking agreements for ${sessionIds.length} sessions`);

                const statusMap = {};
                result.rows.forEach(row => {
                    statusMap[row.session_id] = {
                        status: row.status,
                        signedAt: row.signed_at
                    };
                });

                console.log('Returning agreement status map:', statusMap);
                res.json(statusMap);
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching agreement statuses:', error);
            res.status(500).json({ error: 'Failed to fetch agreement statuses', details: error.message });
        }
    });

    // View agreement by ID (for direct viewing)
    router.get('/agreements/view/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const client = await pool.connect();
            try {
                const result = await client.query(
                    `SELECT a.*, s.client_name, s.session_type, s.date_time
                     FROM booking_agreements a
                     JOIN sessions s ON a.session_id = s.id
                     WHERE a.id = $1`,
                    [id]
                );
                
                if (result.rows.length === 0) {
                    return res.status(404).send('<h1>Contract not found</h1>');
                }
                
                const agreement = result.rows[0];
                
                // Simple HTML view of the contract
                const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${agreement.client_name} - ${agreement.session_type} Contract</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .content { line-height: 1.6; }
                        .status { padding: 5px 10px; border-radius: 4px; display: inline-block; }
                        .status.sent { background: #fbbf24; color: #78350f; }
                        .status.signed { background: #10b981; color: white; }
                        .status.viewed { background: #3b82f6; color: white; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Photography Contract</h1>
                        <p>Client: ${agreement.client_name}</p>
                        <p>Session: ${agreement.session_type} - ${new Date(agreement.date_time).toLocaleDateString()}</p>
                        <p>Status: <span class="status ${agreement.status}">${agreement.status.toUpperCase()}</span></p>
                    </div>
                    <div class="content">
                        ${agreement.content}
                    </div>
                    ${agreement.status !== 'signed' ? `
                        <div style="text-align: center; margin-top: 30px;">
                            <p style="color: #666;">To sign this contract, please access it through the link sent to you.</p>
                        </div>
                    ` : ''}
                </body>
                </html>
                `;
                
                res.send(html);
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error viewing agreement:', error);
            res.status(500).send('<h1>Error loading contract</h1>');
        }
    });

    // Get all pending contracts for the current user
    router.get('/agreements/pending', async (req, res) => {
        try {
            const userId = req.session?.user?.normalized_uid || req.session?.user?.uid || '44735007';
            console.log('Fetching pending contracts for user:', userId);
            
            const client = await pool.connect();
            try {
                const result = await client.query(
                    `SELECT 
                        a.id,
                        a.session_id,
                        a.status,
                        a.created_at,
                        a.sent_at,
                        s.client_name,
                        s.email as client_email,
                        s.phone_number as client_phone,
                        s.session_type,
                        s.date_time as session_date
                     FROM booking_agreements a
                     JOIN photography_sessions s ON a.session_id::text = s.id::text
                     WHERE a.user_id = $1 
                     AND a.status IN ('sent', 'viewed', 'draft')
                     ORDER BY a.created_at DESC`,
                    [userId]
                );
                
                console.log(`Found ${result.rows.length} pending contracts`);
                res.json(result.rows);
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching pending contracts:', error);
            res.status(500).json({ error: 'Failed to fetch pending contracts' });
        }
    });

    // Get pending contract for a specific session
    router.get('/agreements/session/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const userId = req.session?.user?.normalized_uid || req.session?.user?.uid || '44735007';
            console.log('Fetching contract for session:', sessionId, 'user:', userId);
            
            const client = await pool.connect();
            try {
                const result = await client.query(
                    `SELECT 
                        a.id,
                        a.session_id,
                        a.status,
                        a.created_at,
                        a.sent_at,
                        s.client_name,
                        s.email as client_email,
                        s.phone_number as client_phone,
                        s.session_type,
                        s.date_time as session_date
                     FROM booking_agreements a
                     JOIN photography_sessions s ON a.session_id::text = s.id::text
                     WHERE a.session_id = $1 
                     AND a.user_id = $2 
                     AND a.status IN ('sent', 'viewed', 'draft')
                     ORDER BY a.created_at DESC
                     LIMIT 1`,
                    [sessionId, userId]
                );
                
                if (result.rows.length > 0) {
                    console.log(`Found contract for session ${sessionId}:`, result.rows[0].status);
                    res.json(result.rows[0]);
                } else {
                    console.log(`No pending contract found for session ${sessionId}`);
                    res.status(404).json({ error: 'No pending contract found for this session' });
                }
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching session contract:', error);
            res.status(500).json({ error: 'Failed to fetch session contract' });
        }
    });

    // Cancel contract by agreement ID
    router.post('/agreements/:id/cancel', async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.session?.user?.normalized_uid || req.session?.user?.uid;
            
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            
            console.log('Cancelling contract:', id, 'by user:', userId);
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // Check if agreement exists and belongs to user
                const checkResult = await client.query(
                    'SELECT * FROM booking_agreements WHERE id = $1 AND user_id = $2',
                    [id, userId]
                );
                
                if (checkResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Agreement not found' });
                }
                
                const agreement = checkResult.rows[0];
                
                // Only allow cancelling pending contracts
                if (agreement.status === 'signed') {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Cannot cancel a signed contract' });
                }
                
                // Update agreement status to cancelled
                await client.query(
                    `UPDATE booking_agreements 
                     SET status = 'cancelled', 
                         updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $1 AND user_id = $2`,
                    [id, userId]
                );
                
                // Update session contract_signed to false
                await client.query(
                    `UPDATE sessions 
                     SET contract_signed = false,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 AND user_id = $2`,
                    [agreement.session_id, userId]
                );
                
                await client.query('COMMIT');
                
                res.json({ 
                    success: true, 
                    message: 'Contract cancelled successfully',
                    status: 'cancelled'
                });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error cancelling contract:', error);
            res.status(500).json({ error: 'Failed to cancel contract' });
        }
    });

    // Cancel contract endpoint (legacy - by session ID)
    router.post('/booking-agreements/:sessionId/cancel', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const userId = req.session?.user?.normalized_uid || req.session?.user?.uid;
            
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            
            console.log('Cancelling contract for session:', sessionId, 'by user:', userId);
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // Check if agreement exists and belongs to user
                const checkResult = await client.query(
                    'SELECT * FROM booking_agreements WHERE session_id = $1 AND user_id = $2',
                    [sessionId, userId]
                );
                
                if (checkResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Agreement not found' });
                }
                
                const agreement = checkResult.rows[0];
                
                // Only allow cancelling pending contracts (sent, viewed)
                if (agreement.status === 'signed') {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Cannot cancel a signed contract' });
                }
                
                // Update agreement status to cancelled
                await client.query(
                    `UPDATE booking_agreements 
                     SET status = 'cancelled', 
                         updated_at = CURRENT_TIMESTAMP 
                     WHERE session_id = $1 AND user_id = $2`,
                    [sessionId, userId]
                );
                
                // Update session contract_signed to false (if it was set)
                await client.query(
                    `UPDATE sessions 
                     SET contract_signed = false,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 AND user_id = $2`,
                    [sessionId, userId]
                );
                
                await client.query('COMMIT');
                
                res.json({ 
                    success: true, 
                    message: 'Contract cancelled successfully',
                    status: 'cancelled'
                });
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error cancelling contract:', error);
            res.status(500).json({ error: 'Failed to cancel contract' });
        }
    });

    return router;
}

module.exports = createBookingAgreementRoutes;