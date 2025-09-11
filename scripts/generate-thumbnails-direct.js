#!/usr/bin/env node

/**
 * Direct Thumbnail Generation Utility
 * Generates thumbnails for all existing gallery images in r2_files table
 * Uses R2FileManager directly without going through HTTP API
 */

const { Pool } = require('pg');
const R2FileManager = require('../server/r2-file-manager');
const sharp = require('sharp');
// Note: Environment variables should be available from parent process

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize R2FileManager
const r2Manager = new R2FileManager(null, pool);

// Configuration
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay between batches

// Statistics tracking
const stats = {
  total: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

/**
 * Get all gallery files that need thumbnails
 */
async function getGalleryFiles() {
  try {
    const query = `
      SELECT 
        id,
        user_id,
        session_id,
        filename,
        original_filename,
        r2_key,
        file_size_mb
      FROM r2_files 
      WHERE file_type = 'gallery'
      ORDER BY session_id, created_at
    `;
    
    const result = await pool.query(query);
    console.log(`📸 Found ${result.rows.length} gallery files to process`);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching gallery files:', error);
    throw error;
  }
}

/**
 * Check if thumbnails already exist for a file
 */
async function checkThumbnailsExist(userId, sessionId, filename) {
  try {
    // Check if thumbnail records exist in r2_files table
    const baseName = filename.replace(/\.[^/.]+$/, '');
    const query = `
      SELECT COUNT(*) as count
      FROM r2_files 
      WHERE user_id = $1 
      AND session_id = $2 
      AND file_type = 'thumbnail'
      AND filename LIKE $3
    `;
    
    const result = await pool.query(query, [userId, sessionId, `${baseName}_%`]);
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('Error checking thumbnails:', error);
    return false;
  }
}

/**
 * Process a single file to generate thumbnails
 */
async function generateThumbnailForFile(file) {
  try {
    console.log(`  ⏳ Processing: ${file.filename} (${file.file_size_mb}MB)`);
    
    // Check if thumbnails already exist
    const thumbnailsExist = await checkThumbnailsExist(file.user_id, file.session_id, file.filename);
    if (thumbnailsExist) {
      console.log(`  ⏭️  Skipped: ${file.filename} - Thumbnails already exist`);
      stats.skipped++;
      return { success: false, skipped: true, file: file.filename };
    }
    
    // Check if it's an image file
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
    const fileExt = file.filename.toLowerCase().match(/\.[^/.]+$/)?.[0] || '';
    if (!imageExtensions.includes(fileExt)) {
      console.log(`  ⏭️  Skipped: ${file.filename} - Not an image file (${fileExt})`);
      stats.skipped++;
      return { success: false, skipped: true, file: file.filename };
    }
    
    // Get the original file from R2
    console.log(`     Fetching file from R2: ${file.r2_key}`);
    const fileStream = await r2Manager.getFileStream(file.r2_key);
    if (!fileStream) {
      throw new Error('Original file not found in R2');
    }

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);
    console.log(`     File buffer size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    // Generate thumbnail using the R2FileManager method
    console.log(`     Generating thumbnails...`);
    const thumbnailResult = await r2Manager.generateThumbnail(
      fileBuffer,
      file.filename,
      file.user_id,
      file.session_id,
      'gallery'
    );

    if (!thumbnailResult || !thumbnailResult.success) {
      // If thumbnail generation fails, return gracefully
      const message = thumbnailResult?.error || 'Thumbnail generation not supported for this file type';
      console.log(`  ❌ Failed: ${file.filename} - ${message}`);
      stats.failed++;
      stats.errors.push({ file: file.filename, error: message });
      return { success: false, file: file.filename, error: message };
    }

    // Count generated thumbnails
    const thumbnailCount = thumbnailResult.thumbnails ? thumbnailResult.thumbnails.length : 0;
    console.log(`  ✅ Success: Generated ${thumbnailCount} thumbnail sizes for ${file.filename}`);
    
    // Log thumbnail details
    if (thumbnailResult.thumbnails) {
      thumbnailResult.thumbnails.forEach(thumb => {
        console.log(`     - ${thumb.suffix}: ${thumb.width}x${thumb.height}`);
      });
    }
    
    stats.successful++;
    return { success: true, file: file.filename, thumbnailCount };
    
  } catch (error) {
    console.error(`  ❌ Error processing ${file.filename}:`, error.message);
    stats.failed++;
    stats.errors.push({ file: file.filename, error: error.message });
    return { success: false, file: file.filename, error: error.message };
  }
}

/**
 * Process files in batches
 */
async function processBatch(files, batchNumber, totalBatches) {
  console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${files.length} files)`);
  console.log('━'.repeat(50));
  
  // Process files sequentially to avoid overwhelming R2
  const results = [];
  for (const file of files) {
    const result = await generateThumbnailForFile(file);
    results.push(result);
    stats.processed++;
  }
  
  // Log batch summary
  const batchSuccessful = results.filter(r => r.success).length;
  const batchFailed = results.filter(r => !r.success && !r.skipped).length;
  const batchSkipped = results.filter(r => r.skipped).length;
  
  console.log(`\n📊 Batch ${batchNumber} complete:`);
  console.log(`   ✅ Successful: ${batchSuccessful}`);
  console.log(`   ❌ Failed: ${batchFailed}`);
  console.log(`   ⏭️  Skipped: ${batchSkipped}`);
}

/**
 * Process files by session for better organization
 */
async function processFilesBySession(files) {
  // Group files by session
  const filesBySession = files.reduce((acc, file) => {
    if (!acc[file.session_id]) {
      acc[file.session_id] = [];
    }
    acc[file.session_id].push(file);
    return acc;
  }, {});
  
  const sessions = Object.keys(filesBySession);
  console.log(`\n📁 Processing ${sessions.length} sessions`);
  
  // Sort sessions to process 'd0892278-1882-4466-955f-fba2425e53ef' first
  const targetSession = 'd0892278-1882-4466-955f-fba2425e53ef';
  if (sessions.includes(targetSession)) {
    const index = sessions.indexOf(targetSession);
    sessions.splice(index, 1);
    sessions.unshift(targetSession);
    console.log(`\n🎯 Prioritizing session ${targetSession} with ${filesBySession[targetSession].length} files`);
  }
  
  // Process each session
  for (const [index, sessionId] of sessions.entries()) {
    const sessionFiles = filesBySession[sessionId];
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎯 Session ${index + 1}/${sessions.length}: ${sessionId}`);
    console.log(`   Files to process: ${sessionFiles.length}`);
    console.log(`${'═'.repeat(60)}`);
    
    // Process session files in batches
    for (let i = 0; i < sessionFiles.length; i += BATCH_SIZE) {
      const batch = sessionFiles.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(sessionFiles.length / BATCH_SIZE);
      
      await processBatch(batch, batchNumber, totalBatches);
      
      // Add delay between batches to avoid overwhelming the server
      if (i + BATCH_SIZE < sessionFiles.length) {
        console.log(`\n⏳ Waiting ${DELAY_BETWEEN_BATCHES/1000} seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
  }
}

/**
 * Verify thumbnails in database
 */
async function verifyThumbnails() {
  try {
    console.log(`\n🔍 Verifying thumbnails in database...`);
    
    const query = `
      SELECT 
        session_id,
        COUNT(*) as thumbnail_count,
        MIN(created_at) as first_created,
        MAX(created_at) as last_created
      FROM r2_files 
      WHERE file_type = 'thumbnail'
      GROUP BY session_id
      ORDER BY session_id
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('   No thumbnails found in database');
      return;
    }
    
    console.log(`\n   Found thumbnails in ${result.rows.length} sessions:`);
    result.rows.forEach(row => {
      console.log(`   - Session ${row.session_id}: ${row.thumbnail_count} thumbnails`);
    });
    
    // Get total count
    const totalQuery = `SELECT COUNT(*) as total FROM r2_files WHERE file_type = 'thumbnail'`;
    const totalResult = await pool.query(totalQuery);
    console.log(`\n   Total thumbnails in database: ${totalResult.rows[0].total}`);
    
  } catch (error) {
    console.error('Error verifying thumbnails:', error);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Direct Thumbnail Generation Utility');
  console.log('═'.repeat(60));
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`⚙️  Batch size: ${BATCH_SIZE} files`);
  console.log(`⏱️  Delay between batches: ${DELAY_BETWEEN_BATCHES/1000} seconds`);
  console.log('═'.repeat(60));
  
  try {
    // Get all gallery files
    const files = await getGalleryFiles();
    stats.total = files.length;
    
    if (files.length === 0) {
      console.log('✅ No gallery files found to process');
      return;
    }
    
    // Process files by session
    await processFilesBySession(files);
    
    // Verify thumbnails
    await verifyThumbnails();
    
    // Print final statistics
    console.log(`\n${'═'.repeat(60)}`);
    console.log('📊 FINAL STATISTICS');
    console.log(`${'═'.repeat(60)}`);
    console.log(`Total files:      ${stats.total}`);
    console.log(`Processed:        ${stats.processed}`);
    console.log(`✅ Successful:    ${stats.successful}`);
    console.log(`❌ Failed:        ${stats.failed}`);
    console.log(`⏭️  Skipped:      ${stats.skipped}`);
    
    if (stats.successful > 0) {
      console.log(`\nSuccess rate:     ${((stats.successful / (stats.total - stats.skipped)) * 100).toFixed(1)}%`);
      console.log(`Thumbnails/file:  ${stats.successful > 0 ? '3 sizes (sm, md, lg)' : 'N/A'}`);
    }
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      stats.errors.forEach(err => {
        console.log(`   - ${err.file}: ${err.error}`);
      });
    }
    
    console.log(`\n✅ Thumbnail generation complete!`);
    console.log(`📅 Finished at: ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Handle script termination
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Process interrupted by user');
  console.log(`📊 Progress: ${stats.processed}/${stats.total} files processed`);
  await pool.end();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { getGalleryFiles, generateThumbnailForFile, processBatch };