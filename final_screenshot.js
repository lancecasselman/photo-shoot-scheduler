const { chromium } = require('playwright');

async function takeScreenshot() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    await page.setViewportSize({ width: 1200, height: 800 });
    
    try {
        console.log('Taking final screenshot of improved gallery interface...');
        
        await page.goto('http://localhost:5000/client-gallery.html?token=dda7ad42-1613-4bac-9fe0-7b38d10dba80');
        
        // Wait for gallery to load
        await page.waitForTimeout(3000);
        
        await page.screenshot({ 
            path: 'gallery_after_improvements.png',
            fullPage: true
        });
        
        console.log('✅ Final screenshot saved as gallery_after_improvements.png');
        
    } catch (error) {
        console.error('Screenshot error:', error.message);
        await page.screenshot({ path: 'gallery_final_attempt.png', fullPage: true });
        console.log('Fallback screenshot saved as gallery_final_attempt.png');
    }
    
    await browser.close();
}

takeScreenshot();