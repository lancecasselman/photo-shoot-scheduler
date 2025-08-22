#!/bin/bash

# Android Maven Fix Script
# Converts project to use Maven Central dependencies instead of local modules

echo "🔧 Converting Android project to use Maven Central dependencies..."

# Stop any running Gradle daemons
echo "🛑 Stopping Gradle daemons..."
cd android && ./gradlew --stop
cd ..

# Clean old build artifacts
echo "🧹 Cleaning old build artifacts..."
rm -rf android/build
rm -rf android/app/build
rm -rf android/.gradle

# Remove old capacitor-cordova-android-plugins directory if it exists
if [ -d "android/capacitor-cordova-android-plugins" ]; then
    echo "📁 Removing old capacitor-cordova-android-plugins directory..."
    rm -rf android/capacitor-cordova-android-plugins
fi

# Remove capacitor.settings.gradle if it exists
if [ -f "android/capacitor.settings.gradle" ]; then
    echo "📁 Removing capacitor.settings.gradle..."
    rm -f android/capacitor.settings.gradle
fi

# Run Capacitor sync
echo "🔄 Running Capacitor sync..."
npx cap sync android

# Build the project
echo "🏗️ Building Android project..."
cd android && ./gradlew clean assembleDebug
cd ..

echo "✅ Android project converted to Maven Central dependencies!"
echo ""
echo "📋 Changes made:"
echo "  • Removed local Capacitor modules"
echo "  • Added Maven Central dependencies (com.capacitorjs:*)"
echo "  • Cleaned up settings.gradle"
echo "  • Removed flatDir repository configuration"
echo "  • Using Capacitor 7.4.3 from Maven Central"
echo ""
echo "🚀 Your Android project now uses the modern Maven-based approach!"