/**
 * Direct test of contract email sending functionality
 * This tests the email sending directly without needing database records
 */

const { initializeNotificationServices, sendContractForSignature } = require('./server/notifications');

// Initialize notification services
initializeNotificationServices();

// Test configuration
const CLIENT_EMAIL = 'm_casselman@icloud.com';
const CLIENT_NAME = 'Michael Casselman';
const SESSION_TYPE = 'Wedding Photography';
const SESSION_DATE = 'December 15, 2024';
const BUSINESS_NAME = 'The Legacy Photography';
const BUSINESS_EMAIL = 'lance@thelegacyphotography.com';
const SIGNING_URL = 'https://photomanagementsystem.com/sign/test-token-123';

async function testContractEmailDirect() {
    console.log('============================================================');
    console.log('DIRECT CONTRACT EMAIL TEST');
    console.log('============================================================');
    console.log('Testing contract email sending directly...\n');
    
    console.log('Email Details:');
    console.log('- To:', CLIENT_EMAIL);
    console.log('- Client Name:', CLIENT_NAME);
    console.log('- Session Type:', SESSION_TYPE);
    console.log('- Session Date:', SESSION_DATE);
    console.log('- Business Name:', BUSINESS_NAME);
    console.log('- Business Email:', BUSINESS_EMAIL);
    console.log('- Signing URL:', SIGNING_URL);
    console.log('\nSending contract email...\n');
    
    try {
        const result = await sendContractForSignature(
            CLIENT_EMAIL,
            CLIENT_NAME,
            SESSION_TYPE,
            SESSION_DATE,
            BUSINESS_NAME,
            BUSINESS_EMAIL,
            SIGNING_URL
        );
        
        if (result.success) {
            console.log('✅ Contract email sent successfully!');
            console.log('📧 Email delivered to:', CLIENT_EMAIL);
            console.log('📋 The email contains a link to sign the contract at:');
            console.log('   ', SIGNING_URL);
        } else {
            console.log('❌ Failed to send contract email:', result.error);
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Error details:', error);
    }
    
    console.log('\n============================================================');
    console.log('This test sends a real email to the specified address.');
    console.log('Check the inbox for:', CLIENT_EMAIL);
    console.log('============================================================');
}

// Run the test
testContractEmailDirect();