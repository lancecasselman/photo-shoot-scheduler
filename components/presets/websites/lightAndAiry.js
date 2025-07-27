// Light and Airy Photography Preset
window.LightAndAiryPreset = {
    meta: {
        name: "Light & Airy",
        description: "Bright, cheerful photography with soft pastels and natural light",
        font: "Lato, sans-serif",
        brandColor: "#f8bbd9",
        secondaryColor: "#e7a3c4",
        backgroundColor: "#fefefe",
        animations: true,
        category: "lifestyle",
        thumbnail: "/images/preview_light.jpg"
    },
    pages: {
        home: [
            {
                id: `preset-la-${Date.now()}-1`,
                type: "heading",
                content: "Light & Airy Photography",
                styles: {
                    fontSize: "48px",
                    color: "#d4869c",
                    textAlign: "center",
                    fontFamily: "Lato, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "300",
                    letterSpacing: "1px"
                },
                animations: { type: "fadeInUp", delay: "0.2s" }
            },
            {
                id: `preset-la-${Date.now()}-2`,
                type: "paragraph",
                content: "Capturing life's sweetest moments with soft, natural light and a dreamy aesthetic. Specializing in family portraits, maternity sessions, and lifestyle photography that feels like sunshine.",
                styles: {
                    fontSize: "19px",
                    color: "#8b7f8e",
                    textAlign: "center",
                    lineHeight: "1.7",
                    maxWidth: "650px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Lato, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "fadeIn", delay: "0.4s" }
            },
            {
                id: `preset-la-${Date.now()}-3`,
                type: "button",
                content: "✨ View My Work",
                styles: {
                    backgroundColor: "#f8bbd9",
                    color: "white",
                    padding: "16px 35px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "25px",
                    cursor: "pointer",
                    fontFamily: "Lato, sans-serif",
                    fontWeight: "400",
                    boxShadow: "0 4px 15px rgba(248,187,217,0.4)"
                },
                animations: { type: "bounceIn", delay: "0.6s" }
            }
        ],
        about: [
            {
                id: `preset-la-${Date.now()}-4`,
                type: "heading",
                content: "Hello Beautiful! 🌸",
                styles: {
                    fontSize: "42px",
                    color: "#d4869c",
                    textAlign: "center",
                    fontFamily: "Lato, sans-serif",
                    marginBottom: "30px",
                    fontWeight: "300"
                },
                animations: { type: "heartBeat", delay: "0.2s" }
            },
            {
                id: `preset-la-${Date.now()}-5`,
                type: "paragraph",
                content: "I believe every moment deserves to be captured with love and light. My approach is gentle, natural, and focused on bringing out the genuine joy and connection in every session. Let's create something beautiful together!",
                styles: {
                    fontSize: "18px",
                    color: "#8b7f8e",
                    textAlign: "center",
                    lineHeight: "1.7",
                    maxWidth: "620px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Lato, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            }
        ],
        gallery: [
            {
                id: `preset-la-${Date.now()}-6`,
                type: "heading",
                content: "🌷 Portfolio Gallery 🌷",
                styles: {
                    fontSize: "38px",
                    color: "#d4869c",
                    textAlign: "center",
                    fontFamily: "Lato, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "300"
                },
                animations: { type: "fadeInDown", delay: "0.2s" }
            },
            {
                id: `preset-la-${Date.now()}-7`,
                type: "paragraph",
                content: "A collection of bright, joyful moments captured with soft natural light and lots of love.",
                styles: {
                    fontSize: "17px",
                    color: "#8b7f8e",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "500px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Lato, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "fadeIn", delay: "0.4s" }
            }
        ],
        contact: [
            {
                id: `preset-la-${Date.now()}-8`,
                type: "heading",
                content: "Let's Chat! 💕",
                styles: {
                    fontSize: "36px",
                    color: "#d4869c",
                    textAlign: "center",
                    fontFamily: "Lato, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "300"
                },
                animations: { type: "wobble", delay: "0.2s" }
            },
            {
                id: `preset-la-${Date.now()}-9`,
                type: "paragraph",
                content: "I'd love to capture your special moments! Whether it's family photos, maternity sessions, or celebrating life's milestones, let's create something magical together.",
                styles: {
                    fontSize: "18px",
                    color: "#8b7f8e",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "580px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Lato, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            },
            {
                id: `preset-la-${Date.now()}-10`,
                type: "button",
                content: "🌸 Book Your Session",
                styles: {
                    backgroundColor: "#e7a3c4",
                    color: "white",
                    padding: "17px 40px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "30px",
                    cursor: "pointer",
                    fontFamily: "Lato, sans-serif",
                    fontWeight: "400",
                    boxShadow: "0 4px 15px rgba(231,163,196,0.4)"
                },
                animations: { type: "bounceIn", delay: "0.6s" }
            }
        ]
    }
};