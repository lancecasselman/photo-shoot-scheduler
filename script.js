// Photography Session Scheduler
// Session management system with cloud database

// Listen for contract signing messages from popup windows
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'contractSigned') {
        console.log('📡 Received contract signed notification:', event.data);
        
        // Update the specific session's agreement status
        const sessionId = event.data.sessionId;
        if (sessionId) {
            // Update the booking agreement status for this session
            if (typeof window.updateAgreementStatus === 'function') {
                window.updateAgreementStatus(sessionId, 'signed');
            }
            
            // Also refresh the session data to get the latest contract_signed status
            setTimeout(() => {
                if (typeof loadSessions === 'function') {
                    loadSessions();
                }
            }, 1000);
        }
    }
});

// Global variables
// sessions variable is declared in index.html - using global scope
let sessionIdCounter = 1;
let currentUser = null;

// Firebase Authentication functions
async function checkAuth() {
    // Only skip auth check if actively logging out (not for manual logout flag)
    // Clear logout flags if coming from secure-app.html (successful authentication)
    if (document.referrer.includes('secure-app.html')) {
        console.log('Coming from secure app - clearing logout flags');
        sessionStorage.removeItem('loggingOut');
        localStorage.removeItem('manualLogout');
    }
    
    // Prevent refresh loops - skip auth if already authenticated this session
    if (sessionStorage.getItem('authChecked') === 'true') {
        console.log('Auth already checked this session - preventing refresh loop');
        return true; // Assume authenticated to prevent loops
    }
    
    // Only skip auth if actively logging out AND coming from a logout action
    if (sessionStorage.getItem('loggingOut') === 'true' && document.referrer.includes('secure-login.html')) {
        console.log('Skipping auth check - logout in progress from login page');
        return false;
    }
    
    // Clear any stale manual logout flag at start of auth check
    // If user is on homepage and not actively logging out, clear the manual logout flag
    if (localStorage.getItem('manualLogout') === 'true' && !sessionStorage.getItem('loggingOut')) {
        console.log('Clearing stale manual logout flag during auth check');
        localStorage.removeItem('manualLogout');
        sessionStorage.removeItem('loggingOut');
    }

    // Check if we just came from auth page
    const fromAuth = document.referrer.includes('auth.html') || document.referrer.includes('secure-login.html') || sessionStorage.getItem('fromAuth') === 'true';
    
    try {
        console.log(' AUTH CHECK: Checking authentication with backend...');
        console.log(' AUTH CHECK: About to call /api/auth/user');
        const response = await fetch('/api/auth/user', {
            credentials: 'include', // Ensure cookies are sent
            headers: {
                'Cache-Control': 'no-cache' // Prevent caching of auth responses
            }
        });
        
        console.log(' AUTH CHECK: Auth response status:', response.status, 'ok:', response.ok);
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            updateUserUI();
            console.log('User authenticated successfully:', currentUser.email);
            return true;
        } else {
            console.log('Auth check failed - response not ok:', response.status);
            
            // COMPLETELY disable redirects if coming from auth page
            if (localStorage.getItem('manualLogout') !== 'true' && !fromAuth && !sessionStorage.getItem('fromAuth') && !document.referrer.includes('auth.html') && !document.referrer.includes('secure-login.html')) {
                console.log(' AUTH CHECK: Scheduling redirect to auth page...');
                setTimeout(() => {
                    redirectToAuth();
                }, 2000); // Even longer delay
            } else {
                console.log(' AUTH CHECK: Skipping redirect - from auth page, manual logout, or has fromAuth flag');
                console.log(' AUTH CHECK: fromAuth:', fromAuth);
                console.log(' AUTH CHECK: sessionStorage fromAuth:', sessionStorage.getItem('fromAuth'));
                console.log(' AUTH CHECK: referrer:', document.referrer);
            }
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error.message || error);
        console.error('Full error details:', error);
        
        // COMPLETELY disable redirects if coming from auth page
        if (localStorage.getItem('manualLogout') !== 'true' && !fromAuth && !sessionStorage.getItem('fromAuth') && !document.referrer.includes('auth.html') && !document.referrer.includes('secure-login.html')) {
            console.log(' AUTH CHECK: Scheduling redirect to auth page due to error...');
            setTimeout(() => {
                redirectToAuth();
            }, 2000); // Even longer delay
        } else {
            console.log(' AUTH CHECK: Skipping redirect due to error - from auth page, manual logout, or has fromAuth flag');
            console.log(' AUTH CHECK: fromAuth:', fromAuth);
            console.log(' AUTH CHECK: sessionStorage fromAuth:', sessionStorage.getItem('fromAuth'));
            console.log(' AUTH CHECK: referrer:', document.referrer);
        }
        return false;
    }
}

function updateUserUI() {
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');

    // Check if elements exist before updating
    if (!userInfo || !userName) {
        console.log('User UI elements not found, skipping update');
        return;
    }

    if (currentUser) {
        userName.textContent = currentUser.displayName || currentUser.email;
        if (userAvatar) {
            if (currentUser.photoURL && !currentUser.photoURL.includes('gravatar.com')) {
                userAvatar.src = currentUser.photoURL;
                userAvatar.style.display = 'block';
                // Add error handler in case the photo URL fails
                userAvatar.onerror = () => {
                    if (window.AvatarUtils) {
                        userAvatar.src = AvatarUtils.generateInitialsAvatar(
                            currentUser.displayName || currentUser.email, 
                            40
                        );
                    } else {
                        userAvatar.style.display = 'none';
                    }
                };
            } else if (window.AvatarUtils) {
                // Use initials avatar instead of gravatar
                userAvatar.src = AvatarUtils.generateInitialsAvatar(
                    currentUser.displayName || currentUser.email, 
                    40
                );
                userAvatar.style.display = 'block';
            } else {
                userAvatar.style.display = 'none';
            }
        }
        userInfo.style.display = 'flex';
    } else {
        userInfo.style.display = 'none';
    }
}

function redirectToAuth() {
    console.log('🚨 REDIRECT TO AUTH CALLED!');
    console.log('🚨 Current location:', window.location.href);
    console.log('🚨 Current pathname:', window.location.pathname);
    console.log('🚨 Referrer:', document.referrer);
    console.log('🚨 fromAuth flag:', sessionStorage.getItem('fromAuth'));
    console.log('🚨 Manual logout flag:', localStorage.getItem('manualLogout'));
    console.log('🚨 Logging out flag:', sessionStorage.getItem('loggingOut'));
    
    // Debug stack trace to see who called this function
    console.log('🚨 REDIRECT STACK TRACE:', new Error().stack);
    
    if (window.location.pathname !== '/secure-login.html' && window.location.pathname !== '/auth.html') {
        console.log('🚨 PERFORMING REDIRECT TO SECURE-LOGIN.HTML...');
        window.location.href = '/secure-login.html';
    } else {
        console.log('🚨 Already on auth page, skipping redirect');
    }
}

// Show message to user
function showMessage(message, type = 'info') {
    try {
        const messageContainer = document.getElementById('messageContainer');
        if (!messageContainer) {
            // Fallback to console if messageContainer doesn't exist
            console.log(`${type}: ${message}`);
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;

        // Safe DOM manipulation with null checks
        if (messageContainer && messageDiv) {
            messageContainer.appendChild(messageDiv);

            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (messageDiv && messageDiv.parentNode && messageDiv.parentNode.contains(messageDiv)) {
                    messageDiv.remove();
                }
            }, 5000);
        }
    } catch (error) {
        // Ultimate fallback to prevent crashes
        console.log(`Message (${type}): ${message}`);
        console.error('showMessage error:', error.message || error);
    }
}

// Mobile menu functions
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const hamburgerMenu = document.querySelector('.hamburger-menu');

    if (mobileMenu) {
        const isVisible = mobileMenu.classList.contains('show');

        if (isVisible) {
            closeMobileMenu();
        } else {
            showMobileMenu();
        }
    }
}

function showMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const hamburgerMenu = document.querySelector('.hamburger-menu');

    if (mobileMenu) {
        mobileMenu.classList.add('show');
        if (hamburgerMenu) {
            hamburgerMenu.classList.add('active');
        }
    }
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const hamburgerMenu = document.querySelector('.hamburger-menu');

    if (mobileMenu) {
        mobileMenu.classList.remove('show');
        if (hamburgerMenu) {
            hamburgerMenu.classList.remove('active');
        }
    }
}

// Add event listeners for dropdown menu handling
document.addEventListener('DOMContentLoaded', function() {
    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const mobileMenu = document.getElementById('mobileMenu');
        const hamburgerMenu = document.querySelector('.hamburger-menu');

        if (mobileMenu && mobileMenu.classList.contains('show')) {
            // Check if click is outside the mobile menu and hamburger button
            if (!mobileMenu.contains(event.target) && !hamburgerMenu.contains(event.target)) {
                closeMobileMenu();
            }
        }
    });

    // Close dropdown when any button in the page is clicked (except nav links)
    document.addEventListener('click', function(event) {
        const mobileMenu = document.getElementById('mobileMenu');

        if (mobileMenu && mobileMenu.classList.contains('show')) {
            // Check if the clicked element is a button but not a nav link
            if ((event.target.tagName === 'BUTTON' || event.target.classList.contains('btn')) &&
                !event.target.classList.contains('nav-link') &&
                !event.target.classList.contains('hamburger-menu')) {
                closeMobileMenu();
            }
        }
    });

    // Close dropdown when pressing Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeMobileMenu();
        }
    });
});

function showMobileTool(toolName) {
    // Hide all mobile tools first
    const allTools = document.querySelectorAll('.mobile-tool');
    allTools.forEach(tool => tool.style.display = 'none');

    // Show the requested tool
    const tool = document.getElementById(`mobile-${toolName}`);
    if (tool) {
        tool.style.display = 'block';
    }

    console.log(`Mobile tool activated: ${toolName}`);
}

// Collapsible Session Form Toggle Function
function toggleSessionForm() {
    const content = document.getElementById('sessionFormContent');
    const icon = document.getElementById('sessionFormIcon');
    
    if (content && icon) {
        const isCollapsed = content.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Expand the form
            content.classList.remove('collapsed');
            icon.classList.remove('rotated');
            icon.textContent = '▼';
        } else {
            // Collapse the form
            content.classList.add('collapsed');
            icon.classList.add('rotated');
            icon.textContent = '▲';
        }
    }
}

// Add session to the list
function addSession(sessionData) {
    console.log('Adding session:', sessionData);

    // Create session object
    const session = {
        id: sessionIdCounter++,
        ...sessionData,
        createdAt: new Date().toISOString()
    };

    sessions.push(session);
    console.log('Session added:', session);

    // Re-render sessions
    if (typeof window.renderSessions === 'function') {
        window.renderSessions();
    }
    showMessage('Session added successfully!', 'success');
}

