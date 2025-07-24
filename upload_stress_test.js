#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

console.log('🧪 Starting Upload Stress Test');

// Create test image files of various sizes
function createTestFile(filename, sizeMB) {
    const buffer = Buffer.alloc(sizeMB * 1024 * 1024, 'A'); // Fill with 'A' characters
    fs.writeFileSync(filename, buffer);
    console.log(`✅ Created test file: ${filename} (${sizeMB}MB)`);
}

async function testUpload() {
    try {
        // Create test files
        const testFiles = [
            { name: 'test-large-1.jpg', size: 25 },
            { name: 'test-large-2.jpg', size: 30 },
            { name: 'test-large-3.jpg', size: 28 },
            { name: 'test-medium-1.jpg', size: 15 },
            { name: 'test-medium-2.jpg', size: 20 },
        ];
        
        console.log('📁 Creating test files...');
        testFiles.forEach(file => {
            createTestFile(file.name, file.size);
        });
        
        console.log('🚀 Starting upload test...');
        
        const formData = new FormData();
        
        testFiles.forEach(file => {
            const filePath = path.resolve(file.name);
            const fileStream = fs.createReadStream(filePath);
            formData.append('photos', fileStream, {
                filename: file.name,
                contentType: 'image/jpeg'
            });
        });
        
        console.log('📤 Uploading files...');
        
        const response = await fetch('http://localhost:5000/api/sessions/test-session/upload-photos', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': 'Bearer test-token' // Mock auth for testing
            }
        });
        
        console.log(`📊 Response status: ${response.status}`);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Upload successful:', result);
        } else {
            const error = await response.text();
            console.log('❌ Upload failed:', error);
        }
        
        // Cleanup test files
        console.log('🧹 Cleaning up test files...');
        testFiles.forEach(file => {
            if (fs.existsSync(file.name)) {
                fs.unlinkSync(file.name);
                console.log(`🗑️ Deleted: ${file.name}`);
            }
        });
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testUpload();