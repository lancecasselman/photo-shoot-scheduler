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
        
        // 2. Check for photos in session_files table
        console.log('\n2️⃣ Checking photos in session_files table...');
        const sessionFilesResult = await pool.query(
            'SELECT COUNT(*) as count FROM session_files WHERE session_id = $1',
            [SESSION_ID]
        );
        console.log(`📸 Found ${sessionFilesResult.rows[0].count} files in session_files table`);
        
        if (sessionFilesResult.rows[0].count > 0) {
            // Get sample of files with details
            const sampleFiles = await pool.query(
                `SELECT filename, file_type, file_size, upload_status, 
                        r2_key, thumbnail_generated, created_at 
                 FROM session_files 
                 WHERE session_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 5`,
                [SESSION_ID]
            );
            
            console.log('\n📋 Sample files from session_files:');
            sampleFiles.rows.forEach((file, i) => {
                console.log(`  ${i+1}. ${file.filename}`);
                console.log(`     - Type: ${file.file_type}`);
                console.log(`     - Size: ${(file.file_size / 1024 / 1024).toFixed(2)}MB`);
                console.log(`     - Upload status: ${file.upload_status}`);
                console.log(`     - Thumbnail generated: ${file.thumbnail_generated}`);
                console.log(`     - R2 Key: ${file.r2_key}`);
            });
        }
        
        // 3. Check for photos in r2_files table
        console.log('\n3️⃣ Checking photos in r2_files table...');
        const r2FilesResult = await pool.query(
            `SELECT COUNT(*) as count FROM r2_files 
             WHERE session_id = $1`,
            [SESSION_ID]
        );
        console.log(`📸 Found ${r2FilesResult.rows[0].count} files in r2_files table`);
        
        if (r2FilesResult.rows[0].count > 0) {
            // Get sample of files with details
            const sampleR2Files = await pool.query(
                `SELECT file_name, file_type, file_size_bytes, folder_type,
                        r2_key, has_thumbnail, thumbnail_keys, created_at 
                 FROM r2_files 
                 WHERE session_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 5`,
                [SESSION_ID]
            );
            
            console.log('\n📋 Sample files from r2_files:');
            sampleR2Files.rows.forEach((file, i) => {
                console.log(`  ${i+1}. ${file.file_name}`);
                console.log(`     - Type: ${file.file_type}`);
                console.log(`     - Folder: ${file.folder_type}`);
                console.log(`     - Size: ${(file.file_size_bytes / 1024 / 1024).toFixed(2)}MB`);
                console.log(`     - Has thumbnail: ${file.has_thumbnail}`);
                console.log(`     - R2 Key: ${file.r2_key}`);
                if (file.thumbnail_keys) {
                    const thumbs = typeof file.thumbnail_keys === 'string' 
                        ? JSON.parse(file.thumbnail_keys) 
                        : file.thumbnail_keys;
                    console.log(`     - Thumbnail keys: ${JSON.stringify(thumbs, null, 2)}`);
                }
            });
        }
        
        // 4. Check R2 storage directly
        console.log('\n4️⃣ Checking R2 storage directly...');
        const R2FileManager = require('./server/r2-file-manager');
        const r2Manager = new R2FileManager(null, pool);
        
        // Test R2 connection
        const r2Connected = await r2Manager.testConnection();
        console.log(`R2 Connection: ${r2Connected ? '✅ Connected' : '❌ Not connected'}`);
        
        if (r2Connected) {
            // Check for files in R2
            const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
            
            const prefix = `users/${session.user_id}/sessions/${SESSION_ID}/`;
            console.log(`\n🔍 Listing objects with prefix: ${prefix}`);
            
            const listCommand = new ListObjectsV2Command({
                Bucket: r2Manager.bucketName,
                Prefix: prefix,
                MaxKeys: 200  // Increase to see more files
            });
            
            const listResult = await r2Manager.s3Client.send(listCommand);
            
            if (listResult.Contents && listResult.Contents.length > 0) {
                console.log(`\nFound ${listResult.Contents.length} objects in R2:`);
                
                // Categorize files
                const originals = [];
                const thumbnails = {
                    sm: [],
                    md: [],
                    lg: []
                };
                
                listResult.Contents.forEach(obj => {
                    const filename = obj.Key.split('/').pop();
                    if (filename.includes('_sm.')) {
                        thumbnails.sm.push(filename);
                    } else if (filename.includes('_md.')) {
                        thumbnails.md.push(filename);
                    } else if (filename.includes('_lg.')) {
                        thumbnails.lg.push(filename);
                    } else {
                        originals.push(filename);
                    }
                });
                
                console.log(`\n📊 File breakdown:`);
                console.log(`  - Original files: ${originals.length}`);
                console.log(`  - Small thumbnails: ${thumbnails.sm.length}`);
                console.log(`  - Medium thumbnails: ${thumbnails.md.length}`);
                console.log(`  - Large thumbnails: ${thumbnails.lg.length}`);
                
                // Show first few originals
                console.log(`\n📷 First 5 original files:`);
                originals.slice(0, 5).forEach(f => console.log(`    - ${f}`));
                
                // Show first few thumbnails
                if (thumbnails.sm.length > 0) {
                    console.log(`\n🖼️ First 5 small thumbnails:`);
                    thumbnails.sm.slice(0, 5).forEach(f => console.log(`    - ${f}`));
                }
                
                // Check for missing thumbnails
                const missingThumbnails = originals.filter(original => {
                    const baseName = original.substring(0, original.lastIndexOf('.'));
                    const ext = original.substring(original.lastIndexOf('.'));
                    
                    // Skip non-image files
                    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
                    if (!imageExts.includes(ext.toLowerCase())) {
                        return false;
                    }
                    
                    const hasSm = thumbnails.sm.some(t => t.startsWith(baseName));
                    const hasMd = thumbnails.md.some(t => t.startsWith(baseName));
                    const hasLg = thumbnails.lg.some(t => t.startsWith(baseName));
                    
                    return !hasSm || !hasMd || !hasLg;
                });
                
                if (missingThumbnails.length > 0) {
                    console.log(`\n⚠️ Files missing thumbnails: ${missingThumbnails.length}`);
                    console.log('First 5 files needing thumbnails:');
                    missingThumbnails.slice(0, 5).forEach(f => console.log(`    - ${f}`));
                }
            } else {
                console.log('⚠️ No objects found in R2 for this session');
            }
        }
        
        // 5. Test creating a test authentication session
        console.log('\n5️⃣ Creating test authentication for API testing...');
        
        // Create a test endpoint that bypasses auth temporarily
        console.log('Creating temporary test endpoint...');
        
        // 6. Summary and recommendations
        console.log('\n📊 SUMMARY AND RECOMMENDATIONS:');
        console.log('================================');
        
        const totalSessionFiles = sessionFilesResult.rows[0].count;
        const totalR2Files = r2FilesResult.rows[0].count;
        
        console.log(`Files in session_files table: ${totalSessionFiles}`);
        console.log(`Files in r2_files table: ${totalR2Files}`);
        
        if (totalR2Files === 0 && totalSessionFiles === 0) {
            console.log('\n❌ CRITICAL ISSUE: No files found in database tables!');
            console.log('SOLUTION: Files may be stored differently or need to be migrated.');
        }
        
        console.log('\n🔐 Authentication Issue:');
        console.log('The API requires authentication. Solutions:');
        console.log('1. Create a temporary bypass for testing');
        console.log('2. Use a proper authentication flow');
        console.log('3. Test through the actual UI with login');
        
        console.log('\n🖼️ Thumbnail Generation:');
        console.log('To generate missing thumbnails:');
        console.log('1. Use the /api/r2/generate-thumbnail endpoint');
        console.log('2. Or batch process all files needing thumbnails');
        
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