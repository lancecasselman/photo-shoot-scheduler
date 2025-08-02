// Multi-page Website Builder functionality

let currentPageId = 'home';
let pages = {};
let navigationOrder = ['home'];
let navigationLabels = { 'home': 'Home' };

// Initialize multi-page functionality
document.addEventListener('DOMContentLoaded', () => {
    initializeMultiPage();
    setupEventListeners();
});

function initializeMultiPage() {
    // Initialize with default home page
    pages[currentPageId] = {
        id: 'home',
        name: 'Home',
        content: '',
        lastModified: new Date().toISOString()
    };
    
    // Load existing pages if any
    loadMultiPageData();
    
    // Update UI
    updatePageList();
    updateNavList();
    
    console.log('Multi-page system initialized');
}

function setupEventListeners() {
    // Add page button
    document.getElementById('addPageBtn').addEventListener('click', addNewPage);
    
    // Add nav item button
    document.getElementById('addNavBtn').addEventListener('click', addNavItem);
    
    // Page list delegation
    document.getElementById('pageList').addEventListener('click', handlePageAction);
    
    // Nav list delegation
    document.getElementById('navList').addEventListener('click', handleNavAction);
    
    // Update save and export functions to handle multi-page
    const originalSave = window.saveLayout;
    window.saveLayout = saveMultiPageLayout;
    
    // Override zip export for multi-page
    const originalZipExport = window.exportAsZip;
    if (originalZipExport) {
        window.exportAsZip = exportMultiPageZip;
    }
}

function addNewPage() {
    const pageName = prompt('Enter page name:');
    if (!pageName || pageName.trim() === '') return;
    
    const pageId = generatePageId(pageName);
    
    // Create new page
    pages[pageId] = {
        id: pageId,
        name: pageName.trim(),
        content: '',
        lastModified: new Date().toISOString()
    };
    
    // Add to navigation by default
    navigationOrder.push(pageId);
    navigationLabels[pageId] = pageName.trim();
    
    // Update UI
    updatePageList();
    updateNavList();
    
    // Switch to new page
    switchToPage(pageId);
    
    console.log('Added new page:', pageName);
}

function addNavItem() {
    // Show available pages that aren't in nav yet
    const availablePages = Object.keys(pages).filter(id => !navigationOrder.includes(id));
    
    if (availablePages.length === 0) {
        alert('All pages are already in navigation');
        return;
    }
    
    const pageId = availablePages[0]; // For now, add the first available
    const label = prompt('Enter navigation label:', pages[pageId].name);
    
    if (!label || label.trim() === '') return;
    
    navigationOrder.push(pageId);
    navigationLabels[pageId] = label.trim();
    
    updateNavList();
    console.log('Added nav item:', label);
}

function handlePageAction(e) {
    const pageItem = e.target.closest('.page-item');
    if (!pageItem) return;
    
    const pageId = pageItem.dataset.pageId;
    
    if (e.target.classList.contains('edit-page')) {
        editPageName(pageId);
    } else if (e.target.classList.contains('delete-page')) {
        deletePage(pageId);
    } else {
        // Click on page item - switch to page
        switchToPage(pageId);
    }
}

function handleNavAction(e) {
    const navItem = e.target.closest('.nav-item');
    if (!navItem) return;
    
    const pageId = navItem.dataset.pageId;
    
    if (e.target.classList.contains('edit-nav')) {
        editNavLabel(pageId);
    } else if (e.target.classList.contains('move-up')) {
        moveNavItem(pageId, -1);
    } else if (e.target.classList.contains('move-down')) {
        moveNavItem(pageId, 1);
    }
}

function switchToPage(pageId) {
    if (!pages[pageId]) return;
    
    // Save current page content
    saveCurrentPageContent();
    
    // Switch to new page
    currentPageId = pageId;
    
    // Load page content
    loadPageContent(pageId);
    
    // Update UI
    updatePageList();
    
    console.log('Switched to page:', pages[pageId].name);
}

function saveCurrentPageContent() {
    if (pages[currentPageId]) {
        const blocksContainer = document.getElementById('blocks');
        pages[currentPageId].content = blocksContainer ? blocksContainer.innerHTML : '';
        pages[currentPageId].lastModified = new Date().toISOString();
    }
}

function loadPageContent(pageId) {
    if (!pages[pageId]) return;
    
    const blocksContainer = document.getElementById('blocks');
    if (blocksContainer) {
        blocksContainer.innerHTML = pages[pageId].content || '';
        
        // Reinitialize any dynamic functionality for loaded content
        if (typeof reinitializeBlocks === 'function') {
            reinitializeBlocks();
        }
    }
}

function editPageName(pageId) {
    const newName = prompt('Enter new page name:', pages[pageId].name);
    if (!newName || newName.trim() === '') return;
    
    pages[pageId].name = newName.trim();
    
    // Update nav label if it exists
    if (navigationLabels[pageId]) {
        navigationLabels[pageId] = newName.trim();
    }
    
    updatePageList();
    updateNavList();
}

function deletePage(pageId) {
    if (pageId === 'home') {
        alert('Cannot delete the Home page');
        return;
    }
    
    if (!confirm(`Delete page "${pages[pageId].name}"?`)) return;
    
    // Remove from pages
    delete pages[pageId];
    
    // Remove from navigation
    const navIndex = navigationOrder.indexOf(pageId);
    if (navIndex > -1) {
        navigationOrder.splice(navIndex, 1);
        delete navigationLabels[pageId];
    }
    
    // Switch to home if current page was deleted
    if (currentPageId === pageId) {
        switchToPage('home');
    }
    
    updatePageList();
    updateNavList();
}

