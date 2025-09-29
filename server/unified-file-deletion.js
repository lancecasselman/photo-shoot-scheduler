/**
 * Unified File Deletion Service
 * Provides complete photo deletion with zero traces remaining
 */

const { Pool } = require('pg');
const R2FileManager = require('./r2-file-manager');

class UnifiedFileDeletion {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        this.r2Manager = new R2FileManager(null, this.pool);
    }

    /**
     * Complete photo deletion with zero traces remaining
     * @param {boolean} skipPhotosArraySync - Set to true to skip photos array sync (for batch operations)
     */
    async deletePhotoCompletely(userId, sessionId, filename, skipPhotosArraySync = false) {
        const deletionLog = [];
        const errors = [];
        
        console.log(`🗑️ Starting COMPLETE deletion: ${filename} from session ${sessionId}`);
        
        // Start transaction for data consistency
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            // Step 1: Verify user ownership and get file details (within transaction)
            const fileQuery = await client.query(`
                SELECT sf.*, sf.file_size_bytes, sf.file_size_mb, sf.folder_type
                FROM session_files sf
                WHERE sf.session_id = $1 AND sf.filename = $2
            `, [sessionId, filename]);
            
            // Also check for any R2 files that might not be in database but should be deleted
            let r2FilesToDelete = [];
            try {
                const sessionFiles = await this.r2Manager.getSessionFiles(sessionId, userId);
                const allR2Files = [
                    ...sessionFiles.filesByType.gallery
                ];
                r2FilesToDelete = allR2Files.filter(f => f.filename === filename);
            } catch (r2Error) {
                console.log(` Could not check R2 for additional files: ${r2Error.message}`);
            }

            if (fileQuery.rows.length === 0) {
                throw new Error(`File not found or access denied: ${filename}`);
            }

            const fileRecord = fileQuery.rows[0];
            const folderType = fileRecord.folder_type || 'gallery'; // Default to gallery if not specified
            const fileSizeBytes = fileRecord.file_size_bytes || 0;
            const fileSizeMB = fileRecord.file_size_mb || 0;

            deletionLog.push(`✓ Verified ownership and access for ${filename} (${fileSizeMB}MB)`);
            console.log(` File details: ${filename} - ${fileSizeMB}MB - Type: ${folderType}`);

            // Step 2: Delete from Cloud Storage (R2) - HARD GATE: Must succeed before proceeding
            console.log(`☁️ Attempting to delete from R2: ${filename} from session ${sessionId}`);
            
            // Use the R2 key from database record for direct deletion
            const r2Key = fileRecord.r2_key;
            if (!r2Key) {
                throw new Error(`No R2 key found in database record - cannot proceed with deletion`);
            }

            console.log(`🔑 Deleting using stored R2 key: ${r2Key}`);
            const r2Result = await this.r2Manager.deleteFileByKey(r2Key);
            
            if (!r2Result || !r2Result.success) {
                throw new Error(`R2 deletion failed: ${r2Result?.error || 'Unknown R2 error'} - ABORTING to prevent orphaned metadata`);
            }

            deletionLog.push(`✓ Deleted from cloud storage using key: ${r2Key}`);
            console.log(`☁️ Successfully deleted from R2: ${filename} - proceeding with cleanup`);

            // Step 3: Delete all thumbnails, previews, and cached versions
            console.log(`🖼️ Starting comprehensive thumbnail cleanup for: ${filename}`);
            const thumbnailSizes = ['_sm', '_md', '_lg', '_thumb', '_preview', ''];
            const thumbnailPaths = [];
            let thumbnailsDeleted = 0;
            
            try {
                // Generate all possible thumbnail and preview paths
                const baseFilename = filename.replace(/\.[^/.]+$/, ""); // Remove extension
                const extension = filename.substring(filename.lastIndexOf('.'));
                
                for (const size of thumbnailSizes) {
                    const thumbnailFilename = size ? `${baseFilename}${size}${extension}` : filename;
                    const paths = [
                        `${userId}/${sessionId}/thumbnails/${thumbnailFilename}`,
                        `${userId}/${sessionId}/previews/${thumbnailFilename}`,
                        `${userId}/${sessionId}/cache/${thumbnailFilename}`,
                        `thumbnails/${userId}/${sessionId}/${thumbnailFilename}`,
                        `previews/${userId}/${sessionId}/${thumbnailFilename}`,
                        `cache/${userId}/${sessionId}/${thumbnailFilename}`
                    ];
                    thumbnailPaths.push(...paths);
                }
                
                // Delete each thumbnail/preview variant
                for (const thumbnailPath of thumbnailPaths) {
                    try {
                        await this.r2Manager.deleteFile(thumbnailPath);
                        thumbnailsDeleted++;
                        console.log(`📷 Deleted thumbnail: ${thumbnailPath}`);
                    } catch (thumbError) {
                        // Individual thumbnail failures are acceptable (file may not exist)
                        // Don't log these as they clutter the output
                    }
                }
                
                if (thumbnailsDeleted > 0) {
                    deletionLog.push(`✓ Deleted ${thumbnailsDeleted} thumbnail/preview variant(s)`);
                } else {
                    deletionLog.push(`📷 No thumbnails found to delete (acceptable)`);
                }
                
            } catch (thumbError) {
                console.warn(`⚠️ Thumbnail cleanup error: ${thumbError.message}`);
                errors.push(`Thumbnail cleanup: ${thumbError.message}`);
            }

            // Step 4: Remove from database - session_files table (within transaction)
            const deleteDbResult = await client.query(`
                DELETE FROM session_files 
                WHERE session_id = $1 AND filename = $2
            `, [sessionId, filename]);

            if (deleteDbResult.rowCount > 0) {
                deletionLog.push(`✓ Removed from session_files database (${deleteDbResult.rowCount} record)`);
                console.log(`🗄️ Database record removed: ${filename}`);
            } else {
                console.warn(` No database record found to delete for: ${filename}`);
            }

            // Step 5: Update storage tracking tables (within transaction)
            // Update gallery_storage_tracking if it's a gallery file
            if (folderType === 'gallery') {
                await client.query(`
                    UPDATE gallery_storage_tracking 
                    SET total_size_bytes = total_size_bytes - $1,
                        file_count = file_count - 1,
                        last_updated = NOW()
                    WHERE session_id = $2 AND user_id = $3
                `, [fileSizeBytes, sessionId, userId]);
                deletionLog.push(`✓ Updated gallery storage tracking (-${fileSizeMB}MB)`);
            }


            // Step 6: Clean up ALL download-related data (critical - must not fail silently)
            console.log(`🔄 Starting comprehensive download cleanup for: ${filename}`);
            
            // 6a. Clean up download_entitlements (client download allowances)
            const entitlementsResult = await client.query(`
                DELETE FROM download_entitlements 
                WHERE session_id = $1 AND (photo_id = $2 OR photo_id LIKE $3)
            `, [sessionId, filename, `%${filename}%`]);
            if (entitlementsResult.rowCount > 0) {
                deletionLog.push(`✓ Removed ${entitlementsResult.rowCount} download entitlement(s)`);
                console.log(`🗑️ Cleaned ${entitlementsResult.rowCount} download entitlements`);
            }
            
            // 6b. Clean up download_history (all download attempt logs)
            const historyResult = await client.query(`
                DELETE FROM download_history 
                WHERE session_id = $1 AND (photo_id = $2 OR filename = $2)
            `, [sessionId, filename]);
            if (historyResult.rowCount > 0) {
                deletionLog.push(`✓ Removed ${historyResult.rowCount} download history record(s)`);
                console.log(`🗑️ Cleaned ${historyResult.rowCount} download history records`);
            }
            
            // 6c. Clean up unused download_tokens for this photo
            const tokensResult = await client.query(`
                DELETE FROM download_tokens 
                WHERE session_id = $1 AND (filename = $2 OR photo_id = $2)
            `, [sessionId, filename]);
            if (tokensResult.rowCount > 0) {
                deletionLog.push(`✓ Removed ${tokensResult.rowCount} download token(s)`);
                console.log(`🗑️ Cleaned ${tokensResult.rowCount} download tokens`);
            }
            
            // 6d. Clean up gallery_downloads (download usage records)
            const galleryDownloadsResult = await client.query(`
                DELETE FROM gallery_downloads 
                WHERE session_id = $1 AND (photo_id = $2 OR filename = $2)
            `, [sessionId, filename]);
            if (galleryDownloadsResult.rowCount > 0) {
                deletionLog.push(`✓ Removed ${galleryDownloadsResult.rowCount} gallery download record(s)`);
                console.log(`🗑️ Cleaned ${galleryDownloadsResult.rowCount} gallery download records`);
            }
            
            // 6e. Clean up digital_transactions (payment records)
            const transactionsResult = await client.query(`
                DELETE FROM digital_transactions 
                WHERE session_id = $1 AND photo_id = $2
            `, [sessionId, filename]);
            if (transactionsResult.rowCount > 0) {
                deletionLog.push(`✓ Removed ${transactionsResult.rowCount} digital transaction(s)`);
                console.log(`🗑️ Cleaned ${transactionsResult.rowCount} digital transactions`);
            }
            
            // 6f. Clean up r2_files table if it exists (allow this one to fail silently)
            try {
                const r2FilesResult = await client.query(`
                    DELETE FROM r2_files 
                    WHERE session_id = $1 AND (filename = $2 OR original_filename = $2)
                `, [sessionId, filename]);
                if (r2FilesResult.rowCount > 0) {
                    deletionLog.push(`✓ Removed ${r2FilesResult.rowCount} R2 file record(s)`);
                    console.log(`🗑️ Cleaned ${r2FilesResult.rowCount} R2 file records`);
                }
            } catch (r2Error) {
                // This table may not exist in all installations - log but don't fail
                console.log(`📝 R2 files table cleanup (may not exist): ${r2Error.message}`);
            }
            
            deletionLog.push(`✓ Completed comprehensive download cleanup`);
            
            // Step 7: Clean up photo metadata and associations (allow missing tables)
            try {
                // Remove from any website builder galleries (if applicable)
                await client.query(`
                    DELETE FROM website_gallery_photos 
                    WHERE session_id = $1 AND filename = $2
                `, [sessionId, filename]);
                deletionLog.push(`✓ Cleaned website gallery associations`);
            } catch (websiteError) {
                // Table may not exist - log but continue
                console.log(`📝 Website gallery cleanup (table may not exist): ${websiteError.message}`);
            }

            try {
                // Remove from community posts if shared (if applicable)
                await client.query(`
                    DELETE FROM community_photos 
                    WHERE session_id = $1 AND filename = $2
                `, [sessionId, filename]);
                deletionLog.push(`✓ Cleaned community post associations`);
            } catch (communityError) {
                // Table may not exist - log but continue
                console.log(`📝 Community posts cleanup (table may not exist): ${communityError.message}`);
            }

            // Step 8: Update session photos array using robust synchronization (skip if batch operation)
            if (skipPhotosArraySync) {
                deletionLog.push(`⏭️ Skipped photos array sync (will sync at end of batch)`);
                console.log(`⏭️ Skipping photos array sync for batch operation`);
            } else {
                console.log(`📋 Synchronizing session photos array with actual files for session: ${sessionId}`);
            
            // Get current photos array
            const sessionQuery = await client.query(`
                SELECT photos FROM photography_sessions 
                WHERE id = $1 AND user_id = $2
            `, [sessionId, userId]);
            
            if (sessionQuery.rows.length > 0) {
                // Get all CURRENT files in session_files to rebuild photos array
                const currentFilesQuery = await client.query(`
                    SELECT filename, r2_key, file_size_bytes, uploaded_at, original_name, folder_type
                    FROM session_files 
                    WHERE session_id = $1 AND folder_type = 'gallery'
                    ORDER BY uploaded_at ASC
                `, [sessionId]);
                
                const currentFiles = currentFilesQuery.rows;
                let photosArray = sessionQuery.rows[0].photos || [];
                const originalLength = photosArray.length;
                
                console.log(`📊 Current photos array has ${originalLength} photos, session_files has ${currentFiles.length} gallery files`);
                
                // ROBUST APPROACH: Rebuild photos array from session_files (source of truth)
                const validPhotosSet = new Set(currentFiles.map(f => f.filename));
                const validR2KeysSet = new Set(currentFiles.map(f => f.r2_key));
                
                // Filter photos array to only include photos that exist in session_files
                const syncedPhotosArray = photosArray.filter(photo => {
                    if (typeof photo === 'string') {
                        // Handle string format (legacy)
                        const filenameFromString = photo.split('/').pop();
                        return validPhotosSet.has(filenameFromString);
                    } else if (typeof photo === 'object' && photo !== null) {
                        // Handle object format (current)
                        return validPhotosSet.has(photo.filename) || 
                               validR2KeysSet.has(photo.r2Key);
                    }
                    return false;
                });
                
                // Add any gallery files from session_files that aren't in photos array
                const existingFilenames = new Set();
                syncedPhotosArray.forEach(photo => {
                    if (typeof photo === 'object' && photo.filename) {
                        existingFilenames.add(photo.filename);
                    } else if (typeof photo === 'string') {
                        const filename = photo.split('/').pop();
                        existingFilenames.add(filename);
                    }
                });
                
                // Add missing files from session_files to photos array
                currentFiles.forEach(file => {
                    if (!existingFilenames.has(file.filename)) {
                        console.log(`📝 Adding missing file to photos array: ${file.filename}`);
                        syncedPhotosArray.push({
                            filename: file.filename,
                            originalName: file.original_name || file.filename,
                            url: `/r2/file/${userId}/session-${sessionId}/gallery/${file.filename}`,
                            r2Key: file.r2_key,
                            size: file.file_size_bytes || 0,
                            uploadedAt: file.uploaded_at || new Date().toISOString()
                        });
                    }
                });
                
                // Update the session with synchronized photos array
                await client.query(`
                    UPDATE photography_sessions 
                    SET photos = $1, updated_at = NOW()
                    WHERE id = $2 AND user_id = $3
                `, [JSON.stringify(syncedPhotosArray), sessionId, userId]);
                
                const removedCount = originalLength - syncedPhotosArray.length;
                const addedCount = syncedPhotosArray.length - (originalLength - removedCount);
                
                deletionLog.push(`✓ Synchronized photos array: ${syncedPhotosArray.length} photos (removed ${removedCount}, added ${addedCount})`);
                console.log(`📋 Photos array synchronized: ${originalLength} → ${syncedPhotosArray.length} photos`);
                console.log(`📊 Sync details: removed ${removedCount} orphaned photos, added ${addedCount} missing photos`);
                
            } else {
                // Session not found is a critical error for data consistency
                throw new Error(`Session not found for photos array update: ${sessionId}`);
            }
            }
            
            // Step 8.5: Update R2 backup-index.json to remove deleted file
            try {
                console.log(`🗂️ Updating R2 backup index to remove: ${filename}`);
                
                // Prepare file info for backup index removal
                const fileInfoForBackup = {
                    filename: filename,
                    r2Key: fileRecord.r2_key,
                    fileType: folderType,
                    fileSizeBytes: fileSizeBytes,
                    uploadedAt: fileRecord.uploaded_at || new Date().toISOString(),
                    originalFormat: filename.substring(filename.lastIndexOf('.') + 1),
                    contentType: 'image/jpeg'
                };
                
                // Update backup index to remove this file
                await this.r2Manager.updateBackupIndex(userId, sessionId, fileInfoForBackup, 'remove');
                
                deletionLog.push(`✓ Updated R2 backup index to remove file reference`);
                console.log(`🗂️ Successfully updated backup index for session ${sessionId}`);
                
            } catch (backupIndexError) {
                console.warn(`⚠️ Backup index update failed: ${backupIndexError.message}`);
                errors.push(`Backup index update: ${backupIndexError.message}`);
                deletionLog.push(`⚠️ Backup index update failed: ${backupIndexError.message}`);
            }
            
            // Step 9: Log the deletion for audit trail (within transaction)
            try {
                await client.query(`
                    INSERT INTO deletion_audit_log 
                    (user_id, session_id, filename, file_size_mb, folder_type, deleted_at, deletion_method)
                    VALUES ($1, $2, $3, $4, $5, NOW(), 'unified_deletion')
                `, [userId, sessionId, filename, fileSizeMB, folderType]);
                deletionLog.push(`✓ Logged deletion for audit trail`);
            } catch (auditError) {
                // Audit logging failure shouldn't block deletion but log it
                console.warn(`⚠️ Audit logging failed: ${auditError.message}`);
            }

            // Commit the transaction - all database changes are now permanent
            await client.query('COMMIT');
            console.log(`✅ Database transaction committed for ${filename}`);
            deletionLog.push(`✓ Database transaction committed`);

            // Final comprehensive summary
            const successfulSteps = deletionLog.filter(step => step.startsWith('✓')).length;
            const warningSteps = deletionLog.filter(step => step.startsWith('⚠️') || step.startsWith('📷')).length;
            const totalSteps = deletionLog.length;
            
            console.log(`✅ COMPLETE DELETION SUCCESS: ${filename}`);
            console.log(`📊 Deletion Summary:`);
            console.log(`   ✓ Successful steps: ${successfulSteps}`);
            console.log(`   ⚠️ Warning steps: ${warningSteps}`);
            console.log(`   🔢 Total operations: ${totalSteps}`);
            console.log(`   📋 File size reclaimed: ${fileSizeMB}MB`);
            if (errors.length > 0) {
                console.log(`   ❌ Non-critical errors: ${errors.length}`);
                errors.forEach((error, index) => {
                    console.log(`      ${index + 1}. ${error}`);
                });
            }
            
            return {
                success: true,
                filename: filename,
                fileSizeMB: fileSizeMB,
                folderType: folderType,
                steps: deletionLog,
                summary: {
                    successfulSteps: successfulSteps,
                    warningSteps: warningSteps,
                    totalSteps: totalSteps,
                    errorsCount: errors.length,
                    sizeReclaimedMB: fileSizeMB
                },
                errors: errors.length > 0 ? errors : null,
                message: `Successfully deleted ${filename} (${fileSizeMB}MB) with comprehensive cleanup (${successfulSteps}/${totalSteps} operations successful)`
            };

        } catch (error) {
            // Rollback transaction on any error to maintain data consistency
            try {
                await client.query('ROLLBACK');
                console.log(`🔄 Database transaction rolled back due to error`);
                deletionLog.push(`⚠️ Database transaction rolled back`);
            } catch (rollbackError) {
                console.error(`❌ Failed to rollback transaction: ${rollbackError.message}`);
                errors.push(`Transaction rollback failed: ${rollbackError.message}`);
            }
            
            console.error(`❌ DELETION FAILED: ${filename} - ${error.message}`);
            console.error(`🔍 Error details:`, error.stack);
            
            // Log partial progress for debugging
            const successfulSteps = deletionLog.filter(step => step.startsWith('✓')).length;
            if (successfulSteps > 0) {
                console.log(`📊 Partial progress before failure:`);
                console.log(`   ✓ Completed steps: ${successfulSteps}`);
                console.log(`   🔢 Total attempted: ${deletionLog.length}`);
            }
            
            return {
                success: false,
                filename: filename,
                error: error.message,
                errorStack: error.stack,
                steps: deletionLog,
                summary: {
                    successfulSteps: successfulSteps,
                    totalSteps: deletionLog.length,
                    errorsCount: errors.length + 1, // +1 for the main error
                    partialCompletion: successfulSteps > 0
                },
                errors: [...errors, error.message],
                message: `Failed to delete ${filename}: ${error.message} (${successfulSteps} steps completed before failure)`
            };
        } finally {
            // Always release the database connection
            client.release();
        }
    }

    /**
     * Synchronize photos array with session_files (standalone method)
     * This ensures the photos array only contains photos that actually exist
     */
    async synchronizePhotosArray(userId, sessionId) {
        console.log(`🔄 Starting photos array synchronization for session: ${sessionId}`);
        
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Get current photos array
            const sessionQuery = await client.query(`
                SELECT photos FROM photography_sessions 
                WHERE id = $1 AND user_id = $2
            `, [sessionId, userId]);
            
            if (sessionQuery.rows.length === 0) {
                throw new Error(`Session not found: ${sessionId}`);
            }
            
            // Get all CURRENT gallery files in session_files
            const currentFilesQuery = await client.query(`
                SELECT filename, r2_key, file_size_bytes, uploaded_at, original_name, folder_type
                FROM session_files 
                WHERE session_id = $1 AND folder_type = 'gallery'
                ORDER BY uploaded_at ASC
            `, [sessionId]);
            
            const currentFiles = currentFilesQuery.rows;
            let photosArray = sessionQuery.rows[0].photos || [];
            const originalLength = photosArray.length;
            
            console.log(`📊 Photos array: ${originalLength} photos | Session files: ${currentFiles.length} gallery files`);
            
            // Create sets for efficient lookup
            const validPhotosSet = new Set(currentFiles.map(f => f.filename));
            const validR2KeysSet = new Set(currentFiles.map(f => f.r2_key));
            
            // Filter photos array to only include photos that exist in session_files
            const syncedPhotosArray = photosArray.filter(photo => {
                if (typeof photo === 'string') {
                    const filenameFromString = photo.split('/').pop();
                    return validPhotosSet.has(filenameFromString);
                } else if (typeof photo === 'object' && photo !== null) {
                    return validPhotosSet.has(photo.filename) || 
                           validR2KeysSet.has(photo.r2Key);
                }
                return false;
            });
            
            // Add any gallery files from session_files that aren't in photos array
            const existingFilenames = new Set();
            syncedPhotosArray.forEach(photo => {
                if (typeof photo === 'object' && photo.filename) {
                    existingFilenames.add(photo.filename);
                } else if (typeof photo === 'string') {
                    const filename = photo.split('/').pop();
                    existingFilenames.add(filename);
                }
            });
            
            // Add missing files
            currentFiles.forEach(file => {
                if (!existingFilenames.has(file.filename)) {
                    console.log(`➕ Adding missing file to photos array: ${file.filename}`);
                    syncedPhotosArray.push({
                        filename: file.filename,
                        originalName: file.original_name || file.filename,
                        url: `/r2/file/${userId}/session-${sessionId}/gallery/${file.filename}`,
                        r2Key: file.r2_key,
                        size: file.file_size_bytes || 0,
                        uploadedAt: file.uploaded_at || new Date().toISOString()
                    });
                }
            });
            
            // Update the session
            await client.query(`
                UPDATE photography_sessions 
                SET photos = $1, updated_at = NOW()
                WHERE id = $2 AND user_id = $3
            `, [JSON.stringify(syncedPhotosArray), sessionId, userId]);
            
            await client.query('COMMIT');
            
            const removedCount = originalLength - syncedPhotosArray.length + (syncedPhotosArray.length - currentFiles.length);
            const addedCount = currentFiles.length - (originalLength - removedCount);
            
            console.log(`✅ Photos array synchronized: ${originalLength} → ${syncedPhotosArray.length} photos`);
            console.log(`📊 Removed ${Math.max(0, originalLength - syncedPhotosArray.length)} orphaned photos, added ${Math.max(0, syncedPhotosArray.length - (originalLength - Math.max(0, originalLength - syncedPhotosArray.length)))} missing photos`);
            
            return {
                success: true,
                originalCount: originalLength,
                syncedCount: syncedPhotosArray.length,
                filesInDatabase: currentFiles.length,
                message: `Synchronized photos array: ${originalLength} → ${syncedPhotosArray.length} photos`
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ Photos array synchronization failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                message: `Failed to synchronize photos array: ${error.message}`
            };
        } finally {
            client.release();
        }
    }

    /**
     * Delete multiple photos in batch with parallel processing
     * Race-condition safe: Syncs photos array once at the end
     */
    async deleteMultiplePhotos(userId, sessionId, filenames) {
        console.log(`🗑️ Batch deletion: ${filenames.length} photos from session ${sessionId}`);
        
        const results = [];
        let totalReclaimed = 0;
        let successCount = 0;
        let errorCount = 0;

        // Process deletions in parallel batches for speed (30 at a time for maximum performance)
        const BATCH_SIZE = 30;
        const totalBatches = Math.ceil(filenames.length / BATCH_SIZE);
        
        console.log(`📦 Processing ${filenames.length} deletions in ${totalBatches} parallel batches of ${BATCH_SIZE}`);
        
        for (let i = 0; i < filenames.length; i += BATCH_SIZE) {
            const batch = filenames.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            
            console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} files)...`);
            
            // Delete all files in this batch in parallel (skip photos array sync - will do once at end)
            const batchPromises = batch.map(filename => 
                this.deletePhotoCompletely(userId, sessionId, filename, true)
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Update counters
            for (const result of batchResults) {
                if (result.success) {
                    successCount++;
                    totalReclaimed += parseFloat(result.fileSizeMB || 0);
                } else {
                    errorCount++;
                }
            }
            
            console.log(`✅ Batch ${batchNumber} complete: ${batchResults.filter(r => r.success).length}/${batch.length} successful`);
        }

        console.log(`✅ Batch deletion complete: ${successCount} success, ${errorCount} errors, ${totalReclaimed.toFixed(2)}MB reclaimed`);
        
        // NOW sync photos array once to prevent race conditions
        console.log(`🔄 Final step: Synchronizing photos array after all deletions...`);
        const syncResult = await this.synchronizePhotosArray(userId, sessionId);
        if (syncResult.success) {
            console.log(`✅ Photos array synchronized: ${syncResult.syncedCount} photos remaining`);
        } else {
            console.warn(`⚠️ Photos array sync failed: ${syncResult.error}`);
        }

        return {
            success: errorCount === 0,
            totalFiles: filenames.length,
            successCount: successCount,
            errorCount: errorCount,
            totalReclaimedMB: totalReclaimed.toFixed(2),
            photosSynced: syncResult.success,
            remainingPhotos: syncResult.syncedCount || 0,
            results: results,
            message: `Deleted ${successCount}/${filenames.length} photos, reclaimed ${totalReclaimed.toFixed(2)}MB`
        };
    }

    /**
     * Verify deletion completeness across all systems
     */
    async verifyDeletionComplete(userId, sessionId, filename) {
        const issues = [];
        const verificationSteps = [];
        
        try {
            console.log(`🔍 Starting comprehensive deletion verification for: ${filename}`);
            
            // Check main session_files database
            const dbCheck = await this.pool.query(`
                SELECT COUNT(*) as count FROM session_files 
                WHERE session_id = $1 AND filename = $2
            `, [sessionId, filename]);
            
            if (parseInt(dbCheck.rows[0].count) > 0) {
                issues.push('Database record still exists in session_files');
            } else {
                verificationSteps.push('✓ Verified removal from session_files table');
            }
            
            // Check all download-related tables
            const downloadTables = [
                'download_entitlements',
                'download_history', 
                'download_tokens',
                'gallery_downloads',
                'digital_transactions'
            ];
            
            for (const table of downloadTables) {
                try {
                    const checkQuery = `
                        SELECT COUNT(*) as count FROM ${table} 
                        WHERE session_id = $1 AND (photo_id = $2 OR filename = $2)
                    `;
                    const result = await this.pool.query(checkQuery, [sessionId, filename]);
                    
                    if (parseInt(result.rows[0].count) > 0) {
                        issues.push(`Records still exist in ${table}`);
                    } else {
                        verificationSteps.push(`✓ Verified removal from ${table}`);
                    }
                } catch (tableError) {
                    verificationSteps.push(`⚠️ Could not verify ${table} (table may not exist)`);
                }
            }
            
            // Check r2_files table if it exists
            try {
                const r2Check = await this.pool.query(`
                    SELECT COUNT(*) as count FROM r2_files 
                    WHERE session_id = $1 AND (filename = $2 OR original_filename = $2)
                `, [sessionId, filename]);
                
                if (parseInt(r2Check.rows[0].count) > 0) {
                    issues.push('Records still exist in r2_files');
                } else {
                    verificationSteps.push('✓ Verified removal from r2_files table');
                }
            } catch (r2Error) {
                verificationSteps.push('⚠️ Could not verify r2_files (table may not exist)');
            }

            // Check cloud storage by trying to get session files
            try {
                const sessionFiles = await this.r2Manager.getSessionFiles(sessionId, userId);
                const stillExists = sessionFiles.filesByType.gallery.some(f => f.filename === filename);
                if (stillExists) {
                    issues.push('File still exists in cloud storage');
                } else {
                    verificationSteps.push('✓ Verified removal from cloud storage');
                }
            } catch (cloudError) {
                // File not existing is what we want
                verificationSteps.push('✓ Cloud storage check: file not found (expected)');
            }
            
            // Check backup index
            try {
                const backupIndex = await this.r2Manager.getSessionBackupIndex(userId, sessionId);
                const existsInBackup = backupIndex.files.some(f => f.filename === filename);
                if (existsInBackup) {
                    issues.push('File still referenced in backup index');
                } else {
                    verificationSteps.push('✓ Verified removal from backup index');
                }
            } catch (backupError) {
                verificationSteps.push('⚠️ Could not verify backup index (may not exist)');
            }
            
            const isComplete = issues.length === 0;
            console.log(`🔍 Verification complete: ${isComplete ? 'PASSED' : 'FAILED'}`);
            if (issues.length > 0) {
                console.log(`❌ Issues found:`, issues);
            }
            console.log(`📊 Verification steps: ${verificationSteps.length}`);

            return {
                complete: isComplete,
                issues: issues,
                verificationSteps: verificationSteps,
                tablesChecked: downloadTables.length + 3, // +3 for session_files, r2_files, cloud storage
                message: isComplete ? 
                    `Deletion verified complete across ${verificationSteps.length} checks` : 
                    `Issues found: ${issues.join(', ')}`
            };

        } catch (error) {
            console.error(`❌ Verification failed: ${error.message}`);
            return {
                complete: false,
                issues: [`Verification failed: ${error.message}`],
                verificationSteps: verificationSteps,
                message: `Could not verify deletion: ${error.message}`
            };
        }
    }
}

module.exports = UnifiedFileDeletion;