// Boho theme - Artistic and free-spirited design

window.BohoTheme = {
    meta: {
        name: "Boho Artistic",
        description: "Free-spirited design with earthy tones and artistic flair",
        font: "Quicksand, sans-serif",
        primaryColor: "#8B4513",
        secondaryColor: "#DEB887",
        backgroundColor: "#FFF8DC"
    },
    blocks: {
        home: [
            {
                id: 1101,
                type: "heading",
                content: "✨ Bohemian Photography ✨",
                styles: {
                    fontSize: "38px",
                    color: "#8B4513",
                    textAlign: "center",
                    fontFamily: "Quicksand, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "600"
                },
                animations: { type: "bounceIn", delay: "0.3s" }
            },
            {
                id: 1102,
                type: "paragraph",
                content: "Celebrating the wild, the free, and the beautifully imperfect. Capturing souls through an artistic lens with natural light and authentic moments.",
                styles: {
                    fontSize: "17px",
                    color: "#654321",
                    textAlign: "center",
                    lineHeight: "1.6",
                    maxWidth: "650px",
                    margin: "0 auto 25px auto",
                    fontFamily: "Quicksand, sans-serif",
                    fontStyle: "italic"
                },
                animations: { type: "slideInLeft", delay: "0.5s" }
            },
            {
                id: 1103,
                type: "button",
                content: "🌿 Explore My Art",
                styles: {
                    backgroundColor: "#DEB887",
                    color: "#8B4513",
                    padding: "18px 35px",
                    fontSize: "16px",
                    border: "2px solid #8B4513",
                    borderRadius: "25px",
                    cursor: "pointer",
                    fontFamily: "Quicksand, sans-serif",
                    margin: "20px auto",
                    display: "block",
                    fontWeight: "600"
                },
                animations: { type: "heartBeat", delay: "0.7s" }
            }
        ],
        about: [
            {
                id: 2101,
                type: "heading",
                content: "🌙 My Creative Journey",
                styles: {
                    fontSize: "34px",
                    color: "#8B4513",
                    textAlign: "center",
                    fontFamily: "Quicksand, sans-serif",
                    marginBottom: "25px",
                    fontWeight: "600"
                },
                animations: { type: "rotateIn" }
            },
            {
                id: 2102,
                type: "paragraph",
                content: "Art flows through my veins like ancient rivers. I believe in capturing the essence of free spirits and wild hearts. My camera is my paintbrush, and light is my canvas.",
                styles: {
                    fontSize: "16px",
                    color: "#654321",
                    lineHeight: "1.7",
                    maxWidth: "650px",
                    margin: "0 auto 20px auto",
                    fontFamily: "Quicksand, sans-serif",
                    textAlign: "center"
                },
                animations: { type: "slideInUp", delay: "0.3s" }
            },
            {
                id: 2103,
                type: "paragraph",
                content: "From desert sunrises to forest clearings, I find magic in every corner of nature. Let's create art that speaks to your soul and celebrates your unique story.",
                styles: {
                    fontSize: "16px",
                    color: "#654321",
                    lineHeight: "1.7",
                    maxWidth: "650px",
                    margin: "0 auto",
                    fontFamily: "Quicksand, sans-serif",
                    textAlign: "center",
                    fontStyle: "italic"
                },
                animations: { type: "slideInDown", delay: "0.5s" }
            }
        ],
        gallery: [
            {
                id: 3101,
                type: "heading",
                content: "🎨 Artistic Portfolio",
                styles: {
                    fontSize: "34px",
                    color: "#8B4513",
                    textAlign: "center",
                    fontFamily: "Quicksand, sans-serif",
                    marginBottom: "20px",
                    fontWeight: "600"
                },
                animations: { type: "flipInX" }
            },
            {
                id: 3102,
                type: "paragraph",
                content: "A collection of souls captured in their most authentic moments ✨",
                styles: {
                    fontSize: "16px",
                    color: "#654321",
                    textAlign: "center",
                    marginBottom: "30px",
                    fontFamily: "Quicksand, sans-serif",
                    fontStyle: "italic"
                },
                animations: { type: "fadeIn", delay: "0.2s" }
            },
            {
                id: 3103,
                type: "image",
                content: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400",
                styles: {
                    width: "320px",
                    height: "240px",
                    objectFit: "cover",
                    borderRadius: "15px",
                    margin: "15px",
                    boxShadow: "0 8px 25px rgba(139,69,19,0.2)",
                    border: "3px solid #DEB887"
                },
                animations: { type: "rotateInUpLeft", delay: "0.4s" }
            }
        ],
        contact: [
            {
                id: 4101,
                type: "heading",
                content: "🌸 Let's Connect Souls",
                styles: {
                    fontSize: "34px",
                    color: "#8B4513",
                    textAlign: "center",
                    fontFamily: "Quicksand, sans-serif",
                    marginBottom: "20px",
                    fontWeight: "600"
                },
                animations: { type: "bounceInDown" }
            },
            {
                id: 4102,
                type: "paragraph",
                content: "Ready to embark on a creative adventure? Let's weave magic together and create art that celebrates your beautiful spirit.",
                styles: {
                    fontSize: "16px",
                    color: "#654321",
                    textAlign: "center",
                    marginBottom: "30px",
                    fontFamily: "Quicksand, sans-serif",
                    maxWidth: "550px",
                    margin: "0 auto 30px auto",
                    lineHeight: "1.6"
                },
                animations: { type: "slideInRight", delay: "0.2s" }
            },
            {
                id: 4103,
                type: "button",
                content: "🦋 Start Our Journey",
                styles: {
                    backgroundColor: "#DEB887",
                    color: "#8B4513",
                    padding: "18px 35px",
                    fontSize: "16px",
                    border: "2px solid #8B4513",
                    borderRadius: "25px",
                    cursor: "pointer",
                    fontFamily: "Quicksand, sans-serif",
                    margin: "0 auto",
                    display: "block",
                    fontWeight: "600"
                },
                animations: { type: "wobble", delay: "0.4s" }
            }
        ]
    }
};