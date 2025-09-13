// Data Export & GDPR Compliance System for Photography Platform
const archiver = require('archiver');
const fs = require('fs').promises;
const path = require('path');

class DataExportSystem {
    constructor(pool, r2Manager) {
        this.pool = pool;
        this.r2Manager = r2Manager;
        this.exportFormats = ['json', 'csv', 'zip'];
    }

    // Complete user data export (GDPR Article 20 - Data Portability)
    async exportUserData(userId, format = 'zip', includeFiles = true) {
        try {
            console.log(`📦 Starting data export for user ${userId} in ${format} format`);
            
            const userData = await this.collectUserData(userId);
            const exportId = `export-${userId}-${Date.now()}`;
            
            if (format === 'zip' && includeFiles) {
                return await this.createZipExport(userData, exportId, userId);
            } else if (format === 'json') {
                return await this.createJSONExport(userData, exportId);
            } else if (format === 'csv') {
                return await this.createCSVExport(userData, exportId);
            } else {
                throw new Error(`Unsupported export format: ${format}`);
            }

        } catch (error) {
            console.error(`❌ Data export failed for user ${userId}:`, error);
            throw error;
        }
    }

    // Collect all user data across platform
    async collectUserData(userId) {
        try {
            const userData = {
                profile: await this.getUserProfile(userId),
                sessions: await this.getUserSessions(userId),
                files: await this.getUserFiles(userId),
                subscriptions: await this.getUserSubscriptions(userId),
                support: await this.getUserSupportHistory(userId),
                activities: await this.getUserActivities(userId),
                billing: await this.getUserBillingHistory(userId),
                businessExpenses: await this.getUserBusinessExpenses(userId),
                sessionProfits: await this.getUserSessionProfits(userId),
                mileageTracking: await this.getUserMileageData(userId),
                websites: await this.getUserWebsites(userId),
                community: await this.getUserCommunityData(userId),
                exportMetadata: {
                    exportedAt: new Date().toISOString(),
                    exportedBy: userId,
                    dataRetentionPolicy: '7 years from account closure',
                    gdprCompliant: true
                }
            };

            console.log(`📊 Collected data for user ${userId}:`, {
                sessions: userData.sessions.length,
                files: userData.files.length,
                supportTickets: userData.support.length,
                businessExpenses: userData.businessExpenses.length,
                sessionProfits: userData.sessionProfits.length,
                mileageEntries: userData.mileageTracking.length,
                websites: userData.websites.length,
                communityPosts: userData.community.length
            });

            return userData;

        } catch (error) {
            console.error('Error collecting user data:', error);
            throw error;
        }
    }

    // Get user profile information
    async getUserProfile(userId) {
        try {
            const profile = await this.pool.query(`
                SELECT 
                    uid, email, display_name, phone_number, photo_url,
                    email_verified, created_at, last_sign_in, provider_data
                FROM users 
                WHERE uid = $1
            `, [userId]);

            return profile.rows[0] || {};

        } catch (error) {
            console.error('Error fetching user profile:', error);
            return {};
        }
    }

    // Get all user sessions with metadata
    async getUserSessions(userId) {
        try {
            const sessions = await this.pool.query(`
                SELECT 
                    s.*,
                    COUNT(sf.id) as file_count,
                    SUM(sf.file_size) as total_size
                FROM sessions s
                LEFT JOIN session_files sf ON s.id = sf.session_id
                WHERE s.user_id = $1
                GROUP BY s.id
                ORDER BY s.created_at DESC
            `, [userId]);

            return sessions.rows;

        } catch (error) {
            console.error('Error fetching user sessions:', error);
            return [];
        }
    }

    // Get all user files with download information
    async getUserFiles(userId) {
        try {
            const files = await this.pool.query(`
                SELECT 
                    sf.*,
                    s.session_name,
                    s.client_name
                FROM session_files sf
                JOIN sessions s ON sf.session_id = s.id
                WHERE s.user_id = $1
                ORDER BY sf.uploaded_at DESC
            `, [userId]);

            return files.rows;

        } catch (error) {
            console.error('Error fetching user files:', error);
            return [];
        }
    }

    // Get subscription history
    async getUserSubscriptions(userId) {
        try {
            const subscriptions = await this.pool.query(`
                SELECT * FROM user_subscriptions
                WHERE user_id = $1
                ORDER BY created_at DESC
            `, [userId]);

            return subscriptions.rows;

        } catch (error) {
            console.error('Error fetching user subscriptions:', error);
            return [];
        }
    }

