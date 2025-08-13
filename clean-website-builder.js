// Clean, working Website Builder - no broken functionality
const CleanWebsiteBuilder = {
    currentDevice: 'desktop',
    currentElement: null,
    
    // Simple content storage per device
    content: {
        desktop: '<div style="padding: 40px; text-align: center;"><h1 class="wb-editable">Your Photography Portfolio</h1><p class="wb-editable" style="color: #666;">Click any text to edit</p></div>',
        tablet: '<div style="padding: 30px; text-align: center;"><h1 class="wb-editable">Tablet Portfolio</h1><p class="wb-editable" style="color: #666;">Tablet-optimized view</p></div>',
        mobile: '<div style="padding: 20px; text-align: center;"><h1 class="wb-editable" style="font-size: 24px;">Mobile Portfolio</h1><p class="wb-editable" style="color: #666;">Mobile-friendly design</p></div>'
    },

    init() {
        console.log('Initializing Clean Website Builder...');
        this.setupCanvas();
        this.setupEditing();
        this.loadContent();
    },

    setupCanvas() {
        const canvas = document.getElementById('wb-canvas');
        if (!canvas) return;
        
        canvas.innerHTML = this.content[this.currentDevice];
        this.setupEditing();
    },

    setupEditing() {
        const canvas = document.getElementById('wb-canvas');
        if (!canvas) return;

        // Simple click-to-edit functionality
        canvas.addEventListener('click', (e) => {
            if (e.target.classList.contains('wb-editable')) {
                this.editElement(e.target);
            }
        });
    },

    editElement(element) {
        const currentText = element.textContent;
        const newText = prompt('Edit text:', currentText);
        if (newText !== null && newText !== currentText) {
            element.textContent = newText;
            this.saveContent();
        }
    },

    switchDevice(device) {
        // Save current content
        this.saveContent();
        
        // Switch device
        this.currentDevice = device;
        
        // Update button states
        document.querySelectorAll('.wb-device-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.toLowerCase().includes(device)) {
                btn.classList.add('active');
            }
        });
        
        // Update canvas
        const canvas = document.getElementById('wb-canvas');
        if (canvas) {
            canvas.className = `wb-canvas ${device}`;
            canvas.innerHTML = this.content[device];
            this.setupEditing();
        }
        
        console.log(`Switched to ${device} view`);
    },

    saveContent() {
        const canvas = document.getElementById('wb-canvas');
        if (canvas) {
            this.content[this.currentDevice] = canvas.innerHTML;
            localStorage.setItem('clean-wb-content', JSON.stringify(this.content));
        }
    },

    loadContent() {
        const saved = localStorage.getItem('clean-wb-content');
        if (saved) {
            try {
                this.content = JSON.parse(saved);
                this.setupCanvas();
            } catch (e) {
                console.warn('Could not load saved content:', e);
            }
        }
    },

    addElement(type) {
        const canvas = document.getElementById('wb-canvas');
        if (!canvas) return;

        let html = '';
        switch(type) {
            case 'text':
                html = '<p class="wb-editable" style="padding: 20px; border: 1px dashed #ccc; margin: 10px 0;">Click to edit this text</p>';
                break;
            case 'image':
                html = '<img class="wb-editable" src="https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=400&h=300&fit=crop" style="width: 100%; max-width: 400px; height: auto; margin: 10px 0; border-radius: 8px;" alt="Click to change image">';
                break;
            case 'button':
                html = '<button class="wb-editable" style="background: #667eea; color: white; padding: 12px 24px; border: none; border-radius: 8px; margin: 10px 0; cursor: pointer;">Click to edit button</button>';
                break;
            default:
                html = '<div class="wb-editable" style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 10px 0;">New element - click to edit</div>';
        }

        canvas.insertAdjacentHTML('beforeend', html);
        this.setupEditing();
        this.saveContent();
    },

    clear() {
        if (confirm('Clear all content? This cannot be undone.')) {
            const canvas = document.getElementById('wb-canvas');
            if (canvas) {
                canvas.innerHTML = '<div style="padding: 40px; text-align: center;"><h1 class="wb-editable">Start Building</h1><p class="wb-editable" style="color: #666;">Add elements from the sidebar</p></div>';
                this.setupEditing();
                this.saveContent();
            }
        }
    },

    preview() {
        const canvas = document.getElementById('wb-canvas');
        if (!canvas) return;

        const previewWindow = window.open('', '_blank');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Photography Portfolio Preview</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
                    .wb-editable { border: none !important; }
                </style>
            </head>
            <body>
                ${canvas.innerHTML}
            </body>
            </html>
        `);
        previewWindow.document.close();
    },

    export() {
        const canvas = document.getElementById('wb-canvas');
        if (!canvas) return;

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Photography Portfolio</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .wb-editable { border: none !important; }
    </style>
</head>
<body>
    ${canvas.innerHTML}
</body>
</html>
        `;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'photography-website.html';
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CleanWebsiteBuilder.init());
} else {
    CleanWebsiteBuilder.init();
}

// Export for global access
window.CleanWebsiteBuilder = CleanWebsiteBuilder;