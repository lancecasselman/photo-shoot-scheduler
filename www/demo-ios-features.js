// iOS Features Demo for Photography Scheduler
// This demonstrates all native iOS capabilities

class iOSFeaturesDemo {
    constructor() {
        this.setupDemoInterface();
        this.initializeCapacitorFeatures();
    }

    setupDemoInterface() {
        // Create demo interface in the main app
        const demoSection = document.createElement('div');
        demoSection.id = 'ios-demo';
        demoSection.innerHTML = `
            <div class="demo-section">
                <h2>📱 iOS Native Features Demo</h2>
                <div class="demo-grid">
                    <div class="demo-card">
                        <h3>📸 Camera Integration</h3>
                        <p>Take client photos with native camera</p>
                        <button class="demo-btn" onclick="demoCamera()">Test Camera</button>
                        <div id="camera-result"></div>
                    </div>
                    
                    <div class="demo-card">
                        <h3>📞 Contact Actions</h3>
                        <p>Native phone, SMS, and email integration</p>
                        <button class="demo-btn" onclick="demoContacts()">Test Contacts</button>
                        <div id="contact-result"></div>
                    </div>
                    
                    <div class="demo-card">
                        <h3>🔔 Push Notifications</h3>
                        <p>Session reminders and alerts</p>
                        <button class="demo-btn" onclick="demoNotifications()">Test Notifications</button>
                        <div id="notification-result"></div>
                    </div>
                    
                    <div class="demo-card">
                        <h3>📱 Device Info</h3>
                        <p>Platform and device details</p>
                        <button class="demo-btn" onclick="demoDeviceInfo()">Get Device Info</button>
                        <div id="device-result"></div>
                    </div>
                    
                    <div class="demo-card">
                        <h3>🌐 Network Status</h3>
                        <p>Real-time connectivity monitoring</p>
                        <button class="demo-btn" onclick="demoNetwork()">Monitor Network</button>
                        <div id="network-result"></div>
                    </div>
                    
                    <div class="demo-card">
                        <h3>⚡ App State</h3>
                        <p>Background/foreground detection</p>
                        <button class="demo-btn" onclick="demoAppState()">Monitor App State</button>
                        <div id="app-state-result"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Add demo styles
        const demoStyles = document.createElement('style');
        demoStyles.textContent = `
            .demo-section {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 15px;
                padding: 20px;
                margin: 20px 0;
                backdrop-filter: blur(10px);
            }
            
            .demo-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }
            
            .demo-card {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
                padding: 20px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                transition: all 0.3s ease;
            }
            
            .demo-card:hover {
                transform: translateY(-5px);
                background: rgba(255, 255, 255, 0.1);
            }
            
