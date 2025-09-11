// Test script to verify the photo API response is working
const https = require('https');

// Test configuration - replace with actual values
const sessionId = 'd0892278-1882-4466-955f-fba2425e53ef'; // The session with 115 files
const authToken = 'test-token'; // This would normally come from authentication

// Function to test the photo API endpoint
async function testPhotoAPI() {
    console.log('🧪 Testing Photo API Response...');
    console.log(`📸 Session ID: ${sessionId}`);
    
    const options = {
        hostname: 'localhost',
        port: 5000,
        path: `/api/sessions/${sessionId}/photos`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            // Include authentication headers if needed
            'Cookie': 'connect.sid=s%3AH9DsPnVTVDLqv8Zf_MxMl-xJ5fPfKDt3.rFz1AhOdXQj0a6vG8Zr5kLgv1YvbElGqKJ1y9N8QxWo' // Example session cookie
        },
        rejectUnauthorized: false // For local testing
    };
    
    return new Promise((resolve, reject) => {
        console.log('📡 Making request to:', `http://localhost:5000${options.path}`);
        
        const startTime = Date.now();
        
        const req = https.request(options, (res) => {
            let data = '';
            
            console.log(`📥 Response Status: ${res.statusCode}`);
            console.log(`📥 Response Headers:`, res.headers);
            
            res.on('data', (chunk) => {
                data += chunk;
                // Log progress for large responses
                if (data.length % 10000 === 0) {
                    console.log(`📦 Received ${data.length} bytes so far...`);
                }
            });
            
            res.on('end', () => {
                const responseTime = Date.now() - startTime;
                console.log(`⏱️ Response received in ${responseTime}ms`);
                console.log(`📦 Total response size: ${data.length} bytes`);
                
                try {
                    const jsonResponse = JSON.parse(data);
                    
                    console.log('✅ Successfully received JSON response!');
                    console.log(`📸 Total files: ${jsonResponse.totalFiles || 0}`);
                    console.log(`📁 Session ID: ${jsonResponse.sessionId}`);
                    console.log(`👤 Client Name: ${jsonResponse.clientName}`);
                    
                    if (jsonResponse.files && Array.isArray(jsonResponse.files)) {
                        console.log(`✅ Files array received with ${jsonResponse.files.length} items`);
                        
                        // Show first few files as examples
                        const sampleFiles = jsonResponse.files.slice(0, 3);
                        console.log('📸 Sample files:');
                        sampleFiles.forEach((file, index) => {
                            console.log(`  ${index + 1}. ${file.filename} (${file.folderType})`);
                        });
                        
                        if (jsonResponse.files.length === 115) {
                            console.log('🎉 SUCCESS: All 115 files received in response!');
                        }
                    } else {
                        console.log('⚠️ No files array in response');
                    }
                    
                    resolve(jsonResponse);
                } catch (parseError) {
                    console.error('❌ Failed to parse JSON response:', parseError.message);
                    console.log('📄 Raw response:', data.substring(0, 500));
                    reject(parseError);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Request error:', error.message);
            reject(error);
        });
        
        req.on('timeout', () => {
            console.error('❌ Request timeout after 30 seconds');
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        // Set a timeout of 30 seconds
        req.setTimeout(30000);
        
        req.end();
    });
}

// Alternative test using fetch (simpler)
async function testWithFetch() {
    console.log('\n🧪 Testing with fetch API...');
    
    try {
        const response = await fetch(`http://localhost:5000/api/sessions/${sessionId}/photos`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`📥 Response Status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Successfully received JSON response!');
            console.log(`📸 Total files: ${data.totalFiles || 0}`);
            
            if (data.files && data.files.length === 115) {
                console.log('🎉 SUCCESS: All 115 files received in response!');
            }
            
            return data;
        } else {
            console.error('❌ Response not OK:', response.status, response.statusText);
            const errorText = await response.text();
            console.log('Error response:', errorText);
        }
    } catch (error) {
        console.error('❌ Fetch error:', error.message);
    }
}

// Run the test
console.log('🚀 Starting Photo API Response Test');
console.log('================================\n');

// First check if we can connect to the server
const http = require('http');
http.get('http://localhost:5000/', (res) => {
    console.log('✅ Server is running on port 5000');
    console.log('\nNote: This test requires authentication. You may need to:');
    console.log('1. Be logged in to the application');
    console.log('2. Have a valid session cookie');
    console.log('3. Use the correct session ID that belongs to your user\n');
    
    // Run the actual test
    testPhotoAPI()
        .then(result => {
            console.log('\n✅ Test completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Test failed:', error.message);
            process.exit(1);
        });
}).on('error', (err) => {
    console.error('❌ Cannot connect to server on port 5000:', err.message);
    console.log('Make sure the server is running with: node server.js');
    process.exit(1);
});