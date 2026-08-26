#!/usr/bin/env python3
"""Start the local terrain and hydrology workbench and open the browser."""

from __future__ import annotations

import functools
import http.server
import socket
import socketserver
import threading
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ENTRY = "web/terrain-hydrology-workbench-v100/index.html"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        print(f"[HTTP] {format % args}")


def free_port(preferred: int = 8765) -> int:
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            probe.bind(("127.0.0.1", 0))
            return int(probe.getsockname()[1])


def main() -> None:
    port = free_port()
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    with socketserver.ThreadingTCPServer(("127.0.0.1", port), handler) as server:
        server.daemon_threads = True
        url = f"http://127.0.0.1:{port}/{ENTRY}"
        print("三地区真实地貌与水系工作台已启动")
        print(url)
        print("保持此窗口打开。结束时按 Ctrl+C。")
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n工作台已停止。")


if __name__ == "__main__":
    main()
