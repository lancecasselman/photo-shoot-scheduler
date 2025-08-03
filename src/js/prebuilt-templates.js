// Prebuilt Templates System for Website Builder
// Provides one-click template loading with user confirmation

let prebuiltModal = null;

// Initialize prebuilt templates functionality
document.addEventListener('DOMContentLoaded', () => {
    setupPrebuiltButton();
    createPrebuiltModal();
});

/**
 * Sets up the prebuilt templates button functionality
 * Connects to the existing button in the controls section
 */
function setupPrebuiltButton() {
    const prebuiltButton = document.getElementById('prebuiltTemplates');
    if (!prebuiltButton) {
        console.error('Prebuilt templates button not found in HTML');
        return;
    }
    
    // Style the button to match other controls
    prebuiltButton.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 8px 16px;
        margin: 4px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        letter-spacing: 0.5px;
    `;
    
    // Add hover effects
    prebuiltButton.addEventListener('mouseenter', () => {
        prebuiltButton.style.transform = 'translateY(-2px)';
        prebuiltButton.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
    });
    
    prebuiltButton.addEventListener('mouseleave', () => {
        prebuiltButton.style.transform = 'translateY(0)';
        prebuiltButton.style.boxShadow = 'none';
    });
    
    // Add click handler
    prebuiltButton.addEventListener('click', () => {
        showPrebuiltModal();
    });
    
    console.log('Prebuilt templates button functionality added');
}

/**
 * Creates the modal dialog for selecting prebuilt templates
 * Includes template preview and confirmation options
 */
function createPrebuiltModal() {
    prebuiltModal = document.createElement('div');
    prebuiltModal.id = 'prebuiltModal';
    prebuiltModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        z-index: 10001;
        align-items: center;
        justify-content: center;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        position: relative;
    `;
    
    modalContent.innerHTML = `
        <div style="padding: 30px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <h2 style="margin: 0; font-size: 24px; color: #333; font-weight: 600;">Prebuilt Templates</h2>
                <button id="closePrebuiltModal" style="background: none; border: none; font-size: 24px; color: #999; cursor: pointer; padding: 5px;">×</button>
            </div>
            
            <div id="templateOptions">
                <div class="template-option" data-template="light-airy-portfolio">
                    <div style="border: 2px solid #eee; border-radius: 8px; padding: 20px; margin-bottom: 20px; cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.borderColor='#667eea'" onmouseout="this.style.borderColor='#eee'">
                        <div style="display: flex; gap: 20px; align-items: center;">
                            <div style="flex: 1;">
                                <h3 style="margin: 0 0 10px 0; font-size: 20px; color: #333;">Light & Airy Portfolio</h3>
                                <p style="margin: 0 0 15px 0; color: #666; line-height: 1.5;">Professional photography website with clean, elegant design. Includes Home, Portfolio, About, Contact, and Pricing pages.</p>
                                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                    <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #666;">5 Pages</span>
                                    <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #666;">Photography Focus</span>
                                    <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #666;">Mobile Responsive</span>
                                </div>
                            </div>
                            <div style="width: 120px; height: 80px; background: linear-gradient(135deg, #f5f5f0 0%, #fafafa 100%); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px; text-align: center;">
                                Template Preview
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="background: #fff8dc; border: 1px solid #ffa500; border-radius: 6px; padding: 15px; margin: 20px 0;">
                <strong style="color: #cc8800;">Important:</strong> Loading a prebuilt template will replace your current website content. Make sure to export your current work if you want to save it.
            </div>
            
            <div style="display: flex; gap: 15px; justify-content: flex-end; margin-top: 25px;">
                <button id="cancelPrebuilt" style="padding: 12px 24px; border: 1px solid #ddd; background: white; color: #666; border-radius: 6px; cursor: pointer; font-size: 14px;">Cancel</button>
                <button id="loadSelectedTemplate" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;" disabled>Load Template</button>
            </div>
        </div>
    `;
    
    prebuiltModal.appendChild(modalContent);
    document.body.appendChild(prebuiltModal);
    
    // Setup modal event listeners
    setupModalEventListeners();
}

/**
 * Sets up all event listeners for the prebuilt modal
 * Handles template selection, confirmation, and modal closing
 */
