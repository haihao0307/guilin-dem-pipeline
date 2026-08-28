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
        self.ws = websocket.create_connection(ws_url, timeout=10, origin="http://127.0.0.1")
        self.counter = 0
        self.events: list[dict] = []

    def close(self) -> None:
        self.ws.close()

    def command(self, method: str, params: dict | None = None, timeout: float = 20) -> dict:
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


def wait_json(url: str, timeout: float = 20) -> dict:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            response = requests.get(url, timeout=2)
            if response.ok:
                return response.json()
        except Exception as error:  # pragma: no cover
            last_error = error
        time.sleep(0.15)
    raise TimeoutError(f"Timed out waiting for {url}: {last_error}")


def wait_for_qa(cdp: CDP, timeout: float = 150) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        value = cdp.evaluate("window.__GUILIN_V074_QA_RESULT || null")
        if isinstance(value, dict):
            return value
        time.sleep(0.1)
    body = cdp.evaluate("document.body ? document.body.innerText.slice(0, 3000) : 'no body'")
    raise TimeoutError(f"QA result did not appear. Body: {body}")


def capture(cdp: CDP, path: Path) -> None:
    result = cdp.command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
    path.write_bytes(base64.b64decode(result["data"]))


def collect_cdp_errors(events: list[dict]) -> list[dict]:
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
            text = " ".join(str(arg.get("value", arg.get("description", ""))) for arg in params.get("args", []))
            errors.append({"type": method, "text": text})
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--chromium", default=shutil.which("chromium") or shutil.which("google-chrome"))
    parser.add_argument("--expect-real-asset", action="store_true")
    parser.add_argument("--qa-timeout", type=float, default=150)
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
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-first-run",
        "--allow-file-access-from-files",
        "--disable-web-security",
        "--hide-scrollbars",
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
        target = requests.put(
            f"http://127.0.0.1:{port}/json/new?about:blank", timeout=5
        ).json()
        cdp = CDP(target["webSocketDebuggerUrl"])
        cdp.command("Page.enable")
        cdp.command("Runtime.enable")
        cdp.command("Log.enable")
        cdp.command("Network.enable")
        cdp.command(
            "Emulation.setDeviceMetricsOverride",
            {"width": 1600, "height": 1000, "deviceScaleFactor": 1, "mobile": False},
        )
        cdp.command("Page.navigate", {"url": args.url})
        desktop_result = wait_for_qa(cdp, args.qa_timeout)
        capture(cdp, args.evidence_dir / "desktop-1600x1000.png")
        dom = cdp.evaluate("document.documentElement.outerHTML")
        (args.evidence_dir / "browser-dom.html").write_text(str(dom), encoding="utf-8")

        cdp.command(
            "Emulation.setDeviceMetricsOverride",
            {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True},
        )
        cdp.command("Page.reload", {"ignoreCache": True})
        mobile_result = wait_for_qa(cdp, args.qa_timeout)
        capture(cdp, args.evidence_dir / "mobile-390x844.png")
        cdp_errors = collect_cdp_errors(cdp.events)
        real_asset_ok = True
        if args.expect_real_asset:
            real_asset_ok = all(
                result.get("image_url") != "qa-data-url"
                and "guilin_raw_union_preview.webp" in str(result.get("image_url"))
                for result in (desktop_result, mobile_result)
            )
        payload = {
            "schema": "guilin-v074-cdp-browser-qa/v1",
            "passed": bool(desktop_result.get("passed")) and bool(mobile_result.get("passed")) and not cdp_errors and real_asset_ok,
            "desktop": desktop_result,
            "mobile": mobile_result,
            "real_asset_required": args.expect_real_asset,
            "real_asset_ok": real_asset_ok,
            "cdp_errors": cdp_errors,
        }
        (args.evidence_dir / "browser-qa.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        assert payload["passed"] is True, payload
        print(json.dumps({"passed": True, "desktop_checks": len(desktop_result["checks"]), "mobile_checks": len(mobile_result["checks"])}, ensure_ascii=False))
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
