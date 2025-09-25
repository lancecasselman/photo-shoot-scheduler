const { chromium } = require('playwright');

async function testFreemiumGallery() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    console.log('🚀 Starting Freemium Gallery Test...\n');
    
    try {
        // Test 1: Navigate to gallery
        console.log('📍 Test 1: Navigating to John Casselman gallery...');
        await page.goto('http://localhost:5000/g/dda7ad42-1613-4bac-9fe0-7b38d10dba80');
        await page.waitForLoadState('networkidle');
        console.log('✅ Gallery loaded successfully\n');
        
        // Test 2: Check for gallery loaded state
        console.log('📍 Test 2: Verifying gallery initialization...');
        await page.waitForSelector('.gallery-grid', { timeout: 10000 });
        const photoCards = await page.$$('.photo-card');
        console.log(`✅ Found ${photoCards.length} photo cards in gallery\n`);
        
        // Test 3: Verify download buttons are visible
        console.log('📍 Test 3: Checking download buttons visibility...');
        let downloadButtonsFound = 0;
        for (let i = 0; i < photoCards.length; i++) {
            const downloadBtn = await photoCards[i].$('.download-btn');
            if (downloadBtn) {
                downloadButtonsFound++;
                const isVisible = await downloadBtn.isVisible();
                console.log(`   Photo ${i + 1}: Download button ${isVisible ? '✅ visible' : '❌ hidden'}`);
            } else {
                console.log(`   Photo ${i + 1}: ❌ No download button found`);
            }
        }
        console.log(`✅ Download buttons found on ${downloadButtonsFound}/${photoCards.length} photos\n`);
        
        // Test 4: Check freemium banner
        console.log('📍 Test 4: Checking freemium banner...');
        const banner = await page.$('.pricing-banner');
        if (banner) {
            const isVisible = await banner.isVisible();
            const bannerText = await banner.textContent();
            console.log(`   Banner visible: ${isVisible ? '✅' : '❌'}`);
            console.log(`   Banner text: "${bannerText}"`);
            
            const expectedText = '🆓 2 of 2 free downloads remaining • Then $4.66 each';
            const hasCorrectText = bannerText && bannerText.includes('2 of 2 free downloads remaining');
            console.log(`   Correct quota text: ${hasCorrectText ? '✅' : '❌'}`);
        } else {
            console.log('   ❌ Freemium banner not found');
        }
        console.log('');
        
        // Test 5: Check first 2 photos for FREE buttons
        console.log('📍 Test 5: Testing first 2 photos for FREE download buttons...');
        for (let i = 0; i < Math.min(2, photoCards.length); i++) {
            const downloadBtn = await photoCards[i].$('.download-btn');
            if (downloadBtn) {
                const buttonText = await downloadBtn.textContent();
                const isFreeButton = buttonText && buttonText.includes('FREE');
                console.log(`   Photo ${i + 1}: "${buttonText}" ${isFreeButton ? '✅ FREE' : '❌ Not FREE'}`);
                
                // Check if button has immediate download class
                const isImmediate = await downloadBtn.evaluate(btn => btn.classList.contains('immediate'));
                console.log(`   Photo ${i + 1}: Immediate download class: ${isImmediate ? '✅' : '❌'}`);
            }
        }
        console.log('');
        
        // Test 6: Check remaining photos for paid buttons
        console.log('📍 Test 6: Testing remaining photos for paid download buttons...');
        for (let i = 2; i < photoCards.length; i++) {
            const downloadBtn = await photoCards[i].$('.download-btn');
            if (downloadBtn) {
                const buttonText = await downloadBtn.textContent();
                const isPaidButton = buttonText && buttonText.includes('$4.66');
                console.log(`   Photo ${i + 1}: "${buttonText}" ${isPaidButton ? '✅ Paid' : '❌ Not paid'}`);
            }
        }
        console.log('');
        
        // Test 7: Test free download functionality (first photo)
        console.log('📍 Test 7: Testing free download functionality...');
        const firstPhotoCard = photoCards[0];
        if (firstPhotoCard) {
            const downloadBtn = await firstPhotoCard.$('.download-btn');
            if (downloadBtn) {
                console.log('   Clicking first photo FREE download button...');
                
                // Set up download listener
                const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
                
                await downloadBtn.click();
                
                try {
                    const download = await downloadPromise;
                    console.log(`   ✅ Download started immediately: ${download.suggestedFilename()}`);
                } catch (error) {
                    console.log('   ❌ No immediate download detected');
                    
                    // Check if anything was added to cart instead
                    const cartBtn = await page.$('.floating-cart');
                    if (cartBtn) {
                        const cartCount = await page.$('.cart-count');
                        if (cartCount) {
                            const count = await cartCount.textContent();
                            console.log(`   ❌ Item added to cart instead (count: ${count})`);
                        }
                    }
                }
            }
        }
        console.log('');
        
        // Test 8: Test paid download functionality (third photo)
        console.log('📍 Test 8: Testing paid download functionality (should add to cart)...');
        if (photoCards.length > 2) {
            const thirdPhotoCard = photoCards[2];
            const downloadBtn = await thirdPhotoCard.$('.download-btn');
            if (downloadBtn) {
                console.log('   Clicking third photo paid download button...');
                
                // Get initial cart count
                const cartBtn = await page.$('.floating-cart');
                let initialCartCount = 0;
                if (cartBtn) {
                    const cartCountEl = await page.$('.cart-count');
                    if (cartCountEl) {
                        initialCartCount = parseInt(await cartCountEl.textContent()) || 0;
                    }
                }
                
                await downloadBtn.click();
                await page.waitForTimeout(1000); // Wait for cart update
                
                // Check if cart count increased
                const cartCountEl = await page.$('.cart-count');
                if (cartCountEl) {
                    const newCartCount = parseInt(await cartCountEl.textContent()) || 0;
                    const addedToCart = newCartCount > initialCartCount;
                    console.log(`   Cart count: ${initialCartCount} → ${newCartCount} ${addedToCart ? '✅ Added to cart' : '❌ Not added to cart'}`);
                } else {
                    console.log('   ❌ Cart count element not found');
                }
            }
        }
        console.log('');
        
        // Test 9: Check quota banner update after potential downloads
        console.log('📍 Test 9: Checking quota banner after interactions...');
        const updatedBanner = await page.$('.pricing-banner');
        if (updatedBanner) {
            const updatedBannerText = await updatedBanner.textContent();
            console.log(`   Updated banner text: "${updatedBannerText}"`);
        }
        console.log('');
        
        // Test 10: Screenshot for visual verification
        console.log('📍 Test 10: Taking screenshot for visual verification...');
        await page.screenshot({ 
            path: 'freemium_gallery_test.png', 
            fullPage: true 
        });
        console.log('   ✅ Screenshot saved as freemium_gallery_test.png\n');
        
        console.log('🎉 Freemium Gallery Test Completed!\n');
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        await browser.close();
    }
}

// Run the test
testFreemiumGallery().catch(console.error);