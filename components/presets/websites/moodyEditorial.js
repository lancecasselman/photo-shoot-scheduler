// Moody Editorial Photography Preset
window.MoodyEditorialPreset = {
    meta: {
        name: "Moody Editorial",
        description: "Dark, dramatic editorial photography with cinematic aesthetics",
        font: "Crimson Text, serif",
        brandColor: "#8b0000",
        secondaryColor: "#2c1810",
        backgroundColor: "#1a1a1a",
        animations: true,
        category: "editorial",
        thumbnail: "/images/preview_moody.jpg"
    },
    pages: {
        home: [
            {
                id: `preset-me-${Date.now()}-1`,
                type: "heading",
                content: "MOODY EDITORIAL",
                styles: {
                    fontSize: "58px",
                    color: "#ffffff",
                    textAlign: "center",
                    fontFamily: "Crimson Text, serif",
                    marginBottom: "25px",
                    fontWeight: "600",
                    letterSpacing: "2px",
                    textShadow: "2px 2px 4px rgba(139,0,0,0.5)"
                },
                animations: { type: "fadeInDown", delay: "0.2s" }
            },
            {
                id: `preset-me-${Date.now()}-2`,
                type: "paragraph",
                content: "Cinematic storytelling through shadows and light. Creating dramatic, emotion-rich imagery that captures the raw intensity of human experience.",
                styles: {
                    fontSize: "20px",
                    color: "#cccccc",
                    textAlign: "center",
                    lineHeight: "1.8",
                    maxWidth: "650px",
                    margin: "0 auto 40px auto",
                    fontFamily: "Crimson Text, serif",
                    fontStyle: "italic",
                    fontWeight: "400"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            },
            {
                id: `preset-me-${Date.now()}-3`,
                type: "button",
                content: "Enter the Gallery",
                styles: {
                    backgroundColor: "#8b0000",
                    color: "white",
                    padding: "18px 40px",
                    fontSize: "16px",
                    border: "2px solid #8b0000",
                    borderRadius: "0px",
                    cursor: "pointer",
                    fontFamily: "Crimson Text, serif",
                    letterSpacing: "1px",
                    fontWeight: "600",
                    transition: "all 0.3s ease"
                },
                animations: { type: "rotateIn", delay: "0.6s" }
            }
        ],
        about: [
            {
                id: `preset-me-${Date.now()}-4`,
                type: "heading",
                content: "SHADOWS & STORIES",
                styles: {
                    fontSize: "44px",
                    color: "#ffffff",
                    textAlign: "center",
                    fontFamily: "Crimson Text, serif",
                    marginBottom: "30px",
                    fontWeight: "600",
                    letterSpacing: "1px"
                },
                animations: { type: "zoomIn", delay: "0.2s" }
            },
            {
                id: `preset-me-${Date.now()}-5`,
                type: "paragraph",
                content: "I specialize in creating atmospheric, cinematic imagery that explores the deeper emotions of my subjects. Every session is a collaboration to uncover authentic moments within dramatic, carefully crafted lighting scenarios.",
                styles: {
                    fontSize: "18px",
                    color: "#bbbbbb",
                    textAlign: "center",
                    lineHeight: "1.7",
                    maxWidth: "600px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Crimson Text, serif",
                    fontWeight: "400"
                },
                animations: { type: "fadeInLeft", delay: "0.4s" }
            }
        ],
        gallery: [
            {
                id: `preset-me-${Date.now()}-6`,
                type: "heading",
                content: "PORTFOLIO",
                styles: {
                    fontSize: "48px",
                    color: "#ffffff",
                    textAlign: "center",
                    fontFamily: "Crimson Text, serif",
                    marginBottom: "25px",
                    fontWeight: "600",
                    letterSpacing: "3px"
                },
                animations: { type: "slideInDown", delay: "0.2s" }
            },
            {
                id: `preset-me-${Date.now()}-7`,
                type: "paragraph",
                content: "A curated collection of editorial sessions showcasing dramatic lighting, emotion, and cinematic storytelling.",
                styles: {
                    fontSize: "17px",
                    color: "#cccccc",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "520px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Crimson Text, serif",
                    fontStyle: "italic"
                },
                animations: { type: "fadeIn", delay: "0.4s" }
            }
        ],
        contact: [
            {
                id: `preset-me-${Date.now()}-8`,
                type: "heading",
                content: "CREATE WITH ME",
                styles: {
                    fontSize: "42px",
                    color: "#ffffff",
                    textAlign: "center",
                    fontFamily: "Crimson Text, serif",
                    marginBottom: "25px",
                    fontWeight: "600",
                    letterSpacing: "1px"
                },
                animations: { type: "pulse", delay: "0.2s" }
            },
            {
                id: `preset-me-${Date.now()}-9`,
                type: "paragraph",
                content: "Ready to explore the dramatic side of photography? Let's collaborate to create powerful, emotion-driven imagery that tells your unique story.",
                styles: {
                    fontSize: "18px",
                    color: "#bbbbbb",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "580px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Crimson Text, serif",
                    fontWeight: "400"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            },
            {
                id: `preset-me-${Date.now()}-10`,
                type: "button",
                content: "Book Your Session",
                styles: {
                    backgroundColor: "transparent",
                    color: "#8b0000",
                    padding: "16px 35px",
                    fontSize: "16px",
                    border: "2px solid #8b0000",
                    borderRadius: "0px",
                    cursor: "pointer",
                    fontFamily: "Crimson Text, serif",
                    letterSpacing: "1px",
                    fontWeight: "600",
                    transition: "all 0.3s ease"
                },
                animations: { type: "bounceIn", delay: "0.6s" }
            }
        ]
    }
};