// Create API session
async function createAPISession(sessionData) {
    try {
        console.log('Creating session via API:', sessionData);

        const authToken = await getAuthToken();
        const headers = {
            'Content-Type': 'application/json'
        };

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers,
            body: JSON.stringify(sessionData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('API response:', result);

        // Reload sessions to show the new one
        loadSessions();
        showMessage('Session created successfully!', 'success');

    } catch (error) {
        console.error('Error creating session:', error.message || error);
        console.error('Full error details:', error);
        showMessage('Error creating session: ' + error.message, 'error');
    }
}

// Load sessions from API
async function loadSessions() {
    try {
        console.log('Loading sessions from API...');

        const authToken = await getAuthToken();
        const headers = {};

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch('/api/sessions', { headers });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Data type:', typeof data, 'Array:', Array.isArray(data));
        console.log('Raw API response:', data);
        console.log('Testing session deposit_amount from API:', data.find(s => s.clientName === 'Testing dammit')?.deposit_amount || 'NOT FOUND');

        if (!Array.isArray(data)) {
            console.error('API returned non-array data:', data);
            showMessage('Error: Invalid data format from server', 'error');
            return;
        }

        // Transform the data to match frontend format
        const transformedSessions = data.map(session => ({
            id: session.id,
            sessionType: session.session_type || session.sessionType,
            clientName: session.client_name || session.clientName,
            dateTime: session.date_time || session.dateTime,
            location: session.location,
            phoneNumber: session.phone_number || session.phoneNumber,
            email: session.email,
            price: parseFloat(session.price) || 0,
            depositAmount: parseFloat(session.deposit_amount || session.depositAmount) || 0,
            duration: parseInt(session.duration) || 60,
            notes: session.notes || '',
            contractSigned: session.contract_signed || session.contractSigned || false,
            paid: session.paid || false,
            edited: session.edited || false,
            delivered: session.delivered || false,
            reminderEnabled: session.reminder_enabled || session.reminderEnabled || false,
            galleryReadyNotified: session.gallery_ready_notified || session.galleryReadyNotified || false,
            reminderSent: session.reminder_sent || session.reminderSent || false,
            createdBy: session.created_by || session.createdBy,
            createdAt: session.created_at || session.createdAt,
            updatedAt: session.updated_at || session.updatedAt
        }));

        console.log('Transformed sessions:', transformedSessions);

        sessions = transformedSessions;
        window.sessions = sessions; // Ensure window.sessions is set for storage calculation
        window.sessionsData = transformedSessions; // Store sessions data for deposit function

        // Call the index.html renderSessions function instead of the disabled script.js one
        if (typeof window.renderSessions === 'function') {
            window.renderSessions();

            // Trigger booking agreement status updates after sessions are rendered
            setTimeout(() => {
                const sessionsRenderedEvent = new Event('sessionsRendered');
                window.dispatchEvent(sessionsRenderedEvent);
            }, 200);
        } else {
            console.error('renderSessions function not found in window scope');
        }
        // Clear any existing error messages when sessions load successfully
        const messageContainer = document.getElementById('messageContainer');
        if (messageContainer) {
            // Remove all existing error messages
            const errorMessages = messageContainer.querySelectorAll('.message-error');
            errorMessages.forEach(msg => msg.remove());
        }
        
        console.log('Successfully loaded', sessions.length, 'sessions');

        // Initialize business dashboard with real session data
        if (typeof window.initializeDashboard === 'function') {
            window.initializeDashboard();
        }

        // Update storage usage after sessions are loaded
        updateStorageUsage().catch(err => {
            console.error('Error updating storage usage:', err);
        });

    } catch (error) {
        console.error('Error loading sessions:', error.message || error);
        console.error('Full error details:', error);
        showMessage('Error loading sessions: ' + error.message, 'error');
    }
}

// Storage usage calculation function
async function updateStorageUsage() {
    try {
        console.log('Updating storage usage...');
        
        // Get storage quota status from the server
        const response = await fetch('/api/storage/quota-status');
        if (!response.ok) {
            throw new Error('Failed to fetch storage quota');
        }
        
        const data = await response.json();
        console.log('Storage quota data:', data);
        
        // Update storage display in settings if it exists
        const storageUsageDiv = document.getElementById('storageUsage');
        if (storageUsageDiv) {
            const usagePercent = parseFloat(data.percentUsed);
            const progressColor = usagePercent > 90 ? '#dc3545' : 
                                 usagePercent > 75 ? '#ffc107' : '#28a745';
            
            storageUsageDiv.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span><strong>Used:</strong> ${data.usage.totalGB} GB</span>
                        <span><strong>Total:</strong> ${data.quota.totalGB} GB</span>
                    </div>
                    <div style="background: #e9ecef; border-radius: 8px; height: 20px; overflow: hidden;">
                        <div style="background: ${progressColor}; width: ${usagePercent}%; height: 100%; transition: width 0.3s ease;"></div>
                    </div>
                    <div style="text-align: center; margin-top: 5px; color: #666; font-size: 0.9em;">
                        ${usagePercent}% used (${data.remainingGB} GB remaining)
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                    <div style="padding: 10px; background: white; border-radius: 6px;">
                        <div style="color: #666; font-size: 0.85em;">Gallery Storage</div>
                        <div style="font-weight: bold;">${data.usage.galleryMB} MB</div>
                    </div>
                    <div style="padding: 10px; background: white; border-radius: 6px;">
                        <div style="color: #666; font-size: 0.85em;">RAW Storage</div>
                        <div style="font-weight: bold;">${data.usage.rawMB} MB</div>
                    </div>
                </div>
                ${data.isNearLimit ? `
                    <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; color: #856404;">
                        <strong>⚠️ Storage Warning:</strong> You are approaching your storage limit. Consider upgrading your plan.
                    </div>
                ` : ''}
            `;
        }
        
        // Update global storage stats if available
        const totalGalleryStorage = document.getElementById('totalGalleryStorage');
        const totalRawStorage = document.getElementById('totalRawStorage');
        const totalCombinedStorage = document.getElementById('totalCombinedStorage');
        
        if (totalGalleryStorage) {
            totalGalleryStorage.textContent = `${data.usage.galleryMB} MB`;
        }
        if (totalRawStorage) {
            totalRawStorage.textContent = `${data.usage.rawMB} MB`;
        }
        if (totalCombinedStorage) {
            totalCombinedStorage.textContent = `${data.usage.totalGB} GB`;
        }
        
        return data;
        
    } catch (error) {
        console.error('Error updating storage usage:', error);
        
        // Show error in storage display if exists
        const storageUsageDiv = document.getElementById('storageUsage');
        if (storageUsageDiv) {
            storageUsageDiv.innerHTML = `
                <div style="color: #dc3545;">
                    Failed to load storage information. 
                    <button onclick="updateStorageUsage()" style="margin-left: 10px; padding: 5px 10px; background: white; color: #374151; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer;">
                        Retry
                    </button>
                </div>
            `;
        }
        
        throw error;
    }
}

// Get auth token if available
async function getAuthToken() {
    if (window.currentUser && typeof window.currentUser.getIdToken === 'function') {
        try {
            return await window.currentUser.getIdToken();
        } catch (error) {
            console.error('Error getting auth token:', error);
            return null;
        }
    }
    return null;
}

// Render sessions in the UI - DISABLED: Using index.html version instead
// function renderSessions() {
//     console.log('renderSessions called with', sessions.length, 'sessions');
//     const container = document.getElementById('sessionsContainer');
//
//     if (!container) {
//         console.error('Sessions container not found');
//         return;
//     }
//
//     // Clear container
//     container.innerHTML = '';
//
//     if (sessions.length === 0) {
//         const emptyState = document.createElement('div');
//         emptyState.className = 'empty-state';
//         emptyState.innerHTML = '<p>No sessions scheduled yet. Add your first session above!</p>';
//         container.appendChild(emptyState);
//         return;
//     }
//
//     console.log('Rendering', sessions.length, 'session cards');
//
//     // Sort sessions by date
//     const sortedSessions = [...sessions].sort((a, b) => {
//         const dateA = new Date(a.dateTime || a.date_time);
//         const dateB = new Date(b.dateTime || b.date_time);
//         return dateA - dateB;
//     });
//
//     console.log('Sorted sessions:', sortedSessions);
//
//     // Create session cards
//     sortedSessions.forEach((session, index) => {
//         console.log(`Creating session card ${index + 1}:`, session.clientName);
//         const card = createSessionCard(session);
//         container.appendChild(card);
//         console.log(`Session card ${index + 1} added`);
//     });
//
//     console.log('All session cards rendered. Container children count:', container.children.length);
//     console.log('Sessions rendered, container should now show', sessions.length, 'sessions');
// }

// Create individual session card
function createSessionCard(session) {
    console.log('=== CRITICAL DEBUG: Creating session card for:', session.clientName);
    console.log('Session object:', session);
    console.log(' RAW BUTTONS DEBUG: Starting button creation process');

    // Create main card container
    const card = document.createElement('div');
    card.className = 'session-card';
    card.setAttribute('data-session-id', session.id);

    // Create header section
    const header = document.createElement('div');
    header.className = 'session-header';

    // Create header info section
    const headerInfo = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'session-title';
    title.textContent = session.sessionType;

    const client = document.createElement('div');
    client.className = 'session-client';
    client.textContent = session.clientName;

    headerInfo.appendChild(title);
    headerInfo.appendChild(client);

    // Create actions section
    const actions = document.createElement('div');
    actions.className = 'session-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-primary';
    editBtn.textContent = '✏️ Edit';
    editBtn.onclick = () => editSession(session.id);

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn btn-secondary upload-photos-btn';
    uploadBtn.textContent = '📁 Upload Files';
    uploadBtn.onclick = () => openUploadDialog(session.id);
    // Remove inline styles that interfere with responsive design
    uploadBtn.style.backgroundColor = '#6b7280'; // Gray background
    uploadBtn.style.color = 'white'; // White text

    // Download Controls Button
    const downloadControlsBtn = document.createElement('button');
    downloadControlsBtn.className = 'btn btn-info';
    downloadControlsBtn.textContent = '📥 Download Controls';
    downloadControlsBtn.onclick = () => openDownloadControls(session.id);
    downloadControlsBtn.style.backgroundColor = '#3b82f6'; // Blue background
    downloadControlsBtn.style.color = 'white';
    downloadControlsBtn.style.marginBottom = '5px';
    console.log('✅ DOWNLOAD CONTROLS BUTTON CREATED for session:', session.id);

    const calendarBtn = document.createElement('button');
    calendarBtn.className = 'btn btn-success';
    calendarBtn.textContent = 'Schedule: Add to Calendar';
    calendarBtn.onclick = () => exportToCalendar(session.id);

    // Direct email client button
    const emailClientBtn = document.createElement('button');
    emailClientBtn.className = 'btn btn-primary';
    emailClientBtn.textContent = ' Email Client';
    emailClientBtn.onclick = () => openEmailClient(session);
    emailClientBtn.style.backgroundColor = 'white';
    emailClientBtn.style.color = '#374151';
    emailClientBtn.style.border = '1px solid #d1d5db';
    emailClientBtn.style.marginBottom = '5px';

    const galleryBtn = document.createElement('button');
    galleryBtn.className = 'btn btn-warning';
    galleryBtn.textContent = ' Copy Gallery URL';
    galleryBtn.onclick = () => copyGalleryUrl(session.id);
    
    // View Gallery button for photographers to preview print ordering
    const viewGalleryBtn = document.createElement('button');
    viewGalleryBtn.className = 'btn btn-success';
    viewGalleryBtn.textContent = '👁️ View Gallery';
    viewGalleryBtn.onclick = () => {
        window.open(`/sessions/${session.id}/gallery`, '_blank');
    };
    viewGalleryBtn.style.backgroundColor = '#28a745';
    viewGalleryBtn.style.color = 'white';
    viewGalleryBtn.style.marginBottom = '5px';

    // RAW Backup Upload Button
    const rawUploadBtn = document.createElement('button');
    rawUploadBtn.className = 'btn btn-info';
    rawUploadBtn.textContent = 'RAW Backup Upload';
    rawUploadBtn.onclick = () => {
        currentGallerySessionId = session.id;
        initRawUpload();
    };
    rawUploadBtn.style.backgroundColor = '#17a2b8';
    rawUploadBtn.style.color = 'white';
    rawUploadBtn.style.margin = '2px';
    rawUploadBtn.style.display = 'inline-block';

    // RAW Folder Button
    const rawFolderBtn = document.createElement('button');
    rawFolderBtn.className = 'btn btn-dark';
    rawFolderBtn.textContent = 'RAW Folder';
    rawFolderBtn.onclick = () => openRawFolder(session.id, session.clientName);
    rawFolderBtn.style.backgroundColor = '#343a40';
    rawFolderBtn.style.color = 'white';
    rawFolderBtn.style.margin = '2px';
    rawFolderBtn.style.display = 'inline-block';

    // Email preview button (shows after gallery notification is generated)
    const emailPreviewBtn = document.createElement('button');
    emailPreviewBtn.className = 'btn btn-outline-primary';
    emailPreviewBtn.textContent = ' Email Preview';
    emailPreviewBtn.style.fontSize = '0.85em';
    emailPreviewBtn.onclick = () => {
        const previewUrl = `/api/sessions/${session.id}/email-preview`;
        window.open(previewUrl, '_blank');
    };
    // Only show if gallery has been notified (meaning email preview exists)
    emailPreviewBtn.style.display = session.galleryReadyNotified ? 'block' : 'none';

    const invoiceBtn = document.createElement('button');
    invoiceBtn.className = 'btn btn-info';
    invoiceBtn.textContent = ' Send Invoice';
    invoiceBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(' INVOICE BUTTON CLICKED - USING NEW TIPPING SYSTEM');
        createInvoice(session);
    };

    console.log('DEBUG: Creating deposit button for session:', session.clientName);
    const depositBtn = document.createElement('button');
    depositBtn.className = 'btn btn-warning';
    depositBtn.textContent = '💳 Send Deposit';
    // Capture the session object properly in closure
    depositBtn.onclick = function() {
        console.log('DEBUG: Deposit button clicked with session:', session);
        sendDepositInvoice(session);
    };
    depositBtn.style.backgroundColor = 'white';
    depositBtn.style.color = '#374151';
    depositBtn.style.border = '1px solid #d1d5db';
    console.log('DEBUG: Deposit button created:', depositBtn.textContent);

    // Payment Plan Button
    const paymentPlanBtn = document.createElement('button');
    paymentPlanBtn.className = 'btn btn-success';
    paymentPlanBtn.textContent = ' Payment Plan';
    paymentPlanBtn.onclick = function() {
        console.log('DEBUG: Payment plan button clicked with session:', session);
        if (typeof window.openPaymentPlanModal === 'function') {
            window.openPaymentPlanModal(session);
        } else {
            console.error('openPaymentPlanModal function not found');
            showMessage('Payment plan feature is loading, please try again in a moment.', 'info');
        }
    };
    paymentPlanBtn.style.backgroundColor = '#28a745';
    paymentPlanBtn.style.color = 'white';
    paymentPlanBtn.style.margin = '2px';

    // Show payment plan status if exists
    if (session.hasPaymentPlan) {
        paymentPlanBtn.textContent = ' View Payment Plan';
        paymentPlanBtn.style.backgroundColor = '#17a2b8';
    }

    // Booking Agreement Button
    const bookingAgreementBtn = document.createElement('button');
    bookingAgreementBtn.className = 'btn booking-agreement-btn';
    bookingAgreementBtn.innerHTML = '📄 <span class="agreement-status">Create Agreement</span>';
    bookingAgreementBtn.setAttribute('data-session-id', session.id);
    bookingAgreementBtn.onclick = () => {
        console.log('Booking agreement button clicked for session:', session.id);
        if (typeof window.openBookingAgreementModal === 'function') {
            window.openBookingAgreementModal(session.id);
        } else {
            console.error('openBookingAgreementModal function not found');
            showMessage('Booking agreement system is loading, please try again in a moment.', 'info');
            // Try to initialize booking agreements if not loaded
            if (typeof initializeBookingAgreements === 'function') {
                initializeBookingAgreements();
            }
        }
    };
    bookingAgreementBtn.style.backgroundColor = '#9b59b6';
    bookingAgreementBtn.style.color = 'white';
    bookingAgreementBtn.style.margin = '2px';
    console.log('Booking Agreement button created for session:', session.id);

    // View Contracts Button with PDF Download
    const viewContractsBtn = document.createElement('button');
    viewContractsBtn.className = 'btn btn-secondary';
    viewContractsBtn.textContent = '📄 View Contracts';
    viewContractsBtn.onclick = () => {
        viewSessionContractsPDF(session.id, session.clientName);
    };
    viewContractsBtn.style.backgroundColor = '#6c757d';
    viewContractsBtn.style.color = 'white';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.onclick = () => deleteSession(session.id);

    console.log('About to append buttons for:', session.clientName);
    console.log('Upload button created:', uploadBtn.textContent);
    console.log('Upload button onclick:', uploadBtn.onclick ? 'Set' : 'NOT SET');

    actions.appendChild(editBtn);
    actions.appendChild(uploadBtn);
    actions.appendChild(downloadControlsBtn);
    actions.appendChild(calendarBtn);
    actions.appendChild(emailClientBtn);
    actions.appendChild(galleryBtn);
    actions.appendChild(viewGalleryBtn); // Add View Gallery button
    actions.appendChild(emailPreviewBtn);
    actions.appendChild(invoiceBtn);
    actions.appendChild(depositBtn);
    actions.appendChild(paymentPlanBtn);
    actions.appendChild(viewContractsBtn);
    actions.appendChild(bookingAgreementBtn);
    console.log('DEBUG: Deposit button appended successfully');
    console.log(' DEBUG: About to append RAW Upload button:', rawUploadBtn.textContent);
    actions.appendChild(rawUploadBtn);
    console.log(' DEBUG: RAW Upload button appended successfully');
    console.log(' DEBUG: About to append RAW Folder button:', rawFolderBtn.textContent);
    actions.appendChild(rawFolderBtn);
    console.log(' DEBUG: RAW Folder button appended successfully');
    actions.appendChild(deleteBtn);

    // Debug: Log all buttons in the actions container
    console.log('Actions container buttons:', actions.children.length);
    for (let i = 0; i < actions.children.length; i++) {
        console.log(`Button ${i}: ${actions.children[i].textContent}`);
    }

    header.appendChild(headerInfo);
    header.appendChild(actions);

    // Create details section
    const details = document.createElement('div');
    details.className = 'session-details';

    // Date and time
    const dateTimeDiv = document.createElement('div');
    dateTimeDiv.className = 'detail-item';
    const dateTime = new Date(session.dateTime);
    dateTimeDiv.innerHTML = `
        <div class="detail-label">Date & Time</div>
        <div class="detail-value">${dateTime.toLocaleDateString()} at ${dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;

    // Location
    const locationDiv = document.createElement('div');
    locationDiv.className = 'detail-item';
    locationDiv.innerHTML = `
        <div class="detail-label">Location</div>
        <div class="detail-value">${session.location}</div>
    `;

    // Phone number with call and text buttons  
    const phoneNumber = session.phoneNumber || session.phone_number;
    const phoneDiv = createPhoneDetailItem('Phone', phoneNumber);

    // Email
    const emailDiv = document.createElement('div');
    emailDiv.className = 'detail-item';
    emailDiv.innerHTML = `
        <div class="detail-label">Email</div>
        <div class="detail-value"><a href="mailto:${session.email}">${session.email}</a></div>
    `;

    // Price and duration
    const priceDiv = document.createElement('div');
    priceDiv.className = 'detail-item';
    priceDiv.innerHTML = `
        <div class="detail-label">Price & Duration</div>
        <div class="detail-value">$${session.price} for ${session.duration} minutes</div>
    `;

    // Notes
    if (session.notes && session.notes.trim()) {
        const notesDiv = document.createElement('div');
        notesDiv.className = 'detail-item';
        notesDiv.innerHTML = `
            <div class="detail-label">Notes</div>
            <div class="detail-value">${session.notes}</div>
        `;
        details.appendChild(notesDiv);
    }

    // Status indicators
    const statusDiv = document.createElement('div');
    statusDiv.className = 'session-status';

    const statusItems = [
        { key: 'paid', label: 'Paid', value: session.paid },
        { key: 'edited', label: 'Edited', value: session.edited },
        { key: 'delivered', label: 'Delivered', value: session.delivered }
    ];

    statusItems.forEach(item => {
        const statusItem = document.createElement('div');
        statusItem.className = `status-item ${item.value ? 'completed' : 'pending'}`;
        statusItem.textContent = item.label;
        statusDiv.appendChild(statusItem);
    });

    // Append all sections to details
    details.appendChild(dateTimeDiv);
    details.appendChild(locationDiv);
    details.appendChild(phoneDiv);
    details.appendChild(emailDiv);
    details.appendChild(priceDiv);
    details.appendChild(statusDiv);

    // Create photo gallery section
    const gallerySection = createPhotoGallery(session);

    // Append sections to card
    card.appendChild(header);
    card.appendChild(details);
    card.appendChild(gallerySection);

    console.log('Session card created for:', session.clientName);
    return card;
}

// Helper function to create phone detail item with call and text buttons
function createPhoneDetailItem(label, phoneNumber) {
    const item = document.createElement('div');
    item.className = 'detail-item';

    const labelDiv = document.createElement('div');
    labelDiv.className = 'detail-label';
    labelDiv.textContent = label;

    const valueDiv = document.createElement('div');
    valueDiv.className = 'detail-value';
    valueDiv.style.display = 'flex';
    valueDiv.style.alignItems = 'center';
    valueDiv.style.gap = '10px';

    const phoneSpan = document.createElement('span');
    phoneSpan.textContent = phoneNumber;

    const callBtn = document.createElement('a');
    callBtn.href = `tel:${phoneNumber}`;
    callBtn.className = 'phone-action-btn';
    callBtn.textContent = '';
    callBtn.title = 'Call';
    callBtn.style.cssText = `
        text-decoration: none;
        padding: 4px 8px;
        background: #28a745;
        color: white;
        border-radius: 4px;
        font-size: 12px;
    `;

    const textBtn = document.createElement('a');
    textBtn.href = `sms:${phoneNumber}`;
    textBtn.className = 'phone-action-btn';
    textBtn.textContent = '💬';
    textBtn.title = 'Text';
    textBtn.style.cssText = `
        text-decoration: none;
        padding: 4px 8px;
        background: #007bff;
        color: white;
        border-radius: 4px;
        font-size: 12px;
    `;

    valueDiv.appendChild(phoneSpan);
    valueDiv.appendChild(callBtn);
    valueDiv.appendChild(textBtn);

    item.appendChild(labelDiv);
    item.appendChild(valueDiv);

    return item;
}

// Edit session function
window.editSession = function(sessionId) {
    console.log('Edit session:', sessionId);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
        showMessage('Session not found', 'error');
        return;
    }

    // Populate form with session data for editing
    const form = document.getElementById('sessionForm');
    form.elements.sessionType.value = session.sessionType;
    form.elements.clientName.value = session.clientName;

    // Format datetime for input
    const dateTime = new Date(session.dateTime);
    const formattedDateTime = dateTime.toISOString().slice(0, 16);
    form.elements.dateTime.value = formattedDateTime;

    form.elements.location.value = session.location;
    form.elements.phoneNumber.value = session.phone_number || session.phoneNumber;
    form.elements.email.value = session.email;
    form.elements.price.value = session.price;
    form.elements.duration.value = session.duration;
    form.elements.notes.value = session.notes;
    form.elements.contractSigned.checked = session.contractSigned;
    form.elements.paid.checked = session.paid;
    form.elements.edited.checked = session.edited;
    form.elements.delivered.checked = session.delivered;
    form.elements.reminderEnabled.checked = session.reminderEnabled;
    form.elements.galleryReadyNotified.checked = session.galleryReadyNotified;

    // Store the ID for updating
    form.dataset.editingId = sessionId;

    // Change submit button text
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Session';

    // Scroll to form
    form.scrollIntoView({ behavior: 'smooth' });
}

// Delete session function
window.deleteSession = async function(sessionId) {
    if (!confirm('Are you sure you want to delete this session?')) {
        return;
    }

    try {
        const authToken = await getAuthToken();
        const headers = {};

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE',
            headers
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Remove from local array and re-render
        sessions = sessions.filter(s => s.id !== sessionId);
        if (typeof window.renderSessions === 'function') {
            window.renderSessions();
        }
        showMessage('Session deleted successfully!', 'success');

    } catch (error) {
        console.error('Error deleting session:', error.message || error);
        console.error('Full error details:', error);
        showMessage('Error deleting session: ' + error.message, 'error');
    }
}

// Universal calendar export function - works across all devices and calendar apps
window.exportToCalendar = function(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
        showMessage('Session not found', 'error');
        return;
    }

    const startDate = new Date(session.dateTime);
    const endDate = new Date(startDate.getTime() + session.duration * 60000);

    // Format date for .ics file (YYYYMMDDTHHMMSSZ)
    const formatICSDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    // Generate unique ID for the event
    const eventUID = `photo-session-${sessionId}@thelegacyphotography.com`;
    const timestamp = formatICSDate(new Date());

    // Create .ics file content
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Lance - The Legacy Photography//Photography Session Scheduler//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${eventUID}`,
        `DTSTAMP:${timestamp}`,
        `DTSTART:${formatICSDate(startDate)}`,
        `DTEND:${formatICSDate(endDate)}`,
        `SUMMARY:${session.sessionType} Photography Session - ${session.clientName}`,
        `DESCRIPTION:Photography session with ${session.clientName}\\n\\nContact: ${session.phone_number || session.phoneNumber}\\nEmail: ${session.email}\\nPrice: $${session.price}\\nDuration: ${session.duration} minutes\\n\\nNotes: ${session.notes || 'No additional notes'}`,
        `LOCATION:${session.location}`,
        'ORGANIZER;CN=Lance - The Legacy Photography:mailto:lance@thelegacyphotography.com',
        `ATTENDEE;CN=${session.clientName};RSVP=TRUE:mailto:${session.email}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'CATEGORIES:APPOINTMENT,PHOTOGRAPHY',
        'BEGIN:VALARM',
        'TRIGGER:-PT1H',
        'ACTION:DISPLAY',
        'DESCRIPTION:Photography session reminder - 1 hour before',
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-PT24H',
        'ACTION:DISPLAY',
        'DESCRIPTION:Photography session reminder - 1 day before',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    // Detect device type for optimal calendar integration
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isWindows = /Windows|Win32|Win64|WOW64/i.test(navigator.userAgent);

    // Method 1: Direct calendar app integration (mobile devices)
    if (isIOS || isAndroid) {
        // Create a data URL for immediate calendar app recognition
        const dataUrl = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsContent);

        // For mobile devices, use window.location.href for best calendar app integration
        showMessage('Opening calendar app...', 'success');

        // Primary method: Use server URL which handles mobile browsers better
        window.location.href = `/api/sessions/${sessionId}/calendar.ics`;

        // Fallback: Data URL method
        setTimeout(() => {
            try {
                window.location.href = dataUrl;
            } catch (error) {
                console.log('Data URL fallback used');
            }
        }, 1000);

    } else {
        // Method 2: Download .ics file (desktop)
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = `${session.clientName.replace(/[^a-zA-Z0-9]/g, '_')}_${session.sessionType.replace(/[^a-zA-Z0-9]/g, '_')}_Session.ics`;
        link.style.display = 'none';

        // Add to page, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL
        setTimeout(() => URL.revokeObjectURL(url), 100);

        showMessage('Calendar event downloaded - double-click the .ics file to add to your calendar', 'success');

        // Also provide server URL as additional option for desktop
        setTimeout(() => {
            const serverUrl = `/api/sessions/${sessionId}/calendar.ics`;
            if (confirm('Would you like to also open the calendar file directly in your browser?')) {
                window.open(serverUrl, '_blank');
            }
        }, 2000);
    }

    // Universal fallback: Google Calendar (works on all devices)
    setTimeout(() => {
        const googleStartDate = formatICSDate(startDate);
        const googleEndDate = formatICSDate(endDate);

        const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
            `&text=${encodeURIComponent(session.sessionType + ' Photography Session - ' + session.clientName)}` +
            `&dates=${googleStartDate}/${googleEndDate}` +
            `&location=${encodeURIComponent(session.location)}` +
            `&details=${encodeURIComponent(
                `Photography session with ${session.clientName}\n\n` +
                `Contact: ${session.phone_number || session.phoneNumber}\n` +
                `Email: ${session.email}\n` +
                `Price: $${session.price}\n` +
                `Duration: ${session.duration} minutes\n\n` +
                `${session.notes ? 'Notes: ' + session.notes : ''}`
            )}`;

        // Show Google Calendar option based on device type
        const delay = (isIOS || isAndroid) ? 4000 : 3000;
        setTimeout(() => {
            const message = (isIOS || isAndroid) ?
                'Calendar app should have opened. Would you also like to add to Google Calendar?' :
                'Calendar file downloaded. Would you also like to add to Google Calendar?';

            if (confirm(message)) {
                window.open(googleCalendarUrl, '_blank');
            }
        }, delay);
    }, 500);
}

// Open email client with session details
window.openEmailClient = function(sessionOrId) {
    // Handle both session object and sessionId
    let session;
    if (typeof sessionOrId === 'string') {
        session = sessions.find(s => s.id === sessionOrId);
        if (!session) {
            showMessage('Session not found', 'error');
            return;
        }
    } else {
        session = sessionOrId;
    }

    const subject = `Photography Session - ${session.sessionType} with ${session.clientName}`;
    const body = `Hi ${session.clientName},

I hope this email finds you well! I wanted to reach out regarding your upcoming ${session.sessionType} photography session.

Session Details:
Schedule: Date & Time: ${new Date(session.dateTime).toLocaleDateString()} at ${new Date(session.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
📍 Location: ${session.location}
 Investment: $${session.price}
⏱️ Duration: ${session.duration} minutes

${session.notes ? `Additional Notes: ${session.notes}` : ''}

Please feel free to reach out if you have any questions or need to make any changes to our session.

Looking forward to capturing some beautiful moments with you!

Best regards,
Lance - The Legacy Photography
Professional Photography Services
 Call/Text: ${session.phone_number || session.phoneNumber}
 Email: lance@thelegacyphotography.com`;

    const mailtoUrl = `mailto:${session.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Open email client
    const emailLink = document.createElement('a');
    emailLink.href = mailtoUrl;
    emailLink.target = '_blank';
    emailLink.style.display = 'none';
    document.body.appendChild(emailLink);
    emailLink.click();
    document.body.removeChild(emailLink);

    showMessage(` Opening email client for ${session.clientName}`, 'success');
}

// Bulk email all clients using default email client
window.emailAllClients = async function() {
    try {
        showMessage('Loading client emails...', 'info');
        
        // Fetch all clients from the working endpoint
        const response = await fetch('/api/clients');
        if (!response.ok) {
            throw new Error('Failed to fetch clients');
        }
        
        const clients = await response.json();
        
        // Filter clients that have email addresses
        const clientsWithEmail = clients.filter(client => client.email && client.email.trim() !== '');
        
        if (clientsWithEmail.length === 0) {
            showMessage('No client emails found to send to', 'warning');
            return;
        }
        
        const clientEmails = clientsWithEmail.map(client => client.email).join(',');
        
        const subject = 'Update from The Legacy Photography';
        const body = `Hi there!

I hope this message finds you well. I wanted to reach out to share some exciting updates and let you know about upcoming opportunities.

As a valued client of The Legacy Photography, you're always the first to know about:
✨ New service offerings
📸 Special session promotions  
🎉 Seasonal photography opportunities
💫 Behind-the-scenes updates

Thank you for being part of The Legacy Photography family. Your trust in me to capture your most precious moments means the world to me.

Feel free to reply to this email if you have any questions or if you'd like to schedule your next session!

Best regards,
Lance - The Legacy Photography
Professional Photography Services
📧 Email: lance@thelegacyphotography.com
📱 Call/Text: Available in your session details

P.S. I'd love to hear how your photos have been bringing joy to your life! `;

        const mailtoUrl = `mailto:?bcc=${encodeURIComponent(clientEmails)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        // Check if the mailto URL is too long (some email clients have limits)
        if (mailtoUrl.length > 2000) {
            // Split into smaller groups if needed
            const emailChunks = [];
            const emailArray = clientsWithEmail.map(client => client.email);
            const chunkSize = 20; // Send to 20 clients at a time
            
            for (let i = 0; i < emailArray.length; i += chunkSize) {
                emailChunks.push(emailArray.slice(i, i + chunkSize));
            }
            
            if (confirm(`You have ${clientsWithEmail.length} clients. Due to email client limitations, this will open ${emailChunks.length} separate email windows. Continue?`)) {
                emailChunks.forEach((chunk, index) => {
                    setTimeout(() => {
                        const chunkEmails = chunk.join(',');
                        const chunkMailtoUrl = `mailto:?bcc=${encodeURIComponent(chunkEmails)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                        
                        const emailLink = document.createElement('a');
                        emailLink.href = chunkMailtoUrl;
                        emailLink.target = '_blank';
                        emailLink.style.display = 'none';
                        document.body.appendChild(emailLink);
                        emailLink.click();
                        document.body.removeChild(emailLink);
                    }, index * 1000); // 1 second delay between each window
                });
                
                showMessage(`Opening ${emailChunks.length} email windows for ${clientsWithEmail.length} clients`, 'success');
            }
        } else {
            // Single email window for all clients
            const emailLink = document.createElement('a');
            emailLink.href = mailtoUrl;
            emailLink.target = '_blank';
            emailLink.style.display = 'none';
            document.body.appendChild(emailLink);
            emailLink.click();
            document.body.removeChild(emailLink);
            
            showMessage(`📧 Opening email client with ${clientsWithEmail.length} clients in BCC`, 'success');
        }
        
    } catch (error) {
        console.error('Error opening bulk email:', error);
        showMessage('Failed to open bulk email client', 'error');
    }
}

