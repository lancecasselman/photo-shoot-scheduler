// Photography Session Scheduler
// Session management system with cloud database

// Global variables
let sessions = [];
let sessionIdCounter = 1;
let selectedPhotos = []; // Store selected photos for upload

// Show upload dialog for a session
function showUploadDialog(sessionId) {
    console.log('Opening upload dialog for session:', sessionId);
    
    // Create upload dialog
    const dialog = document.createElement('div');
    dialog.className = 'upload-dialog-overlay';
    dialog.style.cssText = `
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
    
    const dialogContent = document.createElement('div');
    dialogContent.className = 'upload-dialog-content';
    dialogContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        max-width: 500px;
        width: 90%;
        max-height: 80%;
        overflow-y: auto;
    `;
    
    dialogContent.innerHTML = `
        <h3>Upload Photos</h3>
        <p>Select up to 1000 photos (100MB each max)</p>
        <input type="file" id="photo-upload-input" multiple accept="image/*" style="margin: 20px 0;">
        <div id="upload-progress" style="display: none;">
            <div class="progress-bar" style="background: #f0f0f0; height: 20px; border-radius: 10px; overflow: hidden;">
                <div class="progress-fill" style="background: #4CAF50; height: 100%; width: 0%; transition: width 0.3s;"></div>
            </div>
            <p id="upload-status">Uploading...</p>
        </div>
        <div style="margin-top: 20px; text-align: right;">
            <button onclick="this.closest('.upload-dialog-overlay').remove()" style="margin-right: 10px; padding: 10px 20px; background: #ccc; border: none; border-radius: 5px; cursor: pointer;">Cancel</button>
            <button id="upload-start-btn" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">Upload Photos</button>
        </div>
    `;
    
    dialog.appendChild(dialogContent);
    document.body.appendChild(dialog);
    
    // Handle upload
    const uploadInput = dialog.querySelector('#photo-upload-input');
    const uploadBtn = dialog.querySelector('#upload-start-btn');
    const progressDiv = dialog.querySelector('#upload-progress');
    const progressFill = dialog.querySelector('.progress-fill');
    const statusText = dialog.querySelector('#upload-status');
    
    uploadBtn.onclick = async () => {
        const files = uploadInput.files;
        if (files.length === 0) {
            alert('Please select photos to upload');
            return;
        }
        
        progressDiv.style.display = 'block';
        uploadBtn.disabled = true;
        
        try {
            const result = await uploadPhotosToBackend(sessionId, files);
            progressFill.style.width = '100%';
            statusText.textContent = `Successfully uploaded ${files.length} photos!`;
            
            setTimeout(() => {
                dialog.remove();
                loadSessions(); // Refresh sessions to show updated photo count
                showMessage(`Successfully uploaded ${files.length} photos!`, 'success');
            }, 2000);
            
        } catch (error) {
            console.error('Upload failed:', error);
            statusText.textContent = 'Upload failed: ' + error.message;
            progressFill.style.background = '#f44336';
            uploadBtn.disabled = false;
        }
    };
    
    // Close dialog when clicking outside
    dialog.onclick = (e) => {
        if (e.target === dialog) {
            dialog.remove();
        }
    };
}

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
    // Handle both PostgreSQL (snake_case) and Firestore (camelCase) formats
    return {
        id: dbSession.id,
        sessionType: dbSession.sessionType || dbSession.session_type,
        clientName: dbSession.clientName || dbSession.client_name,
        dateTime: dbSession.dateTime || dbSession.date_time,
        location: dbSession.location,
        phoneNumber: dbSession.phoneNumber || dbSession.phone_number,
        email: dbSession.email,
        price: parseFloat(dbSession.price || 0),
        duration: dbSession.duration,
        notes: dbSession.notes || '',
        contractSigned: dbSession.contractSigned || dbSession.contract_signed || false,
        paid: dbSession.paid || false,
        edited: dbSession.edited || false,
        delivered: dbSession.delivered || false,
        reminderEnabled: dbSession.reminderEnabled || dbSession.reminder_enabled || false,
        galleryReadyNotified: dbSession.galleryReadyNotified || dbSession.gallery_ready_notified || false,
        reminderSent: dbSession.reminderSent || dbSession.reminder_sent || false,
        createdBy: dbSession.createdBy || dbSession.created_by,
        createdAt: dbSession.createdAt || dbSession.created_at,
        updatedAt: dbSession.updatedAt || dbSession.updated_at,
        userEmail: dbSession.userEmail || dbSession.user_email,
        userDisplayName: dbSession.userDisplayName || dbSession.user_display_name
    };
}