            .demo-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 25px;
                padding: 12px 24px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                width: 100%;
                margin: 10px 0;
            }
            
            .demo-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.2);
            }
            
            .demo-result {
                margin-top: 15px;
                padding: 10px;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.1);
                font-size: 14px;
                line-height: 1.4;
            }
            
            .demo-success {
                background: rgba(76, 175, 80, 0.2);
                border: 1px solid rgba(76, 175, 80, 0.3);
            }
            
            .demo-error {
                background: rgba(244, 67, 54, 0.2);
                border: 1px solid rgba(244, 67, 54, 0.3);
            }
            
            .demo-info {
                background: rgba(33, 150, 243, 0.2);
                border: 1px solid rgba(33, 150, 243, 0.3);
            }
        `;
        
        document.head.appendChild(demoStyles);
        
        // Insert demo after the header
        const header = document.querySelector('header');
        if (header) {
            header.insertAdjacentElement('afterend', demoSection);
        } else {
            document.body.insertBefore(demoSection, document.body.firstChild);
        }
    }

    async initializeCapacitorFeatures() {
        console.log('Initializing Capacitor features...');
        
        // Check if we're in a Capacitor environment
        if (typeof window.Capacitor !== 'undefined') {
            console.log('Capacitor environment detected');
            this.showCapacitorStatus(true);
            await this.setupNativeFeatures();
        } else {
            console.log('Web environment - simulating native features');
            this.showCapacitorStatus(false);
            this.setupWebFallbacks();
        }
    }

    showCapacitorStatus(isNative) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'demo-card';
        statusDiv.innerHTML = `
            <h3>🚀 Platform Status</h3>
            <p><strong>Environment:</strong> ${isNative ? 'Native iOS App' : 'Web App'}</p>
            <p><strong>Capacitor:</strong> ${typeof window.Capacitor !== 'undefined' ? 'Available' : 'Not Available'}</p>
            <p><strong>Platform:</strong> ${typeof window.Capacitor !== 'undefined' ? window.Capacitor.getPlatform() : 'Web'}</p>
            <p><strong>Native Features:</strong> ${isNative ? 'Fully Available' : 'Web Fallbacks'}</p>
        `;
        
        const demoGrid = document.querySelector('.demo-grid');
        if (demoGrid) {
            demoGrid.insertBefore(statusDiv, demoGrid.firstChild);
        }
    }

    async setupNativeFeatures() {
        // Initialize native iOS features
        try {
            // Status bar configuration
            if (typeof StatusBar !== 'undefined') {
                await StatusBar.setStyle({ style: 'DARK' });
                console.log('Status bar configured');
            }
            
            // Hide splash screen
            if (typeof SplashScreen !== 'undefined') {
                await SplashScreen.hide();
                console.log('Splash screen hidden');
            }
            
            // Set up network monitoring
            if (typeof Network !== 'undefined') {
                Network.addListener('networkStatusChange', (status) => {
                    this.handleNetworkChange(status);
                });
                console.log('Network monitoring enabled');
            }
            
            // Set up app state monitoring
            if (typeof App !== 'undefined') {
                App.addListener('appStateChange', (state) => {
                    this.handleAppStateChange(state);
                });
                
                App.addListener('backButton', () => {
                    console.log('Back button pressed');
                });
                console.log('App state monitoring enabled');
            }
            
            console.log('All native features initialized');
        } catch (error) {
            console.error('Error initializing native features:', error);
        }
    }

    setupWebFallbacks() {
        // Set up web equivalents for testing
        console.log('Setting up web fallbacks for testing');
        
        // Monitor page visibility (similar to app state)
        document.addEventListener('visibilitychange', () => {
            const isVisible = !document.hidden;
            this.handleAppStateChange({ isActive: isVisible });
        });
        
        // Monitor network status
        window.addEventListener('online', () => {
            this.handleNetworkChange({ connected: true, connectionType: 'wifi' });
        });
        
        window.addEventListener('offline', () => {
            this.handleNetworkChange({ connected: false, connectionType: 'none' });
        });
    }

    handleNetworkChange(status) {
        console.log('Network status changed:', status);
        
        const networkResult = document.getElementById('network-result');
        if (networkResult) {
            networkResult.innerHTML = `
                <div class="demo-result ${status.connected ? 'demo-success' : 'demo-error'}">
                    <strong>Status:</strong> ${status.connected ? 'Connected' : 'Disconnected'}<br>
                    <strong>Type:</strong> ${status.connectionType || 'Unknown'}<br>
                    <strong>Time:</strong> ${new Date().toLocaleTimeString()}
                </div>
            `;
        }
    }

    handleAppStateChange(state) {
        console.log('App state changed:', state);
        
        const appStateResult = document.getElementById('app-state-result');
        if (appStateResult) {
            appStateResult.innerHTML = `
                <div class="demo-result demo-info">
                    <strong>State:</strong> ${state.isActive ? 'Active' : 'Background'}<br>
                    <strong>Time:</strong> ${new Date().toLocaleTimeString()}
                </div>
            `;
        }
    }
}

// Global demo functions
window.demoCamera = async function() {
    const result = document.getElementById('camera-result');
    
    try {
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            // Native camera
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: true,
                resultType: CameraResultType.Uri,
                source: CameraSource.Camera,
            });
            
            result.innerHTML = `
                <div class="demo-result demo-success">
                    <strong>Photo captured successfully!</strong><br>
                    <img src="${image.webPath}" style="max-width: 150px; border-radius: 8px; margin-top: 10px;">
                </div>
            `;
        } else {
            // Web fallback
            result.innerHTML = `
                <div class="demo-result demo-info">
                    <strong>Web Environment:</strong> Camera available in native iOS app only<br>
                    <strong>Feature:</strong> In native app, this opens the device camera
                </div>
            `;
        }
    } catch (error) {
        result.innerHTML = `
            <div class="demo-result demo-error">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    }
};

