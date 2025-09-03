/**
 * Inline Content Editor for Landing Page
 * Provides secure, visual content editing for admin users
 */

class ContentEditor {
  constructor() {
    this.isEditMode = false;
    this.isAdmin = false;
    this.contentData = {};
    this.editableElements = new Map();
    this.currentUser = null;
    this.apiBaseUrl = '/api/content';
    
    // Initialize editor
    this.init();
  }

  async init() {
    try {
      console.log('🎨 CONTENT EDITOR: Initializing...');
      
      // Check authentication and load content
      await this.checkAdminAccess();
      await this.loadContent();
      
      if (this.isAdmin) {
        this.setupAdminInterface();
        this.makeElementsEditable();
      }
      
      console.log('✅ CONTENT EDITOR: Initialized successfully');
      
    } catch (error) {
      console.error('❌ CONTENT EDITOR: Initialization failed:', error);
    }
  }

  async checkAdminAccess() {
    try {
      // Check if user is authenticated with Firebase
      if (typeof firebase !== 'undefined' && firebase.auth) {
        const user = firebase.auth().currentUser;
        if (user) {
          this.currentUser = user;
          
          // Get ID token for API authentication
          const idToken = await user.getIdToken();
          
          // Store token for API requests
          this.authToken = idToken;
          
          console.log('🔐 CONTENT EDITOR: User authenticated:', user.email);
        }
      }
    } catch (error) {
      console.error('⚠️ CONTENT EDITOR: Auth check failed:', error);
    }
  }

  async loadContent() {
    try {
      const headers = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(this.apiBaseUrl, { headers });
      const data = await response.json();
      
      if (response.ok) {
        this.contentData = data.content || {};
        this.isAdmin = data.isAdmin || false;
        
        console.log('📄 CONTENT EDITOR: Content loaded', {
          contentItems: Object.keys(this.contentData).length,
          isAdmin: this.isAdmin
        });
        
        // Apply content to page elements
        this.applyContentToPage();
        
      } else {
        console.error('❌ CONTENT EDITOR: Failed to load content:', data);
      }
      
    } catch (error) {
      console.error('❌ CONTENT EDITOR: Error loading content:', error);
    }
  }

  applyContentToPage() {
    // Apply loaded content to page elements
    Object.entries(this.contentData).forEach(([key, data]) => {
      const element = document.querySelector(`[data-content-key="${key}"]`);
      if (element) {
        if (data.type === 'image_url') {
          element.src = data.value;
        } else if (data.type === 'html') {
          element.innerHTML = data.value;
        } else {
          element.textContent = data.value;
        }
      }
    });
  }

  setupAdminInterface() {
    // Show admin edit button
    this.showAdminEditButton();
    
    // Create admin toolbar
    this.createAdminToolbar();
    
    // Add admin styles
    this.addAdminStyles();
    
    console.log('🛠️ CONTENT EDITOR: Admin interface created');
  }

  showAdminEditButton() {
    const adminButton = document.getElementById('admin-edit-button');
    if (adminButton) {
      adminButton.style.display = 'block';
      console.log('🔧 CONTENT EDITOR: Admin edit button shown');
    }
  }

  createAdminToolbar() {
    // Remove existing toolbar
    const existingToolbar = document.getElementById('content-editor-toolbar');
    if (existingToolbar) {
      existingToolbar.remove();
    }

    // Create new toolbar
    const toolbar = document.createElement('div');
    toolbar.id = 'content-editor-toolbar';
    toolbar.className = 'content-editor-toolbar';
    toolbar.innerHTML = `
      <div class="toolbar-content">
        <div class="toolbar-left">
          <span class="toolbar-logo">✏️ Content Editor</span>
          <span class="toolbar-status" id="edit-status">View Mode</span>
        </div>
        <div class="toolbar-right">
          <button id="toggle-edit-mode" class="toolbar-btn primary">
            Enable Edit Mode
          </button>
          <button id="save-all-changes" class="toolbar-btn success" style="display: none;">
            💾 Save All
          </button>
          <button id="cancel-changes" class="toolbar-btn danger" style="display: none;">
            ❌ Cancel
          </button>
        </div>
      </div>
    `;

    // Insert toolbar at top of page
    document.body.insertBefore(toolbar, document.body.firstChild);

    // Add event listeners
    this.setupToolbarEvents();
    
    // Adjust body padding for toolbar
    document.body.style.paddingTop = '60px';
  }

