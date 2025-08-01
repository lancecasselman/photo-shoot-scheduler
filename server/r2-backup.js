// Cloudflare R2 RAW Backup Service
// $20/TB pricing model for photographer RAW file archiving

const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');

class R2BackupService {
    constructor() {
        // Configure R2 with S3-compatible API using your credentials
        this.s3 = new AWS.S3({
            endpoint: `https://7c6cbcff658042c3a36b2aceead25b6f.r2.cloudflarestorage.com`,
            accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
            region: 'auto', // R2 uses 'auto' for region
            signatureVersion: 'v4',
        });
        
        this.bucketName = 'photography-raw-backups';
        this.pricePerTB = 20; // $20/TB/month
    }

    /**
     * Upload RAW files to R2 for a specific session
     */
    async backupSessionRAW(photographerId, sessionId, rawFiles) {
        try {
            const uploadPromises = rawFiles.map(file => 
                this.uploadRAWFile(photographerId, sessionId, file)
            );
            
            const results = await Promise.all(uploadPromises);
            
            // Update backup tracking in database
            await this.updateBackupMetadata(photographerId, sessionId, results);
            
            console.log(`✅ RAW backup completed for session ${sessionId}: ${rawFiles.length} files`);
            return results;
            
        } catch (error) {
            console.error('❌ RAW backup failed:', error);
            throw error;
        }
    }

    /**
     * Upload file from upload processing (new integration method)
     */
    async uploadFile({ filePath, fileName, userId, sessionId, backupId }) {
        try {
            console.log(`💾 R2 Backup: Starting upload of ${fileName} to R2...`);
            
            const objectKey = `${userId}/${sessionId}/${fileName}`;
            const fileStream = fs.createReadStream(filePath);
            const fileStats = await fs.stat(filePath);
            
            const uploadParams = {
                Bucket: this.bucketName,
                Key: objectKey,
                Body: fileStream,
                ContentLength: fileStats.size,
                Metadata: {
                    'original-name': fileName,
                    'user-id': userId,
                    'session-id': sessionId,
                    'backup-id': backupId.toString(),
                    'upload-date': new Date().toISOString()
                }
            };
            
            const result = await this.s3.upload(uploadParams).promise();
            console.log(`✅ R2 Backup: Successfully uploaded ${fileName} (${(fileStats.size / 1024 / 1024).toFixed(1)}MB) to R2`);
            
            // Update backup record
            if (backupId) {
                await this.updateBackupStatus(backupId, 'completed', result.Location);
            }
            
            // Update storage billing
            await this.updateStorageBilling(userId, fileStats.size);
            
            return {
                success: true,
                location: result.Location,
                objectKey: objectKey,
                size: fileStats.size
            };
            
        } catch (error) {
            console.error(`❌ R2 Backup: Upload failed for ${fileName}:`, error);
            
            if (backupId) {
                await this.updateBackupStatus(backupId, 'failed', null, error.message);
            }
            
            throw error;
        }
    }

    /**
     * Upload individual RAW file to organized R2 structure (legacy method)
     */
    async uploadRAWFile(photographerId, sessionId, file) {
        const fileName = path.basename(file.originalname);
        const r2Key = `photographer-${photographerId}/session-${sessionId}/raw/${fileName}`;
        
        try {
            const fileBuffer = await fs.readFile(file.path);
            
            const uploadParams = {
                Bucket: this.bucketName,
                Key: r2Key,
                Body: fileBuffer,
                ContentType: file.mimetype || 'application/octet-stream',
                Metadata: {
                    'photographer-id': photographerId.toString(),
                    'session-id': sessionId.toString(),
                    'upload-date': new Date().toISOString(),
                    'file-size': file.size.toString()
                }
            };

            const result = await this.s3.upload(uploadParams).promise();
            
            return {
                success: true,
                fileName: fileName,
                r2Key: r2Key,
                size: file.size,
                etag: result.ETag,
                location: result.Location
            };
            
        } catch (error) {
            console.error(`❌ Failed to upload ${fileName}:`, error);
            return {
                success: false,
                fileName: fileName,
                error: error.message
            };
        }
    }

    /**
     * Retrieve RAW files for emergency recovery
     */
    async retrieveSessionRAW(photographerId, sessionId) {
        const prefix = `photographer-${photographerId}/session-${sessionId}/raw/`;
        
        try {
            const listParams = {
                Bucket: this.bucketName,
                Prefix: prefix
            };

            const objects = await this.s3.listObjectsV2(listParams).promise();
            
            return objects.Contents.map(obj => ({
                fileName: path.basename(obj.Key),
                size: obj.Size,
                lastModified: obj.LastModified,
                downloadUrl: this.generatePresignedUrl(obj.Key)
            }));
            
        } catch (error) {
            console.error('❌ Failed to retrieve RAW files:', error);
            throw error;
        }
    }

