// Enhanced block creation and editing functionality
document.addEventListener('DOMContentLoaded', () => {
    const addBlockBtn = document.getElementById('addBlock');
    const toggleThemeBtn = document.getElementById('toggleTheme');
    const blocksContainer = document.getElementById('blocks');

    // Add Block functionality with drag-and-drop support
    addBlockBtn.addEventListener('click', () => {
        const newBlock = document.createElement('div');
        newBlock.className = 'block';
        newBlock.contentEditable = 'true';
        newBlock.draggable = true;
        newBlock.innerHTML = '<h2>New Section</h2><p>Click to edit...</p>';
        
        // Add drag event listeners if setupBlockDragEvents is available
        if (typeof setupBlockDragEvents === 'function') {
            setupBlockDragEvents(newBlock);
        }
        
        blocksContainer.appendChild(newBlock);
        
        // Add animation
        newBlock.classList.add('new');
        setTimeout(() => newBlock.classList.remove('new'), 300);
        
        // Focus on the new block
        newBlock.focus();
        
        // Save state for undo/redo
        if (typeof saveUndoState === 'function') {
            setTimeout(() => saveUndoState(), 200);
        }
        
        console.log('New block added with drag-and-drop support');
    });

    // Theme toggle functionality
    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            console.log('Theme toggled');
        });
    }

    // Make existing blocks draggable on page load
    setTimeout(() => {
        if (typeof setupDragAndDrop === 'function') {
            setupDragAndDrop();
        }
    }, 100);
});