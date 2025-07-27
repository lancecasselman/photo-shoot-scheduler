# Custom Domain Deployment Guide: photomanagementsystem.com

## Current Status
✅ **Working perfectly**: https://photo-shoot-scheduler-lancecasselman.replit.app
🔄 **Deployed but needs Firebase config**: https://photomanagementsystem.com

### Custom Domain Analysis
- ✅ Server running with authentication enabled
- ✅ API endpoints responding correctly
- ✅ Landing page and auth page loading
- ❌ Firebase domain authorization missing

## Step 1: Firebase Console Configuration

### Add Authorized Domain
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **photoshcheduleapp**
3. Navigate to **Authentication** → **Settings** → **Authorized domains**
4. Click **"Add domain"**
5. Enter: `photomanagementsystem.com`
6. Click **"Add"**

**Note**: If you don't see "Authorized domains" under Settings, check under **Authentication** → **Sign-in method** tab and scroll down.

### Current Firebase Configuration
- Project ID: `photoshcheduleapp`
- API Key: `AIzaSyDbtboh1bW6xu9Tz9FILkx_0lzGwXQHjyM`
- Auth Domain: `photoshcheduleapp.firebaseapp.com`

## Step 2: Update OAuth Configuration (For Google Sign-in)

### Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **photoshcheduleapp**
3. Navigate to **APIs & Services** → **Credentials**
4. Find your **OAuth 2.0 Client ID**
5. Edit and add to **Authorized JavaScript origins**:
   - `https://photomanagementsystem.com`
6. Add to **Authorized redirect URIs**:
   - `https://photomanagementsystem.com/__/auth/handler`

## Step 3: Server Configuration

The current server is configured to work with any domain. Key files are ready:

### Essential Files for Deployment
- `server.js` - Complete Express.js backend
- `auth.html` - Authentication page (fixed redirect)
- `index.html` - Main application dashboard
- `landing.html` - Landing page
- `firebase-config.js` - Client-side Firebase config
- `.env` - Environment variables (needs custom domain setup)

### CORS Configuration
The server already includes CORS headers that work with any domain:
```javascript
app.use(cors({
    origin: true,
    credentials: true
}));
```

## Step 4: Deploy to Custom Domain

### Option A: Use Replit Custom Domain
1. In Replit project settings
2. Add custom domain: `photomanagementsystem.com`
3. Follow DNS configuration instructions
4. Replit handles SSL automatically

### Option B: External Hosting
1. Upload all project files to your hosting provider
2. Configure environment variables:
   - `DATABASE_URL` (PostgreSQL connection)
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON` (Firebase Admin SDK)
   - `STRIPE_SECRET_KEY` (if using Stripe)
   - `SENDGRID_API_KEY` (if using email)
3. Ensure Node.js runtime is available
4. Run: `node server.js`

## Step 5: DNS Configuration

Point your domain to the hosting:
```
Type: A
Host: @
Value: [Your hosting IP]

Type: CNAME  
Host: www
Value: photomanagementsystem.com
```

## Step 6: SSL Certificate

Ensure HTTPS is enabled (required for Firebase Auth):
- Replit: Automatic SSL
- Other hosts: Configure SSL certificate

## Step 7: Test Authentication Flow

After deployment:
1. Visit `https://photomanagementsystem.com`
2. Click "Launch App"
3. Sign in with Google or Email/Password
4. Should redirect to main application

## Current Firebase Project Setup

Your Firebase project is already configured with:
- ✅ Authentication enabled
- ✅ Google Sign-in provider
- ✅ Email/Password provider
- ✅ Database rules configured
- ✅ Storage bucket configured

Just need to add the custom domain to authorized domains list.

## Next Steps

1. **Add photomanagementsystem.com to Firebase authorized domains**
2. **Update Google OAuth settings**
3. **Deploy to custom domain**
4. **Test authentication flow**

The system is ready - just needs the domain configuration!