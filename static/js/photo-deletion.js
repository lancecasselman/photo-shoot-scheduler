/**
 * Photo Deletion Client-Side Functions
 * Handles complete photo deletion with user feedback
 */

class PhotoDeletion {
    constructor() {
        this.deleteInProgress = new Set();
    }

    /**
     * Delete a single photo with complete cleanup
     */
    async deletePhoto(sessionId, folderType, filename) {
        const deleteKey = `${sessionId}-${folderType}-${filename}`;
        
        if (this.deleteInProgress.has(deleteKey)) {
            showMessage('Deletion already in progress for this photo', 'warning');
            return;
        }

        this.deleteInProgress.add(deleteKey);

        try {
            console.log(`🗑️ Starting deletion: ${filename} from ${folderType}`);
            
            // Show loading indicator
            const deleteBtn = document.querySelector(`[data-delete-photo="${filename}"]`);
            if (deleteBtn) {
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '⏳ Deleting...';
            }

            // Make deletion request
            const apiOrigin = window.location.origin;
            const response = await fetch(`${apiOrigin}/api/sessions/${sessionId}/files/${folderType}/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                console.log(` Deletion success: ${filename} - ${result.reclaimedMB}MB reclaimed`);
                
                // Show success message
                showMessage(`Photo deleted successfully: ${filename} (${result.reclaimedMB}MB reclaimed)`, 'success');
                
                // Remove photo from UI immediately
                this.removePhotoFromUI(filename);
                
                // Update storage stats
                await this.refreshStorageStats();
                
                // Log detailed steps for debugging
                console.log('Deletion steps completed:', result.steps);
                
            } else {
                console.error(`❌ Deletion failed: ${filename}`, result);
                showMessage(`Failed to delete photo: ${result.error}`, 'error');
                
                // Re-enable button
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = '🗑️ Delete';
                }
            }

        } catch (error) {
            console.error('Photo deletion error:', error);
            showMessage(`Error deleting photo: ${error.message}`, 'error');
            
            // Re-enable button
            const deleteBtn = document.querySelector(`[data-delete-photo="${filename}"]`);
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = '🗑️ Delete';
            }
        } finally {
            this.deleteInProgress.delete(deleteKey);
        }
    }

    /**
     * Delete multiple photos in batch
     */
    async batchDeletePhotos(sessionId, folderType, filenames) {
        if (!filenames || filenames.length === 0) {
            showMessage('No photos selected for deletion', 'warning');
            return;
        }

        const confirmed = confirm(`Are you sure you want to delete ${filenames.length} photos? This cannot be undone.`);
        if (!confirmed) return;

        try {
            console.log(`🗑️ Starting batch deletion: ${filenames.length} photos from ${folderType}`);
            
            // Show progress indicator
            showMessage(`Deleting ${filenames.length} photos...`, 'info');

            const apiOrigin = window.location.origin;
            const response = await fetch(`${apiOrigin}/api/sessions/${sessionId}/files/${folderType}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ filenames })
            });

            const result = await response.json();

            if (result.success || result.successCount > 0) {
                console.log(` Batch deletion result: ${result.successCount}/${result.totalFiles} success`);
                
                showMessage(
                    `Batch deletion complete: ${result.successCount}/${result.totalFiles} photos deleted, ${result.totalReclaimedMB}MB reclaimed`, 
                    result.errorCount > 0 ? 'warning' : 'success'
                );
                
                // Remove successfully deleted photos from UI
                result.details.forEach(detail => {
                    if (detail.success) {
                        this.removePhotoFromUI(detail.filename);
                    }
                });
                
                // Update storage stats
                await this.refreshStorageStats();
                
            } else {
                console.error('❌ Batch deletion failed:', result);
                showMessage(`Batch deletion failed: ${result.error}`, 'error');
            }

        } catch (error) {
            console.error('Batch photo deletion error:', error);
            showMessage(`Error in batch deletion: ${error.message}`, 'error');
        }
    }

    /**
     * Remove photo from UI immediately after successful deletion
     */
    removePhotoFromUI(filename) {
        // Remove from photo grid
        const photoElement = document.querySelector(`[data-filename="${filename}"]`);
        if (photoElement) {
            photoElement.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                photoElement.remove();
            }, 300);
        }

        // Remove from photo lists
        const photoListItems = document.querySelectorAll(`[data-photo-filename="${filename}"]`);
        photoListItems.forEach(item => {
            item.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                item.remove();
            }, 300);
        });

        // Update photo counts
        this.updatePhotoCounts();
    }

    /**
     * Update photo counts after deletion
     */
    updatePhotoCounts() {
        const photoGrids = document.querySelectorAll('.photo-grid');
        photoGrids.forEach(grid => {
            const photos = grid.querySelectorAll('.photo-item:not([style*="display: none"])');
            const countElement = grid.parentElement.querySelector('.photo-count');
            if (countElement) {
                const count = photos.length;
                countElement.textContent = `${count} photo${count !== 1 ? 's' : ''}`;
            }
        });
    }

    /**
     * Refresh global storage statistics
     */
    async refreshStorageStats() {
        try {
            console.log('Refreshing storage stats after deletion...');
            
            const response = await fetch('/api/global-storage-stats', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const stats = await response.json();
                console.log('Updated storage stats:', stats);
                
                // Update storage display elements
                const elements = {
                    '.total-storage': stats.combined.totalSizeFormatted,
                    '.gallery-storage': stats.gallery.totalSizeFormatted,
                    '.raw-storage': stats.raw.totalSizeFormatted,
                    '.total-files': stats.combined.fileCount,
                    '.gallery-files': stats.gallery.fileCount,
                    '.raw-files': stats.raw.fileCount
                };
                
                Object.entries(elements).forEach(([selector, value]) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        element.textContent = value;
                    }
                });
                
                // Trigger storage update event for other components
                document.dispatchEvent(new CustomEvent('storageStatsUpdated', { 
                    detail: stats 
                }));
            }
        } catch (error) {
            console.warn('Failed to refresh storage stats:', error);
        }
    }

    /**
     * Verify deletion was complete
     */
    async verifyDeletion(sessionId, folderType, filename) {
        try {
            const response = await fetch(
                `/api/sessions/${sessionId}/files/${folderType}/${encodeURIComponent(filename)}/verify-deletion`,
                { credentials: 'include' }
            );
            
            const result = await response.json();
            
            if (result.success && result.deletionComplete) {
                console.log(` Deletion verified complete: ${filename}`);
                return true;
            } else {
                console.warn(` Deletion verification issues: ${filename}`, result.issues);
                return false;
            }
        } catch (error) {
            console.error('Deletion verification error:', error);
            return false;
        }
    }
}

