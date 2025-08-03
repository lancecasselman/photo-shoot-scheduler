// Light & Airy Portfolio - Prebuilt Website Template
// Professional photography website template with fully editable content

const lightAiryPortfolioTemplate = {
    name: "Light & Airy Portfolio",
    description: "Professional photography website with clean, airy design",
    pages: {
        "home": {
            title: "Home",
            content: `
                <div class="block hero-block" contenteditable="false" style="background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1200\" height=\"600\" viewBox=\"0 0 1200 600\"><rect width=\"1200\" height=\"600\" fill=\"%23f5f5f0\"/><text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"%23666\" font-size=\"24\">Click to upload hero image</text></svg>'); background-size: cover; background-position: center; color: white; text-align: center; padding: 120px 20px; min-height: 60vh;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 56px; margin-bottom: 20px; font-weight: 300; letter-spacing: 2px; font-family: 'Playfair Display', serif;">Photos That Stand Out</h1>
                        <p contenteditable="true" style="font-size: 22px; margin-bottom: 40px; font-weight: 300; opacity: 0.9;">Timeless photography for life's boldest moments.</p>
                        <button contenteditable="true" style="background: transparent; color: white; border: 2px solid white; padding: 15px 40px; font-size: 16px; letter-spacing: 1px; cursor: pointer; transition: all 0.3s ease;">View My Work</button>
                    </div>
                </div>
                
                <div class="block about-preview-block" contenteditable="false" style="padding: 80px 20px; background: #fafafa;">
                    <div style="max-width: 1000px; margin: 0 auto; display: flex; align-items: center; gap: 60px;">
                        <div style="flex: 1;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; background: #f8f8f8; border: 2px dashed #ddd; border-radius: 8px; min-height: 400px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                        <div class="placeholder-content" style="text-align: center; color: #999;">
                            <div style="font-size: 24px; margin-bottom: 10px; color: #999; font-weight: bold;">+</div>
                            <div style="font-size: 16px;">Click to Add Photo</div>
                        </div>
                        <img class="uploaded-image" src="" style="width: 100%; height: auto; border-radius: 8px; display: none;" alt="About Image">
                    </div>
                        </div>
                        <div style="flex: 1;">
                            <h2 contenteditable="true" style="font-size: 36px; margin-bottom: 30px; color: #333; font-family: 'Playfair Display', serif; font-weight: 400;">Hello, I'm John</h2>
                            <p contenteditable="true" style="font-size: 18px; line-height: 1.8; color: #666; margin-bottom: 20px;">I'm a South Carolina photographer making bold moments timeless. With over 10 years of experience, I specialize in capturing the authentic emotions that make your story unique.</p>
                            <p contenteditable="true" style="font-size: 18px; line-height: 1.8; color: #666;">Every session is tailored to reflect your personality and style, creating memories you'll treasure forever.</p>
                        </div>
                    </div>
                </div>
                
                <div class="block gallery-preview-block" contenteditable="false" style="padding: 80px 20px; background: white;">
                    <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
                        <h2 contenteditable="true" style="font-size: 42px; margin-bottom: 60px; color: #333; font-family: 'Playfair Display', serif; font-weight: 400;">Recent Work</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 30px; margin-bottom: 50px;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #f8f8f8; border: 2px dashed #ddd; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #999;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #999; font-weight: bold;">+</div>
                                    <div style="font-size: 14px;">Portfolio Image 1</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; border-radius: 8px; display: none;" alt="Portfolio Image 1">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #f8f8f8; border: 2px dashed #ddd; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #999;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #999; font-weight: bold;">+</div>
                                    <div style="font-size: 14px;">Portfolio Image 2</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; border-radius: 8px; display: none;" alt="Portfolio Image 2">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #f8f8f8; border: 2px dashed #ddd; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #999;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #999; font-weight: bold;">+</div>
                                    <div style="font-size: 14px;">Portfolio Image 3</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; border-radius: 8px; display: none;" alt="Portfolio Image 3">
                            </div>
                        </div>
                        <button contenteditable="true" style="background: #333; color: white; border: none; padding: 15px 40px; font-size: 16px; letter-spacing: 1px; cursor: pointer; border-radius: 4px;">View Full Portfolio</button>
                    </div>
                </div>
                
                <div class="block testimonial-block" contenteditable="false" style="padding: 80px 20px; background: #f9f9f9;">
                    <div style="max-width: 800px; margin: 0 auto; text-align: center;">
                        <blockquote contenteditable="true" style="font-size: 28px; font-style: italic; color: #555; margin-bottom: 30px; line-height: 1.6; font-family: 'Playfair Display', serif;">"We absolutely love our photos! John captured our personalities perfectly and made us feel so comfortable during the session."</blockquote>
                        <h4 contenteditable="true" style="color: #333; margin-bottom: 5px; font-size: 18px;">Mary & James</h4>
                        <p contenteditable="true" style="color: #777; font-size: 14px;">Engagement Session</p>
                    </div>
                </div>
            `
        },
        "portfolio": {
            title: "Portfolio",
            content: `
                <div class="block portfolio-header-block" contenteditable="false" style="padding: 80px 20px 60px; background: white; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 48px; margin-bottom: 20px; color: #333; font-family: 'Playfair Display', serif; font-weight: 400;">Portfolio</h1>
                        <p contenteditable="true" style="font-size: 20px; color: #666; line-height: 1.6;">A collection of my favorite moments captured over the years</p>
                    </div>
                </div>
                
                <div class="block portfolio-categories-block" contenteditable="false" style="padding: 40px 20px; background: #fafafa; text-align: center;">
                    <div style="max-width: 600px; margin: 0 auto;">
                        <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
                            <button contenteditable="true" style="background: #333; color: white; border: none; padding: 12px 24px; font-size: 14px; letter-spacing: 1px; cursor: pointer; border-radius: 4px;">All</button>
                            <button contenteditable="true" style="background: transparent; color: #666; border: 1px solid #ddd; padding: 12px 24px; font-size: 14px; letter-spacing: 1px; cursor: pointer; border-radius: 4px;">Weddings</button>
                            <button contenteditable="true" style="background: transparent; color: #666; border: 1px solid #ddd; padding: 12px 24px; font-size: 14px; letter-spacing: 1px; cursor: pointer; border-radius: 4px;">Families</button>
                            <button contenteditable="true" style="background: transparent; color: #666; border: 1px solid #ddd; padding: 12px 24px; font-size: 14px; letter-spacing: 1px; cursor: pointer; border-radius: 4px;">Seniors</button>
                        </div>
                    </div>
                </div>
                
                <div class="block portfolio-gallery-block" contenteditable="false" style="padding: 60px 20px; background: white;">
                    <div style="max-width: 1200px; margin: 0 auto;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                            <img contenteditable="false" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'><rect width='400' height='500' fill='%23f8f8f8' stroke='%23ddd' stroke-width='2'/><text x='50%' y='40%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='16'>Wedding Photo 1</text><text x='50%' y='60%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='12'>First Look</text></svg>" style="width: 100%; height: 400px; object-fit: cover; border-radius: 8px;" alt="Wedding Photo">
                            <img contenteditable="false" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'><rect width='400' height='500' fill='%23f8f8f8' stroke='%23ddd' stroke-width='2'/><text x='50%' y='40%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='16'>Family Photo 1</text><text x='50%' y='60%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='12'>Beach Day</text></svg>" style="width: 100%; height: 400px; object-fit: cover; border-radius: 8px;" alt="Family Photo">
                            <img contenteditable="false" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'><rect width='400' height='500' fill='%23f8f8f8' stroke='%23ddd' stroke-width='2'/><text x='50%' y='40%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='16'>Senior Photo 1</text><text x='50%' y='60%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='12'>Graduation</text></svg>" style="width: 100%; height: 400px; object-fit: cover; border-radius: 8px;" alt="Senior Photo">
                            <img contenteditable="false" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'><rect width='400' height='500' fill='%23f8f8f8' stroke='%23ddd' stroke-width='2'/><text x='50%' y='40%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='16'>Wedding Photo 2</text><text x='50%' y='60%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='12'>Ceremony</text></svg>" style="width: 100%; height: 400px; object-fit: cover; border-radius: 8px;" alt="Wedding Photo">
                            <img contenteditable="false" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'><rect width='400' height='500' fill='%23f8f8f8' stroke='%23ddd' stroke-width='2'/><text x='50%' y='40%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='16'>Family Photo 2</text><text x='50%' y='60%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='12'>Holiday</text></svg>" style="width: 100%; height: 400px; object-fit: cover; border-radius: 8px;" alt="Family Photo">
                            <img contenteditable="false" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'><rect width='400' height='500' fill='%23f8f8f8' stroke='%23ddd' stroke-width='2'/><text x='50%' y='40%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='16'>Senior Photo 2</text><text x='50%' y='60%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='12'>Studio Session</text></svg>" style="width: 100%; height: 400px; object-fit: cover; border-radius: 8px;" alt="Senior Photo">
                        </div>
                    </div>
                </div>
            `
        },
        "about": {
            title: "About",
            content: `
                <div class="block about-hero-block" contenteditable="false" style="padding: 80px 20px; background: white;">
                    <div style="max-width: 1000px; margin: 0 auto; display: flex; align-items: center; gap: 60px;">
                        <div style="flex: 1;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; background: #f8f8f8; border: 2px dashed #ddd; border-radius: 8px; min-height: 500px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #999;">
                                    <div style="font-size: 24px; margin-bottom: 10px; color: #999; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Photographer Portrait</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: auto; border-radius: 8px; display: none;" alt="About Image">
                            </div>
                        </div>
                        <div style="flex: 1;">
                            <h1 contenteditable="true" style="font-size: 48px; margin-bottom: 30px; color: #333; font-family: 'Playfair Display', serif; font-weight: 400;">Hi! I'm John</h1>
                            <p contenteditable="true" style="font-size: 18px; line-height: 1.8; color: #666; margin-bottom: 25px;">I've spent 10+ years capturing the big and small moments that matter most. What started as a hobby quickly became my passion and eventually my career.</p>
                            <p contenteditable="true" style="font-size: 18px; line-height: 1.8; color: #666; margin-bottom: 25px;">Based in Charleston, South Carolina, I specialize in wedding, family, and portrait photography. My approach is natural and unposed, focusing on authentic emotions and genuine connections.</p>
                            <p contenteditable="true" style="font-size: 18px; line-height: 1.8; color: #666;">When I'm not behind the camera, you can find me exploring new locations, spending time with my family, or planning the next adventure with my wife and two kids.</p>
                        </div>
                    </div>
                </div>
                
                <div class="block awards-block" contenteditable="false" style="padding: 80px 20px; background: #fafafa; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h2 contenteditable="true" style="font-size: 36px; margin-bottom: 50px; color: #333; font-family: 'Playfair Display', serif; font-weight: 400;">Recognition & Awards</h2>
                        <div style="display: flex; justify-content: center; gap: 40px; flex-wrap: wrap;">
                            <div style="text-align: center;">
                                <img contenteditable="false" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23f8f8f8' stroke='%23ddd' stroke-width='2'/><text x='50%' y='45%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='10'>Award</text><text x='50%' y='65%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='10'>Badge</text></svg>" style="width: 100px; height: 100px; margin-bottom: 15px;" alt="Award Badge 1">
                                <p contenteditable="true" style="color: #666; font-size: 14px;">Wedding Photographer of the Year 2023</p>
                            </div>
                            <div style="text-align: center;">
                                <img contenteditable="false" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23f8f8f8' stroke='%23ddd' stroke-width='2'/><text x='50%' y='45%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='10'>Award</text><text x='50%' y='65%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='10'>Badge</text></svg>" style="width: 100px; height: 100px; margin-bottom: 15px;" alt="Award Badge 2">
                                <p contenteditable="true" style="color: #666; font-size: 14px;">Featured in Charleston Weddings Magazine</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="block philosophy-block" contenteditable="false" style="padding: 80px 20px; background: white; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h2 contenteditable="true" style="font-size: 36px; margin-bottom: 30px; color: #333; font-family: 'Playfair Display', serif; font-weight: 400;">My Philosophy</h2>
                        <p contenteditable="true" style="font-size: 20px; line-height: 1.7; color: #666; font-style: italic;">"Photography is about finding beauty in ordinary moments and preserving them for generations to come. Every photo tells a story, and I'm honored to help tell yours."</p>
                    </div>
                </div>
            `
        },
        "contact": {
            title: "Contact",
            content: `
                <div class="block contact-header-block" contenteditable="false" style="padding: 80px 20px 60px; background: white; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 48px; margin-bottom: 20px; color: #333; font-family: 'Playfair Display', serif; font-weight: 400;">Get In Touch</h1>
                        <p contenteditable="true" style="font-size: 20px; color: #666; line-height: 1.6;">Ready to capture your story? I'd love to hear from you.</p>
                    </div>
                </div>
                
                <div class="block contact-form-block" contenteditable="false" style="padding: 60px 20px; background: #fafafa;">
                    <div style="max-width: 800px; margin: 0 auto; display: flex; gap: 60px;">
                        <div style="flex: 1;">
                            <h3 contenteditable="true" style="font-size: 24px; margin-bottom: 30px; color: #333;">Send Me a Message</h3>
                            <form style="display: flex; flex-direction: column; gap: 20px;">
                                <input contenteditable="true" type="text" placeholder="Your Name" style="padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
                                <input contenteditable="true" type="email" placeholder="Your Email" style="padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
                                <input contenteditable="true" type="text" placeholder="Event Date (if applicable)" style="padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
                                <textarea contenteditable="true" placeholder="Tell me about your vision..." style="padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; min-height: 120px; resize: vertical;"></textarea>
                                <button contenteditable="true" type="submit" style="background: #333; color: white; border: none; padding: 15px 30px; font-size: 16px; letter-spacing: 1px; cursor: pointer; border-radius: 4px; align-self: flex-start;">Send Message</button>
                            </form>
                        </div>
                        <div style="flex: 1;">
                            <h3 contenteditable="true" style="font-size: 24px; margin-bottom: 30px; color: #333;">Contact Information</h3>
                            <div style="display: flex; flex-direction: column; gap: 20px;">
                                <div>
                                    <h4 contenteditable="true" style="color: #333; margin-bottom: 5px;">Phone</h4>
                                    <p contenteditable="true" style="color: #666; font-size: 16px;">(555) 123-4567</p>
                                </div>
                                <div>
                                    <h4 contenteditable="true" style="color: #333; margin-bottom: 5px;">Email</h4>
                                    <p contenteditable="true" style="color: #666; font-size: 16px;">info@johnlegacy.com</p>
                                </div>
                                <div>
                                    <h4 contenteditable="true" style="color: #333; margin-bottom: 5px;">Location</h4>
                                    <p contenteditable="true" style="color: #666; font-size: 16px;">Charleston, South Carolina<br>Available for travel worldwide</p>
                                </div>
                                <div>
                                    <h4 contenteditable="true" style="color: #333; margin-bottom: 5px;">Response Time</h4>
                                    <p contenteditable="true" style="color: #666; font-size: 16px;">I typically respond within 24 hours</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="block social-block" contenteditable="false" style="padding: 60px 20px; background: white; text-align: center;">
                    <div style="max-width: 600px; margin: 0 auto;">
                        <h3 contenteditable="true" style="font-size: 24px; margin-bottom: 30px; color: #333;">Follow My Work</h3>
                        <div style="display: flex; justify-content: center; gap: 20px;">
                            <a contenteditable="true" href="#" style="color: #666; text-decoration: none; padding: 10px 20px; border: 1px solid #ddd; border-radius: 4px; transition: all 0.3s ease;">Instagram</a>
                            <a contenteditable="true" href="#" style="color: #666; text-decoration: none; padding: 10px 20px; border: 1px solid #ddd; border-radius: 4px; transition: all 0.3s ease;">Facebook</a>
                            <a contenteditable="true" href="#" style="color: #666; text-decoration: none; padding: 10px 20px; border: 1px solid #ddd; border-radius: 4px; transition: all 0.3s ease;">Pinterest</a>
                        </div>
                    </div>
                </div>
            `
        },
        "pricing": {
            title: "Packages",
            content: `
                <div class="block pricing-header-block" contenteditable="false" style="padding: 80px 20px 60px; background: white; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 48px; margin-bottom: 20px; color: #333; font-family: 'Playfair Display', serif; font-weight: 400;">Photography Packages</h1>
                        <p contenteditable="true" style="font-size: 20px; color: #666; line-height: 1.6;">Capture your moments with packages designed to fit your needs</p>
                    </div>
                </div>
                
                <div class="block packages-block" contenteditable="false" style="padding: 60px 20px; background: #fafafa;">
                    <div style="max-width: 1000px; margin: 0 auto;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px;">
                            <div style="background: white; padding: 40px; border-radius: 8px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                                <h3 contenteditable="true" style="font-size: 28px; margin-bottom: 15px; color: #333; font-family: 'Playfair Display', serif;">Mini Session</h3>
                                <div contenteditable="true" style="font-size: 36px; color: #333; margin-bottom: 20px; font-weight: bold;">$295</div>
                                <ul style="list-style: none; padding: 0; margin-bottom: 30px;">
                                    <li contenteditable="true" style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">30 minute session</li>
                                    <li contenteditable="true" style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">20 edited photos</li>
                                    <li contenteditable="true" style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">Online gallery</li>
                                    <li contenteditable="true" style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">Print release included</li>
                                    <li contenteditable="true" style="padding: 8px 0; color: #666;">Perfect for families & couples</li>
                                </ul>
                                <button contenteditable="true" style="background: #333; color: white; border: none; padding: 15px 30px; font-size: 16px; letter-spacing: 1px; cursor: pointer; border-radius: 4px; width: 100%;">Book Now</button>
                            </div>
                            
                            <div style="background: white; padding: 40px; border-radius: 8px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 2px solid #333;">
                                <h3 contenteditable="true" style="font-size: 28px; margin-bottom: 15px; color: #333; font-family: 'Playfair Display', serif;">Full Session</h3>
                                <div contenteditable="true" style="font-size: 36px; color: #333; margin-bottom: 20px; font-weight: bold;">$400</div>
                                <ul style="list-style: none; padding: 0; margin-bottom: 30px;">
                                    <li contenteditable="true" style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">1 hour session</li>
                                    <li contenteditable="true" style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">50 edited photos</li>
                                    <li contenteditable="true" style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">Online gallery</li>
                                    <li contenteditable="true" style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">Print release included</li>
                                    <li contenteditable="true" style="padding: 8px 0; color: #666;">Most popular choice</li>
                                </ul>
                                <button contenteditable="true" style="background: #333; color: white; border: none; padding: 15px 30px; font-size: 16px; letter-spacing: 1px; cursor: pointer; border-radius: 4px; width: 100%;">Book Now</button>
                            </div>
                            
                            <div style="background: white; padding: 40px; border-radius: 8px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                                <h3 contenteditable="true" style="font-size: 28px; margin-bottom: 15px; color: #333; font-family: 'Playfair Display', serif;">Wedding Package</h3>
                                <div contenteditable="true" style="font-size: 36px; color: #333; margin-bottom: 20px; font-weight: bold;">Custom</div>
                                <ul style="list-style: none; padding: 0; margin-bottom: 30px;">
                                    <li contenteditable="true" style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">Full day coverage</li>
                                    <li contenteditable="true" style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">500+ edited photos</li>
                                    <li contenteditable="true" style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">Online gallery</li>
                                    <li contenteditable="true" style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">Engagement session included</li>
                                    <li contenteditable="true" style="padding: 8px 0; color: #666;">Your most important day</li>
                                </ul>
                                <button contenteditable="true" style="background: #333; color: white; border: none; padding: 15px 30px; font-size: 16px; letter-spacing: 1px; cursor: pointer; border-radius: 4px; width: 100%;">Get Quote</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="block booking-info-block" contenteditable="false" style="padding: 60px 20px; background: white; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h2 contenteditable="true" style="font-size: 36px; margin-bottom: 30px; color: #333; font-family: 'Playfair Display', serif; font-weight: 400;">Booking Information</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px; text-align: left;">
                            <div>
                                <h4 contenteditable="true" style="color: #333; margin-bottom: 10px;">Booking Process</h4>
                                <p contenteditable="true" style="color: #666; line-height: 1.6;">$100 retainer required to secure your date. Remaining balance due on the day of your session.</p>
                            </div>
                            <div>
                                <h4 contenteditable="true" style="color: #333; margin-bottom: 10px;">Delivery Time</h4>
                                <p contenteditable="true" style="color: #666; line-height: 1.6;">Your edited photos will be delivered within 2 weeks via an online gallery.</p>
                            </div>
                            <div>
                                <h4 contenteditable="true" style="color: #333; margin-bottom: 10px;">Travel</h4>
                                <p contenteditable="true" style="color: #666; line-height: 1.6;">Travel within 30 miles of Charleston is included. Additional travel fees may apply.</p>
                            </div>
                            <div>
                                <h4 contenteditable="true" style="color: #333; margin-bottom: 10px;">Rescheduling</h4>
                                <p contenteditable="true" style="color: #666; line-height: 1.6;">Weather-related rescheduling is always complimentary. Other changes subject to availability.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `
        }
    }
};

// Make template available globally for the website builder
window.lightAiryPortfolioTemplate = lightAiryPortfolioTemplate;