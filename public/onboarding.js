/**
 * Photography Business Onboarding Wizard
 * Handles user registration, username selection, and business setup
 */

class OnboardingWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 6;
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
                formContainer.innerHTML = this.renderPaymentSettingsStep();
                this.setupPaymentSettings();
                break;
            case 6:
                formContainer.innerHTML = this.renderCompletionStep();
                this.completeOnboarding();
                break;
        }
    }
    
    renderWelcomeStep() {
        return `
            <div class="step-content">
                <div class="welcome-hero" style="background: linear-gradient(135deg, #8B7355 0%, #A0896E 100%); color: white; padding: 40px; border-radius: 16px; margin-bottom: 30px;">
                    <h2 style="color: white; margin-bottom: 15px;">Welcome to Photography Management System</h2>
                    <p style="color: rgba(255, 255, 255, 0.9); font-size: 18px;">Let's get your business connected and ready to manage clients professionally</p>
                </div>
                
                <div class="news-section" style="background: #FFF9E6; padding: 20px; border-radius: 12px; margin-bottom: 30px; border-left: 4px solid #FFD700;">
                    <h4 style="color: #333; margin-bottom: 10px;">Good News:</h4>
                    <p style="color: #555;">Payment processing is automatically set up during onboarding! The platform uses your device's built-in email and messaging apps - no external API setup required.</p>
                </div>
                
                <div class="setup-section">
                    <div class="setup-card" style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;">
                        <div style="display: flex; align-items: flex-start; gap: 20px;">
                            <div style="background: #8B7355; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; flex-shrink: 0;">
                                1
                            </div>
                            <div style="flex: 1;">
                                <h3 style="margin-bottom: 15px; color: #333;">Configure Your Business Profile</h3>
                                <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">
                                    Add your business information, branding, session types, and pricing. This personalizes the entire platform for your business.
                                </p>
                                <button onclick="window.onboardingWizard.renderStep(2)" class="setup-btn" style="background: #8B7355; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 500; transition: background 0.3s;">
                                    Setup Business Profile
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="setup-card" style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); opacity: 0.6; pointer-events: none;">
                        <div style="display: flex; align-items: flex-start; gap: 20px;">
                            <div style="background: #ccc; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; flex-shrink: 0;">
                                2
                            </div>
                            <div style="flex: 1;">
                                <h3 style="margin-bottom: 15px; color: #999;">Configure Payment Processing</h3>
                                <p style="color: #999; line-height: 1.6;">
                                    Set up your Stripe account to accept payments directly from clients. This will be available after setting up your business profile.
                                </p>
                            </div>
                        </div>
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
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="firstName">First Name *</label>
                        <input 
                            type="text" 
                            id="firstName" 
                            name="firstName" 
                            placeholder="First Name"
                            value="${this.formData.firstName || ''}"
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="lastName">Last Name *</label>
                        <input 
                            type="text" 
                            id="lastName" 
                            name="lastName" 
                            placeholder="Last Name"
                            value="${this.formData.lastName || ''}"
                            required
                        >
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="businessName">Business Name *</label>
                    <input 
                        type="text" 
                        id="businessName" 
                        name="businessName" 
                        placeholder="Your Photography Business Name"
                        value="${this.formData.businessName || ''}"
                        required
                    >
                    <div class="form-hint">
                        This will appear on invoices and client communications.
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="email">Email *</label>
                        <input 
                            type="email" 
                            id="email" 
                            name="email" 
                            placeholder="your@email.com"
                            value="${this.formData.email || ''}"
                            required
                            readonly
                        >
                        <div class="form-hint">
                            Your account email (cannot be changed).
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="phoneNumber">Phone Number *</label>
                        <input 
                            type="tel" 
                            id="phoneNumber" 
                            name="phoneNumber" 
                            placeholder="(555) 123-4567"
                            value="${this.formData.phoneNumber || ''}"
                            required
                        >
                        <div class="form-hint">
                            For client communications and Stripe account.
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="streetAddress">Street Address *</label>
                    <input 
                        type="text" 
                        id="streetAddress" 
                        name="streetAddress" 
                        placeholder="123 Main Street"
                        value="${this.formData.streetAddress || ''}"
                        required
                    >
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="city">City *</label>
                        <input 
                            type="text" 
                            id="city" 
                            name="city" 
                            placeholder="City"
                            value="${this.formData.city || ''}"
                            required
                        >
                    </div>
                    
                    <div class="form-group" style="max-width: 150px;">
                        <label for="state">State *</label>
                        <input 
                            type="text" 
                            id="state" 
                            name="state" 
                            placeholder="State"
                            value="${this.formData.state || ''}"
                            maxlength="2"
                            required
                        >
                    </div>
                    
                    <div class="form-group" style="max-width: 150px;">
                        <label for="zipCode">ZIP Code *</label>
                        <input 
                            type="text" 
                            id="zipCode" 
                            name="zipCode" 
                            placeholder="12345"
                            value="${this.formData.zipCode || ''}"
                            pattern="[0-9]{5}"
                            maxlength="5"
                            required
                        >
                    </div>
                </div>
                
                <div class="form-hint" style="margin-top: 20px;">
                    * Required fields - This information helps us provide location-based features and proper invoicing.
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
    
    renderPaymentSettingsStep() {
        return `
            <div class="step-content">
                <h2>💳 Configure Payment Processing</h2>
                <p>Set up your Stripe account to accept payments directly from clients. You can always return to this later in Business Setup if needed.</p>
                
                <!-- Payment Setup Status -->
                <div class="payment-status-card">
                    <div class="status-indicator" id="onboardingStripeStatusIndicator">
                        <span class="status-dot pending" id="onboardingStatusDot"></span>
                        <span id="onboardingStripeStatusText">Initializing payment setup...</span>
                    </div>
                    <div class="status-details" id="onboardingStripeStatusDetails">
                        Loading payment setup status...
                    </div>
                </div>

                <!-- Stripe Connect Setup Form -->
                <div id="onboardingStripeSetupForm" class="payment-setup-form" style="display: none;">
                    <h3>Complete Payment Setup</h3>
                    <p>We'll create your secure Stripe Express account to receive payments directly from clients.</p>
                    
                    <div class="form-section">
                        <h4>Business Information</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="onboardingBusinessEmail">Business Email:</label>
                                <input type="email" id="onboardingBusinessEmail" placeholder="business@example.com" readonly>
                            </div>
                            <div class="form-group">
                                <label for="onboardingBusinessCountry">Country:</label>
                                <select id="onboardingBusinessCountry">
                                    <option value="US">United States</option>
                                    <option value="CA">Canada</option>
                                    <option value="GB">United Kingdom</option>
                                    <option value="AU">Australia</option>
                                    <option value="DE">Germany</option>
                                    <option value="FR">France</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button onclick="onboardingSetupStripeConnect()" class="primary-btn" id="onboardingSetupStripeBtn">
                            <span class="btn-text">Set Up Payment Processing</span>
                            <span class="btn-loading" style="display: none;">Setting Up...</span>
                        </button>
                    </div>
                </div>

                <!-- Stripe Connect Complete -->
                <div id="onboardingStripeConnectComplete" class="payment-complete-card" style="display: none;">
                    <div class="success-icon">✅</div>
                    <h3>Payment Processing Ready!</h3>
                    <p>Your Stripe Express account is set up and ready to receive payments.</p>
                    
                    <div class="account-info">
                        <div class="info-row">
                            <span class="info-label">Account ID:</span>
                            <span class="info-value" id="onboardingStripeAccountId">Loading...</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Status:</span>
                            <span class="info-value status-ready">Ready for Payments</span>
                        </div>
                    </div>
                </div>

                <!-- Skip Option -->
                <div class="skip-section" style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <p style="color: #666; margin-bottom: 15px;"><em>Not ready to set up payments? You can configure your bank account later from the Business Setup section to accept Stripe payments.</em></p>
                    <button onclick="window.onboardingWizard.skipPaymentSetup()" class="skip-btn" style="background: transparent; border: 2px solid #8B7355; color: #8B7355; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        Skip Payment Setup for Now
                    </button>
                </div>

                <!-- Help Information -->
                <div class="help-info">
                    <h4>ℹ️ Why Set Up Payments Now?</h4>
                    <div class="help-grid">
                        <div class="help-item">
                            <h5>Direct Deposits</h5>
                            <p>Client payments go directly to your bank account - no middleman holds your money.</p>
                        </div>
                        <div class="help-item">
                            <h5>Professional Invoicing</h5>
                            <p>Send professional invoices and accept payments online instantly.</p>
                        </div>
                        <div class="help-item">
                            <h5>Secure Processing</h5>
                            <p>Stripe handles all security and compliance - the same system used by millions of businesses.</p>
                        </div>
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
                            <strong>Name:</strong> ${this.formData.firstName} ${this.formData.lastName}
                        </div>
                        <div class="summary-item">
                            <strong>Business:</strong> ${this.formData.businessName}
                        </div>
                        <div class="summary-item">
                            <strong>Email:</strong> ${this.formData.email}
                        </div>
                        <div class="summary-item">
                            <strong>Phone:</strong> ${this.formData.phoneNumber}
                        </div>
                        <div class="summary-item">
                            <strong>Address:</strong> ${this.formData.streetAddress}, ${this.formData.city}, ${this.formData.state} ${this.formData.zipCode}
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
    
    skipPaymentSetup() {
        // Mark payment setup as skipped and proceed to next step
        this.formData.paymentSetupSkipped = true;
        this.nextStep();
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
            case 3: // Business Information step
                if (!this.formData.firstName || this.formData.firstName.trim().length < 1) {
                    alert('Please enter your first name.');
                    return false;
                }
                if (!this.formData.lastName || this.formData.lastName.trim().length < 1) {
                    alert('Please enter your last name.');
                    return false;
                }
                if (!this.formData.businessName || this.formData.businessName.trim().length < 2) {
                    alert('Please enter your business name.');
                    return false;
                }
                if (!this.formData.phoneNumber || this.formData.phoneNumber.trim().length < 10) {
                    alert('Please enter a valid phone number (at least 10 digits).');
                    return false;
                }
                if (!this.formData.streetAddress || this.formData.streetAddress.trim().length < 3) {
                    alert('Please enter your street address.');
                    return false;
                }
                if (!this.formData.city || this.formData.city.trim().length < 2) {
                    alert('Please enter your city.');
                    return false;
                }
                if (!this.formData.state || this.formData.state.trim().length !== 2) {
                    alert('Please enter your state (2-letter code).');
                    return false;
                }
                if (!this.formData.zipCode || !/^\d{5}$/.test(this.formData.zipCode)) {
                    alert('Please enter a valid 5-digit ZIP code.');
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

    // Setup Payment Settings functionality
    setupPaymentSettings() {
        this.loadOnboardingPaymentStatus();
    }

    async loadOnboardingPaymentStatus() {
        const statusText = document.getElementById('onboardingStripeStatusText');
        const statusDetails = document.getElementById('onboardingStripeStatusDetails');
        const setupForm = document.getElementById('onboardingStripeSetupForm');
        const completeSection = document.getElementById('onboardingStripeConnectComplete');
        const businessEmail = document.getElementById('onboardingBusinessEmail');

        try {
            // Set business email from form data
            if (businessEmail) {
                businessEmail.value = this.formData.email || '';
            }

            // Check Stripe Connect status
            const stripeResponse = await fetch('/api/stripe-connect/status');
            if (!stripeResponse.ok) {
                throw new Error('Failed to load payment status');
            }
            const stripeData = await stripeResponse.json();

            const statusDot = document.getElementById('onboardingStatusDot');

            if (stripeData.hasAccount && stripeData.onboardingComplete) {
                // Show complete state
                setupForm.style.display = 'none';
                completeSection.style.display = 'block';
                
                statusText.textContent = 'Payment processing is ready!';
                statusDetails.textContent = 'Your Stripe Express account is fully set up and can receive payments.';
                statusDot.className = 'status-dot active';
                
                document.getElementById('onboardingStripeAccountId').textContent = stripeData.accountId || 'Loading...';

            } else if (stripeData.hasAccount) {
                // Account exists but onboarding not complete
                statusText.textContent = 'Complete your payment setup';
                statusDetails.innerHTML = `
                    <p>Your Stripe Express account has been created but setup is not complete.</p>
                    <button onclick="continueOnboardingStripeSetup()" class="primary-btn" style="margin-top: 15px;">
                        Continue Setup
                    </button>
                `;
                setupForm.style.display = 'none';
                completeSection.style.display = 'none';
                
            } else {
                // No account exists yet
                statusText.textContent = 'Set up payment processing';
                statusDetails.textContent = 'Create your secure Stripe Express account to receive payments from clients.';
                setupForm.style.display = 'block';
                completeSection.style.display = 'none';
                statusDot.className = 'status-dot pending';
            }

        } catch (error) {
            console.error('Error loading payment status:', error);
            statusText.textContent = 'Error loading payment status';
            statusDetails.textContent = 'Unable to check your payment setup. You can skip this step for now.';
            
            const statusDot = document.getElementById('onboardingStatusDot');
            statusDot.className = 'status-dot error';
        }
    }
}

// Global functions for payment setup in onboarding
window.onboardingSetupStripeConnect = async function() {
    const button = document.getElementById('onboardingSetupStripeBtn');
    const buttonText = button.querySelector('.btn-text');
    const buttonLoading = button.querySelector('.btn-loading');
    const businessCountry = document.getElementById('onboardingBusinessCountry').value;

    button.disabled = true;
    buttonText.style.display = 'none';
    buttonLoading.style.display = 'inline';

    try {
        const response = await fetch('/api/stripe-connect/create-account', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                country: businessCountry
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create Stripe account');
        }

        const data = await response.json();
        
        if (data.accountLinkUrl) {
            // Open Stripe onboarding in a new window
            const stripeWindow = window.open(data.accountLinkUrl, 'stripe-onboarding', 'width=800,height=600,scrollbars=yes,resizable=yes');
            
            // Poll for completion
            const checkCompletion = setInterval(() => {
                try {
                    if (stripeWindow.closed) {
                        clearInterval(checkCompletion);
                        // Reload payment status after onboarding window closes
                        setTimeout(() => {
                            if (window.onboardingWizard) {
                                window.onboardingWizard.loadOnboardingPaymentStatus();
                            }
                        }, 2000);
                    }
                } catch (e) {
                    // Handle cross-origin restrictions
                    clearInterval(checkCompletion);
                }
            }, 1000);

        } else {
            throw new Error('No onboarding URL received');
        }

    } catch (error) {
        console.error('Error setting up Stripe Connect:', error);
        alert('Error setting up payment processing. You can skip this step and set it up later.');
        
        button.disabled = false;
        buttonText.style.display = 'inline';
        buttonLoading.style.display = 'none';
    }
}

window.continueOnboardingStripeSetup = async function() {
    try {
        const response = await fetch('/api/stripe-connect/continue-onboarding', {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('Failed to continue onboarding');
        }

        const data = await response.json();
        
        if (data.accountLinkUrl) {
            // Open in new window like the initial setup
            const stripeWindow = window.open(data.accountLinkUrl, 'stripe-onboarding', 'width=800,height=600,scrollbars=yes,resizable=yes');
            
            // Poll for completion
            const checkCompletion = setInterval(() => {
                try {
                    if (stripeWindow.closed) {
                        clearInterval(checkCompletion);
                        setTimeout(() => {
                            if (window.onboardingWizard) {
                                window.onboardingWizard.loadOnboardingPaymentStatus();
                            }
                        }, 2000);
                    }
                } catch (e) {
                    clearInterval(checkCompletion);
                }
            }, 1000);

        } else {
            throw new Error('No onboarding URL received');
        }

    } catch (error) {
        console.error('Error continuing Stripe onboarding:', error);
        alert('Error accessing payment setup. You can skip this step and set it up later.');
    }
}

// No longer needed - method is part of the class now

// Initialize the wizard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Onboarding wizard starting...');
    window.onboardingWizard = new OnboardingWizard();
});