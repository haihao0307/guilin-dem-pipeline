from __future__ import annotations

import argparse
import json
import shutil
import socket
import subprocess
import time
from pathlib import Path

import requests
import websocket


class CDP:
    def __init__(self, url: str):
        self.ws = websocket.create_connection(url, timeout=30, origin="http://127.0.0.1")
        self.counter = 0

    def close(self) -> None:
        self.ws.close()

    def command(self, method: str, params: dict | None = None, timeout: float = 120) -> dict:
        self.counter += 1
        request_id = self.counter
        self.ws.settimeout(timeout)
        self.ws.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            payload = json.loads(self.ws.recv())
            if payload.get("id") == request_id:
                if "error" in payload:
                    raise RuntimeError(f"{method}: {payload['error']}")
                return payload.get("result", {})
        raise TimeoutError(method)

    def evaluate(self, expression: str, await_promise: bool = False, timeout: float = 120):
        result = self.command(
            "Runtime.evaluate",
            {
                "expression": expression,
                "returnByValue": True,
                "awaitPromise": await_promise,
                "userGesture": True,
            },
            timeout,
        )
        remote = result.get("result", {})
        if remote.get("subtype") == "error":
            raise RuntimeError(remote.get("description", "Runtime error"))
        return remote.get("value")


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_json(url: str, timeout: float = 45) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            response = requests.get(url, timeout=3)
            if response.ok:
                return response.json()
        except requests.RequestException:
            pass
        time.sleep(0.2)
    raise TimeoutError(url)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--page-url", required=True)
    parser.add_argument("--asset-url", required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument(
        "--chromium",
        default=(
            shutil.which("google-chrome")
            or shutil.which("google-chrome-stable")
            or shutil.which("chromium")
            or shutil.which("chromium-browser")
        ),
    )
    args = parser.parse_args()
    if not args.chromium:
        raise SystemExit("Chromium not found")
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    port = free_port()
    profile = args.receipt.parent / "cors-chrome-profile"
    process = subprocess.Popen(
        [
            args.chromium,
            "--headless=new",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-background-networking",
            "--remote-allow-origins=*",
            f"--remote-debugging-port={port}",
            f"--user-data-dir={profile}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    cdp = None
    try:
        wait_json(f"http://127.0.0.1:{port}/json/version")
        target = requests.put(f"http://127.0.0.1:{port}/json/new?about:blank", timeout=10).json()
        cdp = CDP(target["webSocketDebuggerUrl"])
        cdp.command("Page.enable")
        cdp.command("Runtime.enable")
        cdp.command("Page.navigate", {"url": args.page_url})
        time.sleep(1)
        expression = f"""
        (async () => {{
          try {{
            const response = await fetch({json.dumps(args.asset_url)}, {{
              cache: 'no-store',
              headers: {{ Range: 'bytes=0-1023' }},
            }});
            const buffer = await response.arrayBuffer();
            return {{
              ok: response.ok,
              status: response.status,
              bytes: buffer.byteLength,
              responseType: response.type,
              finalUrl: response.url,
              contentRange: response.headers.get('content-range'),
              acceptRanges: response.headers.get('accept-ranges'),
            }};
          }} catch (error) {{
            return {{ok:false,error:String(error && (error.stack || error.message || error))}};
          }}
        }})()
        """
        result = cdp.evaluate(expression, await_promise=True, timeout=180)
        passed = bool(
            isinstance(result, dict)
            and result.get("ok") is True
            and result.get("status") == 206
            and result.get("bytes") == 1024
        )
        receipt = {
            "schema": "guilin-canonical-release-browser-range-cors/v1",
            "passed": passed,
            "page_url": args.page_url,
            "asset_url": args.asset_url,
            "result": result,
        }
        args.receipt.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(receipt, ensure_ascii=False, indent=2))
        if not passed:
            raise SystemExit(1)
    finally:
        if cdp:
            cdp.close()
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
        shutil.rmtree(profile, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
