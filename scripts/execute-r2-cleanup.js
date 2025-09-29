#!/usr/bin/env node

// Direct R2 cleanup execution script
// This bypasses HTTP authentication and calls the cleanup logic directly

require('dotenv').config();

const { Pool } = require('pg');
const R2FileManager = require('../server/r2-file-manager');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    min: 2,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 15000,
});

async function executeR2Cleanup(dryRun = true, categories = ['all']) {
    let r2FileManager;
    
    try {
        console.log('🧹 Starting R2 Storage Cleanup...');
        console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE DELETION'}`);
        console.log(`   Categories: ${categories.join(', ')}`);

        // Initialize R2 File Manager
        r2FileManager = new R2FileManager(null, pool);
        
        // Wait for R2 connection to be established
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!r2FileManager.r2Available) {
            throw new Error('R2 connection not available');
        }

        const cleanupResults = {
            timestamp: new Date().toISOString(),
            mode: dryRun ? 'dry-run' : 'live',
            categories: categories,
            summary: {
                totalOrphanedFiles: 0,
                totalOrphanedSizeBytes: 0,
                totalOrphanedSizeMB: 0,
                totalOrphanedSizeGB: 0,
                filesDeleted: 0,
                storageReclaimed: {
                    bytes: 0,
                    mb: 0,
                    gb: 0
                }
            },
            orphanedFilesByCategory: {},
            deletionLog: [],
            errors: []
        };

        // Step 1: Get all valid R2 keys from database tables
        console.log('📊 Collecting valid R2 keys from database...');
        
        const validR2Keys = new Set();
        
        // Get R2 keys from session_files table
        const sessionFilesQuery = `
            SELECT r2_key, filename, file_size_bytes, folder_type, user_id, session_id
            FROM session_files 
            WHERE r2_key IS NOT NULL AND r2_key != ''
        `;
        const sessionFilesResult = await pool.query(sessionFilesQuery);
        sessionFilesResult.rows.forEach(row => {
            if (row.r2_key) {
                validR2Keys.add(row.r2_key);
            }
        });

        // Get R2 keys from r2_files table if it exists
        try {
            const r2FilesQuery = `
                SELECT r2_key, filename, file_size_bytes, file_type, user_id, session_id
                FROM r2_files 
                WHERE r2_key IS NOT NULL AND r2_key != ''
            `;
            const r2FilesResult = await pool.query(r2FilesQuery);
            r2FilesResult.rows.forEach(row => {
                if (row.r2_key) {
                    validR2Keys.add(row.r2_key);
                }
            });
        } catch (error) {
            console.log('   r2_files table not found, skipping...');
        }

        // Get R2 keys from photography_sessions photos JSONB field
        try {
            const photosQuery = `
                SELECT id, photos
                FROM photography_sessions 
                WHERE photos IS NOT NULL 
                AND jsonb_array_length(photos) > 0
            `;
            const photosResult = await pool.query(photosQuery);
            photosResult.rows.forEach(row => {
                if (row.photos && Array.isArray(row.photos)) {
                    row.photos.forEach(photo => {
                        if (photo.r2Key) {
                            validR2Keys.add(photo.r2Key);
                        }
                        if (photo.r2_key) {
                            validR2Keys.add(photo.r2_key);
                        }
                    });
                }
            });
        } catch (error) {
            console.log('   Error reading photography_sessions photos:', error.message);
        }

        console.log(`   Found ${validR2Keys.size} valid R2 keys in database`);

        // Step 2: List all objects in R2 bucket
        console.log('☁️ Listing all R2 bucket objects...');
        const r2Objects = await r2FileManager.listObjects('');
        
        const totalR2Size = r2Objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);
        const totalR2SizeGB = totalR2Size / (1024 * 1024 * 1024);
        
        console.log(`   Found ${r2Objects.length} objects in R2 bucket (${totalR2SizeGB.toFixed(2)} GB)`);

        // Step 3: Identify orphaned files by category
        console.log('🔍 Identifying orphaned files...');
        
        const orphanedFiles = {
            gallery_files: [],
            thumbnails: [],
            legacy_uuid: [],
            backup_indexes: [],
            unknown: []
        };

        r2Objects.forEach(r2Object => {
            const key = r2Object.Key;
            
            // Skip if this R2 key exists in database
            if (validR2Keys.has(key)) {
                return;
            }
            
            // Categorize orphaned file
            let category = 'unknown';
            if (key.includes('/thumbnails/') || key.includes('_sm.') || key.includes('_md.') || key.includes('_lg.')) {
                category = 'thumbnails';
            } else if (key.includes('backup-index.json')) {
                category = 'backup_indexes';
            } else if (key.startsWith('photographer-') && key.includes('/session-')) {
                category = 'gallery_files';
            } else if (key.includes('/') && key.length > 30 && !key.includes('photographer-')) {
                category = 'legacy_uuid';
            }

            const orphanedFile = {
                key: key,
                size: r2Object.Size || 0,
                lastModified: r2Object.LastModified,
                category: category
            };

            orphanedFiles[category].push(orphanedFile);
            
            cleanupResults.summary.totalOrphanedFiles++;
            cleanupResults.summary.totalOrphanedSizeBytes += orphanedFile.size;
        });

        // Calculate total sizes
        cleanupResults.summary.totalOrphanedSizeMB = cleanupResults.summary.totalOrphanedSizeBytes / (1024 * 1024);
        cleanupResults.summary.totalOrphanedSizeGB = cleanupResults.summary.totalOrphanedSizeMB / 1024;

        // Generate category summaries
        Object.keys(orphanedFiles).forEach(category => {
            const categoryFiles = orphanedFiles[category];
            const categorySize = categoryFiles.reduce((sum, file) => sum + file.size, 0);
            
            cleanupResults.orphanedFilesByCategory[category] = {
                count: categoryFiles.length,
                sizeBytes: categorySize,
                sizeMB: categorySize / (1024 * 1024),
                sizeGB: categorySize / (1024 * 1024 * 1024)
            };
        });

        console.log(`   🗑️ Found ${cleanupResults.summary.totalOrphanedFiles} orphaned files (${cleanupResults.summary.totalOrphanedSizeGB.toFixed(2)} GB)`);
        
        // Log breakdown by category
        Object.keys(cleanupResults.orphanedFilesByCategory).forEach(category => {
            const cat = cleanupResults.orphanedFilesByCategory[category];
            if (cat.count > 0) {
                console.log(`      ${category}: ${cat.count} files (${cat.sizeGB.toFixed(2)} GB)`);
            }
        });

        // Step 4: Delete orphaned files (if not dry run)
        if (!dryRun && cleanupResults.summary.totalOrphanedFiles > 0) {
            console.log('🗑️ Starting file deletion...');
            
            let deletedCount = 0;
            let deletedBytes = 0;
            
            for (const category of Object.keys(orphanedFiles)) {
                // Skip categories not included in cleanup
                if (!categories.includes('all') && !categories.includes(category)) {
                    console.log(`   Skipping ${category} (not in requested categories)`);
                    continue;
                }
                
                const categoryFiles = orphanedFiles[category];
                console.log(`   Deleting ${categoryFiles.length} ${category} files...`);
                
                for (const file of categoryFiles) {
                    try {
                        await r2FileManager.deleteFileByKey(file.key);
                        
                        deletedCount++;
                        deletedBytes += file.size;
                        
                        cleanupResults.deletionLog.push({
                            key: file.key,
                            size: file.size,
                            category: file.category,
                            deletedAt: new Date().toISOString(),
                            success: true
                        });
                        
                        // Log progress every 100 deletions
                        if (deletedCount % 100 === 0) {
                            console.log(`      Progress: ${deletedCount} files deleted`);
                        }
                        
                    } catch (error) {
                        console.error(`      Failed to delete ${file.key}:`, error.message);
                        
                        cleanupResults.errors.push({
                            key: file.key,
                            error: error.message,
                            category: file.category
                        });
                        
                        cleanupResults.deletionLog.push({
                            key: file.key,
                            size: file.size,
                            category: file.category,
                            deletedAt: new Date().toISOString(),
                            success: false,
                            error: error.message
                        });
                    }
                }
            }
            
            cleanupResults.summary.filesDeleted = deletedCount;
            cleanupResults.summary.storageReclaimed = {
                bytes: deletedBytes,
                mb: deletedBytes / (1024 * 1024),
                gb: deletedBytes / (1024 * 1024 * 1024)
            };
            
            console.log(`✅ Cleanup completed: ${deletedCount} files deleted, ${cleanupResults.summary.storageReclaimed.gb.toFixed(2)} GB reclaimed`);
            
            if (cleanupResults.errors.length > 0) {
                console.log(`⚠️ ${cleanupResults.errors.length} deletion errors occurred`);
            }
            
        } else if (dryRun) {
            console.log('📋 Dry run completed - no files were deleted');
            console.log(`   Would delete: ${cleanupResults.summary.totalOrphanedFiles} files (${cleanupResults.summary.totalOrphanedSizeGB.toFixed(2)} GB)`);
        }

        // Step 5: Final bucket analysis (if live deletion occurred)
        if (!dryRun && cleanupResults.summary.filesDeleted > 0) {
            console.log('📊 Performing final bucket analysis...');
            
            // Wait a moment for deletions to propagate
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const finalR2Objects = await r2FileManager.listObjects('');
            const finalTotalSize = finalR2Objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);
            const finalTotalSizeGB = finalTotalSize / (1024 * 1024 * 1024);
            
            cleanupResults.finalBucketState = {
                totalObjects: finalR2Objects.length,
                totalSizeBytes: finalTotalSize,
                totalSizeGB: finalTotalSizeGB,
                reductionGB: totalR2SizeGB - finalTotalSizeGB
            };
            
            console.log(`📊 Final bucket state: ${finalR2Objects.length} objects (${finalTotalSizeGB.toFixed(2)} GB)`);
            console.log(`📉 Total reduction: ${cleanupResults.finalBucketState.reductionGB.toFixed(2)} GB`);
        }

        return cleanupResults;

    } catch (error) {
        console.error('❌ R2 Cleanup failed:', error);
        throw error;
    } finally {
        // Close database connection
        if (pool) {
            await pool.end();
        }
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--live');
    const categories = args.includes('--categories') 
        ? args[args.indexOf('--categories') + 1]?.split(',') || ['all']
        : ['all'];

    console.log('\n🚀 R2 Storage Cleanup Script');
    console.log('===============================');
    
    if (dryRun) {
        console.log('🔍 Running in DRY RUN mode (use --live for actual deletion)');
    } else {
        console.log('⚠️  Running in LIVE mode - files will be permanently deleted!');
    }

    try {
        const results = await executeR2Cleanup(dryRun, categories);
        
        console.log('\n📊 CLEANUP SUMMARY:');
        console.log('==================');
        console.log(`Mode: ${results.mode}`);
        console.log(`Orphaned files found: ${results.summary.totalOrphanedFiles}`);
        console.log(`Total orphaned storage: ${results.summary.totalOrphanedSizeGB.toFixed(2)} GB`);
        
        if (!dryRun) {
            console.log(`Files deleted: ${results.summary.filesDeleted}`);
            console.log(`Storage reclaimed: ${results.summary.storageReclaimed.gb.toFixed(2)} GB`);
            
            if (results.finalBucketState) {
                console.log(`Final bucket size: ${results.finalBucketState.totalSizeGB.toFixed(2)} GB`);
            }
        }
        
        console.log('\nBreakdown by category:');
        Object.entries(results.orphanedFilesByCategory).forEach(([category, data]) => {
            if (data.count > 0) {
                console.log(`  ${category}: ${data.count} files (${data.sizeGB.toFixed(2)} GB)`);
            }
        });
        
        if (results.errors.length > 0) {
            console.log(`\n⚠️ Errors: ${results.errors.length} deletion failures`);
        }
        
    } catch (error) {
        console.error('\n❌ Script failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { executeR2Cleanup };