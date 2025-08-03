// Floating Inline Text Toolbar for Website Builder

let textToolbar = null;
let currentSelection = null;
let selectionTimeout = null;

// Initialize text toolbar functionality
document.addEventListener('DOMContentLoaded', () => {
    createTextToolbar();
    setupTextSelectionListeners();
});

function createTextToolbar() {
    // Create toolbar container
    textToolbar = document.createElement('div');
    textToolbar.id = 'textToolbar';
    textToolbar.className = 'text-toolbar';
    textToolbar.style.cssText = `
        position: absolute;
        top: -1000px;
        left: -1000px;
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        display: none;
        z-index: 10000;
        user-select: none;
        white-space: nowrap;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
    `;
    
    // Create toolbar buttons and controls
    textToolbar.innerHTML = `
        <div class="toolbar-group">
            <select class="font-family-select" title="Font Family">
                <option value="inherit">Default</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Times New Roman', serif">Times</option>
                <option value="'Courier New', monospace">Courier</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value="Tahoma, sans-serif">Tahoma</option>
            </select>
            
            <select class="font-size-select" title="Font Size">
                <option value="12px">12px</option>
                <option value="14px">14px</option>
                <option value="16px" selected>16px</option>
                <option value="18px">18px</option>
                <option value="20px">20px</option>
                <option value="24px">24px</option>
                <option value="28px">28px</option>
                <option value="32px">32px</option>
                <option value="36px">36px</option>
            </select>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <div class="toolbar-group">
            <button class="toolbar-btn" data-command="bold" title="Bold">
                <strong>B</strong>
            </button>
            <button class="toolbar-btn" data-command="italic" title="Italic">
                <em>I</em>
            </button>
            <button class="toolbar-btn" data-command="underline" title="Underline">
                <u>U</u>
            </button>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <div class="toolbar-group">
            <div class="color-group">
                <label class="color-label">Text</label>
                <input type="color" class="text-color-picker" value="#000000" title="Text Color">
            </div>
            <div class="color-group">
                <label class="color-label">Highlight</label>
                <input type="color" class="highlight-color-picker" value="#ffff00" title="Highlight Color">
            </div>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <div class="toolbar-group">
            <button class="toolbar-btn" data-command="createLink" title="Add Link">
                Link
            </button>
            <button class="toolbar-btn" data-command="insertUnorderedList" title="Bullet List">
                • List
            </button>
        </div>
    `;
    
    // Add toolbar styles
    const toolbarStyles = document.createElement('style');
    toolbarStyles.textContent = `
        .text-toolbar .toolbar-group {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        
        .text-toolbar .toolbar-divider {
            width: 1px;
            height: 20px;
            background: #e0e0e0;
            margin: 0 6px;
        }
        
        .text-toolbar .toolbar-btn {
            background: none;
            border: 1px solid transparent;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            min-width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .text-toolbar .toolbar-btn:hover {
            background: #f5f5f5;
            border-color: #ddd;
        }
        
        .text-toolbar .toolbar-btn.active {
            background: #e3f2fd;
            border-color: #2196f3;
        }
        
        .text-toolbar select {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 4px 6px;
            font-size: 12px;
            background: white;
            cursor: pointer;
        }
        
        .text-toolbar .font-family-select {
            width: 80px;
        }
        
        .text-toolbar .font-size-select {
            width: 60px;
        }
        
        .text-toolbar .color-group {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
        }
        
        .text-toolbar .color-label {
            font-size: 10px;
            color: #666;
        }
        
        .text-toolbar input[type="color"] {
            width: 24px;
            height: 20px;
            border: 1px solid #ddd;
            border-radius: 3px;
            cursor: pointer;
            padding: 0;
        }
        
        @media (max-width: 768px) {
            .text-toolbar {
                transform: scale(0.9);
                transform-origin: top left;
            }
        }
    `;
    
    document.head.appendChild(toolbarStyles);
    document.body.appendChild(textToolbar);
    
    // Setup toolbar event listeners
    setupToolbarEvents();
}

