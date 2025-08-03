// Floating Block Toolbar for Website Builder

let blockToolbar = null;
let selectedBlock = null;
let toolbarTimeout = null;

// Initialize block toolbar functionality
document.addEventListener('DOMContentLoaded', () => {
    createBlockToolbar();
    setupBlockSelectionListeners();
});

function createBlockToolbar() {
    // Create toolbar container
    blockToolbar = document.createElement('div');
    blockToolbar.id = 'blockToolbar';
    blockToolbar.className = 'block-toolbar';
    blockToolbar.style.cssText = `
        position: absolute;
        top: -1000px;
        left: -1000px;
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        display: none;
        z-index: 9999;
        user-select: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        min-width: 320px;
    `;
    
    // Create toolbar content
    blockToolbar.innerHTML = `
        <div class="toolbar-section">
            <div class="toolbar-row">
                <div class="control-group">
                    <label class="control-label">Background</label>
                    <input type="color" class="bg-color-picker" value="#ffffff" title="Background Color">
                </div>
                
                <div class="control-group">
                    <label class="control-label">Border</label>
                    <input type="color" class="border-color-picker" value="#e0e0e0" title="Border Color">
                    <input type="number" class="border-width-input" value="0" min="0" max="10" title="Border Width (px)">
                </div>
                
                <div class="control-group">
                    <label class="control-label">Opacity</label>
                    <input type="range" class="opacity-slider" min="0" max="100" value="100" title="Opacity">
                    <span class="opacity-value">100%</span>
                </div>
            </div>
            
            <div class="toolbar-row">
                <div class="control-group">
                    <label class="control-label">Padding</label>
                    <button class="padding-decrease" title="Decrease Padding">-</button>
                    <input type="number" class="padding-input" value="20" min="0" max="100" title="Padding (px)">
                    <button class="padding-increase" title="Increase Padding">+</button>
                </div>
                
                <div class="control-group">
                    <label class="control-label">Margin</label>
                    <button class="margin-decrease" title="Decrease Margin">-</button>
                    <input type="number" class="margin-input" value="0" min="0" max="100" title="Margin (px)">
                    <button class="margin-increase" title="Increase Margin">+</button>
                </div>
                
                <div class="control-group">
                    <label class="control-label">Layer</label>
                    <button class="bring-forward" title="Bring Forward">Forward</button>
                    <button class="send-backward" title="Send Backward">Backward</button>
                </div>
            </div>
            
            <div class="toolbar-row">
                <div class="control-group action-group">
                    <button class="duplicate-block" title="Duplicate Block">Duplicate</button>
                    <button class="delete-block" title="Delete Block">Delete</button>
                </div>
            </div>
        </div>
    `;
    
    // Add toolbar styles
    const toolbarStyles = document.createElement('style');
    toolbarStyles.textContent = `
        .block-toolbar .toolbar-section {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .block-toolbar .toolbar-row {
            display: flex;
            gap: 12px;
            align-items: flex-start;
            flex-wrap: wrap;
        }
        
        .block-toolbar .control-group {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            min-width: 70px;
        }
        
        .block-toolbar .action-group {
            flex-direction: row;
            min-width: auto;
        }
        
        .block-toolbar .control-label {
            font-size: 10px;
            color: #666;
            font-weight: 500;
            text-align: center;
        }
        
        .block-toolbar input[type="color"] {
            width: 32px;
            height: 24px;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            padding: 0;
        }
        
        .block-toolbar input[type="number"] {
            width: 50px;
            height: 24px;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 2px 4px;
            text-align: center;
            font-size: 11px;
        }
        
        .block-toolbar input[type="range"] {
            width: 80px;
            height: 20px;
        }
        
        .block-toolbar .opacity-value {
            font-size: 10px;
            color: #666;
            min-width: 30px;
            text-align: center;
        }
        
        .block-toolbar button {
            background: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 10px;
            height: 24px;
            transition: all 0.2s ease;
        }
        
        .block-toolbar button:hover {
            background: #e9ecef;
            border-color: #adb5bd;
        }
        
        .block-toolbar .padding-decrease,
        .block-toolbar .padding-increase,
        .block-toolbar .margin-decrease,
        .block-toolbar .margin-increase {
            width: 24px;
            font-weight: bold;
        }
        
        .block-toolbar .duplicate-block {
            background: #28a745;
            color: white;
            border-color: #28a745;
        }
        
        .block-toolbar .duplicate-block:hover {
            background: #218838;
        }
        
        .block-toolbar .delete-block {
            background: #dc3545;
            color: white;
            border-color: #dc3545;
        }
        
        .block-toolbar .delete-block:hover {
            background: #c82333;
        }
        
        .selected-block {
            outline: 2px solid #007bff !important;
            outline-offset: 2px;
        }
        
        .selected-block [contenteditable="true"] {
            outline: none !important;
            cursor: text !important;
        }
        
        .selected-block [contenteditable="true"]:focus {
            outline: 1px solid #28a745 !important;
            outline-offset: 1px;
        }
        
        @media (max-width: 768px) {
            .block-toolbar {
                transform: scale(0.85);
                transform-origin: top left;
                min-width: 280px;
            }
            
            .block-toolbar .toolbar-row {
                gap: 8px;
            }
            
            .block-toolbar .control-group {
                min-width: 60px;
            }
        }
    `;
    
    document.head.appendChild(toolbarStyles);
    document.body.appendChild(blockToolbar);
    
    // Setup toolbar event listeners
    setupBlockToolbarEvents();
}

