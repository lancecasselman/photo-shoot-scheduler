// Enhanced Photography Scheduler with Capacitor iOS Native Features
import { App } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Keyboard } from '@capacitor/keyboard';
import { PushNotifications } from '@capacitor/push-notifications';

// Original app functionality
let sessions = [];
let nextId = 1;

// Capacitor native features
class CapacitorPhotoScheduler {
    constructor() {
        this.init();
    }

    async init() {
        // Initialize Capacitor
        await this.initializeCapacitor();
        
        // Initialize original app
        this.initializeApp();
        
        // Set up native features
        this.setupNativeFeatures();
    }

    async initializeCapacitor() {
        // Configure status bar
        await StatusBar.setStyle({ style: 'DARK' });
        
        // Hide splash screen
        await SplashScreen.hide();
        
        // Get device info
        const deviceInfo = await Device.getInfo();
        console.log('Device info:', deviceInfo);
        
        // Check network status
        const networkStatus = await Network.getStatus();
        console.log('Network status:', networkStatus);
        
        // Set up network monitoring
        Network.addListener('networkStatusChange', status => {
            console.log('Network status changed:', status);
            this.handleNetworkChange(status);
        });
    }

    initializeApp() {
        // Load existing sessions
        this.loadSessions();
        
        // Set up form handling
        this.setupFormHandling();
        
        // Set up mobile-specific features
        this.setupMobileFeatures();
    }

    setupNativeFeatures() {
        // Set up push notifications
        this.setupPushNotifications();
        
        // Set up keyboard handling
        this.setupKeyboardHandling();
        
        // Set up app state handling
        this.setupAppStateHandling();
    }

    async setupPushNotifications() {
        // Request permissions
        await PushNotifications.requestPermissions();
        
        // Register for push notifications
        await PushNotifications.register();
        
        // Handle registration
        PushNotifications.addListener('registration', token => {
            console.log('Push registration success, token: ' + token.value);
        });
        
        // Handle errors
        PushNotifications.addListener('registrationError', err => {
            console.error('Registration error: ', err.error);
        });
        
        // Handle incoming notifications
        PushNotifications.addListener('pushNotificationReceived', notification => {
            console.log('Push notification received: ', notification);
            this.handleNotification(notification);
        });
    }

    setupKeyboardHandling() {
        // Handle keyboard show/hide
        Keyboard.addListener('keyboardWillShow', info => {
            document.body.style.paddingBottom = `${info.keyboardHeight}px`;
        });
        
        Keyboard.addListener('keyboardWillHide', () => {
            document.body.style.paddingBottom = '0px';
        });
    }

    setupAppStateHandling() {
        // Handle app state changes
        App.addListener('appStateChange', state => {
            console.log('App state changed:', state);
            
            if (state.isActive) {
                // App became active - refresh data
                this.loadSessions();
            } else {
                // App went to background - save state
                this.saveAppState();
            }
        });
        
        // Handle back button
        App.addListener('backButton', () => {
            // Handle back button press
            console.log('Back button pressed');
        });
    }

    setupMobileFeatures() {
        // Add camera functionality for client photos
        this.addCameraFeature();
        
        // Enhance contact buttons with native actions
        this.enhanceContactButtons();
    }

    addCameraFeature() {
        // Add camera button to form
        const form = document.getElementById('session-form');
        if (form) {
            const cameraButton = document.createElement('button');
            cameraButton.type = 'button';
            cameraButton.textContent = '📸 Take Client Photo';
            cameraButton.className = 'camera-btn';
            cameraButton.onclick = () => this.takePhoto();
            
            form.appendChild(cameraButton);
        }
    }

    async takePhoto() {
        try {
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: true,
                resultType: CameraResultType.Uri,
                source: CameraSource.Camera,
            });
            
            // Store the image URI
            const imageUri = image.webPath;
            console.log('Photo taken:', imageUri);
            
