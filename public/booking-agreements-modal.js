// Booking Agreements Modal Management System

let currentAgreementSessionId = null;
let currentAgreement = null;
let agreementTemplates = [];

// Immediately inject critical styles to force black text when this file loads
(function() {
    const criticalStyles = document.createElement('style');
    criticalStyles.innerHTML = `
        /* CRITICAL: Force ALL modal text to be black */
        #bookingAgreementModal * {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
        }
        #agreementContent,
        #agreementContent * {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
        }
        .agreement-content-editor,
        .agreement-content-editor * {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
        }
        [contenteditable="true"],
        [contenteditable="true"] * {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
        }
        /* Ensure white background for contrast */
        #agreementContent {
            background-color: white !important;
        }
    `;
    document.head.appendChild(criticalStyles);
})();

// Function to view signed/pending contracts
async function viewSignedPendingContracts() {
    try {
        // Fetch all sent and signed agreements for the current user
        const response = await fetch('/api/booking/agreements/all');
        
        if (!response.ok) {
            throw new Error('Failed to fetch agreements');
        }
        
        const agreements = await response.json();
        
        // Filter for sent, viewed, and signed agreements
        const sentAndSignedAgreements = agreements.filter(agreement => 
            ['sent', 'viewed', 'signed'].includes(agreement.status)
        );
        
        showSignedPendingContractsModal(sentAndSignedAgreements);
        
    } catch (error) {
        console.error('Error fetching agreements:', error);
        alert('Error loading signed/pending contracts: ' + error.message);
    }
}

