#!/usr/bin/env python3
from __future__ import annotations

import argparse
import http.server
import os
import socketserver
import time
from pathlib import Path

STRESS_HEADER = "X-R36-Stress"
OSM_FRAGMENT = "/site/dist/r3-5/data/osm/"


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _should_delay(self) -> bool:
        path = self.path.split("?", 1)[0]
        return (
            self.headers.get(STRESS_HEADER) == "1"
            and OSM_FRAGMENT in path
            and path.endswith(".u16le")
        )

    def do_GET(self) -> None:
        if self._should_delay():
            time.sleep(self.server.stress_delay_s)
        try:
            super().do_GET()
        except (BrokenPipeError, ConnectionResetError):
            print(f"CLIENT_ABORT GET {self.path}", flush=True)

    def do_HEAD(self) -> None:
        if self._should_delay():
            time.sleep(self.server.stress_delay_s)
        try:
            super().do_HEAD()
        except (BrokenPipeError, ConnectionResetError):
            print(f"CLIENT_ABORT HEAD {self.path}", flush=True)

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} - {fmt % args}", flush=True)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--directory", default=".")
    ap.add_argument("--stress-delay-ms", type=float, default=500.0)
    args = ap.parse_args()
    root = Path(args.directory).resolve()
    os.chdir(root)
    server = Server(("127.0.0.1", args.port), Handler)
    server.stress_delay_s = max(0.0, args.stress_delay_ms / 1000.0)
    print(
        f"R3.6 delayed test server root={root} port={args.port} "
        f"stress_delay_ms={args.stress_delay_ms}",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
