// Modern theme - Clean minimalist design with bold typography

window.ModernTheme = {
    meta: {
        name: "Modern Minimal",
        description: "Clean minimalist design with bold typography and modern aesthetics",
        font: "Inter, sans-serif",
        primaryColor: "#2563EB",
        secondaryColor: "#1E40AF",
        backgroundColor: "#FFFFFF"
    },
    blocks: {
        home: [
            {
                id: 1301,
                type: "heading",
                content: "Modern Photography",
                styles: {
                    fontSize: "48px",
                    color: "#1F2937",
                    textAlign: "center",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "800",
                    letterSpacing: "-0.02em"
                },
                animations: { type: "slideInUp", delay: "0.2s" }
            },
            {
                id: 1302,
                type: "paragraph",
                content: "Contemporary visual storytelling through minimalist aesthetics and bold compositions. Creating striking imagery for modern brands and forward-thinking individuals.",
                styles: {
                    fontSize: "18px",
                    color: "#4B5563",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "600px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "fadeIn", delay: "0.4s" }
            },
            {
                id: 1303,
                type: "button",
                content: "View Portfolio",
                styles: {
                    backgroundColor: "#2563EB",
                    color: "white",
                    padding: "14px 28px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    margin: "20px auto",
                    display: "block",
                    fontWeight: "600",
                    transition: "all 0.3s ease"
                },
                animations: { type: "zoomIn", delay: "0.6s" }
            }
        ],
        about: [
            {
                id: 2301,
                type: "heading",
                content: "Creative Vision",
                styles: {
                    fontSize: "40px",
                    color: "#1F2937",
                    textAlign: "center",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: "30px",
                    fontWeight: "800"
                },
                animations: { type: "flipInY" }
            },
            {
                id: 2302,
                type: "paragraph",
                content: "I believe in the power of simplicity. My approach strips away the unnecessary to reveal the essential beauty in every moment. Through clean compositions and thoughtful lighting, I create images that speak with clarity and impact.",
                styles: {
                    fontSize: "16px",
                    color: "#4B5563",
                    lineHeight: "1.7",
                    maxWidth: "700px",
                    margin: "0 auto 25px auto",
                    fontFamily: "Inter, sans-serif",
                    textAlign: "center"
                },
                animations: { type: "slideInLeft", delay: "0.3s" }
            },
            {
                id: 2303,
                type: "paragraph",
                content: "Working with cutting-edge techniques and contemporary aesthetics, I help brands and individuals tell their stories through powerful visual narratives that resonate in today's fast-paced world.",
                styles: {
                    fontSize: "16px",
                    color: "#4B5563",
                    lineHeight: "1.7",
                    maxWidth: "700px",
                    margin: "0 auto",
                    fontFamily: "Inter, sans-serif",
                    textAlign: "center"
                },
                animations: { type: "slideInRight", delay: "0.5s" }
            }
        ],
        gallery: [
            {
                id: 3301,
                type: "heading",
                content: "Portfolio",
                styles: {
                    fontSize: "40px",
                    color: "#1F2937",
                    textAlign: "center",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: "20px",
                    fontWeight: "800"
                },
                animations: { type: "slideInDown" }
            },
            {
                id: 3302,
                type: "paragraph",
                content: "A curated collection of contemporary visual storytelling",
                styles: {
                    fontSize: "16px",
                    color: "#4B5563",
                    textAlign: "center",
                    marginBottom: "35px",
                    fontFamily: "Inter, sans-serif"
                },
                animations: { type: "fadeInUp", delay: "0.2s" }
            },
            {
                id: 3303,
                type: "image",
                content: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400",
                styles: {
                    width: "340px",
                    height: "240px",
                    objectFit: "cover",
                    borderRadius: "12px",
                    margin: "12px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.1)"
                },
                animations: { type: "zoomInUp", delay: "0.4s" }
            }
        ],
        contact: [
            {
                id: 4301,
                type: "heading",
                content: "Let's Collaborate",
                styles: {
                    fontSize: "40px",
                    color: "#1F2937",
                    textAlign: "center",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: "20px",
                    fontWeight: "800"
                },
                animations: { type: "bounceInDown" }
            },
            {
                id: 4302,
                type: "paragraph",
                content: "Ready to create something extraordinary? Let's discuss your vision and bring your story to life through powerful contemporary photography.",
                styles: {
                    fontSize: "16px",
                    color: "#4B5563",
                    textAlign: "center",
                    marginBottom: "35px",
                    fontFamily: "Inter, sans-serif",
                    maxWidth: "600px",
                    margin: "0 auto 35px auto",
                    lineHeight: "1.6"
                },
                animations: { type: "slideInUp", delay: "0.2s" }
            },
            {
                id: 4303,
                type: "button",
                content: "Start Project",
                styles: {
                    backgroundColor: "#2563EB",
                    color: "white",
                    padding: "14px 28px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    margin: "0 auto",
                    display: "block",
                    fontWeight: "600"
                },
                animations: { type: "pulse", delay: "0.4s" }
            }
        ]
    }
};