// Photography Session Scheduler
// Session management system with cloud database

// Global variables
// sessions variable is declared in index.html - using global scope
let sessionIdCounter = 1;
let currentUser = null;

// Firebase Authentication functions
async function checkAuth() {
    // Skip authentication check only for actual landing page content
    // Check if this is the real landing page by looking for landing page elements
    const isLandingPage = document.querySelector('.landing-hero') || document.querySelector('.pricing-section') || document.title.includes('Complete Business Platform');
    
    if (window.location.pathname === '/' && isLandingPage) {
        console.log('Landing page - skipping authentication check');
        return false; // Don't authenticate on landing page
    }
    
    // Skip auth if this is a direct redirect from landing page buttons
    if (sessionStorage.getItem('landingRedirect') === 'true') {
        console.log('Direct redirect from landing page - clearing flag and proceeding with auth');
        sessionStorage.removeItem('landingRedirect');
        // Continue with normal auth check
    }
    
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
    const fromAuth = document.referrer.includes('secure-login.html') || sessionStorage.getItem('fromAuth') === 'true';
    
    // Check if we're on iOS and use native auth handler
    if (window.nativeAuth && (window.nativeAuth.isIOS || window.nativeAuth.isCapacitor)) {
        console.log('Using native iOS authentication handler...');
        try {
            await window.nativeAuth.initialize();
            if (window.nativeAuth.isAuthenticated()) {
                currentUser = window.nativeAuth.getCurrentUser();
                window.currentUser = currentUser;
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
                window.currentUser = data.user;
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
        if (!fromAuth && !sessionStorage.getItem('fromAuth') && !document.referrer.includes('secure-login.html')) {
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
    console.log('REDIRECT TO AUTH CALLED!');
    console.log('Current location:', window.location.href);
    console.log('Current pathname:', window.location.pathname);
    console.log('Referrer:', document.referrer);
    console.log('fromAuth flag:', sessionStorage.getItem('fromAuth'));
    console.log('Manual logout flag:', localStorage.getItem('manualLogout'));
    console.log('Logging out flag:', sessionStorage.getItem('loggingOut'));
    
    // Debug stack trace to see who called this function
    console.log('REDIRECT STACK TRACE:', new Error().stack);
    
    if (window.location.pathname !== '/secure-login.html') {
        console.log('PERFORMING REDIRECT TO AUTH.HTML...');
        window.location.href = '/secure-login.html';
    } else {
        console.log('Already on auth page, skipping redirect');
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
    // Skip session loading only for actual landing page content
    const isLandingPage = document.querySelector('.landing-hero') || document.querySelector('.pricing-section') || document.title.includes('Complete Business Platform');
    
    if (window.location.pathname === '/' && isLandingPage) {
        console.log('Landing page - skipping session loading');
        return;
    }
    
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

        if (!Array.isArray(data)) {
            console.error('API returned non-array data:', data);
            showMessage('Error: Invalid data format from server', 'error');
            return;
        }

        // Transform the data to match frontend format
        const transformedSessions = data.map(session => {
            const transformed = {
                id: session.id,
                sessionType: session.session_type || session.sessionType,
                clientName: session.client_name || session.clientName,
                dateTime: session.date_time || session.dateTime,
                location: session.location,
                phoneNumber: session.phone_number || session.phoneNumber,
                email: session.email,
                price: parseFloat(session.price) || 0,
                depositAmount: parseFloat(session.deposit_amount || session.depositAmount) || 0,
                // CRITICAL FIX: Read payment status fields correctly from both camelCase and snake_case
                depositPaid: session.depositPaid || session.deposit_paid || false,
                depositSent: session.depositSent || session.deposit_sent || false, 
                invoiceSent: session.invoiceSent || session.invoice_sent || false,
                depositPaidAt: session.deposit_paid_at || session.depositPaidAt,
                invoicePaidAt: session.invoice_paid_at || session.invoicePaidAt,
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
            };
            
            // Debug: Log payment fields for sessions with deposits/invoices sent
            if (session.depositSent || session.invoiceSent || session.deposit_sent || session.invoice_sent) {
                console.log(`Payment fields for ${transformed.clientName}:`, {
                    raw_depositSent: session.depositSent,
                    raw_deposit_sent: session.deposit_sent,
                    transformed_depositSent: transformed.depositSent,
                    transformed_invoiceSent: transformed.invoiceSent,
                    transformed_depositPaid: transformed.depositPaid,
                    depositAmount: transformed.depositAmount
                });
            }
            
            return transformed;
        });

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


// Create individual session card
function createSessionCard(session) {

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
    
    // Add payment status badges in the header
    let paymentBadgesHTML = '';
    
    // Check deposit status
    if (session.depositPaid === true) {
        paymentBadgesHTML += '<span style="background: #22c55e; color: white; padding: 3px 8px; border-radius: 10px; font-size: 10px; margin-left: 10px; display: inline-block; font-weight: 600;">Deposit Paid</span>';
    } else if (session.depositSent === true) {
        paymentBadgesHTML += '<span style="background: #fb923c; color: white; padding: 3px 8px; border-radius: 10px; font-size: 10px; margin-left: 10px; display: inline-block; font-weight: 600;">Deposit Sent</span>';
    }
    
    // Check invoice status
    if (session.paid === true) {
        paymentBadgesHTML += '<span style="background: #22c55e; color: white; padding: 3px 8px; border-radius: 10px; font-size: 10px; margin-left: 10px; display: inline-block; font-weight: 600;">Fully Paid</span>';
    } else if (session.invoiceSent === true) {
        paymentBadgesHTML += '<span style="background: #3b82f6; color: white; padding: 3px 8px; border-radius: 10px; font-size: 10px; margin-left: 10px; display: inline-block; font-weight: 600;">Invoice Sent</span>';
    }
    
    // Add price with payment badges
    const priceInfo = document.createElement('div');
    priceInfo.className = 'session-price-header';
    priceInfo.style.cssText = 'font-size: 14px; color: #4a5568; margin-top: 4px;';
    
    let priceText = `$${session.price}`;
    if (session.depositPaid === true && session.depositAmount > 0) {
        const remaining = session.price - session.depositAmount;
        priceText = `$${session.price} (Remaining: $${remaining.toFixed(2)})`;
    }
    
    priceInfo.innerHTML = priceText + paymentBadgesHTML;

    headerInfo.appendChild(title);
    headerInfo.appendChild(client);
    headerInfo.appendChild(priceInfo);

    // Create actions section
    const actions = document.createElement('div');
    actions.className = 'session-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-primary';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => editSession(session.id);

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn btn-secondary upload-photos-btn';
    uploadBtn.textContent = '📁 Upload Files';
    uploadBtn.onclick = () => openUploadDialog(session.id);
    // Remove inline styles that interfere with responsive design
    uploadBtn.style.backgroundColor = '#6b7280'; // Gray background
    uploadBtn.style.color = 'white'; // White text

    // Download Controls is now integrated into Gallery Manager - no separate button needed

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

    // Gallery Notification button - send gallery links via Email/SMS
    const galleryNotifyBtn = document.createElement('button');
    galleryNotifyBtn.className = 'btn btn-success';
    galleryNotifyBtn.textContent = '📧📱 Send Gallery Notification';
    galleryNotifyBtn.onclick = () => sendGalleryNotification(session.id);
    galleryNotifyBtn.style.backgroundColor = '#28a745';
    galleryNotifyBtn.style.color = 'white';
    galleryNotifyBtn.style.margin = '2px';
    
    // Only enable if gallery access token exists (pulls phone from session card)
    if (!session.galleryAccessToken) {
        galleryNotifyBtn.textContent = '⚠️ Generate Gallery First';
        galleryNotifyBtn.style.backgroundColor = '#6c757d';
        galleryNotifyBtn.disabled = true;
        galleryNotifyBtn.title = 'Generate gallery access first, then you can send notifications';
    }

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

    const depositBtn = document.createElement('button');
    depositBtn.className = 'btn btn-warning';
    depositBtn.textContent = 'Send Deposit';
    // Capture the session object properly in closure
    depositBtn.onclick = function() {
        sendDepositInvoice(session);
    };
    depositBtn.style.backgroundColor = 'white';
    depositBtn.style.color = '#374151';
    depositBtn.style.border = '1px solid #d1d5db';

    // Payment Plan Button
    const paymentPlanBtn = document.createElement('button');
    paymentPlanBtn.className = 'btn btn-success';
    paymentPlanBtn.textContent = ' Payment Plan';
    paymentPlanBtn.onclick = function() {
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
        paymentPlanBtn.style.backgroundColor = '#6c757d';
    }

    // View Contracts Button with PDF functionality
    const viewContractsBtn = document.createElement('button');
    viewContractsBtn.className = 'btn btn-secondary';
    viewContractsBtn.textContent = '📄 View Contracts';
    viewContractsBtn.onclick = () => {
        viewSessionContractsPDF(session.id, session.clientName);
    };
    viewContractsBtn.style.backgroundColor = '#6c757d';
    viewContractsBtn.style.color = 'white';

    // Booking Agreement Button - CRITICAL: Must have booking-agreement-btn class and data-session-id attribute
    const bookingAgreementBtn = document.createElement('button');
    bookingAgreementBtn.className = 'btn btn-secondary booking-agreement-btn';
    bookingAgreementBtn.setAttribute('data-session-id', session.id);
    bookingAgreementBtn.onclick = (e) => {
        e.stopPropagation();
        if (typeof window.openBookingAgreementModal === 'function') {
            window.openBookingAgreementModal(session.id);
        } else {
            console.error('openBookingAgreementModal function not found');
            showMessage('Booking agreement feature is loading, please try again in a moment.', 'info');
        }
    };
    bookingAgreementBtn.style.backgroundColor = '#6c757d';
    bookingAgreementBtn.style.color = 'white';
    bookingAgreementBtn.style.margin = '2px';
    
    // Create status span inside the button
    const agreementStatusSpan = document.createElement('span');
    agreementStatusSpan.className = 'agreement-status';
    agreementStatusSpan.textContent = '📋 Booking Agreement';
    bookingAgreementBtn.appendChild(agreementStatusSpan);

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
    actions.appendChild(galleryNotifyBtn);
    actions.appendChild(emailPreviewBtn);
    actions.appendChild(invoiceBtn);
    actions.appendChild(depositBtn);
    actions.appendChild(paymentPlanBtn);
    actions.appendChild(viewContractsBtn);
    actions.appendChild(bookingAgreementBtn);
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

    // Price, payment status, and duration
    const priceDiv = document.createElement('div');
    priceDiv.className = 'detail-item';
    
    // Calculate remaining balance if deposit is paid
    let priceDisplay = `$${session.price}`;
    let paymentBadges = '';
    
    // Check deposit status - ensure we're reading the fields correctly
    if (session.depositPaid === true) {
        const remaining = session.price - (session.depositAmount || 0);
        priceDisplay = `$${session.price} (Remaining: $${remaining.toFixed(2)})`;
        paymentBadges += '<span style="background: #22c55e; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; margin-left: 8px; display: inline-block; font-weight: 500;">✓ Deposit Paid</span>';
    } else if (session.depositSent === true) {
        paymentBadges += '<span style="background: #fb923c; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; margin-left: 8px; display: inline-block; font-weight: 500;">⏳ Deposit Pending</span>';
    }
    
    // Check invoice status
    if (session.paid === true) {
        paymentBadges += '<span style="background: #22c55e; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; margin-left: 8px; display: inline-block; font-weight: 500;">✓ Fully Paid</span>';
    } else if (session.invoiceSent === true) {
        paymentBadges += '<span style="background: #3b82f6; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; margin-left: 8px; display: inline-block; font-weight: 500;">⏳ Invoice Sent</span>';
    }
    
    // Debug: Always log payment status for debugging
    console.log(`📊 Session ${session.clientName} payment status:`, {
        depositSent: session.depositSent,
        depositPaid: session.depositPaid,
        invoiceSent: session.invoiceSent,
        paid: session.paid,
        hasBadges: !!paymentBadges
    });
    
    priceDiv.innerHTML = `
        <div class="detail-label">Price & Duration</div>
        <div class="detail-value">${priceDisplay} for ${session.duration} minutes${paymentBadges}</div>
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
    console.log('🗑️ DELETE FUNCTION CALLED - SessionId:', sessionId);
    
    if (!confirm('Are you sure you want to delete this session?')) {
        console.log('❌ User cancelled deletion');
        return;
    }

    console.log('✅ User confirmed deletion, sending DELETE request...');

    try {
        const url = `/api/sessions/${sessionId}`;
        console.log('📡 DELETE URL:', url);
        
        const response = await fetch(url, {
            method: 'DELETE',
            credentials: 'include'
        });

        console.log('📥 DELETE Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ DELETE failed:', errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ DELETE successful:', result);

        // Remove from local array and re-render
        sessions = sessions.filter(s => s.id !== sessionId);
        if (typeof window.renderSessions === 'function') {
            window.renderSessions();
        }
        showMessage('Session deleted successfully!', 'success');

    } catch (error) {
        console.error('❌ Error deleting session:', error);
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

        // Handle SMS option - use the SMS link returned from server
        if (result.smsSent && result.smsLink) {
            setTimeout(() => {
                showMessage('💬 SMS ready! Click to open messaging app.', 'success');
                
                // Create SMS button that user can click
                const smsButton = document.createElement('button');
                smsButton.textContent = '📱 Send SMS';
                smsButton.style.cssText = 'background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px;';
                smsButton.onclick = () => {
                    console.log(`📱 Opening SMS app with formatted phone number from session card`);
                    window.location.href = result.smsLink;
                };
                
                // Find the messages container and add the button
                const messagesContainer = document.querySelector('.messages') || document.body;
                messagesContainer.appendChild(smsButton);
            }, 3000);
        } else if (result.smsSent) {
            setTimeout(() => {
                showMessage('💬 SMS prepared but no phone number available.', 'warning');
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
        
        // Show invoice send dialog with SMS and email options
        showInvoiceSendDialog({
            amount: remainingBalance,
            clientName: session.clientName,
            clientPhone: session.phoneNumber || session.phone_number,  // Handle both field names
            clientEmail: session.email,
            invoiceUrl: customInvoiceUrl
        });

        console.log(' TIPPING SUCCESS: Custom invoice URL created:', customInvoiceUrl);
        console.log(' Phone number for SMS:', session.phoneNumber || session.phone_number);

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
async function sendViaSMS(phone, clientName, amount, invoiceUrl) {
    if (!phone) {
        alert('No phone number found for this client. Please add a phone number to the session.');
        return;
    }
    
    // Clean phone number - remove spaces and formatting but keep country code
    const cleanPhone = phone.replace(/[\s()-]/g, '');
    console.log('📱 SMS: Original phone:', phone, 'Cleaned:', cleanPhone);
    
    const message = `Hi ${clientName}! Your photography invoice for $${parseFloat(amount).toFixed(2)} is ready. You can add a tip and pay securely here: ${invoiceUrl}`;
    
    // Create SMS URL that opens default SMS app
    const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
    
    // Extract session ID from invoice URL to update database
    const urlParams = new URL(invoiceUrl).searchParams;
    const sessionId = urlParams.get('sessionId');
    
    if (sessionId) {
        // Mark invoice as sent in database
        try {
            const authToken = await getAuthToken();
            const response = await fetch('/api/mark-invoice-sent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ sessionId })
            });
            
            if (response.ok) {
                console.log('✅ Invoice marked as sent in database');
                // Refresh sessions to show updated status
                setTimeout(() => loadSessions(), 1000);
            }
        } catch (error) {
            console.error('Error marking invoice as sent:', error);
        }
    }
    
    // Open SMS app
    window.location.href = smsUrl;
    
    showMessage(`SMS app opened with invoice message for ${cleanPhone}!`, 'success');
}

// Send invoice via email using device default email app
async function sendViaEmail(email, clientName, amount, invoiceUrl) {
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
    
    // Extract session ID from invoice URL to update database
    const urlParams = new URL(invoiceUrl).searchParams;
    const sessionId = urlParams.get('sessionId');
    
    if (sessionId) {
        // Mark invoice as sent in database
        try {
            const authToken = await getAuthToken();
            const response = await fetch('/api/mark-invoice-sent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ sessionId })
            });
            
            if (response.ok) {
                console.log('✅ Invoice marked as sent in database');
                // Refresh sessions to show updated status
                setTimeout(() => loadSessions(), 1000);
            }
        } catch (error) {
            console.error('Error marking invoice as sent:', error);
        }
    }
    
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

        // Use the correct endpoint: /api/sessions/:sessionId/files/gallery
        const response = await fetch(`/api/sessions/${sessionId}/files/gallery`, { 
            headers,
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const photos = data.files || [];

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

        // Create photo items with proper preview URLs
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
    photoItem.setAttribute('data-filename', photo.filename || photo.name);

    const img = document.createElement('img');
    // Use the preview endpoint for thumbnails
    const fileName = photo.filename || photo.name;
    img.src = `/api/sessions/${sessionId}/files/gallery/preview/${encodeURIComponent(fileName)}`;
    img.alt = fileName || `Photo ${index + 1}`;
    img.loading = 'lazy';
    
    // Use download URL for full image in lightbox
    const fullImageUrl = photo.downloadUrl || `/api/sessions/${sessionId}/files/gallery/download/${encodeURIComponent(fileName)}`;
    img.onclick = () => openPhotoLightbox(fullImageUrl, fileName);
    
    // Add error handling for images
    img.onerror = function() {
        // If preview fails, try the download URL
        this.src = fullImageUrl;
    };

    // Add delete button for admin users
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'photo-delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Delete photo';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deletePhoto(sessionId, 'gallery', fileName);
    };

    photoItem.appendChild(img);
    photoItem.appendChild(deleteBtn);

    return photoItem;
}

// Open photo upload dialog - create modal dynamically
function openUploadDialog(sessionId) {
    console.log('Opening upload dialog for session:', sessionId);

    // Remove existing modal if any
    const existingModal = document.getElementById('uploadModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal HTML structure
    const modal = document.createElement('div');
    modal.id = 'uploadModal';
    modal.className = 'upload-modal';
    modal.innerHTML = `
        <div class="upload-modal-content">
            <div class="upload-modal-header">
                <h3>Gallery Manager</h3>
                <button class="close-btn" onclick="closeUploadModal()">&times;</button>
            </div>
            
            <!-- Gallery Management Toolbar -->
            <div class="gallery-toolbar">
                <div class="toolbar-section">
                    <button class="toolbar-btn" onclick="openGalleryView('${sessionId}')">
                        <span class="btn-icon">🖼️</span> Gallery
                    </button>
                    <button class="toolbar-btn" onclick="downloadAllZIP('${sessionId}')">
                        <span class="btn-icon">📦</span> Download All ZIP
                    </button>
                    <button class="toolbar-btn" onclick="deleteAllPhotos('${sessionId}')">
                        <span class="btn-icon">🗑️</span> Delete All
                    </button>
                    <button class="toolbar-btn" onclick="sendToClient('${sessionId}')">
                        <span class="btn-icon">📧</span> Send to Client
                    </button>
                    <button class="toolbar-btn" onclick="refreshGallery('${sessionId}')">
                        <span class="btn-icon">🔄</span> Refresh
                    </button>
                </div>
                
                <!-- Download Controls Section -->
                <div class="toolbar-section download-controls-section">
                    <div class="section-label">Download Controls:</div>
                    <button class="toolbar-btn download-control-btn" onclick="quickToggleDownloads('${sessionId}')" id="toggleDownloads_${sessionId}">
                        <span class="btn-icon">🔓</span> <span id="downloadStatus_${sessionId}">Enable</span>
                    </button>
                    <button class="toolbar-btn download-control-btn" onclick="quickSetPricing('${sessionId}')">
                        <span class="btn-icon">💰</span> Set Pricing
                    </button>
                    <button class="toolbar-btn download-control-btn" onclick="quickWatermarkToggle('${sessionId}')" id="toggleWatermark_${sessionId}">
                        <span class="btn-icon">🎨</span> <span id="watermarkStatus_${sessionId}">Watermark</span>
                    </button>
                    <button class="toolbar-btn download-control-btn" onclick="viewDownloadAnalytics('${sessionId}')">
                        <span class="btn-icon">📊</span> Analytics
                    </button>
                </div>
            </div>
            
            <div class="upload-modal-body">
                <!-- Tabs for different sections -->
                <div class="tab-navigation">
                    <button class="tab-btn active" onclick="switchTab('upload', '${sessionId}')">📁 Upload Files</button>
                    <button class="tab-btn" onclick="switchTab('downloads', '${sessionId}')">📥 Download Controls</button>
                </div>
                
                <!-- Upload Tab -->
                <div id="uploadTab" class="tab-content active">
                    <div class="drop-zone" id="dropZone">
                        <div class="drop-zone-content">
                            <svg class="upload-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <h4>Upload Files</h4>
                            <p>Drag and drop files or click anywhere in this area to browse</p>
                            <p class="file-types">📁 Upload multiple files • All file types supported</p>
                        </div>
                        <input type="file" id="fileInput" multiple accept="*/*" style="display: none;">
                    </div>
                    <div class="file-preview" id="filePreview"></div>
                </div>
                
                <!-- Download Controls Tab -->
                <div id="downloadsTab" class="tab-content" style="display: none;">
                    <div id="downloadControlsContent">
                        Loading download settings...
                    </div>
                </div>
            </div>
            <div class="upload-modal-footer">
                <button class="btn btn-secondary" onclick="closeUploadModal()">Close</button>
                <button class="btn btn-primary" id="uploadBtn" disabled>Upload Files</button>
            </div>
        </div>
    `;

    // Add modal styles if not already present
    if (!document.querySelector('#uploadModalStyles')) {
        const styles = document.createElement('style');
        styles.id = 'uploadModalStyles';
        styles.innerHTML = `
            .upload-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                align-items: center;
                justify-content: center;
            }
            .upload-modal.active {
                display: flex;
            }
            .upload-modal-content {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            }
            .upload-modal-header {
                padding: 20px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .upload-modal-header h3 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: #333;
            }
            .upload-modal-header .close-btn {
                background: none;
                border: none;
                font-size: 28px;
                cursor: pointer;
                color: #999;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .upload-modal-header .close-btn:hover {
                color: #333;
            }
            
            /* Gallery Toolbar Styles */
            .gallery-toolbar {
                background: #f8fafc;
                border-bottom: 1px solid #e5e7eb;
                padding: 15px 20px;
            }
            .toolbar-section {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            .toolbar-btn {
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 14px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s ease;
                color: #374151;
            }
            .toolbar-btn:hover {
                background: #f3f4f6;
                border-color: #9ca3af;
                transform: translateY(-1px);
            }
            .toolbar-btn:active {
                transform: translateY(0);
            }
            .btn-icon {
                font-size: 16px;
            }
            
            /* Download Controls Section */
            .download-controls-section {
                border-top: 1px solid #e5e7eb;
                padding-top: 15px;
                margin-top: 15px;
            }
            .section-label {
                font-size: 12px;
                font-weight: 600;
                color: #6b7280;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
            }
            .download-control-btn {
                background: #f8fafc;
                border-color: #e2e8f0;
                color: #475569;
            }
            .download-control-btn:hover {
                background: #e2e8f0;
                border-color: #cbd5e1;
                color: #334155;
            }
            
            /* Tab Navigation Styles */
            .tab-navigation {
                display: flex;
                border-bottom: 2px solid #e5e7eb;
                margin-bottom: 20px;
                gap: 5px;
            }
            .tab-btn {
                background: none;
                border: none;
                padding: 12px 20px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                color: #6b7280;
                border-bottom: 2px solid transparent;
                transition: all 0.2s ease;
            }
            .tab-btn.active {
                color: #00D4AA;
                border-bottom-color: #00D4AA;
                background: #f0fdf9;
            }
            .tab-btn:hover:not(.active) {
                color: #374151;
                background: #f9fafb;
            }
            .tab-content {
                display: none;
            }
            .tab-content.active {
                display: block;
            }
            
            .upload-modal-body {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
            }
            .drop-zone {
                border: 2px dashed #cbd5e1;
                border-radius: 8px;
                padding: 40px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                background: #f9fafb;
            }
            .drop-zone:hover {
                border-color: #00D4AA;
                background: #f0fdf4;
            }
            .drop-zone.drag-over {
                border-color: #00D4AA;
                background: #e6fffa;
            }
            .drop-zone-content {
                pointer-events: none;
            }
            .upload-icon {
                color: #00D4AA;
                margin-bottom: 16px;
            }
            .drop-zone p {
                margin: 8px 0;
                color: #6b7280;
            }
            .drop-zone .file-types {
                font-size: 14px;
                color: #9ca3af;
            }
            .file-preview {
                margin-top: 20px;
                max-height: 200px;
                overflow-y: auto;
            }
            .file-preview-item {
                display: flex;
                align-items: center;
                padding: 12px;
                background: #f9fafb;
                border-radius: 6px;
                margin-bottom: 8px;
            }
            .file-preview-item img {
                width: 40px;
                height: 40px;
                object-fit: cover;
                border-radius: 4px;
                margin-right: 12px;
            }
            .file-preview-item .file-info {
                flex: 1;
            }
            .file-preview-item .file-name {
                font-weight: 500;
                color: #333;
                font-size: 14px;
            }
            .file-preview-item .file-size {
                font-size: 12px;
                color: #9ca3af;
            }
            .file-preview-item .remove-file {
                background: none;
                border: none;
                color: #ef4444;
                cursor: pointer;
                font-size: 20px;
                padding: 0 8px;
            }
            .upload-modal-footer {
                padding: 20px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            .upload-modal-footer .btn {
                padding: 10px 20px;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            .upload-modal-footer .btn-secondary {
                background: #f3f4f6;
                color: #374151;
                border: 1px solid #d1d5db;
            }
            .upload-modal-footer .btn-secondary:hover {
                background: #e5e7eb;
            }
            .upload-modal-footer .btn-primary {
                background: #00D4AA;
                color: white;
                border: none;
            }
            .upload-modal-footer .btn-primary:hover:not(:disabled) {
                background: #00BF9A;
            }
            .upload-modal-footer .btn-primary:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(styles);
    }

    // Add modal to page
    document.body.appendChild(modal);

    // Store session ID for upload
    window.currentUploadSessionId = sessionId;

    // Setup event handlers
    setupUploadModal(sessionId);

    // Show modal
    modal.classList.add('active');
}

// Gallery Management Functions for the new toolbar buttons
window.openGalleryView = function(sessionId) {
    console.log('Opening gallery view for session:', sessionId);
    
    // Get the session data to get gallery token
    const session = window.sessionsData.find(s => s.id === sessionId);
    if (session && session.galleryAccessToken) {
        const baseUrl = window.location.origin;
        const galleryUrl = `${baseUrl}/g/${session.galleryAccessToken}`;
        window.open(galleryUrl, '_blank');
    } else {
        showMessage('Gallery not yet available for this session', 'warning');
    }
};

window.downloadAllZIP = async function(sessionId) {
    console.log('Downloading all photos as ZIP for session:', sessionId);
    
    try {
        const response = await fetch(`/api/sessions/${sessionId}/download-all`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `session-${sessionId}-photos.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showMessage('All photos downloaded successfully!', 'success');
        } else {
            throw new Error('Failed to download photos');
        }
    } catch (error) {
        console.error('Error downloading all photos:', error);
        showMessage('Error downloading photos. Please try again.', 'error');
    }
};

window.deleteAllPhotos = async function(sessionId) {
    console.log('Delete all photos requested for session:', sessionId);
    
    const confirmed = confirm('Are you sure you want to delete ALL photos from this session? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/sessions/${sessionId}/delete-all-photos`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(`Successfully deleted all photos. Reclaimed ${result.totalReclaimedMB}MB of storage.`, 'success');
            // Refresh the session data
            await loadSessions();
            // Close the modal
            closeUploadModal();
        } else {
            showMessage(`Failed to delete photos: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting all photos:', error);
        showMessage('Error deleting photos. Please try again.', 'error');
    }
};

window.sendToClient = function(sessionId) {
    console.log('Send to client requested for session:', sessionId);
    
    // Get the session data
    const session = window.sessionsData.find(s => s.id === sessionId);
    if (!session) {
        showMessage('Session not found', 'error');
        return;
    }
    
    // Open email client with gallery link
    if (session.galleryAccessToken) {
        const baseUrl = window.location.origin;
        const galleryUrl = `${baseUrl}/g/${session.galleryAccessToken}`;
        const subject = encodeURIComponent(`Your ${session.sessionType} Photos are Ready!`);
        const body = encodeURIComponent(`Hi ${session.clientName},\n\nYour photos from the ${session.sessionType} session are now ready for viewing and download!\n\nGallery Link: ${galleryUrl}\n\nBest regards,\nYour Photographer`);
        
        window.open(`mailto:${session.email}?subject=${subject}&body=${body}`, '_blank');
    } else {
        showMessage('Gallery not yet available for this session', 'warning');
    }
};

window.refreshGallery = async function(sessionId) {
    console.log('Refreshing gallery for session:', sessionId);
    
    try {
        // Reload sessions data
        await loadSessions();
        
        // Update the upload modal if it's still open
        const modal = document.getElementById('uploadModal');
        if (modal && modal.classList.contains('active')) {
            // Update the file preview to show current photos
            await updateFilePreview(sessionId);
        }
        
        showMessage('Gallery refreshed successfully!', 'success');
    } catch (error) {
        console.error('Error refreshing gallery:', error);
        showMessage('Error refreshing gallery. Please try again.', 'error');
    }
};

// Quick Download Control Functions
window.quickToggleDownloads = async function(sessionId) {
    try {
        // Get current policy first
        const response = await fetch(`/api/downloads/sessions/${sessionId}/policy`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load current policy');
        }
        
        const policy = await response.json();
        const newStatus = !policy.downloadEnabled;
        
        // Toggle the download status
        const formData = new FormData();
        formData.append('downloadEnabled', newStatus.toString());
        
        const updateResponse = await fetch(`/api/downloads/sessions/${sessionId}/policy`, {
            method: 'PUT',
            credentials: 'include',
            body: formData
        });
        
        if (updateResponse.ok) {
            // Update button text and icon
            const btn = document.getElementById(`downloadStatus_${sessionId}`);
            const icon = document.querySelector(`#toggleDownloads_${sessionId} .btn-icon`);
            
            if (btn && icon) {
                btn.textContent = newStatus ? 'Disable' : 'Enable';
                icon.textContent = newStatus ? '🔒' : '🔓';
            }
            
            showMessage(`Downloads ${newStatus ? 'enabled' : 'disabled'} successfully!`, 'success');
        } else {
            throw new Error('Failed to update download status');
        }
    } catch (error) {
        console.error('Error toggling downloads:', error);
        showMessage('Error updating download status', 'error');
    }
};

window.quickSetPricing = async function(sessionId) {
    const pricingModel = prompt("Select pricing model:\n1. free\n2. paid\n3. freemium\n\nEnter choice (1-3):");
    
    if (!pricingModel) return;
    
    const models = { '1': 'free', '2': 'paid', '3': 'freemium' };
    const selectedModel = models[pricingModel];
    
    if (!selectedModel) {
        showMessage('Invalid pricing model selected', 'error');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('pricingModel', selectedModel);
        
        if (selectedModel === 'paid' || selectedModel === 'freemium') {
            const price = prompt("Enter price per download ($):");
            if (price) {
                formData.append('pricePerDownload', price);
            }
        }
        
        if (selectedModel === 'freemium') {
            const freeDownloads = prompt("Enter number of free downloads:");
            if (freeDownloads) {
                formData.append('freeDownloads', freeDownloads);
            }
        }
        
        const response = await fetch(`/api/downloads/sessions/${sessionId}/policy`, {
            method: 'PUT',
            credentials: 'include',
            body: formData
        });
        
        if (response.ok) {
            showMessage(`Pricing model set to ${selectedModel}`, 'success');
        } else {
            throw new Error('Failed to update pricing');
        }
    } catch (error) {
        console.error('Error setting pricing:', error);
        showMessage('Error updating pricing model', 'error');
    }
};

window.quickWatermarkToggle = async function(sessionId) {
    try {
        // Get current policy
        const response = await fetch(`/api/downloads/sessions/${sessionId}/policy`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load current policy');
        }
        
        const policy = await response.json();
        const newStatus = !policy.watermarkEnabled;
        
        const formData = new FormData();
        formData.append('watermarkEnabled', newStatus.toString());
        
        if (newStatus) {
            // Set default watermark settings
            formData.append('watermarkType', 'text');
            formData.append('watermarkText', '© Photography');
            formData.append('watermarkPosition', 'bottom-right');
            formData.append('watermarkOpacity', '60');
        }
        
        const updateResponse = await fetch(`/api/downloads/sessions/${sessionId}/policy`, {
            method: 'PUT',
            credentials: 'include',
            body: formData
        });
        
        if (updateResponse.ok) {
            // Update button text
            const btn = document.getElementById(`watermarkStatus_${sessionId}`);
            if (btn) {
                btn.textContent = newStatus ? 'Remove WM' : 'Add WM';
            }
            
            showMessage(`Watermark ${newStatus ? 'enabled' : 'disabled'} successfully!`, 'success');
        } else {
            throw new Error('Failed to update watermark status');
        }
    } catch (error) {
        console.error('Error toggling watermark:', error);
        showMessage('Error updating watermark status', 'error');
    }
};

window.viewDownloadAnalytics = async function(sessionId) {
    try {
        // This would fetch and display download analytics
        // For now, show a placeholder message
        showMessage('Download analytics feature coming soon!', 'info');
        
        // Future implementation could fetch download stats:
        // - Total downloads
        // - Revenue generated
        // - Most downloaded images
        // - Download patterns by time/date
    } catch (error) {
        console.error('Error viewing analytics:', error);
        showMessage('Error loading download analytics', 'error');
    }
};

// Tab switching functionality
window.switchTab = function(tabName, sessionId) {
    console.log('Switching to tab:', tabName);
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    if (tabName === 'upload') {
        document.getElementById('uploadTab').classList.add('active');
        document.getElementById('uploadTab').style.display = 'block';
        document.getElementById('uploadBtn').style.display = 'block';
    } else if (tabName === 'downloads') {
        document.getElementById('downloadsTab').classList.add('active');
        document.getElementById('downloadsTab').style.display = 'block';
        document.getElementById('uploadBtn').style.display = 'none';
        loadDownloadControls(sessionId);
    }
};

// Load download controls content into the tab
async function loadDownloadControls(sessionId) {
    const container = document.getElementById('downloadControlsContent');
    
    try {
        container.innerHTML = 'Loading download settings...';
        
        // Get current download policy
        const response = await fetch(`/api/downloads/sessions/${sessionId}/policy`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load download policy');
        }
        
        const policy = await response.json();
        console.log('Current policy:', policy);
        
        container.innerHTML = `
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
            
            <div style="margin-top: 30px;">
                <button id="saveDownloadPolicy" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">💾 Save Download Settings</button>
            </div>
        `;
        
        // Setup event handlers for the download controls
        setupDownloadControlsHandlers(sessionId);
        
    } catch (error) {
        console.error('Error loading download controls:', error);
        container.innerHTML = `
            <div style="color: #dc2626; padding: 20px; text-align: center; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
                <h4>Error loading download settings</h4>
                <p>Please try refreshing the page or contact support if the issue persists.</p>
            </div>
        `;
    }
}

// Setup event handlers for download controls
function setupDownloadControlsHandlers(sessionId) {
    // Handle dropdown changes
    const pricingModel = document.getElementById('pricingModel');
    if (pricingModel) {
        pricingModel.onchange = function() {
            const value = this.value;
            const freeOptions = document.getElementById('freeOptions');
            const freemiumOptions = document.getElementById('freemiumOptions');
            const paidOptions = document.getElementById('paidOptions');
            
            if (freeOptions) freeOptions.style.display = value === 'free' ? 'block' : 'none';
            if (freemiumOptions) freemiumOptions.style.display = value === 'freemium' ? 'block' : 'none';
            if (paidOptions) paidOptions.style.display = (value === 'paid' || value === 'freemium') ? 'block' : 'none';
        };
    }
    
    const watermarkEnabled = document.getElementById('watermarkEnabled');
    if (watermarkEnabled) {
        watermarkEnabled.onchange = function() {
            const watermarkOptions = document.getElementById('watermarkOptions');
            if (watermarkOptions) {
                watermarkOptions.style.display = this.value === 'true' ? 'block' : 'none';
            }
        };
    }
    
    const watermarkType = document.getElementById('watermarkType');
    if (watermarkType) {
        watermarkType.onchange = function() {
            const value = this.value;
            const textWatermark = document.getElementById('textWatermark');
            const logoWatermark = document.getElementById('logoWatermark');
            
            if (textWatermark) textWatermark.style.display = value === 'text' ? 'block' : 'none';
            if (logoWatermark) logoWatermark.style.display = value === 'logo' ? 'block' : 'none';
        };
    }
    
    // Handle save
    const saveBtn = document.getElementById('saveDownloadPolicy');
    if (saveBtn) {
        saveBtn.onclick = async function() {
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
                
                if (saveResponse.ok) {
                    showMessage('Download settings saved successfully!', 'success');
                } else {
                    throw new Error('Failed to save settings');
                }
                
            } catch (error) {
                console.error('Error saving download policy:', error);
                showMessage('Error saving download settings. Please try again.', 'error');
            }
        };
    }
}

// Helper function to update file preview in the modal
async function updateFilePreview(sessionId) {
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const session = await response.json();
            const previewContainer = document.getElementById('filePreview');
            
            if (session.photos && session.photos.length > 0) {
                previewContainer.innerHTML = `
                    <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
                        <h4 style="margin: 0 0 10px 0; color: #374151;">Current Photos (${session.photos.length})</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;">
                            ${session.photos.map(photo => `
                                <div style="text-align: center;">
                                    <img src="${photo.url}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px;" alt="${photo.filename}">
                                    <p style="font-size: 12px; margin: 5px 0 0 0; color: #6b7280;">${photo.filename}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else {
                previewContainer.innerHTML = `
                    <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; text-align: center; color: #6b7280;">
                        No photos uploaded yet
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error updating file preview:', error);
    }
}

// Global storage for upload modal event handlers to prevent duplicates
window.uploadModalHandlers = null;

// Setup upload modal functionality
function setupUploadModal(sessionId) {
    console.log('Setting up upload modal for session:', sessionId);
    
    // Get modal elements
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const uploadBtn = document.getElementById('uploadBtn');
    const previewContainer = document.getElementById('filePreview');
    
    // Clean up any existing handlers first
    if (window.uploadModalHandlers) {
        console.log('Cleaning up existing upload modal handlers');
        if (fileInput && window.uploadModalHandlers.fileInputChange) {
            fileInput.removeEventListener('change', window.uploadModalHandlers.fileInputChange);
        }
        if (dropZone) {
            if (window.uploadModalHandlers.dropZoneClick) {
                dropZone.removeEventListener('click', window.uploadModalHandlers.dropZoneClick);
            }
            if (window.uploadModalHandlers.dragOver) {
                dropZone.removeEventListener('dragover', window.uploadModalHandlers.dragOver);
            }
            if (window.uploadModalHandlers.dragLeave) {
                dropZone.removeEventListener('dragleave', window.uploadModalHandlers.dragLeave);
            }
            if (window.uploadModalHandlers.drop) {
                dropZone.removeEventListener('drop', window.uploadModalHandlers.drop);
            }
        }
        if (uploadBtn && window.uploadModalHandlers.uploadClick) {
            uploadBtn.removeEventListener('click', window.uploadModalHandlers.uploadClick);
        }
    }
    
    // Track selected files
    let selectedFiles = [];

    // Create and store event handler functions globally
    window.uploadModalHandlers = {
        fileInputChange: (e) => {
            handleFileSelection(e.target.files);
        },
        dropZoneClick: (e) => {
            // Prevent multiple file dialogs
            e.preventDefault();
            e.stopPropagation();
            if (fileInput && !fileInput.disabled) {
                fileInput.click();
            }
        },
        dragOver: (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        },
        dragLeave: () => {
            dropZone.classList.remove('drag-over');
        },
        drop: (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            handleFileSelection(e.dataTransfer.files);
        },
        uploadClick: (e) => {
            e.preventDefault();
            uploadPhotos(sessionId, selectedFiles);
        }
    };

    // Add event listeners using the stored handlers
    if (fileInput) {
        fileInput.addEventListener('change', window.uploadModalHandlers.fileInputChange);
    }

    if (dropZone) {
        dropZone.addEventListener('click', window.uploadModalHandlers.dropZoneClick);
        dropZone.addEventListener('dragover', window.uploadModalHandlers.dragOver);
        dropZone.addEventListener('dragleave', window.uploadModalHandlers.dragLeave);
        dropZone.addEventListener('drop', window.uploadModalHandlers.drop);
    }

    if (uploadBtn) {
        uploadBtn.addEventListener('click', window.uploadModalHandlers.uploadClick);
    }

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
            previewItem.className = 'file-preview-item';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = file.name;

            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';

            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = file.name;

            const fileSize = document.createElement('div');
            fileSize.className = 'file-size';
            // Format file size properly
            const formatFileSize = (bytes) => {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            };
            fileSize.textContent = formatFileSize(file.size);

            fileInfo.appendChild(fileName);
            fileInfo.appendChild(fileSize);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => {
                selectedFiles.splice(index, 1);
                updateUploadPreview();
                uploadBtn.disabled = selectedFiles.length === 0;
                uploadBtn.textContent = selectedFiles.length > 0 ? `Upload ${selectedFiles.length} Files` : 'Upload Files';
            };

            previewItem.appendChild(img);
            previewItem.appendChild(fileInfo);
            previewItem.appendChild(removeBtn);
            previewContainer.appendChild(previewItem);
        });
    }
}

// Close upload modal
function closeUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) {
        // Clean up event handlers before removing modal
        if (window.uploadModalHandlers) {
            const fileInput = document.getElementById('fileInput');
            const dropZone = document.getElementById('dropZone');
            const uploadBtn = document.getElementById('uploadBtn');
            
            if (fileInput && window.uploadModalHandlers.fileInputChange) {
                fileInput.removeEventListener('change', window.uploadModalHandlers.fileInputChange);
            }
            if (dropZone) {
                if (window.uploadModalHandlers.dropZoneClick) {
                    dropZone.removeEventListener('click', window.uploadModalHandlers.dropZoneClick);
                }
                if (window.uploadModalHandlers.dragOver) {
                    dropZone.removeEventListener('dragover', window.uploadModalHandlers.dragOver);
                }
                if (window.uploadModalHandlers.dragLeave) {
                    dropZone.removeEventListener('dragleave', window.uploadModalHandlers.dragLeave);
                }
                if (window.uploadModalHandlers.drop) {
                    dropZone.removeEventListener('drop', window.uploadModalHandlers.drop);
                }
            }
            if (uploadBtn && window.uploadModalHandlers.uploadClick) {
                uploadBtn.removeEventListener('click', window.uploadModalHandlers.uploadClick);
            }
            
            // Clear the handlers reference
            window.uploadModalHandlers = null;
        }
        
        modal.classList.remove('active');
        // Clean up after a delay to allow animation
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Image compression function for upload optimization
async function compressImage(file, options = {}) {
    const {
        quality = 0.85, // 85% quality for better balance (increased from 80%)
        maxWidth = 3000, // Increased for professional quality
        maxHeight = 3000, // Increased for professional quality
        format = 'image/jpeg' // Always convert to JPEG for consistency
    } = options;

    // Skip compression for RAW files and small files
    const extension = file.name.toLowerCase().split('.').pop();
    const rawFormats = ['nef', 'cr2', 'cr3', 'arw', 'dng', 'raf', 'orf', 'rw2', '3fr', 'raw'];
    if (rawFormats.includes(extension)) {
        console.log(`⏭️ Skipping compression for ${file.name} (RAW format)`);
        return file;
    }
    
    // Skip compression for already small files
    if (file.size < 1024 * 1024) { // Less than 1MB
        console.log(`⏭️ Skipping compression for ${file.name} (already small: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        return file;
    }

    // Skip non-image files
    if (!file.type.startsWith('image/')) {
        return file;
    }
    
    // Intelligent quality adjustment based on file size
    let adjustedQuality = quality;
    if (file.size > 50 * 1024 * 1024) { // > 50MB
        adjustedQuality = 0.7; // More aggressive compression for very large files
        console.log(`🎯 Adjusting quality to ${adjustedQuality} for large file: ${file.name}`);
    } else if (file.size > 20 * 1024 * 1024) { // > 20MB
        adjustedQuality = 0.75;
        console.log(`🎯 Adjusting quality to ${adjustedQuality} for medium-large file: ${file.name}`);
    }

    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            try {
                // Calculate optimal dimensions
                let width = img.width;
                let height = img.height;
                
                // Scale down if needed
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (maxHeight / height) * width;
                    height = maxHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw with high quality
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to blob
                canvas.toBlob((blob) => {
                    if (!blob) {
                        console.warn(`⚠️ Compression failed for ${file.name}, using original`);
                        resolve(file);
                        return;
                    }
                    
                    const compressedFile = new File(
                        [blob],
                        file.name.replace(/\.[^/.]+$/, '.jpg'),
                        { type: format, lastModified: Date.now() }
                    );
                    
                    const reduction = ((file.size - compressedFile.size) / file.size * 100).toFixed(1);
                    console.log(`🗜️ ${file.name} compressed by ${reduction}% (${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB)`);
                    resolve(compressedFile);
                }, format, quality);
            } catch (error) {
                console.warn(`⚠️ Compression error for ${file.name}:`, error);
                resolve(file);
            }
        };
        
        img.onerror = () => {
            console.warn(`⚠️ Failed to load ${file.name} for compression`);
            resolve(file);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// Enhanced upload function with MULTIPART optimization for 2-4x faster uploads
async function uploadPhotos(sessionId, files) {
        if (files.length === 0) return;

        try {
            console.log(`🚀 Starting OPTIMIZED MULTIPART upload of ${files.length} files...`);

            const authToken = await getAuthToken();
            if (!authToken) {
                throw new Error('Authentication required for photo upload');
            }

            // Compress images before upload for optimal performance
            console.log('🗜️ Compressing images for optimal upload...');
            const processedFiles = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const compressedFile = await compressImage(file);
                processedFiles.push(compressedFile);
            }

            // Show enhanced progress modal with per-file tracking
            showEnhancedUploadProgress(processedFiles.length);

            // Separate files by size for optimal upload strategy
            // Use direct R2 for virtually all files to avoid blocking the server
            const DIRECT_UPLOAD_THRESHOLD = 512 * 1024; // 512KB - use direct R2 for all but tiny files
            const largeFiles = processedFiles.filter(f => f.size > DIRECT_UPLOAD_THRESHOLD);
            const smallFiles = processedFiles.filter(f => f.size <= DIRECT_UPLOAD_THRESHOLD);
            
            console.log(`📊 Upload strategy: ${largeFiles.length} direct R2 uploads (non-blocking), ${smallFiles.length} server uploads`);
            
            let totalUploaded = 0;
            let totalFailed = 0;
            
            // FAST PATH: Upload files directly to R2 using presigned URLs (non-blocking, scalable)
            if (largeFiles.length > 0) {
                console.log(`⚡ Using DIRECT R2 upload for ${largeFiles.length} files (non-blocking)...`);
                
                try {
                    // Get presigned URLs for direct R2 upload
                    const presignedResponse = await fetch('/api/r2/generate-presigned-urls', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            sessionId,
                            files: largeFiles.map(f => ({
                                filename: f.name,
                                size: f.size,
                                fileType: 'gallery'
                            }))
                        })
                    });
                    
                    if (presignedResponse.ok) {
                        const presignedData = await presignedResponse.json();
                        
                        if (presignedData.success && presignedData.urls) {
                            // Upload files directly to R2 with intelligent concurrency
                            const MAX_CONCURRENT = 8; // Increased concurrency for faster uploads
                            
                            for (let i = 0; i < presignedData.urls.length; i += MAX_CONCURRENT) {
                                const batch = presignedData.urls.slice(i, i + MAX_CONCURRENT);
                                const batchFiles = largeFiles.slice(i, i + MAX_CONCURRENT);
                                
                                const uploadPromises = batch.map(async (urlInfo, idx) => {
                                    if (urlInfo.error) {
                                        console.error(`Failed to get presigned URL for ${urlInfo.filename}`);
                                        return false;
                                    }
                                    
                                    const file = batchFiles[idx];
                                    const fileIndex = processedFiles.indexOf(file);
                                    
                                    try {
                                        updateFileProgress(fileIndex, file.name, 'uploading', 0);
                                        
                                        // Direct upload to R2 using presigned URL
                                        const uploadResponse = await fetch(urlInfo.url, {
                                            method: 'PUT',
                                            body: file,
                                            headers: {
                                                'Content-Type': urlInfo.contentType || file.type
                                            }
                                        });
                                        
                                        if (uploadResponse.ok) {
                                            updateFileProgress(fileIndex, file.name, 'completed', 100);
                                            console.log(`✅ Direct R2 upload completed: ${file.name}`);
                                            return true;
                                        } else {
                                            throw new Error(`Upload failed with status ${uploadResponse.status}`);
                                        }
                                    } catch (uploadError) {
                                        console.error(`Direct upload failed for ${file.name}:`, uploadError);
                                        updateFileProgress(fileIndex, file.name, 'failed', 0);
                                        return false;
                                    }
                                });
                                
                                const results = await Promise.all(uploadPromises);
                                const successCount = results.filter(r => r === true).length;
                                totalUploaded += successCount;
                                totalFailed += results.length - successCount;
                                
                                // Update overall progress
                                const completedCount = totalUploaded + totalFailed;
                                const overallProgress = Math.round((completedCount / processedFiles.length) * 100);
                                updateEnhancedProgress(overallProgress, `Uploaded ${totalUploaded}/${processedFiles.length} files`);
                            }
                            
                            // Mark upload as complete in database
                            const completeResult = await fetch('/api/r2/complete-upload', {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${authToken}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    sessionId,
                                    files: largeFiles.map(f => ({
                                        filename: f.name,
                                        size: f.size,
                                        fileType: 'gallery'
                                    }))
                                })
                            });
                            
                            if (completeResult.ok) {
                                console.log('✅ Large file uploads completed and tracked');
                            } else {
                                console.warn('⚠️ Failed to complete upload tracking, but files were uploaded');
                            }
                        }
                    } else {
                        console.error('Failed to get presigned URLs - retrying with multipart endpoint');
                        
                        // Fallback: Try multipart upload endpoint for large files
                        try {
                            for (const file of largeFiles) {
                                const fileIndex = processedFiles.indexOf(file);
                                console.log(`Attempting multipart upload for: ${file.name}`);
                                
                                // Create multipart upload
                                const createResponse = await fetch('/api/r2/multipart/create', {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${authToken}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        fileName: file.name,
                                        fileSize: file.size,
                                        contentType: file.type || 'image/jpeg',
                                        sessionId: sessionId,
                                        folderType: 'gallery'
                                    })
                                });
                                
                                if (!createResponse.ok) {
                                    throw new Error(`Failed to create multipart upload for ${file.name}`);
                                }
                                
                                const uploadData = await createResponse.json();
                                updateFileProgress(fileIndex, file.name, 'uploading', 0);
                                
                                // Upload file using the multipart endpoint
                                const formData = new FormData();
                                formData.append('data', await file.arrayBuffer());
                                
                                const uploadResponse = await fetch(`/api/r2/multipart/upload/${uploadData.fields.uploadId}`, {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${authToken}`
                                    },
                                    body: formData
                                });
                                
                                if (uploadResponse.ok) {
                                    updateFileProgress(fileIndex, file.name, 'complete', 100);
                                    totalUploaded++;
                                } else {
                                    throw new Error(`Failed to upload ${file.name}`);
                                }
                            }
                        } catch (multipartError) {
                            console.error('Multipart fallback failed:', multipartError);
                            largeFiles.forEach((file) => {
                                const fileIndex = processedFiles.indexOf(file);
                                updateFileProgress(fileIndex, file.name, 'failed', 0);
                            });
                            totalFailed += largeFiles.length;
                            showMessage('Failed to upload large files. Please try again or contact support.', 'error');
                        }
                    }
                } catch (presignedError) {
                    console.error('Presigned URL error:', presignedError);
                    // Mark large files as failed instead of trying server upload (which has size limits)
                    largeFiles.forEach((file, idx) => {
                        const fileIndex = processedFiles.indexOf(file);
                        updateFileProgress(fileIndex, file.name, 'failed', 0);
                    });
                    totalFailed += largeFiles.length;
                    showMessage(`Upload error: ${presignedError.message}. Please try again or contact support.`, 'error');
                }
            }
            
            // STANDARD PATH: Upload tiny files through server (only for files under 512KB)
            if (smallFiles.length > 0) {
                console.log(`📤 Using server upload for ${smallFiles.length} tiny files...`);
                
                const BATCH_SIZE = 8; // Increased for small files
                
                for (let i = 0; i < smallFiles.length; i += BATCH_SIZE) {
                    const batch = smallFiles.slice(i, i + BATCH_SIZE);
                    
                    // Update progress: Starting batch
                    const currentProgress = Math.round(((totalUploaded + totalFailed) / processedFiles.length) * 100);
                    updateEnhancedProgress(currentProgress, `Processing batch ${Math.floor(i/BATCH_SIZE) + 1}...`);
                    
                    // Upload current batch
                    const formData = new FormData();
                    batch.forEach((file, index) => {
                        formData.append('photos', file);
                        const fileIndex = processedFiles.indexOf(file);
                        updateFileProgress(fileIndex, file.name, 'uploading', 0);
                    });

                    try {
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
                        
                        // Update individual file progress
                        batch.forEach((file, index) => {
                            const fileIndex = processedFiles.indexOf(file);
                            updateFileProgress(fileIndex, file.name, 'completed', 100);
                        });
                        
                        totalUploaded += result.uploaded || batch.length;
                        
                    } catch (batchError) {
                        console.error(`Batch ${Math.floor(i/BATCH_SIZE) + 1} failed:`, batchError);
                        
                        // Mark batch files as failed
                        batch.forEach((file, index) => {
                            const fileIndex = processedFiles.indexOf(file);
                            updateFileProgress(fileIndex, file.name, 'failed', 0);
                        });
                        
                        totalFailed += batch.length;
                    }
                    
                    // Update overall progress
                    const overallProgress = Math.round(((totalUploaded + totalFailed) / processedFiles.length) * 100);
                    updateEnhancedProgress(overallProgress, `Uploaded ${totalUploaded}/${processedFiles.length} files`);
                }
            }

            // Upload complete
            console.log(`✅ OPTIMIZED upload complete! ${totalUploaded} uploaded, ${totalFailed} failed`);
            console.log(`⚡ Upload used MULTIPART optimization for large files`);
            updateEnhancedProgress(100, `Complete! ${totalUploaded} uploaded successfully`);
            
            if (totalFailed > 0) {
                showMessage(`Upload completed with ${totalFailed} failed files. ${totalUploaded} files uploaded successfully.`, 'warning');
            } else {
                showMessage(`Successfully uploaded all ${totalUploaded} files with MULTIPART optimization!`, 'success');
            }

            // Close progress modal after delay
            setTimeout(() => {
                hideEnhancedUploadProgress();
                const modal = document.getElementById('uploadModal');
                if (modal) {
                    modal.classList.remove('active');
                }
            }, 2000);

            // Reload photos for this session
            const galleryGrid = document.querySelector(`.gallery-grid[data-session-id="${sessionId}"]`);
            const photoCount = galleryGrid?.parentElement?.querySelector('.photo-count');
            if (galleryGrid) {
                loadSessionPhotos(sessionId, galleryGrid, photoCount);
            }

    } catch (error) {
        console.error('Upload error:', error);
        showMessage('Upload failed: ' + error.message, 'error');
        hideEnhancedUploadProgress();
    }
    
    // Enhanced progress modal functions
    function showEnhancedUploadProgress(totalFiles) {
        // Remove existing progress modal if any
        const existingModal = document.getElementById('enhancedUploadProgress');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = 'enhancedUploadProgress';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <h3 style="margin: 0 0 1rem 0; color: #333; text-align: center;">Uploading ${totalFiles} Files</h3>
                
                <!-- Overall Progress -->
                <div style="margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: #666; font-size: 14px;">Overall Progress</span>
                        <span id="overallPercent" style="color: #666; font-size: 14px;">0%</span>
                    </div>
                    <div style="background: #f0f0f0; border-radius: 10px; height: 12px; overflow: hidden;">
                        <div id="overallProgressBar" style="background: linear-gradient(45deg, #28a745, #20c997); height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 10px;"></div>
                    </div>
                    <p id="overallStatus" style="margin: 0.5rem 0 0 0; color: #666; font-size: 14px; text-align: center;">Preparing upload...</p>
                </div>
                
                <!-- File Progress List -->
                <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e1e5e9; border-radius: 8px; padding: 1rem;">
                    <div id="fileProgressList"></div>
                </div>
                
                <div style="text-align: center; margin-top: 1rem;">
                    <button onclick="cancelEnhancedUpload()" style="background: #dc3545; color: white; border: none; border-radius: 6px; padding: 0.5rem 1rem; cursor: pointer; font-size: 14px;">
                        Cancel Upload
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add file progress items
        const fileProgressList = document.getElementById('fileProgressList');
        for (let i = 0; i < totalFiles; i++) {
            const fileItem = document.createElement('div');
            fileItem.id = `fileProgress-${i}`;
            fileItem.style.cssText = `
                display: flex;
                align-items: center;
                padding: 0.5rem 0;
                border-bottom: 1px solid #f1f3f4;
                font-size: 13px;
            `;
            fileItem.innerHTML = `
                <div style="flex: 1; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Preparing...</div>
                <div style="width: 80px; text-align: right; color: #666;">Pending</div>
            `;
            fileProgressList.appendChild(fileItem);
        }
    }
    
    function updateEnhancedProgress(percent, status) {
        const progressBar = document.getElementById('overallProgressBar');
        const percentDisplay = document.getElementById('overallPercent');
        const statusDisplay = document.getElementById('overallStatus');
        
        if (progressBar) progressBar.style.width = percent + '%';
        if (percentDisplay) percentDisplay.textContent = percent + '%';
        if (statusDisplay) statusDisplay.textContent = status;
    }
    
    function updateFileProgress(fileIndex, fileName, status, percent) {
        const fileItem = document.getElementById(`fileProgress-${fileIndex}`);
        if (!fileItem) return;
        
        const statusColors = {
            'uploading': '#007bff',
            'completed': '#28a745',
            'failed': '#dc3545',
            'pending': '#6c757d'
        };
        
        const statusText = {
            'uploading': `${percent}%`,
            'completed': 'Done',
            'failed': 'Failed',
            'pending': 'Pending'
        };
        
        fileItem.innerHTML = `
            <div style="flex: 1; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${fileName}">${fileName}</div>
            <div style="width: 80px; text-align: right; color: ${statusColors[status]}; font-weight: 500;">${statusText[status]}</div>
        `;
    }
    
    function hideEnhancedUploadProgress() {
        const modal = document.getElementById('enhancedUploadProgress');
        if (modal) {
            modal.remove();
        }
    }
    
    function cancelEnhancedUpload() {
        // This would cancel the upload if we implement abortion
        hideEnhancedUploadProgress();
        showMessage('Upload cancelled by user', 'info');
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
async function deletePhoto(sessionId, folderType, filename) {
    if (!confirm('Are you sure you want to delete this photo?')) {
        return;
    }

    try {
        const authToken = await getAuthToken();
        if (!authToken) {
            throw new Error('Authentication required for photo deletion');
        }

        // Show loading indicator
        const deleteBtn = document.querySelector(`[data-filename="${filename}"] .photo-delete-btn`);
        if (deleteBtn) {
            deleteBtn.innerHTML = '⏳';
            deleteBtn.disabled = true;
        }

        // Use unified deletion endpoint that removes from both storage and database
        const response = await fetch(`/api/sessions/${sessionId}/files/${folderType}/${encodeURIComponent(filename)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
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
        
        // Show success message with storage reclaimed if available
        const message = result.reclaimedMB 
            ? `Photo deleted successfully! ${result.reclaimedMB}MB reclaimed`
            : 'Photo deleted successfully!';
        showMessage(message, 'success');

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
        const deleteBtn = document.querySelector(`[data-filename="${filename}"] .photo-delete-btn`);
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
        window.location.replace('/secure-login.html');
        
    } catch (error) {
        console.error('Logout error:', error);
        
        // Force logout even on error
        currentUser = null;
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('manualLogout', 'true');
        
        window.location.replace('/secure-login.html');
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
    const fromAuth = document.referrer.includes('secure-login.html') || sessionStorage.getItem('fromAuth') === 'true';
    
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
    const fromAuth = document.referrer.includes('secure-login.html') || sessionStorage.getItem('fromAuth') === 'true';
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
                                <button onclick="window.location.href='${result.smsLink}'" class="btn btn-secondary" style="margin: 5px;">
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
                } else {
                    const error = await response.json();
                    showMessage(error.error || 'Failed to create booking agreement', 'error');
                }
            } catch (error) {
                console.error('Error creating booking agreement:', error);
                showMessage('Error creating booking agreement', 'error');
            }
        };




        window.sendContract = async function(contractId) {
            console.log('sendContract called with ID:', contractId);
            
            try {
                // Fetch the contract details
                const response = await fetch(`/api/booking/agreements/${contractId}`);
                if (!response.ok) {
                    showMessage('Failed to load contract', 'error');
                    return;
                }
                
                const contract = await response.json();
                
                // Find the session for this contract
                const sessionResponse = await fetch(`/api/sessions/${contract.session_id}`);
                if (!sessionResponse.ok) {
                    showMessage('Failed to load session details', 'error');
                    return;
                }
                
                const session = await sessionResponse.json();
                
                // Show modal for choosing send method
                const modal = document.createElement('div');
                modal.className = 'send-options-modal';
                modal.style = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
                
                modal.innerHTML = `
                    <div class="send-options-content" style="background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%;">
                        <h3>Send Contract for Signature</h3>
                        <p>How would you like to send the contract to ${session.clientName}?</p>
                        
                        <div class="send-options" style="display: flex; gap: 15px; margin: 20px 0;">
                            <div class="send-option" style="flex: 1; padding: 20px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.3s;" 
                                 onclick="sendContractViaEmail('${contractId}', '${session.email}', '${session.clientName}')">
                                <i class="fas fa-envelope" style="font-size: 24px; color: #3498db; margin-bottom: 10px;"></i>
                                <h4>Email</h4>
                                <p style="font-size: 14px; color: #666;">${session.email || 'No email provided'}</p>
                                ${!session.email ? '<p style="color: #dc3545; font-size: 12px;">Email address required</p>' : ''}
                            </div>
                            
                            <div class="send-option" style="flex: 1; padding: 20px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.3s;"
                                 onclick="sendContractViaSMS('${contractId}', '${session.phoneNumber}', '${session.clientName}')">
                                <i class="fas fa-sms" style="font-size: 24px; color: #27ae60; margin-bottom: 10px;"></i>
                                <h4>Text Message (SMS)</h4>
                                <p style="font-size: 14px; color: #666;">${session.phoneNumber || 'No phone number provided'}</p>
                                ${!session.phoneNumber ? '<p style="color: #dc3545; font-size: 12px;">Phone number required</p>' : ''}
                            </div>
                        </div>
                        
                        <div style="text-align: center; padding-top: 15px; border-top: 1px solid #e0e0e0; margin-top: 20px;">
                            <button class="btn btn-secondary" onclick="closeContractSendModal()">Cancel</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                // Add hover effects
                modal.querySelectorAll('.send-option').forEach(option => {
                    option.addEventListener('mouseenter', function() {
                        this.style.borderColor = '#3498db';
                        this.style.background = '#f8f9fa';
                    });
                    option.addEventListener('mouseleave', function() {
                        this.style.borderColor = '#e0e0e0';
                        this.style.background = 'white';
                    });
                });
                
            } catch (error) {
                console.error('Error in sendContract:', error);
                showMessage('Error preparing to send contract', 'error');
            }
        };
        
        // Helper function to close the modal
        window.closeContractSendModal = function() {
            const modal = document.querySelector('.send-options-modal');
            if (modal) modal.remove();
        };
        
        // Send via Email
        window.sendContractViaEmail = async function(contractId, email, clientName) {
            if (!email) {
                showMessage('Email address is required', 'error');
                return;
            }
            
            closeContractSendModal();
            
            try {
                const response = await fetch(`/api/booking/agreements/${contractId}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientEmail: email,
                        clientName: clientName,
                        sendMethod: 'email'
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    
                    // Use the mailto URL from backend
                    if (result.mailtoUrl) {
                        window.location.href = result.mailtoUrl;
                        showMessage('Opening email client...', 'success');
                    }
                } else {
                    showMessage('Failed to prepare contract', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage('Error sending contract', 'error');
            }
        };
        
        // Send via SMS
        window.sendContractViaSMS = async function(contractId, phoneNumber, clientName) {
            if (!phoneNumber) {
                showMessage('Phone number is required', 'error');
                return;
            }
            
            closeContractSendModal();
            
            try {
                const response = await fetch(`/api/booking/agreements/${contractId}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientPhone: phoneNumber,
                        clientName: clientName,
                        sendMethod: 'sms'
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    
                    // Use the sms URL from backend
                    if (result.smsUrl) {
                        window.location.href = result.smsUrl;
                        showMessage('Opening SMS app...', 'success');
                    }
                } else {
                    showMessage('Failed to prepare contract', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage('Error sending contract', 'error');
            }
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
                @page {
                    size: A4;
                    margin: 1in;
                }
                
                body { 
                    font-family: Arial, sans-serif; 
                    line-height: 1.4; 
                    color: #000; 
                    max-width: 100%; 
                    margin: 0; 
                    padding: 0;
                    background: white;
                }
                
                .container {
                    max-width: 100%;
                    margin: 0;
                    padding: 0;
                }
                
                .header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                    border-bottom: 2px solid #333; 
                    padding-bottom: 20px; 
                }
                
                .header h1 {
                    font-size: 24px;
                    margin: 0 0 15px 0;
                    color: #000;
                }
                
                .content { 
                    line-height: 1.6; 
                    margin-bottom: 40px; 
                    color: #000;
                }
                
                .signature-section { 
                    border: 2px solid #333; 
                    padding: 20px; 
                    margin-top: 30px; 
                    background: #f9f9f9; 
                    page-break-inside: avoid;
                }
                
                .signature-info { 
                    margin-bottom: 15px; 
                }
                
                .signature-info p { 
                    margin: 5px 0; 
                    color: #000; 
                    font-size: 14px;
                }
                
                .signature-image { 
                    text-align: center; 
                    margin: 20px 0; 
                }
                
                .signature-image img { 
                    max-width: 300px; 
                    height: auto; 
                    border: 1px solid #333;
                    background: white;
                }
                
                .status-badge { 
                    background: #28a745; 
                    color: white; 
                    padding: 8px 15px; 
                    border-radius: 4px; 
                    display: inline-block; 
                    font-weight: bold;
                }
                
                h1, h2, h3, h4, h5, h6, p, div, span, strong { 
                    color: #000 !important; 
                }
                
                .pdf-controls {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                    background: white;
                    padding: 15px;
                    border: 2px solid #007bff;
                    border-radius: 8px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                
                .pdf-btn {
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                }
                
                .pdf-btn:hover {
                    background: #0056b3;
                }
                
                @media print {
                    .pdf-controls {
                        display: none !important;
                    }
                    
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            </style>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 100);
                };
                
                function downloadPDF() {
                    window.print();
                }
            </script>
        </head>
        <body>
            <div class="pdf-controls">
                <button class="pdf-btn" onclick="downloadPDF()">📄 Save as PDF</button>
            </div>
            
            <div class="container">
                <div class="header">
                    <h1>Photography Contract</h1>
                    <p><strong>Client:</strong> ${clientName}</p>
                    <p><strong>Status:</strong> <span class="status-badge">${contract.status === 'signed' ? 'ELECTRONICALLY SIGNED' : 'PENDING'}</span></p>
                </div>
                
                <div class="content">
                    ${content}
                </div>
                
                ${contract.status === 'signed' && contract.signature_info ? `
                    <div class="signature-section">
                        <h3 style="text-align: center; color: #28a745; margin-bottom: 20px;">✓ Digital Signature</h3>
                        <div class="signature-info">
                            <p><strong>Electronically Signed by:</strong> ${contract.signature_info.signer_name}</p>
                            <p><strong>Email Address:</strong> ${contract.signature_info.signer_email}</p>
                            <p><strong>Date & Time:</strong> ${new Date(contract.signature_info.signed_at).toLocaleString()}</p>
                        </div>
                        ${contract.signature_info.signature_data ? `
                            <div class="signature-image">
                                <p><strong>Client Signature:</strong></p>
                                <img src="${contract.signature_info.signature_data}" alt="Client Electronic Signature">
                            </div>
                        ` : ''}
                        <p style="text-align: center; font-style: italic; margin-top: 20px; font-size: 12px;">
                            This signature was captured electronically and is legally binding.
                        </p>
                    </div>
                ` : contract.status === 'signed' ? `
                    <div class="signature-section">
                        <h3>Signature Information</h3>
                        <p><strong>Status:</strong> Signed</p>
                        <p><strong>Signed Date:</strong> ${new Date(contract.signed_at).toLocaleDateString()}</p>
                    </div>
                ` : ''}
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

// Show contract selection dialog for multiple contracts
function showContractSelectionDialog(contracts, clientName) {
    const dialogHTML = `
        <div class="contract-selection-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div class="contract-selection-dialog" style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;">
                <h3 style="margin-top: 0; color: #333;">Select Contract to Download</h3>
                <div class="contract-list">
                    ${contracts.map((contract, index) => `
                        <div class="contract-option" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; cursor: pointer;" onclick="selectContract(${index})">
                            <h4 style="margin: 0 0 10px 0; color: #333;">Contract ${index + 1}</h4>
                            <p style="margin: 5px 0; color: #666;"><strong>Status:</strong> ${contract.status}</p>
                            ${contract.status === 'signed' ? `<p style="margin: 5px 0; color: #666;"><strong>Signed:</strong> ${new Date(contract.signed_at).toLocaleDateString()}</p>` : ''}
                            <p style="margin: 5px 0; color: #666; font-size: 14px;">${(contract.content || 'No content').substring(0, 100)}...</p>
                        </div>
                    `).join('')}
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="closeContractSelectionDialog()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', dialogHTML);
    
    // Store contracts for selection
    window.selectedContracts = contracts;
    window.selectedClientName = clientName;
}

// Handle contract selection
window.selectContract = function(index) {
    const contract = window.selectedContracts[index];
    const clientName = window.selectedClientName;
    
    closeContractSelectionDialog();
    downloadContractPDF(contract, clientName);
};

// Close contract selection dialog
window.closeContractSelectionDialog = function() {
    const dialog = document.querySelector('.contract-selection-overlay');
    if (dialog) {
        dialog.remove();
    }
    delete window.selectedContracts;
    delete window.selectedClientName;
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
                        expiresInDays: 180
                    })
                });
                
                if (!tokenResponse.ok) {
                    throw new Error('Failed to generate token');
                }
                
                const tokenData = await tokenResponse.json();
                const galleryUrl = `${window.location.origin}/g/${sessionId}?token=${tokenData.token}`;
                
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