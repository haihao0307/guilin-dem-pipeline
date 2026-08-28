from __future__ import annotations

import argparse
import base64
import json
import shutil
import socket
import subprocess
import time
from pathlib import Path

import requests
import websocket


class CDP:
    def __init__(self, ws_url: str):
        self.ws = websocket.create_connection(ws_url, timeout=20, origin="http://127.0.0.1")
        self.counter = 0
        self.events: list[dict] = []

    def close(self) -> None:
        self.ws.close()

    def command(self, method: str, params: dict | None = None, timeout: float = 30) -> dict:
        self.counter += 1
        message_id = self.counter
        self.ws.send(json.dumps({"id": message_id, "method": method, "params": params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            payload = json.loads(self.ws.recv())
            if payload.get("id") == message_id:
                if "error" in payload:
                    raise RuntimeError(f"CDP {method} failed: {payload['error']}")
                return payload.get("result", {})
            self.events.append(payload)
        raise TimeoutError(f"CDP command timed out: {method}")

    def evaluate(self, expression: str, *, await_promise: bool = False) -> object:
        result = self.command(
            "Runtime.evaluate",
            {
                "expression": expression,
                "returnByValue": True,
                "awaitPromise": await_promise,
                "userGesture": True,
            },
        )
        remote = result.get("result", {})
        if remote.get("subtype") == "error":
            raise RuntimeError(remote.get("description", "Runtime evaluation failed"))
        return remote.get("value")


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_json(url: str, timeout: float = 30) -> dict:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            response = requests.get(url, timeout=2)
            if response.ok:
                return response.json()
        except Exception as error:
            last_error = error
        time.sleep(0.15)
    raise TimeoutError(f"Timed out waiting for {url}: {last_error}")


def wait_for_qa(cdp: CDP, timeout: float) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        value = cdp.evaluate("window.__GUILIN_V075_QA__ || null")
        if isinstance(value, dict):
            return value
        time.sleep(0.12)
    body = cdp.evaluate("document.body ? document.body.innerText.slice(0, 3000) : 'no body'")
    raise TimeoutError(f"QA result did not appear. Body: {body}")


def capture(cdp: CDP, path: Path) -> None:
    result = cdp.command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}, timeout=60)
    path.write_bytes(base64.b64decode(result["data"]))


def collect_cdp_errors(events: list[dict]) -> list[dict]:
    errors: list[dict] = []
    ignored_fragments = (
        "favicon.ico",
        "Failed to load resource: the server responded with a status of 404",
    )
    for event in events:
        method = event.get("method")
        params = event.get("params", {})
        text = ""
        if method == "Runtime.exceptionThrown":
            details = params.get("exceptionDetails", {})
            text = details.get("text", "exception")
        elif method == "Log.entryAdded":
            entry = params.get("entry", {})
            if entry.get("level") == "error":
                text = entry.get("text", "log error")
        elif method == "Runtime.consoleAPICalled" and params.get("type") == "error":
            text = " ".join(str(arg.get("value", arg.get("description", ""))) for arg in params.get("args", []))
        if text and not any(fragment in text for fragment in ignored_fragments):
            errors.append({"type": method, "text": text})
    return errors


def webgl_receipt(cdp: CDP) -> dict:
    value = cdp.evaluate(
        """
        (() => {
          const canvas = document.getElementById('terrainCanvas');
          const gl = canvas && canvas.getContext('webgl2');
          if (!gl) return { available: false };
          const debug = gl.getExtension('WEBGL_debug_renderer_info');
          return {
            available: true,
            version: gl.getParameter(gl.VERSION),
            shading_language: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
          };
        })()
        """
    )
    return value if isinstance(value, dict) else {"available": False}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--chromium", default=shutil.which("chromium") or shutil.which("google-chrome"))
    parser.add_argument("--qa-timeout", type=float, default=180)
    args = parser.parse_args()
    if not args.chromium:
        raise SystemExit("Chromium executable not found")
    args.evidence_dir.mkdir(parents=True, exist_ok=True)
    port = free_port()
    profile = args.evidence_dir / "chromium-profile"
    if profile.exists():
        shutil.rmtree(profile)
    stderr_path = args.evidence_dir / "chromium-cdp-stderr.log"
    command = [
        args.chromium,
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-first-run",
        "--hide-scrollbars",
        "--ignore-gpu-blocklist",
        "--enable-webgl",
        "--enable-unsafe-swiftshader",
        "--use-gl=angle",
        "--use-angle=swiftshader-webgl",
        "--disable-vulkan",
        "--remote-allow-origins=*",
        "--remote-debugging-address=127.0.0.1",
        f"--remote-debugging-port={port}",
        f"--user-data-dir={profile}",
        "about:blank",
    ]
    with stderr_path.open("wb") as stderr:
        process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=stderr)
    cdp: CDP | None = None
    try:
        wait_json(f"http://127.0.0.1:{port}/json/version")
        target = requests.put(f"http://127.0.0.1:{port}/json/new?about:blank", timeout=5).json()
        cdp = CDP(target["webSocketDebuggerUrl"])
        for method in ("Page.enable", "Runtime.enable", "Log.enable", "Network.enable"):
            cdp.command(method)
        cdp.command(
            "Emulation.setDeviceMetricsOverride",
            {"width": 1600, "height": 1000, "deviceScaleFactor": 1, "mobile": False},
        )
        cdp.command("Page.navigate", {"url": args.url})
        desktop = wait_for_qa(cdp, args.qa_timeout)
        desktop_webgl = webgl_receipt(cdp)
        cdp.evaluate("document.querySelector('[data-view=low]').click()")
        time.sleep(0.4)
        low_view_active = bool(cdp.evaluate("document.querySelector('[data-view=low]').classList.contains('active')"))
        cdp.evaluate("document.querySelector('[data-view=overview]').click()")
        time.sleep(0.4)
        capture(cdp, args.evidence_dir / "desktop-1600x1000.png")
        dom = cdp.evaluate("document.documentElement.outerHTML")
        (args.evidence_dir / "browser-dom.html").write_text(str(dom), encoding="utf-8")

        cdp.command(
            "Emulation.setDeviceMetricsOverride",
            {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True},
        )
        cdp.command("Page.reload", {"ignoreCache": True})
        mobile = wait_for_qa(cdp, args.qa_timeout)
        mobile_webgl = webgl_receipt(cdp)
        capture(cdp, args.evidence_dir / "mobile-390x844.png")
        errors = collect_cdp_errors(cdp.events)
        passed = (
            bool(desktop.get("passed"))
            and bool(mobile.get("passed"))
            and desktop_webgl.get("available") is True
            and mobile_webgl.get("available") is True
            and desktop.get("aoi_status") == "ACCEPTED"
            and desktop.get("source_resolution_m") == [12.5, 12.5]
            and desktop.get("fallback_30m_used") is False
            and desktop.get("gap_fill_applied") is False
            and int(desktop.get("triangle_count", 0)) > 100
            and low_view_active
            and not errors
        )
        payload = {
            "schema": "guilin-v075-cdp-browser-qa/v1",
            "passed": passed,
            "desktop": desktop,
            "mobile": mobile,
            "desktop_webgl": desktop_webgl,
            "mobile_webgl": mobile_webgl,
            "low_view_control_active": low_view_active,
            "cdp_errors": errors,
        }
        (args.evidence_dir / "browser-qa.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        if not passed:
            raise AssertionError(payload)
        print(json.dumps({
            "passed": True,
            "triangle_count": desktop["triangle_count"],
            "mesh": desktop["preview_mesh_grid"],
            "renderer": desktop_webgl.get("renderer"),
        }, ensure_ascii=False))
    finally:
        if cdp is not None:
            cdp.close()
        process.terminate()
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        if profile.exists():
            shutil.rmtree(profile, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
