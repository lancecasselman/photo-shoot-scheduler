# Android Release Keystore (One-Time)
Generate:
keytool -genkey -v -keystore photography-manager-release.keystore -alias photography-manager -keyalg RSA -keysize 2048 -validity 10000

Keep this file OUT of git. Back it up securely. Use it in Android Studio → Build → Generate Signed Bundle/APK → Android App Bundle (.aab).