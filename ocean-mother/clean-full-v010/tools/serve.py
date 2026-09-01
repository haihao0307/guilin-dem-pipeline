#!/usr/bin/env python3
"""Local-only static server. No installation, remote API, or asset downloads."""
from __future__ import annotations
import sys
sys.dont_write_bytecode = True
import argparse
import functools
import http.server
import json
import threading
import webbrowser
from pathlib import Path
from verify import check

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('port must be 0..65535')
    root = Path(__file__).resolve().parents[1]
    report = check(root)
    if report['status'] != 'PACKAGE_INTEGRITY_PASS':
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1
    class Handler(http.server.SimpleHTTPRequestHandler):
        extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                          '.js':'text/javascript', '.cjs':'text/javascript',
                          '.glsl':'text/plain', '.frag':'text/plain', '.vert':'text/plain'}
        def end_headers(self):
            self.send_header('Cache-Control','no-cache')
            super().end_headers()
    handler = functools.partial(Handler, directory=str(root))
    try:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError:
        if args.port == 0:
            raise
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    url = f'http://127.0.0.1:{server.server_port}/workbench/'
    print('Ocean Mother local workbench', flush=True)
    print(url, flush=True)
    print('Keep this window open. Press Ctrl+C to stop.', flush=True)
    if not args.no_browser:
        opener = threading.Timer(0.4, lambda: webbrowser.open(url))
        opener.daemon = True
        opener.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
