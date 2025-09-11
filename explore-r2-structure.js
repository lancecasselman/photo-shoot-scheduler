const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function exploreR2Structure() {
    console.log('🔍 Exploring R2 Bucket Structure...\n');
    
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    
    if (!bucketName || !accountId || !accessKeyId || !secretAccessKey) {
        console.error('❌ R2 credentials not configured');
        return;
    }
    
    const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
        },
        forcePathStyle: true,
    });
    
    console.log(`Bucket: ${bucketName}`);
    console.log(`Endpoint: https://${accountId}.r2.cloudflarestorage.com\n`);
    
    // Test different prefix patterns to find where photos are stored
    const prefixesToTest = [
        '',  // List all top-level folders
        'sessions/',  // Check sessions folder
        'sessions/BFZI4tzu4rdsiZZSK63cqZ5yohw2/',  // Check user folder
        'sessions/BFZI4tzu4rdsiZZSK63cqZ5yohw2/d0892278-1882-4466-955f-fba2425e53ef/',  // Specific session
        'photographer-BFZI4tzu4rdsiZZSK63cqZ5yohw2/',  // Alternative pattern
        'photographer-BFZI4tzu4rdsiZZSK63cqZ5yohw2/session-d0892278-1882-4466-955f-fba2425e53ef/',  // Alternative pattern 2
        'BFZI4tzu4rdsiZZSK63cqZ5yohw2/',  // Just user ID
        'd0892278-1882-4466-955f-fba2425e53ef/',  // Just session ID
    ];
    
    for (const prefix of prefixesToTest) {
        console.log(`\n📂 Testing prefix: "${prefix}"`);
        console.log('─'.repeat(50));
        
        try {
            const listCommand = new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: prefix,
                MaxKeys: 20,  // Limit results for exploration
                Delimiter: prefix === '' ? '/' : undefined  // Use delimiter for top-level to see folders
            });
            
            const response = await s3Client.send(listCommand);
            
            // Show common prefixes (folders)
            if (response.CommonPrefixes && response.CommonPrefixes.length > 0) {
                console.log('📁 Folders found:');
                response.CommonPrefixes.forEach(prefix => {
                    console.log(`   • ${prefix.Prefix}`);
                });
            }
            
            // Show contents
            if (response.Contents && response.Contents.length > 0) {
                console.log(`📄 Objects found: ${response.Contents.length} (showing first 20)`);
                response.Contents.forEach(obj => {
                    const size = (obj.Size / 1024).toFixed(2);
                    const date = obj.LastModified ? obj.LastModified.toISOString().split('T')[0] : 'Unknown';
                    console.log(`   • ${obj.Key}`);
                    console.log(`     Size: ${size} KB, Modified: ${date}`);
                });
                
                if (response.IsTruncated) {
                    console.log(`   ... More objects available (truncated)`);
                }
            } else if (!response.CommonPrefixes || response.CommonPrefixes.length === 0) {
                console.log('   ❌ No objects or folders found with this prefix');
            }
            
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
        }
    }
    
    // Now search for the specific session in the database to understand the structure
    console.log('\n\n📊 Database Investigation:');
    console.log('─'.repeat(50));
    
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        // Check session details
        const sessionResult = await pool.query(
            `SELECT id, user_id, client_name, photos, created_at 
             FROM photography_sessions 
             WHERE id = $1`,
            ['d0892278-1882-4466-955f-fba2425e53ef']
        );
        
        if (sessionResult.rows.length > 0) {
            const session = sessionResult.rows[0];
            console.log('Session found in database:');
            console.log(`   ID: ${session.id}`);
            console.log(`   User ID: ${session.user_id}`);
            console.log(`   Client: ${session.client_name}`);
            console.log(`   Photos array length: ${session.photos ? session.photos.length : 0}`);
            
            if (session.photos && session.photos.length > 0) {
                console.log('\n   Sample photos from database:');
                session.photos.slice(0, 3).forEach(photo => {
                    console.log(`   • ${photo.filename || photo.originalName || photo}`);
                    if (photo.r2Key) {
                        console.log(`     R2 Key: ${photo.r2Key}`);
                    }
                });
            }
        } else {
            console.log('   ❌ Session not found in database');
        }
        
        // Check if there are any files in the photos table for this session
        const photosResult = await pool.query(
            `SELECT * FROM photos WHERE session_id = $1 LIMIT 5`,
            ['d0892278-1882-4466-955f-fba2425e53ef']
        );
        
        if (photosResult.rows.length > 0) {
            console.log(`\n   Photos table has ${photosResult.rows.length} entries for this session`);
            photosResult.rows.forEach(photo => {
                console.log(`   • ${photo.filename}`);
                if (photo.r2_key) {
                    console.log(`     R2 Key: ${photo.r2_key}`);
                }
            });
        }
        
    } catch (dbError) {
        console.error('Database error:', dbError.message);
    } finally {
        await pool.end();
    }
    
    console.log('\n✅ R2 Structure Exploration Complete!');
}

// Run the exploration
exploreR2Structure().catch(error => {
    console.error('❌ Exploration failed:', error);
    process.exit(1);
});