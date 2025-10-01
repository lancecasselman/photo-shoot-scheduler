/**
 * Storage Quota Checker for Upload Forms
 * Prevents uploads when user exceeds quota and shows upgrade prompts
 */

class StorageQuotaChecker {
    constructor() {
        this.quotaInfo = null;
        this.lastChecked = 0;
        this.cacheTimeout = 30000; // 30 seconds cache
    }

    /**
     * Check if user can upload files of given total size
     */
    async checkUploadQuota(totalSizeBytes) {
        try {
            const response = await fetch('/api/storage/check-upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ fileSizeBytes: totalSizeBytes })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to check quota');
            }

            this.quotaInfo = result;
            this.lastChecked = Date.now();

            return result;
        } catch (error) {
            console.error('Error checking upload quota:', error);
            throw error;
        }
    }

    /**
     * Get cached or fresh quota information
     */
    async getQuotaInfo() {
        if (this.quotaInfo && (Date.now() - this.lastChecked) < this.cacheTimeout) {
            return this.quotaInfo;
        }

        try {
            const response = await fetch('/api/storage/summary', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to get storage summary');
            }

            const summary = await response.json();
            this.quotaInfo = summary;
            this.lastChecked = Date.now();

            return summary;
        } catch (error) {
            console.error('Error getting quota info:', error);
            throw error;
        }
    }

    /**
     * Check files before upload and show warnings/errors
     */
    async validateUpload(files) {
        if (!files || files.length === 0) {
            return { canUpload: true, message: 'No files to upload' };
        }

        const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
        const totalSizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(3);
        
        console.log(`📊 Validating upload: ${files.length} files, ${totalSizeGB}GB total`);
        
        try {
            const quotaCheck = await this.checkUploadQuota(totalSize);
            
            if (!quotaCheck.canUpload) {
                return {
                    canUpload: false,
                    error: 'Storage quota exceeded',
                    currentUsageGB: quotaCheck.currentUsageGB,
                    quotaGB: quotaCheck.quotaGB,
                    uploadSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                    message: `Upload would exceed your ${quotaCheck.quotaGB}GB storage limit.`,
                    upgradeRequired: true
                };
            }

            if (quotaCheck.isNearLimit) {
                return {
                    canUpload: true,
                    warning: true,
                    currentUsageGB: quotaCheck.currentUsageGB,
                    quotaGB: quotaCheck.quotaGB,
                    remainingGB: quotaCheck.remainingGB,
                    message: `Warning: You're using ${((quotaCheck.currentUsageGB / quotaCheck.quotaGB) * 100).toFixed(1)}% of your storage.`
                };
            }

            return {
                canUpload: true,
                currentUsageGB: quotaCheck.currentUsageGB,
                quotaGB: quotaCheck.quotaGB
            };
        } catch (error) {
            // If quota check fails, allow upload (fail-safe)
            console.error('Quota validation failed, allowing upload:', error);
            return {
                canUpload: true,
                message: 'Quota check unavailable, proceeding with upload'
            };
        }
    }

    /**
     * Show storage quota exceeded modal
     */
    showQuotaExceededModal(quotaInfo) {
        const modal = document.createElement('div');
        modal.className = 'quota-modal-overlay';
        modal.innerHTML = `
            <div class="quota-modal">
                <div class="quota-modal-header">
                    <h2>Storage Limit Reached</h2>
                    <button class="quota-modal-close">&times;</button>
                </div>
                <div class="quota-modal-body">
                    <div class="quota-usage-bar">
                        <div class="quota-bar">
                            <div class="quota-fill" style="width: ${Math.min(100, (quotaInfo.currentUsageGB / quotaInfo.quotaGB) * 100)}%"></div>
                        </div>
                        <div class="quota-text">${quotaInfo.currentUsageGB}GB / ${quotaInfo.quotaGB}GB used</div>
                    </div>
                    <p>You've reached your storage limit. Upgrade your plan to continue uploading photos.</p>
                    <p><strong>Upload size:</strong> ${quotaInfo.uploadSizeMB}MB</p>
                </div>
                <div class="quota-modal-footer">
                    <button class="btn btn-secondary quota-modal-close">Cancel</button>
                    <button class="btn btn-primary" onclick="window.open('/storage-dashboard.html', '_blank')">Upgrade Storage</button>
                </div>
            </div>
        `;

        // Add styles if not already present
        if (!document.getElementById('quota-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'quota-modal-styles';
            styles.textContent = `
                .quota-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                .quota-modal {
                    background: white;
                    border-radius: 10px;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }
                .quota-modal-header {
                    padding: 20px;
                    border-bottom: 1px solid #eee;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .quota-modal-header h2 {
                    margin: 0;
                    color: #e74c3c;
                }
                .quota-modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #999;
                }
                .quota-modal-body {
                    padding: 20px;
                }
                .quota-usage-bar {
                    margin: 15px 0;
                }
                .quota-bar {
                    height: 10px;
                    background: #f0f0f0;
                    border-radius: 5px;
                    overflow: hidden;
                    margin-bottom: 5px;
                }
                .quota-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #e74c3c, #c0392b);
                    transition: width 0.3s ease;
                }
                .quota-text {
                    font-size: 14px;
                    color: #666;
                    text-align: center;
                }
                .quota-modal-footer {
                    padding: 20px;
                    border-top: 1px solid #eee;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: 600;
                }
                .btn-primary {
                    background: #3498db;
                    color: white;
                }
                .btn-secondary {
                    background: #95a5a6;
                    color: white;
                }
            `;
            document.head.appendChild(styles);
        }

        // Close modal handlers
        const closeModal = () => modal.remove();
        modal.querySelectorAll('.quota-modal-close').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        document.body.appendChild(modal);
    }

    /**
     * Show storage warning notification
     */
    showStorageWarning(quotaInfo) {
        const warning = document.createElement('div');
        warning.className = 'storage-warning';
        warning.innerHTML = `
            <div class="warning-content">
                <strong>Storage Warning:</strong> ${quotaInfo.message}
                <button class="warning-close">&times;</button>
            </div>
        `;

        // Add warning styles if not present
        if (!document.getElementById('storage-warning-styles')) {
            const styles = document.createElement('style');
            styles.id = 'storage-warning-styles';
            styles.textContent = `
                .storage-warning {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #f39c12;
                    color: white;
                    padding: 15px;
                    border-radius: 5px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 9999;
                    max-width: 400px;
                }
                .warning-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .warning-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    margin-left: 10px;
                }
            `;
            document.head.appendChild(styles);
        }

        warning.querySelector('.warning-close').addEventListener('click', () => {
            warning.remove();
        });

        // Auto-remove after 10 seconds
        setTimeout(() => warning.remove(), 10000);

        document.body.appendChild(warning);
    }
}

// Create global instance
window.StorageQuotaChecker = StorageQuotaChecker;
window.storageQuotaChecker = new StorageQuotaChecker();