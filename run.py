#!/usr/bin/env python3
"""
Simple HTTP server for Photography Scheduler static files
"""
import http.server
import socketserver
import os

PORT = 5000

# Change to the directory containing static files
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Set up server with proper headers
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

# Start server
with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Server running on http://0.0.0.0:{PORT}")
    httpd.serve_forever()