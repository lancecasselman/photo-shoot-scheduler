# Fix Git Push Issues - Step by Step

## Problem
- 356 commits ahead of origin/newmain
- Git LFS configured but git-lfs not available
- Large files causing push rejection

## Solution Steps

### Step 1: Remove Git LFS Configuration
```bash
# Remove the LFS pre-push hook that's blocking pushes
rm .git/hooks/pre-push

# Verify the hook is removed
ls -la .git/hooks/ | grep pre-push
```

### Step 2: Check for Large Files
```bash
# Find any remaining large files in the current commit
find . -size +50M -not -path "./.git/*" -exec ls -lh {} \;

# Check what's staged for commit
git status
```

### Step 3: Push to GitHub
```bash
# Try pushing now that LFS hook is removed
git push origin newmain

# If it still fails due to large files, you may need to:
# git reset --soft HEAD~1  # to unstage large files
# git reset HEAD <large-file>  # to unstage specific files
```

### Step 4: If Push Still Fails (Large Files in History)
```bash
# Use BFG to clean repository history
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
java -jar bfg-1.14.0.jar --strip-blobs-bigger-than 50M
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin newmain --force
```

## Why This Happened
- Git LFS was set up for .tif/.tiff files
- The git-lfs binary isn't available in this environment
- Your photos are now properly stored in Cloudflare R2
- Git LFS is no longer needed since large files go to cloud storage

## Prevention
- .gitignore now prevents large files from being committed
- All photo uploads go directly to Cloudflare R2
- Repository should stay under 100MB going forward