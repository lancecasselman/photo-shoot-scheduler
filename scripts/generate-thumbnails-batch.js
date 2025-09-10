#!/usr/bin/env node

/**
 * Batch Thumbnail Generation Utility
 * Generates thumbnails for all existing gallery images in r2_files table
 * Processes files in batches of 5 to avoid overwhelming the server
 */

const { Pool } = require('pg');
const fetch = require('node-fetch');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Configuration
const BATCH_SIZE = 5;
const API_BASE_URL = 'http://localhost:5000'; // Adjust if needed
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
 * Process a single file to generate thumbnails
 */
async function generateThumbnailForFile(file) {
  try {
    console.log(`  ⏳ Processing: ${file.filename} (${file.file_size_mb}MB)`);
    
    // First, we need to get an auth token
    // For this utility, we'll use a service account or admin credentials
    // You'll need to adjust this based on your authentication setup
    
    const requestBody = {
      sessionId: file.session_id,
      filename: file.filename,
      r2Key: file.r2_key
    };
    
    // Make the API call to generate thumbnails
    const response = await fetch(`${API_BASE_URL}/api/r2/generate-thumbnail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication headers if needed
        // 'Authorization': 'Bearer YOUR_TOKEN',
        // For development, you might use session cookies
        'Cookie': 'connect.sid=' + process.env.ADMIN_SESSION_COOKIE // Set this in .env
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log(`  ✅ Success: Generated thumbnails for ${file.filename}`);
      if (result.message) {
        console.log(`     Message: ${result.message}`);
      }
      stats.successful++;
      return { success: true, file: file.filename };
    } else if (result.skipped) {
      console.log(`  ⏭️  Skipped: ${file.filename} - ${result.message || 'Not an image file'}`);
      stats.skipped++;
      return { success: false, skipped: true, file: file.filename };
    } else {
      console.log(`  ❌ Failed: ${file.filename} - ${result.message || result.error || 'Unknown error'}`);
      stats.failed++;
      stats.errors.push({ file: file.filename, error: result.message || result.error });
      return { success: false, file: file.filename, error: result.message || result.error };
    }
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
  
  const promises = files.map(file => generateThumbnailForFile(file));
  const results = await Promise.allSettled(promises);
  
  stats.processed += files.length;
  
  // Log batch summary
  const batchSuccessful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
  const batchFailed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success && !r.value?.skipped)).length;
  const batchSkipped = results.filter(r => r.status === 'fulfilled' && r.value?.skipped).length;
  
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
 * Main execution function
 */
async function main() {
  console.log('🚀 Batch Thumbnail Generation Utility');
  console.log(''.repeat(60));
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`⚙️  Batch size: ${BATCH_SIZE} files`);
  console.log(`⏱️  Delay between batches: ${DELAY_BETWEEN_BATCHES/1000} seconds`);
  console.log(''.repeat(60));
  
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
    
    // Print final statistics
    console.log(`\n${'═'.repeat(60)}`);
    console.log('📊 FINAL STATISTICS');
    console.log(`${'═'.repeat(60)}`);
    console.log(`Total files:      ${stats.total}`);
    console.log(`Processed:        ${stats.processed}`);
    console.log(`✅ Successful:    ${stats.successful}`);
    console.log(`❌ Failed:        ${stats.failed}`);
    console.log(`⏭️  Skipped:      ${stats.skipped}`);
    console.log(`Success rate:     ${((stats.successful / stats.total) * 100).toFixed(1)}%`);
    
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