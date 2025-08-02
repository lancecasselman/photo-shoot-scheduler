// Image resize and alt text editing functionality

document.addEventListener('DOMContentLoaded', () => {
    initializeImageResize();
});

function initializeImageResize() {
    const blocksContainer = document.getElementById('blocks');
    if (!blocksContainer) return;
    
    // Add resize handles to all image blocks
    const imageBlocks = blocksContainer.querySelectorAll('.image-block');
    imageBlocks.forEach(addResizeHandles);
    
    // Add event listeners for image interactions
    blocksContainer.addEventListener('click', handleImageClick);
    blocksContainer.addEventListener('dblclick', handleImageDoubleClick);
    blocksContainer.addEventListener('contextmenu', handleImageRightClick);
}

function addResizeHandles(imageBlock) {
    // Remove existing handles
    imageBlock.querySelectorAll('.resize-handle').forEach(handle => handle.remove());
    
    // Create resize handles
    const handles = ['nw', 'ne', 'sw', 'se'];
    handles.forEach(position => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${position}`;
        handle.addEventListener('mousedown', (e) => startResize(e, imageBlock, position));
        imageBlock.appendChild(handle);
    });
    
    // Add caption if it doesn't exist
    if (!imageBlock.querySelector('.image-caption')) {
        const caption = document.createElement('div');
        caption.className = 'image-caption';
        caption.contentEditable = 'true';
        caption.textContent = 'Click to add caption...';
        caption.addEventListener('focus', handleCaptionFocus);
        caption.addEventListener('blur', handleCaptionBlur);
        imageBlock.appendChild(caption);
    }
}

function handleImageClick(e) {
    const imageBlock = e.target.closest('.image-block');
    if (!imageBlock) return;
    
    // Clear previous selections
    document.querySelectorAll('.image-block.selected').forEach(block => {
        block.classList.remove('selected');
    });
    
    // Select current image
    imageBlock.classList.add('selected');
}

function handleImageDoubleClick(e) {
    const img = e.target.closest('img');
    if (!img) return;
    
    e.preventDefault();
    editAltText(img);
}

function handleImageRightClick(e) {
    const img = e.target.closest('img');
    if (!img) return;
    
    e.preventDefault();
    editAltText(img);
}

function editAltText(img) {
    const currentAlt = img.alt || '';
    const newAlt = prompt('Enter alt text for this image:', currentAlt);
    
    if (newAlt !== null) {
        img.alt = newAlt;
        
        // Save state for undo/redo
        if (typeof saveUndoState === 'function') {
            saveUndoState();
        }
    }
}

function handleCaptionFocus(e) {
    const caption = e.target;
    if (caption.textContent === 'Click to add caption...') {
        caption.textContent = '';
    }
}

function handleCaptionBlur(e) {
    const caption = e.target;
    if (caption.textContent.trim() === '') {
        caption.textContent = 'Click to add caption...';
    }
    
    // Save state for undo/redo
    if (typeof saveUndoState === 'function') {
        saveUndoState();
    }
}

let isResizing = false;
let resizeStartX, resizeStartY, resizeStartWidth, resizeStartHeight;

function startResize(e, imageBlock, position) {
    e.preventDefault();
    e.stopPropagation();
    
    isResizing = true;
    const img = imageBlock.querySelector('img');
    if (!img) return;
    
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartWidth = img.offsetWidth;
    resizeStartHeight = img.offsetHeight;
    
    document.addEventListener('mousemove', (moveE) => handleResize(moveE, img, position));
    document.addEventListener('mouseup', stopResize);
    
    // Prevent drag during resize
    imageBlock.draggable = false;
}

function handleResize(e, img, position) {
    if (!isResizing) return;
    
    const deltaX = e.clientX - resizeStartX;
    const deltaY = e.clientY - resizeStartY;
    
    let newWidth = resizeStartWidth;
    let newHeight = resizeStartHeight;
    
    // Calculate new dimensions based on resize handle position
    switch (position) {
        case 'se':
            newWidth = resizeStartWidth + deltaX;
            newHeight = resizeStartHeight + deltaY;
            break;
        case 'sw':
            newWidth = resizeStartWidth - deltaX;
            newHeight = resizeStartHeight + deltaY;
            break;
        case 'ne':
            newWidth = resizeStartWidth + deltaX;
            newHeight = resizeStartHeight - deltaY;
            break;
        case 'nw':
            newWidth = resizeStartWidth - deltaX;
            newHeight = resizeStartHeight - deltaY;
            break;
    }
    
    // Maintain aspect ratio
    const aspectRatio = resizeStartWidth / resizeStartHeight;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        newHeight = newWidth / aspectRatio;
    } else {
        newWidth = newHeight * aspectRatio;
    }
    
    // Apply minimum size constraints
    newWidth = Math.max(50, newWidth);
    newHeight = Math.max(50, newHeight);
    
    // Apply new dimensions
    img.style.width = newWidth + 'px';
    img.style.height = newHeight + 'px';
}

function stopResize(e) {
    if (!isResizing) return;
    
    isResizing = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    
    // Re-enable dragging
    const imageBlocks = document.querySelectorAll('.image-block');
    imageBlocks.forEach(block => {
        block.draggable = true;
    });
    
    // Save state for undo/redo
    if (typeof saveUndoState === 'function') {
        saveUndoState();
    }
}

// Export function for use by other modules
window.initializeImageResize = initializeImageResize;