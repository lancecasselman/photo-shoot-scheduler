const express = require('express');
// CONSOLIDATED: Multer removed - all uploads now use batch presigned URLs
// const multer = require('multer'); // REMOVED - no longer needed
const R2FileManager = require('./r2-file-manager');
// REMOVED: Old stripe storage billing - using new storage system
const R2SyncService = require('./r2-sync-service');
const UnifiedFileDeletionService = require('./unified-file-deletion');
const StorageSystem = require('./storage-system');
const { Pool } = require('pg');

/**
 * UPLOAD CONSOLIDATION COMPLETE:
 * All photo uploads now use the batch presigned URL method exclusively.
 * 
 * The batch presigned URL method is the ONLY upload system because it:
 * - Uploads directly from browser to R2 (no server bottleneck)
 * - Supports concurrent uploads (up to 4 files at once)
 * - Has proper quota checking and validation
 * - Is optimized for large files and RAW formats
 * 
 * Removed methods:
 * - Legacy multer-based server uploads (/api/r2/upload, /api/r2/backup-upload, /api/r2/gallery-upload)
 * - Legacy session upload endpoint (/api/sessions/:id/upload-photos)
 * 
 * Primary endpoints:
 * - POST /api/r2/generate-presigned-urls - Get presigned URLs for direct uploads
 * - POST /api/r2/confirm-uploads - Confirm successful uploads and process files
 */

// Multer configuration removed - no longer needed for consolidated upload system
// All file validation now happens in the generate-presigned-urls endpoint

/**
 * R2 Storage API Routes
 * All routes handle authentication and storage limit enforcement
 * Frontend never receives R2 credentials - all operations go through backend
 */