  setupToolbarEvents() {
    const toggleBtn = document.getElementById('toggle-edit-mode');
    const saveBtn = document.getElementById('save-all-changes');
    const cancelBtn = document.getElementById('cancel-changes');

    toggleBtn.addEventListener('click', () => {
      this.toggleEditMode();
    });

    saveBtn.addEventListener('click', () => {
      this.saveAllChanges();
    });

    cancelBtn.addEventListener('click', () => {
      this.cancelChanges();
    });
  }

  toggleEditMode() {
    this.isEditMode = !this.isEditMode;
    
    const toggleBtn = document.getElementById('toggle-edit-mode');
    const saveBtn = document.getElementById('save-all-changes');
    const cancelBtn = document.getElementById('cancel-changes');
    const statusSpan = document.getElementById('edit-status');

    if (this.isEditMode) {
      // Enable edit mode
      toggleBtn.textContent = 'Exit Edit Mode';
      toggleBtn.className = 'toolbar-btn warning';
      saveBtn.style.display = 'inline-block';
      cancelBtn.style.display = 'inline-block';
      statusSpan.textContent = 'Edit Mode';
      statusSpan.className = 'toolbar-status editing';
      
      this.enableInlineEditing();
      this.showEditingInstructions();
      
    } else {
      // Disable edit mode
      toggleBtn.textContent = 'Enable Edit Mode';
      toggleBtn.className = 'toolbar-btn primary';
      saveBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      statusSpan.textContent = 'View Mode';
      statusSpan.className = 'toolbar-status';
      
      this.disableInlineEditing();
      this.hideEditingInstructions();
    }

    console.log(`🎛️ CONTENT EDITOR: Edit mode ${this.isEditMode ? 'enabled' : 'disabled'}`);
  }

  makeElementsEditable() {
    // Find all elements with data-content-key attributes
    const editableElements = document.querySelectorAll('[data-content-key]');
    
    editableElements.forEach(element => {
      const contentKey = element.getAttribute('data-content-key');
      const contentType = this.contentData[contentKey]?.type || 'text';
      
      // Store element info
      this.editableElements.set(contentKey, {
        element: element,
        type: contentType,
        originalValue: element.textContent || element.innerHTML,
        hasChanges: false
      });
      
      // Add visual indicator for admin
      element.classList.add('content-editable-element');
      element.setAttribute('title', `Editable: ${contentKey}`);
    });

    console.log(`🎯 CONTENT EDITOR: Found ${editableElements.length} editable elements`);
  }

  enableInlineEditing() {
    this.editableElements.forEach((data, contentKey) => {
      const { element, type } = data;
      
      if (type === 'image_url') {
        this.makeImageEditable(element, contentKey);
      } else {
        this.makeTextEditable(element, contentKey);
      }
      
      // Add editing visual indicators
      element.classList.add('editing-active');
    });
  }

