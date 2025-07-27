// Test Firebase Authentication Flow on Custom Domain
// This script tests if Firebase authentication is working on photomanagementsystem.com

console.log('Testing Firebase Authentication on Custom Domain...');

// Test Firebase initialization
fetch('https://photomanagementsystem.com/firebase-config.js')
  .then(response => response.text())
  .then(config => {
    console.log('✅ Firebase config loaded');
    
    // Test if domain is authorized by checking for auth errors
    return fetch('https://photomanagementsystem.com/auth.html');
  })
  .then(response => response.text())
  .then(html => {
    const hasAuthErrors = html.toLowerCase().includes('unauthorized') || 
                         html.toLowerCase().includes('domain is not authorized');
    
    if (hasAuthErrors) {
      console.log('❌ Firebase domain authorization needed');
      console.log('Required: Add photomanagementsystem.com to Firebase Console');
    } else {
      console.log('✅ No Firebase domain errors detected');
    }
    
    // Test API status
    return fetch('https://photomanagementsystem.com/api/status');
  })
  .then(response => response.json())
  .then(status => {
    console.log('API Status:', status);
    console.log(`Authentication: ${status.authenticationEnabled ? '✅' : '❌'}`);
    console.log(`Firebase: ${status.firebaseInitialized ? '✅' : '❌'}`);
    console.log(`Database: ${status.databaseConnected ? '✅' : '❌'}`);
  })
  .catch(error => {
    console.error('Test failed:', error);
  });