# Git Repository Cleanup Instructions

Your Git repository has grown to 2.4GB, causing sync timeouts. Here's how to clean it up:

## Immediate Fix for GitHub Push Rejection

The current error is caused by a 260MB TIFF file that exceeds GitHub's 100MB limit. Run these commands in the Shell:

```bash
# Remove the large file from Git staging
git reset HEAD uploads/1754707011404-262014534-DSC_2827.tif

# Remove it from Git tracking completely
git rm --cached uploads/1754707011404-262014534-DSC_2827.tif

# Commit the removal
git commit -m "Remove large TIFF file - photos now stored in Cloudflare R2"

# Now you should be able to push
git push origin newmain
```

## Long-term Solution: Clean Git History

To reduce the 2.4GB repository size, you'll need to remove large files from Git history:

### Option 1: Use BFG Repo-Cleaner (Recommended)
```bash
# Download BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# Remove all files larger than 50MB from history
java -jar bfg-1.14.0.jar --strip-blobs-bigger-than 50M

# Clean up
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

### Option 2: Use Git Filter-Branch
```bash
# Remove all image files from history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch uploads/*.jpg uploads/*.jpeg uploads/*.png uploads/*.tif uploads/*.tiff' \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

## Prevention Measures Already Implemented

✅ `.gitignore` file created to prevent future large file commits
✅ All photos now properly stored in Cloudflare R2
✅ Upload system configured to use cloud storage

## Repository Size Targets

- **Current**: 2.4GB (too large)
- **Target**: Under 100MB
- **GitHub recommended**: Under 1GB
- **Replit works best**: Under 500MB

## What Files to Keep in Git

✅ **Keep**: Source code, configuration files, documentation
❌ **Remove**: Photos, videos, large assets, binaries

All your photos are safely stored in Cloudflare R2 and will not be affected by Git cleanup.