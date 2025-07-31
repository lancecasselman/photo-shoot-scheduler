// Comprehensive Post-Subscription Onboarding System
// This ensures new subscribers have zero issues getting started

const OnboardingFlow = {
    currentStep: 0,
    userData: {},
    
    steps: [
        {
            id: 'welcome',
            title: ' Welcome to Photography Management System!',
            subtitle: 'Your subscription is active. Let\'s get you set up in 5 minutes.',
            content: `
                <div class="welcome-content">
                    <div class="feature-grid">
                        <div class="feature-card">
                            <span class="feature-icon"></span>
                            <h3>Session Management</h3>
                            <p>Track all your photography sessions</p>
                        </div>
                        <div class="feature-card">
                            <span class="feature-icon"></span>
                            <h3>Invoicing & Payments</h3>
                            <p>Get paid faster with Stripe</p>
                        </div>
                        <div class="feature-card">
                            <span class="feature-icon"></span>
                            <h3>Website Builder</h3>
                            <p>Create stunning portfolio sites</p>
                        </div>
                        <div class="feature-card">
                            <span class="feature-icon"></span>
                            <h3>Client Galleries</h3>
                            <p>Share photos beautifully</p>
                        </div>
                    </div>
                    <button class="cta-button" onclick="OnboardingFlow.startQuickSetup()">
                        Start Quick Setup →
                    </button>
                </div>
            `,
            skipable: false
        },
        {
            id: 'business-basics',
            title: ' Business Basics',
            subtitle: 'Tell us about your photography business',
            fields: [
                {
                    name: 'businessName',
                    label: 'Business Name',
                    type: 'text',
                    placeholder: 'e.g., Sunset Photography Studio',
                    required: true,
                    validation: (value) => value.length >= 2
                },
                {
                    name: 'businessType',
                    label: 'Primary Photography Type',
                    type: 'select',
                    options: [
                        { value: 'wedding', label: ' Wedding Photography' },
                        { value: 'portrait', label: ' Portrait Photography' },
                        { value: 'family', label: ' Family Photography' },
                        { value: 'commercial', label: ' Commercial Photography' },
                        { value: 'event', label: ' Event Photography' },
                        { value: 'mixed', label: ' Multiple Specialties' }
                    ],
                    required: true
                },
                {
                    name: 'location',
                    label: 'Business Location',
                    type: 'text',
                    placeholder: 'e.g., Charleston, SC',
                    required: true
                }
            ]
        },
        {
            id: 'quick-branding',
            title: ' Quick Branding',
            subtitle: 'Personalize your platform (you can change this anytime)',
            fields: [
                {
                    name: 'logo',
                    label: 'Upload Logo (Optional)',
                    type: 'file',
                    accept: 'image/*',
                    preview: true,
                    required: false
                },
                {
                    name: 'primaryColor',
                    label: 'Brand Color',
                    type: 'color-preset',
                    presets: [
                        { color: '#d4af37', name: 'Classic Gold' },
                        { color: '#8B7355', name: 'Warm Brown' },
                        { color: '#4a90e2', name: 'Sky Blue' },
                        { color: '#7cb342', name: 'Nature Green' },
                        { color: '#e91e63', name: 'Rose Pink' },
                        { color: '#9c27b0', name: 'Royal Purple' }
                    ],
                    required: true
                }
            ]
        },
        {
            id: 'session-defaults',
            title: ' Default Pricing',
            subtitle: 'Set your standard rates (easily adjustable per session)',
            fields: [
                {
                    name: 'defaultSessionPrice',
                    label: 'Standard Session Price',
                    type: 'currency',
                    placeholder: '250',
                    required: true,
                    validation: (value) => value > 0
                },
                {
                    name: 'defaultDeposit',
                    label: 'Standard Deposit',
                    type: 'currency',
                    placeholder: '50',
                    required: true,
                    hint: 'Usually 20-30% of session price'
                },
                {
                    name: 'sessionDuration',
                    label: 'Default Session Duration',
                    type: 'select',
                    options: [
                        { value: '1', label: '1 Hour' },
                        { value: '2', label: '2 Hours' },
                        { value: '3', label: '3 Hours' },
                        { value: '4', label: '4 Hours' },
                        { value: '8', label: 'Full Day (8 Hours)' }
                    ],
                    required: true
                }
            ]
        },
        {
            id: 'quick-start',
            title: ' Ready to Go!',
            subtitle: 'You\'re all set! Here\'s what to do next:',
            content: `
                <div class="completion-content">
                    <div class="next-steps">
                        <h3>Quick Start Guide:</h3>
                        <div class="step-item">
                            <span class="step-number">1</span>
                            <div class="step-content">
                                <h4>Add Your First Session</h4>
                                <p>Click "Add New Session" to schedule your first client</p>
                            </div>
                        </div>
                        <div class="step-item">
                            <span class="step-number">2</span>
                            <div class="step-content">
                                <h4>Build Your Website</h4>
                                <p>Use our drag-and-drop builder to create your portfolio</p>
                            </div>
                        </div>
                        <div class="step-item">
                            <span class="step-number">3</span>
                            <div class="step-content">
                                <h4>Connect Payment Processing</h4>
                                <p>Set up Stripe to accept payments online</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="action-buttons">
                        <button class="secondary-button" onclick="OnboardingFlow.watchTutorial()">
                            📹 Watch 2-Min Tutorial
                        </button>
                        <button class="primary-button" onclick="OnboardingFlow.completeOnboarding()">
                             Go to Dashboard
                        </button>
                    </div>
                    
                    <div class="help-section">
                        <p>Need help? <a href="#" onclick="OnboardingFlow.openSupport()">Chat with us</a> or email support@photomanagementsystem.com</p>
                    </div>
                </div>
            `
        }
    ],
    
    init() {
        // Check if user needs onboarding
        this.checkOnboardingStatus();
    },
    
    async checkOnboardingStatus() {
        try {
            const response = await fetch('/api/onboarding/status');
            const data = await response.json();
            
            if (!data.completed) {
                this.showOnboardingModal();
            }
        } catch (error) {
            console.error('Error checking onboarding status:', error);
        }
    },
    
    showOnboardingModal() {
        const modal = document.createElement('div');
        modal.className = 'onboarding-modal';
        modal.innerHTML = `
            <div class="onboarding-backdrop"></div>
            <div class="onboarding-container">
                <div class="onboarding-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${((this.currentStep + 1) / this.steps.length) * 100}%"></div>
                    </div>
                    <span class="progress-text">Step ${this.currentStep + 1} of ${this.steps.length}</span>
                </div>
                
                <div class="onboarding-content" id="onboardingContent">
                    ${this.renderCurrentStep()}
                </div>
                
                <div class="onboarding-navigation">
                    <button class="nav-button back" onclick="OnboardingFlow.previousStep()" 
                            ${this.currentStep === 0 ? 'disabled' : ''}>
                        ← Back
                    </button>
                    <button class="nav-button next" onclick="OnboardingFlow.nextStep()">
                        ${this.currentStep === this.steps.length - 1 ? 'Complete Setup' : 'Continue →'}
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.attachStyles();
    },
    
    renderCurrentStep() {
        const step = this.steps[this.currentStep];
        let html = `
            <h2>${step.title}</h2>
            <p class="subtitle">${step.subtitle}</p>
        `;
        
        if (step.content) {
            html += step.content;
        } else if (step.fields) {
            html += '<form class="onboarding-form">';
            step.fields.forEach(field => {
                html += this.renderField(field);
            });
            html += '</form>';
        }
        
        return html;
    },
    
    renderField(field) {
        switch (field.type) {
            case 'text':
            case 'email':
            case 'tel':
                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label} ${field.required ? '*' : ''}</label>
                        <input type="${field.type}" 
                               id="${field.name}" 
                               name="${field.name}"
                               placeholder="${field.placeholder || ''}"
                               ${field.required ? 'required' : ''}
                               value="${this.userData[field.name] || ''}">
                        ${field.hint ? `<small class="hint">${field.hint}</small>` : ''}
                    </div>
                `;
                
            case 'select':
                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label} ${field.required ? '*' : ''}</label>
                        <select id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>
                            <option value="">Choose...</option>
                            ${field.options.map(opt => `
                                <option value="${opt.value}" ${this.userData[field.name] === opt.value ? 'selected' : ''}>
                                    ${opt.label}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                `;
                
            case 'currency':
                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label} ${field.required ? '*' : ''}</label>
                        <div class="currency-input">
                            <span class="currency-symbol">$</span>
                            <input type="number" 
                                   id="${field.name}" 
                                   name="${field.name}"
                                   placeholder="${field.placeholder || '0'}"
                                   min="0"
                                   step="0.01"
                                   ${field.required ? 'required' : ''}
                                   value="${this.userData[field.name] || ''}">
                        </div>
                        ${field.hint ? `<small class="hint">${field.hint}</small>` : ''}
                    </div>
                `;
                
            case 'color-preset':
                return `
                    <div class="form-group">
                        <label>${field.label} ${field.required ? '*' : ''}</label>
                        <div class="color-preset-grid">
                            ${field.presets.map(preset => `
                                <div class="color-preset ${this.userData[field.name] === preset.color ? 'selected' : ''}"
                                     onclick="OnboardingFlow.selectColor('${field.name}', '${preset.color}')"
                                     style="background-color: ${preset.color}">
                                    <span class="color-name">${preset.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                
            case 'file':
                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label} ${field.required ? '*' : ''}</label>
                        <div class="file-upload-area">
                            <input type="file" 
                                   id="${field.name}" 
                                   name="${field.name}"
                                   accept="${field.accept || '*'}"
                                   onchange="OnboardingFlow.handleFileUpload(event, '${field.name}')"
                                   ${field.required ? 'required' : ''}>
                            <label for="${field.name}" class="file-upload-label">
                                <span class="upload-icon">📁</span>
                                <span>Click to upload or drag and drop</span>
                            </label>
                            <div id="${field.name}-preview" class="file-preview"></div>
                        </div>
                    </div>
                `;
                
            default:
                return '';
        }
    },
    
    selectColor(fieldName, color) {
        this.userData[fieldName] = color;
        document.querySelectorAll('.color-preset').forEach(el => {
            el.classList.remove('selected');
        });
        event.target.closest('.color-preset').classList.add('selected');
    },
    
    handleFileUpload(event, fieldName) {
        const file = event.target.files[0];
        if (file) {
            this.userData[fieldName] = file;
            
            // Show preview for images
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.getElementById(`${fieldName}-preview`);
                    preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                };
                reader.readAsDataURL(file);
            }
        }
    },
    
    startQuickSetup() {
        this.currentStep = 1;
        this.updateModal();
    },
    
    async nextStep() {
        // Validate current step
        if (!this.validateCurrentStep()) {
            return;
        }
        
        // Save current step data
        this.saveStepData();
        
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.updateModal();
        } else {
            await this.completeOnboarding();
        }
    },
    
    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateModal();
        }
    },
    
    validateCurrentStep() {
        const step = this.steps[this.currentStep];
        if (!step.fields) return true;
        
        let isValid = true;
        step.fields.forEach(field => {
            if (field.required) {
                const element = document.getElementById(field.name);
                if (!element || !element.value) {
                    element?.classList.add('error');
                    isValid = false;
                } else {
                    element.classList.remove('error');
                }
                
                // Run custom validation if provided
                if (field.validation && element?.value) {
                    if (!field.validation(element.value)) {
                        element.classList.add('error');
                        isValid = false;
                    }
                }
            }
        });
        
        return isValid;
    },
    
    saveStepData() {
        const step = this.steps[this.currentStep];
        if (!step.fields) return;
        
        step.fields.forEach(field => {
            const element = document.getElementById(field.name);
            if (element) {
                this.userData[field.name] = element.value;
            }
        });
    },
    
    updateModal() {
        const content = document.getElementById('onboardingContent');
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        const backButton = document.querySelector('.nav-button.back');
        const nextButton = document.querySelector('.nav-button.next');
        
        // Update content
        content.innerHTML = this.renderCurrentStep();
        
        // Update progress
        const progress = ((this.currentStep + 1) / this.steps.length) * 100;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `Step ${this.currentStep + 1} of ${this.steps.length}`;
        
        // Update navigation
        backButton.disabled = this.currentStep === 0;
        nextButton.textContent = this.currentStep === this.steps.length - 1 ? 'Complete Setup' : 'Continue →';
    },
    
    async completeOnboarding() {
        try {
            // Save all onboarding data
            const response = await fetch('/api/onboarding/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.userData)
            });
            
            if (response.ok) {
                // Close modal
                document.querySelector('.onboarding-modal').remove();
                
                // Show success message
                this.showSuccessMessage();
                
                // Reload the page to apply settings
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        } catch (error) {
            console.error('Error completing onboarding:', error);
        }
    },
    
    showSuccessMessage() {
        const message = document.createElement('div');
        message.className = 'success-toast';
        message.innerHTML = `
            <div class="success-content">
                <span class="success-icon"></span>
                <span>Setup complete! Loading your dashboard...</span>
            </div>
        `;
        document.body.appendChild(message);
        
        setTimeout(() => message.remove(), 3000);
    },
    
    watchTutorial() {
        window.open('https://www.youtube.com/watch?v=demo', '_blank');
    },
    
    openSupport() {
        // Implement live chat or support ticket system
        window.open('/support', '_blank');
    },
    
    attachStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .onboarding-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                animation: fadeIn 0.3s ease;
            }
            
            .onboarding-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(5px);
            }
            
            .onboarding-container {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 16px;
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.4s ease;
            }
            
            .onboarding-progress {
                padding: 1.5rem 2rem;
                border-bottom: 1px solid #f0f0f0;
            }
            
            .progress-bar {
                height: 6px;
                background: #f0f0f0;
                border-radius: 3px;
                overflow: hidden;
                margin-bottom: 0.5rem;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(135deg, #d4af37, #f4e4bc);
                transition: width 0.3s ease;
            }
            
            .progress-text {
                font-size: 0.875rem;
                color: #666;
            }
            
            .onboarding-content {
                padding: 2rem;
            }
            
            .onboarding-content h2 {
                font-size: 1.75rem;
                margin-bottom: 0.5rem;
                color: #333;
            }
            
            .subtitle {
                color: #666;
                margin-bottom: 2rem;
            }
            
            .form-group {
                margin-bottom: 1.5rem;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 500;
                color: #333;
            }
            
            .form-group input,
            .form-group select {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 1rem;
                transition: border-color 0.2s;
            }
            
            .form-group input:focus,
            .form-group select:focus {
                outline: none;
                border-color: #d4af37;
            }
            
            .form-group input.error {
                border-color: #e74c3c;
            }
            
            .hint {
                display: block;
                margin-top: 0.25rem;
                font-size: 0.875rem;
                color: #999;
            }
            
            .currency-input {
                position: relative;
            }
            
            .currency-symbol {
                position: absolute;
                left: 0.75rem;
                top: 50%;
                transform: translateY(-50%);
                color: #666;
                font-weight: 500;
            }
            
            .currency-input input {
                padding-left: 2rem;
            }
            
            .color-preset-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 1rem;
                margin-top: 0.5rem;
            }
            
            .color-preset {
                height: 60px;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                border: 3px solid transparent;
            }
            
            .color-preset:hover {
                transform: scale(1.05);
            }
            
            .color-preset.selected {
                border-color: #333;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            
            .color-name {
                background: white;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 500;
            }
            
            .file-upload-area {
                position: relative;
            }
            
            .file-upload-area input[type="file"] {
                position: absolute;
                opacity: 0;
                width: 100%;
                height: 120px;
                cursor: pointer;
            }
            
            .file-upload-label {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 120px;
                border: 2px dashed #d0d0d0;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .file-upload-label:hover {
                border-color: #d4af37;
                background: #fafaf8;
            }
            
            .upload-icon {
                font-size: 2rem;
                margin-bottom: 0.5rem;
            }
            
            .file-preview img {
                max-width: 150px;
                max-height: 150px;
                margin-top: 1rem;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            
            .onboarding-navigation {
                padding: 1.5rem 2rem;
                border-top: 1px solid #f0f0f0;
                display: flex;
                justify-content: space-between;
            }
            
            .nav-button {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .nav-button.back {
                background: #f0f0f0;
                color: #666;
            }
            
            .nav-button.back:hover:not(:disabled) {
                background: #e0e0e0;
            }
            
            .nav-button.back:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .nav-button.next {
                background: linear-gradient(135deg, #d4af37, #f4e4bc);
                color: #000;
            }
            
            .nav-button.next:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
            }
            
            .feature-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
                margin: 2rem 0;
            }
            
            .feature-card {
                padding: 1.5rem;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                text-align: center;
                transition: all 0.2s;
            }
            
            .feature-card:hover {
                border-color: #d4af37;
                background: #fafaf8;
            }
            
            .feature-icon {
                font-size: 2rem;
                display: block;
                margin-bottom: 0.5rem;
            }
            
            .feature-card h3 {
                font-size: 1rem;
                margin-bottom: 0.25rem;
                color: #333;
            }
            
            .feature-card p {
                font-size: 0.875rem;
                color: #666;
                margin: 0;
            }
            
            .cta-button {
                display: block;
                width: 100%;
                padding: 1rem;
                background: linear-gradient(135deg, #d4af37, #f4e4bc);
                color: #000;
                border: none;
                border-radius: 8px;
                font-size: 1.125rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .cta-button:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 20px rgba(212, 175, 55, 0.3);
            }
            
            .next-steps {
                margin: 2rem 0;
            }
            
            .step-item {
                display: flex;
                align-items: start;
                margin-bottom: 1.5rem;
            }
            
            .step-number {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                background: #f0f0f0;
                border-radius: 50%;
                font-weight: 600;
                margin-right: 1rem;
                flex-shrink: 0;
            }
            
            .step-content h4 {
                margin: 0 0 0.25rem 0;
                color: #333;
            }
            
            .step-content p {
                margin: 0;
                color: #666;
                font-size: 0.875rem;
            }
            
            .action-buttons {
                display: flex;
                gap: 1rem;
                margin: 2rem 0;
            }
            
            .secondary-button,
            .primary-button {
                flex: 1;
                padding: 0.875rem 1.5rem;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .secondary-button {
                background: #f0f0f0;
                color: #333;
            }
            
            .secondary-button:hover {
                background: #e0e0e0;
            }
            
            .primary-button {
                background: linear-gradient(135deg, #d4af37, #f4e4bc);
                color: #000;
            }
            
            .primary-button:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
            }
            
            .help-section {
                text-align: center;
                padding-top: 1rem;
                border-top: 1px solid #f0f0f0;
                color: #666;
                font-size: 0.875rem;
            }
            
            .help-section a {
                color: #d4af37;
                text-decoration: none;
                font-weight: 500;
            }
            
            .help-section a:hover {
                text-decoration: underline;
            }
            
            .success-toast {
                position: fixed;
                top: 2rem;
                right: 2rem;
                background: white;
                border-radius: 8px;
                padding: 1rem 1.5rem;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                z-index: 10001;
                animation: slideInRight 0.3s ease;
            }
            
            .success-content {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            
            .success-icon {
                font-size: 1.5rem;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translate(-50%, -40%);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%);
                }
            }
            
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @media (max-width: 640px) {
                .onboarding-container {
                    width: 95%;
                }
                
                .feature-grid {
                    grid-template-columns: 1fr;
                }
                
                .color-preset-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .action-buttons {
                    flex-direction: column;
                }
            }
        `;
        document.head.appendChild(style);
    }
};

// Auto-initialize when loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => OnboardingFlow.init());
} else {
    OnboardingFlow.init();
}