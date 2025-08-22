#!/bin/bash

# Post Capacitor Sync Fix Script
# Automatically fixes issues after running npx cap sync

echo "🔧 Running post-sync fixes..."

# Fix capacitor.build.gradle file
if [ -f "android/app/capacitor.build.gradle" ]; then
    echo "📝 Fixing capacitor.build.gradle..."
    
    # Fix Java version and remove problematic apply line
    sed -i.bak \
        -e 's/JavaVersion.VERSION_21/JavaVersion.VERSION_17/g' \
        -e '/apply from.*cordova\.variables\.gradle/d' \
        android/app/capacitor.build.gradle
    
    rm -f android/app/capacitor.build.gradle.bak
    echo "✅ Fixed Java version and removed cordova.variables.gradle reference"
fi

echo "🔍 Verification:"
echo "Java version in capacitor.build.gradle:"
grep -n "VERSION_" android/app/capacitor.build.gradle || echo "No Java version found"

echo "Cordova variables references:"
grep -n "cordova.variables" android/app/capacitor.build.gradle || echo "No cordova.variables references found ✅"

echo ""
echo "✅ Post-sync fixes completed!"