            // You can store this URI with the session
            return imageUri;
        } catch (error) {
            console.error('Error taking photo:', error);
        }
    }

    enhanceContactButtons() {
        // This will be called when sessions are rendered
        // to enhance phone and SMS buttons with native actions
    }

    handleNetworkChange(status) {
        const networkStatus = document.getElementById('network-status');
        if (networkStatus) {
            networkStatus.textContent = status.connected ? 'Online' : 'Offline';
            networkStatus.className = status.connected ? 'online' : 'offline';
        }
        
        // Show/hide sync indicators
        if (!status.connected) {
            this.showOfflineMode();
        } else {
            this.hideOfflineMode();
            this.syncData();
        }
    }

    showOfflineMode() {
        const offlineIndicator = document.createElement('div');
        offlineIndicator.id = 'offline-indicator';
        offlineIndicator.textContent = 'Offline Mode - Changes will sync when connected';
        offlineIndicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ff6b6b;
            color: white;
            padding: 10px;
            text-align: center;
            z-index: 1000;
        `;
        
        if (!document.getElementById('offline-indicator')) {
            document.body.appendChild(offlineIndicator);
        }
    }

    hideOfflineMode() {
        const offlineIndicator = document.getElementById('offline-indicator');
        if (offlineIndicator) {
            offlineIndicator.remove();
        }
    }

    handleNotification(notification) {
        // Handle push notifications
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'notification';
        notificationDiv.innerHTML = `
            <h4>${notification.title}</h4>
            <p>${notification.body}</p>
        `;
        
        document.body.appendChild(notificationDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notificationDiv.remove();
        }, 5000);
    }

    // Enhanced session management with native features
    async loadSessions() {
        try {
            const response = await fetch('/api/sessions');
            if (response.ok) {
                const data = await response.json();
                sessions = data.sessions || [];
                this.renderSessions();
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
            this.loadOfflineSessions();
        }
    }

    loadOfflineSessions() {
        // Load from local storage when offline
        const offlineSessions = localStorage.getItem('offline_sessions');
        if (offlineSessions) {
            sessions = JSON.parse(offlineSessions);
            this.renderSessions();
        }
    }

    async syncData() {
        // Sync offline changes when connection is restored
        const offlineChanges = localStorage.getItem('offline_changes');
        if (offlineChanges) {
            const changes = JSON.parse(offlineChanges);
            
            for (const change of changes) {
                try {
                    await this.syncChange(change);
                } catch (error) {
                    console.error('Error syncing change:', error);
                }
            }
            
            // Clear offline changes
            localStorage.removeItem('offline_changes');
        }
    }

    async syncChange(change) {
        // Sync individual changes
        const response = await fetch(`/api/sessions${change.id ? `/${change.id}` : ''}`, {
            method: change.method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(change.data)
        });
        
        return response.json();
    }

    saveAppState() {
        // Save current state when app goes to background
        localStorage.setItem('app_state', JSON.stringify({
            sessions,
            lastSync: new Date().toISOString()
        }));
    }

    // Enhanced form handling for mobile
    setupFormHandling() {
        const form = document.getElementById('session-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleFormSubmission(e);
            });
        }
    }

    async handleFormSubmission(e) {
        const formData = new FormData(e.target);
        const sessionData = Object.fromEntries(formData);
        
        // Add mobile-specific data
        const deviceInfo = await Device.getInfo();
        sessionData.createdOnDevice = deviceInfo.platform;
        sessionData.deviceId = deviceInfo.identifier;
        
        // Add photo if taken
        if (this.currentPhotoUri) {
            sessionData.clientPhoto = this.currentPhotoUri;
        }
        
        await this.addSession(sessionData);
    }

    async addSession(sessionData) {
        // Add session with offline support
        const session = {
            id: nextId++,
            ...sessionData,
            createdAt: new Date().toISOString()
        };
        
        sessions.push(session);
        this.renderSessions();
        
        // Try to sync with server
        try {
            await this.syncSessionToServer(session);
        } catch (error) {
            console.error('Error syncing session:', error);
            this.saveOfflineChange('POST', session);
        }
    }

    async syncSessionToServer(session) {
        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(session)
        });
        
        if (!response.ok) {
            throw new Error('Failed to sync session');
        }
        
        return response.json();
    }

    saveOfflineChange(method, data) {
        // Save changes for later sync
        const offlineChanges = JSON.parse(localStorage.getItem('offline_changes') || '[]');
        offlineChanges.push({
            method,
            data,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('offline_changes', JSON.stringify(offlineChanges));
    }

    renderSessions() {
        const sessionsContainer = document.getElementById('sessions');
        if (!sessionsContainer) return;
        
        sessionsContainer.innerHTML = '';
        
        sessions.forEach(session => {
            const sessionCard = this.createSessionCard(session);
            sessionsContainer.appendChild(sessionCard);
        });
    }

    createSessionCard(session) {
        const card = document.createElement('div');
        card.className = 'session-card';
        
        card.innerHTML = `
            <div class="session-header">
                <h3>${session.clientName}</h3>
                <span class="session-type">${session.sessionType}</span>
            </div>
            
            <div class="session-details">
                <p><strong>Date:</strong> ${new Date(session.dateTime).toLocaleDateString()}</p>
                <p><strong>Location:</strong> ${session.location}</p>
                <p><strong>Price:</strong> $${session.price}</p>
            </div>
            
            <div class="session-contacts">
                <button class="contact-btn call-btn" onclick="window.open('tel:${session.phoneNumber}')">
                    📞 Call
                </button>
                <button class="contact-btn sms-btn" onclick="window.open('sms:${session.phoneNumber}')">
                    💬 Text
                </button>
                <button class="contact-btn email-btn" onclick="window.open('mailto:${session.email}')">
                    ✉️ Email
                </button>
            </div>
            
            <div class="session-status">
                <label><input type="checkbox" ${session.contractSigned ? 'checked' : ''}> Contract Signed</label>
                <label><input type="checkbox" ${session.paid ? 'checked' : ''}> Paid</label>
                <label><input type="checkbox" ${session.edited ? 'checked' : ''}> Edited</label>
                <label><input type="checkbox" ${session.delivered ? 'checked' : ''}> Delivered</label>
            </div>
            
            ${session.clientPhoto ? `<img src="${session.clientPhoto}" alt="Client Photo" class="client-photo">` : ''}
        `;
        
        return card;
    }

    // Schedule push notifications for reminders
    async scheduleReminder(session) {
        const reminderTime = new Date(session.dateTime);
        reminderTime.setHours(reminderTime.getHours() - 24); // 24 hours before
        
        await PushNotifications.schedule({
            notifications: [{
                title: 'Photography Session Reminder',
                body: `Session with ${session.clientName} tomorrow at ${new Date(session.dateTime).toLocaleTimeString()}`,
                id: session.id,
                schedule: { at: reminderTime }
            }]
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CapacitorPhotoScheduler();
});

// Export for use in other files
window.CapacitorPhotoScheduler = CapacitorPhotoScheduler;