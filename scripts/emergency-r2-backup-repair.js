#!/usr/bin/env node

/**
 * EMERGENCY R2 BACKUP REPAIR SYSTEM
 * Critical script to identify and repair missing R2 backups
 */

const { Pool } = require('pg');
const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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

const { Pool } = require('pg');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const r2Client = new S3Client({
    endpoint: process.env.R2_ENDPOINT,
    region: 'auto',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY,
        secretAccessKey: process.env.R2_SECRET_KEY
    }
});

const bucketName = process.env.R2_BUCKET_NAME;

async function repairR2Backup() {
    console.log('🚨 EMERGENCY R2 BACKUP REPAIR STARTING...');
    
    let client;
    try {
        client = await pool.connect();
        
        // Get files missing R2 keys
        const missingR2Result = await client.query(`
            SELECT sf.id, sf.session_id, sf.user_id, sf.filename, sf.folder_type, 
                   sf.file_size_bytes, sf.uploaded_at,
                   ps.client_name
            FROM session_files sf
            LEFT JOIN photography_sessions ps ON sf.session_id = ps.id
            WHERE sf.r2_key IS NULL OR sf.r2_key = ''
            ORDER BY sf.folder_type, sf.uploaded_at DESC
        `);
        
        console.log(` Found ${missingR2Result.rows.length} files missing R2 backup`);
        
        // Get all R2 objects for matching
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
        
        console.log(` R2 contains ${r2Objects.length} objects to match against`);
        
        let matchedCount = 0;
        let unmatchedCount = 0; 0;
        
        // Try to match database entries with R2 objects
        for (const dbFile of missingR2Result.rows) {
            try {
                // Look for potential matches in R2
                const potentialMatches = r2Objects.filter(r2Obj => {
                    const r2Filename = r2Obj.Key.split('/').pop();
                    const r2FolderType = r2Obj.Key.includes('/gallery/') ? 'gallery' : 
                                       r2Obj.Key.includes('/raw/') ? 'raw' : 'unknown';
                    
                    // Check if filename and folder type match
                    return (r2Filename === dbFile.filename || 
                            dbFile.filename.includes(r2Filename) || 
                            r2Filename.includes(dbFile.filename)) &&
                           r2FolderType === dbFile.folder_type;
                });
                
                if (potentialMatches.length === 1) {
                    // Perfect match - update database
                    const match = potentialMatches[0];
                    
                    await client.query(`
                        UPDATE session_files 
                        SET r2_key = $1
                        WHERE id = $2
                    `, [match.Key, dbFile.id]);
                    
                    console.log(` Linked: ${dbFile.filename} -> ${match.Key}`);
                    matchedCount++;
                    
                } else if (potentialMatches.length > 1) {
                    console.log(`🤔 Multiple matches for ${dbFile.filename}:`);
                    potentialMatches.forEach(match => {
                        console.log(`   - ${match.Key}`);
                    });
                } else {
                    console.log(`❌ No match found for ${dbFile.filename} (${dbFile.folder_type})`);
                    unmatchedCount++;
                }
                
            } catch (error) {
                console.error(`Error processing ${dbFile.filename}:`, error.message);
            }
        }
        
        // Summary
        console.log(`\n REPAIR SUMMARY:`);
        console.log(`    Successfully linked: ${matchedCount} files`);
        console.log(`   ❌ Could not match: ${unmatchedCount} files`);
        
        // Verify repair results
        const verificationResult = await client.query(`
            SELECT 
                folder_type,
                COUNT(*) as total_files,
                COUNT(CASE WHEN r2_key IS NOT NULL AND r2_key != '' THEN 1 END) as backed_up_files,
                COUNT(CASE WHEN r2_key IS NULL OR r2_key = '' THEN 1 END) as missing_backup
            FROM session_files 
            GROUP BY folder_type
        `);
        
        console.log(`\n POST-REPAIR VERIFICATION:`);
        for (const row of verificationResult.rows) {
            console.log(`   ${row.folder_type.toUpperCase()}:`);
            console.log(`     Total: ${row.total_files} files`);
            console.log(`     Backed up: ${row.backed_up_files} files`);
            console.log(`     Missing backup: ${row.missing_backup} files`);
            
            const backupPercent = Math.round((row.backed_up_files / row.total_files) * 100);
            console.log(`     Backup coverage: ${backupPercent}%`);
        }
        
    } catch (error) {
        console.error('❌ Repair failed:', error);
        throw error;
    } finally {
        if (client) client.release();
        await pool.end();d();
    }
}

// Run the repair
repairR2Backup().then(() => {
    console.log('\n Emergency R2 backup repair completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Repair script failed:', error);
    process.exit(1);
});ss.exit(1);
});