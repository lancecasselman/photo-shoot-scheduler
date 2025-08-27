# Firebase Domain Authorization Issue

## Current Problem
Mobile Google OAuth fails with "Unable to verify that the app domain is authorized"

## Root Cause
The Replit domain `8b52078f-2876-41ad-b7b4-15cd08bb6e7e-00-26t6e4y6vz596.worf.replit.dev` needs to be added to Firebase Console's authorized domains.

## Fix Required in Firebase Console
1. Go to Firebase Console > Authentication > Settings > Authorized domains
2. Add the current Replit domain: `8b52078f-2876-41ad-b7b4-15cd08bb6e7e-00-26t6e4y6vz596.worf.replit.dev`
3. Also add the wildcard: `*.worf.replit.dev` for future domain changes

## Current Firebase Project Configuration
- Project ID: `photoshcheduleapp`
- Auth Domain: `photoshcheduleapp.firebaseapp.com`
- API Key: `AIzaSyDbtboh1bW6xu9Tz9FILkx_0lzGwXQHjyM`

## Status
Domain authorization must be done in Firebase Console by project admin.