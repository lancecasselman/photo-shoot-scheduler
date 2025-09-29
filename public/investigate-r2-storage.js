/**
 * R2 Storage Investigation Script
 * Analyze R2 bucket contents vs database records to identify storage discrepancy
 */

const { Pool } = require('pg');
const R2FileManager = require('../server/r2-file-manager');

class R2StorageInvestigator {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        this.r2Manager = new R2FileManager(null, this.pool);
    }

    /**
     * Get all database records for comparison
     */
    async getDatabaseFiles() {
        console.log('\n📊 STEP 1: Analyzing Database Records...');
        
        const query = `
            SELECT 
                user_id,
                session_id,
                filename,
                r2_key,
                file_size_bytes,
                file_size_mb,
                folder_type,
                uploaded_at,
                CASE 
                    WHEN r2_key IS NULL THEN 'NO_R2_KEY'
                    WHEN r2_key LIKE 'photographer-%/session-%/%' THEN 'HUMAN_READABLE' 
                    ELSE 'UUID_STYLE'
                END as key_pattern
            FROM session_files 
            ORDER BY uploaded_at DESC
        `;
        
        const result = await this.pool.query(query);
        const files = result.rows;
        
        const summary = {
            totalFiles: files.length,
            totalSizeBytes: files.reduce((sum, f) => sum + parseInt(f.file_size_bytes || 0), 0),
            totalSizeMB: files.reduce((sum, f) => sum + parseFloat(f.file_size_mb || 0), 0),
            totalSizeGB: files.reduce((sum, f) => sum + parseFloat(f.file_size_mb || 0), 0) / 1024,
            keyPatterns: {},
            userSessions: new Set(),
            missingR2Keys: 0
        };
        
        files.forEach(file => {
            const pattern = file.key_pattern;
            summary.keyPatterns[pattern] = (summary.keyPatterns[pattern] || 0) + 1;
            summary.userSessions.add(`${file.user_id}:${file.session_id}`);
            if (!file.r2_key) summary.missingR2Keys++;
        });
        
        console.log('✅ Database Analysis Complete:');
        console.log(`   📁 Total Files: ${summary.totalFiles}`);
        console.log(`   💾 Total Size: ${summary.totalSizeGB.toFixed(2)} GB (${summary.totalSizeMB.toFixed(2)} MB)`);
        console.log(`   🔑 Key Patterns:`, summary.keyPatterns);
        console.log(`   👤 Unique Sessions: ${summary.userSessions.size}`);
        console.log(`   ❌ Missing R2 Keys: ${summary.missingR2Keys}`);
        
        return { files, summary };
    }

    /**
     * List all objects in R2 bucket and analyze storage patterns
     */
    async getR2BucketContents() {
        console.log('\n☁️ STEP 2: Analyzing R2 Bucket Contents...');
        
        if (!this.r2Manager.r2Available) {
            throw new Error('R2 is not available - cannot list bucket contents');
        }
        
        // Get all objects in bucket (no prefix = everything)
        const allObjects = await this.r2Manager.listObjects('');
        
        console.log(`📦 Found ${allObjects.length} objects in R2 bucket`);
        
        // Analyze file patterns and calculate totals
        const analysis = {
            totalObjects: allObjects.length,
            totalSizeBytes: 0,
            totalSizeMB: 0,
            totalSizeGB: 0,
            pathPatterns: {
                humanReadable: [],
                uuidStyle: [],
                thumbnails: [],
                backupIndexes: [],
                other: []
            },
            userSessionCounts: {},
            fileTypeCounts: {}
        };
        
        allObjects.forEach(obj => {
            analysis.totalSizeBytes += obj.Size || 0;
            
            const key = obj.Key;
            
            // Classify path patterns
            if (key.includes('/thumbnails/') || key.includes('_sm.') || key.includes('_md.') || key.includes('_lg.')) {
                analysis.pathPatterns.thumbnails.push(key);
            } else if (key.includes('backup-index.json')) {
                analysis.pathPatterns.backupIndexes.push(key);
            } else if (key.startsWith('photographer-') && key.includes('/session-')) {
                analysis.pathPatterns.humanReadable.push(key);
                
                // Extract user session info
                const match = key.match(/photographer-([^\/]+)\/session-([^\/]+)/);
                if (match) {
                    const sessionKey = `${match[1]}:${match[2]}`;
                    analysis.userSessionCounts[sessionKey] = (analysis.userSessionCounts[sessionKey] || 0) + 1;
                }
            } else if (key.includes('/') && key.length > 30) {
                analysis.pathPatterns.uuidStyle.push(key);
            } else {
                analysis.pathPatterns.other.push(key);
            }
            
            // File type analysis
            const ext = key.substring(key.lastIndexOf('.') + 1).toLowerCase();
            analysis.fileTypeCounts[ext] = (analysis.fileTypeCounts[ext] || 0) + 1;
        });
        
        analysis.totalSizeMB = analysis.totalSizeBytes / (1024 * 1024);
        analysis.totalSizeGB = analysis.totalSizeMB / 1024;
        
        console.log('✅ R2 Bucket Analysis Complete:');
        console.log(`   📁 Total Objects: ${analysis.totalObjects}`);
        console.log(`   💾 Total Size: ${analysis.totalSizeGB.toFixed(2)} GB (${analysis.totalSizeMB.toFixed(2)} MB)`);
        console.log(`   🗂️ Human Readable: ${analysis.pathPatterns.humanReadable.length} files`);
        console.log(`   🔗 UUID Style: ${analysis.pathPatterns.uuidStyle.length} files`);
        console.log(`   🖼️ Thumbnails: ${analysis.pathPatterns.thumbnails.length} files`);
        console.log(`   📋 Backup Indexes: ${analysis.pathPatterns.backupIndexes.length} files`);
        console.log(`   ❓ Other: ${analysis.pathPatterns.other.length} files`);
        console.log(`   📊 File Types:`, analysis.fileTypeCounts);
        
        return { objects: allObjects, analysis };
    }

    /**
     * Compare database records with R2 bucket contents to find discrepancies
     */
    async compareDbWithR2(dbData, r2Data) {
        console.log('\n🔍 STEP 3: Comparing Database vs R2 Bucket...');
        
        const dbFiles = dbData.files;
        const r2Objects = r2Data.objects;
        
        // Create lookup maps
        const dbKeyMap = new Map();
        const dbFilenameMap = new Map();
        
        dbFiles.forEach(file => {
            if (file.r2_key) {
                dbKeyMap.set(file.r2_key, file);
            }
            const lookupKey = `${file.user_id}:${file.session_id}:${file.filename}`;
            dbFilenameMap.set(lookupKey, file);
        });
        
        const r2KeyMap = new Map();
        r2Objects.forEach(obj => {
            r2KeyMap.set(obj.Key, obj);
        });
        
        // Find mismatches
        const comparison = {
            inBothDbAndR2: [],
            inDbButNotR2: [],
            inR2ButNotDb: [],
            orphanedFiles: [],
            sizeMismatches: []
        };
        
        // Check DB files against R2
        dbFiles.forEach(dbFile => {
            if (!dbFile.r2_key) {
                comparison.inDbButNotR2.push({ ...dbFile, reason: 'No R2 key in database' });
                return;
            }
            
            const r2Object = r2KeyMap.get(dbFile.r2_key);
            if (r2Object) {
                comparison.inBothDbAndR2.push({ db: dbFile, r2: r2Object });
                
                // Check size mismatches
                const dbSizeBytes = parseInt(dbFile.file_size_bytes || 0);
                const r2SizeBytes = r2Object.Size || 0;
                if (Math.abs(dbSizeBytes - r2SizeBytes) > 1024) { // Allow 1KB tolerance
                    comparison.sizeMismatches.push({
                        filename: dbFile.filename,
                        r2Key: dbFile.r2_key,
                        dbSize: dbSizeBytes,
                        r2Size: r2SizeBytes,
                        difference: Math.abs(dbSizeBytes - r2SizeBytes)
                    });
                }
            } else {
                comparison.inDbButNotR2.push({ ...dbFile, reason: 'R2 file not found' });
            }
        });
        
        // Check R2 objects against DB
        r2Objects.forEach(r2Object => {
            const dbFile = dbKeyMap.get(r2Object.Key);
            if (!dbFile) {
                // This is an orphaned file in R2
                comparison.inR2ButNotDb.push(r2Object);
                
                // Try to identify what type of orphaned file this is
                const key = r2Object.Key;
                let orphanType = 'unknown';
                
                if (key.includes('/thumbnails/') || key.includes('_sm.') || key.includes('_md.') || key.includes('_lg.')) {
                    orphanType = 'thumbnail';
                } else if (key.includes('backup-index.json')) {
                    orphanType = 'backup_index';
                } else if (key.startsWith('photographer-') && key.includes('/session-')) {
                    orphanType = 'gallery_file';
                } else if (key.includes('/') && key.length > 30) {
                    orphanType = 'legacy_uuid';
                }
                
                comparison.orphanedFiles.push({
                    key: r2Object.Key,
                    size: r2Object.Size,
                    lastModified: r2Object.LastModified,
                    type: orphanType
                });
            }
        });
        
        // Calculate orphaned storage
        const orphanedSizeBytes = comparison.orphanedFiles.reduce((sum, file) => sum + (file.size || 0), 0);
        const orphanedSizeMB = orphanedSizeBytes / (1024 * 1024);
        const orphanedSizeGB = orphanedSizeMB / 1024;
        
        console.log('✅ Comparison Analysis Complete:');
        console.log(`   ✅ Files in both DB and R2: ${comparison.inBothDbAndR2.length}`);
        console.log(`   📉 Files in DB but missing from R2: ${comparison.inDbButNotR2.length}`);
        console.log(`   📈 Files in R2 but missing from DB: ${comparison.inR2ButNotDb.length}`);
        console.log(`   🗑️ Orphaned files: ${comparison.orphanedFiles.length}`);
        console.log(`   💾 Orphaned storage: ${orphanedSizeGB.toFixed(2)} GB`);
        console.log(`   ⚠️ Size mismatches: ${comparison.sizeMismatches.length}`);
        
        // Group orphaned files by type
        const orphansByType = {};
        comparison.orphanedFiles.forEach(file => {
            if (!orphansByType[file.type]) {
                orphansByType[file.type] = { count: 0, sizeBytes: 0 };
            }
            orphansByType[file.type].count++;
            orphansByType[file.type].sizeBytes += file.size || 0;
        });
        
        console.log('\n🗂️ Orphaned Files by Type:');
        Object.entries(orphansByType).forEach(([type, stats]) => {
            const sizeMB = stats.sizeBytes / (1024 * 1024);
            console.log(`   ${type}: ${stats.count} files (${sizeMB.toFixed(2)} MB)`);
        });
        
        return comparison;
    }

    /**
     * Generate cleanup recommendations
     */
    generateCleanupRecommendations(comparison, dbSummary, r2Analysis) {
        console.log('\n🧹 STEP 4: Cleanup Recommendations...');
        
        const recommendations = [];
        
        // Calculate storage discrepancy
        const expectedSizeGB = dbSummary.totalSizeGB;
        const actualSizeGB = r2Analysis.totalSizeGB;
        const discrepancyGB = actualSizeGB - expectedSizeGB;
        
        console.log(`📊 Storage Discrepancy Analysis:`);
        console.log(`   Expected (DB): ${expectedSizeGB.toFixed(2)} GB`);
        console.log(`   Actual (R2): ${actualSizeGB.toFixed(2)} GB`);
        console.log(`   Discrepancy: ${discrepancyGB.toFixed(2)} GB`);
        
        if (comparison.orphanedFiles.length > 0) {
            const orphanedSizeGB = comparison.orphanedFiles.reduce((sum, f) => sum + (f.size || 0), 0) / (1024 * 1024 * 1024);
            
            recommendations.push({
                priority: 'HIGH',
                action: 'Remove orphaned files',
                description: `${comparison.orphanedFiles.length} orphaned files consuming ${orphanedSizeGB.toFixed(2)} GB`,
                files: comparison.orphanedFiles.map(f => f.key)
            });
        }
        
        if (comparison.sizeMismatches.length > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'Investigate size mismatches',
                description: `${comparison.sizeMismatches.length} files have size discrepancies between DB and R2`,
                files: comparison.sizeMismatches
            });
        }
        
        if (comparison.inDbButNotR2.length > 0) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Fix missing R2 files',
                description: `${comparison.inDbButNotR2.length} files exist in DB but are missing from R2`,
                files: comparison.inDbButNotR2
            });
        }
        
        console.log(`\n📋 Generated ${recommendations.length} recommendations:`);
        recommendations.forEach((rec, index) => {
            console.log(`   ${index + 1}. [${rec.priority}] ${rec.action}: ${rec.description}`);
        });
        
        return recommendations;
    }

    /**
     * Run complete investigation
     */
    async investigate() {
        try {
            console.log('🔍 Starting R2 Storage Investigation...');
            console.log('=' .repeat(60));
            
            // Step 1: Get database files
            const dbData = await this.getDatabaseFiles();
            
            // Step 2: Get R2 bucket contents
            const r2Data = await this.getR2BucketContents();
            
            // Step 3: Compare and find discrepancies
            const comparison = await this.compareDbWithR2(dbData, r2Data);
            
            // Step 4: Generate cleanup recommendations
            const recommendations = this.generateCleanupRecommendations(comparison, dbData.summary, r2Data.analysis);
            
            console.log('\n' + '=' .repeat(60));
            console.log('✅ Investigation Complete!');
            
            return {
                database: dbData,
                r2Bucket: r2Data,
                comparison,
                recommendations
            };
            
        } catch (error) {
            console.error('❌ Investigation failed:', error);
            throw error;
        } finally {
            await this.pool.end();
        }
    }
}

// Export for use in other scripts
module.exports = R2StorageInvestigator;

// Run investigation if called directly
if (require.main === module) {
    const investigator = new R2StorageInvestigator();
    investigator.investigate()
        .then(results => {
            console.log('\n📊 Investigation Results Summary:');
            console.log(`Database expects: ${results.database.summary.totalSizeGB.toFixed(2)} GB`);
            console.log(`R2 bucket contains: ${results.r2Bucket.analysis.totalSizeGB.toFixed(2)} GB`);
            console.log(`Discrepancy: ${(results.r2Bucket.analysis.totalSizeGB - results.database.summary.totalSizeGB).toFixed(2)} GB`);
            console.log(`Orphaned files: ${results.comparison.orphanedFiles.length}`);
            console.log(`Cleanup recommendations: ${results.recommendations.length}`);
        })
        .catch(error => {
            console.error('Investigation failed:', error);
            process.exit(1);
        });
}