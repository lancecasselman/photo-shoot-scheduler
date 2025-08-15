#!/usr/bin/env node

/**
 * Cleanup script to remove orphaned files that exist in filesystem but not tracked properly
 * This prevents accumulation of untracked files taking up space
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function cleanupOrphanedFiles() {
    console.log('🗑️ Starting orphaned file cleanup...');
    
    try {
        // Get all files currently tracked in database
        const dbResult = await pool.query(`
            SELECT DISTINCT s.id as session_id, s.client_name, 
                   array_agg(DISTINCT (p->>'filename')) as photo_filenames,
                   array_agg(DISTINCT sf.filename) as session_file_names
            FROM sessions s
            LEFT JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.photos) = 'array' THEN s.photos ELSE '[]'::jsonb END) AS p ON true
            LEFT JOIN session_files sf ON sf.session_id = s.id
            WHERE s.user_id = '44735007'
            GROUP BY s.id, s.client_name
        `);
        
        console.log(`Found ${dbResult.rows.length} sessions to check`);
        
        // Get all physical files in uploads directory
        const uploadsDir = path.join(__dirname, 'uploads');
        let physicalFiles = [];
        
        if (fs.existsSync(uploadsDir)) {
            physicalFiles = fs.readdirSync(uploadsDir).filter(file => 
                file.toLowerCase().match(/\.(jpg|jpeg|png|tiff|tif|raw|cr2|cr3|nef|arw|dng)$/i)
            );
        }
        
        console.log(`Found ${physicalFiles.length} physical files in uploads/`);
        
        // Track all files that should exist
        let trackedFiles = new Set();
        let sessionAnalysis = [];
        
        dbResult.rows.forEach(session => {
            let sessionFiles = [];
            
            // Add files from session.photos
            if (session.photo_filenames && session.photo_filenames[0]) {
                session.photo_filenames.forEach(filename => {
                    if (filename) {
                        trackedFiles.add(filename);
                        sessionFiles.push({ source: 'session.photos', filename });
                    }
                });
            }
            
            // Add files from session_files table
            if (session.session_file_names && session.session_file_names[0]) {
                session.session_file_names.forEach(filename => {
                    if (filename) {
                        trackedFiles.add(filename);
                        sessionFiles.push({ source: 'session_files', filename });
                    }
                });
            }
            
            sessionAnalysis.push({
                sessionId: session.session_id,
                clientName: session.client_name,
                files: sessionFiles
            });
        });
        
        console.log(`\n SESSION ANALYSIS:`);
        sessionAnalysis.forEach(session => {
            console.log(`${session.clientName} (${session.sessionId.substring(0,8)}): ${session.files.length} tracked files`);
            session.files.forEach(file => {
                console.log(`  - ${file.filename} (from ${file.source})`);
            });
        });
        
        // Find orphaned files
        const orphanedFiles = physicalFiles.filter(file => {
            // Check if file is tracked by original name or by any generated filename pattern
            const isTracked = Array.from(trackedFiles).some(trackedFile => {
                return trackedFile === file || 
                       trackedFile.includes(file) || 
                       file.includes(trackedFile.replace(/^\d+-\d+-/, ''));
            });
            return !isTracked;
        });
        
        console.log(`\n🗑️ ORPHANED FILES FOUND: ${orphanedFiles.length}`);
        orphanedFiles.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
            console.log(`  - ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        });
        
        if (orphanedFiles.length > 0) {
            console.log(`\n Total orphaned storage: ${orphanedFiles.reduce((total, file) => {
                const filePath = path.join(uploadsDir, file);
                return total + fs.statSync(filePath).size;
            }, 0) / 1024 / 1024} MB`);
            
            // Uncomment the following lines to actually delete the files
            // console.log('\n🗑️ Deleting orphaned files...');
            // orphanedFiles.forEach(file => {
            //     const filePath = path.join(uploadsDir, file);
            //     fs.unlinkSync(filePath);
            //     console.log(`   Deleted: ${file}`);
            // });
            
            console.log('\n Files NOT deleted (safety check). Uncomment deletion code to actually remove them.');
        } else {
            console.log('\n No orphaned files found!');
        }
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    } finally {
        await pool.end();
    }
}

// Run cleanup
cleanupOrphanedFiles();