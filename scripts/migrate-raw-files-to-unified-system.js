#!/usr/bin/env node

/**
 * Migration Script: Move raw files from raw_files table to unified session_files table
 * This ensures all files are tracked in one place and properly backed up to R2
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateRawFiles() {
    console.log(' Starting raw files migration to unified session_files system...');
    
    let client;
    try {
        client = await pool.connect();
        
        // Get all raw files from the old table
        const rawFilesResult = await client.query(`
            SELECT id, session_id, user_id, filename, original_filename, 
                   file_extension, file_size_bytes, r2_key, upload_completed_at
            FROM raw_files 
            WHERE upload_status = 'completed'
            ORDER BY upload_completed_at
        `);
        
        console.log(` Found ${rawFilesResult.rows.length} raw files to migrate`);
        
        let migratedCount = 0;
        let skippedCount = 0;
        
        for (const rawFile of rawFilesResult.rows) {
            try {
                // Check if already exists in session_files
                const existingResult = await client.query(`
                    SELECT id FROM session_files 
                    WHERE session_id = $1 AND filename = $2 AND folder_type = 'raw'
                `, [rawFile.session_id, rawFile.original_filename]);
                
                if (existingResult.rows.length > 0) {
                    console.log(`⏭️  Skipping ${rawFile.original_filename} - already exists in session_files`);
                    skippedCount++;
                    continue;
                }
                
                // Insert into unified session_files table
                await client.query(`
                    INSERT INTO session_files (
                        id, session_id, user_id, filename, folder_type, 
                        r2_key, file_size_bytes, uploaded_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    rawFile.id,
                    rawFile.session_id,
                    rawFile.user_id,
                    rawFile.original_filename,
                    'raw',
                    rawFile.r2_key,
                    rawFile.file_size_bytes,
                    rawFile.upload_completed_at
                ]);
                
                console.log(` Migrated: ${rawFile.original_filename} (${Math.round(rawFile.file_size_bytes/1024/1024)}MB)`);
                migratedCount++;
                
            } catch (error) {
                console.error(`❌ Error migrating ${rawFile.original_filename}:`, error.message);
            }
        }
        
        console.log(`\n Migration Summary:`);
        console.log(`    Migrated: ${migratedCount} files`);
        console.log(`   ⏭️  Skipped: ${skippedCount} files`);
        console.log(`   📁 Total files processed: ${rawFilesResult.rows.length}`);
        
        // Verify the migration
        const verificationResult = await client.query(`
            SELECT folder_type, COUNT(*) as count, 
                   SUM(file_size_bytes)/1024/1024 as total_mb
            FROM session_files 
            GROUP BY folder_type
        `);
        
        console.log(`\n Post-migration verification:`);
        for (const row of verificationResult.rows) {
            console.log(`   ${row.folder_type}: ${row.count} files, ${Math.round(row.total_mb)}MB`);
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

// Run the migration
migrateRawFiles().then(() => {
    console.log(' Raw files migration completed successfully!');
    process.exit(0);
}).catch(error => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
});