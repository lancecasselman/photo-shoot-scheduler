// Image Upload Functionality for Website Builder
// Handles Firebase Storage uploads and image insertion

// Initialize upload functionality
document.addEventListener('DOMContentLoaded', () => {
    const uploadBtn = document.getElementById('uploadImage');
    const fileInput = document.getElementById('imageFileInput');
    const blocksContainer = document.getElementById('blocks');

    if (!uploadBtn || !fileInput || !blocksContainer) {
        console.error('Upload elements not found');
        return;
    }

    // Upload button click handler
    uploadBtn.addEventListener('click', () => {
        if (uploadBtn.disabled) return;
        fileInput.click();
    });

    // File selection handler
    fileInput.addEventListener('change', handleFileSelection);

    // Drag and drop support (optional enhancement)
    blocksContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    blocksContainer.addEventListener('drop', handleFileDrop);
});

// Handle file selection from input
async function handleFileSelection(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    const file = files[0];
    await uploadAndInsertImage(file);
    
    // Clear the input for reuse
    event.target.value = '';
}

// Handle drag and drop file upload
async function handleFileDrop(event) {
    event.preventDefault();
    
    const files = event.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    
    // Check file type
    if (!isValidImageFile(file)) {
        alert('Please upload a valid image file (.jpg, .jpeg, .png, .webp)');
        return;
    }

    await uploadAndInsertImage(file);
}

// Validate image file type
function isValidImageFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return validTypes.includes(file.type);
}

// Main upload and insert function
async function uploadAndInsertImage(file) {
    if (!isValidImageFile(file)) {
        alert('Please upload a valid image file (.jpg, .jpeg, .png, .webp)');
        return;
    }

    const uploadBtn = document.getElementById('uploadImage');
    
    try {
        // Disable upload button during process
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        // Upload to Firebase Storage
        const imageUrl = await uploadToFirebaseStorage(file);
        
        // Insert image into builder
        insertImageIntoBuilder(imageUrl, file.name);
        
        console.log('Image uploaded and inserted successfully:', imageUrl);
        
    } catch (error) {
        console.error('Upload failed:', error);
        alert('Upload failed: ' + error.message);
    } finally {
        // Re-enable upload button
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Image';
    }
}

// Upload file to Firebase Storage
async function uploadToFirebaseStorage(file) {
    try {
        // Get current user info
        const response = await fetch('/api/auth/user');
        if (!response.ok) {
            throw new Error('User not authenticated');
        }
        
        const userData = await response.json();
        const userId = userData.uid;
        
        // Create unique filename
        const timestamp = Date.now();
        const filename = `${timestamp}_${file.name}`;
        const storagePath = `builderUploads/${userId}/${filename}`;
        
        // Upload using FormData
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', storagePath);
        
        const uploadResponse = await fetch('/api/upload/image', {
            method: 'POST',
            body: formData
        });
        
        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.text();
            throw new Error(`Upload failed: ${errorData}`);
        }
        
        const result = await uploadResponse.json();
        return result.downloadURL;
        
    } catch (error) {
        console.error('Firebase upload error:', error);
        throw new Error('Failed to upload image to storage');
    }
}

// Insert image into the builder layout
function insertImageIntoBuilder(imageUrl, altText) {
    const blocksContainer = document.getElementById('blocks');
    
    // Create image block
    const imageBlock = document.createElement('div');
    imageBlock.className = 'block image-block';
    imageBlock.draggable = true;
    
    // Create image element
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = altText || 'User Upload';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';
    img.style.margin = '0 auto';
    
    imageBlock.appendChild(img);
    
    // Add drag event listeners if available
    if (typeof setupBlockDragEvents === 'function') {
        setupBlockDragEvents(imageBlock);
    }
    
    // Append to blocks container
    blocksContainer.appendChild(imageBlock);
    
    // Add animation
    imageBlock.classList.add('new');
    setTimeout(() => imageBlock.classList.remove('new'), 300);
    
    console.log('Image block inserted into builder');
}