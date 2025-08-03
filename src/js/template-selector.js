// Template Selector System
// Modal interface for choosing between multiple prebuilt website templates

/**
 * Initialize template selector functionality
 * Sets up the Prebuilt button and modal system for template selection
 */
function initializeTemplateSelector() {
    // Create and add the Prebuilt button to the builder interface
    addPrebuiltButton();
    
    // Create the template selection modal
    createTemplateSelectorModal();
    
    console.log('Template selector system initialized');
}

/**
 * Add the Prebuilt button to the website builder interface
 * Button appears next to existing controls for easy access
 */
function addPrebuiltButton() {
    // Check if the existing prebuilt button exists and update it instead
    const existingButton = document.getElementById('prebuiltTemplates');
    
    if (existingButton) {
        // Update existing button to open template selector
        existingButton.innerHTML = 'Prebuilt Templates';
        existingButton.style.cssText = `
            padding: 12px 24px;
            background: linear-gradient(135deg, #6c5ce7, #a29bfe);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin: 0 5px;
            box-shadow: 0 4px 15px rgba(108, 92, 231, 0.3);
        `;
        
        // Remove any existing click handlers
        existingButton.removeEventListener('click', existingButton.clickHandler);
        
        // Add new click handler
        existingButton.clickHandler = openTemplateSelectorModal;
        existingButton.addEventListener('click', existingButton.clickHandler);
        
        // Add hover effects
        existingButton.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 6px 20px rgba(108, 92, 231, 0.4)';
        });
        
        existingButton.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 15px rgba(108, 92, 231, 0.3)';
        });
        
        console.log('Existing prebuilt button updated with template selector');
        return;
    }
    
    // Find the controls container where we'll add the button
    const controlsContainer = document.querySelector('.builder-controls');
    
    if (controlsContainer) {
        // Create the Prebuilt button
        const prebuiltButton = document.createElement('button');
        prebuiltButton.id = 'prebuiltTemplatesButton';
        prebuiltButton.innerHTML = 'Prebuilt Templates';
        prebuiltButton.style.cssText = `
            padding: 12px 24px;
            background: linear-gradient(135deg, #6c5ce7, #a29bfe);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-left: 10px;
            box-shadow: 0 4px 15px rgba(108, 92, 231, 0.3);
        `;
        
        // Add hover effect
        prebuiltButton.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 6px 20px rgba(108, 92, 231, 0.4)';
        });
        
        prebuiltButton.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 15px rgba(108, 92, 231, 0.3)';
        });
        
        // Add click handler to open template selector
        prebuiltButton.addEventListener('click', openTemplateSelectorModal);
        
        // Insert the button into the controls container
        controlsContainer.appendChild(prebuiltButton);
        
        console.log('Prebuilt templates button added to interface');
    } else {
        console.warn('Controls container not found - adding fallback button');
        addFallbackPrebuiltButton();
    }
}

/**
 * Add fallback button if main controls container not found
 * Creates a floating button as alternative placement
 */
