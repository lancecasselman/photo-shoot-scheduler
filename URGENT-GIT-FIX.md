# URGENT: Fix Git Push - Large File in History

## The Problem
The 260MB TIFF file `uploads/1754707011404-262014534-DSC_2827.tif` is stuck in your Git history and preventing pushes to GitHub.

## SOLUTION 1: Quick Fix (Recommended)
Since all your photos are now in Cloudflare R2, you can safely create a fresh repository:

```bash
# 1. Create a backup of your current work
cp -r . ../backup-photography-app

# 2. Create fresh Git repository (removes all history)
rm -rf .git
git init
git remote add origin https://github.com/lancecasselman/photo-shoot-scheduler

# 3. Add all current files (ignoring large files due to .gitignore)
git add .
git commit -m "Fresh start - all photos now in Cloudflare R2"

# 4. Push as new main branch
git push -u origin main --force
```

## SOLUTION 2: Clean Current Branch
If you want to keep Git history, use BFG Repo-Cleaner:

```bash
# Download BFG
curl -L -o bfg-1.14.0.jar https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0.jar

# Remove files larger than 50MB from entire history
java -jar bfg-1.14.0.jar --strip-blobs-bigger-than 50M

# Clean up Git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push clean history
git push origin newmain --force
```

## Why This Works
✅ Your photos are safely in Cloudflare R2  
✅ .gitignore prevents future large files  
✅ Fresh repo = no large files in history  
✅ Repository size drops from 2.4GB to ~50MB  

## What You Won't Lose
- All your source code
- All configuration files  
- All current functionality
- Your photos (they're in R2 cloud storage)

## Choose Solution 1 for fastest fix (5 minutes)
## Choose Solution 2 to preserve Git history (15+ minutes)

Both solutions will fix your sync timeout issues permanently.