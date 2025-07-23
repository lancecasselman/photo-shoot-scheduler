// Photography Session Scheduler
// Session management system with cloud database

// Global variables
let sessions = [];
let sessionIdCounter = 1;
let currentUser = null;

// Authentication functions
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
            currentUser = await response.json();
            updateUserUI();
            return true;
        } else {
            currentUser = null;
            redirectToAuth();
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        currentUser = null;
        redirectToAuth();
        return false;
    }
}

function updateUserUI() {
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    
    if (currentUser) {
        userName.textContent = currentUser.firstName || currentUser.email;
        if (currentUser.profileImageUrl) {
            userAvatar.src = currentUser.profileImageUrl;
            userAvatar.style.display = 'block';
        } else {
            userAvatar.style.display = 'none';
        }
        userInfo.style.display = 'flex';
    } else {
        userInfo.style.display = 'none';
    }
}

function redirectToAuth() {
    if (window.location.pathname !== '/auth.html') {
        window.location.href = '/auth.html';
    }
}

// Show message to user
function showMessage(message, type = 'info') {
    const messageContainer = document.getElementById('messageContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    messageContainer.appendChild(messageDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
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
    renderSessions();
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
        renderSessions();
        console.log('Successfully loaded', sessions.length, 'sessions');
        
    } catch (error) {
        console.error('Error loading sessions:', error);
        showMessage('Error loading sessions: ' + error.message, 'error');
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

// Render sessions in the UI
function renderSessions() {
    console.log('renderSessions called with', sessions.length, 'sessions');
    const container = document.getElementById('sessionsContainer');
    
    if (!container) {
        console.error('Sessions container not found');
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    if (sessions.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = '<p>No sessions scheduled yet. Add your first session above!</p>';
        container.appendChild(emptyState);
        return;
    }
    
    console.log('Rendering', sessions.length, 'session cards');
    
    // Sort sessions by date
    const sortedSessions = [...sessions].sort((a, b) => {
        const dateA = new Date(a.dateTime || a.date_time);
        const dateB = new Date(b.dateTime || b.date_time);
        return dateA - dateB;
    });
    
    console.log('Sorted sessions:', sortedSessions);
    
    // Create session cards
    sortedSessions.forEach((session, index) => {
        console.log(`Creating session card ${index + 1}:`, session.clientName);
        const card = createSessionCard(session);
        container.appendChild(card);
        console.log(`Session card ${index + 1} added`);
    });
    
    console.log('All session cards rendered. Container children count:', container.children.length);
    console.log('Sessions rendered, container should now show', sessions.length, 'sessions');
}

// Create individual session card
function createSessionCard(session) {
    console.log('=== CRITICAL DEBUG: Creating session card for:', session.clientName);
    console.log('Session object:', session);

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
    uploadBtn.textContent = '📸 Upload Photos';
    uploadBtn.onclick = () => openUploadDialog(session.id);
    // Remove inline styles that interfere with responsive design
    uploadBtn.style.backgroundColor = '#6b7280'; // Gray background
    uploadBtn.style.color = 'white'; // White text

    const calendarBtn = document.createElement('button');
    calendarBtn.className = 'btn btn-success';
    calendarBtn.textContent = '📅 Add to Calendar';
    calendarBtn.onclick = () => exportToCalendar(session.id);

    // Direct email client button
    const emailClientBtn = document.createElement('button');
    emailClientBtn.className = 'btn btn-primary';
    emailClientBtn.textContent = '📧 Email Client';
    emailClientBtn.onclick = () => openEmailClient(session);
    emailClientBtn.style.backgroundColor = '#007bff';
    emailClientBtn.style.marginBottom = '5px';

    const galleryBtn = document.createElement('button');
    galleryBtn.className = 'btn btn-warning';
    galleryBtn.textContent = '📸 Copy Gallery URL';
    galleryBtn.onclick = () => copyGalleryUrl(session.id);

    // Email preview button (shows after gallery notification is generated)
    const emailPreviewBtn = document.createElement('button');
    emailPreviewBtn.className = 'btn btn-outline-primary';
    emailPreviewBtn.textContent = '📧 Email Preview';
    emailPreviewBtn.style.fontSize = '0.85em';
    emailPreviewBtn.onclick = () => {
        const previewUrl = `/api/sessions/${session.id}/email-preview`;
        window.open(previewUrl, '_blank');
    };
    // Only show if gallery has been notified (meaning email preview exists)
    emailPreviewBtn.style.display = session.galleryReadyNotified ? 'block' : 'none';

    const invoiceBtn = document.createElement('button');
    invoiceBtn.className = 'btn btn-info';
    invoiceBtn.textContent = '💰 Send Invoice';
    invoiceBtn.onclick = () => createInvoice(session);

    const depositBtn = document.createElement('button');
    depositBtn.className = 'btn btn-deposit';
    depositBtn.textContent = '💳 Send Deposit';
    depositBtn.onclick = () => openDepositModal(session.id);

    const contractBtn = document.createElement('button');
    contractBtn.className = 'btn btn-contract';
    contractBtn.textContent = '📝 Send Contract';
    contractBtn.onclick = () => openContractModal(session.id);

    // Call and text buttons for main actions
    const callClientBtn = document.createElement('button');
    callClientBtn.className = 'btn btn-success';
    callClientBtn.textContent = '📞 Call Client';
    callClientBtn.onclick = () => window.location.href = `tel:${session.phoneNumber}`;

    const textClientBtn = document.createElement('button');
    textClientBtn.className = 'btn btn-info';
    textClientBtn.textContent = '💬 Text Client';
    textClientBtn.onclick = () => window.location.href = `sms:${session.phoneNumber}`;

    const paymentPlanBtn = document.createElement('button');
    paymentPlanBtn.className = 'btn btn-warning';
    paymentPlanBtn.textContent = '📅 Create Payment Plan';
    paymentPlanBtn.onclick = () => openPaymentPlanModal(session.id);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.onclick = () => deleteSession(session.id);

    console.log('About to append buttons for:', session.clientName);
    console.log('Upload button created:', uploadBtn.textContent);
    console.log('Upload button onclick:', uploadBtn.onclick ? 'Set' : 'NOT SET');
    console.log('Deposit button created:', depositBtn.textContent);
    console.log('Deposit button onclick:', depositBtn.onclick ? 'Set' : 'NOT SET');
    
    actions.appendChild(editBtn);
    actions.appendChild(uploadBtn);
    actions.appendChild(calendarBtn);
    actions.appendChild(emailClientBtn);
    actions.appendChild(galleryBtn);
    actions.appendChild(emailPreviewBtn);
    actions.appendChild(invoiceBtn);
    actions.appendChild(depositBtn);
    actions.appendChild(paymentPlanBtn);
    actions.appendChild(contractBtn);
    actions.appendChild(callClientBtn);
    actions.appendChild(textClientBtn);
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
        { key: 'contractSigned', label: 'Contract Signed', value: session.contractSigned },
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
    callBtn.textContent = '📞';
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
function editSession(sessionId) {
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
async function deleteSession(sessionId) {
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
        renderSessions();
        showMessage('Session deleted successfully!', 'success');
        
    } catch (error) {
        console.error('Error deleting session:', error);
        showMessage('Error deleting session: ' + error.message, 'error');
    }
}

// Export to calendar function - generates .ics file for iPhone Calendar
function exportToCalendar(sessionId) {
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
    
    // Option 1: Download .ics file directly (better for desktop)
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${session.clientName}_${session.sessionType}_Session.ics`;
    
    // Add to page temporarily and click
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(link.href);
    
    // Better iPhone Calendar integration
    const serverIcsUrl = `/api/sessions/${sessionId}/calendar.ics`;
    
    // Enhanced iPhone Calendar integration
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        showMessage('📅 Opening iPhone Calendar...', 'success');
        
        // Primary approach: Direct server .ics URL for iPhone Calendar app
        window.location.href = serverIcsUrl;
        
        // Backup: Show instructions after a short delay
        setTimeout(() => {
            showMessage(`📅 iPhone: If Calendar doesn't open automatically, tap "Add Event" when prompted`, 'info');
        }, 2000);
        
        // Final fallback: Google Calendar option
        setTimeout(() => {
            const startDate = new Date(session.dateTime);
            const endDate = new Date(startDate.getTime() + session.duration * 60000);
            const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            
            const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(session.sessionType + ' - ' + session.clientName)}&dates=${formatDate(startDate)}/${formatDate(endDate)}&location=${encodeURIComponent(session.location)}&details=${encodeURIComponent('Photography session with ' + session.clientName + '\nContact: ' + session.phoneNumber + '\nEmail: ' + session.email + '\nPrice: $' + session.price)}`;
            
            if (confirm('📅 Alternative: Open Google Calendar instead?')) {
                window.open(googleCalendarUrl, '_blank');
            }
        }, 4000);
        
    } else {
        // For other devices, provide download and server option
        showMessage(`📅 Calendar event downloaded! iPhone users can visit: ${window.location.origin}${serverIcsUrl}`, 'success');
        
        // Also open server URL for desktop browsers
        setTimeout(() => {
            window.open(serverIcsUrl, '_blank');
        }, 1000);
    }
}

// Open email client with session details
function openEmailClient(session) {
    const subject = `Photography Session - ${session.sessionType} with ${session.clientName}`;
    const body = `Hi ${session.clientName},

I hope this email finds you well! I wanted to reach out regarding your upcoming ${session.sessionType} photography session.

Session Details:
📅 Date & Time: ${new Date(session.dateTime).toLocaleDateString()} at ${new Date(session.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
📍 Location: ${session.location}
💰 Investment: $${session.price}
⏱️ Duration: ${session.duration} minutes

${session.notes ? `Additional Notes: ${session.notes}` : ''}

Please feel free to reach out if you have any questions or need to make any changes to our session.

Looking forward to capturing some beautiful moments with you!

Best regards,
Lance - The Legacy Photography
Professional Photography Services
📞 Call/Text: ${session.phoneNumber}
📧 Email: lance@thelegacyphotography.com`;

    const mailtoUrl = `mailto:${session.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open email client
    const emailLink = document.createElement('a');
    emailLink.href = mailtoUrl;
    emailLink.target = '_blank';
    emailLink.style.display = 'none';
    document.body.appendChild(emailLink);
    emailLink.click();
    document.body.removeChild(emailLink);
    
    showMessage(`📧 Opening email client for ${session.clientName}`, 'success');
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
            showMessage(`📸 Gallery URL copied to clipboard! ${result.galleryUrl}`, 'success');
            
            // Update the button text to show it's been generated
            const button = document.querySelector(`[data-session-id="${sessionId}"] .btn-warning`);
            if (button) {
                button.textContent = '✅ Gallery URL Copied';
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
            showMessage('📧 Opening your email client with gallery notification...', 'info');
            
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
                showMessage('📧 Email client opened! Or preview the email first:', 'success');
                
                // Add email preview button
                setTimeout(() => {
                    if (confirm('📧 Want to see the email preview before sending? Click OK to open email preview.')) {
                        window.open(result.emailPreviewUrl, '_blank');
                    }
                }, 2000);
            }, 1000);
        } else {
            showMessage('⚠️ Email notification prepared. Check console for details.', 'warning');
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

// Create invoice function
async function createInvoice(session) {
    try {
        console.log('Creating invoice for session:', session);
        
        showMessage('Creating invoice...', 'info');
        
        const authToken = await getAuthToken();
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const response = await fetch('/api/create-invoice', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sessionId: session.id,
                clientName: session.clientName,
                email: session.email,
                amount: session.price,
                description: `${session.sessionType} Photography Session`,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create invoice: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Invoice creation result:', result);
        
        if (result.success && result.invoice_url) {
            showMessage('Invoice created successfully!', 'success');
            
            // Open the invoice URL in a new tab
            window.open(result.invoice_url, '_blank');
            
            // Show a dialog with invoice details
            const message = `Invoice created successfully!\n\nInvoice URL: ${result.invoice_url}\n\nThe invoice has been sent to ${session.email}`;
            alert(message);
        } else {
            throw new Error(result.error || 'Unknown error creating invoice');
        }
        
    } catch (error) {
        console.error('Error creating invoice:', error);
        showMessage('Error creating invoice: ' + error.message, 'error');
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
            if (!file.type.startsWith('image/')) {
                showMessage(`${file.name} is not an image file`, 'error');
                return false;
            }
            if (file.size > 10 * 1024 * 1024) {
                showMessage(`${file.name} is too large (max 10MB)`, 'error');
                return false;
            }
            return true;
        });
        
        if (selectedFiles.length > 20) {
            selectedFiles = selectedFiles.slice(0, 20);
            showMessage('Only first 20 files selected (maximum limit)', 'warning');
        }
        
        // Update preview
        updateUploadPreview();
        
        // Enable/disable upload button
        uploadBtn.disabled = selectedFiles.length === 0;
        uploadBtn.textContent = selectedFiles.length > 0 ? `Upload ${selectedFiles.length} Photos` : 'Upload Photos';
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
                uploadBtn.textContent = selectedFiles.length > 0 ? `Upload ${selectedFiles.length} Photos` : 'Upload Photos';
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
            
            const response = await fetch(`/api/sessions/${sessionId}/photos`, {
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
        
        const response = await fetch(`/api/sessions/${sessionId}/photos/${photoIndex}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Delete failed');
        }
        
        const result = await response.json();
        console.log('Delete result:', result);
        showMessage('Photo deleted successfully!', 'success');
        
        // Reload photos for this session
        const galleryGrid = document.querySelector(`.gallery-grid[data-session-id="${sessionId}"]`);
        const photoCount = galleryGrid?.parentElement?.querySelector('.photo-count');
        if (galleryGrid) {
            loadSessionPhotos(sessionId, galleryGrid, photoCount);
        }
        
    } catch (error) {
        console.error('Delete error:', error);
        showMessage('Delete failed: ' + error.message, 'error');
    }
}
// Open payment plan modal (placeholder)
function openPaymentPlanModal(sessionId) {
    console.log('Opening payment plan modal for session:', sessionId);
    showMessage('Payment plan feature coming soon!', 'info');
}

// Open deposit modal
function openDepositModal(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
        showMessage('Session not found', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>💳 Send Deposit Invoice - ${session.clientName}</h3>
                <span class="close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="deposit-amount-modal">Deposit Amount ($)</label>
                    <input type="number" id="deposit-amount-modal" placeholder="Enter deposit amount" step="0.01" min="0" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div id="deposit-calculation" style="display: none; background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Total Session Price:</span>
                        <span>$${session.price}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Deposit Amount:</span>
                        <span id="deposit-display">$0.00</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 8px; font-weight: bold;">
                        <span>Remaining Balance:</span>
                        <span id="deposit-remaining-display">$0.00</span>
                    </div>
                </div>
                
                <div id="deposit-status-modal" style="margin: 15px 0;">
                    <!-- Status will be loaded here -->
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" onclick="sendDepositInvoice('${sessionId}')" class="btn btn-deposit">Send Deposit Invoice</button>
                <button type="button" onclick="this.parentElement.parentElement.parentElement.remove()" class="btn btn-secondary">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add calculation listener
    const amountInput = document.getElementById('deposit-amount-modal');
    amountInput.addEventListener('input', () => calculateDepositModal(session.price));
    
    // Focus on input
    amountInput.focus();
}

// Calculate deposit in modal
function calculateDepositModal(sessionPrice) {
    const amountInput = document.getElementById('deposit-amount-modal');
    const calcSection = document.getElementById('deposit-calculation');
    const depositDisplay = document.getElementById('deposit-display');
    const remainingDisplay = document.getElementById('deposit-remaining-display');
    
    const depositAmount = parseFloat(amountInput.value);
    
    if (isNaN(depositAmount) || depositAmount <= 0) {
        calcSection.style.display = 'none';
        return;
    }
    
    const remainingBalance = Math.max(0, sessionPrice - depositAmount);
    
    depositDisplay.textContent = '$' + depositAmount.toFixed(2);
    remainingDisplay.textContent = '$' + remainingBalance.toFixed(2);
    calcSection.style.display = 'block';
}

// Send deposit invoice
async function sendDepositInvoice(sessionId) {
    const amountInput = document.getElementById('deposit-amount-modal');
    const depositAmount = parseFloat(amountInput.value);
    
    if (isNaN(depositAmount) || depositAmount <= 0) {
        showMessage('Please enter a valid deposit amount', 'error');
        return;
    }
    
    try {
        showMessage('Creating deposit invoice...', 'info');
        
        const response = await fetch(`/api/sessions/${sessionId}/send-deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ depositAmount })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Deposit invoice sent successfully!', 'success');
            
            // Open the invoice URL
            if (result.invoiceUrl) {
                window.open(result.invoiceUrl, '_blank');
            }
            
            // Close modal
            const modal = document.querySelector('.modal');
            if (modal) {
                modal.remove();
            }
            
            // Refresh sessions
            await loadSessions();
        } else {
            throw new Error(result.error || 'Failed to send deposit invoice');
        }
    } catch (error) {
        console.error('Error sending deposit invoice:', error);
        showMessage('Error sending deposit invoice: ' + error.message, 'error');
    }
}
