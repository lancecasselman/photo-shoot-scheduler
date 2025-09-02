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
                    <!-- Template Selector -->
                    <div id="templateSelector" class="template-section">
                        <label for="agreementTemplate" style="display: block; color: #000000; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Select Template:</label>
                        <select id="agreementTemplate" onchange="loadSelectedTemplate()" style="width: 100%; padding: 10px 12px; border: 2px solid #e2e8f0; border-radius: 5px; font-size: 14px; color: #000000; background-color: white; cursor: pointer;">
                            <option value="" style="color: #666666;">Choose a template...</option>
                        </select>
                    </div>

                    <!-- Agreement Editor -->
                    <div id="agreementEditor" class="editor-section">
                        <div id="agreementContent" contenteditable="true" class="agreement-content-editor" style="color: #000000 !important; -webkit-text-fill-color: #000000 !important; background-color: white !important; padding: 20px !important; border: 2px solid #ddd !important;"></div>
                    </div>

                    <!-- Agreement Viewer (for sent/signed) -->
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
                        <button id="downloadBtn" class="btn btn-info" onclick="downloadAgreementPDF()" style="display: none;">
                            <i class="fas fa-download"></i> Download PDF
                        </button>
                        <button id="resendBtn" class="btn btn-warning" onclick="resendAgreement()" style="display: none;">
                            <i class="fas fa-redo"></i> Resend
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
    
    // Inject a critical style element to force black text
    if (!document.getElementById('forceBlackTextStyles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'forceBlackTextStyles';
        styleEl.innerHTML = `
            #bookingAgreementModal * {
                color: #000000 !important;
                -webkit-text-fill-color: #000000 !important;
            }
            #agreementContent * {
                color: #000000 !important;
                -webkit-text-fill-color: #000000 !important;
            }
            [contenteditable="true"] * {
                color: #000000 !important;
                -webkit-text-fill-color: #000000 !important;
            }
        `;
        document.head.appendChild(styleEl);
    }
    
    // Force ALL text in the modal to be black
    setTimeout(() => {
        const allElements = modal.querySelectorAll('*');
        allElements.forEach(element => {
            element.style.setProperty('color', '#000000', 'important');
            element.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
        });
        
        // Specifically target the content areas
        const contentEditor = document.getElementById('agreementContent');
        const contentViewer = document.getElementById('agreementViewContent');
        
        if (contentEditor) {
            contentEditor.style.setProperty('color', '#000000', 'important');
            contentEditor.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
            contentEditor.querySelectorAll('*').forEach(el => {
                el.style.setProperty('color', '#000000', 'important');
                el.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
            });
        }
        
        if (contentViewer) {
            contentViewer.style.setProperty('color', '#000000', 'important');
            contentViewer.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
            contentViewer.querySelectorAll('*').forEach(el => {
                el.style.setProperty('color', '#000000', 'important');
                el.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
            });
        }
    }, 200);

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
                select.innerHTML = '<option value="" style="color: #666666;">Choose a template...</option>';
                agreementTemplates.forEach(template => {
                    const option = document.createElement('option');
                    option.value = template.id;
                    option.textContent = template.name;
                    option.dataset.category = template.category;
                    option.style.color = '#000000';
                    select.appendChild(option);
                });
            }
        } else {
            console.error('Failed to load templates, status:', response.status);
        }
    } catch (error) {
        console.error('Error loading templates:', error);
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
                displayAgreement(agreement, session);
            } else {
                // No agreement exists, show template selector
                showCreateMode(session);
            }
        } else {
            showCreateMode(session);
        }
    } catch (error) {
        console.error('Error loading agreement:', error);
        showCreateMode(session);
    }
}