  makeTextEditable(element, contentKey) {
    const data = this.editableElements.get(contentKey);
    
    // Make element editable
    element.contentEditable = true;
    element.spellcheck = false;
    
    // Add editing events
    element.addEventListener('input', (e) => {
      data.hasChanges = true;
      this.markAsChanged(element);
    });
    
    element.addEventListener('blur', (e) => {
      this.validateTextContent(element, contentKey);
    });
    
    element.addEventListener('keydown', (e) => {
      // Prevent Enter key for single-line text
      if (e.key === 'Enter' && data.type === 'text') {
        e.preventDefault();
      }
      
      // Save on Ctrl+S
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.saveChanges(contentKey);
      }
    });
  }

  makeImageEditable(element, contentKey) {
    const data = this.editableElements.get(contentKey);
    
    // Create image edit overlay
    const overlay = document.createElement('div');
    overlay.className = 'image-edit-overlay';
    overlay.innerHTML = `
      <div class="image-edit-controls">
        <input type="text" class="image-url-input" placeholder="Enter image URL..." 
               value="${element.src}">
        <button class="apply-image-btn">Apply</button>
      </div>
    `;
    
    // Position overlay
    element.style.position = 'relative';
    element.appendChild(overlay);
    
    // Handle image URL changes
    const urlInput = overlay.querySelector('.image-url-input');
    const applyBtn = overlay.querySelector('.apply-image-btn');
    
    applyBtn.addEventListener('click', () => {
      const newUrl = urlInput.value.trim();
      if (newUrl && this.isValidImageUrl(newUrl)) {
        element.src = newUrl;
        data.hasChanges = true;
        this.markAsChanged(element);
      }
    });
    
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        applyBtn.click();
      }
    });
  }

  disableInlineEditing() {
    this.editableElements.forEach((data, contentKey) => {
      const { element } = data;
      
      // Remove editing capabilities
      element.contentEditable = false;
      element.classList.remove('editing-active');
      
      // Remove image edit overlays
      const overlay = element.querySelector('.image-edit-overlay');
      if (overlay) {
        overlay.remove();
      }
    });
  }

  markAsChanged(element) {
    element.classList.add('content-changed');
    
    // Show save buttons
    document.getElementById('save-all-changes').style.display = 'inline-block';
    document.getElementById('cancel-changes').style.display = 'inline-block';
  }

  async saveAllChanges() {
    try {
      console.log('💾 CONTENT EDITOR: Saving all changes...');
      
      const savePromises = [];
      
      this.editableElements.forEach((data, contentKey) => {
        if (data.hasChanges) {
          const newValue = this.getElementValue(data.element, data.type);
          savePromises.push(this.saveContentItem(contentKey, newValue, data.type));
        }
      });
      
      if (savePromises.length === 0) {
        this.showNotification('No changes to save', 'info');
        return;
      }
      
      // Save all changes
      await Promise.all(savePromises);
      
      // Update UI
      this.editableElements.forEach((data, contentKey) => {
        if (data.hasChanges) {
          data.hasChanges = false;
          data.element.classList.remove('content-changed');
        }
      });
      
      this.showNotification(`Saved ${savePromises.length} changes successfully!`, 'success');
      console.log('✅ CONTENT EDITOR: All changes saved');
      
    } catch (error) {
      console.error('❌ CONTENT EDITOR: Error saving changes:', error);
      this.showNotification('Error saving changes: ' + error.message, 'error');
    }
  }

  async saveContentItem(contentKey, value, type) {
    const data = this.contentData[contentKey];
    const section = data ? data.section : this.guessSection(contentKey);
    
    const response = await fetch(`${this.apiBaseUrl}/${contentKey}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        value: value,
        type: type,
        section: section,
        reason: 'Inline edit via content editor'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save content');
    }
    
    return response.json();
  }

  cancelChanges() {
    // Restore original values
    this.editableElements.forEach((data, contentKey) => {
      if (data.hasChanges) {
        if (data.type === 'image_url') {
          data.element.src = this.contentData[contentKey]?.value || data.originalValue;
        } else {
          data.element.textContent = this.contentData[contentKey]?.value || data.originalValue;
        }
        
        data.hasChanges = false;
        data.element.classList.remove('content-changed');
      }
    });
    
    this.showNotification('Changes cancelled', 'info');
  }

  getElementValue(element, type) {
    if (type === 'image_url') {
      return element.src;
    } else if (type === 'html') {
      return element.innerHTML;
    } else {
      return element.textContent;
    }
  }

  guessSection(contentKey) {
    if (contentKey.startsWith('nav.')) return 'navigation';
    if (contentKey.startsWith('hero.')) return 'hero';
    if (contentKey.startsWith('features.')) return 'features';
    if (contentKey.startsWith('about.')) return 'about';
    if (contentKey.startsWith('pricing.')) return 'pricing';
    if (contentKey.startsWith('contact.')) return 'contact';
    if (contentKey.startsWith('footer.')) return 'footer';
    return 'general';
  }

  isValidImageUrl(url) {
    try {
      new URL(url);
      return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) || url.includes('unsplash.com');
    } catch {
      return false;
    }
  }

  validateTextContent(element, contentKey) {
    const content = element.textContent.trim();
    
    if (content.length === 0) {
      this.showNotification('Content cannot be empty', 'warning');
      element.textContent = this.editableElements.get(contentKey).originalValue;
      return false;
    }
    
    if (content.length > 2000) {
      this.showNotification('Content too long (max 2000 characters)', 'warning');
      element.textContent = content.substring(0, 2000);
    }
    
    return true;
  }

  showEditingInstructions() {
    const instructions = document.createElement('div');
    instructions.id = 'editing-instructions';
    instructions.className = 'editing-instructions';
    instructions.innerHTML = `
      <div class="instructions-content">
        <h4>📝 Editing Instructions</h4>
        <ul>
          <li>Click any highlighted text to edit it directly</li>
          <li>For images, click to change the URL</li>
          <li>Use Ctrl+S to save individual items</li>
          <li>Click "Save All" to save all changes at once</li>
          <li>Click "Cancel" to discard all changes</li>
        </ul>
        <button onclick="this.closest('.editing-instructions').style.display='none'">Got it!</button>
      </div>
    `;
    
    document.body.appendChild(instructions);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (instructions.parentNode) {
        instructions.style.display = 'none';
      }
    }, 10000);
  }

  hideEditingInstructions() {
    const instructions = document.getElementById('editing-instructions');
    if (instructions) {
      instructions.remove();
    }
  }

  showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.content-editor-notification');
    existing.forEach(n => n.remove());
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `content-editor-notification ${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  addAdminStyles() {
    if (document.getElementById('content-editor-styles')) {
      return; // Already added
    }

    const styles = document.createElement('style');
    styles.id = 'content-editor-styles';
    styles.textContent = `
      /* Content Editor Toolbar */
      .content-editor-toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #1a1a1a;
        border-bottom: 2px solid #d4af37;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      }
      
      .toolbar-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 20px;
        max-width: 1200px;
        margin: 0 auto;
      }
      
      .toolbar-left {
        display: flex;
        align-items: center;
        gap: 15px;
      }
      
      .toolbar-logo {
        color: #d4af37;
        font-weight: 600;
        font-size: 1.1rem;
      }
      
      .toolbar-status {
        color: #ccc;
        font-size: 0.9rem;
        padding: 4px 8px;
        border-radius: 4px;
        background: rgba(255,255,255,0.1);
      }
      
      .toolbar-status.editing {
        background: #28a745;
        color: white;
        animation: pulse 2s infinite;
      }
      
      .toolbar-right {
        display: flex;
        gap: 10px;
      }
      
      .toolbar-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 0.9rem;
      }
      
      .toolbar-btn.primary {
        background: #d4af37;
        color: #1a1a1a;
      }
      
      .toolbar-btn.success {
        background: #28a745;
        color: white;
      }
      
      .toolbar-btn.warning {
        background: #ffc107;
        color: #1a1a1a;
      }
      
      .toolbar-btn.danger {
        background: #dc3545;
        color: white;
      }
      
      .toolbar-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      }
      
      /* Editable Elements */
      .content-editable-element {
        position: relative;
        transition: all 0.3s ease;
      }
      
      .content-editable-element:hover {
        outline: 2px dashed #d4af37;
        outline-offset: 2px;
      }
      
      .editing-active {
        outline: 2px solid #28a745;
        outline-offset: 2px;
        background: rgba(40, 167, 69, 0.1);
      }
      
      .content-changed {
        outline: 2px solid #ffc107;
        outline-offset: 2px;
        background: rgba(255, 193, 7, 0.1);
      }
      
      /* Image Editing */
      .image-edit-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px;
      }
      
      .image-edit-controls {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      
      .image-url-input {
        padding: 8px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 0.9rem;
        min-width: 300px;
      }
      
      .apply-image-btn {
        padding: 8px 16px;
        background: #28a745;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
      }
      
      /* Instructions */
      .editing-instructions {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        border: 2px solid #d4af37;
        border-radius: 10px;
        padding: 20px;
        max-width: 350px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 9999;
      }
      
      .instructions-content h4 {
        margin: 0 0 10px 0;
        color: #1a1a1a;
      }
      
      .instructions-content ul {
        margin: 10px 0;
        padding-left: 20px;
        color: #666;
      }
      
      .instructions-content button {
        background: #d4af37;
        color: #1a1a1a;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        margin-top: 10px;
      }
      
      /* Notifications */
      .content-editor-notification {
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 9998;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideInRight 0.3s ease;
      }
      
      .content-editor-notification.success {
        background: #28a745;
      }
      
      .content-editor-notification.error {
        background: #dc3545;
      }
      
      .content-editor-notification.warning {
        background: #ffc107;
        color: #1a1a1a;
      }
      
      .content-editor-notification.info {
        background: #17a2b8;
      }
      
      /* Animations */
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      
      @keyframes slideInRight {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      
      /* Mobile Responsiveness */
      @media (max-width: 768px) {
        .toolbar-content {
          flex-direction: column;
          gap: 10px;
          padding: 15px;
        }
        
        .toolbar-right {
          width: 100%;
          justify-content: center;
        }
        
        .content-editor-toolbar {
          position: relative;
        }
        
        body {
          padding-top: 120px !important;
        }
        
        .editing-instructions {
          bottom: 10px;
          right: 10px;
          left: 10px;
          max-width: none;
        }
        
        .image-url-input {
          min-width: 200px;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }

  toggleEditMode() {
    this.isEditMode = !this.isEditMode;
    
    const adminButton = document.getElementById('admin-edit-button');
    const toolbar = document.getElementById('content-editor-toolbar');
    
    if (this.isEditMode) {
      // Enter edit mode
      adminButton.classList.add('edit-mode-active');
      if (toolbar) toolbar.style.display = 'block';
      this.enableEditing();
      console.log('✏️ CONTENT EDITOR: Edit mode enabled');
    } else {
      // Exit edit mode
      adminButton.classList.remove('edit-mode-active');
      if (toolbar) toolbar.style.display = 'none';
      this.disableEditing();
      console.log('👁️ CONTENT EDITOR: Edit mode disabled');
    }
  }

  enableEditing() {
    // Add editing indicators to all editable elements
    this.editableElements.forEach((element, key) => {
      element.classList.add('content-editable-hover');
    });
    
    // Show editing instructions
    this.showEditingInstructions();
  }

  disableEditing() {
    // Remove editing indicators
    this.editableElements.forEach((element, key) => {
      element.classList.remove('content-editable-hover', 'content-editing');
    });
    
    // Hide editing instructions
    this.hideEditingInstructions();
  }

  showEditingInstructions() {
    let instructions = document.getElementById('editing-instructions');
    if (!instructions) {
      instructions = document.createElement('div');
      instructions.id = 'editing-instructions';
      instructions.className = 'editing-instructions';
      instructions.innerHTML = `
        <div class="instructions-content">
          <h4>🎨 Edit Mode Active</h4>
          <p>Click any highlighted text to edit it directly!</p>
          <button onclick="window.contentEditor.toggleEditMode()" class="btn-exit-edit">
            Exit Edit Mode
          </button>
        </div>
      `;
      document.body.appendChild(instructions);
    }
    instructions.style.display = 'block';
  }

  hideEditingInstructions() {
    const instructions = document.getElementById('editing-instructions');
    if (instructions) {
      instructions.style.display = 'none';
    }
  }
}

// Global function for button onclick
function toggleEditMode() {
  if (window.contentEditor && window.contentEditor.isAdmin) {
    window.contentEditor.toggleEditMode();
  } else {
    console.warn('⚠️ CONTENT EDITOR: Only admin users can toggle edit mode');
  }
}

// Initialize content editor when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if not in iframe (to avoid conflicts)
  if (window.self === window.top) {
    window.contentEditor = new ContentEditor();
  }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentEditor;
}