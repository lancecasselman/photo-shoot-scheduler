const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Create a simple test JPEG image using canvas
async function createTestImage() {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');
    
    // Create a gradient background
    const gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, '#4a90e2');
    gradient.addColorStop(1, '#7b68ee');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);
    
    // Add text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Test Upload Image', 400, 300);
    
    // Add timestamp
    ctx.font = '24px Arial';
    ctx.fillText(new Date().toISOString(), 400, 350);
    
    // Save as JPEG
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
    const filename = 'test-image-' + Date.now() + '.jpg';
    fs.writeFileSync(filename, buffer);
    
    console.log(`Created test image: ${filename}`);
    return filename;
}

// Upload the image to the server
async function uploadImage(filename, sessionId) {
    try {
        // First, get authentication token (simulate login)
        const loginResponse = await fetch('http://localhost:5000/api/auth/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: 'test-token' // This would normally be a Firebase token
            })
        });
        
        const cookies = loginResponse.headers.get('set-cookie');
        
        // Create form data for upload
        const form = new FormData();
        form.append('file', fs.createReadStream(filename));
        
        // Upload to the server
        const uploadResponse = await fetch(`http://localhost:5000/api/sessions/${sessionId}/files/gallery/upload-direct`, {
            method: 'POST',
            headers: {
                'Cookie': cookies || ''
            },
            body: form
        });
        
        const result = await uploadResponse.text();
        console.log('Upload response status:', uploadResponse.status);
        console.log('Upload response:', result);
        
        if (uploadResponse.ok) {
            const data = JSON.parse(result);
            console.log(' Upload successful!');
            console.log('File uploaded as:', data.fileName);
            console.log('R2 Key:', data.r2Key);
            console.log('Size:', data.size, 'MB');
        } else {
            console.error('❌ Upload failed:', result);
        }
        
        // Clean up test file
        fs.unlinkSync(filename);
        
    } catch (error) {
        console.error('Error during upload:', error);
    }
}

// Run the test
async function runTest() {
    console.log('Starting upload test...');
    
    // Use a test session ID (you'll need to replace this with an actual session ID)
    const sessionId = 'a7e93f59-9a96-497b-8af5-763858e84bd8'; // Using the session from your logs
    
    try {
        const filename = await createTestImage();
        await uploadImage(filename, sessionId);
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Check if canvas is available, if not use a pre-existing image
fs.access('notification-test.jpg', fs.constants.F_OK, (err) => {
    if (!err) {
        console.log('Using existing test image: notification-test.jpg');
        uploadImage('notification-test.jpg', 'a7e93f59-9a96-497b-8af5-763858e84bd8');
    } else {
        console.log('No test image found, creating one...');
        runTest();
    }
});