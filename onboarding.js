const steps = [
  "businessInfo",
  "branding", 
  "stripe",
  "communication",
  "sessionTypes",
  "previewLaunch"
];

let currentStep = 0;
let wizardData = {};

const formContainer = document.getElementById("wizard-form");
const stepNum = document.getElementById("stepNum");
const progressFill = document.getElementById("progressFill");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");

function updateProgress() {
  const progress = ((currentStep + 1) / steps.length) * 100;
  progressFill.style.width = progress + '%';
  stepNum.textContent = currentStep + 1;
  
  prevBtn.disabled = currentStep === 0;
  nextBtn.textContent = currentStep === steps.length - 1 ? 'Launch 🚀' : 'Next ➡';
}

function renderStep() {
  const step = steps[currentStep];
  formContainer.innerHTML = getStepHTML(step);
  updateProgress();
  preloadStepData();
}

function getStepHTML(step) {
  switch (step) {
    case "businessInfo":
      return `
        <h2>📊 Business Information</h2>
        <div class="form-group">
          <label for="bizName">Business Name *</label>
          <input type="text" id="bizName" placeholder="e.g. The Legacy Photography" required />
        </div>
        <div class="form-group">
          <label for="bizLocation">Primary Location *</label>
          <input type="text" id="bizLocation" placeholder="e.g. Charleston, SC" required />
        </div>
        <div class="form-group">
          <label for="bizPhone">Phone Number *</label>
          <input type="tel" id="bizPhone" placeholder="e.g. (843) 485-1315" required />
        </div>
        <div class="form-group">
          <label for="bizEmail">Business Email *</label>
          <input type="email" id="bizEmail" placeholder="e.g. contact@yourbusiness.com" required />
        </div>
        <div class="form-group">
          <label for="bizWebsite">Website (Optional)</label>
          <input type="url" id="bizWebsite" placeholder="e.g. https://yourbusiness.com" />
        </div>
      `;
    case "branding":
      return `
        <h2>🎨 Brand Styling</h2>
        <div class="form-group">
          <label for="logoUpload">Upload Logo (Optional)</label>
          <input type="file" id="logoUpload" accept="image/*" />
        </div>
        <div class="form-group">
          <label for="themeColor">Primary Brand Color</label>
          <input type="color" id="themeColor" value="#d4af37" />
        </div>
        <div class="form-group">
          <label for="tagline">Business Tagline</label>
          <input type="text" id="tagline" placeholder="e.g. Capturing Timeless Moments" />
        </div>
        <div class="form-group">
          <label for="style">Photography Style</label>
          <select id="style">
            <option value="wedding">Wedding Photography</option>
            <option value="portrait">Portrait Photography</option>
            <option value="family">Family Photography</option>
            <option value="commercial">Commercial Photography</option>
            <option value="event">Event Photography</option>
            <option value="mixed">Mixed Styles</option>
          </select>
        </div>
      `;
    case "stripe":
      return `
        <h2>💳 Payment Setup</h2>
        <p style="margin-bottom: 25px; color: #ccc; line-height: 1.6;">
          Connect your Stripe account to accept payments, send invoices, and manage subscriptions automatically.
        </p>
        <button class="stripe-connect-btn" onclick="connectStripe()">
          🔗 Connect to Stripe
        </button>
        <div class="form-group">
          <label for="currency">Default Currency</label>
          <select id="currency">
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="AUD">AUD - Australian Dollar</option>
          </select>
        </div>
        <div class="form-group">
          <label for="taxRate">Tax Rate (Optional)</label>
          <input type="number" id="taxRate" placeholder="e.g. 8.5" step="0.1" min="0" max="50" />
          <small style="color: #999;">Enter as percentage (e.g. 8.5 for 8.5%)</small>
        </div>
      `;
    case "communication":
      return `
        <h2>📧 Communication Preferences</h2>
        <div class="checkbox-group">
          <input type="checkbox" id="enableEmail" checked />
          <label for="enableEmail">Enable Email Notifications</label>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="enableSMS" />
          <label for="enableSMS">Enable SMS Notifications (requires Twilio)</label>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="autoReminders" checked />
          <label for="autoReminders">Automatic Session Reminders</label>
        </div>
        <div class="form-group">
          <label for="welcomeEmail">Default Welcome Email Template</label>
          <textarea id="welcomeEmail" placeholder="Hi [CLIENT_NAME],

Thank you for choosing [BUSINESS_NAME] for your photography needs! 

Your session is scheduled for [SESSION_DATE] at [SESSION_LOCATION]. I'm excited to capture your special moments.

Please let me know if you have any questions before your session.

Best regards,
[PHOTOGRAPHER_NAME]">Hi [CLIENT_NAME],

Thank you for choosing [BUSINESS_NAME] for your photography needs! 

Your session is scheduled for [SESSION_DATE] at [SESSION_LOCATION]. I'm excited to capture your special moments.

Please let me know if you have any questions before your session.

Best regards,
[PHOTOGRAPHER_NAME]</textarea>
        </div>
      `;
    case "sessionTypes":
      return `
        <h2>📸 First Session Type</h2>
        <p style="margin-bottom: 25px; color: #ccc;">
          Create your first session type. You can add more later from the main dashboard.
        </p>
        <div class="form-group">
          <label for="sessionName">Session Name *</label>
          <input type="text" id="sessionName" placeholder="e.g. Family Portrait Session" required />
        </div>
        <div class="form-group">
          <label for="sessionPrice">Price *</label>
          <input type="number" id="sessionPrice" placeholder="e.g. 350" min="0" step="0.01" required />
        </div>
        <div class="form-group">
          <label for="sessionDuration">Duration (minutes) *</label>
          <input type="number" id="sessionDuration" placeholder="e.g. 90" min="15" step="15" required />
        </div>
        <div class="form-group">
          <label for="deliverables">What's Included</label>
          <textarea id="deliverables" placeholder="e.g. 25 edited high-resolution digital images, online gallery access, print release">25 edited high-resolution digital images
Online gallery access for 30 days
Print release included
1-2 hour session
Multiple outfit changes welcome</textarea>
        </div>
      `;
    case "previewLaunch":
      return `
        <h2>🚀 Ready to Launch!</h2>
        <div class="success-message">
          <h3>Setup Complete!</h3>
          <p>Your photography management system is configured and ready to go.</p>
        </div>
        <div style="background: rgba(212, 175, 55, 0.1); padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h4 style="color: #d4af37; margin-top: 0;">What happens next:</h4>
          <ul style="color: #ccc; line-height: 1.8;">
            <li>✅ Your business settings will be saved</li>
            <li>✅ Dashboard will be configured with your branding</li>
            <li>✅ Your first session type will be available</li>
            <li>✅ Payment processing will be ready (if Stripe connected)</li>
            <li>✅ Email templates will be configured</li>
          </ul>
        </div>
        <button class="launch-btn" onclick="launchPortal()">
          🎉 Launch My Photography Business Portal
        </button>
        <p style="text-align: center; color: #999; margin-top: 20px;">
          You can always update these settings later from your dashboard.
        </p>
      `;
    default:
      return "<p>Error loading step.</p>";
  }
}

