// Photography Session Scheduler
// Session management system with cloud database

// Global variables
let sessions = [];
let sessionIdCounter = 1;

// API helper functions

// DOM elements
const sessionForm = document.getElementById('sessionForm');
const sessionsContainer = document.getElementById('sessionsContainer');
const messageContainer = document.getElementById('messageContainer');

// API call helper with authentication
async function apiCall(url, options = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // Add authentication header if user is logged in and has a token
        if (window.currentUser && window.userToken) {
            headers['Authorization'] = `Bearer ${window.userToken}`;
        }
        
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        
        // More specific error messages for debugging
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
        } else if (error.name === 'SyntaxError') {
            throw new Error('Server response error: Invalid data format received.');
        } else {
            throw new Error(`API error: ${error.message}`);
        }
    }
}

// Convert database format to frontend format
function transformSessionData(dbSession) {
    return {
        id: dbSession.id,
        sessionType: dbSession.session_type,
        clientName: dbSession.client_name,
        dateTime: dbSession.date_time,
        location: dbSession.location,
        phoneNumber: dbSession.phone_number,
        email: dbSession.email,
        price: parseFloat(dbSession.price),
        duration: dbSession.duration,
        notes: dbSession.notes,
        contractSigned: dbSession.contract_signed,
        paid: dbSession.paid,
        edited: dbSession.edited,
        delivered: dbSession.delivered,
        createdBy: dbSession.created_by,
        createdAt: dbSession.created_at,
        updatedAt: dbSession.updated_at,
        userEmail: dbSession.user_email,
        userDisplayName: dbSession.user_display_name
    };
}

// Global variables for admin view
let adminSessions = [];
let isAdminUser = false;

