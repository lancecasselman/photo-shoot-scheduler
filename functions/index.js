const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getStorage } = require("firebase-admin/storage");

admin.initializeApp();
const db = admin.firestore();
const bucket = getStorage().bucket();

// Generate and deploy static site to Firebase Storage
exports.generateStaticSite = functions.https.onCall(async (data, context) => {
    try {
        const { username, blocks, theme, brandColor, settings } = data;
        
        if (!username || !blocks) {
            throw new functions.https.HttpsError("invalid-argument", "Username and blocks are required.");
        }

        // Enhanced HTML generation with professional themes
        const themeStyles = {
            classic: {
                background: 'linear-gradient(135deg, #faf7f0 0%, #f5f1e8 100%)',
                primaryColor: '#D4AF37',
                textColor: '#333333',
                fontFamily: 'Georgia, serif'
            },
            modern: {
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                primaryColor: '#2563EB',
                textColor: '#1f2937',
                fontFamily: 'Inter, sans-serif'
            },
            dark: {
                background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                primaryColor: '#10B981',
                textColor: '#ffffff',
                fontFamily: 'Roboto, sans-serif'
            },
            bold: {
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                primaryColor: '#DC2626',
                textColor: '#1f2937',
                fontFamily: 'Montserrat, sans-serif'
            }
        };

        const selectedTheme = themeStyles[theme] || themeStyles.classic;
        
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="index, follow">
    <title>${settings?.seoTitle || `${username} Photography`}</title>
    <meta name="description" content="${settings?.seoDescription || 'Professional photography portfolio and services'}">
    <meta name="keywords" content="photography, portfolio, professional photographer, wedding photography, portrait photography">
    
    <!-- Open Graph tags -->
    <meta property="og:title" content="${settings?.seoTitle || `${username} Photography`}">
    <meta property="og:description" content="${settings?.seoDescription || 'Professional photography portfolio and services'}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://photomanagementsystem.com/site/${username}">
    
    <!-- Twitter Card tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${settings?.seoTitle || `${username} Photography`}">
    <meta name="twitter:description" content="${settings?.seoDescription || 'Professional photography portfolio and services'}">
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: ${selectedTheme.fontFamily};
            background: ${selectedTheme.background};
            color: ${selectedTheme.textColor};
            line-height: 1.6;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        .site-content {
            background: rgba(255, 255, 255, 0.95);
            padding: 60px 40px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }
        
        .block {
            margin-bottom: 30px;
            animation: fadeInUp 0.6s ease-out;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        h1, h2, h3 {
            color: ${selectedTheme.primaryColor};
            margin-bottom: 15px;
        }
        
        p {
            margin-bottom: 15px;
            line-height: 1.8;
        }
        
        img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        
        button {
            background: linear-gradient(135deg, ${selectedTheme.primaryColor}, ${selectedTheme.primaryColor}dd);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
        
        .footer {
            text-align: center;
            margin-top: 60px;
            padding-top: 30px;
            border-top: 2px solid ${selectedTheme.primaryColor};
            color: #666;
        }
        
        .footer a {
            color: ${selectedTheme.primaryColor};
            text-decoration: none;
        }
        
        @media (max-width: 768px) {
            .site-content {
                padding: 30px 20px;
            }
            
            .container {
                padding: 20px 10px;
            }
        }
    </style>
    
    ${settings?.analytics ? `
    <!-- Analytics Tracking -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'GA_MEASUREMENT_ID');
    </script>
    ` : ''}
</head>
<body>
    <div class="container">
        <div class="site-content">
            ${blocks.map(block => {
                const styles = { ...block.styles };
                
                switch (block.type) {
                    case 'heading':
                        return `<div class="block"><h1 style="${styleStr(styles)}">${escapeHTML(block.content)}</h1></div>`;
                    
                    case 'paragraph':
                        return `<div class="block"><p style="${styleStr(styles)}">${escapeHTML(block.content)}</p></div>`;
                    
                    case 'image':
                        return `<div class="block"><img src="${escapeHTML(block.content)}" alt="Portfolio image" style="${styleStr(styles)}" /></div>`;
                    
                    case 'button':
                        return `<div class="block"><button style="${styleStr(styles)}" onclick="window.open('mailto:lance@thelegacyphotography.com')">${escapeHTML(block.content)}</button></div>`;
                    
                    default:
                        return '';
                }
            }).join('\n            ')}
        </div>
        
        <div class="footer">
            <p>Created with Photography Management System</p>
            <p>
                <a href="mailto:lance@thelegacyphotography.com">Contact: lance@thelegacyphotography.com</a> | 
                <a href="tel:843-485-1315">Call: 843-485-1315</a>
            </p>
            <p style="margin-top: 10px; font-size: 12px; color: #999;">
                Built with Advanced Website Builder • ${new Date().getFullYear()}
            </p>
        </div>
    </div>
    
    <script>
        // Contact interaction tracking
        document.addEventListener('click', function(e) {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                console.log('Contact button clicked - Email interaction');
            }
        });
        
        // Page load analytics
        window.addEventListener('load', function() {
            console.log('Portfolio page loaded successfully');
        });
    </script>
</body>
</html>`;

        // Save to Firebase Storage
        const file = bucket.file(`sites/${username}/index.html`);
        await file.save(html, { 
            metadata: {
                contentType: "text/html",
                cacheControl: "public, max-age=3600"
            }
        });

        // Save metadata to Firestore
        await db.collection('published_sites').doc(username).set({
            username,
            theme,
            brandColor,
            settings: settings || {},
            publishedAt: admin.firestore.FieldValue.serverTimestamp(),
            blockCount: blocks.length,
            version: '2.0'
        });

        return { 
            success: true, 
            url: `https://photomanagementsystem.com/site/${username}`,
            storageUrl: `https://storage.googleapis.com/${bucket.name}/sites/${username}/index.html`,
            publishedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error generating static site:', error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// Helper function to convert styles object to CSS string
function styleStr(styles) {
    return Object.entries(styles || {})
        .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`)
        .join(";");
}

// Helper function to escape HTML
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Cloud function to serve static sites
exports.serveStaticSite = functions.https.onRequest(async (req, res) => {
    try {
        const username = req.path.split('/')[2]; // Extract username from /site/username
        
        if (!username) {
            res.status(404).send('Site not found');
            return;
        }

        const file = bucket.file(`sites/${username}/index.html`);
        const [exists] = await file.exists();
        
        if (!exists) {
            res.status(404).send(`
                <html>
                    <head><title>Site Not Found</title></head>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 100px;">
                        <h1 style="color: #D4AF37;">Site Not Found</h1>
                        <p>The site "${username}" does not exist or has been removed.</p>
                        <a href="/">← Back to Photography Management System</a>
                    </body>
                </html>
            `);
            return;
        }

        const [content] = await file.download();
        res.set('Content-Type', 'text/html');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(content);

    } catch (error) {
        console.error('Error serving static site:', error);
        res.status(500).send('Error loading site');
    }
});