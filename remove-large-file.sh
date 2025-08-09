#!/bin/bash

# Script to remove the large TIFF file from Git history
# Run this in the Shell to fix the push issue

echo "🔍 Searching for the large TIFF file..."

# Check if file exists in current directory
if [ -f "uploads/1754707011404-262014534-DSC_2827.tif" ]; then
    echo "📁 Found file in uploads/ - removing..."
    rm -f uploads/1754707011404-262014534-DSC_2827.tif
    echo "✅ File removed from disk"
else
    echo "📂 File not found in current directory (good - it's only in Git history)"
fi

# Remove from Git tracking if it's staged
echo "🔧 Removing from Git staging area..."
git reset HEAD uploads/1754707011404-262014534-DSC_2827.tif 2>/dev/null || echo "File not staged"
git rm --cached uploads/1754707011404-262014534-DSC_2827.tif 2>/dev/null || echo "File not in index"

# Check current Git status
echo "📊 Current Git status:"
git status --porcelain

echo ""
echo "🚨 IMPORTANT: The file is still in Git HISTORY."
echo "To completely remove it, you need to clean Git history with:"
echo "1. BFG Repo-Cleaner (recommended)"
echo "2. Create a fresh repository (fastest)"
echo ""
echo "See URGENT-GIT-FIX.md for complete instructions."