// Copy gallery URL to clipboard
// Function to view signed contract details
window.viewSignedContract = async function viewSignedContract(sessionId, clientName) {
    try {
        const response = await fetch(`/api/booking/agreements/session/${sessionId}`);
        if (response.ok) {
            const agreement = await response.json();
            
            if (agreement && agreement.status === 'signed') {
                // Get signature details
                const sigResponse = await fetch(`/api/booking/agreements/${agreement.id}/signatures`);
                if (sigResponse.ok) {
                    const signatures = await sigResponse.json();
                    showSignedContractModal(agreement, signatures, clientName);
                } else {
                    showMessage('Contract found but signature details unavailable', 'warning');
                }
            } else {
                showMessage(`No signed contract found for ${clientName}`, 'info');
            }
        } else {
            showMessage(`No contract found for ${clientName}`, 'info');
        }
    } catch (error) {
        console.error('Error fetching signed contract:', error);
        showMessage('Error loading signed contract', 'error');
    }
}

// Function to show signed contract modal
function showSignedContractModal(agreement, signatures, clientName) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    const signature = signatures[0]; // Get the first signature
    const signedDate = new Date(signature.created_at).toLocaleString();

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #28a745;">✅ Signed Contract - ${clientName}</h3>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #333;">Signature Details</h4>
                <p style="margin: 5px 0;"><strong>Signer:</strong> ${signature.signer_name}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${signature.signer_email}</p>
                <p style="margin: 5px 0;"><strong>Signed Date:</strong> ${signedDate}</p>
                <p style="margin: 5px 0;"><strong>IP Address:</strong> ${signature.ip_address}</p>
            </div>
            
            <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; background: white;">
                <h4 style="margin: 0 0 15px 0;">Contract Content</h4>
                <div style="max-height: 300px; overflow-y: auto; line-height: 1.6;">
                    ${agreement.content}
                </div>
            </div>
            
            <div style="margin-top: 20px; text-align: center;">
                <button onclick="this.closest('.modal-overlay').remove()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

async function copyGalleryUrl(sessionId) {
    try {
        showMessage('Generating gallery URL...', 'info');

        // Generate gallery access if not already done
        const response = await fetch(`/api/sessions/${sessionId}/send-gallery-notification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.galleryUrl) {
            // Copy URL to clipboard
            await navigator.clipboard.writeText(result.galleryUrl);
            showMessage(` Gallery URL copied to clipboard! ${result.galleryUrl}`, 'success');

            // Update the button text to show it's been generated
            const button = document.querySelector(`[data-session-id="${sessionId}"] .btn-warning`);
            if (button) {
                button.textContent = 'SUCCESS: Gallery URL Copied';
                button.disabled = true;
                button.style.backgroundColor = '#28a745';
            }

            // Reload sessions to update UI
            loadSessions();
        }

    } catch (error) {
        console.error('Error copying gallery URL:', error);
        showMessage('Error generating gallery URL: ' + error.message, 'error');
    }
}

// Send gallery notification function
async function sendGalleryNotification(sessionId) {
    console.log('Send gallery notification for session:', sessionId);

    try {
        showMessage('Sending gallery notification...', 'info');

        const response = await fetch(`/api/sessions/${sessionId}/send-gallery-notification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.mailtoUrl) {
            // Open email client with pre-filled content
            showMessage(' Opening your email client with gallery notification...', 'info');

            // Open mailto link
            const emailLink = document.createElement('a');
            emailLink.href = result.mailtoUrl;
            emailLink.target = '_blank';
            emailLink.style.display = 'none';
            document.body.appendChild(emailLink);
            emailLink.click();
            document.body.removeChild(emailLink);

            // Show success message with preview option
            setTimeout(() => {
                showMessage(' Email client opened! Or preview the email first:', 'success');

                // Add email preview button
                setTimeout(() => {
                    if (confirm(' Want to see the email preview before sending? Click OK to open email preview.')) {
                        window.open(result.emailPreviewUrl, '_blank');
                    }
                }, 2000);
            }, 1000);
        } else {
            showMessage('WARNING: Email notification prepared. Check console for details.', 'warning');
        }

        // Always show SMS option
        if (result.smsSent) {
            setTimeout(() => {
                showMessage('💬 SMS link prepared for manual sending if needed.', 'info');
            }, 2000);
        }

    } catch (error) {
        console.error('Error sending gallery notification:', error);
        showMessage('Error sending notification: ' + error.message, 'error');
    }
}

// Bridge function for HTML templates to use tipping system
window.createInvoiceWithTipping = function(sessionId) {
    console.log(' BRIDGE: createInvoiceWithTipping called with sessionId:', sessionId);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
        showMessage('Session not found', 'error');
        return;
    }
    console.log(' BRIDGE: Found session, calling createInvoice with tipping system');
    createInvoice(session);
};

// Create invoice function with tipping system - simplified approach
async function createInvoice(session) {
    try {
        console.log(' NEW TIPPING SYSTEM: Creating tipping-enabled invoice for session:', session);

        showMessage('Creating invoice with tip options...', 'info');

        // Calculate remaining balance (price - existing deposits)
        const sessionPrice = parseFloat(session.price) || 0;
        const existingDeposit = parseFloat(session.depositAmount) || 0;
        const remainingBalance = sessionPrice - existingDeposit;

        if (remainingBalance <= 0) {
            showMessage('This session is already fully paid. No invoice needed.', 'warning');
            return;
        }

        // Create a simple payment record directly for tipping
        const paymentData = {
            sessionId: session.id,
            amount: remainingBalance,
            clientName: session.clientName,
            clientEmail: session.email,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };

        // Generate a simple payment ID for the invoice page
        const paymentId = `payment-${session.id}-${Date.now()}`;
        
        // Store payment data in localStorage for the invoice page to access
        localStorage.setItem(`payment-${paymentId}`, JSON.stringify(paymentData));
        
        // Create the custom invoice URL with tipping interface
        const customInvoiceUrl = `${window.location.origin}/invoice.html?payment=${paymentId}&sessionId=${session.id}&amount=${remainingBalance}`;
        
        showMessage('Invoice with tip options created successfully!', 'success');
        
        // Open the custom invoice URL
        window.open(customInvoiceUrl, '_blank');

        console.log(' TIPPING SUCCESS: Custom invoice URL created:', customInvoiceUrl);

    } catch (error) {
        console.error('Error creating invoice with tipping:', error);
        showMessage('Error creating invoice: ' + error.message, 'error');
    }
}

