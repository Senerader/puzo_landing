"""Local static preview, with the same asset layout as the production image."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
ALLOWED = {'/', '/index.html', '/styles.css', '/script.js', '/theme-init.js', '/robots.txt', '/sitemap.xml'}


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path not in ALLOWED and not path.startswith('/assets/'):
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        path = unquote(urlsplit(self.path).path)
        if path not in ALLOWED and not path.startswith('/assets/'):
            self.send_error(404)
            return
        super().do_HEAD()

    def translate_path(self, path):
        clean = unquote(urlsplit(path).path)
        base = PUBLIC if clean.startswith('/assets/') else ROOT
        candidate = (base / clean.lstrip('/')).resolve()
        if not candidate.is_relative_to(base.resolve()):
            return str(ROOT / '__not_found__')
        return str(candidate)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--host', default='127.0.0.1')
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f'Puzo Software preview: http://{args.host}:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