// Global photo deletion instance
const photoDeletion = new PhotoDeletion();

// Add CSS for fade out animation
if (!document.querySelector('#photo-deletion-styles')) {
    const style = document.createElement('style');
    style.id = 'photo-deletion-styles';
    style.textContent = `
        @keyframes fadeOut {
            from { opacity: 1; transform: scale(1); }
            to { opacity: 0; transform: scale(0.9); }
        }
        
        .delete-button {
            background: #ef4444;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
        }
        
        .delete-button:hover {
            background: #dc2626;
            transform: scale(1.05);
        }
        
        .delete-button:disabled {
            background: #9ca3af;
            cursor: not-allowed;
            transform: none;
        }
        
        .batch-delete-controls {
            margin: 10px 0;
            padding: 10px;
            background: #f9fafb;
            border-radius: 8px;
        }
        
        .batch-delete-button {
            background: #dc2626;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-weight: 500;
        }
        
        .batch-delete-button:hover {
            background: #b91c1c;
        }
    `;
    document.head.appendChild(style);
}

// Utility function to add delete buttons to photo elements
function addDeleteButtons() {
    const photoItems = document.querySelectorAll('.photo-item:not([data-delete-added])');
    
    photoItems.forEach(photoItem => {
        const filename = photoItem.dataset.filename;
        const sessionId = photoItem.dataset.sessionId || getCurrentSessionId();
        const folderType = photoItem.dataset.folderType || 'gallery';
        
        if (filename) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-button';
            deleteBtn.innerHTML = '🗑️ Delete';
            deleteBtn.dataset.deletePhoto = filename;
            deleteBtn.onclick = () => photoDeletion.deletePhoto(sessionId, folderType, filename);
            
            photoItem.appendChild(deleteBtn);
            photoItem.dataset.deleteAdded = 'true';
        }
    });
}

// Auto-initialize delete buttons when DOM loads
document.addEventListener('DOMContentLoaded', addDeleteButtons);

// Re-add buttons when new photos are loaded
document.addEventListener('photosLoaded', addDeleteButtons);