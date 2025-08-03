// Block Library functionality for the Website Builder

// Initialize block library UI
document.addEventListener('DOMContentLoaded', () => {
    createBlockLibraryModal();
    setupLibraryButton();
    setupDragAndDrop();
});

// Create the block library modal
function createBlockLibraryModal() {
    const modal = document.createElement('div');
    modal.id = 'blockLibraryModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div id="blockLibraryContent" style="
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            max-width: 800px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #2c3e50;">Block Library</h3>
                <button id="closeBlockLibrary" style="
                    background: #95a5a6;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    cursor: pointer;
                    font-size: 16px;
                ">×</button>
            </div>
            <div id="blockGrid" style="
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 15px;
            "></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal handlers
    document.getElementById('closeBlockLibrary').addEventListener('click', closeBlockLibrary);
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'blockLibraryModal') {
            closeBlockLibrary();
        }
    });
}

// Setup the "Add from Library" button
function setupLibraryButton() {
    const addLibraryBtn = document.getElementById('addFromLibrary');
    if (addLibraryBtn) {
        addLibraryBtn.addEventListener('click', showBlockLibrary);
    }
}

// Show block library modal
function showBlockLibrary() {
    const modal = document.getElementById('blockLibraryModal');
    const blockGrid = document.getElementById('blockGrid');
    
    // Clear existing blocks
    blockGrid.innerHTML = '';
    
    // Load blocks from library
    if (typeof window.blockLibrary !== 'undefined') {
        window.blockLibrary.forEach(block => {
            const blockCard = createBlockCard(block);
            blockGrid.appendChild(blockCard);
        });
    } else {
        blockGrid.innerHTML = '<p style="text-align: center; color: #666;">Block library not available</p>';
    }
    
    modal.style.display = 'flex';
}

// Close block library modal
function closeBlockLibrary() {
    document.getElementById('blockLibraryModal').style.display = 'none';
}

// Create a block card for the library
function createBlockCard(block) {
    const card = document.createElement('div');
    card.style.cssText = `
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 15px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: #f9f9f9;
        text-align: center;
    `;
    
    card.innerHTML = `
        <h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 14px;">${block.name}</h4>
        <div style="
            background: white;
            border: 1px solid #eee;
            border-radius: 4px;
            padding: 10px;
            font-size: 10px;
            color: #666;
            height: 60px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        ">Preview</div>
        <button style="
            margin-top: 10px;
            background: #3498db;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            width: 100%;
        ">Add Block</button>
    `;
    
    // Add hover effects
    card.addEventListener('mouseenter', () => {
        card.style.borderColor = '#3498db';
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.borderColor = '#ddd';
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
    });
    
    // Add click handler to insert block
    card.addEventListener('click', () => insertBlock(block));
    
    return card;
}

// Insert block into the builder
function insertBlock(block) {
    const builderContainer = document.getElementById('blocks');
    if (!builderContainer) {
        alert('Builder container not found');
        return;
    }
    
    // Create temporary container to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = block.html.trim();
    
    // Get the block element
    const blockElement = tempDiv.firstElementChild;
    if (!blockElement) {
        alert('Invalid block HTML');
        return;
    }
    
    // Add draggable attributes
    blockElement.draggable = true;
    blockElement.setAttribute('data-block-id', block.id);
    
    // Add drag event listeners
    setupBlockDragEvents(blockElement);
    
    // Append to builder
    builderContainer.appendChild(blockElement);
    
    // Close the library modal
    closeBlockLibrary();
    
    // Setup image placeholders in the inserted block
    setupImagePlaceholders(blockElement);
    
    // Add animation
    blockElement.classList.add('new');
    setTimeout(() => blockElement.classList.remove('new'), 300);
    
    // Save state for undo/redo
    if (typeof saveUndoState === 'function') {
        setTimeout(() => saveUndoState(), 200);
    }
    
    console.log('Inserted block:', block.name);
}

