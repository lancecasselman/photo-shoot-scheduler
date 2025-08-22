# Android Project Troubleshooting

## Build Issues

### 1. Missing cordova.variables.gradle
**Error:** `Could not read script 'cordova.variables.gradle' as it does not exist`

**Solution:** Run the automated fix script:
```bash
./scripts/fix-android-build.sh
```

### 2. Java Version Conflicts
**Error:** Java 21 vs Java 17 conflicts

**Solution:** All files are configured for Java 17. The fix script ensures consistency.

### 3. Repository Configuration
**Error:** `repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)`

**Solution:** Already fixed - using `PREFER_SETTINGS` mode.

## IDE Issues

### Android Studio Project Disposal Error
**Error:** `java.lang.IllegalStateException: Must not dispose default project`

**What it is:** Android Studio internal error when closing projects

**Impact:** None - purely cosmetic IDE issue

**Solutions:**
1. **Ignore it** - error doesn't affect builds or functionality
2. **Restart Android Studio** if IDE becomes unresponsive  
3. **File → Invalidate Caches and Restart** to clear IDE state
4. **Update Android Studio** to latest stable version

### Project Import Issues
If Android Studio has trouble importing the project:

1. **Close Android Studio completely**
2. **Delete `.idea` folder** in the android directory
3. **Run the fix script:** `./scripts/fix-android-build.sh`
4. **Reopen project** in Android Studio
5. **Let Gradle sync complete**

## Build Commands

### Clean Build
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### Capacitor Sync
```bash
npx cap sync android
```

### Complete Reset
```bash
rm -rf android
npx cap add android
./scripts/fix-android-build.sh
```

## Verification Checklist

- [ ] `cordova.variables.gradle` exists
- [ ] All files use Java 17
- [ ] Gradle sync succeeds
- [ ] 8 Capacitor plugins detected
- [ ] App builds without errors

## Getting Help

1. **Check logs** in Android Studio's Build tab
2. **Run with verbose:** `./gradlew assembleDebug --info`
3. **Verify file structure** matches the README guide
4. **Run the automated fix script** as first troubleshooting step

The project is configured for production deployment to Google Play Store with all modern Android development best practices.