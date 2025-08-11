#!/usr/bin/env node

/**
 * Debug script for Raw Storage Manager
 * This script tests and diagnoses issues with the raw storage functionality
 */

const { Pool } = require('pg');
const R2FileManager = require('./server/r2-file-manager.js');

class RawStorageDebugger {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        this.r2Manager = new R2FileManager(null, this.pool);
    }

    async runDiagnostics() {
        console.log('🔧 RAW STORAGE MANAGER DEBUG REPORT');
        console.log('=====================================\n');

        try {
            // 1. Test R2 Connection
            await this.testR2Connection();
            
            // 2. Test Database Connection
            await this.testDatabaseConnection();
            
            // 3. Check session files data
            await this.checkSessionFiles();
            
            // 4. Test storage calculations
            await this.testStorageCalculations();
            
            // 5. Test file type detection
            await this.testFileTypeDetection();
            
            // 6. Check backup indices
            await this.checkBackupIndices();
            
        } catch (error) {
            console.error('❌ Debug script failed:', error);
        } finally {
            await this.pool.end();
        }
    }

    async testR2Connection() {
        console.log('1. 🌐 Testing R2 Connection...');
        
        try {
            const isConnected = await this.r2Manager.testConnection();
            if (isConnected) {
                console.log('   ✅ R2 connection successful');
                console.log(`   📦 Bucket: ${this.r2Manager.bucketName}`);
                console.log(`   🔑 Endpoint: https://${this.r2Manager.accountId}.r2.cloudflarestorage.com`);
            } else {
                console.log('   ❌ R2 connection failed');
            }
        } catch (error) {
            console.log('   ❌ R2 connection error:', error.message);
        }
        console.log('');
    }

    async testDatabaseConnection() {
        console.log('2. 🗄️ Testing Database Connection...');
        
        try {
            const result = await this.pool.query('SELECT NOW() as current_time');
            console.log('   ✅ Database connection successful');
            console.log('   🕒 Current time:', result.rows[0].current_time);
            
            // Check session_files table
            const tableCheck = await this.pool.query(`
                SELECT COUNT(*) as total_files, 
                       SUM(file_size_bytes) as total_bytes,
                       COUNT(CASE WHEN folder_type = 'raw' THEN 1 END) as raw_files,
                       COUNT(CASE WHEN folder_type = 'gallery' THEN 1 END) as gallery_files
                FROM session_files
            `);
            
            const stats = tableCheck.rows[0];
            console.log('   📊 Session Files Table:');
            console.log(`      Total files: ${stats.total_files}`);
            console.log(`      Raw files: ${stats.raw_files}`);
            console.log(`      Gallery files: ${stats.gallery_files}`);
            console.log(`      Total bytes: ${stats.total_bytes || 0}`);
            
        } catch (error) {
            console.log('   ❌ Database connection error:', error.message);
        }
        console.log('');
    }

    async checkSessionFiles() {
        console.log('3. 📁 Checking Session Files...');
        
        try {
            // Get a sample of recent sessions
            const sessions = await this.pool.query(`
                SELECT id, client_name, created_at 
                FROM photography_sessions 
                ORDER BY created_at DESC 
                LIMIT 5
            `);
            
            console.log(`   Found ${sessions.rows.length} recent sessions:`);
            
            for (const session of sessions.rows) {
                console.log(`   📸 Session: ${session.client_name} (${session.id})`);
                
                // Check files for this session
                const files = await this.pool.query(`
                    SELECT folder_type, filename, file_size_bytes, r2_key
                    FROM session_files 
                    WHERE session_id = $1
                `, [session.id]);
                
                if (files.rows.length > 0) {
                    const rawCount = files.rows.filter(f => f.folder_type === 'raw').length;
                    const galleryCount = files.rows.filter(f => f.folder_type === 'gallery').length;
                    const totalBytes = files.rows.reduce((sum, f) => sum + parseInt(f.file_size_bytes || 0), 0);
                    
                    console.log(`      Files: ${files.rows.length} total (${rawCount} raw, ${galleryCount} gallery)`);
                    console.log(`      Size: ${(totalBytes / (1024**2)).toFixed(2)} MB`);
                } else {
                    console.log('      No files found in database');
                }
            }
            
        } catch (error) {
            console.log('   ❌ Session files check error:', error.message);
        }
        console.log('');
    }

    async testStorageCalculations() {
        console.log('4. 🧮 Testing Storage Calculations...');
        
        try {
            // Test for Lance's account - use Firebase UID that matches R2 storage
            const userId = 'BFZI4tzu4rdsiZZSK63cqZ5yohw2';
            
            console.log(`   Testing storage calculation for user: ${userId}`);
            
            const storageUsage = await this.r2Manager.getUserStorageUsage(userId);
            
            console.log('   📊 Storage Usage Results:');
            console.log(`      Total: ${storageUsage.totalGB} GB (${storageUsage.totalBytes} bytes)`);
            console.log(`      Gallery: ${storageUsage.galleryGB} GB (${storageUsage.galleryCount} files)`);
            console.log(`      Raw: ${storageUsage.rawGB} GB (${storageUsage.rawCount} files)`);
            console.log(`      Usage: ${storageUsage.usedPercentage}%`);
            console.log(`      Status: ${storageUsage.storageStatus}`);
            
        } catch (error) {
            console.log('   ❌ Storage calculation error:', error.message);
        }
        console.log('');
    }

    async testFileTypeDetection() {
        console.log('5. 🔍 Testing File Type Detection...');
        
        const testFiles = [
            'IMG_001.NEF',
            'DSC_002.CR2', 
            'photo.ARW',
            'image.DNG',
            'final.JPG',
            'processed.png',
            'video.MP4',
            'document.PDF'
        ];
        
        testFiles.forEach(filename => {
            const type = this.r2Manager.getFileTypeCategory(filename);
            console.log(`   ${filename} → ${type}`);
        });
        
        console.log('');
    }

    async checkBackupIndices() {
        console.log('6. 📋 Checking R2 Backup Indices...');
        
        try {
            // Get sessions to check their backup indices
            const sessions = await this.pool.query(`
                SELECT ps.id, ps.client_name, ps.user_id
                FROM photography_sessions ps
                WHERE ps.user_id = '44735007'
                ORDER BY ps.created_at DESC 
                LIMIT 3
            `);
            
            for (const session of sessions.rows) {
                console.log(`   📸 Checking backup index for: ${session.client_name}`);
                
                try {
                    const backupIndex = await this.r2Manager.getSessionBackupIndex(session.user_id, session.id);
                    console.log(`      Files in index: ${backupIndex.totalFiles || backupIndex.files?.length || 0}`);
                    console.log(`      Total size: ${((backupIndex.totalSizeBytes || 0) / (1024**2)).toFixed(2)} MB`);
                    
                    if (backupIndex.files && backupIndex.files.length > 0) {
                        const rawFiles = backupIndex.files.filter(f => f.fileType === 'raw' || f.r2Key?.includes('/raw/'));
                        const galleryFiles = backupIndex.files.filter(f => f.fileType === 'gallery' || f.r2Key?.includes('/gallery/'));
                        console.log(`      Raw files: ${rawFiles.length}`);
                        console.log(`      Gallery files: ${galleryFiles.length}`);
                    }
                    
                } catch (indexError) {
                    console.log(`      ❌ No backup index found: ${indexError.message}`);
                }
            }
            
        } catch (error) {
            console.log('   ❌ Backup index check error:', error.message);
        }
        console.log('');
    }
}

// Run the diagnostics
const debugTool = new RawStorageDebugger();
debugTool.runDiagnostics().then(() => {
    console.log('🎯 DEBUG COMPLETE');
    process.exit(0);
}).catch(error => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
});