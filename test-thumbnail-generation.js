#!/usr/bin/env node

/**
 * Test script for thumbnail generation functionality
 * Tests the enhanced thumbnail system with all file types
 */

const { Pool } = require('pg');
const R2FileManager = require('./server/r2-file-manager.js');
const fs = require('fs');
const path = require('path');

class ThumbnailTester {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        this.r2Manager = new R2FileManager(null, this.pool);
    }

    async runThumbnailTests() {
        console.log('🔧 THUMBNAIL GENERATION TEST');
        console.log('============================\n');

        try {
            // 1. Test R2 connection
            const connectionTest = await this.r2Manager.testConnection();
            if (!connectionTest) {
                throw new Error('R2 connection failed');
            }
            console.log('✅ R2 connection successful\n');

            // 2. Test file type detection
            await this.testFileTypeDetection();
            
            // 3. Test thumbnail generation for existing files
            await this.testExistingFileThumbnails();
            
            // 4. Test thumbnail retrieval
            await this.testThumbnailRetrieval();
            
        } catch (error) {
            console.error('❌ Thumbnail test failed:', error);
        } finally {
            await this.pool.end();
        }
    }

    async testFileTypeDetection() {
        console.log('1. 🔍 Testing File Type Detection...');
        
        const testFiles = [
            'IMG_001.NEF',     // RAW Nikon
            'DSC_002.CR2',     // RAW Canon
            'photo.ARW',       // RAW Sony
            'image.DNG',       // RAW Adobe
            'final.JPG',       // Gallery JPEG
            'processed.png',   // Gallery PNG
            'large.TIFF',      // Gallery TIFF
            'video.MP4',       // Video
            'document.PDF',    // Document
            'design.PSD'       // Adobe
        ];
        
        testFiles.forEach(filename => {
            const category = this.r2Manager.getFileTypeCategory(filename);
            const isImage = this.r2Manager.isImageFile(filename);
            console.log(`   ${filename} → Category: ${category}, IsImage: ${isImage}`);
        });
        
        console.log('');
    }

    async testExistingFileThumbnails() {
        console.log('2. 🖼️ Testing Thumbnail Generation for Existing Files...');
        
        try {
            // Get files from the test session
            const testUserId = 'BFZI4tzu4rdsiZZSK63cqZ5yohw2';
            const testSessionId = 'c6ae6559-6572-475d-ab3c-d667d9c7e8c1';
            
            console.log(`   Testing with user: ${testUserId}, session: ${testSessionId}`);
            
            // Get session files
            const sessionFiles = await this.r2Manager.getSessionFiles(testUserId, testSessionId);
            
            if (sessionFiles.success && sessionFiles.totalFiles > 0) {
                console.log(`   Found ${sessionFiles.totalFiles} files in session`);
                
                // Test thumbnails for first few image files
                const imageFiles = [];
                for (const [type, files] of Object.entries(sessionFiles.filesByType)) {
                    if (['raw', 'gallery'].includes(type)) {
                        imageFiles.push(...files.slice(0, 2)); // Test first 2 of each type
                    }
                }
                
                console.log(`   Testing thumbnails for ${imageFiles.length} image files:`);
                
                for (const file of imageFiles) {
                    console.log(`   📸 Testing thumbnails for: ${file.filename}`);
                    
                    // Test each thumbnail size
                    const sizes = ['_sm', '_md', '_lg'];
                    for (const size of sizes) {
                        try {
                            const thumbnail = await this.r2Manager.getThumbnail(testUserId, testSessionId, file.filename, size);
                            
                            if (thumbnail.success) {
                                const sizeKB = (thumbnail.buffer.length / 1024).toFixed(1);
                                console.log(`      ✅ ${size}: ${sizeKB}KB`);
                            } else {
                                console.log(`      ⚠️ ${size}: ${thumbnail.error}`);
                            }
                        } catch (thumbError) {
                            console.log(`      ❌ ${size}: ${thumbError.message}`);
                        }
                    }
                }
            } else {
                console.log('   ⚠️ No files found in test session');
            }
            
        } catch (error) {
            console.log('   ❌ Existing file thumbnail test failed:', error.message);
        }
        
        console.log('');
    }

    async testThumbnailRetrieval() {
        console.log('3. 📥 Testing Thumbnail Retrieval API...');
        
        try {
            // Test the enhanced preview route logic
            const testUserId = 'BFZI4tzu4rdsiZZSK63cqZ5yohw2';
            const testSessionId = 'c6ae6559-6572-475d-ab3c-d667d9c7e8c1';
            
            // Get a test file
            const sessionFiles = await this.r2Manager.getSessionFiles(testUserId, testSessionId);
            
            if (sessionFiles.success && sessionFiles.totalFiles > 0) {
                // Find first image file
                let testFile = null;
                for (const [type, files] of Object.entries(sessionFiles.filesByType)) {
                    if (['raw', 'gallery'].includes(type) && files.length > 0) {
                        testFile = files[0];
                        break;
                    }
                }
                
                if (testFile) {
                    console.log(`   Testing retrieval for: ${testFile.filename}`);
                    
                    // Test different sizes
                    const sizes = ['_sm', '_md', '_lg'];
                    for (const size of sizes) {
                        try {
                            const result = await this.r2Manager.getThumbnail(testUserId, testSessionId, testFile.filename, size);
                            
                            if (result.success) {
                                console.log(`   ✅ ${size}: Retrieved ${(result.buffer.length / 1024).toFixed(1)}KB thumbnail`);
                            } else {
                                console.log(`   ⚠️ ${size}: ${result.error}`);
                            }
                        } catch (error) {
                            console.log(`   ❌ ${size}: ${error.message}`);
                        }
                    }
                } else {
                    console.log('   ⚠️ No image files found for testing');
                }
            }
            
        } catch (error) {
            console.log('   ❌ Thumbnail retrieval test failed:', error.message);
        }
        
        console.log('');
    }
}

// Run the tests
const tester = new ThumbnailTester();
tester.runThumbnailTests().then(() => {
    console.log('🎯 THUMBNAIL TESTS COMPLETE');
    process.exit(0);
}).catch(error => {
    console.error('❌ Thumbnail tests failed:', error);
    process.exit(1);
});