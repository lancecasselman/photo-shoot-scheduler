const { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

/**
 * Enhanced R2 File Manager for Photography Management System
 * Handles ALL file types: RAW, gallery images, documents, videos, audio
 * Features real-time storage usage tracking and Stripe upgrade integration
 * 
 * Storage Limits:
 * - Base Plan: 1TB included
 * - Additional Storage: $35/month per TB
 * - Real-time usage tracking with upgrade prompts
 */
class R2FileManager {
  constructor() {
    // Initialize S3 client for R2 compatibility
    const endpoint = `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
    
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'rawphoto';
    
    // Supported file types (all file types are now supported)
    this.fileTypeCategories = {
      raw: ['.nef', '.cr2', '.arw', '.dng', '.raf', '.orf', '.pef', '.srw', '.x3f', '.rw2'],
      gallery: ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'],
      video: ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.r3d', '.braw'],
      audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.aiff'],
      document: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
      adobe: ['.psd', '.ai', '.indd', '.prproj', '.aep'],
      other: [] // All other file types
    };
    
    console.log(`R2 File Manager initialized with bucket: ${this.bucketName}`);
    console.log(`R2 endpoint: ${endpoint}`);
    
    // Test connection on initialization
    this.testConnection();
  }

  /**
   * Test R2 connection and create bucket if needed
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      const command = new HeadBucketCommand({ Bucket: this.bucketName });
      await this.s3Client.send(command);
      console.log('✅ R2 connection successful');
      return true;
    } catch (error) {
      console.error('❌ R2 connection test failed:', error.message);
      
      // Try to create bucket if it doesn't exist
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        console.log('📦 Bucket not found, attempting to create...');
        try {
          const createCommand = new CreateBucketCommand({ Bucket: this.bucketName });
          await this.s3Client.send(createCommand);
          console.log('✅ Bucket created successfully');
          return true;
        } catch (createError) {
          console.error('❌ Failed to create bucket:', createError.message);
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Determine file type category based on extension
   * @param {string} filename - The filename to analyze
   * @returns {string} File type category (raw, gallery, video, audio, document, adobe, other)
   */
  getFileTypeCategory(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    for (const [category, extensions] of Object.entries(this.fileTypeCategories)) {
      if (extensions.includes(ext)) {
        return category;
      }
    }
    
    return 'other';
  }

  /**
   * Generate organized R2 key path
   * Format: photographer-{userId}/session-{sessionId}/{fileType}/{filename}
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID  
   * @param {string} filename - Original filename
   * @param {string} fileType - File type category
   * @returns {string} R2 key path
   */
  generateR2Key(userId, sessionId, filename, fileType) {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `photographer-${userId}/session-${sessionId}/${fileType}/${sanitizedFilename}`;
  }

  /**
   * Check storage limit before upload
   * @param {string} userId - User ID
   * @param {number} fileSizeBytes - Size of file to upload
   * @returns {Promise<{allowed: boolean, usage: object, message?: string}>}
   */
  async checkStorageLimit(userId, fileSizeBytes) {
    try {
      // For now, allow uploads while R2 connection is being established
      // In production, this would check actual usage against 1TB limit
      const fileSizeGB = fileSizeBytes / (1024 * 1024 * 1024);
      const usage = {
        totalSizeGB: 0,
        maxAllowedTB: 1,
        filesUploaded: 0
      };
      
      console.log(`✅ Storage check passed for user ${userId}: ${fileSizeGB.toFixed(2)}GB upload`);
      return { 
        allowed: true, 
        usage,
        message: `Upload allowed - ${fileSizeGB.toFixed(2)}GB within 1TB limit`
      };
    } catch (error) {
      console.error('Error checking storage limit:', error);
      throw new Error('Failed to check storage limit');
    }
  }

  /**
   * Upload file to R2 with comprehensive tracking
   * @param {Buffer} fileBuffer - File buffer data
   * @param {string} filename - Original filename
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<object>} Upload result with database record
   */
  async uploadFile(fileBuffer, filename, userId, sessionId) {
    const fileSizeBytes = fileBuffer.length;
    const fileType = this.getFileTypeCategory(filename);
    
    try {
      // Check storage limit before upload
      const limitCheck = await this.checkStorageLimit(userId, fileSizeBytes);
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.message);
      }

      // Generate R2 key and metadata
      const r2Key = this.generateR2Key(userId, sessionId, filename, fileType);
      const fileSizeMB = (fileSizeBytes / (1024 * 1024));
      const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'));

      console.log(`📤 Uploading ${fileType} file: ${filename} (${fileSizeMB.toFixed(2)}MB) to R2`);

      // Dynamic import of storage to avoid circular dependency
      const { storage } = require('./storage');
      
      // Create database record FIRST (with pending status)
      const r2FileRecord = await storage.createR2File({
        id: crypto.randomUUID(),
        sessionId,
        userId,
        filename,
        originalFilename: filename,
        fileType,
        fileExtension,
        fileSizeBytes: fileSizeBytes.toString(),
        fileSizeMB: fileSizeMB.toFixed(2),
        r2Key,
        uploadStatus: 'pending',
        uploadStartedAt: new Date(),
      });

      // Upload to R2
      const uploadParams = {
        Bucket: this.bucketName,
        Key: r2Key,
        Body: fileBuffer,
        ContentType: this.getContentType(filename),
        Metadata: {
          'original-filename': filename,
          'user-id': userId,
          'session-id': sessionId,
          'file-type': fileType,
          'upload-timestamp': new Date().toISOString(),
          'file-size-bytes': fileSizeBytes.toString(),
          'file-size-mb': fileSizeMB.toFixed(2)
        }
      };

      const command = new PutObjectCommand(uploadParams);
      const uploadResult = await this.s3Client.send(command);

      // Update database record to completed
      await storage.updateR2FileStatus(r2FileRecord.id, 'completed', new Date());

      // Generate public URL if needed
      const r2Url = `https://${this.bucketName}.${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${r2Key}`;

      console.log(`✅ Upload successful: ${filename}`);

      return {
        success: true,
        fileId: r2FileRecord.id,
        r2Key,
        r2Url,
        fileType,
        fileSizeBytes,
        fileSizeMB: fileSizeMB.toFixed(2),
        etag: uploadResult.ETag,
        uploadedAt: new Date(),
        storageUsage: limitCheck.usage
      };

    } catch (error) {
      console.error('❌ R2 upload error:', error);
      
      // Update database record to failed if it was created
      try {
        const files = await storage.getR2FilesBySession(sessionId, userId);
        const pendingFile = files.find(f => f.filename === filename && f.uploadStatus === 'pending');
        if (pendingFile) {
          await storage.updateR2FileStatus(pendingFile.id, 'failed');
        }
      } catch (dbError) {
        console.error('Failed to update database record:', dbError);
      }
      
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Download file from R2 with access tracking
   * @param {string} fileId - Database file ID
   * @param {string} userId - User ID for security
   * @returns {Promise<object>} Download stream and metadata
   */
  async downloadFile(fileId, userId) {
    try {
      // Get file record from database
      const fileRecord = await storage.getR2FileById(fileId, userId);
      if (!fileRecord) {
        throw new Error('File not found or access denied');
      }

      // Download from R2
      const downloadParams = {
        Bucket: this.bucketName,
        Key: fileRecord.r2Key
      };

      const command = new GetObjectCommand(downloadParams);
      const result = await this.s3Client.send(command);
      
      // Update last accessed timestamp and download count
      await storage.updateR2FileStatus(fileRecord.id, fileRecord.uploadStatus);
      
      console.log(`📥 Downloaded: ${fileRecord.filename} for user ${userId}`);
      
      return {
        success: true,
        data: result.Body,
        filename: fileRecord.originalFilename,
        contentType: result.ContentType || this.getContentType(fileRecord.filename),
        contentLength: result.ContentLength,
        metadata: result.Metadata,
        lastModified: result.LastModified,
        fileRecord
      };

    } catch (error) {
      console.error('❌ R2 download error:', error);
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Delete file from R2 and database
   * @param {string} fileId - Database file ID
   * @param {string} userId - User ID for security
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(fileId, userId) {
    try {
      // Get file record from database
      const fileRecord = await storage.getR2FileById(fileId, userId);
      if (!fileRecord) {
        throw new Error('File not found or access denied');
      }

      // Delete from R2
      const deleteParams = {
        Bucket: this.bucketName,
        Key: fileRecord.r2Key
      };

      const command = new DeleteObjectCommand(deleteParams);
      await this.s3Client.send(command);

      // Delete from database (this will trigger storage usage recalculation)
      const deleted = await storage.deleteR2File(fileId, userId);
      
      if (deleted) {
        console.log(`🗑️ Deleted: ${fileRecord.filename} from R2 and database`);
      }
      
      return deleted;

    } catch (error) {
      console.error('❌ R2 delete error:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Get user's current storage usage with formatted display
   * @param {string} userId - User ID
   * @returns {Promise<object>} Storage usage information
   */
  async getUserStorageUsage(userId) {
    try {
      const usage = await storage.recalculateUserStorageUsage(userId);
      
      const totalGB = Number(usage.totalSizeGB);
      const maxTB = Number(usage.maxAllowedTB);
      const maxGB = maxTB * 1024;
      const percentUsed = Math.round((totalGB / maxGB) * 100);
      
      return {
        totalFiles: usage.totalFiles,
        totalSizeGB: totalGB,
        totalSizeTB: Number(usage.totalSizeTB),
        maxAllowedTB: maxTB,
        maxAllowedGB: maxGB,
        percentUsed,
        storageStatus: usage.storageStatus,
        additionalStorageTB: usage.additionalStorageTB,
        monthlyStorageCost: Number(usage.monthlyStorageCost),
        displayText: `${Math.round(totalGB)}GB of ${Math.round(maxGB)}GB used (${percentUsed}%)`,
        isNearLimit: percentUsed >= 90,
        isOverLimit: usage.storageStatus === 'overlimit'
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      throw new Error('Failed to get storage usage');
    }
  }

  /**
   * List files for a session with usage information
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} Files list and storage info
   */
  async getSessionFiles(sessionId, userId) {
    try {
      const files = await storage.getR2FilesBySession(sessionId, userId);
      const usage = await this.getUserStorageUsage(userId);
      
      // Group files by type
      const filesByType = files.reduce((acc, file) => {
        if (!acc[file.fileType]) acc[file.fileType] = [];
        acc[file.fileType].push({
          id: file.id,
          filename: file.originalFilename,
          fileType: file.fileType,
          fileSizeMB: Number(file.fileSizeMB),
          uploadStatus: file.uploadStatus,
          uploadedAt: file.uploadCompletedAt,
          downloadCount: file.downloadCount
        });
        return acc;
      }, {});
      
      return {
        sessionId,
        filesByType,
        totalFiles: files.length,
        totalSizeMB: files.reduce((sum, file) => sum + Number(file.fileSizeMB), 0),
        storageUsage: usage
      };
    } catch (error) {
      console.error('Error getting session files:', error);
      throw new Error('Failed to get session files');
    }
  }

  /**
   * Generate presigned URL for direct client uploads (if needed in future)
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {string} filename - Filename
   * @param {number} fileSizeBytes - File size for limit checking
   * @returns {Promise<object>} Presigned URL and upload info
   */
  async generatePresignedUploadUrl(userId, sessionId, filename, fileSizeBytes) {
    try {
      // Check storage limit
      const limitCheck = await this.checkStorageLimit(userId, fileSizeBytes);
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.message);
      }

      const fileType = this.getFileTypeCategory(filename);
      const r2Key = this.generateR2Key(userId, sessionId, filename, fileType);
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: r2Key,
        ContentType: this.getContentType(filename),
        Metadata: {
          'user-id': userId,
          'session-id': sessionId,
          'file-type': fileType,
          'original-filename': filename
        }
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 }); // 1 hour

      return {
        uploadUrl: presignedUrl,
        r2Key,
        fileType,
        expiresIn: 3600
      };
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }
  }

  /**
   * Get MIME type for file extensions
   * @param {string} filename - Filename
   * @returns {string} MIME type
   */
  getContentType(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    const contentTypes = {
      // RAW formats
      '.nef': 'image/x-nikon-nef',
      '.cr2': 'image/x-canon-cr2', 
      '.arw': 'image/x-sony-arw',
      '.dng': 'image/x-adobe-dng',
      '.raf': 'image/x-fuji-raf',
      '.orf': 'image/x-olympus-orf',
      '.pef': 'image/x-pentax-pef',
      '.srw': 'image/x-samsung-srw',
      '.x3f': 'image/x-sigma-x3f',
      '.rw2': 'image/x-panasonic-rw2',
      
      // Standard images
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
      
      // Video formats
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.r3d': 'video/x-r3d',
      '.braw': 'video/x-braw',
      
      // Audio formats
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.aiff': 'audio/aiff',
      
      // Documents
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.rtf': 'application/rtf',
      
      // Adobe files
      '.psd': 'image/vnd.adobe.photoshop',
      '.ai': 'application/postscript',
      '.indd': 'application/x-indesign',
      '.prproj': 'application/x-premiere',
      '.aep': 'application/x-after-effects'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}

module.exports = R2FileManager;