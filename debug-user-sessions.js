// Debug script to check current user and associated sessions
// Add this temporarily to auth.html to debug authentication

console.log('🔍 Debugging user authentication and sessions...');

// Function to check current user after authentication
window.debugCurrentUser = function() {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            console.log('✅ Current Firebase User:', {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName
            });
            
            // Check what sessions this user should see
            try {
                const response = await fetch('/api/sessions', {
                    headers: {
                        'Authorization': `Bearer ${await user.getIdToken()}`
                    }
                });
                
                if (response.ok) {
                    const sessions = await response.json();
                    console.log(`📋 Sessions for ${user.email}:`, sessions);
                    
                    if (sessions.length === 0) {
                        console.log('⚠️ No sessions found for this user.');
                        console.log('Expected sessions for lancecasselman@icloud.com:');
                        console.log('- Tyler Decker (family)');
                        console.log('- Tina and Nick Balser (family)');
                        console.log('- Maddie and Taya (engagement)');
                    }
                } else {
                    console.log('❌ Failed to fetch sessions:', response.status);
                }
            } catch (error) {
                console.log('❌ Error fetching sessions:', error);
            }
        } else {
            console.log('❌ No user authenticated');
        }
    });
};

// Auto-run when page loads
if (typeof firebase !== 'undefined') {
    window.debugCurrentUser();
}