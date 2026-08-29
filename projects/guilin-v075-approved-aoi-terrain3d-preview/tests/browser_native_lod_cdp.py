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
from PIL import Image, ImageStat


EXPECTED_SOURCE_SHA = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
EXPECTED_AOI_SHA = "36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80"
EXPECTED_TILE_BYTES = 8_388_608


class CDP:
    def __init__(self, ws_url: str):
        self.ws = websocket.create_connection(ws_url, timeout=30, origin="http://127.0.0.1")
        self.counter = 0
        self.events: list[dict] = []

    def close(self) -> None:
        self.ws.close()

    def command(self, method: str, params: dict | None = None, timeout: float = 90) -> dict:
        self.counter += 1
        message_id = self.counter
        self.ws.settimeout(timeout)
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

    def evaluate(self, expression: str, *, await_promise: bool = False, timeout: float = 180) -> object:
        result = self.command(
            "Runtime.evaluate",
            {
                "expression": expression,
                "returnByValue": True,
                "awaitPromise": await_promise,
                "userGesture": True,
            },
            timeout=timeout,
        )
        remote = result.get("result", {})
        if remote.get("subtype") == "error":
            raise RuntimeError(remote.get("description", "Runtime evaluation failed"))
        return remote.get("value")


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_json(url: str, timeout: float = 45) -> dict:
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
        value = cdp.evaluate("window.__GUILIN_V077_QA_RESULT || null", timeout=45)
        last = value
        if isinstance(value, dict) and value.get("data_ready") is True and int(value.get("valid_triangle_count", 0)) > 100_000:
            return value
        time.sleep(0.2)
    body = cdp.evaluate("document.body ? document.body.innerText.slice(0, 5000) : 'no body'", timeout=30)
    raise TimeoutError(f"QA result did not become ready. Last: {last}. Body: {body}")


def capture(cdp: CDP, path: Path) -> None:
    result = cdp.command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}, timeout=120)
    path.write_bytes(base64.b64decode(result["data"]))


