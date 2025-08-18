// Photography Session Scheduler
// Session management system with cloud database

// Global variables
// sessions variable is declared in index.html - using global scope
let sessionIdCounter = 1;
let currentUser = null;

// Firebase Authentication functions
async function checkAuth() {
    // Only skip auth check if actively logging out (not for manual logout flag)
    if (sessionStorage.getItem('loggingOut') === 'true') {
        console.log('Skipping auth check - logout in progress');
        return false;
    }
    
    // Clear any stale manual logout flag at start of auth check
    if (localStorage.getItem('manualLogout') === 'true') {
        console.log('Clearing stale manual logout flag during auth check');
        localStorage.removeItem('manualLogout');
    }

    // Check if we just came from auth page
    const fromAuth = document.referrer.includes('auth.html') || sessionStorage.getItem('fromAuth') === 'true';
    
    // Check if we're on iOS and use native auth handler
    if (window.nativeAuth && (window.nativeAuth.isIOS || window.nativeAuth.isCapacitor)) {
        console.log('Using native iOS authentication handler...');
        try {
            await window.nativeAuth.initialize();
            if (window.nativeAuth.isAuthenticated()) {
                currentUser = window.nativeAuth.getCurrentUser();
                updateUserUI();
                console.log('iOS user authenticated successfully:', currentUser.email);
                return true;
            } else {
                console.log('No iOS authentication found');
                return false;
            }
        } catch (error) {
            console.error('Native auth check failed:', error);
            return false;
        }
    }
    
    // Regular web authentication flow
    try {
        console.log(' AUTH CHECK: Checking authentication with backend...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('/api/auth/user', {
            credentials: 'include',
            headers: {
                'Cache-Control': 'no-cache'
            },
            signal: controller.signal
        }).catch(error => {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.error('Auth check timed out');
                throw new Error('Authentication check timed out');
            }
            throw error;
        });
        
        clearTimeout(timeoutId);
        console.log(' AUTH CHECK: Auth response status:', response.status, 'ok:', response.ok);
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.user) {
                currentUser = data.user;
                updateUserUI();
                console.log('User authenticated successfully:', currentUser.email);
                return true;
            } else {
                console.log('Auth check failed - no user data in response');
                return false;
            }
        } else {
            console.log('Auth check failed - response not ok:', response.status);
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        
        // Only redirect on network errors if not coming from auth page
        if (!fromAuth && !sessionStorage.getItem('fromAuth') && !document.referrer.includes('auth.html')) {
            // Only redirect on certain error types
            if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
                console.log(' AUTH CHECK: Network error detected, scheduling redirect...');
                setTimeout(() => {
                    redirectToAuth();
                }, 3000);
            }
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
    
    if (window.location.pathname !== '/auth.html') {
        console.log('🚨 PERFORMING REDIRECT TO AUTH.HTML...');
        window.location.href = '/auth.html';
    } else {
        console.log('🚨 Already on auth page, skipping redirect');
    }
}

