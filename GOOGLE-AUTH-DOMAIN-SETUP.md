# Google Authentication Domain Setup

## Current Issue
Google authentication is failing because the Replit domain is not authorized in Firebase.

## Current Domain
`8b52078f-2876-41ad-b7b4-15cd08bb6e7e-00-26t6e4y6vz596.worf.replit.dev`

## Status
❌ STILL NEEDS TO BE ADDED - Google login failing on mobile preview

## To Fix Google Authentication:

### Step 1: Add Domain to Firebase
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your `photoshcheduleapp` project
3. Go to **Authentication** > **Settings** > **Authorized domains**
4. Click **Add domain**
5. Add: `8b52078f-2876-41ad-b7b4-15cd08bb6e7e-00-26t6e4y6vz596.worf.replit.dev`
6. Click **Done** and **Save**

### Step 2: For Production Deployment
When you deploy to a `.replit.app` domain, you'll need to add that domain too:
- Format: `yourapp.replit.app`

### Step 3: Wildcard Option (Advanced)
You can also add wildcard domains for Replit:
- `*.worf.replit.dev`
- `*.replit.dev`

## Temporary Workaround
Users can still login using email/password authentication while Google authentication is being set up.

## Error Details
- **Error**: "Unable to verify that the app domain is authorized"
- **Cause**: Domain not in Firebase authorized domains list
- **Solution**: Add domain to Firebase console as described above

## Once Fixed
After adding the domain to Firebase, Google authentication will work immediately without code changes.