// Draggable Toolbars System for Website Builder
// Makes text and block toolbars draggable to prevent content blocking

let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let toolbarPositions = {
    textToolbar: { x: 100, y: 100 },
    blockToolbar: { x: 200, y: 100 }
};

/**
 * Initialize draggable functionality for toolbars
 * Called after toolbars are created
 */
function initializeDraggableToolbars() {
    // Add drag handles and functionality to existing toolbars
    setTimeout(() => {
        makeToolbarDraggable('text-toolbar', 'textToolbar');
        makeToolbarDraggable('block-toolbar', 'blockToolbar');
    }, 100);
}

/**
 * Makes a toolbar draggable by adding drag handle and event listeners
 * @param {string} toolbarId - The ID of the toolbar element
 * @param {string} positionKey - Key for storing toolbar position
 */
function makeToolbarDraggable(toolbarId, positionKey) {
    const toolbar = document.getElementById(toolbarId);
    if (!toolbar) {
        console.warn(`Toolbar ${toolbarId} not found for draggable functionality`);
        return;
    }
    
    // Add drag handle to toolbar if it doesn't exist
    let dragHandle = toolbar.querySelector('.drag-handle');
    if (!dragHandle) {
        dragHandle = createDragHandle();
        toolbar.insertBefore(dragHandle, toolbar.firstChild);
    }
    
    // Ensure toolbar is positioned for dragging
    if (toolbar.style.position !== 'fixed' && toolbar.style.position !== 'absolute') {
        toolbar.style.position = 'fixed';
    }
    
    // Set initial position if not already set
    if (toolbarPositions[positionKey]) {
        toolbar.style.left = toolbarPositions[positionKey].x + 'px';
        toolbar.style.top = toolbarPositions[positionKey].y + 'px';
    }
    
    // Add drag functionality
    setupDragEvents(toolbar, dragHandle, positionKey);
    
    console.log(`Made toolbar ${toolbarId} draggable`);
}

/**
 * Creates a drag handle element for toolbars
 * @returns {HTMLElement} The drag handle element
 */
function createDragHandle() {
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = `
        <div class="drag-dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;
    
    // Add drag handle styles
    dragHandle.style.cssText = `
        background: #f0f0f0;
        border-bottom: 1px solid #ddd;
        padding: 4px;
        cursor: move;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 4px 4px 0 0;
        user-select: none;
    `;
    
    // Style the dots
    const dotsContainer = dragHandle.querySelector('.drag-dots');
    dotsContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 4px);
        gap: 2px;
    `;
    
    const dots = dragHandle.querySelectorAll('.dot');
    dots.forEach(dot => {
        dot.style.cssText = `
            width: 4px;
            height: 4px;
            background: #999;
            border-radius: 50%;
        `;
    });
    
    return dragHandle;
}

/**
 * Sets up drag event listeners for a toolbar
 * @param {HTMLElement} toolbar - The toolbar element
 * @param {HTMLElement} dragHandle - The drag handle element
 * @param {string} positionKey - Key for storing position
 */
function setupDragEvents(toolbar, dragHandle, positionKey) {
    let startPos = { x: 0, y: 0 };
    let toolbarPos = { x: 0, y: 0 };
    
    // Mouse down on drag handle
    dragHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        isDragging = true;
        startPos.x = e.clientX;
        startPos.y = e.clientY;
        
        const rect = toolbar.getBoundingClientRect();
        toolbarPos.x = rect.left;
        toolbarPos.y = rect.top;
        
        toolbar.style.zIndex = '10003'; // Bring to front while dragging
        dragHandle.style.cursor = 'grabbing';
        
        // Add global mouse events
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });
    
    function handleMouseMove(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        const deltaX = e.clientX - startPos.x;
        const deltaY = e.clientY - startPos.y;
        
        const newX = toolbarPos.x + deltaX;
        const newY = toolbarPos.y + deltaY;
        
        // Keep toolbar within viewport bounds
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const toolbarRect = toolbar.getBoundingClientRect();
        
        const constrainedX = Math.max(0, Math.min(newX, viewportWidth - toolbarRect.width));
        const constrainedY = Math.max(0, Math.min(newY, viewportHeight - toolbarRect.height));
        
        toolbar.style.left = constrainedX + 'px';
        toolbar.style.top = constrainedY + 'px';
        
        // Store position
        toolbarPositions[positionKey] = { x: constrainedX, y: constrainedY };
    }
    
    function handleMouseUp(e) {
        if (!isDragging) return;
        
        isDragging = false;
        toolbar.style.zIndex = '10001'; // Reset z-index
        dragHandle.style.cursor = 'move';
        
        // Remove global mouse events
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Save position to localStorage for persistence
        try {
            localStorage.setItem('toolbarPositions', JSON.stringify(toolbarPositions));
        } catch (error) {
            console.warn('Could not save toolbar positions to localStorage:', error);
        }
    }
}

/**
 * Load saved toolbar positions from localStorage
 */
function loadToolbarPositions() {
    try {
        const saved = localStorage.getItem('toolbarPositions');
        if (saved) {
            const positions = JSON.parse(saved);
            toolbarPositions = { ...toolbarPositions, ...positions };
        }
    } catch (error) {
        console.warn('Could not load toolbar positions from localStorage:', error);
    }
}

/**
 * Reset toolbar positions to defaults
 */
function resetToolbarPositions() {
    toolbarPositions = {
        textToolbar: { x: 100, y: 100 },
        blockToolbar: { x: 200, y: 100 }
    };
    
    // Apply positions to existing toolbars
    const textToolbar = document.getElementById('text-toolbar');
    const blockToolbar = document.getElementById('block-toolbar');
    
    if (textToolbar) {
        textToolbar.style.left = toolbarPositions.textToolbar.x + 'px';
        textToolbar.style.top = toolbarPositions.textToolbar.y + 'px';
    }
    
    if (blockToolbar) {
        blockToolbar.style.left = toolbarPositions.blockToolbar.x + 'px';
        blockToolbar.style.top = toolbarPositions.blockToolbar.y + 'px';
    }
    
    // Clear localStorage
    try {
        localStorage.removeItem('toolbarPositions');
    } catch (error) {
        console.warn('Could not clear toolbar positions from localStorage:', error);
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    loadToolbarPositions();
    
    // Wait for toolbars to be created before making them draggable
    setTimeout(initializeDraggableToolbars, 500);
});

// Make functions available globally
window.draggableToolbarsAPI = {
    initializeDraggableToolbars,
    makeToolbarDraggable,
    resetToolbarPositions,
    loadToolbarPositions
};