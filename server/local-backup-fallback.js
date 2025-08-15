const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Local backup fallback system for when R2 is unavailable
 * Stores files locally with organized structure and metadata tracking
 */
class LocalBackupFallback {
  constructor() {
    this.backupDir = path.join(process.cwd(), 'local-backups');
    this.metadataFile = path.join(this.backupDir, 'backup-metadata.json');
    this.initialized = false;
  }

  async initialize() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Initialize metadata file if it doesn't exist
      try {
        await fs.access(this.metadataFile);
      } catch {
        await fs.writeFile(this.metadataFile, JSON.stringify({ files: [], created: new Date() }, null, 2));
      }
      
      this.initialized = true;
      console.log(' Local backup fallback initialized');
    } catch (error) {
      console.error('❌ Failed to initialize local backup:', error);
      throw error;
    }
  }

  async saveFile(fileBuffer, filename, userId, sessionId) {
    if (!this.initialized) await this.initialize();

    try {
      const fileId = crypto.randomUUID();
      const fileExtension = path.extname(filename);
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      
      // Create user/session directory structure
      const userDir = path.join(this.backupDir, userId);
      const sessionDir = path.join(userDir, sessionId);
      await fs.mkdir(sessionDir, { recursive: true });
      
      // Save file with unique ID to prevent conflicts
      const backupFilename = `${fileId}_${sanitizedFilename}`;
      const filePath = path.join(sessionDir, backupFilename);
      await fs.writeFile(filePath, fileBuffer);
      
      // Update metadata
      const metadata = await this.getMetadata();
      const fileRecord = {
        id: fileId,
        originalFilename: filename,
        backupFilename,
        userId,
        sessionId,
        fileSizeBytes: fileBuffer.length,
        fileSizeMB: (fileBuffer.length / (1024 * 1024)).toFixed(2),
        fileExtension,
        savedAt: new Date(),
        localPath: filePath,
        status: 'saved'
      };
      
      metadata.files.push(fileRecord);
      await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
      
      console.log(` Local backup saved: ${filename} (${fileRecord.fileSizeMB}MB)`);
      return fileRecord;
      
    } catch (error) {
      console.error('❌ Local backup failed:', error);
      throw error;
    }
  }

  async getMetadata() {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return { files: [], created: new Date() };
    }
  }

  async getUserFiles(userId) {
    const metadata = await this.getMetadata();
    return metadata.files.filter(file => file.userId === userId);
  }

  async getSessionFiles(sessionId, userId) {
    const metadata = await this.getMetadata();
    return metadata.files.filter(file => 
      file.sessionId === sessionId && file.userId === userId
    );
  }

  async getStorageUsage(userId) {
    const userFiles = await this.getUserFiles(userId);
    const totalBytes = userFiles.reduce((sum, file) => sum + file.fileSizeBytes, 0);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
    const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
    
    return {
      totalFiles: userFiles.length,
      totalSizeBytes: totalBytes,
      totalSizeMB: Number(totalMB),
      totalSizeGB: Number(totalGB),
      files: userFiles
    };
  }

  async deleteFile(fileId, userId) {
    try {
      const metadata = await this.getMetadata();
      const fileIndex = metadata.files.findIndex(f => f.id === fileId && f.userId === userId);
      
      if (fileIndex === -1) {
        throw new Error('File not found');
      }
      
      const file = metadata.files[fileIndex];
      
      // Delete physical file
      try {
        await fs.unlink(file.localPath);
      } catch (error) {
        console.warn(` Could not delete physical file: ${error.message}`);
      }
      
      // Remove from metadata
      metadata.files.splice(fileIndex, 1);
      await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
      
      console.log(`🗑️ Local backup deleted: ${file.originalFilename}`);
      return true;
      
    } catch (error) {
      console.error('❌ Local backup deletion failed:', error);
      throw error;
    }
  }

  async getFile(fileId, userId) {
    try {
      const metadata = await this.getMetadata();
      const file = metadata.files.find(f => f.id === fileId && f.userId === userId);
      
      if (!file) {
        throw new Error('File not found');
      }
      
      const fileBuffer = await fs.readFile(file.localPath);
      return {
        buffer: fileBuffer,
        filename: file.originalFilename,
        metadata: file
      };
      
    } catch (error) {
      console.error('❌ Local backup retrieval failed:', error);
      throw error;
    }
  }
}

module.exports = LocalBackupFallback;