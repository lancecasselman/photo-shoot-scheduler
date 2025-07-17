#!/usr/bin/env python3
"""
Debug test for Photography Scheduler deployment
"""
import http.server
import socketserver
import os
import sys
import json
import urllib.request
import time

def test_server_setup():
    """Test basic server setup"""
    print("=== SERVER SETUP TEST ===")
    
    # Test 1: Import modules
    try:
        import http.server
        import socketserver
        print("✓ Required modules imported successfully")
    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False
    
    # Test 2: Check port availability
    PORT = int(os.environ.get('PORT', 5000))
    print(f"✓ Using port: {PORT}")
    
    # Test 3: Check file existence
    required_files = ['index.html', 'style.css', 'script.js']
    for file in required_files:
        if os.path.exists(file):
            print(f"✓ {file} exists")
        else:
            print(f"✗ {file} missing")
            return False
    
    # Test 4: Test server binding
    try:
        with socketserver.TCPServer(("0.0.0.0", PORT + 1), http.server.SimpleHTTPRequestHandler) as httpd:
            print(f"✓ Server can bind to port {PORT + 1}")
    except Exception as e:
        print(f"✗ Server binding error: {e}")
        return False
    
    return True

def test_file_content():
    """Test file content validity"""
    print("\n=== FILE CONTENT TEST ===")
    
    # Test index.html
    try:
        with open('index.html', 'r') as f:
            content = f.read()
            if '<!DOCTYPE html>' in content and 'Photography Session Scheduler' in content:
                print("✓ index.html content valid")
            else:
                print("✗ index.html content invalid")
                return False
    except Exception as e:
        print(f"✗ index.html read error: {e}")
        return False
    
    # Test script.js
    try:
        with open('script.js', 'r') as f:
            content = f.read()
            if 'sessionForm' in content and 'handleFormSubmit' in content:
                print("✓ script.js content valid")
            else:
                print("✗ script.js content invalid")
                return False
    except Exception as e:
        print(f"✗ script.js read error: {e}")
        return False
    
    return True

def test_deployment_config():
    """Test deployment configuration"""
    print("\n=== DEPLOYMENT CONFIG TEST ===")
    
    # Test environment variables
    port = os.environ.get('PORT', 'not set')
    print(f"PORT environment variable: {port}")
    
    # Test working directory
    print(f"Current working directory: {os.getcwd()}")
    
    # Test Python version
    print(f"Python version: {sys.version}")
    
    # Test file permissions
    for file in ['app.py', 'main.py', 'start.sh']:
        if os.path.exists(file):
            stat = os.stat(file)
            print(f"✓ {file} permissions: {oct(stat.st_mode)[-3:]}")
        else:
            print(f"- {file} not found")
    
    return True

def main():
    """Run all debug tests"""
    print("Photography Scheduler Debug Test")
    print("=" * 50)
    
    # Change to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    success = True
    success &= test_server_setup()
    success &= test_file_content()
    success &= test_deployment_config()
    
    print("\n" + "=" * 50)
    if success:
        print("✓ ALL TESTS PASSED - Application should deploy successfully")
    else:
        print("✗ SOME TESTS FAILED - Review errors above")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)