function setupTextSelectionListeners() {
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keyup', handleTextSelection);
    document.addEventListener('mousedown', handleMouseDown);
    
    // Hide toolbar when clicking outside editable content
    document.addEventListener('click', (e) => {
        if (!textToolbar.contains(e.target) && !isInEditableBlock(e.target)) {
            // Small delay to allow block selection to work
            setTimeout(() => hideTextToolbar(), 50);
        }
    });
}

function handleMouseDown(e) {
    // Don't hide toolbar if clicking on it
    if (textToolbar && textToolbar.contains(e.target)) {
        e.preventDefault();
        return;
    }
    
    // Check if clicking on editable content - allow text selection
    if (isInEditableBlock(e.target)) {
        // Don't prevent default for text selection in editable blocks
        return;
    }
}

function handleTextSelection(e) {
    // Clear any existing timeout
    if (selectionTimeout) {
        clearTimeout(selectionTimeout);
    }
    
    // Small delay to ensure selection has settled
    selectionTimeout = setTimeout(() => {
        const selection = window.getSelection();
        
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const selectedText = selection.toString().trim();
            
            // Check if selection is within an editable block
            if (selectedText && isSelectionInEditableBlock(range)) {
                currentSelection = { selection, range };
                showTextToolbar(range);
                updateToolbarState();
                
                // Also ensure the containing block is selected for block toolbar
                const container = range.commonAncestorContainer;
                const textNode = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
                const block = textNode.closest('.block');
                if (block && typeof window.blockToolbarAPI !== 'undefined') {
                    setTimeout(() => window.blockToolbarAPI.selectBlock(block), 10);
                }
            } else {
                hideTextToolbar();
            }
        } else {
            hideTextToolbar();
        }
    }, 50);
}

function isSelectionInEditableBlock(range) {
    let container = range.commonAncestorContainer;
    
    // If text node, get parent element
    if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentElement;
    }
    
    return isInEditableBlock(container);
}

function isInEditableBlock(element) {
    if (!element) return false;
    
    // Check if element or any parent is contenteditable
    let current = element;
    while (current && current !== document.body) {
        if (current.contentEditable === 'true' || current.hasAttribute('contenteditable')) {
            // Make sure it's within the website builder
            const builderContainer = document.getElementById('blocks');
            return builderContainer && builderContainer.contains(current);
        }
        current = current.parentElement;
    }
    return false;
}

function showTextToolbar(range) {
    if (!textToolbar) return;
    
    const rect = range.getBoundingClientRect();
    const toolbarHeight = 50; // Approximate toolbar height
    const padding = 10;
    
    let top = rect.top + window.scrollY - toolbarHeight - padding;
    let left = rect.left + window.scrollX + (rect.width / 2) - 150; // Center toolbar
    
    // Adjust position if toolbar would be outside viewport
    const viewportWidth = window.innerWidth;
    const toolbarWidth = 300; // Approximate toolbar width
    
    if (left < padding) {
        left = padding;
    } else if (left + toolbarWidth > viewportWidth - padding) {
        left = viewportWidth - toolbarWidth - padding;
    }
    
    if (top < padding) {
        // Show below selection if no room above
        top = rect.bottom + window.scrollY + padding;
    }
    
    textToolbar.style.top = top + 'px';
    textToolbar.style.left = left + 'px';
    textToolbar.style.display = 'block';
}

function hideTextToolbar() {
    if (textToolbar) {
        textToolbar.style.display = 'none';
    }
    currentSelection = null;
}

