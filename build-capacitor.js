#!/usr/bin/env node

// Build script for Capacitor iOS app
// This script syncs your development files to the www directory and builds the app

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Building Capacitor iOS App...');

// Files to sync from root to www directory
const filesToSync = [
    'index.html',
    'style.css', 
    'script.js',
    'manifest.json',
    'sw.js',
    'icon-192x192.svg',
    'icon-512x512.svg'
];

// Function to copy files
function copyFile(src, dest) {
    try {
        fs.copyFileSync(src, dest);
        console.log(`✅ Copied ${src} to ${dest}`);
    } catch (error) {
        console.error(`❌ Error copying ${src}:`, error.message);
    }
}

// Function to update HTML for Capacitor
function updateHtmlForCapacitor(htmlPath) {
    try {
        let html = fs.readFileSync(htmlPath, 'utf8');
        
        // Add Capacitor-specific viewport meta tag
        html = html.replace(
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">'
        );
        
        // Add Capacitor CDN scripts if not present
        if (!html.includes('@capacitor/core')) {
            const capacitorScripts = `
    <!-- Capacitor Core -->
    <script type="module" src="https://cdn.jsdelivr.net/npm/@capacitor/core@latest/dist/capacitor.js"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@capacitor/app@latest/dist/plugin.js"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@capacitor/camera@latest/dist/plugin.js"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@capacitor/device@latest/dist/plugin.js"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@capacitor/keyboard@latest/dist/plugin.js"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@capacitor/network@latest/dist/plugin.js"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@capacitor/push-notifications@latest/dist/plugin.js"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@capacitor/splash-screen@latest/dist/plugin.js"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@capacitor/status-bar@latest/dist/plugin.js"></script>`;
            
            html = html.replace('</head>', capacitorScripts + '\n</head>');
        }
        
        fs.writeFileSync(htmlPath, html);
        console.log('✅ Updated HTML for Capacitor');
    } catch (error) {
        console.error('❌ Error updating HTML:', error.message);
    }
}

// Function to update CSS for mobile
function updateCssForMobile(cssPath) {
    try {
        let css = fs.readFileSync(cssPath, 'utf8');
        
        // Add mobile-specific styles
        const mobileStyles = `
/* Capacitor iOS App Styles */
body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
}

.camera-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 25px;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    margin: 10px 0;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.camera-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
}

.client-photo {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
    margin: 10px 0;
    border: 3px solid #667eea;
}

.contact-btn {
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 20px;
    padding: 8px 16px;
    margin: 2px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.contact-btn:hover {
    background: #45a049;
    transform: translateY(-1px);
}

.call-btn { background: #2196F3; }
.sms-btn { background: #FF9800; }
.email-btn { background: #9C27B0; }

.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    max-width: 300px;
}

.notification h4 {
    margin: 0 0 8px 0;
    color: #333;
}

.notification p {
    margin: 0;
    color: #666;
}

.offline {
    background: #ff6b6b;
    color: white;
}

.online {
    background: #4CAF50;
    color: white;
}

/* Mobile-specific adjustments */
@media (max-width: 768px) {
    .form-grid {
        grid-template-columns: 1fr;
    }
    
    .sessions-grid {
        grid-template-columns: 1fr;
    }
    
    .camera-btn {
        width: 100%;
        margin: 10px 0;
    }
    
    .contact-btn {
        flex: 1;
        margin: 2px;
    }
    
    .session-contacts {
        display: flex;
        gap: 4px;
    }
}
`;
        
        // Add mobile styles if not present
        if (!css.includes('Capacitor iOS App Styles')) {
            css += mobileStyles;
            fs.writeFileSync(cssPath, css);
            console.log('✅ Added mobile styles to CSS');
        }
    } catch (error) {
        console.error('❌ Error updating CSS:', error.message);
    }
}

// Main build process
function buildCapacitorApp() {
    console.log('1. Syncing files to www directory...');
    
    // Ensure www directory exists
    if (!fs.existsSync('www')) {
        fs.mkdirSync('www');
        console.log('✅ Created www directory');
    }
    
    // Copy files to www directory
    filesToSync.forEach(file => {
        if (fs.existsSync(file)) {
            copyFile(file, path.join('www', file));
        } else {
            console.log(`⚠️  File ${file} not found, skipping...`);
        }
    });
    
    // Update files for Capacitor
    console.log('2. Updating files for Capacitor...');
    updateHtmlForCapacitor('www/index.html');
    updateCssForMobile('www/style.css');
    
    // Copy the enhanced Capacitor script
    if (fs.existsSync('www/capacitor-script.js')) {
        console.log('3. Capacitor-enhanced script ready');
    }
    
    // Build and sync Capacitor
    console.log('4. Syncing Capacitor...');
    try {
        execSync('npx cap sync ios', { stdio: 'inherit' });
        console.log('✅ Capacitor sync completed');
    } catch (error) {
        console.error('❌ Capacitor sync failed:', error.message);
    }
    
    console.log('🎉 Capacitor iOS app build completed!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Open iOS project: npx cap open ios');
    console.log('2. Build and run in Xcode');
    console.log('3. Test on iOS device/simulator');
}

// Run the build
buildCapacitorApp();