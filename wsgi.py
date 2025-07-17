#!/usr/bin/env python3
"""
WSGI entry point for Photography Scheduler
For production deployment compatibility
"""
import os
import sys
from wsgiref.simple_server import make_server
from wsgiref.util import FileWrapper
import mimetypes
import urllib.parse

class StaticFileWSGIApp:
    def __init__(self, root_dir='.'):
        self.root_dir = os.path.abspath(root_dir)
        
    def __call__(self, environ, start_response):
        path = environ['PATH_INFO']
        
        # Handle root path
        if path == '/':
            path = '/index.html'
        
        # Security check - prevent directory traversal
        if '..' in path:
            start_response('403 Forbidden', [('Content-Type', 'text/plain')])
            return [b'Forbidden']
            
        # Get file path
        file_path = os.path.join(self.root_dir, path.lstrip('/'))
        
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            start_response('404 Not Found', [('Content-Type', 'text/plain')])
            return [b'Not Found']
        
        # Get MIME type
        mime_type, _ = mimetypes.guess_type(file_path)
        if mime_type is None:
            mime_type = 'application/octet-stream'
            
        # Headers
        headers = [
            ('Content-Type', mime_type),
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Content-Type'),
        ]
        
        # File size for Content-Length
        file_size = os.path.getsize(file_path)
        headers.append(('Content-Length', str(file_size)))
        
        start_response('200 OK', headers)
        
        # Return file content
        with open(file_path, 'rb') as f:
            return FileWrapper(f)

# Create WSGI application
application = StaticFileWSGIApp()

def run_wsgi_server():
    """Run WSGI server for development"""
    PORT = int(os.environ.get('PORT', 5000))
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with make_server('0.0.0.0', PORT, application) as httpd:
        print(f"Photography Scheduler WSGI server running on http://0.0.0.0:{PORT}")
        httpd.serve_forever()

if __name__ == '__main__':
    run_wsgi_server()