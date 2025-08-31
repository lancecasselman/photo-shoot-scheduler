/**
 * Test script for contract email sending functionality
 * This tests the booking agreement send endpoint to ensure contracts are sent via email
 */

const http = require('http');
const https = require('https');

// Test configuration
const SERVER_URL = 'http://localhost:5000';
const AGREEMENT_ID = '5bf0d5d9-a829-41d5-a764-f7c6aab4485e'; // Actual agreement ID from database
const CLIENT_EMAIL = 'm_casselman@icloud.com'; // Using a real email for testing
const CLIENT_NAME = 'Michael Casselman';
const SESSION_TYPE = 'Wedding Photography';
const SESSION_DATE = 'December 15, 2024';

async function testContractEmailSending() {
    console.log('============================================================');
    console.log('CONTRACT EMAIL SENDING TEST');
    console.log('============================================================');
    console.log('Testing contract email sending system...\n');
    
    try {
        // Prepare the request body
        const requestBody = {
            clientEmail: CLIENT_EMAIL,
            clientName: CLIENT_NAME,
            sessionType: SESSION_TYPE,
            sessionDate: SESSION_DATE
        };
        
        console.log('Request details:');
        console.log('- Client Email:', CLIENT_EMAIL);
        console.log('- Client Name:', CLIENT_NAME);
        console.log('- Session Type:', SESSION_TYPE);
        console.log('- Session Date:', SESSION_DATE);
        console.log('\nSending contract for signature...\n');
        
        // Send the request using http module
        const result = await new Promise((resolve, reject) => {
            const data = JSON.stringify(requestBody);
            
            const options = {
                hostname: 'localhost',
                port: 5000,
                path: `/api/booking/agreements/${AGREEMENT_ID}/send`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                    'Cookie': 'connect.sid=test-session'
                }
            };
            
            const req = http.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        resolve({ status: res.statusCode, data: parsed });
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.write(data);
            req.end();
        });
        
        console.log('Response Status:', result.status);
        console.log('Response:', JSON.stringify(result.data, null, 2));
        
        if (result.data.success) {
            console.log('\n✅ Contract sending request successful!');
            if (result.data.emailSent) {
                console.log('📧 Email sent successfully to:', CLIENT_EMAIL);
                console.log('🔗 Signing URL:', result.data.signingUrl);
            } else {
                console.log('⚠️ Agreement ready but email failed:', result.data.emailError);
                console.log('📋 Manual signing URL:', result.data.signingUrl);
            }
        } else {
            console.log('\n❌ Failed to send contract:', result.data.error || result.data.message);
        }
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        console.error('Error details:', error);
    }
    
    console.log('\n============================================================');
    console.log('Note: To test with a real agreement:');
    console.log('1. Create an agreement through the UI first');
    console.log('2. Get the agreement ID from the database or UI');
    console.log('3. Replace AGREEMENT_ID in this script with the actual ID');
    console.log('4. Update CLIENT_EMAIL with a real email address to receive the contract');
    console.log('============================================================');
}

// Run the test
testContractEmailSending();