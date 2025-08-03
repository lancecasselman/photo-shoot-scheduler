class AIAssistant {
    constructor() {
        this.isOpen = false;
        this.credits = 0;
        this.dragOffset = { x: 0, y: 0 };
        this.init();
    }

    init() {
        this.createAssistantUI();
        this.loadCredits();
        this.bindEvents();
        this.addAIButtons();
    }

    createAssistantUI() {
        // Create floating AI assistant panel
        const assistantPanel = document.createElement('div');
        assistantPanel.id = 'ai-assistant-panel';
        assistantPanel.className = 'ai-assistant-panel';
        assistantPanel.innerHTML = `
            <div class="ai-assistant-header">
                <div class="ai-drag-handle">
                    <div class="drag-dots"></div>
                    <div class="drag-dots"></div>
                    <div class="drag-dots"></div>
                </div>
                <h3>AI Assistant</h3>
                <div class="ai-credits">
                    <span id="ai-credits-count">0</span> credits
                </div>
                <button class="ai-close-btn">&times;</button>
            </div>
            <div class="ai-assistant-content">
                <div class="ai-quick-actions">
                    <button class="ai-action-btn" data-action="write-page">Write My Site</button>
                    <button class="ai-action-btn" data-action="improve-text">Improve Text</button>
                    <button class="ai-action-btn" data-action="seo-optimize">SEO Optimize</button>
                    <button class="ai-action-btn" data-action="generate-alt">Alt Text</button>
                </div>
                <div class="ai-chat-area">
                    <div class="ai-messages" id="ai-messages"></div>
                    <div class="ai-input-area">
                        <textarea id="ai-prompt" placeholder="Describe what you need help with..."></textarea>
                        <button id="ai-send-btn">Send</button>
                    </div>
                </div>
                <div class="ai-credits-shop">
                    <button id="buy-credits-btn" class="buy-credits-btn">Buy Credits</button>
                </div>
            </div>
        `;

        // Add CSS styles
        const styles = document.createElement('style');
        styles.textContent = `
            .ai-assistant-panel {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 350px;
                max-height: 600px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.12);
                border: 1px solid #e1e5e9;
                z-index: 10000;
                display: none;
                resize: both;
                overflow: hidden;
                min-width: 300px;
                min-height: 400px;
            }

            .ai-assistant-panel.open {
                display: flex;
                flex-direction: column;
            }

            .ai-assistant-header {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                cursor: move;
                user-select: none;
            }

            .ai-drag-handle {
                display: flex;
                flex-direction: column;
                gap: 2px;
                margin-right: 8px;
                cursor: move;
            }

            .drag-dots {
                width: 4px;
                height: 4px;
                background: rgba(255,255,255,0.7);
                border-radius: 50%;
            }

            .ai-assistant-header h3 {
                margin: 0;
                font-size: 16px;
                flex: 1;
            }

            .ai-credits {
                font-size: 12px;
                background: rgba(255,255,255,0.2);
                padding: 4px 8px;
                border-radius: 12px;
                margin-right: 8px;
            }

            .ai-close-btn {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .ai-assistant-content {
                flex: 1;
                padding: 16px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .ai-quick-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-bottom: 16px;
            }

            .ai-action-btn {
                padding: 8px 12px;
                border: 1px solid #e1e5e9;
                background: white;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }

            .ai-action-btn:hover {
                background: #f8f9fa;
                border-color: #667eea;
            }

            .ai-chat-area {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 200px;
            }

            .ai-messages {
                flex: 1;
                overflow-y: auto;
                margin-bottom: 12px;
                border: 1px solid #e1e5e9;
                border-radius: 6px;
                padding: 12px;
                background: #fafbfc;
                min-height: 150px;
            }

            .ai-message {
                margin-bottom: 12px;
                padding: 8px;
                border-radius: 6px;
                font-size: 14px;
                line-height: 1.4;
            }

            .ai-message.user {
                background: #667eea;
                color: white;
                margin-left: 20px;
            }

            .ai-message.assistant {
                background: white;
                border: 1px solid #e1e5e9;
                margin-right: 20px;
            }

            .ai-input-area {
                display: flex;
                gap: 8px;
            }

            #ai-prompt {
                flex: 1;
                border: 1px solid #e1e5e9;
                border-radius: 6px;
                padding: 8px;
                resize: none;
                height: 40px;
                font-family: inherit;
            }

            #ai-send-btn {
                background: #667eea;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 8px 16px;
                cursor: pointer;
                white-space: nowrap;
            }

            #ai-send-btn:hover {
                background: #5a6fd8;
            }

            #ai-send-btn:disabled {
                background: #ccc;
                cursor: not-allowed;
            }

            .ai-credits-shop {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #e1e5e9;
            }

            .buy-credits-btn {
                width: 100%;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
                border: none;
                padding: 10px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
            }

            .buy-credits-btn:hover {
                opacity: 0.9;
            }

            .ai-assistant-trigger {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 50%;
                color: white;
                font-size: 24px;
                cursor: pointer;
                z-index: 9999;
                box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
                transition: all 0.3s;
            }

            .ai-assistant-trigger:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 25px rgba(102, 126, 234, 0.6);
            }

            .ai-block-button {
                position: absolute;
                top: -35px;
                right: 0;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
                opacity: 0;
                transition: opacity 0.2s;
                z-index: 1000;
            }

            [contenteditable]:hover .ai-block-button,
            .block:hover .ai-block-button {
                opacity: 1;
            }

            .credits-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 10001;
            }

            .credits-modal.show {
                display: flex;
            }

            .credits-modal-content {
                background: white;
                border-radius: 12px;
                padding: 24px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            }

            .credit-bundle {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                margin-bottom: 12px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .credit-bundle:hover {
                border-color: #667eea;
                background: #f8f9ff;
            }

            .credit-bundle.popular {
                border-color: #f5576c;
                background: #fff5f6;
            }

            .credit-bundle.popular::after {
                content: "Most Popular";
                position: absolute;
                top: -8px;
                right: 16px;
                background: #f5576c;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
            }

            .bundle-info h4 {
                margin: 0 0 4px 0;
                font-size: 18px;
            }

            .bundle-info p {
                margin: 0;
                color: #666;
                font-size: 14px;
            }

            .bundle-price {
                font-size: 20px;
                font-weight: bold;
                color: #667eea;
            }
        `;

        document.head.appendChild(styles);

        // Create floating trigger button
        const triggerButton = document.createElement('button');
        triggerButton.className = 'ai-assistant-trigger';
        triggerButton.innerHTML = '✨';
        triggerButton.title = 'AI Assistant';

        document.body.appendChild(triggerButton);
        document.body.appendChild(assistantPanel);

        this.panel = assistantPanel;
        this.trigger = triggerButton;
    }

    bindEvents() {
        // Trigger button
        this.trigger.addEventListener('click', () => this.toggle());

        // Close button
        this.panel.querySelector('.ai-close-btn').addEventListener('click', () => this.close());

        // Send button
        this.panel.querySelector('#ai-send-btn').addEventListener('click', () => this.sendMessage());

        // Enter key in textarea
        this.panel.querySelector('#ai-prompt').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Quick action buttons
        this.panel.querySelectorAll('.ai-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleQuickAction(e.target.dataset.action));
        });

        // Buy credits button
        this.panel.querySelector('#buy-credits-btn').addEventListener('click', () => this.showCreditsModal());

        // Make panel draggable
        this.makeDraggable();
    }

    makeDraggable() {
        const header = this.panel.querySelector('.ai-assistant-header');
        let isDragging = false;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = this.panel.getBoundingClientRect();
            this.dragOffset.x = e.clientX - rect.left;
            this.dragOffset.y = e.clientY - rect.top;
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;

            // Keep panel within viewport
            const maxX = window.innerWidth - this.panel.offsetWidth;
            const maxY = window.innerHeight - this.panel.offsetHeight;

            this.panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            this.panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
            this.panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'move';
        });
    }

    async loadCredits() {
        try {
            const response = await fetch('/api/ai/credits', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.credits = data.credits || 0;
                this.updateCreditsDisplay();
                console.log('AI Credits loaded:', this.credits);
            } else {
                console.error('Failed to load credits:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Failed to load AI credits:', error);
        }
    }

    updateCreditsDisplay() {
        const creditsElement = this.panel.querySelector('#ai-credits-count');
        if (creditsElement) {
            creditsElement.textContent = this.credits.toLocaleString();
        }
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.panel.classList.add('open');
        this.isOpen = true;
        this.loadCredits();
    }

    close() {
        this.panel.classList.remove('open');
        this.isOpen = false;
    }

    async sendMessage() {
        const promptInput = this.panel.querySelector('#ai-prompt');
        const sendBtn = this.panel.querySelector('#ai-send-btn');
        const messagesArea = this.panel.querySelector('#ai-messages');
        
        const prompt = promptInput.value.trim();
        if (!prompt) return;

        // Check credits
        if (this.credits < 10) {
            this.addMessage('system', 'Insufficient credits. Please purchase more credits to continue.');
            this.showCreditsModal();
            return;
        }

        // Disable input
        promptInput.disabled = true;
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        // Add user message
        this.addMessage('user', prompt);
        promptInput.value = '';

        try {
            const response = await fetch('/api/ai/generate-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    prompt: prompt,
                    requestType: 'general_assistance'
                })
            });

            const result = await response.json();

            if (result.success) {
                this.addMessage('assistant', result.content);
                this.credits -= result.creditsUsed || 10;
                this.updateCreditsDisplay();
            } else {
                if (result.error === 'insufficient_credits') {
                    this.addMessage('system', result.message);
                    this.showCreditsModal();
                } else {
                    this.addMessage('system', 'Failed to generate response. Please try again.');
                }
            }
        } catch (error) {
            console.error('AI request failed:', error);
            this.addMessage('system', 'Network error. Please check your connection and try again.');
        } finally {
            // Re-enable input
            promptInput.disabled = false;
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
            promptInput.focus();
        }
    }

    addMessage(type, content) {
        const messagesArea = this.panel.querySelector('#ai-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${type}`;
        messageDiv.textContent = content;
        messagesArea.appendChild(messageDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    async handleQuickAction(action) {
        switch (action) {
            case 'write-page':
                this.showBusinessInfoModal();
                break;
            case 'improve-text':
                this.improveSelectedText();
                break;
            case 'seo-optimize':
                this.optimizeForSEO();
                break;
            case 'generate-alt':
                this.generateAltText();
                break;
        }
    }

    showBusinessInfoModal() {
        // Create business info modal for "Write My Site" feature
        const modal = document.createElement('div');
        modal.className = 'credits-modal show';
        modal.innerHTML = `
            <div class="credits-modal-content">
                <h3>Tell us about your photography business</h3>
                <form id="business-info-form">
                    <div style="margin-bottom: 16px;">
                        <label>Business Name:</label>
                        <input type="text" name="businessName" required style="width: 100%; padding: 8px; margin-top: 4px;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label>Photography Specialty:</label>
                        <select name="specialty" style="width: 100%; padding: 8px; margin-top: 4px;">
                            <option value="wedding">Wedding Photography</option>
                            <option value="portrait">Portrait Photography</option>
                            <option value="family">Family Photography</option>
                            <option value="commercial">Commercial Photography</option>
                            <option value="fashion">Fashion Photography</option>
                            <option value="landscape">Landscape Photography</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label>Location:</label>
                        <input type="text" name="location" placeholder="City, State" style="width: 100%; padding: 8px; margin-top: 4px;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label>Years of Experience:</label>
                        <input type="text" name="experience" placeholder="e.g., 5+ years" style="width: 100%; padding: 8px; margin-top: 4px;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label>What makes you unique?</label>
                        <textarea name="uniquePoints" placeholder="Describe your style, approach, or what sets you apart..." style="width: 100%; padding: 8px; margin-top: 4px; height: 60px;"></textarea>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button type="button" onclick="this.closest('.credits-modal').remove()" style="padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
                        <button type="submit" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Generate My Site</button>
                    </div>
                </form>
            </div>
        `;

        modal.querySelector('#business-info-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const businessInfo = Object.fromEntries(formData);
            
            modal.remove();
            await this.generateFullSite(businessInfo);
        });

        document.body.appendChild(modal);
    }

    async generateFullSite(businessInfo) {
        this.addMessage('user', `Generate a complete website for ${businessInfo.businessName}`);
        this.addMessage('system', 'Generating your complete website content...');

        try {
            const response = await fetch('/api/ai/generate-page-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ businessInfo })
            });

            const result = await response.json();

            if (result.success) {
                this.applyGeneratedContent(result.content);
                this.addMessage('assistant', 'Complete website content generated and applied to your pages!');
                this.credits -= result.creditsUsed || 50;
                this.updateCreditsDisplay();
            } else {
                this.addMessage('system', result.message || 'Failed to generate website content.');
            }
        } catch (error) {
            console.error('Failed to generate site:', error);
            this.addMessage('system', 'Failed to generate website content. Please try again.');
        }
    }

    applyGeneratedContent(content) {
        try {
            const parsedContent = JSON.parse(content);
            
            // Apply content to current page blocks
            const heroHeading = document.querySelector('h1[contenteditable], .hero h1, .hero-title');
            const heroSubtext = document.querySelector('.hero p, .hero-subtitle, .hero-description');
            const aboutSection = document.querySelector('.about-content, .about p, [class*="about"] p');
            
            if (heroHeading && parsedContent.heroHeadline) {
                heroHeading.textContent = parsedContent.heroHeadline;
            }
            
            if (heroSubtext && parsedContent.heroSubtext) {
                heroSubtext.textContent = parsedContent.heroSubtext;
            }
            
            if (aboutSection && parsedContent.aboutSection) {
                aboutSection.innerHTML = parsedContent.aboutSection.replace(/\n/g, '<br>');
            }

        } catch (error) {
            console.error('Failed to parse generated content:', error);
            // Fallback: just display the raw content
            this.addMessage('assistant', content);
        }
    }

    async showCreditsModal() {
        try {
            const response = await fetch('/api/ai/credit-bundles');
            const data = await response.json();

            if (!data.success) {
                console.error('Failed to load credit bundles');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'credits-modal show';
            modal.innerHTML = `
                <div class="credits-modal-content">
                    <h3>Purchase AI Credits</h3>
                    <p>Choose a credit bundle to continue using AI features:</p>
                    <div class="credit-bundles">
                        ${data.bundles.map(bundle => `
                            <div class="credit-bundle ${bundle.popular ? 'popular' : ''}" data-credits="${bundle.credits}" data-price="${bundle.price}">
                                <div class="bundle-info">
                                    <h4>${bundle.credits.toLocaleString()} Credits</h4>
                                    <p>Perfect for ${this.getBundleDescription(bundle.credits)}</p>
                                </div>
                                <div class="bundle-price">$${bundle.price}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
                        <button onclick="this.closest('.credits-modal').remove()" style="padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
                    </div>
                </div>
            `;

            // Add click handlers for bundles
            modal.querySelectorAll('.credit-bundle').forEach(bundle => {
                bundle.addEventListener('click', async () => {
                    const credits = parseInt(bundle.dataset.credits);
                    const price = parseFloat(bundle.dataset.price);
                    
                    modal.remove();
                    await this.purchaseCredits(credits, price);
                });
            });

            // Close modal when clicking outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });

            document.body.appendChild(modal);
        } catch (error) {
            console.error('Failed to show credits modal:', error);
        }
    }

    getBundleDescription(credits) {
        if (credits <= 1000) return 'basic content generation';
        if (credits <= 5000) return 'small websites';
        if (credits <= 10000) return 'medium websites';
        if (credits <= 25000) return 'large websites';
        return 'multiple websites';
    }

    async purchaseCredits(credits, price) {
        console.log('Attempting to purchase:', credits, 'credits for $', price);
        
        try {
            const response = await fetch('/api/ai/purchase-credits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ credits, priceUsd: price })
            });

            console.log('Purchase response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Purchase failed with error:', errorText);
                alert(`Purchase failed: ${response.status} ${response.statusText}`);
                return;
            }

            const result = await response.json();
            console.log('Purchase result:', result);

            if (result.success && result.checkoutUrl) {
                console.log('Redirecting to Stripe checkout:', result.checkoutUrl);
                window.location.href = result.checkoutUrl;
            } else {
                console.error('Purchase result error:', result);
                alert(result.error || 'Failed to initiate purchase. Please try again.');
            }
        } catch (error) {
            console.error('Purchase request failed:', error);
            alert('Network error. Please check your connection and try again.');
        }
    }

    addAIButtons() {
        // Add AI helper buttons to editable elements
        const addAIButton = (element) => {
            if (element.querySelector('.ai-block-button')) return;

            const aiButton = document.createElement('button');
            aiButton.className = 'ai-block-button';
            aiButton.textContent = 'AI';
            aiButton.title = 'AI Assistant';
            
            aiButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.open();
                
                // Pre-fill prompt based on element type
                const promptInput = this.panel.querySelector('#ai-prompt');
                const currentText = element.textContent.trim();
                
                if (currentText) {
                    promptInput.value = `Improve this text: "${currentText}"`;
                } else {
                    const elementType = element.tagName.toLowerCase();
                    switch (elementType) {
                        case 'h1':
                            promptInput.value = 'Write a compelling headline for a photography website';
                            break;
                        case 'h2':
                            promptInput.value = 'Write a section heading for a photography website';
                            break;
                        case 'p':
                            promptInput.value = 'Write engaging paragraph content for a photography website';
                            break;
                        default:
                            promptInput.value = 'Help me write content for this section';
                    }
                }
            });

            element.style.position = 'relative';
            element.appendChild(aiButton);
        };

        // Add to existing editable elements
        document.querySelectorAll('[contenteditable="true"]').forEach(addAIButton);

        // Add to blocks
        document.querySelectorAll('.block, .content-block').forEach(addAIButton);

        // Observer for dynamically added elements
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.hasAttribute('contenteditable') || node.classList.contains('block') || node.classList.contains('content-block')) {
                            addAIButton(node);
                        }
                        
                        node.querySelectorAll && node.querySelectorAll('[contenteditable="true"], .block, .content-block').forEach(addAIButton);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Initialize AI Assistant when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on website builder page
    if (window.location.pathname.includes('website-builder')) {
        window.aiAssistant = new AIAssistant();
        
        // Check for successful credit purchase
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('credits_purchased') === 'true') {
            setTimeout(() => {
                window.aiAssistant.loadCredits();
                window.aiAssistant.addMessage('system', 'Credits successfully purchased! You can now use AI features.');
            }, 1000);
        }
    }
});