function setupModalEventListeners() {
    if (!prebuiltModal) return;
    
    // Close modal handlers
    const closeBtn = prebuiltModal.querySelector('#closePrebuiltModal');
    const cancelBtn = prebuiltModal.querySelector('#cancelPrebuilt');
    
    closeBtn?.addEventListener('click', hidePrebuiltModal);
    cancelBtn?.addEventListener('click', hidePrebuiltModal);
    
    // Click outside to close
    prebuiltModal.addEventListener('click', (e) => {
        if (e.target === prebuiltModal) {
            hidePrebuiltModal();
        }
    });
    
    // Template selection
    const templateOptions = prebuiltModal.querySelectorAll('.template-option');
    const loadBtn = prebuiltModal.querySelector('#loadSelectedTemplate');
    let selectedTemplate = null;
    
    templateOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove previous selection
            templateOptions.forEach(opt => {
                opt.style.borderColor = '#eee';
                opt.style.background = 'white';
            });
            
            // Select current option
            option.style.borderColor = '#667eea';
            option.style.background = '#f8f9ff';
            
            selectedTemplate = option.dataset.template;
            loadBtn.disabled = false;
            loadBtn.style.opacity = '1';
        });
    });
    
    // Load template button
    loadBtn?.addEventListener('click', () => {
        if (selectedTemplate) {
            loadPrebuiltTemplate(selectedTemplate);
        }
    });
}

/**
 * Shows the prebuilt templates modal
 */
