// Website Preview functionality
// Opens a new window with an uneditable version of the multi-page website

document.addEventListener('DOMContentLoaded', function() {
    const previewButton = document.getElementById('previewWebsite');
    if (previewButton) {
        previewButton.addEventListener('click', openPreview);
    }
});

function openPreview() {
    try {
        // Generate the complete website HTML
        const websiteHTML = generatePreviewHTML();
        
        // Open new window
        const previewWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
        
        if (previewWindow) {
            previewWindow.document.write(websiteHTML);
            previewWindow.document.close();
            
            // Set the title
            previewWindow.document.title = 'Website Preview';
            
            console.log('Website preview opened successfully');
        } else {
            alert('Unable to open preview window. Please check your browser\'s popup blocker settings.');
        }
        
    } catch (error) {
        console.error('Error opening preview:', error);
        alert('Error opening preview. Please try again.');
    }
}

function generatePreviewHTML() {
    // Get current font
    const fontFamily = currentFont || 'Inter';
    const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}:wght@300;400;500;600;700&display=swap`;
    
    // Get all pages data
    const pagesData = pages || {};
    const navOrder = navigationOrder || Object.keys(pagesData);
    
    // Generate pages HTML
    const pagesHTML = Object.entries(pagesData).map(([pageId, pageData]) => {
        // Clean the content - remove contenteditable and other editing attributes
        let cleanContent = pageData.content || '';
        cleanContent = cleanContent.replace(/contenteditable="[^"]*"/g, '');
        cleanContent = cleanContent.replace(/onclick="[^"]*"/g, '');
        cleanContent = cleanContent.replace(/data-block-[^=]*="[^"]*"/g, '');
        cleanContent = cleanContent.replace(/class="([^"]*?)\s*(selected|editing|block-selected)(\s[^"]*)?"/g, 'class="$1$3"');
        
        return `
            <div id="page-${pageId}" class="page-content" style="display: ${pageId === navOrder[0] ? 'block' : 'none'}">
                ${cleanContent}
            </div>
        `;
    }).join('');
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website Preview</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${fontUrl}" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: '${fontFamily}', sans-serif;
            line-height: 1.6;
            color: #333;
        }
        
        /* Content Styles */
        .preview-content {
            margin-top: 0;
        }
        
        .page-content {
            min-height: 100vh;
        }
        
        /* Make buttons and links functional */
        button {
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        button:hover {
            opacity: 0.8;
            transform: translateY(-1px);
        }
        
        /* Image styles */
        img {
            max-width: 100%;
            height: auto;
        }
        
        .uploaded-image {
            display: block !important;
        }
        
        .image-placeholder-container {
            display: none !important;
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            .preview-content {
                margin-top: 0;
            }
        }
        
        /* Hide editing elements */
        .block-toolbar,
        .text-toolbar,
        .editing-indicator,
        .drag-handle {
            display: none !important;
        }
        
        /* Ensure proper block styling */
        .block {
            position: relative;
        }
    </style>
</head>
<body>
    <div class="preview-content">
        ${pagesHTML}
    </div>
    
    <script>
        // Make buttons functional with visual feedback
        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('button').forEach(button => {
                if (!button.onclick) {
                    button.addEventListener('click', function(e) {
                        e.preventDefault();
                        
                        // Visual button feedback
                        this.style.transform = 'scale(0.95)';
                        setTimeout(() => {
                            this.style.transform = '';
                        }, 150);
                        
                        console.log('Button clicked:', this.textContent);
                    });
                }
            });
        });
    </script>
</body>
</html>
    `;
}