    /**
     * Generate presigned URL for secure RAW file download
     */
    generatePresignedUrl(r2Key, expirationSeconds = 3600) {
        const params = {
            Bucket: this.bucketName,
            Key: r2Key,
            Expires: expirationSeconds
        };
        
        return this.s3.getSignedUrl('getObject', params);
    }

    /**
     * Calculate storage usage and billing for photographer
     */
    async calculateStorageBilling(photographerId) {
        const prefix = `photographer-${photographerId}/`;
        
        try {
            let totalBytes = 0;
            let continuationToken = null;
            
            do {
                const listParams = {
                    Bucket: this.bucketName,
                    Prefix: prefix,
                    ContinuationToken: continuationToken
                };

                const result = await this.s3.listObjectsV2(listParams).promise();
                
                totalBytes += result.Contents.reduce((sum, obj) => sum + obj.Size, 0);
                continuationToken = result.NextContinuationToken;
                
            } while (continuationToken);
            
            const totalTB = totalBytes / (1024 * 1024 * 1024 * 1024); // Convert to TB
            const monthlyCharge = totalTB * this.pricePerTB;
            
            return {
                totalBytes: totalBytes,
                totalTB: parseFloat(totalTB.toFixed(3)),
                monthlyCharge: parseFloat(monthlyCharge.toFixed(2)),
                pricePerTB: this.pricePerTB
            };
            
        } catch (error) {
            console.error('❌ Failed to calculate storage billing:', error);
            throw error;
        }
    }

    /**
     * Delete session RAW files (for GDPR compliance or photographer request)
     */
    async deleteSessionRAW(photographerId, sessionId) {
        const prefix = `photographer-${photographerId}/session-${sessionId}/raw/`;
        
        try {
            const listParams = {
                Bucket: this.bucketName,
                Prefix: prefix
            };

            const objects = await this.s3.listObjectsV2(listParams).promise();
            
            if (objects.Contents.length === 0) {
                return { deleted: 0, message: 'No RAW files found for this session' };
            }

            const deleteParams = {
                Bucket: this.bucketName,
                Delete: {
                    Objects: objects.Contents.map(obj => ({ Key: obj.Key }))
                }
            };

            const result = await this.s3.deleteObjects(deleteParams).promise();
            
            return {
                deleted: result.Deleted.length,
                errors: result.Errors || []
            };
            
        } catch (error) {
            console.error('❌ Failed to delete RAW files:', error);
            throw error;
        }
    }

    /**
     * Update backup metadata in PostgreSQL
     */
    async updateBackupMetadata(photographerId, sessionId, uploadResults) {
        // This will integrate with your existing PostgreSQL database
        // Track backup status, file counts, total size, etc.
        const successfulUploads = uploadResults.filter(result => result.success);
        const totalSize = successfulUploads.reduce((sum, result) => sum + result.size, 0);
        
        console.log(`📊 Backup metadata: ${successfulUploads.length} files, ${totalSize} bytes`);
        
        // TODO: Add to your existing database schema
        // INSERT INTO raw_backups (photographer_id, session_id, file_count, total_size, backup_date)
    }

    /**
     * Update backup status in database
     */
    async updateBackupStatus(backupId, status, location = null, error = null) {
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        
        try {
            const updateFields = ['backup_status = $2'];
            const values = [backupId, status];
            let paramIndex = 3;
            
            if (status === 'completed') {
                updateFields.push(`backup_completed_at = $${paramIndex++}`);
                values.push(new Date());
                
                if (location) {
                    updateFields.push(`r2_object_key = $${paramIndex++}`);
                    values.push(location);
                }
            }
            
            if (error) {
                updateFields.push(`backup_error = $${paramIndex++}`);
                values.push(error);
            }
            
            const query = `
                UPDATE raw_backups 
                SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `;
            
            await pool.query(query, values);
            console.log(`📝 Updated backup ${backupId} status to ${status}`);
            
        } catch (dbError) {
            console.error('❌ Failed to update backup status:', dbError);
        }
    }

    /**
     * Update storage billing for user
     */
    async updateStorageBilling(userId, additionalBytes) {
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        
        try {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const additionalTB = additionalBytes / (1024 ** 4);
            const additionalCost = additionalTB * this.pricePerTB;
            
            await pool.query(`
                INSERT INTO raw_storage_billing (
                    user_id, billing_month, total_storage_bytes, 
                    total_storage_tb, monthly_cost_usd
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (user_id, billing_month)
                DO UPDATE SET 
                    total_storage_bytes = raw_storage_billing.total_storage_bytes + $3,
                    total_storage_tb = raw_storage_billing.total_storage_tb + $4,
                    monthly_cost_usd = raw_storage_billing.monthly_cost_usd + $5,
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, currentMonth, additionalBytes, additionalTB, additionalCost]);
            
            console.log(`💰 Updated billing for ${userId}: +${(additionalBytes / 1024 / 1024).toFixed(1)}MB (+$${additionalCost.toFixed(2)})`);
            
        } catch (dbError) {
            console.error('❌ Failed to update storage billing:', dbError);
        }
    }
}

module.exports = R2BackupService;