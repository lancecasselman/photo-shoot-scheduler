#!/usr/bin/env node

// Test script to verify the photo API fix for large galleries
// This script simulates what the gallery-manager.html does when loading photos

const http = require('http');

// Test configuration - Update these values if needed
const CONFIG = {
    host: 'localhost',
    port: 5000,
    sessionId: 'd0892278-1882-4466-955f-fba2425e53ef',
    folderType: 'gallery',
    // Replace with a valid session cookie if you have one
    sessionCookie: 'connect.sid=s%3Ad0d85f60-1f20-4dc3-9a29-ec1c08fb929b.xsO7qLuaJMLMxmLcLT8uOJkS9LdKUv7lzCJW24xLpOM'
};

console.log('🧪 Testing Photo API Fix');
console.log('================================');
console.log(`Session ID: ${CONFIG.sessionId}`);
console.log(`Folder Type: ${CONFIG.folderType}`);
console.log(`API Endpoint: http://${CONFIG.host}:${CONFIG.port}/api/sessions/${CONFIG.sessionId}/photos?folder=${CONFIG.folderType}`);
console.log('================================\n');

// Function to test the API
function testPhotoAPI() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: CONFIG.host,
            port: CONFIG.port,
            path: `/api/sessions/${CONFIG.sessionId}/photos?folder=${CONFIG.folderType}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cookie': CONFIG.sessionCookie
            }
        };

        const startTime = Date.now();
        console.log('⏳ Sending request to API...');

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const duration = Date.now() - startTime;
                console.log(`✅ Response received in ${duration}ms`);
                console.log(`Status Code: ${res.statusCode}`);
                console.log(`Status Message: ${res.statusMessage}`);
                console.log('Response Headers:', res.headers);
                console.log('================================\n');

                try {
                    const jsonData = JSON.parse(data);
                    
                    if (res.statusCode === 401 || res.statusCode === 403) {
                        console.log('❌ Authentication Error:');
                        console.log(JSON.stringify(jsonData, null, 2));
                        console.log('\n🔑 To test with authentication:');
                        console.log('1. Login to the app in a browser');
                        console.log('2. Open DevTools and get the session cookie value');
                        console.log('3. Update the sessionCookie in this script');
                    } else if (res.statusCode === 200) {
                        console.log('✅ API Response Success!');
                        console.log(`Success: ${jsonData.success}`);
                        console.log(`Total Files: ${jsonData.totalFiles || (jsonData.files ? jsonData.files.length : 0)}`);
                        console.log(`Session ID: ${jsonData.sessionId}`);
                        console.log(`Client Name: ${jsonData.clientName}`);
                        
                        if (jsonData.files && jsonData.files.length > 0) {
                            console.log('\n📸 Files Retrieved:');
                            console.log(`Number of files: ${jsonData.files.length}`);
                            
                            // Show first 5 files as examples
                            const samplesToShow = Math.min(5, jsonData.files.length);
                            console.log(`\nShowing first ${samplesToShow} files:`);
                            
                            for (let i = 0; i < samplesToShow; i++) {
                                const file = jsonData.files[i];
                                console.log(`\n  File ${i + 1}:`);
                                console.log(`    - Filename: ${file.filename}`);
                                console.log(`    - Size: ${(file.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`);
                                console.log(`    - Type: ${file.contentType}`);
                                console.log(`    - Has URL: ${!!file.url}`);
                                console.log(`    - Has Download URL: ${!!file.downloadUrl}`);
                                console.log(`    - Has Thumbnails: ${!!file.thumbnails && Object.keys(file.thumbnails).length > 0}`);
                                console.log(`    - Requires Auth: ${file.requiresAuth || false}`);
                                
                                if (file.error) {
                                    console.log(`    ⚠️ Error: ${file.error}`);
                                }
                            }
                            
                            if (jsonData.files.length > samplesToShow) {
                                console.log(`\n  ... and ${jsonData.files.length - samplesToShow} more files`);
                            }
                            
                            // Check URL generation strategy
                            const filesWithPresignedUrls = jsonData.files.filter(f => f.url && f.url.startsWith('https://'));
                            const filesWithPreviewEndpoints = jsonData.files.filter(f => f.url && f.url.startsWith('/api/r2/preview'));
                            
                            console.log('\n📊 URL Generation Strategy:');
                            console.log(`  - Files with presigned URLs: ${filesWithPresignedUrls.length}`);
                            console.log(`  - Files with preview endpoints: ${filesWithPreviewEndpoints.length}`);
                            
                            if (filesWithPreviewEndpoints.length > 0) {
                                console.log('\n💡 Note: Large galleries use preview endpoints to avoid timeout');
                                console.log('    This is expected behavior for galleries with >50 files');
                            }
                            
                            console.log('\n✅ SUCCESS: API is returning photos correctly!');
                        } else {
                            console.log('\n⚠️ Warning: API returned success but no files in response');
                            console.log('Full response:', JSON.stringify(jsonData, null, 2));
                        }
                    } else {
                        console.log(`❌ Unexpected status code: ${res.statusCode}`);
                        console.log('Response:', JSON.stringify(jsonData, null, 2));
                    }
                } catch (parseError) {
                    console.log('❌ Failed to parse JSON response');
                    console.log('Raw response:', data.substring(0, 500));
                    if (data.length > 500) {
                        console.log('... (truncated)');
                    }
                }
                
                resolve();
            });
        });

        req.on('error', (error) => {
            console.error('❌ Request Error:', error.message);
            reject(error);
        });

        // Set a timeout to prevent hanging
        req.setTimeout(30000, () => {
            console.error('❌ Request timeout after 30 seconds');
            req.abort();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Run the test
testPhotoAPI()
    .then(() => {
        console.log('\n🏁 Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    });