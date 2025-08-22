#!/bin/bash

# Fix Capacitor Build Gradle Script
# Fixes the auto-generated capacitor.build.gradle file issues

echo "🔧 Fixing capacitor.build.gradle file issues..."

# Function to fix the capacitor.build.gradle file
fix_capacitor_build_gradle() {
    local build_file="android/app/capacitor.build.gradle"
    
    if [ -f "$build_file" ]; then
        echo "📝 Fixing Java version and removing problematic lines..."
        
        # Create a temporary file with fixes
        sed -e 's/JavaVersion.VERSION_21/JavaVersion.VERSION_17/g' \
            -e '/apply from.*cordova\.variables\.gradle/d' \
            "$build_file" > "${build_file}.tmp"
        
        # Replace the original file
        mv "${build_file}.tmp" "$build_file"
        
        echo "✅ Fixed capacitor.build.gradle"
    else
        echo "⚠️  capacitor.build.gradle not found"
    fi
}

# Run Capacitor sync first
echo "🔄 Running Capacitor sync..."
npx cap sync android

# Fix the generated file
fix_capacitor_build_gradle

# Verify the fix
echo "🔍 Verifying fixes..."
if grep -q "VERSION_17" android/app/capacitor.build.gradle; then
    echo "✅ Java 17 version confirmed"
else
    echo "⚠️  Java version may need manual verification"
fi

if grep -q "cordova.variables.gradle" android/app/capacitor.build.gradle; then
    echo "⚠️  cordova.variables.gradle reference still exists - removing..."
    fix_capacitor_build_gradle
else
    echo "✅ No problematic cordova.variables.gradle reference"
fi

echo ""
echo "📋 Current capacitor.build.gradle content:"
cat android/app/capacitor.build.gradle

echo ""
echo "✅ Capacitor build file fixes completed!"