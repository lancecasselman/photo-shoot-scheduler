# Direct iOS Installation Guide - Option 2

## Prerequisites
- Mac with Xcode installed
- iPhone/iPad with iOS 12.0 or later
- USB cable to connect device to Mac
- Apple ID (free) signed into Xcode

## Step-by-Step Installation

### 1. Connect Your Device
- Connect iPhone/iPad to Mac with USB cable
- Unlock your device and trust the computer if prompted
- Keep device connected throughout the process

### 2. Configure Xcode Signing
- In Xcode, select your project in the navigator
- Go to "Signing & Capabilities" tab
- Under "Team", select your Apple ID
- Xcode will automatically create a development certificate

### 3. Select Your Device
- In Xcode toolbar, click the device selector (next to play button)
- Choose your connected iPhone/iPad from the list
- You should see your device name appear

### 4. Build and Install
- Press `⌘ + R` (or click the play button)
- Xcode will build and install the app on your device
- The app will launch automatically

### 5. Trust the Developer (First Time Only)
- On your device, go to Settings → General → VPN & Device Management
- Find your Apple ID under "Developer App"
- Tap "Trust [Your Apple ID]"
- Confirm trust when prompted

### 6. Launch Your App
- Find "Photography Scheduler" on your home screen
- Tap to launch your native iOS app
- All features work including camera, notifications, contacts

## What You Get
- Native iOS app permanently installed on your device
- Full camera access for client photos
- Push notifications for session reminders
- Native contact integration (call, SMS, email)
- Offline functionality with data sync
- Professional photography business management

## Development Workflow
- Make changes to your web files (HTML, CSS, JS)
- Run `node build-capacitor.js` to sync changes
- Build and run in Xcode (⌘R) to update the app

## Troubleshooting
- **Device not appearing**: Ensure USB connection and device is unlocked
- **Build fails**: Check Apple ID is signed in to Xcode
- **App won't launch**: Trust the developer certificate in device settings
- **Features not working**: Ensure all permissions are granted in iOS Settings

Your app is now ready for professional use on your iOS device!