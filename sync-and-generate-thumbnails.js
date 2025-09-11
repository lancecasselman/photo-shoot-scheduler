const { Pool } = require('pg');
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');
const R2FileManager = require('./server/r2-file-manager');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const SESSION_ID = 'd0892278-1882-4466-955f-fba2425e53ef';
const USER_ID = '44735007';

async function syncAndGenerateThumbnails() {
    console.log('🔄 Starting R2 to Database sync and thumbnail generation...\n');
    
    const r2Manager = new R2FileManager(null, pool);
    
    try {
        // 1. Get all files from R2
        console.log('1️⃣ Fetching all files from R2...');
        const prefix = `photographer-${USER_ID}/session-${SESSION_ID}/`;
        
        let allFiles = [];
        let continuationToken = undefined;
        let hasMore = true;
        
        while (hasMore) {
            const listCommand = new ListObjectsV2Command({
                Bucket: r2Manager.bucketName,
                Prefix: prefix,
                MaxKeys: 1000,
                ContinuationToken: continuationToken
            });
            
            const response = await r2Manager.s3Client.send(listCommand);
            
            if (response.Contents && response.Contents.length > 0) {
                allFiles = allFiles.concat(response.Contents);
                continuationToken = response.NextContinuationToken;
                hasMore = response.IsTruncated || false;
            } else {
                hasMore = false;
            }
        }
        
        console.log(`✅ Found ${allFiles.length} total files in R2`);
        
        // 2. Filter to get only original images (not thumbnails or json)
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const originalImages = allFiles.filter(file => {
            const filename = file.Key.split('/').pop();
            const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
            return imageExtensions.includes(ext) && 
                   !filename.includes('_sm.') && 
                   !filename.includes('_md.') && 
                   !filename.includes('_lg.') &&
                   !filename.endsWith('.json');
        });
        
        console.log(`📸 Found ${originalImages.length} original images\n`);
        
        // 3. Check which files exist in database
        console.log('2️⃣ Checking database for existing records...');
        const existingFiles = await pool.query(
            'SELECT r2_key FROM r2_files WHERE session_id = $1',
            [SESSION_ID]
        );
        const existingKeys = new Set(existingFiles.rows.map(r => r.r2_key));
        console.log(`📊 Found ${existingKeys.size} files already in database`);
        
        // 4. Add missing files to database
        const missingFiles = originalImages.filter(file => !existingKeys.has(file.Key));
        console.log(`⚠️ Need to add ${missingFiles.length} files to database\n`);
        
        if (missingFiles.length > 0) {
            console.log('3️⃣ Adding missing files to database...');
            let addedCount = 0;
            
            for (const file of missingFiles) {
                const filename = file.Key.split('/').pop();
                const folderType = file.Key.includes('/gallery/') ? 'gallery' : 
                                  file.Key.includes('/raw/') ? 'raw' : 'gallery';
                const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
                
                try {
                    await pool.query(`
                        INSERT INTO r2_files (
                            id, session_id, user_id, filename, original_filename,
                            file_type, file_extension, file_size_bytes, file_size_mb,
                            r2_key, upload_status, created_at
                        ) VALUES (
                            gen_random_uuid(), $1, $2, $3, $3,
                            $4, $5, $6, $7,
                            $8, 'completed', NOW()
                        )
                    `, [
                        SESSION_ID,
                        USER_ID,
                        filename,
                        folderType,
                        ext.replace('.', ''),
                        file.Size,
                        (file.Size / 1024 / 1024).toFixed(2),
                        file.Key
                    ]);
                    
                    addedCount++;
                    if (addedCount % 10 === 0) {
                        console.log(`  Added ${addedCount}/${missingFiles.length} files...`);
                    }
                } catch (error) {
                    console.log(`  ⚠️ Error adding ${filename}: ${error.message}`);
                }
            }
            
            console.log(`✅ Added ${addedCount} files to database\n`);
        }
        
        // 5. Check for missing thumbnails
        console.log('4️⃣ Checking for missing thumbnails...');
        const thumbnails = allFiles.filter(file => {
            const filename = file.Key.split('/').pop();
            return filename.includes('_sm.') || filename.includes('_md.') || filename.includes('_lg.');
        });
        
        const thumbnailMap = {};
        thumbnails.forEach(thumb => {
            const filename = thumb.Key.split('/').pop();
            const baseName = filename.substring(0, filename.lastIndexOf('_'));
            if (!thumbnailMap[baseName]) {
                thumbnailMap[baseName] = { sm: false, md: false, lg: false };
            }
            if (filename.includes('_sm.')) thumbnailMap[baseName].sm = true;
            if (filename.includes('_md.')) thumbnailMap[baseName].md = true;
            if (filename.includes('_lg.')) thumbnailMap[baseName].lg = true;
        });
        
        const imagesNeedingThumbnails = [];
        originalImages.forEach(img => {
            const filename = img.Key.split('/').pop();
            const baseName = filename.substring(0, filename.lastIndexOf('.'));
            
            if (!thumbnailMap[baseName] || 
                !thumbnailMap[baseName].sm || 
                !thumbnailMap[baseName].md || 
                !thumbnailMap[baseName].lg) {
                imagesNeedingThumbnails.push(img);
            }
        });
        
        console.log(`📊 ${imagesNeedingThumbnails.length} images need thumbnail generation\n`);
        
        // 6. Generate missing thumbnails (batch process, max 20 at a time to avoid timeout)
        if (imagesNeedingThumbnails.length > 0) {
            console.log('5️⃣ Generating missing thumbnails...');
            console.log('  (Processing in batches to avoid timeouts)');
            
            const batchSize = 20;
            const totalBatches = Math.ceil(imagesNeedingThumbnails.length / batchSize);
            let processedCount = 0;
            let successCount = 0;
            let skipCount = 0;
            
            for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
                const start = batchNum * batchSize;
                const end = Math.min(start + batchSize, imagesNeedingThumbnails.length);
                const batch = imagesNeedingThumbnails.slice(start, end);
                
                console.log(`\n  Batch ${batchNum + 1}/${totalBatches} (${batch.length} images)...`);
                
                for (const img of batch) {
                    const filename = img.Key.split('/').pop();
                    processedCount++;
                    
                    try {
                        // Get the image from R2
                        const getCommand = new GetObjectCommand({
                            Bucket: r2Manager.bucketName,
                            Key: img.Key
                        });
                        
                        const response = await r2Manager.s3Client.send(getCommand);
                        
                        // Convert stream to buffer
                        const chunks = [];
                        for await (const chunk of response.Body) {
                            chunks.push(chunk);
                        }
                        const fileBuffer = Buffer.concat(chunks);
                        
                        // Generate thumbnails using R2FileManager
                        const result = await r2Manager.generateThumbnail(
                            fileBuffer,
                            filename,
                            USER_ID,
                            SESSION_ID,
                            'gallery'
                        );
                        
                        if (result && result.success) {
                            successCount++;
                            console.log(`    ✅ [${processedCount}/${imagesNeedingThumbnails.length}] Generated thumbnails for ${filename}`);
                        } else if (result && result.skipped) {
                            skipCount++;
                            console.log(`    ⏭️  [${processedCount}/${imagesNeedingThumbnails.length}] Skipped ${filename} (unsupported format)`);
                        } else {
                            console.log(`    ⚠️  [${processedCount}/${imagesNeedingThumbnails.length}] Failed for ${filename}`);
                        }
                        
                    } catch (error) {
                        console.log(`    ❌ [${processedCount}/${imagesNeedingThumbnails.length}] Error processing ${filename}: ${error.message}`);
                    }
                    
                    // Add a small delay between files to avoid overwhelming the system
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                console.log(`  Batch ${batchNum + 1} complete. Progress: ${processedCount}/${imagesNeedingThumbnails.length}`);
            }
            
            console.log(`\n✅ Thumbnail generation complete:`);
            console.log(`   - Successfully generated: ${successCount}`);
            console.log(`   - Skipped (unsupported): ${skipCount}`);
            console.log(`   - Failed: ${processedCount - successCount - skipCount}`);
        }
        
        // 7. Update database with thumbnail status
        console.log('\n6️⃣ Updating database with thumbnail status...');
        
        // Re-check R2 for thumbnails after generation
        const updatedThumbnails = [];
        let token = undefined;
        let more = true;
        
        while (more) {
            const listCmd = new ListObjectsV2Command({
                Bucket: r2Manager.bucketName,
                Prefix: prefix,
                MaxKeys: 1000,
                ContinuationToken: token
            });
            
            const resp = await r2Manager.s3Client.send(listCmd);
            
            if (resp.Contents && resp.Contents.length > 0) {
                const thumbs = resp.Contents.filter(f => {
                    const name = f.Key.split('/').pop();
                    return name.includes('_sm.') || name.includes('_md.') || name.includes('_lg.');
                });
                updatedThumbnails.push(...thumbs);
                token = resp.NextContinuationToken;
                more = resp.IsTruncated || false;
            } else {
                more = false;
            }
        }
        
        console.log(`Found ${updatedThumbnails.length} total thumbnails in R2`);
        
        // Final summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 FINAL SUMMARY:');
        console.log(`  - Total files in R2: ${allFiles.length}`);
        console.log(`  - Original images: ${originalImages.length}`);
        console.log(`  - Files in database: ${existingKeys.size + missingFiles.length}`);
        console.log(`  - Total thumbnails: ${updatedThumbnails.length}`);
        console.log(`  - Expected thumbnails (3 per image): ${originalImages.length * 3}`);
        
        if (updatedThumbnails.length >= originalImages.length * 3 * 0.8) {
            console.log('\n✅ Thumbnail coverage is good (>80%)');
        } else {
            console.log('\n⚠️ Some thumbnails may still be missing');
            console.log('   This could be due to unsupported formats (RAW files, etc.)');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

// Run the sync
syncAndGenerateThumbnails().then(() => {
    console.log('\n✅ Sync and thumbnail generation complete');
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});