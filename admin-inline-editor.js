// Universal Admin Inline Editing System with Photo Blocks
// This file handles all inline editing across the platform

(function() {
    'use strict';
    
    // Configuration
    const ADMIN_EMAIL = 'lancecasselman@icloud.com';
    const AUTO_SAVE_DELAY = 500; // milliseconds
    
    // State management
    let isAdmin = false;
    let saveTimer = null;
    let currentPage = window.location.pathname.replace('/', '') || 'index';
    let currentUserEmail = null;
    
    // Initialize the editor system
    async function initializeAdminEditor() {
        try {
            // Check if user is admin
            const authResponse = await fetch('/api/auth/check', {
                credentials: 'include'
            });
            
            if (!authResponse.ok) return;
            
            const authData = await authResponse.json();
            
            if (authData.email === ADMIN_EMAIL) {
                isAdmin = true;
                console.log('Admin editor activated');
                
                // Load saved edits first
                await loadSavedEdits();
                
                // Enable editing features
                enableInlineEditing();
                addAdminToolbar();
                enablePhotoBlocks();
                
                // Show admin indicator
                showAdminBadge();
                
                // Apply editing to existing content
                applyEditingToExistingContent();
            }
        } catch (error) {
            console.log('Admin editor not available:', error);
        }
    }
    
    // Load saved content edits
    async function loadSavedEdits() {
        try {
            const response = await fetch(`/api/admin/content/${currentPage}`);
            if (!response.ok) return;
            
            const data = await response.json();
            if (data.edits && data.edits.length > 0) {
                data.edits.forEach(edit => {
                    try {
                        const elements = document.querySelectorAll(edit.selector);
                        elements.forEach(element => {
                            if (element) {
                                if (edit.type === 'photoBlock') {
                                    // Recreate photo block
                                    createPhotoBlockFromData(edit.content, element.parentNode, element);
                                    element.remove();
                                } else {
                                    element.innerHTML = edit.content;
                                    element.dataset.originalContent = edit.content;
                                }
                            }
                        });
                    } catch (e) {
                        console.log('Could not apply edit:', e);
                    }
                });
                console.log(`Applied ${data.edits.length} saved edits`);
            }
        } catch (error) {
            console.log('Could not load saved edits:', error);
        }
    }
    
    // Enable inline editing for all text elements
    function enableInlineEditing() {
        // Select all editable text elements
        const editableSelectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'span', 'div.text-content',
            '.editable', '.title', '.subtitle', '.description',
            'td', 'th', 'li', 'label',
            '.dashboard-title', '.tab-title', '.session-title',
            '.client-name', '.location', '.notes'
        ];
        
        // Make elements editable
        editableSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                // Skip if already editable or contains form elements
                if (element.classList.contains('admin-editable') || 
                    element.querySelector('input, select, textarea, button')) {
                    return;
                }
                
                makeElementEditable(element);
            });
        });
    }
    
    // Make an element editable
    function makeElementEditable(element) {
        element.classList.add('admin-editable');
        element.dataset.originalContent = element.innerHTML;
        
        // Add hover effect
        element.addEventListener('mouseenter', handleMouseEnter);
        element.addEventListener('mouseleave', handleMouseLeave);
        
        // Add click to edit
        element.addEventListener('click', handleEditClick);
    }
    
    function handleMouseEnter(e) {
        if (!e.target.isContentEditable) {
            e.target.style.outline = '2px dashed #d4af37';
            e.target.style.outlineOffset = '4px';
            e.target.style.cursor = 'text';
        }
    }
    
    function handleMouseLeave(e) {
        if (!e.target.isContentEditable) {
            e.target.style.outline = 'none';
        }
    }
    
    function handleEditClick(e) {
        if (!e.target.isContentEditable && isAdmin) {
            e.preventDefault();
            e.stopPropagation();
            startEditing(e.target);
        }
    }
    
    // Start editing an element
    function startEditing(element) {
        element.contentEditable = true;
        element.focus();
        element.style.outline = '2px solid #667eea';
        element.style.background = 'rgba(102, 126, 234, 0.1)';
        
        // Select all content
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Add event listeners
        element.addEventListener('blur', handleEditBlur);
        element.addEventListener('keydown', handleEditKeydown);
        element.addEventListener('input', handleEditInput);
    }
    
    function handleEditBlur(e) {
        stopEditing(e.target);
    }
    
    function handleEditKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.target.blur();
        }
        if (e.key === 'Escape') {
            e.target.innerHTML = e.target.dataset.originalContent;
            e.target.blur();
        }
    }
    
    function handleEditInput(e) {
        // Auto-save with debounce
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveContent(e.target);
        }, AUTO_SAVE_DELAY);
    }
    
    // Stop editing an element
    function stopEditing(element) {
        element.contentEditable = false;
        element.style.outline = 'none';
        element.style.background = 'transparent';
        
        // Save if content changed
        if (element.innerHTML !== element.dataset.originalContent) {
            saveContent(element);
        }
        
        // Remove temporary event listeners
        element.removeEventListener('blur', handleEditBlur);
        element.removeEventListener('keydown', handleEditKeydown);
        element.removeEventListener('input', handleEditInput);
    }
    
    // Save content to database
    async function saveContent(element, type = 'text') {
        const selector = getElementSelector(element);
        const content = element.innerHTML;
        
        try {
            const response = await fetch('/api/admin/content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    page: currentPage,
                    selector: selector,
                    content: content,
                    type: type
                })
            });
            
            if (response.ok) {
                element.dataset.originalContent = content;
                showSaveIndicator(element, 'saved');
            } else {
                element.innerHTML = element.dataset.originalContent;
                showSaveIndicator(element, 'error');
            }
        } catch (error) {
            console.error('Save failed:', error);
            element.innerHTML = element.dataset.originalContent;
            showSaveIndicator(element, 'error');
        }
    }
    
    // Generate unique selector for element
    function getElementSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }
        
        const path = [];
        let current = element;
        
        while (current && current.tagName) {
            let selector = current.tagName.toLowerCase();
            
            if (current.className) {
                const classes = current.className.split(' ')
                    .filter(c => c && !c.includes('admin') && !c.includes('edit'))
                    .slice(0, 2);
                if (classes.length) {
                    selector += '.' + classes.join('.');
                }
            }
            
            const siblings = Array.from(current.parentNode?.children || []);
            const index = siblings.indexOf(current);
            
            if (index > 0 || siblings.length > 1) {
                selector += `:nth-child(${index + 1})`;
            }
            
            path.unshift(selector);
            current = current.parentNode;
            
            if (path.length >= 3) break;
        }
        
        return path.join(' > ');
    }
    
    // Show save indicator
    function showSaveIndicator(element, status) {
        const indicator = document.createElement('div');
        indicator.className = 'save-indicator';
        indicator.style.cssText = `
            position: fixed;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            z-index: 100000;
            pointer-events: none;
            animation: fadeInOut 2s ease;
        `;
        
        if (status === 'saved') {
            indicator.style.background = '#10b981';
            indicator.style.color = 'white';
            indicator.textContent = '✓ Saved';
        } else {
            indicator.style.background = '#ef4444';
            indicator.style.color = 'white';
            indicator.textContent = '✗ Error';
        }
        
        const rect = element.getBoundingClientRect();
        indicator.style.left = rect.left + 'px';
        indicator.style.top = (rect.top - 40) + 'px';
        
        document.body.appendChild(indicator);
        
        setTimeout(() => {
            indicator.remove();
        }, 2000);
    }
    
    // Add admin toolbar
    function addAdminToolbar() {
        // Only show toolbar on secure landing page
        const isSecureLandingPage = window.location.pathname === '/secure-landing.html' || 
                                    window.location.pathname === '/secure-landing';
        
        if (!isSecureLandingPage) {
            console.log('Admin toolbar hidden - not on secure landing page');
            return;
        }
        
        const toolbar = document.createElement('div');
        toolbar.id = 'admin-toolbar';
        toolbar.innerHTML = `
            <div style="
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 120px;
                background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(15px);
                border-top: 1px solid #e2e8f0;
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
                box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
            ">
                <!-- Tabs Header -->
                <div style="
                    height: 40px;
                    display: flex;
                    align-items: center;
                    padding: 0 20px;
                    border-bottom: 1px solid #f1f5f9;
                    background: rgba(248, 250, 252, 0.8);
                ">
                    <button class="tool-tab active" data-tab="elements" style="
                        padding: 0 20px;
                        height: 100%;
                        background: white;
                        border: none;
                        border-bottom: 2px solid #667eea;
                        color: #667eea;
                        font-size: 13px;
                        font-weight: 500;
                        cursor: pointer;
                    ">Elements</button>
                    <button class="tool-tab" data-tab="text" style="
                        padding: 0 20px;
                        height: 100%;
                        background: none;
                        border: none;
                        border-bottom: 2px solid transparent;
                        color: #64748b;
                        font-size: 13px;
                        font-weight: 500;
                        cursor: pointer;
                    ">Text Styles</button>
                    <button class="tool-tab" data-tab="layout" style="
                        padding: 0 20px;
                        height: 100%;
                        background: none;
                        border: none;
                        border-bottom: 2px solid transparent;
                        color: #64748b;
                        font-size: 13px;
                        font-weight: 500;
                        cursor: pointer;
                    ">Layout</button>
                    <button class="tool-tab" data-tab="design" style="
                        padding: 0 20px;
                        height: 100%;
                        background: none;
                        border: none;
                        border-bottom: 2px solid transparent;
                        color: #64748b;
                        font-size: 13px;
                        font-weight: 500;
                        cursor: pointer;
                    ">Design</button>
                    
                    <div style="margin-left: auto; display: flex; gap: 10px;">
                        <button id="preview-mode" style="
                            padding: 6px 12px;
                            background: #f1f5f9;
                            border: none;
                            border-radius: 6px;
                            color: #475569;
                            font-size: 12px;
                            font-weight: 500;
                            cursor: pointer;
                        ">Preview</button>
                        <button id="save-all" style="
                            padding: 6px 16px;
                            background: #667eea;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 12px;
                            font-weight: 500;
                            cursor: pointer;
                        ">Save Changes</button>
                    </div>
                </div>
                
                <!-- Tools Content -->
                <div style="
                    flex: 1;
                    overflow-x: auto;
                    overflow-y: hidden;
                    padding: 15px 0;
                ">
                    <!-- Elements Tab -->
                    <div class="tab-panel active" data-panel="elements" style="
                        display: flex;
                        gap: 20px;
                        padding: 0 20px;
                    ">
                        <div class="tool-section">
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase;">BASIC</div>
                            <div style="display: flex; gap: 8px;">
                                <button class="component-btn" id="add-heading" style="
                                    padding: 8px 12px;
                                    background: white;
                                    border: 1px solid #e2e8f0;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                ">
                                    <span style="font-weight: 700;">H</span> Heading
                                </button>
                                <button class="component-btn" id="add-text-block" style="
                                    padding: 8px 12px;
                                    background: white;
                                    border: 1px solid #e2e8f0;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                ">
                                    <span>T</span> Text
                                </button>
                                <button class="component-btn" id="add-button" style="
                                    padding: 8px 12px;
                                    background: white;
                                    border: 1px solid #e2e8f0;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                ">Button</button>
                            </div>
                        </div>
                        
                        <div class="tool-section">
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase;">MEDIA</div>
                            <div style="display: flex; gap: 8px;">
                                <button class="component-btn" id="add-photo-block" style="
                                    padding: 8px 12px;
                                    background: white;
                                    border: 1px solid #e2e8f0;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                ">📷 Image</button>
                                <button class="component-btn" id="add-gallery" style="
                                    padding: 8px 12px;
                                    background: white;
                                    border: 1px solid #e2e8f0;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                ">🖼️ Gallery</button>
                                <button class="component-btn" id="add-video" style="
                                    padding: 8px 12px;
                                    background: white;
                                    border: 1px solid #e2e8f0;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                ">🎬 Video</button>
                            </div>
                        </div>
                        
                        <div class="tool-section">
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase;">SECTIONS</div>
                            <div style="display: flex; gap: 8px;">
                                <button class="component-btn" id="add-hero" style="
                                    padding: 8px 12px;
                                    background: white;
                                    border: 1px solid #e2e8f0;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                ">Hero</button>
                                <button class="component-btn" id="add-features" style="
                                    padding: 8px 12px;
                                    background: white;
                                    border: 1px solid #e2e8f0;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                ">Features</button>
                                <button class="component-btn" id="add-contact" style="
                                    padding: 8px 12px;
                                    background: white;
                                    border: 1px solid #e2e8f0;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                ">Contact</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Text Styles Tab -->
                    <div class="tab-panel" data-panel="text" style="
                        display: none;
                        gap: 20px;
                        padding: 0 20px;
                    ">
                        <div class="tool-section">
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px;">FONT FAMILY</div>
                            <select id="font-family" style="
                                padding: 6px 10px;
                                border: 1px solid #e2e8f0;
                                border-radius: 6px;
                                font-size: 12px;
                                background: white;
                            ">
                                <option value="Inter">Inter</option>
                                <option value="Playfair Display">Playfair Display</option>
                                <option value="Montserrat">Montserrat</option>
                                <option value="Raleway">Raleway</option>
                                <option value="Lato">Lato</option>
                            </select>
                        </div>
                        
                        <div class="tool-section">
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px;">SIZE</div>
                            <div style="display: flex; gap: 4px;">
                                <button class="size-btn" data-size="sm" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Small</button>
                                <button class="size-btn" data-size="md" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Medium</button>
                                <button class="size-btn" data-size="lg" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Large</button>
                                <button class="size-btn" data-size="xl" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">XL</button>
                            </div>
                        </div>
                        
                        <div class="tool-section">
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px;">ALIGNMENT</div>
                            <div style="display: flex; gap: 4px;">
                                <button class="align-btn" data-align="left" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Left</button>
                                <button class="align-btn" data-align="center" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Center</button>
                                <button class="align-btn" data-align="right" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Right</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Layout Tab -->
                    <div class="tab-panel" data-panel="layout" style="
                        display: none;
                        gap: 20px;
                        padding: 0 20px;
                    ">
                        <div class="tool-section">
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px;">SPACING</div>
                            <div style="display: flex; gap: 8px;">
                                <button class="spacing-btn" data-spacing="compact" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Compact</button>
                                <button class="spacing-btn" data-spacing="normal" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Normal</button>
                                <button class="spacing-btn" data-spacing="relaxed" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Relaxed</button>
                            </div>
                        </div>
                        
                        <div class="tool-section">
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px;">COLUMNS</div>
                            <div style="display: flex; gap: 4px;">
                                <button class="column-btn" data-cols="1" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">1</button>
                                <button class="column-btn" data-cols="2" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">2</button>
                                <button class="column-btn" data-cols="3" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">3</button>
                                <button class="column-btn" data-cols="4" style="padding: 6px 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">4</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Design Tab -->
                    <div class="tab-panel" data-panel="design" style="
                        display: none;
                        gap: 20px;
                        padding: 0 20px;
                    ">
                        <div class="tool-section">
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px;">THEME</div>
                            <div style="display: flex; gap: 8px;">
                                <button class="theme-btn" data-theme="minimal" style="padding: 6px 12px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Minimal</button>
                                <button class="theme-btn" data-theme="elegant" style="padding: 6px 12px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Elegant</button>
                                <button class="theme-btn" data-theme="bold" style="padding: 6px 12px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Bold</button>
                                <button class="theme-btn" data-theme="dark" style="padding: 6px 12px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; cursor: pointer;">Dark</button>
                            </div>
                        </div>
                        
                        <div class="tool-section">
                            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px;">COLORS</div>
                            <div style="display: flex; gap: 6px;">
                                <button class="color-btn" data-color="#000000" style="width: 28px; height: 28px; background: #000000; border: 2px solid #e2e8f0; border-radius: 4px; cursor: pointer;"></button>
                                <button class="color-btn" data-color="#667eea" style="width: 28px; height: 28px; background: #667eea; border: 2px solid #e2e8f0; border-radius: 4px; cursor: pointer;"></button>
                                <button class="color-btn" data-color="#ef4444" style="width: 28px; height: 28px; background: #ef4444; border: 2px solid #e2e8f0; border-radius: 4px; cursor: pointer;"></button>
                                <button class="color-btn" data-color="#10b981" style="width: 28px; height: 28px; background: #10b981; border: 2px solid #e2e8f0; border-radius: 4px; cursor: pointer;"></button>
                                <button class="color-btn" data-color="#f59e0b" style="width: 28px; height: 28px; background: #f59e0b; border: 2px solid #e2e8f0; border-radius: 4px; cursor: pointer;"></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(toolbar);
        
        // Add tab switching functionality
        const tabs = toolbar.querySelectorAll('.tool-tab');
        const panels = toolbar.querySelectorAll('.tab-panel');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetPanel = tab.dataset.tab;
                
                // Update active tab
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.background = 'none';
                    t.style.borderBottomColor = 'transparent';
                    t.style.color = '#64748b';
                });
                tab.classList.add('active');
                tab.style.background = 'white';
                tab.style.borderBottomColor = '#667eea';
                tab.style.color = '#667eea';
                
                // Show corresponding panel
                panels.forEach(panel => {
                    if (panel.dataset.panel === targetPanel) {
                        panel.style.display = 'flex';
                    } else {
                        panel.style.display = 'none';
                    }
                });
            });
        });
        
        // Add component handlers
        document.getElementById('add-photo-block')?.addEventListener('click', insertPhotoBlock);
        document.getElementById('add-text-block')?.addEventListener('click', insertTextBlock);
        document.getElementById('add-heading')?.addEventListener('click', () => insertHeading());
        document.getElementById('add-button')?.addEventListener('click', () => insertButton());
        document.getElementById('add-gallery')?.addEventListener('click', () => insertGallery());
        document.getElementById('add-video')?.addEventListener('click', () => insertVideo());
        document.getElementById('add-hero')?.addEventListener('click', () => insertHeroSection());
        document.getElementById('add-features')?.addEventListener('click', () => insertFeaturesSection());
        document.getElementById('add-contact')?.addEventListener('click', () => insertContactSection());
        document.getElementById('save-all')?.addEventListener('click', saveAllChanges);
        document.getElementById('preview-mode')?.addEventListener('click', togglePreviewMode);
        
        // Add text style handlers
        document.getElementById('font-family')?.addEventListener('change', (e) => applyFontFamily(e.target.value));
        toolbar.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => applyTextSize(btn.dataset.size));
        });
        toolbar.querySelectorAll('.align-btn').forEach(btn => {
            btn.addEventListener('click', () => applyAlignment(btn.dataset.align));
        });
        
        // Add layout handlers
        toolbar.querySelectorAll('.spacing-btn').forEach(btn => {
            btn.addEventListener('click', () => applySpacing(btn.dataset.spacing));
        });
        toolbar.querySelectorAll('.column-btn').forEach(btn => {
            btn.addEventListener('click', () => applyColumns(btn.dataset.cols));
        });
        
        // Add design handlers
        toolbar.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
        });
        toolbar.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => applyColor(btn.dataset.color));
        });
    }
    
    // Enable photo block functionality
    function enablePhotoBlocks() {
        // Add styles for photo blocks
        const style = document.createElement('style');
        style.textContent = `
            #admin-toolbar button:hover {
                background: #3a3a3a !important;
            }
            
            #admin-toolbar #save-all:hover {
                background: #2563eb !important;
            }
            
            .photo-block {
                position: relative;
                margin: 20px 0;
                border: 2px dashed #d4af37;
                border-radius: 10px;
                padding: 20px;
                background: rgba(212, 175, 55, 0.1);
                min-height: 200px;
            }
            
            .photo-block.has-image {
                border-style: solid;
                background: transparent;
            }
            
            .photo-block img {
                max-width: 100%;
                height: auto;
                border-radius: 8px;
                display: block;
                margin: 0 auto;
            }
            
            .photo-caption {
                text-align: center;
                margin-top: 10px;
                font-style: italic;
                color: #888;
                min-height: 20px;
                padding: 5px;
            }
            
            .photo-upload-area {
                text-align: center;
                padding: 40px;
                cursor: pointer;
            }
            
            .photo-upload-area:hover {
                background: rgba(212, 175, 55, 0.2);
            }
            
            .photo-controls {
                position: absolute;
                top: 10px;
                right: 10px;
                display: none;
                gap: 5px;
            }
            
            .photo-block:hover .photo-controls {
                display: flex;
            }
            
            .photo-control-btn {
                background: #1a1a1a;
                color: #d4af37;
                border: 1px solid #d4af37;
                padding: 5px 10px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 12px;
            }
            
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateY(10px); }
                20% { opacity: 1; transform: translateY(0); }
                80% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Insert photo block
    function insertPhotoBlock() {
        const photoBlock = document.createElement('div');
        photoBlock.className = 'photo-block';
        photoBlock.innerHTML = `
            <div class="photo-controls">
                <button class="photo-control-btn" onclick="this.closest('.photo-block').remove()">Delete</button>
            </div>
            <div class="photo-upload-area">
                <p>Click to upload photo or drag & drop</p>
                <input type="file" accept="image/*" style="display: none;">
            </div>
            <div class="photo-caption admin-editable" contenteditable="true" placeholder="Enter caption..."></div>
        `;
        
        // Find insertion point
        const mainContent = document.querySelector('main, .content, .container, body');
        const insertPoint = document.querySelector('.selected-for-insert') || mainContent.lastElementChild;
        
        if (insertPoint) {
            insertPoint.parentNode.insertBefore(photoBlock, insertPoint.nextSibling);
        } else {
            mainContent.appendChild(photoBlock);
        }
        
        // Add upload handler
        const uploadArea = photoBlock.querySelector('.photo-upload-area');
        const fileInput = photoBlock.querySelector('input[type="file"]');
        
        uploadArea.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            handlePhotoUpload(e.target.files[0], photoBlock);
        });
        
        // Enable drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.background = 'rgba(212, 175, 55, 0.3)';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.background = 'transparent';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.background = 'transparent';
            
            if (e.dataTransfer.files.length > 0) {
                handlePhotoUpload(e.dataTransfer.files[0], photoBlock);
            }
        });
        
        // Make caption editable
        const caption = photoBlock.querySelector('.photo-caption');
        makeElementEditable(caption);
        
        // Save the block
        savePhotoBlock(photoBlock);
    }
    
    // Handle photo upload
    async function handlePhotoUpload(file, photoBlock) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const uploadArea = photoBlock.querySelector('.photo-upload-area');
            uploadArea.innerHTML = `<img src="${e.target.result}" alt="Uploaded photo">`;
            photoBlock.classList.add('has-image');
            
            // Save the updated block
            savePhotoBlock(photoBlock);
        };
        reader.readAsDataURL(file);
    }
    
    // Save photo block
    function savePhotoBlock(photoBlock) {
        const img = photoBlock.querySelector('img');
        const caption = photoBlock.querySelector('.photo-caption');
        
        const data = {
            imageSrc: img ? img.src : null,
            caption: caption.innerHTML
        };
        
        saveContent(photoBlock, 'photoBlock');
    }
    
    // Create photo block from saved data
    function createPhotoBlockFromData(data, parent, before) {
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        
        const photoBlock = document.createElement('div');
        photoBlock.className = 'photo-block';
        if (parsedData.imageSrc) {
            photoBlock.classList.add('has-image');
        }
        
        photoBlock.innerHTML = `
            <div class="photo-controls">
                <button class="photo-control-btn" onclick="this.closest('.photo-block').remove()">Delete</button>
            </div>
            ${parsedData.imageSrc ? 
                `<div class="photo-upload-area"><img src="${parsedData.imageSrc}" alt="Photo"></div>` :
                `<div class="photo-upload-area"><p>Click to upload photo</p><input type="file" accept="image/*" style="display: none;"></div>`
            }
            <div class="photo-caption admin-editable">${parsedData.caption || 'Enter caption...'}</div>
        `;
        
        if (before) {
            parent.insertBefore(photoBlock, before);
        } else {
            parent.appendChild(photoBlock);
        }
        
        return photoBlock;
    }
    
    // Insert text block
    function insertTextBlock() {
        const textBlock = document.createElement('div');
        textBlock.className = 'text-content admin-editable';
        textBlock.style.cssText = `
            margin: 20px 0;
            padding: 15px;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            min-height: 50px;
        `;
        textBlock.contentEditable = true;
        textBlock.innerHTML = 'Enter your text here...';
        
        // Find insertion point
        const mainContent = document.querySelector('main, .content, .container, body');
        mainContent.appendChild(textBlock);
        
        // Make it editable
        makeElementEditable(textBlock);
        
        // Focus on it
        textBlock.focus();
        
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(textBlock);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    // Save all changes
    async function saveAllChanges() {
        const editables = document.querySelectorAll('.admin-editable');
        let savedCount = 0;
        
        for (const element of editables) {
            if (element.innerHTML !== element.dataset.originalContent) {
                await saveContent(element);
                savedCount++;
            }
        }
        
        // Show confirmation
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #10b981;
            color: white;
            padding: 20px 30px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            z-index: 100000;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        toast.textContent = `✓ Saved ${savedCount} changes`;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 2000);
    }
    
    // Insert heading element
    function insertHeading() {
        const heading = document.createElement('h2');
        heading.contentEditable = true;
        heading.innerHTML = 'Click to Edit Heading';
        heading.style.cssText = `
            font-size: 2.5rem;
            font-weight: 700;
            margin: 20px 0;
            color: #1a202c;
            cursor: text;
        `;
        insertAtCursor(heading);
    }
    
    // Insert button element
    function insertButton() {
        const button = document.createElement('button');
        button.contentEditable = true;
        button.innerHTML = 'Click Me';
        button.style.cssText = `
            padding: 12px 24px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin: 10px 0;
        `;
        insertAtCursor(button);
    }
    
    // Insert gallery
    function insertGallery() {
        const gallery = document.createElement('div');
        gallery.className = 'photo-gallery';
        gallery.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 20px;
            background: #f7fafc;
            border-radius: 10px;
            margin: 20px 0;
        `;
        gallery.innerHTML = `
            <div style="aspect-ratio: 1; background: #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #718096;">
                <span>📷 Add Image</span>
            </div>
            <div style="aspect-ratio: 1; background: #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #718096;">
                <span>📷 Add Image</span>
            </div>
            <div style="aspect-ratio: 1; background: #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #718096;">
                <span>📷 Add Image</span>
            </div>
        `;
        insertAtCursor(gallery);
    }
    
    // Insert video placeholder
    function insertVideo() {
        const video = document.createElement('div');
        video.style.cssText = `
            width: 100%;
            max-width: 800px;
            aspect-ratio: 16/9;
            background: #000;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 20px auto;
        `;
        video.innerHTML = `
            <div style="text-align: center; color: white;">
                <div style="font-size: 48px; margin-bottom: 10px;">▶️</div>
                <div>Video Placeholder</div>
                <input type="url" placeholder="Enter video URL" style="
                    margin-top: 10px;
                    padding: 8px 12px;
                    border-radius: 6px;
                    border: 1px solid #ccc;
                    background: white;
                    color: black;
                ">
            </div>
        `;
        insertAtCursor(video);
    }
    
    // Insert hero section
    function insertHeroSection() {
        const hero = document.createElement('section');
        hero.style.cssText = `
            min-height: 500px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 60px 20px;
            border-radius: 10px;
            margin: 20px 0;
        `;
        hero.innerHTML = `
            <div>
                <h1 style="font-size: 3rem; font-weight: 700; margin-bottom: 20px;" contenteditable="true">Your Amazing Title</h1>
                <p style="font-size: 1.25rem; opacity: 0.9; margin-bottom: 30px;" contenteditable="true">Beautiful subtitle that captures attention</p>
                <button style="padding: 14px 28px; background: white; color: #667eea; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">Get Started</button>
            </div>
        `;
        insertAtCursor(hero);
    }
    
    // Insert features section
    function insertFeaturesSection() {
        const features = document.createElement('section');
        features.style.cssText = `
            padding: 60px 20px;
            background: #f8fafc;
            border-radius: 10px;
            margin: 20px 0;
        `;
        features.innerHTML = `
            <h2 style="text-align: center; font-size: 2.5rem; font-weight: 700; margin-bottom: 40px;" contenteditable="true">Features</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px;">
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 15px;">✨</div>
                    <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 10px;" contenteditable="true">Feature One</h3>
                    <p style="color: #718096;" contenteditable="true">Description of your amazing feature</p>
                </div>
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🚀</div>
                    <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 10px;" contenteditable="true">Feature Two</h3>
                    <p style="color: #718096;" contenteditable="true">Description of your amazing feature</p>
                </div>
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 15px;">💎</div>
                    <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 10px;" contenteditable="true">Feature Three</h3>
                    <p style="color: #718096;" contenteditable="true">Description of your amazing feature</p>
                </div>
            </div>
        `;
        insertAtCursor(features);
    }
    
    // Insert contact section
    function insertContactSection() {
        const contact = document.createElement('section');
        contact.style.cssText = `
            padding: 60px 20px;
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
        `;
        contact.innerHTML = `
            <h2 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 20px;" contenteditable="true">Get In Touch</h2>
            <p style="color: #718096; margin-bottom: 30px;" contenteditable="true">We'd love to hear from you</p>
            <div style="max-width: 500px; margin: 0 auto;">
                <input type="email" placeholder="Your Email" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 15px;">
                <textarea placeholder="Your Message" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 15px; min-height: 120px; resize: vertical;"></textarea>
                <button style="width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">Send Message</button>
            </div>
        `;
        insertAtCursor(contact);
    }
    
    // Helper function to insert at cursor or append to body
    function insertAtCursor(element) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.insertNode(element);
            range.collapse(false);
        } else {
            const container = document.querySelector('.content-container') || document.querySelector('main') || document.body;
            container.appendChild(element);
        }
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        makeEditableWithDelete(element);
    }
    
    // Make element editable with delete button and draggable
    function makeEditableWithDelete(element) {
        // Make all text content editable
        element.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, button, div').forEach(el => {
            if (!el.classList.contains('block-delete-btn') && !el.classList.contains('drag-handle')) {
                el.contentEditable = true;
            }
        });
        
        // Add container styling and make draggable
        element.style.position = 'relative';
        element.style.cursor = 'move';
        element.draggable = true;
        element.classList.add('draggable-block');
        
        // Add drag handle
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '⋮⋮';
        dragHandle.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            width: 30px;
            height: 30px;
            background: #667eea;
            color: white;
            border-radius: 6px;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            cursor: move;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            user-select: none;
        `;
        
        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'block-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: 30px;
            height: 30px;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 50%;
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            display: none;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            line-height: 1;
            transition: all 0.2s;
        `;
        deleteBtn.onmouseover = () => deleteBtn.style.transform = 'scale(1.1)';
        deleteBtn.onmouseout = () => deleteBtn.style.transform = 'scale(1)';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm('Delete this block?')) {
                element.remove();
                showFloatingMessage('Block deleted');
            }
        };
        
        // Drag event handlers
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', element.innerHTML);
            element.classList.add('dragging');
            element.style.opacity = '0.5';
            
            // Store the dragged element
            window.draggedElement = element;
        });
        
        element.addEventListener('dragend', (e) => {
            element.classList.remove('dragging');
            element.style.opacity = '';
            window.draggedElement = null;
            
            // Remove all drop indicators
            document.querySelectorAll('.drop-indicator').forEach(indicator => {
                indicator.remove();
            });
        });
        
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (!window.draggedElement || window.draggedElement === element) return;
            
            // Remove existing drop indicators
            document.querySelectorAll('.drop-indicator').forEach(indicator => {
                indicator.remove();
            });
            
            // Create drop indicator
            const dropIndicator = document.createElement('div');
            dropIndicator.className = 'drop-indicator';
            dropIndicator.style.cssText = `
                height: 4px;
                background: #667eea;
                margin: 10px 0;
                border-radius: 2px;
                animation: pulse 1s infinite;
            `;
            
            // Determine drop position
            const rect = element.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (e.clientY < midpoint) {
                element.parentNode.insertBefore(dropIndicator, element);
            } else {
                element.parentNode.insertBefore(dropIndicator, element.nextSibling);
            }
        });
        
        element.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (!window.draggedElement || window.draggedElement === element) return;
            
            // Determine drop position
            const rect = element.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (e.clientY < midpoint) {
                element.parentNode.insertBefore(window.draggedElement, element);
            } else {
                element.parentNode.insertBefore(window.draggedElement, element.nextSibling);
            }
            
            showFloatingMessage('Block moved');
            
            // Remove drop indicators
            document.querySelectorAll('.drop-indicator').forEach(indicator => {
                indicator.remove();
            });
        });
        
        // Show/hide controls on hover
        element.addEventListener('mouseenter', function() {
            this.style.outline = '2px dashed #667eea';
            this.style.outlineOffset = '4px';
            const btn = this.querySelector('.block-delete-btn');
            const handle = this.querySelector('.drag-handle');
            if (btn) btn.style.display = 'block';
            if (handle) handle.style.display = 'flex';
        });
        
        element.addEventListener('mouseleave', function() {
            this.style.outline = 'none';
            const btn = this.querySelector('.block-delete-btn');
            const handle = this.querySelector('.drag-handle');
            if (btn) btn.style.display = 'none';
            if (handle) handle.style.display = 'none';
        });
        
        // Add controls if not already present
        if (!element.querySelector('.drag-handle')) {
            element.appendChild(dragHandle);
        }
        if (!element.querySelector('.block-delete-btn')) {
            element.appendChild(deleteBtn);
        }
        
        // Add text selection handler for floating editor
        element.addEventListener('mouseup', handleTextSelection);
        element.addEventListener('keyup', handleTextSelection);
    }
    
    // Show floating message
    function showFloatingMessage(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #10b981;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            z-index: 100000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
    
    // Handle text selection for floating editor
    function handleTextSelection() {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        // Remove existing floating editor
        const existingEditor = document.getElementById('floating-editor');
        if (existingEditor) existingEditor.remove();
        
        // Only show if text is selected
        if (text.length > 0) {
            showFloatingEditor(selection);
        }
    }
    
    // Show floating text editor
    function showFloatingEditor(selection) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        const editor = document.createElement('div');
        editor.id = 'floating-editor';
        editor.style.cssText = `
            position: fixed;
            top: ${rect.top - 50}px;
            left: ${rect.left + (rect.width / 2) - 150}px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px;
            display: flex;
            gap: 4px;
            z-index: 100000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        // Format buttons
        const formats = [
            { icon: 'B', command: 'bold', title: 'Bold' },
            { icon: 'I', command: 'italic', title: 'Italic', style: 'font-style: italic;' },
            { icon: 'U', command: 'underline', title: 'Underline', style: 'text-decoration: underline;' },
            { icon: 'S', command: 'strikethrough', title: 'Strikethrough', style: 'text-decoration: line-through;' },
            { icon: '↑', command: 'superscript', title: 'Superscript' },
            { icon: '↓', command: 'subscript', title: 'Subscript' },
            { icon: '≡', command: 'justifyLeft', title: 'Align Left' },
            { icon: '≡', command: 'justifyCenter', title: 'Center' },
            { icon: '≡', command: 'justifyRight', title: 'Align Right' },
            { icon: '🔗', command: 'createLink', title: 'Add Link' },
            { icon: '×', command: 'removeFormat', title: 'Clear Format' }
        ];
        
        formats.forEach(format => {
            const btn = document.createElement('button');
            btn.innerHTML = format.icon;
            btn.title = format.title;
            btn.style.cssText = `
                width: 28px;
                height: 28px;
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: ${format.command === 'bold' ? 'bold' : 'normal'};
                ${format.style || ''}
                transition: all 0.2s;
            `;
            btn.onmouseover = () => {
                btn.style.background = '#f1f5f9';
                btn.style.borderColor = '#667eea';
            };
            btn.onmouseout = () => {
                btn.style.background = 'white';
                btn.style.borderColor = '#e2e8f0';
            };
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (format.command === 'createLink') {
                    const url = prompt('Enter URL:');
                    if (url) document.execCommand('createLink', false, url);
                } else {
                    document.execCommand(format.command, false, null);
                }
                
                // Keep selection active
                selection.removeAllRanges();
                selection.addRange(range);
            };
            editor.appendChild(btn);
        });
        
        // Add color picker
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = '#000000';
        colorPicker.title = 'Text Color';
        colorPicker.style.cssText = `
            width: 28px;
            height: 28px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            cursor: pointer;
        `;
        colorPicker.onchange = (e) => {
            document.execCommand('foreColor', false, e.target.value);
            selection.removeAllRanges();
            selection.addRange(range);
        };
        editor.appendChild(colorPicker);
        
        // Add font size selector
        const fontSize = document.createElement('select');
        fontSize.innerHTML = `
            <option value="1">Small</option>
            <option value="3" selected>Normal</option>
            <option value="5">Large</option>
            <option value="7">Huge</option>
        `;
        fontSize.style.cssText = `
            height: 28px;
            padding: 0 8px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        fontSize.onchange = (e) => {
            document.execCommand('fontSize', false, e.target.value);
            selection.removeAllRanges();
            selection.addRange(range);
        };
        editor.appendChild(fontSize);
        
        document.body.appendChild(editor);
        
        // Remove editor when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('mousedown', function removeEditor(e) {
                if (!editor.contains(e.target)) {
                    editor.remove();
                    document.removeEventListener('mousedown', removeEditor);
                }
            });
        }, 100);
    }
    
    // Apply editing capabilities to existing content sections
    function applyEditingToExistingContent() {
        // Find all major content sections
        const sections = document.querySelectorAll('section, article, .content-section, .hero-section, .features-section, .contact-section, .gallery-section');
        
        sections.forEach(section => {
            // Skip if already has delete button
            if (section.querySelector('.block-delete-btn')) return;
            
            // Apply editing capabilities
            makeEditableWithDelete(section);
        });
        
        // Also apply to individual content blocks
        const blocks = document.querySelectorAll('.text-block, .photo-block, .content-block, .editable-content');
        blocks.forEach(block => {
            if (!block.querySelector('.block-delete-btn')) {
                makeEditableWithDelete(block);
            }
        });
    }
    
    // Apply font family
    function applyFontFamily(fontFamily) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const element = range.commonAncestorContainer.nodeType === 3 
                ? range.commonAncestorContainer.parentElement 
                : range.commonAncestorContainer;
            element.style.fontFamily = fontFamily;
        }
    }
    
    // Apply text size
    function applyTextSize(size) {
        const sizes = {
            'sm': '14px',
            'md': '16px', 
            'lg': '20px',
            'xl': '24px'
        };
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const element = range.commonAncestorContainer.nodeType === 3 
                ? range.commonAncestorContainer.parentElement 
                : range.commonAncestorContainer;
            element.style.fontSize = sizes[size] || '16px';
        }
    }
    
    // Apply text alignment
    function applyAlignment(align) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const element = range.commonAncestorContainer.nodeType === 3 
                ? range.commonAncestorContainer.parentElement 
                : range.commonAncestorContainer;
            element.style.textAlign = align;
        }
    }
    
    // Apply spacing
    function applySpacing(spacing) {
        const spacings = {
            'compact': '10px',
            'normal': '20px',
            'relaxed': '40px'
        };
        const container = document.querySelector('.content-container') || document.querySelector('main') || document.body;
        container.style.padding = spacings[spacing] || '20px';
    }
    
    // Apply columns
    function applyColumns(cols) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const element = range.commonAncestorContainer.nodeType === 3 
                ? range.commonAncestorContainer.parentElement 
                : range.commonAncestorContainer;
            if (element.style.display !== 'grid') {
                element.style.display = 'grid';
            }
            element.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            element.style.gap = '20px';
        }
    }
    
    // Apply theme
    function applyTheme(theme) {
        const themes = {
            'minimal': { bg: '#ffffff', text: '#000000', accent: '#667eea' },
            'elegant': { bg: '#fafafa', text: '#2d3748', accent: '#805ad5' },
            'bold': { bg: '#1a202c', text: '#ffffff', accent: '#ed8936' },
            'dark': { bg: '#000000', text: '#ffffff', accent: '#48bb78' }
        };
        const selectedTheme = themes[theme] || themes.minimal;
        document.body.style.background = selectedTheme.bg;
        document.body.style.color = selectedTheme.text;
    }
    
    // Apply color
    function applyColor(color) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const element = range.commonAncestorContainer.nodeType === 3 
                ? range.commonAncestorContainer.parentElement 
                : range.commonAncestorContainer;
            element.style.color = color;
        }
    }
    
    // Toggle preview mode
    function togglePreviewMode() {
        const toolbar = document.getElementById('admin-toolbar');
        const editableElements = document.querySelectorAll('[contenteditable="true"]');
        const button = document.getElementById('preview-mode');
        
        if (button.textContent === 'Preview') {
            toolbar.style.display = 'none';
            editableElements.forEach(el => {
                el.contentEditable = false;
                el.style.outline = 'none';
            });
            button.textContent = 'Edit';
            
            // Show preview indicator
            const indicator = document.createElement('div');
            indicator.id = 'preview-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 14px;
                z-index: 10000;
            `;
            indicator.textContent = 'Preview Mode';
            document.body.appendChild(indicator);
            
            setTimeout(() => {
                toolbar.style.display = '';
                button.textContent = 'Preview';
                editableElements.forEach(el => el.contentEditable = true);
                document.getElementById('preview-indicator')?.remove();
            }, 5000);
        }
    }
    
    // Show admin badge
    function showAdminBadge() {
        const badge = document.createElement('div');
        badge.innerHTML = `
            <div style="
                position: fixed;
                top: 80px;
                right: 20px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: 12px 20px;
                border-radius: 30px;
                font-weight: 600;
                font-size: 14px;
                z-index: 99998;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                <span style="
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    background: #10b981;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                "></span>
                Admin Mode Active
            </div>
        `;
        
        document.body.appendChild(badge);
        
        // Add pulse animation and drag styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .draggable-block {
                transition: transform 0.2s;
            }
            
            .draggable-block:active {
                transform: scale(0.98);
            }
            
            .dragging {
                cursor: grabbing !important;
            }
            
            .drop-indicator {
                animation: pulse 1s infinite;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAdminEditor);
    } else {
        initializeAdminEditor();
    }
    
    // Export for global use
    window.AdminEditor = {
        init: initializeAdminEditor,
        insertPhotoBlock: insertPhotoBlock,
        insertTextBlock: insertTextBlock,
        saveAll: saveAllChanges
    };
})();