function setupBlockSelectionListeners() {
    document.addEventListener('click', handleBlockClick);
    
    // Hide toolbar when clicking outside blocks
    document.addEventListener('click', (e) => {
        if (blockToolbar && blockToolbar.contains(e.target)) {
            return; // Don't hide if clicking on toolbar
        }
        
        const clickedBlock = e.target.closest('.block');
        const editableElement = e.target.closest('[contenteditable="true"]');
        
        // Don't hide block toolbar if clicking on editable text inside a block
        // But do hide it if clicking completely outside any block
        if (!clickedBlock) {
            hideBlockToolbar();
        }
    });
    
    // Handle escape key to deselect
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideBlockToolbar();
        }
    });
}

function handleBlockClick(e) {
    const block = e.target.closest('.block');
    
    if (block && isInBuilderContainer(block)) {
        // Check if we're clicking on editable content inside the block
        const editableElement = e.target.closest('[contenteditable="true"]');
        
        // If clicking on editable content, allow text editing but still select block
        if (editableElement && editableElement !== block) {
            // Select block but don't prevent text editing
            selectBlock(block);
            return; // Don't stop propagation for text editing
        }
        
        // If clicking on non-editable areas, select the block immediately
        e.stopPropagation();
        selectBlock(block);
    }
}

function isInBuilderContainer(element) {
    const builderContainer = document.getElementById('blocks');
    return builderContainer && builderContainer.contains(element);
}

function selectBlock(block) {
    // Remove previous selection
    if (selectedBlock) {
        selectedBlock.classList.remove('selected-block');
    }
    
    // Select new block
    selectedBlock = block;
    block.classList.add('selected-block');
    
    // Show toolbar
    showBlockToolbar(block);
    updateToolbarValues();
}

function showBlockToolbar(block) {
    if (!blockToolbar) return;
    
    const rect = block.getBoundingClientRect();
    const toolbarHeight = 120; // Approximate toolbar height
    const toolbarWidth = 320; // Approximate toolbar width
    const padding = 10;
    
    let top = rect.top + window.scrollY - toolbarHeight - padding;
    let left = rect.left + window.scrollX + (rect.width / 2) - (toolbarWidth / 2);
    
    // Adjust position if toolbar would be outside viewport
    const viewportWidth = window.innerWidth;
    
    if (left < padding) {
        left = padding;
    } else if (left + toolbarWidth > viewportWidth - padding) {
        left = viewportWidth - toolbarWidth - padding;
    }
    
    if (top < padding) {
        // Show below block if no room above
        top = rect.bottom + window.scrollY + padding;
    }
    
    blockToolbar.style.top = top + 'px';
    blockToolbar.style.left = left + 'px';
    blockToolbar.style.display = 'block';
}

function hideBlockToolbar() {
    if (blockToolbar) {
        blockToolbar.style.display = 'none';
    }
    
    if (selectedBlock) {
        selectedBlock.classList.remove('selected-block');
        selectedBlock = null;
    }
}

