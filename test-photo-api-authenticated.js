const fetch = require('node-fetch');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const SESSION_ID = 'd0892278-1882-4466-955f-fba2425e53ef';
const BASE_URL = 'http://localhost:5000';

async function testPhotoAPI() {
    console.log('🔍 Starting comprehensive photo API test...\n');
    
    try {
        // 1. First, check if the session exists in the database
        console.log('1️⃣ Checking session in database...');
        const sessionResult = await pool.query(
            'SELECT id, client_name, user_id, location FROM photography_sessions WHERE id = $1',
            [SESSION_ID]
        );
        
        if (sessionResult.rows.length === 0) {
            console.error('❌ Session not found in database!');
            return;
        }
        
        const session = sessionResult.rows[0];
        console.log('✅ Session found:', {
            id: session.id,
            client_name: session.client_name,
            user_id: session.user_id,
            location: session.location
        });
        
        // 2. Check for photos in the database
        console.log('\n2️⃣ Checking photos in database...');
        const photosResult = await pool.query(
            'SELECT COUNT(*) as count FROM session_photos WHERE session_id = $1',
            [SESSION_ID]
        );
        console.log(`📸 Found ${photosResult.rows[0].count} photos in database`);
        
        // Get sample of photos with details
        const samplePhotos = await pool.query(
            `SELECT filename, file_type, file_size_mb, has_thumbnail, 
                    thumbnail_urls, r2_key, created_at 
             FROM session_photos 
             WHERE session_id = $1 
             ORDER BY created_at DESC 
             LIMIT 5`,
            [SESSION_ID]
        );
        
        console.log('\n📋 Sample photos:');
        samplePhotos.rows.forEach((photo, i) => {
            console.log(`  ${i+1}. ${photo.filename}`);
            console.log(`     - Type: ${photo.file_type}`);
            console.log(`     - Size: ${photo.file_size_mb}MB`);
            console.log(`     - Has thumbnail: ${photo.has_thumbnail}`);
            console.log(`     - R2 Key: ${photo.r2_key}`);
            if (photo.thumbnail_urls) {
                const thumbs = typeof photo.thumbnail_urls === 'string' 
                    ? JSON.parse(photo.thumbnail_urls) 
                    : photo.thumbnail_urls;
                console.log(`     - Thumbnails: ${Object.keys(thumbs).join(', ')}`);
            }
        });
        
        // 3. Check R2 storage for thumbnails
        console.log('\n3️⃣ Checking R2 storage for thumbnails...');
        const R2FileManager = require('./server/r2-file-manager');
        const r2Manager = new R2FileManager(null, pool);
        
        // Test R2 connection
        const r2Connected = await r2Manager.testConnection();
        console.log(`R2 Connection: ${r2Connected ? '✅ Connected' : '❌ Not connected'}`);
        
        if (r2Connected) {
            // Check for thumbnails in R2
            const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
            
            const prefix = `users/${session.user_id}/sessions/${SESSION_ID}/`;
            console.log(`\n🔍 Listing objects with prefix: ${prefix}`);
            
            const listCommand = new ListObjectsV2Command({
                Bucket: r2Manager.bucketName,
                Prefix: prefix,
                MaxKeys: 10
            });
            
            const listResult = await r2Manager.s3Client.send(listCommand);
            
            if (listResult.Contents && listResult.Contents.length > 0) {
                console.log(`Found ${listResult.Contents.length} objects in R2:`);
                listResult.Contents.forEach(obj => {
                    const filename = obj.Key.split('/').pop();
                    const size = (obj.Size / 1024 / 1024).toFixed(2);
                    console.log(`  - ${filename} (${size}MB)`);
                });
                
                // Check specifically for thumbnails
                const thumbnailCount = listResult.Contents.filter(obj => 
                    obj.Key.includes('_sm.') || 
                    obj.Key.includes('_md.') || 
                    obj.Key.includes('_lg.')
                ).length;
                
                console.log(`\n📊 Thumbnail summary:`);
                console.log(`  - Total objects: ${listResult.Contents.length}`);
                console.log(`  - Thumbnails found: ${thumbnailCount}`);
            } else {
                console.log('⚠️ No objects found in R2 for this session');
            }
        }
        
        // 4. Test the API endpoint directly (without authentication for now)
        console.log('\n4️⃣ Testing API endpoint response structure...');
        
        // We'll need to simulate authentication - let's check if there's a way to test
        // For now, let's at least check what the API would return if authenticated
        
        // Create a test function that simulates what the API should return
        console.log('\n📋 Expected API response structure:');
        console.log('The API should return an array of photo objects with:');
        console.log('  - fileName: The filename');
        console.log('  - url: Presigned URL for the full image');
        console.log('  - thumbnails: Object with sm, md, lg URLs');
        console.log('  - fileSize: Size in MB');
        console.log('  - uploadDate: Upload timestamp');
        
        // 5. Test thumbnail generation
        console.log('\n5️⃣ Testing thumbnail generation capability...');
        
        // Get one photo without thumbnails
        const noThumbResult = await pool.query(
            `SELECT filename, r2_key FROM session_photos 
             WHERE session_id = $1 AND has_thumbnail = false 
             LIMIT 1`,
            [SESSION_ID]
        );
        
        if (noThumbResult.rows.length > 0) {
            const testPhoto = noThumbResult.rows[0];
            console.log(`\n🔧 Found photo without thumbnail: ${testPhoto.filename}`);
            console.log('   Attempting to generate thumbnail...');
            
            // We would call the thumbnail generation API here
            // But we need authentication first
            console.log('   ⚠️ Thumbnail generation requires authenticated API call');
        } else {
            console.log('✅ All photos already have thumbnails marked in database');
        }
        
        // 6. Summary and recommendations
        console.log('\n📊 SUMMARY AND RECOMMENDATIONS:');
        console.log('================================');
        
        const totalPhotos = photosResult.rows[0].count;
        const photosWithThumbs = await pool.query(
            'SELECT COUNT(*) as count FROM session_photos WHERE session_id = $1 AND has_thumbnail = true',
            [SESSION_ID]
        );
        const thumbCount = photosWithThumbs.rows[0].count;
        
        console.log(`Total photos: ${totalPhotos}`);
        console.log(`Photos with thumbnails: ${thumbCount}`);
        console.log(`Photos needing thumbnails: ${totalPhotos - thumbCount}`);
        
        if (totalPhotos - thumbCount > 0) {
            console.log('\n⚠️ ISSUE FOUND: Not all photos have thumbnails');
            console.log('SOLUTION: Need to run thumbnail generation for missing thumbnails');
        }
        
        console.log('\n🔐 Authentication Issue:');
        console.log('The API requires authentication. To test properly, we need to:');
        console.log('1. Create a test user session');
        console.log('2. Or temporarily bypass authentication for testing');
        console.log('3. Or use the gallery manager with proper login');
        
    } catch (error) {
        console.error('❌ Error during test:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

// Run the test
testPhotoAPI().then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});