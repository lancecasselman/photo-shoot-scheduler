#!/usr/bin/env python3
"""
Photography Scheduler Web Application
Simple HTTP server for serving static files
"""
import http.server
import socketserver
import os
import sys

# Get port from environment variable or use default
PORT = int(os.environ.get('PORT', 5000))

class PhotoSchedulerHandler(http.server.SimpleHTTPRequestHandler):
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

def main():
    # Change to the directory containing static files
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Create server
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("0.0.0.0", PORT), PhotoSchedulerHandler) as httpd:
        print(f"Photography Scheduler running on http://0.0.0.0:{PORT}")
        print(f"Serving files from: {os.getcwd()}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Server stopped")
            sys.exit(0)

if __name__ == "__main__":
    main()