const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  
  // Set desktop viewport first
  await page.setViewport({ width: 1200, height: 800 });
  
  try {
    console.log('🚀 Starting Print Lab testing...');
    
    // Navigate to the app
    console.log('📱 Loading app...');
    await page.goto('http://localhost:5000/app', { waitUntil: 'networkidle2' });
    
    // Wait for app to load and hamburger menu to be available
    await page.waitForSelector('.hamburger-menu', { timeout: 10000 });
    console.log('✅ App loaded successfully');
    
    // Click hamburger menu
    console.log('🍔 Opening hamburger menu...');
    await page.click('.hamburger-menu');
    await page.waitForTimeout(500);
    
    // Wait for mobile menu to appear and click Print Lab
    await page.waitForSelector('.mobile-menu', { timeout: 5000 });
    console.log('🏷️ Clicking Print Lab...');
    
    // Look for Print Lab link and click it
    const printLabLink = await page.$x("//a[contains(text(), '🏷️ Print Lab')]");
    if (printLabLink.length > 0) {
      await printLabLink[0].click();
      console.log('✅ Print Lab link clicked');
    } else {
      throw new Error('❌ Print Lab link not found');
    }
    
    // Wait for Print Lab to load
    await page.waitForTimeout(2000);
    
    // Check if Print Lab content is visible
    const printLabTab = await page.$('#printLabTab');
    if (printLabTab) {
      const isVisible = await page.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }, printLabTab);
      
      if (isVisible) {
        console.log('✅ Print Lab interface is visible');
        
        // Wait for products to load
        await page.waitForTimeout(3000);
        
        // Check if products loaded
        const productsGrid = await page.$('#printLabGrid');
        if (productsGrid) {
          const gridVisible = await page.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none';
          }, productsGrid);
          
          if (gridVisible) {
            console.log('✅ Print Lab products grid is visible');
            
            // Take desktop screenshot
            await page.screenshot({
              path: 'print_lab_desktop.png',
              fullPage: true
            });
            console.log('📸 Desktop screenshot saved');
            
            // Test mobile view
            console.log('📱 Testing mobile responsiveness...');
            await page.setViewport({ width: 375, height: 667 });
            await page.waitForTimeout(1000);
            
            await page.screenshot({
              path: 'print_lab_mobile.png',
              fullPage: true
            });
            console.log('📸 Mobile screenshot saved');
            
            console.log('✅ Print Lab testing completed successfully!');
          } else {
            console.log('⚠️ Products grid not visible yet');
          }
        } else {
          console.log('⚠️ Products grid element not found');
        }
      } else {
        console.log('❌ Print Lab tab not visible');
      }
    } else {
      console.log('❌ Print Lab tab element not found');
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    
    // Take error screenshot
    await page.screenshot({
      path: 'print_lab_error.png',
      fullPage: true
    });
    console.log('📸 Error screenshot saved');
  }
  
  await browser.close();
})();
