// Test script for download policy API endpoints
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const baseUrl = 'http://localhost:5000';
const sessionId = 'd0892278-1882-4466-955f-fba2425e53ef';

async function testDownloadPolicyApi() {
    console.log('🧪 Testing Download Policy API Endpoints');
    console.log('========================================\n');

    try {
        // Test 1: GET download policy (should work without auth for public endpoints)
        console.log('1. Testing GET /api/downloads/sessions/:sessionId/policy');
        const getResponse = await fetch(`${baseUrl}/api/downloads/sessions/${sessionId}/policy`);
        console.log(`   Status: ${getResponse.status}`);
        
        if (getResponse.ok) {
            const policy = await getResponse.json();
            console.log('   ✅ GET Policy successful:', JSON.stringify(policy, null, 2));
        } else {
            const error = await getResponse.text();
            console.log('   ❌ GET Policy failed:', error);
        }
        console.log('');

        // Test 2: Test PUT download policy (will likely need auth)
        console.log('2. Testing PUT /api/downloads/sessions/:sessionId/policy');
        const formData = new URLSearchParams();
        formData.append('downloadEnabled', 'true');
        formData.append('pricingModel', 'freemium');
        formData.append('pricePerDownload', '2.99');
        formData.append('freeDownloads', '3');
        formData.append('watermarkEnabled', 'true');
        formData.append('watermarkText', 'Test Watermark');
        
        const putResponse = await fetch(`${baseUrl}/api/downloads/sessions/${sessionId}/policy`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });
        
        console.log(`   Status: ${putResponse.status}`);
        
        if (putResponse.ok) {
            const result = await putResponse.json();
            console.log('   ✅ PUT Policy successful:', JSON.stringify(result, null, 2));
        } else {
            const error = await putResponse.text();
            console.log('   ❌ PUT Policy failed (likely needs auth):', error);
        }
        console.log('');

        // Test 3: Test client gallery endpoint
        console.log('3. Testing GET /api/downloads/client-gallery/:sessionId');
        const clientResponse = await fetch(`${baseUrl}/api/downloads/client-gallery/${sessionId}`);
        console.log(`   Status: ${clientResponse.status}`);
        
        if (clientResponse.ok) {
            const data = await clientResponse.json();
            console.log('   ✅ Client gallery data:', {
                sessionExists: !!data.session,
                photoCount: data.photos?.length || 0,
                downloadPolicy: data.session?.pricingModel || 'none'
            });
        } else {
            const error = await clientResponse.text();
            console.log('   ❌ Client gallery failed:', error);
        }
        console.log('');

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
    }
}

// Run tests
testDownloadPolicyApi();