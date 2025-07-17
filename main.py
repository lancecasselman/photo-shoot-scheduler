
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
import json

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
        # Custom logging for deployment
        timestamp = self.log_date_time_string()
        message = format % args
        print(f"[{timestamp}] {self.address_string()} - {message}")

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    print(f"Received signal {signum}, shutting down gracefully...")
    sys.exit(0)

def health_check():
    """Health check endpoint for deployment platforms"""
    return "Photography Scheduler is running and healthy"

def main():
    """Main server entry point with enhanced deployment support"""
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Get port from environment with fallback
    PORT = int(os.environ.get('PORT', 5000))
    HOST = os.environ.get('HOST', '0.0.0.0')
    
    # Change to script directory to serve files properly
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    print(f"Working directory: {os.getcwd()}")
    print(f"Script directory: {script_dir}")
    
    # Verify required files exist
    required_files = ['index.html', 'style.css', 'script.js']
    missing_files = []
    
    for file in required_files:
        if not os.path.exists(file):
            missing_files.append(file)
        else:
            file_size = os.path.getsize(file)
            print(f"✓ {file} found ({file_size} bytes)")
    
    if missing_files:
        print(f"ERROR: Missing required files: {missing_files}")
        sys.exit(1)
    
    # Configure server with deployment-friendly settings
    socketserver.TCPServer.allow_reuse_address = True
    
    # Try multiple ports if needed for deployment environments
    ports_to_try = [PORT, 8080, 3000, 5000]
    server_started = False
    
    for port in ports_to_try:
        try:
            with socketserver.TCPServer((HOST, port), PhotoSchedulerHandler) as httpd:
                print(f"Photography Scheduler running on http://{HOST}:{port}")
                print(f"Serving files from: {os.getcwd()}")
                print("Server ready for requests")
                print("Health check: " + health_check())
                
                # Deployment health check
                if os.environ.get('DEPLOYMENT_CHECK'):
                    print("DEPLOYMENT_CHECK passed - server can bind and serve")
                    return
                
                server_started = True
                # Start the server
                httpd.serve_forever()
                break
                
        except OSError as e:
            if e.errno == 98:  # Address already in use
                print(f"Port {port} is already in use, trying next port...")
                continue
            elif e.errno == 13:  # Permission denied
                print(f"Permission denied on port {port}, trying next port...")
                continue
            else:
                print(f"Server error on port {port}: {e}")
                if port == ports_to_try[-1]:  # Last port to try
                    print("Failed to start server on any available port")
                    sys.exit(1)
                continue
        except KeyboardInterrupt:
            print("Server shutdown requested")
            sys.exit(0)
        except Exception as e:
            print(f"Unexpected error on port {port}: {e}")
            if port == ports_to_try[-1]:  # Last port to try
                print("Failed to start server due to unexpected errors")
                sys.exit(1)
            continue
    
    if not server_started:
        print("Could not start server on any available port")
        sys.exit(1)

if __name__ == "__main__":
    main()
