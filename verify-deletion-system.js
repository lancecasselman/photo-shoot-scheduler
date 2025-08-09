// Verification script to test deletion system completeness
const { Pool } = require('pg');

const dbPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verifyDeletionSystem() {
  console.log('🔍 Verifying deletion system completeness...\n');
  
  try {
    // Check for any files in database
    const allFiles = await dbPool.query(
      'SELECT session_id, folder_type, filename, file_size_mb, uploaded_at FROM session_files ORDER BY session_id, folder_type'
    );
    
    console.log(`📊 Total files in database: ${allFiles.rows.length}`);
    
    if (allFiles.rows.length > 0) {
      console.log('\n📋 Files still in database:');
      allFiles.rows.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.session_id}/${file.folder_type}/${file.filename} (${file.file_size_mb} MB)`);
      });
      
      // Group by session
      const sessionGroups = {};
      allFiles.rows.forEach(file => {
        if (!sessionGroups[file.session_id]) {
          sessionGroups[file.session_id] = { gallery: 0, raw: 0, totalSize: 0 };
        }
        sessionGroups[file.session_id][file.folder_type]++;
        sessionGroups[file.session_id].totalSize += parseFloat(file.file_size_mb);
      });
      
      console.log('\n📊 Files by session:');
      Object.entries(sessionGroups).forEach(([sessionId, counts]) => {
        console.log(`   ${sessionId}: ${counts.gallery} gallery + ${counts.raw} raw = ${counts.totalSize.toFixed(2)} MB`);
      });
    } else {
      console.log('✅ Database is clean - no files recorded');
    }
    
    // Test the unified deletion system components
    console.log('\n🧪 Testing deletion system components...');
    
    // Check if unified deletion service exists
    try {
      const unifiedDeletion = require('./server/unified-file-deletion.js');
      console.log('   ✅ Unified deletion service loaded');
    } catch (error) {
      console.log('   ❌ Unified deletion service missing');
    }
    
    // Check deletion endpoints in r2-api-routes
    const fs = require('fs');
    const routeContent = fs.readFileSync('./server/r2-api-routes.js', 'utf8');
    
    const hasUnifiedDelete = routeContent.includes('unifiedDeletion.deleteFile');
    const hasDatabaseLookup = routeContent.includes('SELECT folder_type, filename FROM session_files');
    
    console.log(`   ✅ Deletion endpoints use unified service: ${hasUnifiedDelete}`);
    console.log(`   ✅ Deletion endpoints query database first: ${hasDatabaseLookup}`);
    
    console.log('\n📋 Deletion System Status:');
    console.log(`   Database cleanup: ${allFiles.rows.length === 0 ? '✅ CLEAN' : '❌ HAS ORPHANED RECORDS'}`);
    console.log(`   Unified deletion: ${hasUnifiedDelete ? '✅ ACTIVE' : '❌ MISSING'}`);
    console.log(`   Database lookup: ${hasDatabaseLookup ? '✅ ACTIVE' : '❌ MISSING'}`);
    
    if (allFiles.rows.length === 0 && hasUnifiedDelete && hasDatabaseLookup) {
      console.log('\n🎯 DELETION SYSTEM: ✅ FULLY OPERATIONAL');
    } else {
      console.log('\n⚠️ DELETION SYSTEM: ❌ NEEDS ATTENTION');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await dbPool.end();
  }
}

verifyDeletionSystem();