// Load sessions from database
async function loadSessions() {
    try {
        console.log('Loading sessions from database...');
        const data = await apiCall('/api/sessions');
        console.log('Sessions loaded:', data);
        
        // Transform database format to frontend format
        sessions = (data || []).map(transformSessionData);
        renderSessions();
        
        if (sessions.length === 0) {
            console.log('No sessions found in database');
        }
        
        // Check if user is admin and load admin sessions
        if (window.currentUser && window.currentUser.email === 'lancecasselman@icloud.com') {
            isAdminUser = true;
            loadAdminSessions();
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        
        // Check if this is an authentication error
        if (error.message.includes('Unauthorized')) {
            console.log('Authentication error - setting up fallback user');
            
            // Set up fallback user if not already set
            if (!window.currentUser) {
                window.currentUser = { uid: 'fallback-user', email: 'demo@example.com' };
                window.userToken = null;
            }
            
            // Try to load sessions again with fallback user
            console.log('Retrying session load with fallback user');
            setTimeout(() => {
                loadSessions();
            }, 1000);
            
            return; // Don't show error message, just retry
        } else {
            showMessage(`Error loading sessions: ${error.message}. Please check your connection and try again.`, 'error');
        }
        
        // Fallback to empty sessions array
        sessions = [];
        renderSessions();
        
        // Additional mobile debugging
        if (navigator.userAgent.includes('Mobile')) {
            console.log('Mobile device - API call failed, showing error details');
            console.log('User agent:', navigator.userAgent);
            console.log('Current URL:', window.location.href);
        }
    }
}

// Render admin sessions
function renderAdminSessions() {
    // Check if admin container exists, if not create it
    let adminContainer = document.getElementById('adminSessionsContainer');
    if (!adminContainer) {
        adminContainer = document.createElement('div');
        adminContainer.id = 'adminSessionsContainer';
        adminContainer.style.cssText = `
            margin-top: 40px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #dee2e6;
        `;
        
        // Add admin label
        const adminLabel = document.createElement('h3');
        adminLabel.textContent = '🔒 Admin View: All Sessions';
        adminLabel.style.cssText = `
            margin: 0 0 20px 0;
            color: #495057;
            font-size: 18px;
            font-weight: 600;
        `;
        adminContainer.appendChild(adminLabel);
        
        // Add admin sessions list container
        const adminSessionsList = document.createElement('div');
        adminSessionsList.id = 'adminSessionsList';
        adminContainer.appendChild(adminSessionsList);
        
        // Insert admin container after the main sessions container
        const mainContainer = document.querySelector('.container');
        mainContainer.appendChild(adminContainer);
    }
    
    const adminSessionsList = document.getElementById('adminSessionsList');
    adminSessionsList.innerHTML = '';
    
    if (adminSessions.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.textContent = 'No sessions found in the system.';
        emptyState.style.cssText = `
            color: #6c757d;
            font-style: italic;
            padding: 20px;
            text-align: center;
        `;
        adminSessionsList.appendChild(emptyState);
        return;
    }
    
    // Sort sessions by date/time
    const sortedSessions = [...adminSessions].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    
    // Create admin session items
    sortedSessions.forEach(session => {
        const sessionItem = createAdminSessionItem(session);
        adminSessionsList.appendChild(sessionItem);
    });
}

// Create admin session item
function createAdminSessionItem(session) {
    const sessionDate = new Date(session.dateTime);
    const formattedDate = sessionDate.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    const formattedTime = sessionDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const item = document.createElement('div');
    item.style.cssText = `
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        padding: 15px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;
    
    const sessionInfo = document.createElement('div');
    sessionInfo.style.cssText = `
        flex: 1;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 15px;
        align-items: center;
    `;
    
    const sessionDetails = document.createElement('div');
    const sessionTitle = document.createElement('div');
    sessionTitle.textContent = session.sessionType;
    sessionTitle.style.cssText = `
        font-weight: 600;
        color: #495057;
        margin-bottom: 2px;
    `;
    const clientName = document.createElement('div');
    clientName.textContent = session.clientName;
    clientName.style.cssText = `
        color: #6c757d;
        font-size: 14px;
    `;
    sessionDetails.appendChild(sessionTitle);
    sessionDetails.appendChild(clientName);
    
    const dateTimeDiv = document.createElement('div');
    dateTimeDiv.innerHTML = `<strong>${formattedDate}</strong><br><span style="color: #6c757d;">${formattedTime}</span>`;
    
    const phoneDiv = document.createElement('div');
    phoneDiv.innerHTML = `<strong>Phone:</strong><br><span style="color: #6c757d;">${session.phoneNumber || 'No phone number'}</span>`;
    
    // Add call and text buttons only if phone number exists
    if (session.phoneNumber && session.phoneNumber.trim() !== '') {
        const phoneActionsDiv = document.createElement('div');
        phoneActionsDiv.style.cssText = `
            display: flex;
            gap: 5px;
            margin-top: 5px;
        `;
        
        const callBtn = document.createElement('a');
        callBtn.href = `tel:${session.phoneNumber}`;
        callBtn.textContent = '📞';
        callBtn.style.cssText = `
            text-decoration: none;
            font-size: 14px;
            cursor: pointer;
            padding: 3px 6px;
            border-radius: 3px;
            background: #e8f5e8;
            border: 1px solid #4CAF50;
            transition: background-color 0.2s;
        `;
        callBtn.title = 'Call';
        callBtn.onmouseover = () => callBtn.style.backgroundColor = '#d4edda';
        callBtn.onmouseout = () => callBtn.style.backgroundColor = '#e8f5e8';
        
        const textBtn = document.createElement('a');
        textBtn.href = `sms:${session.phoneNumber}`;
        textBtn.textContent = '💬';
        textBtn.style.cssText = `
            text-decoration: none;
            font-size: 14px;
            cursor: pointer;
            padding: 3px 6px;
            border-radius: 3px;
            background: #e3f2fd;
            border: 1px solid #2196F3;
            transition: background-color 0.2s;
        `;
        textBtn.title = 'Text';
        textBtn.onmouseover = () => textBtn.style.backgroundColor = '#bbdefb';
        textBtn.onmouseout = () => textBtn.style.backgroundColor = '#e3f2fd';
        
        phoneActionsDiv.appendChild(callBtn);
        phoneActionsDiv.appendChild(textBtn);
        phoneDiv.appendChild(phoneActionsDiv);
    }
    
    const priceDiv = document.createElement('div');
    priceDiv.innerHTML = `<strong>$${session.price}</strong><br><span style="color: #6c757d;">${session.duration} min</span>`;
    
    sessionInfo.appendChild(sessionDetails);
    sessionInfo.appendChild(dateTimeDiv);
    sessionInfo.appendChild(phoneDiv);
    sessionInfo.appendChild(priceDiv);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.style.cssText = `
        background: #dc3545;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin-left: 15px;
    `;
    deleteBtn.onclick = () => adminDeleteSession(session.id);
    
    item.appendChild(sessionInfo);
    item.appendChild(deleteBtn);
    
    return item;
}

// Admin delete session function
async function adminDeleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
        return;
    }
    
    try {
        await apiCall(`/api/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        
        // Remove from admin sessions array
        adminSessions = adminSessions.filter(session => session.id !== sessionId);
        
        // Remove from regular sessions array if it exists there
        sessions = sessions.filter(session => session.id !== sessionId);
        
        // Re-render both views
        renderSessions();
        renderAdminSessions();
        
        showMessage('Session deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting session:', error);
        showMessage('Error deleting session. Please try again.', 'error');
    }
}

