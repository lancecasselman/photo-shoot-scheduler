#!/usr/bin/env python3
"""
Complete deployment verification for Photography Scheduler
"""
import urllib.request
import json
import os
import sys

def verify_deployment():
    """Comprehensive deployment verification"""
    print("=== DEPLOYMENT VERIFICATION ===")
    
    port = int(os.environ.get('PORT', 5000))
    base_url = f'http://localhost:{port}'
    
    tests = [
        ('Root endpoint', f'{base_url}/'),
        ('CSS file', f'{base_url}/style.css'),
        ('JavaScript file', f'{base_url}/script.js'),
        ('Health check', f'{base_url}/'),
    ]
    
    results = []
    
    for test_name, url in tests:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if response.status == 200:
                    content = response.read().decode('utf-8')
                    content_size = len(content)
                    
                    # Specific checks
                    if test_name == 'Root endpoint':
                        success = 'Photography Session Scheduler' in content
                    elif test_name == 'CSS file':
                        success = 'margin: 0' in content and 'padding: 0' in content
                    elif test_name == 'JavaScript file':
                        success = 'sessionForm' in content and 'handleFormSubmit' in content
                    elif test_name == 'Health check':
                        success = 'Photography Session Scheduler' in content
                    else:
                        success = True
                    
                    if success:
                        print(f"✓ {test_name}: OK ({content_size} bytes)")
                        results.append(True)
                    else:
                        print(f"✗ {test_name}: Content check failed")
                        results.append(False)
                else:
                    print(f"✗ {test_name}: HTTP {response.status}")
                    results.append(False)
        except Exception as e:
            print(f"✗ {test_name}: {e}")
            results.append(False)
    
    # Test OPTIONS request
    try:
        req = urllib.request.Request(base_url, method='OPTIONS')
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                print("✓ OPTIONS request: OK")
                results.append(True)
            else:
                print(f"✗ OPTIONS request: HTTP {response.status}")
                results.append(False)
    except Exception as e:
        print(f"✗ OPTIONS request: {e}")
        results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n=== RESULTS ===")
    print(f"Success rate: {success_rate:.1f}% ({sum(results)}/{len(results)})")
    
    if success_rate == 100:
        print("🎉 DEPLOYMENT READY FOR PRODUCTION!")
        return True
    else:
        print("❌ DEPLOYMENT ISSUES DETECTED")
        return False

if __name__ == "__main__":
    success = verify_deployment()
    sys.exit(0 if success else 1)