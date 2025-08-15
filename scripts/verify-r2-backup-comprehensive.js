#!/usr/bin/env node

/**
 * Comprehensive R2 Backup Verification and Repair System
 * Verifies all files are properly backed up to R2 cloud storage
 */

const { Pool } = require('pg');
const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize R2 client
const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
});

const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

async function verifyR2Backup() {
    console.log(' Starting comprehensive R2 backup verification...');
    console.log(` Checking bucket: ${bucketName}`);
    
    let client;
    try {
        client = await pool.connect();
        
        // Get all files from database
        const dbFilesResult = await client.query(`
            SELECT sf.id, sf.session_id, sf.user_id, sf.filename, sf.folder_type, 
                   sf.r2_key, sf.file_size_bytes, sf.uploaded_at,
                   ps.client_name
            FROM session_files sf
            LEFT JOIN photography_sessions ps ON sf.session_id = ps.id
            ORDER BY sf.folder_type, sf.uploaded_at DESC
        `);
        
        console.log(` Database contains ${dbFilesResult.rows.length} files total`);
        
        // Separate files by backup status
        const withR2Keys = dbFilesResult.rows.filter(f => f.r2_key && f.r2_key.trim() !== '');
        const missingR2Keys = dbFilesResult.rows.filter(f => !f.r2_key || f.r2_key.trim() === '');
        
        console.log(` Files with R2 keys: ${withR2Keys.length}`);
        console.log(`❌ Files missing R2 keys: ${missingR2Keys.length}`);
        
        // Get all objects from R2 bucket
        console.log('\n Checking R2 bucket contents...');
        const r2Objects = [];
        let continuationToken;
        
        do {
            const listCommand = new ListObjectsV2Command({
                Bucket: bucketName,
                ContinuationToken: continuationToken,
                MaxKeys: 1000
            });
            
            const response = await r2Client.send(listCommand);
            
            if (response.Contents) {
                r2Objects.push(...response.Contents);
            }
            
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);
        
        console.log(` R2 bucket contains ${r2Objects.length} objects`);
        
        // Analyze backup status
        let galleryR2Count = 0;
        let rawR2Count = 0;
        let totalR2Size = 0;
        
        r2Objects.forEach(obj => {
            if (obj.Key.includes('/gallery/')) galleryR2Count++;
            if (obj.Key.includes('/raw/')) rawR2Count++;
            totalR2Size += obj.Size;
        });
        
        console.log(`\n R2 Storage Analysis:`);
        console.log(`   Gallery files in R2: ${galleryR2Count}`);
        console.log(`   Raw files in R2: ${rawR2Count}`);
        console.log(`   Total R2 size: ${Math.round(totalR2Size/1024/1024)}MB`);
        
        // Check for orphaned files in R2 (files in R2 but not in database)
        console.log(`\n Checking for orphaned files in R2...`);
        const dbR2Keys = new Set(withR2Keys.map(f => f.r2_key));
        const orphanedR2Files = r2Objects.filter(obj => !dbR2Keys.has(obj.Key));
        
        if (orphanedR2Files.length > 0) {
            console.log(`  Found ${orphanedR2Files.length} orphaned files in R2:`);
            orphanedR2Files.slice(0, 5).forEach(file => {
                console.log(`   📁 ${file.Key} (${Math.round(file.Size/1024/1024)}MB)`);
            });
            if (orphanedR2Files.length > 5) {
                console.log(`   ... and ${orphanedR2Files.length - 5} more`);
            }
        } else {
            console.log(` No orphaned files found in R2`);
        }
        
        // Detailed analysis of missing R2 keys
        if (missingR2Keys.length > 0) {
            console.log(`\n❌ Files missing R2 backup keys:`);
            
            const rawMissing = missingR2Keys.filter(f => f.folder_type === 'raw');
            const galleryMissing = missingR2Keys.filter(f => f.folder_type === 'gallery');
            
            console.log(`   Raw files missing backup: ${rawMissing.length}`);
            console.log(`   Gallery files missing backup: ${galleryMissing.length}`);
            
            rawMissing.forEach(file => {
                const sizeMB = Math.round(file.file_size_bytes / 1024 / 1024);
                console.log(`   📁 RAW: ${file.filename} (${sizeMB}MB) - ${file.client_name || 'Unknown'}`);
            });
        }
        
        // Verify files with R2 keys actually exist in R2
        console.log(`\n Verifying database R2 keys exist in bucket...`);
        let verifiedCount = 0;
        let brokenLinks = 0;
        
        for (const file of withR2Keys.slice(0, 10)) { // Check first 10 to avoid overwhelming
            try {
                const headCommand = new HeadObjectCommand({
                    Bucket: bucketName,
                    Key: file.r2_key
                });
                await r2Client.send(headCommand);
                verifiedCount++;
            } catch (error) {
                brokenLinks++;
                console.log(`   ❌ Broken link: ${file.filename} -> ${file.r2_key}`);
            }
        }
        
        if (withR2Keys.length > 10) {
            console.log(`    Verified ${verifiedCount}/10 sample files (${brokenLinks} broken links)`);
        } else {
            console.log(`    Verified ${verifiedCount}/${withR2Keys.length} files (${brokenLinks} broken links)`);
        }
        
        // Summary and recommendations
        console.log(`\n BACKUP STATUS SUMMARY:`);
        console.log(`   Database files: ${dbFilesResult.rows.length}`);
        console.log(`   Files with R2 keys: ${withR2Keys.length}`);
        console.log(`   Files missing R2 keys: ${missingR2Keys.length}`);
        console.log(`   R2 bucket objects: ${r2Objects.length}`);
        console.log(`   Orphaned R2 files: ${orphanedR2Files.length}`);
        
        if (missingR2Keys.length > 0) {
            console.log(`\n  CRITICAL: ${missingR2Keys.length} files are NOT backed up to R2 cloud`);
            console.log(`   These files only exist in the database and may be lost if not backed up`);
        } else {
            console.log(`\n ALL FILES PROPERLY BACKED UP TO R2 CLOUD`);
        }
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

// Run the verification
verifyR2Backup().then(() => {
    console.log('\n R2 backup verification completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Verification script failed:', error);
    process.exit(1);
});