    // Get support ticket history
    async getUserSupportHistory(userId) {
        try {
            const support = await this.pool.query(`
                SELECT 
                    ticket_id, subject, category, priority, description,
                    status, created_at, resolved_at
                FROM support_tickets
                WHERE photographer_email = (
                    SELECT email FROM users WHERE uid = $1
                )
                ORDER BY created_at DESC
            `, [userId]);

            return support.rows;

        } catch (error) {
            console.error('Error fetching support history:', error);
            return [];
        }
    }

    // Get user activity logs
    async getUserActivities(userId) {
        try {
            const activities = await this.pool.query(`
                SELECT 
                    activity_type, activity_data, created_at
                FROM user_activity_log
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 1000
            `, [userId]);

            return activities.rows;

        } catch (error) {
            console.error('Error fetching user activities:', error);
            return [];
        }
    }

    // Get billing history
    async getUserBillingHistory(userId) {
        try {
            const billing = await this.pool.query(`
                SELECT 
                    amount, currency, status, payment_method,
                    stripe_payment_intent_id, created_at
                FROM billing_history
                WHERE user_id = $1
                ORDER BY created_at DESC
            `, [userId]);

            return billing.rows;

        } catch (error) {
            console.error('Error fetching billing history:', error);
            return [];
        }
    }

    // Get published websites
    async getUserWebsites(userId) {
        try {
            const websites = await this.pool.query(`
                SELECT 
                    subdomain, website_data, theme, published_at, updated_at
                FROM published_websites
                WHERE user_id = $1
                ORDER BY published_at DESC
            `, [userId]);

            return websites.rows;

        } catch (error) {
            console.error('Error fetching user websites:', error);
            return [];
        }
    }

    // Get community data (posts, comments, etc.)
    async getUserCommunityData(userId) {
        try {
            const community = await this.pool.query(`
                SELECT 
                    'post' as type, content, image_url, created_at
                FROM community_posts
                WHERE user_id = $1
                UNION ALL
                SELECT 
                    'comment' as type, content, NULL as image_url, created_at
                FROM community_comments
                WHERE user_id = $1
                ORDER BY created_at DESC
            `, [userId]);

            return community.rows;

        } catch (error) {
            console.error('Error fetching community data:', error);
            return [];
        }
    }

    // Get business expenses for tax and accounting purposes
    async getUserBusinessExpenses(userId) {
        try {
            const expenses = await this.pool.query(`
                SELECT 
                    id, date, category, description, amount, 
                    recurring, receipt_url, tax_deductible, 
                    created_at, updated_at
                FROM business_expenses
                WHERE user_id = $1
                ORDER BY date DESC
            `, [userId]);

            return expenses.rows;

        } catch (error) {
            console.error('Error fetching business expenses:', error);
            return [];
        }
    }

    // Get session profit data for business reporting
    async getUserSessionProfits(userId) {
        try {
            const sessionProfits = await this.pool.query(`
                SELECT 
                    ps.id, ps.session_name, ps.client_name, ps.date,
                    ps.session_fee, ps.deposit_amount, ps.balance_due,
                    ps.photographer_profit, ps.expenses, ps.net_profit,
                    ps.package_price, ps.additional_services_fee,
                    ps.created_at, ps.updated_at
                FROM photography_sessions ps
                WHERE ps.user_id = $1
                AND ps.photographer_profit IS NOT NULL
                ORDER BY ps.date DESC
            `, [userId]);

            return sessionProfits.rows;

        } catch (error) {
            console.error('Error fetching session profits:', error);
            return [];
        }
    }

    // Get mileage tracking data for business tax deductions
    async getUserMileageData(userId) {
        try {
            const mileage = await this.pool.query(`
                SELECT 
                    ps.id, ps.session_name, ps.client_name, ps.date,
                    ps.location, ps.miles_to_location, ps.mileage_cost,
                    ps.travel_time, ps.parking_fees, ps.tolls,
                    ps.created_at
                FROM photography_sessions ps
                WHERE ps.user_id = $1
                AND ps.miles_to_location IS NOT NULL
                ORDER BY ps.date DESC
            `, [userId]);

            return mileage.rows;

        } catch (error) {
            console.error('Error fetching mileage data:', error);
            return [];
        }
    }

