const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const sharp = require('sharp');

class R2FileManager {
  constructor(localBackup, pool = null) {
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    this.accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    this.accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    this.localBackup = localBackup;
    this.pool = pool;
    this.db = pool; // Database connection pool
    this.r2Available = false;
    
    // Debug database connection
    if (pool) {
      console.log(' R2FileManager: Database pool connected');
    } else {
      console.log(' R2FileManager: No database pool provided');
    }
    
    // File type categories for organization
    this.fileTypeCategories = {
      'raw': ['.nef', '.cr2', '.arw', '.dng', '.raf', '.orf', '.rw2', '.3fr', '.crw', '.dcr', '.erf', '.k25', '.kdc', '.mrw', '.pef', '.sr2', '.srf', '.x3f'],
      'gallery': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif'],  
      'video': ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v'],
      'audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
      'document': ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'],
      'adobe': ['.psd', '.ai', '.indd', '.eps', '.xd'],
      'other': []
    };

    if (!this.bucketName || !this.accountId || !this.accessKeyId || !this.secretAccessKey) {
      console.log(' R2 credentials missing - using local backup only');
      return;
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
      forcePathStyle: true,
    });

    console.log(`R2 File Manager initialized with bucket: ${this.bucketName}`);
    console.log(`R2 endpoint: https://${this.accountId}.r2.cloudflarestorage.com`);
    
