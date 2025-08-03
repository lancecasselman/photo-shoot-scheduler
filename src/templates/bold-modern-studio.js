// Bold Modern Studio - Prebuilt Website Template
// Modern photography website with bold design and deep accent colors

const boldModernStudioTemplate = {
    name: "Bold Modern Studio",
    description: "Bold modern design with deep blues and gold accents",
    pages: {
        "home": {
            title: "Home",
            content: `
                <div class="block hero-block" contenteditable="false" style="position: relative; background: linear-gradient(rgba(25,42,86,0.7), rgba(25,42,86,0.7)); background-size: cover; background-position: center; color: white; text-align: center; padding: 140px 20px; min-height: 70vh;">
                    <div class="hero-background-container" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1;">
                        <div class="image-placeholder-container" style="position: relative; width: 100%; height: 100%; background: #192a56; border: 3px dashed #f39c12; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                            <div class="placeholder-content" style="text-align: center; color: #f39c12;">
                                <div style="font-size: 28px; margin-bottom: 12px; color: #f39c12; font-weight: bold;">+</div>
                                <div style="font-size: 18px; font-weight: 600;">Add Bold Hero Background</div>
                            </div>
                            <img class="uploaded-image hero-bg-image" src="" style="width: 100%; height: 100%; object-fit: cover; display: none;" alt="Hero Background">
                        </div>
                    </div>
                    <div style="position: relative; z-index: 2; max-width: 900px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 72px; margin-bottom: 30px; font-weight: 900; letter-spacing: 3px; font-family: 'Montserrat', sans-serif; text-transform: uppercase; text-shadow: 3px 3px 6px rgba(0,0,0,0.7);">Stand Out. Stay Bold.</h1>
                        <p contenteditable="true" style="font-size: 26px; margin-bottom: 50px; font-weight: 300; text-shadow: 2px 2px 4px rgba(0,0,0,0.7);">Modern photography that captures your edge and defines your story.</p>
                        <button contenteditable="true" style="background: #f39c12; color: #192a56; border: none; padding: 20px 50px; font-size: 18px; font-weight: 700; letter-spacing: 2px; cursor: pointer; transition: all 0.3s ease; border-radius: 0; text-transform: uppercase;">Explore Portfolio</button>
                    </div>
                </div>
                
                <div class="block gallery-preview-block" contenteditable="false" style="padding: 100px 20px; background: #2c2c2c;">
                    <div style="max-width: 1400px; margin: 0 auto; text-align: center;">
                        <h2 contenteditable="true" style="font-size: 48px; margin-bottom: 80px; color: #f39c12; font-family: 'Montserrat', sans-serif; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Featured Work</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 60px;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 500px; background: #1a1a1a; border: 2px solid #f39c12; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #f39c12;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #f39c12; font-weight: bold;">+</div>
                                    <div style="font-size: 16px; font-weight: 600;">Bold Portfolio Image 1</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 500px; object-fit: cover; display: none;" alt="Portfolio Image 1">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 500px; background: #1a1a1a; border: 2px solid #f39c12; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #f39c12;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #f39c12; font-weight: bold;">+</div>
                                    <div style="font-size: 16px; font-weight: 600;">Bold Portfolio Image 2</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 500px; object-fit: cover; display: none;" alt="Portfolio Image 2">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 500px; background: #1a1a1a; border: 2px solid #f39c12; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #f39c12;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #f39c12; font-weight: bold;">+</div>
                                    <div style="font-size: 16px; font-weight: 600;">Bold Portfolio Image 3</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 500px; object-fit: cover; display: none;" alt="Portfolio Image 3">
                            </div>
                        </div>
                        <button contenteditable="true" style="background: transparent; color: #f39c12; border: 3px solid #f39c12; padding: 18px 45px; font-size: 16px; font-weight: 700; letter-spacing: 2px; cursor: pointer; text-transform: uppercase;">View Complete Portfolio</button>
                    </div>
                </div>
            `
        },
        "portfolio": {
            title: "Portfolio",
            content: `
                <div class="block portfolio-header-block" contenteditable="false" style="padding: 80px 20px; background: #192a56; color: white; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 64px; margin-bottom: 30px; font-family: 'Montserrat', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 4px;">Portfolio</h1>
                        <p contenteditable="true" style="font-size: 24px; font-weight: 300; color: #f39c12;">Bold photography that makes a statement</p>
                    </div>
                </div>
                
                <div class="block portfolio-grid-block" contenteditable="false" style="padding: 60px 20px; background: #2c2c2c;">
                    <div style="max-width: 1400px; margin: 0 auto;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #1a1a1a; border: 2px solid #f39c12; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #f39c12;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #f39c12; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Portfolio Work 1</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; display: none;" alt="Portfolio Work 1">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #1a1a1a; border: 2px solid #f39c12; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #f39c12;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #f39c12; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Portfolio Work 2</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; display: none;" alt="Portfolio Work 2">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #1a1a1a; border: 2px solid #f39c12; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #f39c12;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #f39c12; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Portfolio Work 3</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; display: none;" alt="Portfolio Work 3">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #1a1a1a; border: 2px solid #f39c12; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #f39c12;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #f39c12; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Portfolio Work 4</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; display: none;" alt="Portfolio Work 4">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #1a1a1a; border: 2px solid #f39c12; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #f39c12;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #f39c12; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Portfolio Work 5</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; display: none;" alt="Portfolio Work 5">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 400px; background: #1a1a1a; border: 2px solid #f39c12; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #f39c12;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #f39c12; font-weight: bold;">+</div>
                                    <div style="font-size: 16px;">Portfolio Work 6</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 400px; object-fit: cover; display: none;" alt="Portfolio Work 6">
                            </div>
                        </div>
                    </div>
                </div>
            `
        },
        "about": {
            title: "About",
            content: `
                <div class="block about-hero-block" contenteditable="false" style="padding: 100px 20px; background: linear-gradient(135deg, #192a56 0%, #273c75 100%);">
                    <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 80px;">
                        <div style="flex: 1;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; background: #1a1a1a; border: 3px solid #f39c12; border-radius: 0; min-height: 600px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #f39c12;">
                                    <div style="font-size: 28px; margin-bottom: 12px; color: #f39c12; font-weight: bold;">+</div>
                                    <div style="font-size: 18px; font-weight: 600;">Bold Photographer Portrait</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: auto; display: none;" alt="Photographer Portrait">
                            </div>
                        </div>
                        <div style="flex: 1; color: white;">
                            <h1 contenteditable="true" style="font-size: 56px; margin-bottom: 40px; font-family: 'Montserrat', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; color: #f39c12;">About the Studio</h1>
                            <p contenteditable="true" style="font-size: 22px; line-height: 1.8; margin-bottom: 30px; font-weight: 300;">Bold photography isn't just about technique - it's about capturing the raw essence of who you are. With over 8 years of experience, I specialize in creating striking images that demand attention.</p>
                            <p contenteditable="true" style="font-size: 22px; line-height: 1.8; margin-bottom: 30px; font-weight: 300;">Every session is designed to push creative boundaries and deliver photographs that stand out from the crowd.</p>
                            <div style="display: flex; gap: 30px; margin-top: 40px;">
                                <div style="text-align: center;">
                                    <div contenteditable="true" style="font-size: 48px; font-weight: 900; color: #f39c12; margin-bottom: 10px;">500+</div>
                                    <div contenteditable="true" style="font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">Bold Sessions</div>
                                </div>
                                <div style="text-align: center;">
                                    <div contenteditable="true" style="font-size: 48px; font-weight: 900; color: #f39c12; margin-bottom: 10px;">8</div>
                                    <div contenteditable="true" style="font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">Years Experience</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="block values-block" contenteditable="false" style="padding: 100px 20px; background: #2c2c2c;">
                    <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
                        <h2 contenteditable="true" style="font-size: 48px; margin-bottom: 80px; color: #f39c12; font-family: 'Montserrat', sans-serif; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Core Values</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 60px;">
                            <div style="text-align: center;">
                                <h3 contenteditable="true" style="font-size: 28px; color: white; margin-bottom: 20px; font-weight: 800; text-transform: uppercase;">Authenticity</h3>
                                <p contenteditable="true" style="color: #ccc; font-size: 18px; line-height: 1.6;">Real moments, genuine emotions, authentic connections that shine through every frame.</p>
                            </div>
                            <div style="text-align: center;">
                                <h3 contenteditable="true" style="font-size: 28px; color: white; margin-bottom: 20px; font-weight: 800; text-transform: uppercase;">Innovation</h3>
                                <p contenteditable="true" style="color: #ccc; font-size: 18px; line-height: 1.6;">Pushing creative boundaries with cutting-edge techniques and bold artistic vision.</p>
                            </div>
                            <div style="text-align: center;">
                                <h3 contenteditable="true" style="font-size: 28px; color: white; margin-bottom: 20px; font-weight: 800; text-transform: uppercase;">Excellence</h3>
                                <p contenteditable="true" style="color: #ccc; font-size: 18px; line-height: 1.6;">Delivering exceptional quality that exceeds expectations in every single project.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `
        },
        "contact": {
            title: "Contact",
            content: `
                <div class="block contact-hero-block" contenteditable="false" style="padding: 80px 20px; background: #192a56; color: white; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 64px; margin-bottom: 30px; font-family: 'Montserrat', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 4px;">Get In Touch</h1>
                        <p contenteditable="true" style="font-size: 24px; font-weight: 300; color: #f39c12;">Ready to create something bold together?</p>
                    </div>
                </div>
                
                <div class="block contact-form-block" contenteditable="false" style="padding: 100px 20px; background: #2c2c2c;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <form style="display: grid; gap: 30px;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                                <input contenteditable="true" placeholder="First Name" style="padding: 20px; background: #1a1a1a; border: 2px solid #f39c12; color: white; font-size: 18px; border-radius: 0;">
                                <input contenteditable="true" placeholder="Last Name" style="padding: 20px; background: #1a1a1a; border: 2px solid #f39c12; color: white; font-size: 18px; border-radius: 0;">
                            </div>
                            <input contenteditable="true" placeholder="Email Address" style="padding: 20px; background: #1a1a1a; border: 2px solid #f39c12; color: white; font-size: 18px; border-radius: 0;">
                            <input contenteditable="true" placeholder="Phone Number" style="padding: 20px; background: #1a1a1a; border: 2px solid #f39c12; color: white; font-size: 18px; border-radius: 0;">
                            <select contenteditable="true" style="padding: 20px; background: #1a1a1a; border: 2px solid #f39c12; color: white; font-size: 18px; border-radius: 0;">
                                <option>Photography Type</option>
                                <option>Portrait</option>
                                <option>Corporate</option>
                                <option>Fashion</option>
                                <option>Event</option>
                            </select>
                            <textarea contenteditable="true" placeholder="Tell me about your vision..." style="padding: 20px; background: #1a1a1a; border: 2px solid #f39c12; color: white; font-size: 18px; min-height: 150px; border-radius: 0; resize: vertical;"></textarea>
                            <button type="submit" style="background: #f39c12; color: #192a56; border: none; padding: 25px; font-size: 18px; font-weight: 700; letter-spacing: 2px; cursor: pointer; text-transform: uppercase; border-radius: 0;">Send Message</button>
                        </form>
                    </div>
                </div>
                
                <div class="block contact-info-block" contenteditable="false" style="padding: 80px 20px; background: linear-gradient(135deg, #192a56 0%, #273c75 100%);">
                    <div style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 60px; text-align: center;">
                        <div>
                            <h3 contenteditable="true" style="font-size: 24px; color: #f39c12; margin-bottom: 20px; font-weight: 800; text-transform: uppercase;">Studio Location</h3>
                            <p contenteditable="true" style="color: white; font-size: 18px; line-height: 1.6;">123 Bold Street<br>Creative District<br>Charleston, SC 29401</p>
                        </div>
                        <div>
                            <h3 contenteditable="true" style="font-size: 24px; color: #f39c12; margin-bottom: 20px; font-weight: 800; text-transform: uppercase;">Contact Info</h3>
                            <p contenteditable="true" style="color: white; font-size: 18px; line-height: 1.6;">Phone: (843) 555-BOLD<br>Email: hello@boldstudio.com<br>Response: 24-48 hours</p>
                        </div>
                        <div>
                            <h3 contenteditable="true" style="font-size: 24px; color: #f39c12; margin-bottom: 20px; font-weight: 800; text-transform: uppercase;">Studio Hours</h3>
                            <p contenteditable="true" style="color: white; font-size: 18px; line-height: 1.6;">Monday - Friday: 9AM - 7PM<br>Saturday: 10AM - 6PM<br>Sunday: By appointment</p>
                        </div>
                    </div>
                </div>
            `
        },
        "packages": {
            title: "Packages",
            content: `
                <div class="block packages-hero-block" contenteditable="false" style="padding: 80px 20px; background: #192a56; color: white; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 64px; margin-bottom: 30px; font-family: 'Montserrat', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 4px;">Packages</h1>
                        <p contenteditable="true" style="font-size: 24px; font-weight: 300; color: #f39c12;">Bold photography packages designed for impact</p>
                    </div>
                </div>
                
                <div class="block packages-grid-block" contenteditable="false" style="padding: 100px 20px; background: #2c2c2c;">
                    <div style="max-width: 1200px; margin: 0 auto;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 40px;">
                            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2c2c2c 100%); border: 3px solid #f39c12; padding: 60px 40px; text-align: center; transition: all 0.3s ease;">
                                <h3 contenteditable="true" style="font-size: 36px; color: #f39c12; margin-bottom: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">Studio Mini</h3>
                                <div contenteditable="true" style="font-size: 56px; color: white; margin-bottom: 30px; font-weight: 900;">$350</div>
                                <div contenteditable="true" style="color: #ccc; margin-bottom: 40px; font-size: 16px;">Perfect for individual portraits</div>
                                <ul style="list-style: none; padding: 0; margin-bottom: 50px;">
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0; border-bottom: 1px solid #444;">45 minute studio session</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0; border-bottom: 1px solid #444;">15 professionally edited images</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0; border-bottom: 1px solid #444;">Signature bold editing style</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0;">High-resolution digital gallery</li>
                                </ul>
                                <button contenteditable="true" style="background: #f39c12; color: #1a1a1a; border: none; padding: 20px 40px; font-weight: 700; text-transform: uppercase; font-size: 16px; letter-spacing: 1px; cursor: pointer; width: 100%;">Book Now</button>
                            </div>
                            
                            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2c2c2c 100%); border: 3px solid #f39c12; padding: 60px 40px; text-align: center; transition: all 0.3s ease; transform: scale(1.05); box-shadow: 0 20px 40px rgba(243,156,18,0.3);">
                                <div style="background: #f39c12; color: #1a1a1a; padding: 10px 20px; margin: -60px -40px 30px -40px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Most Popular</div>
                                <h3 contenteditable="true" style="font-size: 36px; color: #f39c12; margin-bottom: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">Studio Pro</h3>
                                <div contenteditable="true" style="font-size: 56px; color: white; margin-bottom: 30px; font-weight: 900;">$600</div>
                                <div contenteditable="true" style="color: #ccc; margin-bottom: 40px; font-size: 16px;">Comprehensive portrait experience</div>
                                <ul style="list-style: none; padding: 0; margin-bottom: 50px;">
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0; border-bottom: 1px solid #444;">2 hour studio session</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0; border-bottom: 1px solid #444;">40 professionally edited images</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0; border-bottom: 1px solid #444;">Creative direction & styling advice</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0; border-bottom: 1px solid #444;">Multiple outfit changes</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0;">Print release included</li>
                                </ul>
                                <button contenteditable="true" style="background: #f39c12; color: #1a1a1a; border: none; padding: 20px 40px; font-weight: 700; text-transform: uppercase; font-size: 16px; letter-spacing: 1px; cursor: pointer; width: 100%;">Book Now</button>
                            </div>
                            
                            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2c2c2c 100%); border: 3px solid #f39c12; padding: 60px 40px; text-align: center; transition: all 0.3s ease;">
                                <h3 contenteditable="true" style="font-size: 36px; color: #f39c12; margin-bottom: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">Studio Elite</h3>
                                <div contenteditable="true" style="font-size: 56px; color: white; margin-bottom: 30px; font-weight: 900;">$950</div>
                                <div contenteditable="true" style="color: #ccc; margin-bottom: 40px; font-size: 16px;">Ultimate bold photography experience</div>
                                <ul style="list-style: none; padding: 0; margin-bottom: 50px;">
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0; border-bottom: 1px solid #444;">3 hour premium session</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0; border-bottom: 1px solid #444;">75 professionally edited images</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0; border-bottom: 1px solid #444;">Custom set design & props</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0; border-bottom: 1px solid #444;">Professional makeup consultation</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 18px; padding: 10px 0;">Luxury print package</li>
                                </ul>
                                <button contenteditable="true" style="background: #f39c12; color: #1a1a1a; border: none; padding: 20px 40px; font-weight: 700; text-transform: uppercase; font-size: 16px; letter-spacing: 1px; cursor: pointer; width: 100%;">Book Now</button>
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
    module.exports = boldModernStudioTemplate;
}