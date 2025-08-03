const AWS = require('aws-sdk');

/**
 * Cloudflare R2 Storage Service for RAW file backup
 * Handles upload, download, and management of RAW photography files
 * Billing: $20/TB per month, rounded up (1.1TB = $40/month)
 */
class R2StorageService {
  constructor() {
    // Try alternative R2 endpoint format without bucket name in hostname
    const endpoint = `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    
    this.s3 = new AWS.S3({
      endpoint: endpoint,
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      region: 'wnam',
      signatureVersion: 'v4',
      s3ForcePathStyle: false,
    });
    
    console.log(`R2 endpoint: ${endpoint}`);
    
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    this.supportedExtensions = ['.nef', '.cr2', '.arw', '.dng', '.raf', '.orf', '.pef', '.srw', '.x3f', '.rw2'];
    
    console.log('R2 Storage Service initialized with bucket:', this.bucketName);
  }

  /**
   * Test R2 connection by listing bucket contents
   * @returns {Promise<boolean>} - Connection status
   */
  async testConnection() {
    try {
      console.log(`Testing R2 connection to bucket: ${this.bucketName}`);
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      console.log('R2 connection successful');
      return true;
    } catch (error) {
      console.error('R2 connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Check if file extension is supported RAW format
   * @param {string} filename - The filename to check
   * @returns {boolean} - True if supported RAW format
   */
  isRawFile(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return this.supportedExtensions.includes(ext);
  }

  /**
   * Generate R2 key path for user/session organization
   * Format: photographer-{userId}/session-{sessionId}/raw/{filename}
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID  
   * @param {string} filename - Original filename
   * @returns {string} - R2 key path
   */
  generateR2Key(userId, sessionId, filename) {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `photographer-${userId}/session-${sessionId}/raw/${sanitizedFilename}`;
  }

  /**
   * Upload RAW file to R2 storage
   * @param {Buffer} fileBuffer - File buffer data
   * @param {string} filename - Original filename
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<object>} - Upload result with R2 key and metadata
   */
  async uploadRawFile(fileBuffer, filename, userId, sessionId) {
    try {
      if (!this.isRawFile(filename)) {
        throw new Error(`Unsupported file type. Supported: ${this.supportedExtensions.join(', ')}`);
      }

      const r2Key = this.generateR2Key(userId, sessionId, filename);
      const fileSizeBytes = fileBuffer.length;
      const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

      console.log(`Uploading RAW file: ${filename} (${fileSizeMB}MB) to R2 key: ${r2Key}`);

      const uploadParams = {
        Bucket: this.bucketName,
        Key: r2Key,
        Body: fileBuffer,
        ContentType: this.getContentType(filename),
        Metadata: {
          'original-filename': filename,
          'user-id': userId,
          'session-id': sessionId,
          'upload-timestamp': new Date().toISOString(),
          'file-size-bytes': fileSizeBytes.toString(),
          'file-size-mb': fileSizeMB
        }
      };

      const result = await this.s3.upload(uploadParams).promise();

      return {
        success: true,
        r2Key: r2Key,
        location: result.Location,
        etag: result.ETag,
        fileSizeBytes: fileSizeBytes,
        fileSizeMB: parseFloat(fileSizeMB),
        uploadedAt: new Date()
      };

    } catch (error) {
      console.error('R2 upload error:', error);
      throw new Error(`Failed to upload RAW file: ${error.message}`);
    }
  }

  /**
   * Download RAW file from R2 storage
   * @param {string} r2Key - R2 key path
   * @returns {Promise<object>} - Download stream and metadata
   */
  async downloadRawFile(r2Key) {
    try {
      const downloadParams = {
        Bucket: this.bucketName,
        Key: r2Key
      };

      const result = await this.s3.getObject(downloadParams).promise();
      
      return {
        success: true,
        data: result.Body,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        metadata: result.Metadata,
        lastModified: result.LastModified
      };

    } catch (error) {
      console.error('R2 download error:', error);
      throw new Error(`Failed to download RAW file: ${error.message}`);
    }
  }

  /**
   * Delete RAW file from R2 storage
   * @param {string} r2Key - R2 key path
   * @returns {Promise<boolean>} - Success status
   */
  async deleteRawFile(r2Key) {
    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Key: r2Key
      };

      await this.s3.deleteObject(deleteParams).promise();
      console.log(`Deleted RAW file from R2: ${r2Key}`);
      
      return true;

    } catch (error) {
      console.error('R2 delete error:', error);
      throw new Error(`Failed to delete RAW file: ${error.message}`);
    }
  }

  /**
   * List RAW files for a session
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} - List of files in session
   */
  async listSessionRawFiles(userId, sessionId) {
    try {
      const prefix = `photographer-${userId}/session-${sessionId}/raw/`;
      
      const listParams = {
        Bucket: this.bucketName,
        Prefix: prefix
      };

      const result = await this.s3.listObjectsV2(listParams).promise();
      
      return result.Contents.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        filename: obj.Key.split('/').pop()
      }));

    } catch (error) {
      console.error('R2 list error:', error);
      throw new Error(`Failed to list RAW files: ${error.message}`);
    }
  }

  /**
   * Get content type for RAW file extensions
   * @param {string} filename - Filename
   * @returns {string} - MIME type
   */
  getContentType(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const contentTypes = {
      '.nef': 'image/x-nikon-nef',
      '.cr2': 'image/x-canon-cr2', 
      '.arw': 'image/x-sony-arw',
      '.dng': 'image/x-adobe-dng',
      '.raf': 'image/x-fuji-raf',
      '.orf': 'image/x-olympus-orf',
      '.pef': 'image/x-pentax-pef',
      '.srw': 'image/x-samsung-srw',
      '.x3f': 'image/x-sigma-x3f',
      '.rw2': 'image/x-panasonic-rw2'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Calculate monthly storage cost based on total TB usage
   * $20 per TB per month, rounded up (1.1TB = $40/month)
   * @param {number} totalSizeTB - Total storage in TB
   * @returns {number} - Monthly cost in USD
   */
  calculateMonthlyCost(totalSizeTB) {
    const tierTB = Math.ceil(totalSizeTB);
    return tierTB * 20; // $20 per TB
  }

  /**
   * Check R2 connection and bucket access
   * @returns {Promise<boolean>} - Connection status
   */
  async testConnection() {
    try {
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      console.log('R2 connection successful');
      return true;
    } catch (error) {
      console.error('R2 connection failed:', error);
      return false;
    }
  }
}

module.exports = R2StorageService;