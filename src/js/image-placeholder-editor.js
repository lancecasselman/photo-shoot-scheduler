// Image Placeholder Editor System
// Provides click-to-edit functionality for all image placeholders in the website builder

/**
 * Initialize image placeholder editing functionality
 * Sets up click handlers and upload mechanisms for all image placeholders
 */
function initializeImagePlaceholderEditor() {
    setupImagePlaceholderClickHandlers();
    createImageUploadModal();
    console.log('Image placeholder editor system initialized');
}

/**
 * Sets up click handlers for all image placeholder containers
 * Allows users to click on placeholders to upload images
 */
function setupImagePlaceholderClickHandlers() {
    // Set up click handlers for existing placeholders
    updateImagePlaceholderHandlers();
    
    // Monitor for new placeholders added dynamically with throttling
    let observerTimeout;
    const observer = new MutationObserver(() => {
        clearTimeout(observerTimeout);
        observerTimeout = setTimeout(() => {
            updateImagePlaceholderHandlers();
        }, 100); // Throttle to prevent excessive updates
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Updates click handlers for all image placeholder containers
 * Called when new content is added to ensure all placeholders are editable
 */
function updateImagePlaceholderHandlers() {
    const placeholders = document.querySelectorAll('.image-placeholder-container:not([data-handlers-added])');
    
    placeholders.forEach(placeholder => {
        // Mark as processed to avoid duplicate handlers
        placeholder.setAttribute('data-handlers-added', 'true');
        
        // Add click handler
        placeholder.addEventListener('click', handlePlaceholderClick);
        
        // Add hover effects
        placeholder.addEventListener('mouseenter', () => {
            if (!placeholder.classList.contains('has-image')) {
                placeholder.style.borderColor = '#007bff';
                placeholder.style.background = '#f8f9ff';
            }
        });
        
        placeholder.addEventListener('mouseleave', () => {
            if (!placeholder.classList.contains('has-image')) {
                placeholder.style.borderColor = '#ddd';
                placeholder.style.background = '#f8f8f8';
            }
        });
    });
    
    if (placeholders.length > 0) {
        console.log(`Added handlers to ${placeholders.length} new image placeholders`);
    }
}

/**
 * Handles clicks on image placeholder containers
 * Triggers image upload/selection process
 * @param {Event} event - The click event
 */
function handlePlaceholderClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const placeholder = event.currentTarget;
    showImageUploadModal(placeholder);
}

/**
 * Global function to trigger image upload (used in template HTML)
 * @param {HTMLElement} placeholder - The placeholder element clicked
 */
window.triggerImageUpload = function(placeholder) {
    showImageUploadModal(placeholder);
};

/**
 * Creates the image upload modal dialog
 * Provides options for uploading from device or selecting from gallery
 */
function createImageUploadModal() {
    const modal = document.createElement('div');
    modal.id = 'imageUploadModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        z-index: 10004;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="background: white; border-radius: 12px; max-width: 500px; width: 90%; padding: 30px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 20px; color: #333;">Add Photo</h3>
                <button id="closeImageModal" style="background: none; border: none; font-size: 24px; color: #999; cursor: pointer; padding: 5px;">×</button>
            </div>
            
            <div class="upload-options" style="display: flex; flex-direction: column; gap: 15px;">
                <button id="uploadFromDevice" style="padding: 15px 20px; background: #007bff; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    Upload from Device
                </button>
                
                <button id="selectFromGallery" style="padding: 15px 20px; background: #28a745; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    Select from Gallery
                </button>
                
                <div id="removeImageSection" style="display: none; padding-top: 15px; border-top: 1px solid #eee;">
                    <button id="removeImage" style="padding: 12px 20px; background: #dc3545; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; width: 100%;">
                        Remove Current Image
                    </button>
                </div>
            </div>
        </div>
        
        <input type="file" id="imageFileUpload" accept="image/*" style="display: none;">
    `;
    
    document.body.appendChild(modal);
    setupImageUploadModalEvents(modal);
}

/**
 * Sets up event listeners for the image upload modal
 * @param {HTMLElement} modal - The modal element
 */
function setupImageUploadModalEvents(modal) {
    const closeBtn = modal.querySelector('#closeImageModal');
    const uploadBtn = modal.querySelector('#uploadFromDevice');
    const galleryBtn = modal.querySelector('#selectFromGallery');
    const removeBtn = modal.querySelector('#removeImage');
    const fileInput = modal.querySelector('#imageFileUpload');
    
    let currentPlaceholder = null;
    
    // Close modal
    closeBtn.addEventListener('click', () => hideImageUploadModal());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideImageUploadModal();
    });
    
    // Upload from device
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && currentPlaceholder) {
            handleImageUpload(file, currentPlaceholder);
        }
    });
    
    // Select from gallery (integrate with existing gallery system)
    galleryBtn.addEventListener('click', () => {
        // Try to integrate with existing image upload system
        if (typeof window.showImageGallery === 'function') {
            window.showImageGallery((selectedImage) => {
                if (selectedImage && currentPlaceholder) {
                    setPlaceholderImage(currentPlaceholder, selectedImage);
                    hideImageUploadModal();
                }
            });
        } else {
            alert('Gallery feature not available. Please use device upload.');
        }
    });
    
    // Remove image
    removeBtn.addEventListener('click', () => {
        if (currentPlaceholder) {
            removePlaceholderImage(currentPlaceholder);
            hideImageUploadModal();
        }
    });
    
    // Store reference to update current placeholder
    modal.getCurrentPlaceholder = () => currentPlaceholder;
    modal.setCurrentPlaceholder = (placeholder) => {
        currentPlaceholder = placeholder;
        
        // Show/hide remove button based on whether image exists
        const removeSection = modal.querySelector('#removeImageSection');
        const hasImage = placeholder.classList.contains('has-image');
        removeSection.style.display = hasImage ? 'block' : 'none';
    };
}

/**
 * Shows the image upload modal for a specific placeholder
 * @param {HTMLElement} placeholder - The placeholder element to edit
 */
function showImageUploadModal(placeholder) {
    const modal = document.getElementById('imageUploadModal');
    if (!modal) {
        console.error('Image upload modal not found');
        return;
    }
    
    modal.setCurrentPlaceholder(placeholder);
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Hides the image upload modal
 */
function hideImageUploadModal() {
    const modal = document.getElementById('imageUploadModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Reset file input
        const fileInput = modal.querySelector('#imageFileUpload');
        if (fileInput) fileInput.value = '';
    }
}

/**
 * Handles image file upload and processing
 * @param {File} file - The uploaded image file
 * @param {HTMLElement} placeholder - The placeholder to update
 */
function handleImageUpload(file, placeholder) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
    }
    
    // Create image URL
    const imageUrl = URL.createObjectURL(file);
    
    // Set the image in the placeholder
    setPlaceholderImage(placeholder, imageUrl);
    
    // Try to upload to server if upload system is available
    if (typeof window.uploadImageToServer === 'function') {
        window.uploadImageToServer(file)
            .then(result => {
                if (result && result.downloadURL) {
                    // Use the server download URL for the image
                    setPlaceholderImage(placeholder, result.downloadURL);
                    console.log('Image uploaded to server:', result);
                } else if (result && typeof result === 'string') {
                    // Handle string URL response
                    setPlaceholderImage(placeholder, result);
                }
            })
            .catch(error => {
                console.warn('Server upload failed, using local URL:', error);
            });
    }
    
    hideImageUploadModal();
}

/**
 * Sets an image in a placeholder container
 * @param {HTMLElement} placeholder - The placeholder container
 * @param {string} imageUrl - The URL of the image to set
 */
function setPlaceholderImage(placeholder, imageUrl) {
    const placeholderContent = placeholder.querySelector('.placeholder-content');
    const uploadedImage = placeholder.querySelector('.uploaded-image');
    
    if (placeholderContent && uploadedImage) {
        // Hide placeholder content and show image
        placeholderContent.style.display = 'none';
        uploadedImage.src = imageUrl;
        uploadedImage.style.display = 'block';
        
        // Update placeholder styling
        placeholder.classList.add('has-image');
        placeholder.style.border = 'none';
        placeholder.style.background = 'transparent';
        
        // Add edit overlay on hover
        addImageEditOverlay(placeholder);
        
        console.log('Image set in placeholder:', imageUrl);
    }
}

/**
 * Removes an image from a placeholder container
 * @param {HTMLElement} placeholder - The placeholder container
 */
function removePlaceholderImage(placeholder) {
    const placeholderContent = placeholder.querySelector('.placeholder-content');
    const uploadedImage = placeholder.querySelector('.uploaded-image');
    
    if (placeholderContent && uploadedImage) {
        // Show placeholder content and hide image
        placeholderContent.style.display = 'block';
        uploadedImage.src = '';
        uploadedImage.style.display = 'none';
        
        // Reset placeholder styling
        placeholder.classList.remove('has-image');
        placeholder.style.border = '2px dashed #ddd';
        placeholder.style.background = '#f8f8f8';
        
        // Remove edit overlay
        const overlay = placeholder.querySelector('.image-edit-overlay');
        if (overlay) overlay.remove();
        
        console.log('Image removed from placeholder');
    }
}

/**
 * Adds an edit overlay to image placeholders with images
 * @param {HTMLElement} placeholder - The placeholder container
 */
function addImageEditOverlay(placeholder) {
    // Remove existing overlay
    const existingOverlay = placeholder.querySelector('.image-edit-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    // Create edit overlay
    const overlay = document.createElement('div');
    overlay.className = 'image-edit-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: none;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
    `;
    
    overlay.innerHTML = `
        <div style="text-align: center; color: white;">
            <div style="font-size: 20px; margin-bottom: 8px; font-weight: bold;">EDIT</div>
            <div style="font-size: 14px; font-weight: 600;">Click to Change Photo</div>
        </div>
    `;
    
    // Show overlay on hover
    placeholder.addEventListener('mouseenter', () => {
        if (placeholder.classList.contains('has-image')) {
            overlay.style.display = 'flex';
        }
    });
    
    placeholder.addEventListener('mouseleave', () => {
        overlay.style.display = 'none';
    });
    
    // Click overlay to edit
    overlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showImageUploadModal(placeholder);
    });
    
    placeholder.appendChild(overlay);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeImagePlaceholderEditor, 100);
});

// Make functions available globally
window.imagePlaceholderAPI = {
    initializeImagePlaceholderEditor,
    updateImagePlaceholderHandlers,
    setPlaceholderImage,
    removePlaceholderImage,
    showImageUploadModal,
    hideImageUploadModal
};