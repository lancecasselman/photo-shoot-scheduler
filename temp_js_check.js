    <script>
        let sessionId = '';
        let folderType = '';
        let clientName = '';
        let files = [];
        let uploadQueue = [];
        let isUploading = false;

        // Get URL parameters
        function getUrlParams() {
            const urlParams = new URLSearchParams(window.location.search);
            sessionId = urlParams.get('sessionId');
            folderType = urlParams.get('folderType');
            clientName = urlParams.get('clientName') || 'Client';
            
            // Update UI
            document.getElementById('folderTitle').textContent = 
                folderType === 'gallery' ? '📸 Gallery Manager' : '📁 Raw Storage Manager';
            document.getElementById('folderType').textContent = 
                folderType === 'gallery' ? 'Gallery' : 'Raw Storage';
            document.getElementById('clientName').textContent = clientName;
            
            // Show send to client button only for gallery
            if (folderType === 'gallery') {
                document.getElementById('sendClientBtn').style.display = 'flex';
            }
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            getUrlParams();
            loadFiles();
            setupDragAndDrop();
            setupFileInput();
        });

        // Setup drag and drop
        function setupDragAndDrop() {
            const uploadZone = document.getElementById('uploadZone');
            
            uploadZone.addEventListener('dragover', function(e) {
                e.preventDefault();
                uploadZone.classList.add('dragover');
            });
            
            uploadZone.addEventListener('dragleave', function(e) {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
            });
            
            uploadZone.addEventListener('drop', function(e) {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
                const files = Array.from(e.dataTransfer.files);
                handleFileSelection(files);
            });
        }

        // Setup file input
        function setupFileInput() {
            const fileInput = document.getElementById('fileInput');
            fileInput.addEventListener('change', function(e) {
                const files = Array.from(e.target.files);
                handleFileSelection(files);
                e.target.value = ''; // Reset input
            });
        }

        // Trigger file upload
        function triggerFileUpload() {
            document.getElementById('fileInput').click();
        }

        // Handle file selection
        function handleFileSelection(selectedFiles) {
            if (selectedFiles.length === 0) return;
            
            uploadQueue = [...selectedFiles];
            processUploadQueue();
        }

        // Process upload queue (2 files at a time)
        async function processUploadQueue() {
            if (isUploading || uploadQueue.length === 0) return;
            
            isUploading = true;
            document.getElementById('progressContainer').style.display = 'block';
            
            const batchSize = 2;
            
            while (uploadQueue.length > 0) {
                const batch = uploadQueue.splice(0, batchSize);
                const uploadPromises = batch.map(file => uploadFile(file));
                
                try {
                    await Promise.all(uploadPromises);
                } catch (error) {
                    console.error('Batch upload error:', error);
                }
            }
            
            isUploading = false;
            document.getElementById('progressContainer').style.display = 'none';
            loadFiles(); // Refresh file list
        }

        // Upload single file
        async function uploadFile(file) {
            try {
                console.log(`Starting upload for ${file.name}, size: ${file.size}`);
                console.log(`Session ID: ${sessionId}, Folder Type: ${folderType}`);
                
                // Get upload URL
                const response = await fetch(`/api/sessions/${sessionId}/files/upload`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include', // Include cookies for authentication
                    body: JSON.stringify({ 
                        folderType,
                        fileName: file.name // Pass original filename
                    })
                });
                
                console.log(`Upload URL response status: ${response.status}`);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Upload URL response error:', errorText);
                    alert(`Authentication or server error: ${errorText}. Please refresh the page and try again.`);
                    throw new Error(`Failed to get upload URL: ${response.status} - ${errorText}`);
                }
                
                const { uploadURL } = await response.json();
                console.log('Got upload URL:', uploadURL);
                
                // Upload file to object storage
                console.log(`Uploading ${file.name} to object storage...`);
                const uploadResponse = await fetch(uploadURL, {
                    method: 'PUT',
                    body: file,
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream'
                    }
                });
                
                console.log(`Object storage upload response status: ${uploadResponse.status}`);
                
                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    console.error('File upload response error:', errorText);
                    alert(`File upload failed: ${errorText}. Please try again.`);
                    throw new Error(`Failed to upload file: ${uploadResponse.status} - ${errorText}`);
                }
                
                console.log(`Successfully uploaded ${file.name} to object storage`);
                updateProgress(`Uploaded ${file.name}`);
                
                // Wait a moment for file to become available in storage before setting metadata
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Set metadata with original filename
                try {
                    const metadataResponse = await fetch(`/api/sessions/${sessionId}/files/${folderType}/update-metadata`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            uploadUrl: uploadURL,
                            originalName: file.name
                        })
                    });
                    
                    if (metadataResponse.ok) {
                        console.log(`Successfully set metadata for ${file.name}`);
                    } else {
                        const errorText = await metadataResponse.text();
                        console.warn(`Failed to set metadata for ${file.name}:`, errorText);
                    }
                } catch (metadataError) {
                    console.warn('Metadata update error:', metadataError);
                }
                
                // Wait a moment for upload to propagate, then reload files
                setTimeout(() => {
                    loadFiles();
                }, 1000);
                
            } catch (error) {
                console.error('Upload error for', file.name, ':', error);
                alert(`Failed to upload ${file.name}: ${error.message}`);
            }
        }

        // Update progress
        function updateProgress(text) {
            document.getElementById('progressText').textContent = text;
        }

        // Update stats display - removed old function causing syntax errors
        
        // Load and display storage statistics for both folders
        async function loadStorageStats() {
            try {
                const response = await fetch('/api/sessions/' + sessionId + '/storage-stats', {
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    console.warn('Failed to load storage stats');
                    return;
                }
                
                const stats = await response.json();
                console.log('Storage stats received:', stats);
                
                // Add or update storage stats display
                let storageDiv = document.getElementById('storage-stats');
                if (!storageDiv) {
                    storageDiv = document.createElement('div');
                    storageDiv.id = 'storage-stats';
                    storageDiv.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    storageDiv.style.color = 'white';
                    storageDiv.style.padding = '15px';
                    storageDiv.style.borderRadius = '12px';
                    storageDiv.style.margin = '15px 0';
                    storageDiv.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    document.querySelector('.container').insertBefore(storageDiv, document.querySelector('.folder-container'));
                }
                
                // Build HTML content using string concatenation
                var galleryMeasured = '';
                if (stats.gallery.validFiles !== stats.gallery.fileCount) {
                    galleryMeasured = '<div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">(' + stats.gallery.validFiles + ' measured)</div>';
                }
                
                var rawMeasured = '';
                if (stats.raw.validFiles !== stats.raw.fileCount) {
                    rawMeasured = '<div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">(' + stats.raw.validFiles + ' measured)</div>';
                }
                
                var combinedMeasured = '';
                if (stats.combined.validFiles !== stats.combined.fileCount) {
                    combinedMeasured = '<div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">(' + stats.combined.validFiles + ' measured)</div>';
                }
                
                storageDiv.innerHTML = 
                    '<h3 style="margin: 0 0 10px 0; font-size: 18px;">📊 Session Storage Overview</h3>' +
                    '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 10px;">' +
                        '<div style="text-align: center;">' +
                            '<div style="font-size: 20px; font-weight: bold;">' + stats.gallery.fileCount + '</div>' +
                            '<div style="font-size: 12px; opacity: 0.9;">Gallery Files</div>' +
                            '<div style="font-size: 14px; margin-top: 2px;">' + stats.gallery.totalSizeFormatted + '</div>' +
                            galleryMeasured +
                        '</div>' +
                        '<div style="text-align: center;">' +
                            '<div style="font-size: 20px; font-weight: bold;">' + stats.raw.fileCount + '</div>' +
                            '<div style="font-size: 12px; opacity: 0.9;">Raw Files</div>' +
                            '<div style="font-size: 14px; margin-top: 2px;">' + stats.raw.totalSizeFormatted + '</div>' +
                            rawMeasured +
                        '</div>' +
                        '<div style="text-align: center; border-left: 1px solid rgba(255,255,255,0.3); padding-left: 15px;">' +
                            '<div style="font-size: 20px; font-weight: bold;">' + stats.combined.fileCount + '</div>' +
                            '<div style="font-size: 12px; opacity: 0.9;">Total Files</div>' +
                            '<div style="font-size: 14px; margin-top: 2px;">' + stats.combined.totalSizeFormatted + '</div>' +
                            combinedMeasured +
                        '</div>' +
                    '</div>';
                
                console.log('Storage stats loaded successfully');
            } catch (error) {
                console.error('Error loading storage stats:', error);
            }
        }

        // Load files
        async function loadFiles() {
            try {
                const response = await fetch(`/api/sessions/${sessionId}/files/${folderType}`, {
                    credentials: 'include' // Include cookies for authentication
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Load files response error:', errorText);
                    throw new Error(`Failed to load files: ${response.status} - ${errorText}`);
                }
                
                const data = await response.json();
                files = data.files || [];
                
                console.log(`Loaded ${files.length} files for ${folderType} folder`);
                renderFiles();
                loadStorageStats();
                
            } catch (error) {
                console.error('Load files error:', error);
                document.getElementById('fileContainer').innerHTML = `
                    <div class="empty-state">
                        <h3>❌ Error Loading Files</h3>
                        <p>${error.message}</p>
                        <button class="btn" onclick="loadFiles()">Try Again</button>
                    </div>
                `;
            }
        }

        // Render files
        function renderFiles() {
            const container = document.getElementById('fileContainer');
            const emptyState = document.getElementById('emptyState');
            
            if (!container) {
                console.error('File container not found');
                return;
            }
            
            // Update file count display in header
            const fileCountElement = document.getElementById('fileCount');
            if (fileCountElement) {
                fileCountElement.textContent = files.length;
            }
            
            // Calculate total size for current folder
            const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
            const totalSizeElement = document.getElementById('totalSize');
            if (totalSizeElement) {
                totalSizeElement.textContent = formatFileSize(totalBytes);
            }
            
            if (files.length === 0) {
                if (emptyState) {
                    emptyState.style.display = 'block';
                    container.innerHTML = '';
                    container.appendChild(emptyState);
                } else {
                    container.innerHTML = `
                        <div class="empty-state" style="text-align: center; padding: 40px;">
                            <h3>📁 No Files</h3>
                            <p>No files found in this ${folderType} folder</p>
                        </div>
                    `;
                }
                return;
            }
            
            if (emptyState) {
                emptyState.style.display = 'none';
            }
            
            const fileGrid = document.createElement('div');
            fileGrid.className = 'file-grid';
            
            files.forEach(file => {
                const fileCard = createFileCard(file);
                fileGrid.appendChild(fileCard);
            });
            
            container.innerHTML = '';
            container.appendChild(fileGrid);
        }

        // Create file card
        function createFileCard(file) {
            const card = document.createElement('div');
            card.className = 'file-card';
            
            const isImage = file.contentType && file.contentType.startsWith('image/');
            
            card.innerHTML = `
                <div class="file-preview">
                    ${isImage ? 
                        `<img src="/api/sessions/${sessionId}/files/${folderType}/thumbnail/${file.name}" 
                             alt="${file.name}" 
                             onclick="openLightbox(\\"${file.downloadUrl}\\")"
                             onerror="this.src=\\"${file.downloadUrl}\\"; this.style.objectFit=\\"cover\\";"
                             loading="lazy">` :
                        `<div class="file-icon">${getFileIcon(file.contentType)}</div>`
                    }
                </div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-meta">
                        ${formatFileSize(file.size)} • ${formatDate(file.timeCreated)}
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn" onclick="downloadFile(\\"${file.downloadUrl}\\", \\"${file.name}\\")">
                        📥 Download
                    </button>
                    <button class="btn btn-danger" onclick="deleteFile(\\"${file.name}\\")">
                        🗑️ Delete
                    </button>
                </div>
            `;
            
            return card;
        }

        // Get file icon based on content type
        function getFileIcon(contentType) {
            if (!contentType) return '📄';
            
            if (contentType.startsWith('image/')) return '🖼️';
            if (contentType.startsWith('video/')) return '🎥';
            if (contentType.startsWith('audio/')) return '🎵';
            if (contentType.includes('pdf')) return '📕';
            if (contentType.includes('document') || contentType.includes('word')) return '📝';
            if (contentType.includes('spreadsheet') || contentType.includes('excel')) return '📊';
            if (contentType.includes('zip') || contentType.includes('archive')) return '📦';
            
            return '📄';
        }

        // Format file size
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        // Format date
        function formatDate(dateString) {
            return new Date(dateString).toLocaleDateString();
        }

        // Stats display now handled by loadStorageStats() function

        // Download file
        function downloadFile(url, filename) {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        // Download all files as ZIP
        async function downloadAllFiles() {
            if (files.length === 0) {
                alert('No files to download');
                return;
            }
            
            try {
                const response = await fetch(`/api/sessions/${sessionId}/files/${folderType}/download-zip`, {
                    credentials: 'include' // Include cookies for authentication
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Download ZIP response error:', errorText);
                    throw new Error(`Failed to create ZIP file: ${response.status} - ${errorText}`);
                }
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${clientName}-${sessionId}-${folderType}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                console.log(`Successfully downloaded ZIP for ${folderType} folder`);
                
            } catch (error) {
                console.error('Download ZIP error:', error);
                alert('Failed to download ZIP: ' + error.message);
            }
        }

        // Delete file
        async function deleteFile(fileName) {
            if (!confirm(`Are you sure you want to delete ${fileName}?`)) {
                return;
            }
            
            try {
                const encodedFileName = encodeURIComponent(fileName);
                const response = await fetch(`/api/sessions/${sessionId}/files/${folderType}/${encodedFileName}`, {
                    method: 'DELETE',
                    credentials: 'include' // Include cookies for authentication
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Failed to delete file' }));
                    throw new Error(errorData.error || `Failed to delete file: ${response.status}`);
                }
                
                console.log(`Successfully deleted ${fileName}`);
                loadFiles(); // Refresh file list
                
            } catch (error) {
                console.error('Delete error:', error);
                alert('Failed to delete file: ' + error.message);
            }
        }

        // Download all files as ZIP
        async function downloadAllFiles() {
            if (files.length === 0) {
                alert('No files available for download');
                return;
            }

            try {
                const response = await fetch(`/api/sessions/${sessionId}/files/${folderType}/download-zip`);
                
                if (!response.ok) {
                    throw new Error(`Download failed: ${response.status}`);
                }

                // Create download link
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${clientName.replace(/[^a-zA-Z0-9]/g, '_')}_${folderType}_files.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
            } catch (error) {
                console.error('Download error:', error);
                alert('Failed to download files: ' + error.message);
            }
        }

        // Delete all files
        async function deleteAllFiles() {
            if (files.length === 0) {
                alert('No files to delete');
                return;
            }

            const confirmMessage = `Are you sure you want to delete ALL ${files.length} files from the ${folderType} folder?\n\nThis action cannot be undone!`;
            
            if (!confirm(confirmMessage)) {
                return;
            }

            try {
                let successCount = 0;
                let errorCount = 0;
                
                // Delete files in batches of 3 to avoid overwhelming the server
                const batchSize = 3;
                for (let i = 0; i < files.length; i += batchSize) {
                    const batch = files.slice(i, i + batchSize);
                    const promises = batch.map(async (file) => {
                        try {
                            const response = await fetch(`/api/sessions/${sessionId}/files/${folderType}/${encodeURIComponent(file.name)}`, {
                                method: 'DELETE'
                            });
                            
                            if (!response.ok) {
                                throw new Error(`Failed to delete ${file.name}: ${response.status}`);
                            }
                            successCount++;
                            console.log(`Successfully deleted ${file.name}`);
                        } catch (error) {
                            errorCount++;
                            console.error(`Failed to delete ${file.name}:`, error);
                        }
                    });
                    
                    await Promise.all(promises);
                    
                    // Small delay between batches to prevent overwhelming the server
                    if (i + batchSize < files.length) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
                
                // Show results and refresh
                if (errorCount === 0) {
                    alert(`Successfully deleted all ${successCount} files!`);
                } else {
                    alert(`Deleted ${successCount} files. Failed to delete ${errorCount} files. Check console for details.`);
                }
                
                loadFiles(); // Refresh file list
                
            } catch (error) {
                console.error('Delete all error:', error);
                alert('Failed to delete files: ' + error.message);
            }
        }

        // Send to client (Gallery only)
        function sendToClient() {
            const clientGalleryUrl = `${window.location.origin}/client-gallery.html?session=${sessionId}`;
            const subject = `Your Photography Gallery - Session`;
            const body = `Hi ${clientName},

Your photography gallery is ready for viewing and download!

📸 View Your Gallery: ${clientGalleryUrl}

You can:
• View all your photos in high resolution
• Download individual photos
• Download selected photos as a ZIP file
• Download your entire gallery

The gallery will remain available for download. If you have any questions or need assistance, please don't hesitate to reach out.

Best regards,
Lance - The Legacy Photography
Professional Photography Services
lance@thelegacyphotography.com`;

            const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailtoUrl;
        }

        // Refresh files
        function refreshFiles() {
            loadFiles();
        }

        // Lightbox functions
        function openLightbox(imageSrc) {
            document.getElementById('lightboxImage').src = imageSrc;
            document.getElementById('lightbox').style.display = 'block';
        }

        function closeLightbox() {
            document.getElementById('lightbox').style.display = 'none';
        }

        // Close lightbox with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeLightbox();
            }
        });
    </script>
