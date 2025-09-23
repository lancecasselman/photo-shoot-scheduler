const { chromium } = require('playwright');

async function takeScreenshot() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Set viewport size for consistent screenshots
    await page.setViewportSize({ width: 1200, height: 800 });
    
    try {
        // Navigate to client gallery with token
        await page.goto('http://localhost:5000/client-gallery.html?token=dda7ad42-1613-4bac-9fe0-7b38d10dba80');
        
        // Wait for gallery to load
        await page.waitForSelector('.photo-card', { timeout: 10000 });
        
        // Take screenshot
        await page.screenshot({ 
            path: 'gallery_before.png',
            fullPage: true
        });
        
        console.log('Screenshot saved as gallery_before.png');
        
    } catch (error) {
        console.error('Error taking screenshot:', error.message);
        
        // Try to take a screenshot anyway to see what's showing
        await page.screenshot({ 
            path: 'gallery_error.png',
            fullPage: true
        });
        console.log('Error screenshot saved as gallery_error.png');
    }
    
    await browser.close();
}

takeScreenshot();