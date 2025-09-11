const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

async function fixBackupIndex() {
    console.log('🔧 Fixing Backup Index for Session d0892278-1882-4466-955f-fba2425e53ef\n');
    
    const R2FileManager = require('./server/r2-file-manager');
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const r2Manager = new R2FileManager(null, pool);
    
    const sessionId = 'd0892278-1882-4466-955f-fba2425e53ef';
    const userId = '44735007';
    
    console.log('1️⃣ Deleting corrupted backup index...');
    const indexKey = `photographer-${userId}/session-${sessionId}/backup-index.json`;
    
    try {
        const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Key: indexKey
        });
        await r2Manager.s3Client.send(deleteCommand);
        console.log('   ✅ Deleted corrupted backup index');
    } catch (error) {
        console.log('   ⚠️ No existing index to delete or error:', error.message);
    }
    
    console.log('\n2️⃣ Listing actual files in R2...');
    const prefix = `photographer-${userId}/session-${sessionId}/`;
    const objects = await r2Manager.listObjects(prefix);
    
    console.log(`   Found ${objects.length} objects in R2`);
    
    // Filter out thumbnails and backup files to get actual photos
    const photoFiles = objects.filter(obj => {
        const key = obj.Key;
        return !key.endsWith('backup-index.json') && 
               !key.endsWith('backups.json') &&
               !key.includes('_sm.') && 
               !key.includes('_md.') && 
               !key.includes('_lg.') &&
               !key.includes('/thumbnails/');
    });
    
    console.log(`   Found ${photoFiles.length} actual photo files`);
    
    if (photoFiles.length > 0) {
        console.log('\n3️⃣ Sample files found:');
        photoFiles.slice(0, 5).forEach(obj => {
            const filename = obj.Key.split('/').pop();
            const folder = obj.Key.includes('/gallery/') ? 'gallery' : 
                          obj.Key.includes('/raw/') ? 'raw' : 'other';
            console.log(`   • ${filename} (${folder}, ${(obj.Size / (1024 * 1024)).toFixed(2)} MB)`);
        });
        
        console.log('\n4️⃣ Rebuilding backup index with correct data...');
        
        // Prepare files for index rebuild
        const indexFiles = photoFiles.map(obj => {
            const filename = obj.Key.split('/').pop();
            return {
                filename: filename,
                r2Key: obj.Key,
                fileSizeBytes: obj.Size || 0,
                contentType: r2Manager.getContentType(filename),
                originalFormat: filename.split('.').pop(),
                uploadedAt: obj.LastModified ? obj.LastModified.toISOString() : new Date().toISOString()
            };
        });
        
        // Rebuild the index
        const newIndex = await r2Manager.rebuildBackupIndex(userId, sessionId, indexFiles);
        console.log(`   ✅ Rebuilt backup index with ${newIndex.totalFiles} files`);
        console.log(`   Total size: ${(newIndex.totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`);
        
        console.log('\n5️⃣ Testing getSessionFiles() again...');
        const sessionFiles = await r2Manager.getSessionFiles(userId, sessionId);
        
        console.log(`   ✅ Total files found: ${sessionFiles.totalFiles}`);
        console.log(`   Total size: ${(sessionFiles.totalSize / (1024 * 1024)).toFixed(2)} MB`);
        
        console.log('\n   📁 Files by type:');
        for (const [type, files] of Object.entries(sessionFiles.filesByType)) {
            if (files && files.length > 0) {
                console.log(`      ${type}: ${files.length} files`);
            }
        }
        
        console.log('\n✅ Backup index fixed successfully!');
        console.log('\n📌 The photos should now load correctly in:');
        console.log('   • Gallery Manager: /gallery-manager.html?sessionId=' + sessionId);
        console.log('   • Photos API: /api/sessions/' + sessionId + '/photos');
        
    } else {
        console.log('\n❌ No photo files found in R2 for this session');
        console.log('   The session may not have any uploaded photos yet');
    }
    
    await pool.end();
}

// Run the fix
fixBackupIndex().then(() => {
    console.log('\n✅ Backup index fix completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
});