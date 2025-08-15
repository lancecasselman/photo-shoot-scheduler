const LocalBackupFallback = require('./local-backup-fallback');

/**
 * Service to sync local backup files to R2 when connection is restored
 */
class R2SyncService {
  constructor(r2FileManager) {
    this.r2Manager = r2FileManager;
    this.localBackup = new LocalBackupFallback();
    this.syncInProgress = false;
  }

  /**
   * Sync all local backup files to R2 cloud storage
   * @param {string} userId - Optional: sync files for specific user only
   * @returns {Promise<object>} Sync results
   */
  async syncLocalToR2(userId = null) {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    if (!this.r2Manager.r2Available) {
      throw new Error('R2 not available - cannot sync');
    }

    this.syncInProgress = true;
    console.log(' Starting local backup to R2 sync...');

    try {
      const metadata = await this.localBackup.getMetadata();
      let filesToSync = metadata.files;

      // Filter by user if specified
      if (userId) {
        filesToSync = filesToSync.filter(file => file.userId === userId);
      }

      console.log(`📁 Found ${filesToSync.length} files to sync`);

      const results = {
        total: filesToSync.length,
        successful: [],
        failed: [],
        totalSize: 0
      };

      // Sync files in batches to avoid overwhelming the system
      const batchSize = 5;
      for (let i = 0; i < filesToSync.length; i += batchSize) {
        const batch = filesToSync.slice(i, i + batchSize);
        
        console.log(` Syncing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(filesToSync.length/batchSize)}`);

        const batchPromises = batch.map(async (file) => {
          try {
            // Read file from local backup
            const fileData = await this.localBackup.getFile(file.id, file.userId);
            
            // Upload to R2
            const r2Result = await this.r2Manager.uploadToR2(
              fileData.buffer,
              file.originalFilename,
              file.userId,
              file.sessionId,
              this.r2Manager.getFileTypeCategory(file.originalFilename)
            );

            results.successful.push({
              originalFile: file,
              r2Result: r2Result,
              localPath: file.localPath
            });

            results.totalSize += file.fileSizeBytes;

            console.log(` Synced: ${file.originalFilename} (${file.fileSizeMB}MB)`);
            return { success: true, file };

          } catch (error) {
            console.error(`❌ Failed to sync ${file.originalFilename}:`, error.message);
            results.failed.push({
              file: file,
              error: error.message
            });
            return { success: false, file, error };
          }
        });

        await Promise.allSettled(batchPromises);
        
        // Small delay between batches
        if (i + batchSize < filesToSync.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(` Sync completed: ${results.successful.length}/${results.total} files uploaded`);
      console.log(` Total synced: ${(results.totalSize / (1024 * 1024 * 1024)).toFixed(2)}GB`);

      return results;

    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Clean up local backup files after successful R2 sync
   * @param {Array} syncResults - Results from syncLocalToR2
   * @param {boolean} keepMetadata - Whether to keep metadata file
   * @returns {Promise<object>} Cleanup results
   */
  async cleanupSyncedFiles(syncResults, keepMetadata = true) {
    console.log('🧹 Starting cleanup of synced files...');

    const cleanupResults = {
      deleted: [],
      failed: [],
      spaceSaved: 0
    };

    for (const syncedFile of syncResults.successful) {
      try {
        await this.localBackup.deleteFile(syncedFile.originalFile.id, syncedFile.originalFile.userId);
        
        cleanupResults.deleted.push(syncedFile.originalFile.originalFilename);
        cleanupResults.spaceSaved += syncedFile.originalFile.fileSizeBytes;

      } catch (error) {
        console.error(` Failed to cleanup ${syncedFile.originalFile.originalFilename}:`, error.message);
        cleanupResults.failed.push({
          filename: syncedFile.originalFile.originalFilename,
          error: error.message
        });
      }
    }

    console.log(`🧹 Cleanup completed: ${cleanupResults.deleted.length} files removed`);
    console.log(`💾 Space saved: ${(cleanupResults.spaceSaved / (1024 * 1024)).toFixed(2)}MB`);

    return cleanupResults;
  }

  /**
   * Get sync status and pending files
   * @param {string} userId - Optional: status for specific user
   * @returns {Promise<object>} Sync status
   */
  async getSyncStatus(userId = null) {
    try {
      const metadata = await this.localBackup.getMetadata();
      let pendingFiles = metadata.files;

      if (userId) {
        pendingFiles = pendingFiles.filter(file => file.userId === userId);
      }

      const totalSize = pendingFiles.reduce((sum, file) => sum + file.fileSizeBytes, 0);

      return {
        r2Available: this.r2Manager.r2Available,
        syncInProgress: this.syncInProgress,
        pendingFiles: pendingFiles.length,
        pendingSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(3),
        files: pendingFiles.map(file => ({
          filename: file.originalFilename,
          sizeMB: file.fileSizeMB,
          savedAt: file.savedAt,
          sessionId: file.sessionId
        }))
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      throw error;
    }
  }
}

module.exports = R2SyncService;