// Load admin sessions (all sessions from all users)
async function loadAdminSessions() {
    try {
        console.log('Loading admin sessions...');
        const data = await apiCall('/api/admin/sessions');
        console.log('Admin sessions loaded:', data);
        
        // Transform database format to frontend format
        adminSessions = (data || []).map(transformSessionData);
        renderAdminSessions();
        
        if (adminSessions.length === 0) {
            console.log('No admin sessions found');
        }
    } catch (error) {
        console.error('Error loading admin sessions:', error);
        showMessage(`Error loading admin sessions: ${error.message}`, 'error');
        
        // Fallback to empty admin sessions array
        adminSessions = [];
        renderAdminSessions();
    }
}

// Make loadSessions available globally for auth.js
window.loadSessions = loadSessions;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Set minimum datetime to current date/time
    const now = new Date();
    const formattedNow = now.toISOString().slice(0, 16);
    document.getElementById('dateTime').min = formattedNow;
    
    // Add form submit event listener
    sessionForm.addEventListener('submit', handleFormSubmit);
    
    // Check server status to determine if we should load sessions
    try {
        const statusResponse = await fetch('/api/status');
        const statusData = await statusResponse.json();
        
        // Load sessions if user is authenticated OR if authentication is disabled
        if (window.currentUser || !statusData.authenticationEnabled) {
            loadSessions();
        } else {
            // Initial render for empty state
            renderSessions();
        }
    } catch (error) {
        console.error('Error checking server status:', error);
        // Fallback to loading sessions if we can't check status
        loadSessions();
    }
    
    // Mobile-specific debugging
    if (navigator.userAgent.includes('Mobile')) {
        console.log('Mobile device detected');
    }
});

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    // Check if we need authentication (only if Firebase is enabled)
    const statusResponse = await fetch('/api/status');
    const statusData = await statusResponse.json();
    
    if (statusData.authenticationEnabled && !window.currentUser) {
        showMessage('Please log in to add sessions.', 'error');
        return;
    }
    
    try {
        const formData = new FormData(sessionForm);
        const sessionData = {
            sessionType: formData.get('sessionType').trim(),
            clientName: formData.get('clientName').trim(),
            dateTime: formData.get('dateTime'),
            location: formData.get('location').trim(),
            phoneNumber: formData.get('phoneNumber').trim(),
            email: formData.get('email').trim(),
            price: parseFloat(formData.get('price')),
            duration: parseInt(formData.get('duration')),
            notes: formData.get('notes').trim(),
            contractSigned: formData.has('contractSigned'),
            paid: formData.has('paid'),
            edited: formData.has('edited'),
            delivered: formData.has('delivered'),
            createdBy: window.currentUser ? window.currentUser.uid : 'fallback-user'
        };
        
        // Debug: Log the form data before sending
        console.log('Form data being sent:', sessionData);
        console.log('DateTime from form:', sessionData.dateTime);
        console.log('Phone number from form:', sessionData.phoneNumber);
        
        // Validate required fields
        if (!validateSessionData(sessionData)) {
            return;
        }
        
        // Save session to database
        const savedSession = await apiCall('/api/sessions', {
            method: 'POST',
            body: JSON.stringify(sessionData)
        });
        
        // Transform and add to local sessions array
        sessions.push(transformSessionData(savedSession));
        
        // Clear form
        sessionForm.reset();
        
        // Re-render sessions
        renderSessions();
        
        // Show success message
        showMessage('Session added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding session:', error);
        showMessage('Error adding session. Please try again.', 'error');
    }
}