// Setup drag and drop functionality
function setupDragAndDrop() {
    const builderContainer = document.getElementById('blocks');
    if (!builderContainer) return;
    
    // Make existing blocks draggable
    const existingBlocks = builderContainer.querySelectorAll('.block');
    existingBlocks.forEach(block => {
        block.draggable = true;
        setupBlockDragEvents(block);
    });
    
    // Setup drop zone
    builderContainer.addEventListener('dragover', handleDragOver);
    builderContainer.addEventListener('drop', handleDrop);
}

// Setup drag events for a block
function setupBlockDragEvents(block) {
    block.addEventListener('dragstart', handleDragStart);
    block.addEventListener('dragend', handleDragEnd);
}

let draggedElement = null;

// Handle drag start
function handleDragStart(e) {
    draggedElement = e.target;
    e.target.style.opacity = '0.5';
    
    // Optimize for image blocks by reducing visual updates
    const isImageBlock = e.target.querySelector('img') !== null;
    
    // Create visual indicator
    const indicator = document.createElement('div');
    indicator.id = 'dragIndicator';
    indicator.style.cssText = `
        position: fixed;
        background: #3498db;
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        pointer-events: none;
        z-index: 1000;
        font-size: 12px;
    `;
    indicator.textContent = isImageBlock ? 'Moving image block...' : 'Dragging block...';
    document.body.appendChild(indicator);
    
    // Throttle mousemove updates for better performance with image blocks
    let lastUpdate = 0;
    const throttleInterval = isImageBlock ? 16 : 8; // 60fps for images, 120fps for text
    
    function throttledUpdateDragIndicator(e) {
        const now = Date.now();
        if (now - lastUpdate >= throttleInterval) {
            updateDragIndicator(e);
            lastUpdate = now;
        }
    }
    
    document.addEventListener('mousemove', throttledUpdateDragIndicator);
    e.target._throttledUpdate = throttledUpdateDragIndicator; // Store reference for cleanup
}

// Handle drag end
function handleDragEnd(e) {
    e.target.style.opacity = '';
    draggedElement = null;
    
    // Remove visual indicator
    const indicator = document.getElementById('dragIndicator');
    if (indicator) {
        indicator.remove();
    }
    
    // Remove the throttled event listener
    if (e.target._throttledUpdate) {
        document.removeEventListener('mousemove', e.target._throttledUpdate);
        delete e.target._throttledUpdate;
    } else {
        document.removeEventListener('mousemove', updateDragIndicator);
    }
    
    // Remove drop indicators
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    
    // Save state for undo/redo after drag operation
    if (typeof saveUndoState === 'function') {
        setTimeout(() => saveUndoState(), 100);
    }
}

// Setup image placeholders for clickable upload
function setupImagePlaceholders(container) {
    // Find all image placeholders (SVG data URLs containing "Click to upload image")
    const images = container.querySelectorAll('img');
    
    images.forEach(img => {
        if (isImagePlaceholder(img)) {
            setupImagePlaceholderClick(img);
        }
    });
}

// Check if an image is a placeholder
function isImagePlaceholder(img) {
    const src = img.src;
    return src.includes('data:image/svg+xml') && 
           (src.includes('Click to upload image') || src.includes('Upload') || src.includes('upload'));
}

// Setup click handler for image placeholder
function setupImagePlaceholderClick(img) {
    // Add visual styling to indicate it's clickable
    img.style.cursor = 'pointer';
    img.style.border = '2px dashed #dee2e6';
    img.style.borderRadius = '8px';
    img.style.transition = 'all 0.3s ease';
    
    // Add hover effect
    img.addEventListener('mouseenter', () => {
        img.style.borderColor = '#007bff';
        img.style.opacity = '0.8';
    });
    
    img.addEventListener('mouseleave', () => {
        img.style.borderColor = '#dee2e6';
        img.style.opacity = '1';
    });
    
    // Add click handler for upload
    img.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openImageUploadForPlaceholder(img);
    });
    
    // Mark as placeholder for future reference
    img.dataset.placeholder = 'true';
}

