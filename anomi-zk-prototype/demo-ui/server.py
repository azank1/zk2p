#!/usr/bin/env python3
"""
Simple HTTP server with cache-busting headers for development
"""
import http.server
import socketserver
from urllib.parse import urlparse

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add cache-busting headers
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # Custom log format
        print(f"{self.address_string()} - {format % args}")

if __name__ == '__main__':
    PORT = 8080
    HOST = '127.0.0.1'
    
    with socketserver.TCPServer((HOST, PORT), NoCacheHTTPRequestHandler) as httpd:
        print(f"Server running at http://{HOST}:{PORT}/")
        print("Cache-busting enabled - files will always be fresh")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")

