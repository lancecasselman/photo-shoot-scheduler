# iOS Configuration & Xcode Deployment Guide

## ✅ Current iOS Configuration Status

### **Firebase Configuration Updated:**
- ✅ Real API Key: `AIzaSyChc_dG-N5V0M87SkVTZM7mgj2lFjr95k4`
- ✅ Updated Storage Bucket: `photoshcheduleapp.firebasestorage.app`
- ✅ Project ID: `photoshcheduleapp`
- ✅ Bundle ID: `com.thelegacyphotography.photomanager`

### **App Configuration:**
- ✅ App Name: "Photography Manager"
- ✅ Bundle Identifier: `com.thelegacyphotography.photomanager`
- ✅ All Capacitor plugins configured (8 plugins)
- ✅ Camera, Photos, Location permissions set
- ✅ Firebase URL schemes configured

## 🚨 IMPORTANT: Firebase iOS App Registration Required

**You need to register an iOS app in your Firebase project:**

### Step 1: Add iOS App to Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/project/photoshcheduleapp)
2. Click "Add app" and select iOS
3. Enter Bundle ID: `com.thelegacyphotography.photomanager`
4. Enter App nickname: `Photography Manager iOS`
5. Download the new `GoogleService-Info.plist` file
6. Replace the current iOS configuration with the new file

### Step 2: Current iOS Firebase Configuration
The iOS app is currently using these placeholder OAuth client IDs that need to be updated:
- **CLIENT_ID**: `1080892259604-e4c3vfml2fspj7hf8h9bn0n0k5qs5q1q.apps.googleusercontent.com`
- **REVERSED_CLIENT_ID**: `com.googleusercontent.apps.1080892259604-e4c3vfml2fspj7hf8h9bn0n0k5qs5q1q`

## 🏗️ Local iOS Development Setup

### Requirements:
- **macOS** (iOS development requires macOS)
- **Xcode** (latest version from App Store)
- **Apple Developer Account** (for device testing and App Store)
- **CocoaPods** (`sudo gem install cocoapods`)

### Step 1: Copy Project to macOS
```bash
# Copy entire project to your Mac
# Ensure all files transfer correctly
```

### Step 2: Install Dependencies
```bash
# In project directory on Mac
npm install

# Install iOS pods
cd ios/App
pod install
cd ../..
```

### Step 3: Sync Capacitor
```bash
npx cap sync ios
```

### Step 4: Open in Xcode
```bash
npx cap open ios
```

### Step 5: Configure Xcode Project
1. **Select your team** in Project Settings > Signing & Capabilities
2. **Update Bundle Identifier** if needed: `com.thelegacyphotography.photomanager`
3. **Add GoogleService-Info.plist** to the project (drag & drop into Xcode)
4. **Verify Info.plist** permissions are set correctly

## 📱 iOS App Features Configured

### **Camera & Media:**
- Camera access for photo capture
- Photo library access for portfolio management
- Photo library write access for saving images
- Microphone access for video features

### **Firebase Integration:**
- Authentication (Google Sign-In ready)
- Firestore database access
- Firebase Storage for file uploads
- Real-time data synchronization

### **Native iOS Features:**
- Push notifications configured
- Status bar styling (light content)
- Splash screen setup
- Keyboard handling
- Device orientation support (portrait + landscape)

### **Network & Security:**
- HTTPS scheme configured
- Firebase domains whitelisted
- Replit development server access
- SSL/TLS security configured

## 🚀 Deployment Process

### **For Development Testing:**
1. Connect iPhone/iPad to Mac
2. Select your device in Xcode
3. Click "Run" to install on device
4. Trust developer certificate in Settings

### **For App Store Deployment:**
1. **Apple Developer Account** required ($99/year)
2. **App Store Connect** setup
3. **Production certificates** and provisioning profiles
4. **App Store Review** process
5. **TestFlight** for beta testing

## 🔑 Current iOS Capabilities

### **Photography Features:**
- ✅ Native camera integration
- ✅ Photo gallery management
- ✅ File upload to cloud storage
- ✅ Real-time client galleries
- ✅ Session management
- ✅ Portfolio publishing

### **Business Features:**
- ✅ User authentication
- ✅ Subscription management
- ✅ Payment processing (Stripe)
- ✅ Client communication
- ✅ Invoice generation
- ✅ Contract signing

### **Technical Stack:**
- ✅ Capacitor 7.0.2 for native bridge
- ✅ Firebase integration
- ✅ PostgreSQL backend
- ✅ Cloudflare R2 storage
- ✅ Real-time synchronization

## ⚠️ Next Steps Required

### **Immediate (for proper iOS functionality):**
1. **Register iOS app in Firebase Console**
2. **Download new GoogleService-Info.plist**
3. **Replace current iOS Firebase config**

### **For Local Development:**
1. **Copy project to macOS machine**
2. **Install Xcode and dependencies**
3. **Configure Apple Developer account**
4. **Test on physical iOS device**

### **For App Store:**
1. **Apple Developer Program enrollment**
2. **App Store Connect configuration**
3. **Production build and submission**

Your iOS app is fully configured and ready for development once you complete the Firebase iOS app registration and have access to a macOS development environment.