    // Test connection
    this.testConnection();
  }

  async testConnection() {
    try {
      const headCommand = new HeadBucketCommand({ Bucket: this.bucketName });
      await this.s3Client.send(headCommand);
      console.log(' R2 connection successful - cloud backup active');
      this.r2Available = true;
      return true;
    } catch (error) {
      console.log(' R2 unavailable - using local backup fallback');
      console.log(`   Error: ${error.code} - ${error.message?.substring(0, 50)}`);
      this.r2Available = false;
      
      // Try to create bucket if it doesn't exist
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        console.log(' Bucket not found, attempting to create...');
        try {
          const createCommand = new CreateBucketCommand({ Bucket: this.bucketName });
          await this.s3Client.send(createCommand);
          console.log(' Bucket created successfully');
          this.r2Available = true;
          return true;
        } catch (createError) {
          console.error('❌ Failed to create bucket:', createError.message);
          this.r2Available = false;
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Determine file type category based on extension
   */
  getFileTypeCategory(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'other';
    }
    
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    for (const [category, extensions] of Object.entries(this.fileTypeCategories)) {
      if (extensions.includes(ext)) {
        return category;
      }
    }
    
    return 'other';
  }

  // Check if file is an image that can be processed
  isImageFile(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const imageExtensions = [
      ...this.fileTypeCategories.raw,
      ...this.fileTypeCategories.gallery,
      '.heic', '.heif', '.avif' // Additional formats Sharp can handle
    ];
    return imageExtensions.includes(ext);
  }

  // Generate thumbnail for uploaded images
  async generateThumbnail(fileBuffer, originalFilename, userId, sessionId, fileType) {
    try {
      console.log(`🖼️ Generating thumbnail for: ${originalFilename}`);

      // Create thumbnail filename
      const ext = originalFilename.split('.').pop();
      const baseName = originalFilename.replace(`.${ext}`, '');
      
      // Generate multiple thumbnail sizes for different use cases
      const thumbnailSizes = [
        { suffix: '_sm', width: 150, height: 150, quality: 80 }, // Small thumbnail
        { suffix: '_md', width: 400, height: 300, quality: 85 }, // Medium preview
        { suffix: '_lg', width: 800, height: 600, quality: 90 }  // Large preview
      ];

      const thumbnails = [];

      for (const size of thumbnailSizes) {
        try {
          // Process image with Sharp
          let processedBuffer;
          
          // Handle different file types
          const isRawFile = this.fileTypeCategories.raw.includes('.' + ext.toLowerCase());
          
          if (isRawFile) {
            // For RAW files, extract embedded JPEG if possible, otherwise convert
            try {
              processedBuffer = await sharp(fileBuffer)
                .jpeg({ quality: size.quality, progressive: true, mozjpeg: true })
                .resize(size.width, size.height, { 
                  fit: 'inside', 
                  withoutEnlargement: true,
                  background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .toBuffer();
            } catch (rawError) {
              console.warn(` RAW processing failed for ${originalFilename}, trying basic conversion`);
              // Fallback for difficult RAW formats
              processedBuffer = await sharp(fileBuffer)
                .resize(size.width, size.height, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: size.quality })
                .toBuffer();
            }
          } else {
            // Standard image processing
            processedBuffer = await sharp(fileBuffer)
              .resize(size.width, size.height, { 
                fit: 'inside', 
                withoutEnlargement: true,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
              })
              .jpeg({ quality: size.quality, progressive: true })
              .toBuffer();
          }

          // Upload thumbnail to R2
          const thumbnailKey = `photographer-${userId}/session-${sessionId}/thumbnails/${baseName}${size.suffix}.jpg`;
          
          const putCommand = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: thumbnailKey,
            Body: processedBuffer,
            ContentType: 'image/jpeg',
            Metadata: {
              'original-file': originalFilename,
              'thumbnail-size': size.suffix,
              'original-type': fileType,
              'generated-at': new Date().toISOString()
            }
          });

          await this.s3Client.send(putCommand);
          
          thumbnails.push({
            size: size.suffix,
            key: thumbnailKey,
            dimensions: `${size.width}x${size.height}`,
            sizeBytes: processedBuffer.length
          });

          console.log(` Generated ${size.suffix} thumbnail: ${thumbnailKey}`);

        } catch (sizeError) {
          console.warn(` Failed to generate ${size.suffix} thumbnail:`, sizeError.message);
        }
      }

      // Update backup index with thumbnail information
      if (thumbnails.length > 0) {
        await this.updateBackupIndex(userId, sessionId, {
          originalFile: originalFilename,
          thumbnails: thumbnails,
          type: 'thumbnail-set'
        }, 'add');
      }

      return {
        success: true,
        thumbnails: thumbnails,
        count: thumbnails.length
      };

    } catch (error) {
      console.error(`❌ Thumbnail generation failed for ${originalFilename}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get thumbnail for a file
  async getThumbnail(userId, sessionId, originalFilename, size = '_md') {
    try {
      const ext = originalFilename.split('.').pop();
      const baseName = originalFilename.replace(`.${ext}`, '');
      const thumbnailKey = `photographer-${userId}/session-${sessionId}/thumbnails/${baseName}${size}.jpg`;
      
      console.log(`🖼️ Retrieving thumbnail: ${thumbnailKey}`);
      
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: thumbnailKey
      });
      
      const response = await this.s3Client.send(getCommand);
      const buffer = await response.Body.transformToByteArray();
      
      return {
        success: true,
        buffer: Buffer.from(buffer),
        contentType: 'image/jpeg',
        size: size,
        key: thumbnailKey
      };
      
    } catch (error) {
      // If thumbnail doesn't exist, try to generate it on-demand
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        console.log(` Thumbnail not found, attempting on-demand generation for: ${originalFilename}`);
        return this.generateThumbnailOnDemand(userId, sessionId, originalFilename, size);
      }
      
      console.error(`❌ Failed to retrieve thumbnail:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate thumbnail on-demand if it doesn't exist
  async generateThumbnailOnDemand(userId, sessionId, originalFilename, requestedSize = '_md') {
    try {
      console.log(` Generating thumbnail on-demand for: ${originalFilename}`);
      
      // First download the original file
      const originalFile = await this.downloadFile(userId, sessionId, originalFilename);
      if (!originalFile.success) {
        throw new Error('Could not download original file for thumbnail generation');
      }
      
      // Generate thumbnail
      const thumbnailResult = await this.generateThumbnail(
        originalFile.buffer, 
        originalFilename, 
        userId, 
        sessionId, 
        this.getFileTypeCategory(originalFilename)
      );
      
      if (!thumbnailResult.success) {
        throw new Error('Thumbnail generation failed');
      }
      
      // Return the requested size thumbnail
      return await this.getThumbnail(userId, sessionId, originalFilename, requestedSize);
      
    } catch (error) {
      console.error(`❌ On-demand thumbnail generation failed:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate organized R2 key path
   * Format: photographer-{userId}/session-{sessionId}/{fileType}/{filename}
   */
  generateR2Key(userId, sessionId, filename, fileType) {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `photographer-${userId}/session-${sessionId}/${fileType}/${sanitizedFilename}`;
  }

  /**
   * Generate backup index file path for a session
   */
  generateBackupIndexKey(userId, sessionId) {
    return `photographer-${userId}/session-${sessionId}/backup-index.json`;
  }

  /**
   * Update backup index file for a session
   */
  async updateBackupIndex(userId, sessionId, fileInfo, action = 'add') {
    try {
      const indexKey = this.generateBackupIndexKey(userId, sessionId);
      let backupIndex = { sessionId, userId, files: [], lastUpdated: new Date().toISOString() };
      
      // Try to get existing backup index
      try {
        const getCommand = new GetObjectCommand({ Bucket: this.bucketName, Key: indexKey });
        const response = await this.s3Client.send(getCommand);
        const indexData = await response.Body.transformToString();
        backupIndex = JSON.parse(indexData);
      } catch (error) {
        // Index doesn't exist yet, use new one
        console.log('Creating new backup index for session:', sessionId);
      }

      // Update the index
      if (action === 'add') {
        // Remove existing entry if it exists
        backupIndex.files = backupIndex.files.filter(f => f.filename !== fileInfo.filename);
        // Add new entry
        backupIndex.files.push({
          filename: fileInfo.filename,
          r2Key: fileInfo.r2Key,
          fileType: fileInfo.fileType,
          fileSizeBytes: fileInfo.fileSizeBytes,
          uploadedAt: fileInfo.uploadedAt,
          originalFormat: fileInfo.originalFormat,
          contentType: fileInfo.contentType
        });
      } else if (action === 'remove') {
        backupIndex.files = backupIndex.files.filter(f => f.filename !== fileInfo.filename);
      }

      backupIndex.lastUpdated = new Date().toISOString();
      backupIndex.totalFiles = backupIndex.files.length;
      backupIndex.totalSizeBytes = backupIndex.files.reduce((sum, f) => sum + f.fileSizeBytes, 0);

      // Save updated index back to R2
      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: indexKey,
        Body: JSON.stringify(backupIndex, null, 2),
        ContentType: 'application/json'
      });
      
      await this.s3Client.send(putCommand);
      console.log(` Backup index updated for session ${sessionId}: ${backupIndex.totalFiles} files`);
      
      return backupIndex;
    } catch (error) {
      console.error('Error updating backup index:', error);
      throw error;
    }
  }

  /**
   * Upload file to R2 with comprehensive tracking
   */
  async uploadFile(fileBuffer, filename, userId, sessionId, fileType = null) {
    const fileSizeBytes = fileBuffer.length;
    // Use provided fileType or detect from filename
    const actualFileType = fileType || this.getFileTypeCategory(filename);
    const fileSizeMB = (fileSizeBytes / (1024 * 1024));
    
    try {
      console.log(`📤 Uploading ${actualFileType.toUpperCase()} file: ${filename} (${fileSizeMB.toFixed(2)}MB)`);
      
      // Try R2 upload first if available
      if (this.r2Available) {
        try {
          console.log('☁️ Attempting R2 cloud upload...');
          return await this.uploadToR2(fileBuffer, filename, userId, sessionId, actualFileType);
        } catch (r2Error) {
          console.error(' R2 upload failed:', r2Error.message);
          
          // Check if it's a credential/connection issue
          if (r2Error.message?.includes('credentials') || r2Error.message?.includes('Access Denied') || r2Error.message?.includes('SignatureDoesNotMatch')) {
            console.error('❌ R2 credentials issue detected - marking R2 as unavailable');
            this.r2Available = false;
          } else {
            console.warn(' Temporary R2 issue, retrying...');
            // Try one more time for temporary network issues
            try {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
              return await this.uploadToR2(fileBuffer, filename, userId, sessionId, actualFileType);
            } catch (retryError) {
              console.error('❌ R2 retry failed, falling back to local backup');
              this.r2Available = false;
            }
          }
        }
      }
      
      // Fall back to local backup or throw error if not available
      if (this.localBackup) {
        console.log('💾 Using local backup storage...');
        const localResult = await this.localBackup.saveFile(fileBuffer, filename, userId, sessionId);
        
        return {
          success: true,
          fileId: localResult.id,
          storageType: 'local',
          localPath: localResult.localPath,
          fileType: actualFileType,
          fileSizeBytes,
          fileSizeMB: localResult.fileSizeMB,
          uploadedAt: localResult.savedAt,
          note: 'Stored locally - will sync to cloud when R2 connection is restored'
        };
      } else {
        throw new Error('Neither R2 cloud storage nor local backup is available');
      }

    } catch (error) {
      console.error('❌ Upload failed:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async uploadToR2(fileBuffer, filename, userId, sessionId, fileType) {
    const fileSizeBytes = fileBuffer.length;
    const fileSizeMB = (fileSizeBytes / (1024 * 1024));
    const r2Key = this.generateR2Key(userId, sessionId, filename, fileType);
    const fileId = crypto.randomUUID();

    // Determine content type from filename
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const contentTypeMap = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', 
      '.gif': 'image/gif', '.webp': 'image/webp', '.tiff': 'image/tiff', '.tif': 'image/tiff',
      '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.zip': 'application/zip',
      // RAW formats
      '.nef': 'image/x-nikon-nef', '.cr2': 'image/x-canon-cr2', '.arw': 'image/x-sony-arw',
      '.dng': 'image/x-adobe-dng', '.raf': 'image/x-fuji-raf', '.orf': 'image/x-olympus-orf'
    };
    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    const uploadParams = {
      Bucket: this.bucketName,
      Key: r2Key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: {
        'original-filename': filename,
        'user-id': userId,
        'session-id': sessionId,
        'file-type': fileType,
        'upload-timestamp': new Date().toISOString(),
        'file-size-bytes': fileSizeBytes.toString()
      }
    };

    try {
      console.log(`☁️ Uploading to R2: ${r2Key} (${fileSizeMB.toFixed(2)}MB)`);
      
      // Upload file to R2
      const putCommand = new PutObjectCommand(uploadParams);
      await this.s3Client.send(putCommand);
      
      console.log(` R2 upload successful: ${filename}`);
      
      // Update backup index
      const fileInfo = {
        filename,
        r2Key,
        fileType,
        fileSizeBytes,
        uploadedAt: new Date().toISOString(),
        originalFormat: filename.substring(filename.lastIndexOf('.')),
        contentType
      };
      
      await this.updateBackupIndex(userId, sessionId, fileInfo, 'add');
      
      // Also track in database for accurate storage calculations
      if (this.pool) {
        try {
          await this.pool.query(`
            INSERT INTO session_files (user_id, session_id, folder_type, filename, file_size_bytes, file_size_mb, r2_key, uploaded_at, original_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (session_id, filename) 
            DO UPDATE SET 
              file_size_bytes = EXCLUDED.file_size_bytes,
              file_size_mb = EXCLUDED.file_size_mb,
              r2_key = EXCLUDED.r2_key,
              uploaded_at = EXCLUDED.uploaded_at
          `, [userId, sessionId, fileType, filename, fileSizeBytes, fileSizeMB, r2Key, new Date(), filename]);
          
          console.log(` Database record updated for file: ${filename}`);
        } catch (dbError) {
          console.warn(' Failed to update database record:', dbError.message);
          // Continue with success since R2 upload worked
        }
      }

      // Generate thumbnail for image files
      if (this.isImageFile(filename)) {
        try {
          await this.generateThumbnail(fileBuffer, filename, userId, sessionId, fileType);
        } catch (thumbnailError) {
          console.warn(` Failed to generate thumbnail for ${filename}:`, thumbnailError.message);
          // Continue - thumbnail generation failure shouldn't fail the main upload
        }
      }
      
      return {
        success: true,
        fileId,
        storageType: 'r2',
        r2Key,
        r2Url: `https://${this.bucketName}.r2.dev/${r2Key}`,
        fileType,
        fileSizeBytes,
        fileSizeMB,
        uploadedAt: new Date().toISOString(),
        contentType
      };
      
    } catch (error) {
      console.error('❌ R2 upload failed:', error);
      throw new Error(`R2 upload failed: ${error.message}`);
    }
  }

  /**
   * Download file from R2 at full resolution
   */
  async downloadFile(userId, sessionId, filename) {
    try {
      // First, try to get file info from database
      let fileInfo;
      
      // Try session_files table first
      const sessionFileQuery = `
        SELECT filename, r2_key, file_size_bytes, original_name
        FROM session_files 
        WHERE session_id = $1 AND filename = $2
      `;
      const sessionFileResult = await this.db.query(sessionFileQuery, [sessionId, filename]);
      
      if (sessionFileResult.rows.length > 0) {
        const row = sessionFileResult.rows[0];
        fileInfo = {
          filename: row.filename,
          r2Key: row.r2_key,
          fileSizeBytes: row.file_size_bytes,
          originalName: row.original_name,
          contentType: 'image/jpeg' // Default, will be determined by file extension
        };
      } else {
        // Try raw_backups table
        const backupQuery = `
          SELECT filename, r2_object_key, file_size, original_name, mime_type
          FROM raw_backups 
          WHERE session_id = $1 AND filename = $2
        `;
        const backupResult = await this.db.query(backupQuery, [sessionId, filename]);
        
        if (backupResult.rows.length > 0) {
          const row = backupResult.rows[0];
          fileInfo = {
            filename: row.filename,
            r2Key: row.r2_object_key,
            fileSizeBytes: row.file_size,
            originalName: row.original_name,
            contentType: row.mime_type || 'image/jpeg'
          };
        }
      }
      
      if (!fileInfo) {
        throw new Error(`File not found in database: ${filename}`);
      }
      
      // Download the file from R2
      const getFileCommand = new GetObjectCommand({ 
        Bucket: this.bucketName, 
        Key: fileInfo.r2Key 
      });
      const fileResponse = await this.s3Client.send(getFileCommand);
      
      // Convert stream to buffer
      const fileBuffer = await fileResponse.Body.transformToByteArray();
      
      console.log(` Downloaded from R2: ${filename} (${fileBuffer.length} bytes)`);
      
      return {
        success: true,
        filename: fileInfo.filename,
        buffer: Buffer.from(fileBuffer),
        contentType: fileInfo.contentType,
        fileSizeBytes: fileInfo.fileSizeBytes,
        originalFormat: fileInfo.originalFormat || 'jpeg',
        metadata: fileResponse.Metadata
      };
      
    } catch (error) {
      console.error('❌ R2 download failed:', error);
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Get all files for a specific session (organized by type)
   */
  async getSessionFiles(userId, sessionId) {
    try {
      console.log(`📁 Getting session files for user: ${userId}, session: ${sessionId}`);
      
      // Get the backup index which contains all file metadata
      const backupIndex = await this.getSessionBackupIndex(userId, sessionId);
      
      if (!backupIndex.files || backupIndex.files.length === 0) {
        console.log(`📁 No files found in backup index for session ${sessionId}`);
        return {
          success: true,
          filesByType: {
            raw: [],
            gallery: [],
            video: [],
            document: [],
            other: []
          },
          totalFiles: 0,
          totalSize: 0
        };
      }

      // Organize files by category
      const filesByType = {
        raw: [],
        gallery: [],
        video: [],
        document: [],
        other: []
      };

      let totalSize = 0;

      backupIndex.files.forEach(file => {
        // Determine file type based on R2 key path (more accurate than extension)
        let category = 'other';
        if (file.r2Key) {
          if (file.r2Key.includes('/raw/')) {
            category = 'raw';
          } else if (file.r2Key.includes('/gallery/')) {
            category = 'gallery';
          } else if (file.r2Key.includes('/video/')) {
            category = 'video';
          } else if (file.r2Key.includes('/document/')) {
            category = 'document';
          } else {
            // Fallback to extension-based classification if path doesn't match
            category = this.getFileTypeCategory(file.filename);
          }
        } else {
          // Fallback for legacy files without R2 key
          category = this.getFileTypeCategory(file.filename);
        }

        const fileInfo = {
          filename: file.filename,
          fileSizeBytes: file.fileSizeBytes,
          fileSizeMB: file.fileSizeBytes / (1024 * 1024),
          uploadedAt: file.uploadedAt,
          fileType: category,
          contentType: file.contentType,
          r2Key: file.r2Key,
          originalFormat: file.originalFormat
        };

        filesByType[category].push(fileInfo);
        totalSize += file.fileSizeBytes;
      });

      console.log(`📁 Retrieved ${backupIndex.files.length} files for session ${sessionId}`);

      return {
        success: true,
        filesByType,
        totalFiles: backupIndex.files.length,
        totalSize
      };

    } catch (error) {
      console.error('Error getting session files:', error);
      throw error;
    }
  }

  /**
   * Get backup index for a session
   */
  async getSessionBackupIndex(userId, sessionId) {
    try {
      const indexKey = this.generateBackupIndexKey(userId, sessionId);
      const getCommand = new GetObjectCommand({ Bucket: this.bucketName, Key: indexKey });
      const response = await this.s3Client.send(getCommand);
      const backupIndex = JSON.parse(await response.Body.transformToString());
      
      console.log(` Retrieved backup index for session ${sessionId}: ${backupIndex.totalFiles} files`);
      return backupIndex;
      
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return { sessionId, userId, files: [], totalFiles: 0, totalSizeBytes: 0 };
      }
      console.error('Error getting backup index:', error);
      throw error;
    }
  }

  /**
   * Check if user can upload given amount of data within storage limits
   */
  async checkStorageLimit(userId, additionalBytes) {
    try {
      const maxStorageBytes = 1024 * 1024 * 1024 * 1024; // 1TB in bytes
      
      // Get current usage from actual storage calculation
      let currentUsageBytes = 0;
      
      try {
        const storageUsage = await this.getUserStorageUsage(userId);
        currentUsageBytes = storageUsage.totalBytes || 0;
        console.log(` Current storage usage: ${(currentUsageBytes / (1024**3)).toFixed(2)} GB`);
      } catch (usageError) {
        console.warn(' Could not get current storage usage, using safe default:', usageError.message);
        currentUsageBytes = 0; // Safe default - allow upload
      }
      
      const totalAfterUpload = currentUsageBytes + additionalBytes;
      const additionalGB = additionalBytes / (1024**3);
      
      console.log(`📤 Upload check: Current: ${(currentUsageBytes / (1024**3)).toFixed(2)} GB, Additional: ${additionalGB.toFixed(2)} GB, Total after: ${(totalAfterUpload / (1024**3)).toFixed(2)} GB`);
      
      if (totalAfterUpload > maxStorageBytes) {
        return {
          allowed: false,
          message: `Upload would exceed 1TB storage limit. Current: ${(currentUsageBytes / (1024**3)).toFixed(2)} GB, Upload: ${additionalGB.toFixed(2)} GB, Total: ${(totalAfterUpload / (1024**3)).toFixed(2)} GB`,
          usage: {
            current: currentUsageBytes,
            limit: maxStorageBytes,
            afterUpload: totalAfterUpload
          }
        };
      }
      
      return {
        allowed: true,
        message: `Upload within storage limits. Current: ${(currentUsageBytes / (1024**3)).toFixed(2)} GB, After upload: ${(totalAfterUpload / (1024**3)).toFixed(2)} GB`,
        usage: {
          current: currentUsageBytes,
          limit: maxStorageBytes,
          afterUpload: totalAfterUpload
        }
      };
      
    } catch (error) {
      console.error('Error checking storage limit:', error);
      // Allow upload if we can't check limits (fail-safe)
      return {
        allowed: true,
        message: 'Storage limit check unavailable - allowing upload'
      };
    }
  }

  /**
   * Delete a specific file from R2 storage and update backup index
   */
  async deleteFile(userId, sessionId, filename) {
    try {
      console.log(`🗑️ Deleting file: ${filename} from session ${sessionId}`);
      
      // First, get the backup index to find the file
      const backupIndex = await this.getSessionBackupIndex(userId, sessionId);
      const fileInfo = backupIndex.files.find(f => f.filename === filename);
      
      if (!fileInfo) {
        console.log(`❌ File not found in backup index: ${filename}`);
        // Try to find file with alternative search patterns (handle URL encoding/decoding issues)
        const decodedFilename = decodeURIComponent(filename);
        const encodedFilename = encodeURIComponent(filename);
        const altFileInfo = backupIndex.files.find(f => 
          f.filename === decodedFilename || 
          f.filename === encodedFilename ||
          f.r2Key.includes(filename) ||
          f.r2Key.includes(decodedFilename)
        );
        
        if (!altFileInfo) {
          console.log(`❌ File not found even with alternative search: ${filename}`);
          return { success: false, error: 'File not found in backup index' };
        }
        
        console.log(` Found file with alternative search: ${altFileInfo.filename}`);
        // Use the found file info
        fileInfo = altFileInfo;
      }
      
      // Delete the file from R2
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileInfo.r2Key
      });
      
      try {
        await this.s3Client.send(deleteCommand);
        console.log(` File deleted from R2: ${fileInfo.r2Key}`);
      } catch (s3Error) {
        // Handle case where file might not exist in R2 but is in index
        if (s3Error.name === 'NoSuchKey' || s3Error.Code === 'NoSuchKey') {
          console.log(` File not found in R2, but removing from index: ${fileInfo.r2Key}`);
        } else {
          throw s3Error; // Re-throw if it's a different error
        }
      }
      
      // Update the backup index to remove the file
      await this.updateBackupIndex(userId, sessionId, fileInfo, 'remove');
      
      // CRITICAL: Also remove from session_files database table for accurate storage calculations
      try {
        const { pool } = require('./db');
        
        // Delete both possible filename formats (full path and just filename)
        const deleteResult1 = await pool.query(
          'DELETE FROM session_files WHERE session_id = $1 AND filename = $2',
          [sessionId, filename]
        );
        
        const deleteResult2 = await pool.query(
          'DELETE FROM session_files WHERE session_id = $1 AND filename LIKE $2',
          [sessionId, `%.private/sessions/${sessionId}/%/${filename}`]
        );
        
        const totalDeleted = deleteResult1.rowCount + deleteResult2.rowCount;
        console.log(`🗑️ Removed ${totalDeleted} entries from database for file: ${filename}`);
        
      } catch (dbError) {
        console.error(' Failed to remove file from database (storage calculation may be incorrect):', dbError.message);
        // Continue with success since R2 deletion worked
      }
      
      return { 
        success: true, 
        message: `File ${filename} deleted successfully`,
        deletedFile: fileInfo
      };
      
    } catch (error) {
      console.error('❌ Failed to delete', filename, ':', error.message);
      console.error('❌ Error details:', {
        userId,
        sessionId,
        filename,
        error: error.stack || error.message
      });
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Delete file by R2 key directly (for cleanup operations)
   */
  async deleteFileByKey(r2Key) {
    try {
      console.log(`🗑️ Direct R2 deletion: ${r2Key}`);
      
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: r2Key
      });
      
      await this.s3Client.send(deleteCommand);
      console.log(` Directly deleted from R2: ${r2Key}`);
      
      return { success: true, message: `File ${r2Key} deleted directly from R2` };
      
    } catch (error) {
      console.error('❌ Direct R2 deletion failed:', r2Key, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get file stream from R2 for ZIP downloads and direct access
   */
  async getFileStream(r2Key) {
    try {
      if (!this.r2Available) {
        console.log(' R2 not available for file stream');
        return null;
      }

      console.log(`📥 Getting file stream from R2: ${r2Key}`);
      
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: r2Key
      });
      
      const response = await this.s3Client.send(getCommand);
      
      if (response.Body) {
        console.log(` File stream retrieved: ${r2Key}`);
        return response.Body;
      } else {
        console.warn(` No body in response for: ${r2Key}`);
        return null;
      }
      
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
        console.warn(` File not found in R2: ${r2Key}`);
      } else {
        console.error(`❌ Error getting file stream for ${r2Key}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Get user's current storage usage from R2 cloud with RAW/Gallery breakdown
   */
  async getUserStorageUsage(userId) {
    try {
      console.log(` Calculating storage usage for user: ${userId}`);
      
      // Get all sessions for the user - try multiple path patterns
      console.log(` Scanning R2 storage for user ${userId} with path patterns...`);
      
      // First try the current format, then try other possible formats
      const pathPatterns = [
        `photographer-${userId}/`,
        `${userId}/`,
        `user-${userId}/`,
        `photographer-BFZI4tzu4rdsiZZSK63cqZ5yohw2/`, // Firebase UID mapping for Lance
        `photographer-44735007/`, // Legacy user ID for testing
        `BFZI4tzu4rdsiZZSK63cqZ5yohw2/` // Direct Firebase UID
      ];
      
      let totalBytes = 0;
      let galleryBytes = 0;
      let rawBytes = 0;
      let fileCount = 0;
      let galleryCount = 0;
      let rawCount = 0;
      
      for (const prefix of pathPatterns) {
        console.log(` Checking path pattern: ${prefix}`);
        
        const listCommand = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix
        });
        
        const response = await this.s3Client.send(listCommand);
        
        if (response.Contents && response.Contents.length > 0) {
          console.log(` Found ${response.Contents.length} objects with prefix: ${prefix}`);
          
          for (const object of response.Contents) {
            // Skip backup index files from size calculation
            if (!object.Key.endsWith('/backup-index.json') && !object.Key.endsWith('/backups.json')) {
              const fileSize = object.Size || 0;
              totalBytes += fileSize;
              fileCount++;
              
              console.log(`📄 File: ${object.Key} (${fileSize} bytes)`);
              
              // Categorize by file path
              if (object.Key.includes('/gallery/')) {
                galleryBytes += fileSize;
                galleryCount++;
              } else if (object.Key.includes('/raw/')) {
                rawBytes += fileSize;
                rawCount++;
              }
            }
          }
          break; // Use first pattern that has results
        } else {
          console.log(`❌ No files found with prefix: ${prefix}`);
        }
      }
      
      const totalGB = totalBytes / (1024 * 1024 * 1024);
      const galleryGB = galleryBytes / (1024 * 1024 * 1024);
      const rawGB = rawBytes / (1024 * 1024 * 1024);
      const maxStorageGB = 1024; // 1TB limit
      const usedPercentage = (totalGB / maxStorageGB) * 100;
      const remainingGB = maxStorageGB - totalGB;
      
      console.log(` Storage usage: ${totalGB.toFixed(2)} GB total (Gallery: ${galleryGB.toFixed(2)} GB, RAW: ${rawGB.toFixed(2)} GB) of ${maxStorageGB} GB (${usedPercentage.toFixed(1)}%)`);
      
      return {
        totalBytes: Math.round(totalBytes),
        totalGB: Math.round(totalGB * 100) / 100,
        galleryBytes: Math.round(galleryBytes),
        galleryGB: Math.round(galleryGB * 100) / 100,
        galleryCount: galleryCount,
        rawBytes: Math.round(rawBytes),
        rawGB: Math.round(rawGB * 100) / 100,
        rawCount: rawCount,
        usedPercentage: Math.round(usedPercentage * 10) / 10,
        percentUsed: Math.round(usedPercentage * 10) / 10,
        remainingGB: Math.round(remainingGB * 100) / 100,
        fileCount: fileCount,
        displayText: `${totalGB.toFixed(2)} GB of ${maxStorageGB} GB used ( ${galleryGB.toFixed(2)} GB + 📷 ${rawGB.toFixed(2)} GB)`,
        monthlyStorageCost: Math.round(totalGB * 0.015 * 100) / 100, // $0.015 per GB/month
        additionalStorageTB: 0,
        storageStatus: usedPercentage > 90 ? "Near Limit" : "Active",
        isNearLimit: usedPercentage > 80,
        isOverLimit: usedPercentage > 100
      };
    } catch (error) {
      console.error('Error getting user storage usage:', error);
      // Return fallback data if R2 query fails
      return {
        totalBytes: 0,
        totalGB: 0,
        usedPercentage: 0,
        percentUsed: 0,
        remainingGB: 1024,
        fileCount: 0,
        displayText: "Storage calculation unavailable",
        monthlyStorageCost: 0,
        additionalStorageTB: 0,
        storageStatus: "Active",
        isNearLimit: false,
        isOverLimit: false
      };
    }
  }

  

  /**
   * Track download activity for analytics
   */
  async trackDownload(userId, filename, sizeBytes) {
    try {
      const trackingKey = `photographer-${userId}/downloads/tracking-${Date.now()}.json`;
      const trackingData = {
        filename: filename,
        sizeBytes: sizeBytes,
        downloadedAt: new Date().toISOString(),
        userId: userId
      };
      
      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: trackingKey,
        Body: JSON.stringify(trackingData),
        ContentType: 'application/json'
      });
      
      await this.s3Client.send(putCommand);
      console.log(`📥 Download tracked: ${filename} (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB)`);
      
    } catch (error) {
      console.error('Error tracking download:', error);
      // Don't throw error - tracking is optional
    }
  }
}

module.exports = R2FileManager;