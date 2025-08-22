#!/bin/bash
# This script fixes the capacitor.build.gradle after sync

echo "Fixing capacitor.build.gradle..."

# Fix the cordova.variables.gradle apply
sed -i 's/^apply from: "..\/capacitor-cordova-android-plugins\/cordova.variables.gradle"/\/\/ Conditionally apply cordova.variables.gradle if it exists\ndef cordovaVars = file("..\/capacitor-cordova-android-plugins\/cordova.variables.gradle")\nif (cordovaVars.exists()) {\n    apply from: cordovaVars\n}/' app/capacitor.build.gradle

# Remove local project dependencies (they're now Maven deps in app/build.gradle)
sed -i '/implementation project(.*capacitor-/d' app/capacitor.build.gradle

echo "capacitor.build.gradle fixed!"