// Display agreement based on status
function displayAgreement(agreement, session) {
    const status = agreement.status;

    // Always show create mode instead of viewer mode
    showCreateMode(session);
    updateModalButtons('new');
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
        select.innerHTML = '<option value="" style="color: #666666;">Choose a template...</option>';
        if (agreementTemplates && agreementTemplates.length > 0) {
            agreementTemplates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                option.dataset.category = template.category;
                option.style.color = '#000000';
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

// Show view mode
function showViewMode(agreement, session) {
    document.getElementById('templateSelector').style.display = 'none';
    document.getElementById('agreementEditor').style.display = 'none';
    document.getElementById('agreementViewer').style.display = 'block';

    // Display content
    document.getElementById('agreementViewContent').innerHTML = agreement.content;
    
    // Force all text to be black
    const viewContent = document.getElementById('agreementViewContent');
    if (viewContent) {
        // Apply black color to all child elements
        const allElements = viewContent.querySelectorAll('*');
        allElements.forEach(el => {
            el.style.color = '#000000';
            el.style.setProperty('color', '#000000', 'important');
        });
        // Apply to the container itself
        viewContent.style.color = '#000000';
        viewContent.style.setProperty('color', '#000000', 'important');
    }

    // Show status badge
    const badge = document.getElementById('agreementStatusBadge');
    badge.className = `status-badge status-${agreement.status}`;
    badge.textContent = getStatusText(agreement.status);

    // Show signature info if signed
    if (agreement.status === 'signed' && agreement.signature_data) {
        document.getElementById('signatureInfo').style.display = 'block';
        document.getElementById('signerName').textContent = agreement.signer_name || 'Client';
        document.getElementById('signedDate').textContent = 
            new Date(agreement.signature_date).toLocaleDateString();
    } else {
        document.getElementById('signatureInfo').style.display = 'none';
    }
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
    const editor = document.getElementById('agreementContent');
    editor.innerHTML = content;
    
    // Add inline black styles to EVERY element
    editor.style = 'color: #000000 !important;';
    const allElements = editor.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
        allElements[i].style = 'color: #000000 !important;';
    }
    
    // Force all text to be black immediately and after a delay
    const forceBlackText = () => {
        const contentElement = document.getElementById('agreementContent');
        if (contentElement) {
            // Apply to the container
            contentElement.style.setProperty('color', '#000000', 'important');
            
            // Apply to ALL child elements
            const allElements = contentElement.querySelectorAll('*');
            allElements.forEach(el => {
                el.style.setProperty('color', '#000000', 'important');
            });
            
            // Also apply to any text nodes
            const walker = document.createTreeWalker(
                contentElement,
                NodeFilter.SHOW_ELEMENT,
                null,
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                node.style.setProperty('color', '#000000', 'important');
            }
        }
    };
    
    // Apply immediately
    forceBlackText();
    
    // Apply again after DOM updates
    setTimeout(forceBlackText, 50);
    setTimeout(forceBlackText, 150);
    setTimeout(forceBlackText, 300);
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
        console.error('Error saving agreement:', error);
        showMessage('Error saving agreement', 'error');
    }
}

