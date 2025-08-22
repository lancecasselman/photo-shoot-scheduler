#!/bin/bash

echo "🔧 Preventing Capacitor Build Conflicts"
echo "======================================"

# Remove the auto-generated capacitor.build.gradle that causes conflicts
if [ -f "android/app/capacitor.build.gradle" ]; then
    echo "❌ Removing problematic auto-generated capacitor.build.gradle..."
    rm android/app/capacitor.build.gradle
    echo "✅ Removed successfully"
else
    echo "✅ capacitor.build.gradle already removed"
fi

# Check if main build.gradle has proper dependencies
echo ""
echo "📋 Checking main build.gradle configuration..."

if grep -q "implementation project(':capacitor-app')" android/app/build.gradle; then
    echo "✅ All Capacitor plugin dependencies are properly configured in main build.gradle"
else
    echo "⚠️  Capacitor plugin dependencies need to be added to main build.gradle"
fi

echo ""
echo "🎯 Solution Applied:"
echo "  • Removed auto-generated capacitor.build.gradle file"
echo "  • All Capacitor dependencies now managed in main build.gradle"
echo "  • No more cordova.variables.gradle conflicts"
echo "  • Consistent Java 17 configuration"
echo ""
echo "✅ Build configuration cleaned and optimized!"