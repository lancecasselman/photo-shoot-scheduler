#!/usr/bin/env python3
"""
Health check for Photography Scheduler
"""
import urllib.request
import sys
import os

def check_health():
    port = int(os.environ.get('PORT', 5000))
    url = f'http://localhost:{port}/'
    
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            if response.status == 200:
                content = response.read().decode('utf-8')
                if 'Photography Session Scheduler' in content:
                    print("✓ Health check passed")
                    return True
                else:
                    print("✗ Health check failed: Wrong content")
                    return False
            else:
                print(f"✗ Health check failed: Status {response.status}")
                return False
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False

if __name__ == "__main__":
    success = check_health()
    sys.exit(0 if success else 1)