# Android App Signing Setup

## Generate Production Keystore

Run this command to create your production signing key:

```bash
keytool -genkey -v -keystore photography-manager-release.keystore -alias photography-manager -keyalg RSA -keysize 2048 -validity 10000
```

## Required Information:
- **Keystore Password**: Choose a strong password (store securely)
- **Key Alias**: photography-manager
- **Key Password**: Can be same as keystore password
- **First and Last Name**: The Legacy Photography
- **Organizational Unit**: Photography Services
- **Organization**: The Legacy Photography
- **City**: Your city
- **State**: Your state
- **Country Code**: US (or your country)

## Security Notes:
1. **NEVER lose this keystore file** - you cannot update your app without it
2. **Store passwords securely** - consider using a password manager
3. **Backup the keystore** - keep multiple copies in secure locations
4. **Do not commit to version control** - keep keystore files private

## Build Configuration:
After creating the keystore, update capacitor.config.ts:

```typescript
android: {
  buildOptions: {
    keystorePath: './android/photography-manager-release.keystore',
    keystoreAlias: 'photography-manager',
    keystoreAliasPassword: 'YOUR_KEY_PASSWORD',
    keystorePassword: 'YOUR_KEYSTORE_PASSWORD'
  }
}
```

## Production Build Commands:
```bash
# Clean and sync
npx cap clean android
npx cap sync android

# Open Android Studio for release build
npx cap open android
```

In Android Studio:
1. Build → Generate Signed Bundle/APK
2. Select "Android App Bundle"
3. Choose your keystore file
4. Enter passwords
5. Select "release" build variant
6. Build bundle for Play Store upload