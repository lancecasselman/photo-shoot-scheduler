const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Email and SMS services
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 5000;

// In-memory storage for sessions
let sessions = [];

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
app.get('/api/sessions', (req, res) => {
    console.log(`Returning ${sessions.length} sessions`);
    res.json(sessions);
});

// Create new session
app.post('/api/sessions', (req, res) => {
    const sessionData = {
        id: uuidv4(),
        ...req.body,
        photos: [],
        createdAt: new Date().toISOString()
    };
    
    sessions.unshift(sessionData); // Add to beginning of array
    console.log(`Created session: ${sessionData.clientName} (${sessionData.id})`);
    res.json(sessionData);
});

// Update session
app.put('/api/sessions/:id', (req, res) => {
    const sessionId = req.params.id;
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    const existingSession = sessions[sessionIndex];
    const updatedSession = {
        ...existingSession,
        ...req.body,
        id: sessionId, // Preserve the original ID
        photos: existingSession.photos, // Preserve existing photos
        createdAt: existingSession.createdAt, // Preserve creation date
        updatedAt: new Date().toISOString()
    };
    
    sessions[sessionIndex] = updatedSession;
    console.log(`Updated session: ${updatedSession.clientName} (${sessionId})`);
    res.json(updatedSession);
});

// Upload photos to session
app.post('/api/sessions/:id/upload-photos', upload.array('photos'), (req, res) => {
    const sessionId = req.params.id;
    const session = sessions.find(s => s.id === sessionId);
    
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

    session.photos = session.photos || [];
    session.photos.push(...newPhotos);

    console.log(`Uploaded ${newPhotos.length} photos to session ${session.clientName}`);
    res.json({ 
        message: 'Photos uploaded successfully', 
        photos: newPhotos,
        totalPhotos: session.photos.length 
    });
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
    
    // Store access token in session (in production, this would be in Firestore)
    session.galleryAccessToken = accessToken;
    session.galleryCreatedAt = new Date().toISOString();
    session.galleryExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    
    const galleryUrl = `${req.protocol}://${req.get('host')}/gallery/${sessionId}?access=${accessToken}`;
    
    console.log(`Generated gallery access for session: ${session.clientName} (${sessionId})`);
    
    res.json({
        message: 'Gallery access generated successfully',
        galleryUrl,
        accessToken,
        expiresAt: session.galleryExpiresAt
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
    
    if (new Date() > new Date(session.galleryExpiresAt)) {
        return res.status(403).json({ error: 'Gallery access has expired' });
    }
    
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
    
    if (new Date() > new Date(session.galleryExpiresAt)) {
        return res.status(403).json({ error: 'Gallery access has expired' });
    }
    
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
        if (process.env.SENDGRID_API_KEY) {
            // Send email via SendGrid
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            
            const emailMsg = {
                to: session.email,
                from: process.env.FROM_EMAIL || 'noreply@photography.com',
                subject: subject,
                text: message,
                html: `
                    <h2>📸 Your Photo Gallery is Ready!</h2>
                    <p>Hi ${session.clientName},</p>
                    <p>Your photos from your <strong>${session.sessionType}</strong> session are now ready for viewing and download.</p>
                    <p><a href="${galleryUrl}" style="background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Your Gallery</a></p>
                    <p>Gallery URL: <a href="${galleryUrl}">${galleryUrl}</a></p>
                    <p>Best regards,<br>Your Photography Team</p>
                `
            };
            
            await sgMail.send(emailMsg);
            emailSent = true;
            console.log(`Email sent to ${session.email}`);
        }
    } catch (error) {
        console.error('Email sending failed:', error);
    }
    
    try {
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            // Send SMS via Twilio
            const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            
            await twilioClient.messages.create({
                body: `📸 ${session.clientName}, your ${session.sessionType} photos are ready! View gallery: ${galleryUrl}`,
                from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
                to: session.phoneNumber
            });
            
            smsSent = true;
            console.log(`SMS sent to ${session.phoneNumber}`);
        }
    } catch (error) {
        console.error('SMS sending failed:', error);
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`📸 Photo Session Scheduler running on http://0.0.0.0:${PORT}`);
    console.log('Fresh start - all data cleared');
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