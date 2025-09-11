const fetch = require('node-fetch');

// Test the photos API endpoint for session d0892278-1882-4466-955f-fba2425e53ef
// This session should have 10 photos stored at: sessions/BFZI4tzu4rdsiZZSK63cqZ5yohw2/d0892278-1882-4466-955f-fba2425e53ef/

async function testPhotosAPI() {
    try {
        console.log('🔍 Testing Photos API Endpoint...\n');
        
        // First, test the internal R2FileManager directly
        console.log('1. Testing R2FileManager directly:');
        const R2FileManager = require('./server/r2-file-manager');
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        const r2Manager = new R2FileManager(null, pool);
        
        // Test with the known session and user ID
        const sessionId = 'd0892278-1882-4466-955f-fba2425e53ef';
        const userId = 'BFZI4tzu4rdsiZZSK63cqZ5yohw2'; // Firebase UID from the path
        
        console.log(`   Session: ${sessionId}`);
        console.log(`   User ID: ${userId}`);
        console.log(`   Expected R2 prefix: sessions/${userId}/${sessionId}/\n`);
        
        // Get session files
        const sessionFiles = await r2Manager.getSessionFiles(userId, sessionId);
        
        console.log('2. Results from R2FileManager:');
        console.log(`   Total files found: ${sessionFiles.totalFiles}`);
        console.log(`   Total size: ${(sessionFiles.totalSize / (1024 * 1024)).toFixed(2)} MB`);
        console.log('\n   Files by type:');
        
        for (const [type, files] of Object.entries(sessionFiles.filesByType)) {
            if (files && files.length > 0) {
                console.log(`   - ${type}: ${files.length} files`);
                files.slice(0, 3).forEach(file => {
                    console.log(`     • ${file.filename} (${(file.fileSizeMB || 0).toFixed(2)} MB)`);
                });
                if (files.length > 3) {
                    console.log(`     ... and ${files.length - 3} more`);
                }
            }
        }
        
        // Also test listing objects directly
        console.log('\n3. Testing direct R2 listing:');
        const prefix = `sessions/${userId}/${sessionId}/`;
        const r2Objects = await r2Manager.listObjects(prefix);
        console.log(`   Found ${r2Objects.length} objects in R2 with prefix: ${prefix}`);
        
        if (r2Objects.length > 0) {
            console.log('   Sample objects:');
            r2Objects.slice(0, 5).forEach(obj => {
                console.log(`     • ${obj.Key} (${(obj.Size / 1024).toFixed(2)} KB)`);
            });
            if (r2Objects.length > 5) {
                console.log(`     ... and ${r2Objects.length - 5} more`);
            }
        }
        
        // Test backup index
        console.log('\n4. Checking backup index:');
        try {
            const backupIndex = await r2Manager.getSessionBackupIndex(userId, sessionId);
            console.log(`   Backup index found: ${backupIndex.totalFiles || 0} files`);
            if (backupIndex.rebuilt) {
                console.log(`   Index was rebuilt at: ${backupIndex.rebuiltAt}`);
            }
        } catch (indexError) {
            console.log(`   No backup index found (will be created automatically)`);
        }
        
        console.log('\n✅ Photo loading system test complete!');
        
        // Close the pool
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
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
});