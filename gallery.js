// Gallery functionality
let currentSession = null;
let allPhotos = [];
let currentLightboxIndex = 0;

// Initialize gallery when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await initializeGallery();
});

async function initializeGallery() {
    try {
        // Get session ID from URL
        const pathParts = window.location.pathname.split('/');
        const sessionId = pathParts[pathParts.length - 1];
        
        if (!sessionId || sessionId === 'gallery') {
            showError('Invalid session ID');
            return;
        }

        console.log('Loading gallery for session:', sessionId);
        
        // Load session details and photos
        await Promise.all([
            loadSessionDetails(sessionId),
            loadPhotos(sessionId)
        ]);
        
    } catch (error) {
        console.error('Error initializing gallery:', error);
        showError('Failed to load gallery');
    }
}

async function loadSessionDetails(sessionId) {
    try {
        const response = await fetch(`/api/sessions`, {
            headers: {
                'Authorization': window.currentUser ? `Bearer ${window.currentUser.accessToken}` : ''
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch sessions');
        }
        
        const sessions = await response.json();
        currentSession = sessions.find(s => s.id === sessionId);
        
        if (currentSession) {
            document.getElementById('gallery-title').textContent = 
                `${currentSession.sessionType} - ${currentSession.clientName}`;
            
            const sessionDate = new Date(currentSession.dateTime).toLocaleDateString();
            document.getElementById('gallery-subtitle').textContent = 
                `${sessionDate} at ${currentSession.location}`;
        } else {
            document.getElementById('gallery-subtitle').textContent = 'Session not found';
        }
        
    } catch (error) {
        console.error('Error loading session details:', error);
        document.getElementById('gallery-subtitle').textContent = 'Error loading session details';
    }
}

async function loadPhotos(sessionId) {
    try {
        const response = await fetch(`/api/sessions/${sessionId}/photos`, {
            headers: {
                'Authorization': window.currentUser ? `Bearer ${window.currentUser.accessToken}` : ''
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch photos');
        }
        
        const data = await response.json();
        allPhotos = data.photos || [];
        
        console.log('Loaded photos:', allPhotos);
        renderGallery();
        
    } catch (error) {
        console.error('Error loading photos:', error);
        showError('Failed to load photos');
    }
}

function renderGallery() {
    const galleryGrid = document.getElementById('gallery-grid');
    const emptyGallery = document.getElementById('empty-gallery');
    
    if (allPhotos.length === 0) {
        galleryGrid.style.display = 'none';
        emptyGallery.style.display = 'block';
        return;
    }
    
    galleryGrid.style.display = 'grid';
    emptyGallery.style.display = 'none';
    
    galleryGrid.innerHTML = '';
    
    allPhotos.forEach((photoUrl, index) => {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        
        const img = document.createElement('img');
        img.src = photoUrl;
        img.alt = `Photo ${index + 1}`;
        img.loading = 'lazy';
        img.onclick = () => openLightbox(index);
        
        const actions = document.createElement('div');
        actions.className = 'photo-actions';
        
        const viewBtn = document.createElement('button');
        viewBtn.textContent = '👁️';
        viewBtn.title = 'View full size';
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            openLightbox(index);
        };
        
        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = '⬇️';
        downloadBtn.title = 'Download';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            downloadPhoto(photoUrl, index);
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deletePhoto(index);
        };
        
        actions.appendChild(viewBtn);
        actions.appendChild(downloadBtn);
        actions.appendChild(deleteBtn);
        
        photoItem.appendChild(img);
        photoItem.appendChild(actions);
        galleryGrid.appendChild(photoItem);
    });
}

function openLightbox(index) {
    currentLightboxIndex = index;
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    
    lightboxImg.src = allPhotos[index];
    lightbox.classList.add('active');
    
    // Keyboard navigation
    document.addEventListener('keydown', handleLightboxKeyboard);
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('active');
    document.removeEventListener('keydown', handleLightboxKeyboard);
}

function prevPhoto() {
    if (currentLightboxIndex > 0) {
        currentLightboxIndex--;
        document.getElementById('lightbox-img').src = allPhotos[currentLightboxIndex];
    }
}

function nextPhoto() {
    if (currentLightboxIndex < allPhotos.length - 1) {
        currentLightboxIndex++;
        document.getElementById('lightbox-img').src = allPhotos[currentLightboxIndex];
    }
}

function handleLightboxKeyboard(e) {
    switch(e.key) {
        case 'Escape':
            closeLightbox();
            break;
        case 'ArrowLeft':
            prevPhoto();
            break;
        case 'ArrowRight':
            nextPhoto();
            break;
    }
}

async function openPhotoUpload() {
    const fileInput = document.getElementById('hidden-file-input');
    
    fileInput.onchange = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        await uploadPhotos(files);
        fileInput.value = ''; // Reset input
    };
    
    fileInput.click();
}

async function uploadPhotos(files) {
    if (!currentSession) {
        showError('Session not loaded');
        return;
    }
    
    try {
        showMessage(`Uploading ${files.length} photo(s)...`, 'info');
        
        const formData = new FormData();
        formData.append('sessionId', currentSession.id);
        
        files.forEach((file) => {
            formData.append('photos', file);
        });
        
        const response = await fetch('/api/sessions/upload-photos', {
            method: 'POST',
            headers: {
                'Authorization': window.currentUser ? `Bearer ${window.currentUser.accessToken}` : ''
            },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Upload failed');
        }
        
        const result = await response.json();
        showMessage(`Successfully uploaded ${result.uploadedCount} photo(s)!`, 'success');
        
        // Reload gallery
        await loadPhotos(currentSession.id);
        
    } catch (error) {
        console.error('Error uploading photos:', error);
        showError('Error uploading photos: ' + error.message);
    }
}

function downloadPhoto(photoUrl, index) {
    const link = document.createElement('a');
    link.href = photoUrl;
    link.download = `photo-${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function downloadAll() {
    if (allPhotos.length === 0) {
        showError('No photos to download');
        return;
    }
    
    showMessage('Preparing download...', 'info');
    
    // Download each photo individually
    allPhotos.forEach((photoUrl, index) => {
        setTimeout(() => {
            downloadPhoto(photoUrl, index);
        }, index * 500); // Stagger downloads
    });
    
    showMessage(`Started download of ${allPhotos.length} photos`, 'success');
}

async function deletePhoto(index) {
    if (!confirm('Are you sure you want to delete this photo?')) {
        return;
    }
    
    try {
        showMessage('Deleting photo...', 'info');
        
        // Remove photo from array
        const updatedPhotos = allPhotos.filter((_, i) => i !== index);
        
        // Update session with new photo array
        const response = await fetch(`/api/sessions/${currentSession.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': window.currentUser ? `Bearer ${window.currentUser.accessToken}` : ''
            },
            body: JSON.stringify({
                photos: updatedPhotos
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete photo');
        }
        
        allPhotos = updatedPhotos;
        renderGallery();
        showMessage('Photo deleted successfully!', 'success');
        
    } catch (error) {
        console.error('Error deleting photo:', error);
        showError('Error deleting photo: ' + error.message);
    }
}

function shareGallery() {
    const galleryUrl = window.location.href;
    
    if (navigator.share) {
        navigator.share({
            title: `${currentSession?.clientName || 'Session'} Gallery`,
            text: 'Check out this photography session gallery',
            url: galleryUrl
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(galleryUrl).then(() => {
            showMessage('Gallery link copied to clipboard!', 'success');
        }).catch(() => {
            showError('Failed to copy link');
        });
    }
}

// Utility functions
function showMessage(message, type = 'info') {
    const messageContainer = document.createElement('div');
    messageContainer.className = `message ${type}`;
    messageContainer.textContent = message;
    messageContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 10001;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    switch(type) {
        case 'success':
            messageContainer.style.backgroundColor = '#4CAF50';
            break;
        case 'error':
            messageContainer.style.backgroundColor = '#f44336';
            break;
        case 'info':
            messageContainer.style.backgroundColor = '#2196F3';
            break;
    }
    
    document.body.appendChild(messageContainer);
    
    // Fade in
    setTimeout(() => {
        messageContainer.style.opacity = '1';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        messageContainer.style.opacity = '0';
        setTimeout(() => {
            if (messageContainer.parentNode) {
                messageContainer.parentNode.removeChild(messageContainer);
            }
        }, 300);
    }, 3000);
}

function showError(message) {
    showMessage(message, 'error');
}

// Handle authentication state changes
window.addEventListener('authStateChanged', (event) => {
    if (event.detail.user) {
        window.currentUser = event.detail.user;
    } else {
        window.currentUser = null;
    }
});