# Google Play Store Deployment Setup

## Current Status: 🟡 SETUP REQUIRED

Your photography management platform is ready for Android deployment with the following configuration:

### **Current Mobile Configuration:**
- **App ID**: `com.thelegacyphotography.photomanager`
- **App Name**: `Photography Manager`
- **Platform**: Capacitor 7.x (Latest)
- **Target**: Android + iOS hybrid app

## Google Play Store Setup Steps:

### **Phase 1: Development Environment** ⚙️

#### 1. Android Development Setup
```bash
# Install Android platform (in progress)
npx cap add android

# Sync project files
npx cap sync android

# Build for Android
npx cap build android
```

#### 2. Required Software
- **Android Studio**: Latest version for building and signing
- **Java JDK 11+**: Required for Android compilation
- **Android SDK**: API Level 31+ (Android 12)
- **Gradle**: 7.0+ (bundled with Android Studio)

### **Phase 2: App Configuration** 📱

#### 1. App Manifest Updates (android/app/src/main/AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.VIBRATE" />
```

#### 2. Build Configuration
- **Target SDK**: 34 (Android 14)
- **Minimum SDK**: 22 (Android 5.1)
- **Compile SDK**: 34
- **Build Tools**: 34.0.0

### **Phase 3: Google Play Console Setup** 🏪

#### 1. Create Google Play Developer Account
- **Cost**: $25 one-time registration fee
- **Requirements**: Google account, payment method, tax info
- **Timeline**: 24-48 hours for approval

#### 2. App Store Listing Requirements

**App Information:**
- **App Title**: "Photography Manager Pro"
- **Short Description**: "Professional photography business management platform"
- **Full Description**: 4000-character detailed description
- **Category**: Business / Productivity
- **Content Rating**: Everyone

**Required Assets:**
- **App Icon**: 512×512 PNG (high-resolution)
- **Feature Graphic**: 1024×500 PNG (Store banner)
- **Screenshots**: Minimum 2, maximum 8 (Phone + Tablet)
  - Phone: 320dp to 3840dp (16:9 or 9:16 aspect ratio)
  - 7-inch tablet: 1024dp to 3840dp
  - 10-inch tablet: 1024dp to 3840dp

### **Phase 4: App Signing & Security** 🔐

#### 1. Generate Signing Key
```bash
# Create keystore (one-time setup)
keytool -genkey -v -keystore photography-manager.keystore -alias photography-manager -keyalg RSA -keysize 2048 -validity 10000

# Store keystore securely - NEVER lose this file!
```

#### 2. Configure Signing in Capacitor
```typescript
// capacitor.config.ts updates needed
android: {
  buildOptions: {
    keystorePath: 'photography-manager.keystore',
    keystoreAlias: 'photography-manager',
    keystoreAliasPassword: 'YOUR_ALIAS_PASSWORD',
    keystorePassword: 'YOUR_KEYSTORE_PASSWORD'
  }
}
```

### **Phase 5: Subscription Integration** 💳

#### 1. Google Play Billing Setup
```bash
# Install Play Billing plugin
npm install @capacitor-community/in-app-purchases
```

#### 2. Configure Subscription Products
- **Professional Plan**: $39.99/month
- **Storage Add-on**: $24.99/month per TB
- **Product IDs**: 
  - `professional_monthly_subscription`
  - `storage_addon_1tb_monthly`

### **Phase 6: Build & Deploy** 🚀

#### 1. Production Build Process
```bash
# Clean build
npx cap clean android

# Sync latest changes
npx cap sync android

# Open in Android Studio for final build
npx cap open android
```

#### 2. Android Studio Build Steps
1. Build → Generate Signed Bundle/APK
2. Select "Android App Bundle" (recommended)
3. Choose existing keystore
4. Select "release" build variant
5. Generate bundle (.aab file)

#### 3. Upload to Play Console
1. Create new release in Play Console
2. Upload signed app bundle (.aab)
3. Complete store listing
4. Submit for review

### **Phase 7: Testing & Optimization** 🧪

#### 1. Internal Testing
- Upload to Internal Testing track
- Test core photography features:
  - Session creation and management
  - Photo upload and gallery creation
  - Client communication
  - Payment processing
  - Website builder functionality

#### 2. Performance Optimization
- APK size optimization (target <50MB)
- Startup time optimization
- Battery usage optimization
- Network efficiency

### **Timeline Estimate:**

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Development Setup | 1-2 days | Android Studio installation |
| App Configuration | 2-3 days | Asset creation, permissions |
| Play Console Setup | 1-2 days | Account approval |
| App Signing | 1 day | Keystore generation |
| Subscription Integration | 3-5 days | Play Billing API |
| Build & Deploy | 1-2 days | Final testing |
| Review Process | 3-7 days | Google review |

**Total Timeline: 2-3 weeks**

### **Revenue Model Integration:**

#### Subscription Tiers for Play Store:
1. **Professional Plan**: $39.99/month
   - 100GB cloud storage
   - Unlimited sessions
   - Website builder
   - Client galleries
   - Payment processing

2. **Storage Add-ons**: $24.99/month each
   - Additional 1TB storage
   - Auto-backup to cloud
   - RAW file support

#### Expected Revenue:
- **Target**: 500-1,000 photographers
- **Conversion Rate**: 15-25% of downloads
- **Annual Revenue Potential**: $234K - $468K

### **Next Immediate Steps:**

1. ✅ Install Android platform dependencies
2. ⏳ Configure Android project structure
3. ⏳ Create app signing keystore
4. ⏳ Generate required store assets
5. ⏳ Set up Google Play Developer account
6. ⏳ Implement Google Play Billing

## Current Blockers: None
## Prerequisites: Android Studio installation recommended