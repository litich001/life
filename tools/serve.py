"""Dev static server with no-cache headers."""
import functools
import http.server
import os
import socketserver

PORT = int(os.environ.get('PORT', '8021'))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Handler, directory=ROOT)) as httpd:
    print('serving %s on %d' % (ROOT, PORT))
    httpd.serve_forever()