// Send for signature
async function sendForSignature() {
    if (!currentAgreement) {
        await saveAgreement();
    }

    if (!currentAgreement) return;

    const session = sessions.find(s => s.id === currentAgreementSessionId);
    if (!session) return;

    try {
        const response = await fetch(`/api/booking/agreements/${currentAgreement.id}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientEmail: session.email,
                clientName: session.clientName
            })
        });

        if (response.ok) {
            const result = await response.json();
            showMessage('Agreement sent for signature!', 'success');
            updateAgreementStatus(currentAgreementSessionId, 'sent');
            currentAgreement.status = 'sent';
            displayAgreement(currentAgreement, session);
        } else {
            showMessage('Failed to send agreement', 'error');
        }
    } catch (error) {
        console.error('Error sending agreement:', error);
        showMessage('Error sending agreement', 'error');
    }
}

// Update modal buttons based on status
function updateModalButtons(status) {
    const previewBtn = document.getElementById('previewBtn');
    const saveBtn = document.getElementById('saveBtn');
    const sendBtn = document.getElementById('sendBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const resendBtn = document.getElementById('resendBtn');

    // Reset all buttons
    [previewBtn, saveBtn, sendBtn, downloadBtn, resendBtn].forEach(btn => {
        if (btn) btn.style.display = 'none';
    });

    switch(status) {
        case 'new':
        case 'draft':
            if (previewBtn) previewBtn.style.display = 'inline-block';
            if (saveBtn) saveBtn.style.display = 'inline-block';
            if (sendBtn) sendBtn.style.display = 'inline-block';
            break;
        case 'sent':
        case 'viewed':
            if (downloadBtn) downloadBtn.style.display = 'inline-block';
            if (resendBtn) resendBtn.style.display = 'inline-block';
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
    const signedButton = document.querySelector(`.signed-contract-btn[data-session-id="${sessionId}"]`);
    
    if (!button) {
        // Try again after a short delay in case the button hasn't been rendered yet
        setTimeout(() => {
            const buttonRetry = document.querySelector(`.booking-agreement-btn[data-session-id="${sessionId}"]`);
            const signedButtonRetry = document.querySelector(`.signed-contract-btn[data-session-id="${sessionId}"]`);
            if (buttonRetry) {
                updateAgreementStatusButton(buttonRetry, status);
                updateSignedContractButton(signedButtonRetry, status);
            }
        }, 500);
        return;
    }
    
    updateAgreementStatusButton(button, status);
    updateSignedContractButton(signedButton, status);
}

// Helper function to update the actual button
function updateAgreementStatusButton(button, status) {

    const statusSpan = button.querySelector('.agreement-status');
    if (!statusSpan) {
        return;
    }

    // Update button appearance
    button.className = `btn booking-agreement-btn btn-agreement-${status}`;

    // Update status text
    statusSpan.textContent = getStatusText(status);
}

// Helper function to update the signed contract button
function updateSignedContractButton(signedButton, status) {
    console.log('🔍 updateSignedContractButton called with status:', status, 'button exists:', !!signedButton);
    if (!signedButton) {
        console.log('❌ Signed contract button not found');
        return;
    }

    // Always show the signed contract button, but update its appearance based on status
    signedButton.style.display = 'inline-block';
    console.log('✅ Signed contract button display set to inline-block');
    
    if (status === 'signed') {
        signedButton.style.backgroundColor = '#28a745'; // Green when signed
        signedButton.innerHTML = '✅ <span class="signed-status">View Signed Contract</span>';
        console.log('✅ Contract signed - button shows "View Signed Contract"');
    } else {
        signedButton.style.backgroundColor = '#6c757d'; // Gray when not signed
        signedButton.innerHTML = '📄 <span class="signed-status">No Contract Signed</span>';
        console.log('❌ No contract signed yet - button shows "No Contract Signed"');
    }
}

// Get status display text
function getStatusText(status) {
    const statusTexts = {
        'draft': 'Draft Agreement',
        'sent': '',
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

// Resend agreement
async function resendAgreement() {
    if (!currentAgreement) return;

    const session = sessions.find(s => s.id === currentAgreementSessionId);
    if (!session) return;

    if (confirm('Resend agreement to ' + session.email + '?')) {
        await sendForSignature();
    }
}

// Send via SMS using device's default SMS app
async function sendViaSMS() {
    if (!currentAgreementSessionId) {
        showMessage('Please select a session first', 'error');
        return;
    }

    const session = sessions.find(s => s.id === currentAgreementSessionId);
    if (!session) {
        showMessage('Session not found', 'error');
        return;
    }

    if (!session.phoneNumber) {
        showMessage('No phone number found for this client', 'error');
        return;
    }

    // Get the contract content from the editor
    const agreementContent = document.getElementById('agreementContent');
    if (!agreementContent || !agreementContent.innerHTML.trim()) {
        showMessage('Please create or select a contract first', 'error');
        return;
    }

    try {
        // First save the agreement to get a signable link
        const templateId = document.getElementById('agreementTemplate').value;
        const content = agreementContent.innerHTML;

        const response = await fetch('/api/booking/agreements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: currentAgreementSessionId,
                templateId: templateId,
                content: content,
                agreementId: currentAgreement?.id
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save agreement');
        }

        const savedAgreement = await response.json();

        // Now send it for signature via SMS
        const sendResponse = await fetch(`/api/booking/agreements/${savedAgreement.id}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientEmail: session.email,
                clientPhone: session.phoneNumber,
                clientName: session.clientName,
                sessionType: session.sessionType,
                sessionDate: session.dateTime,
                sendMethod: 'sms'
            })
        });

        if (!sendResponse.ok) {
            throw new Error('Failed to prepare SMS');
        }

        const result = await sendResponse.json();
        
        if (result.success) {
            // Check if we got an SMS URL to open
            if (result.smsUrl) {
                // Open the SMS app with the pre-filled message
                window.location.href = result.smsUrl;
                showMessage('SMS app opened with signable contract link!', 'success');
            } else {
                showMessage('Contract prepared successfully!', 'success');
            }
            
            // Update the agreement status
            currentAgreement = savedAgreement;
            updateModalButtons('sent');
        } else {
            showMessage('Error preparing SMS: ' + result.message, 'error');
        }

    } catch (error) {
        console.error('Error sending via SMS:', error);
        showMessage('Error sending contract: ' + error.message, 'error');
    }
}

// Expose functions globally
window.openBookingAgreementModal = openBookingAgreementModal;
window.closeBookingAgreementModal = closeBookingAgreementModal;
window.loadSelectedTemplate = loadSelectedTemplate;
window.saveAgreement = saveAgreement;
window.sendForSignature = sendForSignature;
window.sendViaSMS = sendViaSMS;
window.previewAgreement = previewAgreement;
window.downloadAgreementPDF = downloadAgreementPDF;
window.resendAgreement = resendAgreement;

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

// Make updateAgreementStatus accessible globally for message handling
window.updateAgreementStatus = updateAgreementStatus;

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