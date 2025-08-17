# macOS Xcode Setup Instructions

## Required Steps on macOS

Since this project was created in Replit (Linux environment), you'll need to complete the CocoaPods setup on your Mac to resolve the xcconfig file issues.

### 1. Install CocoaPods (if not already installed)
```bash
sudo gem install cocoapods
```

### 2. Navigate to iOS App Directory
```bash
cd /Users/johncasselman/Desktop/photo-shoot-scheduler/ios/App
```

### 3. Install Pods
```bash
pod install --repo-update
```

### 4. Always Open .xcworkspace (Not .xcodeproj)
```bash
# Open the workspace file, not the project file
open App.xcworkspace
```
**Important**: Always use `App.xcworkspace` instead of `App.xcodeproj` when working with CocoaPods.

### 5. Fix Script Phase Warning
In Xcode, after opening the workspace:

1. Select your project in the navigator
2. Select the **App** target
3. Go to **Build Phases** tab
4. Find the script phase `[CP] Embed Pods Frameworks`
5. Click on it and add these **Output Files**:
   ```
   $(BUILT_PRODUCTS_DIR)/$(FRAMEWORKS_FOLDER_PATH)/Capacitor.framework
   $(BUILT_PRODUCTS_DIR)/$(FRAMEWORKS_FOLDER_PATH)/CapacitorApp.framework
   $(BUILT_PRODUCTS_DIR)/$(FRAMEWORKS_FOLDER_PATH)/CapacitorCamera.framework
   $(BUILT_PRODUCTS_DIR)/$(FRAMEWORKS_FOLDER_PATH)/CapacitorCordova.framework
   $(BUILT_PRODUCTS_DIR)/$(FRAMEWORKS_FOLDER_PATH)/CapacitorDevice.framework
   $(BUILT_PRODUCTS_DIR)/$(FRAMEWORKS_FOLDER_PATH)/CapacitorKeyboard.framework
   $(BUILT_PRODUCTS_DIR)/$(FRAMEWORKS_FOLDER_PATH)/CapacitorNetwork.framework
   $(BUILT_PRODUCTS_DIR)/$(FRAMEWORKS_FOLDER_PATH)/CapacitorPushNotifications.framework
   $(BUILT_PRODUCTS_DIR)/$(FRAMEWORKS_FOLDER_PATH)/CapacitorSplashScreen.framework
   $(BUILT_PRODUCTS_DIR)/$(FRAMEWORKS_FOLDER_PATH)/CapacitorStatusBar.framework
   ```

### 6. Verify Bundle Identifier
Ensure your bundle identifier is set to:
```
com.thelegacyphotography.photomanager
```

### 7. Clean and Build
1. **Product** → **Clean Build Folder** (⌘+Shift+K)
2. **Product** → **Build** (⌘+B)

## Troubleshooting

### If Pod Install Fails
```bash
# Update CocoaPods
sudo gem update cocoapods

# Clean and retry
rm -rf Pods Podfile.lock
pod install --repo-update
```

### If Build Still Fails
1. Quit Xcode completely
2. Delete derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`
3. Run `pod install` again
4. Open `App.xcworkspace` (not `.xcodeproj`)
5. Clean build folder and rebuild

### Firebase Issues
If Firebase authentication doesn't work:
1. Verify `GoogleService-Info.plist` is in Xcode project
2. Check bundle identifier matches Firebase configuration
3. Ensure Firebase pods are properly installed

## Development Workflow

Once setup is complete:

1. **Always use**: `App.xcworkspace`
2. **Test on simulator** first
3. **Test on device** before App Store submission
4. **Archive for distribution** when ready for App Store

---

**Note**: These steps only need to be done once on each Mac development machine. The temporary xcconfig files created in Replit will be replaced by proper CocoaPods-generated files.