#!/usr/bin/env python3
"""
Photography Scheduler - Deployment Entry Point
Bulletproof deployment configuration
"""
import http.server
import socketserver
import os
import sys
import signal
import atexit

class PhotoSchedulerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='.', **kwargs)
    
    def do_GET(self):
        # Handle root path
        if self.path == '/':
            self.path = '/index.html'
        return super().do_GET()
    
    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def end_headers(self):
        # Add CORS headers to all responses
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def cleanup_handler(signum, frame):
    """Handle graceful shutdown"""
    print("Shutting down server...")
    sys.exit(0)

def main():
    # Get port from environment or use default
    PORT = int(os.environ.get('PORT', 5000))
    
    # Change to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, cleanup_handler)
    signal.signal(signal.SIGINT, cleanup_handler)
    
    # Configure server
    socketserver.TCPServer.allow_reuse_address = True
    
    try:
        with socketserver.TCPServer(("0.0.0.0", PORT), PhotoSchedulerHandler) as httpd:
            print(f"Photography Scheduler deployed on http://0.0.0.0:{PORT}")
            print(f"Serving directory: {os.getcwd()}")
            print("Ready for production deployment")
            
            # Register cleanup
            atexit.register(lambda: print("Server stopped"))
            
            httpd.serve_forever()
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"Port {PORT} is already in use. Trying alternative port...")
            PORT = PORT + 1
            with socketserver.TCPServer(("0.0.0.0", PORT), PhotoSchedulerHandler) as httpd:
                print(f"Photography Scheduler deployed on http://0.0.0.0:{PORT}")
                httpd.serve_forever()
        else:
            print(f"Server error: {e}")
            sys.exit(1)
    except Exception as e:
        print(f"Deployment error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()