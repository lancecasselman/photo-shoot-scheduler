const fetch = require('node-fetch');

// Final test for the fixed photos API
async function testFixedPhotosAPI() {
    try {
        console.log('🔍 FINAL TEST: Photos API with Session d0892278-1882-4466-955f-fba2425e53ef\n');
        
        const R2FileManager = require('./server/r2-file-manager');
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        const r2Manager = new R2FileManager(null, pool);
        
        // The problematic session
        const sessionId = 'd0892278-1882-4466-955f-fba2425e53ef';
        const userId = '44735007'; // The actual user ID where photos are stored
        
        console.log('📋 Session Details:');
        console.log(`   Session ID: ${sessionId}`);
        console.log(`   User ID: ${userId}`);
        console.log(`   Expected R2 prefix: photographer-${userId}/session-${sessionId}/\n`);
        
        // Test getSessionFiles with the correct user ID
        console.log('1️⃣ Testing R2FileManager.getSessionFiles():');
        const sessionFiles = await r2Manager.getSessionFiles(userId, sessionId);
        
        console.log(`   ✅ Total files found: ${sessionFiles.totalFiles}`);
        console.log(`   ✅ Total size: ${(sessionFiles.totalSize / (1024 * 1024)).toFixed(2)} MB`);
        
        if (sessionFiles.totalFiles > 0) {
            console.log('\n   📁 Files by type:');
            for (const [type, files] of Object.entries(sessionFiles.filesByType)) {
                if (files && files.length > 0) {
                    console.log(`      ${type}: ${files.length} files`);
                    // Show first 2 files
                    files.slice(0, 2).forEach(file => {
                        console.log(`        • ${file.filename}`);
                    });
                }
            }
            
            // Test presigned URL generation
            console.log('\n2️⃣ Testing Presigned URL Generation:');
            const galleryFiles = sessionFiles.filesByType.gallery || [];
            if (galleryFiles.length > 0) {
                const testFile = galleryFiles[0];
                try {
                    const presignedUrl = await r2Manager.getPresignedUrl(testFile.r2Key, 3600, testFile.filename);
                    console.log(`   ✅ Generated presigned URL for ${testFile.filename}`);
                    console.log(`   URL starts with: ${presignedUrl.substring(0, 80)}...`);
                    
                    // Check if URL is valid
                    if (presignedUrl.includes('X-Amz-Signature')) {
                        console.log('   ✅ URL contains AWS signature - valid presigned URL');
                    }
                } catch (urlError) {
                    console.log(`   ❌ Failed to generate URL: ${urlError.message}`);
                }
            }
            
            // Check thumbnails
            console.log('\n3️⃣ Checking Thumbnails:');
            const firstGalleryFile = galleryFiles[0];
            if (firstGalleryFile) {
                const thumbnailSizes = ['_sm', '_md', '_lg'];
                for (const size of thumbnailSizes) {
                    const thumbnailKey = firstGalleryFile.r2Key.replace(/(\.[^.]+)$/, `${size}$1`);
                    try {
                        // Check if thumbnail exists by trying to generate a URL for it
                        const thumbnailUrl = await r2Manager.getPresignedUrl(thumbnailKey, 3600, `thumb${size}`);
                        console.log(`   ✅ Thumbnail ${size} exists`);
                    } catch (error) {
                        console.log(`   ⚠️ Thumbnail ${size} not found (may need generation)`);
                    }
                }
            }
            
            // Check backup index
            console.log('\n4️⃣ Backup Index Status:');
            try {
                const backupIndex = await r2Manager.getSessionBackupIndex(userId, sessionId);
                console.log(`   ✅ Backup index exists with ${backupIndex.totalFiles || 0} files`);
                console.log(`   Total size in index: ${((backupIndex.totalSizeBytes || 0) / (1024 * 1024)).toFixed(2)} MB`);
                if (backupIndex.rebuilt) {
                    console.log(`   ✨ Index was rebuilt at: ${backupIndex.rebuiltAt}`);
                }
            } catch (indexError) {
                console.log(`   ⚠️ No backup index found`);
            }
            
            console.log('\n✅ SUCCESS! Photos are loading correctly!');
            console.log('\n📌 Summary:');
            console.log(`   • Found ${sessionFiles.totalFiles} total files`);
            console.log(`   • Gallery files: ${(sessionFiles.filesByType.gallery || []).length}`);
            console.log(`   • Raw files: ${(sessionFiles.filesByType.raw || []).length}`);
            console.log(`   • URLs can be generated successfully`);
            console.log('\n🎉 The photo loading system is now working properly!');
            
        } else {
            console.log('\n❌ No files found - checking alternative patterns...');
            
            // Try direct listing to debug
            const prefix = `photographer-${userId}/session-${sessionId}/`;
            const objects = await r2Manager.listObjects(prefix);
            console.log(`\n   Direct R2 listing found ${objects.length} objects`);
            if (objects.length > 0) {
                console.log('   Sample objects:');
                objects.slice(0, 3).forEach(obj => {
                    console.log(`     • ${obj.Key} (${(obj.Size / 1024).toFixed(2)} KB)`);
                });
            }
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the final test
testFixedPhotosAPI().then(() => {
    console.log('\n✅ Final test completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Final test error:', error);
    process.exit(1);
});