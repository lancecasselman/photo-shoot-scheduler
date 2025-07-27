#!/usr/bin/env python3
"""
Deployment Verification Script for Custom Domain
Tests authentication and functionality on photomanagementsystem.com
"""

import requests
import json

def test_custom_domain():
    base_url = "https://photomanagementsystem.com"
    
    print("🔍 Testing Custom Domain Deployment")
    print(f"Domain: {base_url}")
    print("-" * 50)
    
    # Test 1: Landing page
    try:
        response = requests.get(f"{base_url}/")
        print(f"✅ Landing page: {response.status_code}")
        if "Launch App" in response.text:
            print("   - Launch App button found")
    except Exception as e:
        print(f"❌ Landing page: {e}")
    
    # Test 2: Authentication page  
    try:
        response = requests.get(f"{base_url}/auth.html")
        print(f"✅ Auth page: {response.status_code}")
        if "Firebase" in response.text:
            print("   - Firebase authentication loaded")
    except Exception as e:
        print(f"❌ Auth page: {e}")
    
    # Test 3: API Status
    try:
        response = requests.get(f"{base_url}/api/status")
        status = response.json()
        print(f"✅ API Status: {response.status_code}")
        print(f"   - Authentication: {status.get('authenticationEnabled')}")
        print(f"   - Firebase: {status.get('firebaseInitialized')}")
        print(f"   - Database: {status.get('databaseConnected')}")
    except Exception as e:
        print(f"❌ API Status: {e}")
    
    # Test 4: Main App (should redirect to auth)
    try:
        response = requests.get(f"{base_url}/app", allow_redirects=False)
        print(f"✅ Main App: {response.status_code}")
        if response.status_code == 302:
            redirect_location = response.headers.get('location', '')
            if 'auth.html' in redirect_location:
                print("   - Correctly redirects to authentication")
            else:
                print(f"   - Redirects to: {redirect_location}")
        elif response.status_code == 200:
            print("   - ⚠️ No authentication required (unexpected)")
    except Exception as e:
        print(f"❌ Main App: {e}")
    
    print("-" * 50)
    print("🔧 Firebase Configuration Check")
    
    # Check if Firebase domain is authorized
    firebase_errors = [
        "auth/unauthorized-domain",
        "This domain is not authorized",
        "domain is not authorized"
    ]
    
    try:
        response = requests.get(f"{base_url}/auth.html")
        content = response.text.lower()
        
        has_firebase_error = any(error.lower() in content for error in firebase_errors)
        
        if has_firebase_error:
            print("❌ Firebase domain authorization issue detected")
            print("   Required: Add photomanagementsystem.com to Firebase Console")
            print("   Path: Authentication → Settings → Authorized domains")
        else:
            print("✅ No Firebase domain errors detected")
            
    except Exception as e:
        print(f"❌ Firebase check failed: {e}")
    
    print("-" * 50)
    print("📋 Next Steps:")
    print("1. Add photomanagementsystem.com to Firebase authorized domains")
    print("2. Update Google OAuth settings with custom domain")
    print("3. Test authentication flow after Firebase configuration")

if __name__ == "__main__":
    test_custom_domain()