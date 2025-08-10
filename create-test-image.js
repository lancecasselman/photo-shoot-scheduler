const sharp = require('sharp');
const fs = require('fs');

// Create a test JPEG image using sharp
async function createTestImage() {
    const width = 800;
    const height = 600;
    
    // Create an SVG with gradient and text
    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#4a90e2;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#7b68ee;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="${width}" height="${height}" fill="url(#gradient)" />
            <text x="${width/2}" y="${height/2}" font-family="Arial" font-size="48" font-weight="bold" text-anchor="middle" fill="white">
                Test Upload Image
            </text>
            <text x="${width/2}" y="${height/2 + 60}" font-family="Arial" font-size="24" text-anchor="middle" fill="white">
                ${new Date().toISOString()}
            </text>
        </svg>
    `;
    
    // Convert SVG to JPEG
    const buffer = await sharp(Buffer.from(svg))
        .jpeg({ quality: 90 })
        .toBuffer();
    
    const filename = 'test-upload-image.jpg';
    fs.writeFileSync(filename, buffer);
    
    console.log(`✅ Created test image: ${filename}`);
    console.log(`   Size: ${(buffer.length / 1024).toFixed(2)} KB`);
    
    return filename;
}

createTestImage().catch(console.error);