function updateToolbarValues() {
    if (!selectedBlock || !blockToolbar) return;
    
    const computedStyle = window.getComputedStyle(selectedBlock);
    
    // Update background color
    const bgColorPicker = blockToolbar.querySelector('.bg-color-picker');
    const bgColor = computedStyle.backgroundColor;
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
        bgColorPicker.value = rgbToHex(bgColor);
    }
    
    // Update border color and width
    const borderColorPicker = blockToolbar.querySelector('.border-color-picker');
    const borderWidthInput = blockToolbar.querySelector('.border-width-input');
    const borderColor = computedStyle.borderColor;
    const borderWidth = parseInt(computedStyle.borderWidth) || 0;
    
    if (borderColor) {
        borderColorPicker.value = rgbToHex(borderColor);
    }
    borderWidthInput.value = borderWidth;
    
    // Update opacity
    const opacitySlider = blockToolbar.querySelector('.opacity-slider');
    const opacityValue = blockToolbar.querySelector('.opacity-value');
    const opacity = Math.round(parseFloat(computedStyle.opacity || 1) * 100);
    
    opacitySlider.value = opacity;
    opacityValue.textContent = opacity + '%';
    
    // Update padding and margin
    const paddingInput = blockToolbar.querySelector('.padding-input');
    const marginInput = blockToolbar.querySelector('.margin-input');
    
    const padding = parseInt(computedStyle.padding) || 20;
    const margin = parseInt(computedStyle.margin) || 0;
    
    paddingInput.value = padding;
    marginInput.value = margin;
}

function setupBlockToolbarEvents() {
    if (!blockToolbar) return;
    
    // Background color
    const bgColorPicker = blockToolbar.querySelector('.bg-color-picker');
    bgColorPicker.addEventListener('change', (e) => {
        if (selectedBlock) {
            selectedBlock.style.backgroundColor = e.target.value;
            saveBlockState();
        }
    });
    
    // Border color
    const borderColorPicker = blockToolbar.querySelector('.border-color-picker');
    borderColorPicker.addEventListener('change', (e) => {
        if (selectedBlock) {
            selectedBlock.style.borderColor = e.target.value;
            selectedBlock.style.borderStyle = 'solid';
            saveBlockState();
        }
    });
    
    // Border width
    const borderWidthInput = blockToolbar.querySelector('.border-width-input');
    borderWidthInput.addEventListener('input', (e) => {
        if (selectedBlock) {
            const width = parseInt(e.target.value) || 0;
            selectedBlock.style.borderWidth = width + 'px';
            selectedBlock.style.borderStyle = width > 0 ? 'solid' : 'none';
            saveBlockState();
        }
    });
    
    // Opacity slider
    const opacitySlider = blockToolbar.querySelector('.opacity-slider');
    const opacityValue = blockToolbar.querySelector('.opacity-value');
    
    opacitySlider.addEventListener('input', (e) => {
        if (selectedBlock) {
            const opacity = parseInt(e.target.value) / 100;
            selectedBlock.style.opacity = opacity;
            opacityValue.textContent = e.target.value + '%';
            saveBlockState();
        }
    });
    
    // Padding controls
    const paddingInput = blockToolbar.querySelector('.padding-input');
    const paddingDecrease = blockToolbar.querySelector('.padding-decrease');
    const paddingIncrease = blockToolbar.querySelector('.padding-increase');
    
    paddingInput.addEventListener('input', (e) => {
        if (selectedBlock) {
            selectedBlock.style.padding = e.target.value + 'px';
            saveBlockState();
        }
    });
    
    paddingDecrease.addEventListener('click', () => {
        const currentValue = parseInt(paddingInput.value) || 0;
        const newValue = Math.max(0, currentValue - 5);
        paddingInput.value = newValue;
        if (selectedBlock) {
            selectedBlock.style.padding = newValue + 'px';
            saveBlockState();
        }
    });
    
    paddingIncrease.addEventListener('click', () => {
        const currentValue = parseInt(paddingInput.value) || 0;
        const newValue = Math.min(100, currentValue + 5);
        paddingInput.value = newValue;
        if (selectedBlock) {
            selectedBlock.style.padding = newValue + 'px';
            saveBlockState();
        }
    });
    
    // Margin controls
    const marginInput = blockToolbar.querySelector('.margin-input');
    const marginDecrease = blockToolbar.querySelector('.margin-decrease');
    const marginIncrease = blockToolbar.querySelector('.margin-increase');
    
    marginInput.addEventListener('input', (e) => {
        if (selectedBlock) {
            selectedBlock.style.margin = e.target.value + 'px';
            saveBlockState();
        }
    });
    
    marginDecrease.addEventListener('click', () => {
        const currentValue = parseInt(marginInput.value) || 0;
        const newValue = Math.max(0, currentValue - 5);
        marginInput.value = newValue;
        if (selectedBlock) {
            selectedBlock.style.margin = newValue + 'px';
            saveBlockState();
        }
    });
    
    marginIncrease.addEventListener('click', () => {
        const currentValue = parseInt(marginInput.value) || 0;
        const newValue = Math.min(100, currentValue + 5);
        marginInput.value = newValue;
        if (selectedBlock) {
            selectedBlock.style.margin = newValue + 'px';
            saveBlockState();
        }
    });
    
    // Layer controls
    const bringForward = blockToolbar.querySelector('.bring-forward');
    const sendBackward = blockToolbar.querySelector('.send-backward');
    
    bringForward.addEventListener('click', () => {
        if (selectedBlock) {
            const currentZ = parseInt(selectedBlock.style.zIndex) || 0;
            selectedBlock.style.zIndex = currentZ + 1;
            selectedBlock.style.position = 'relative';
            saveBlockState();
        }
    });
    
    sendBackward.addEventListener('click', () => {
        if (selectedBlock) {
            const currentZ = parseInt(selectedBlock.style.zIndex) || 0;
            selectedBlock.style.zIndex = Math.max(-1, currentZ - 1);
            selectedBlock.style.position = 'relative';
            saveBlockState();
        }
    });
    
    // Action buttons
    const duplicateBtn = blockToolbar.querySelector('.duplicate-block');
    const deleteBtn = blockToolbar.querySelector('.delete-block');
    
    duplicateBtn.addEventListener('click', () => {
        if (selectedBlock) {
            duplicateBlock(selectedBlock);
        }
    });
    
    deleteBtn.addEventListener('click', () => {
        if (selectedBlock && confirm('Delete this block?')) {
            deleteBlock(selectedBlock);
        }
    });
}

