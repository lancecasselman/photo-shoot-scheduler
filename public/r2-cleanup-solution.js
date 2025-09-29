/**
 * R2 Storage Cleanup Solution
 * 
 * Based on investigation findings:
 * - Database: 177 files, 3.44 GB (expected)
 * - R2 Bucket: 1,714 objects, 6.86 GB (actual)
 * - Orphaned: 1,537 files, 3.42 GB (76% of excess storage)
 * 
 * ROOT CAUSE: Legacy files and thumbnails not properly cleaned up
 */

const { Pool } = require('pg');
const R2FileManager = require('../server/r2-file-manager');

class R2CleanupSolution {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        this.r2Manager = new R2FileManager(null, this.pool);
    }

    /**
     * PHASE 1: Safe cleanup of clearly orphaned files
     */
    async cleanupOrphanedFiles() {
        console.log('🧹 PHASE 1: Cleaning up orphaned files...');
        
        // Get current valid files from database
        const dbResult = await this.pool.query(`
            SELECT DISTINCT r2_key 
            FROM session_files 
            WHERE r2_key IS NOT NULL
        `);
        const validKeys = new Set(dbResult.rows.map(row => row.r2_key));
        
        console.log(`📊 Database has ${validKeys.size} valid file keys`);
        
        // Get all R2 objects
        const r2Objects = await this.r2Manager.listObjects('');
        console.log(`☁️ R2 has ${r2Objects.length} total objects`);
        
        // Categorize orphaned files
        const orphanCategories = {
            galleryFiles: [],
            thumbnails: [],
            legacyUuid: [],
            backupIndexes: [],
            communityFiles: []
        };
        
        let totalOrphanedSize = 0;
        
        r2Objects.forEach(obj => {
            if (!validKeys.has(obj.Key)) {
                // This is an orphaned file
                const key = obj.Key;
                totalOrphanedSize += obj.Size || 0;
                
                if (key.includes('/thumbnails/') || key.includes('_sm.') || key.includes('_md.') || key.includes('_lg.') || key.includes('_thumb.') || key.includes('_feed.') || key.includes('_full.')) {
                    orphanCategories.thumbnails.push(obj);
                } else if (key.includes('backup-index.json')) {
                    orphanCategories.backupIndexes.push(obj);
                } else if (key.startsWith('community/')) {
                    orphanCategories.communityFiles.push(obj);
                } else if (key.startsWith('photographer-') && key.includes('/session-')) {
                    orphanCategories.galleryFiles.push(obj);
                } else if (key.includes('/') && key.length > 30) {
                    orphanCategories.legacyUuid.push(obj);
                }
            }
        });
        
        const totalOrphanedGB = totalOrphanedSize / (1024 * 1024 * 1024);
        
        console.log('\n📋 ORPHANED FILE CATEGORIES:');
        Object.entries(orphanCategories).forEach(([category, files]) => {
            const size = files.reduce((sum, f) => sum + (f.Size || 0), 0) / (1024 * 1024);
            console.log(`   ${category}: ${files.length} files (${size.toFixed(1)} MB)`);
        });
        
        console.log(`\n💾 Total orphaned storage: ${totalOrphanedGB.toFixed(2)} GB`);
        
        return orphanCategories;
    }

    /**
     * PHASE 2: Execute safe cleanup
     */
    async executeSafeCleanup(orphanCategories, dryRun = true) {
        console.log(`\n🧹 PHASE 2: ${dryRun ? 'DRY RUN - ' : ''}Executing cleanup...`);
        
        const cleanupPlan = [
            { 
                name: 'thumbnails', 
                files: orphanCategories.thumbnails,
                priority: 'HIGH',
                description: 'Generated thumbnails not tracked in database'
            },
            { 
                name: 'backupIndexes', 
                files: orphanCategories.backupIndexes,
                priority: 'MEDIUM',
                description: 'Backup metadata files'
            },
            { 
                name: 'communityFiles', 
                files: orphanCategories.communityFiles,
                priority: 'LOW',
                description: 'Community platform files (may be in use)'
            },
            { 
                name: 'legacyUuid', 
                files: orphanCategories.legacyUuid,
                priority: 'MEDIUM',
                description: 'Legacy UUID-based file paths'
            }
        ];
        
        let totalCleanedSize = 0;
        let totalCleanedFiles = 0;
        
        for (const category of cleanupPlan) {
            console.log(`\n🗂️ Processing ${category.name} (${category.priority} priority)`);
            console.log(`   Description: ${category.description}`);
            console.log(`   Files to process: ${category.files.length}`);
            
            const categorySize = category.files.reduce((sum, f) => sum + (f.Size || 0), 0);
            const categorySizeMB = categorySize / (1024 * 1024);
            console.log(`   Size to reclaim: ${categorySizeMB.toFixed(1)} MB`);
            
            if (!dryRun && category.priority !== 'LOW') {
                console.log('   🗑️ Deleting files...');
                let deleted = 0;
                let failed = 0;
                
                for (const file of category.files) {
                    try {
                        await this.r2Manager.deleteFile(file.Key);
                        deleted++;
                        totalCleanedSize += file.Size || 0;
                        
                        // Progress indicator every 100 files
                        if (deleted % 100 === 0) {
                            console.log(`     Progress: ${deleted}/${category.files.length} deleted`);
                        }
                    } catch (error) {
                        failed++;
                        if (failed < 5) { // Only log first few failures
                            console.log(`     Failed to delete ${file.Key}: ${error.message}`);
                        }
                    }
                }
                
                console.log(`   ✅ Completed: ${deleted} deleted, ${failed} failed`);
                totalCleanedFiles += deleted;
            } else if (dryRun) {
                console.log(`   🔍 DRY RUN: Would delete ${category.files.length} files (${categorySizeMB.toFixed(1)} MB)`);
                totalCleanedSize += categorySize;
                totalCleanedFiles += category.files.length;
            } else {
                console.log(`   ⏭️ Skipping ${category.name} due to LOW priority`);
            }
        }
        
        const totalCleanedGB = totalCleanedSize / (1024 * 1024 * 1024);
        
        console.log(`\n📊 CLEANUP SUMMARY:`);
        console.log(`   Files ${dryRun ? 'to be cleaned' : 'cleaned'}: ${totalCleanedFiles}`);
        console.log(`   Storage ${dryRun ? 'to be reclaimed' : 'reclaimed'}: ${totalCleanedGB.toFixed(2)} GB`);
        
        return {
            filesProcessed: totalCleanedFiles,
            sizeReclaimed: totalCleanedGB,
            dryRun
        };
    }

    /**
     * PHASE 3: Gallery files cleanup (requires manual review)
     */
    async reviewGalleryFiles(orphanCategories) {
        console.log('\n🔍 PHASE 3: Gallery Files Review (Manual Action Required)');
        
        const galleryFiles = orphanCategories.galleryFiles;
        const gallerySize = galleryFiles.reduce((sum, f) => sum + (f.Size || 0), 0);
        const gallerySizeGB = gallerySize / (1024 * 1024 * 1024);
        
        console.log(`📁 Found ${galleryFiles.length} orphaned gallery files (${gallerySizeGB.toFixed(2)} GB)`);
        
        // Group by session
        const sessionGroups = {};
        galleryFiles.forEach(file => {
            const match = file.Key.match(/session-([^\/]+)/);
            if (match) {
                const sessionId = match[1];
                if (!sessionGroups[sessionId]) {
                    sessionGroups[sessionId] = [];
                }
                sessionGroups[sessionId].push(file);
            }
        });
        
        console.log(`\n📋 Gallery files grouped by session:`);
        Object.entries(sessionGroups).forEach(([sessionId, files]) => {
            const sessionSize = files.reduce((sum, f) => sum + (f.Size || 0), 0) / (1024 * 1024);
            console.log(`   Session ${sessionId}: ${files.length} files (${sessionSize.toFixed(1)} MB)`);
        });
        
        console.log('\n⚠️ MANUAL ACTION REQUIRED:');
        console.log('   These gallery files require manual review before deletion');
        console.log('   They may be from deleted sessions or failed cleanup operations');
        console.log('   Recommend checking if these session IDs exist in photography_sessions table');
        
        return sessionGroups;
    }

    /**
     * Main cleanup execution
     */
    async runCleanup(dryRun = true) {
        try {
            console.log('🔍 R2 STORAGE CLEANUP SOLUTION');
            console.log('=' .repeat(50));
            
            // Phase 1: Analyze orphaned files
            const orphanCategories = await this.cleanupOrphanedFiles();
            
            // Phase 2: Execute safe cleanup
            const cleanupResults = await this.executeSafeCleanup(orphanCategories, dryRun);
            
            // Phase 3: Review gallery files
            const galleryReview = await this.reviewGalleryFiles(orphanCategories);
            
            console.log('\n' + '=' .repeat(50));
            console.log('✅ CLEANUP SOLUTION COMPLETE');
            
            return {
                orphanCategories,
                cleanupResults,
                galleryReview
            };
            
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
            throw error;
        } finally {
            await this.pool.end();
        }
    }
}

// Export for use in endpoints
module.exports = R2CleanupSolution;

// Run cleanup if called directly
if (require.main === module) {
    const cleanup = new R2CleanupSolution();
    
    // Check command line arguments
    const dryRun = !process.argv.includes('--execute');
    
    if (dryRun) {
        console.log('🔍 RUNNING DRY RUN - No files will be deleted');
        console.log('   Add --execute flag to perform actual cleanup');
    } else {
        console.log('⚠️  EXECUTING ACTUAL CLEANUP - Files will be deleted!');
    }
    
    cleanup.runCleanup(dryRun)
        .then(results => {
            console.log('\n📊 Final Results:');
            console.log(`   Files to clean: ${results.cleanupResults.filesProcessed}`);
            console.log(`   Storage to reclaim: ${results.cleanupResults.sizeReclaimed.toFixed(2)} GB`);
            process.exit(0);
        })
        .catch(error => {
            console.error('Cleanup failed:', error);
            process.exit(1);
        });
}