function editNavLabel(pageId) {
    const newLabel = prompt('Enter navigation label:', navigationLabels[pageId]);
    if (!newLabel || newLabel.trim() === '') return;
    
    navigationLabels[pageId] = newLabel.trim();
    updateNavList();
}

function moveNavItem(pageId, direction) {
    const currentIndex = navigationOrder.indexOf(pageId);
    if (currentIndex === -1) return;
    
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= navigationOrder.length) return;
    
    // Swap items
    [navigationOrder[currentIndex], navigationOrder[newIndex]] = 
    [navigationOrder[newIndex], navigationOrder[currentIndex]];
    
    updateNavList();
}

function updatePageList() {
    const pageList = document.getElementById('pageList');
    if (!pageList) return;
    
    pageList.innerHTML = '';
    
    Object.values(pages).forEach(page => {
        const pageItem = document.createElement('div');
        pageItem.className = `page-item ${page.id === currentPageId ? 'active' : ''}`;
        pageItem.dataset.pageId = page.id;
        
        pageItem.innerHTML = `
            <span class="page-name">${page.name}</span>
            <div class="page-actions">
                <button class="edit-page" title="Edit Page">Edit</button>
                ${page.id !== 'home' ? '<button class="delete-page" title="Delete Page">×</button>' : ''}
            </div>
        `;
        
        pageList.appendChild(pageItem);
    });
}

function updateNavList() {
    const navList = document.getElementById('navList');
    if (!navList) return;
    
    navList.innerHTML = '';
    
    navigationOrder.forEach((pageId, index) => {
        if (!pages[pageId]) return;
        
        const navItem = document.createElement('div');
        navItem.className = 'nav-item';
        navItem.dataset.pageId = pageId;
        navItem.draggable = true;
        
        navItem.innerHTML = `
            <span class="nav-label">${navigationLabels[pageId] || pages[pageId].name}</span>
            <div class="nav-actions">
                <button class="edit-nav" title="Edit Label">Edit</button>
                ${index > 0 ? '<button class="move-up" title="Move Up">↑</button>' : ''}
                ${index < navigationOrder.length - 1 ? '<button class="move-down" title="Move Down">↓</button>' : ''}
            </div>
        `;
        
        navList.appendChild(navItem);
    });
}

function generatePageId(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'page';
}

// Enhanced save function for multi-page
function saveMultiPageLayout() {
    // Save current page content first
    saveCurrentPageContent();
    
    const layoutData = {
        pages: pages,
        navigationOrder: navigationOrder,
        navigationLabels: navigationLabels,
        currentPageId: currentPageId,
        type: 'multi-page',
        lastModified: new Date().toISOString()
    };
    
    // Use existing save functionality
    const layoutId = document.getElementById('layoutIdInput').value || `layout-${Date.now()}`;
    
    fetch('/api/layouts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            layoutId: layoutId,
            layoutData: layoutData
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Multi-page layout saved:', data);
        alert('Multi-page website saved successfully!');
    })
    .catch(error => {
        console.error('Save error:', error);
        alert('Failed to save layout');
    });
}

// Enhanced export function for multi-page
async function exportMultiPageZip() {
    console.log('Starting multi-page ZIP export');
    
    // Save current page content
    saveCurrentPageContent();
    
    const exportBtn = document.getElementById('exportZip');
    const originalText = exportBtn.textContent;
    
    try {
        exportBtn.disabled = true;
        exportBtn.textContent = 'Exporting...';
        
        // Prepare multi-page data
        const multiPageData = {
            pages: pages,
            navigationOrder: navigationOrder,
            navigationLabels: navigationLabels,
            selectedFont: document.getElementById('fontPicker').value,
            isDarkTheme: document.body.classList.contains('dark'),
            type: 'multi-page'
        };
        
        // Send to server for ZIP generation
        const response = await fetch('/api/export/multi-page-zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(multiPageData)
        });
        
        if (!response.ok) {
            throw new Error(`Export failed: ${response.status}`);
        }
        
        // Download the ZIP file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `multi-page-website-${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('Multi-page ZIP export completed');
        
    } catch (error) {
        console.error('Multi-page export failed:', error);
        alert('Export failed: ' + error.message);
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = originalText;
    }
}

function loadMultiPageData() {
    // Try to load existing multi-page data from storage or server
    // This would integrate with the existing load functionality
    
    const layoutId = document.getElementById('layoutIdInput').value;
    if (!layoutId) return;
    
    fetch(`/api/layouts/load/${layoutId}`)
        .then(response => response.json())
        .then(data => {
            if (data.type === 'multi-page') {
                pages = data.pages || { 'home': { id: 'home', name: 'Home', content: '' } };
                navigationOrder = data.navigationOrder || ['home'];
                navigationLabels = data.navigationLabels || { 'home': 'Home' };
                currentPageId = data.currentPageId || 'home';
                
                updatePageList();
                updateNavList();
                loadPageContent(currentPageId);
                
                console.log('Multi-page data loaded');
            }
        })
        .catch(error => console.error('Load error:', error));
}

// Make functions available globally
window.switchToPage = switchToPage;
window.saveMultiPageLayout = saveMultiPageLayout;
window.exportMultiPageZip = exportMultiPageZip;