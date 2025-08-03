// Edgy Urban Lookbook - Prebuilt Website Template
// Dark theme photography website with neon accents and modern typography

const edgyUrbanLookbookTemplate = {
    name: "Edgy Urban Lookbook",
    description: "Dark theme photography with neon accents and modern urban style",
    pages: {
        "home": {
            title: "Home",
            content: `
                <div class="block hero-block" contenteditable="false" style="position: relative; background: linear-gradient(rgba(15,15,15,0.8), rgba(15,15,15,0.8)); background-size: cover; background-position: center; color: white; text-align: center; padding: 140px 20px; min-height: 80vh;">
                    <div class="hero-background-container" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1;">
                        <div class="image-placeholder-container" style="position: relative; width: 100%; height: 100%; background: #0f0f0f; border: 2px dashed #00ff41; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                            <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                <div style="font-size: 28px; margin-bottom: 12px; color: #00ff41; font-weight: bold;">+</div>
                                <div style="font-size: 18px; font-weight: 600;">Add Urban Hero Background</div>
                            </div>
                            <img class="uploaded-image hero-bg-image" src="" style="width: 100%; height: 100%; object-fit: cover; display: none;" alt="Hero Background">
                        </div>
                    </div>
                    <div style="position: relative; z-index: 2; max-width: 900px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 84px; margin-bottom: 30px; font-weight: 900; letter-spacing: 4px; font-family: 'Inter', sans-serif; text-transform: uppercase; color: #00ff41; text-shadow: 0 0 20px rgba(0,255,65,0.5), 0 0 40px rgba(0,255,65,0.3);">URBAN EDGE</h1>
                        <p contenteditable="true" style="font-size: 28px; margin-bottom: 50px; font-weight: 300; color: #cccccc; text-transform: uppercase; letter-spacing: 2px;">Street photography that captures the city's pulse</p>
                        <button contenteditable="true" style="background: transparent; color: #00ff41; border: 2px solid #00ff41; padding: 20px 50px; font-size: 16px; font-weight: 700; letter-spacing: 3px; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; box-shadow: 0 0 20px rgba(0,255,65,0.3);">View Lookbook</button>
                    </div>
                </div>
                
                <div class="block gallery-grid-block" contenteditable="false" style="padding: 80px 20px; background: #1a1a1a;">
                    <div style="max-width: 1400px; margin: 0 auto;">
                        <h2 contenteditable="true" style="font-size: 56px; margin-bottom: 60px; color: white; font-family: 'Inter', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; text-align: center; text-shadow: 0 0 10px rgba(255,255,255,0.3);">LATEST SHOOTS</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 350px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Urban Shot 1</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 350px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Urban Shot 1">
                                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(45deg, rgba(0,255,65,0.1), transparent); opacity: 0; transition: opacity 0.3s;"></div>
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 350px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Urban Shot 2</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 350px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Urban Shot 2">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 350px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Urban Shot 3</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 350px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Urban Shot 3">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 350px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Urban Shot 4</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 350px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Urban Shot 4">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 350px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Urban Shot 5</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 350px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Urban Shot 5">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 350px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Urban Shot 6</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 350px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Urban Shot 6">
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="block about-preview-block" contenteditable="false" style="padding: 100px 20px; background: #0f0f0f;">
                    <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 80px;">
                        <div style="flex: 1;">
                            <h2 contenteditable="true" style="font-size: 48px; margin-bottom: 40px; color: #00ff41; font-family: 'Inter', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; text-shadow: 0 0 10px rgba(0,255,65,0.5);">RAW URBAN</h2>
                            <p contenteditable="true" style="font-size: 20px; line-height: 1.8; color: #cccccc; margin-bottom: 30px; font-weight: 300;">Street photography is about capturing the unfiltered essence of urban life. Every frame tells a story of the city's heartbeat.</p>
                            <p contenteditable="true" style="font-size: 20px; line-height: 1.8; color: #cccccc; margin-bottom: 40px; font-weight: 300;">Specializing in high-contrast, edgy portraits and lifestyle photography that breaks conventional boundaries.</p>
                            <button contenteditable="true" style="background: #00ff41; color: #0f0f0f; border: none; padding: 18px 45px; font-size: 14px; font-weight: 700; letter-spacing: 2px; cursor: pointer; text-transform: uppercase;">View Full Story</button>
                        </div>
                        <div style="flex: 1;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; background: #1a1a1a; border: 2px solid #333; min-height: 500px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 28px; margin-bottom: 12px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 18px; text-transform: uppercase;">Urban Portrait</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: auto; display: none; filter: contrast(1.2) brightness(0.9);" alt="Urban Portrait">
                            </div>
                        </div>
                    </div>
                </div>
            `
        },
        "portfolio": {
            title: "Portfolio",
            content: `
                <div class="block portfolio-header-block" contenteditable="false" style="padding: 80px 20px; background: #0f0f0f; color: white; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 72px; margin-bottom: 30px; font-family: 'Inter', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 5px; color: #00ff41; text-shadow: 0 0 20px rgba(0,255,65,0.5);">PORTFOLIO</h1>
                        <p contenteditable="true" style="font-size: 24px; font-weight: 300; color: #cccccc; text-transform: uppercase; letter-spacing: 2px;">Urban photography that defines the edge</p>
                    </div>
                </div>
                
                <div class="block filter-tabs-block" contenteditable="false" style="padding: 40px 20px; background: #1a1a1a; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
                            <button contenteditable="true" style="background: #00ff41; color: #0f0f0f; border: none; padding: 12px 25px; font-size: 14px; font-weight: 700; letter-spacing: 2px; cursor: pointer; text-transform: uppercase;">All</button>
                            <button contenteditable="true" style="background: transparent; color: #cccccc; border: 2px solid #333; padding: 12px 25px; font-size: 14px; font-weight: 700; letter-spacing: 2px; cursor: pointer; text-transform: uppercase;">Street</button>
                            <button contenteditable="true" style="background: transparent; color: #cccccc; border: 2px solid #333; padding: 12px 25px; font-size: 14px; font-weight: 700; letter-spacing: 2px; cursor: pointer; text-transform: uppercase;">Portrait</button>
                            <button contenteditable="true" style="background: transparent; color: #cccccc; border: 2px solid #333; padding: 12px 25px; font-size: 14px; font-weight: 700; letter-spacing: 2px; cursor: pointer; text-transform: uppercase;">Urban</button>
                            <button contenteditable="true" style="background: transparent; color: #cccccc; border: 2px solid #333; padding: 12px 25px; font-size: 14px; font-weight: 700; letter-spacing: 2px; cursor: pointer; text-transform: uppercase;">Night</button>
                        </div>
                    </div>
                </div>
                
                <div class="block portfolio-grid-block" contenteditable="false" style="padding: 40px 20px; background: #1a1a1a;">
                    <div style="max-width: 1400px; margin: 0 auto;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 320px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Portfolio 1</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 320px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Portfolio 1">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 320px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Portfolio 2</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 320px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Portfolio 2">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 320px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Portfolio 3</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 320px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Portfolio 3">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 320px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Portfolio 4</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 320px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Portfolio 4">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 320px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Portfolio 5</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 320px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Portfolio 5">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 320px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Portfolio 6</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 320px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Portfolio 6">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 320px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Portfolio 7</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 320px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Portfolio 7">
                            </div>
                            <div class="image-placeholder-container" style="position: relative; width: 100%; height: 320px; background: #0f0f0f; border: 1px solid #333; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; overflow: hidden;" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 24px; margin-bottom: 8px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 14px; text-transform: uppercase;">Portfolio 8</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: 320px; object-fit: cover; display: none; filter: contrast(1.2) brightness(0.9);" alt="Portfolio 8">
                            </div>
                        </div>
                    </div>
                </div>
            `
        },
        "about": {
            title: "About",
            content: `
                <div class="block about-hero-block" contenteditable="false" style="padding: 100px 20px; background: #0f0f0f;">
                    <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 80px;">
                        <div style="flex: 1;">
                            <div class="image-placeholder-container" style="position: relative; width: 100%; background: #1a1a1a; border: 2px solid #00ff41; min-height: 600px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; filter: grayscale(100%);" onclick="triggerImageUpload(this)">
                                <div class="placeholder-content" style="text-align: center; color: #00ff41;">
                                    <div style="font-size: 28px; margin-bottom: 12px; color: #00ff41; font-weight: bold;">+</div>
                                    <div style="font-size: 18px; text-transform: uppercase;">Photographer Portrait</div>
                                </div>
                                <img class="uploaded-image" src="" style="width: 100%; height: auto; display: none; filter: grayscale(100%) contrast(1.2);" alt="Photographer Portrait">
                            </div>
                        </div>
                        <div style="flex: 1; color: white;">
                            <h1 contenteditable="true" style="font-size: 56px; margin-bottom: 40px; font-family: 'Inter', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; color: #00ff41; text-shadow: 0 0 10px rgba(0,255,65,0.5);">THE LENS</h1>
                            <p contenteditable="true" style="font-size: 20px; line-height: 1.8; margin-bottom: 30px; color: #cccccc; font-weight: 300;">Street photography is rebellion. It's capturing the raw, unfiltered truth of urban existence when no one's watching.</p>
                            <p contenteditable="true" style="font-size: 20px; line-height: 1.8; margin-bottom: 30px; color: #cccccc; font-weight: 300;">Based in the concrete jungle, I hunt for moments that others miss. Every frame is a statement, every shot breaks the mold.</p>
                            <p contenteditable="true" style="font-size: 20px; line-height: 1.8; margin-bottom: 40px; color: #cccccc; font-weight: 300;">This isn't pretty photography. This is life through a different lens.</p>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; margin-top: 50px;">
                                <div style="text-align: center; border: 1px solid #333; padding: 30px 20px; background: #1a1a1a;">
                                    <div contenteditable="true" style="font-size: 36px; font-weight: 900; color: #00ff41; margin-bottom: 10px; text-shadow: 0 0 10px rgba(0,255,65,0.5);">1K+</div>
                                    <div contenteditable="true" style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #cccccc;">Street Shots</div>
                                </div>
                                <div style="text-align: center; border: 1px solid #333; padding: 30px 20px; background: #1a1a1a;">
                                    <div contenteditable="true" style="font-size: 36px; font-weight: 900; color: #00ff41; margin-bottom: 10px; text-shadow: 0 0 10px rgba(0,255,65,0.5);">24/7</div>
                                    <div contenteditable="true" style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #cccccc;">City Hunt</div>
                                </div>
                                <div style="text-align: center; border: 1px solid #333; padding: 30px 20px; background: #1a1a1a;">
                                    <div contenteditable="true" style="font-size: 36px; font-weight: 900; color: #00ff41; margin-bottom: 10px; text-shadow: 0 0 10px rgba(0,255,65,0.5);">5</div>
                                    <div contenteditable="true" style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #cccccc;">Years Deep</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="block philosophy-block" contenteditable="false" style="padding: 100px 20px; background: #1a1a1a;">
                    <div style="max-width: 1000px; margin: 0 auto; text-align: center;">
                        <h2 contenteditable="true" style="font-size: 48px; margin-bottom: 60px; color: white; font-family: 'Inter', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 3px;">PHILOSOPHY</h2>
                        <div style="background: #0f0f0f; padding: 60px 40px; border: 2px solid #333; position: relative;">
                            <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(45deg, #00ff41, transparent, #00ff41); z-index: -1; opacity: 0.3;"></div>
                            <blockquote contenteditable="true" style="font-size: 32px; font-style: italic; color: #00ff41; margin-bottom: 40px; line-height: 1.5; font-family: 'Inter', sans-serif; font-weight: 300; text-shadow: 0 0 10px rgba(0,255,65,0.3);">"The city doesn't pose. It just exists. My job is to capture its truth in the split second when everything aligns."</blockquote>
                            <div contenteditable="true" style="color: #cccccc; font-size: 18px; text-transform: uppercase; letter-spacing: 2px;">Raw. Unfiltered. Real.</div>
                        </div>
                    </div>
                </div>
            `
        },
        "contact": {
            title: "Contact",
            content: `
                <div class="block contact-hero-block" contenteditable="false" style="padding: 80px 20px; background: #0f0f0f; color: white; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 72px; margin-bottom: 30px; font-family: 'Inter', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 5px; color: #00ff41; text-shadow: 0 0 20px rgba(0,255,65,0.5);">CONTACT</h1>
                        <p contenteditable="true" style="font-size: 24px; font-weight: 300; color: #cccccc; text-transform: uppercase; letter-spacing: 2px;">Ready to capture the edge?</p>
                    </div>
                </div>
                
                <div class="block contact-form-block" contenteditable="false" style="padding: 100px 20px; background: #1a1a1a;">
                    <div style="max-width: 700px; margin: 0 auto;">
                        <div style="background: #0f0f0f; padding: 50px 40px; border: 2px solid #333;">
                            <form style="display: grid; gap: 25px;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
                                    <input contenteditable="true" placeholder="NAME" style="padding: 18px 20px; background: #1a1a1a; border: 1px solid #333; color: #00ff41; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-family: 'Inter', sans-serif; font-weight: 500;">
                                    <input contenteditable="true" placeholder="EMAIL" style="padding: 18px 20px; background: #1a1a1a; border: 1px solid #333; color: #00ff41; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-family: 'Inter', sans-serif; font-weight: 500;">
                                </div>
                                <input contenteditable="true" placeholder="PHONE" style="padding: 18px 20px; background: #1a1a1a; border: 1px solid #333; color: #00ff41; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-family: 'Inter', sans-serif; font-weight: 500;">
                                <select contenteditable="true" style="padding: 18px 20px; background: #1a1a1a; border: 1px solid #333; color: #00ff41; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-family: 'Inter', sans-serif; font-weight: 500;">
                                    <option>PROJECT TYPE</option>
                                    <option>STREET PHOTOGRAPHY</option>
                                    <option>URBAN PORTRAITS</option>
                                    <option>LIFESTYLE SHOOT</option>
                                    <option>COMMERCIAL PROJECT</option>
                                    <option>OTHER</option>
                                </select>
                                <textarea contenteditable="true" placeholder="TELL ME ABOUT YOUR VISION..." style="padding: 18px 20px; background: #1a1a1a; border: 1px solid #333; color: #00ff41; font-size: 14px; min-height: 120px; resize: vertical; text-transform: uppercase; letter-spacing: 1px; font-family: 'Inter', sans-serif; font-weight: 500;"></textarea>
                                <button type="submit" style="background: #00ff41; color: #0f0f0f; border: none; padding: 20px; font-size: 16px; font-weight: 700; letter-spacing: 3px; cursor: pointer; text-transform: uppercase; font-family: 'Inter', sans-serif; transition: all 0.3s ease; box-shadow: 0 0 20px rgba(0,255,65,0.3);">SEND MESSAGE</button>
                            </form>
                        </div>
                    </div>
                </div>
                
                <div class="block contact-info-block" contenteditable="false" style="padding: 80px 20px; background: #0f0f0f;">
                    <div style="max-width: 1000px; margin: 0 auto;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 40px;">
                            <div style="background: #1a1a1a; padding: 40px 30px; border: 1px solid #333; text-align: center;">
                                <h3 contenteditable="true" style="font-size: 18px; color: #00ff41; margin-bottom: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">LOCATION</h3>
                                <p contenteditable="true" style="color: #cccccc; font-size: 14px; line-height: 1.6; text-transform: uppercase; letter-spacing: 1px;">DOWNTOWN CORE<br>METRO DISTRICT<br>CHARLESTON, SC</p>
                            </div>
                            <div style="background: #1a1a1a; padding: 40px 30px; border: 1px solid #333; text-align: center;">
                                <h3 contenteditable="true" style="font-size: 18px; color: #00ff41; margin-bottom: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">CONTACT</h3>
                                <p contenteditable="true" style="color: #cccccc; font-size: 14px; line-height: 1.6; text-transform: uppercase; letter-spacing: 1px;">PHONE: (843) 555-EDGE<br>EMAIL: SHOOT@URBANEDGE.COM<br>RESPONSE: 24-48 HOURS</p>
                            </div>
                            <div style="background: #1a1a1a; padding: 40px 30px; border: 1px solid #333; text-align: center;">
                                <h3 contenteditable="true" style="font-size: 18px; color: #00ff41; margin-bottom: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">AVAILABILITY</h3>
                                <p contenteditable="true" style="color: #cccccc; font-size: 14px; line-height: 1.6; text-transform: uppercase; letter-spacing: 1px;">WEEKDAYS: ANYTIME<br>WEEKENDS: BY APPOINTMENT<br>NIGHT SHOOTS: PREFERRED</p>
                            </div>
                            <div style="background: #1a1a1a; padding: 40px 30px; border: 1px solid #333; text-align: center;">
                                <h3 contenteditable="true" style="font-size: 18px; color: #00ff41; margin-bottom: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">QUICK LINKS</h3>
                                <div style="display: flex; flex-direction: column; gap: 10px;">
                                    <a contenteditable="true" href="#" style="color: #cccccc; text-decoration: none; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; transition: color 0.3s;">PORTFOLIO</a>
                                    <a contenteditable="true" href="#" style="color: #cccccc; text-decoration: none; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; transition: color 0.3s;">PACKAGES</a>
                                    <a contenteditable="true" href="#" style="color: #cccccc; text-decoration: none; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; transition: color 0.3s;">INSTAGRAM</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `
        },
        "packages": {
            title: "Packages",
            content: `
                <div class="block packages-hero-block" contenteditable="false" style="padding: 80px 20px; background: #0f0f0f; color: white; text-align: center;">
                    <div style="max-width: 800px; margin: 0 auto;">
                        <h1 contenteditable="true" style="font-size: 72px; margin-bottom: 30px; font-family: 'Inter', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 5px; color: #00ff41; text-shadow: 0 0 20px rgba(0,255,65,0.5);">PACKAGES</h1>
                        <p contenteditable="true" style="font-size: 24px; font-weight: 300; color: #cccccc; text-transform: uppercase; letter-spacing: 2px;">Raw pricing for real photography</p>
                    </div>
                </div>
                
                <div class="block packages-grid-block" contenteditable="false" style="padding: 100px 20px; background: #1a1a1a;">
                    <div style="max-width: 1200px; margin: 0 auto;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 40px;">
                            <div style="background: #0f0f0f; border: 2px solid #333; padding: 50px 40px; text-align: center; transition: all 0.3s ease;">
                                <h3 contenteditable="true" style="font-size: 28px; color: #00ff41; margin-bottom: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px rgba(0,255,65,0.3);">STREET</h3>
                                <div contenteditable="true" style="font-size: 48px; color: white; margin-bottom: 30px; font-weight: 900; font-family: 'Inter', sans-serif;">$400</div>
                                <div contenteditable="true" style="color: #cccccc; margin-bottom: 40px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Urban photography session</div>
                                <ul style="list-style: none; padding: 0; margin-bottom: 50px;">
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">2 HOUR STREET SESSION</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">25 EDITED IMAGES</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">HIGH CONTRAST EDITING</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">DIGITAL GALLERY</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">48 HOUR DELIVERY</li>
                                </ul>
                                <button contenteditable="true" style="background: transparent; color: #00ff41; border: 2px solid #00ff41; padding: 18px 35px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; cursor: pointer; width: 100%; transition: all 0.3s ease;">BOOK STREET</button>
                            </div>
                            
                            <div style="background: #0f0f0f; border: 2px solid #00ff41; padding: 50px 40px; text-align: center; transition: all 0.3s ease; position: relative; box-shadow: 0 0 30px rgba(0,255,65,0.3);">
                                <div style="position: absolute; top: -15px; left: 50%; transform: translateX(-50%); background: #00ff41; color: #0f0f0f; padding: 8px 25px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-size: 12px;">MOST POPULAR</div>
                                <h3 contenteditable="true" style="font-size: 28px; color: #00ff41; margin-bottom: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px rgba(0,255,65,0.5);">PORTRAIT</h3>
                                <div contenteditable="true" style="font-size: 48px; color: white; margin-bottom: 30px; font-weight: 900; font-family: 'Inter', sans-serif;">$650</div>
                                <div contenteditable="true" style="color: #cccccc; margin-bottom: 40px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Professional urban portraits</div>
                                <ul style="list-style: none; padding: 0; margin-bottom: 50px;">
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">3 HOUR PORTRAIT SESSION</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">40 EDITED IMAGES</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">MULTIPLE LOCATIONS</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">OUTFIT CHANGES</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">CREATIVE DIRECTION</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">24 HOUR DELIVERY</li>
                                </ul>
                                <button contenteditable="true" style="background: #00ff41; color: #0f0f0f; border: none; padding: 18px 35px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; cursor: pointer; width: 100%; box-shadow: 0 0 20px rgba(0,255,65,0.3);">BOOK PORTRAIT</button>
                            </div>
                            
                            <div style="background: #0f0f0f; border: 2px solid #333; padding: 50px 40px; text-align: center; transition: all 0.3s ease;">
                                <h3 contenteditable="true" style="font-size: 28px; color: #00ff41; margin-bottom: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px rgba(0,255,65,0.3);">COMMERCIAL</h3>
                                <div contenteditable="true" style="font-size: 48px; color: white; margin-bottom: 30px; font-weight: 900; font-family: 'Inter', sans-serif;">$1200</div>
                                <div contenteditable="true" style="color: #cccccc; margin-bottom: 40px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Full commercial package</div>
                                <ul style="list-style: none; padding: 0; margin-bottom: 50px;">
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">FULL DAY COVERAGE</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">100+ EDITED IMAGES</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">UNLIMITED LOCATIONS</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">FULL CREATIVE CONTROL</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #333; text-transform: uppercase; letter-spacing: 1px;">COMMERCIAL LICENSE</li>
                                    <li contenteditable="true" style="color: white; margin-bottom: 15px; font-size: 14px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">RUSH DELIVERY</li>
                                </ul>
                                <button contenteditable="true" style="background: transparent; color: #00ff41; border: 2px solid #00ff41; padding: 18px 35px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; cursor: pointer; width: 100%; transition: all 0.3s ease;">BOOK COMMERCIAL</button>
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
    module.exports = edgyUrbanLookbookTemplate;
}