// Show invoice send dialog with SMS and email options
function showInvoiceSendDialog(data) {
    const { amount, clientName, clientPhone, clientEmail, invoiceUrl } = data;
    
    // Remove existing dialog if present
    const existingDialog = document.getElementById('invoice-send-dialog');
    if (existingDialog) existingDialog.remove();
    
    // Create dialog HTML
    const dialogHTML = `
        <div id="invoice-send-dialog" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div style="background: white; padding: 30px; border-radius: 12px; width: 90%; max-width: 500px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                <div style="text-align: center; margin-bottom: 25px;">
                    <h2 style="margin: 0 0 10px 0; color: #333; font-size: 24px;"> Invoice Created Successfully!</h2>
                    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <div style="font-size: 16px; color: #0369a1; margin-bottom: 8px;"> Amount: $${amount.toFixed(2)}</div>
                        <div style="font-size: 16px; color: #0369a1;"> Client: ${clientName}</div>
                    </div>
                    <div style="background: #f0f9f0; padding: 12px; border-radius: 8px; font-size: 14px; color: #166534;">
                         Client can add 15%, 20%, 25% tips or custom amounts
                    </div>
                </div>
                
                <div style="margin-bottom: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">Send Invoice to Client:</h3>
                    
                    <div style="display: grid; gap: 12px;">
                        <button onclick="sendViaSMS('${session.phone_number || session.phoneNumber}', '${clientName}', '${amount}', '${invoiceUrl}')" 
                                style="padding: 15px 20px; background: #22c55e; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            📱 Send via SMS
                        </button>
                        
                        <button onclick="sendViaEmail('${clientEmail}', '${clientName}', '${amount}', '${invoiceUrl}')" 
                                style="padding: 15px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                             Send via Email
                        </button>
                    </div>
                </div>
                
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                    <div style="font-size: 14px; color: #6b7280; margin-bottom: 15px;">
                        Invoice URL (you can copy this manually):
                    </div>
                    <div style="background: #f9fafb; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; word-break: break-all; color: #374151; border: 1px solid #e5e7eb;">
                        ${invoiceUrl}
                    </div>
                    <button onclick="copyToClipboard('${invoiceUrl}')" 
                            style="margin-top: 10px; padding: 8px 15px; background: #6b7280; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">
                         Copy URL
                    </button>
                </div>
                
                <div style="text-align: center; margin-top: 25px;">
                    <button onclick="closeInvoiceSendDialog()" 
                            style="padding: 12px 30px; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add to page
    document.body.insertAdjacentHTML('beforeend', dialogHTML);
}

// Send invoice via SMS using device default SMS app
function sendViaSMS(phone, clientName, amount, invoiceUrl) {
    if (!phone) {
        alert('No phone number found for this client. Please add a phone number to the session.');
        return;
    }
    
    const message = `Hi ${clientName}! Your photography invoice for $${parseFloat(amount).toFixed(2)} is ready. You can add a tip and pay securely here: ${invoiceUrl}`;
    
    // Create SMS URL that opens default SMS app
    const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
    
    // Open SMS app
    window.location.href = smsUrl;
    
    showMessage('SMS app opened with invoice message!', 'success');
}

// Send invoice via email using device default email app
function sendViaEmail(email, clientName, amount, invoiceUrl) {
    if (!email) {
        alert('No email address found for this client. Please add an email to the session.');
        return;
    }
    
    const subject = `Photography Invoice - $${parseFloat(amount).toFixed(2)}`;
    const body = `Hi ${clientName},

Your photography session invoice is ready! 

Invoice Amount: $${parseFloat(amount).toFixed(2)}

You can review your invoice and add a tip (if you'd like) using the secure payment link below:

${invoiceUrl}

Features of your invoice:
• Add 15%, 20%, or 25% tip with one click
• Add custom tip amounts
• Secure payment processing
• Instant confirmation

Thank you for choosing our photography services!

Best regards,
The Legacy Photography`;
    
    // Create mailto URL that opens default email app
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open email app
    window.location.href = mailtoUrl;
    
    showMessage('Email app opened with invoice message!', 'success');
}

// Copy URL to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showMessage('Invoice URL copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Clipboard copy failed:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

// Fallback copy method for older browsers
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showMessage('Invoice URL copied to clipboard!', 'success');
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showMessage('Could not copy URL. Please copy manually.', 'error');
    }
    
    document.body.removeChild(textArea);
}

// Close invoice send dialog
function closeInvoiceSendDialog() {
    const dialog = document.getElementById('invoice-send-dialog');
    if (dialog) dialog.remove();
}

// Send deposit invoice with custom amount - NEW TIPPING SYSTEM VERSION
async function sendDepositInvoice(session) {
    try {
        console.log(' NEW DEPOSIT SYSTEM: sendDepositInvoice called with session:', session);
        console.log(' NEW CODE VERSION: Using deposit tipping system');

        // If session is just an ID string, fetch the full session object
        if (typeof session === 'string') {
            console.log(' DEPOSIT BRIDGE: Session is a string ID, need to find full session object');
            // Find session in the sessions array from the API response
            const fullSession = window.sessionsData ? window.sessionsData.find(s => s.id === session) : null;
            if (fullSession) {
                session = fullSession;
                console.log(' DEPOSIT BRIDGE: Found full session object:', session);
            } else {
                console.log(' DEPOSIT BRIDGE: Could not find session in sessionsData');
                showMessage('Error: Session data not found. Please refresh the page and try again.', 'error');
                return;
            }
        }

        // Ensure we have valid session data
        if (!session || !session.price) {
            showMessage('Error: Session data is missing. Please refresh the page and try again.', 'error');
            return;
        }

        // Calculate suggested deposit amount (50% of session price or remaining balance)
        const existingDeposits = session.depositAmount || 0;
        const remainingBalance = session.price - existingDeposits;
        const suggestedAmount = existingDeposits > 0 ? 
            (remainingBalance * 0.5) : 
            (session.price * 0.5);

        console.log(' DEPOSIT BRIDGE: Prompting for customizable deposit amount');
        
        // Prompt for custom deposit amount with helpful context
        let promptText;
        if (existingDeposits > 0) {
            promptText = `Enter additional deposit amount for ${session.clientName}:\n\nSession Total: $${session.price}\nPrevious Deposits: $${existingDeposits.toFixed(2)}\nRemaining Balance: $${remainingBalance.toFixed(2)}\nSuggested 50%: $${suggestedAmount.toFixed(2)}`;
        } else {
            promptText = `Enter deposit amount for ${session.clientName}:\n\nSession Total: $${session.price}\nSuggested 50%: $${suggestedAmount.toFixed(2)}`;
        }

        const depositAmountInput = prompt(promptText, suggestedAmount.toFixed(2));

        if (!depositAmountInput) {
            return; // User cancelled
        }

        const depositAmount = parseFloat(depositAmountInput);

        if (isNaN(depositAmount) || depositAmount <= 0) {
            showMessage('Please enter a valid amount greater than $0', 'error');
            return;
        }

        if (depositAmount > session.price) {
            const confirmOverage = confirm(
                `Deposit amount ($${depositAmount.toFixed(2)}) is more than the session total ($${session.price}).\n\nDo you want to continue?`
            );
            if (!confirmOverage) {
                return;
            }
        }

        console.log(' DEPOSIT BRIDGE: Creating deposit invoice with custom amount:', depositAmount.toFixed(2));

        // Create deposit invoice with tipping system using suggested amount
        const authToken = await getAuthToken();
        const headers = {
            'Content-Type': 'application/json'
        };

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch('/api/create-deposit-invoice-with-tipping', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sessionId: session.id,
                depositAmount: depositAmount,
                includeTipping: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create deposit invoice: ${errorText}`);
        }

        const result = await response.json();
        console.log(' DEPOSIT TIPPING SUCCESS: Custom deposit invoice URL created:', result.invoice_url);

        if (result.success && result.invoice_url) {
            showMessage(`Deposit invoice created for $${depositAmount.toFixed(2)}! Opening in new window...`, 'success');

            // Open deposit invoice in new window
            console.log(' Attempting to open window with URL:', result.invoice_url);
            
            try {
                // Use a simple approach that works better with popup blockers
                const newWindow = window.open('', '_blank');
                if (newWindow) {
                    newWindow.location.href = result.invoice_url;
                    console.log(' Deposit invoice window opened successfully');
                } else {
                    throw new Error('Popup blocked');
                }
            } catch (error) {
                console.log('❌ Popup blocked - using fallback');
                showMessage('Browser blocked popup. Click this link to open deposit invoice:', 'warning');
                
                // Create a clickable link in the message area
                setTimeout(() => {
                    const linkDiv = document.createElement('div');
                    linkDiv.innerHTML = `
                        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 5px;">
                            <strong>Deposit Invoice Ready!</strong><br>
                            <a href="${result.invoice_url}" target="_blank" style="color: #0066cc; text-decoration: underline;">
                                Click here to open $${depositAmount.toFixed(2)} deposit invoice →
                            </a>
                        </div>
                    `;
                    
                    // Insert after the sessions list
                    const sessionsContainer = document.querySelector('.sessions-container') || document.body;
                    sessionsContainer.appendChild(linkDiv);
                    
                    // Auto-remove after 30 seconds
                    setTimeout(() => linkDiv.remove(), 30000);
                }, 500);
            }

            // Wait a moment for database to update, then refresh sessions
            setTimeout(async () => {
                await loadSessions();
                console.log(' DEPOSIT BRIDGE: Sessions reloaded after deposit creation');
            }, 1000);
        } else {
            throw new Error(result.message || 'Unknown error creating deposit invoice');
        }

    } catch (error) {
        console.error('Error creating deposit invoice:', error);
        showMessage('Error creating deposit invoice: ' + error.message, 'error');
    }
}

// Form submission handler
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('sessionForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formData = new FormData(form);
            const sessionData = {};

            // Extract form data
            for (let [key, value] of formData.entries()) {
                if (key === 'contractSigned' || key === 'paid' || key === 'edited' || key === 'delivered' || key === 'reminderEnabled' || key === 'galleryReadyNotified') {
                    sessionData[key] = value === 'on';
                } else if (key === 'price') {
                    sessionData[key] = parseFloat(value) || 0;
                } else if (key === 'duration') {
                    sessionData[key] = parseInt(value) || 60;
                } else {
                    sessionData[key] = value;
                }
            }

            // Handle checkboxes that aren't checked (they won't be in FormData)
            const checkboxes = ['contractSigned', 'paid', 'edited', 'delivered', 'reminderEnabled', 'galleryReadyNotified'];
            checkboxes.forEach(checkbox => {
                if (!formData.has(checkbox)) {
                    sessionData[checkbox] = false;
                }
            });

            console.log('Form data extracted:', sessionData);

            // Check if we're editing or creating
            const editingId = form.dataset.editingId;
            if (editingId) {
                // Update session
                await updateAPISession(editingId, sessionData);

                // Reset form state
                delete form.dataset.editingId;
                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.textContent = 'Add Session';
            } else {
                // Create new session
                await createAPISession(sessionData);
            }

            // Reset form
            form.reset();
        });
    }

    // Load sessions on page load
    loadSessions();
});

// Update session via API
async function updateAPISession(sessionId, sessionData) {
    try {
        console.log('Updating session via API:', sessionId, sessionData);

        const authToken = await getAuthToken();
        const headers = {
            'Content-Type': 'application/json'
        };

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(sessionData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Update API response:', result);

        // Reload sessions to show the updated one
        loadSessions();
        showMessage('Session updated successfully!', 'success');

    } catch (error) {
        console.error('Error updating session:', error.message || error);
        console.error('Full error details:', error);
        showMessage('Error updating session: ' + error.message, 'error');
    }
}

// Photo Gallery Functions

// Create photo gallery section for session card
function createPhotoGallery(session) {
    const gallerySection = document.createElement('div');
    gallerySection.className = 'photo-gallery-section';
    gallerySection.setAttribute('data-session-id', session.id);

    const galleryHeader = document.createElement('div');
    galleryHeader.className = 'gallery-header';

    const galleryTitle = document.createElement('h4');
    galleryTitle.className = 'gallery-title';
    galleryTitle.textContent = 'Photo Gallery & Download Controls';

    const photoCount = document.createElement('span');
    photoCount.className = 'photo-count';
    const count = session.photos ? session.photos.length : 0;
    photoCount.textContent = `${count} photos`;

    galleryHeader.appendChild(galleryTitle);
    galleryHeader.appendChild(photoCount);

    // Add download controls section
    const downloadControls = createDownloadControlsSection(session);
    
    const galleryGrid = document.createElement('div');
    galleryGrid.className = 'gallery-grid';
    galleryGrid.setAttribute('data-session-id', session.id);

    // Load photos for this session
    loadSessionPhotos(session.id, galleryGrid, photoCount);

    gallerySection.appendChild(galleryHeader);
    gallerySection.appendChild(downloadControls);
    gallerySection.appendChild(galleryGrid);

    return gallerySection;
}

// Load photos for a specific session
async function loadSessionPhotos(sessionId, container, countElement) {
    try {
        const authToken = await getAuthToken();
        const headers = {};

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`/api/sessions/${sessionId}/photos`, { headers });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const photos = data.photos || [];

        // Update photo count
        if (countElement) {
            countElement.textContent = `${photos.length} photos`;
        }

        // Clear container
        container.innerHTML = '';

        if (photos.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'gallery-empty';
            emptyState.textContent = 'No photos uploaded yet';
            container.appendChild(emptyState);
            return;
        }

        // Create photo items
        photos.forEach((photo, index) => {
            const photoItem = createPhotoItem(photo, index, sessionId);
            container.appendChild(photoItem);
        });

        console.log(`Loaded ${photos.length} photos for session ${sessionId}`);

    } catch (error) {
        console.error('Error loading photos:', error);
        container.innerHTML = '<div class="gallery-error">Error loading photos</div>';
    }
}

// Create individual photo item
function createPhotoItem(photo, index, sessionId) {
    const photoItem = document.createElement('div');
    photoItem.className = 'gallery-photo-item';
    photoItem.setAttribute('data-photo-index', index);

    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.fileName || `Photo ${index + 1}`;
    img.loading = 'lazy';
    img.onclick = () => openPhotoLightbox(photo.url, photo.fileName);

    // Add delete button for admin users
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'photo-delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Delete photo';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deletePhoto(sessionId, index);
    };

    photoItem.appendChild(img);
    photoItem.appendChild(deleteBtn);

    return photoItem;
}

// Create download controls section for session management
function createDownloadControlsSection(session) {
    const controlsSection = document.createElement('div');
    controlsSection.className = 'download-controls-section';
    controlsSection.style.cssText = `
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 20px;
        margin: 15px 0;
    `;

    // Download Policy Configuration
    const policyHeader = document.createElement('div');
    policyHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    `;
    
    const policyTitle = document.createElement('h5');
    policyTitle.textContent = '📥 Download Policy & Controls';
    policyTitle.style.cssText = `
        margin: 0;
        color: #495057;
        font-weight: 600;
    `;

    const configureBtn = document.createElement('button');
    configureBtn.className = 'btn btn-primary';
    configureBtn.textContent = '⚙️ Configure';
    configureBtn.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        color: white;
        font-size: 0.9rem;
        cursor: pointer;
    `;
    configureBtn.onclick = () => openDownloadPolicyModal(session.id);

    policyHeader.appendChild(policyTitle);
    policyHeader.appendChild(configureBtn);

    // Current Policy Display
    const policyDisplay = document.createElement('div');
    policyDisplay.id = `policy-display-${session.id}`;
    policyDisplay.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 15px;
    `;

    // Quick Actions Row
    const actionsRow = document.createElement('div');
    actionsRow.style.cssText = `
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 15px;
    `;

    const generateTokenBtn = document.createElement('button');
    generateTokenBtn.className = 'btn btn-success';
    generateTokenBtn.textContent = '🔑 Generate Download Token';
    generateTokenBtn.style.cssText = `
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        color: white;
        font-size: 0.9rem;
        cursor: pointer;
    `;
    generateTokenBtn.onclick = () => generateDownloadToken(session.id);

    const analyticsBtn = document.createElement('button');
    analyticsBtn.className = 'btn btn-info';
    analyticsBtn.textContent = '📊 View Analytics';
    analyticsBtn.style.cssText = `
        background: linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%);
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        color: white;
        font-size: 0.9rem;
        cursor: pointer;
    `;
    analyticsBtn.onclick = () => showDownloadAnalytics(session.id);

    const watermarkBtn = document.createElement('button');
    watermarkBtn.className = 'btn btn-secondary';
    watermarkBtn.textContent = '🎨 Watermark Settings';
    watermarkBtn.style.cssText = `
        background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        color: white;
        font-size: 0.9rem;
        cursor: pointer;
    `;
    watermarkBtn.onclick = () => openWatermarkModal(session.id);

    actionsRow.appendChild(generateTokenBtn);
    actionsRow.appendChild(analyticsBtn);
    actionsRow.appendChild(watermarkBtn);

    // Analytics Summary
    const analyticsSummary = document.createElement('div');
    analyticsSummary.id = `analytics-summary-${session.id}`;
    analyticsSummary.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 10px;
        background: white;
        padding: 15px;
        border-radius: 6px;
        border: 1px solid #dee2e6;
    `;

    controlsSection.appendChild(policyHeader);
    controlsSection.appendChild(policyDisplay);
    controlsSection.appendChild(actionsRow);
    controlsSection.appendChild(analyticsSummary);

    // Load current policy and analytics only after authentication is established
    if (window.currentUser || document.cookie.includes('connect.sid')) {
        // Authentication appears to be ready, load data
        loadDownloadPolicy(session.id);
        loadDownloadAnalytics(session.id);
    } else {
        // Wait for authentication to be established
        const checkAuthAndLoad = () => {
            if (window.currentUser || document.cookie.includes('connect.sid')) {
                loadDownloadPolicy(session.id);
                loadDownloadAnalytics(session.id);
            } else {
                // Show fallback UI if auth is not ready after timeout
                setTimeout(() => {
                    if (!window.currentUser && !document.cookie.includes('connect.sid')) {
                        showDownloadPolicyFallback(session.id);
                        showDownloadAnalyticsFallback(session.id);
                    }
                }, 2000);
            }
        };
        
        // Try loading after a short delay
        setTimeout(checkAuthAndLoad, 1000);
    }

    return controlsSection;
}