window.demoContacts = function() {
    const result = document.getElementById('contact-result');
    
    try {
        const phoneNumber = '1234567890';
        const email = 'client@example.com';
        
        result.innerHTML = `
            <div class="demo-result demo-success">
                <strong>Contact Actions Available:</strong><br>
                <button onclick="window.open('tel:${phoneNumber}')" class="demo-btn">📞 Call ${phoneNumber}</button>
                <button onclick="window.open('sms:${phoneNumber}')" class="demo-btn">💬 SMS ${phoneNumber}</button>
                <button onclick="window.open('mailto:${email}')" class="demo-btn">✉️ Email ${email}</button>
            </div>
        `;
    } catch (error) {
        result.innerHTML = `
            <div class="demo-result demo-error">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    }
};

window.demoNotifications = async function() {
    const result = document.getElementById('notification-result');
    
    try {
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            // Native push notifications
            const permission = await PushNotifications.requestPermissions();
            
            if (permission.receive === 'granted') {
                // Schedule a test notification
                await PushNotifications.schedule({
                    notifications: [{
                        title: 'Photography Scheduler',
                        body: 'Session reminder: Client meeting in 1 hour',
                        id: Date.now(),
                        schedule: { at: new Date(Date.now() + 5000) }
                    }]
                });
                
                result.innerHTML = `
                    <div class="demo-result demo-success">
                        <strong>Notification scheduled!</strong><br>
                        Test notification will appear in 5 seconds
                    </div>
                `;
            } else {
                result.innerHTML = `
                    <div class="demo-result demo-error">
                        <strong>Permission denied:</strong> ${permission.receive}
                    </div>
                `;
            }
        } else {
            // Web notification fallback
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                setTimeout(() => {
                    new Notification('Photography Scheduler', {
                        body: 'Session reminder: Client meeting in 1 hour',
                        icon: '/icon-192x192.svg'
                    });
                }, 5000);
                
                result.innerHTML = `
                    <div class="demo-result demo-info">
                        <strong>Web notification scheduled!</strong><br>
                        Test notification will appear in 5 seconds
                    </div>
                `;
            } else {
                result.innerHTML = `
                    <div class="demo-result demo-error">
                        <strong>Permission:</strong> ${permission}
                    </div>
                `;
            }
        }
    } catch (error) {
        result.innerHTML = `
            <div class="demo-result demo-error">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    }
};

window.demoDeviceInfo = async function() {
    const result = document.getElementById('device-result');
    
    try {
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            // Native device info
            const deviceInfo = await Device.getInfo();
            
            result.innerHTML = `
                <div class="demo-result demo-success">
                    <strong>Device Information:</strong><br>
                    <strong>Platform:</strong> ${deviceInfo.platform}<br>
                    <strong>Model:</strong> ${deviceInfo.model}<br>
                    <strong>OS Version:</strong> ${deviceInfo.osVersion}<br>
                    <strong>App Version:</strong> ${deviceInfo.appVersion}<br>
                    <strong>Device ID:</strong> ${deviceInfo.identifier?.substring(0, 8)}...
                </div>
            `;
        } else {
            // Web device info
            result.innerHTML = `
                <div class="demo-result demo-info">
                    <strong>Web Environment:</strong><br>
                    <strong>Platform:</strong> ${navigator.platform}<br>
                    <strong>User Agent:</strong> ${navigator.userAgent.substring(0, 50)}...<br>
                    <strong>Language:</strong> ${navigator.language}<br>
                    <strong>Online:</strong> ${navigator.onLine}
                </div>
            `;
        }
    } catch (error) {
        result.innerHTML = `
            <div class="demo-result demo-error">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    }
};

window.demoNetwork = async function() {
    const result = document.getElementById('network-result');
    
    try {
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            // Native network status
            const status = await Network.getStatus();
            
            result.innerHTML = `
                <div class="demo-result ${status.connected ? 'demo-success' : 'demo-error'}">
                    <strong>Network Status:</strong><br>
                    <strong>Connected:</strong> ${status.connected}<br>
                    <strong>Type:</strong> ${status.connectionType}<br>
                    <strong>Monitoring:</strong> Real-time updates enabled
                </div>
            `;
        } else {
            // Web network status
            result.innerHTML = `
                <div class="demo-result ${navigator.onLine ? 'demo-success' : 'demo-error'}">
                    <strong>Network Status:</strong><br>
                    <strong>Online:</strong> ${navigator.onLine}<br>
                    <strong>Connection:</strong> ${navigator.connection?.effectiveType || 'Unknown'}<br>
                    <strong>Monitoring:</strong> Page visibility events enabled
                </div>
            `;
        }
    } catch (error) {
        result.innerHTML = `
            <div class="demo-result demo-error">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    }
};

window.demoAppState = function() {
    const result = document.getElementById('app-state-result');
    
    try {
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            result.innerHTML = `
                <div class="demo-result demo-success">
                    <strong>App State Monitoring:</strong><br>
                    Listening for app state changes...<br>
                    <strong>Tip:</strong> Switch to another app and back to see updates
                </div>
            `;
        } else {
            result.innerHTML = `
                <div class="demo-result demo-info">
                    <strong>Page Visibility Monitoring:</strong><br>
                    Listening for tab visibility changes...<br>
                    <strong>Tip:</strong> Switch to another tab and back to see updates
                </div>
            `;
        }
    } catch (error) {
        result.innerHTML = `
            <div class="demo-result demo-error">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    }
};

// Initialize demo when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Starting iOS features demo...');
    new iOSFeaturesDemo();
});

// Export for external use
window.iOSFeaturesDemo = iOSFeaturesDemo;