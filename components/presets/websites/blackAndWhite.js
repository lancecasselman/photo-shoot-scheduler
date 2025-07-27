// Black and White Photography Preset
window.BlackAndWhitePreset = {
    meta: {
        name: "Black & White Classic",
        description: "Timeless monochrome photography with dramatic contrast",
        font: "Source Sans Pro, sans-serif",
        brandColor: "#2c2c2c",
        secondaryColor: "#666666",
        backgroundColor: "#ffffff",
        animations: true,
        category: "classic",
        thumbnail: "/images/preview_bw.jpg"
    },
    pages: {
        home: [
            {
                id: `preset-bw-${Date.now()}-1`,
                type: "heading",
                content: "BLACK & WHITE PHOTOGRAPHY",
                styles: {
                    fontSize: "50px",
                    color: "#2c2c2c",
                    textAlign: "center",
                    fontFamily: "Source Sans Pro, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "700",
                    letterSpacing: "1px"
                },
                animations: { type: "fadeInDown", delay: "0.2s" }
            },
            {
                id: `preset-bw-${Date.now()}-2`,
                type: "paragraph",
                content: "Capturing the essence of moments through the timeless art of monochrome photography. Where shadows dance with light to tell compelling stories.",
                styles: {
                    fontSize: "19px",
                    color: "#555555",
                    textAlign: "center",
                    lineHeight: "1.7",
                    maxWidth: "650px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Source Sans Pro, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "fadeInUp", delay: "0.4s" }
            },
            {
                id: `preset-bw-${Date.now()}-3`,
                type: "button",
                content: "View Portfolio",
                styles: {
                    backgroundColor: "#2c2c2c",
                    color: "white",
                    padding: "16px 35px",
                    fontSize: "15px",
                    border: "2px solid #2c2c2c",
                    borderRadius: "0px",
                    cursor: "pointer",
                    fontFamily: "Source Sans Pro, sans-serif",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    fontWeight: "600"
                },
                animations: { type: "slideInUp", delay: "0.6s" }
            }
        ],
        about: [
            {
                id: `preset-bw-${Date.now()}-4`,
                type: "heading",
                content: "MONOCHROME VISION",
                styles: {
                    fontSize: "42px",
                    color: "#2c2c2c",
                    textAlign: "center",
                    fontFamily: "Source Sans Pro, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "700",
                    letterSpacing: "1px"
                },
                animations: { type: "zoomIn", delay: "0.2s" }
            },
            {
                id: `preset-bw-${Date.now()}-5`,
                type: "paragraph",
                content: "Black and white photography strips away distractions to reveal the raw emotion and composition within each frame. I specialize in creating dramatic, high-contrast imagery that speaks to the soul.",
                styles: {
                    fontSize: "18px",
                    color: "#555555",
                    textAlign: "center",
                    lineHeight: "1.7",
                    maxWidth: "620px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Source Sans Pro, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "slideInLeft", delay: "0.4s" }
            }
        ],
        gallery: [
            {
                id: `preset-bw-${Date.now()}-6`,
                type: "heading",
                content: "MONOCHROME GALLERY",
                styles: {
                    fontSize: "40px",
                    color: "#2c2c2c",
                    textAlign: "center",
                    fontFamily: "Source Sans Pro, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "700",
                    letterSpacing: "2px"
                },
                animations: { type: "slideInDown", delay: "0.2s" }
            },
            {
                id: `preset-bw-${Date.now()}-7`,
                type: "paragraph",
                content: "A collection of powerful black and white images showcasing the beauty of monochrome storytelling.",
                styles: {
                    fontSize: "17px",
                    color: "#666666",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "500px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Source Sans Pro, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "fadeIn", delay: "0.4s" }
            }
        ],
        contact: [
            {
                id: `preset-bw-${Date.now()}-8`,
                type: "heading",
                content: "LET'S CREATE ART",
                styles: {
                    fontSize: "38px",
                    color: "#2c2c2c",
                    textAlign: "center",
                    fontFamily: "Source Sans Pro, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "700",
                    letterSpacing: "1px"
                },
                animations: { type: "pulse", delay: "0.2s" }
            },
            {
                id: `preset-bw-${Date.now()}-9`,
                type: "paragraph",
                content: "Ready to explore the timeless beauty of black and white photography? Let's collaborate to create striking monochrome images that capture your unique story.",
                styles: {
                    fontSize: "18px",
                    color: "#555555",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "580px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Source Sans Pro, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            },
            {
                id: `preset-bw-${Date.now()}-10`,
                type: "button",
                content: "Book Session",
                styles: {
                    backgroundColor: "transparent",
                    color: "#2c2c2c",
                    padding: "16px 35px",
                    fontSize: "15px",
                    border: "2px solid #2c2c2c",
                    borderRadius: "0px",
                    cursor: "pointer",
                    fontFamily: "Source Sans Pro, sans-serif",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    fontWeight: "600"
                },
                animations: { type: "bounceIn", delay: "0.6s" }
            }
        ]
    }
};