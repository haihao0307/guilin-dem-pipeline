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


EXPECTED_CANONICAL_SHA = "91154cbe7c29220c9da41efc98105f1d36b614a343636543f7dd230735da079a"
EXPECTED_SOURCE_SHA = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"


class CDP:
    def __init__(self, url: str):
        self.ws = websocket.create_connection(url, timeout=30, origin="http://127.0.0.1")
        self.counter = 0
        self.events: list[dict] = []

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
            self.events.append(payload)
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


def wait_for(cdp: CDP, expression: str, timeout: float, description: str):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = cdp.evaluate(expression)
        if last:
            return last
        time.sleep(0.25)
    raise TimeoutError(f"{description}: {last!r}")


def capture(cdp: CDP, path: Path) -> None:
    payload = cdp.command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}, 180)
    path.write_bytes(base64.b64decode(payload["data"]))


def collect_browser_errors(events: list[dict]) -> list[str]:
    errors: list[str] = []
    for event in events:
        method = event.get("method")
        params = event.get("params", {})
        if method == "Runtime.exceptionThrown":
            detail = params.get("exceptionDetails", {})
            errors.append(str(detail.get("exception", {}).get("description") or detail.get("text") or "exception"))
        elif method == "Log.entryAdded" and params.get("entry", {}).get("level") == "error":
            errors.append(str(params["entry"].get("text", "log error")))
        elif method == "Runtime.consoleAPICalled" and params.get("type") == "error":
            values = [argument.get("value") or argument.get("description") for argument in params.get("args", [])]
            errors.append(" ".join(str(value) for value in values if value))
        elif method == "Network.loadingFailed":
            errors.append(str(params.get("errorText") or "network loading failed"))
    return sorted(set(error for error in errors if error))


def network_summary(events: list[dict]) -> dict:
    requests_seen: list[dict] = []
    legacy_urls: list[str] = []
    shard_urls: list[str] = []
    shard_requests_without_range: list[str] = []
    for event in events:
        if event.get("method") != "Network.requestWillBeSent":
            continue
        request = event.get("params", {}).get("request", {})
        url = str(request.get("url") or "")
        headers = request.get("headers") or {}
        if not url:
            continue
        requests_seen.append({"url": url, "range": headers.get("Range") or headers.get("range")})
        if "/guilin-truth-data/native/" in url:
            legacy_urls.append(url)
        if "/guilin-elevation-store-v1/" in url and "/shards/" in url:
            shard_urls.append(url)
            if not (headers.get("Range") or headers.get("range")):
                shard_requests_without_range.append(url)
    return {
        "request_count": len(requests_seen),
        "legacy_tile_network_urls": sorted(set(legacy_urls)),
        "shard_request_count": len(shard_urls),
        "shard_requests_without_range": sorted(set(shard_requests_without_range)),
    }


def validate_initial(state: dict) -> list[str]:
    failures: list[str] = []
    expected = {
        "source_tiff_read": False,
        "source_tiff_role": "cold-backup-only",
        "source_tiff_sha256": EXPECTED_SOURCE_SHA,
        "canonical_stream_sha256": EXPECTED_CANONICAL_SHA,
        "canonical_sample_count": 211_919_355,
        "canonical_data_bytes": 423_838_710,
        "logical_chunk_count": 840,
        "physical_shard_count": 7,
        "overlap_samples": 0,
        "padding_samples": 0,
        "compression": "none",
        "resampling": "none",
        "quantization": "none",
        "interpolation": "none",
        "source_elevation_modified_m": 0,
        "full_truth_downloaded_on_page_open": False,
        "legacy_tile_network_request_count": 0,
        "virtual_legacy_tile_count": 0,
        "range_request_count": 0,
        "loaded_chunk_count": 0,
        "first_load_canonical_elevation_bytes": 0,
    }
    for key, value in expected.items():
        if state.get(key) != value:
            failures.append(f"initial {key}: {state.get(key)!r}")
    return failures