function duplicateBlock(block) {
    const clone = block.cloneNode(true);
    
    // Remove selection class from clone
    clone.classList.remove('selected-block');
    
    // Reset any unique IDs in the clone
    resetCloneIds(clone);
    
    // Insert after original block
    block.parentNode.insertBefore(clone, block.nextSibling);
    
    // Setup drag and drop for cloned block
    if (typeof setupBlockDragEvents === 'function') {
        setupBlockDragEvents(clone);
    }
    
    // Setup image placeholders if present
    if (typeof setupImagePlaceholders === 'function') {
        setupImagePlaceholders(clone);
    }
    
    // Select the new block
    selectBlock(clone);
    
    saveBlockState();
}

function deleteBlock(block) {
    hideBlockToolbar();
    block.remove();
    saveBlockState();
}

function resetCloneIds(element) {
    // Remove any IDs to avoid duplicates
    if (element.id) {
        element.removeAttribute('id');
    }
    
    // Recursively reset IDs in children
    const childrenWithIds = element.querySelectorAll('[id]');
    childrenWithIds.forEach(child => {
        child.removeAttribute('id');
    });
}

function saveBlockState() {
    // Save state for undo/redo
    if (typeof saveUndoState === 'function') {
        setTimeout(() => saveUndoState(), 200);
    }
}

// Utility function to convert RGB to hex
function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb;
    
    const result = rgb.match(/\d+/g);
    if (!result || result.length < 3) return '#ffffff';
    
    return '#' + result.slice(0, 3).map(x => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Make functions available globally
window.blockToolbarAPI = {
    selectBlock: selectBlock,
    hideToolbar: hideBlockToolbar,
    showToolbar: showBlockToolbar,
    getSelectedBlock: () => selectedBlock
};