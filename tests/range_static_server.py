from __future__ import annotations

import argparse
import mimetypes
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


RANGE_PATTERN = re.compile(r"^bytes=(\d+)-(\d*)$")


class RangeRequestHandler(SimpleHTTPRequestHandler):
    server_version = "GuilinRangeStatic/1.0"

    def translate_path(self, path: str) -> str:
        root = Path(self.server.root).resolve()
        clean = unquote(urlsplit(path).path)
        relative = Path(clean.lstrip("/"))
        candidate = (root / relative).resolve()
        if root not in candidate.parents and candidate != root:
            return str(root / "__forbidden__")
        return str(candidate)

    def send_head(self):
        path = Path(self.translate_path(self.path))
        if path.is_dir():
            index = path / "index.html"
            if index.is_file():
                path = index
            else:
                return super().send_head()
        if not path.is_file():
            self.send_error(404, "File not found")
            return None
        file_size = path.stat().st_size
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        range_header = self.headers.get("Range")
        if range_header:
            match = RANGE_PATTERN.match(range_header.strip())
            if not match:
                self.send_error(416, "Unsupported byte range")
                return None
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else file_size - 1
            if start >= file_size or end < start:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{file_size}")
                self.end_headers()
                return None
            end = min(end, file_size - 1)
            handle = path.open("rb")
            handle.seek(start)
            self.send_response(206)
            self.send_header("Content-Type", content_type)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            self.send_header("Content-Length", str(end - start + 1))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.range_remaining = end - start + 1
            return handle
        handle = path.open("rb")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(file_size))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.range_remaining = None
        return handle

    def copyfile(self, source, outputfile) -> None:
        remaining = getattr(self, "range_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        while remaining > 0:
            chunk = source.read(min(1024 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

    def log_message(self, format: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    root = args.root.resolve()
    if not root.is_dir():
        raise SystemExit(f"root does not exist: {root}")
    server = ThreadingHTTPServer((args.host, args.port), RangeRequestHandler)
    server.root = str(root)
    print(f"serving {root} on http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