// Load and display current download policy
async function loadDownloadPolicy(sessionId) {
    try {
        const response = await fetch(`/api/downloads/sessions/${sessionId}/policy`, {
            credentials: 'include' // Use session-based auth
        });
        
        if (!response.ok) {
            // Handle auth errors gracefully
            if (response.status === 401) {
                console.log('Download policy: Authentication required');
                showDownloadPolicyFallback(sessionId);
                return;
            }
            throw new Error('Failed to load policy');
        }

        const data = await response.json();
        const policy = data.policy;

        const policyDisplay = document.getElementById(`policy-display-${sessionId}`);
        if (!policyDisplay) return;

        policyDisplay.innerHTML = `
            <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #dee2e6;">
                <div style="font-weight: 600; color: #495057; margin-bottom: 5px;">Pricing Model</div>
                <div style="color: #28a745; font-weight: 500;">${getPricingModelDisplay(policy.pricingModel)}</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #dee2e6;">
                <div style="font-weight: 600; color: #495057; margin-bottom: 5px;">Download Limit</div>
                <div style="color: #6c757d;">${policy.downloadMax || 'Unlimited'}</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #dee2e6;">
                <div style="font-weight: 600; color: #495057; margin-bottom: 5px;">Price per Download</div>
                <div style="color: #dc3545;">$${parseFloat(policy.pricePerDownload || 0).toFixed(2)}</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #dee2e6;">
                <div style="font-weight: 600; color: #495057; margin-bottom: 5px;">Watermark</div>
                <div style="color: ${policy.watermarkEnabled ? '#28a745' : '#6c757d'};">
                    ${policy.watermarkEnabled ? `✅ ${policy.watermarkType}` : '❌ Disabled'}
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading download policy:', error);
        showDownloadPolicyFallback(sessionId);
    }
}

// Show fallback UI for download policy
function showDownloadPolicyFallback(sessionId) {
    const policyDisplay = document.getElementById(`policy-display-${sessionId}`);
    if (policyDisplay) {
        policyDisplay.innerHTML = `
            <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #dee2e6; text-align: center;">
                <div style="color: #6c757d; margin-bottom: 8px;">⚠️ Download policy not configured</div>
                <button onclick="openDownloadPolicyModal('${sessionId}')" style="
                    background: #007bff; 
                    color: white; 
                    border: none; 
                    padding: 6px 12px; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 0.8rem;
                ">Configure Now</button>
            </div>
        `;
    }
}

// Load and display download analytics
async function loadDownloadAnalytics(sessionId) {
    try {
        const response = await fetch(`/api/downloads/sessions/${sessionId}/analytics`, {
            credentials: 'include' // Use session-based auth
        });
        
        if (!response.ok) {
            // Handle auth errors gracefully
            if (response.status === 401) {
                console.log('Download analytics: Authentication required');
                showDownloadAnalyticsFallback(sessionId);
                return;
            }
            throw new Error('Failed to load analytics');
        }

        const data = await response.json();
        const analytics = data.analytics;

        const analyticsSummary = document.getElementById(`analytics-summary-${sessionId}`);
        if (!analyticsSummary) return;

        analyticsSummary.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 1.2rem; font-weight: 600; color: #17a2b8;">${analytics.totalDownloads}</div>
                <div style="font-size: 0.8rem; color: #6c757d;">Total Downloads</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.2rem; font-weight: 600; color: #28a745;">${analytics.freeDownloads}</div>
                <div style="font-size: 0.8rem; color: #6c757d;">Free Downloads</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.2rem; font-weight: 600; color: #dc3545;">${analytics.paidDownloads}</div>
                <div style="font-size: 0.8rem; color: #6c757d;">Paid Downloads</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.2rem; font-weight: 600; color: #6f42c1;">$${parseFloat(analytics.totalRevenue || 0).toFixed(2)}</div>
                <div style="font-size: 0.8rem; color: #6c757d;">Revenue</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.2rem; font-weight: 600; color: #fd7e14;">${analytics.uniqueClients}</div>
                <div style="font-size: 0.8rem; color: #6c757d;">Unique Clients</div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading download analytics:', error);
        showDownloadAnalyticsFallback(sessionId);
    }
}

// Show fallback UI for download analytics
function showDownloadAnalyticsFallback(sessionId) {
    const analyticsSummary = document.getElementById(`analytics-summary-${sessionId}`);
    if (analyticsSummary) {
        analyticsSummary.innerHTML = `
            <div style="text-align: center; color: #6c757d; grid-column: 1 / -1; padding: 20px;">
                <div style="font-size: 0.9rem; margin-bottom: 8px;">📊 Analytics not available</div>
                <div style="font-size: 0.8rem;">Configure download policy to start tracking</div>
            </div>
        `;
    }
}

// Helper function to display pricing model
function getPricingModelDisplay(model) {
    switch (model) {
        case 'free': return '🆓 Free Downloads';
        case 'paid': return '💰 Paid Downloads';
        case 'freemium': return '🎯 Freemium Model';
        default: return '🆓 Free Downloads';
    }
}

// Open download policy configuration modal
function openDownloadPolicyModal(sessionId) {
    // Remove existing modal if present
    const existingModal = document.getElementById('download-policy-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'download-policy-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    modal.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        ">
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 25px;
                border-bottom: 2px solid #e9ecef;
                padding-bottom: 15px;
            ">
                <h3 style="margin: 0; color: #495057; font-weight: 600;">📥 Download Policy Configuration</h3>
                <button onclick="closeDownloadPolicyModal()" style="
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #6c757d;
                    padding: 5px;
                ">×</button>
            </div>
            
            <form id="download-policy-form">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #495057;">Pricing Model</label>
                    <select id="pricingModel" style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #dee2e6;
                        border-radius: 6px;
                        font-size: 1rem;
                    ">
                        <option value="free">🆓 Free Downloads</option>
                        <option value="paid">💰 Paid Downloads Only</option>
                        <option value="freemium">🎯 Freemium (Free + Paid)</option>
                    </select>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #495057;">Download Limit (leave empty for unlimited)</label>
                    <input type="number" id="downloadMax" placeholder="e.g., 10" style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #dee2e6;
                        border-radius: 6px;
                        font-size: 1rem;
                    ">
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #495057;">Price per Download ($)</label>
                    <input type="number" step="0.01" id="pricePerDownload" placeholder="e.g., 5.00" style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #dee2e6;
                        border-radius: 6px;
                        font-size: 1rem;
                    ">
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #495057;">Free Downloads (for freemium model)</label>
                    <input type="number" id="freeDownloads" placeholder="e.g., 3" style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #dee2e6;
                        border-radius: 6px;
                        font-size: 1rem;
                    ">
                </div>

                <div style="margin-bottom: 25px;">
                    <label style="display: flex; align-items: center; font-weight: 600; color: #495057;">
                        <input type="checkbox" id="watermarkEnabled" style="margin-right: 10px; transform: scale(1.2);">
                        Enable Watermarks
                    </label>
                </div>

                <div style="
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                    border-top: 1px solid #e9ecef;
                    padding-top: 20px;
                ">
                    <button type="button" onclick="closeDownloadPolicyModal()" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 12px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                    ">Cancel</button>
                    <button type="submit" style="
                        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                        color: white;
                        border: none;
                        padding: 12px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                    ">Save Policy</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Load current policy data
    loadPolicyDataIntoForm(sessionId);

    // Handle form submission
    document.getElementById('download-policy-form').onsubmit = (e) => {
        e.preventDefault();
        saveDownloadPolicy(sessionId);
    };
}

// Load current policy data into form
async function loadPolicyDataIntoForm(sessionId) {
    try {

        const response = await fetch(`/api/downloads/sessions/${sessionId}/policy`, { 
            credentials: 'include' // Use session-based auth
        });
        if (!response.ok) return;

        const data = await response.json();
        const policy = data.policy;

        document.getElementById('pricingModel').value = policy.pricingModel || 'free';
        document.getElementById('downloadMax').value = policy.downloadMax || '';
        document.getElementById('pricePerDownload').value = policy.pricePerDownload || '';
        document.getElementById('freeDownloads').value = policy.freeDownloads || '';
        document.getElementById('watermarkEnabled').checked = policy.watermarkEnabled || false;

    } catch (error) {
        console.error('Error loading policy data:', error);
    }
}

// Save download policy
async function saveDownloadPolicy(sessionId) {
    try {
        const authToken = await getAuthToken();
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const policyData = {
            pricingModel: document.getElementById('pricingModel').value,
            downloadMax: parseInt(document.getElementById('downloadMax').value) || null,
            pricePerDownload: parseFloat(document.getElementById('pricePerDownload').value) || 0,
            freeDownloads: parseInt(document.getElementById('freeDownloads').value) || 0,
            watermarkEnabled: document.getElementById('watermarkEnabled').checked
        };

        const response = await fetch(`/api/downloads/sessions/${sessionId}/policy`, {
            method: 'PUT',
            headers,
            credentials: 'include', // Use session-based auth
            body: JSON.stringify(policyData)
        });

        if (!response.ok) throw new Error('Failed to save policy');

        showMessage('Download policy updated successfully!', 'success');
        closeDownloadPolicyModal();
        
        // Refresh policy display
        loadDownloadPolicy(sessionId);

    } catch (error) {
        console.error('Error saving download policy:', error);
        showMessage('Error saving download policy: ' + error.message, 'error');
    }
}

// Close download policy modal
function closeDownloadPolicyModal() {
    const modal = document.getElementById('download-policy-modal');
    if (modal) modal.remove();
}

// Generate download token
async function generateDownloadToken(sessionId) {
    const clientEmail = prompt('Enter client email for download token:');
    if (!clientEmail) return;

    try {
        const headers = { 'Content-Type': 'application/json' };

        const response = await fetch(`/api/downloads/sessions/${sessionId}/generate-token`, {
            method: 'POST',
            headers,
            credentials: 'include', // Use session-based auth
            body: JSON.stringify({ clientEmail, expiresInHours: 72 })
        });

        if (!response.ok) throw new Error('Failed to generate token');

        const data = await response.json();
        
        // Show token with copy option
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 600px;
                width: 90%;
                text-align: center;
            ">
                <h3 style="color: #28a745; margin-bottom: 20px;">🔑 Download Token Generated</h3>
                <p style="margin-bottom: 15px; color: #495057;">Client: <strong>${clientEmail}</strong></p>
                <p style="margin-bottom: 15px; color: #495057;">Expires: <strong>${new Date(data.expiresAt).toLocaleString()}</strong></p>
                
                <div style="
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 6px;
                    margin-bottom: 20px;
                    word-break: break-all;
                    font-family: monospace;
                    border: 1px solid #dee2e6;
                ">${data.downloadUrl}</div>
                
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button onclick="navigator.clipboard.writeText('${data.downloadUrl}').then(() => showMessage('URL copied!', 'success'))" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 12px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                    ">📋 Copy URL</button>
                    <button onclick="this.closest('div').closest('div').remove()" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 12px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                    ">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        showMessage('Download token generated successfully!', 'success');

    } catch (error) {
        console.error('Error generating download token:', error);
        showMessage('Error generating download token: ' + error.message, 'error');
    }
}

// Show download analytics modal
async function showDownloadAnalytics(sessionId) {
    try {
        const response = await fetch(`/api/downloads/sessions/${sessionId}/analytics`, {
            credentials: 'include' // Use session-based auth
        });
        if (!response.ok) throw new Error('Failed to load analytics');

        const data = await response.json();
        const analytics = data.analytics;

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 700px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 25px;
                    border-bottom: 2px solid #e9ecef;
                    padding-bottom: 15px;
                ">
                    <h3 style="margin: 0; color: #495057;">📊 Download Analytics</h3>
                    <button onclick="this.closest('div').closest('div').remove()" style="
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        cursor: pointer;
                        color: #6c757d;
                    ">×</button>
                </div>
                
                <div style="
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 25px;
                ">
                    <div style="
                        background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 8px;
                        text-align: center;
                    ">
                        <div style="font-size: 2rem; font-weight: bold;">${analytics.totalDownloads}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Total Downloads</div>
                    </div>
                    <div style="
                        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 8px;
                        text-align: center;
                    ">
                        <div style="font-size: 2rem; font-weight: bold;">${analytics.freeDownloads}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Free Downloads</div>
                    </div>
                    <div style="
                        background: linear-gradient(135deg, #dc3545 0%, #e83e8c 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 8px;
                        text-align: center;
                    ">
                        <div style="font-size: 2rem; font-weight: bold;">${analytics.paidDownloads}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Paid Downloads</div>
                    </div>
                    <div style="
                        background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 8px;
                        text-align: center;
                    ">
                        <div style="font-size: 2rem; font-weight: bold;">$${parseFloat(analytics.totalRevenue || 0).toFixed(2)}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Total Revenue</div>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <button onclick="this.closest('div').closest('div').remove()" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 12px 25px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                    ">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

    } catch (error) {
        console.error('Error loading analytics:', error);
        showMessage('Error loading analytics: ' + error.message, 'error');
    }
}

// Open watermark configuration modal
function openWatermarkModal(sessionId) {
    // Placeholder for watermark configuration
    showMessage('Watermark configuration will open the dedicated watermark settings modal', 'info');
    // This could integrate with the existing watermark logo upload functionality
}

// Open photo upload dialog - use existing HTML modal
function openUploadDialog(sessionId) {
    console.log('Opening upload dialog for session:', sessionId);

    // Use the existing HTML modal
    const modal = document.getElementById('uploadModal');
    const fileInput = document.getElementById('fileInput');
    const filePreview = document.getElementById('filePreview');

    // Clear previous state
    fileInput.value = '';
    filePreview.innerHTML = '';

    // Store session ID for upload
    window.currentUploadSessionId = sessionId;

    // Show modal
    modal.classList.add('active');
}

// Setup upload modal functionality - removed old code
function setupUploadModal(sessionId) {
    // This function is no longer needed since we use HTML upload modal
    console.log('Using existing HTML upload modal for session:', sessionId);
    return; // Exit early - all functionality handled by HTML modal

    // File input change handler
    fileInput.addEventListener('change', (e) => {
        handleFileSelection(e.target.files);
    });

    // Drop zone click handler
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFileSelection(e.dataTransfer.files);
    });

    // Upload button handler
    uploadBtn.addEventListener('click', async () => {
        console.log('🚀 Upload button clicked! Starting direct upload...');
        console.log('Files to upload:', selectedFiles.length);
        
        // Show progress modal
        showUploadProgress();
        
        try {
            const result = await uploadPhotosDirect(sessionId, selectedFiles);
            
            if (result && result.success) {
                console.log('✅ Upload successful!', result);
                showMessage(`Successfully uploaded ${result.count || selectedFiles.length} photos!`, 'success');
                
                // Close modals
                setTimeout(() => {
                    hideUploadProgress();
                    const modal = document.getElementById('uploadModal');
                    if (modal) modal.classList.remove('active');
                }, 1500);
                
                // Reload photos
                const galleryGrid = document.querySelector(`.gallery-grid[data-session-id="${sessionId}"]`);
                const photoCount = galleryGrid?.parentElement?.querySelector('.photo-count');
                if (galleryGrid) {
                    loadSessionPhotos(sessionId, galleryGrid, photoCount);
                }
            } else {
                throw new Error('Upload failed - no success result');
            }
        } catch (error) {
            console.error('❌ Upload error:', error);
            hideUploadProgress();
            showMessage('Upload failed: ' + error.message, 'error');
        }
    });

    function handleFileSelection(files) {
        selectedFiles = Array.from(files).filter(file => {
            // Accept all file types - no restrictions for photographers
            if (file.size > 5 * 1024 * 1024 * 1024) { // 5GB per file limit (Cloudflare R2 technical limit)
                showMessage(`${file.name} is too large (max 5GB per file)`, 'error');
                return false;
            }
            return true;
        });

        // No file count limit for RAW backup - photographers need unlimited capacity

        // Update preview
        updateUploadPreview();

        // Enable/disable upload button
        uploadBtn.disabled = selectedFiles.length === 0;
        uploadBtn.textContent = selectedFiles.length > 0 ? `Upload ${selectedFiles.length} Files` : 'Upload Files';
    }

    function updateUploadPreview() {
        previewContainer.innerHTML = '';

        if (selectedFiles.length === 0) {
            return;
        }

        selectedFiles.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'upload-preview-item';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = file.name;

            const fileName = document.createElement('div');
            fileName.className = 'preview-file-name';
            fileName.textContent = file.name;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'preview-remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => {
                selectedFiles.splice(index, 1);
                updateUploadPreview();
                uploadBtn.disabled = selectedFiles.length === 0;
                uploadBtn.textContent = selectedFiles.length > 0 ? `Upload ${selectedFiles.length} Files` : 'Upload Files';
            };

            previewItem.appendChild(img);
            previewItem.appendChild(fileName);
            previewItem.appendChild(removeBtn);
            previewContainer.appendChild(previewItem);
        });
    }

    // Simple upload progress functions
    function showUploadProgress() {
        const progressHtml = `
            <div id="uploadProgressModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 10000;">
                <div style="background: white; padding: 30px; border-radius: 10px; min-width: 300px; text-align: center;">
                    <h3>Uploading Photos...</h3>
                    <div style="margin: 20px 0;">
                        <div class="spinner" style="margin: 0 auto;"></div>
                    </div>
                    <p id="uploadStatusText">Please wait...</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', progressHtml);
    }

    function hideUploadProgress() {
        const modal = document.getElementById('uploadProgressModal');
        if (modal) modal.remove();
    }

    function updateFileProgress(index, fileName, status, percent) {
        const statusText = document.getElementById('uploadStatusText');
        if (statusText) {
            statusText.textContent = `Uploading ${fileName} (${percent}%)`;
        }
    }

    // Fast upload function using presigned URLs for direct R2 uploads
    async function uploadPhotosDirect(sessionId, files) {
        if (files.length === 0) return;

        try {
            console.log('🚀 Starting FAST direct R2 upload process...');
            console.log('Uploading', files.length, 'files to session', sessionId);
            
            const authToken = await getAuthToken();
            if (!authToken) {
                throw new Error('Authentication required for photo upload');
            }

            // Step 1: Get presigned URLs from server
            const fileMetadata = files.map(file => ({
                filename: file.name,
                contentType: file.type || 'image/jpeg',
                size: file.size
            }));

            const urlResponse = await fetch(`/api/sessions/${sessionId}/upload-urls`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ files: fileMetadata })
            });

            if (!urlResponse.ok) {
                const errorData = await urlResponse.json();
                if (errorData.error === 'Storage quota exceeded') {
                    throw new Error(errorData.message);
                }
                // Fallback to legacy upload if presigned URLs fail
                console.log('⚠️ Presigned URL generation failed, falling back to legacy upload');
                return uploadPhotosLegacy(sessionId, files);
            }

            const urlData = await urlResponse.json();
            const urls = urlData.urls;
            console.log(`✅ Got ${urls.length} presigned URLs for direct upload`);
            console.log('First URL data:', urls[0]); // Debug the URL structure

            // Step 2: Upload files directly to R2 in parallel (MUCH FASTER!)
            const uploadPromises = files.map(async (file, index) => {
                const urlData = urls[index];
                if (!urlData) return null;

                console.log(`📤 Uploading ${file.name} directly to R2 (${(file.size / 1024 / 1024).toFixed(2)} MB)...`);
                console.log('Using presigned URL:', urlData.presignedUrl?.substring(0, 100) + '...');
                
                // Update progress for this file
                updateFileProgress(index, file.name, 'uploading', 0);
                
                // For files over 100MB, use chunked upload for better reliability
                if (file.size > 100 * 1024 * 1024) {
                    return uploadLargeFileDirect(file, urlData);
                }
                
                // Standard upload for smaller files
                const uploadResponse = await fetch(urlData.presignedUrl, {
                    method: 'PUT',
                    body: file,
                    headers: {
                        'Content-Type': file.type || 'image/jpeg'
                    }
                });

                if (!uploadResponse.ok) {
                    console.error(`❌ Upload failed for ${file.name}:`, uploadResponse.status, uploadResponse.statusText);
                    updateFileProgress(index, file.name, 'failed', 0);
                    throw new Error(`Failed to upload ${file.name} to R2: ${uploadResponse.status} ${uploadResponse.statusText}`);
                }

                console.log(`✅ ${file.name} uploaded successfully!`);
                updateFileProgress(index, file.name, 'completed', 100);
                return {
                    filename: file.name,
                    key: urlData.key,
                    size: file.size
                };
            });

            // Upload all files in parallel for maximum speed
            const results = await Promise.all(uploadPromises);
            const successfulUploads = results.filter(r => r !== null);
            
            console.log(`🎉 Successfully uploaded ${successfulUploads.length} files directly to R2!`);
            
            // Step 3: Notify server of completed uploads
            console.log(`📝 Confirming ${successfulUploads.length} uploads with server...`);
            const confirmResponse = await fetch(`/api/sessions/${sessionId}/confirm-uploads`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ uploads: successfulUploads })
            });

            if (!confirmResponse.ok) {
                const errorText = await confirmResponse.text();
                console.error('❌ Failed to confirm uploads:', confirmResponse.status, errorText);
                throw new Error(`Failed to confirm uploads: ${confirmResponse.status} ${errorText}`);
            }

            const confirmResult = await confirmResponse.json();
            console.log(`✅ Confirmed uploads successfully:`, confirmResult);

            return { success: true, count: successfulUploads.length };

        } catch (error) {
            console.error('Direct upload error:', error);
            // Fallback to legacy upload on any error
            console.log('⚠️ Direct upload failed, falling back to legacy upload');
            return uploadPhotosLegacy(sessionId, files);
        }
    }

    // Legacy upload function (slower, through server)
    async function uploadPhotosLegacy(sessionId, files) {
        if (files.length === 0) return;

        try {
            console.log('Starting legacy upload process (slower)...');

            const authToken = await getAuthToken();
            if (!authToken) {
                throw new Error('Authentication required for photo upload');
            }

            const formData = new FormData();
            files.forEach(file => {
                formData.append('photos', file);
            });

            console.log('Uploading photos through server...');

            const response = await fetch(`/api/sessions/${sessionId}/upload-photos`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const result = await response.json();
            return { success: true, ...result };

        } catch (error) {
            console.error('Legacy upload error:', error);
            throw error;
        }
    }

    // Chunked upload for large files (over 100MB)
    async function uploadLargeFileDirect(file, urlData) {
        console.log(`📦 Using chunked upload for large file: ${file.name}`);
        
        const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks
        const chunks = Math.ceil(file.size / CHUNK_SIZE);
        
        try {
            for (let i = 0; i < chunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);
                
                console.log(`📤 Uploading chunk ${i + 1}/${chunks} (${((end - start) / 1024 / 1024).toFixed(2)} MB)...`);
                
                // Note: For true multipart uploads, we'd need a different approach
                // This is a simplified version that still provides progress feedback
                if (i === 0) {
                    // First chunk - use the presigned URL
                    const uploadResponse = await fetch(urlData.presignedUrl, {
                        method: 'PUT',
                        body: file, // Upload entire file for now
                        headers: {
                            'Content-Type': file.type || 'image/jpeg'
                        }
                    });

                    if (!uploadResponse.ok) {
                        throw new Error(`Failed to upload ${file.name} to R2`);
                    }
                    
                    console.log(`✅ Large file ${file.name} uploaded successfully!`);
                    break; // File uploaded
                }
            }
            
            return {
                filename: file.name,
                key: urlData.key,
                size: file.size
            };
        } catch (error) {
            console.error(`Error uploading large file ${file.name}:`, error);
            throw error;
        }
    }

    // Use the fast direct upload by default
    async function uploadPhotos(sessionId, files) {
        return uploadPhotosDirect(sessionId, files);
    }
}

