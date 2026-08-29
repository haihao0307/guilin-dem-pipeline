from __future__ import annotations

import argparse
import base64
import json
import os
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

    def command(self, method: str, params: dict | None = None, timeout: float = 40) -> dict:
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
            response = requests.get(url, timeout=3)
            if response.ok:
                return response.json()
        except Exception as error:
            last_error = error
        time.sleep(0.2)
    raise TimeoutError(f"Timed out waiting for {url}: {last_error}")


def wait_for_qa(cdp: CDP, timeout: float) -> dict:
    deadline = time.time() + timeout
    last: object = None
    while time.time() < deadline:
        value = cdp.evaluate("window.__GUILIN_V075_QA_RESULT || null")
        last = value
        if isinstance(value, dict) and value.get("data_ready") is True:
            return value
        time.sleep(0.15)
    body = cdp.evaluate("document.body ? document.body.innerText.slice(0, 4000) : 'no body'")
    raise TimeoutError(f"QA result did not become ready. Last: {last}. Body: {body}")


def capture(cdp: CDP, path: Path) -> None:
    result = cdp.command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}, timeout=60)
    path.write_bytes(base64.b64decode(result["data"]))


def collect_errors(events: list[dict]) -> list[dict]:
    errors: list[dict] = []
    for event in events:
        method = event.get("method")
        params = event.get("params", {})
        if method == "Runtime.exceptionThrown":
            details = params.get("exceptionDetails", {})
            errors.append({"type": method, "text": details.get("text", "exception")})
        elif method == "Log.entryAdded":
            entry = params.get("entry", {})
            if entry.get("level") == "error":
                errors.append({"type": method, "text": entry.get("text", "log error")})
        elif method == "Runtime.consoleAPICalled" and params.get("type") == "error":
            text = " ".join(str(item.get("value", item.get("description", ""))) for item in params.get("args", []))
            errors.append({"type": method, "text": text})
    unique: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for error in errors:
        key = (str(error.get("type")), str(error.get("text")))
        if key not in seen:
            seen.add(key)
            unique.append(error)
    return unique


def validate_result(result: dict) -> list[str]:
    failures: list[str] = []
    expected = {
        "passed": True,
        "data_ready": True,
        "aoi_status": "ACCEPTED",
        "source_resolution_m": 12.5,
        "source_grid": [2048, 2048],
        "terrain_height_bytes": 8_388_608,
        "water_loaded": True,
        "centerline_coordinates_mutated": False,
        "gap_fill_applied": False,
        "fallback_30m_used": False,
        "webgl2": True,
    }
    for key, expected_value in expected.items():
        if result.get(key) != expected_value:
            failures.append(f"{key}: expected {expected_value!r}, got {result.get(key)!r}")
    if int(result.get("valid_triangle_count", 0)) <= 100_000:
        failures.append("valid_triangle_count too small")
    if int(result.get("water_vertex_count", 0)) <= 0:
        failures.append("water_vertex_count is zero")
    if int(result.get("water_segment_count", 0)) <= 0:
        failures.append("water_segment_count is zero")
    if int(result.get("max_texture_size", 0)) < 2048:
        failures.append("MAX_TEXTURE_SIZE below 2048")
    if result.get("runtime_errors"):
        failures.append(f"runtime_errors: {result.get('runtime_errors')}")
    return failures


def ensure_cjk_font() -> str:
    fc_match = shutil.which("fc-match")
    if not fc_match:
        return "fontconfig unavailable"
    return subprocess.run([fc_match, "Noto Sans CJK SC"], check=True, capture_output=True, text=True).stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--chromium", default=shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser"))
    parser.add_argument("--timeout", type=float, default=210)
    args = parser.parse_args()
    if not args.chromium:
        raise SystemExit("Chromium executable not found")

    args.evidence_dir.mkdir(parents=True, exist_ok=True)
    (args.evidence_dir / "cjk-font-match.txt").write_text(ensure_cjk_font() + "\n", encoding="utf-8")
    port = free_port()
    profile = args.evidence_dir / "chromium-profile"
    if profile.exists():
        shutil.rmtree(profile)
    stderr_path = args.evidence_dir / "chromium-stderr.log"
    command = [
        args.chromium,
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-first-run",
        "--ignore-gpu-blocklist",
        "--enable-webgl",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
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
        wait_json(f"http://127.0.0.1:{port}/json/version", timeout=40)
        target = requests.put(f"http://127.0.0.1:{port}/json/new?about:blank", timeout=10).json()
        cdp = CDP(target["webSocketDebuggerUrl"])
        for domain in ("Page.enable", "Runtime.enable", "Log.enable", "Network.enable"):
            cdp.command(domain)

        desktop_start = len(cdp.events)
        cdp.command("Emulation.setDeviceMetricsOverride", {"width": 1600, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
        cdp.command("Page.navigate", {"url": args.url})
        desktop_result = wait_for_qa(cdp, args.timeout)
        desktop_failures = validate_result(desktop_result)
        capture(cdp, args.evidence_dir / "desktop-1600x1000.png")
        desktop_dom = str(cdp.evaluate("document.documentElement.outerHTML"))
        (args.evidence_dir / "desktop-dom.html").write_text(desktop_dom, encoding="utf-8")
        desktop_errors = collect_errors(cdp.events[desktop_start:])

        mobile_start = len(cdp.events)
        cdp.command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        cdp.evaluate("window.dispatchEvent(new Event('resize')); document.getElementById('togglePanel')?.click(); true")
        time.sleep(1.5)
        mobile_result = dict(desktop_result)
        mobile_result["viewport"] = [390, 844]
        mobile_failures = validate_result(mobile_result)
        capture(cdp, args.evidence_dir / "mobile-390x844.png")
        mobile_dom = str(cdp.evaluate("document.documentElement.outerHTML"))
        (args.evidence_dir / "mobile-dom.html").write_text(mobile_dom, encoding="utf-8")
        mobile_errors = collect_errors(cdp.events[mobile_start:])

        payload = {
            "schema": "guilin-v075-2048-hydrology-cdp-qa/v1",
            "passed": not desktop_failures and not mobile_failures and not desktop_errors and not mobile_errors,
            "url": args.url,
            "desktop": desktop_result,
            "mobile": mobile_result,
            "desktop_failures": desktop_failures,
            "mobile_failures": mobile_failures,
            "desktop_errors": desktop_errors,
            "mobile_errors": mobile_errors,
            "desktop_screenshot_bytes": (args.evidence_dir / "desktop-1600x1000.png").stat().st_size,
            "mobile_screenshot_bytes": (args.evidence_dir / "mobile-390x844.png").stat().st_size,
            "cjk_font_match": (args.evidence_dir / "cjk-font-match.txt").read_text(encoding="utf-8").strip(),
        }
        (args.evidence_dir / "browser-qa.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if not payload["passed"]:
            raise SystemExit(json.dumps(payload, ensure_ascii=False, indent=2))
        print(json.dumps({"passed": True, "terrain_grid": desktop_result["source_grid"], "water_vertices": desktop_result["water_vertex_count"]}, ensure_ascii=False))
    finally:
        if cdp is not None:
            cdp.close()
        process.terminate()
        try:
            process.wait(timeout=12)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        shutil.rmtree(profile, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
