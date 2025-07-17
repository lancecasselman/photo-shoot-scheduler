#!/usr/bin/env python3
"""
Photography Scheduler - Main Entry Point
Production-ready HTTP server for static file serving
"""
import http.server
import socketserver
import os
import sys
import signal
import threading
import time

class PhotoSchedulerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='.', **kwargs)
    
    def do_GET(self):
        # Handle root path and route to index.html
        if self.path == '/' or self.path == '':
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
    
    def log_message(self, format, *args):
        # Custom logging to ensure proper format
        sys.stderr.write("%s - - [%s] %s\n" %
                         (self.address_string(),
                          self.log_date_time_string(),
                          format % args))

def health_check():
    """Simple health check endpoint"""
    return "Photography Scheduler is running"

def main():
    """Main server entry point"""
    # Get port from environment or use default
    PORT = int(os.environ.get('PORT', 5000))
    
    # Change to script directory to serve files properly
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Ensure required files exist
    required_files = ['index.html', 'style.css', 'script.js']
    for file in required_files:
        if not os.path.exists(file):
            print(f"Error: Required file {file} not found")
            sys.exit(1)
    
    # Configure server
    socketserver.TCPServer.allow_reuse_address = True
    
    try:
        with socketserver.TCPServer(("0.0.0.0", PORT), PhotoSchedulerHandler) as httpd:
            print(f"Photography Scheduler running on http://0.0.0.0:{PORT}")
            print(f"Serving files from: {os.getcwd()}")
            print("Server ready for requests")
            
            # Start the server
            httpd.serve_forever()
            
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"Error: Port {PORT} is already in use")
            sys.exit(1)
        else:
            print(f"Server error: {e}")
            sys.exit(1)
    except KeyboardInterrupt:
        print("Server shutdown requested")
        sys.exit(0)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()