
# 📱 Mobile Build Instructions for Mac

## Prerequisites
1. **Xcode** (for iOS) - Install from Mac App Store
2. **Android Studio** (for Android) - Download from developer.android.com
3. **Node.js** - Already installed in your Replit environment

## Step 1: Initialize Capacitor Platforms

```bash
# Add iOS platform
npm run cap:add:ios

# Add Android platform  
npm run cap:add:android
```

## Step 2: Sync Your Web App to Native Platforms

```bash
# Sync web app to both platforms
npm run cap:sync
```

## Step 3: Build for iOS (Mac Required)

```bash
# Open in Xcode
npx cap open ios
```

**In Xcode:**
1. Select your development team in "Signing & Capabilities"
2. Change Bundle Identifier to your unique ID (e.g., `com.yourname.photoshootscheduler`)
3. Connect your iPhone via USB
4. Select your device in the toolbar
5. Click ▶️ Run button to install on device

**For App Store:**
1. In Xcode: Product → Archive
2. Follow prompts to upload to App Store Connect
3. Submit for review in App Store Connect dashboard

## Step 4: Build for Android

```bash
# Open in Android Studio
npx cap open android
```

**In Android Studio:**
1. Build → Generate Signed Bundle/APK
2. Choose "Android App Bundle" 
3. Create or use existing keystore
4. Build release bundle
5. Upload .aab file to Google Play Console

## Step 5: Testing Locally

```bash
# Test on iOS simulator
npm run cap:run:ios

# Test on Android emulator  
npm run cap:run:android
```

## Your Web App Integration

✅ **Web Server**: Your Node.js server continues running on port 5000
✅ **API Calls**: Mobile app makes HTTPS calls to your APIs (Firebase/R2/Stripe)
✅ **No Changes**: Your existing web app works exactly the same
✅ **File Structure**: Capacitor uses your current directory as webDir

## App Store Requirements

### iOS App Store:
- Developer account ($99/year)
- App icons (various sizes)
- Privacy policy URL
- App description and screenshots

### Google Play Store:
- Developer account ($25 one-time)
- Signed APK/AAB
- Store listing with screenshots
- Privacy policy

## Next Steps After Build:
1. Test thoroughly on physical devices
2. Add app icons to `/ios/App/App/Assets.xcassets/` and `/android/app/src/main/res/`
3. Configure push notifications if needed
4. Submit to app stores

Your photography management platform is now mobile-ready! 🎉
