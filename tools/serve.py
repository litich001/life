"""Dev static server with no-cache headers."""
import functools
import http.server
import os

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


# Threading, not plain TCPServer. A single-threaded server handles one request
# at a time, so a client that opens a socket and walks away without closing it
# leaves the server blocked in recv() forever -- every later request then hangs
# until it times out, which looks exactly like the browser being broken.
# daemon_threads so Ctrl-C does not wait on a stuck connection.
class Server(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


with Server(('127.0.0.1', PORT), functools.partial(Handler, directory=ROOT)) as httpd:
    print('serving %s on %d' % (ROOT, PORT))
    httpd.serve_forever()