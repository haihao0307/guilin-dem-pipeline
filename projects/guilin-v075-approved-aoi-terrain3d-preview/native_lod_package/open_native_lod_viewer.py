from __future__ import annotations

import http.server
import os
import socket
import socketserver
import threading
import webbrowser
from pathlib import Path


def choose_port(start: int = 8765, end: int = 8795) -> int:
    for port in range(start, end + 1):
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise RuntimeError("找不到可用的本地端口")


def main() -> None:
    root = Path(__file__).resolve().parent / "site"
    if not (root / "index.html").is_file():
        raise SystemExit(f"缺少网页目录：{root}")
    os.chdir(root)
    port = choose_port()
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.ThreadingTCPServer(("127.0.0.1", port), handler) as server:
        server.daemon_threads = True
        url = f"http://127.0.0.1:{port}/?anchor=guilin"
        print("桂林 V0.7.7 原生 LOD 检查页已启动")
        print(url)
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
