const fetch = require('node-fetch');

// Test with session that we know has photos in R2
async function testPhotosAPI() {
    try {
        console.log('🔍 Testing Photos API with Known Session...\n');
        
        const R2FileManager = require('./server/r2-file-manager');
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        const r2Manager = new R2FileManager(null, pool);
        
        // Test with session that has photos
        const sessionId = '5bad52e9-1bbb-4c4a-b7fc-d826788c69e6';
        const userId = 'BFZI4tzu4rdsiZZSK63cqZ5yohw2';
        
        console.log(`   Session: ${sessionId}`);
        console.log(`   User ID: ${userId}`);
        console.log(`   Expected R2 prefix: photographer-${userId}/session-${sessionId}/\n`);
        
        // Get session files
        const sessionFiles = await r2Manager.getSessionFiles(userId, sessionId);
        
        console.log('✅ Results from R2FileManager:');
        console.log(`   Total files found: ${sessionFiles.totalFiles}`);
        console.log(`   Total size: ${(sessionFiles.totalSize / (1024 * 1024)).toFixed(2)} MB`);
        console.log('\n   Files by type:');
        
        for (const [type, files] of Object.entries(sessionFiles.filesByType)) {
            if (files && files.length > 0) {
                console.log(`   📁 ${type}: ${files.length} files`);
                files.slice(0, 3).forEach(file => {
                    console.log(`      • ${file.filename} (${(file.fileSizeMB || 0).toFixed(2)} MB)`);
                    console.log(`        R2 Key: ${file.r2Key}`);
                });
                if (files.length > 3) {
                    console.log(`      ... and ${files.length - 3} more`);
                }
            }
        }
        
        // Test presigned URL generation for the first gallery file
        if (sessionFiles.filesByType.gallery && sessionFiles.filesByType.gallery.length > 0) {
            console.log('\n🔗 Testing Presigned URL generation:');
            const firstFile = sessionFiles.filesByType.gallery[0];
            try {
                const presignedUrl = await r2Manager.getPresignedUrl(firstFile.r2Key, 3600, firstFile.filename);
                console.log(`   ✅ Generated URL for ${firstFile.filename}`);
                console.log(`   URL: ${presignedUrl.substring(0, 100)}...`);
            } catch (urlError) {
                console.log(`   ❌ Failed to generate URL: ${urlError.message}`);
            }
        }
        
        // Check the backup index
        console.log('\n📋 Backup Index Status:');
        try {
            const backupIndex = await r2Manager.getSessionBackupIndex(userId, sessionId);
            console.log(`   ✅ Backup index exists with ${backupIndex.totalFiles || 0} files`);
            if (backupIndex.rebuilt) {
                console.log(`   ✨ Index was rebuilt at: ${backupIndex.rebuiltAt}`);
            }
        } catch (indexError) {
            console.log(`   ⚠️ No backup index (will be created on next fetch)`);
        }
        
        // Test the original problematic session too
        console.log('\n\n📌 Checking Original Session:');
        const originalSessionId = 'd0892278-1882-4466-955f-fba2425e53ef';
        
        // Check both possible user IDs (Firebase UID and integer ID)
        const userIds = ['BFZI4tzu4rdsiZZSK63cqZ5yohw2', '44735007'];
        
        for (const testUserId of userIds) {
            console.log(`\n   Testing with User ID: ${testUserId}`);
            const prefix = `photographer-${testUserId}/session-${originalSessionId}/`;
            const objects = await r2Manager.listObjects(prefix);
            if (objects && objects.length > 0) {
                console.log(`   ✅ Found ${objects.length} objects with prefix: ${prefix}`);
                objects.slice(0, 3).forEach(obj => {
                    console.log(`      • ${obj.Key}`);
                });
            } else {
                console.log(`   ❌ No objects found with prefix: ${prefix}`);
            }
        }
        
        console.log('\n✅ Photo loading system test complete!');
        
        await pool.end();
        
        return sessionFiles;
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testPhotosAPI().then(() => {
    console.log('\n🎉 All tests completed successfully!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
});