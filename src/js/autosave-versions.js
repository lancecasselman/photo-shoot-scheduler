// Autosave and Version History functionality
let autosaveInterval = null;
let currentLayoutId = null;
let autosaveEnabled = false;

// Initialize autosave functionality
document.addEventListener('DOMContentLoaded', () => {
    const autosaveToggle = document.getElementById('autosaveToggle');
    const viewVersionsBtn = document.getElementById('viewVersions');
    const closeVersionsBtn = document.getElementById('closeVersions');
    
    // Autosave toggle handler
    autosaveToggle.addEventListener('change', (e) => {
        autosaveEnabled = e.target.checked;
        
        if (autosaveEnabled) {
            startAutosave();
            console.log('Autosave enabled - saving every 30 seconds');
        } else {
            stopAutosave();
            console.log('Autosave disabled');
        }
    });
    
    // View versions button handler
    viewVersionsBtn.addEventListener('click', showVersionHistory);
    
    // Close versions modal handler
    closeVersionsBtn.addEventListener('click', closeVersionModal);
    
    // Close modal when clicking outside
    document.getElementById('versionModal').addEventListener('click', (e) => {
        if (e.target.id === 'versionModal') {
            closeVersionModal();
        }
    });
});

// Start autosave interval
function startAutosave() {
    stopAutosave(); // Clear any existing interval
    
    autosaveInterval = setInterval(() => {
        if (autosaveEnabled && currentLayoutId) {
            performAutosave();
        }
    }, 30000); // 30 seconds
}

// Stop autosave interval
function stopAutosave() {
    if (autosaveInterval) {
        clearInterval(autosaveInterval);
        autosaveInterval = null;
    }
}

// Perform autosave operation
async function performAutosave() {
    try {
        const builderContainer = document.getElementById('blocks');
        
        if (!builderContainer) {
            console.warn('Builder container not found for autosave');
            return;
        }
        
        // Capture the complete layout HTML
        const layout = builderContainer.innerHTML;
        
        // Skip autosave if no content
        if (!layout.trim()) {
            return;
        }
        
        const payload = {
            layoutId: currentLayoutId,
            layout: layout,
            createdAt: new Date()
        };
        
        const response = await fetch('/api/save-version', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Autosave successful:', result.versionId);
        
        // Visual indicator of autosave
        showAutosaveIndicator();
        
    } catch (error) {
        console.error('Autosave failed:', error);
    }
}

// Show visual autosave indicator
function showAutosaveIndicator() {
    const toggle = document.getElementById('autosaveToggle');
    const label = toggle.parentElement;
    const originalText = label.textContent;
    
    label.style.color = '#27ae60';
    label.textContent = '✓ Auto-saved';
    
    setTimeout(() => {
        label.style.color = '';
        label.textContent = originalText;
    }, 2000);
}

// Set current layout ID (called from save-layout.js)
function setCurrentLayoutId(layoutId) {
    currentLayoutId = layoutId;
    console.log('Current layout ID set:', layoutId);
}

// Show version history modal
async function showVersionHistory() {
    if (!currentLayoutId) {
        alert('Please save a layout first to view its version history.');
        return;
    }
    
    try {
        const response = await fetch(`/api/versions/${currentLayoutId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const versions = await response.json();
        displayVersions(versions);
        
    } catch (error) {
        console.error('Failed to load versions:', error);
        alert('Failed to load version history.');
    }
}

// Display versions in modal
function displayVersions(versions) {
    const versionList = document.getElementById('versionList');
    const versionModal = document.getElementById('versionModal');
    
    versionList.innerHTML = '';
    
    if (versions.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No versions found.';
        li.style.fontStyle = 'italic';
        versionList.appendChild(li);
    } else {
        versions.forEach((version, index) => {
            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            li.style.padding = '12px';
            li.style.margin = '8px 0';
            li.style.border = '1px solid #ddd';
            li.style.borderRadius = '6px';
            li.style.backgroundColor = '#f9f9f9';
            
            const createdAt = new Date(version.createdAt);
            const timeAgo = getTimeAgo(createdAt);
            
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>Version ${versions.length - index}</strong><br>
                        <small>${createdAt.toLocaleString()}</small><br>
                        <small style="color: #666;">${timeAgo}</small>
                    </div>
                    <button onclick="revertToVersion('${version.id}')" style="
                        background: #3498db; 
                        color: white; 
                        border: none; 
                        padding: 6px 12px; 
                        border-radius: 4px; 
                        cursor: pointer;
                    ">Revert</button>
                </div>
            `;
            
            li.addEventListener('mouseenter', () => {
                li.style.backgroundColor = '#e6f3ff';
            });
            
            li.addEventListener('mouseleave', () => {
                li.style.backgroundColor = '#f9f9f9';
            });
            
            versionList.appendChild(li);
        });
    }
    
    versionModal.style.display = 'flex';
}

// Close version modal
function closeVersionModal() {
    document.getElementById('versionModal').style.display = 'none';
}

// Revert to a specific version
async function revertToVersion(versionId) {
    if (!confirm('Are you sure you want to revert to this version? This will replace your current work.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/version/${versionId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const versionData = await response.json();
        const builderContainer = document.getElementById('blocks');
        
        if (!builderContainer) {
            alert('Builder container not found!');
            return;
        }
        
        // Load the version content
        builderContainer.innerHTML = versionData.layout;
        
        // Ensure all blocks are editable
        const loadedBlocks = builderContainer.querySelectorAll('.block');
        loadedBlocks.forEach(block => {
            if (!block.hasAttribute('contenteditable')) {
                block.contentEditable = "true";
            }
        });
        
        closeVersionModal();
        alert('Version restored successfully!');
        console.log('Reverted to version:', versionId);
        
    } catch (error) {
        console.error('Failed to revert version:', error);
        alert('Failed to revert to version.');
    }
}

// Helper function to get relative time
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Make revertToVersion globally accessible
window.revertToVersion = revertToVersion;