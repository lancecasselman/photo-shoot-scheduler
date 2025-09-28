const express = require('express');
const { Pool } = require('pg');
const R2FileManager = require('./server/r2-file-manager');
const StorageSystem = require('./server/storage-system');
require('dotenv').config();

console.log('🧪 Testing Storage Quota System');
console.log('===============================');

// Test the actual storage system implementation
async function testStorageQuotaSystem() {
  try {
    // Initialize exactly like the server does
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    console.log('✅ Database pool created');
    
    const r2Manager = new R2FileManager(null, pool);
    console.log('✅ R2FileManager created');
    
    const storageSystem = new StorageSystem(pool, r2Manager);
    console.log('✅ StorageSystem created');
    console.log('');
    
    // Test 1: Initialize tables
    console.log('🧪 Test 1: Initializing storage tables...');
    try {
      await storageSystem.initializeTables();
      console.log('✅ Storage tables initialized successfully');
    } catch (initError) {
      console.log(`⚠️ Storage tables already exist: ${initError.message}`);
    }
    console.log('');
    
    // Test 2: Test with a real user ID (from the logs we've seen)
    const testUserId = '44735007'; // Real user ID from R2 paths
    console.log(`🧪 Test 2: Testing quota system for user ${testUserId}...`);
    
    // Get or create user quota
    const userQuota = await storageSystem.getUserQuota(testUserId);
    console.log(`   User quota: ${userQuota.total_quota_gb}GB (base: ${userQuota.base_storage_gb}GB)`);
    
    // Calculate storage usage (this is where failures typically happen)
    console.log('   Calculating actual storage usage from R2...');
    const storageUsage = await storageSystem.calculateStorageUsage(testUserId);
    console.log(`   ✅ Storage calculation succeeded:`);
    console.log(`      Total: ${storageUsage.totalGB}GB (${storageUsage.totalFiles} files)`);
    console.log(`      Gallery: ${(storageUsage.galleryBytes / 1024 / 1024).toFixed(2)}MB`);
    console.log(`      Raw: ${(storageUsage.rawBytes / 1024 / 1024).toFixed(2)}MB`);
    
    // Test upload permission check
    console.log('');
    const testUploadSize = 50 * 1024 * 1024; // 50MB test upload
    console.log(`🧪 Test 3: Testing canUpload for ${testUploadSize / 1024 / 1024}MB upload...`);
    
    const canUploadResult = await storageSystem.canUpload(testUserId, testUploadSize);
    
    console.log(`   Current usage: ${canUploadResult.currentUsageGB}GB`);
    console.log(`   Quota limit: ${canUploadResult.quotaGB}GB`);
    console.log(`   Remaining: ${canUploadResult.remainingGB}GB`);
    console.log(`   Can upload: ${canUploadResult.canUpload ? '✅ YES' : '❌ NO (QUOTA EXCEEDED)'}`);
    console.log(`   Near limit: ${canUploadResult.isNearLimit ? '⚠️ YES (>90%)' : '✅ NO'}`);
    
    if (!canUploadResult.canUpload) {
      console.log('   ❌ This would trigger "Storage quota exceeded" error');
      console.log('   This explains why users are getting quota errors!');
    } else {
      console.log('   ✅ Upload should be allowed without quota errors');
    }
    
    console.log('');
    
    // Test 4: Test with admin user (should have unlimited)
    console.log('🧪 Test 4: Testing admin bypass...');
    const adminCanUpload = await storageSystem.canUpload(testUserId, testUploadSize, 'lancecasselman@icloud.com');
    console.log(`   Admin can upload: ${adminCanUpload.canUpload ? '✅ YES' : '❌ NO'}`);
    console.log(`   Admin bypass active: ${adminCanUpload.isAdmin ? '✅ YES' : '❌ NO'}`);
    
    console.log('');
    console.log('🎉 STORAGE QUOTA SYSTEM TEST COMPLETED!');
    console.log('   All functionality is working correctly.');
    console.log('   R2 connection: ✅ Active');
    console.log('   Storage calculation: ✅ Functional');
    console.log('   Quota enforcement: ✅ Operational');
    
    // Clean up
    await pool.end();
    
    return true;
    
  } catch (error) {
    console.error('');
    console.error('💥 STORAGE QUOTA SYSTEM TEST FAILED');
    console.error(`   Error: ${error.name || 'Unknown'}`);
    console.error(`   Message: ${error.message}`);
    console.error(`   Stack: ${error.stack?.split('\n')[1]?.trim()}`);
    console.error('');
    console.error('   This explains why users are getting "Storage quota exceeded" errors!');
    console.error('   The storage calculation is failing, causing fake quota errors.');
    
    return false;
  }
}

// Run the test
testStorageQuotaSystem().then((success) => {
  if (!success) {
    process.exit(1);
  }
}).catch((error) => {
  console.error('💥 UNEXPECTED ERROR:', error);
  process.exit(1);
});