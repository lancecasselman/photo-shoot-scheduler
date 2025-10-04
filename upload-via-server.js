const fs = require('fs');
const path = require('path');

// Import the server's R2FileManager
const R2FileManager = require('./server/r2-file-manager.js');

async function uploadTestImages() {
    const sessionId = '6fc2ee67-9455-4115-bd43-1102569080e6';
    const userId = 'dev-test-user-001';
    
    const r2Manager = new R2FileManager();
    
    const imageFiles = [
        { local: 'attached_assets/stock_images/professional_wedding_c4029288.jpg', r2name: 'wedding_photo_1.jpg' },
        { local: 'attached_assets/stock_images/professional_wedding_b175dc7d.jpg', r2name: 'wedding_photo_2.jpg' },
        { local: 'attached_assets/stock_images/professional_wedding_be65ae5c.jpg', r2name: 'wedding_photo_3.jpg' }
    ];

    console.log('Uploading test images to R2...');
    
    for (const img of imageFiles) {
        try {
            const fileBuffer = fs.readFileSync(img.local);
            const fileStream = fs.createReadStream(img.local);
            const fileSize = fileBuffer.length;
            
            const uploadResult = await r2Manager.uploadFile({
                userId,
                sessionId,
                fileName: img.r2name,
                originalFileName: img.r2name,
                fileBuffer,
                fileType: 'gallery',
                fileExtension: '.jpg',
                fileSizeBytes: fileSize,
                contentType: 'image/jpeg'
            });
            
            if (uploadResult.success) {
                console.log(`✅ Uploaded ${img.r2name} to R2`);
            } else {
                console.error(`❌ Failed to upload ${img.r2name}:`, uploadResult.error);
            }
        } catch (error) {
            console.error(`Error uploading ${img.local}:`, error.message);
        }
    }
    
    console.log('\n✅ Upload complete! Check the gallery manager.');
}

uploadTestImages().catch(console.error);