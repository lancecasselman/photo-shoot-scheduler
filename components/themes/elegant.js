// Elegant theme - Classic photography portfolio design

window.ElegantTheme = {
    meta: {
        name: "Elegant Classic",
        description: "Timeless elegance with serif fonts and golden accents",
        font: "Georgia, serif",
        primaryColor: "#D4AF37",
        secondaryColor: "#8B7355",
        backgroundColor: "#FEFEFE"
    },
    blocks: {
        home: [
            {
                id: 1001,
                type: "heading",
                content: "Welcome to My Photography Studio",
                styles: {
                    fontSize: "42px",
                    color: "#2C2C2C",
                    textAlign: "center",
                    fontFamily: "Georgia, serif",
                    marginBottom: "20px",
                    fontWeight: "normal"
                },
                animations: { type: "fadeInUp", delay: "0.2s" }
            },
            {
                id: 1002,
                type: "paragraph",
                content: "Capturing life's most precious moments with artistry and elegance. Professional photography services for weddings, portraits, and special events.",
                styles: {
                    fontSize: "18px",
                    color: "#555555",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "600px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Georgia, serif"
                },
                animations: { type: "fadeInUp", delay: "0.4s" }
            },
            {
                id: 1003,
                type: "button",
                content: "View My Portfolio",
                styles: {
                    backgroundColor: "#D4AF37",
                    color: "white",
                    padding: "15px 30px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontFamily: "Georgia, serif",
                    margin: "20px auto",
                    display: "block"
                },
                animations: { type: "fadeInUp", delay: "0.6s" }
            }
        ],
        about: [
            {
                id: 2001,
                type: "heading",
                content: "About the Artist",
                styles: {
                    fontSize: "36px",
                    color: "#2C2C2C",
                    textAlign: "center",
                    fontFamily: "Georgia, serif",
                    marginBottom: "30px"
                },
                animations: { type: "fadeInDown" }
            },
            {
                id: 2002,
                type: "paragraph",
                content: "With over a decade of experience in photography, I specialize in capturing the authentic emotions and natural beauty in every moment. My approach combines technical expertise with artistic vision to create timeless images that tell your unique story.",
                styles: {
                    fontSize: "16px",
                    color: "#555555",
                    lineHeight: "1.7",
                    maxWidth: "700px",
                    margin: "0 auto 25px auto",
                    fontFamily: "Georgia, serif"
                },
                animations: { type: "fadeInLeft", delay: "0.3s" }
            },
            {
                id: 2003,
                type: "paragraph",
                content: "Based in the heart of the city, I draw inspiration from both urban landscapes and natural settings. Every session is tailored to reflect your personality and style, ensuring that your photos are as unique as you are.",
                styles: {
                    fontSize: "16px",
                    color: "#555555",
                    lineHeight: "1.7",
                    maxWidth: "700px",
                    margin: "0 auto",
                    fontFamily: "Georgia, serif"
                },
                animations: { type: "fadeInRight", delay: "0.5s" }
            }
        ],
        gallery: [
            {
                id: 3001,
                type: "heading",
                content: "Portfolio Gallery",
                styles: {
                    fontSize: "36px",
                    color: "#2C2C2C",
                    textAlign: "center",
                    fontFamily: "Georgia, serif",
                    marginBottom: "20px"
                },
                animations: { type: "fadeInDown" }
            },
            {
                id: 3002,
                type: "paragraph",
                content: "A curated selection of my finest work, showcasing the beauty and emotion captured in each session.",
                styles: {
                    fontSize: "16px",
                    color: "#555555",
                    textAlign: "center",
                    marginBottom: "30px",
                    fontFamily: "Georgia, serif"
                },
                animations: { type: "fadeInUp", delay: "0.2s" }
            },
            {
                id: 3003,
                type: "image",
                content: "https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400",
                styles: {
                    width: "300px",
                    height: "200px",
                    objectFit: "cover",
                    borderRadius: "8px",
                    margin: "10px",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
                },
                animations: { type: "zoomIn", delay: "0.4s" }
            }
        ],
        contact: [
            {
                id: 4001,
                type: "heading",
                content: "Let's Create Together",
                styles: {
                    fontSize: "36px",
                    color: "#2C2C2C",
                    textAlign: "center",
                    fontFamily: "Georgia, serif",
                    marginBottom: "20px"
                },
                animations: { type: "fadeInDown" }
            },
            {
                id: 4002,
                type: "paragraph",
                content: "Ready to capture your special moments? I'd love to hear about your vision and create something beautiful together.",
                styles: {
                    fontSize: "16px",
                    color: "#555555",
                    textAlign: "center",
                    marginBottom: "30px",
                    fontFamily: "Georgia, serif",
                    maxWidth: "600px",
                    margin: "0 auto 30px auto"
                },
                animations: { type: "fadeInUp", delay: "0.2s" }
            },
            {
                id: 4003,
                type: "button",
                content: "Send Message",
                styles: {
                    backgroundColor: "#D4AF37",
                    color: "white",
                    padding: "15px 30px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontFamily: "Georgia, serif",
                    margin: "0 auto",
                    display: "block"
                },
                animations: { type: "pulse", delay: "0.4s" }
            }
        ]
    }
};