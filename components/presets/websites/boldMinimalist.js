// Bold Minimalist Photography Preset
window.BoldMinimalistPreset = {
    meta: {
        name: "Bold Minimalist",
        description: "Clean minimalist design with bold typography and striking layouts",
        font: "Inter, sans-serif",
        brandColor: "#000000",
        secondaryColor: "#333333",
        backgroundColor: "#ffffff",
        animations: true,
        category: "minimalist",
        thumbnail: "/images/preview_bold.jpg"
    },
    pages: {
        home: [
            {
                id: `preset-bm-${Date.now()}-1`,
                type: "heading",
                content: "BOLD PHOTOGRAPHY",
                styles: {
                    fontSize: "64px",
                    color: "#000000",
                    textAlign: "center",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: "20px",
                    fontWeight: "900",
                    letterSpacing: "-2px",
                    textTransform: "uppercase"
                },
                animations: { type: "slideInDown", delay: "0.1s" }
            },
            {
                id: `preset-bm-${Date.now()}-2`,
                type: "paragraph",
                content: "Striking visuals. Minimal distractions. Maximum impact.",
                styles: {
                    fontSize: "24px",
                    color: "#666666",
                    textAlign: "center",
                    lineHeight: "1.4",
                    maxWidth: "500px",
                    margin: "0 auto 50px auto",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: "300"
                },
                animations: { type: "fadeIn", delay: "0.3s" }
            },
            {
                id: `preset-bm-${Date.now()}-3`,
                type: "button",
                content: "VIEW WORK",
                styles: {
                    backgroundColor: "#000000",
                    color: "white",
                    padding: "20px 50px",
                    fontSize: "14px",
                    border: "none",
                    borderRadius: "0px",
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    fontWeight: "600"
                },
                animations: { type: "slideInUp", delay: "0.5s" }
            }
        ],
        about: [
            {
                id: `preset-bm-${Date.now()}-4`,
                type: "heading",
                content: "LESS IS MORE",
                styles: {
                    fontSize: "48px",
                    color: "#000000",
                    textAlign: "left",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: "40px",
                    fontWeight: "800",
                    letterSpacing: "-1px",
                    textTransform: "uppercase"
                },
                animations: { type: "slideInLeft", delay: "0.2s" }
            },
            {
                id: `preset-bm-${Date.now()}-5`,
                type: "paragraph",
                content: "I strip away the unnecessary to reveal what truly matters. My photography focuses on bold compositions, dramatic lighting, and authentic moments that speak louder than words.",
                styles: {
                    fontSize: "20px",
                    color: "#444444",
                    textAlign: "left",
                    lineHeight: "1.6",
                    maxWidth: "600px",
                    margin: "0 0 30px 0",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "fadeInUp", delay: "0.4s" }
            }
        ],
        gallery: [
            {
                id: `preset-bm-${Date.now()}-6`,
                type: "heading",
                content: "PORTFOLIO",
                styles: {
                    fontSize: "56px",
                    color: "#000000",
                    textAlign: "center",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: "30px",
                    fontWeight: "900",
                    letterSpacing: "-1px",
                    textTransform: "uppercase"
                },
                animations: { type: "zoomIn", delay: "0.2s" }
            },
            {
                id: `preset-bm-${Date.now()}-7`,
                type: "paragraph",
                content: "Selected works that define my minimalist approach to photography.",
                styles: {
                    fontSize: "18px",
                    color: "#666666",
                    textAlign: "center",
                    lineHeight: "1.5",
                    maxWidth: "450px",
                    margin: "0 auto 40px auto",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: "300"
                },
                animations: { type: "fadeIn", delay: "0.4s" }
            }
        ],
        contact: [
            {
                id: `preset-bm-${Date.now()}-8`,
                type: "heading",
                content: "LET'S WORK",
                styles: {
                    fontSize: "52px",
                    color: "#000000",
                    textAlign: "center",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: "20px",
                    fontWeight: "900",
                    letterSpacing: "-1px",
                    textTransform: "uppercase"
                },
                animations: { type: "pulse", delay: "0.2s" }
            },
            {
                id: `preset-bm-${Date.now()}-9`,
                type: "paragraph",
                content: "Ready for bold, impactful photography? Let's create something extraordinary together.",
                styles: {
                    fontSize: "20px",
                    color: "#555555",
                    textAlign: "center",
                    lineHeight: "1.5",
                    maxWidth: "550px",
                    margin: "0 auto 40px auto",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "fadeInUp", delay: "0.4s" }
            },
            {
                id: `preset-bm-${Date.now()}-10`,
                type: "button",
                content: "GET IN TOUCH",
                styles: {
                    backgroundColor: "#000000",
                    color: "white",
                    padding: "18px 45px",
                    fontSize: "14px",
                    border: "none",
                    borderRadius: "0px",
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    fontWeight: "600"
                },
                animations: { type: "bounceIn", delay: "0.6s" }
            }
        ]
    }
};