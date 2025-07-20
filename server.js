const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

// Serve gallery page
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
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
    }
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});