// Validate session data
function validateSessionData(data) {
    const requiredFields = ['sessionType', 'clientName', 'dateTime', 'location', 'phoneNumber', 'email'];
    
    for (const field of requiredFields) {
        if (!data[field] || data[field].toString().trim() === '') {
            showMessage(`Please fill in the ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} field.`, 'error');
            return false;
        }
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        showMessage('Please enter a valid email address.', 'error');
        return false;
    }
    
    // Validate price
    if (isNaN(data.price) || data.price < 0) {
        showMessage('Please enter a valid price.', 'error');
        return false;
    }
    
    // Validate duration
    if (isNaN(data.duration) || data.duration < 1) {
        showMessage('Please enter a valid duration in minutes.', 'error');
        return false;
    }
    
    // Validate date is in the future
    const sessionDate = new Date(data.dateTime);
    if (sessionDate < new Date()) {
        showMessage('Session date must be in the future.', 'error');
        return false;
    }
    
    return true;
}

// Render all sessions
function renderSessions() {
    // Clear existing content
    sessionsContainer.innerHTML = '';
    
    if (sessions.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        
        const message = document.createElement('p');
        message.textContent = 'No sessions scheduled yet. Add your first session above!';
        
        emptyState.appendChild(message);
        sessionsContainer.appendChild(emptyState);
        return;
    }
    
    // Sort sessions by date/time
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    
    // Create and append session cards using DOM methods
    sortedSessions.forEach(session => {
        const sessionCard = createSessionCard(session);
        sessionsContainer.appendChild(sessionCard);
    });
}

