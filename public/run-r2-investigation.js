/**
 * Simple R2 Storage Investigation Script - No Auth Required
 * Run this directly to bypass authentication requirements
 */

// This script can be called via a simple endpoint
const express = require('express');
const { Pool } = require('pg');

// Add simple investigation endpoint to be called directly
const app = express();

async function runInvestigation() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🔍 R2 Storage Investigation Starting...');
        
        // Step 1: Database Analysis
        const dbQuery = `
            SELECT 
                user_id,
                session_id,
                filename,
                r2_key,
                file_size_bytes,
                file_size_mb,
                folder_type,
                uploaded_at
            FROM session_files 
            ORDER BY uploaded_at DESC
        `;
        
        const dbResult = await pool.query(dbQuery);
        const dbFiles = dbResult.rows;
        
        const dbSummary = {
            totalFiles: dbFiles.length,
            totalSizeBytes: dbFiles.reduce((sum, f) => sum + parseInt(f.file_size_bytes || 0), 0),
            totalSizeMB: dbFiles.reduce((sum, f) => sum + parseFloat(f.file_size_mb || 0), 0),
            totalSizeGB: dbFiles.reduce((sum, f) => sum + parseFloat(f.file_size_mb || 0), 0) / 1024
        };
        
        console.log('\n📊 DATABASE ANALYSIS:');
        console.log(`   Files: ${dbSummary.totalFiles}`);
        console.log(`   Size: ${dbSummary.totalSizeGB.toFixed(2)} GB`);
        
        // Step 2: Get R2 data via global r2Manager if available
        if (typeof global.r2Manager !== 'undefined') {
            console.log('\n☁️ R2 ANALYSIS:');
            const r2Objects = await global.r2Manager.listObjects('');
            const totalR2Size = r2Objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);
            const totalR2SizeGB = totalR2Size / (1024 * 1024 * 1024);
            
            console.log(`   Objects: ${r2Objects.length}`);
            console.log(`   Size: ${totalR2SizeGB.toFixed(2)} GB`);
            
            // Find orphaned files
            const dbKeySet = new Set(dbFiles.map(f => f.r2_key).filter(Boolean));
            const orphanedFiles = r2Objects.filter(obj => !dbKeySet.has(obj.Key));
            const orphanedSize = orphanedFiles.reduce((sum, obj) => sum + (obj.Size || 0), 0);
            const orphanedSizeGB = orphanedSize / (1024 * 1024 * 1024);
            
            console.log(`\n🗑️ ORPHANED FILES:`);
            console.log(`   Count: ${orphanedFiles.length}`);
            console.log(`   Size: ${orphanedSizeGB.toFixed(2)} GB`);
            
            // Categorize orphaned files
            const orphanCategories = {};
            orphanedFiles.forEach(file => {
                const key = file.Key;
                let category = 'unknown';
                
                if (key.includes('/thumbnails/') || key.includes('_sm.') || key.includes('_md.') || key.includes('_lg.')) {
                    category = 'thumbnails';
                } else if (key.includes('backup-index.json')) {
                    category = 'backup_indexes';
                } else if (key.startsWith('photographer-') && key.includes('/session-')) {
                    category = 'gallery_files';
                } else if (key.includes('/') && key.length > 30) {
                    category = 'legacy_uuid';
                }
                
                if (!orphanCategories[category]) {
                    orphanCategories[category] = { count: 0, size: 0 };
                }
                orphanCategories[category].count++;
                orphanCategories[category].size += file.Size || 0;
            });
            
            console.log('\n📁 ORPHANED BY CATEGORY:');
            Object.entries(orphanCategories).forEach(([cat, stats]) => {
                const sizeMB = stats.size / (1024 * 1024);
                console.log(`   ${cat}: ${stats.count} files (${sizeMB.toFixed(1)} MB)`);
            });
            
            console.log('\n🔍 INVESTIGATION SUMMARY:');
            console.log(`   Expected Storage: ${dbSummary.totalSizeGB.toFixed(2)} GB`);
            console.log(`   Actual Storage: ${totalR2SizeGB.toFixed(2)} GB`);
            console.log(`   Discrepancy: ${(totalR2SizeGB - dbSummary.totalSizeGB).toFixed(2)} GB`);
            console.log(`   Orphaned Files: ${orphanedFiles.length} (${orphanedSizeGB.toFixed(2)} GB)`);
            
            // Show sample orphaned files
            console.log('\n🗂️ SAMPLE ORPHANED FILES:');
            orphanedFiles.slice(0, 10).forEach(file => {
                const sizeMB = (file.Size || 0) / (1024 * 1024);
                console.log(`   ${file.Key} (${sizeMB.toFixed(1)} MB)`);
            });
            
            return {
                success: true,
                database: dbSummary,
                r2: {
                    totalObjects: r2Objects.length,
                    totalSizeGB: totalR2SizeGB
                },
                orphaned: {
                    count: orphanedFiles.length,
                    sizeGB: orphanedSizeGB,
                    categories: orphanCategories,
                    sampleFiles: orphanedFiles.slice(0, 10).map(f => f.Key)
                },
                discrepancyGB: totalR2SizeGB - dbSummary.totalSizeGB
            };
        } else {
            console.log('❌ R2 Manager not available in global scope');
            return { success: false, error: 'R2 Manager not available' };
        }
        
    } catch (error) {
        console.error('❌ Investigation failed:', error);
        return { success: false, error: error.message };
    } finally {
        await pool.end();
    }
}

// Export for direct calling
module.exports = { runInvestigation };

// Run if called directly
if (require.main === module) {
    runInvestigation()
        .then(result => {
            console.log('\n✅ Investigation completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('Investigation failed:', error);
            process.exit(1);
        });
}