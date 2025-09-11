/**
 * R2 Direct Upload Module
 * Handles concurrent photo uploads with presigned URLs
 * Features: 4 concurrent uploads, retry logic, progress tracking, preview generation
 */

class R2DirectUploader {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 4;
        this.maxRetries = options.maxRetries || 3;
        this.chunkSize = options.chunkSize || 10 * 1024 * 1024; // 10MB chunks
        this.sessionId = options.sessionId || null;
        
        // Upload state tracking
        this.uploadQueue = [];
        this.activeUploads = new Map();
        this.completedUploads = [];
        this.failedUploads = [];
        
        // Progress tracking
        this.onProgress = options.onProgress || null;
        this.onFileComplete = options.onFileComplete || null;
        this.onAllComplete = options.onAllComplete || null;
        this.onError = options.onError || null;
        
        // File type limits
        this.fileLimits = {
            raw: 5 * 1024 * 1024 * 1024, // 5GB
            video: 5 * 1024 * 1024 * 1024, // 5GB
            gallery: 500 * 1024 * 1024, // 500MB
            adobe: 500 * 1024 * 1024, // 500MB
            other: 100 * 1024 * 1024 // 100MB
        };
        
        // File type detection
        this.fileTypes = {
            raw: ['.nef', '.cr2', '.arw', '.dng', '.raf', '.orf', '.rw2', '.3fr', '.crw', '.dcr', '.erf', '.k25', '.kdc', '.mrw', '.pef', '.sr2', '.srf', '.x3f'],
            gallery: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif'],
            video: ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v'],
            audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
            document: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'],
            adobe: ['.psd', '.ai', '.indd', '.eps', '.xd']
        };
    }
    
    /**
     * Get file type category
     */
    getFileType(filename) {
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        for (const [type, extensions] of Object.entries(this.fileTypes)) {
            if (extensions.includes(ext)) {
                return type;
            }
        }
        return 'other';
    }
    
    /**
     * Validate file before upload
     */
    validateFile(file) {
        const fileType = this.getFileType(file.name);
        const maxSize = this.fileLimits[fileType] || this.fileLimits.other;
        
        if (file.size > maxSize) {
            return {
                valid: false,
                error: `File too large: ${file.name} (${(file.size / (1024*1024)).toFixed(2)}MB exceeds ${(maxSize / (1024*1024)).toFixed(0)}MB limit)`
            };
        }
        
        return { valid: true, fileType };
    }
    
    /**
     * Upload multiple files with concurrent processing
     */
    async uploadFiles(files, sessionId = null) {
        this.sessionId = sessionId || this.sessionId;
        
        if (!this.sessionId) {
            throw new Error('Session ID is required for upload');
        }
        
        // Reset state
        this.uploadQueue = [];
        this.activeUploads.clear();
        this.completedUploads = [];
        this.failedUploads = [];
        
        // Validate all files
        const validatedFiles = [];
        for (const file of files) {
            const validation = this.validateFile(file);
            if (validation.valid) {
                validatedFiles.push({
                    file,
                    fileType: validation.fileType,
                    retries: 0
                });
            } else {
                console.error(validation.error);
                this.failedUploads.push({
                    filename: file.name,
                    error: validation.error
                });
                if (this.onError) {
                    this.onError(file.name, validation.error);
                }
            }
        }
        
        if (validatedFiles.length === 0) {
            console.error('No valid files to upload');
            return {
                success: false,
                error: 'No valid files to upload',
                failed: this.failedUploads
            };
        }
        
        // Get presigned URLs for all valid files
        const presignedUrls = await this.getPresignedUrls(validatedFiles);
        
        if (!presignedUrls.success) {
            console.error('Failed to get presigned URLs:', presignedUrls.error);
            return {
                success: false,
                error: presignedUrls.error || 'Failed to get upload URLs',
                failed: this.failedUploads
            };
        }
        
        // Create upload queue with presigned URLs
        for (let i = 0; i < validatedFiles.length; i++) {
            const fileData = validatedFiles[i];
            const urlData = presignedUrls.urls[i];
            
            if (urlData) {
                this.uploadQueue.push({
                    ...fileData,
                    presignedUrl: urlData.presignedUrl,
                    key: urlData.key,
                    index: i,
                    progress: 0
                });
            }
        }
        
        // Start concurrent upload processing
        await this.processUploadQueue();
        
        // SECURITY: Confirm uploads with server - MANDATORY
        let confirmationResult = null;
        if (this.completedUploads.length > 0) {
            console.log('🔒 Confirming uploads with server (MANDATORY)...');
            confirmationResult = await this.confirmUploads();
            
            // SECURITY: Handle confirmation failures
            if (!confirmationResult || !confirmationResult.success) {
                console.error('🚨 Upload confirmation failed!');
                
                // Move all completed uploads to failed if confirmation fails
                if (confirmationResult && confirmationResult.deletedFiles) {
                    for (const deleted of confirmationResult.deletedFiles) {
                        this.failedUploads.push({
                            filename: deleted.filename,
                            error: deleted.reason || 'File deleted by server'
                        });
                        
                        // Remove from completedUploads
                        this.completedUploads = this.completedUploads.filter(
                            upload => upload.key !== deleted.key
                        );
                    }
                }
                
                // Notify user of security violation
                if (confirmationResult && confirmationResult.error) {
                    if (this.onError) {
                        this.onError('SECURITY', confirmationResult.error);
                    }
                    alert(`⚠️ Upload Security Violation: ${confirmationResult.error}`);
                }
            } else {
                console.log('✅ Upload confirmation successful');
            }
        }
        
        // Call completion callback with confirmation results
        if (this.onAllComplete) {
            this.onAllComplete({
                completed: this.completedUploads,
                failed: this.failedUploads,
                total: files.length,
                confirmationResult: confirmationResult
            });
        }
        
        return {
            success: this.failedUploads.length === 0 && (!confirmationResult || confirmationResult.success),
            completed: this.completedUploads,
            failed: this.failedUploads,
            total: files.length,
            confirmationResult: confirmationResult
        };
    }
    
    /**
     * Get presigned URLs from server
     */
    async getPresignedUrls(validatedFiles) {
        try {
            const response = await fetch('/api/r2/generate-presigned-urls', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    files: validatedFiles.map(f => ({
                        filename: f.file.name,
                        contentType: f.file.type || 'application/octet-stream',
                        size: f.file.size
                    }))
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || error.message || 'Failed to get presigned URLs');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('Error getting presigned URLs:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Process upload queue with concurrent limit
     */
    async processUploadQueue() {
        const uploadPromises = [];
        
        while (this.uploadQueue.length > 0 || this.activeUploads.size > 0) {
            // Start new uploads up to concurrent limit
            while (this.uploadQueue.length > 0 && this.activeUploads.size < this.maxConcurrent) {
                const uploadData = this.uploadQueue.shift();
                const uploadPromise = this.uploadFile(uploadData);
                // SECURITY FIX: Use R2 key instead of filename to avoid collisions
                this.activeUploads.set(uploadData.key, uploadPromise);
                uploadPromises.push(uploadPromise);
            }
            
            // Wait for at least one upload to complete
            if (this.activeUploads.size > 0) {
                await Promise.race(Array.from(this.activeUploads.values()));
            }
        }
        
        // Wait for all remaining uploads to complete
        await Promise.allSettled(uploadPromises);
    }
    
    /**
     * Upload a single file with retry logic
     */
    async uploadFile(uploadData) {
        const { file, presignedUrl, key, retries } = uploadData;
        
        try {
            console.log(`📤 Uploading ${file.name} (${(file.size / (1024*1024)).toFixed(2)}MB)`);
            
            // Create XMLHttpRequest for progress tracking
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    uploadData.progress = percentComplete;
                    
                    if (this.onProgress) {
                        this.onProgress(file.name, percentComplete, event.loaded, event.total);
                    }
                }
            });
            
            // Create promise for upload completion
            const uploadPromise = new Promise((resolve, reject) => {
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                });
                
                xhr.addEventListener('error', () => {
                    reject(new Error('Network error during upload'));
                });
                
                xhr.addEventListener('abort', () => {
                    reject(new Error('Upload aborted'));
                });
            });
            
            // Start upload
            xhr.open('PUT', presignedUrl, true);
            xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
            xhr.send(file);
            
            // Wait for upload to complete
            await uploadPromise;
            
            // Upload successful
            console.log(`✅ Uploaded ${file.name} successfully`);
            
            this.completedUploads.push({
                filename: file.name,
                key: key,
                size: file.size
            });
            
            // Generate preview if it's an image
            if (this.isImageFile(file.name)) {
                this.generatePreview(file, key);
            }
            
            // Call file complete callback
            if (this.onFileComplete) {
                this.onFileComplete(file.name, key, true);
            }
            
        } catch (error) {
            console.error(`❌ Failed to upload ${file.name}:`, error);
            
            // Retry logic
            if (retries < this.maxRetries) {
                console.log(`🔄 Retrying upload for ${file.name} (attempt ${retries + 1}/${this.maxRetries})`);
                uploadData.retries = retries + 1;
                
                // Add back to queue for retry
                this.uploadQueue.unshift(uploadData);
            } else {
                // Max retries exceeded
                this.failedUploads.push({
                    filename: file.name,
                    error: error.message
                });
                
                if (this.onFileComplete) {
                    this.onFileComplete(file.name, null, false, error.message);
                }
                
                if (this.onError) {
                    this.onError(file.name, error.message);
                }
            }
        } finally {
            // SECURITY FIX: Remove using R2 key instead of filename
            this.activeUploads.delete(key);
        }
    }
    
    /**
     * Confirm successful uploads with server
     */
    async confirmUploads() {
        try {
            const response = await fetch('/api/r2/confirm-uploads', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    uploadedFiles: this.completedUploads
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                console.error('🚨 Failed to confirm uploads:', result);
                // Return the error result for handling
                return {
                    success: false,
                    error: result.error || 'Upload confirmation failed',
                    ...result
                };
            } else {
                console.log(`✅ Confirmed ${result.confirmed} uploads with server`);
                
                // SECURITY: Check for deleted files
                if (result.deleted > 0) {
                    console.warn(`⚠️ Server deleted ${result.deleted} files due to security violations`);
                }
                
                // SECURITY: Check for size mismatches
                if (result.sizeMismatch) {
                    console.warn(`⚠️ Size mismatch detected: declared ${result.totalDeclaredSize} bytes, actual ${result.totalActualSize} bytes`);
                }
                
                return result;
            }
            
        } catch (error) {
            console.error('Error confirming uploads:', error);
            return {
                success: false,
                error: error.message || 'Network error during confirmation'
            };
        }
    }
    
    /**
     * Check if file is an image
     */
    isImageFile(filename) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif'];
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return imageExtensions.includes(ext);
    }
    
    /**
     * Generate preview for uploaded image
     */
    generatePreview(file, key) {
        if (!file.type.startsWith('image/')) {
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            // Create preview element
            const preview = document.createElement('div');
            preview.className = 'upload-preview';
            preview.innerHTML = `
                <img src="${e.target.result}" alt="${file.name}" style="max-width: 200px; max-height: 200px;">
                <div class="preview-info">
                    <span class="filename">${file.name}</span>
                    <span class="filesize">${(file.size / (1024*1024)).toFixed(2)}MB</span>
                </div>
            `;
            
            // Add preview to DOM if container exists
            const previewContainer = document.getElementById('upload-previews');
            if (previewContainer) {
                previewContainer.appendChild(preview);
            }
        };
        
        reader.readAsDataURL(file);
    }
    
    /**
     * Create upload progress UI
     */
    createProgressUI(container) {
        const progressHTML = `
            <div id="upload-progress-container" style="display: none;">
                <h3>Upload Progress</h3>
                <div id="upload-progress-list"></div>
                <div id="upload-summary" style="margin-top: 20px;">
                    <span id="upload-completed">0</span> / <span id="upload-total">0</span> files uploaded
                </div>
            </div>
        `;
        
        if (typeof container === 'string') {
            document.getElementById(container).innerHTML = progressHTML;
        } else {
            container.innerHTML = progressHTML;
        }
        
        return {
            container: document.getElementById('upload-progress-container'),
            list: document.getElementById('upload-progress-list'),
            completed: document.getElementById('upload-completed'),
            total: document.getElementById('upload-total')
        };
    }
    
    /**
     * Update progress UI
     */
    updateProgressUI(filename, progress, status = 'uploading') {
        const list = document.getElementById('upload-progress-list');
        if (!list) return;
        
        let progressItem = document.getElementById(`progress-${filename.replace(/[^a-zA-Z0-9]/g, '_')}`);
        
        if (!progressItem) {
            progressItem = document.createElement('div');
            progressItem.id = `progress-${filename.replace(/[^a-zA-Z0-9]/g, '_')}`;
            progressItem.className = 'upload-progress-item';
            list.appendChild(progressItem);
        }
        
        const statusIcon = status === 'completed' ? '✅' : 
                          status === 'failed' ? '❌' : 
                          status === 'uploading' ? '📤' : '⏳';
        
        progressItem.innerHTML = `
            <div class="progress-header">
                <span class="progress-icon">${statusIcon}</span>
                <span class="progress-filename">${filename}</span>
                <span class="progress-percent">${Math.round(progress)}%</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progress}%; background: ${
                    status === 'completed' ? '#28a745' :
                    status === 'failed' ? '#dc3545' : '#007bff'
                }"></div>
            </div>
        `;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = R2DirectUploader;
}