// Create session card using safe DOM methods
function createSessionCard(session) {
    try {
        const sessionDate = new Date(session.dateTime);
        const formattedDate = sessionDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = sessionDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    
    // Create main card container
    const card = document.createElement('div');
    card.className = 'session-card';
    
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
    
    const calendarBtn = document.createElement('button');
    calendarBtn.className = 'btn btn-success';
    calendarBtn.textContent = '📅 Add to Calendar';
    calendarBtn.onclick = () => exportToCalendar(session.id);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.onclick = () => deleteSession(session.id);
    
    actions.appendChild(calendarBtn);
    actions.appendChild(deleteBtn);
    
    header.appendChild(headerInfo);
    header.appendChild(actions);
    
    // Create details section
    const details = document.createElement('div');
    details.className = 'session-details';
    
    // Helper function to create detail items
    function createDetailItem(label, value) {
        const item = document.createElement('div');
        item.className = 'detail-item';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'detail-label';
        labelDiv.textContent = label;
        
        const valueDiv = document.createElement('div');
        valueDiv.className = 'detail-value';
        valueDiv.textContent = value;
        
        item.appendChild(labelDiv);
        item.appendChild(valueDiv);
        
        return item;
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
        
        const phoneText = document.createElement('span');
        phoneText.textContent = phoneNumber || 'No phone number';
        
        // Only create buttons if phone number exists
        if (phoneNumber && phoneNumber.trim() !== '') {
            const callBtn = document.createElement('a');
            callBtn.href = `tel:${phoneNumber}`;
            callBtn.textContent = '📞';
            callBtn.style.cssText = `
                text-decoration: none;
                font-size: 16px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                background: #e8f5e8;
                border: 1px solid #4CAF50;
                transition: background-color 0.2s;
            `;
            callBtn.title = 'Call';
            callBtn.onmouseover = () => callBtn.style.backgroundColor = '#d4edda';
            callBtn.onmouseout = () => callBtn.style.backgroundColor = '#e8f5e8';
            
            const textBtn = document.createElement('a');
            textBtn.href = `sms:${phoneNumber}`;
            textBtn.textContent = '💬';
            textBtn.style.cssText = `
                text-decoration: none;
                font-size: 16px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                background: #e3f2fd;
                border: 1px solid #2196F3;
                transition: background-color 0.2s;
            `;
            textBtn.title = 'Text';
            textBtn.onmouseover = () => textBtn.style.backgroundColor = '#bbdefb';
            textBtn.onmouseout = () => textBtn.style.backgroundColor = '#e3f2fd';
            
            valueDiv.appendChild(callBtn);
            valueDiv.appendChild(textBtn);
        }
        
        valueDiv.insertBefore(phoneText, valueDiv.firstChild);
        
        item.appendChild(labelDiv);
        item.appendChild(valueDiv);
        
        return item;
    }
    
    details.appendChild(createDetailItem('Date & Time', `${formattedDate} at ${formattedTime}`));
    details.appendChild(createDetailItem('Location', session.location));
    details.appendChild(createPhoneDetailItem('Phone', session.phoneNumber));
    details.appendChild(createDetailItem('Email', session.email));
    details.appendChild(createDetailItem('Price', `$${session.price.toFixed(2)}`));
    details.appendChild(createDetailItem('Duration', `${session.duration} minutes`));
    
    // Create status indicators section
    const statusIndicators = document.createElement('div');
    statusIndicators.className = 'status-indicators';
    
    // Helper function to create status items
    function createStatusItem(id, checked, label, statusText) {
        const item = document.createElement('div');
        item.className = 'status-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${id}-${session.id}`;
        checkbox.checked = checked;
        checkbox.onchange = (e) => updateSessionStatus(session.id, id, e.target.checked);
        
        const labelEl = document.createElement('label');
        labelEl.htmlFor = `${id}-${session.id}`;
        labelEl.textContent = `${label} ${statusText}`;
        
        item.appendChild(checkbox);
        item.appendChild(labelEl);
        
        return item;
    }
    
    statusIndicators.appendChild(createStatusItem('contractSigned', session.contractSigned, 'Contract', session.contractSigned ? 'Signed' : 'Pending'));
    statusIndicators.appendChild(createStatusItem('paid', session.paid, 'Payment', session.paid ? 'Received' : 'Pending'));
    statusIndicators.appendChild(createStatusItem('edited', session.edited, 'Editing', session.edited ? 'Complete' : 'Pending'));
    statusIndicators.appendChild(createStatusItem('delivered', session.delivered, 'Delivery', session.delivered ? 'Complete' : 'Pending'));
    
    // Create notes section if notes exist
    if (session.notes) {
        const notesSection = document.createElement('div');
        notesSection.className = 'notes-section';
        
        const notesTitle = document.createElement('h4');
        notesTitle.textContent = 'Notes:';
        
        const notesContent = document.createElement('div');
        notesContent.className = 'notes-content';
        notesContent.textContent = session.notes;
        
        notesSection.appendChild(notesTitle);
        notesSection.appendChild(notesContent);
        
        card.appendChild(header);
        card.appendChild(details);
        card.appendChild(statusIndicators);
        card.appendChild(notesSection);
    } else {
        card.appendChild(header);
        card.appendChild(details);
        card.appendChild(statusIndicators);
    }
    
    return card;
    } catch (error) {
        console.error('Error creating session card:', error, session);
        // Return a basic error card
        const errorCard = document.createElement('div');
        errorCard.className = 'session-card';
        errorCard.style.backgroundColor = '#ffebee';
        errorCard.style.border = '1px solid #f44336';
        errorCard.innerHTML = `
            <p style="color: #f44336; padding: 10px;">
                Error displaying session: ${session.sessionType || 'Unknown'}
            </p>
        `;
        return errorCard;
    }
}

