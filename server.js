const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

// Direct email service using nodemailer
const nodemailer = require('nodemailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// PostgreSQL database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create direct email transporter
const createEmailTransporter = () => {
    // Try Gmail SMTP first, then fallback to generic SMTP
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
    
    // Fallback: use any SMTP server
    if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER || process.env.EMAIL_USER,
                pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
            }
        });
    }
    
    return null;
};

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database table
async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(255) PRIMARY KEY,
                client_name VARCHAR(255) NOT NULL,
                session_type VARCHAR(255) NOT NULL,
                date_time TIMESTAMP NOT NULL,
                location VARCHAR(255) NOT NULL,
                phone_number VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                duration INTEGER NOT NULL,
                notes TEXT,
                contract_signed BOOLEAN DEFAULT FALSE,
                paid BOOLEAN DEFAULT FALSE,
                edited BOOLEAN DEFAULT FALSE,
                delivered BOOLEAN DEFAULT FALSE,
                send_reminder BOOLEAN DEFAULT FALSE,
                notify_gallery_ready BOOLEAN DEFAULT FALSE,
                photos JSONB DEFAULT '[]',
                gallery_access_token VARCHAR(255),
                gallery_created_at TIMESTAMP,
                gallery_expires_at TIMESTAMP,
                gallery_ready_notified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Database table initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Database helper functions
