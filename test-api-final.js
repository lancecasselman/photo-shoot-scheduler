// Final test to verify the photo API fix is working
const http = require('http');

function testPhotoAPI() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/test/sessions/d0892278-1882-4466-955f-fba2425e53ef/photos?folder=gallery',
            method: 'GET'
        };

        console.log('🧪 Testing Photo API Response Fix...');
        const startTime = Date.now();
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const responseTime = Date.now() - startTime;
                
                try {
                    const jsonResponse = JSON.parse(data);
                    
                    console.log('✅ API Response Details:');
                    console.log('   - Status Code:', res.statusCode);
                    console.log('   - Response Time:', responseTime + 'ms');
                    console.log('   - Response Size:', (data.length / 1024).toFixed(2) + ' KB');
                    console.log('   - Success:', jsonResponse.success);
                    console.log('   - Total Files:', jsonResponse.totalFiles);
                    console.log('   - Photos Array Length:', jsonResponse.photos ? jsonResponse.photos.length : 0);
                    console.log('   - Has Client Name:', !!jsonResponse.clientName);
                    console.log('   - Session ID:', jsonResponse.sessionId);
                    
                    if (jsonResponse.success && jsonResponse.photos && jsonResponse.photos.length === 115) {
                        console.log('\n🎉 SUCCESS: Photo API is now working correctly!');
                        console.log('   All 115 files are being returned in the response.');
                        console.log('   The response format matches client expectations.');
                        
                        // Check sample photo structure
                        if (jsonResponse.photos[0]) {
                            const samplePhoto = jsonResponse.photos[0];
                            console.log('\n📸 Sample Photo Structure:');
                            console.log('   - fileName:', samplePhoto.fileName);
                            console.log('   - Has URL:', !!samplePhoto.url);
                            console.log('   - Has Thumbnails:', !!samplePhoto.thumbnails);
                            console.log('   - File Size:', samplePhoto.fileSize);
                        }
                        
                        resolve(true);
                    } else {
                        console.log('\n⚠️ Response received but not complete:');
                        console.log('   Expected 115 photos, got:', jsonResponse.photos ? jsonResponse.photos.length : 0);
                        resolve(false);
                    }
                } catch (error) {
                    console.error('❌ Failed to parse JSON:', error.message);
                    console.log('Raw response (first 500 chars):', data.substring(0, 500));
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Request error:', error.message);
            reject(error);
        });
        
        req.setTimeout(30000);
        req.end();
    });
}

// Run the test
testPhotoAPI()
    .then(success => {
        if (success) {
            console.log('\n✅ Photo API Fix Verified Successfully!');
            console.log('The API is now properly returning JSON responses with all photos.');
        } else {
            console.log('\n⚠️ API is responding but may need further investigation.');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    });