    // Create ZIP export with all files
    async createZipExport(userData, exportId, userId) {
        try {
            const tempDir = `/tmp/${exportId}`;
            await fs.mkdir(tempDir, { recursive: true });

            // Create data JSON file
            const dataFile = path.join(tempDir, 'user-data.json');
            await fs.writeFile(dataFile, JSON.stringify(userData, null, 2));

            // Create CSV summaries
            await this.createCSVFiles(userData, tempDir);

            // Download actual files from R2 if requested
            const filesDir = path.join(tempDir, 'files');
            await fs.mkdir(filesDir, { recursive: true });
            
            await this.downloadUserFiles(userData.files, filesDir, userId);

            // Create ZIP archive
            const zipPath = `/tmp/${exportId}.zip`;
            await this.createZipArchive(tempDir, zipPath);

            // Clean up temp directory
            await fs.rmdir(tempDir, { recursive: true });

            return {
                success: true,
                exportId,
                filePath: zipPath,
                format: 'zip',
                size: (await fs.stat(zipPath)).size,
                downloadUrl: `/api/export/download/${exportId}`
            };

        } catch (error) {
            console.error('Error creating ZIP export:', error);
            throw error;
        }
    }

    // Download user files from R2 storage
    async downloadUserFiles(files, filesDir, userId) {
        try {
            let downloadCount = 0;
            const maxFiles = 100; // Limit for large exports

            for (const file of files.slice(0, maxFiles)) {
                try {
                    if (file.r2_key) {
                        const fileData = await this.r2Manager.downloadFileBuffer(file.r2_key);
                        if (fileData) {
                            const filePath = path.join(filesDir, `${file.session_name}-${file.filename}`);
                            await fs.writeFile(filePath, fileData);
                            downloadCount++;
                        }
                    }
                } catch (fileError) {
                    console.warn(`Failed to download file ${file.filename}:`, fileError.message);
                }
            }

            console.log(`📁 Downloaded ${downloadCount} files for user ${userId}`);

        } catch (error) {
            console.error('Error downloading user files:', error);
        }
    }

    // Create CSV files for structured data
    async createCSVFiles(userData, tempDir) {
        try {
            // Sessions CSV
            if (userData.sessions.length > 0) {
                const sessionsCsv = this.convertToCSV(userData.sessions);
                await fs.writeFile(path.join(tempDir, 'sessions.csv'), sessionsCsv);
            }

            // Files CSV
            if (userData.files.length > 0) {
                const filesCsv = this.convertToCSV(userData.files);
                await fs.writeFile(path.join(tempDir, 'files.csv'), filesCsv);
            }

            // Support tickets CSV
            if (userData.support.length > 0) {
                const supportCsv = this.convertToCSV(userData.support);
                await fs.writeFile(path.join(tempDir, 'support-tickets.csv'), supportCsv);
            }

            // Business expenses CSV
            if (userData.businessExpenses && userData.businessExpenses.length > 0) {
                const expensesCsv = this.convertToCSV(userData.businessExpenses);
                await fs.writeFile(path.join(tempDir, 'business-expenses.csv'), expensesCsv);
            }

            // Session profits CSV
            if (userData.sessionProfits && userData.sessionProfits.length > 0) {
                const profitsCsv = this.convertToCSV(userData.sessionProfits);
                await fs.writeFile(path.join(tempDir, 'session-profits.csv'), profitsCsv);
            }

            // Mileage tracking CSV
            if (userData.mileageTracking && userData.mileageTracking.length > 0) {
                const mileageCsv = this.convertToCSV(userData.mileageTracking);
                await fs.writeFile(path.join(tempDir, 'mileage-tracking.csv'), mileageCsv);
            }

        } catch (error) {
            console.error('Error creating CSV files:', error);
        }
    }

    // Create ZIP archive
    async createZipArchive(sourceDir, outputPath) {
        return new Promise((resolve, reject) => {
            const output = require('fs').createWriteStream(outputPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => resolve());
            archive.on('error', reject);

            archive.pipe(output);
            archive.directory(sourceDir, false);
            archive.finalize();
        });
    }

    // Create JSON export
    async createJSONExport(userData, exportId) {
        try {
            const jsonPath = `/tmp/${exportId}.json`;
            await fs.writeFile(jsonPath, JSON.stringify(userData, null, 2));

            return {
                success: true,
                exportId,
                filePath: jsonPath,
                format: 'json',
                size: (await fs.stat(jsonPath)).size,
                downloadUrl: `/api/export/download/${exportId}`
            };

        } catch (error) {
            console.error('Error creating JSON export:', error);
            throw error;
        }
    }