function addFallbackPrebuiltButton() {
    const fallbackButton = document.createElement('button');
    fallbackButton.id = 'prebuiltTemplatesButtonFallback';
    fallbackButton.innerHTML = 'Prebuilt Templates';
    fallbackButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        padding: 12px 24px;
        background: linear-gradient(135deg, #6c5ce7, #a29bfe);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(108, 92, 231, 0.3);
    `;
    
    fallbackButton.addEventListener('click', openTemplateSelectorModal);
    document.body.appendChild(fallbackButton);
}

/**
 * Create the template selection modal interface
 * Modal displays all available templates with previews and descriptions
 */
function createTemplateSelectorModal() {
    // Create modal backdrop
    const modalBackdrop = document.createElement('div');
    modalBackdrop.id = 'templateSelectorBackdrop';
    modalBackdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: none;
        backdrop-filter: blur(5px);
    `;
    
    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'templateSelectorModal';
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 20px;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
        max-width: 900px;
        max-height: 80vh;
        width: 90%;
        overflow: hidden;
        z-index: 10001;
    `;
    
    // Modal header
    const modalHeader = document.createElement('div');
    modalHeader.style.cssText = `
        padding: 30px 40px 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #f8f9fa, #ffffff);
    `;
    
    const modalTitle = document.createElement('h2');
    modalTitle.textContent = 'Choose a Template';
    modalTitle.style.cssText = `
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        color: #2d3436;
        font-family: 'Inter', sans-serif;
    `;
    
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
        background: none;
        border: none;
        font-size: 32px;
        cursor: pointer;
        color: #636e72;
        padding: 0;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.3s ease;
    `;
    
    closeButton.addEventListener('click', closeTemplateSelectorModal);
    closeButton.addEventListener('mouseenter', function() {
        this.style.background = '#f8f9fa';
        this.style.color = '#2d3436';
    });
    closeButton.addEventListener('mouseleave', function() {
        this.style.background = 'none';
        this.style.color = '#636e72';
    });
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    // Modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        padding: 30px 40px 40px;
        max-height: 60vh;
        overflow-y: auto;
    `;
    
    // Templates grid
    const templatesGrid = document.createElement('div');
    templatesGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 25px;
    `;
    
    // Define available templates
    const templates = [
        {
            name: 'Bold Modern Studio',
            description: 'Bold modern design with deep blues and gold accents',
            variable: 'boldModernStudioTemplate',
            color: '#192a56',
            accent: '#f39c12'
        },
        {
            name: 'Elegant Wedding',
            description: 'Romantic wedding photography with pastel colors',
            variable: 'elegantWeddingTemplate', 
            color: '#5d4e75',
            accent: '#d4af37'
        },
        {
            name: 'Edgy Urban Lookbook',
            description: 'Dark theme photography with neon accents',
            variable: 'edgyUrbanLookbookTemplate',
            color: '#0f0f0f',
            accent: '#00ff41'
        }
    ];
    
    // Create template cards
    templates.forEach(template => {
        const templateCard = createTemplateCard(template);
        templatesGrid.appendChild(templateCard);
    });
    
    modalContent.appendChild(templatesGrid);
    
    // Assemble modal
    modal.appendChild(modalHeader);
    modal.appendChild(modalContent);
    modalBackdrop.appendChild(modal);
    
    // Add to page
    document.body.appendChild(modalBackdrop);
    
    // Close modal when clicking backdrop
    modalBackdrop.addEventListener('click', function(e) {
        if (e.target === modalBackdrop) {
            closeTemplateSelectorModal();
        }
    });
}

/**
 * Create individual template card for selection
 * @param {Object} template - Template configuration object
 * @returns {HTMLElement} Template card element
 */
function createTemplateCard(template) {
    const card = document.createElement('div');
    card.style.cssText = `
        border: 2px solid #e9ecef;
        border-radius: 15px;
        padding: 25px;
        cursor: pointer;
        transition: all 0.3s ease;
        background: white;
        position: relative;
        overflow: hidden;
    `;
    
    // Add gradient background based on template colors
    const gradientOverlay = document.createElement('div');
    gradientOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, ${template.color}, ${template.accent});
    `;
    card.appendChild(gradientOverlay);
    
    // Template name
    const name = document.createElement('h3');
    name.textContent = template.name;
    name.style.cssText = `
        margin: 0 0 15px 0;
        font-size: 20px;
        font-weight: 700;
        color: ${template.color};
        font-family: 'Inter', sans-serif;
    `;
    
    // Template description
    const description = document.createElement('p');
    description.textContent = template.description;
    description.style.cssText = `
        margin: 0 0 20px 0;
        font-size: 14px;
        color: #636e72;
        line-height: 1.5;
    `;
    
    // Color preview
    const colorPreview = document.createElement('div');
    colorPreview.style.cssText = `
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
    `;
    
    const primaryColor = document.createElement('div');
    primaryColor.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: ${template.color};
        border: 2px solid #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    
    const accentColor = document.createElement('div');
    accentColor.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: ${template.accent};
        border: 2px solid #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    
    colorPreview.appendChild(primaryColor);
    colorPreview.appendChild(accentColor);
    
    // Select button
    const selectButton = document.createElement('button');
    selectButton.textContent = 'Use This Template';
    selectButton.style.cssText = `
        width: 100%;
        padding: 12px 20px;
        background: linear-gradient(135deg, ${template.color}, ${template.accent});
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
    `;
    
    // Add hover effects
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
        this.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.1)';
        this.style.borderColor = template.accent;
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'none';
        this.style.borderColor = '#e9ecef';
    });
    
    selectButton.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.05)';
    });
    
    selectButton.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
    });
    
    // Add click handler for template selection
    selectButton.addEventListener('click', function(e) {
        e.stopPropagation();
        selectTemplate(template);
    });
    
    card.addEventListener('click', function() {
        selectTemplate(template);
    });
    
    // Assemble card
    card.appendChild(name);
    card.appendChild(description);
    card.appendChild(colorPreview);
    card.appendChild(selectButton);
    
    return card;
}

/**
 * Handle template selection with user confirmation
 * @param {Object} template - Selected template configuration
 */
function selectTemplate(template) {
    // Show confirmation dialog before replacing current content
    const confirmation = confirm(
        `Are you sure you want to load the "${template.name}" template?\n\n` +
        'This will replace your current website content. Make sure to save any work you want to keep.'
    );
    
    if (confirmation) {
        // Close the template selector modal
        closeTemplateSelectorModal();
        
        // Load the selected template
        loadSelectedTemplate(template);
    }
}

/**
 * Load the selected template into the website builder
 * @param {Object} template - Template configuration to load
 */
function loadSelectedTemplate(template) {
    try {
        // Get the template data based on the variable name
        let templateData;
        
        switch (template.variable) {
            case 'boldModernStudioTemplate':
                templateData = (typeof boldModernStudioTemplate !== 'undefined') ? boldModernStudioTemplate : window.boldModernStudioTemplate;
                break;
            case 'elegantWeddingTemplate':
                templateData = (typeof elegantWeddingTemplate !== 'undefined') ? elegantWeddingTemplate : window.elegantWeddingTemplate;
                break;
            case 'edgyUrbanLookbookTemplate':
                templateData = (typeof edgyUrbanLookbookTemplate !== 'undefined') ? edgyUrbanLookbookTemplate : window.edgyUrbanLookbookTemplate;
                break;
            default:
                throw new Error(`Template "${template.variable}" not found`);
        }
        
        if (!templateData) {
            throw new Error(`Template data for "${template.name}" is not available`);
        }
        
        // Use the existing prebuilt template loading function if available
        if (typeof loadPrebuiltTemplate === 'function') {
            loadPrebuiltTemplate(templateData);
            console.log(`Successfully loaded template: ${template.name}`);
        } else if (typeof window.prebuiltTemplatesAPI !== 'undefined' && window.prebuiltTemplatesAPI.loadTemplate) {
            window.prebuiltTemplatesAPI.loadTemplate(templateData);
            console.log(`Successfully loaded template: ${template.name}`);
        } else {
            // Fallback: load template directly
            loadTemplateDirect(templateData);
            console.log(`Template loaded via fallback method: ${template.name}`);
        }
        
    } catch (error) {
        console.error('Error loading template:', error);
        alert(`Error loading template: ${error.message}\n\nPlease try again or contact support.`);
    }
}

/**
 * Direct template loading fallback method
 * @param {Object} templateData - Template data to load
 */
function loadTemplateDirect(templateData) {
    try {
        // Use the same approach as the existing prebuilt template system
        const canvas = document.getElementById('canvas');
        if (!canvas) {
            throw new Error('Canvas container not found');
        }
        
        // Clear existing content
        canvas.innerHTML = '';
        
        // Load first page content
        const firstPageSlug = Object.keys(templateData.pages)[0];
        const firstPage = templateData.pages[firstPageSlug];
        
        if (firstPage && firstPage.content) {
            canvas.innerHTML = firstPage.content;
        }
        
        // Update page navigation if multi-page system exists
        if (typeof updatePageNavigation === 'function') {
            // Clear existing pages and add template pages
            const pageData = {};
            Object.entries(templateData.pages).forEach(([slug, page]) => {
                pageData[slug] = {
                    title: page.title,
                    content: page.content
                };
            });
            
            // Update the global pages object
            if (typeof window.pages !== 'undefined') {
                window.pages = pageData;
                updatePageNavigation();
                
                // Switch to first page
                if (typeof switchToPage === 'function') {
                    switchToPage(firstPageSlug);
                }
            }
        }
        
        // Reinitialize all systems
        setTimeout(() => {
            // Reinitialize all blocks
            if (typeof reinitializeAllBlocks === 'function') {
                reinitializeAllBlocks();
            }
            
            // Reinitialize image placeholder system
            if (typeof updateImagePlaceholderHandlers === 'function') {
                updateImagePlaceholderHandlers();
            }
            
            // Reinitialize draggable toolbars
            if (typeof initializeDraggableToolbars === 'function') {
                initializeDraggableToolbars();
            }
            
            console.log('Template loaded and systems reinitialized');
        }, 100);
        
    } catch (error) {
        console.error('Error in direct template loading:', error);
        throw error;
    }
}

/**
 * Open the template selector modal
 */
function openTemplateSelectorModal() {
    const backdrop = document.getElementById('templateSelectorBackdrop');
    if (backdrop) {
        backdrop.style.display = 'block';
        // Add animation
        setTimeout(() => {
            backdrop.style.opacity = '1';
        }, 10);
    }
}

/**
 * Close the template selector modal
 */
function closeTemplateSelectorModal() {
    const backdrop = document.getElementById('templateSelectorBackdrop');
    if (backdrop) {
        backdrop.style.opacity = '0';
        setTimeout(() => {
            backdrop.style.display = 'none';
        }, 300);
    }
}

// Export API for external access
window.templateSelectorAPI = {
    init: initializeTemplateSelector,
    openModal: openTemplateSelectorModal,
    closeModal: closeTemplateSelectorModal
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTemplateSelector);
} else {
    initializeTemplateSelector();
}