function createR2Routes() {
  const router = express.Router();
  
  // Database connection for API routes
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  const r2Manager = new R2FileManager(null, pool);
  const storageSystem = new StorageSystem(pool, r2Manager);
  // REMOVED: Old storage billing - using new storage system
  const syncService = new R2SyncService(r2Manager);
  const unifiedDeletion = new UnifiedFileDeletionService();

  // Authentication middleware for all routes - compatible with main server auth
  router.use((req, res, next) => {
    // Strict authentication check - no fallbacks that could be bypassed
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    const hasValidSession = req.session && req.session.user && req.session.user.uid;
    
    if (isAuthenticated && req.user && req.user.uid) {
      // Primary authentication method
      return next();
    }
    
    if (hasValidSession) {
      // Secondary authentication via session - but verify user ID exists
      req.user = req.session.user;
      if (req.user.uid) {
        return next();
      }
    }
    
    // Log failed authentication attempts for security monitoring
    console.log('R2 API Auth failed - no valid session', {
      hasIsAuthenticated: !!req.isAuthenticated,
      isAuthenticated: isAuthenticated,
      hasSession: !!req.session,
      hasSessionUser: !!(req.session && req.session.user),
      hasUserUid: !!(req.user && req.user.uid),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    return res.status(401).json({ error: 'Authentication required' });
  });

  /**
   * GET /api/r2/storage-usage
   * Get user's current storage usage and limits
   */
  router.get('/storage-usage', async (req, res) => {
    try {
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      console.log('Getting storage usage for user:', userId);
      
      // Calculate actual storage usage from all sessions
      let totalBytes = 0;
      let galleryBytes = 0;
      let rawBytes = 0;
      let galleryFiles = 0;
      let rawFiles = 0;
      
      try {
        // Get all photography sessions for this user
        let sessionsQuery = 'SELECT id FROM photography_sessions WHERE user_id = $1';
        let queryParams = [userId];
        
        // SPECIAL ACCESS: If Lance's accounts, use unified Lance account (admin mode)
        if (req.user.email === 'lancecasselman@icloud.com' || req.user.email === 'lancecasselman2011@gmail.com' || req.user.email === 'Lance@thelegacyphotography.com') {
          console.log('UNIFIED LANCE ACCOUNT: Storage calculation for unified Lance account');
          sessionsQuery = 'SELECT id FROM photography_sessions WHERE user_id = $1';
          queryParams = ['44735007'];
          // Use the Firebase UID for R2 storage lookups
          userId = 'BFZI4tzu4rdsiZZSK63cqZ5yohw2';
        }
        
        const sessionsResult = await pool.query(sessionsQuery, queryParams);
        
        console.log(` Calculating storage for ${sessionsResult.rows.length} sessions`);
        
        // Calculate storage for each session
        for (const session of sessionsResult.rows) {
          console.log(` Calculating storage for session: ${session.id}`);
          
          try {
            const sessionFiles = await r2Manager.getSessionFiles(userId, session.id);
            console.log(`🗃️ Files for session ${session.id}:`, {
              galleryCount: sessionFiles.filesByType.gallery?.length || 0,
              rawCount: sessionFiles.filesByType.raw?.length || 0,
              totalSize: sessionFiles.totalSize || 0
            });
            
            // Add to gallery storage
            if (sessionFiles.filesByType.gallery) {
              for (const file of sessionFiles.filesByType.gallery) {
                galleryBytes += file.fileSizeBytes || 0;
                galleryFiles++;
              }
            }
            
            // Add to RAW storage
            if (sessionFiles.filesByType.raw) {
              for (const file of sessionFiles.filesByType.raw) {
                rawBytes += file.fileSizeBytes || 0;
                rawFiles++;
              }
            }
          } catch (sessionError) {
            console.error(`Error calculating storage for session ${session.id}:`, sessionError);
          }
        }
        
        totalBytes = galleryBytes + rawBytes;
        console.log(` Storage calculated: Gallery: ${(galleryBytes / (1024**3)).toFixed(2)} GB, RAW: ${(rawBytes / (1024**3)).toFixed(2)} GB`);
        
      } catch (dbError) {
        console.error('Database error calculating storage:', dbError);
      }
      
      const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
      const galleryGB = (galleryBytes / (1024 * 1024 * 1024)).toFixed(2);
      const rawGB = (rawBytes / (1024 * 1024 * 1024)).toFixed(2);
      const usagePercent = ((totalBytes / (1024 * 1024 * 1024 * 1024)) * 100).toFixed(1); // 1TB = 1024^4 bytes
      
      // Return frontend-compatible storage info with separate tracking
      const usage = {
        totalBytes,
        totalGB: parseFloat(totalGB),
        galleryBytes,
        galleryGB: parseFloat(galleryGB),
        rawBytes,
        rawGB: parseFloat(rawGB),
        usedPercentage: parseFloat(usagePercent),
        percentUsed: parseFloat(usagePercent),
        remainingGB: 1024 - parseFloat(totalGB), // 1TB limit
        fileCount: galleryFiles + rawFiles,
        galleryFiles,
        rawFiles,
        totalFiles: galleryFiles + rawFiles,
        displayText: `${totalGB} GB of 1024 GB used`,
        monthlyStorageCost: 0,
        additionalStorageTB: 0,
        storageStatus: "Base Plan Active",
        isNearLimit: parseFloat(usagePercent) > 85,
        isOverLimit: parseFloat(usagePercent) > 100
      };
      
      const billingInfo = {
        currentPlan: 'Base Plan (1TB)',
        monthlyCharge: 0,
        storageLimit: 1024,
        upgradeAvailable: true
      };
      
      res.json({
        success: true,
        usage,
        billing: billingInfo
      });
    } catch (error) {
      console.error('Error getting storage usage:', error);
      res.status(500).json({ error: 'Failed to get storage usage' });
    }
  });

  /**
   * CONSOLIDATED: Server-side upload endpoint redirected to batch presigned URL method
   * This endpoint is kept for backward compatibility but redirects to the efficient batch method
   */
  router.post('/upload', (req, res) => {
    console.log('⚠️ REDUNDANT UPLOAD ENDPOINT CALLED - Redirecting to batch presigned URL method');
    return res.status(308).json({
      message: 'This endpoint has been deprecated. Please use the batch presigned URL method.',
      redirect: true,
      newEndpoint: '/api/r2/generate-presigned-urls',
      instructions: 'Use R2DirectUploader class for efficient direct-to-R2 uploads',
      documentation: 'The batch presigned URL method supports concurrent uploads, better performance, and direct browser-to-R2 transfers.'
    });
  });

  /* ORIGINAL SERVER UPLOAD CODE REMOVED - replaced with redirect
  router.post('/upload', upload.array('files', 50), async (req, res) => {
    // ... server-side upload code removed ...
  });
  */

  /**
   * CONSOLIDATED: Backup upload endpoint redirected to batch presigned URL method
   */
  router.post('/backup-upload', (req, res) => {
    console.log('⚠️ REDUNDANT BACKUP-UPLOAD ENDPOINT CALLED - Redirecting to batch presigned URL method');
    return res.status(308).json({
      message: 'This endpoint has been deprecated. Please use the batch presigned URL method.',
      redirect: true,
      newEndpoint: '/api/r2/generate-presigned-urls',
      instructions: 'Use R2DirectUploader class for efficient direct-to-R2 uploads',
      documentation: 'The batch presigned URL method supports concurrent uploads, better performance, and direct browser-to-R2 transfers.'
    });
  });

  /* ORIGINAL BACKUP UPLOAD CODE REMOVED - replaced with redirect
  router.post('/backup-upload', upload.array('files', 50), async (req, res) => {
    // ... backup upload code removed ...
  });
  */

  /**
   * CONSOLIDATED: Gallery upload endpoint redirected to batch presigned URL method
   */
  router.post('/gallery-upload', (req, res) => {
    console.log('⚠️ REDUNDANT GALLERY-UPLOAD ENDPOINT CALLED - Redirecting to batch presigned URL method');
    return res.status(308).json({
      message: 'This endpoint has been deprecated. Please use the batch presigned URL method.',
      redirect: true,
      newEndpoint: '/api/r2/generate-presigned-urls',
      instructions: 'Use R2DirectUploader class for efficient direct-to-R2 uploads',
      documentation: 'The batch presigned URL method supports concurrent uploads, better performance, and direct browser-to-R2 transfers.'
    });
  });

  /* ORIGINAL GALLERY UPLOAD CODE REMOVED - replaced with redirect
  router.post('/gallery-upload', upload.array('files', 50), async (req, res) => {
    // ... gallery upload code removed ...
  });
  */

  /**
   * GET /api/r2/session/:sessionId/files
   * Get all files for a specific session
   */
  router.get('/session/:sessionId/files', async (req, res) => {
    try {
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { sessionId } = req.params;
      
      const sessionFiles = await r2Manager.getSessionFiles(sessionId, userId);
      
      res.json({
        success: true,
        ...sessionFiles
      });
    } catch (error) {
      console.error('Error getting session files:', error);
      res.status(500).json({ error: 'Failed to get files' });
    }
  });

  /**
   * GET /api/r2/session/:sessionId/backup-index
   * Get backup index for a specific session
   */
  router.get('/session/:sessionId/backup-index', async (req, res) => {
    try {
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { sessionId } = req.params;
      
      const backupIndex = await r2Manager.getSessionBackupIndex(userId, sessionId);
      
      res.json({
        success: true,
        sessionId,
        ...backupIndex
      });
      
    } catch (error) {
      console.error('Error getting backup index:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get backup index',
        message: error.message 
      });
    }
  });

  /**
   * 🔒 BULLETPROOF PREVIEW ENDPOINT - Only serves verified database photos
   * GET /api/r2/preview/:sessionId/:filename
   */
  router.get('/preview/:sessionId/:filename', async (req, res) => {
    try {
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { sessionId, filename } = req.params;
      const { size } = req.query;
      
      console.log('🔒 BULLETPROOF PREVIEW REQUEST:', {
        userId: userId,
        sessionId: sessionId,
        filename: filename,
        size: size || 'medium',
        timestamp: new Date().toISOString()
      });
      
      // BULLETPROOF VERIFICATION: Check if this photo exists in verified database
      const client = await pool.connect();
      const sessionQuery = await client.query(`
        SELECT 
          id, 
          client_name, 
          photos,
          user_id
        FROM photography_sessions 
        WHERE id = $1 
        AND user_id = $2
        AND photos IS NOT NULL 
        AND jsonb_array_length(photos) > 0
      `, [sessionId, userId]);
      client.release();
      
      if (sessionQuery.rows.length === 0) {
        console.log('❌ BULLETPROOF PREVIEW BLOCKED: No session or no verified photos:', {
          sessionId: sessionId,
          userId: userId,
          filename: filename
        });
        return res.status(404).json({ error: 'Preview not available - photos not verified' });
      }
      
      const session = sessionQuery.rows[0];
      const photos = session.photos || [];
      
      // STRICT VERIFICATION: Only serve files that exist in verified photos array
      const verifiedPhoto = photos.find(photo => 
        photo.filename === filename || 
        photo.url === filename ||
        photo.url.includes(filename)
      );
      
      if (!verifiedPhoto) {
        console.log('❌ BULLETPROOF PREVIEW BLOCKED: Photo not in verified list:', {
          sessionId: sessionId,
          clientName: session.client_name,
          requestedFilename: filename,
          verifiedPhotos: photos.map(p => p.filename || p.url),
          userId: userId
        });
        return res.status(404).json({ error: 'Preview not available - photo not verified' });
      }
      
      console.log('✅ BULLETPROOF PREVIEW VERIFIED:', {
        sessionId: sessionId,
        clientName: session.client_name,
        verifiedFilename: verifiedPhoto.filename,
        verifiedUrl: verifiedPhoto.url,
        userId: userId
      });
      
      // For verified external URLs (like Unsplash), redirect or proxy
      if (verifiedPhoto.url && verifiedPhoto.url.startsWith('http')) {
        console.log('✅ VERIFIED EXTERNAL URL - redirecting to:', verifiedPhoto.url);
        return res.redirect(verifiedPhoto.url);
      }
      
      // For verified R2 files, continue with thumbnail processing
      const thumbnailSize = size === 'small' ? '_sm' : 
                           size === 'large' ? '_lg' : '_md';
      
      if (r2Manager.isImageFile(filename)) {
        const thumbnailResult = await r2Manager.getThumbnail(userId, sessionId, filename, thumbnailSize);
        
        if (thumbnailResult.success) {
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('X-Verified-Client', session.client_name);
          res.setHeader('X-Thumbnail-Size', thumbnailSize);
          res.send(thumbnailResult.buffer);
          console.log('✅ SERVED VERIFIED THUMBNAIL:', {
            filename: filename,
            size: thumbnailSize,
            clientName: session.client_name
          });
          return;
        }
      }
      
      // Fallback: Verify and serve original file
      const downloadResult = await r2Manager.downloadFile(userId, sessionId, filename);
      
      if (!downloadResult.success) {
        console.log('❌ BULLETPROOF PREVIEW: R2 file not found after verification:', {
          sessionId: sessionId,
          filename: filename,
          clientName: session.client_name
        });
        return res.status(404).json({ error: 'Verified file not accessible in storage' });
      }
      
      // Process and serve verified file
      if (r2Manager.isImageFile(filename)) {
        const sharp = require('sharp');
        const maxSize = size === 'small' ? 150 : size === 'large' ? 800 : 400;
        
        try {
          const processedBuffer = await sharp(downloadResult.buffer)
            .jpeg({ quality: 85, progressive: true })
            .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
            .toBuffer();
          
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('X-Verified-Client', session.client_name);
          res.setHeader('X-Processed', 'bulletproof-verified');
          res.send(processedBuffer);
          console.log('✅ SERVED VERIFIED PROCESSED IMAGE:', {
            filename: filename,
            clientName: session.client_name,
            size: maxSize
          });
        } catch (sharpError) {
          console.warn('⚠️ Sharp processing failed for verified file:', sharpError.message);
          res.setHeader('Content-Type', downloadResult.contentType || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('X-Verified-Client', session.client_name);
          res.send(downloadResult.buffer);
        }
      } else {
        // Serve verified non-image file
        res.setHeader('Content-Type', downloadResult.contentType || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Verified-Client', session.client_name);
        res.send(downloadResult.buffer);
        console.log('✅ SERVED VERIFIED NON-IMAGE FILE:', {
          filename: filename,
          clientName: session.client_name
        });
      }
      
    } catch (error) {
      console.error('❌ BULLETPROOF PREVIEW ERROR:', error);
      res.status(500).json({ error: 'Preview failed - security verification error', message: error.message });
    }
  });

  /**
   * GET /api/r2/thumbnail/:sessionId/:filename
   * Get optimized thumbnail for a file (JPEG format, multiple sizes)
   */
  router.get('/thumbnail/:sessionId/:filename', async (req, res) => {
    try {
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { sessionId, filename } = req.params;
      const { size = 'medium' } = req.query; // small, medium, large
      
      console.log(`🖼️ Thumbnail request: ${filename} (${size}) for session ${sessionId}`);
      
      // Map size parameter to thumbnail suffix
      const thumbnailSize = size === 'small' ? '_sm' : 
                           size === 'large' ? '_lg' : '_md';
      
      // Get thumbnail
      const thumbnailResult = await r2Manager.getThumbnail(userId, sessionId, filename, thumbnailSize);
      
      if (thumbnailResult.success) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours cache
        res.setHeader('X-Thumbnail-Size', thumbnailSize);
        res.setHeader('X-Original-File', filename);
        res.send(thumbnailResult.buffer);
        console.log(` Served thumbnail ${thumbnailSize} for ${filename}`);
      } else {
        res.status(404).json({ 
          error: 'Thumbnail not available',
          message: thumbnailResult.error,
          originalFile: filename
        });
      }
      
    } catch (error) {
      console.error('Thumbnail error:', error);
      res.status(500).json({ 
        error: 'Thumbnail generation failed', 
        message: error.message 
      });
    }
  });

  /**
   * GET /api/r2/download-all/:userId/:sessionId
   * Download all files for a session as ZIP
   */
  router.get('/download-all/:userId/:sessionId', async (req, res) => {
    try {
      const archiver = require('archiver');
      const currentUserId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { userId, sessionId } = req.params;
      
      console.log(` ZIP download request for session ${sessionId} by user ${currentUserId}`);
      
      // Allow download if user IDs match
      const userIdMatch = currentUserId === userId || 
                         req.user.original_uid === userId ||
                         req.user.uid === userId;
      
      if (!userIdMatch) {
        console.log(`❌ Access denied: ${currentUserId} !== ${userId}`);
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Get all files for the session
      const backupIndex = await r2Manager.getSessionBackupIndex(currentUserId, sessionId);
      
      if (!backupIndex.files || backupIndex.files.length === 0) {
        return res.status(404).json({ error: 'No files found for this session' });
      }
      
      // Calculate total size for progress tracking - use backup index data
      let totalSize = 0;
      const filesWithSizes = [];
      
      for (const file of backupIndex.files) {
        // Use fileSizeBytes from backup index, or estimate if missing
        const actualSize = file.fileSizeBytes || file.size || (250 * 1024 * 1024); // 250MB default for TIFF
        totalSize += actualSize;
        filesWithSizes.push({
          ...file,
          size: actualSize
        });
      }
      
      console.log(` Total ZIP size estimate: ${(totalSize / (1024*1024*1024)).toFixed(2)} GB`);
      
      // Set headers optimized for huge downloads (no Content-Length for streaming)
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="Session_${sessionId}_Files.zip"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // Create ZIP archive optimized for multi-GB downloads
      const archive = archiver('zip', { 
        zlib: { level: 0 }, // No compression - raw speed for huge files
        highWaterMark: 64 * 1024 * 1024, // 64MB buffer for multi-GB transfers
        statConcurrency: 1, // Sequential processing to manage memory
        store: true // Store mode for maximum throughput
      });
      
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'ZIP creation failed' });
        }
      });
      
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('Archive warning:', err);
        } else {
          console.error('Archive warning (critical):', err);
        }
      });
      
      // Extended timeout for multi-GB downloads (30 minutes)
      const timeoutId = setTimeout(() => {
        console.error('ZIP creation timeout');
        if (!res.headersSent) {
          res.status(408).json({ error: 'ZIP creation timeout' });
        }
      }, 1800000); // 30 minutes for huge downloads
      
      // Pipe archive to response
      archive.pipe(res);
      
      // Process files sequentially for memory efficiency with huge files
      let processedSize = 0;
      for (let i = 0; i < filesWithSizes.length; i++) {
        const file = filesWithSizes[i];
        try {
          const fileSizeGB = file.size > 0 ? (file.size / (1024*1024*1024)).toFixed(2) : '0.25';
          console.log(`📁 [${i+1}/${filesWithSizes.length}] Adding ${file.filename} (${fileSizeGB}GB)`);
          
          // Use streaming download for memory efficiency
          const downloadResult = await r2Manager.downloadFile(currentUserId, sessionId, file.filename);
          
          if (downloadResult.success) {
            // Add file to archive with minimal metadata (ensure proper streaming)
            const stream = require('stream');
            const readable = new stream.PassThrough();
            readable.end(downloadResult.buffer);
            
            archive.append(readable, { 
              name: file.filename,
              date: new Date(),
              store: true // Force store mode for this file
            });
            
            processedSize += file.size;
            const progressPercent = totalSize > 0 ? ((processedSize / totalSize) * 100).toFixed(1) : '0.0';
            const processedGB = (processedSize/(1024*1024*1024)).toFixed(2);
            const totalGB = (totalSize/(1024*1024*1024)).toFixed(2);
            console.log(` Added ${file.filename} | Progress: ${progressPercent}% (${processedGB}GB/${totalGB}GB)`);
            
            // Force garbage collection hint for huge files
            if (global.gc && file.size > 500 * 1024 * 1024) { // 500MB+
              global.gc();
            }
          } else {
            console.warn(` Failed to download ${file.filename} for ZIP`);
          }
        } catch (fileError) {
          console.error(`Error adding ${file.filename} to ZIP:`, fileError);
        }
      }
      
      // Finalize the archive and wait for completion
      console.log(' Finalizing ZIP archive...');
      
      // Set up promise to wait for archive completion
      const archivePromise = new Promise((resolve, reject) => {
        archive.on('end', () => {
          console.log(` ZIP download completed for session ${sessionId}`);
          clearTimeout(timeoutId);
          resolve();
        });
        
        archive.on('error', (err) => {
          console.error('Archive error during finalization:', err);
          clearTimeout(timeoutId);
          reject(err);
        });
      });
      
      // Finalize the archive
      archive.finalize();
      
      // Wait for completion
      await archivePromise;
      
    } catch (error) {
      console.error('❌ ZIP download error:', error);
      clearTimeout(timeoutId);
      if (!res.headersSent) {
        res.status(500).json({ error: 'ZIP download failed', message: error.message });
      }
    }
  });

  /**
   * GET /api/r2/download/:userId/:sessionId/:filename
   * Download a specific file by path
   */
  router.get('/download/:userId/:sessionId/:filename', async (req, res) => {
    try {
      const currentUserId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { userId, sessionId, filename } = req.params;
      
      console.log(`📥 Download request: ${filename} for user ${currentUserId} (requesting as ${userId})`);
      
      // Allow download if user IDs match (flexible matching for different ID formats)
      const userIdMatch = currentUserId === userId || 
                         req.user.original_uid === userId ||
                         req.user.uid === userId;
      
      if (!userIdMatch) {
        console.log(`❌ Access denied: ${currentUserId} !== ${userId}`);
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const downloadResult = await r2Manager.downloadFile(currentUserId, sessionId, filename);
      
      if (!downloadResult.success) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Set appropriate headers for download
      res.setHeader('Content-Type', downloadResult.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadResult.filename}"`);
      res.setHeader('Content-Length', downloadResult.fileSizeBytes);
      
      // Send the file buffer
      res.send(downloadResult.buffer);
      
      console.log(` File downloaded: ${filename} by user ${currentUserId}`);
      
    } catch (error) {
      console.error('❌ Download error:', error);
      res.status(500).json({ error: 'Download failed', message: error.message });
    }
  });

  /**
   * POST /api/r2/track-download
   * Track download activity for unified storage analytics
   */
  router.post('/track-download', async (req, res) => {
    try {
      const currentUserId = req.user.original_uid || req.user.uid || req.user.id;
      const { filename, sizeBytes, timestamp } = req.body;
      
      await r2Manager.trackDownload(currentUserId, filename, sizeBytes);
      
      res.json({ 
        success: true, 
        message: 'Download tracked successfully' 
      });
      
    } catch (error) {
      console.error('Error tracking download:', error);
      res.status(500).json({ 
        error: 'Download tracking failed', 
        message: error.message 
      });
    }
  });

  /**
   * GET /api/r2/download/:fileId
   * Download a specific file by fileId (legacy)
   */
  router.get('/download/:fileId', async (req, res) => {
    try {
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { fileId } = req.params;
      
      const downloadResult = await r2Manager.downloadFileById(fileId, userId);
      
      // Set appropriate headers
      res.setHeader('Content-Type', downloadResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${downloadResult.filename}"`);
      res.setHeader('Content-Length', downloadResult.contentLength);
      
      // Stream the file data
      downloadResult.data.pipe(res);
      
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(404).json({ error: 'File not found or access denied' });
    }
  });

  /**
   * DELETE /api/r2/file/:fileId
   * Delete a specific file
   */
  router.delete('/file/:fileId', async (req, res) => {
    try {
      const userId = req.user.id;
      const { fileId } = req.params;
      
      const deleted = await r2Manager.deleteFile(fileId, userId);
      
      if (deleted) {
        // Get updated storage usage
        const updatedUsage = await r2Manager.getUserStorageUsage(userId);
        
        res.json({
          success: true,
          message: 'File deleted successfully',
          storageUsage: updatedUsage
        });
      } else {
        res.status(404).json({ error: 'File not found or already deleted' });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  /**
   * DELETE /api/r2/session/:sessionId/delete/:filename
   * Delete a specific file from a session (simplified endpoint)
   */
  router.delete('/session/:sessionId/delete/:filename', async (req, res) => {
    try {
      const currentUserId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { sessionId, filename } = req.params;
      
      console.log(`🗑️ UNIFIED Delete request: ${filename} from session ${sessionId} by user ${currentUserId}`);
      
      // Find the file in the database to get the correct folder type
      const pool = require('pg').Pool;
      const dbPool = new pool({ connectionString: process.env.DATABASE_URL });
      
      const decodedFilename = decodeURIComponent(filename);
      const cleanFilename = decodedFilename.split('/').pop(); // Get just the filename without path
      
      // Look up the file in the database to get folder type and full path
      const fileQuery = await dbPool.query(
        'SELECT folder_type, filename FROM session_files WHERE session_id = $1 AND (filename LIKE $2 OR filename = $3)',
        [sessionId, `%${cleanFilename}`, cleanFilename]
      );
      
      if (fileQuery.rows.length === 0) {
        console.log(`❌ File not found in database: ${cleanFilename}`);
        return res.status(404).json({ error: 'File not found in database' });
      }
      
      const folderType = fileQuery.rows[0].folder_type;
      console.log(`📁 Found file in database: ${cleanFilename} (${folderType})`);
      
      // Use unified deletion service to ensure both cloud storage and database are updated
      const deleteResult = await unifiedDeletion.deleteFile(sessionId, folderType, cleanFilename, currentUserId);
      
      if (deleteResult.success) {
        console.log(` File deleted: ${filename}`);
        res.json({
          success: true,
          message: `File ${filename} deleted successfully`
        });
      } else {
        res.status(404).json({ error: 'File not found or already deleted' });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file: ' + error.message });
    }
  });

  /**
   * DELETE /api/r2/delete/:userId/:sessionId/:filename
   * Delete a specific file by filename from a session
   */
  router.delete('/delete/:userId/:sessionId/:filename', async (req, res) => {
    try {
      const currentUserId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { userId, sessionId, filename } = req.params;
      
      // Allow deletion if user IDs match
      const userIdMatch = currentUserId === userId || 
                         req.user.original_uid === userId ||
                         req.user.uid === userId;
      
      if (!userIdMatch) {
        console.log(`❌ Delete access denied: ${currentUserId} !== ${userId}`);
        return res.status(403).json({ error: 'Access denied' });
      }
      
      console.log(`🗑️ UNIFIED Delete request: ${filename} from session ${sessionId}`);
      
      // Find the file in the database to get the correct folder type
      const pool = require('pg').Pool;
      const dbPool = new pool({ connectionString: process.env.DATABASE_URL });
      
      const decodedFilename = decodeURIComponent(filename);
      const cleanFilename = decodedFilename.split('/').pop(); // Get just the filename without path
      
      // Look up the file in the database to get folder type and full path
      const fileQuery = await dbPool.query(
        'SELECT folder_type, filename FROM session_files WHERE session_id = $1 AND (filename LIKE $2 OR filename = $3)',
        [sessionId, `%${cleanFilename}`, cleanFilename]
      );
      
      if (fileQuery.rows.length === 0) {
        console.log(`❌ File not found in database: ${cleanFilename}`);
        return res.status(404).json({ error: 'File not found in database' });
      }
      
      const folderType = fileQuery.rows[0].folder_type;
      console.log(`📁 Found file in database: ${cleanFilename} (${folderType})`);
      
      // Use unified deletion service to ensure both cloud storage and database are updated
      const deleteResult = await unifiedDeletion.deleteFile(sessionId, folderType, cleanFilename, currentUserId);
      
      if (deleteResult.success) {
        console.log(` File deleted: ${filename}`);
        res.json({
          success: true,
          message: `File ${filename} deleted successfully`
        });
      } else {
        res.status(404).json({ error: 'File not found or already deleted' });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file: ' + error.message });
    }
  });

  /**
   * DELETE /api/r2/delete-all/:userId/:sessionId
   * Delete all files from a session
   */
  router.delete('/delete-all/:userId/:sessionId', async (req, res) => {
    try {
      const currentUserId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { userId, sessionId } = req.params;
      
      // Allow deletion if user IDs match
      const userIdMatch = currentUserId === userId || 
                         req.user.original_uid === userId ||
                         req.user.uid === userId;
      
      if (!userIdMatch) {
        console.log(`❌ Delete all access denied: ${currentUserId} !== ${userId}`);
        return res.status(403).json({ error: 'Access denied' });
      }
      
      console.log(`🗑️ UNIFIED Delete all request for session ${sessionId}`);
      
      // Use unified deletion service to delete all session files
      const deleteAllResult = await unifiedDeletion.deleteSessionFiles(sessionId, currentUserId);
      
      console.log(`🗑️ Unified deletion completed: ${deleteAllResult.deletedCount} files deleted`);
      
      res.json({
        success: deleteAllResult.success,
        message: deleteAllResult.message,
        deletedCount: deleteAllResult.deletedCount,
        errors: deleteAllResult.results ? deleteAllResult.results.filter(r => !r.success).map(r => r.error) : []
      });
      
    } catch (error) {
      console.error('Error deleting all files:', error);
      res.status(500).json({ error: 'Failed to delete files: ' + error.message });
    }
  });

  /**
   * POST /api/r2/storage-upgrade/checkout
   * Create Stripe checkout session for additional storage
   */
  router.post('/storage-upgrade/checkout', async (req, res) => {
    try {
      const userId = req.user.id;
      const { additionalTB } = req.body;
      
      if (!additionalTB || additionalTB < 1) {
        return res.status(400).json({ error: 'Must purchase at least 1TB additional storage' });
      }
      
      const userInfo = {
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      };
      
      const checkoutSession = await storageBilling.createStorageUpgradeCheckout(userId, additionalTB, userInfo);
      
      res.json({
        success: true,
        ...checkoutSession
      });
    } catch (error) {
      console.error('Error creating storage upgrade checkout:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  /**
   * POST /api/r2/storage-upgrade/success
   * Handle successful storage upgrade
   */
  router.post('/storage-upgrade/success', async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      const result = await storageBilling.handleStorageUpgradeSuccess(sessionId);
      
      res.json({
        success: true,
        message: 'Storage upgrade completed successfully!',
        ...result
      });
    } catch (error) {
      console.error('Error handling storage upgrade success:', error);
      res.status(500).json({ error: 'Failed to process storage upgrade' });
    }
  });

  /**
   * DELETE /api/r2/storage-subscription
   * Cancel storage subscription
   */
  router.delete('/storage-subscription', async (req, res) => {
    try {
      const userId = req.user.id;
      
      const result = await storageBilling.cancelStorageSubscription(userId);
      
      res.json({
        success: true,
        message: 'Storage subscription cancelled',
        ...result
      });
    } catch (error) {
      console.error('Error cancelling storage subscription:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  });

  /**
   * GET /api/r2/billing
   * Get storage billing information
   */
  router.get('/billing', async (req, res) => {
    try {
      const userId = req.user.id;
      const billingInfo = await storageBilling.getStorageBillingInfo(userId);
      
      res.json({
        success: true,
        billing: billingInfo
      });
    } catch (error) {
      console.error('Error getting billing info:', error);
      res.status(500).json({ error: 'Failed to get billing information' });
    }
  });

  /**
   * POST /api/r2/webhooks/stripe
   * Handle Stripe webhooks for storage billing
   */
  router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      
      // Verify webhook signature (implement if using webhook endpoint)
      // const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      
      // For now, parse the event directly (in production, always verify signatures)
      const event = JSON.parse(req.body);
      
      const result = await storageBilling.handleWebhook(event);
      
      res.json(result);
    } catch (error) {
      console.error('Error handling Stripe webhook:', error);
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * POST /api/r2/sync/local-to-r2
   * Sync all local backup files to R2 when connection is restored
   */
  router.post('/sync/local-to-r2', async (req, res) => {
    try {
      const userId = req.user.id;
      
      if (!r2Manager.r2Available) {
        return res.status(400).json({ 
          error: 'R2 not available - fix credentials first',
          r2Status: 'unavailable'
        });
      }
      
      const syncResults = await syncService.syncLocalToR2(userId);
      
      res.json({
        success: true,
        message: 'Local files synced to R2 successfully',
        results: syncResults
      });
      
    } catch (error) {
      console.error('Error syncing to R2:', error);
      res.status(500).json({ 
        error: 'Sync failed', 
        details: error.message 
      });
    }
  });

  /**
   * GET /api/r2/sync/status
   * Get sync status and pending files
   */
  router.get('/sync/status', async (req, res) => {
    try {
      const userId = req.user.id;
      const status = await syncService.getSyncStatus(userId);
      
      res.json({
        success: true,
        ...status
      });
      
    } catch (error) {
      console.error('Error getting sync status:', error);
      res.status(500).json({ 
        error: 'Failed to get sync status', 
        details: error.message 
      });
    }
  });

  /**
   * POST /api/r2/generate-presigned-urls
   * Generate presigned URLs for direct browser-to-R2 uploads
   * Supports batch uploads with storage quota checking
   */
  router.post('/generate-presigned-urls', async (req, res) => {
    try {
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { sessionId, files } = req.body;
      
      // Validate request
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'Files array is required' });
      }
      
      // Security: Limit number of files per request
      if (files.length > 50) {
        return res.status(400).json({ 
          error: 'Too many files. Maximum 50 files per request' 
        });
      }
      
      // Validate each file and check size limits
      let totalRequestSize = 0;
      const validatedFiles = [];
      
      for (const file of files) {
        if (!file.filename || !file.contentType || !file.size) {
          return res.status(400).json({ 
            error: `Invalid file data: ${file.filename || 'unnamed'}` 
          });
        }
        
        // Determine file type category
        const fileType = r2Manager.getFileTypeCategory(file.filename);
        
        // Apply size limits based on file type
        let maxSize;
        if (fileType === 'raw' || fileType === 'video') {
          maxSize = 5 * 1024 * 1024 * 1024; // 5GB for RAW/video
        } else if (fileType === 'gallery' || fileType === 'adobe') {
          maxSize = 500 * 1024 * 1024; // 500MB for images and Adobe files
        } else {
          maxSize = 100 * 1024 * 1024; // 100MB for other files
        }
        
        if (file.size > maxSize) {
          return res.status(400).json({ 
            error: `File too large: ${file.filename} (${(file.size / (1024*1024)).toFixed(2)}MB exceeds ${(maxSize / (1024*1024)).toFixed(0)}MB limit)` 
          });
        }
        
        totalRequestSize += file.size;
        validatedFiles.push({
          filename: file.filename,
          contentType: file.contentType,
          size: file.size,
          fileType: fileType
        });
      }
      
      console.log(`📤 Presigned URL request: ${validatedFiles.length} files, ${(totalRequestSize / (1024*1024)).toFixed(2)}MB total`);
      
      // Check storage quota before generating URLs
      const quotaCheck = await storageSystem.checkStorageQuota(userId, totalRequestSize);
      
      if (!quotaCheck.allowed) {
        return res.status(403).json({
          error: 'Storage quota exceeded',
          message: quotaCheck.message,
          currentUsage: quotaCheck.currentUsage,
          quotaLimit: quotaCheck.quotaLimit,
          requestedSize: totalRequestSize
        });
      }
      
      // Generate presigned URLs for batch upload
      const urlResult = await r2Manager.generateBatchUploadUrls(userId, sessionId, validatedFiles);
      
      if (!urlResult.success) {
        return res.status(500).json({ 
          error: 'Failed to generate upload URLs',
          details: urlResult.error
        });
      }
      
      // Return presigned URLs to client
      res.json({
        success: true,
        urls: urlResult.urls,
        count: urlResult.count,
        totalSize: totalRequestSize,
        quotaRemaining: quotaCheck.quotaRemaining
      });
      
      console.log(`✅ Generated ${urlResult.count} presigned URLs for user ${userId}`);
      
    } catch (error) {
      console.error('Error generating presigned URLs:', error);
      res.status(500).json({ 
        error: 'Failed to generate upload URLs',
        message: error.message 
      });
    }
  });

  /**
   * POST /api/r2/confirm-uploads
   * Confirm successful uploads and update database
   * Called after client completes direct uploads to R2
   * SECURITY: Verifies actual file sizes and auto-deletes files that exceed limits
   */
  router.post('/confirm-uploads', async (req, res) => {
    try {
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { sessionId, uploadedFiles } = req.body;
      
      if (!sessionId || !uploadedFiles || !Array.isArray(uploadedFiles)) {
        return res.status(400).json({ 
          error: 'Invalid request. Session ID and uploaded files are required' 
        });
      }
      
      console.log(`📝 Confirming ${uploadedFiles.length} uploads for session ${sessionId}`);
      
      const confirmedFiles = [];
      const failedFiles = [];
      const deletedFiles = [];
      let totalActualSize = 0;
      let totalDeclaredSize = 0;
      
      // Import S3 commands once
      const { HeadObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
      
      // Verify each file exists in R2 and check actual sizes
      for (const file of uploadedFiles) {
        try {
          // SECURITY: Verify file exists and get ACTUAL size from R2
          const headCommand = new HeadObjectCommand({
            Bucket: r2Manager.bucketName,
            Key: file.key
          });
          
          const headResult = await r2Manager.s3Client.send(headCommand);
          
          if (headResult) {
            // CRITICAL: Use actual Content-Length from R2, not client-provided size
            const actualSizeBytes = headResult.ContentLength;
            const declaredSize = file.size || 0;
            const fileType = r2Manager.getFileTypeCategory(file.filename);
            
            totalDeclaredSize += declaredSize;
            
            // SECURITY: Check file size limits based on file type
            let maxSize;
            if (fileType === 'raw' || fileType === 'video') {
              maxSize = 5 * 1024 * 1024 * 1024; // 5GB for RAW/video
            } else if (fileType === 'gallery' || fileType === 'adobe') {
              maxSize = 500 * 1024 * 1024; // 500MB for images and Adobe files
            } else {
              maxSize = 100 * 1024 * 1024; // 100MB for other files
            }
            
            // SECURITY: Verify actual size against limits
            if (actualSizeBytes > maxSize) {
              console.error(`🚨 SECURITY VIOLATION: File ${file.filename} actual size (${(actualSizeBytes / (1024*1024)).toFixed(2)}MB) exceeds limit (${(maxSize / (1024*1024)).toFixed(0)}MB)`);
              
              // AUTO-DELETE file that exceeds limits
              const deleteCommand = new DeleteObjectCommand({
                Bucket: r2Manager.bucketName,
                Key: file.key
              });
              
              await r2Manager.s3Client.send(deleteCommand);
              console.log(`🗑️ Auto-deleted oversized file: ${file.filename}`);
              
              deletedFiles.push({
                filename: file.filename,
                key: file.key,
                actualSize: actualSizeBytes,
                maxAllowed: maxSize,
                reason: 'File size exceeds limit'
              });
              
              failedFiles.push({
                filename: file.filename,
                error: `File size (${(actualSizeBytes / (1024*1024)).toFixed(2)}MB) exceeds limit (${(maxSize / (1024*1024)).toFixed(0)}MB). File has been deleted.`
              });
              
              continue; // Skip to next file
            }
            
            // SECURITY: Check for size mismatch (potential bypass attempt)
            const sizeMismatchThreshold = 1024; // 1KB tolerance for minor differences
            if (declaredSize > 0 && Math.abs(actualSizeBytes - declaredSize) > sizeMismatchThreshold) {
              console.warn(`⚠️ Size mismatch for ${file.filename}: declared ${declaredSize} bytes, actual ${actualSizeBytes} bytes`);
            }
            
            // Add to total ACTUAL size (not declared size)
            totalActualSize += actualSizeBytes;
            
            // Update backup index with ACTUAL size
            await r2Manager.updateBackupIndex(userId, sessionId, {
              filename: file.filename,
              originalPath: file.key,
              backupPath: file.key,
              fileSizeBytes: actualSizeBytes, // Use ACTUAL size
              fileType: fileType,
              uploadedAt: new Date().toISOString(),
              status: 'uploaded',
              thumbnailGenerated: false,
              actualSize: actualSizeBytes,
              declaredSize: declaredSize
            });
            
            confirmedFiles.push({
              filename: file.filename,
              key: file.key,
              size: actualSizeBytes, // Return ACTUAL size
              declaredSize: declaredSize,
              fileType: fileType
            });
            
            // Generate thumbnails for image files in background
            if (r2Manager.isImageFile(file.filename)) {
              // Schedule thumbnail generation (non-blocking)
              setImmediate(async () => {
                try {
                  const getCommand = new GetObjectCommand({
                    Bucket: r2Manager.bucketName,
                    Key: file.key
                  });
                  
                  const getResult = await r2Manager.s3Client.send(getCommand);
                  const chunks = [];
                  for await (const chunk of getResult.Body) {
                    chunks.push(chunk);
                  }
                  const fileBuffer = Buffer.concat(chunks);
                  
                  await r2Manager.generateThumbnail(
                    fileBuffer,
                    file.filename,
                    userId,
                    sessionId,
                    fileType
                  );
                  
                  console.log(`🖼️ Thumbnail generated for ${file.filename}`);
                } catch (thumbError) {
                  console.error(`Failed to generate thumbnail for ${file.filename}:`, thumbError.message);
                }
              });
            }
          } else {
            throw new Error('File not found in R2');
          }
        } catch (error) {
          console.error(`Failed to confirm upload for ${file.filename}:`, error.message);
          failedFiles.push({
            filename: file.filename,
            error: error.message
          });
        }
      }
      
      // SECURITY: Check total actual size against storage quota
      const userEmail = req.user?.email;
      const adminEmails = [
        'lancecasselman@icloud.com',
        'lancecasselman2011@gmail.com', 
        'lance@thelegacyphotography.com'
      ];
      
      // Skip quota check for admin accounts
      const isAdmin = userEmail && adminEmails.includes(userEmail.toLowerCase());
      
      if (!isAdmin && totalActualSize > 0) {
        const quotaCheck = await storageSystem.checkStorageQuota(userId, totalActualSize);
        
        if (!quotaCheck.allowed) {
          console.error(`🚨 QUOTA VIOLATION: User ${userId} exceeded quota with ${(totalActualSize / (1024*1024*1024)).toFixed(2)}GB upload`);
          
          // Delete ALL files from this batch if quota exceeded
          for (const file of confirmedFiles) {
            try {
              const deleteCommand = new DeleteObjectCommand({
                Bucket: r2Manager.bucketName,
                Key: file.key
              });
              
              await r2Manager.s3Client.send(deleteCommand);
              console.log(`🗑️ Auto-deleted file due to quota violation: ${file.filename}`);
              
              deletedFiles.push({
                filename: file.filename,
                key: file.key,
                actualSize: file.size,
                reason: 'Storage quota exceeded'
              });
            } catch (deleteError) {
              console.error(`Failed to delete file ${file.filename}:`, deleteError.message);
            }
          }
          
          return res.status(413).json({
            error: 'Storage quota exceeded',
            message: quotaCheck.message,
            deletedFiles: deletedFiles,
            currentUsage: quotaCheck.currentUsage,
            quotaLimit: quotaCheck.quotaLimit,
            uploadedSize: totalActualSize
          });
        }
      }
      
      // Only update storage usage with ACTUAL sizes after all validations pass
      if (confirmedFiles.length > 0) {
        await storageSystem.updateStorageUsage(userId, totalActualSize);
      }
      
      // Get updated storage usage
      const currentUsage = await storageSystem.getUserStorageUsage(userId);
      
      // Return response with security details
      const response = {
        success: failedFiles.length === 0 && deletedFiles.length === 0,
        confirmed: confirmedFiles.length,
        failed: failedFiles.length,
        deleted: deletedFiles.length,
        confirmedFiles,
        failedFiles,
        deletedFiles,
        totalActualSize,
        totalDeclaredSize,
        sizeMismatch: totalActualSize !== totalDeclaredSize,
        storageUsage: {
          used: currentUsage.used,
          limit: currentUsage.limit,
          percentage: currentUsage.percentage
        }
      };
      
      // Log security events
      if (deletedFiles.length > 0) {
        console.log(`🚨 SECURITY: Auto-deleted ${deletedFiles.length} files for user ${userId}`, deletedFiles);
      }
      
      if (response.sizeMismatch) {
        console.log(`⚠️ Size mismatch detected: declared ${totalDeclaredSize} bytes, actual ${totalActualSize} bytes`);
      }
      
      res.json(response);
      
      console.log(`✅ Confirmed ${confirmedFiles.length} uploads, ${failedFiles.length} failed, ${deletedFiles.length} deleted`);
      
    } catch (error) {
      console.error('Error confirming uploads:', error);
      res.status(500).json({ 
        error: 'Failed to confirm uploads',
        message: error.message 
      });
    }
  });

  return router;
}

module.exports = createR2Routes;