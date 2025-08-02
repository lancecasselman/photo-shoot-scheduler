// Block Library - Prebuilt design blocks for the Website Builder
export const blockLibrary = [
    {
        id: 'header-nav',
        name: 'Header with Navigation',
        category: 'navigation',
        html: `
            <div class="block header-block" contenteditable="false" style="background: #2c3e50; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
                <h1 contenteditable="true" style="margin: 0; font-size: 24px;">Your Brand</h1>
                <nav contenteditable="true" style="display: flex; gap: 20px;">
                    <a href="#" style="color: white; text-decoration: none;">Home</a>
                    <a href="#" style="color: white; text-decoration: none;">About</a>
                    <a href="#" style="color: white; text-decoration: none;">Services</a>
                    <a href="#" style="color: white; text-decoration: none;">Contact</a>
                </nav>
            </div>
        `
    },
    {
        id: 'hero-section',
        name: 'Hero Section',
        category: 'content',
        html: `
            <div class="block hero-block" contenteditable="false" style="background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600"><rect width="1200" height="600" fill="%234a90e2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="24">Hero Background</text></svg>'); background-size: cover; color: white; text-align: center; padding: 100px 20px;">
                <h1 contenteditable="true" style="font-size: 48px; margin-bottom: 20px;">Welcome to Our Website</h1>
                <p contenteditable="true" style="font-size: 20px; margin-bottom: 30px; max-width: 600px; margin-left: auto; margin-right: auto;">Create amazing experiences with our professional services and cutting-edge solutions.</p>
                <button contenteditable="true" style="background: #e74c3c; color: white; border: none; padding: 15px 30px; font-size: 18px; border-radius: 5px; cursor: pointer;">Get Started</button>
            </div>
        `
    },
    {
        id: 'text-image-row',
        name: 'Text + Image Row',
        category: 'content',
        html: `
            <div class="block text-image-block" contenteditable="false" style="display: flex; align-items: center; gap: 40px; padding: 60px 20px; max-width: 1200px; margin: 0 auto;">
                <div style="flex: 1;">
                    <h2 contenteditable="true" style="font-size: 36px; margin-bottom: 20px; color: #2c3e50;">About Our Services</h2>
                    <p contenteditable="true" style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 20px;">We provide exceptional solutions tailored to your needs. Our team of experts is dedicated to delivering high-quality results that exceed expectations.</p>
                    <p contenteditable="true" style="font-size: 16px; line-height: 1.6; color: #555;">With years of experience and a commitment to excellence, we ensure every project is completed with precision and care.</p>
                </div>
                <div style="flex: 1;">
                    <img contenteditable="false" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='500' height='300' viewBox='0 0 500 300'><rect width='500' height='300' fill='%23f8f9fa' stroke='%23dee2e6' stroke-width='2'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%236c757d' font-size='18'>Click to upload image</text></svg>" style="width: 100%; height: auto; border-radius: 8px;" alt="Service Image">
                </div>
            </div>
        `
    },
    {
        id: 'features-grid',
        name: 'Features Grid',
        category: 'content',
        html: `
            <div class="block features-block" contenteditable="false" style="padding: 60px 20px; background: #f8f9fa;">
                <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
                    <h2 contenteditable="true" style="font-size: 36px; margin-bottom: 50px; color: #2c3e50;">Our Features</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px;">
                        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                            <h3 contenteditable="true" style="font-size: 24px; margin-bottom: 15px; color: #2c3e50;">Feature One</h3>
                            <p contenteditable="true" style="color: #555; line-height: 1.6;">Description of your first amazing feature that provides value to your customers.</p>
                        </div>
                        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                            <h3 contenteditable="true" style="font-size: 24px; margin-bottom: 15px; color: #2c3e50;">Feature Two</h3>
                            <p contenteditable="true" style="color: #555; line-height: 1.6;">Description of your second amazing feature that sets you apart from the competition.</p>
                        </div>
                        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                            <h3 contenteditable="true" style="font-size: 24px; margin-bottom: 15px; color: #2c3e50;">Feature Three</h3>
                            <p contenteditable="true" style="color: #555; line-height: 1.6;">Description of your third amazing feature that completes your service offering.</p>
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    {
        id: 'contact-section',
        name: 'Contact Section',
        category: 'content',
        html: `
            <div class="block contact-block" contenteditable="false" style="padding: 60px 20px; background: #2c3e50; color: white;">
                <div style="max-width: 800px; margin: 0 auto; text-align: center;">
                    <h2 contenteditable="true" style="font-size: 36px; margin-bottom: 20px;">Get In Touch</h2>
                    <p contenteditable="true" style="font-size: 18px; margin-bottom: 40px;">Ready to start your project? Contact us today for a free consultation.</p>
                    <div style="display: flex; justify-content: center; gap: 40px; flex-wrap: wrap;">
                        <div>
                            <h4 contenteditable="true" style="margin-bottom: 10px;">Email</h4>
                            <p contenteditable="true" style="color: #bdc3c7;">contact@yoursite.com</p>
                        </div>
                        <div>
                            <h4 contenteditable="true" style="margin-bottom: 10px;">Phone</h4>
                            <p contenteditable="true" style="color: #bdc3c7;">(555) 123-4567</p>
                        </div>
                        <div>
                            <h4 contenteditable="true" style="margin-bottom: 10px;">Address</h4>
                            <p contenteditable="true" style="color: #bdc3c7;">123 Business St, City, State 12345</p>
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    {
        id: 'footer',
        name: 'Footer',
        category: 'navigation',
        html: `
            <div class="block footer-block" contenteditable="false" style="background: #34495e; color: white; padding: 40px 20px; text-align: center;">
                <div style="max-width: 1200px; margin: 0 auto;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; margin-bottom: 20px;">
                        <h3 contenteditable="true" style="margin: 0;">Your Brand</h3>
                        <nav contenteditable="true" style="display: flex; gap: 20px; flex-wrap: wrap;">
                            <a href="#" style="color: #bdc3c7; text-decoration: none;">Privacy</a>
                            <a href="#" style="color: #bdc3c7; text-decoration: none;">Terms</a>
                            <a href="#" style="color: #bdc3c7; text-decoration: none;">Support</a>
                        </nav>
                    </div>
                    <hr style="border: none; border-top: 1px solid #555; margin: 20px 0;">
                    <p contenteditable="true" style="color: #bdc3c7; margin: 0;">© 2025 Your Brand. All rights reserved.</p>
                </div>
            </div>
        `
    }
];

// Make available globally for the website builder
if (typeof window !== 'undefined') {
    window.blockLibrary = blockLibrary;
}