    // Create CSV export
    async createCSVExport(userData, exportId) {
        try {
            const csvPath = `/tmp/${exportId}.csv`;
            
            // Flatten user data for CSV
            const flatData = this.flattenUserData(userData);
            const csvContent = this.convertToCSV(flatData);
            
            await fs.writeFile(csvPath, csvContent);

            return {
                success: true,
                exportId,
                filePath: csvPath,
                format: 'csv',
                size: (await fs.stat(csvPath)).size,
                downloadUrl: `/api/export/download/${exportId}`
            };

        } catch (error) {
            console.error('Error creating CSV export:', error);
            throw error;
        }
    }

    // Convert data to CSV format with security and data integrity fixes
    convertToCSV(data) {
        if (!data || data.length === 0) return '';

        // Build consistent headers from union of all row keys (fixes column stability)
        const allHeaders = new Set();
        data.forEach(row => {
            if (row && typeof row === 'object') {
                Object.keys(row).forEach(key => allHeaders.add(key));
            }
        });
        const headers = Array.from(allHeaders).sort();

        // Create header row with proper CSV formatting
        const csvRows = [headers.map(header => this.escapeCsvValue(header)).join(',')];

        // Process each data row
        for (const row of data) {
            const values = headers.map(header => {
                const rawValue = row ? row[header] : null;
                return this.escapeCsvValue(rawValue);
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    }

    // Escape and sanitize CSV values for security and data integrity
    escapeCsvValue(value) {
        // Handle null/undefined values
        if (value === null || value === undefined) {
            return '';
        }

        // Handle booleans
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }

        // Handle numbers (including zero)
        if (typeof value === 'number') {
            return isNaN(value) ? '' : value.toString();
        }

        // Handle dates
        if (value instanceof Date) {
            return `"${value.toISOString()}"`;
        }

        // Handle objects and arrays by serializing to JSON
        if (typeof value === 'object') {
            try {
                const jsonString = JSON.stringify(value);
                return this.sanitizeAndQuoteCsvValue(jsonString);
            } catch (error) {
                // Fallback for non-serializable objects
                return this.sanitizeAndQuoteCsvValue('[Complex Object]');
            }
        }

        // Handle strings and convert other types to string
        const stringValue = String(value);
        return this.sanitizeAndQuoteCsvValue(stringValue);
    }

    // Sanitize and quote CSV values to prevent injection attacks
    sanitizeAndQuoteCsvValue(str) {
        if (!str || typeof str !== 'string') {
            return '""';
        }

        // CSV Injection protection: Prefix dangerous characters that could trigger formula execution
        const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
        let sanitizedValue = str;
        
        if (dangerousChars.some(char => str.startsWith(char))) {
            // Prefix with apostrophe to prevent formula execution in Excel/Sheets
            sanitizedValue = "'" + str;
        }

        // Handle special CSV characters that require quoting
        const needsQuoting = sanitizedValue.includes(',') || 
                           sanitizedValue.includes('"') || 
                           sanitizedValue.includes('\n') || 
                           sanitizedValue.includes('\r');

        if (needsQuoting || sanitizedValue !== str) {
            // Escape existing double quotes by doubling them
            const escapedValue = sanitizedValue.replace(/"/g, '""');
            return `"${escapedValue}"`;
        }

        // For simple values that don't need special handling, still quote for consistency
        return `"${sanitizedValue}"`;
    }

    // Flatten nested user data for CSV export
    flattenUserData(userData) {
        const flattened = [];
        
        // Add profile data
        if (userData.profile) {
            flattened.push({
                type: 'profile',
                ...userData.profile
            });
        }

        // Add session summaries
        userData.sessions.forEach(session => {
            flattened.push({
                type: 'session',
                ...session
            });
        });

        // Add business expenses
        userData.businessExpenses.forEach(expense => {
            flattened.push({
                type: 'business_expense',
                ...expense
            });
        });

        // Add session profits
        userData.sessionProfits.forEach(profit => {
            flattened.push({
                type: 'session_profit',
                ...profit
            });
        });

        // Add mileage tracking
        userData.mileageTracking.forEach(mileage => {
            flattened.push({
                type: 'mileage',
                ...mileage
            });
        });

        // Add billing history
        userData.billing.forEach(billing => {
            flattened.push({
                type: 'billing',
                ...billing
            });
        });

        return flattened;
    }

    // GDPR Right to be forgotten (Article 17)
    async deleteUserData(userId, verificationCode) {
        try {
            console.log(`🗑️ Starting GDPR data deletion for user ${userId}`);
            
            // Verify deletion request
            const isVerified = await this.verifyDeletionRequest(userId, verificationCode);
            if (!isVerified) {
                throw new Error('Deletion verification failed');
            }

            const deletionLog = [];

            // 1. Delete user files from R2 storage
            const files = await this.getUserFiles(userId);
            for (const file of files) {
                if (file.r2_key) {
                    await this.r2Manager.deleteFileByKey(file.r2_key);
                    deletionLog.push(`Deleted file: ${file.filename}`);
                }
            }

            // 2. Delete database records
            const tables = [
                'session_files',
                'sessions',
                'user_subscriptions', 
                'support_tickets',
                'user_activity_log',
                'storage_summary',
                'published_websites',
                'community_posts',
                'community_comments',
                'billing_history',
                'users'
            ];

            for (const table of tables) {
                try {
                    const result = await this.deleteDatabaseRecords(table, userId);
                    deletionLog.push(`Deleted ${result.rowCount} records from ${table}`);
                } catch (error) {
                    deletionLog.push(`Failed to delete from ${table}: ${error.message}`);
                }
            }

            // 3. Log deletion for compliance
            await this.logGDPRDeletion(userId, deletionLog);

            console.log(`✅ GDPR deletion completed for user ${userId}`);
            return {
                success: true,
                deletedItems: deletionLog.length,
                deletionLog
            };

        } catch (error) {
            console.error(`❌ GDPR deletion failed for user ${userId}:`, error);
            throw error;
        }
    }

    // Delete records from specific table
    async deleteDatabaseRecords(table, userId) {
        const userIdColumns = {
            'users': 'uid',
            'sessions': 'user_id', 
            'session_files': 'session_id IN (SELECT id FROM sessions WHERE user_id = $1)',
            'user_subscriptions': 'user_id',
            'support_tickets': 'photographer_email IN (SELECT email FROM users WHERE uid = $1)',
            'user_activity_log': 'user_id',
            'storage_summary': 'user_id',
            'published_websites': 'user_id',
            'community_posts': 'user_id',
            'community_comments': 'user_id',
            'billing_history': 'user_id'
        };

        const whereClause = userIdColumns[table];
        if (!whereClause) {
            throw new Error(`Unknown table for deletion: ${table}`);
        }

        if (whereClause.includes('IN (')) {
            return await this.pool.query(`DELETE FROM ${table} WHERE ${whereClause}`, [userId]);
        } else {
            return await this.pool.query(`DELETE FROM ${table} WHERE ${whereClause} = $1`, [userId]);
        }
    }

    // Verify deletion request with email confirmation
    async verifyDeletionRequest(userId, verificationCode) {
        try {
            const verification = await this.pool.query(`
                SELECT * FROM gdpr_deletion_requests
                WHERE user_id = $1 AND verification_code = $2
                AND created_at > NOW() - INTERVAL '24 hours'
                AND verified = false
            `, [userId, verificationCode]);

            if (verification.rows.length === 0) {
                return false;
            }

            // Mark as verified
            await this.pool.query(`
                UPDATE gdpr_deletion_requests
                SET verified = true, verified_at = NOW()
                WHERE user_id = $1 AND verification_code = $2
            `, [userId, verificationCode]);

            return true;

        } catch (error) {
            console.error('Error verifying deletion request:', error);
            return false;
        }
    }

    // Log GDPR deletion for compliance auditing
    async logGDPRDeletion(userId, deletionLog) {
        try {
            await this.pool.query(`
                INSERT INTO gdpr_deletion_log 
                (user_id, deletion_completed_at, deletion_details, compliance_status)
                VALUES ($1, NOW(), $2, 'completed')
            `, [userId, JSON.stringify(deletionLog)]);

        } catch (error) {
            console.error('Error logging GDPR deletion:', error);
        }
    }

    // Initialize data export tables
    async initializeTables() {
        try {
            // GDPR deletion requests table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS gdpr_deletion_requests (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    verification_code VARCHAR(100) NOT NULL,
                    verified BOOLEAN DEFAULT false,
                    verified_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // GDPR deletion log for compliance
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS gdpr_deletion_log (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    deletion_completed_at TIMESTAMP NOT NULL,
                    deletion_details JSONB,
                    compliance_status VARCHAR(50) DEFAULT 'completed',
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Data export requests tracking
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS data_export_requests (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    export_id VARCHAR(100) NOT NULL,
                    format VARCHAR(20) NOT NULL,
                    status VARCHAR(50) DEFAULT 'processing',
                    file_path TEXT,
                    file_size BIGINT,
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            console.log(' Data export system tables initialized');

        } catch (error) {
            console.error('Error initializing data export tables:', error);
        }
    }
}

module.exports = DataExportSystem;