#!/usr/bin/env python3
"""
Simple Photography Scheduler Server
Minimal deployment-ready version
"""
import http.server
import socketserver
import os

PORT = int(os.environ.get('PORT', 5000))

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.path = '/index.html'
        return super().do_GET()

# Change to script directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Start server
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Server running on port {PORT}")
    httpd.serve_forever()