def validate_detail(runtime: dict, viewer: dict, network: dict) -> list[str]:
    failures: list[str] = []
    expected = {
        "ready": True,
        "manifest_loaded": True,
        "source_tiff_read": False,
        "source_tiff_role": "cold-backup-only",
        "canonical_stream_sha256": EXPECTED_CANONICAL_SHA,
        "canonical_sample_count": 211_919_355,
        "canonical_data_bytes": 423_838_710,
        "logical_chunk_count": 840,
        "physical_shard_count": 7,
        "overlap_samples": 0,
        "padding_samples": 0,
        "compression": "none",
        "resampling": "none",
        "quantization": "none",
        "interpolation": "none",
        "source_elevation_modified_m": 0,
        "full_truth_downloaded_on_page_open": False,
        "legacy_tile_network_request_count": 0,
        "range_response_other_count": 0,
        "all_range_responses_partial": True,
        "first_load_canonical_elevation_bytes": 0,
    }
    for key, value in expected.items():
        if runtime.get(key) != value:
            failures.append(f"detail {key}: {runtime.get(key)!r}")
    if int(runtime.get("range_request_count", 0)) <= 0:
        failures.append("canonical store range requests did not occur")
    if int(runtime.get("range_response_206_count", 0)) != int(runtime.get("range_request_count", -1)):
        failures.append("not every canonical store response was HTTP 206")
    if int(runtime.get("maximum_range_response_bytes", 0)) > 512 * 512 * 2:
        failures.append(f"range response too large: {runtime.get('maximum_range_response_bytes')}")
    if int(runtime.get("loaded_chunk_count", 0)) <= 0:
        failures.append("no canonical chunks were loaded")
    if int(runtime.get("chunk_sha256_verified_count", -1)) != int(runtime.get("loaded_chunk_count", -2)):
        failures.append("canonical chunk SHA256 verification count mismatch")
    if int(runtime.get("virtual_legacy_tile_count", 0)) <= 0:
        failures.append("no virtual compatibility tile was reconstructed")
    if float(runtime.get("loaded_fraction", 1.0)) >= 0.15:
        failures.append(f"too much canonical truth was downloaded: {runtime.get('loaded_fraction')}")
    if runtime.get("last_error"):
        failures.append(f"canonical runtime error: {runtime.get('last_error')}")
    if viewer.get("native_detail_active") is not True:
        failures.append("native detail did not activate")
    if viewer.get("native_detail_grid") != [640, 640]:
        failures.append(f"native detail grid: {viewer.get('native_detail_grid')}")
    if int(viewer.get("loaded_native_tile_count", 0)) <= 0:
        failures.append("viewer did not receive reconstructed native tiles")
    if viewer.get("height_image_texture_used") is not False:
        failures.append("viewer used a height image texture")
    if viewer.get("source_tile_compression") != "none":
        failures.append(f"viewer source compression: {viewer.get('source_tile_compression')}")
    if network.get("legacy_tile_network_urls"):
        failures.append("legacy native tile network requests escaped the canonical adapter")
    if int(network.get("shard_request_count", 0)) <= 0:
        failures.append("no canonical shard requests were observed")
    if network.get("shard_requests_without_range"):
        failures.append("canonical shard request lacked a Range header")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--timeout", type=float, default=600)
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
        raise SystemExit("Chromium or Google Chrome not found")
    args.evidence_dir.mkdir(parents=True, exist_ok=True)
    port = free_port()
    profile = args.evidence_dir / "chrome-profile"
    with (args.evidence_dir / "chromium.log").open("wb") as log_handle:
        process = subprocess.Popen(
            [
                args.chromium,
                "--headless=new",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--hide-scrollbars",
                "--disable-background-networking",
                "--ignore-gpu-blocklist",
                "--enable-webgl",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--remote-allow-origins=*",
                f"--remote-debugging-port={port}",
                f"--user-data-dir={profile}",
                "about:blank",
            ],
            stdout=subprocess.DEVNULL,
            stderr=log_handle,
        )
        cdp = None
        try:
            wait_json(f"http://127.0.0.1:{port}/json/version")
            target = requests.put(f"http://127.0.0.1:{port}/json/new?about:blank", timeout=10).json()
            cdp = CDP(target["webSocketDebuggerUrl"])
            for domain in ("Page.enable", "Runtime.enable", "Log.enable", "Network.enable"):
                cdp.command(domain)
            cdp.command(
                "Emulation.setDeviceMetricsOverride",
                {"width": 1600, "height": 1000, "deviceScaleFactor": 1, "mobile": False},
            )
            cdp.command("Page.navigate", {"url": args.url})
            wait_for(
                cdp,
                "window.__GUILIN_FULL_MAP_QA_RESULT && window.__GUILIN_FULL_MAP_QA_RESULT.passed === true",
                args.timeout,
                "full map viewer readiness",
            )
            initial = cdp.evaluate("window.__GUILIN_CANONICAL_STORE_RUNTIME.getState()")
            initial_failures = validate_initial(initial)
            capture(cdp, args.evidence_dir / "initial-full-map.png")
            viewer = cdp.evaluate(
                "window.__GUILIN_FULL_MAP_TEST_API.activateNativeDetail()",
                await_promise=True,
                timeout=args.timeout,
            )
            wait_for(
                cdp,
                "window.__GUILIN_FULL_MAP_QA_RESULT && window.__GUILIN_FULL_MAP_QA_RESULT.native_detail_active === true",
                args.timeout,
                "canonical native detail activation",
            )
            runtime = cdp.evaluate("window.__GUILIN_CANONICAL_STORE_RUNTIME.getState()")
            network = network_summary(cdp.events)
            detail_failures = validate_detail(runtime, viewer, network)
            capture(cdp, args.evidence_dir / "canonical-native-detail.png")
            browser_errors = collect_browser_errors(cdp.events)
            payload = {
                "schema": "guilin-canonical-elevation-browser-qa/v1",
                "passed": not initial_failures and not detail_failures and not browser_errors,
                "url": args.url,
                "initial": initial,
                "detail_runtime": runtime,
                "detail_viewer": viewer,
                "network": network,
                "failures": initial_failures + detail_failures,
                "browser_errors": browser_errors,
            }
            (args.evidence_dir / "canonical-browser-qa.json").write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            if not payload["passed"]:
                raise SystemExit(json.dumps(payload, ensure_ascii=False, indent=2))
            print(json.dumps({
                "passed": True,
                "range_requests": runtime["range_request_count"],
                "range_bytes": runtime["range_network_bytes"],
                "virtual_tiles": runtime["virtual_legacy_tile_count"],
                "source_tiff_read": runtime["source_tiff_read"],
            }))
        finally:
            if cdp:
                cdp.close()
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
            shutil.rmtree(profile, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
