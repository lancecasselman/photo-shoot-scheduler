// Vintage Fashion Photography Preset
window.VintageFashionPreset = {
    meta: {
        name: "Vintage Fashion",
        description: "Retro-inspired fashion photography with vintage aesthetics",
        font: "Abril Fatface, serif",
        brandColor: "#b8860b",
        secondaryColor: "#8b4513",
        backgroundColor: "#f5f5dc",
        animations: true,
        category: "fashion",
        thumbnail: "/images/preview_vintage.jpg"
    },
    pages: {
        home: [
            {
                id: `preset-vf-${Date.now()}-1`,
                type: "heading",
                content: "VINTAGE FASHION",
                styles: {
                    fontSize: "54px",
                    color: "#8b4513",
                    textAlign: "center",
                    fontFamily: "Abril Fatface, serif",
                    marginBottom: "20px",
                    fontWeight: "400",
                    letterSpacing: "2px",
                    textShadow: "2px 2px 4px rgba(0,0,0,0.1)"
                },
                animations: { type: "rotateIn", delay: "0.2s" }
            },
            {
                id: `preset-vf-${Date.now()}-2`,
                type: "paragraph",
                content: "Bringing timeless elegance to modern fashion through vintage-inspired portraiture. Each session captures the glamour and sophistication of bygone eras.",
                styles: {
                    fontSize: "19px",
                    color: "#654321",
                    textAlign: "center",
                    lineHeight: "1.7",
                    maxWidth: "600px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Georgia, serif",
                    fontStyle: "italic"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            },
            {
                id: `preset-vf-${Date.now()}-3`,
                type: "button",
                content: "View Collections",
                styles: {
                    backgroundColor: "#b8860b",
                    color: "white",
                    padding: "16px 35px",
                    fontSize: "15px",
                    border: "2px solid #8b4513",
                    borderRadius: "0px",
                    cursor: "pointer",
                    fontFamily: "Georgia, serif",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    fontWeight: "bold"
                },
                animations: { type: "fadeInUp", delay: "0.6s" }
            }
        ],
        about: [
            {
                id: `preset-vf-${Date.now()}-4`,
                type: "heading",
                content: "TIMELESS STYLE",
                styles: {
                    fontSize: "44px",
                    color: "#8b4513",
                    textAlign: "center",
                    fontFamily: "Abril Fatface, serif",
                    marginBottom: "25px",
                    fontWeight: "400",
                    letterSpacing: "1px"
                },
                animations: { type: "zoomIn", delay: "0.2s" }
            },
            {
                id: `preset-vf-${Date.now()}-5`,
                type: "paragraph",
                content: "Inspired by the golden age of fashion photography, I create images that blend classic elegance with contemporary style. Each session is carefully crafted to transport you to an era of timeless glamour.",
                styles: {
                    fontSize: "18px",
                    color: "#654321",
                    textAlign: "center",
                    lineHeight: "1.7",
                    maxWidth: "650px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Georgia, serif"
                },
                animations: { type: "slideInLeft", delay: "0.4s" }
            }
        ],
        gallery: [
            {
                id: `preset-vf-${Date.now()}-6`,
                type: "heading",
                content: "FASHION PORTFOLIO",
                styles: {
                    fontSize: "42px",
                    color: "#8b4513",
                    textAlign: "center",
                    fontFamily: "Abril Fatface, serif",
                    marginBottom: "25px",
                    fontWeight: "400",
                    letterSpacing: "2px"
                },
                animations: { type: "slideInDown", delay: "0.2s" }
            },
            {
                id: `preset-vf-${Date.now()}-7`,
                type: "paragraph",
                content: "A curated collection showcasing vintage-inspired fashion photography with timeless appeal.",
                styles: {
                    fontSize: "17px",
                    color: "#654321",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "520px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Georgia, serif",
                    fontStyle: "italic"
                },
                animations: { type: "fadeIn", delay: "0.4s" }
            }
        ],
        contact: [
            {
                id: `preset-vf-${Date.now()}-8`,
                type: "heading",
                content: "BOOK YOUR SESSION",
                styles: {
                    fontSize: "38px",
                    color: "#8b4513",
                    textAlign: "center",
                    fontFamily: "Abril Fatface, serif",
                    marginBottom: "25px",
                    fontWeight: "400",
                    letterSpacing: "1px"
                },
                animations: { type: "pulse", delay: "0.2s" }
            },
            {
                id: `preset-vf-${Date.now()}-9`,
                type: "paragraph",
                content: "Ready to step into timeless elegance? Let's create stunning vintage-inspired fashion photography that captures your unique style and personality.",
                styles: {
                    fontSize: "18px",
                    color: "#654321",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "600px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Georgia, serif"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            },
            {
                id: `preset-vf-${Date.now()}-10`,
                type: "button",
                content: "Schedule Consultation",
                styles: {
                    backgroundColor: "transparent",
                    color: "#b8860b",
                    padding: "16px 35px",
                    fontSize: "15px",
                    border: "2px solid #b8860b",
                    borderRadius: "0px",
                    cursor: "pointer",
                    fontFamily: "Georgia, serif",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    fontWeight: "bold"
                },
                animations: { type: "bounceIn", delay: "0.6s" }
            }
        ]
    }
};