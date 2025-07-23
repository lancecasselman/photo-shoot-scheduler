const fetch = require('node-fetch');

async function testContractSystem() {
    const baseUrl = 'http://localhost:5000';
    
    try {
        console.log('🧪 Testing Contract System...\n');
        
        // Step 1: Get sessions
        console.log('1. Fetching sessions...');
        const sessionsResponse = await fetch(`${baseUrl}/api/sessions`);
        const sessions = await sessionsResponse.json();
        
        if (!sessions || sessions.length === 0) {
            console.log('❌ No sessions found. Creating a test session first.');
            return;
        }
        
        const testSession = sessions[0];
        console.log(`✅ Found session: ${testSession.clientName} (ID: ${testSession.id})`);
        
        // Step 2: Test contract creation
        console.log('\n2. Testing contract creation...');
        const contractResponse = await fetch(`${baseUrl}/api/sessions/${testSession.id}/contracts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contractType: 'photo_release'
            })
        });
        
        if (contractResponse.ok) {
            const contractResult = await contractResponse.json();
            console.log(`✅ Contract created successfully: ${contractResult.contract.id}`);
            
            // Step 3: Test getting contracts for session
            console.log('\n3. Testing contract retrieval...');
            const getContractsResponse = await fetch(`${baseUrl}/api/sessions/${testSession.id}/contracts`);
            
            if (getContractsResponse.ok) {
                const contracts = await getContractsResponse.json();
                console.log(`✅ Retrieved ${contracts.length} contract(s) for session`);
                
                if (contracts.length > 0) {
                    console.log(`   - Contract ID: ${contracts[0].id}`);
                    console.log(`   - Status: ${contracts[0].status}`);
                    console.log(`   - Type: ${contracts[0].contract_type}`);
                }
            } else {
                console.log('❌ Failed to retrieve contracts');
            }
            
        } else {
            const errorText = await contractResponse.text();
            console.log(`❌ Contract creation failed: ${errorText}`);
        }
        
        // Step 4: Test the contract signing page
        console.log('\n4. Testing contract signing page...');
        const signingPageResponse = await fetch(`${baseUrl}/contract-signing.html`);
        
        if (signingPageResponse.ok) {
            console.log('✅ Contract signing page accessible');
        } else {
            console.log('❌ Contract signing page not accessible');
        }
        
        console.log('\n🎉 Contract system testing complete!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testContractSystem();