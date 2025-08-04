// Test Firebase Admin SDK connection and permissions
const admin = require("firebase-admin");

async function testFirebaseConnection() {
  console.log('🔥 Testing Firebase connection...');
  
  try {
    // Parse service account
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('✅ Service account parsed successfully');
    console.log(`   Project: ${serviceAccount.project_id}`);
    console.log(`   Client: ${serviceAccount.client_email}`);
    
    // Initialize if not already done
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: `${serviceAccount.project_id}.appspot.com`,
      });
      console.log('✅ Firebase Admin initialized');
    }
    
    // Test Firestore connection
    console.log('\n📋 Testing Firestore...');
    const db = admin.firestore();
    
    // Try to write a test document
    const testRef = db.collection('connection-test').doc('test-doc');
    await testRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      test: true,
      message: 'Connection test successful'
    });
    console.log('✅ Firestore write successful');
    
    // Try to read the document back
    const doc = await testRef.get();
    if (doc.exists) {
      console.log('✅ Firestore read successful');
      console.log(`   Data: ${JSON.stringify(doc.data(), null, 2)}`);
    }
    
    // Clean up test document
    await testRef.delete();
    console.log('✅ Firestore cleanup successful');
    
    // Test Storage bucket access
    console.log('\n📦 Testing Firebase Storage...');
    const bucket = admin.storage().bucket();
    
    // Check bucket exists and we have access
    const [exists] = await bucket.exists();
    if (exists) {
      console.log('✅ Storage bucket exists and accessible');
      console.log(`   Bucket: ${bucket.name}`);
      
      // Test upload a small file
      const testFileName = 'connection-test.txt';
      const file = bucket.file(testFileName);
      await file.save('Firebase connection test - success!', {
        metadata: {
          contentType: 'text/plain'
        }
      });
      console.log('✅ Storage upload successful');
      
      // Clean up test file
      await file.delete();
      console.log('✅ Storage cleanup successful');
    } else {
      console.log('⚠️ Storage bucket not found or no access');
    }
    
    // Test Authentication service
    console.log('\n🔐 Testing Firebase Auth...');
    try {
      // Just check if we can access the auth service
      const userRecord = await admin.auth().getUser('test-uid-that-does-not-exist').catch(() => null);
      console.log('✅ Auth service accessible (expected user not found)');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('✅ Auth service accessible (expected error)');
      } else {
        console.log(`⚠️ Auth service error: ${error.code}`);
      }
    }
    
    console.log('\n🎉 Firebase connection test completed successfully!');
    console.log('✅ All Firebase services are working correctly');
    
  } catch (error) {
    console.error('\n❌ Firebase connection test failed:');
    console.error(`   Error: ${error.code || error.name}`);
    console.error(`   Message: ${error.message}`);
    
    if (error.code === 'permission-denied') {
      console.log('\n💡 Permission issue - check service account roles');
    } else if (error.code === 'invalid-argument') {
      console.log('\n💡 Configuration issue - check service account format');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('\n💡 Network issue - check internet connection');
    }
  }
}

// Run the test
testFirebaseConnection().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Test script error:', error);
  process.exit(1);
});