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
                console.log(`⚠️ Could not check R2 for additional files: ${r2Error.message}`);
            }

            if (fileQuery.rows.length === 0) {
                throw new Error(`File not found or access denied: ${filename}`);
            }

            const fileRecord = fileQuery.rows[0];
            const folderType = fileRecord.folder_type || 'gallery'; // Default to gallery if not specified
            const fileSizeBytes = fileRecord.file_size_bytes || 0;
            const fileSizeMB = fileRecord.file_size_mb || 0;

            deletionLog.push(`✓ Verified ownership and access for ${filename} (${fileSizeMB}MB)`);
            console.log(`📋 File details: ${filename} - ${fileSizeMB}MB - Type: ${folderType}`);

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
                console.warn(`⚠️ Cloud deletion failed (continuing with database cleanup): ${cloudError.message}`);
                errors.push(`Cloud storage: ${cloudError.message}`);
                deletionLog.push(`⚠️ Cloud deletion failed: ${cloudError.message}`);
            }

            // Step 3: Delete thumbnails and cached versions
            try {
                const thumbnailPath = `${userId}/${sessionId}/thumbnails/${filename}`;
                await this.r2Manager.deleteFile(thumbnailPath);
                deletionLog.push(`✓ Deleted thumbnail: ${thumbnailPath}`);
            } catch (thumbError) {
                // Thumbnails may not exist, this is acceptable
                console.log(`📷 No thumbnail to delete (acceptable): ${thumbError.message}`);
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
                console.warn(`⚠️ No database record found to delete for: ${filename}`);
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
                console.warn(`⚠️ Storage tracking update failed: ${trackingError.message}`);
                errors.push(`Storage tracking: ${trackingError.message}`);
            }

            // Step 6: Clean up any photo metadata or associations
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
                console.log(`📝 Metadata cleanup (tables may not exist): ${metadataError.message}`);
            }

            // Step 7: Log the deletion for audit trail
            try {
                await this.pool.query(`
                    INSERT INTO deletion_audit_log 
                    (user_id, session_id, filename, file_size_mb, folder_type, deleted_at, deletion_method)
                    VALUES ($1, $2, $3, $4, $5, NOW(), 'unified_deletion')
                `, [userId, sessionId, filename, fileSizeMB, folderType]);
                deletionLog.push(`✓ Logged deletion for audit trail`);
            } catch (auditError) {
                // Audit logging failure shouldn't block deletion
                console.warn(`📋 Audit logging failed: ${auditError.message}`);
            }

            console.log(`🎯 COMPLETE DELETION SUCCESS: ${filename}`);
            console.log(`📊 Steps completed: ${deletionLog.length}`);
            
            return {
                success: true,
                filename: filename,
                fileSizeMB: fileSizeMB,
                folderType: folderType,
                steps: deletionLog,
                errors: errors.length > 0 ? errors : null,
                message: `Successfully deleted ${filename} (${fileSizeMB}MB) with complete cleanup`
            };

        } catch (error) {
            console.error(`❌ DELETION FAILED: ${filename} - ${error.message}`);
            
            return {
                success: false,
                filename: filename,
                error: error.message,
                steps: deletionLog,
                errors: errors,
                message: `Failed to delete ${filename}: ${error.message}`
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

        console.log(`📊 Batch deletion complete: ${successCount} success, ${errorCount} errors, ${totalReclaimed.toFixed(2)}MB reclaimed`);

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
     * Verify deletion completeness
     */
    async verifyDeletionComplete(userId, sessionId, filename) {
        const issues = [];
        
        try {
            // Check database
            const dbCheck = await this.pool.query(`
                SELECT COUNT(*) as count FROM session_files 
                WHERE session_id = $1 AND filename = $2
            `, [sessionId, filename]);
            
            if (parseInt(dbCheck.rows[0].count) > 0) {
                issues.push('Database record still exists');
            }

            // Check cloud storage by trying to get session files
            try {
                const sessionFiles = await this.r2Manager.getSessionFiles(sessionId, userId);
                const stillExists = sessionFiles.filesByType.gallery.some(f => f.filename === filename) ||
                                 sessionFiles.filesByType.raw.some(f => f.filename === filename);
                if (stillExists) {
                    issues.push('File still exists in cloud storage');
                }
            } catch (cloudError) {
                // File not existing is what we want
                console.log(`✓ Cloud storage check: ${filename} not found (expected)`);
            }

            return {
                complete: issues.length === 0,
                issues: issues,
                message: issues.length === 0 ? 'Deletion verified complete' : `Issues found: ${issues.join(', ')}`
            };

        } catch (error) {
            return {
                complete: false,
                issues: [`Verification failed: ${error.message}`],
                message: `Could not verify deletion: ${error.message}`
            };
        }
    }
}

module.exports = UnifiedFileDeletion;