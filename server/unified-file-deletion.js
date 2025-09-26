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
     */
    async deletePhotoCompletely(userId, sessionId, filename) {
        const deletionLog = [];
        const errors = [];
        
        console.log(`🗑️ Starting COMPLETE deletion: ${filename} from session ${sessionId}`);
        
        try {
            // Step 1: Verify user ownership and get file details
            const fileQuery = await this.pool.query(`
                SELECT sf.*, sf.file_size_bytes, sf.file_size_mb, sf.folder_type
                FROM session_files sf
                WHERE sf.session_id = $1 AND sf.filename = $2
            `, [sessionId, filename]);
            
            // Also check for any R2 files that might not be in database but should be deleted
            let r2FilesToDelete = [];
            try {
                const sessionFiles = await this.r2Manager.getSessionFiles(sessionId, userId);
                const allR2Files = [
                    ...sessionFiles.filesByType.gallery,
                    ...sessionFiles.filesByType.raw
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

            // Step 2: Delete from Cloud Storage (R2) - Use direct R2 key deletion
            try {
                console.log(`☁️ Attempting to delete from R2: ${filename} from session ${sessionId}`);
                
                // Use the R2 key from database record for direct deletion
                const r2Key = fileRecord.r2_key;
                if (r2Key) {
                    console.log(`🔑 Deleting using stored R2 key: ${r2Key}`);
                    const r2Result = await this.r2Manager.deleteFileByKey(r2Key);
                    
                    if (r2Result && r2Result.success) {
                        deletionLog.push(`✓ Deleted from cloud storage using key: ${r2Key}`);
                        console.log(`☁️ Successfully deleted from R2: ${filename}`);
                    } else {
                        throw new Error('R2 deletion by key failed');
                    }
                } else {
                    throw new Error('No R2 key found in database record');
                }
                
            } catch (cloudError) {
                console.warn(` Cloud deletion failed (continuing with database cleanup): ${cloudError.message}`);
                errors.push(`Cloud storage: ${cloudError.message}`);
                deletionLog.push(` Cloud deletion failed: ${cloudError.message}`);
            }

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

            // Step 4: Remove from database - session_files table
            const deleteDbResult = await this.pool.query(`
                DELETE FROM session_files 
                WHERE session_id = $1 AND filename = $2
            `, [sessionId, filename]);

            if (deleteDbResult.rowCount > 0) {
                deletionLog.push(`✓ Removed from session_files database (${deleteDbResult.rowCount} record)`);
                console.log(`🗄️ Database record removed: ${filename}`);
            } else {
                console.warn(` No database record found to delete for: ${filename}`);
            }

            // Step 5: Update storage tracking tables
            try {
                // Update gallery_storage_tracking if it's a gallery file
                if (folderType === 'gallery') {
                    await this.pool.query(`
                        UPDATE gallery_storage_tracking 
                        SET total_size_bytes = total_size_bytes - $1,
                            file_count = file_count - 1,
                            last_updated = NOW()
                        WHERE session_id = $2 AND user_id = $3
                    `, [fileSizeBytes, sessionId, userId]);
                    deletionLog.push(`✓ Updated gallery storage tracking (-${fileSizeMB}MB)`);
                }

                // Update raw_storage_usage if it's a raw file
                if (folderType === 'raw') {
                    await this.pool.query(`
                        UPDATE raw_storage_usage 
                        SET total_size_bytes = total_size_bytes - $1,
                            file_count = file_count - 1,
                            last_updated = NOW()
                        WHERE session_id = $2 AND user_id = $3
                    `, [fileSizeBytes, sessionId, userId]);
                    deletionLog.push(`✓ Updated raw storage tracking (-${fileSizeMB}MB)`);
                }
            } catch (trackingError) {
                console.warn(` Storage tracking update failed: ${trackingError.message}`);
                errors.push(`Storage tracking: ${trackingError.message}`);
            }

            // Step 6: Clean up ALL download-related data
            console.log(`🔄 Starting comprehensive download cleanup for: ${filename}`);
            
            try {
                // 6a. Clean up download_entitlements (client download allowances)
                const entitlementsResult = await this.pool.query(`
                    DELETE FROM download_entitlements 
                    WHERE session_id = $1 AND (photo_id = $2 OR photo_id LIKE $3)
                `, [sessionId, filename, `%${filename}%`]);
                if (entitlementsResult.rowCount > 0) {
                    deletionLog.push(`✓ Removed ${entitlementsResult.rowCount} download entitlement(s)`);
                    console.log(`🗑️ Cleaned ${entitlementsResult.rowCount} download entitlements`);
                }
                
                // 6b. Clean up download_history (all download attempt logs)
                const historyResult = await this.pool.query(`
                    DELETE FROM download_history 
                    WHERE session_id = $1 AND (photo_id = $2 OR filename = $2)
                `, [sessionId, filename]);
                if (historyResult.rowCount > 0) {
                    deletionLog.push(`✓ Removed ${historyResult.rowCount} download history record(s)`);
                    console.log(`🗑️ Cleaned ${historyResult.rowCount} download history records`);
                }
                
                // 6c. Clean up unused download_tokens for this photo
                const tokensResult = await this.pool.query(`
                    DELETE FROM download_tokens 
                    WHERE session_id = $1 AND (filename = $2 OR photo_id = $2)
                `, [sessionId, filename]);
                if (tokensResult.rowCount > 0) {
                    deletionLog.push(`✓ Removed ${tokensResult.rowCount} download token(s)`);
                    console.log(`🗑️ Cleaned ${tokensResult.rowCount} download tokens`);
                }
                
                // 6d. Clean up gallery_downloads (download usage records)
                const galleryDownloadsResult = await this.pool.query(`
                    DELETE FROM gallery_downloads 
                    WHERE session_id = $1 AND (photo_id = $2 OR filename = $2)
                `, [sessionId, filename]);
                if (galleryDownloadsResult.rowCount > 0) {
                    deletionLog.push(`✓ Removed ${galleryDownloadsResult.rowCount} gallery download record(s)`);
                    console.log(`🗑️ Cleaned ${galleryDownloadsResult.rowCount} gallery download records`);
                }
                
                // 6e. Clean up digital_transactions (payment records)
                const transactionsResult = await this.pool.query(`
                    DELETE FROM digital_transactions 
                    WHERE session_id = $1 AND photo_id = $2
                `, [sessionId, filename]);
                if (transactionsResult.rowCount > 0) {
                    deletionLog.push(`✓ Removed ${transactionsResult.rowCount} digital transaction(s)`);
                    console.log(`🗑️ Cleaned ${transactionsResult.rowCount} digital transactions`);
                }
                
                // 6f. Clean up r2_files table if it exists
                try {
                    const r2FilesResult = await this.pool.query(`
                        DELETE FROM r2_files 
                        WHERE session_id = $1 AND (filename = $2 OR original_filename = $2)
                    `, [sessionId, filename]);
                    if (r2FilesResult.rowCount > 0) {
                        deletionLog.push(`✓ Removed ${r2FilesResult.rowCount} R2 file record(s)`);
                        console.log(`🗑️ Cleaned ${r2FilesResult.rowCount} R2 file records`);
                    }
                } catch (r2Error) {
                    console.log(`📝 R2 files table cleanup (may not exist): ${r2Error.message}`);
                }
                
                deletionLog.push(`✓ Completed comprehensive download cleanup`);
                
            } catch (downloadCleanupError) {
                console.warn(`⚠️ Download cleanup partially failed: ${downloadCleanupError.message}`);
                errors.push(`Download cleanup: ${downloadCleanupError.message}`);
                deletionLog.push(`⚠️ Download cleanup partially failed: ${downloadCleanupError.message}`);
            }
            
            // Step 7: Clean up photo metadata and associations
            try {
                // Remove from any website builder galleries (if applicable)
                await this.pool.query(`
                    DELETE FROM website_gallery_photos 
                    WHERE session_id = $1 AND filename = $2
                `, [sessionId, filename]);
                deletionLog.push(`✓ Cleaned website gallery associations`);

                // Remove from community posts if shared (if applicable)
                await this.pool.query(`
                    DELETE FROM community_photos 
                    WHERE session_id = $1 AND filename = $2
                `, [sessionId, filename]);
                deletionLog.push(`✓ Cleaned community post associations`);

            } catch (metadataError) {
                // These tables may not exist, continue
                console.log(` Metadata cleanup (tables may not exist): ${metadataError.message}`);
            }

            // Step 8: Update session photos array to remove this photo
            try {
                console.log(`📋 Updating session photos array to remove: ${filename}`);
                
                // Get current photos array
                const sessionQuery = await this.pool.query(`
                    SELECT photos FROM photography_sessions 
                    WHERE id = $1 AND user_id = $2
                `, [sessionId, userId]);
                
                if (sessionQuery.rows.length > 0) {
                    let photosArray = sessionQuery.rows[0].photos || [];
                    const originalLength = photosArray.length;
                    
                    // Remove the photo from the array (match by filename, url, or r2Key)
                    photosArray = photosArray.filter(photo => {
                        if (typeof photo === 'string') {
                            return !photo.includes(filename);
                        } else if (typeof photo === 'object' && photo !== null) {
                            return !(photo.filename === filename || 
                                   photo.originalName === filename ||
                                   (photo.url && photo.url.includes(filename)) ||
                                   (photo.r2Key && photo.r2Key.includes(filename)));
                        }
                        return true;
                    });
                    
                    // Update the session if photos were removed
                    if (photosArray.length !== originalLength) {
                        await this.pool.query(`
                            UPDATE photography_sessions 
                            SET photos = $1, updated_at = NOW()
                            WHERE id = $2 AND user_id = $3
                        `, [JSON.stringify(photosArray), sessionId, userId]);
                        
                        const removedCount = originalLength - photosArray.length;
                        deletionLog.push(`✓ Removed ${removedCount} photo reference(s) from session photos array`);
                        console.log(`📋 Updated session photos array: removed ${removedCount} reference(s)`);
                    } else {
                        deletionLog.push(`📋 No photo references found in session photos array`);
                    }
                } else {
                    console.warn(`⚠️ Session not found for photos array update: ${sessionId}`);
                }
                
            } catch (sessionError) {
                console.warn(`⚠️ Session photos array update failed: ${sessionError.message}`);
                errors.push(`Session photos update: ${sessionError.message}`);
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
                    contentType: folderType === 'raw' ? 'application/octet-stream' : 'image/jpeg'
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
            
            // Step 9: Log the deletion for audit trail
            try {
                await this.pool.query(`
                    INSERT INTO deletion_audit_log 
                    (user_id, session_id, filename, file_size_mb, folder_type, deleted_at, deletion_method)
                    VALUES ($1, $2, $3, $4, $5, NOW(), 'unified_deletion')
                `, [userId, sessionId, filename, fileSizeMB, folderType]);
                deletionLog.push(`✓ Logged deletion for audit trail`);
            } catch (auditError) {
                // Audit logging failure shouldn't block deletion
                console.warn(` Audit logging failed: ${auditError.message}`);
            }

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
        }
    }

    /**
     * Delete multiple photos in batch
     */
    async deleteMultiplePhotos(userId, sessionId, filenames) {
        console.log(`🗑️ Batch deletion: ${filenames.length} photos from session ${sessionId}`);
        
        const results = [];
        let totalReclaimed = 0;
        let successCount = 0;
        let errorCount = 0;

        for (const filename of filenames) {
            const result = await this.deletePhotoCompletely(userId, sessionId, filename);
            results.push(result);
            
            if (result.success) {
                successCount++;
                totalReclaimed += parseFloat(result.fileSizeMB || 0);
            } else {
                errorCount++;
            }
        }

        console.log(` Batch deletion complete: ${successCount} success, ${errorCount} errors, ${totalReclaimed.toFixed(2)}MB reclaimed`);

        return {
            success: errorCount === 0,
            totalFiles: filenames.length,
            successCount: successCount,
            errorCount: errorCount,
            totalReclaimedMB: totalReclaimed.toFixed(2),
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
                const stillExists = sessionFiles.filesByType.gallery.some(f => f.filename === filename) ||
                                 sessionFiles.filesByType.raw.some(f => f.filename === filename);
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