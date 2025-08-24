# Getting Debug Signing Certificate SHA-1

## Current Status
Your `google-services.json` currently has a placeholder: `"certificate_hash": "SHA1_PLACEHOLDER"`

## How to Get Your Debug SHA-1

### Method 1: Using Android Studio
1. Open Android Studio
2. Open your project
3. Click on Gradle tab (right side)
4. Navigate to: `android` > `Tasks` > `android` > `signingReport`
5. Double-click `signingReport`
6. Look for the SHA1 fingerprint in the output

### Method 2: Command Line (if you have Android SDK)
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### Method 3: Generate New Debug Keystore
```bash
keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000
```

## Why You Need It
The SHA-1 certificate hash is required for:
- Firebase Authentication (especially Google Sign-In)
- Google APIs that require app verification
- Google Play Store app verification
- OAuth 2.0 authentication flows

## Default Debug SHA-1
If you haven't customized your debug keystore, Android Studio typically generates one automatically. The location is usually:
- **Windows**: `C:\Users\{username}\.android\debug.keystore`
- **Mac/Linux**: `~/.android/debug.keystore`

## Next Steps
1. Get your actual SHA-1 fingerprint using one of the methods above
2. Update your Firebase project console with the SHA-1
3. Download new `google-services.json` with the correct certificate hash
4. Replace the current file in `android/app/google-services.json`

## For Production
You'll also need to add your release keystore SHA-1 when you're ready to publish to Google Play Store.