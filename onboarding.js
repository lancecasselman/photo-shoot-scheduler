/**
 * Photography Business Onboarding Wizard
 * Handles user registration, username selection, and business setup
 */

class OnboardingWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 5;
        this.formData = {};
        this.usernameCheckTimeout = null;
        
        this.init();
    }
    
    init() {
        this.renderStep(1);
        this.setupEventListeners();
        this.checkAuthStatus();
    }
    
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/user');
            if (response.ok) {
                const data = await response.json();
                this.formData.userId = data.user.uid;
                this.formData.email = data.user.email;
                this.formData.displayName = data.user.displayName;
                
                // Check if onboarding is already completed
                const userResponse = await fetch(`/api/users/${data.user.uid}`);
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData.onboardingCompleted) {
                        // Redirect to main app
                        window.location.href = '/';
                        return;
                    }
                }
            } else {
                // Not authenticated - redirect to auth
                window.location.href = '/auth.html';
                return;
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            window.location.href = '/auth.html';
        }
    }
    
    setupEventListeners() {
        const nextBtn = document.getElementById('nextBtn');
        const prevBtn = document.getElementById('prevBtn');
        
        nextBtn.addEventListener('click', () => this.nextStep());
        prevBtn.addEventListener('click', () => this.prevStep());
    }
    
    renderStep(step) {
        this.currentStep = step;
        this.updateProgress();
        this.updateNavigation();
        
        const formContainer = document.getElementById('wizard-form');
        
        switch(step) {
            case 1:
                formContainer.innerHTML = this.renderWelcomeStep();
                break;
            case 2:
                formContainer.innerHTML = this.renderUsernameStep();
                this.setupUsernameValidation();
                break;
            case 3:
                formContainer.innerHTML = this.renderBusinessInfoStep();
                break;
            case 4:
                formContainer.innerHTML = this.renderBusinessTypeStep();
                break;
            case 5:
                formContainer.innerHTML = this.renderCompletionStep();
                this.completeOnboarding();
                break;
        }
    }
    
    renderWelcomeStep() {
        return `
            <div class="step-content">
                <div class="welcome-hero">
                    <h2>Welcome to Your Photography Business Platform! 📸</h2>
                    <p>Let's set up your professional photography management system in just a few steps.</p>
                    
                    <div class="feature-preview">
                        <div class="feature-item">
                            <div class="feature-icon">📅</div>
                            <h4>Session Management</h4>
                            <p>Schedule and track all your photography sessions</p>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon">🖼️</div>
                            <h4>Client Galleries</h4>
                            <p>Share photos with clients securely</p>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon">💰</div>
                            <h4>Invoicing & Payments</h4>
                            <p>Get paid faster with professional invoices</p>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon">🌐</div>
                            <h4>Website Builder</h4>
                            <p>Create stunning photography websites</p>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon">👥</div>
                            <h4>Community</h4>
                            <p>Connect with other photographers</p>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon">☁️</div>
                            <h4>Cloud Storage</h4>
                            <p>100GB secure storage included</p>
                        </div>
                    </div>
                    
                    <div class="user-info">
                        <p><strong>Account:</strong> ${this.formData.email || 'Setting up...'}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderUsernameStep() {
        return `
            <div class="step-content">
                <h2>Choose Your Username</h2>
                <p>Your username will identify you in the community and on your public profile.</p>
                
                <div class="form-group">
                    <label for="username">Username</label>
                    <div class="username-input-container">
                        <span class="username-prefix">@</span>
                        <input 
                            type="text" 
                            id="username" 
                            name="username" 
                            placeholder="yourname" 
                            value="${this.formData.username || ''}"
                            maxlength="30"
                            pattern="[a-zA-Z0-9_]+"
                            autocomplete="off"
                        >
                    </div>
                    <div id="username-feedback" class="username-feedback"></div>
                    <div class="form-hint">
                        Use only letters, numbers, and underscores. 3-30 characters.
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="displayName">Display Name</label>
                    <input 
                        type="text" 
                        id="displayName" 
                        name="displayName" 
                        placeholder="Your Business or Personal Name"
                        value="${this.formData.displayName || ''}"
                        maxlength="50"
                    >
                    <div class="form-hint">
                        This is how your name will appear to clients and in the community.
                    </div>
                </div>
                
                <div class="username-preview">
                    <h4>Preview:</h4>
                    <div class="preview-card">
                        <div class="preview-profile">
                            <div class="preview-avatar">📸</div>
                            <div class="preview-info">
                                <div class="preview-display-name">Your Display Name</div>
                                <div class="preview-username">@username</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderBusinessInfoStep() {
        return `
            <div class="step-content">
                <h2>Business Information</h2>
                <p>Tell us about your photography business to customize your experience.</p>
                
                <div class="form-group">
                    <label for="businessName">Business Name</label>
                    <input 
                        type="text" 
                        id="businessName" 
                        name="businessName" 
                        placeholder="Your Photography Business Name"
                        value="${this.formData.businessName || ''}"
                    >
                    <div class="form-hint">
                        This will appear on invoices and client communications.
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="firstName">First Name</label>
                    <input 
                        type="text" 
                        id="firstName" 
                        name="firstName" 
                        placeholder="First Name"
                        value="${this.formData.firstName || ''}"
                    >
                </div>
                
                <div class="form-group">
                    <label for="lastName">Last Name</label>
                    <input 
                        type="text" 
                        id="lastName" 
                        name="lastName" 
                        placeholder="Last Name"
                        value="${this.formData.lastName || ''}"
                    >
                </div>
            </div>
        `;
    }
    
    renderBusinessTypeStep() {
        return `
            <div class="step-content">
                <h2>What Type of Photography Do You Do?</h2>
                <p>This helps us customize features and templates for your specialty.</p>
                
                <div class="business-type-grid">
                    <div class="business-type-card ${this.formData.businessType === 'wedding' ? 'selected' : ''}" data-type="wedding">
                        <div class="type-icon">💍</div>
                        <h4>Wedding Photography</h4>
                        <p>Capturing love stories and special moments</p>
                    </div>
                    
                    <div class="business-type-card ${this.formData.businessType === 'portrait' ? 'selected' : ''}" data-type="portrait">
                        <div class="type-icon">👤</div>
                        <h4>Portrait Photography</h4>
                        <p>Professional headshots and personal branding</p>
                    </div>
                    
                    <div class="business-type-card ${this.formData.businessType === 'family' ? 'selected' : ''}" data-type="family">
                        <div class="type-icon">👨‍👩‍👧‍👦</div>
                        <h4>Family Photography</h4>
                        <p>Family sessions and lifestyle photography</p>
                    </div>
                    
                    <div class="business-type-card ${this.formData.businessType === 'event' ? 'selected' : ''}" data-type="event">
                        <div class="type-icon">🎉</div>
                        <h4>Event Photography</h4>
                        <p>Corporate events and celebrations</p>
                    </div>
                    
                    <div class="business-type-card ${this.formData.businessType === 'commercial' ? 'selected' : ''}" data-type="commercial">
                        <div class="type-icon">🏢</div>
                        <h4>Commercial Photography</h4>
                        <p>Business and product photography</p>
                    </div>
                    
                    <div class="business-type-card ${this.formData.businessType === 'other' ? 'selected' : ''}" data-type="other">
                        <div class="type-icon">📷</div>
                        <h4>Other</h4>
                        <p>Multiple specialties or unique focus</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderSubscriptionStep() {
        return `
            <div class="step-content">
                <h2>Choose Your Plan</h2>
                <p>Start with our Professional Plan to access all features.</p>
                
                <div class="subscription-card">
                    <div class="plan-header">
                        <h3>Professional Plan</h3>
                        <div class="plan-price">$39<span>/month</span></div>
                    </div>
                    
                    <div class="plan-features">
                        <div class="feature-item">✅ Complete session management</div>
                        <div class="feature-item">✅ Client galleries and portfolios</div>
                        <div class="feature-item">✅ Invoice and payment processing</div>
                        <div class="feature-item">✅ Contract management</div>
                        <div class="feature-item">✅ 100GB cloud storage</div>
                        <div class="feature-item">✅ Website builder</div>
                        <div class="feature-item">✅ Community platform access</div>
                        <div class="feature-item">✅ Priority support</div>
                    </div>
                    
                    <div class="storage-addons">
                        <h4>Storage Add-ons Available:</h4>
                        <p>Additional 1TB storage: $25/month each</p>
                    </div>
                    
                    <div class="plan-action">
                        <button id="subscribeBtn" class="subscribe-btn">
                            Start Professional Plan - $39/month
                        </button>
                        <p class="billing-note">
                            7-day free trial • Cancel anytime • Secure payment via Stripe
                        </p>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderCompletionStep() {
        return `
            <div class="step-content">
                <div class="completion-hero">
                    <div class="success-icon">🎉</div>
                    <h2>Welcome to Your Photography Platform!</h2>
                    <p>Your account is now set up and ready to go.</p>
                    
                    <div class="completion-summary">
                        <h4>Account Summary:</h4>
                        <div class="summary-item">
                            <strong>Username:</strong> @${this.formData.username}
                        </div>
                        <div class="summary-item">
                            <strong>Display Name:</strong> ${this.formData.displayName}
                        </div>
                        <div class="summary-item">
                            <strong>Business:</strong> ${this.formData.businessName}
                        </div>
                        <div class="summary-item">
                            <strong>Specialty:</strong> ${this.getBusinessTypeLabel(this.formData.businessType)}
                        </div>
                    </div>
                    
                    <div class="next-steps">
                        <h4>What's Next:</h4>
                        <div class="step-item">1. Set up your first photography session</div>
                        <div class="step-item">2. Create client galleries</div>
                        <div class="step-item">3. Build your photography website</div>
                        <div class="step-item">4. Connect with the photography community</div>
                    </div>
                    
                    <button id="enterPlatformBtn" class="enter-platform-btn">
                        Enter Your Photography Platform →
                    </button>
                </div>
            </div>
        `;
    }
    
    setupUsernameValidation() {
        const usernameInput = document.getElementById('username');
        const displayNameInput = document.getElementById('displayName');
        
        usernameInput.addEventListener('input', (e) => {
            let value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
            e.target.value = value;
            this.formData.username = value;
            this.validateUsername(value);
            this.updatePreview();
        });
        
        displayNameInput.addEventListener('input', (e) => {
            this.formData.displayName = e.target.value;
            this.updatePreview();
        });
        
        // Setup business type selection
        setTimeout(() => {
            const typeCards = document.querySelectorAll('.business-type-card');
            typeCards.forEach(card => {
                card.addEventListener('click', () => {
                    typeCards.forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    this.formData.businessType = card.dataset.type;
                });
            });
        }, 100);
    }
    
    async validateUsername(username) {
        const feedback = document.getElementById('username-feedback');
        
        if (!username) {
            feedback.innerHTML = '';
            return false;
        }
        
        if (username.length < 3) {
            feedback.innerHTML = '<span class="error">Username must be at least 3 characters</span>';
            return false;
        }
        
        if (username.length > 30) {
            feedback.innerHTML = '<span class="error">Username must be 30 characters or less</span>';
            return false;
        }
        
        if (!/^[a-z0-9_]+$/.test(username)) {
            feedback.innerHTML = '<span class="error">Username can only contain letters, numbers, and underscores</span>';
            return false;
        }
        
        // Clear previous timeout
        if (this.usernameCheckTimeout) {
            clearTimeout(this.usernameCheckTimeout);
        }
        
        // Check availability after 500ms delay
        this.usernameCheckTimeout = setTimeout(async () => {
            try {
                feedback.innerHTML = '<span class="checking">Checking availability...</span>';
                
                const response = await fetch(`/api/users/check-username?username=${username}`);
                const data = await response.json();
                
                if (data.available) {
                    feedback.innerHTML = '<span class="success">✓ Username available</span>';
                    this.formData.usernameValid = true;
                } else {
                    feedback.innerHTML = '<span class="error">✗ Username already taken</span>';
                    this.formData.usernameValid = false;
                }
            } catch (error) {
                feedback.innerHTML = '<span class="error">Error checking username</span>';
                this.formData.usernameValid = false;
            }
        }, 500);
        
        return true;
    }
    
    updatePreview() {
        const previewDisplayName = document.querySelector('.preview-display-name');
        const previewUsername = document.querySelector('.preview-username');
        
        if (previewDisplayName) {
            previewDisplayName.textContent = this.formData.displayName || 'Your Display Name';
        }
        if (previewUsername) {
            previewUsername.textContent = `@${this.formData.username || 'username'}`;
        }
    }
    
    updateProgress() {
        const progressFill = document.getElementById('progressFill');
        const stepNum = document.getElementById('stepNum');
        
        const progress = (this.currentStep / this.totalSteps) * 100;
        progressFill.style.width = `${progress}%`;
        stepNum.textContent = this.currentStep;
    }
    
    updateNavigation() {
        const nextBtn = document.getElementById('nextBtn');
        const prevBtn = document.getElementById('prevBtn');
        
        prevBtn.style.display = this.currentStep === 1 ? 'none' : 'block';
        
        if (this.currentStep === this.totalSteps) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'block';
            nextBtn.textContent = this.currentStep === this.totalSteps - 1 ? 'Complete Setup →' : 'Next →';
        }
    }
    
    async nextStep() {
        if (!await this.validateCurrentStep()) {
            return;
        }
        
        this.collectCurrentStepData();
        
        if (this.currentStep < this.totalSteps) {
            this.renderStep(this.currentStep + 1);
        }
    }
    
    prevStep() {
        if (this.currentStep > 1) {
            this.renderStep(this.currentStep - 1);
        }
    }
    
    async validateCurrentStep() {
        switch(this.currentStep) {
            case 2: // Username step
                if (!this.formData.username || !this.formData.usernameValid) {
                    alert('Please choose a valid, available username.');
                    return false;
                }
                if (!this.formData.displayName || this.formData.displayName.trim().length < 2) {
                    alert('Please enter a display name (at least 2 characters).');
                    return false;
                }
                break;
            case 3: // Business info
                if (!this.formData.businessName || this.formData.businessName.trim().length < 2) {
                    alert('Please enter your business name.');
                    return false;
                }
                break;
            case 4: // Business type
                if (!this.formData.businessType) {
                    alert('Please select your photography specialty.');
                    return false;
                }
                break;
        }
        return true;
    }
    
    collectCurrentStepData() {
        const formContainer = document.getElementById('wizard-form');
        const inputs = formContainer.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            if (input.name && input.value) {
                this.formData[input.name] = input.value;
            }
        });
    }
    
    async completeOnboarding() {
        try {
            const response = await fetch('/api/users/complete-onboarding', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.formData),
            });
            
            if (response.ok) {
                // Setup enter platform button
                const enterBtn = document.getElementById('enterPlatformBtn');
                if (enterBtn) {
                    enterBtn.addEventListener('click', () => {
                        window.location.href = '/';
                    });
                }
            } else {
                throw new Error('Failed to complete onboarding');
            }
        } catch (error) {
            console.error('Error completing onboarding:', error);
            alert('There was an error completing your setup. Please try again.');
        }
    }
    
    getBusinessTypeLabel(type) {
        const labels = {
            wedding: 'Wedding Photography',
            portrait: 'Portrait Photography',
            family: 'Family Photography',
            event: 'Event Photography',
            commercial: 'Commercial Photography',
            other: 'Other'
        };
        return labels[type] || type;
    }
}

// Initialize the wizard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Onboarding wizard starting...');
    window.onboardingWizard = new OnboardingWizard();
});