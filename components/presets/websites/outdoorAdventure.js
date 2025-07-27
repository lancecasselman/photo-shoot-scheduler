// Outdoor Adventure Photography Preset
window.OutdoorAdventurePreset = {
    meta: {
        name: "Outdoor Adventure",
        description: "Rugged outdoor photography capturing adventure and wilderness",
        font: "Oswald, sans-serif",
        brandColor: "#2d5016",
        secondaryColor: "#4a7c59",
        backgroundColor: "#f8f9f5",
        animations: true,
        category: "adventure",
        thumbnail: "/images/preview_outdoor.jpg"
    },
    pages: {
        home: [
            {
                id: `preset-oa-${Date.now()}-1`,
                type: "heading",
                content: "🏔️ OUTDOOR ADVENTURE 🏔️",
                styles: {
                    fontSize: "48px",
                    color: "#2d5016",
                    textAlign: "center",
                    fontFamily: "Oswald, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "600",
                    letterSpacing: "1px",
                    textTransform: "uppercase"
                },
                animations: { type: "bounceInDown", delay: "0.2s" }
            },
            {
                id: `preset-oa-${Date.now()}-2`,
                type: "paragraph",
                content: "Capturing the raw beauty of nature and the thrill of outdoor adventures. From mountain peaks to forest trails, I document the spirit of exploration and the wilderness that calls to us all.",
                styles: {
                    fontSize: "19px",
                    color: "#3a5a40",
                    textAlign: "center",
                    lineHeight: "1.7",
                    maxWidth: "680px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Open Sans, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            },
            {
                id: `preset-oa-${Date.now()}-3`,
                type: "button",
                content: "🎯 View Adventures",
                styles: {
                    backgroundColor: "#2d5016",
                    color: "white",
                    padding: "18px 40px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontFamily: "Oswald, sans-serif",
                    fontWeight: "500",
                    letterSpacing: "1px",
                    textTransform: "uppercase"
                },
                animations: { type: "zoomIn", delay: "0.6s" }
            }
        ],
        about: [
            {
                id: `preset-oa-${Date.now()}-4`,
                type: "heading",
                content: "🥾 WILDERNESS PHOTOGRAPHER 🥾",
                styles: {
                    fontSize: "40px",
                    color: "#2d5016",
                    textAlign: "center",
                    fontFamily: "Oswald, sans-serif",
                    marginBottom: "30px",
                    fontWeight: "600",
                    textTransform: "uppercase"
                },
                animations: { type: "wobble", delay: "0.2s" }
            },
            {
                id: `preset-oa-${Date.now()}-5`,
                type: "paragraph",
                content: "Born for the outdoors, I live and breathe adventure photography. Whether it's scaling mountain peaks, exploring hidden waterfalls, or documenting epic hiking journeys, I'm passionate about capturing the untamed beauty of our natural world.",
                styles: {
                    fontSize: "18px",
                    color: "#3a5a40",
                    textAlign: "center",
                    lineHeight: "1.7",
                    maxWidth: "650px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Open Sans, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "slideInLeft", delay: "0.4s" }
            }
        ],
        gallery: [
            {
                id: `preset-oa-${Date.now()}-6`,
                type: "heading",
                content: "🌲 ADVENTURE GALLERY 🌲",
                styles: {
                    fontSize: "38px",
                    color: "#2d5016",
                    textAlign: "center",
                    fontFamily: "Oswald, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "600",
                    textTransform: "uppercase"
                },
                animations: { type: "fadeInUp", delay: "0.2s" }
            },
            {
                id: `preset-oa-${Date.now()}-7`,
                type: "paragraph",
                content: "Epic adventures captured through my lens - from sunrise summits to canyon explorations and everything in between.",
                styles: {
                    fontSize: "17px",
                    color: "#4a7c59",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "550px",
                    margin: "0 auto 35px auto",
                    fontFamily: "Open Sans, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "fadeIn", delay: "0.4s" }
            }
        ],
        contact: [
            {
                id: `preset-oa-${Date.now()}-8`,
                type: "heading",
                content: "🏕️ READY FOR ADVENTURE? 🏕️",
                styles: {
                    fontSize: "34px",
                    color: "#2d5016",
                    textAlign: "center",
                    fontFamily: "Oswald, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "600",
                    textTransform: "uppercase"
                },
                animations: { type: "heartBeat", delay: "0.2s" }
            },
            {
                id: `preset-oa-${Date.now()}-9`,
                type: "paragraph",
                content: "Let's explore the wilderness together! Whether you need adventure documentation, outdoor portraits, or want to capture your next epic journey, I'm ready to hit the trails with you.",
                styles: {
                    fontSize: "18px",
                    color: "#3a5a40",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "600px",
                    margin: "0 auto 30px auto",
                    fontFamily: "Open Sans, sans-serif",
                    fontWeight: "400"
                },
                animations: { type: "slideInUp", delay: "0.4s" }
            },
            {
                id: `preset-oa-${Date.now()}-10`,
                type: "button",
                content: "🗺️ Plan Adventure",
                styles: {
                    backgroundColor: "#4a7c59",
                    color: "white",
                    padding: "17px 40px",
                    fontSize: "16px",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontFamily: "Oswald, sans-serif",
                    fontWeight: "500",
                    letterSpacing: "1px",
                    textTransform: "uppercase"
                },
                animations: { type: "bounceIn", delay: "0.6s" }
            }
        ]
    }
};