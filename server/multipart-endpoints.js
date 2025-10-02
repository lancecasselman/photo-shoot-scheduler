/**
 * Enhanced Multipart Upload Endpoints
 * Provides server-side endpoints for the optimized multipart upload system
 */

const express = require('express');
const { S3Client } = require('@aws-sdk/client-s3');
const MultipartUploader = require('./multipart-upload');
const R2FileManager = require('./r2-file-manager');

function createMultipartRoutes(pool) {
  const router = express.Router();

  // Initialize R2 and multipart uploader
  const r2Manager = new R2FileManager(null, pool);

  // Authentication middleware
  router.use((req, res, next) => {
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    const hasValidSession = req.session && req.session.user && req.session.user.uid;

    if (isAuthenticated && req.user && req.user.uid) {
      return next();
    }

    if (hasValidSession) {
      req.user = req.session.user;
      if (req.user.uid) {
        return next();
      }
    }

    return res.status(401).json({ error: 'Authentication required for multipart uploads' });
  });

  /**
   * POST /api/r2/multipart/create
   * Create multipart upload and return upload parameters
   */
  router.post('/create', async (req, res) => {
    try {
      const { fileName, fileSize, contentType, sessionId, folderType = 'gallery' } = req.body;
      const userId = req.user.normalized_uid || req.user.uid || req.user.id;

      console.log(`🚀 Creating multipart upload: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);

      if (!fileName || !fileSize || !sessionId) {
        return res.status(400).json({ 
          error: 'Missing required parameters: fileName, fileSize, sessionId' 
        });
      }

      // Validate folderType - allow all types including gallery
      const validFolderTypes = ['gallery', 'video', 'document', 'other'];
      if (!validFolderTypes.includes(folderType)) {
        console.log(`⚠️ Invalid folder type ${folderType}, defaulting to gallery`);
        folderType = 'gallery';
      }

      // Storage quota check with admin bypass
      const StorageSystem = require('./storage-system');
      const storageSystem = new StorageSystem(pool, r2Manager);

      const adminEmails = [
        'lancecasselman@icloud.com',
        'lancecasselman2011@gmail.com', 
        'lance@thelegacyphotography.com'
      ];

      if (req.user?.email && adminEmails.includes(req.user.email.toLowerCase())) {
        console.log(`✅ Admin bypass for multipart upload: ${req.user.email} has unlimited storage`);
      } else {
        const canUploadResult = await storageSystem.canUpload(userId, fileSize, req.user.email);
        if (!canUploadResult.canUpload) {
          // Allow upload if within 150% of base quota (very lenient for multipart uploads)
          if (canUploadResult.isOverBaseQuota && canUploadResult.currentUsageGB < (canUploadResult.quotaGB * 1.5)) {
            console.log(`⚠️ Multipart upload over base quota but within tolerance, allowing upload`);
          } else {
            return res.status(413).json({
              error: 'Storage quota exceeded',
              usage: {
                currentGB: canUploadResult.currentUsageGB,
                quotaGB: canUploadResult.quotaGB,
                effectiveQuotaGB: canUploadResult.effectiveQuotaGB,
                remainingGB: canUploadResult.remainingGB,
                requestedGB: (fileSize / (1024 * 1024 * 1024)).toFixed(2)
              },
              upgradeRequired: true
            });
          }
        }
      }

      // Generate R2 key for the file
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `${userId}/${sessionId}/${folderType}/${timestamp}_${sanitizedFileName}`;

      // Get multipart uploader instance
      const s3Client = r2Manager.s3Client;
      const bucketName = r2Manager.bucketName;
      const multipartUploader = new MultipartUploader(s3Client, bucketName);

      // Calculate optimal chunk configuration
      const chunkSize = multipartUploader.calculateOptimalChunkSize(fileSize);
      const totalParts = Math.ceil(fileSize / chunkSize);
      const concurrency = multipartUploader.calculateOptimalConcurrency(fileSize, totalParts);

      // Create multipart upload
      const { CreateMultipartUploadCommand } = require('@aws-sdk/client-s3');
      const createResponse = await s3Client.send(
        new CreateMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
          ContentType: contentType || 'application/octet-stream',
          Metadata: {
            userId: userId,
            sessionId: sessionId,
            folderType: folderType,
            originalFileName: fileName,
            uploadTimestamp: timestamp.toString()
          }
        })
      );

      const uploadId = createResponse.UploadId;
      console.log(`✅ Multipart upload created: ${uploadId} (${totalParts} parts)`);

      // Store upload metadata in database for tracking
      await pool.query(`
        INSERT INTO multipart_uploads (
          upload_id, user_id, session_id, folder_type, key, 
          file_name, file_size, total_parts, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (upload_id) DO UPDATE SET
          created_at = NOW()
      `, [uploadId, userId, sessionId, folderType, key, fileName, fileSize, totalParts]);

      // Return Uppy-compatible response
      res.json({
        method: 'POST',
        url: `/api/r2/multipart/upload/${uploadId}`,
        headers: {
          'x-upload-key': key,
          'x-total-parts': totalParts.toString(),
          'x-chunk-size': chunkSize.toString(),
          'x-concurrency': concurrency.toString()
        },
        fields: {
          uploadId: uploadId,
          key: key,
          bucket: bucketName,
          totalParts: totalParts,
          chunkSize: chunkSize,
          concurrency: concurrency
        }
      });

    } catch (error) {
      console.error('❌ Multipart upload creation failed:', error);
      res.status(500).json({ 
        error: 'Failed to create multipart upload',
        details: error.message 
      });
    }
  });

  /**
   * POST /api/r2/multipart/upload/:uploadId
   * Handle multipart upload execution
   */
  router.post('/upload/:uploadId', async (req, res) => {
    const { uploadId } = req.params;
    const userId = req.user.normalized_uid || req.user.uid || req.user.id;

    try {
      console.log(`📤 Processing multipart upload: ${uploadId}`);

      // Get upload metadata from database
      const uploadQuery = await pool.query(
        'SELECT * FROM multipart_uploads WHERE upload_id = $1 AND user_id = $2',
        [uploadId, userId]
      );

      if (uploadQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Upload session not found' });
      }

      const uploadData = uploadQuery.rows[0];
      const { key, file_name, session_id, folder_type } = uploadData;

      // Get file buffer from request
      let fileBuffer;
      if (req.body && req.body.data) {
        // Handle base64 encoded data
        fileBuffer = Buffer.from(req.body.data, 'base64');
      } else if (req.file && req.file.buffer) {
        // Handle multer file upload
        fileBuffer = req.file.buffer;
      } else {
        return res.status(400).json({ error: 'No file data provided' });
      }

      // Use enhanced multipart uploader
      const s3Client = r2Manager.s3Client;
      const bucketName = r2Manager.bucketName;
      const multipartUploader = new MultipartUploader(s3Client, bucketName);

      const uploadResult = await multipartUploader.uploadLargeFile(
        fileBuffer, 
        key, 
        req.headers['content-type'] || 'application/octet-stream',
        {
          userId: userId,
          sessionId: session_id,
          folderType: folder_type,
          originalFileName: file_name
        }
      );

      // Update database with successful upload
      await pool.query(
        'UPDATE multipart_uploads SET completed_at = NOW(), success = true WHERE upload_id = $1',
        [uploadId]
      );

      // Track storage usage
      await r2Manager.trackFileUpload(userId, session_id, folder_type, file_name, fileBuffer.length);

      console.log(`✅ Multipart upload completed: ${file_name}`);

      res.json({
        success: true,
        key: key,
        fileName: file_name,
        size: fileBuffer.length,
        location: uploadResult.location,
        etag: uploadResult.etag
      });

    } catch (error) {
      console.error(`❌ Multipart upload failed: ${uploadId}:`, error);

      // Update database with failure
      await pool.query(
        'UPDATE multipart_uploads SET completed_at = NOW(), success = false, error = $2 WHERE upload_id = $1',
        [uploadId, error.message]
      );

      res.status(500).json({ 
        error: 'Multipart upload failed',
        details: error.message 
      });
    }
  });

  /**
   * DELETE /api/r2/multipart/abort/:uploadId
   * Abort multipart upload and clean up
   */
  router.delete('/abort/:uploadId', async (req, res) => {
    const { uploadId } = req.params;
    const userId = req.user.normalized_uid || req.user.uid || req.user.id;

    try {
      // Get upload metadata
      const uploadResult = await pool.query(
        'SELECT key FROM multipart_uploads WHERE upload_id = $1 AND user_id = $2',
        [uploadId, userId]
      );

      if (uploadResult.rows.length === 0) {
        return res.status(404).json({ error: 'Upload session not found' });
      }

      const key = uploadResult.rows[0].key;

      // Abort multipart upload on R2
      const { AbortMultipartUploadCommand } = require('@aws-sdk/client-s3');
      const s3Client = r2Manager.s3Client;
      const bucketName = r2Manager.bucketName;

      await s3Client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
          UploadId: uploadId
        })
      );

      // Clean up database
      await pool.query(
        'DELETE FROM multipart_uploads WHERE upload_id = $1',
        [uploadId]
      );

      console.log(`🗑️ Multipart upload aborted: ${uploadId}`);
      res.json({ success: true, message: 'Upload aborted successfully' });

    } catch (error) {
      console.error('Error aborting multipart upload:', error);
      res.status(500).json({ 
        error: 'Failed to abort upload',
        details: error.message 
      });
    }
  });

  // Create multipart_uploads table if it doesn't exist
  router.use(async (req, res, next) => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS multipart_uploads (
          upload_id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          session_id VARCHAR(255) NOT NULL,
          folder_type VARCHAR(50) NOT NULL,
          key VARCHAR(1000) NOT NULL,
          file_name VARCHAR(500) NOT NULL,
          file_size BIGINT NOT NULL,
          total_parts INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP NULL,
          success BOOLEAN DEFAULT FALSE,
          error TEXT NULL
        )
      `);
    } catch (error) {
      console.error('Error creating multipart_uploads table:', error);
    }
    next();
  });

  return router;
}

module.exports = createMultipartRoutes;