const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function checkR2Storage() {
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    
    const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
        },
        forcePathStyle: true,
    });
    
    console.log('🔍 Checking R2 Storage for session d0892278-1882-4466-955f-fba2425e53ef\n');
    
    try {
        // List all possible prefixes where photos might be stored
        const prefixes = [
            'users/44735007/sessions/d0892278-1882-4466-955f-fba2425e53ef/',
            'photographer-44735007/session-d0892278-1882-4466-955f-fba2425e53ef/',
            'sessions/d0892278-1882-4466-955f-fba2425e53ef/',
            'd0892278-1882-4466-955f-fba2425e53ef/'
        ];
        
        let totalFiles = 0;
        let allFiles = [];
        
        for (const prefix of prefixes) {
            console.log(`\n📁 Checking prefix: ${prefix}`);
            
            let continuationToken = undefined;
            let hasMore = true;
            let prefixFiles = [];
            
            while (hasMore) {
                const listCommand = new ListObjectsV2Command({
                    Bucket: bucketName,
                    Prefix: prefix,
                    MaxKeys: 1000,
                    ContinuationToken: continuationToken
                });
                
                try {
                    const response = await s3Client.send(listCommand);
                    
                    if (response.Contents && response.Contents.length > 0) {
                        prefixFiles = prefixFiles.concat(response.Contents);
                        continuationToken = response.NextContinuationToken;
                        hasMore = response.IsTruncated || false;
                    } else {
                        hasMore = false;
                    }
                } catch (error) {
                    console.log(`  ❌ Error listing with prefix ${prefix}: ${error.message}`);
                    hasMore = false;
                }
            }
            
            if (prefixFiles.length > 0) {
                console.log(`  ✅ Found ${prefixFiles.length} files`);
                totalFiles += prefixFiles.length;
                allFiles = allFiles.concat(prefixFiles);
                
                // Categorize files
                const originals = [];
                const thumbnails = {
                    sm: [],
                    md: [],
                    lg: []
                };
                
                prefixFiles.forEach(obj => {
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
                
                console.log(`  📊 Breakdown:`);
                console.log(`     - Original files: ${originals.length}`);
                console.log(`     - Small thumbnails: ${thumbnails.sm.length}`);
                console.log(`     - Medium thumbnails: ${thumbnails.md.length}`);
                console.log(`     - Large thumbnails: ${thumbnails.lg.length}`);
                
                // Show sample files
                if (originals.length > 0) {
                    console.log(`  📷 First 3 original files:`);
                    originals.slice(0, 3).forEach(f => console.log(`     - ${f}`));
                }
            } else {
                console.log(`  ⚠️ No files found with this prefix`);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 TOTAL SUMMARY:');
        console.log(`Total files found across all prefixes: ${totalFiles}`);
        
        if (totalFiles > 0) {
            // Deduplicate by filename
            const uniqueKeys = [...new Set(allFiles.map(f => f.Key))];
            console.log(`Unique file keys: ${uniqueKeys.length}`);
            
            // Analyze all unique files
            const allOriginals = [];
            const allThumbnails = {
                sm: [],
                md: [],
                lg: []
            };
            
            uniqueKeys.forEach(key => {
                const filename = key.split('/').pop();
                if (filename.includes('_sm.')) {
                    allThumbnails.sm.push(key);
                } else if (filename.includes('_md.')) {
                    allThumbnails.md.push(key);
                } else if (filename.includes('_lg.')) {
                    allThumbnails.lg.push(key);
                } else {
                    allOriginals.push(key);
                }
            });
            
            console.log('\n📸 FINAL FILE COUNTS:');
            console.log(`  - Original photos: ${allOriginals.length}`);
            console.log(`  - Small thumbnails: ${allThumbnails.sm.length}`);
            console.log(`  - Medium thumbnails: ${allThumbnails.md.length}`);
            console.log(`  - Large thumbnails: ${allThumbnails.lg.length}`);
            
            // Check for missing thumbnails
            console.log('\n🔍 THUMBNAIL ANALYSIS:');
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
            const imageOriginals = allOriginals.filter(key => {
                const ext = key.substring(key.lastIndexOf('.')).toLowerCase();
                return imageExtensions.includes(ext);
            });
            
            console.log(`Total image files that should have thumbnails: ${imageOriginals.length}`);
            
            const missingThumbnails = imageOriginals.filter(originalKey => {
                const parts = originalKey.split('/');
                const filename = parts.pop();
                const baseName = filename.substring(0, filename.lastIndexOf('.'));
                const dirPath = parts.join('/');
                
                const hasSmall = allThumbnails.sm.some(t => t.includes(baseName) && t.includes('_sm.'));
                const hasMedium = allThumbnails.md.some(t => t.includes(baseName) && t.includes('_md.'));
                const hasLarge = allThumbnails.lg.some(t => t.includes(baseName) && t.includes('_lg.'));
                
                return !hasSmall || !hasMedium || !hasLarge;
            });
            
            console.log(`Images missing at least one thumbnail size: ${missingThumbnails.length}`);
            
            if (missingThumbnails.length > 0) {
                console.log('\n⚠️ First 5 files needing thumbnails:');
                missingThumbnails.slice(0, 5).forEach(key => {
                    console.log(`  - ${key}`);
                });
            } else {
                console.log('✅ All image files have complete thumbnail sets!');
            }
            
            // Show the actual R2 keys for reference
            console.log('\n📁 Sample R2 keys (first 3):');
            uniqueKeys.slice(0, 3).forEach(key => {
                console.log(`  - ${key}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error checking R2 storage:', error);
    }
}

checkR2Storage().then(() => {
    console.log('\n✅ R2 storage check complete');
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});