const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function uploadTestImages() {
    const sessionId = '6fc2ee67-9455-4115-bd43-1102569080e6';
    const userId = 'dev-test-user-001';
    
    const imageFiles = [
        'attached_assets/stock_images/professional_wedding_c4029288.jpg',
        'attached_assets/stock_images/professional_wedding_b175dc7d.jpg',
        'attached_assets/stock_images/professional_wedding_be65ae5c.jpg'
    ];

    console.log('Uploading test wedding photos to session...');
    
    for (const imagePath of imageFiles) {
        try {
            const form = new FormData();
            form.append('file', fs.createReadStream(imagePath));
            form.append('sessionId', sessionId);
            form.append('userId', userId);
            form.append('folderType', 'gallery');

            console.log(`Uploading ${imagePath}...`);
            
            const response = await fetch('http://localhost:5000/api/r2/gallery-upload', {
                method: 'POST',
                body: form,
                headers: {
                    'Cookie': 'connect.sid=test-session-cookie'
                }
            });

            const result = await response.json();
            console.log(`Response:`, result);
            
            if (response.ok) {
                console.log(`✅ Successfully uploaded ${imagePath}`);
            } else {
                console.error(`❌ Failed to upload ${imagePath}:`, result.error);
            }
        } catch (error) {
            console.error(`Error uploading ${imagePath}:`, error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\nUpload complete! Images should now be available in the gallery manager.');
}

uploadTestImages();