// Open photo in lightbox
function openPhotoLightbox(imageUrl, fileName) {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.onclick = () => overlay.remove();

    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.onclick = (e) => e.stopPropagation();

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = fileName || 'Photo';
    img.className = 'lightbox-image';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'lightbox-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => overlay.remove();

    const title = document.createElement('div');
    title.className = 'lightbox-title';
    title.textContent = fileName || 'Photo';

    lightbox.appendChild(closeBtn);
    lightbox.appendChild(img);
    lightbox.appendChild(title);
    overlay.appendChild(lightbox);
    document.body.appendChild(overlay);
}

// Delete photo
async function deletePhoto(sessionId, photoIndex) {
    if (!confirm('Are you sure you want to delete this photo?')) {
        return;
    }

    try {
        const authToken = await getAuthToken();
        if (!authToken) {
            throw new Error('Authentication required for photo deletion');
        }

        // Show loading indicator
        const deleteBtn = document.querySelector(`[data-photo-index="${photoIndex}"] .photo-delete-btn`);
        if (deleteBtn) {
            deleteBtn.innerHTML = '⏳';
            deleteBtn.disabled = true;
        }

        // Get the photo filename first to use unified deletion
        const session = await fetch(`/api/sessions/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        }).then(res => res.json());

        const photo = session.photos[photoIndex];
        if (!photo) {
            throw new Error('Photo not found');
        }

        const filename = photo.originalName || photo.filename;

        // Use unified deletion endpoint that removes from both storage and database
        const response = await fetch(`/api/sessions/${sessionId}/files/gallery/${encodeURIComponent(filename)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            let errorMessage = `Delete failed (${response.status})`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (jsonError) {
                console.warn('Could not parse error response:', jsonError);
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('Photo deleted successfully:', result.message || result);
        showMessage(`Photo deleted successfully! ${result.reclaimedMB || ''}MB reclaimed`, 'success');

        // Refresh storage stats immediately to update totals
        if (typeof refreshGlobalStorageStats === 'function') {
            refreshGlobalStorageStats();
        }

        // Reload photos for this session
        const galleryGrid = document.querySelector(`.gallery-grid[data-session-id="${sessionId}"]`);
        const photoCount = galleryGrid?.parentElement?.querySelector('.photo-count');
        if (galleryGrid) {
            loadSessionPhotos(sessionId, galleryGrid, photoCount);
        }

    } catch (error) {
        console.error('Failed to delete photo:', error.message);
        showMessage(`Delete failed: ${error.message}`, 'error');

        // Reset delete button
        const deleteBtn = document.querySelector(`[data-photo-index="${photoIndex}"] .photo-delete-btn`);
        if (deleteBtn) {
            deleteBtn.innerHTML = '×';
            deleteBtn.disabled = false;
        }
    }
}

// Firebase logout function
async function firebaseLogout() {
    try {
        // Set flag to prevent automatic re-authentication
        sessionStorage.setItem('loggingOut', 'true');
        localStorage.setItem('manualLogout', 'true');
        
        console.log('Starting logout process...');
        
        // First, clear server session
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Server logout response:', response.status);

        // Then clear Firebase auth if available
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                await firebase.auth().signOut();
                console.log('Firebase logout successful');
            }
        } catch (firebaseError) {
            console.error('Firebase signout error:', firebaseError);
        }

        // Clear all local data
        currentUser = null;
        localStorage.clear();
        
        // Keep the logout flags until redirect
        sessionStorage.setItem('loggingOut', 'true');
        localStorage.setItem('manualLogout', 'true');
        
        console.log('Logout complete, redirecting...');
        
        // Force redirect with page reload
        window.location.replace('/auth.html');
        
    } catch (error) {
        console.error('Logout error:', error);
        
        // Force logout even on error
        currentUser = null;
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('manualLogout', 'true');
        
        window.location.replace('/auth.html');
    }
}

// Initialize page function
async function initializePage() {
    console.log(' INIT PAGE: Starting initialization...');
    console.log(' INIT PAGE: Document referrer:', document.referrer);
    console.log(' INIT PAGE: Session fromAuth flag:', sessionStorage.getItem('fromAuth'));
    console.log(' INIT PAGE: Manual logout flag:', localStorage.getItem('manualLogout'));

    // Add delay if coming from auth page to allow session establishment
    const urlParams = new URLSearchParams(window.location.search);
    const fromAuth = document.referrer.includes('auth.html') || sessionStorage.getItem('fromAuth') === 'true';
    
    if (fromAuth) {
        console.log(' INIT PAGE: Coming from auth page - clearing logout flags and waiting for session establishment...');
        sessionStorage.removeItem('fromAuth'); // Clear flag
        
        // CRITICAL FIX: Clear manual logout flag when successfully coming from auth page
        localStorage.removeItem('manualLogout');
        sessionStorage.removeItem('loggingOut');
        
        console.log(' INIT PAGE: Logout flags cleared, waiting 2 seconds for backend session to fully establish...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Reduced to 2 seconds since we now wait 1.5 in auth page
    } else {
        console.log(' INIT PAGE: Not from auth page, proceeding immediately');
    }

    // Check authentication with explicit retry logic
    console.log(' INIT PAGE: Starting authentication check...');
    let isAuthenticated = await checkAuth();
    console.log(' INIT PAGE: First auth check result:', isAuthenticated);
    
    // If auth fails but we just came from auth page, retry multiple times
    if (!isAuthenticated && fromAuth) {
        console.log(' INIT PAGE: Auth failed but coming from auth page - retrying up to 3 times...');
        for (let i = 1; i <= 3; i++) {
            console.log(` INIT PAGE: Retry ${i}/3 - waiting 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            isAuthenticated = await checkAuth();
            console.log(` INIT PAGE: Retry ${i}/3 result:`, isAuthenticated);
            if (isAuthenticated) break;
        }
    }
    
    if (!isAuthenticated) {
        console.log(' INIT PAGE: User not authenticated after retries - returning early');
        return; // Don't load app content if not authenticated
    }
    
    console.log(' INIT PAGE: Authentication successful, proceeding with app initialization...');

    // Initialize main app content after successful authentication
    if (typeof window.initializeAppContent === 'function') {
        window.initializeAppContent();
    } else {
        console.log('App content initializer not available, loading sessions directly...');
        // Fallback: load sessions data directly if main app function not available yet
        try {
            await loadSessions(); // Use loadSessions instead of loadSessionsFromAPI
            console.log('Page initialization complete');
        } catch (error) {
            console.log('Session loading failed, but page initialized');
        }
    }
}

// Initialize when page loads
window.addEventListener('load', function() {
    console.log(' MAIN APP: Page loaded event fired');
    console.log(' MAIN APP: Current URL:', window.location.href);
    console.log(' MAIN APP: Referrer:', document.referrer);
    console.log(' MAIN APP: fromAuth flag:', sessionStorage.getItem('fromAuth'));
    console.log(' MAIN APP: Manual logout flag:', localStorage.getItem('manualLogout'));
    console.log(' MAIN APP: Logging out flag:', sessionStorage.getItem('loggingOut'));
    console.log(' MAIN APP: Starting initializePage...');
    
    // Check if we're stuck in a redirect loop
    const urlParams = new URLSearchParams(window.location.search);
    const fromAuth = document.referrer.includes('auth.html') || sessionStorage.getItem('fromAuth') === 'true';
    console.log(' MAIN APP: Coming from auth?', fromAuth);
    
    initializePage();
});

// Trigger workflow automation for session
async function triggerWorkflow(sessionId) {
    try {
        // Get session data first
        const response = await fetch(`/api/sessions/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch session data');
        }

        const session = await response.json();

        // Show workflow options
        const workflowTypes = [
            { id: 'galleryDelivery', name: ' Gallery Ready Notification', desc: 'Notify client their photos are ready' },
            { id: 'contractReminder', name: ' Contract Reminder', desc: 'Remind client to sign contract' },
            { id: 'paymentFollowup', name: ' Payment Follow-up', desc: 'Send payment reminder' },
            { id: 'sessionPrep', name: ' Session Preparation', desc: 'Send session prep guide' },
            { id: 'feedbackRequest', name: ' Feedback Request', desc: 'Request client review' }
        ];

        let optionsHTML = workflowTypes.map(workflow =>
            `<div style="margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer;"
                  onclick="executeWorkflow('${sessionId}', '${workflow.id}')">
                <strong>${workflow.name}</strong><br>
                <small style="color: #666;">${workflow.desc}</small>
             </div>`
        ).join('');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>⚡ Workflow Automation</h3>
                    <button onclick="this.closest('.modal-overlay').remove()" class="close-button">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Select an automated workflow to trigger for <strong>${session.clientName}</strong>:</p>
                    ${optionsHTML}
                    <div style="margin-top: 20px; text-align: center;">
                        <button onclick="window.open('/advanced-workflow.html', '_blank')" class="btn btn-secondary">
                            ⚙️ Manage Automation Settings
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

    } catch (error) {
        console.error('Error triggering workflow:', error);
        showMessage('Failed to load workflow options: ' + error.message, 'error');
    }
}

// Execute specific workflow
async function executeWorkflow(sessionId, workflowType) {
    try {
        // Get session data for workflow
        const sessionResponse = await fetch(`/api/sessions/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const session = await sessionResponse.json();

        const clientData = {
            clientName: session.clientName,
            email: session.email,
            phoneNumber: session.phone_number || session.phoneNumber,
            sessionType: session.sessionType,
            sessionDate: new Date(session.dateTime).toLocaleDateString()
        };

        const response = await fetch('/api/trigger-workflow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                sessionId: sessionId,
                workflowType: workflowType,
                clientData: clientData
            })
        });

        if (!response.ok) {
            throw new Error('Failed to trigger workflow');
        }

        const result = await response.json();

        if (result.success) {
            // Show success with action options
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3> Workflow Ready</h3>
                        <button onclick="this.closest('.modal-overlay').remove()" class="close-button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Template Generated:</strong> ${result.template.subject}</p>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <strong>Message Preview:</strong><br>
                            ${result.template.message}
                        </div>
                        <div style="text-align: center; margin-top: 20px;">
                            <button onclick="window.open('${result.mailtoLink}')" class="btn btn-primary" style="margin: 5px;">
                                 Open Email Client
                            </button>
                            ${result.smsLink ? `
                                <button onclick="window.open('${result.smsLink}')" class="btn btn-secondary" style="margin: 5px;">
                                    📱 Send SMS
                                </button>
                            ` : ''}
                            <button onclick="copyToClipboard(\`${result.template.message}\`)" class="btn btn-secondary" style="margin: 5px;">
                                 Copy Message
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Close existing modal and show new one
            document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
            document.body.appendChild(modal);

            showMessage('Workflow executed successfully!', 'success');
        } else {
            throw new Error(result.error || 'Workflow execution failed');
        }

    } catch (error) {
        console.error('Error executing workflow:', error);
        showMessage('Failed to execute workflow: ' + error.message, 'error');
    }
}

// Copy text to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showMessage('Message copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showMessage('Failed to copy message', 'error');
    });
}

// RAW Backup Upload Dialog Function
function openRawUploadDialog(sessionId) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 2000;
        display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;">
            <h3 style="margin: 0 0 1rem 0; color: #333;">RAW Backup Upload</h3>
            <p style="margin-bottom: 1rem; color: #666;">Upload RAW files, high-resolution photos, and documents for cloud backup.</p>

            <input type="file" id="rawFileInput-${sessionId}" multiple accept="*/*"
                   style="margin-bottom: 1rem; padding: 0.5rem; width: 100%; border: 2px dashed #ddd; border-radius: 6px;">

            <div id="rawUploadProgress-${sessionId}" style="display: none; margin: 1rem 0;">
                <div style="background: #f0f0f0; border-radius: 10px; overflow: hidden; height: 20px;">
                    <div id="rawUploadProgressBar-${sessionId}" style="background: #17a2b8; height: 100%; width: 0%; transition: width 0.3s;"></div>
                </div>
                <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #666;">Uploading files...</p>
            </div>

            <div style="display: flex; justify-content: space-between; gap: 1rem;">
                <button onclick="this.closest('div').remove()" style="flex: 1; padding: 0.75rem; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Cancel
                </button>
                <button onclick="uploadRawFiles('${sessionId}')" style="flex: 1; padding: 0.75rem; background: #17a2b8; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Upload RAW Files
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// RAW Files Upload Function (from script.js - RENAMED to avoid conflicts)
async function uploadRawFilesOld(sessionId) {
    console.log('Script.js uploadRawFilesOld called - this is for older modal system');
    // This function is for older modal system - not used for current RAW backup
    return;
}

// Toast notification function
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10001;
        padding: 1rem 1.5rem; border-radius: 6px; color: white; font-weight: 500;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// File type icon helper
function getFileTypeIcon(type) {
    const icons = {
        raw: '📷',
        gallery: '🖼️',
        video: '🎬',
        document: '📄',
        other: '📁'
    };
    return icons[type] || icons.other;
}

// Loading utility function
function showLoading(show) {
    const existingLoader = document.getElementById('globalLoader');

    if (show) {
        if (!existingLoader) {
            const loader = document.createElement('div');
            loader.id = 'globalLoader';
            loader.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
            `;
            loader.innerHTML = `
                <div style="background: white; padding: 2rem; border-radius: 8px; text-align: center;">
                    <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #17a2b8; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                    <div>Loading...</div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
            document.body.appendChild(loader);
        }
    } else {
        if (existingLoader) {
            existingLoader.remove();
        }
    }
}

// RAW Gallery Function
async function openRawFolder(sessionId, clientName) {
    try {
        showLoading(true);

        const response = await fetch(`/api/r2/session/${sessionId}/files`);
        const data = await response.json();

        if (!data.success) {
            throw new Error('Failed to load RAW files');
        }

        showLoading(false);
        showRawGalleryModal(sessionId, clientName, data.filesByType);

    } catch (error) {
        showLoading(false);
        console.error('RAW gallery error:', error);
        alert(`Failed to load RAW gallery: ${error.message}`);
    }
}

function showRawGalleryModal(sessionId, clientName, filesByType) {
    const modal = document.createElement('div');
    modal.className = 'modal-parent';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 2000;
        display: flex; align-items: center; justify-content: center;
        overflow-y: auto;
    `;

    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    let totalFiles = 0;
    Object.values(filesByType).forEach(files => totalFiles += files.length);

    let fileGridHtml = '';
    Object.entries(filesByType).forEach(([type, files]) => {
        if (files.length > 0) {
            fileGridHtml += `<h4 style="margin: 1rem 0 0.5rem 0; color: #333; text-transform: capitalize;">${getFileTypeIcon(type)} ${type} Files (${files.length})</h4>`;

            files.forEach(file => {
                const uploadDate = new Date(file.uploadedAt).toLocaleDateString();
                const fileSizeMB = (file.fileSizeBytes / (1024 * 1024)).toFixed(1);
                const isImage = file.contentType && file.contentType.startsWith('image/');

                // Generate preview URL for images
                const previewUrl = isImage ? `/api/r2/preview/${sessionId}/${encodeURIComponent(file.filename)}` : null;

                fileGridHtml += `
                    <div style="margin-bottom: 1rem; padding: 1rem; border-radius: 8px; background: #f8f9fa; border: 1px solid #dee2e6;">
                        <div style="display: flex; gap: 1rem; align-items: flex-start;">
                            ${isImage ? `
                                <div style="flex-shrink: 0; position: relative;">
                                    <img src="${previewUrl}" alt="${file.filename}"
                                         style="width: 150px; height: 100px; object-fit: cover; border-radius: 8px; border: 2px solid #dee2e6; cursor: pointer;"
                                         onclick="viewFullImage('${previewUrl}', '${file.filename}')"
                                         onerror="console.log('Image failed to load:', '${previewUrl}'); this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                    <div style="width: 150px; height: 100px; background: #e9ecef; border-radius: 8px; display: none; align-items: center; justify-content: center; flex-direction: column; font-size: 12px; color: #6c757d; text-align: center;">
                                        📷<br>TIFF Preview
                                    </div>
                                </div>
                            ` : `
                                <div style="flex-shrink: 0; width: 150px; height: 100px; background: #e9ecef; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 32px;">
                                    ${getFileTypeIcon(type)}
                                </div>
                            `}
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: bold; margin-bottom: 0.5rem; word-break: break-word;">${file.filename}</div>
                                <div style="font-size: 0.9rem; color: #6c757d; line-height: 1.4;">
                                    📏 ${fileSizeMB} MB |  ${uploadDate}<br>
                                     R2 Cloud Backup<br>
                                    🔗 ${(file.r2Key || '').substring(0, 45)}...
                                </div>
                                <div style="margin-top: 0.75rem;">
                                    <button onclick="downloadRawFile('${sessionId}', '${file.filename}')"
                                            style="padding: 0.5rem 1rem; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; margin-right: 0.5rem;">
                                        📥 Download
                                    </button>
                                    ${isImage ? `
                                        <button onclick="viewFullImage('${previewUrl}', '${file.filename}')"
                                                style="padding: 0.5rem 1rem; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; margin-right: 0.5rem;">
                                             View Full
                                        </button>
                                    ` : ''}
                                    <button onclick="deleteRawFile('${sessionId}', '${file.filename}', '${clientName}')"
                                            style="padding: 0.5rem 1rem; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
                                        🗑️ Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
    });

    modal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 90vw; max-height: 90vh; width: 800px; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 2px solid #dee2e6; padding-bottom: 1rem;">
                <h2 style="margin: 0; color: #333;">🖼️ ${clientName} - RAW Files</h2>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="downloadAllRawFiles('${sessionId}', '${clientName}')" style="background: #28a745; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer; font-size: 1rem;"> Download All</button>
                    <button onclick="deleteAllRawFiles('${sessionId}', '${clientName}')" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer; font-size: 1rem;">🗑️ Delete All</button>
                    <button onclick="this.closest('.modal-parent').remove()" style="background: #6c757d; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer; font-size: 1rem;">✕ Close</button>
                </div>
            </div>
            <div style="margin-bottom: 1rem; padding: 1rem; background: #e9ecef; border-radius: 6px;">
                <strong>RAW Backup Summary:</strong> ${totalFiles} files stored in R2 cloud backup
            </div>
            <div style="max-height: 60vh; overflow-y: auto;">
                ${fileGridHtml || '<p style="text-align: center; color: #6c757d; padding: 2rem;">No RAW files found. Upload some files to get started.</p>'}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Download RAW File Function
async function downloadRawFile(sessionId, filename) {
    try {
        showLoading(true);

        // Get user ID with fallbacks
        const userId = currentUser?.uid || currentUser?.original_uid || 'BFZI4tzu4rdsiZZSK63cqZ5yohw2';

        // Use the correct download endpoint format
        const response = await fetch(`/api/r2/download/${userId}/${sessionId}/${encodeURIComponent(filename)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/octet-stream',
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showLoading(false);
        showToast(`Downloaded: ${filename}`, 'success');

    } catch (error) {
        showLoading(false);
        console.error('Download error:', error);
        showToast(`Download failed: ${error.message}`, 'error');
    }
}

function getFileTypeIcon(fileType) {
    const icons = {
        'images': '🖼️',
        'raw': '',
        'videos': '🎬',
        'documents': '📄',
        'audio': '🎵',
        'other': '📁'
    };
    return icons[fileType] || icons.other;
}

// Delete individual RAW file
async function deleteRawFile(sessionId, filename, clientName) {
    if (!confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
        return;
    }

    try {
        showLoading(true);

        // Get user ID with fallbacks
        const userId = currentUser?.uid || currentUser?.original_uid || 'BFZI4tzu4rdsiZZSK63cqZ5yohw2';

        const response = await fetch(`/api/r2/delete/${userId}/${sessionId}/${encodeURIComponent(filename)}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        showLoading(false);
        showToast(`Deleted: ${filename}`, 'success');

        // Close current modal and reopen with updated data
        document.querySelector('.modal-parent')?.remove();
        setTimeout(() => openRawFolder(sessionId, clientName), 100);

        // Update storage usage
        await updateStorageUsage();

    } catch (error) {
        showLoading(false);
        console.error('Delete error:', error);
        showToast(`Delete failed: ${error.message}`, 'error');
    }
}

// Delete all RAW files for a session
async function deleteAllRawFiles(sessionId, clientName) {
    if (!confirm(`Are you sure you want to delete ALL RAW files for ${clientName}? This action cannot be undone.`)) {
        return;
    }

    try {
        showLoading(true);

        // Get user ID with fallbacks
        const userId = currentUser?.uid || currentUser?.original_uid || 'BFZI4tzu4rdsiZZSK63cqZ5yohw2';

        const response = await fetch(`/api/r2/delete-all/${userId}/${sessionId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        showLoading(false);
        showToast(`Deleted ${result.deletedCount || 'all'} RAW files`, 'success');

        // Close current modal and reopen with updated data
        document.querySelector('.modal-parent')?.remove();
        setTimeout(() => openRawFolder(sessionId, clientName), 100);

        // Update storage usage
        await updateStorageUsage();

    } catch (error) {
        showLoading(false);
        console.error('Delete all error:', error);
        showToast(`Delete all failed: ${error.message}`, 'error');
    }
}

// View full image in modal
function viewFullImage(imageUrl, filename) {
    const modal = document.createElement('div');
    modal.className = 'modal-parent-fullscreen';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
    `;

    modal.innerHTML = `
        <div style="position: relative; max-width: 95vw; max-height: 95vh;">
            <img src="${imageUrl}" alt="${filename}"
                 style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;">
            <div style="position: absolute; top: -40px; left: 0; color: white; font-size: 16px; font-weight: bold;">
                ${filename}
            </div>
            <button onclick="this.closest('.modal-parent-fullscreen').remove()"
                    style="position: absolute; top: -40px; right: 0; background: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer;">
                ✕ Close
            </button>
        </div>
    `;

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    document.body.appendChild(modal);
}

// Show download progress modal
function showDownloadProgress(clientName) {
    const modal = document.createElement('div');
    modal.className = 'modal-parent';
    modal.id = 'downloadProgressModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    modal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; width: 400px; text-align: center;">
            <h3 style="margin: 0 0 1rem 0; color: #333;"> Creating ZIP File</h3>
            <p style="margin: 0 0 1rem 0; color: #666;">${clientName} - RAW Files</p>
            <div style="background: #f0f0f0; border-radius: 10px; height: 20px; margin: 1rem 0; overflow: hidden;">
                <div id="progressBar" style="background: linear-gradient(45deg, #28a745, #20c997); height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 10px;"></div>
            </div>
            <p id="progressText" style="margin: 0; color: #666; font-size: 14px;">Preparing download...</p>
            <div style="margin-top: 1rem;">
                <button onclick="cancelDownload()" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer;">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    return modal;
}

// Update progress bar
function updateProgress(percent, text) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    if (progressBar) progressBar.style.width = percent + '%';
    if (progressText) progressText.textContent = text;
}

// Cancel download
function cancelDownload() {
    if (window.downloadController) {
        window.downloadController.abort();
    }
    const modal = document.getElementById('downloadProgressModal');
    if (modal) modal.remove();
}

// Download all RAW files as ZIP with progress tracking
async function downloadAllRawFiles(sessionId, clientName) {
    let progressModal = null;

    try {
        console.log(" Starting download for session:", sessionId, "client:", clientName);

        // Show progress modal immediately
        progressModal = showDownloadProgress(clientName);
        console.log(" Progress modal created:", progressModal);

        // Force immediate display
        if (progressModal) {
            progressModal.style.display = 'flex';
            console.log(" Progress modal displayed");
        }

        updateProgress(10, "Connecting to server...");
        console.log(" Initial progress set");

        // Get user ID with fallbacks
        const userId = currentUser?.uid || currentUser?.original_uid || "BFZI4tzu4rdsiZZSK63cqZ5yohw2";

        // Extended timeout for multi-GB downloads (30 minutes)
        window.downloadController = new AbortController();
        const timeoutId = setTimeout(() => window.downloadController.abort(), 1800000); // 30 minutes

        updateProgress(20, "Requesting multi-GB ZIP creation from R2 storage...");

        // Set up progress tracking simulation for ZIP creation phase
        let serverProgress = 20;
        const progressInterval = setInterval(() => {
            if (serverProgress < 80) {
                serverProgress += 2;
                const fileNumber = Math.floor((serverProgress-20)/15) + 1;
                updateProgress(serverProgress, `Creating ZIP... Processing file ${Math.min(fileNumber, 4)}/4 (${((serverProgress-20)/60*100).toFixed(0)}%)`);
            }
        }, 1000);

        // Request ZIP download from server
        const response = await fetch(`/api/r2/download-all/${userId}/${sessionId}`, {
            method: "GET",
            headers: {
                "Accept": "application/zip",
            },
            signal: window.downloadController.signal
        });

        clearInterval(progressInterval);

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        updateProgress(50, "Downloading ZIP file...");

        // Get content length for progress tracking
        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;

        let loaded = 0;
        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            chunks.push(value);
            loaded += value.length;

            if (total > 0) {
                const percent = Math.min(50 + (loaded / total) * 40, 90);
                const loadedGB = (loaded / (1024*1024*1024)).toFixed(2);
                const totalGB = (total / (1024*1024*1024)).toFixed(2);
                updateProgress(percent, `Downloading: ${loadedGB} GB / ${totalGB} GB`);
            } else {
                const loadedMB = (loaded / (1024*1024)).toFixed(1);
                const loadedGB = (loaded / (1024*1024*1024)).toFixed(2);
                if (loaded > 1024*1024*1024) {
                    updateProgress(70, `Downloaded: ${loadedGB} GB...`);
                } else {
                    updateProgress(70, `Downloaded: ${loadedMB} MB...`);
                }
            }
        }

        updateProgress(95, "Preparing download...");

        // Combine chunks into blob
        const blob = new Blob(chunks);

        // Check if we actually got a ZIP file
        if (blob.size === 0) {
            throw new Error("Received empty ZIP file");
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${clientName}_RAW_Files_${new Date().toISOString().split("T")[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        updateProgress(100, `Download complete: ${(blob.size / (1024*1024)).toFixed(1)} MB`);

        // Close modal after success
        setTimeout(() => {
            if (progressModal) progressModal.remove();
            showToast(`ZIP downloaded successfully: ${(blob.size / (1024*1024)).toFixed(1)} MB`, "success");
        }, 1500);

    } catch (error) {
        console.error(" ZIP download error:", error);

        if (progressModal) {
            progressModal.remove();
            console.log(" Progress modal removed due to error");
        }

        if (error.name === 'AbortError') {
            showToast("Download cancelled or timed out", "error");
        } else {
            showToast(`ZIP download failed: ${error.message}`, "error");
            console.error(" Full error details:", error);
        }
    } finally {
        window.downloadController = null;
        console.log(" Download process finished");
    }
}

// Website Builder Functions
        window.updatePreview = function() {
            const theme = document.getElementById('websiteTheme')?.value || 'legacy';
            const preview = document.getElementById('websitePreview');

            if (!preview) return;

            // Update preview based on selected theme
            preview.className = `website-preview theme-${theme}`;
            preview.innerHTML = `
                <div class="preview-header">My Photography Studio</div>
                <div class="preview-hero">Welcome to my world of photography</div>
                <div class="preview-content">
                    <div class="preview-section">About Me</div>
                    <div class="preview-section">Portfolio</div>
                    <div class="preview-section">Contact</div>
                </div>
            `;
        };

        window.handleHeroUpload = function() {
            const fileInput = document.getElementById('heroImage');
            const file = fileInput?.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const previewContainer = document.getElementById('heroPreview');
                    if (previewContainer) {
                        previewContainer.innerHTML = `
                            <img src="${e.target.result}" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px;">
                        `;
                    }
                };
                reader.readAsDataURL(file);
            }
        };

        window.previewWebsite = function() {
            showMessage('Opening website preview...', 'info');
            // Open preview in new tab
            window.open('/preview', '_blank');
        };

        window.publishWebsite = function() {
            showMessage('Publishing website...', 'info');
            // Implement website publishing
        };

        // Booking Agreement Functions
        window.createBookingAgreement = async function() {
            const sessionSelect = document.getElementById('contractSessionSelect');
            const templateSelect = document.getElementById('contractTemplate');

            if (!sessionSelect?.value) {
                showMessage('Please select a session', 'error');
                return;
            }

            try {
                const response = await fetch('/api/booking-agreements', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId: sessionSelect.value,
                        templateType: templateSelect?.value || 'standard'
                    }),
                    credentials: 'include'
                });

                if (response.ok) {
                    const result = await response.json();
                    showMessage('Booking agreement created successfully!', 'success');
                    loadContracts();
                } else {
                    const error = await response.json();
                    showMessage(error.error || 'Failed to create booking agreement', 'error');
                }
            } catch (error) {
                console.error('Error creating booking agreement:', error);
                showMessage('Error creating booking agreement', 'error');
            }
        };

        window.loadContracts = async function() {
            try {
                const response = await fetch('/api/booking-agreements', {
                    credentials: 'include'
                });

                if (response.ok) {
                    const contracts = await response.json();
                    renderContracts(contracts);
                }
            } catch (error) {
                console.error('Error loading contracts:', error);
            }
        };

        function renderContracts(contracts) {
            const container = document.getElementById('contractsContainer');
            if (!container) return;

            if (contracts.length === 0) {
                container.innerHTML = '<p>No contracts created yet.</p>';
                return;
            }

            container.innerHTML = contracts.map(contract => `
                <div class="contract-item" style="background: var(--bg-card); padding: 20px; margin: 10px 0; border-radius: 12px; border: 1px solid var(--accent-beige);">
                    <h4>${contract.client_name}</h4>
                    <p><strong>Session:</strong> ${contract.session_type}</p>
                    <p><strong>Status:</strong> ${contract.status}</p>
                    <p><strong>Created:</strong> ${new Date(contract.created_at).toLocaleDateString()}</p>
                    <div class="contract-actions" style="margin-top: 15px;">
                        <button class="btn btn-primary" onclick="viewContract('${contract.id}')">View</button>
                        <button class="btn btn-secondary" onclick="sendContract('${contract.id}')">Send</button>
                    </div>
                </div>
            `).join('');
        }

        window.viewContract = function(contractId) {
            showMessage('Opening contract viewer...', 'info');
            // Implement contract viewing
        };

        window.sendContract = function(contractId) {
            showMessage('Sending contract to client...', 'info');
            // Implement contract sending
        };

window.switchTab = function(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });

            // Remove active class from all nav tabs
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });

            // Show selected tab
            const selectedTab = document.getElementById(tabName + 'Tab');
            if (selectedTab) {
                selectedTab.classList.add('active');
            }

            // Add active class to corresponding nav tab
            const navTab = document.querySelector(`a[onclick*="${tabName}"]`);
            if (navTab) {
                navTab.classList.add('active');
            }

            // Load appropriate content
            switch(tabName) {
                case 'clients':
                    // Already loaded on page load
                    break;
                case 'goldenHour':
                    // Initialize golden hour calculator if needed
                    break;
                case 'businessManagement':
                    loadBusinessManagement();
                    break;
                case 'websiteBuilder':
                    // Initialize website builder
                    setTimeout(() => updatePreview(), 100);
                    break;
                case 'contracts':
                    // Load sessions for contract creation
                    populateContractSessions();
                    loadContracts();
                    break;
                default:
                    break;
            }
        };

        // Load business management functionality
        function loadBusinessManagement() {
            console.log('Loading business management section');
            // Initialize any business management specific functionality
            // The UI is already loaded in index.html, just ensure everything is ready
        }

        // Populate sessions dropdown for contract creation
        function populateContractSessions() {
            const select = document.getElementById('contractSessionSelect');
            if (!select) return;

            select.innerHTML = '<option value="">Choose a session...</option>';

            sessions.forEach(session => {
                const option = document.createElement('option');
                option.value = session.id;
                option.textContent = `${session.clientName} - ${session.sessionType} (${new Date(session.dateTime).toLocaleDateString()})`;
                select.appendChild(option);
            });
        }

        // Toggle workflow status for session checkboxes
        window.toggleWorkflowStatus = function(sessionId, field, isChecked) {
            console.log('Toggling workflow status:', sessionId, field, isChecked);
            
            const session = sessions.find(s => s.id === sessionId);
            if (!session) {
                console.error('Session not found:', sessionId);
                return;
            }

            // Update local session data
            session[field] = isChecked;

            // Send update to server
            updateSession(sessionId, { [field]: isChecked })
                .then(() => {
                    console.log('Workflow status updated successfully');
                    // Update any related UI elements
                    if (field === 'contractSigned') {
                        // Update signed contract button status
                        if (typeof window.updateAgreementStatus === 'function') {
                            window.updateAgreementStatus(sessionId, isChecked ? 'signed' : 'none');
                        }
                    }
                })
                .catch(error => {
                    console.error('Failed to update workflow status:', error);
                    // Revert the checkbox
                    const checkbox = document.getElementById(`${field}_${sessionId}`);
                    if (checkbox) {
                        checkbox.checked = !isChecked;
                    }
                    session[field] = !isChecked;
                    showMessage('Failed to update status', 'error');
                });
        };

// View Session Contracts with PDF Download
async function viewSessionContractsPDF(sessionId, clientName) {
    try {
        const token = await getAuthToken();
        if (!token) {
            showMessage('Please log in to view contracts', 'error');
            return;
        }

        // Fetch contracts for this session
        const response = await fetch(`/api/booking/agreements/session/${sessionId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch contracts');
        }

        const contracts = await response.json();
        
        // For each contract, fetch signature data if it's signed
        for (let contract of contracts) {
            if (contract.status === 'signed') {
                try {
                    const sigResponse = await fetch(`/api/booking/agreements/${contract.id}/signatures`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (sigResponse.ok) {
                        const signatures = await sigResponse.json();
                        if (signatures && signatures.length > 0) {
                            contract.signature_info = signatures[0]; // Get the first signature
                        }
                    }
                } catch (error) {
                    console.warn('Could not fetch signature for contract:', contract.id);
                }
            }
        }
        
        if (!contracts || contracts.length === 0) {
            showMessage('No contracts found for this session', 'info');
            return;
        }

        // If there's only one contract, download it directly
        if (contracts.length === 1) {
            downloadContractPDF(contracts[0], clientName);
        } else {
            // Show selection dialog for multiple contracts
            showContractSelectionDialog(contracts, clientName);
        }

    } catch (error) {
        console.error('Error fetching contracts:', error);
        showMessage('Failed to load contracts', 'error');
    }
}

// Download contract as PDF
function downloadContractPDF(contract, clientName) {
    const content = contract.content || contract.template_content || 'No content available';
    
    // Create a clean filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `Contract_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}_${date}.pdf`;
    
    // Create a print-ready window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Booking Agreement - ${clientName}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    max-width: 800px; 
                    margin: 20px auto; 
                    padding: 20px;
                    line-height: 1.6;
                    color: #333;
                }
                h1, h2, h3 { 
                    color: #2c3e50; 
                    margin-top: 30px;
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 10px;
                }
                .contract-header {
                    text-align: center;
                    margin-bottom: 40px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                }
                .signature-section { 
                    margin-top: 50px; 
                    padding: 20px; 
                    border: 1px solid #ddd;
                    background: #f9f9f9;
                }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
                .download-btn {
                    background: #007bff;
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    margin: 10px;
                }
            </style>
        </head>
        <body>
            <div class="contract-header">
                <h1>Photography Session Agreement</h1>
                <p><strong>Client:</strong> ${clientName}</p>
                <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="no-print" style="text-align: center; margin-bottom: 20px;">
                <button class="download-btn" onclick="window.print()">📄 Save as PDF</button>
                <button class="download-btn" onclick="window.close()">✖ Close</button>
            </div>
            
            <div class="contract-content">
                ${content}
            </div>
            
            ${contract.status === 'signed' && contract.signature_info ? `
                <div class="signature-section">
                    <h3>Digital Signature</h3>
                    <p><strong>Status:</strong> Electronically Signed</p>
                    <p><strong>Signed by:</strong> ${contract.signature_info.signer_name}</p>
                    <p><strong>Email:</strong> ${contract.signature_info.signer_email}</p>
                    <p><strong>Date & Time:</strong> ${new Date(contract.signature_info.signed_at).toLocaleString()}</p>
                    ${contract.signature_info.signature_data ? `
                        <div style="margin-top: 20px;">
                            <p><strong>Client Signature:</strong></p>
                            <div style="border: 2px solid #333; padding: 10px; background: white; display: inline-block; margin-top: 10px;">
                                <img src="${contract.signature_info.signature_data}" 
                                     alt="Client Signature" 
                                     style="max-width: 300px; max-height: 100px; display: block;" />
                            </div>
                        </div>
                    ` : ''}
                    <p style="font-size: 12px; color: #666; margin-top: 15px;">
                        <em>This signature was captured electronically and is legally binding.</em>
                    </p>
                </div>
            ` : contract.status === 'signed' ? `
                <div class="signature-section">
                    <h3>Signature Information</h3>
                    <p><strong>Status:</strong> Signed</p>
                    <p><strong>Signed Date:</strong> ${new Date(contract.signed_at).toLocaleDateString()}</p>
                </div>
            ` : ''}
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

// Show contract selection dialog for multiple contracts
function showContractSelectionDialog(contracts, clientName) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    content.innerHTML = `
        <h3>Select Contract to Download</h3>
        <p>Multiple contracts found for ${clientName}:</p>
        <div id="contractList"></div>
        <div style="text-align: center; margin-top: 20px;">
            <button onclick="this.closest('.modal').remove()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px;">Cancel</button>
        </div>
    `;
    
    const contractList = content.querySelector('#contractList');
    
    contracts.forEach((contract, index) => {
        const contractDiv = document.createElement('div');
        contractDiv.style.cssText = `
            padding: 15px;
            border: 1px solid #ddd;
            margin: 10px 0;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        
        contractDiv.innerHTML = `
            <strong>Contract ${index + 1}</strong><br>
            <small>Status: ${contract.status || 'Draft'}</small><br>
            <small>Created: ${new Date(contract.created_at).toLocaleDateString()}</small>
        `;
        
        contractDiv.onclick = () => {
            downloadContractPDF(contract, clientName);
            modal.remove();
        };
        
        contractDiv.onmouseover = () => contractDiv.style.backgroundColor = '#f8f9fa';
        contractDiv.onmouseout = () => contractDiv.style.backgroundColor = 'white';
        
        contractList.appendChild(contractDiv);
    });
    
    modal.appendChild(content);
    modal.className = 'modal';
    document.body.appendChild(modal);
}

// Make function available globally
window.viewSessionContractsPDF = viewSessionContractsPDF;

// Open Download Controls Interface
async function openDownloadControls(sessionId) {
    try {
        console.log('📥 Opening download controls for session:', sessionId);
        
        // Get current download policy
        const response = await fetch(`/api/downloads/sessions/${sessionId}/policy`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load download policy');
        }
        
        const policy = await response.json();
        console.log('Current policy:', policy);
        
        // Create modal
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.zIndex = '1050';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = 'white';
        modalContent.style.padding = '30px';
        modalContent.style.borderRadius = '12px';
        modalContent.style.maxWidth = '600px';
        modalContent.style.width = '90%';
        modalContent.style.maxHeight = '80vh';
        modalContent.style.overflowY = 'auto';
        modalContent.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
        
        modalContent.innerHTML = `
            <h2 style="margin-bottom: 20px; color: #333;">📥 Download Controls</h2>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Download Enabled:</label>
                <select id="downloadEnabled" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="true" ${policy.downloadEnabled ? 'selected' : ''}>Yes - Allow downloads</option>
                    <option value="false" ${!policy.downloadEnabled ? 'selected' : ''}>No - Disable downloads</option>
                </select>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Pricing Model:</label>
                <select id="pricingModel" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="free" ${policy.pricingModel === 'free' ? 'selected' : ''}>Free (with optional limits)</option>
                    <option value="paid" ${policy.pricingModel === 'paid' ? 'selected' : ''}>Paid (charge per download)</option>
                    <option value="freemium" ${policy.pricingModel === 'freemium' ? 'selected' : ''}>Freemium (limited free, then paid)</option>
                </select>
            </div>
            
            <div id="freeOptions" style="margin-bottom: 20px; ${policy.pricingModel === 'free' ? '' : 'display: none;'}">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Download Limit (0 = unlimited):</label>
                <input type="number" id="downloadMax" value="${policy.downloadMax || 0}" min="0" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div id="freemiumOptions" style="margin-bottom: 20px; ${policy.pricingModel === 'freemium' ? '' : 'display: none;'}">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Free Downloads Allowed:</label>
                <input type="number" id="freeDownloads" value="${policy.freeDownloads || 0}" min="0" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div id="paidOptions" style="margin-bottom: 20px; ${policy.pricingModel === 'paid' || policy.pricingModel === 'freemium' ? '' : 'display: none;'}">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Price Per Download ($):</label>
                <input type="number" id="pricePerDownload" value="${policy.pricePerDownload || 0}" min="0" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <h3 style="margin: 25px 0 15px 0; color: #333;">🎨 Watermark Settings</h3>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Watermark Enabled:</label>
                <select id="watermarkEnabled" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="true" ${policy.watermarkEnabled ? 'selected' : ''}>Yes - Apply watermark</option>
                    <option value="false" ${!policy.watermarkEnabled ? 'selected' : ''}>No - No watermark</option>
                </select>
            </div>
            
            <div id="watermarkOptions" style="${policy.watermarkEnabled ? '' : 'display: none;'}">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Watermark Type:</label>
                    <select id="watermarkType" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="text" ${policy.watermarkType === 'text' ? 'selected' : ''}>Text</option>
                        <option value="logo" ${policy.watermarkType === 'logo' ? 'selected' : ''}>Logo</option>
                    </select>
                </div>
                
                <div id="textWatermark" style="margin-bottom: 20px; ${policy.watermarkType === 'text' ? '' : 'display: none;'}">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Watermark Text:</label>
                    <input type="text" id="watermarkText" value="${policy.watermarkText || '© Photography'}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div id="logoWatermark" style="margin-bottom: 20px; ${policy.watermarkType === 'logo' ? '' : 'display: none;'}">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Upload Logo:</label>
                    <input type="file" id="watermarkLogo" accept=".png,.jpg,.jpeg" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    ${policy.watermarkLogoUrl ? `<p style="color: #28a745; margin-top: 5px;">✅ Logo uploaded</p>` : ''}
                </div>
                
                <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Position:</label>
                        <select id="watermarkPosition" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="top-left" ${policy.watermarkPosition === 'top-left' ? 'selected' : ''}>Top Left</option>
                            <option value="top-right" ${policy.watermarkPosition === 'top-right' ? 'selected' : ''}>Top Right</option>
                            <option value="bottom-left" ${policy.watermarkPosition === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
                            <option value="bottom-right" ${policy.watermarkPosition === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
                            <option value="center" ${policy.watermarkPosition === 'center' ? 'selected' : ''}>Center</option>
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Opacity (%):</label>
                        <input type="number" id="watermarkOpacity" value="${policy.watermarkOpacity || 60}" min="10" max="100" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 15px; margin-top: 30px;">
                <button id="savePolicy" style="flex: 1; padding: 12px; background: #28a745; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">💾 Save Settings</button>
                <button id="generateToken" style="flex: 1; padding: 12px; background: #17a2b8; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">🔗 Generate Access Token</button>
                <button id="closeModal" style="padding: 12px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Handle dropdown changes
        document.getElementById('pricingModel').onchange = function() {
            const value = this.value;
            document.getElementById('freeOptions').style.display = value === 'free' ? 'block' : 'none';
            document.getElementById('freemiumOptions').style.display = value === 'freemium' ? 'block' : 'none';
            document.getElementById('paidOptions').style.display = (value === 'paid' || value === 'freemium') ? 'block' : 'none';
        };
        
        document.getElementById('watermarkEnabled').onchange = function() {
            document.getElementById('watermarkOptions').style.display = this.value === 'true' ? 'block' : 'none';
        };
        
        document.getElementById('watermarkType').onchange = function() {
            const value = this.value;
            document.getElementById('textWatermark').style.display = value === 'text' ? 'block' : 'none';
            document.getElementById('logoWatermark').style.display = value === 'logo' ? 'block' : 'none';
        };
        
        // Handle save
        document.getElementById('savePolicy').onclick = async function() {
            try {
                const formData = new FormData();
                formData.append('downloadEnabled', document.getElementById('downloadEnabled').value);
                formData.append('pricingModel', document.getElementById('pricingModel').value);
                formData.append('downloadMax', document.getElementById('downloadMax').value);
                formData.append('freeDownloads', document.getElementById('freeDownloads').value);
                formData.append('pricePerDownload', document.getElementById('pricePerDownload').value);
                formData.append('watermarkEnabled', document.getElementById('watermarkEnabled').value);
                formData.append('watermarkType', document.getElementById('watermarkType').value);
                formData.append('watermarkText', document.getElementById('watermarkText').value);
                formData.append('watermarkPosition', document.getElementById('watermarkPosition').value);
                formData.append('watermarkOpacity', document.getElementById('watermarkOpacity').value);
                
                const logoFile = document.getElementById('watermarkLogo').files[0];
                if (logoFile) {
                    formData.append('logo', logoFile);
                }
                
                const saveResponse = await fetch(`/api/downloads/sessions/${sessionId}/policy`, {
                    method: 'PUT',
                    credentials: 'include',
                    body: formData
                });
                
                if (!saveResponse.ok) {
                    throw new Error('Failed to save policy');
                }
                
                showMessage('Download policy saved successfully!', 'success');
                document.body.removeChild(modal);
                
            } catch (error) {
                console.error('Error saving policy:', error);
                showMessage('Failed to save policy: ' + error.message, 'error');
            }
        };
        
        // Handle token generation
        document.getElementById('generateToken').onclick = async function() {
            try {
                const tokenResponse = await fetch(`/api/downloads/sessions/${sessionId}/generate-token`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientEmail: 'client@example.com', // Can be customized
                        expiresInHours: 4320 // 180 days = 4320 hours
                    })
                });
                
                if (!tokenResponse.ok) {
                    throw new Error('Failed to generate token');
                }
                
                const tokenData = await tokenResponse.json();
                const galleryUrl = `${window.location.origin}/gallery/${sessionId}?token=${tokenData.token}`;
                
                // Copy to clipboard
                navigator.clipboard.writeText(galleryUrl);
                
                showMessage('Gallery URL copied to clipboard!', 'success');
                
            } catch (error) {
                console.error('Error generating token:', error);
                showMessage('Failed to generate access token: ' + error.message, 'error');
            }
        };
        
        // Handle close
        document.getElementById('closeModal').onclick = function() {
            document.body.removeChild(modal);
        };
        
        // Close on background click
        modal.onclick = function(e) {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };
        
    } catch (error) {
        console.error('Error opening download controls:', error);
        showMessage('Failed to load download controls: ' + error.message, 'error');
    }
}