// Load sessions from database
async function loadSessions() {
    try {
        console.log('Loading sessions from database...');
        const data = await apiCall('/api/sessions');
        console.log('Sessions loaded:', data);
        console.log('Data type:', typeof data, 'Array:', Array.isArray(data));

        // Transform database format to frontend format
        sessions = (data || []).map(transformSessionData);
        console.log('Transformed sessions:', sessions);
        
        renderSessions();
        console.log('Sessions rendered, container should now show', sessions.length, 'sessions');

        if (sessions.length === 0) {
            console.log('No sessions found in database');
        } else {
            console.log(`Successfully loaded ${sessions.length} sessions`);
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



// Make functions available globally for auth.js and dynamic loading
window.loadSessions = loadSessions;
window.showUploadDialog = showUploadDialog;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM Content Loaded - Initializing app');
    
    // Set minimum datetime to current date/time
    const now = new Date();
    const formattedNow = now.toISOString().slice(0, 16);
    const dateTimeElement = document.getElementById('dateTime');
    if (dateTimeElement) {
        dateTimeElement.min = formattedNow;
    }

    // Add form submit event listener
    const sessionForm = document.getElementById('sessionForm');
    if (sessionForm) {
        sessionForm.addEventListener('submit', handleFormSubmit);
        console.log('Form submit listener added');
    } else {
        console.error('Session form not found');
    }
    
    // IMMEDIATELY ensure photo upload section is visible
    const mainUploadSection = document.querySelector('.photo-upload-section');
    if (mainUploadSection) {
        mainUploadSection.style.display = 'block';
        mainUploadSection.style.visibility = 'visible';
        console.log('Photo upload section immediately made visible on DOM load');
    } else {
        console.error('Photo upload section not found in DOM during initialization');
    }
    
    // Set up photo upload with backend API
    setTimeout(() => {
        const photoUploadInput = document.getElementById('photoUpload');
        const uploadSectionElement = document.querySelector('.photo-upload-section');
        
        console.log('Photo upload input found:', !!photoUploadInput);
        console.log('Photo upload section found:', !!uploadSectionElement);
        
        if (photoUploadInput) {
            photoUploadInput.addEventListener('change', handlePhotoSelection);
            console.log('Photo upload event listener added successfully');
        }
        
        // Backend photo upload is always available
        console.log('Backend photo upload API is available');
        
        // Ensure photo upload section is enabled
        const photoUploadArea = document.querySelector('.photo-upload-area');
        const photoUploadHelper = document.querySelector('.photo-upload-helper');
        if (photoUploadArea) {
            photoUploadArea.style.opacity = '1';
            photoUploadArea.style.pointerEvents = 'auto';
        }
        if (photoUploadHelper) {
            photoUploadHelper.textContent = 'Select multiple photos for this session';
            photoUploadHelper.style.color = '';
        }
        
        // Make sure photo upload section is always visible
        if (uploadSectionElement) {
            uploadSectionElement.style.display = 'block';
            uploadSectionElement.style.visibility = 'visible';
            console.log('Photo upload section forced visible');
        }
    }, 500);

    // Check server status to determine if we should load sessions
    try {
        const statusResponse = await fetch('/api/status');
        const statusData = await statusResponse.json();

        // Always load sessions since this is a shared business account
        // Users should see all sessions regardless of authentication state
        loadSessions();
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
        showMessage(editingSessionId ? 'Please log in to edit sessions.' : 'Please log in to add sessions.', 'error');
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
            reminderEnabled: formData.has('reminderEnabled'),
            galleryReadyNotified: formData.has('galleryReadyNotified'),
            createdBy: window.currentUser ? window.currentUser.uid : 'fallback-user'
        };

        // Debug: Log the form data before sending
        console.log('Form data being sent:', sessionData);
        console.log('DateTime from form:', sessionData.dateTime);
        console.log('Phone number from form:', sessionData.phoneNumber);
        console.log('Edit mode:', editingSessionId ? `Editing session ${editingSessionId}` : 'Adding new session');

        // Validate required fields
        if (!validateSessionData(sessionData)) {
            return;
        }

        // Handle photo uploads if any photos are selected
        if (selectedPhotos.length > 0) {
            showMessage('Uploading photos...', 'info');
        }

        if (editingSessionId) {
            // Update existing session
            const updatedSession = await updateSession(editingSessionId, sessionData);

            // Reset edit mode
            editingSessionId = null;

            // Reset form UI
            const formSection = document.querySelector('.form-section h2');
            formSection.textContent = 'Add New Session';

            const submitBtn = document.querySelector('#sessionForm button[type="submit"]');
            submitBtn.textContent = 'Add Session';
            submitBtn.className = 'btn btn-primary';

            // Remove cancel button
            const cancelBtn = document.getElementById('cancelEdit');
            if (cancelBtn) {
                cancelBtn.remove();
            }

            // Clear form
            sessionForm.reset();

            // Reload all sessions from database to ensure we get the current user's data
            await loadSessions();

            // Show success message
            showMessage('Session updated successfully!', 'success');

        } else {
            // Save new session to database
            const savedSession = await apiCall('/api/sessions', {
                method: 'POST',
                body: JSON.stringify(sessionData)
            });

            // Upload photos if any are selected
            if (selectedPhotos.length > 0) {
                try {
                    showUploadProgress(0, selectedPhotos.length);
                    await uploadPhotosToBackend(savedSession.id, selectedPhotos);
                    hideUploadProgress();
                    showMessage(`Session added successfully with ${selectedPhotos.length} photos uploaded!`, 'success');
                } catch (error) {
                    console.error('Error uploading photos:', error);
                    hideUploadProgress();
                    showMessage('Session added but photo upload failed. You can try uploading photos later.', 'warning');
                }
                
                // Clear selected photos
                selectedPhotos = [];
                document.getElementById('photoPreview').innerHTML = '';
            } else {
                showMessage('Session added successfully!', 'success');
            }

            // Clear form
            sessionForm.reset();
            document.getElementById('photoUpload').value = '';

            // Reload all sessions from database to ensure we get the current user's data
            await loadSessions();
        }

        // Reset minimum datetime
        const now = new Date();
        const formattedNow = now.toISOString().slice(0, 16);
        document.getElementById('dateTime').min = formattedNow;

    } catch (error) {
        console.error(editingSessionId ? 'Error updating session:' : 'Error adding session:', error);
        showMessage(editingSessionId ? 'Error updating session. Please try again.' : 'Error adding session. Please try again.', 'error');
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
    console.log('renderSessions called with', sessions.length, 'sessions');
    console.log('Sessions container:', sessionsContainer);
    
    // Clear existing content
    sessionsContainer.innerHTML = '';

    if (sessions.length === 0) {
        console.log('Showing empty state');
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';

        const message = document.createElement('p');
        message.textContent = 'No sessions scheduled yet. Add your first session above!';

        emptyState.appendChild(message);
        sessionsContainer.appendChild(emptyState);
        return;
    }

    console.log('Rendering', sessions.length, 'session cards');
    
    // Sort sessions by date/time
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    console.log('Sorted sessions:', sortedSessions);

    // Create and append session cards using DOM methods
    sortedSessions.forEach((session, index) => {
        console.log(`Creating card ${index + 1} for session:`, session.clientName);
        const sessionCard = createSessionCard(session);
        sessionsContainer.appendChild(sessionCard);
        console.log(`Card ${index + 1} appended to container`);
    });
    
    console.log('All session cards rendered. Container children count:', sessionsContainer.children.length);
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
    uploadBtn.className = 'btn btn-secondary';
    uploadBtn.textContent = '📤 Upload Photos';
    uploadBtn.onclick = () => {
        console.log('Upload button clicked for session:', session.id);
        if (typeof showUploadDialog === 'function') {
            showUploadDialog(session.id);
        } else {
            console.error('showUploadDialog function not available');
            alert('Upload function not ready. Please refresh the page.');
        }
    };

    const calendarBtn = document.createElement('button');
    calendarBtn.className = 'btn btn-success';
    calendarBtn.textContent = '📅 Add to Calendar';
    calendarBtn.onclick = () => exportToCalendar(session.id);

    const galleryBtn = document.createElement('button');
    galleryBtn.className = 'btn btn-warning';
    galleryBtn.textContent = session.galleryReadyNotified ? '✅ Gallery Sent' : '📧 Send Gallery Ready';
    galleryBtn.disabled = session.galleryReadyNotified;
    galleryBtn.onclick = () => sendGalleryNotification(session.id);

    const invoiceBtn = document.createElement('button');
    invoiceBtn.className = 'btn btn-info';
    invoiceBtn.textContent = '💰 Send Invoice';
    invoiceBtn.onclick = () => createInvoice(session);



    const viewGalleryBtn = document.createElement('button');
    viewGalleryBtn.className = 'btn btn-info';
    const photoCount = session.photos ? session.photos.length : 0;
    viewGalleryBtn.textContent = photoCount > 0 ? `🖼️ View Gallery (${photoCount})` : '🖼️ View Gallery';
    viewGalleryBtn.onclick = () => viewGallery(session.id);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.onclick = () => deleteSession(session.id);

    console.log('Adding buttons to session card for:', session.clientName);
    console.log('Upload button created:', uploadBtn.textContent);
    
    actions.appendChild(editBtn);
    actions.appendChild(uploadBtn);
    actions.appendChild(calendarBtn);
    actions.appendChild(galleryBtn);
    actions.appendChild(viewGalleryBtn);
    actions.appendChild(invoiceBtn);
    actions.appendChild(deleteBtn);
    
    console.log('Actions section children count:', actions.children.length);

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

    // Add reminder status indicators (read-only)
    const reminderStatus = document.createElement('div');
    reminderStatus.className = 'reminder-status';
    reminderStatus.innerHTML = `
        <div class="status-item">
            <span class="status-icon">${session.reminderEnabled ? '🔔' : '🔕'}</span>
            <span>Reminder: ${session.reminderEnabled ? (session.reminderSent ? 'Sent' : 'Enabled') : 'Disabled'}</span>
        </div>
        <div class="status-item">
            <span class="status-icon">${session.galleryReadyNotified ? '📧' : '📝'}</span>
            <span>Gallery: ${session.galleryReadyNotified ? 'Notified' : 'Not Sent'}</span>
        </div>
    `;
    statusIndicators.appendChild(reminderStatus);

    // Always append core sections
    card.appendChild(header);
    card.appendChild(details);
    card.appendChild(statusIndicators);
    
    // Load and display gallery for this session
    loadSessionGallery(session.id).then(photoUrls => {
        if (photoUrls.length > 0) {
            displaySessionGallery(session.id, photoUrls);
        }
    }).catch(error => {
        console.error('Error loading gallery for session:', session.id, error);
    });
    
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
        
        card.appendChild(notesSection);
    }
    
    // Photo functionality temporarily removed for stability

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
    // Check if authentication is required
    try {
        const statusResponse = await fetch('/api/status');
        const statusData = await statusResponse.json();

        // Only require authentication if it's enabled
        if (statusData.authenticationEnabled && !window.currentUser) {
            showMessage('Please log in to delete sessions.', 'error');
            return;
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        // Continue with deletion attempt
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
    // Check if authentication is required
    try {
        const statusResponse = await fetch('/api/status');
        const statusData = await statusResponse.json();

        // Only require authentication if it's enabled
        if (statusData.authenticationEnabled && !window.currentUser) {
            showMessage('Please log in to update sessions.', 'error');
            return;
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        // Continue with update attempt
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

// Edit session functionality
let editingSessionId = null;

function editSession(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
        showMessage('Session not found.', 'error');
        return;
    }

    // Set editing mode
    editingSessionId = sessionId;

    // Populate form with session data
    document.getElementById('sessionType').value = session.sessionType;
    document.getElementById('clientName').value = session.clientName;
    document.getElementById('dateTime').value = formatDateTimeForInput(session.dateTime);
    document.getElementById('location').value = session.location;
    document.getElementById('phoneNumber').value = session.phoneNumber;
    document.getElementById('email').value = session.email;
    document.getElementById('price').value = session.price;
    document.getElementById('duration').value = session.duration;
    document.getElementById('notes').value = session.notes || '';
    document.getElementById('contractSigned').checked = session.contractSigned;
    document.getElementById('paid').checked = session.paid;
    document.getElementById('edited').checked = session.edited;
    document.getElementById('delivered').checked = session.delivered;
    document.getElementById('reminderEnabled').checked = session.reminderEnabled;
    document.getElementById('galleryReadyNotified').checked = session.galleryReadyNotified;

    // Update form UI for editing
    const formSection = document.querySelector('.form-section h2');
    formSection.textContent = 'Edit Session';

    const submitBtn = document.querySelector('#sessionForm button[type="submit"]');
    submitBtn.textContent = 'Update Session';
    submitBtn.className = 'btn btn-warning';

    // Add cancel button
    if (!document.getElementById('cancelEdit')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'cancelEdit';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Cancel Edit';
        cancelBtn.onclick = cancelEdit;
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    }

    // Scroll to form
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });

    showMessage('Editing session. Make your changes and click "Update Session".', 'info');
}

function cancelEdit() {
    editingSessionId = null;

    // Reset form UI
    const formSection = document.querySelector('.form-section h2');
    formSection.textContent = 'Add New Session';

    const submitBtn = document.querySelector('#sessionForm button[type="submit"]');
    submitBtn.textContent = 'Add Session';
    submitBtn.className = 'btn btn-primary';

    // Remove cancel button
    const cancelBtn = document.getElementById('cancelEdit');
    if (cancelBtn) {
        cancelBtn.remove();
    }

    // Reset form
    resetForm();

    showMessage('Edit cancelled.', 'info');
}

function formatDateTimeForInput(dateTimeString) {
    const date = new Date(dateTimeString);
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Update session via API
async function updateSession(sessionId, sessionData) {
    try {
        const updatedSession = await apiCall(`/api/sessions/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(sessionData)
        });

        // Update local session object
        const sessionIndex = sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex !== -1) {
            sessions[sessionIndex] = transformSessionData(updatedSession);
        }

        // Re-render sessions
        renderSessions();

        return updatedSession;
    } catch (error) {
        console.error('Error updating session:', error);
        throw error;
    }
}

// Send gallery ready notification
async function sendGalleryNotification(sessionId) {
    try {
        const statusResponse = await fetch('/api/status');
        const statusData = await statusResponse.json();

        if (statusData.authenticationEnabled && !window.currentUser) {
            showMessage('Please log in to send notifications.', 'error');
            return;
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
    }

    if (confirm('Send gallery ready notification to the client?')) {
        try {
            const result = await apiCall(`/api/sessions/${sessionId}/send-gallery-notification`, {
                method: 'POST'
            });

            // Update local session object
            const sessionIndex = sessions.findIndex(s => s.id === sessionId);
            if (sessionIndex !== -1) {
                sessions[sessionIndex].galleryReadyNotified = true;
            }

            // Re-render sessions
            renderSessions();

            const notifications = result.notifications;
            let message = 'Gallery notification sent successfully!';

            if (notifications.email.sent && notifications.sms.sent) {
                message += ' (Email and SMS sent)';
            } else if (notifications.email.sent) {
                message += ' (Email sent)';
            } else if (notifications.sms.sent) {
                message += ' (SMS sent)';
            } else {
                message = 'Notification attempted but may have failed. Check server logs.';
            }

            showMessage(message, 'success');
        } catch (error) {
            console.error('Error sending gallery notification:', error);
            showMessage('Error sending gallery notification. Please try again.', 'error');
        }
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

// Create invoice function
async function createInvoice(session) {
    if (!confirm(`Create and send invoice for ${session.clientName}?`)) {
        return;
    }

    try {
        // Debug: Log the session object to see what data we have
        console.log('Session object for invoice:', session);
        
        // Validate required fields before creating invoice
        if (!session.email || !session.clientName || session.price === undefined || session.price === null) {
            console.error('Missing required fields in session:', {
                email: session.email,
                clientName: session.clientName,
                price: session.price,
                sessionType: session.sessionType
            });
            showMessage('Error: Session is missing required information for invoice creation.', 'error');
            return;
        }

        // Build description with fallback values
        const sessionType = session.sessionType || 'Photography';
        const sessionDate = session.dateTime ? new Date(session.dateTime).toLocaleDateString() : new Date().toLocaleDateString();
        const description = `${sessionType} Photography Session - ${sessionDate}`;

        const invoiceData = {
            customerEmail: session.email,
            clientName: session.clientName,
            amount: session.price,
            description: description
        };

        console.log('Creating invoice with data:', invoiceData);

        const response = await apiCall('/api/invoice', {
            method: 'POST',
            body: JSON.stringify(invoiceData)
        });
        console.log('Invoice created:', response);

        showMessage(`Invoice sent successfully to ${session.email}`, 'success');

        // Optional: Open invoice URL in new tab
        if (response.invoice && response.invoice.hosted_invoice_url) {
            window.open(response.invoice.hosted_invoice_url, '_blank');
        }

    } catch (error) {
        console.error('Error creating invoice:', error);
        showMessage('Error creating invoice: ' + error.message, 'error');
    }
}

// Photo upload functionality temporarily removed for stability

function viewGallery(sessionId) {
    // Store current session ID for gallery view
    sessionStorage.setItem('gallerySessionId', sessionId);
    
    // Navigate to gallery view
    window.location.href = `/gallery/${sessionId}`;
}

// Photo Upload and Management Functions

// Handle photo selection
function handlePhotoSelection(event) {
    const files = Array.from(event.target.files);
    selectedPhotos = files;
    
    console.log(`Selected ${files.length} photos for upload`);
    
    // Display photo previews
    displayPhotoPreview(files);
}

// Display photo preview
function displayPhotoPreview(files) {
    const previewContainer = document.getElementById('photoPreview');
    previewContainer.innerHTML = '';
    
    if (files.length === 0) {
        return;
    }
    
    files.forEach((file, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'photo-preview-item';
        
        // Create image element
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = `Preview ${index + 1}`;
        
        // Create remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'photo-preview-remove';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove photo';
        removeBtn.onclick = (e) => {
            e.preventDefault();
            removePhotoFromSelection(index);
        };
        
        previewItem.appendChild(img);
        previewItem.appendChild(removeBtn);
        previewContainer.appendChild(previewItem);
    });
}

// Remove photo from selection
function removePhotoFromSelection(index) {
    selectedPhotos.splice(index, 1);
    displayPhotoPreview(selectedPhotos);
    
    // Update the file input
    const photoUploadInput = document.getElementById('photoUpload');
    const dt = new DataTransfer();
    selectedPhotos.forEach(file => dt.items.add(file));
    photoUploadInput.files = dt.files;
}

// Upload photos to backend API
async function uploadPhotosToBackend(sessionId, files) {
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    for (let i = 0; i < files.length; i++) {
        formData.append('photos', files[i]);
    }

    const res = await fetch('/api/sessions/upload-photos', {
        method: 'POST',
        headers: {
            Authorization: window.userToken ? `Bearer ${window.userToken}` : undefined
        },
        body: formData
    });

    const data = await res.json();
    return data.photoUrls || [];
}

// Show upload progress
function showUploadProgress(current, total) {
    const uploadSection = document.querySelector('.photo-upload-section');
    if (!uploadSection) return;
    
    // Remove existing progress
    const existingProgress = uploadSection.querySelector('.upload-progress');
    if (existingProgress) {
        existingProgress.remove();
    }
    
    // Create progress container
    const progressContainer = document.createElement('div');
    progressContainer.className = 'upload-progress';
    
    // Progress bar
    const progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'progress-bar-container';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.width = `${(current / total) * 100}%`;
    
    progressBarContainer.appendChild(progressBar);
    
    // Progress text
    const progressText = document.createElement('div');
    progressText.className = 'progress-text';
    progressText.textContent = `Uploading photos... ${current}/${total}`;
    
    progressContainer.appendChild(progressBarContainer);
    progressContainer.appendChild(progressText);
    uploadSection.appendChild(progressContainer);
}

// Update upload progress
function updateUploadProgress(current, total) {
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');
    
    if (progressBar && progressText) {
        progressBar.style.width = `${(current / total) * 100}%`;
        progressText.textContent = `Uploading photos... ${current}/${total}`;
    }
}

// Hide upload progress
function hideUploadProgress() {
    const progressContainer = document.querySelector('.upload-progress');
    if (progressContainer) {
        progressContainer.remove();
    }
}

// Load session gallery
async function loadSessionGallery(sessionId) {
  try {
    const res = await fetch(`/api/sessions/${sessionId}/photos`);
    const data = await res.json();
    return data.photos || [];
  } catch (error) {
    console.error('Error loading session gallery:', error);
    return [];
  }
}


// Display session gallery
function displaySessionGallery(sessionId, photoUrls) {
    const sessionCard = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!sessionCard) return;
    
    // Remove existing gallery
    const existingGallery = sessionCard.querySelector('.session-gallery');
    if (existingGallery) {
        existingGallery.remove();
    }
    
    if (photoUrls.length === 0) return;
    
    // Create gallery section
    const gallerySection = document.createElement('div');
    gallerySection.className = 'session-gallery';
    
    // Gallery header
    const galleryHeader = document.createElement('div');
    galleryHeader.className = 'gallery-header';
    
    const galleryTitle = document.createElement('h4');
    galleryTitle.className = 'gallery-title';
    galleryTitle.textContent = '📸 Session Photos';
    
    const galleryCount = document.createElement('span');
    galleryCount.className = 'gallery-count';
    galleryCount.textContent = `${photoUrls.length} photo${photoUrls.length !== 1 ? 's' : ''}`;
    
    galleryHeader.appendChild(galleryTitle);
    galleryHeader.appendChild(galleryCount);
    
    // Gallery grid
    const galleryGrid = document.createElement('div');
    galleryGrid.className = 'gallery-grid';
    
    photoUrls.forEach((photoUrl, index) => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        
        const img = document.createElement('img');
        img.src = photoUrl;
        img.alt = `Photo ${index + 1}`;
        img.loading = 'lazy';
        img.onclick = () => openPhotoLightbox(photoUrl);
        
        galleryItem.appendChild(img);
        galleryGrid.appendChild(galleryItem);
    });
    
    gallerySection.appendChild(galleryHeader);
    gallerySection.appendChild(galleryGrid);
    
    // Insert gallery before the last element (typically the notes section)
    const lastChild = sessionCard.lastElementChild;
    sessionCard.insertBefore(gallerySection, lastChild);
}

// Open photo in lightbox
function openPhotoLightbox(photoUrl) {
    // Create lightbox overlay
    const lightbox = document.createElement('div');
    lightbox.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
    `;
    
    const img = document.createElement('img');
    img.src = photoUrl;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
    `;
    
    lightbox.appendChild(img);
    lightbox.onclick = () => lightbox.remove();
    
    document.body.appendChild(lightbox);
}

// Delete session function
window.showUploadDialog = showUploadDialog;