function setupToolbarEvents() {
    if (!textToolbar) return;
    
    // Format buttons
    textToolbar.addEventListener('click', (e) => {
        const button = e.target.closest('.toolbar-btn');
        if (button && currentSelection) {
            e.preventDefault();
            
            const command = button.dataset.command;
            executeCommand(command);
        }
    });
    
    // Font family dropdown
    const fontFamilySelect = textToolbar.querySelector('.font-family-select');
    fontFamilySelect.addEventListener('change', (e) => {
        if (currentSelection) {
            executeCommand('fontName', e.target.value);
        }
    });
    
    // Font size dropdown
    const fontSizeSelect = textToolbar.querySelector('.font-size-select');
    fontSizeSelect.addEventListener('change', (e) => {
        if (currentSelection) {
            executeCommand('fontSize', e.target.value);
        }
    });
    
    // Text color picker
    const textColorPicker = textToolbar.querySelector('.text-color-picker');
    textColorPicker.addEventListener('change', (e) => {
        if (currentSelection) {
            executeCommand('foreColor', e.target.value);
        }
    });
    
    // Highlight color picker
    const highlightColorPicker = textToolbar.querySelector('.highlight-color-picker');
    highlightColorPicker.addEventListener('change', (e) => {
        if (currentSelection) {
            executeCommand('hiliteColor', e.target.value);
        }
    });
}

function executeCommand(command, value = null) {
    if (!currentSelection) return;
    
    // Restore selection
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(currentSelection.range);
    
    try {
        if (command === 'createLink') {
            const url = prompt('Enter URL:');
            if (url) {
                document.execCommand(command, false, url);
            }
        } else if (command === 'fontSize') {
            // Use CSS for font size instead of legacy fontSize command
            const span = document.createElement('span');
            span.style.fontSize = value;
            
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                try {
                    range.surroundContents(span);
                } catch (e) {
                    // Fallback: wrap content manually
                    const contents = range.extractContents();
                    span.appendChild(contents);
                    range.insertNode(span);
                }
            }
        } else if (command === 'fontName') {
            // Use CSS for font family
            const span = document.createElement('span');
            span.style.fontFamily = value;
            
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                try {
                    range.surroundContents(span);
                } catch (e) {
                    // Fallback: wrap content manually
                    const contents = range.extractContents();
                    span.appendChild(contents);
                    range.insertNode(span);
                }
            }
        } else {
            // Standard commands
            document.execCommand(command, false, value);
        }
        
        // Update toolbar state after command
        setTimeout(() => updateToolbarState(), 10);
        
        // Save state for undo/redo
        if (typeof saveUndoState === 'function') {
            setTimeout(() => saveUndoState(), 200);
        }
        
    } catch (error) {
        console.error('Command execution failed:', error);
    }
}

function updateToolbarState() {
    if (!textToolbar || !currentSelection) return;
    
    // Update button states based on current formatting
    const buttons = textToolbar.querySelectorAll('.toolbar-btn');
    buttons.forEach(button => {
        const command = button.dataset.command;
        if (command) {
            try {
                const isActive = document.queryCommandState(command);
                button.classList.toggle('active', isActive);
            } catch (e) {
                // Command not supported, ignore
            }
        }
    });
    
    // Update font family and size selectors
    try {
        const fontFamily = document.queryCommandValue('fontName');
        const fontSize = document.queryCommandValue('fontSize');
        
        const fontFamilySelect = textToolbar.querySelector('.font-family-select');
        const fontSizeSelect = textToolbar.querySelector('.font-size-select');
        
        if (fontFamily && fontFamilySelect) {
            fontFamilySelect.value = fontFamily;
        }
        
        // Font size mapping (queryCommandValue returns numbers 1-7)
        const sizeMap = {
            '1': '12px',
            '2': '14px',
            '3': '16px',
            '4': '18px',
            '5': '24px',
            '6': '32px',
            '7': '48px'
        };
        
        if (fontSize && fontSizeSelect && sizeMap[fontSize]) {
            fontSizeSelect.value = sizeMap[fontSize];
        }
    } catch (e) {
        // Commands not supported, ignore
    }
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (selectionTimeout) {
        clearTimeout(selectionTimeout);
    }
});

// Make functions available globally for debugging
window.textToolbarAPI = {
    show: showTextToolbar,
    hide: hideTextToolbar,
    executeCommand: executeCommand
};