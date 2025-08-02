// ZIP Export functionality for Website Builder

document.addEventListener('DOMContentLoaded', () => {
    const exportZipBtn = document.getElementById('exportZip');
    if (exportZipBtn) {
        exportZipBtn.addEventListener('click', exportAsZip);
    }
});

async function exportAsZip() {
    const exportBtn = document.getElementById('exportZip');
    const originalText = exportBtn.textContent;
    
    try {
        exportBtn.disabled = true;
        exportBtn.textContent = 'Exporting...';
        
        // Get current layout data
        const layoutData = await prepareLayoutData();
        
        console.log('Sending layout data to server for ZIP generation');
        
        // Send to server for ZIP generation
        const response = await fetch('/api/export/zip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(layoutData)
        });
        
        if (!response.ok) {
            throw new Error(`Export failed: ${response.status} - ${response.statusText}`);
        }
        
        // Download the ZIP file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `website-${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('ZIP export completed successfully');
        
    } catch (error) {
        console.error('ZIP export failed:', error);
        alert('Export failed: ' + error.message);
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = originalText;
    }
}

async function prepareLayoutData() {
    const blocksContainer = document.getElementById('blocks');
    const fontPicker = document.getElementById('fontPicker');
    
    if (!blocksContainer) {
        throw new Error('Blocks container not found');
    }
    
    // Get current HTML content
    const html = blocksContainer.innerHTML;
    
    // Get selected font
    const selectedFont = fontPicker ? fontPicker.value : 'Inter';
    
    // Extract image URLs from the layout
    const imageUrls = extractImageUrls(html);
    
    // Get current theme (light/dark)
    const isDarkTheme = document.body.classList.contains('dark');
    
    return {
        html: html,
        selectedFont: selectedFont,
        imageUrls: imageUrls,
        isDarkTheme: isDarkTheme,
        timestamp: new Date().toISOString()
    };
}

function extractImageUrls(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const images = tempDiv.querySelectorAll('img');
    const imageUrls = [];
    
    images.forEach(img => {
        if (img.src && img.src.startsWith(window.location.origin)) {
            // Convert absolute URLs to relative paths
            const relativePath = img.src.replace(window.location.origin, '');
            imageUrls.push(relativePath);
        }
    });
    
    return imageUrls;
}