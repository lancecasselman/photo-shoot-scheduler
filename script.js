// Photography Session Scheduler
// Session management system with cloud database

// Global variables
let sessions = [];
let sessionIdCounter = 1;

// API helper functions
async function apiCall(url, options = {}) {
    try {
        console.log(`Making API call to: ${url}`, options);
        console.log(`Full URL: ${window.location.origin}${url}`);
        console.log(`Current host: ${window.location.host}`);
        console.log(`Protocol: ${window.location.protocol}`);
        
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            mode: 'cors',
            credentials: 'omit',
            ...options
        });
        
        console.log(`API response status: ${response.status}`);
        console.log(`Response URL: ${response.url}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API error response: ${errorText}`);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('API response data:', data);
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        
        // More specific error messages for mobile debugging
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
        } else if (error.name === 'SyntaxError') {
            throw new Error('Server response error: Invalid data format received.');
        } else {
            throw new Error(`API error: ${error.message}`);
        }
    }
}

// DOM elements
const sessionForm = document.getElementById('sessionForm');
const sessionsContainer = document.getElementById('sessionsContainer');
const messageContainer = document.getElementById('messageContainer');

// API call helper with authentication
async function apiCall(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    // Add authentication header if user is logged in
    if (window.currentUser && window.userToken) {
        headers['Authorization'] = `Bearer ${window.userToken}`;
    }
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

// Load sessions from database
async function loadSessions() {
    try {
        console.log('Loading sessions from database...');
        const data = await apiCall('/api/sessions');
        console.log('Sessions loaded:', data);
        sessions = data || [];
        renderSessions();
        
        if (sessions.length === 0) {
            console.log('No sessions found in database');
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        showMessage(`Error loading sessions: ${error.message}. Please check your connection and try again.`, 'error');
        
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

// Make loadSessions available globally for auth.js
window.loadSessions = loadSessions;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set minimum datetime to current date/time
    const now = new Date();
    const formattedNow = now.toISOString().slice(0, 16);
    document.getElementById('dateTime').min = formattedNow;
    
    // Add form submit event listener
    sessionForm.addEventListener('submit', handleFormSubmit);
    
    // Load sessions if user is authenticated
    if (window.currentUser) {
        loadSessions();
    } else {
        // Initial render for empty state
        renderSessions();
    }
    
    // Mobile-specific debugging
    if (navigator.userAgent.includes('Mobile')) {
        console.log('Mobile device detected');
    }
});

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!window.currentUser) {
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
            createdBy: window.currentUser.uid
        };
        
        // Validate required fields
        if (!validateSessionData(sessionData)) {
            return;
        }
        
        // Save session to database
        const savedSession = await apiCall('/api/sessions', {
            method: 'POST',
            body: JSON.stringify(sessionData)
        });
        
        // Add to local sessions array
        sessions.push(savedSession);
        
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
    
    details.appendChild(createDetailItem('Date & Time', `${formattedDate} at ${formattedTime}`));
    details.appendChild(createDetailItem('Location', session.location));
    details.appendChild(createDetailItem('Phone', session.phoneNumber));
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