function saveStepData() {
  const step = steps[currentStep];
  const inputs = document.querySelectorAll("#wizard-form input, #wizard-form select, #wizard-form textarea");
  
  wizardData[step] = {};
  inputs.forEach(input => {
    if (input.type === "file") {
      if (input.files.length > 0) {
        wizardData[step][input.id] = input.files[0].name;
      }
    } else if (input.type === "checkbox") {
      wizardData[step][input.id] = input.checked;
    } else {
      wizardData[step][input.id] = input.value || "";
    }
  });
}

function preloadStepData() {
  const step = steps[currentStep];
  const data = wizardData[step];
  
  if (data) {
    for (let key in data) {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === "checkbox") {
          element.checked = data[key];
        } else if (element.type !== "file") {
          element.value = data[key];
        }
      }
    }
  }
}

function validateStep() {
  const requiredInputs = document.querySelectorAll("#wizard-form input[required], #wizard-form select[required]");
  
  for (let input of requiredInputs) {
    if (!input.value.trim()) {
      input.focus();
      input.style.borderColor = '#ff6b6b';
      setTimeout(() => {
        input.style.borderColor = '';
      }, 3000);
      return false;
    }
  }
  return true;
}

nextBtn.addEventListener("click", () => {
  if (!validateStep()) return;
  
  saveStepData();
  
  if (currentStep < steps.length - 1) {
    currentStep++;
    renderStep();
  } else {
    launchPortal();
  }
});

prevBtn.addEventListener("click", () => {
  saveStepData();
  if (currentStep > 0) {
    currentStep--;
    renderStep();
  }
});

function connectStripe() {
  // For now, just show a success message since we have the keys configured
  alert("✅ Stripe integration is already configured with your secret keys!");
}

async function launchPortal() {
  try {
    // Save all wizard data to the server
    const response = await fetch('/api/setup-wizard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(wizardData)
    });
    
    if (response.ok) {
      // Show success animation
      document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; text-align: center; background: linear-gradient(135deg, #1a1a1a 0%, #2c1810 100%); color: #f5f5f5;">
          <div style="font-size: 6rem; margin-bottom: 30px;">🎉</div>
          <h1 style="color: #d4af37; font-size: 3rem; margin-bottom: 20px;">Launch Successful!</h1>
          <p style="font-size: 1.3rem; margin-bottom: 40px; max-width: 600px; line-height: 1.6;">
            Your photography business management system is now ready. Redirecting to your dashboard...
          </p>
          <div style="width: 300px; height: 6px; background: rgba(212, 175, 55, 0.2); border-radius: 3px; overflow: hidden;">
            <div style="height: 100%; background: linear-gradient(90deg, #d4af37, #ffd700); border-radius: 3px; animation: loading 3s ease-in-out;"></div>
          </div>
        </div>
        <style>
          @keyframes loading {
            from { width: 0%; }
            to { width: 100%; }
          }
        </style>
      `;
      
      // Redirect to main app after 3 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    } else {
      alert('❌ Setup failed. Please try again.');
    }
  } catch (error) {
    console.error('Setup error:', error);
    alert('❌ Setup failed. Please try again.');
  }
}

// Initialize wizard
renderStep();