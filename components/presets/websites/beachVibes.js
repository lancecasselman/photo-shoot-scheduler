// Beach Vibes Photography Preset
window.BeachVibesPreset = {
    meta: {
        name: "Beach Vibes",
        description: "Coastal photography with sunny, relaxed beach aesthetics",
        font: "Poppins, sans-serif",
        brandColor: "#00a8cc",
        secondaryColor: "#ff6b35",
        backgroundColor: "#f7f9fc",
        animations: true,
        category: "coastal",
        thumbnail: "/images/preview_beach.jpg"
    },
    pages: {
        home: [
            {
                id: `preset-bv-${Date.now()}-1`,
                type: "heading",
                content: "🌊 Beach Photography 🌊",
                styles: {
                    fontSize: "46px",
                    color: "#00568c",
                    textAlign: "center",
                    fontFamily: "Poppins, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "600",
                    letterSpacing: "0.5px"
                },
                animations: { type: "bounceInDown", delay: "0.2s" }
            },
            {
                id: `preset-bv-${Date.now()}-2`,
                type: "paragraph",
                content: "Capturing the magic of sun, sand, and sea. Specializing in beach portraits, coastal weddings, and ocean adventures that celebrate life's brightest moments.",
                styles: {
                    fontSize: "19px",
                    color: "#2c5f7a",
                    textAlign: "center",
                    lineHeight: "1.7",
                    maxWidth: "680px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            },
            {
                id: `preset-bv-${Date.now()}-3`,
                type: "button",
                content: "🏖️ View Beach Sessions",
                styles: {
                    backgroundColor: "#00a8cc",
                    color: "white",
                    padding: "16px 35px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "25px",
                    cursor: "pointer",
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: "500",
                    boxShadow: "0 4px 15px rgba(0,168,204,0.3)"
                },
                animations: { type: "bounceIn", delay: "0.6s" }
            }
        ],
        about: [
            {
                id: `preset-bv-${Date.now()}-4`,
                type: "heading",
                content: "Life's a Beach 🏄‍♀️",
                styles: {
                    fontSize: "40px",
                    color: "#00568c",
                    textAlign: "center",
                    fontFamily: "Poppins, sans-serif",
                    marginBottom: "30px",
                    fontWeight: "600"
                },
                animations: { type: "wobble", delay: "0.2s" }
            },
            {
                id: `preset-bv-${Date.now()}-5`,
                type: "paragraph",
                content: "I'm all about capturing those carefree coastal moments – the laughter, the splash, the golden hour magic. Born and raised by the ocean, I understand how to work with natural light, tides, and that perfect beach breeze to create stunning imagery.",
                styles: {
                    fontSize: "18px",
                    color: "#2c5f7a",
                    textAlign: "center",
                    lineHeight: "1.7",
                    maxWidth: "650px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "slideInLeft", delay: "0.4s" }
            }
        ],
        gallery: [
            {
                id: `preset-bv-${Date.now()}-6`,
                type: "heading",
                content: "🌅 Beach Galleries 🌅",
                styles: {
                    fontSize: "38px",
                    color: "#00568c",
                    textAlign: "center",
                    fontFamily: "Poppins, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "600"
                },
                animations: { type: "fadeInUp", delay: "0.2s" }
            },
            {
                id: `preset-bv-${Date.now()}-7`,
                type: "paragraph",
                content: "From sunrise sessions to sunset celebrations, explore our collection of coastal photography that captures the essence of beach life.",
                styles: {
                    fontSize: "17px",
                    color: "#2c5f7a",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "550px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "fadeIn", delay: "0.4s" }
            }
        ],
        contact: [
            {
                id: `preset-bv-${Date.now()}-8`,
                type: "heading",
                content: "Ready for Your Beach Session? 🌊",
                styles: {
                    fontSize: "34px",
                    color: "#00568c",
                    textAlign: "center",
                    fontFamily: "Poppins, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "600"
                },
                animations: { type: "heartBeat", delay: "0.2s" }
            },
            {
                id: `preset-bv-${Date.now()}-9`,
                type: "paragraph",
                content: "Let's create some beach magic together! Whether it's family portraits, couple sessions, or special celebrations, I'll help you capture those perfect coastal moments.",
                styles: {
                    fontSize: "18px",
                    color: "#2c5f7a",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "600px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            },
            {
                id: `preset-bv-${Date.now()}-10`,
                type: "button",
                content: "🏖️ Book Beach Session",
                styles: {
                    backgroundColor: "#ff6b35",
                    color: "white",
                    padding: "17px 40px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "30px",
                    cursor: "pointer",
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: "500",
                    boxShadow: "0 4px 15px rgba(255,107,53,0.3)"
                },
                animations: { type: "bounceIn", delay: "0.6s" }
            }
        ]
    }
};