def validate_screenshot(path: Path) -> dict:
    with Image.open(path).convert("RGB") as image:
        width, height = image.size
        center = image.crop((width // 5, height // 6, width * 4 // 5, height * 5 // 6))
        center.thumbnail((400, 300))
        colors = center.getcolors(maxcolors=400 * 300) or []
        gray = center.convert("L")
        statistics = ImageStat.Stat(gray)
        standard_deviation = float(statistics.stddev[0])
        unique_colors = len(colors)
        if path.stat().st_size < 50_000:
            raise RuntimeError(f"Screenshot too small: {path.name} {path.stat().st_size}")
        if unique_colors < 100:
            raise RuntimeError(f"Screenshot color diversity too low: {path.name} {unique_colors}")
        if standard_deviation < 8:
            raise RuntimeError(f"Screenshot contrast too low: {path.name} {standard_deviation}")
        return {
            "file": path.name,
            "bytes": path.stat().st_size,
            "size": [width, height],
            "sampled_unique_colors": unique_colors,
            "sampled_luminance_stddev": standard_deviation,
        }


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


def validate_common(result: dict, expected_tile: str, expected_mode: str) -> list[str]:
    failures: list[str] = []
    expected = {
        "passed": True,
        "data_ready": True,
        "webgl2": True,
        "source_sha256": EXPECTED_SOURCE_SHA,
        "aoi_geometry_sha256": EXPECTED_AOI_SHA,
        "source_resolution_m": 12.5,
        "tile_count": 5,
        "current_tile_id": expected_tile,
        "current_tile_bytes": EXPECTED_TILE_BYTES,
        "current_tile_sha256_verified": True,
        "mode": expected_mode,
        "vertical_scale": 1,
        "resampling": "none",
        "gap_fill_applied": False,
        "fallback_30m_used": False,
        "source_elevation_modified_m": 0,
        "public_deployment_allowed": False,
        "hydrology_centerline_mutated": False,
        "loading_overlay_displayed": False,
        "error_overlay_displayed": False,
    }
    for key, expected_value in expected.items():
        if result.get(key) != expected_value:
            failures.append(f"{key}: expected {expected_value!r}, got {result.get(key)!r}")
    if int(result.get("valid_triangle_count", 0)) <= 100_000:
        failures.append("valid_triangle_count too small")
    if int(result.get("max_texture_size", 0)) < 2048:
        failures.append("MAX_TEXTURE_SIZE below 2048")
    if result.get("runtime_errors"):
        failures.append(f"runtime_errors: {result.get('runtime_errors')}")
    if "WebGL2 按需渲染" not in str(result.get("render_status", "")):
        failures.append(f"render_status mismatch: {result.get('render_status')}")
    if expected_mode == "native":
        if result.get("native_vertex_mode") is not True:
            failures.append("native_vertex_mode is false")
        if abs(float(result.get("vertex_spacing_m", -1)) - 12.5) > 1e-6:
            failures.append(f"native vertex spacing mismatch: {result.get('vertex_spacing_m')}")
        if result.get("render_grid") != [512, 512]:
            failures.append(f"native render grid mismatch: {result.get('render_grid')}")
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
    parser.add_argument("--timeout", type=float, default=300)
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
        wait_json(f"http://127.0.0.1:{port}/json/version", timeout=50)
        target = requests.put(f"http://127.0.0.1:{port}/json/new?about:blank", timeout=10).json()
        cdp = CDP(target["webSocketDebuggerUrl"])
        for domain in ("Page.enable", "Runtime.enable", "Log.enable", "Network.enable"):
            cdp.command(domain)

        desktop_start = len(cdp.events)
        cdp.command("Emulation.setDeviceMetricsOverride", {"width": 1600, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
        navigation = cdp.command("Page.navigate", {"url": args.url})
        if navigation.get("errorText"):
            raise RuntimeError(f"Navigation failed: {navigation['errorText']}")
        overview = wait_for_qa(cdp, args.timeout)
        overview_failures = validate_common(overview, "native-r05-c01", "overview")
        time.sleep(1)
        overview_shot = args.evidence_dir / "desktop-guilin-overview.png"
        capture(cdp, overview_shot)

        native = cdp.evaluate("window.__GUILIN_V077_TEST_API.setMode('native')", await_promise=True, timeout=args.timeout)
        native_failures = validate_common(native, "native-r05-c01", "native")
        time.sleep(1)
        guilin_shot = args.evidence_dir / "desktop-guilin-native.png"
        capture(cdp, guilin_shot)

        zhenbaoding = cdp.evaluate("window.__GUILIN_V077_TEST_API.selectAnchor('zhenbaoding')", await_promise=True, timeout=args.timeout)
        zhenbaoding_failures = validate_common(zhenbaoding, "native-r01-c03", "native")
        time.sleep(1)
        zhenbaoding_shot = args.evidence_dir / "desktop-zhenbaoding-native.png"
        capture(cdp, zhenbaoding_shot)

        yangshuo = cdp.evaluate("window.__GUILIN_V077_TEST_API.selectAnchor('yangshuo')", await_promise=True, timeout=args.timeout)
        yangshuo_failures = validate_common(yangshuo, "native-r07-c02", "native")
        time.sleep(1)
        yangshuo_shot = args.evidence_dir / "desktop-yangshuo-native.png"
        capture(cdp, yangshuo_shot)

        mobile_start = len(cdp.events)
        cdp.command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        cdp.evaluate("window.dispatchEvent(new Event('resize')); document.getElementById('togglePanel')?.click(); true")
        time.sleep(1.5)
        mobile = dict(cdp.evaluate("window.__GUILIN_V077_TEST_API.getState()"))
        mobile["viewport"] = [390, 844]
        mobile_failures = validate_common(mobile, "native-r07-c02", "native")
        mobile_shot = args.evidence_dir / "mobile-yangshuo-native.png"
        capture(cdp, mobile_shot)

        screenshots = [
            validate_screenshot(overview_shot),
            validate_screenshot(guilin_shot),
            validate_screenshot(zhenbaoding_shot),
            validate_screenshot(yangshuo_shot),
            validate_screenshot(mobile_shot),
        ]
        desktop_errors = collect_errors(cdp.events[desktop_start:mobile_start])
        mobile_errors = collect_errors(cdp.events[mobile_start:])
        all_failures = overview_failures + native_failures + zhenbaoding_failures + yangshuo_failures + mobile_failures
        payload = {
            "schema": "guilin-v077-native-lod-cdp-qa/v1",
            "passed": not all_failures and not desktop_errors and not mobile_errors,
            "url": args.url,
            "overview": overview,
            "guilin_native": native,
            "zhenbaoding_native": zhenbaoding,
            "yangshuo_native": yangshuo,
            "mobile": mobile,
            "failures": all_failures,
            "desktop_errors": desktop_errors,
            "mobile_errors": mobile_errors,
            "screenshots": screenshots,
            "cjk_font_match": (args.evidence_dir / "cjk-font-match.txt").read_text(encoding="utf-8").strip(),
        }
        (args.evidence_dir / "browser-qa.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if not payload["passed"]:
            raise SystemExit(json.dumps(payload, ensure_ascii=False, indent=2))
        print(json.dumps({"passed": True, "screenshots": len(screenshots), "native_vertex_spacing_m": native["vertex_spacing_m"]}, ensure_ascii=False))
    finally:
        if cdp is not None:
            cdp.close()
        process.terminate()
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=8)
        shutil.rmtree(profile, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