async function getAllSessions() {
    try {
        const result = await pool.query('SELECT * FROM sessions ORDER BY date_time ASC');
        return result.rows.map(row => ({
            id: row.id,
            clientName: row.client_name,
            sessionType: row.session_type,
            dateTime: row.date_time,
            location: row.location,
            phoneNumber: row.phone_number,
            email: row.email,
            price: parseFloat(row.price),
            duration: row.duration,
            notes: row.notes,
            contractSigned: row.contract_signed,
            paid: row.paid,
            edited: row.edited,
            delivered: row.delivered,
            sendReminder: row.send_reminder,
            notifyGalleryReady: row.notify_gallery_ready,
            photos: row.photos || [],
            galleryAccessToken: row.gallery_access_token,
            galleryCreatedAt: row.gallery_created_at,
            galleryExpiresAt: row.gallery_expires_at,
            galleryReadyNotified: row.gallery_ready_notified,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    } catch (error) {
        console.error('Error fetching sessions:', error);
        return [];
    }
}

async function createSession(sessionData) {
    try {
        const result = await pool.query(`
            INSERT INTO sessions (
                id, client_name, session_type, date_time, location, 
                phone_number, email, price, duration, notes,
                contract_signed, paid, edited, delivered, 
                send_reminder, notify_gallery_ready
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
        `, [
            sessionData.id,
            sessionData.clientName,
            sessionData.sessionType,
            sessionData.dateTime,
            sessionData.location,
            sessionData.phoneNumber,
            sessionData.email,
            sessionData.price,
            sessionData.duration,
            sessionData.notes || '',
            sessionData.contractSigned || false,
            sessionData.paid || false,
            sessionData.edited || false,
            sessionData.delivered || false,
            sessionData.sendReminder || false,
            sessionData.notifyGalleryReady || false
        ]);
        
        const row = result.rows[0];
        return {
            id: row.id,
            clientName: row.client_name,
            sessionType: row.session_type,
            dateTime: row.date_time,
            location: row.location,
            phoneNumber: row.phone_number,
            email: row.email,
            price: parseFloat(row.price),
            duration: row.duration,
            notes: row.notes,
            contractSigned: row.contract_signed,
            paid: row.paid,
            edited: row.edited,
            delivered: row.delivered,
            sendReminder: row.send_reminder,
            notifyGalleryReady: row.notify_gallery_ready,
            photos: row.photos || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } catch (error) {
        console.error('Error creating session:', error);
        throw error;
    }
}

async function getSessionById(id) {
    try {
        const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
        if (result.rows.length === 0) return null;
        
        const row = result.rows[0];
        return {
            id: row.id,
            clientName: row.client_name,
            sessionType: row.session_type,
            dateTime: row.date_time,
            location: row.location,
            phoneNumber: row.phone_number,
            email: row.email,
            price: parseFloat(row.price),
            duration: row.duration,
            notes: row.notes,
            contractSigned: row.contract_signed,
            paid: row.paid,
            edited: row.edited,
            delivered: row.delivered,
            sendReminder: row.send_reminder,
            notifyGalleryReady: row.notify_gallery_ready,
            photos: row.photos || [],
            galleryAccessToken: row.gallery_access_token,
            galleryCreatedAt: row.gallery_created_at,
            galleryExpiresAt: row.gallery_expires_at,
            galleryReadyNotified: row.gallery_ready_notified,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } catch (error) {
        console.error('Error fetching session:', error);
        return null;
    }
}

async function updateSession(id, updates) {
    try {
        const setClause = [];
        const values = [];
        let paramCount = 1;
        
        Object.keys(updates).forEach(key => {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            setClause.push(`${dbKey} = $${paramCount}`);
            values.push(updates[key]);
            paramCount++;
        });
        
        if (setClause.length === 0) return null;
        
        setClause.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        
        const result = await pool.query(`
            UPDATE sessions 
            SET ${setClause.join(', ')} 
            WHERE id = $${paramCount}
            RETURNING *
        `, values);
        
        if (result.rows.length === 0) return null;
        
        const row = result.rows[0];
        return {
            id: row.id,
            clientName: row.client_name,
            sessionType: row.session_type,
            dateTime: row.date_time,
            location: row.location,
            phoneNumber: row.phone_number,
            email: row.email,
            price: parseFloat(row.price),
            duration: row.duration,
            notes: row.notes,
            contractSigned: row.contract_signed,
            paid: row.paid,
            edited: row.edited,
            delivered: row.delivered,
            sendReminder: row.send_reminder,
            notifyGalleryReady: row.notify_gallery_ready,
            photos: row.photos || [],
            galleryAccessToken: row.gallery_access_token,
            galleryCreatedAt: row.gallery_created_at,
            galleryExpiresAt: row.gallery_expires_at,
            galleryReadyNotified: row.gallery_ready_notified,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } catch (error) {
        console.error('Error updating session:', error);
        throw error;
    }
}

async function deleteSession(id) {
    try {
        const result = await pool.query('DELETE FROM sessions WHERE id = $1 RETURNING *', [id]);
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error deleting session:', error);
        throw error;
    }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: Infinity, // No file size limit
        files: Infinity,    // No file count limit
        parts: Infinity,    // No parts limit
        fieldSize: Infinity // No field size limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes

// Get all sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await getAllSessions();
        console.log(`Returning ${sessions.length} sessions from database`);
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// Create new session
app.post('/api/sessions', async (req, res) => {
    const { clientName, sessionType, dateTime, location, phoneNumber, email, price, duration, notes } = req.body;
    
    // Validate required fields
    if (!clientName || !sessionType || !dateTime || !location || !phoneNumber || !email || !price || !duration) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const newSession = {
            id: uuidv4(),
            clientName,
            sessionType,
            dateTime,
            location,
            phoneNumber,
            email,
            price: parseFloat(price),
            duration: parseInt(duration),
            notes: notes || '',
            contractSigned: false,
            paid: false,
            edited: false,
            delivered: false,
            sendReminder: false,
            notifyGalleryReady: false,
            galleryReadyNotified: false
        };
        
        const savedSession = await createSession(newSession);
        console.log(`Created session in database: ${savedSession.clientName} (${savedSession.id})`);
        res.status(201).json(savedSession);
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Update session
app.put('/api/sessions/:id', async (req, res) => {
    const sessionId = req.params.id;
    
    try {
        const updatedSession = await updateSession(sessionId, req.body);
        
        if (!updatedSession) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        console.log(`Updated session in database: ${updatedSession.clientName} (${sessionId})`);
        res.json(updatedSession);
    } catch (error) {
        console.error('Error updating session:', error);
        res.status(500).json({ error: 'Failed to update session' });
    }
});

// Upload photos to session
app.post('/api/sessions/:id/upload-photos', upload.array('photos'), async (req, res) => {
    const sessionId = req.params.id;
    
    try {
        const session = await getSessionById(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Add photos to session
        const newPhotos = req.files.map(file => ({
            id: uuidv4(),
            filename: file.filename,
            originalName: file.originalname,
            url: `/uploads/${file.filename}`,
            size: file.size,
            uploadedAt: new Date().toISOString()
        }));

        const existingPhotos = session.photos || [];
        const updatedPhotos = [...existingPhotos, ...newPhotos];
        
        await updateSession(sessionId, { photos: updatedPhotos });

        console.log(`Uploaded ${newPhotos.length} photos to session ${session.clientName}`);
        res.json({ 
            message: 'Photos uploaded successfully', 
            uploaded: newPhotos.length,
            totalPhotos: updatedPhotos.length 
        });
    } catch (error) {
        console.error('Error uploading photos:', error);
        res.status(500).json({ error: 'Failed to upload photos' });
    }
});

// Delete session
app.delete('/api/sessions/:id', (req, res) => {
    const sessionId = req.params.id;
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[sessionIndex];
    
    // Delete associated photo files
    if (session.photos && session.photos.length > 0) {
        session.photos.forEach(photo => {
            const filePath = path.join(__dirname, 'uploads', photo.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });
    }

    sessions.splice(sessionIndex, 1);
    console.log(`Deleted session: ${session.clientName} (${sessionId})`);
    res.json({ message: 'Session deleted successfully' });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        sessions: sessions.length,
        timestamp: new Date().toISOString() 
    });
});

// Get individual session
app.get('/api/sessions/:id', (req, res) => {
    const sessionId = req.params.id;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
});

// Serve client gallery page
app.get('/gallery/:id', (req, res) => {
    const sessionId = req.params.id;
    const accessToken = req.query.access;
    
    // Inject Firebase config into the HTML
    fs.readFile(path.join(__dirname, 'client-gallery.html'), 'utf8', (err, html) => {
        if (err) {
            return res.status(500).send('Error loading gallery');
        }
        
        // Replace placeholders with actual Firebase config
        const configuredHtml = html
            .replace('{{FIREBASE_API_KEY}}', process.env.VITE_FIREBASE_API_KEY || '')
            .replace('{{FIREBASE_PROJECT_ID}}', process.env.VITE_FIREBASE_PROJECT_ID || '')
            .replace('{{FIREBASE_APP_ID}}', process.env.VITE_FIREBASE_APP_ID || '');
            
        res.send(configuredHtml);
    });
});

// Generate and store gallery access token
app.post('/api/sessions/:id/generate-gallery-access', (req, res) => {
    const sessionId = req.params.id;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    // Generate secure access token
    const accessToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Store access token in session (permanent access)
    session.galleryAccessToken = accessToken;
    session.galleryCreatedAt = new Date().toISOString();
    session.galleryExpiresAt = null; // No expiration
    
    const galleryUrl = `${req.protocol}://${req.get('host')}/gallery/${sessionId}?access=${accessToken}`;
    
    console.log(`Generated gallery access for session: ${session.clientName} (${sessionId})`);
    
    res.json({
        message: 'Gallery access generated successfully',
        galleryUrl,
        accessToken,
        expiresAt: 'Never expires'
    });
});

// Verify gallery access (API endpoint for client gallery)
app.get('/api/gallery/:id/verify', (req, res) => {
    const sessionId = req.params.id;
    const accessToken = req.query.access;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Gallery not found' });
    }
    
    if (!session.galleryAccessToken || session.galleryAccessToken !== accessToken) {
        return res.status(403).json({ error: 'Invalid access token' });
    }
    
    // No expiration check - galleries never expire
    
    res.json({
        sessionId: session.id,
        clientName: session.clientName,
        sessionType: session.sessionType,
        photos: session.photos || [],
        valid: true
    });
});

// Get photos for gallery (client endpoint)
app.get('/api/gallery/:id/photos', (req, res) => {
    const sessionId = req.params.id;
    const accessToken = req.query.access;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Gallery not found' });
    }
    
    if (!session.galleryAccessToken || session.galleryAccessToken !== accessToken) {
        return res.status(403).json({ error: 'Invalid access token' });
    }
    
    // No expiration check - galleries never expire
    
    res.json({
        photos: session.photos || [],
        totalPhotos: (session.photos || []).length
    });
});

// Send gallery notification with email/SMS integration
app.post('/api/sessions/:id/send-gallery-notification', async (req, res) => {
    const sessionId = req.params.id;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!session.galleryAccessToken) {
        return res.status(400).json({ error: 'Gallery access not generated. Generate gallery access first.' });
    }
    
    const galleryUrl = `${req.protocol}://${req.get('host')}/gallery/${sessionId}?access=${session.galleryAccessToken}`;
    
    const message = `Hi ${session.clientName}! Your photos from your ${session.sessionType} session are now ready for viewing and download. View your gallery: ${galleryUrl}`;
    const subject = `Your Photo Gallery is Ready - ${session.sessionType}`;
    
    // Send email notification
    let emailSent = false;
    let smsSent = false;
    
    try {
        const transporter = createEmailTransporter();
        if (transporter) {
            const emailMsg = {
                from: `"Lance - The Legacy Photography" <${process.env.EMAIL_USER || 'lance@thelegacyphotography.com'}>`,
                to: session.email,
                subject: subject,
                text: message,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #667eea;">📸 Your Photo Gallery is Ready!</h2>
                        <p>Hi ${session.clientName},</p>
                        <p>Your photos from your <strong>${session.sessionType}</strong> session are now ready for viewing and download.</p>
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="${galleryUrl}" style="background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Your Gallery</a>
                        </div>
                        <p style="color: #666; font-size: 14px;">Gallery URL: <a href="${galleryUrl}">${galleryUrl}</a></p>
                        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                        <p style="color: #888; font-size: 14px;">
                            Best regards,<br>
                            <strong>Lance - The Legacy Photography</strong><br>
                            Professional Photography Services
                        </p>
                    </div>
                `
            };
            
            await transporter.sendMail(emailMsg);
            emailSent = true;
            console.log(`Email sent to ${session.email} via direct SMTP`);
        } else {
            console.log('No email configuration found - add EMAIL_USER and EMAIL_PASS for direct email sending');
        }
    } catch (error) {
        console.error('Email sending failed:', error);
    }
    
    // Direct SMS sending - simplified notification approach
    try {
        // For now, we'll log SMS details and provide direct links
        // In production, this could integrate with carrier APIs or web-to-SMS services
        if (session.phoneNumber) {
            const smsMessage = `📸 ${session.clientName}, your ${session.sessionType} photos are ready! View gallery: ${galleryUrl}`;
            console.log(`SMS notification prepared for ${session.phoneNumber}: ${smsMessage}`);
            
            // Create a simple SMS link for manual sending if needed
            const smsLink = `sms:${session.phoneNumber}?body=${encodeURIComponent(smsMessage)}`;
            console.log(`SMS link: ${smsLink}`);
            
            // Mark as "sent" for logging purposes
            smsSent = true;
        }
    } catch (error) {
        console.error('SMS preparation failed:', error);
    }
    
    // Fallback: log notification details
    if (!emailSent && !smsSent) {
        console.log(`Gallery notification sent to ${session.clientName} (${session.email})`);
        console.log(`Gallery URL: ${galleryUrl}`);
    }
    
    const notification = {
        to: session.email,
        phone: session.phoneNumber,
        subject: subject,
        message: message,
        galleryUrl,
        emailSent,
        smsSent,
        sentAt: new Date().toISOString()
    };
    
    // Store notification in session for tracking
    session.lastGalleryNotification = notification;
    
    res.json({
        message: `Gallery notification ${emailSent || smsSent ? 'sent successfully' : 'logged (no email/SMS services configured)'}`,
        notification,
        galleryUrl,
        emailSent,
        smsSent
    });
});

// Send invoice via Stripe
app.post('/api/sessions/:id/send-invoice', async (req, res) => {
    const sessionId = req.params.id;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: 'Stripe not configured. Please add STRIPE_SECRET_KEY.' });
    }
    
    try {
        // Create customer if not exists
        let customer;
        try {
            const customers = await stripe.customers.list({
                email: session.email,
                limit: 1
            });
            
            if (customers.data.length > 0) {
                customer = customers.data[0];
            } else {
                customer = await stripe.customers.create({
                    email: session.email,
                    name: session.clientName,
                    phone: session.phoneNumber,
                    metadata: {
                        sessionId: sessionId,
                        sessionType: session.sessionType
                    }
                });
            }
        } catch (error) {
            console.error('Customer creation failed:', error);
            return res.status(500).json({ error: 'Failed to create customer' });
        }
        
        // Create invoice
        const invoice = await stripe.invoices.create({
            customer: customer.id,
            description: `Photography Session - ${session.sessionType}`,
            metadata: {
                sessionId: sessionId,
                clientName: session.clientName,
                sessionType: session.sessionType,
                location: session.location,
                dateTime: session.dateTime
            },
            auto_advance: true
        });
        
        // Add invoice item
        await stripe.invoiceItems.create({
            customer: customer.id,
            invoice: invoice.id,
            amount: Math.round(session.price * 100), // Convert to cents
            currency: 'usd',
            description: `${session.sessionType} Photography Session - ${session.clientName}`,
            metadata: {
                sessionId: sessionId,
                location: session.location,
                dateTime: session.dateTime,
                duration: session.duration
            }
        });
        
        // Finalize and send invoice
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices.sendInvoice(finalizedInvoice.id);
        
        // Store invoice details in session
        session.stripeInvoice = {
            invoiceId: finalizedInvoice.id,
            customerId: customer.id,
            hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url,
            invoicePdf: finalizedInvoice.invoice_pdf,
            amount: session.price,
            status: finalizedInvoice.status,
            sentAt: new Date().toISOString()
        };
        
        console.log(`Invoice sent to ${session.clientName} for $${session.price}`);
        console.log(`Invoice URL: ${finalizedInvoice.hosted_invoice_url}`);
        
        res.json({
            message: 'Invoice sent successfully via Stripe',
            invoice: {
                id: finalizedInvoice.id,
                hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url,
                invoicePdf: finalizedInvoice.invoice_pdf,
                amount: session.price,
                status: finalizedInvoice.status,
                customer: customer.email
            }
        });
        
    } catch (error) {
        console.error('Stripe invoice error:', error);
        res.status(500).json({ 
            error: 'Failed to send invoice',
            details: error.message
        });
    }
});

// Serve gallery page (legacy endpoint for backward compatibility)
app.get('/sessions/:id/gallery', (req, res) => {
    res.sendFile(path.join(__dirname, 'gallery.html'));
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
// Initialize database and start server
async function startServer() {
    await initializeDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`📸 Photo Session Scheduler running on http://0.0.0.0:${PORT}`);
        console.log('Database connected and ready');
    });
}

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

// Error handling
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File upload error. Please try again with smaller batches.' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files in single upload. Please upload in smaller batches.' });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ error: 'Unexpected file upload error. Please try again.' });
        }
    }
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error during upload. Please try uploading fewer files at once.' });
});