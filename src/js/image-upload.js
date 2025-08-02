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
        alert('Image upload failed. Please try again.');
    } finally {
        // Re-enable upload button
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Image';
    }
}

// Upload file to Firebase Storage using client-side Firebase SDK
async function uploadToFirebaseStorage(file) {
    try {
        // Check if Firebase is available and user is authenticated
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK not loaded');
        }
        
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            throw new Error('User not authenticated');
        }
        
        console.log('Authenticated user:', currentUser.email, 'UID:', currentUser.uid);
        
        const user = firebase.auth().currentUser;
        const userId = user.uid;
        
        // Create unique filename
        const timestamp = Date.now();
        const filename = `${timestamp}_${file.name}`;
        const storagePath = `builderUploads/${userId}/${filename}`;
        
        // Get Firebase Storage reference
        const storage = firebase.storage();
        console.log('Firebase Storage initialized, bucket:', storage.app.options.storageBucket);
        
        const storageRef = storage.ref();
        const fileRef = storageRef.child(storagePath);
        
        console.log('Upload path:', storagePath);
        
        // Upload file with metadata
        const metadata = {
            contentType: file.type,
            customMetadata: {
                uploadedBy: userId,
                uploadedAt: new Date().toISOString(),
                originalName: file.name
            }
        };
        
        console.log('Starting upload with metadata:', metadata);
        
        // Upload the file using uploadBytes instead of put for better error handling
        const uploadResult = await firebase.storage().ref(storagePath).put(file, metadata);
        
        console.log('Upload completed:', uploadResult);
        
        // Get download URL
        const downloadURL = await uploadResult.ref.getDownloadURL();
        
        console.log('Image uploaded successfully to:', downloadURL);
        return downloadURL;
        
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