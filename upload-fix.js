// Fixed upload function for HTML modal
function uploadFiles(files) {
    if (!window.currentUploadSessionId) {
        console.error('No session ID set for upload');
        return;
    }

    if (files.length === 0) {
        console.error('No files to upload');
        return;
    }

    const formData = new FormData();
    files.forEach(file => {
        formData.append('photos', file);
    });

    // Show upload status
    const uploadStatus = document.getElementById('uploadStatus');
    const uploadStatusText = document.getElementById('uploadStatusText');
    if (uploadStatus) uploadStatus.style.display = 'block';
    if (uploadStatusText) uploadStatusText.textContent = 'Uploading photos...';

    fetch(`/api/sessions/${window.currentUploadSessionId}/upload-photos`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Upload successful:', data);
        
        // Close modal
        const modal = document.getElementById('uploadModal');
        if (modal) modal.classList.remove('active');
        
        // Show success message
        showMessage(`Successfully uploaded ${data.uploaded || data.photos?.length || 'photos'}!`, 'success');
        
        // Reload page to show new photos
        setTimeout(() => location.reload(), 1000);
    })
    .catch(error => {
        console.error('Upload error:', error);
        showMessage('Upload failed: ' + error.message, 'error');
    });
}