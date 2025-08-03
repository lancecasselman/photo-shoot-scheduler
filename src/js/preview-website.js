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
    const navLabels = navigationLabels || {};
    
    // Generate navigation HTML
    const navigationHTML = navOrder.map(pageId => {
        const label = navLabels[pageId] || pagesData[pageId]?.name || pageId;
        return `<a href="#" onclick="showPage('${pageId}')" class="nav-link" data-page="${pageId}">${label}</a>`;
    }).join('');
    
    // Generate navigation HTML
    const navigationHTML = navOrder.map(pageId => {
        const label = navLabels[pageId] || pagesData[pageId]?.name || pageId;
        return `<a href="#" onclick="showPage('${pageId}')" class="nav-link" data-page="${pageId}">${label}</a>`;
    }).join('');
    
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
        
        /* Navigation Styles */
        .preview-navigation {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid #eee;
            padding: 1rem 2rem;
            display: flex;
            justify-content: center;
            gap: 2rem;
            z-index: 1000;
        }
        
        .nav-link {
            text-decoration: none;
            color: #333;
            font-weight: 500;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            transition: all 0.3s ease;
            cursor: pointer;
        }
        
        .nav-link:hover {
            background: #f5f5f5;
            color: #007bff;
        }
        
        .nav-link.active {
            background: #007bff;
            color: white;
        }
        
        /* Content Styles */
        .preview-content {
            margin-top: 80px;
        }
        
        .page-content {
            min-height: calc(100vh - 80px);
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
            .preview-navigation {
                padding: 1rem;
                gap: 1rem;
                flex-wrap: wrap;
            }
            
            .nav-link {
                padding: 0.4rem 0.8rem;
                font-size: 0.9rem;
            }
            
            .nav-link {
                padding: 0.4rem 0.8rem;
                font-size: 0.9rem;
            }
            
            .preview-content {
                margin-top: 100px;
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
    <nav class="preview-navigation">
        ${navigationHTML}
    </nav>
    
    <div class="preview-content">
        ${pagesHTML}
    </div>
    
    <script>
        let currentPageId = '${navOrder[0] || 'home'}';
        
        function showPage(pageId) {
            // Hide all pages
            document.querySelectorAll('.page-content').forEach(page => {
                page.style.display = 'none';
            });
            
            // Show selected page
            const targetPage = document.getElementById('page-' + pageId);
            if (targetPage) {
                targetPage.style.display = 'block';
                currentPageId = pageId;
            }
            
            // Update navigation
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            
            const activeLink = document.querySelector('.nav-link[data-page="' + pageId + '"]');
            if (activeLink) {
                activeLink.classList.add('active');
            }
            
            // Scroll to top
            window.scrollTo(0, 0);
        }
        
        // Initialize navigation and button functionality
        document.addEventListener('DOMContentLoaded', function() {
            // Set first nav item as active
            const firstNavLink = document.querySelector('.nav-link');
            if (firstNavLink) {
                firstNavLink.classList.add('active');
            }
            
            // Make buttons functional with navigation and visual feedback
            document.querySelectorAll('button').forEach(button => {
                if (!button.onclick) {
                    button.addEventListener('click', function(e) {
                        e.preventDefault();
                        
                        // Check for navigation keywords in button text
                        const buttonText = this.textContent.toLowerCase();
                        
                        if (buttonText.includes('portfolio') || buttonText.includes('gallery') || buttonText.includes('view') && buttonText.includes('work')) {
                            showPage('portfolio');
                        } else if (buttonText.includes('about')) {
                            showPage('about');
                        } else if (buttonText.includes('contact')) {
                            showPage('contact');
                        } else if (buttonText.includes('package') || buttonText.includes('pricing')) {
                            showPage('packages');
                        } else if (buttonText.includes('home')) {
                            showPage('home');
                        } else {
                            // Generic button feedback for non-navigation buttons
                            this.style.transform = 'scale(0.95)';
                            setTimeout(() => {
                                this.style.transform = '';
                            }, 150);
                        }
                        
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