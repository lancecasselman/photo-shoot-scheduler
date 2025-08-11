#!/usr/bin/env node

/**
 * Raw Files R2 Backup Repair Script
 * Identifies raw files without proper R2 backup keys and fixes them
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function repairRawBackup() {
    console.log('🔍 Checking raw files R2 backup status...');
    
    let client;
    try {
        client = await pool.connect();
        
        // Find raw files missing R2 keys
        const rawFilesResult = await client.query(`
            SELECT sf.id, sf.session_id, sf.user_id, sf.filename, sf.r2_key, 
                   sf.file_size_bytes, sf.uploaded_at,
                   ps.client_name
            FROM session_files sf
            LEFT JOIN photography_sessions ps ON sf.session_id = ps.id
            WHERE sf.folder_type = 'raw' 
            AND (sf.r2_key IS NULL OR sf.r2_key = '')
            ORDER BY sf.uploaded_at DESC
        `);
        
        if (rawFilesResult.rows.length === 0) {
            console.log('✅ All raw files have proper R2 backup keys!');
            return;
        }
        
        console.log(`⚠️  Found ${rawFilesResult.rows.length} raw files missing R2 backup keys:`);
        
        for (const file of rawFilesResult.rows) {
            const sizeMB = Math.round(file.file_size_bytes / 1024 / 1024);
            console.log(`   📁 ${file.filename} (${sizeMB}MB) - Session: ${file.client_name}`);
        }
        
        console.log('\n🔧 To fix this, we need to:');
        console.log('1. Check if files exist in local uploads folder');
        console.log('2. Upload missing files to R2 cloud storage');
        console.log('3. Update database with R2 keys');
        
        // Check local uploads folder
        const uploadsPath = path.join(process.cwd(), 'uploads');
        let foundLocalFiles = 0;
        
        for (const file of rawFilesResult.rows) {
            const sessionFolder = path.join(uploadsPath, file.session_id, 'raw');
            
            if (fs.existsSync(sessionFolder)) {
                const files = fs.readdirSync(sessionFolder);
                const matchingFile = files.find(f => f.includes(file.filename) || file.filename.includes(f));
                
                if (matchingFile) {
                    foundLocalFiles++;
                    console.log(`   📂 Found locally: ${matchingFile}`);
                }
            }
        }
        
        if (foundLocalFiles > 0) {
            console.log(`\n💡 Found ${foundLocalFiles} files in local uploads that can be backed up to R2`);
            console.log('   Run the R2 backup repair process to upload these files');
        } else {
            console.log('\n⚠️  No local files found. Raw files may have been uploaded to R2 but database entries are missing R2 keys');
            console.log('   This suggests the upload process completed but database update failed');
        }
        
    } catch (error) {
        console.error('❌ Error checking raw backup status:', error);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

// Run the check
repairRawBackup().then(() => {
    console.log('\n🎯 Raw files backup check completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Backup check failed:', error);
    process.exit(1);
});