// Open image upload for a specific placeholder
function openImageUploadForPlaceholder(placeholderImg) {
    // Create a temporary file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.jpg,.jpeg,.png,.webp';
    fileInput.style.display = 'none';
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            // Show loading state
            const originalSrc = placeholderImg.src;
            placeholderImg.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300" viewBox="0 0 500 300"><rect width="500" height="300" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d" font-size="18">Uploading...</text></svg>';
            
            // Upload using existing server endpoint
            const uploadResult = await uploadImageToServer(file);
            
            if (uploadResult && uploadResult.downloadURL) {
                // Replace placeholder with uploaded image
                replacePlaceholderWithImage(placeholderImg, uploadResult.downloadURL, file.name);
            } else {
                throw new Error('Upload failed');
            }
            
        } catch (error) {
            console.error('Image upload failed:', error);
            
            // Restore original placeholder
            placeholderImg.src = originalSrc;
            alert('Image upload failed. Please try again.');
        }
        
        // Clean up
        document.body.removeChild(fileInput);
    });
    
    // Trigger file selection
    document.body.appendChild(fileInput);
    fileInput.click();
}

// Upload image using existing server logic
async function uploadImageToServer(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch('/api/upload/builder-image', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
    }
    
    return await response.json();
}

// Replace placeholder with actual image
function replacePlaceholderWithImage(placeholderImg, imageUrl, fileName) {
    // Update the image source
    placeholderImg.src = imageUrl;
    placeholderImg.alt = fileName || 'Uploaded image';
    
    // Remove placeholder styling
    placeholderImg.style.cursor = 'default';
    placeholderImg.style.border = 'none';
    placeholderImg.dataset.placeholder = 'false';
    
    // Remove hover effects
    placeholderImg.replaceWith(placeholderImg.cloneNode(true));
    
    // Add image resize functionality if available
    if (typeof setupImageResize === 'function') {
        setupImageResize(placeholderImg);
    }
    
    // Save state for undo/redo
    if (typeof saveUndoState === 'function') {
        setTimeout(() => saveUndoState(), 200);
    }
    
    console.log('Placeholder replaced with uploaded image:', imageUrl);
}

// Reinitialize blocks after loading (for multi-page support)
function reinitializeBlocks() {
    const builderContainer = document.getElementById('blocks');
    if (!builderContainer) return;
    
    // Setup image placeholders for all blocks
    const blocks = builderContainer.querySelectorAll('.block');
    blocks.forEach(block => {
        setupImagePlaceholders(block);
        
        // Ensure drag and drop is setup
        if (!block.draggable) {
            block.draggable = true;
            setupBlockDragEvents(block);
        }
    });
}

// Make reinitializeBlocks available globally for multi-page support
window.reinitializeBlocks = reinitializeBlocks;

// Update drag indicator position
function updateDragIndicator(e) {
    const indicator = document.getElementById('dragIndicator');
    if (indicator) {
        indicator.style.left = (e.clientX + 10) + 'px';
        indicator.style.top = (e.clientY - 30) + 'px';
    }
}

// Handle drag over
function handleDragOver(e) {
    e.preventDefault();
    
    const afterElement = getDragAfterElement(e.clientY);
    const builderContainer = document.getElementById('blocks');
    
    // Remove existing drop indicators
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    
    if (draggedElement && builderContainer) {
        // Create drop indicator
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
        indicator.style.cssText = `
            height: 3px;
            background: #3498db;
            margin: 5px 0;
            border-radius: 2px;
            opacity: 0.8;
        `;
        
        if (afterElement == null) {
            builderContainer.appendChild(indicator);
        } else {
            builderContainer.insertBefore(indicator, afterElement);
        }
    }
}

// Handle drop
function handleDrop(e) {
    e.preventDefault();
    
    const afterElement = getDragAfterElement(e.clientY);
    const builderContainer = document.getElementById('blocks');
    
    if (draggedElement && builderContainer) {
        if (afterElement == null) {
            builderContainer.appendChild(draggedElement);
        } else {
            builderContainer.insertBefore(draggedElement, afterElement);
        }
    }
    
    // Remove drop indicators
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
}

// Get element after current drag position
function getDragAfterElement(y) {
    const builderContainer = document.getElementById('blocks');
    const draggableElements = [...builderContainer.querySelectorAll('.block:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Make functions globally available
window.showBlockLibrary = showBlockLibrary;
window.insertBlock = insertBlock;