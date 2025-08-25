// Automated Backup & Disaster Recovery System for Photography Platform
const cron = require('node-cron');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class BackupSystem {
    constructor(pool, r2Manager) {
        this.pool = pool;
        this.r2Manager = r2Manager;
        this.backupBucket = 'photography-platform-backups';
        this.retentionDays = 30; // Keep backups for 30 days
        this.isInitialized = false;
    }

    // Initialize automated backup schedules
    async initialize() {
        try {
            await this.createBackupTables();
            this.scheduleBackups();
            this.isInitialized = true;
            console.log('✅ Backup system initialized with automated schedules');
        } catch (error) {
            console.error('❌ Failed to initialize backup system:', error);
        }
    }

    // Schedule automated backups
    scheduleBackups() {
        // Daily database backup at 2 AM
        cron.schedule('0 2 * * *', async () => {
            console.log('🔄 Starting scheduled database backup...');
            await this.createDatabaseBackup();
        });

        // Weekly full system backup on Sundays at 3 AM
        cron.schedule('0 3 * * 0', async () => {
            console.log('🔄 Starting scheduled full system backup...');
            await this.createFullSystemBackup();
        });

        // Daily cleanup of old backups at 4 AM
        cron.schedule('0 4 * * *', async () => {
            console.log('🔄 Starting backup cleanup...');
            await this.cleanupOldBackups();
        });

        // Backup verification every 6 hours
        cron.schedule('0 */6 * * *', async () => {
            console.log('🔄 Starting backup verification...');
            await this.verifyBackups();
        });

        console.log('📅 Backup schedules configured:');
        console.log('  - Database: Daily at 2:00 AM');
        console.log('  - Full System: Weekly on Sunday at 3:00 AM');
        console.log('  - Cleanup: Daily at 4:00 AM');
        console.log('  - Verification: Every 6 hours');
    }

    // Create database backup
    async createDatabaseBackup() {
        let backupId = `db-backup-${Date.now()}`;
        try {
            const timestamp = new Date().toISOString();
            
            console.log(`📦 Creating database backup: ${backupId}`);

            // Record backup start
            await this.pool.query(`
                INSERT INTO backup_logs (backup_id, backup_type, status, started_at)
                VALUES ($1, 'database', 'running', $2)
            `, [backupId, timestamp]);

            // Create database dump
            const dumpFile = `/tmp/${backupId}.sql`;
            const dbUrl = process.env.DATABASE_URL;
            
            if (!dbUrl) {
                throw new Error('DATABASE_URL not configured');
            }

            // Execute pg_dump with version compatibility
            // Use Drizzle's query method as fallback for version compatibility
            try {
                const dumpCommand = `pg_dump "${dbUrl}" > ${dumpFile}`;
                await execAsync(dumpCommand);
            } catch (pgDumpError) {
                console.warn('pg_dump failed due to version mismatch, using fallback method:', pgDumpError.message);
                // Fallback: Use Drizzle to export schema and data
                await this.createDatabaseBackupFallback(dumpFile, backupId);
            }

            // Compress the dump
            const compressedFile = `${dumpFile}.gz`;
            await execAsync(`gzip ${dumpFile}`);

            // Upload to R2 backup storage
            const backupKey = `database/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${backupId}.sql.gz`;
            await this.uploadBackupToR2(compressedFile, backupKey);

            // Calculate file size
            const { stdout: sizeOutput } = await execAsync(`stat -c%s ${compressedFile}`);
            const fileSize = parseInt(sizeOutput.trim());

            // Update backup record
            await this.pool.query(`
                UPDATE backup_logs 
                SET status = 'completed', completed_at = NOW(), 
                    backup_size = $1, backup_location = $2
                WHERE backup_id = $3
            `, [fileSize, backupKey, backupId]);

            // Clean up local file
            await execAsync(`rm -f ${compressedFile}`);

            console.log(`✅ Database backup completed: ${backupId} (${this.formatFileSize(fileSize)})`);

            return {
                success: true,
                backupId,
                size: fileSize,
                location: backupKey
            };

        } catch (error) {
            console.error('❌ Database backup failed:', error);
            
            // Update backup record with error
            try {
                await this.pool.query(`
                    UPDATE backup_logs 
                    SET status = 'failed', completed_at = NOW(), error_message = $1
                    WHERE backup_id = $2 AND status = 'running'
                `, [error.message, backupId]);
            } catch (updateError) {
                console.error('Failed to update backup log:', updateError);
            }

            throw error;
        }
    }

    // Create full system backup (database + critical files)
    async createFullSystemBackup() {
        try {
            const backupId = `full-backup-${Date.now()}`;
            console.log(`📦 Creating full system backup: ${backupId}`);

            // Record backup start
            await this.pool.query(`
                INSERT INTO backup_logs (backup_id, backup_type, status, started_at)
                VALUES ($1, 'full_system', 'running', NOW())
            `, [backupId]);

            // Create database backup first
            const dbBackup = await this.createDatabaseBackup();

            // Create system configuration backup
            const configBackup = await this.createConfigurationBackup(backupId);

            // Create user data summary backup
            const userDataBackup = await this.createUserDataSummary(backupId);

            // Calculate total backup size
            const totalSize = dbBackup.size + configBackup.size + userDataBackup.size;

            // Update backup record
            await this.pool.query(`
                UPDATE backup_logs 
                SET status = 'completed', completed_at = NOW(), backup_size = $1
                WHERE backup_id = $2
            `, [totalSize, backupId]);

            console.log(`✅ Full system backup completed: ${backupId} (${this.formatFileSize(totalSize)})`);

            return {
                success: true,
                backupId,
                totalSize,
                components: {
                    database: dbBackup,
                    configuration: configBackup,
                    userData: userDataBackup
                }
            };

        } catch (error) {
            console.error('❌ Full system backup failed:', error);
            throw error;
        }
    }

    // Create configuration backup
    async createConfigurationBackup(backupId) {
        try {
            const configData = {
                timestamp: new Date().toISOString(),
                backupId,
                environment: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    environment: process.env.NODE_ENV || 'development'
                },
                configuration: {
                    // Only include non-sensitive config
                    rateLimit: {
                        windowMs: 15 * 60 * 1000, // 15 minutes
                        max: 500 // requests per window
                    },
                    storageQuotas: {
                        professional: 100 * 1024 * 1024 * 1024, // 100GB
                        storageAddon: 1024 * 1024 * 1024 * 1024 // 1TB
                    },
                    pricing: {
                        professionalPlan: 39,
                        storageAddon: 25
                    }
                },
                features: {
                    websiteBuilder: true,
                    communityPlatform: true,
                    watermarking: true,
                    goldenHourCalculator: true,
                    bookingAgreements: true,
                    stripeConnect: true
                }
            };

            const configJson = JSON.stringify(configData, null, 2);
            const configFile = `/tmp/config-${backupId}.json`;
            
            await require('fs').promises.writeFile(configFile, configJson);

            // Compress and upload
            const compressedFile = `${configFile}.gz`;
            await execAsync(`gzip ${configFile}`);

            const backupKey = `configuration/${new Date().getFullYear()}/${backupId}-config.json.gz`;
            await this.uploadBackupToR2(compressedFile, backupKey);

            // Get file size
            const { stdout: sizeOutput } = await execAsync(`stat -c%s ${compressedFile}`);
            const fileSize = parseInt(sizeOutput.trim());

            // Clean up
            await execAsync(`rm -f ${compressedFile}`);

            console.log(`✅ Configuration backup completed (${this.formatFileSize(fileSize)})`);

            return {
                success: true,
                size: fileSize,
                location: backupKey
            };

        } catch (error) {
            console.error('❌ Configuration backup failed:', error);
            throw error;
        }
    }

    // Create user data summary backup
    async createUserDataSummary(backupId) {
        try {
            // Get aggregated user data (no sensitive info)
            const userSummary = await this.pool.query(`
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN us.plan_type = 'professional' THEN 1 END) as professional_users,
                    SUM(CASE WHEN us.plan_type = 'professional' THEN 39 ELSE 0 END) as monthly_revenue,
                    COUNT(DISTINCT s.id) as total_sessions,
                    COALESCE(SUM(ss.storage_used), 0) as total_storage_used,
                    COUNT(DISTINCT pw.id) as published_websites
                FROM users u
                LEFT JOIN user_subscriptions us ON u.uid = us.user_id AND us.status = 'active'
                LEFT JOIN sessions s ON u.uid = s.user_id
                LEFT JOIN storage_summary ss ON u.uid = ss.user_id
                LEFT JOIN published_websites pw ON u.uid = pw.user_id
            `);

            const platformStats = await this.pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM support_tickets WHERE status = 'open') as open_tickets,
                    (SELECT COUNT(*) FROM community_posts WHERE created_at > NOW() - INTERVAL '30 days') as recent_posts,
                    (SELECT AVG(file_size) FROM session_files) as avg_file_size,
                    (SELECT COUNT(*) FROM data_export_requests WHERE created_at > NOW() - INTERVAL '30 days') as recent_exports
            `);

            const summaryData = {
                timestamp: new Date().toISOString(),
                backupId,
                platform: userSummary.rows[0],
                statistics: platformStats.rows[0],
                backupInfo: {
                    retentionDays: this.retentionDays,
                    backupType: 'user_data_summary',
                    dataPrivacy: 'No personal information included'
                }
            };

            const summaryJson = JSON.stringify(summaryData, null, 2);
            const summaryFile = `/tmp/user-summary-${backupId}.json`;
            
            await require('fs').promises.writeFile(summaryFile, summaryJson);

            // Compress and upload
            const compressedFile = `${summaryFile}.gz`;
            await execAsync(`gzip ${summaryFile}`);

            const backupKey = `user-data/${new Date().getFullYear()}/${backupId}-summary.json.gz`;
            await this.uploadBackupToR2(compressedFile, backupKey);

            // Get file size
            const { stdout: sizeOutput } = await execAsync(`stat -c%s ${compressedFile}`);
            const fileSize = parseInt(sizeOutput.trim());

            // Clean up
            await execAsync(`rm -f ${compressedFile}`);

            console.log(`✅ User data summary backup completed (${this.formatFileSize(fileSize)})`);

            return {
                success: true,
                size: fileSize,
                location: backupKey
            };

        } catch (error) {
            console.error('❌ User data summary backup failed:', error);
            throw error;
        }
    }

    // Upload backup file to R2 storage
    async uploadBackupToR2(filePath, key) {
        try {
            const { PutObjectCommand } = require('@aws-sdk/client-s3');
            const fs = require('fs');
            
            const fileStream = fs.createReadStream(filePath);
            
            const uploadCommand = new PutObjectCommand({
                Bucket: this.backupBucket,
                Key: key,
                Body: fileStream,
                ContentType: 'application/gzip',
                Metadata: {
                    'backup-type': 'automated',
                    'created-at': new Date().toISOString(),
                    'retention-days': this.retentionDays.toString()
                }
            });

            await this.r2Manager.s3Client.send(uploadCommand);
            console.log(`📤 Backup uploaded to R2: ${key}`);

        } catch (error) {
            console.error('❌ Failed to upload backup to R2:', error);
            throw error;
        }
    }

    // Verify backup integrity
    async verifyBackups() {
        try {
            console.log('🔍 Verifying recent backups...');

            // Get recent backups
            const recentBackups = await this.pool.query(`
                SELECT * FROM backup_logs 
                WHERE created_at > NOW() - INTERVAL '7 days'
                AND status = 'completed'
                ORDER BY created_at DESC
            `);

            let verifiedCount = 0;
            let failedCount = 0;

            for (const backup of recentBackups.rows) {
                try {
                    // Check if backup exists in R2
                    const exists = await this.checkBackupExists(backup.backup_location);
                    
                    if (exists) {
                        await this.pool.query(`
                            UPDATE backup_logs 
                            SET verification_status = 'verified', last_verified = NOW()
                            WHERE backup_id = $1
                        `, [backup.backup_id]);
                        verifiedCount++;
                    } else {
                        await this.pool.query(`
                            UPDATE backup_logs 
                            SET verification_status = 'failed', last_verified = NOW()
                            WHERE backup_id = $1
                        `, [backup.backup_id]);
                        failedCount++;
                        console.warn(`❌ Backup verification failed: ${backup.backup_id}`);
                    }

                } catch (error) {
                    console.error(`❌ Error verifying backup ${backup.backup_id}:`, error);
                    failedCount++;
                }
            }

            console.log(`✅ Backup verification completed: ${verifiedCount} verified, ${failedCount} failed`);

            return {
                verified: verifiedCount,
                failed: failedCount,
                total: recentBackups.rows.length
            };

        } catch (error) {
            console.error('❌ Backup verification failed:', error);
            throw error;
        }
    }

    // Check if backup exists in R2
    async checkBackupExists(backupKey) {
        try {
            const { HeadObjectCommand } = require('@aws-sdk/client-s3');
            
            const headCommand = new HeadObjectCommand({
                Bucket: this.backupBucket,
                Key: backupKey
            });

            await this.r2Manager.s3Client.send(headCommand);
            return true;

        } catch (error) {
            if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
                return false;
            }
            throw error;
        }
    }

    // Clean up old backups
    async cleanupOldBackups() {
        try {
            console.log('🧹 Cleaning up old backups...');

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

            // Get old backups
            const oldBackups = await this.pool.query(`
                SELECT * FROM backup_logs 
                WHERE created_at < $1
                AND status = 'completed'
            `, [cutoffDate]);

            let deletedCount = 0;

            for (const backup of oldBackups.rows) {
                try {
                    // Delete from R2 if location exists
                    if (backup.backup_location) {
                        await this.deleteBackupFromR2(backup.backup_location);
                    }

                    // Mark as deleted in database
                    await this.pool.query(`
                        UPDATE backup_logs 
                        SET status = 'deleted', deleted_at = NOW()
                        WHERE backup_id = $1
                    `, [backup.backup_id]);

                    deletedCount++;

                } catch (error) {
                    console.error(`❌ Failed to delete backup ${backup.backup_id}:`, error);
                }
            }

            console.log(`✅ Cleanup completed: ${deletedCount} old backups removed`);

            return {
                deleted: deletedCount,
                cutoffDate: cutoffDate
            };

        } catch (error) {
            console.error('❌ Backup cleanup failed:', error);
            throw error;
        }
    }

    // Delete backup from R2
    async deleteBackupFromR2(backupKey) {
        try {
            const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
            
            const deleteCommand = new DeleteObjectCommand({
                Bucket: this.backupBucket,
                Key: backupKey
            });

            await this.r2Manager.s3Client.send(deleteCommand);
            console.log(`🗑️ Deleted backup from R2: ${backupKey}`);

        } catch (error) {
            console.error('❌ Failed to delete backup from R2:', error);
            throw error;
        }
    }

    // Manual backup creation
    async createManualBackup(backupType = 'manual', userId = null) {
        try {
            const backupId = `manual-${backupType}-${Date.now()}`;
            console.log(`📦 Creating manual backup: ${backupId}`);

            let backupResult;

            switch (backupType) {
                case 'database':
                    backupResult = await this.createDatabaseBackup();
                    break;
                case 'full_system':
                    backupResult = await this.createFullSystemBackup();
                    break;
                default:
                    throw new Error(`Unknown backup type: ${backupType}`);
            }

            // Record manual backup request
            if (userId) {
                await this.pool.query(`
                    UPDATE backup_logs 
                    SET requested_by = $1, manual_backup = true
                    WHERE backup_id = $2
                `, [userId, backupResult.backupId]);
            }

            return backupResult;

        } catch (error) {
            console.error('❌ Manual backup failed:', error);
            throw error;
        }
    }

    // Get backup status and history
    async getBackupStatus() {
        try {
            const summary = await this.pool.query(`
                SELECT 
                    COUNT(*) as total_backups,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_backups,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_backups,
                    MAX(completed_at) as last_backup,
                    SUM(backup_size) as total_backup_size
                FROM backup_logs
                WHERE created_at > NOW() - INTERVAL '30 days'
            `);

            const recent = await this.pool.query(`
                SELECT backup_id, backup_type, status, backup_size, 
                       created_at, completed_at, verification_status
                FROM backup_logs
                ORDER BY created_at DESC
                LIMIT 10
            `);

            return {
                summary: summary.rows[0],
                recentBackups: recent.rows,
                retentionDays: this.retentionDays,
                isAutomated: this.isInitialized
            };

        } catch (error) {
            console.error('❌ Failed to get backup status:', error);
            throw error;
        }
    }

    // Create backup tables
    async createBackupTables() {
        try {
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS backup_logs (
                    id SERIAL PRIMARY KEY,
                    backup_id VARCHAR(255) UNIQUE NOT NULL,
                    backup_type VARCHAR(50) NOT NULL,
                    status VARCHAR(50) DEFAULT 'pending',
                    backup_size BIGINT,
                    backup_location TEXT,
                    verification_status VARCHAR(50),
                    manual_backup BOOLEAN DEFAULT false,
                    requested_by VARCHAR(255),
                    error_message TEXT,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    last_verified TIMESTAMP,
                    deleted_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            console.log(' Backup system tables initialized');

        } catch (error) {
            console.error('Error initializing backup tables:', error);
            throw error;
        }
    }

    // Fallback database backup using Drizzle queries
    async createDatabaseBackupFallback(dumpFile, backupId) {
        try {
            console.log('🔄 Creating database backup using fallback method...');
            
            // Get all tables in the database
            const tablesResult = await this.pool.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            `);
            
            let sqlContent = `-- Database backup created at ${new Date().toISOString()}\n`;
            sqlContent += `-- Backup ID: ${backupId}\n\n`;
            
            // Export each table's data
            for (const table of tablesResult.rows) {
                const tableName = table.table_name;
                try {
                    const tableData = await this.pool.query(`SELECT * FROM ${tableName}`);
                    
                    if (tableData.rows.length > 0) {
                        sqlContent += `-- Data for table: ${tableName}\n`;
                        
                        // Get column names
                        const columns = Object.keys(tableData.rows[0]);
                        
                        for (const row of tableData.rows) {
                            const values = columns.map(col => {
                                const val = row[col];
                                if (val === null) return 'NULL';
                                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                                if (val instanceof Date) return `'${val.toISOString()}'`;
                                if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                                return val;
                            }).join(', ');
                            
                            sqlContent += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});\n`;
                        }
                        sqlContent += `\n`;
                    }
                } catch (tableError) {
                    console.warn(`Warning: Could not backup table ${tableName}:`, tableError.message);
                    sqlContent += `-- Warning: Could not backup table ${tableName}: ${tableError.message}\n\n`;
                }
            }
            
            // Write the SQL content to file
            await require('fs').promises.writeFile(dumpFile, sqlContent);
            console.log(`✅ Fallback database backup completed for ${tablesResult.rows.length} tables`);
            
        } catch (error) {
            console.error('❌ Fallback database backup failed:', error);
            throw error;
        }
    }

    // Utility functions
    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = BackupSystem;