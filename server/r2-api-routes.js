const express = require('express');
const multer = require('multer');
const R2FileManager = require('./r2-file-manager');
// REMOVED: Old stripe storage billing - using new storage system
const R2SyncService = require('./r2-sync-service');
const UnifiedFileDeletionService = require('./unified-file-deletion');
const { Pool } = require('pg');

// Configure multer for file uploads (memory storage for direct R2 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types - photographers need to store everything
    cb(null, true);
  }
});

/**
 * R2 Storage API Routes
 * All routes handle authentication and storage limit enforcement
 * Frontend never receives R2 credentials - all operations go through backend
 */
function createR2Routes() {
  const router = express.Router();
  const r2Manager = new R2FileManager();
  // REMOVED: Old storage billing - using new storage system
  const syncService = new R2SyncService(r2Manager);
  const unifiedDeletion = new UnifiedFileDeletionService();
  
  // Database connection for API routes
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Authentication middleware for all routes - compatible with main server auth
  router.use((req, res, next) => {
    // Check for existing authentication from main server
    if (req.isAuthenticated && req.isAuthenticated()) {
      req.user = req.user || req.session.user;
      return next();
    }
    
    // Fallback to session-based auth
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }
    
    console.log('R2 API Auth failed - no valid session');
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
        }
        
        const sessionsResult = await pool.query(sessionsQuery, queryParams);
        
        console.log(`📊 Calculating storage for ${sessionsResult.rows.length} sessions`);
        
        // Calculate storage for each session
        for (const session of sessionsResult.rows) {
          console.log(`📊 Calculating storage for session: ${session.id}`);
          
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
        console.log(`💾 Storage calculated: Gallery: ${(galleryBytes / (1024**3)).toFixed(2)} GB, RAW: ${(rawBytes / (1024**3)).toFixed(2)} GB`);
        
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
   * POST /api/r2/upload
   * Upload files to R2 with storage limit checking
   * Supports multiple files and all file types
   */
  router.post('/upload', upload.array('files', 50), async (req, res) => {
    try {
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      console.log(`📤 Processing ${req.files.length} files for user ${userId}, session ${sessionId}`);

      // Check total upload size against storage limit
      const totalUploadSize = req.files.reduce((sum, file) => sum + file.size, 0);
      const limitCheck = await r2Manager.checkStorageLimit(userId, totalUploadSize);
      
      if (!limitCheck.allowed) {
        return res.status(413).json({ 
          error: 'Storage limit exceeded',
          message: limitCheck.message,
          usage: limitCheck.usage,
          upgradeRequired: true
        });
      }

      // Upload files in parallel for better performance
      const uploadPromises = req.files.map(file => 
        r2Manager.uploadFile(file.buffer, file.originalname, userId, sessionId)
      );
      
      const uploadResults = await Promise.allSettled(uploadPromises);
      
      // Separate successful and failed uploads
      const successful = [];
      const failed = [];
      
      uploadResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            filename: req.files[index].originalname,
            error: result.reason?.message || 'Upload failed'
          });
        }
      });

      // Get updated storage usage
      const updatedUsage = await r2Manager.getUserStorageUsage(userId);

      res.json({
        success: true,
        uploaded: successful.length,
        failed: failed.length,
        results: {
          successful,
          failed
        },
        storageUsage: updatedUsage
      });

    } catch (error) {
      console.error('Error uploading files:', error);
      res.status(500).json({ error: 'Upload failed', details: error.message });
    }
  });

  /**
   * POST /api/r2/backup-upload
   * Alternative upload endpoint for RAW backup dashboard
   * Same functionality as /upload but with different response format
   */
  router.post('/backup-upload', upload.array('files', 50), async (req, res) => {
    try {
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      console.log(`📱 RAW BACKUP: Processing ${req.files.length} RAW files for user ${userId}, session ${sessionId}`);

      // Check total upload size against storage limit
      const totalUploadSize = req.files.reduce((sum, file) => sum + file.size, 0);
      const limitCheck = await r2Manager.checkStorageLimit(userId, totalUploadSize);
      
      if (!limitCheck.allowed) {
        return res.status(413).json({ 
          error: 'Storage limit exceeded',
          message: limitCheck.message,
          upgradeRequired: true
        });
      }

      // Upload files as RAW backup files (NOT gallery files)
      const uploadPromises = req.files.map(file => 
        r2Manager.uploadFile(file.buffer, file.originalname, userId, sessionId, 'raw')
      );
      
      const uploadResults = await Promise.allSettled(uploadPromises);
      
      // Count successful and failed uploads
      let successfulUploads = 0;
      let failedUploads = 0;
      
      uploadResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          successfulUploads++;
        } else {
          failedUploads++;
          console.error('Upload failed:', result.reason?.message);
        }
      });

      res.json({
        success: true,
        sessionId,
        totalFiles: req.files.length,
        successfulUploads,
        failedUploads,
        message: `Successfully uploaded ${successfulUploads} of ${req.files.length} files to R2 Cloud Storage`
      });

    } catch (error) {
      console.error('R2 backup upload error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Upload failed', 
        message: error.message 
      });
    }
  });

  /**
   * POST /api/r2/gallery-upload
   * Upload files specifically to gallery folder (not RAW backup)
   */
  router.post('/gallery-upload', upload.array('files', 50), async (req, res) => {
    try {
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      console.log(`📸 Gallery Upload: Processing ${req.files.length} files for user ${userId}, session ${sessionId}`);

      // Check total upload size against storage limit
      const totalUploadSize = req.files.reduce((sum, file) => sum + file.size, 0);
      const limitCheck = await r2Manager.checkStorageLimit(userId, totalUploadSize);
      
      if (!limitCheck.allowed) {
        return res.status(413).json({ 
          error: 'Storage limit exceeded',
          message: limitCheck.message,
          upgradeRequired: true
        });
      }

      // Upload files as GALLERY files (not RAW backup)
      const uploadPromises = req.files.map(file => 
        r2Manager.uploadFile(file.buffer, file.originalname, userId, sessionId, 'gallery')
      );
      
      const uploadResults = await Promise.allSettled(uploadPromises);
      
      // Count successful and failed uploads
      let successfulUploads = 0;
      let failedUploads = 0;
      
      uploadResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          successfulUploads++;
        } else {
          failedUploads++;
          console.error('Gallery upload failed:', result.reason?.message);
        }
      });

      res.json({
        success: true,
        sessionId,
        totalFiles: req.files.length,
        successfulUploads,
        failedUploads,
        message: `Successfully uploaded ${successfulUploads} of ${req.files.length} gallery photos`
      });

    } catch (error) {
      console.error('Gallery upload error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Gallery upload failed', 
        message: error.message 
      });
    }
  });

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
   * GET /api/r2/preview/:sessionId/:filename
   * Get image preview from R2 storage (converted to JPEG for browser compatibility)
   */
  router.get('/preview/:sessionId/:filename', async (req, res) => {
    try {
      const sharp = require('sharp');
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;
      const { sessionId, filename } = req.params;
      
      console.log(`🖼️ Preview request: ${filename} for session ${sessionId}`);
      
      // Get file from R2
      const downloadResult = await r2Manager.downloadFile(userId, sessionId, filename);
      
      if (!downloadResult.success) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      // Check if file is an image that needs conversion
      const isRawImage = filename.toLowerCase().includes('.tif') || 
                        filename.toLowerCase().includes('.raw') ||
                        filename.toLowerCase().includes('.cr2') ||
                        filename.toLowerCase().includes('.nef');
      
      if (isRawImage) {
        // Convert to JPEG for browser display
        const jpegBuffer = await sharp(downloadResult.buffer)
          .jpeg({ quality: 85, progressive: true })
          .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(jpegBuffer);
        
        console.log(`✅ Converted ${filename} to JPEG preview`);
      } else {
        // Send original file for standard formats
        res.setHeader('Content-Type', downloadResult.contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(downloadResult.buffer);
      }
      
    } catch (error) {
      console.error('Preview error:', error);
      res.status(404).json({ error: 'Image preview failed' });
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
      
      console.log(`📦 ZIP download request for session ${sessionId} by user ${currentUserId}`);
      
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
      
      console.log(`📊 Total ZIP size estimate: ${(totalSize / (1024*1024*1024)).toFixed(2)} GB`);
      
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
            console.log(`✅ Added ${file.filename} | Progress: ${progressPercent}% (${processedGB}GB/${totalGB}GB)`);
            
            // Force garbage collection hint for huge files
            if (global.gc && file.size > 500 * 1024 * 1024) { // 500MB+
              global.gc();
            }
          } else {
            console.warn(`⚠️ Failed to download ${file.filename} for ZIP`);
          }
        } catch (fileError) {
          console.error(`Error adding ${file.filename} to ZIP:`, fileError);
        }
      }
      
      // Finalize the archive and wait for completion
      console.log('📦 Finalizing ZIP archive...');
      
      // Set up promise to wait for archive completion
      const archivePromise = new Promise((resolve, reject) => {
        archive.on('end', () => {
          console.log(`✅ ZIP download completed for session ${sessionId}`);
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
      
      console.log(`✅ File downloaded: ${filename} by user ${currentUserId}`);
      
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
        console.log(`✅ File deleted: ${filename}`);
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
        console.log(`✅ File deleted: ${filename}`);
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

  return router;
}

module.exports = createR2Routes;