# Fix Android Studio Project with Maven Dependencies

## Modern Solution (Recommended)

Instead of copying local Capacitor files, we've converted the project to use Maven Central dependencies. This eliminates the `cordova.variables.gradle` error completely.

### Method 1: Update Your Local android/app/build.gradle

Replace the dependencies section in your local `android/app/build.gradle` file:

**Remove these problematic lines:**
```gradle
repositories {
    flatDir{
        dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs'
    }
}

// Remove these project dependencies:
implementation project(':capacitor-android')
implementation project(':capacitor-cordova-android-plugins')

// Remove this line:
apply from: 'capacitor.build.gradle'
```

**Replace with Maven Central dependencies:**
```gradle
dependencies {
    implementation fileTree(include: ['*.jar'], dir: 'libs')
    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
    implementation "androidx.coordinatorlayout:coordinatorlayout:$androidxCoordinatorLayoutVersion"
    implementation "androidx.core:core-splashscreen:$coreSplashScreenVersion"
    
    // Capacitor dependencies using Maven Central
    def CAP_VER = "7.4.3"  // match @capacitor/* in package.json
    implementation "com.capacitorjs:core:$CAP_VER"
    implementation "com.capacitorjs:app:$CAP_VER"
    implementation "com.capacitorjs:camera:$CAP_VER"
    implementation "com.capacitorjs:device:$CAP_VER"
    implementation "com.capacitorjs:keyboard:$CAP_VER"
    implementation "com.capacitorjs:network:$CAP_VER"
    implementation "com.capacitorjs:push-notifications:$CAP_VER"
    implementation "com.capacitorjs:splash-screen:$CAP_VER"
    implementation "com.capacitorjs:status-bar:$CAP_VER"
    
    testImplementation "junit:junit:$junitVersion"
    androidTestImplementation "androidx.test.ext:junit:$androidxJunitVersion"
    androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"
}
```

### Method 2: Update Your Local android/settings.gradle

Clean up your `android/settings.gradle` file:

**Remove these lines:**
```gradle
include ':capacitor-cordova-android-plugins'
project(':capacitor-cordova-android-plugins').projectDir = new File('./capacitor-cordova-android-plugins/')
apply from: 'capacitor.settings.gradle'
```

**Keep only:**
```gradle
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "Photography Manager"
include ':app'
```

### Method 3: Complete Project Sync

1. **Download the entire `android` folder** from this Replit environment
2. **Replace your local `android` folder** with the fixed version
3. **Run Capacitor sync** in your local project

### After Applying the Fix

1. **Sync Project with Gradle Files** in Android Studio
2. **Clean and Rebuild** your project
3. The error should be resolved

## Why This Happened

Capacitor generates these files dynamically, but your local Android Studio project was missing them. The files in this Replit environment are properly configured with:

- Java 17 consistency
- All required Capacitor plugin dependencies
- Proper Gradle configuration
- Failsafe file generation

Your local project will now build successfully!