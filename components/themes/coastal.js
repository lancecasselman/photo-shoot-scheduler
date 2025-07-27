// Coastal theme - Ocean-inspired fresh and airy design

window.CoastalTheme = {
    meta: {
        name: "Coastal Breeze",
        description: "Fresh ocean-inspired design with blues and whites",
        font: "Montserrat, sans-serif",
        primaryColor: "#2E86AB",
        secondaryColor: "#A23B72",
        backgroundColor: "#F5F9FC"
    },
    blocks: {
        home: [
            {
                id: 1201,
                type: "heading",
                content: "Ocean Photography Studio",
                styles: {
                    fontSize: "44px",
                    color: "#2E86AB",
                    textAlign: "center",
                    fontFamily: "Montserrat, sans-serif",
                    marginBottom: "20px",
                    fontWeight: "700",
                    textShadow: "0 2px 4px rgba(46,134,171,0.2)"
                },
                animations: { type: "slideInDown", delay: "0.2s" }
            },
            {
                id: 1202,
                type: "paragraph",
                content: "Where memories meet the horizon. Professional coastal and beach photography capturing the natural beauty of seaside moments and ocean adventures.",
                styles: {
                    fontSize: "18px",
                    color: "#2C5F7A",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "620px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Montserrat, sans-serif"
                },
                animations: { type: "fadeInUp", delay: "0.4s" }
            },
            {
                id: 1203,
                type: "button",
                content: "🌊 Dive Into My Work",
                styles: {
                    backgroundColor: "#2E86AB",
                    color: "white",
                    padding: "16px 32px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "30px",
                    cursor: "pointer",
                    fontFamily: "Montserrat, sans-serif",
                    margin: "20px auto",
                    display: "block",
                    fontWeight: "600",
                    boxShadow: "0 4px 15px rgba(46,134,171,0.3)"
                },
                animations: { type: "bounceIn", delay: "0.6s" }
            }
        ],
        about: [
            {
                id: 2201,
                type: "heading",
                content: "Life by the Shore 🏖️",
                styles: {
                    fontSize: "36px",
                    color: "#2E86AB",
                    textAlign: "center",
                    fontFamily: "Montserrat, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "700"
                },
                animations: { type: "lightSpeedIn" }
            },
            {
                id: 2202,
                type: "paragraph",
                content: "Born and raised by the ocean, I understand the rhythm of the tides and the magic of golden hour on the water. My passion lies in capturing the raw beauty of coastal life and the joy of those who love the sea.",
                styles: {
                    fontSize: "16px",
                    color: "#2C5F7A",
                    lineHeight: "1.7",
                    maxWidth: "680px",
                    margin: "0 auto 20px auto",
                    fontFamily: "Montserrat, sans-serif",
                    textAlign: "center"
                },
                animations: { type: "slideInRight", delay: "0.3s" }
            },
            {
                id: 2203,
                type: "paragraph",
                content: "From sunrise surf sessions to sunset beach walks, I specialize in natural, candid photography that tells the story of your connection to the ocean and each other.",
                styles: {
                    fontSize: "16px",
                    color: "#2C5F7A",
                    lineHeight: "1.7",
                    maxWidth: "680px",
                    margin: "0 auto",
                    fontFamily: "Montserrat, sans-serif",
                    textAlign: "center"
                },
                animations: { type: "slideInLeft", delay: "0.5s" }
            }
        ],
        gallery: [
            {
                id: 3201,
                type: "heading",
                content: "🌊 Ocean Portfolio",
                styles: {
                    fontSize: "36px",
                    color: "#2E86AB",
                    textAlign: "center",
                    fontFamily: "Montserrat, sans-serif",
                    marginBottom: "20px",
                    fontWeight: "700"
                },
                animations: { type: "rollIn" }
            },
            {
                id: 3202,
                type: "paragraph",
                content: "Capturing the endless beauty where land meets sea 🌅",
                styles: {
                    fontSize: "16px",
                    color: "#2C5F7A",
                    textAlign: "center",
                    marginBottom: "30px",
                    fontFamily: "Montserrat, sans-serif"
                },
                animations: { type: "fadeInUp", delay: "0.2s" }
            },
            {
                id: 3203,
                type: "image",
                content: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400",
                styles: {
                    width: "350px",
                    height: "220px",
                    objectFit: "cover",
                    borderRadius: "12px",
                    margin: "12px",
                    boxShadow: "0 6px 20px rgba(46,134,171,0.25)",
                    border: "2px solid #B8E6F5"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            }
        ],
        contact: [
            {
                id: 4201,
                type: "heading",
                content: "🐚 Make Waves Together",
                styles: {
                    fontSize: "36px",
                    color: "#2E86AB",
                    textAlign: "center",
                    fontFamily: "Montserrat, sans-serif",
                    marginBottom: "20px",
                    fontWeight: "700"
                },
                animations: { type: "jackInTheBox" }
            },
            {
                id: 4202,
                type: "paragraph",
                content: "Ready to capture your seaside story? Let's meet where the waves kiss the shore and create memories that will last a lifetime.",
                styles: {
                    fontSize: "16px",
                    color: "#2C5F7A",
                    textAlign: "center",
                    marginBottom: "30px",
                    fontFamily: "Montserrat, sans-serif",
                    maxWidth: "580px",
                    margin: "0 auto 30px auto",
                    lineHeight: "1.6"
                },
                animations: { type: "fadeInLeft", delay: "0.2s" }
            },
            {
                id: 4203,
                type: "button",
                content: "🌊 Let's Connect",
                styles: {
                    backgroundColor: "#2E86AB",
                    color: "white",
                    padding: "16px 32px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "30px",
                    cursor: "pointer",
                    fontFamily: "Montserrat, sans-serif",
                    margin: "0 auto",
                    display: "block",
                    fontWeight: "600",
                    boxShadow: "0 4px 15px rgba(46,134,171,0.3)"
                },
                animations: { type: "bounceInUp", delay: "0.4s" }
            }
        ]
    }
};