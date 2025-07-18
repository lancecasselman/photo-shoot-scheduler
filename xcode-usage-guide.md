# Xcode Usage Guide - Photography Scheduler iOS App

## 🎉 Xcode Project Successfully Opened!

Your Photography Scheduler app is now open in Xcode as a native iOS project. Here's everything you need to know to build, test, and deploy your app.

## 📱 Project Overview

**App Details:**
- **Bundle ID:** com.photographer.scheduler
- **App Name:** Photography Scheduler
- **Platform:** iOS (iPhone & iPad)
- **Language:** Swift (with web assets)
- **Architecture:** Capacitor hybrid app

## 🔧 Building Your App

### 1. Select Your Target Device
In Xcode, at the top left:
- Choose **iPhone Simulator** for testing
- Or select a **connected iOS device** for real device testing

### 2. Build and Run
- **Keyboard shortcut:** `⌘ + R` (Command + R)
- **Menu:** Product → Run
- **Button:** Click the ▶️ play button in the toolbar

### 3. First Build Setup
The first build may take a few minutes as Xcode:
- Downloads iOS SDK components
- Configures project dependencies
- Builds your app bundle

## 📲 Testing Your App

### In iOS Simulator
- **Camera:** Will show camera picker (no actual camera in simulator)
- **Push Notifications:** Full testing available
- **Contact Actions:** Opens respective apps (Phone, Messages, Mail)
- **Network Monitoring:** Works with simulator network settings
- **Device Info:** Shows simulator details

### On Physical Device
- **Camera:** Full camera access with photo capture
- **Push Notifications:** Real push notifications
- **Contact Actions:** Direct native integration
- **Network Monitoring:** Real cellular/WiFi monitoring
- **Device Info:** Actual device details

## 🛠️ Development Workflow

### Making Changes to Your App
1. **Edit your web files** (index.html, style.css, script.js)
2. **Run build script:** `node build-capacitor.js`
3. **In Xcode:** Product → Clean Build Folder (⌘⇧K)
4. **Build and run:** ⌘R

### Live Reload Development
```bash
# Run with live reload for faster development
npx cap run ios --livereload
```

## 🔍 Debugging Your App

### Web Inspector (Recommended)
1. **Run your app** in iOS Simulator
2. **Open Safari** on your Mac
3. **Safari Menu:** Develop → Simulator → localhost
4. **Debug** your JavaScript like a web page

### Xcode Console
- **View:** View → Debug Area → Show Debug Area
- **Console:** Shows native iOS logs and JavaScript console.log()

### Network Debugging
- **Xcode:** Debug → Attach to Process
- **Network requests** appear in Xcode's network debugging tools

## 📱 App Features in Xcode

### Native iOS Features Available
- **Camera Integration** - Full camera access
- **Push Notifications** - Real iOS notifications
- **Contact Actions** - Native phone, SMS, email
- **App State Management** - Background/foreground detection
- **Network Monitoring** - Real-time connectivity
- **Device Information** - iOS device details
- **Status Bar Control** - Native iOS styling
- **Keyboard Handling** - Automatic adjustments

### Testing Each Feature
1. **Camera:** Tap camera buttons to access device camera
2. **Notifications:** Allow permissions, test scheduling
3. **Contacts:** Test call, SMS, email buttons
4. **Network:** Toggle WiFi/cellular to see real-time updates
5. **App State:** Switch between apps to test state changes

## 🚀 App Store Deployment

### Prerequisites
- **Apple Developer Account** ($99/year)
- **Valid provisioning profiles**
- **App Store Connect** app listing

### Steps to Deploy
1. **Archive your app:** Product → Archive
2. **Upload to App Store:** Window → Organizer → Upload
3. **App Store Connect:** Review and submit for approval
4. **Distribution:** Apple reviews and publishes

### Code Signing
- **Automatic:** Xcode → Preferences → Accounts → Add Apple ID
- **Manual:** Configure provisioning profiles in project settings

## 📊 Performance Optimization

### Monitoring Performance
- **Xcode Instruments:** Profile your app's performance
- **Memory Usage:** Monitor memory consumption
- **CPU Usage:** Track processing efficiency
- **Network Activity:** Monitor API calls

### Optimization Tips
- **Image Optimization:** Compress images for iOS
- **Bundle Size:** Minimize app size for faster downloads
- **Battery Usage:** Optimize background processes

## 🔧 Advanced Configuration

### Capacitor Configuration
Edit `capacitor.config.ts` for:
- **Server URL:** Change development server URL
- **Plugin Settings:** Configure native plugin behavior
- **iOS Specific:** Platform-specific settings

### iOS Project Settings
In Xcode project settings:
- **Bundle Identifier:** Change app ID
- **Version:** Update app version numbers
- **Capabilities:** Enable additional iOS features
- **Info.plist:** Configure app permissions

## 📝 Common Issues & Solutions

### Build Errors
- **Clean Build:** Product → Clean Build Folder
- **Restart Xcode:** Close and reopen Xcode
- **Update Capacitor:** `npm update @capacitor/ios`

### Permission Issues
- **Camera:** Add camera usage description in Info.plist
- **Notifications:** Configure push notification capabilities
- **Location:** Add location usage descriptions

### Simulator Issues
- **Reset Simulator:** Device → Erase All Content and Settings
- **Different Device:** Test on various iPhone/iPad models
- **iOS Version:** Test on different iOS versions

## 📱 Testing Checklist

Before deploying:
- [ ] Test on multiple iOS devices (iPhone/iPad)
- [ ] Test all camera functionality
- [ ] Verify push notifications work
- [ ] Test contact actions (call, SMS, email)
- [ ] Verify network monitoring
- [ ] Test app state management
- [ ] Check performance on older devices
- [ ] Test offline functionality
- [ ] Verify all session management features

## 🎯 Your App is Ready!

Your Photography Scheduler is now a full native iOS app with:
- **Professional UI** optimized for iOS
- **Native performance** with web flexibility
- **App Store ready** configuration
- **Easy maintenance** with web technologies
- **Full editing capabilities** - you can continue adding features

**Next Steps:**
1. **Test thoroughly** in iOS Simulator and device
2. **Add your Apple Developer account** for device testing
3. **Customize** app icons and splash screens
4. **Optimize** for App Store submission
5. **Deploy** to TestFlight for beta testing

Your app maintains all existing functionality while adding native iOS capabilities!