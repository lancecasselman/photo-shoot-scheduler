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
                background: #1a1a1a;
                border-top: 1px solid #333;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                z-index: 2147483647;
                box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
            ">
                <button id="add-photo-block" style="
                    background: #2a2a2a;
                    color: #fff;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    Photo
                </button>
                <button id="add-text-block" style="
                    background: #2a2a2a;
                    color: #fff;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="4 7 4 4 20 4 20 7"/>
                        <line x1="9" y1="20" x2="15" y2="20"/>
                        <line x1="12" y1="4" x2="12" y2="20"/>
                    </svg>
                    Text
                </button>
                <div style="
                    width: 1px;
                    height: 20px;
                    background: #444;
                    margin: 0 8px;
                "></div>
                <button id="save-all" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 6px 16px;
                    border-radius: 6px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 500;
                ">
                    Save
                </button>
            </div>
        `;
        
        document.body.appendChild(toolbar);
        
        // Add button handlers
        document.getElementById('add-photo-block').addEventListener('click', insertPhotoBlock);
        document.getElementById('add-text-block').addEventListener('click', insertTextBlock);
        document.getElementById('save-all').addEventListener('click', saveAllChanges);
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
        
        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
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