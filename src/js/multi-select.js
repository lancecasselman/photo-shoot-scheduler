// Multi-block selection functionality

let selectedBlocks = new Set();
let isMultiSelecting = false;

document.addEventListener('DOMContentLoaded', () => {
    initializeMultiSelect();
});

function initializeMultiSelect() {
    const blocksContainer = document.getElementById('blocks');
    if (!blocksContainer) return;
    
    // Add event listeners
    blocksContainer.addEventListener('click', handleBlockClick);
    document.addEventListener('keydown', handleKeyDown);
    
    // Clear selection when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#blocks')) {
            clearSelection();
        }
    });
}

function handleBlockClick(e) {
    const block = e.target.closest('.block');
    if (!block) return;
    
    // Shift+click for multi-selection
    if (e.shiftKey) {
        e.preventDefault();
        toggleBlockSelection(block);
    } else if (!e.ctrlKey && !e.metaKey) {
        // Single selection (clear others)
        if (!selectedBlocks.has(block)) {
            clearSelection();
            selectBlock(block);
        }
    } else {
        // Ctrl+click for adding to selection
        e.preventDefault();
        toggleBlockSelection(block);
    }
}

function handleKeyDown(e) {
    // Delete selected blocks
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBlocks.size > 0) {
            e.preventDefault();
            deleteSelectedBlocks();
        }
    }
    
    // Select all blocks
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAllBlocks();
    }
    
    // Escape to clear selection
    if (e.key === 'Escape') {
        clearSelection();
    }
}

function selectBlock(block) {
    selectedBlocks.add(block);
    block.classList.add('multi-selected');
    updateSelectionUI();
}

function deselectBlock(block) {
    selectedBlocks.delete(block);
    block.classList.remove('multi-selected');
    updateSelectionUI();
}

function toggleBlockSelection(block) {
    if (selectedBlocks.has(block)) {
        deselectBlock(block);
    } else {
        selectBlock(block);
    }
}

function clearSelection() {
    selectedBlocks.forEach(block => {
        block.classList.remove('multi-selected');
    });
    selectedBlocks.clear();
    updateSelectionUI();
}

function selectAllBlocks() {
    const blocks = document.querySelectorAll('#blocks .block');
    clearSelection();
    blocks.forEach(block => selectBlock(block));
}

function deleteSelectedBlocks() {
    if (selectedBlocks.size === 0) return;
    
    const confirmed = confirm(`Delete ${selectedBlocks.size} selected block(s)?`);
    if (!confirmed) return;
    
    selectedBlocks.forEach(block => {
        block.remove();
    });
    
    selectedBlocks.clear();
    updateSelectionUI();
    
    // Save state for undo/redo
    if (typeof saveUndoState === 'function') {
        saveUndoState();
    }
}

function updateSelectionUI() {
    // You can add UI updates here, like showing a selection count
    console.log(`${selectedBlocks.size} blocks selected`);
}

// Group operations for selected blocks
function moveSelectedBlocks(direction) {
    if (selectedBlocks.size === 0) return;
    
    const blocksContainer = document.getElementById('blocks');
    const allBlocks = Array.from(blocksContainer.children);
    const selectedArray = Array.from(selectedBlocks);
    
    // Sort selected blocks by their current position
    selectedArray.sort((a, b) => allBlocks.indexOf(a) - allBlocks.indexOf(b));
    
    if (direction === 'up') {
        selectedArray.forEach(block => {
            const prevBlock = block.previousElementSibling;
            if (prevBlock && !selectedBlocks.has(prevBlock)) {
                blocksContainer.insertBefore(block, prevBlock);
            }
        });
    } else if (direction === 'down') {
        selectedArray.reverse().forEach(block => {
            const nextBlock = block.nextElementSibling;
            if (nextBlock && !selectedBlocks.has(nextBlock)) {
                blocksContainer.insertBefore(nextBlock, block);
            }
        });
    }
    
    // Save state for undo/redo
    if (typeof saveUndoState === 'function') {
        saveUndoState();
    }
}

// Export functions for use by other modules
window.initializeMultiSelect = initializeMultiSelect;
window.getSelectedBlocks = () => Array.from(selectedBlocks);
window.clearBlockSelection = clearSelection;