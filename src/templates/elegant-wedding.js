// Elegant Wedding - Prebuilt Website Template
// Romantic wedding photography website with pastel colors and script fonts

const elegantWeddingTemplate = {
    name: "Elegant Wedding",
    description: "Romantic wedding photography with pastel colors and elegant typography",
    pages: {
        "home": {
            title: "Home",
            content: `
                <div class="block hero-block" contenteditable="false" style="position: relative; background: linear-gradient(rgba(255,248,243,0.8), rgba(255,248,243,0.8)); background-size: cover; background-position: center; color: #5d4e75; text-align: center; padding: 120px 20px; min-height: 70vh;">
                    <div class="hero-background-container" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1;">
                        <div class="image-placeholder-container" style="position: relative; width: 100%; height: 100%; background: #fff8f3; border: 2px dashed #d4af37; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                            <div class="placeholder-content" style="text-align: center; color: #d4af37;">
                                <div style="font-size: 24px; margin-bottom: 10px; color: #d4af37; font-weight: bold;">+</div>
                                <div style="font-size: 16px;">Add Romantic Hero Background</div>
                            </div>
                            <img class="uploaded-image hero-bg-image" src="" style="width: 100%; height: 100%; object-fit: cover; display: none;" alt="Hero Background">
                        </div>
                    </div>
                    <div style="position: relative; z-index: 2; max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 68px; margin-bottom: 30px; font-family: 'Dancing Script', cursive; font-weight: 400; color: #5d4e75; text-shadow: 1px 1px 3px rgba(255,255,255,0.8);">Love Stories Captured</h1>
                        <p contenteditable="true" style="font-size: 24px; margin-bottom: 50px; font-weight: 300; color: #8b7d6b; font-style: italic;">Timeless wedding photography for your most precious moments</p>
                        <button contenteditable="true" style="background: #d4af37; color: white; border: none; padding: 18px 45px; font-size: 16px; font-weight: 400; letter-spacing: 1px; cursor: pointer; transition: all 0.3s ease; border-radius: 25px; font-family: 'Cormorant Garamond', serif;">View Our Portfolio</button>
                    </div>
                </div>
                
                <div class="block timeline-block" contenteditable="false" style="padding: 100px 20px; background: linear-gradient(to bottom, #fff8f3, #f5f0e8);">
                    <div style="max-width: 1000px; margin: 0 auto; text-align: center;">
                        <h2 contenteditable="true" style="font-size: 48px; margin-bottom: 80px; color: #5d4e75; font-family: 'Dancing Script', cursive; font-weight: 400;">Your Wedding Timeline</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 40px;">
                            <div style="background: white; padding: 40px 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(93,78,117,0.1); border: 1px solid #f0e6d6;">
                                <div contenteditable="true" style="font-size: 48px; color: #d4af37; margin-bottom: 20px; font-family: 'Cormorant Garamond', serif; font-weight: 600;">01</div>
                                <h3 contenteditable="true" style="font-size: 24px; color: #5d4e75; margin-bottom: 15px; font-family: 'Cormorant Garamond', serif;">Consultation</h3>
                                <p contenteditable="true" style="color: #8b7d6b; font-size: 16px; line-height: 1.6;">We discuss your vision, style preferences, and create a personalized photography plan for your special day.</p>
                            </div>
                            <div style="background: white; padding: 40px 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(93,78,117,0.1); border: 1px solid #f0e6d6;">
                                <div contenteditable="true" style="font-size: 48px; color: #d4af37; margin-bottom: 20px; font-family: 'Cormorant Garamond', serif; font-weight: 600;">02</div>
                                <h3 contenteditable="true" style="font-size: 24px; color: #5d4e75; margin-bottom: 15px; font-family: 'Cormorant Garamond', serif;">Engagement Session</h3>
                                <p contenteditable="true" style="color: #8b7d6b; font-size: 16px; line-height: 1.6;">A romantic engagement session to capture your love story and create beautiful save-the-date images.</p>
                            </div>
                            <div style="background: white; padding: 40px 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(93,78,117,0.1); border: 1px solid #f0e6d6;">
                                <div contenteditable="true" style="font-size: 48px; color: #d4af37; margin-bottom: 20px; font-family: 'Cormorant Garamond', serif; font-weight: 600;">03</div>
                                <h3 contenteditable="true" style="font-size: 24px; color: #5d4e75; margin-bottom: 15px; font-family: 'Cormorant Garamond', serif;">Wedding Day</h3>
                                <p contenteditable="true" style="color: #8b7d6b; font-size: 16px; line-height: 1.6;">Complete wedding day coverage from preparation to reception, capturing every precious moment.</p>
                            </div>
                            <div style="background: white; padding: 40px 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(93,78,117,0.1); border: 1px solid #f0e6d6;">
                                <div contenteditable="true" style="font-size: 48px; color: #d4af37; margin-bottom: 20px; font-family: 'Cormorant Garamond', serif; font-weight: 600;">04</div>
                                <h3 contenteditable="true" style="font-size: 24px; color: #5d4e75; margin-bottom: 15px; font-family: 'Cormorant Garamond', serif;">Gallery Delivery</h3>
                                <p contenteditable="true" style="color: #8b7d6b; font-size: 16px; line-height: 1.6;">Receive your beautifully edited wedding gallery within 6-8 weeks, ready to share and treasure forever.</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="block gallery-preview-block" contenteditable="false" style="padding: 100px 20px; background: white;">
                    <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
                        <h2 contenteditable="true" style="font-size: 48px; margin-bottom: 80px; color: #5d4e75; font-family: 'Dancing Script', cursive; font-weight: 400;">Recent Weddings</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 25px; margin-bottom: 60px;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #fff8f3; border: 2px dashed #d4af37; border-radius: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #d4af37;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #d4af37; font-weight: bold;">+</div>
                                    <div style="font-size: 14px;">Wedding Photo 1</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; border-radius: 15px; display: none;" alt="Wedding Photo 1">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #fff8f3; border: 2px dashed #d4af37; border-radius: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #d4af37;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #d4af37; font-weight: bold;">+</div>
                                    <div style="font-size: 14px;">Wedding Photo 2</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; border-radius: 15px; display: none;" alt="Wedding Photo 2">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #fff8f3; border: 2px dashed #d4af37; border-radius: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #d4af37;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #d4af37; font-weight: bold;">+</div>
                                    <div style="font-size: 14px;">Wedding Photo 3</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; border-radius: 15px; display: none;" alt="Wedding Photo 3">
                            </div>
                        </div>
                        <button contenteditable="true" style="background: transparent; color: #d4af37; border: 2px solid #d4af37; padding: 15px 40px; font-size: 16px; letter-spacing: 1px; cursor: pointer; border-radius: 25px; font-family: 'Cormorant Garamond', serif;">View Complete Gallery</button>
                    </div>
                </div>
                
                <div class="block testimonial-block" contenteditable="false" style="padding: 100px 20px; background: linear-gradient(to bottom, #f5f0e8, #fff8f3);">
                    <div style="max-width: 900px; margin: 0 auto; text-align: center;">
                        <h2 contenteditable="true" style="font-size: 48px; margin-bottom: 60px; color: #5d4e75; font-family: 'Dancing Script', cursive; font-weight: 400;">What Couples Say</h2>
                        <div style="background: white; padding: 60px 40px; border-radius: 20px; box-shadow: 0 15px 40px rgba(93,78,117,0.1); border: 1px solid #f0e6d6;">
                            <blockquote contenteditable="true" style="font-size: 28px; font-style: italic; color: #5d4e75; margin-bottom: 30px; line-height: 1.6; font-family: 'Cormorant Garamond', serif; font-weight: 300;">Our wedding photos are absolutely magical! Every image captures the love and joy we felt on our special day. We couldn't have asked for more beautiful memories.</blockquote>
                            <h4 contenteditable="true" style="color: #d4af37; margin-bottom: 5px; font-size: 20px; font-family: 'Dancing Script', cursive;">Sarah & Michael</h4>
                            <p contenteditable="true" style="color: #8b7d6b; font-size: 14px; font-style: italic;">Charleston Wedding, October 2024</p>
                        </div>
                    </div>
                </div>
            `
        },
        "portfolio": {
            title: "Portfolio",
            content: `
                <div class="block portfolio-header-block" contenteditable="false" style="padding: 80px 20px; background: linear-gradient(to right, #fff8f3, #f5f0e8); color: #5d4e75; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 64px; margin-bottom: 30px; font-family: 'Dancing Script', cursive; font-weight: 400;">Wedding Portfolio</h1>
                        <p contenteditable="true" style="font-size: 24px; font-weight: 300; color: #8b7d6b; font-style: italic;">A collection of our most treasured wedding moments</p>
                    </div>
                </div>
                
                <div class="block portfolio-grid-block" contenteditable="false" style="padding: 80px 20px; background: white;">
                    <div style="max-width: 1300px; margin: 0 auto;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #fff8f3; border: 2px dashed #d4af37; border-radius: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 5px 15px rgba(212,175,55,0.1);" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #d4af37;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #d4af37; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Wedding Gallery 1</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; border-radius: 15px; display: none;" alt="Wedding Gallery 1">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #fff8f3; border: 2px dashed #d4af37; border-radius: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 5px 15px rgba(212,175,55,0.1);" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #d4af37;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #d4af37; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Wedding Gallery 2</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; border-radius: 15px; display: none;" alt="Wedding Gallery 2">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #fff8f3; border: 2px dashed #d4af37; border-radius: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 5px 15px rgba(212,175,55,0.1);" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #d4af37;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #d4af37; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Wedding Gallery 3</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; border-radius: 15px; display: none;" alt="Wedding Gallery 3">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #fff8f3; border: 2px dashed #d4af37; border-radius: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 5px 15px rgba(212,175,55,0.1);" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #d4af37;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #d4af37; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Wedding Gallery 4</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; border-radius: 15px; display: none;" alt="Wedding Gallery 4">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #fff8f3; border: 2px dashed #d4af37; border-radius: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 5px 15px rgba(212,175,55,0.1);" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #d4af37;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #d4af37; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Wedding Gallery 5</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; border-radius: 15px; display: none;" alt="Wedding Gallery 5">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #fff8f3; border: 2px dashed #d4af37; border-radius: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 5px 15px rgba(212,175,55,0.1);" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #d4af37;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #d4af37; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Wedding Gallery 6</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; border-radius: 15px; display: none;" alt="Wedding Gallery 6">
                            </div>
                        </div>
                    </div>
                </div>
            `
        },
        "about": {
            title: "About",
            content: `
                <div class="block about-hero-block" contenteditable="false" style="padding: 100px 20px; background: linear-gradient(to bottom, #fff8f3, #f5f0e8);">
                    <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 80px;">
                        <div style="flex: 1;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; background: #fff8f3; border: 2px dashed #d4af37; border-radius: 20px; min-height: 600px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 10px 30px rgba(212,175,55,0.2);" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #d4af37;">
                                    <div style="font-size: 28px; margin-bottom: 12px; color: #d4af37; font-weight: bold;">+</div>
                                    <div style="font-size: 18px;">Couple Portrait</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: auto; border-radius: 20px; display: none;" alt="Couple Portrait">
                            </div>
                        </div>
                        <div style="flex: 1; color: #5d4e75;">
                            <h1 contenteditable="true" style="font-size: 56px; margin-bottom: 40px; font-family: 'Dancing Script', cursive; font-weight: 400; color: #5d4e75;">Our Love Story</h1>
                            <p contenteditable="true" style="font-size: 20px; line-height: 1.8; margin-bottom: 30px; color: #8b7d6b;">We are Sarah and David, a husband and wife photography team who believes that every love story deserves to be told with beauty, authenticity, and grace.</p>
                            <p contenteditable="true" style="font-size: 20px; line-height: 1.8; margin-bottom: 30px; color: #8b7d6b;">With over 7 years of experience capturing weddings across the Southeast, we understand the importance of preserving the precious moments that make your day uniquely yours.</p>
                            <p contenteditable="true" style="font-size: 20px; line-height: 1.8; margin-bottom: 40px; color: #8b7d6b;">Our romantic, timeless style ensures that your wedding photos will be treasured for generations to come.</p>
                            <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 25px rgba(93,78,117,0.1);">
                                <h3 contenteditable="true" style="font-size: 24px; color: #d4af37; margin-bottom: 20px; font-family: 'Dancing Script', cursive;">Recognition & Awards</h3>
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                                    <div contenteditable="true" style="color: #8b7d6b; font-size: 16px;">Charleston Wedding Awards 2024</div>
                                    <div contenteditable="true" style="color: #8b7d6b; font-size: 16px;">The Knot Best of Weddings</div>
                                    <div contenteditable="true" style="color: #8b7d6b; font-size: 16px;">WeddingWire Couples Choice</div>
                                    <div contenteditable="true" style="color: #8b7d6b; font-size: 16px;">Southern Bride Magazine</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="block values-block" contenteditable="false" style="padding: 100px 20px; background: white;">
                    <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
                        <h2 contenteditable="true" style="font-size: 48px; margin-bottom: 80px; color: #5d4e75; font-family: 'Dancing Script', cursive; font-weight: 400;">Our Approach</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 50px;">
                            <div style="background: linear-gradient(to bottom, #fff8f3, #f5f0e8); padding: 50px 30px; border-radius: 20px; box-shadow: 0 10px 25px rgba(93,78,117,0.1);">
                                <h3 contenteditable="true" style="font-size: 28px; color: #d4af37; margin-bottom: 20px; font-family: 'Dancing Script', cursive;">Authenticity</h3>
                                <p contenteditable="true" style="color: #8b7d6b; font-size: 18px; line-height: 1.6;">We capture genuine emotions and real moments, allowing your true personalities to shine through every image.</p>
                            </div>
                            <div style="background: linear-gradient(to bottom, #fff8f3, #f5f0e8); padding: 50px 30px; border-radius: 20px; box-shadow: 0 10px 25px rgba(93,78,117,0.1);">
                                <h3 contenteditable="true" style="font-size: 28px; color: #d4af37; margin-bottom: 20px; font-family: 'Dancing Script', cursive;">Elegance</h3>
                                <p contenteditable="true" style="color: #8b7d6b; font-size: 18px; line-height: 1.6;">Our romantic, timeless style creates images that are both beautiful and sophisticated, perfect for any home.</p>
                            </div>
                            <div style="background: linear-gradient(to bottom, #fff8f3, #f5f0e8); padding: 50px 30px; border-radius: 20px; box-shadow: 0 10px 25px rgba(93,78,117,0.1);">
                                <h3 contenteditable="true" style="font-size: 28px; color: #d4af37; margin-bottom: 20px; font-family: 'Dancing Script', cursive;">Care</h3>
                                <p contenteditable="true" style="color: #8b7d6b; font-size: 18px; line-height: 1.6;">We treat every couple with the utmost care and attention, ensuring your wedding day experience is stress-free and joyful.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `
        },
        "contact": {
            title: "Contact",
            content: `
                <div class="block contact-hero-block" contenteditable="false" style="padding: 80px 20px; background: linear-gradient(to right, #fff8f3, #f5f0e8); color: #5d4e75; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 64px; margin-bottom: 30px; font-family: 'Dancing Script', cursive; font-weight: 400;">Let's Connect</h1>
                        <p contenteditable="true" style="font-size: 24px; font-weight: 300; color: #8b7d6b; font-style: italic;">We would love to hear about your special day</p>
                    </div>
                </div>
                
                <div class="block contact-form-block" contenteditable="false" style="padding: 100px 20px; background: white;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <div style="background: linear-gradient(to bottom, #fff8f3, #f5f0e8); padding: 60px 50px; border-radius: 25px; box-shadow: 0 15px 40px rgba(93,78,117,0.1); border: 2px solid #f0e6d6;">
                            <form style="display: grid; gap: 25px;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
                                    <input contenteditable="true" placeholder="Bride's Name" style="padding: 18px 20px; background: white; border: 2px solid #d4af37; color: #5d4e75; font-size: 16px; border-radius: 15px; font-family: 'Cormorant Garamond', serif;">
                                    <input contenteditable="true" placeholder="Groom's Name" style="padding: 18px 20px; background: white; border: 2px solid #d4af37; color: #5d4e75; font-size: 16px; border-radius: 15px; font-family: 'Cormorant Garamond', serif;">
                                </div>
                                <input contenteditable="true" placeholder="Email Address" style="padding: 18px 20px; background: white; border: 2px solid #d4af37; color: #5d4e75; font-size: 16px; border-radius: 15px; font-family: 'Cormorant Garamond', serif;">
                                <input contenteditable="true" placeholder="Phone Number" style="padding: 18px 20px; background: white; border: 2px solid #d4af37; color: #5d4e75; font-size: 16px; border-radius: 15px; font-family: 'Cormorant Garamond', serif;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
                                    <input contenteditable="true" placeholder="Wedding Date" style="padding: 18px 20px; background: white; border: 2px solid #d4af37; color: #5d4e75; font-size: 16px; border-radius: 15px; font-family: 'Cormorant Garamond', serif;">
                                    <input contenteditable="true" placeholder="Wedding Venue" style="padding: 18px 20px; background: white; border: 2px solid #d4af37; color: #5d4e75; font-size: 16px; border-radius: 15px; font-family: 'Cormorant Garamond', serif;">
                                </div>
                                <select contenteditable="true" style="padding: 18px 20px; background: white; border: 2px solid #d4af37; color: #5d4e75; font-size: 16px; border-radius: 15px; font-family: 'Cormorant Garamond', serif;">
                                    <option>Photography Package Interest</option>
                                    <option>Essential Wedding</option>
                                    <option>Complete Wedding</option>
                                    <option>Luxury Wedding</option>
                                    <option>Engagement Only</option>
                                </select>
                                <textarea contenteditable="true" placeholder="Tell us about your wedding vision and any special requests..." style="padding: 18px 20px; background: white; border: 2px solid #d4af37; color: #5d4e75; font-size: 16px; min-height: 120px; border-radius: 15px; resize: vertical; font-family: 'Cormorant Garamond', serif;"></textarea>
                                <button type="submit" style="background: #d4af37; color: white; border: none; padding: 20px; font-size: 18px; letter-spacing: 1px; cursor: pointer; border-radius: 15px; font-family: 'Cormorant Garamond', serif; font-weight: 600;">Send Our Love Story</button>
                            </form>
                        </div>
                    </div>
                </div>
                
                <div class="block contact-info-block" contenteditable="false" style="padding: 80px 20px; background: linear-gradient(to bottom, #f5f0e8, #fff8f3);">
                    <div style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 50px; text-align: center;">
                        <div style="background: white; padding: 40px 30px; border-radius: 20px; box-shadow: 0 10px 25px rgba(93,78,117,0.1);">
                            <h3 contenteditable="true" style="font-size: 24px; color: #d4af37; margin-bottom: 20px; font-family: 'Dancing Script', cursive;">Studio Location</h3>
                            <p contenteditable="true" style="color: #8b7d6b; font-size: 16px; line-height: 1.6;">456 Romance Lane<br>Historic District<br>Charleston, SC 29401</p>
                        </div>
                        <div style="background: white; padding: 40px 30px; border-radius: 20px; box-shadow: 0 10px 25px rgba(93,78,117,0.1);">
                            <h3 contenteditable="true" style="font-size: 24px; color: #d4af37; margin-bottom: 20px; font-family: 'Dancing Script', cursive;">Contact Details</h3>
                            <p contenteditable="true" style="color: #8b7d6b; font-size: 16px; line-height: 1.6;">Phone: (843) 555-LOVE<br>Email: hello@elegantweddings.com<br>Response: Within 24 hours</p>
                        </div>
                        <div style="background: white; padding: 40px 30px; border-radius: 20px; box-shadow: 0 10px 25px rgba(93,78,117,0.1);">
                            <h3 contenteditable="true" style="font-size: 24px; color: #d4af37; margin-bottom: 20px; font-family: 'Dancing Script', cursive;">Consultation Hours</h3>
                            <p contenteditable="true" style="color: #8b7d6b; font-size: 16px; line-height: 1.6;">Tuesday - Saturday: 10AM - 6PM<br>Sunday: 12PM - 4PM<br>Monday: By appointment</p>
                        </div>
                    </div>
                </div>
            `
        },
        "packages": {
            title: "Packages",
            content: `
                <div class="block packages-hero-block" contenteditable="false" style="padding: 80px 20px; background: linear-gradient(to right, #fff8f3, #f5f0e8); color: #5d4e75; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 64px; margin-bottom: 30px; font-family: 'Dancing Script', cursive; font-weight: 400;">Wedding Packages</h1>
                        <p contenteditable="true" style="font-size: 24px; font-weight: 300; color: #8b7d6b; font-style: italic;">Elegant photography collections for your special day</p>
                    </div>
                </div>
                
                <div class="block packages-grid-block" contenteditable="false" style="padding: 100px 20px; background: white;">
                    <div style="max-width: 1200px; margin: 0 auto;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 40px;">
                            <div style="background: linear-gradient(to bottom, #fff8f3, #f5f0e8); padding: 50px 40px; border-radius: 25px; text-align: center; box-shadow: 0 15px 40px rgba(93,78,117,0.1); border: 2px solid #f0e6d6;">
                                <h3 contenteditable="true" style="font-size: 32px; color: #d4af37; margin-bottom: 20px; font-family: 'Dancing Script', cursive;">Essential Wedding</h3>
                                <div contenteditable="true" style="font-size: 48px; color: #5d4e75; margin-bottom: 30px; font-family: 'Cormorant Garamond', serif; font-weight: 600;">$2,200</div>
                                <div contenteditable="true" style="color: #8b7d6b; margin-bottom: 40px; font-size: 16px; font-style: italic;">Perfect for intimate celebrations</div>
                                <ul style="list-style: none; padding: 0; margin-bottom: 50px;">
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">6 hours of wedding coverage</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">300+ professionally edited images</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">Online gallery for sharing</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">Print release included</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0;">Romantic editing style</li>
                                </ul>
                                <button contenteditable="true" style="background: #d4af37; color: white; border: none; padding: 18px 35px; font-size: 16px; letter-spacing: 1px; cursor: pointer; border-radius: 25px; font-family: 'Cormorant Garamond', serif; width: 100%;">Choose Package</button>
                            </div>
                            
                            <div style="background: linear-gradient(to bottom, #fff8f3, #f5f0e8); padding: 50px 40px; border-radius: 25px; text-align: center; box-shadow: 0 20px 50px rgba(93,78,117,0.2); border: 3px solid #d4af37; transform: scale(1.05); position: relative;">
                                <div style="background: #d4af37; color: white; padding: 12px 25px; margin: -50px -40px 30px -40px; border-radius: 25px 25px 0 0; font-weight: 600; letter-spacing: 1px; font-family: 'Cormorant Garamond', serif;">Most Popular</div>
                                <h3 contenteditable="true" style="font-size: 32px; color: #d4af37; margin-bottom: 20px; font-family: 'Dancing Script', cursive;">Complete Wedding</h3>
                                <div contenteditable="true" style="font-size: 48px; color: #5d4e75; margin-bottom: 30px; font-family: 'Cormorant Garamond', serif; font-weight: 600;">$3,500</div>
                                <div contenteditable="true" style="color: #8b7d6b; margin-bottom: 40px; font-size: 16px; font-style: italic;">Comprehensive wedding documentation</div>
                                <ul style="list-style: none; padding: 0; margin-bottom: 50px;">
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">8 hours of wedding coverage</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">500+ professionally edited images</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">Complimentary engagement session</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">Second photographer included</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">USB drive with all images</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0;">Wedding timeline planning</li>
                                </ul>
                                <button contenteditable="true" style="background: #d4af37; color: white; border: none; padding: 18px 35px; font-size: 16px; letter-spacing: 1px; cursor: pointer; border-radius: 25px; font-family: 'Cormorant Garamond', serif; width: 100%;">Choose Package</button>
                            </div>
                            
                            <div style="background: linear-gradient(to bottom, #fff8f3, #f5f0e8); padding: 50px 40px; border-radius: 25px; text-align: center; box-shadow: 0 15px 40px rgba(93,78,117,0.1); border: 2px solid #f0e6d6;">
                                <h3 contenteditable="true" style="font-size: 32px; color: #d4af37; margin-bottom: 20px; font-family: 'Dancing Script', cursive;">Luxury Wedding</h3>
                                <div contenteditable="true" style="font-size: 48px; color: #5d4e75; margin-bottom: 30px; font-family: 'Cormorant Garamond', serif; font-weight: 600;">$5,200</div>
                                <div contenteditable="true" style="color: #8b7d6b; margin-bottom: 40px; font-size: 16px; font-style: italic;">Ultimate luxury wedding experience</div>
                                <ul style="list-style: none; padding: 0; margin-bottom: 50px;">
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">Full day coverage (10+ hours)</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">700+ professionally edited images</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">Engagement & bridal sessions</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">Two photographers & assistant</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0; border-bottom: 1px solid rgba(212,175,55,0.3);">Custom wedding album</li>
                                    <li contenteditable="true" style="color: #5d4e75; margin-bottom: 15px; font-size: 16px; padding: 10px 0;">Priority booking & planning</li>
                                </ul>
                                <button contenteditable="true" style="background: #d4af37; color: white; border: none; padding: 18px 35px; font-size: 16px; letter-spacing: 1px; cursor: pointer; border-radius: 25px; font-family: 'Cormorant Garamond', serif; width: 100%;">Choose Package</button>
                            </div>
                        </div>
                    </div>
                </div>
            `
        }
    }
};

// Export the template
if (typeof module !== 'undefined' && module.exports) {
    module.exports = elegantWeddingTemplate;
}