// Show the signed/pending contracts modal
function showSignedPendingContractsModal(agreements) {
    // Remove existing modal if present
    const existingModal = document.getElementById('signedPendingModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal HTML
    const modalHTML = `
        <div id="signedPendingModal" class="booking-modal" style="display: flex; z-index: 10000;">
            <div class="booking-modal-content" style="max-width: 800px; width: 90%;">
                <div class="booking-modal-header">
                    <h2>📄 Signed & Pending Contracts</h2>
                    <button class="booking-modal-close" onclick="closeSignedPendingModal()">&times;</button>
                </div>
                
                <div class="booking-modal-body">
                    <div id="agreementsList" style="max-height: 400px; overflow-y: auto;">
                        ${agreements.length > 0 ? agreements.map(agreement => `
                            <div class="agreement-item" style="border: 1px solid #ddd; margin-bottom: 10px; padding: 15px; border-radius: 5px; background: white;">
                                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 10px;">
                                    <h4 style="margin: 0; color: #333;">${agreement.session_client_name || 'Unknown Client'}</h4>
                                    <span class="status-badge status-${agreement.status}" style="
                                        padding: 4px 8px; 
                                        border-radius: 12px; 
                                        font-size: 12px; 
                                        font-weight: bold;
                                        background: ${agreement.status === 'signed' ? '#28a745' : agreement.status === 'viewed' ? '#ffc107' : '#17a2b8'};
                                        color: white;
                                    ">${agreement.status.toUpperCase()}</span>
                                </div>
                                <p style="margin: 5px 0; color: #666; font-size: 14px;">
                                    <strong>Session:</strong> ${agreement.session_type || 'Photography Session'} | 
                                    <strong>Sent:</strong> ${agreement.sent_at ? new Date(agreement.sent_at).toLocaleDateString() : 'N/A'}
                                    ${agreement.signed_at ? ` | <strong>Signed:</strong> ${new Date(agreement.signed_at).toLocaleDateString()}` : ''}
                                </p>
                                <div style="margin-top: 10px;">
                                    <button onclick="viewAgreementDetails('${agreement.id}')" class="btn btn-sm btn-primary" style="margin-right: 10px;">View Details</button>
                                    ${agreement.status !== 'signed' ? `<button onclick="resendAgreement('${agreement.id}')" class="btn btn-sm btn-secondary">Resend</button>` : ''}
                                </div>
                            </div>
                        `).join('') : '<p style="text-align: center; color: #666; padding: 20px;">No sent or signed contracts found.</p>'}
                    </div>
                </div>
                
                <div class="booking-modal-footer">
                    <button class="btn btn-secondary" onclick="closeSignedPendingModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close the signed/pending contracts modal
function closeSignedPendingModal() {
    const modal = document.getElementById('signedPendingModal');
    if (modal) {
        modal.remove();
    }
}

// View agreement details
async function viewAgreementDetails(agreementId) {
    try {
        // First try to get the agreement details from the all endpoint
        const response = await fetch('/api/booking/agreements/all');
        if (!response.ok) {
            throw new Error('Failed to fetch agreements');
        }
        
        const agreements = await response.json();
        const agreement = agreements.find(a => a.id === agreementId);
        
        if (!agreement) {
            throw new Error('Agreement not found');
        }
        
        // Close current modal and open agreement modal with the details
        closeSignedPendingModal();
        
        // Show the agreement content in a read-only view
        showAgreementDetailsModal(agreement);
        
    } catch (error) {
        console.error('Error fetching agreement details:', error);
        alert('Error loading agreement details: ' + error.message);
    }
}

// Show agreement details in a modal
function showAgreementDetailsModal(agreement) {
    const modalHTML = `
        <div id="agreementDetailsModal" class="booking-modal" style="display: flex; z-index: 10001;">
            <div class="booking-modal-content" style="max-width: 700px; width: 90%;">
                <div class="booking-modal-header">
                    <h2>Agreement Details - ${agreement.session_client_name || 'Unknown Client'}</h2>
                    <button class="booking-modal-close" onclick="closeAgreementDetailsModal()">&times;</button>
                </div>
                
                <div class="booking-modal-body">
                    <div class="agreement-status-info" style="margin-bottom: 20px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <p><strong>Status:</strong> <span style="color: ${agreement.status === 'signed' ? '#28a745' : '#17a2b8'};">${agreement.status.toUpperCase()}</span></p>
                        <p><strong>Sent:</strong> ${agreement.sent_at ? new Date(agreement.sent_at).toLocaleString() : 'N/A'}</p>
                        ${agreement.viewed_at ? `<p><strong>Viewed:</strong> ${new Date(agreement.viewed_at).toLocaleString()}</p>` : ''}
                        ${agreement.signed_at ? `<p><strong>Signed:</strong> ${new Date(agreement.signed_at).toLocaleString()}</p>` : ''}
                    </div>
                    
                    <div class="agreement-content" style="border: 1px solid #ddd; padding: 20px; background: white; max-height: 400px; overflow-y: auto;">
                        ${agreement.content || 'No content available'}
                    </div>
                </div>
                
                <div class="booking-modal-footer">
                    <button class="btn btn-secondary" onclick="closeAgreementDetailsModal()">Close</button>
                    ${agreement.status !== 'signed' ? `<button class="btn btn-primary" onclick="resendAgreement('${agreement.id}')">Resend Agreement</button>` : ''}
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close agreement details modal
function closeAgreementDetailsModal() {
    const modal = document.getElementById('agreementDetailsModal');
    if (modal) {
        modal.remove();
    }
}

// Initialize booking agreements
async function initializeBookingAgreements() {
    console.log('Initializing booking agreements system...');

    // Load templates
    await loadAgreementTemplates();

    // Create modal if it doesn't exist
    if (!document.getElementById('bookingAgreementModal')) {
        createBookingAgreementModal();
    }

    // Update all session cards with agreement status
    await updateAllAgreementStatuses();
}

// Create the modal HTML structure
function createBookingAgreementModal() {
    const modalHTML = `
        <div id="bookingAgreementModal" class="booking-modal" style="display: none;">
            <div class="booking-modal-content">
                <div class="booking-modal-header">
                    <h2 id="agreementModalTitle">Booking Agreement</h2>
                    <button class="booking-modal-close" onclick="closeBookingAgreementModal()">&times;</button>
                </div>

                <div class="booking-modal-body">
                    <!-- Agreement Viewer (for sent/signed) - SHOWN FIRST -->
                    <div id="agreementViewer" class="viewer-section" style="display: none;">
                        <div class="agreement-status-badge">
                            <span id="agreementStatusBadge"></span>
                        </div>
                        <div id="agreementViewContent" class="agreement-content-viewer"></div>
                        <div id="signatureInfo" class="signature-info" style="display: none;">
                            <p><strong>Signed by:</strong> <span id="signerName"></span></p>
                            <p><strong>Date:</strong> <span id="signedDate"></span></p>
                        </div>
                    </div>

                    <!-- Template Selector - ALWAYS AVAILABLE -->
                    <div id="templateSelector" class="template-section">
                        <label for="agreementTemplate">Select Template:</label>
                        <select id="agreementTemplate" onchange="loadSelectedTemplate()">
                            <option value="">Choose a template...</option>
                        </select>
                    </div>

                    <!-- Agreement Editor - ALWAYS AVAILABLE -->
                    <div id="agreementEditor" class="editor-section">
                        <div id="agreementContent" contenteditable="true" class="agreement-content-editor" style="color: #000000 !important; -webkit-text-fill-color: #000000 !important; background-color: white !important; padding: 20px !important; border: 2px solid #ddd !important;"></div>
                    </div>
                </div>

                <div class="booking-modal-footer">
                    <div class="button-group">
                        <button id="previewBtn" class="btn btn-secondary" onclick="previewAgreement()">
                            <i class="fas fa-eye"></i> Preview
                        </button>
                        <button id="saveBtn" class="btn btn-primary" onclick="saveAgreement()">
                            <i class="fas fa-save"></i> Save Draft
                        </button>
                        <button id="sendViaSmsBtn" class="btn btn-success" onclick="sendViaSMS()">
                            <i class="fas fa-sms"></i> Send via Text
                        </button>
                        <button class="btn btn-info" onclick="viewSignedPendingContracts()" style="background-color: #17a2b8; color: white;">
                            📄 Signed/Pending Contracts
                        </button>
                        <button id="downloadBtn" class="btn btn-info" onclick="downloadAgreementPDF()" style="display: none;">
                            <i class="fas fa-download"></i> Download PDF
                        </button>
                        <button id="resendBtn" class="btn btn-warning" onclick="resendAgreement()" style="display: none;">
                            <i class="fas fa-redo"></i> Resend
                        </button>
                        <button id="cancelContractBtn" class="btn btn-danger" onclick="cancelContract()" style="display: none;">
                            <i class="fas fa-times-circle"></i> Cancel Contract
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listener for ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('bookingAgreementModal').style.display === 'flex') {
            closeBookingAgreementModal();
        }
    });
}

// Open booking agreement modal
async function openBookingAgreementModal(sessionId) {
    console.log('Opening booking agreement modal for session:', sessionId);
    currentAgreementSessionId = sessionId;

    // Get session data
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
        showMessage('Session not found', 'error');
        return;
    }

    // Make sure templates are loaded
    if (!agreementTemplates || agreementTemplates.length === 0) {
        await loadAgreementTemplates();
    }

    // Update modal title
    document.getElementById('agreementModalTitle').textContent = 
        `Booking Agreement for ${session.clientName}`;

    // Show modal
    const modal = document.getElementById('bookingAgreementModal');
    modal.style.display = 'flex';

    // Load existing agreement or show template selector
    await loadExistingAgreement(sessionId, session);
}

// Close modal
function closeBookingAgreementModal() {
    const modal = document.getElementById('bookingAgreementModal');
    modal.style.display = 'none';
    currentAgreementSessionId = null;
    currentAgreement = null;
}

// Load agreement templates
async function loadAgreementTemplates() {
    try {
        console.log('Loading booking agreement templates...');
        const response = await fetch('/api/booking/templates');
        console.log('Template response status:', response.status);

        if (response.ok) {
            agreementTemplates = await response.json();
            console.log('Loaded templates:', agreementTemplates.length);

            // Populate template dropdown
            const select = document.getElementById('agreementTemplate');
            if (select) {
                select.innerHTML = '<option value="">Choose a template...</option>';
                agreementTemplates.forEach(template => {
                    const option = document.createElement('option');
                    option.value = template.id;
                    option.textContent = template.name;
                    option.dataset.category = template.category;
                    select.appendChild(option);
                });
            }
        } else {
            console.error('Failed to load templates, status:', response.status);
        }
    } catch (error) {
        console.error('Error loading templates:', error.message || error);
        console.error('Full error details:', error);
    }
}

// Load existing agreement
async function loadExistingAgreement(sessionId, session) {
    try {
        const response = await fetch(`/api/booking/agreements/session/${sessionId}`);
        if (response.ok) {
            const agreement = await response.json();

            if (agreement) {
                currentAgreement = agreement;
                // Show BOTH the existing agreement AND the create new section
                showBothViewAndCreate(agreement, session);
            } else {
                // No agreement exists, show template selector
                showCreateMode(session);
            }
        } else {
            showCreateMode(session);
        }
    } catch (error) {
        console.error('Error loading agreement:', error.message || error);
        console.error('Full error details:', error);
        showCreateMode(session);
    }
}

// Display agreement based on status
function displayAgreement(agreement, session) {
    const status = agreement.status;

    if (status === 'draft') {
        // Show editor mode
        showEditMode(agreement, session);
    } else {
        // ALWAYS show create mode, not viewer
        showBothViewAndCreate(agreement, session);
    }

    updateModalButtons('new'); // Always show create buttons
}

// Show create mode
function showCreateMode(session) {
    document.getElementById('templateSelector').style.display = 'block';
    document.getElementById('agreementEditor').style.display = 'block';
    document.getElementById('agreementViewer').style.display = 'none';

    // Clear editor
    document.getElementById('agreementContent').innerHTML = '';

    // Populate template dropdown if needed
    const select = document.getElementById('agreementTemplate');
    if (select && select.options.length <= 1) {
        // Re-populate dropdown
        select.innerHTML = '<option value="">Choose a template...</option>';
        if (agreementTemplates && agreementTemplates.length > 0) {
            agreementTemplates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                option.dataset.category = template.category;
                select.appendChild(option);
            });
            console.log('Populated dropdown with', agreementTemplates.length, 'templates');
        }
    }

    // Reset template selector
    document.getElementById('agreementTemplate').value = '';

    updateModalButtons('new');
}

// Show edit mode
function showEditMode(agreement, session) {
    document.getElementById('templateSelector').style.display = 'block';
    document.getElementById('agreementEditor').style.display = 'block';
    document.getElementById('agreementViewer').style.display = 'none';

    // Load content into editor
    document.getElementById('agreementContent').innerHTML = agreement.content;

    // Select template if applicable
    if (agreement.template_id) {
        document.getElementById('agreementTemplate').value = agreement.template_id;
    }
}

// Show view mode - DEPRECATED, redirects to showBothViewAndCreate
function showViewMode(agreement, session) {
    // Don't show viewer anymore, always show create mode
    showBothViewAndCreate(agreement, session);
}

// Show both view and create mode for existing contracts
function showBothViewAndCreate(agreement, session) {
    // ALWAYS show the create interface, never just the viewer
    document.getElementById('templateSelector').style.display = 'block';
    document.getElementById('agreementEditor').style.display = 'block';
    document.getElementById('agreementViewer').style.display = 'none'; // Hide viewer
    
    // Clear editor for new contract
    document.getElementById('agreementContent').innerHTML = '';
    document.getElementById('agreementTemplate').value = '';
    
    // Populate template dropdown
    const select = document.getElementById('agreementTemplate');
    if (select && select.options.length <= 1) {
        select.innerHTML = '<option value="">Choose a template...</option>';
        if (agreementTemplates && agreementTemplates.length > 0) {
            agreementTemplates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                option.dataset.category = template.category;
                select.appendChild(option);
            });
        }
    }
    
    
    // Update buttons for creating new contracts
    updateModalButtons('new');
}

// Load selected template
function loadSelectedTemplate() {
    const templateId = document.getElementById('agreementTemplate').value;
    if (!templateId) return;

    const template = agreementTemplates.find(t => t.id === templateId);
    if (!template) return;

    const session = sessions.find(s => s.id === currentAgreementSessionId);
    if (!session) return;

    // Replace template variables with session data
    let content = template.content;
    content = replaceTemplateVariables(content, session);

    // Load into editor
    document.getElementById('agreementContent').innerHTML = content;
}

// Replace template variables
function replaceTemplateVariables(content, session) {
    const replacements = {
        '{{clientName}}': session.clientName,
        '{{clientEmail}}': session.email,
        '{{clientPhone}}': session.phoneNumber,
        '{{sessionType}}': session.sessionType,
        '{{sessionDate}}': new Date(session.dateTime).toLocaleDateString(),
        '{{sessionTime}}': new Date(session.dateTime).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        }),
        '{{location}}': session.location,
        '{{duration}}': session.duration,
        '{{price}}': session.price,
        '{{depositAmount}}': session.depositAmount || Math.round(session.price * 0.3),
        '{{balanceAmount}}': session.price - (session.depositAmount || Math.round(session.price * 0.3)),
        '{{photographerName}}': 'Your Photography Business',
        '{{imageCount}}': '20-30',
        '{{startTime}}': new Date(session.dateTime).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        }),
        '{{endTime}}': new Date(new Date(session.dateTime).getTime() + session.duration * 60000)
            .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        '{{paymentDueDate}}': new Date(new Date(session.dateTime).getTime() - 14 * 24 * 60 * 60 * 1000)
            .toLocaleDateString()
    };

    for (const [key, value] of Object.entries(replacements)) {
        content = content.replace(new RegExp(key, 'g'), value);
    }

    return content;
}

// Save agreement
async function saveAgreement() {
    const content = document.getElementById('agreementContent').innerHTML;
    const templateId = document.getElementById('agreementTemplate').value;

    if (!content.trim()) {
        showMessage('Please add content to the agreement', 'error');
        return;
    }

    try {
        const response = await fetch('/api/booking/agreements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: currentAgreementSessionId,
                templateId: templateId || null,
                content: content,
                agreementId: currentAgreement?.id || null
            })
        });

        if (response.ok) {
            const agreement = await response.json();
            currentAgreement = agreement;
            showMessage('Agreement saved successfully', 'success');
            updateAgreementStatus(currentAgreementSessionId, 'draft');
        } else {
            showMessage('Failed to save agreement', 'error');
        }
    } catch (error) {
        console.error('Error saving agreement:', error.message || error);
        console.error('Full error details:', error);
        showMessage('Error saving agreement: ' + (error.message || 'Unknown error'), 'error');
    }
}

// Send for signature
async function sendForSignature() {
    console.log('🚀🚀🚀 SEND BUTTON CLICKED!!!');
    console.log('Current agreement:', currentAgreement);
    console.log('Current session ID:', currentAgreementSessionId);
    console.log('Sessions available:', sessions);
    
    // Show a visible alert first
    alert('Contract send button clicked! Choose email or SMS.');
    
    // Get the current session
    const session = sessions.find(s => s.id === currentAgreementSessionId);
    if (!session) {
        console.log('❌ No session found, creating basic session');
        // Try to get session info from the modal title
        const modalTitle = document.getElementById('agreementModalTitle');
        const clientName = modalTitle ? modalTitle.textContent.replace('Booking Agreement for ', '') : 'Client';
        
        // Create a basic session object
        const basicSession = {
            id: currentAgreementSessionId,
            clientName: clientName,
            email: 'test@example.com',
            phoneNumber: '555-1234'
        };
        
        console.log('📧 Showing modal with basic session:', basicSession);
        showSendChoiceModal(basicSession);
        return;
    }
    
    console.log('📧 Showing modal with found session:', session);
    showSendChoiceModal(session);
}

// Simple modal to choose send method
function showSendChoiceModal(session) {
    console.log('📧 Showing send choice modal');
    
    // Remove any existing modal
    const existing = document.getElementById('send-choice-popup');
    if (existing) existing.remove();
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'send-choice-popup';
    overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.7) !important;
        z-index: 99999999 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white !important;
        padding: 30px !important;
        border-radius: 10px !important;
        max-width: 450px !important;
        width: 90% !important;
        text-align: center !important;
    `;
    
    modalContent.innerHTML = `
        <h2 style="color: #333; margin-bottom: 20px;">How to Send Contract?</h2>
        <p style="color: #666; margin-bottom: 30px;">Choose how to send the contract to ${session.clientName}</p>
        
        <div style="display: flex; gap: 20px; margin-bottom: 20px;">
            <button id="email-send-btn" style="
                flex: 1;
                padding: 20px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 18px;
                cursor: pointer;
            ">
                📧 Email<br>
                <span style="font-size: 12px;">${session.email}</span>
            </button>
            
            <button id="sms-send-btn" style="
                flex: 1;
                padding: 20px;
                background: #28a745;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 18px;
                cursor: pointer;
            ">
                💬 SMS<br>
                <span style="font-size: 12px;">${session.phoneNumber}</span>
            </button>
        </div>
        
        <button id="cancel-send-btn" style="
            width: 100%;
            padding: 12px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
        ">Cancel</button>
    `;
    
    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);
    
    // Add event listeners
    document.getElementById('email-send-btn').onclick = async function() {
        console.log('Email option selected');
        overlay.remove();
        
        // Save agreement first if needed
        if (!currentAgreement) {
            await saveAgreement();
        }
        
        if (currentAgreement && session.id) {
            sendViaEmail(session.id);
        } else {
            showMessage('Please save the agreement first', 'error');
        }
    };
    
    document.getElementById('sms-send-btn').onclick = async function() {
        console.log('SMS option selected');
        overlay.remove();
        
        // Save agreement first if needed
        if (!currentAgreement) {
            await saveAgreement();
        }
        
        if (currentAgreement && session.id) {
            sendViaSMS(session.id);
        } else {
            showMessage('Please save the agreement first', 'error');
        }
    };
    
    document.getElementById('cancel-send-btn').onclick = function() {
        console.log('Cancel selected');
        overlay.remove();
    };
}

// Show modal for choosing send method
function showSendOptionsModal(session) {
    console.log('📧 showSendOptionsModal called with session:', session);
    
    // Remove any existing modal first
    const existingModal = document.querySelector('.send-options-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'send-options-modal';
    const isResend = currentAgreement?.status === 'sent' || currentAgreement?.status === 'viewed';
    const isSigned = currentAgreement?.status === 'signed';
    
    const title = isSigned ? 'Send to Another Recipient' : (isResend ? 'Resend Contract' : 'Send Contract for Signature');
    const subtitle = isSigned ? 
        `This contract has already been signed. You can send it to another recipient if needed.` :
        (isResend ? 
            `The contract was previously sent. Choose how to resend it to ${session.clientName}:` :
            `How would you like to send the contract to ${session.clientName}?`);
    
    // Set critical styles directly on the modal for immediate visibility
    modal.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: rgba(0, 0, 0, 0.6) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 999999 !important;
    `;
    
    modal.innerHTML = `
        <div class="send-options-content" style="
            background: white !important;
            padding: 30px !important;
            border-radius: 12px !important;
            max-width: 500px !important;
            width: 90% !important;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important;
            position: relative !important;
            z-index: 1000000 !important;
        ">
            <h3 style="margin-bottom: 15px; color: #333;">${title}</h3>
            <p style="color: #666; margin-bottom: 25px;">${subtitle}</p>
            
            <div class="send-options" style="display: flex; gap: 15px; margin: 20px 0;">
                <div class="send-option" onclick="sendViaEmail('${session.id}')" style="
                    flex: 1;
                    padding: 20px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.3s;
                    background: white;
                ">
                    <i class="fas fa-envelope" style="font-size: 32px; color: #3498db; display: block; margin-bottom: 10px;"></i>
                    <h4 style="margin: 10px 0 5px 0; color: #333;">Email</h4>
                    <p class="send-option-detail" style="font-size: 14px; color: #666; margin: 5px 0;">${session.email || 'No email provided'}</p>
                    ${!session.email ? '<p class="text-danger" style="color: #dc3545; font-size: 12px; margin-top: 5px;">Email address required</p>' : ''}
                </div>
                
                <div class="send-option" onclick="sendViaSMS('${session.id}')" style="
                    flex: 1;
                    padding: 20px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.3s;
                    background: white;
                ">
                    <i class="fas fa-sms" style="font-size: 32px; color: #27ae60; display: block; margin-bottom: 10px;"></i>
                    <h4 style="margin: 10px 0 5px 0; color: #333;">Text Message (SMS)</h4>
                    <p class="send-option-detail" style="font-size: 14px; color: #666; margin: 5px 0;">${session.phoneNumber || 'No phone number provided'}</p>
                    ${!session.phoneNumber ? '<p class="text-danger" style="color: #dc3545; font-size: 12px; margin-top: 5px;">Phone number required</p>' : ''}
                </div>
            </div>
            
            <div class="send-options-footer" style="text-align: center; padding-top: 15px; border-top: 1px solid #e0e0e0; margin-top: 20px;">
                <button class="btn btn-secondary" onclick="closeSendOptionsModal()" style="
                    padding: 10px 30px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">Cancel</button>
            </div>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .send-options-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }
        
        .send-options-content {
            background: white;
            border-radius: 10px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }
        
        .send-options-content h3 {
            margin: 0 0 10px 0;
            color: #333;
        }
        
        .send-options-content p {
            color: #666;
            margin-bottom: 20px;
        }
        
        .send-options {
            display: flex;
            gap: 15px;
            margin: 20px 0;
        }
        
        .send-option {
            flex: 1;
            padding: 20px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .send-option:hover:not(.disabled) {
            border-color: #667eea;
            background: #f8f9ff;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }
        
        .send-option.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .send-option i {
            font-size: 32px;
            color: #667eea;
            margin-bottom: 10px;
        }
        
        .send-option h4 {
            margin: 10px 0 5px 0;
            color: #333;
        }
        
        .send-option-detail {
            font-size: 14px;
            color: #666;
            margin: 5px 0;
        }
        
        .send-options-footer {
            text-align: center;
            padding-top: 15px;
            border-top: 1px solid #e0e0e0;
            margin-top: 20px;
        }
        
        .text-danger {
            color: #dc3545;
            font-size: 12px;
            margin-top: 5px;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    console.log('✅ Modal added to DOM');
    console.log('Modal element:', modal);
    console.log('Modal visible:', modal.style.display);
    
    // Force the modal to be visible
    setTimeout(() => {
        const addedModal = document.querySelector('.send-options-modal');
        if (addedModal) {
            console.log('✅ Modal found in DOM after adding');
            addedModal.style.display = 'flex !important';
        } else {
            console.log('❌ Modal NOT found in DOM after adding');
        }
    }, 100);
}

// Close send options modal
function closeSendOptionsModal() {
    const modal = document.querySelector('.send-options-modal');
    if (modal) {
        modal.remove();
    }
}

// Send via Email using mailto link
async function sendViaEmail(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || !session.email) {
        showMessage('Email address is required', 'error');
        return;
    }
    
    closeSendOptionsModal();
    
    try {
        // Save the contract and get signing link
        const response = await fetch(`/api/booking/agreements/${currentAgreement.id}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientEmail: session.email,
                clientName: session.clientName,
                sessionType: session.sessionType,
                sessionDate: new Date(session.dateTime).toLocaleDateString(),
                sendMethod: 'email'
            })
        });

        if (response.ok) {
            const result = await response.json();
            
            // Check if backend returned a mailto URL
            if (result.mailtoUrl) {
                // Use the mailto URL from backend
                window.location.href = result.mailtoUrl;
                showMessage('Opening email client...', 'success');
            } else {
                // Fallback to creating our own (shouldn't happen with updated backend)
                const signingLink = result.signingUrl || `${window.location.origin}/sign-contract?token=${result.accessToken}`;
                const subject = `Photography Contract - ${session.sessionType} Session`;
                const body = `Hello ${session.clientName},\n\nPlease review and sign your photography contract for your session on ${new Date(session.dateTime).toLocaleDateString()}.\n\nClick here to sign: ${signingLink}\n\nThank you!`;
                window.location.href = `mailto:${session.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                showMessage('Opening email client...', 'success');
            }
            
            updateAgreementStatus(currentAgreementSessionId, 'sent');
            currentAgreement.status = 'sent';
            
            // Close modal after short delay
            setTimeout(() => {
                closeBookingAgreementModal();
            }, 1500);
        } else {
            showMessage('Failed to prepare contract', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error sending contract', 'error');
    }
}

// Send via SMS using sms: link
async function sendViaSMS(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || !session.phoneNumber) {
        showMessage('Phone number is required', 'error');
        return;
    }
    
    closeSendOptionsModal();
    
    try {
        // Save the contract and get signing link
        const response = await fetch(`/api/booking/agreements/${currentAgreement.id}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientPhone: session.phoneNumber,
                clientName: session.clientName,
                sessionType: session.sessionType,
                sessionDate: new Date(session.dateTime).toLocaleDateString(),
                sendMethod: 'sms'
            })
        });

        if (response.ok) {
            const result = await response.json();
            
            // Check if backend returned an sms URL
            if (result.smsUrl) {
                // Use the sms URL from backend
                window.location.href = result.smsUrl;
                showMessage('Opening SMS app...', 'success');
            } else {
                // Fallback to creating our own (shouldn't happen with updated backend)
                const signingLink = result.signingUrl || `${window.location.origin}/sign-contract?token=${result.accessToken}`;
                const cleanPhone = session.phoneNumber.replace(/\D/g, '');
                const message = `Hi ${session.clientName}, please sign your photography contract: ${signingLink}`;
                const smsLink = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
                window.location.href = smsLink;
                showMessage('Opening SMS app...', 'success');
            }
            
            updateAgreementStatus(currentAgreementSessionId, 'sent');
            currentAgreement.status = 'sent';
            
            // Close modal after short delay
            setTimeout(() => {
                closeBookingAgreementModal();
            }, 1500);
        } else {
            showMessage('Failed to prepare contract', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error sending contract', 'error');
    }
}

// Show modal with signing link for manual copying
function showSigningLinkModal(signingUrl, phoneNumber) {
    const modal = document.createElement('div');
    modal.className = 'signing-link-modal';
    modal.innerHTML = `
        <div class="signing-link-content">
            <h3>Contract Signing Link</h3>
            <p>Copy this link to share with your client:</p>
            
            <div class="link-container">
                <input type="text" id="signingLinkInput" value="${signingUrl}" readonly />
                <button onclick="copySigningLink()" class="btn btn-primary">
                    <i class="fas fa-copy"></i> Copy Link
                </button>
            </div>
            
            ${phoneNumber ? `
            <div class="sms-instructions">
                <p><i class="fas fa-info-circle"></i> To send via SMS:</p>
                <ol>
                    <li>Copy the link above</li>
                    <li>Open your messaging app</li>
                    <li>Paste the link in a message to ${phoneNumber}</li>
                </ol>
            </div>
            ` : ''}
            
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeSigningLinkModal()">Close</button>
            </div>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .signing-link-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        }
        
        .signing-link-content {
            background: white;
            border-radius: 10px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }
        
        .link-container {
            display: flex;
            gap: 10px;
            margin: 20px 0;
        }
        
        .link-container input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
        }
        
        .sms-instructions {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        
        .sms-instructions ol {
            margin: 10px 0 0 20px;
            padding: 0;
        }
        
        .sms-instructions li {
            margin: 5px 0;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
}

// Copy signing link to clipboard
function copySigningLink() {
    const input = document.getElementById('signingLinkInput');
    input.select();
    document.execCommand('copy');
    showMessage('Link copied to clipboard!', 'success');
}

// Close signing link modal
function closeSigningLinkModal() {
    const modal = document.querySelector('.signing-link-modal');
    if (modal) {
        modal.remove();
    }
}

// Update modal buttons based on status
function updateModalButtons(status) {
    const previewBtn = document.getElementById('previewBtn');
    const saveBtn = document.getElementById('saveBtn');
    const sendBtn = document.getElementById('sendBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const resendBtn = document.getElementById('resendBtn');
    const cancelContractBtn = document.getElementById('cancelContractBtn');

    // Always show buttons for creating/sending new contracts
    if (previewBtn) previewBtn.style.display = 'inline-block';
    if (saveBtn) saveBtn.style.display = 'inline-block';
    if (sendBtn) sendBtn.style.display = 'inline-block';

    // Reset send button text to default
    if (sendBtn) {
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Contract';
    }

    // Show additional buttons based on existing contract status
    switch(status) {
        case 'sent':
        case 'viewed':
            if (downloadBtn) downloadBtn.style.display = 'inline-block';
            // Show cancel button for pending contracts
            if (cancelContractBtn) cancelContractBtn.style.display = 'inline-block';
            break;
        case 'signed':
            if (downloadBtn) downloadBtn.style.display = 'inline-block';
            break;
    }
}

// Update agreement status on session card
function updateAgreementStatus(sessionId, status) {
    // Look for booking agreement button with data-session-id attribute
    const button = document.querySelector(`.booking-agreement-btn[data-session-id="${sessionId}"]`);
    if (!button) {
        console.log(`No booking agreement button found for session ${sessionId}`);
        return;
    }

    const statusSpan = button.querySelector('.agreement-status');
    if (!statusSpan) {
        console.log(`No status span found in booking agreement button for session ${sessionId}`);
        return;
    }

    // Update button appearance
    button.className = `btn booking-agreement-btn btn-agreement-${status}`;

    // Update status text
    statusSpan.textContent = getStatusText(status);

    console.log(`Updated booking agreement status for session ${sessionId} to ${status}`);
}

// Get status display text
function getStatusText(status) {
    const statusTexts = {
        'draft': 'Draft Agreement',
        'sent': 'Pending Signature',
        'viewed': 'Viewed by Client',
        'signed': 'Signed ✓',
        'none': 'Create Agreement'
    };
    return statusTexts[status] || 'Create Agreement';
}

// Update all agreement statuses
async function updateAllAgreementStatuses() {
    // Make sure sessions exist
    if (typeof sessions === 'undefined' || !sessions) {
        console.log('Sessions not yet loaded for booking agreements');
        return;
    }

    const sessionIds = sessions.map(s => s.id);
    if (sessionIds.length === 0) return;

    try {
        const response = await fetch('/api/booking/agreements/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionIds })
        });

        if (response.ok) {
            const statusMap = await response.json();

            sessionIds.forEach(sessionId => {
                const status = statusMap[sessionId]?.status || 'none';
                updateAgreementStatus(sessionId, status);
            });
        }
    } catch (error) {
        console.error('Error updating agreement statuses:', error);
    }
}

// Preview agreement
function previewAgreement() {
    const content = document.getElementById('agreementContent').innerHTML;
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Agreement Preview</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    max-width: 800px; 
                    margin: 40px auto; 
                    padding: 20px;
                    line-height: 1.6;
                }
                h2 { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
                h3 { color: #555; margin-top: 30px; }
                ul { margin: 10px 0; }
                .signature-section { 
                    margin-top: 50px; 
                    padding: 20px; 
                    border: 1px solid #ddd;
                    background: #f9f9f9;
                }
            </style>
        </head>
        <body>${content}</body>
        </html>
    `);
}

// Download agreement as PDF
async function downloadAgreementPDF() {
    if (!currentAgreement) return;

    // This would typically generate a PDF server-side
    // For now, we'll open a print dialog
    const content = document.getElementById('agreementViewContent').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Booking Agreement</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    max-width: 800px; 
                    margin: 40px auto; 
                    padding: 20px;
                }
                @media print {
                    body { margin: 0; }
                }
            </style>
        </head>
        <body onload="window.print();">${content}</body>
        </html>
    `);
}

// Cancel contract function
async function cancelContract() {
    if (!currentAgreementSessionId) return;
    
    // Confirm cancellation
    if (!confirm('Are you sure you want to cancel this contract? This will mark it as cancelled and remove the pending status.')) {
        return;
    }
    
    try {
        const token = await getAuthToken();
        if (!token) {
            showMessage('Please log in to cancel contracts', 'error');
            return;
        }
        
        const response = await fetch(`/api/booking-agreements/${currentAgreementSessionId}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to cancel contract');
        }
        
        const result = await response.json();
        showMessage('Contract cancelled successfully', 'success');
        
        // Update the current agreement status
        if (currentAgreement) {
            currentAgreement.status = 'cancelled';
        }
        
        // Close the modal
        closeBookingAgreementModal();
        
        // Update the session card to reflect the change
        updateAgreementStatus(currentAgreementSessionId, 'cancelled');
        
        // Reload sessions to refresh the data
        if (typeof loadSessions === 'function') {
            await loadSessions();
        }
        
    } catch (error) {
        console.error('Error cancelling contract:', error);
        showMessage('Failed to cancel contract: ' + error.message, 'error');
    }
}

// Resend agreement
async function resendAgreement() {
    // Just call sendForSignature which will show the send options modal
    await sendForSignature();
}

// View pending contract in separate modal
async function viewPendingContract(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    try {
        const response = await fetch(`/api/booking/agreements/session/${sessionId}`);
        if (!response.ok) return;
        
        const agreement = await response.json();
        if (!agreement) return;
        
        // Create a simple modal to view pending contract
        const modal = document.createElement('div');
        modal.className = 'pending-contract-modal';
        modal.innerHTML = `
            <div class="pending-contract-overlay" onclick="this.parentElement.remove()">
                <div class="pending-contract-content" onclick="event.stopPropagation()">
                    <div class="pending-contract-header">
                        <h3>Pending Contract - ${session.clientName}</h3>
                        <button onclick="this.closest('.pending-contract-modal').remove()" class="close-btn">&times;</button>
                    </div>
                    
                    <div class="pending-contract-body">
                        <div class="status-badge status-${agreement.status}">
                            ${getStatusText(agreement.status)}
                        </div>
                        <div class="contract-preview">
                            ${agreement.content}
                        </div>
                    </div>
                    
                    <div class="pending-contract-footer">
                        <button class="btn btn-primary" onclick="resendPendingContract('${sessionId}')">
                            <i class="fas fa-redo"></i> Resend
                        </button>
                        <button class="btn btn-danger" onclick="cancelPendingContract('${sessionId}')">
                            <i class="fas fa-times"></i> Cancel Contract
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('.pending-contract-modal').remove()">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        const styles = `
            <style>
                .pending-contract-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10001;
                }
                
                .pending-contract-overlay {
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .pending-contract-content {
                    background: white;
                    border-radius: 10px;
                    width: 90%;
                    max-width: 700px;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                }
                
                .pending-contract-header {
                    padding: 20px;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .pending-contract-body {
                    padding: 20px;
                    overflow-y: auto;
                    flex: 1;
                }
                
                .pending-contract-footer {
                    padding: 20px;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                
                .contract-preview {
                    margin-top: 20px;
                    padding: 20px;
                    background: #f9fafb;
                    border-radius: 6px;
                    border: 1px solid #e5e7eb;
                }
            </style>
        `;
        
        if (!document.querySelector('.pending-contract-styles')) {
            const styleEl = document.createElement('div');
            styleEl.className = 'pending-contract-styles';
            styleEl.innerHTML = styles;
            document.head.appendChild(styleEl);
        }
        
        document.body.appendChild(modal);
        
        // Store for resend
        window.pendingContractAgreement = agreement;
        window.pendingContractSession = session;
        
    } catch (error) {
        console.error('Error viewing pending contract:', error);
    }
}

// Resend pending contract
async function resendPendingContract(sessionId) {
    const modal = document.querySelector('.pending-contract-modal');
    if (modal) modal.remove();
    
    // Open booking modal to resend
    currentAgreementSessionId = sessionId;
    currentAgreement = window.pendingContractAgreement;
    await openBookingAgreementModal(sessionId);
}

// Cancel pending contract
async function cancelPendingContract(sessionId) {
    if (!confirm('Are you sure you want to cancel this contract?')) return;
    
    currentAgreementSessionId = sessionId;
    await cancelContract();
    
    const modal = document.querySelector('.pending-contract-modal');
    if (modal) modal.remove();
}

// Helper functions for existing contract actions
async function viewExistingInNewModal(sessionId) {
    await viewPendingContract(sessionId);
}

async function resendExistingContract(sessionId) {
    // Get the session
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    // Show send options modal directly
    showSendOptionsModal(session);
}

async function cancelExistingContract(sessionId) {
    currentAgreementSessionId = sessionId;
    await cancelContract();
}

// Expose functions globally
window.openBookingAgreementModal = openBookingAgreementModal;
window.closeBookingAgreementModal = closeBookingAgreementModal;
window.loadSelectedTemplate = loadSelectedTemplate;
window.saveAgreement = saveAgreement;
window.sendForSignature = sendForSignature;

// FORCE OVERRIDE THE FUNCTION TO MAKE SURE IT WORKS
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 FORCING sendForSignature override');
    
    window.sendForSignature = async function() {
        console.log('🚨🚨🚨 OVERRIDE FUNCTION CALLED!!!');
        alert('OVERRIDE: Choose how to send the contract!');
        
        // Create a super simple modal
        const modal = document.createElement('div');
        modal.id = 'simple-send-modal';
        modal.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: white !important;
            padding: 30px !important;
            border: 3px solid red !important;
            z-index: 999999 !important;
        `;
        
        modal.innerHTML = `
            <h2>SEND CONTRACT</h2>
            <p>Choose method:</p>
            <button onclick="alert('Email selected!'); document.getElementById('simple-send-modal').remove();" style="padding: 10px; margin: 5px; background: blue; color: white;">EMAIL</button>
            <button onclick="alert('SMS selected!'); document.getElementById('simple-send-modal').remove();" style="padding: 10px; margin: 5px; background: green; color: white;">SMS</button>
            <button onclick="viewSignedPendingContracts(); document.getElementById('simple-send-modal').remove();" style="padding: 10px; margin: 5px; background: #17a2b8; color: white;">📄 SIGNED/PENDING CONTRACTS</button>
            <br><br>
            <button onclick="document.getElementById('simple-send-modal').remove();" style="padding: 10px; background: gray; color: white;">CANCEL</button>
        `;
        
        document.body.appendChild(modal);
    };
});
window.previewAgreement = previewAgreement;
window.downloadAgreementPDF = downloadAgreementPDF;
window.resendAgreement = resendAgreement;
window.cancelContract = cancelContract;
window.viewPendingContract = viewPendingContract;
window.resendPendingContract = resendPendingContract;
window.cancelPendingContract = cancelPendingContract;
window.viewExistingInNewModal = viewExistingInNewModal;
window.resendExistingContract = resendExistingContract;
window.cancelExistingContract = cancelExistingContract;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM loaded - initializing booking agreements...');
        initializeBookingAgreements();
    });
} else {
    console.log('DOM already loaded - initializing booking agreements...');
    initializeBookingAgreements();
}

// Make sure to update statuses when sessions are loaded
window.addEventListener('sessionsLoaded', function() {
    console.log('Sessions loaded event - updating booking agreement statuses');
    setTimeout(updateAllAgreementStatuses, 500);
});

// Also listen for when sessions are rendered
window.addEventListener('sessionsRendered', function() {
    console.log('Sessions rendered event - updating booking agreement statuses');
    setTimeout(updateAllAgreementStatuses, 100);
});

// Force add the signed/pending contracts button whenever modal opens
function forceAddSignedPendingButton() {
    setTimeout(() => {
        console.log('🔧 FORCING signed/pending button insertion');
        
        // Find the modal and look for the button group
        const modal = document.getElementById('bookingAgreementModal');
        if (!modal) return;
        
        const buttonGroup = modal.querySelector('.button-group');
        if (!buttonGroup) return;
        
        // Check if our button already exists
        const existingButton = buttonGroup.querySelector('button[onclick*="viewSignedPendingContracts"]');
        if (existingButton) return; // Already exists
        
        // Find the Send via Text button or Save Draft button as reference
        const sendTextBtn = buttonGroup.querySelector('button[onclick*="sendViaSMS"], button[id="sendViaSmsBtn"]');
        const saveDraftBtn = buttonGroup.querySelector('button[onclick*="saveAgreement"], button[id="saveBtn"]');
        const referenceBtn = sendTextBtn || saveDraftBtn;
        
        if (!referenceBtn) return;
        
        // Create and insert the new button
        const newButton = document.createElement('button');
        newButton.className = 'btn btn-info';
        newButton.onclick = () => viewSignedPendingContracts();
        newButton.style.cssText = 'background-color: #17a2b8; color: white; margin-left: 10px;';
        newButton.innerHTML = '📄 Signed/Pending Contracts';
        
        // Insert after the reference button
        referenceBtn.parentNode.insertBefore(newButton, referenceBtn.nextSibling);
        console.log('✅ Successfully forced signed/pending button insertion');
    }, 200);
}

// Override the openBookingAgreementModal function to add our button
const originalOpenBookingAgreementModal = window.openBookingAgreementModal;
window.openBookingAgreementModal = function(sessionId) {
    if (originalOpenBookingAgreementModal) {
        originalOpenBookingAgreementModal(sessionId);
    }
    forceAddSignedPendingButton();
};

// AGGRESSIVE DOM INJECTION - Watch for modal and inject button immediately
const modalObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1 && node.id === 'bookingAgreementModal') {
                    // Modal was just added to DOM, inject our button immediately
                    setTimeout(() => {
                        const sendViaSmsBtn = node.querySelector('#sendViaSmsBtn');
                        if (sendViaSmsBtn && !node.querySelector('button[onclick*="viewSignedPendingContracts"]')) {
                            const newButton = document.createElement('button');
                            newButton.className = 'btn btn-info';
                            newButton.onclick = () => viewSignedPendingContracts();
                            newButton.style.cssText = 'background-color: #17a2b8; color: white; margin-left: 10px;';
                            newButton.innerHTML = '📄 Signed/Pending Contracts';
                            sendViaSmsBtn.parentNode.insertBefore(newButton, sendViaSmsBtn.nextSibling);
                            console.log('🚀 AGGRESSIVE INJECTION: Button added to DOM!');
                        }
                    }, 10);
                }
            });
        }
    });
});

// Start watching for DOM changes
modalObserver.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('🔍 DOM observer started - watching for booking modal');

// BACKUP INJECTION - Check periodically for the modal
setInterval(() => {
    const modal = document.getElementById('bookingAgreementModal');
    if (modal && modal.style.display !== 'none') {
        const sendViaSmsBtn = modal.querySelector('#sendViaSmsBtn');
        const existingBtn = modal.querySelector('button[onclick*="viewSignedPendingContracts"]');
        
        if (sendViaSmsBtn && !existingBtn) {
            const newButton = document.createElement('button');
            newButton.className = 'btn btn-info';
            newButton.onclick = () => viewSignedPendingContracts();
            newButton.style.cssText = 'background-color: #17a2b8; color: white; margin-left: 10px;';
            newButton.innerHTML = '📄 Signed/Pending Contracts';
            sendViaSmsBtn.parentNode.insertBefore(newButton, sendViaSmsBtn.nextSibling);
            console.log('🔄 BACKUP INJECTION: Button added via interval check!');
        }
    }
}, 500);