function showPrebuiltModal() {
    if (prebuiltModal) {
        prebuiltModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Hides the prebuilt templates modal
 */
function hidePrebuiltModal() {
    if (prebuiltModal) {
        prebuiltModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Reset selection
        const templateOptions = prebuiltModal.querySelectorAll('.template-option');
        templateOptions.forEach(opt => {
            opt.style.borderColor = '#eee';
            opt.style.background = 'white';
        });
        
        const loadBtn = prebuiltModal.querySelector('#loadSelectedTemplate');
        if (loadBtn) {
            loadBtn.disabled = true;
            loadBtn.style.opacity = '0.6';
        }
    }
}

/**
 * Loads a prebuilt template with user confirmation
 * Integrates with existing multi-page system
 * @param {string} templateId - The ID of the template to load
 */
function loadPrebuiltTemplate(templateId) {
    // Double confirmation for safety
    const userConfirmed = confirm(
        'Are you sure you want to load this prebuilt template?\n\n' +
        'This will replace ALL your current pages and content.\n\n' +
        'Consider exporting your current work first if you want to save it.'
    );
    
    if (!userConfirmed) {
        return;
    }
    
    try {
        let template = null;
        
        // Load the appropriate template
        switch (templateId) {
            case 'light-airy-portfolio':
                if (typeof window.lightAiryPortfolioTemplate !== 'undefined') {
                    template = window.lightAiryPortfolioTemplate;
                } else {
                    throw new Error('Light & Airy Portfolio template not loaded');
                }
                break;
            default:
                throw new Error('Unknown template: ' + templateId);
        }
        
        if (!template) {
            throw new Error('Template data not available');
        }
        
        // Load the template into the builder
        loadTemplateIntoBuilder(template);
        
        // Hide modal
        hidePrebuiltModal();
        
        // Show success message
        showSuccessMessage(`${template.name} template loaded successfully!`);
        
        console.log('Prebuilt template loaded:', template.name);
        
    } catch (error) {
        console.error('Failed to load prebuilt template:', error);
        alert('Failed to load template: ' + error.message);
    }
}

/**
 * Loads template data into the website builder
 * Integrates with existing multi-page system and block functionality
 * @param {Object} template - The template data to load
 */
function loadTemplateIntoBuilder(template) {
    try {
        // Clear existing content and reset multi-page system
        if (typeof window.pages !== 'undefined') {
            window.pages = {};
        }
        
        // Clear the page list UI
        const pageList = document.getElementById('pageList');
        if (pageList) {
            pageList.innerHTML = '';
        }
        
        // Clear the navigation list UI
        const navList = document.getElementById('navList');
        if (navList) {
            navList.innerHTML = '';
        }
        
        // Load each page from the template
        Object.entries(template.pages).forEach(([pageSlug, pageData], index) => {
            // Initialize pages object if not exists
            if (typeof window.pages === 'undefined') {
                window.pages = {};
            }
            
            // Add page to pages object
            window.pages[pageSlug] = {
                title: pageData.title,
                content: pageData.content
            };
            
            // Add page to UI
            if (pageList) {
                const pageItem = document.createElement('div');
                pageItem.className = `page-item${index === 0 ? ' active' : ''}`;
                pageItem.setAttribute('data-page-id', pageSlug);
                pageItem.innerHTML = `
                    <span class="page-name">${pageData.title}</span>
                    <div class="page-actions">
                        <button class="edit-page" title="Edit Page">Edit</button>
                        <button class="delete-page" title="Delete Page">×</button>
                    </div>
                `;
                pageList.appendChild(pageItem);
            }
            
            // Add navigation item
            if (navList) {
                const navItem = document.createElement('div');
                navItem.className = 'nav-item';
                navItem.setAttribute('data-page-id', pageSlug);
                navItem.setAttribute('draggable', 'true');
                navItem.innerHTML = `
                    <span class="nav-label">${pageData.title}</span>
                    <div class="nav-actions">
                        <button class="edit-nav" title="Edit Label">Edit</button>
                        <button class="move-up" title="Move Up">↑</button>
                        <button class="move-down" title="Move Down">↓</button>
                    </div>
                `;
                navList.appendChild(navItem);
            }
        });
        
        // Set the first page as active and load its content
        const firstPageSlug = Object.keys(template.pages)[0];
        if (firstPageSlug) {
            // Set global current page
            if (typeof window.currentPageId !== 'undefined') {
                window.currentPageId = firstPageSlug;
            }
            
            // Load first page content into blocks container
            const blocksContainer = document.getElementById('blocks');
            if (blocksContainer && template.pages[firstPageSlug]) {
                blocksContainer.innerHTML = template.pages[firstPageSlug].content;
            }
        }
        
        // Reinitialize multi-page system event listeners
        if (typeof initializeMultiPageSystem === 'function') {
            initializeMultiPageSystem();
        } else {
            // Fallback: manually set up page click handlers
            setupPageClickHandlers();
        }
        
        // Initialize image placeholder editing for new template
        if (typeof window.imagePlaceholderAPI !== 'undefined') {
            window.imagePlaceholderAPI.updateImagePlaceholderHandlers();
        }
        
        // Initialize draggable toolbars for new template
        if (typeof window.draggableToolbarsAPI !== 'undefined') {
            setTimeout(() => {
                window.draggableToolbarsAPI.initializeDraggableToolbars();
            }, 200);
        }
        
        // Reinitialize all block functionality
        reinitializeAllBlocks();
        
        // Save state for undo/redo
        if (typeof saveUndoState === 'function') {
            setTimeout(() => saveUndoState(), 500);
        }
        
        console.log('Template loaded into builder successfully');
        
    } catch (error) {
        console.error('Error loading template into builder:', error);
        throw error;
    }
}

/**
 * Reinitializes all block functionality after template load
 * Ensures drag-and-drop, image placeholders, and toolbars work properly
 */
function reinitializeAllBlocks() {
    try {
        // Reinitialize blocks system
        if (typeof reinitializeBlocks === 'function') {
            reinitializeBlocks();
        }
        
        // Setup image placeholders for all blocks
        const allBlocks = document.querySelectorAll('.block');
        allBlocks.forEach(block => {
            // Setup drag and drop
            if (!block.draggable) {
                block.draggable = true;
                if (typeof setupBlockDragEvents === 'function') {
                    setupBlockDragEvents(block);
                }
            }
            
            // Setup image placeholders
            if (typeof setupImagePlaceholders === 'function') {
                setupImagePlaceholders(block);
            }
        });
        
        console.log('All blocks reinitialized after template load');
        
    } catch (error) {
        console.error('Error reinitializing blocks:', error);
    }
}

/**
 * Shows a success message to the user
 * @param {string} message - The success message to display
 */
function showSuccessMessage(message) {
    // Create temporary success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
        z-index: 10002;
        font-size: 14px;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    
    notification.textContent = message;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

/**
 * Sets up page click handlers for template-loaded pages
 * Fallback function when multi-page system needs reinitialization
 */
function setupPageClickHandlers() {
    const pageItems = document.querySelectorAll('.page-item');
    pageItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.page-actions')) return;
            
            const pageId = item.getAttribute('data-page-id');
            if (pageId && window.pages && window.pages[pageId]) {
                // Remove active class from all pages
                document.querySelectorAll('.page-item').forEach(p => p.classList.remove('active'));
                
                // Add active class to clicked page
                item.classList.add('active');
                
                // Load page content
                const blocksContainer = document.getElementById('blocks');
                if (blocksContainer) {
                    blocksContainer.innerHTML = window.pages[pageId].content;
                    window.currentPageId = pageId;
                    
                    // Reinitialize blocks after content change
                    reinitializeAllBlocks();
                }
            }
        });
    });
    
    console.log('Page click handlers set up for template pages');
}

// Make functions available globally for debugging and integration
window.prebuiltTemplatesAPI = {
    showModal: showPrebuiltModal,
    hideModal: hidePrebuiltModal,
    loadTemplate: loadPrebuiltTemplate,
    reinitializeBlocks: reinitializeAllBlocks,
    setupPageHandlers: setupPageClickHandlers
};