// Timeless Wedding Photography Preset
window.TimelessWeddingPreset = {
    meta: {
        name: "Timeless Wedding",
        description: "Elegant wedding photography with romantic typography",
        font: "Playfair Display, serif",
        brandColor: "#d1bfa3",
        secondaryColor: "#8b7a6b",
        backgroundColor: "#fdfcf8",
        animations: true,
        category: "wedding",
        thumbnail: "/images/preview_timeless.jpg"
    },
    pages: {
        home: [
            {
                id: `preset-tw-${Date.now()}-1`,
                type: "heading",
                content: "Timeless Wedding Moments",
                styles: {
                    fontSize: "52px",
                    color: "#4a4a4a",
                    textAlign: "center",
                    fontFamily: "Playfair Display, serif",
                    marginBottom: "30px",
                    fontWeight: "400",
                    letterSpacing: "0.5px"
                },
                animations: { type: "fadeInUp", delay: "0.2s" }
            },
            {
                id: `preset-tw-${Date.now()}-2`,
                type: "paragraph",
                content: "Capturing the essence of your special day with timeless elegance and artistic vision. Every moment tells your unique love story.",
                styles: {
                    fontSize: "20px",
                    color: "#6b6b6b",
                    textAlign: "center",
                    lineHeight: "1.8",
                    maxWidth: "700px",
                    margin: "0 auto 40px auto",
                    fontFamily: "Georgia, serif",
                    fontStyle: "italic"
                },
                animations: { type: "fadeInUp", delay: "0.4s" }
            },
            {
                id: `preset-tw-${Date.now()}-3`,
                type: "button",
                content: "View Wedding Galleries",
                styles: {
                    backgroundColor: "#d1bfa3",
                    color: "white",
                    padding: "18px 40px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "2px",
                    cursor: "pointer",
                    fontFamily: "Georgia, serif",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    fontWeight: "400"
                },
                animations: { type: "fadeInUp", delay: "0.6s" }
            }
        ],
        about: [
            {
                id: `preset-tw-${Date.now()}-4`,
                type: "heading",
                content: "About Our Story",
                styles: {
                    fontSize: "42px",
                    color: "#4a4a4a",
                    textAlign: "center",
                    fontFamily: "Playfair Display, serif",
                    marginBottom: "25px",
                    fontWeight: "400"
                },
                animations: { type: "slideInDown", delay: "0.2s" }
            },
            {
                id: `preset-tw-${Date.now()}-5`,
                type: "paragraph",
                content: "With over a decade of experience capturing wedding moments, we believe every couple deserves photography as unique as their love story. Our approach combines timeless elegance with contemporary artistry.",
                styles: {
                    fontSize: "18px",
                    color: "#5a5a5a",
                    textAlign: "center",
                    lineHeight: "1.7",
                    maxWidth: "650px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Georgia, serif"
                },
                animations: { type: "fadeIn", delay: "0.4s" }
            }
        ],
        gallery: [
            {
                id: `preset-tw-${Date.now()}-6`,
                type: "heading",
                content: "Wedding Galleries",
                styles: {
                    fontSize: "38px",
                    color: "#4a4a4a",
                    textAlign: "center",
                    fontFamily: "Playfair Display, serif",
                    marginBottom: "20px",
                    fontWeight: "400"
                },
                animations: { type: "zoomIn", delay: "0.2s" }
            },
            {
                id: `preset-tw-${Date.now()}-7`,
                type: "paragraph",
                content: "Browse our collection of timeless wedding photography showcasing the beauty and emotion of each celebration.",
                styles: {
                    fontSize: "16px",
                    color: "#6b6b6b",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "500px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Georgia, serif"
                },
                animations: { type: "fadeInUp", delay: "0.4s" }
            }
        ],
        contact: [
            {
                id: `preset-tw-${Date.now()}-8`,
                type: "heading",
                content: "Let's Create Magic Together",
                styles: {
                    fontSize: "36px",
                    color: "#4a4a4a",
                    textAlign: "center",
                    fontFamily: "Playfair Display, serif",
                    marginBottom: "25px",
                    fontWeight: "400"
                },
                animations: { type: "heartBeat", delay: "0.2s" }
            },
            {
                id: `preset-tw-${Date.now()}-9`,
                type: "paragraph",
                content: "Ready to tell your love story? Contact us today to discuss your wedding photography needs and schedule your engagement session.",
                styles: {
                    fontSize: "17px",
                    color: "#5a5a5a",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "580px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Georgia, serif"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            },
            {
                id: `preset-tw-${Date.now()}-10`,
                type: "button",
                content: "Book Your Session",
                styles: {
                    backgroundColor: "#d1bfa3",
                    color: "white",
                    padding: "16px 35px",
                    fontSize: "15px",
                    border: "none",
                    borderRadius: "2px",
                    cursor: "pointer",
                    fontFamily: "Georgia, serif",
                    letterSpacing: "0.8px",
                    textTransform: "uppercase"
                },
                animations: { type: "bounceIn", delay: "0.6s" }
            }
        ]
    }
};