// Test the API with simulated authentication
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const baseUrl = 'http://localhost:5000';
const sessionId = 'd0892278-1882-4466-955f-fba2425e53ef';

// Simulate an authenticated request by creating a session first
async function testAuthenticatedAPI() {
    console.log('🧪 Testing Download Policy API with Authentication Simulation');
    console.log('===============================================================\n');
    
    try {
        // Test the gallery manager page (it should contain the session data in JavaScript)
        console.log('1. Testing gallery manager page access');
        const pageResponse = await fetch(`${baseUrl}/gallery-manager.html?sessionId=${sessionId}&folderType=gallery&clientName=John%20Casselman`);
        console.log(`   Gallery Manager Status: ${pageResponse.status}`);
        
        if (pageResponse.ok) {
            const pageContent = await pageResponse.text();
            
            // Check if the quickToggleDownloads function exists
            const hasToggleFunction = pageContent.includes('quickToggleDownloads');
            const hasDownloadEnabled = pageContent.includes('downloadEnabled');
            const hasToggleButton = pageContent.includes('toggleDownloadsBtn');
            
            console.log('   ✅ Gallery Manager loaded successfully');
            console.log(`   📋 Contains quickToggleDownloads function: ${hasToggleFunction}`);
            console.log(`   📋 References downloadEnabled: ${hasDownloadEnabled}`);
            console.log(`   📋 Has toggle button: ${hasToggleButton}`);
            
        } else {
            console.log('   ❌ Gallery Manager failed to load');
        }
        
        console.log('');
        
        // Test the client gallery 
        console.log('2. Testing client gallery access');
        const galleryResponse = await fetch(`${baseUrl}/gallery/dda7ad42-1613-4bac-9fe0-7b38d10dba80`);
        console.log(`   Client Gallery Status: ${galleryResponse.status}`);
        
        if (galleryResponse.ok) {
            const galleryContent = await galleryResponse.text();
            const hasDownloadControls = galleryContent.includes('download') || galleryContent.includes('Download');
            console.log('   ✅ Client gallery loaded successfully');
            console.log(`   📋 Contains download controls: ${hasDownloadControls}`);
        } else {
            console.log('   ❌ Client gallery failed to load');
        }
        
        console.log('');
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
    }
}

testAuthenticatedAPI();
