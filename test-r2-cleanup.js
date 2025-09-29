#!/usr/bin/env node

// Test script to execute R2 cleanup
const axios = require('axios');

async function executeR2Cleanup() {
    try {
        console.log('🧹 Testing R2 Cleanup Endpoint...');
        
        // First, run a dry-run to see what would be deleted
        console.log('\n📋 Step 1: Running dry-run analysis...');
        
        const dryRunResponse = await axios.post('http://localhost:5000/api/admin/r2-cleanup', {
            dryRun: true,
            categories: ['all']
        }, {
            // For testing, we'll need to include session headers
            // In a real scenario, this would require proper authentication
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 300000 // 5 minutes timeout for large operations
        });
        
        console.log('Dry-run results:', JSON.stringify(dryRunResponse.data, null, 2));
        
        // If dry-run shows significant orphaned files, proceed with actual cleanup
        const results = dryRunResponse.data.results;
        if (results.summary.totalOrphanedFiles > 0) {
            console.log(`\n🗑️ Found ${results.summary.totalOrphanedFiles} orphaned files (${results.summary.totalOrphanedSizeGB.toFixed(2)} GB)`);
            console.log('Breakdown by category:');
            Object.entries(results.orphanedFilesByCategory).forEach(([category, data]) => {
                if (data.count > 0) {
                    console.log(`  ${category}: ${data.count} files (${data.sizeGB.toFixed(2)} GB)`);
                }
            });
            
            // Proceed with actual cleanup
            console.log('\n🚀 Step 2: Executing actual cleanup...');
            
            const cleanupResponse = await axios.post('http://localhost:5000/api/admin/r2-cleanup', {
                dryRun: false,
                categories: ['all']
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000 // 10 minutes timeout for deletion operations
            });
            
            console.log('Cleanup results:', JSON.stringify(cleanupResponse.data, null, 2));
            
            const finalResults = cleanupResponse.data.results;
            console.log(`\n✅ Cleanup completed successfully!`);
            console.log(`📊 Files deleted: ${finalResults.summary.filesDeleted}`);
            console.log(`💾 Storage reclaimed: ${finalResults.summary.storageReclaimed.gb.toFixed(2)} GB`);
            
            if (finalResults.finalBucketState) {
                console.log(`📈 Final bucket size: ${finalResults.finalBucketState.totalSizeGB.toFixed(2)} GB`);
                console.log(`📉 Total reduction: ${finalResults.finalBucketState.reductionGB.toFixed(2)} GB`);
            }
            
        } else {
            console.log('\n✅ No orphaned files found - R2 bucket is clean!');
        }
        
    } catch (error) {
        if (error.response) {
            console.error('❌ API Error:', error.response.status, error.response.data);
        } else if (error.request) {
            console.error('❌ Network Error:', error.message);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

executeR2Cleanup();