// Show message to user
function showMessage(message, type = 'info') {
    try {
        // First check if DOM is ready
        if (document.readyState === 'loading') {
            console.log(`Message (${type}): ${message}`);
            return;
        }

        const messageContainer = document.getElementById('messageContainer');
        if (!messageContainer) {
            // Try to create a temporary message container if it doesn't exist
            const tempContainer = document.createElement('div');
            tempContainer.id = 'tempMessageContainer';
            tempContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 300px;
            `;
            document.body?.appendChild(tempContainer);
            
            if (!tempContainer) {
                console.log(`${type}: ${message}`);
                return;
            }
        }

        const container = messageContainer || document.getElementById('tempMessageContainer');
        if (!container) {
            console.log(`${type}: ${message}`);
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            margin-bottom: 10px;
            padding: 10px;
            border-radius: 5px;
            background: ${type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : '#339af0'};
            color: white;
            font-size: 14px;
        `;

        container.appendChild(messageDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            try {
                if (messageDiv && messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            } catch (removeError) {
                console.error('Error removing message:', removeError);
            }
        }, 5000);
    } catch (error) {
        // Ultimate fallback to prevent crashes
        console.log(`Message (${type}): ${message}`);
        console.error('showMessage error:', error);
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
        console.error('Error creating session:', error);
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
        console.log('Successfully loaded', sessions.length, 'sessions');

        // Initialize business dashboard with real session data
        if (typeof window.initializeDashboard === 'function') {
            window.initializeDashboard();
        }

        // Storage usage is now handled by loadStorageUsage() in index.html

    } catch (error) {
        console.error('Error loading sessions:', error);
        showMessage('Error loading sessions: ' + error.message, 'error');
    }
}

// REMOVED: Old updateStorageUsage() function to prevent conflicts
// Storage usage is now calculated by loadStorageUsage() in index.html
// This eliminates double-calculations and ensures proper RAW/Gallery separation

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

    const calendarBtn = document.createElement('button');
    calendarBtn.className = 'btn btn-success';
    calendarBtn.textContent = 'Schedule: Add to Calendar';
    calendarBtn.onclick = () => exportToCalendar(session.id);

    // Direct email client button
    const emailClientBtn = document.createElement('button');
    emailClientBtn.className = 'btn btn-primary';
    emailClientBtn.textContent = ' Email Client';
    emailClientBtn.onclick = () => openEmailClient(session);
    emailClientBtn.style.backgroundColor = '#007bff';
    emailClientBtn.style.marginBottom = '5px';

    const galleryBtn = document.createElement('button');
    galleryBtn.className = 'btn btn-warning';
    galleryBtn.textContent = ' Copy Gallery URL';
    galleryBtn.onclick = () => copyGalleryUrl(session.id);

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
    depositBtn.style.backgroundColor = '#fd7e14';
    depositBtn.style.color = 'white';
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

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.onclick = () => deleteSession(session.id);

    console.log('About to append buttons for:', session.clientName);
    console.log('Upload button created:', uploadBtn.textContent);
    console.log('Upload button onclick:', uploadBtn.onclick ? 'Set' : 'NOT SET');

    actions.appendChild(editBtn);
    actions.appendChild(uploadBtn);
    actions.appendChild(calendarBtn);
    actions.appendChild(emailClientBtn);
    actions.appendChild(galleryBtn);
    actions.appendChild(emailPreviewBtn);
    actions.appendChild(invoiceBtn);
    console.log('DEBUG: About to append deposit button:', depositBtn);
    actions.appendChild(depositBtn);
    actions.appendChild(paymentPlanBtn);
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
    const phoneDiv = createPhoneDetailItem('Phone', session.phoneNumber);

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
    form.elements.phoneNumber.value = session.phoneNumber;
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
        console.error('Error deleting session:', error);
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
        `DESCRIPTION:Photography session with ${session.clientName}\\n\\nContact: ${session.phoneNumber}\\nEmail: ${session.email}\\nPrice: $${session.price}\\nDuration: ${session.duration} minutes\\n\\nNotes: ${session.notes || 'No additional notes'}`,
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
                `Contact: ${session.phoneNumber}\n` +
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
 Call/Text: ${session.phoneNumber}
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

// Copy gallery URL to clipboard
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
                        <button onclick="sendViaSMS('${clientPhone}', '${clientName}', '${amount}', '${invoiceUrl}')" 
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
        console.error('Error updating session:', error);
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
    galleryTitle.textContent = 'Photo Gallery';

    const photoCount = document.createElement('span');
    photoCount.className = 'photo-count';
    const count = session.photos ? session.photos.length : 0;
    photoCount.textContent = `${count} photos`;

    galleryHeader.appendChild(galleryTitle);
    galleryHeader.appendChild(photoCount);

    const galleryGrid = document.createElement('div');
    galleryGrid.className = 'gallery-grid';
    galleryGrid.setAttribute('data-session-id', session.id);

    // Load photos for this session
    loadSessionPhotos(session.id, galleryGrid, photoCount);

    gallerySection.appendChild(galleryHeader);
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
    uploadBtn.addEventListener('click', () => {
        uploadPhotos(sessionId, selectedFiles);
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

    async function uploadPhotos(sessionId, files) {
        if (files.length === 0) return;

        try {
            // Show progress in HTML modal
            console.log('Starting upload process...');

            const authToken = await getAuthToken();
            if (!authToken) {
                throw new Error('Authentication required for photo upload');
            }

            const formData = new FormData();
            files.forEach(file => {
                formData.append('photos', file);
            });

            // Remove old progress tracking - using HTML modal now
            console.log('Uploading photos...');

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

            // Upload complete - using HTML modal now
            console.log('Upload complete!');

            console.log('Upload result:', result);
            showMessage(`Successfully uploaded ${result.uploaded} photos!`, 'success');

            // Close HTML modal after upload
            setTimeout(() => {
                const modal = document.getElementById('uploadModal');
                if (modal) {
                    modal.classList.remove('active');
                }
            }, 1000);

            // Reload photos for this session
            const galleryGrid = document.querySelector(`.gallery-grid[data-session-id="${sessionId}"]`);
            const photoCount = galleryGrid?.parentElement?.querySelector('.photo-count');
            if (galleryGrid) {
                loadSessionPhotos(sessionId, galleryGrid, photoCount);
            }

        } catch (error) {
            console.error('Upload error:', error);
            showMessage('Upload failed: ' + error.message, 'error');

            console.log('Upload failed, hiding progress');
        }
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
            phoneNumber: session.phoneNumber,
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