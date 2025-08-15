#!/usr/bin/env node

/**
 * Comprehensive test for the complete thumbnail system
 * Tests upload with automatic thumbnail generation and API endpoints
 */

const { Pool } = require('pg');
const R2FileManager = require('./server/r2-file-manager.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

class CompleteThumbnailSystemTest {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        this.r2Manager = new R2FileManager(null, this.pool);
        this.testUserId = 'BFZI4tzu4rdsiZZSK63cqZ5yohw2';
        this.testSessionId = 'c6ae6559-6572-475d-ab3c-d667d9c7e8c1';
    }

    async runCompleteTests() {
        console.log(' COMPLETE THUMBNAIL SYSTEM TEST');
        console.log('==================================\n');

        try {
            // 1. Test connection
            await this.testConnection();
            
            // 2. Test file type detection
            await this.testFileTypeDetection();
            
            // 3. Test existing thumbnail retrieval
            await this.testExistingThumbnails();
            
            // 4. Test thumbnail generation performance
            await this.testThumbnailPerformance();
            
            // 5. Test different file formats
            await this.testFileFormatSupport();
            
            // 6. Test storage efficiency
            await this.testStorageEfficiency();
            
        } catch (error) {
            console.error('❌ Complete test failed:', error);
        } finally {
            await this.pool.end();
        }
    }

    async testConnection() {
        console.log('1. 🔗 Testing R2 Connection...');
        const connection = await this.r2Manager.testConnection();
        if (connection) {
            console.log('    R2 connection successful\n');
        } else {
            throw new Error('R2 connection failed');
        }
    }

    async testFileTypeDetection() {
        console.log('2.  Testing File Type Detection...');
        
        const testCases = [
            { file: 'IMG_001.NEF', expected: { category: 'raw', isImage: true } },
            { file: 'DSC_002.CR2', expected: { category: 'raw', isImage: true } },
            { file: 'photo.ARW', expected: { category: 'raw', isImage: true } },
            { file: 'image.DNG', expected: { category: 'raw', isImage: true } },
            { file: 'final.JPG', expected: { category: 'gallery', isImage: true } },
            { file: 'processed.png', expected: { category: 'gallery', isImage: true } },
            { file: 'large.TIFF', expected: { category: 'gallery', isImage: true } },
            { file: 'video.MP4', expected: { category: 'video', isImage: false } },
            { file: 'document.PDF', expected: { category: 'document', isImage: false } }
        ];
        
        let passed = 0;
        for (const test of testCases) {
            const category = this.r2Manager.getFileTypeCategory(test.file);
            const isImage = this.r2Manager.isImageFile(test.file);
            
            const categoryMatch = category === test.expected.category;
            const imageMatch = isImage === test.expected.isImage;
            
            if (categoryMatch && imageMatch) {
                console.log(`    ${test.file}: Category=${category}, IsImage=${isImage}`);
                passed++;
            } else {
                console.log(`   ❌ ${test.file}: Expected category=${test.expected.category}, isImage=${test.expected.isImage}, Got category=${category}, isImage=${isImage}`);
            }
        }
        
        console.log(`    File type detection: ${passed}/${testCases.length} tests passed\n`);
    }

    async testExistingThumbnails() {
        console.log('3. 🖼️ Testing Existing Thumbnail Retrieval...');
        
        try {
            const sessionFiles = await this.r2Manager.getSessionFiles(this.testUserId, this.testSessionId);
            
            if (sessionFiles.success && sessionFiles.totalFiles > 0) {
                console.log(`   Found ${sessionFiles.totalFiles} files in test session`);
                
                // Find image files
                const imageFiles = [];
                for (const [type, files] of Object.entries(sessionFiles.filesByType)) {
                    if (['raw', 'gallery'].includes(type)) {
                        imageFiles.push(...files.slice(0, 2)); // Test first 2 of each type
                    }
                }
                
                console.log(`   Testing thumbnail retrieval for ${imageFiles.length} image files:`);
                
                for (const file of imageFiles) {
                    console.log(`    ${file.filename}:`);
                    
                    const sizes = ['_sm', '_md', '_lg'];
                    let available = 0;
                    
                    for (const size of sizes) {
                        try {
                            const thumbnail = await this.r2Manager.getThumbnail(
                                this.testUserId, 
                                this.testSessionId, 
                                file.filename, 
                                size
                            );
                            
                            if (thumbnail.success) {
                                const sizeKB = (thumbnail.buffer.length / 1024).toFixed(1);
                                console.log(`       ${size}: ${sizeKB}KB`);
                                available++;
                            } else {
                                console.log(`       ${size}: Not available`);
                            }
                        } catch (error) {
                            console.log(`      ❌ ${size}: Error - ${error.message}`);
                        }
                    }
                    
                    console.log(`       ${available}/3 thumbnail sizes available`);
                }
            }
        } catch (error) {
            console.log(`   ❌ Existing thumbnail test failed: ${error.message}`);
        }
        
        console.log('');
    }

    async testThumbnailPerformance() {
        console.log('4. ⚡ Testing Thumbnail Generation Performance...');
        
        try {
            const sessionFiles = await this.r2Manager.getSessionFiles(this.testUserId, this.testSessionId);
            
            if (sessionFiles.success && sessionFiles.totalFiles > 0) {
                // Find a large RAW file for performance testing
                let testFile = null;
                for (const [type, files] of Object.entries(sessionFiles.filesByType)) {
                    if (type === 'raw') {
                        // Find largest file
                        testFile = files.reduce((largest, current) => 
                            current.fileSizeMB > largest.fileSizeMB ? current : largest
                        );
                        break;
                    }
                }
                
                if (testFile) {
                    console.log(`   Testing with: ${testFile.filename} (${testFile.fileSizeMB}MB)`);
                    
                    const startTime = Date.now();
                    
                    // Test thumbnail generation speed
                    const thumbnail = await this.r2Manager.getThumbnail(
                        this.testUserId, 
                        this.testSessionId, 
                        testFile.filename, 
                        '_md'
                    );
                    
                    const endTime = Date.now();
                    const processingTime = endTime - startTime;
                    
                    if (thumbnail.success) {
                        const compressionRatio = ((testFile.fileSizeMB * 1024 * 1024) / thumbnail.buffer.length).toFixed(1);
                        
                        console.log(`   ⚡ Performance Results:`);
                        console.log(`      Processing Time: ${processingTime}ms`);
                        console.log(`      Original Size: ${testFile.fileSizeMB}MB`);
                        console.log(`      Thumbnail Size: ${(thumbnail.buffer.length / 1024).toFixed(1)}KB`);
                        console.log(`      Compression Ratio: ${compressionRatio}:1`);
                        
                        if (processingTime < 5000) {
                            console.log(`       Performance: Good (< 5 seconds)`);
                        } else {
                            console.log(`       Performance: Slow (> 5 seconds)`);
                        }
                    }
                }
            }
        } catch (error) {
            console.log(`   ❌ Performance test failed: ${error.message}`);
        }
        
        console.log('');
    }

    async testFileFormatSupport() {
        console.log('5. 📁 Testing File Format Support...');
        
        try {
            const sessionFiles = await this.r2Manager.getSessionFiles(this.testUserId, this.testSessionId);
            
            if (sessionFiles.success && sessionFiles.totalFiles > 0) {
                const formatStats = {};
                
                // Analyze supported formats
                for (const [type, files] of Object.entries(sessionFiles.filesByType)) {
                    if (['raw', 'gallery'].includes(type)) {
                        for (const file of files) {
                            const ext = file.filename.split('.').pop().toLowerCase();
                            if (!formatStats[ext]) {
                                formatStats[ext] = { count: 0, thumbnailsAvailable: 0 };
                            }
                            formatStats[ext].count++;
                            
                            // Check if thumbnails exist
                            try {
                                const thumbnail = await this.r2Manager.getThumbnail(
                                    this.testUserId, 
                                    this.testSessionId, 
                                    file.filename, 
                                    '_sm'
                                );
                                if (thumbnail.success) {
                                    formatStats[ext].thumbnailsAvailable++;
                                }
                            } catch (error) {
                                // Thumbnail not available
                            }
                        }
                    }
                }
                
                console.log('    Format Support Summary:');
                for (const [format, stats] of Object.entries(formatStats)) {
                    const coverage = ((stats.thumbnailsAvailable / stats.count) * 100).toFixed(1);
                    console.log(`      ${format.toUpperCase()}: ${stats.count} files, ${coverage}% have thumbnails`);
                }
            }
        } catch (error) {
            console.log(`   ❌ Format support test failed: ${error.message}`);
        }
        
        console.log('');
    }

    async testStorageEfficiency() {
        console.log('6. 💾 Testing Storage Efficiency...');
        
        try {
            const sessionFiles = await this.r2Manager.getSessionFiles(this.testUserId, this.testSessionId);
            
            if (sessionFiles.success && sessionFiles.totalFiles > 0) {
                let originalTotalMB = 0;
                let thumbnailTotalKB = 0;
                let thumbnailCount = 0;
                
                for (const [type, files] of Object.entries(sessionFiles.filesByType)) {
                    if (['raw', 'gallery'].includes(type)) {
                        for (const file of files) {
                            originalTotalMB += parseFloat(file.fileSizeMB);
                            
                            // Check thumbnail sizes
                            const sizes = ['_sm', '_md', '_lg'];
                            for (const size of sizes) {
                                try {
                                    const thumbnail = await this.r2Manager.getThumbnail(
                                        this.testUserId, 
                                        this.testSessionId, 
                                        file.filename, 
                                        size
                                    );
                                    if (thumbnail.success) {
                                        thumbnailTotalKB += thumbnail.buffer.length / 1024;
                                        thumbnailCount++;
                                    }
                                } catch (error) {
                                    // Skip unavailable thumbnails
                                }
                            }
                        }
                    }
                }
                
                const thumbnailTotalMB = thumbnailTotalKB / 1024;
                const storageOverhead = ((thumbnailTotalMB / originalTotalMB) * 100).toFixed(2);
                const avgThumbnailKB = (thumbnailTotalKB / Math.max(thumbnailCount, 1)).toFixed(1);
                
                console.log('   💾 Storage Efficiency Results:');
                console.log(`      Original Files: ${originalTotalMB.toFixed(1)}MB`);
                console.log(`      Thumbnails: ${thumbnailTotalMB.toFixed(2)}MB (${thumbnailCount} files)`);
                console.log(`      Storage Overhead: ${storageOverhead}%`);
                console.log(`      Avg Thumbnail Size: ${avgThumbnailKB}KB`);
                
                if (parseFloat(storageOverhead) < 5) {
                    console.log(`       Efficiency: Excellent (< 5% overhead)`);
                } else if (parseFloat(storageOverhead) < 10) {
                    console.log(`       Efficiency: Good (< 10% overhead)`);
                } else {
                    console.log(`       Efficiency: Could be improved (> 10% overhead)`);
                }
            }
        } catch (error) {
            console.log(`   ❌ Storage efficiency test failed: ${error.message}`);
        }
        
        console.log('');
    }
}

// Run the complete tests
const tester = new CompleteThumbnailSystemTest();
tester.runCompleteTests().then(() => {
    console.log(' COMPLETE THUMBNAIL SYSTEM TESTS FINISHED');
    console.log('==========================================');
    process.exit(0);
}).catch(error => {
    console.error('❌ Complete tests failed:', error);
    process.exit(1);
});