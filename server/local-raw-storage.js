const fs = require('fs').promises;
const path = require('path');

/**
 * Local RAW Storage Service - Fallback when R2 is unavailable
 * Simulates R2 functionality using local file system
 * Files stored in ./raw-storage/{userId}/{sessionId}/
 */
class LocalRawStorageService {
  constructor() {
    this.storageRoot = path.join(process.cwd(), 'raw-storage');
    this.supportedExtensions = ['.nef', '.cr2', '.arw', '.dng', '.raf', '.orf', '.pef', '.srw', '.x3f', '.rw2'];
    
    // Ensure storage directory exists
    this.initializeStorage();
    console.log('Local RAW Storage Service initialized (R2 fallback)');
  }

  async initializeStorage() {
    try {
      await fs.mkdir(this.storageRoot, { recursive: true });
    } catch (error) {
      console.error('Failed to create RAW storage directory:', error);
    }
  }

  /**
   * Test connection - always returns true for local storage
   */
  async testConnection() {
    try {
      await fs.access(this.storageRoot);
      console.log('Local RAW storage accessible');
      return true;
    } catch (error) {
      console.error('Local RAW storage test failed:', error.message);
      return false;
    }
  }

  /**
   * Check if file extension is supported RAW format
   */
  isRawFile(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return this.supportedExtensions.includes(ext);
  }

  /**
   * Generate local file path for user/session organization
   */
  generateLocalPath(userId, sessionId, filename) {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const userDir = path.join(this.storageRoot, `user-${userId}`);
    const sessionDir = path.join(userDir, `session-${sessionId}`);
    return {
      fullPath: path.join(sessionDir, sanitizedFilename),
      relativePath: `user-${userId}/session-${sessionId}/${sanitizedFilename}`,
      sessionDir: sessionDir
    };
  }

  /**
   * Upload RAW file to local storage
   */
  async uploadRawFile(fileBuffer, filename, userId, sessionId) {
    try {
      if (!this.isRawFile(filename)) {
        throw new Error(`Unsupported file type. Supported: ${this.supportedExtensions.join(', ')}`);
      }

      const { fullPath, relativePath, sessionDir } = this.generateLocalPath(userId, sessionId, filename);
      const fileSizeBytes = fileBuffer.length;
      const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

      console.log(`Storing RAW file locally: ${filename} (${fileSizeMB}MB) at ${relativePath}`);

      // Ensure session directory exists
      await fs.mkdir(sessionDir, { recursive: true });

      // Write file to local storage
      await fs.writeFile(fullPath, fileBuffer);

      return {
        success: true,
        localPath: fullPath,
        relativePath: relativePath,
        fileSizeBytes: fileSizeBytes,
        fileSizeMB: parseFloat(fileSizeMB),
        uploadedAt: new Date()
      };

    } catch (error) {
      console.error('Local RAW storage error:', error);
      throw new Error(`Failed to store RAW file: ${error.message}`);
    }
  }

  /**
   * Download RAW file from local storage
   */
  async downloadRawFile(localPath) {
    try {
      const fullPath = path.isAbsolute(localPath) ? localPath : path.join(this.storageRoot, localPath);
      const data = await fs.readFile(fullPath);
      const stats = await fs.stat(fullPath);
      
      return {
        success: true,
        data: data,
        contentLength: stats.size,
        lastModified: stats.mtime
      };

    } catch (error) {
      console.error('Local RAW download error:', error);
      throw new Error(`Failed to download RAW file: ${error.message}`);
    }
  }

  /**
   * Delete RAW file from local storage
   */
  async deleteRawFile(localPath) {
    try {
      const fullPath = path.isAbsolute(localPath) ? localPath : path.join(this.storageRoot, localPath);
      await fs.unlink(fullPath);
      console.log(`Deleted RAW file from local storage: ${localPath}`);
      return true;

    } catch (error) {
      console.error('Local RAW delete error:', error);
      throw new Error(`Failed to delete RAW file: ${error.message}`);
    }
  }

  /**
   * Get file content type based on extension
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
   * Calculate monthly cost (always $0 for local storage)
   */
  calculateMonthlyCost(totalSizeTB) {
    return 0; // Local storage is free
  }
}

module.exports = LocalRawStorageService;