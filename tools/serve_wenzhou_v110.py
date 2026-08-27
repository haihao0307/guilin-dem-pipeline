#!/usr/bin/env python3
from __future__ import annotations

import http.server
import os
import socket
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT_MIN = 18931
PORT_MAX = 19031


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".bin": "application/octet-stream",
        ".webp": "image/webp",
        ".json": "application/json; charset=utf-8",
    }

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt: str, *args: object) -> None:
        print("[小温]", fmt % args)


def free_port() -> int:
    for port in range(PORT_MIN, PORT_MAX + 1):
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("18931 至 19031 没有空闲端口")


def main() -> None:
    os.chdir(ROOT)
    port = free_port()
    url = f"http://127.0.0.1:{port}/web/wenzhou-v110/index.html?build=v110&t={time.time_ns()}"
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), NoStoreHandler)
    print("温州真实三维地图 V1.1")
    print("目录:", ROOT)
    print("端口:", port)
    print("地址:", url)
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
