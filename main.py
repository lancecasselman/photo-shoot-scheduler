#!/usr/bin/env python3
"""
Main entry point for Photography Scheduler deployment
"""
import http.server
import socketserver
import os
from functools import partial

# Get port from environment variable or use default
PORT = int(os.environ.get('PORT', 5000))

# Change to the directory containing static files
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Custom handler for better static file serving
class StaticFileHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='.', **kwargs)
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_GET(self):
        # Handle root path by serving index.html
        if self.path == '/':
            self.path = '/index.html'
        return super().do_GET()

def run_server():
    """Run the HTTP server"""
    # Enable address reuse to avoid deployment issues
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("0.0.0.0", PORT), StaticFileHandler) as httpd:
        print(f"Photography Scheduler server running on http://0.0.0.0:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    run_server()