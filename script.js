// In-memory storage for sessions
let sessions = [];
let sessionIdCounter = 1;

// DOM elements
const sessionForm = document.getElementById('sessionForm');
const sessionsContainer = document.getElementById('sessionsContainer');
const messageContainer = document.getElementById('messageContainer');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set minimum datetime to current date/time
    const now = new Date();
    const formattedNow = now.toISOString().slice(0, 16);
    document.getElementById('dateTime').min = formattedNow;
    
    // Add form submit event listener
    sessionForm.addEventListener('submit', handleFormSubmit);
    
    // Initial render
    renderSessions();
});

// Handle form submission
function handleFormSubmit(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(sessionForm);
        const sessionData = {
            id: sessionIdCounter++,
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
            createdAt: new Date().toISOString()
        };
        
        // Validate required fields
        if (!validateSessionData(sessionData)) {
            return;
        }
        
        // Add session to in-memory storage
        sessions.push(sessionData);
        
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
    if (sessions.length === 0) {
        sessionsContainer.innerHTML = `
            <div class="empty-state">
                <p>No sessions scheduled yet. Add your first session above!</p>
            </div>
        `;
        return;
    }
    
    // Sort sessions by date/time
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    
    sessionsContainer.innerHTML = sortedSessions.map(session => createSessionCard(session)).join('');
}

// Create session card HTML
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
    
    return `
        <div class="session-card">
            <div class="session-header">
                <div>
                    <div class="session-title">${escapeHtml(session.sessionType)}</div>
                    <div class="session-client">${escapeHtml(session.clientName)}</div>
                </div>
                <div class="session-actions">
                    <button class="btn btn-success" onclick="exportToCalendar(${session.id})">
                        📅 Add to Calendar
                    </button>
                    <button class="btn btn-danger" onclick="deleteSession(${session.id})">
                        🗑️ Delete
                    </button>
                </div>
            </div>
            
            <div class="session-details">
                <div class="detail-item">
                    <div class="detail-label">Date & Time</div>
                    <div class="detail-value">${formattedDate} at ${formattedTime}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Location</div>
                    <div class="detail-value">${escapeHtml(session.location)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Phone</div>
                    <div class="detail-value">${escapeHtml(session.phoneNumber)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Email</div>
                    <div class="detail-value">${escapeHtml(session.email)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Price</div>
                    <div class="detail-value">$${session.price.toFixed(2)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Duration</div>
                    <div class="detail-value">${session.duration} minutes</div>
                </div>
            </div>
            
            <div class="status-indicators">
                <div class="status-item">
                    <input type="checkbox" id="contract-${session.id}" ${session.contractSigned ? 'checked' : ''} 
                           onchange="updateSessionStatus(${session.id}, 'contractSigned', this.checked)">
                    <label for="contract-${session.id}">Contract ${session.contractSigned ? 'Signed' : 'Pending'}</label>
                </div>
                <div class="status-item">
                    <input type="checkbox" id="paid-${session.id}" ${session.paid ? 'checked' : ''} 
                           onchange="updateSessionStatus(${session.id}, 'paid', this.checked)">
                    <label for="paid-${session.id}">Payment ${session.paid ? 'Received' : 'Pending'}</label>
                </div>
                <div class="status-item">
                    <input type="checkbox" id="edited-${session.id}" ${session.edited ? 'checked' : ''} 
                           onchange="updateSessionStatus(${session.id}, 'edited', this.checked)">
                    <label for="edited-${session.id}">Editing ${session.edited ? 'Complete' : 'Pending'}</label>
                </div>
                <div class="status-item">
                    <input type="checkbox" id="delivered-${session.id}" ${session.delivered ? 'checked' : ''} 
                           onchange="updateSessionStatus(${session.id}, 'delivered', this.checked)">
                    <label for="delivered-${session.id}">Delivery ${session.delivered ? 'Complete' : 'Pending'}</label>
                </div>
            </div>
            
            ${session.notes ? `
                <div class="notes-section">
                    <h4>Notes:</h4>
                    <div class="notes-content">${escapeHtml(session.notes)}</div>
                </div>
            ` : ''}
        </div>
    `;
}

// Delete session
function deleteSession(sessionId) {
    if (confirm('Are you sure you want to delete this session?')) {
        sessions = sessions.filter(session => session.id !== sessionId);
        renderSessions();
        showMessage('Session deleted successfully!', 'success');
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

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update session status (checkbox change)
function updateSessionStatus(sessionId, field, checked) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
        showMessage('Session not found.', 'error');
        return;
    }
    
    // Update the session object
    session[field] = checked;
    
    // Re-render sessions to update the display
    renderSessions();
    
    // Show confirmation message
    const fieldName = field.replace(/([A-Z])/g, ' $1').toLowerCase();
    const status = checked ? 'marked as complete' : 'marked as pending';
    showMessage(`${fieldName} ${status}!`, 'success');
}

// Utility function to handle form reset
function resetForm() {
    sessionForm.reset();
    // Reset minimum datetime
    const now = new Date();
    const formattedNow = now.toISOString().slice(0, 16);
    document.getElementById('dateTime').min = formattedNow;
}