// Delete session
async function deleteSession(sessionId) {
    if (!window.currentUser) {
        showMessage('Please log in to delete sessions.', 'error');
        return;
    }
    
    if (confirm('Are you sure you want to delete this session?')) {
        try {
            await apiCall(`/api/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            
            sessions = sessions.filter(session => session.id !== sessionId);
            renderSessions();
            showMessage('Session deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting session:', error);
            showMessage('Error deleting session. Please try again.', 'error');
        }
    }
}

// Export session to calendar (.ics file)
function exportToCalendar(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
        showMessage('Session not found.', 'error');
        return;
    }
    
    try {
        const icsContent = generateICSContent(session);
        downloadICSFile(icsContent, `${session.clientName}_${session.sessionType}_Session.ics`);
        showMessage('Calendar event exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting to calendar:', error);
        showMessage('Error exporting to calendar. Please try again.', 'error');
    }
}

// Generate ICS file content
function generateICSContent(session) {
    const startDate = new Date(session.dateTime);
    const endDate = new Date(startDate.getTime() + (session.duration * 60000)); // Add duration in milliseconds
    
    // Format dates for ICS (UTC format)
    const formatICSDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };
    
    const startDateUTC = formatICSDate(startDate);
    const endDateUTC = formatICSDate(endDate);
    const createdDate = formatICSDate(new Date());
    
    // Generate unique UID
    const uid = `session-${session.id}-${Date.now()}@photographer-scheduler.com`;
    
    // Escape special characters in text fields
    const escapeICSText = (text) => {
        return text.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
    };
    
    const summary = escapeICSText(`${session.sessionType} - ${session.clientName}`);
    const description = escapeICSText([
        `Photography Session Details:`,
        `Client: ${session.clientName}`,
        `Type: ${session.sessionType}`,
        `Duration: ${session.duration} minutes`,
        `Price: $${session.price.toFixed(2)}`,
        `Phone: ${session.phoneNumber}`,
        `Email: ${session.email}`,
        session.notes ? `Notes: ${session.notes}` : ''
    ].filter(Boolean).join('\\n'));
    
    const location = escapeICSText(session.location);
    
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Photography Scheduler//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART:${startDateUTC}`,
        `DTEND:${endDateUTC}`,
        `DTSTAMP:${createdDate}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    
    return icsContent;
}

// Download ICS file
function downloadICSFile(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
}

// Show message to user
function showMessage(message, type) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    messageContainer.appendChild(messageElement);
    
    // Trigger animation
    setTimeout(() => {
        messageElement.classList.add('show');
    }, 10);
    
    // Remove message after 5 seconds
    setTimeout(() => {
        messageElement.classList.remove('show');
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageContainer.removeChild(messageElement);
            }
        }, 300);
    }, 5000);
}



// Update session status (checkbox change)
async function updateSessionStatus(sessionId, field, checked) {
    if (!window.currentUser) {
        showMessage('Please log in to update sessions.', 'error');
        return;
    }
    
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
        showMessage('Session not found.', 'error');
        return;
    }
    
    try {
        // Update in database
        const updates = { [field]: checked };
        await apiCall(`/api/sessions/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        
        // Update local session object
        session[field] = checked;
        
        // Re-render sessions to update the display
        renderSessions();
        
        // Show confirmation message
        const fieldName = field.replace(/([A-Z])/g, ' $1').toLowerCase();
        const status = checked ? 'marked as complete' : 'marked as pending';
        showMessage(`${fieldName} ${status}!`, 'success');
    } catch (error) {
        console.error('Error updating session:', error);
        showMessage('Error updating session. Please try again.', 'error');
    }
}

// Utility function to handle form reset
function resetForm() {
    sessionForm.reset();
    // Reset minimum datetime
    const now = new Date();
    const formattedNow = now.toISOString().slice(0, 16);
    document.getElementById('dateTime').min = formattedNow;
}
