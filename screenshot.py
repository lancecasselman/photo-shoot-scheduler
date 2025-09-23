from playwright.sync_api import sync_playwright
import time

def take_screenshot():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        # Set viewport size
        page.set_viewport_size({"width": 1200, "height": 800})
        
        try:
            # Navigate to client gallery
            page.goto("http://localhost:5000/client-gallery.html?token=dda7ad42-1613-4bac-9fe0-7b38d10dba80")
            
            # Wait for loading to complete
            time.sleep(3)
            
            # Wait for photo cards to load
            page.wait_for_selector(".photo-card", timeout=10000)
            
            # Take screenshot
            page.screenshot(path="gallery_before.png", full_page=True)
            print("Screenshot saved as gallery_before.png")
            
        except Exception as e:
            print(f"Error: {e}")
            # Take screenshot anyway to see what's there
            page.screenshot(path="gallery_error.png", full_page=True)
            print("Error screenshot saved as gallery_error.png")
        
        browser.close()

if __name__ == "__main__":
    take_screenshot()