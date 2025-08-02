// Undo/Redo functionality for the Website Builder

let undoStack = [];
let redoStack = [];
const MAX_UNDO_HISTORY = 50;

document.addEventListener('DOMContentLoaded', () => {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Save initial state
    saveState();
    updateUndoRedoButtons();
});

function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
            e.preventDefault();
            redo();
        }
    }
}

function saveState() {
    const blocksContainer = document.getElementById('blocks');
    if (!blocksContainer) return;
    
    const state = {
        html: blocksContainer.innerHTML,
        timestamp: Date.now()
    };
    
    // Don't save if the state is identical to the last one
    if (undoStack.length > 0) {
        const lastState = undoStack[undoStack.length - 1];
        if (lastState.html === state.html) return;
    }
    
    undoStack.push(state);
    
    // Limit stack size
    if (undoStack.length > MAX_UNDO_HISTORY) {
        undoStack.shift();
    }
    
    // Clear redo stack when new action is performed
    redoStack = [];
    
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length <= 1) return; // Keep at least one state
    
    const currentState = undoStack.pop();
    redoStack.push(currentState);
    
    const previousState = undoStack[undoStack.length - 1];
    if (previousState) {
        restoreState(previousState);
    }
    
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack.pop();
    undoStack.push(nextState);
    
    restoreState(nextState);
    updateUndoRedoButtons();
}

function restoreState(state) {
    const blocksContainer = document.getElementById('blocks');
    if (!blocksContainer) return;
    
    blocksContainer.innerHTML = state.html;
    
    // Re-initialize drag and drop for restored blocks
    if (typeof setupDragAndDrop === 'function') {
        setupDragAndDrop();
    }
    
    // Re-initialize image resize handles
    if (typeof initializeImageResize === 'function') {
        initializeImageResize();
    }
    
    // Re-initialize multi-selection
    if (typeof initializeMultiSelect === 'function') {
        initializeMultiSelect();
    }
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
        undoBtn.disabled = undoStack.length <= 1;
    }
    
    if (redoBtn) {
        redoBtn.disabled = redoStack.length === 0;
    }
}

// Export functions for use by other modules
window.saveUndoState = saveState;
window.clearUndoRedo = function() {
    undoStack = [];
    redoStack = [];
    saveState();
};