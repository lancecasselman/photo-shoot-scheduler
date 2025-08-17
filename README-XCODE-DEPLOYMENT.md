# Xcode Deployment Guide - Photography Manager

## Project Configuration

### Bundle Identifier
- **Production**: `com.thelegacyphotography.photomanager`
- **App Name**: Photography Manager
- **Scheme**: photomanager

### Prerequisites
1. **Xcode 15+** installed on macOS
2. **iOS Developer Account** (free or paid)
3. **Capacitor CLI** installed globally: `npm install -g @capacitor/cli`

## Deployment Steps

### 1. Sync Capacitor Project
```bash
# From project root
npx cap sync ios
```

### 2. Open in Xcode
```bash
npx cap open ios
```

### 3. Configure App Settings in Xcode

#### Team & Signing
1. Select **App** target in Xcode
2. Go to **Signing & Capabilities** tab
3. Select your **Development Team**
4. Ensure **Bundle Identifier** is: `com.thelegacyphotography.photomanager`
5. Enable **Automatically manage signing**

#### Deployment Target
- Set **iOS Deployment Target**: 13.0 minimum
- Supports iPhone and iPad

### 4. Firebase Configuration
The app includes Firebase authentication with these settings:
- **Project ID**: photoshcheduleapp
- **Bundle ID**: com.thelegacyphotography.photomanager
- **GoogleService-Info.plist** is already configured

### 5. App Permissions
The following permissions are configured:
- **Camera**: Photo capture for sessions
- **Photo Library**: Portfolio management
- **Photo Library Add**: Save photos to device
- **Microphone**: Video recording (optional)
- **Location**: Session location tagging

### 6. Build & Test

#### Simulator Testing
1. Select iOS Simulator (iPhone 15 Pro recommended)
2. Click **Build and Run** (⌘+R)

#### Device Testing
1. Connect iOS device via USB
2. Select your device from targets
3. Click **Build and Run** (⌘+R)
4. Trust developer certificate on device if prompted

### 7. App Store Distribution

#### Archive for Distribution
1. Select **Any iOS Device** as target
2. **Product** → **Archive**
3. In Organizer, select archive and click **Distribute App**
4. Choose **App Store Connect**
5. Follow prompts to upload

#### App Store Connect Setup
1. Create app in [App Store Connect](https://appstoreconnect.apple.com)
2. App Information:
   - **Name**: Photography Manager
   - **Bundle ID**: com.thelegacyphotography.photomanager
   - **Category**: Photography
3. Upload screenshots and metadata
4. Submit for review

## Troubleshooting

### CocoaPods Configuration Issues

If you encounter xcconfig file errors or script phase warnings in Xcode:

1. **On macOS, install CocoaPods and run setup**:
   ```bash
   sudo gem install cocoapods
   cd ios/App
   pod install --repo-update
   ```

2. **Always open the workspace file**:
   ```bash
   open App.xcworkspace  # NOT App.xcodeproj
   ```

3. **Fix script phase warnings** in Xcode:
   - Select project → App target → Build Phases
   - Find `[CP] Embed Pods Frameworks` script
   - Add Output Files (see XCODE-SETUP-MACOS.md for details)

### Common Issues

#### Build Errors
- **Pod install issues**: See `ios/XCODE-SETUP-MACOS.md` for detailed CocoaPods setup
- **Signing errors**: Check Team settings and Bundle ID
- **Capacitor sync issues**: Run `npx cap sync ios` again
- **Missing xcconfig files**: Temporary files provided, but run `pod install` on macOS

#### Firebase Authentication
- Ensure GoogleService-Info.plist is in Xcode project
- Verify Bundle ID matches Firebase configuration
- Check Firebase console for iOS app configuration

#### Network Issues
- Development allows all network requests for Replit compatibility
- Production should restrict to necessary domains only

### Update Commands
```bash
# Update iOS platform
npx cap update ios

# Clean and sync
npx cap clean ios
npx cap sync ios

# Copy web assets
npx cap copy ios
```

## Production Checklist

### Before App Store Submission
- [ ] Complete CocoaPods setup on macOS (see ios/XCODE-SETUP-MACOS.md)
- [ ] Always use App.xcworkspace (not .xcodeproj)
- [ ] Fix script phase output dependencies
- [ ] Update bundle identifier to production value
- [ ] Configure release signing
- [ ] Test on multiple iOS devices
- [ ] Verify all Firebase features work
- [ ] Test camera and photo permissions
- [ ] Remove development debugging
- [ ] Add App Store screenshots
- [ ] Complete App Store metadata

### Security Configuration
- [ ] Restrict network domains for production
- [ ] Disable web debugging
- [ ] Enable certificate pinning if needed
- [ ] Review permission usage descriptions

## Development vs Production

### Development (Current)
- Allows all network requests for Replit compatibility
- Debug logging enabled
- Firebase test configuration

### Production Recommendations
- Restrict network access to necessary domains only
- Disable debug logging
- Use production Firebase configuration
- Enable advanced security features

---

**Ready for Xcode!** The iOS project is configured and ready for development and deployment.