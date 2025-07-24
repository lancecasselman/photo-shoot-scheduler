#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Creating Large Test Files for Upload Testing');

// Create JPEG-like test files with proper headers
function createJPEGTestFile(filename, sizeMB) {
    // JPEG file header
    const jpegHeader = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
        0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
        0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
        0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
        0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32
    ]);
    
    // JPEG end marker
    const jpegEnd = Buffer.from([0xFF, 0xD9]);
    
    // Calculate remaining size for filler content
    const targetSize = sizeMB * 1024 * 1024;
    const fillerSize = targetSize - jpegHeader.length - jpegEnd.length;
    
    // Create filler content (random-ish data that looks like compressed image data)
    const filler = Buffer.alloc(fillerSize);
    for (let i = 0; i < fillerSize; i++) {
        filler[i] = Math.floor(Math.random() * 256);
    }
    
    // Combine header + filler + end
    const fullFile = Buffer.concat([jpegHeader, filler, jpegEnd]);
    
    fs.writeFileSync(filename, fullFile);
    const actualSize = (fs.statSync(filename).size / 1024 / 1024).toFixed(2);
    console.log(`✅ Created: ${filename} (${actualSize}MB)`);
}

// Create multiple large test files
const testFiles = [
    { name: 'test-large-photo-1.jpg', size: 25 },
    { name: 'test-large-photo-2.jpg', size: 30 },
    { name: 'test-large-photo-3.jpg', size: 28 },
    { name: 'test-large-photo-4.jpg', size: 32 },
    { name: 'test-large-photo-5.jpg', size: 27 },
    { name: 'test-huge-photo-1.jpg', size: 45 },
    { name: 'test-huge-photo-2.jpg', size: 50 }
];

console.log('📁 Creating large test files...');

testFiles.forEach(file => {
    createJPEGTestFile(file.name, file.size);
});

const totalSize = testFiles.reduce((sum, file) => sum + file.size, 0);
console.log(`\n📊 Test Suite Created:`);
console.log(`   Files: ${testFiles.length}`);
console.log(`   Total Size: ${totalSize}MB`);
console.log(`   Largest File: ${Math.max(...testFiles.map(f => f.size))}MB`);

console.log(`\n🎯 Upload Test Instructions:`);
console.log(`1. Open the main app and log in`);
console.log(`2. Create a test session`);
console.log(`3. Click "Upload Photos" on the session`);
console.log(`4. Select these test files:`);
testFiles.forEach(file => {
    console.log(`   - ${file.name}`);
});
console.log(`5. Watch the progress bar and server logs`);

console.log(`\n🧹 Cleanup: Delete these files after testing`);