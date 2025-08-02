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
    
    // Add animation
    blockElement.classList.add('new');
    setTimeout(() => blockElement.classList.remove('new'), 300);
    
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
}

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