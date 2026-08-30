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

EXPECTED_SOURCE_SHA = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
EXPECTED_AOI_SHA = "36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80"


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


def wait_ready(cdp: CDP, timeout: float) -> dict:
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = cdp.evaluate("window.__GUILIN_FULL_MAP_QA_RESULT || null")
        if isinstance(last, dict) and last.get("passed") is True:
            return last
        time.sleep(0.3)
    body = cdp.evaluate("document.body ? document.body.innerText.slice(0,5000) : 'no body'")
    raise TimeoutError(f"full-map viewer not ready: {last}; body={body}")


def validate(result: dict, require_detail: bool = False) -> list[str]:
    expected = {
        "passed": True,
        "data_ready": True,
        "webgl2": True,
        "source_sha256": EXPECTED_SOURCE_SHA,
        "aoi_geometry_sha256": EXPECTED_AOI_SHA,
        "native_spacing_m": 12.5,
        "native_tile_count": 54,
        "full_aoi_overview": True,
        "one_continuous_map": True,
        "continuous_zoom": True,
        "tile_picker_required": False,
        "distilled_knowledge_runtime": True,
        "native_tile_delivery": "same-origin-on-demand",
        "full_truth_downloaded_on_page_open": False,
        "stale_public_assets_allowed": False,
        "overview_grid": [768, 768],
        "overview_interpolation": "none",
        "native_detail_available": True,
        "direct_numeric_vertex_geometry": True,
        "height_image_texture_used": False,
        "texture_upload_count": 0,
        "source_tile_compression": "none",
        "source_resampling": "none",
        "source_elevation_modified_m": 0,
        "vertical_scale": 1,
        "osm_linear_waterways_loaded": True,
        "hydrology_dropped_segment_count": 0,
        "hydrology_source_route_coverage": 1.0,
        "hydrology_segment_vertex_order": "upstream_to_downstream",
        "hydrology_flow_progress_monotonic": True,
        "hydrology_flow_distance_monotonic": True,
        "hydrology_future_flow_animation_ready": True,
        "hydrology_orientation_method": "connected-network outlet shortest-path distance",
        "hydrology_runtime_route_break_count": 0,
        "li_reaches_aoi_south_boundary": True,
        "centerline_coordinates_mutated": False,
        "manual_centerline_added": False,
        "synthetic_gap_line_added": False,
        "lake_surface_asset_count": 0,
        "reservoir_surface_asset_count": 0,
        "synthetic_surface_asset_count": 0,
        "runtime_errors": [],
        "loading_overlay_displayed": False,
        "error_overlay_displayed": False,
    }
    failures = [
        f"{key}: expected {value!r}, got {result.get(key)!r}"
        for key, value in expected.items()
        if result.get(key) != value
    ]
    if int(result.get("hydrology_segment_count", 0)) < 1_000:
        failures.append("hydrology_segment_count below 1000")
    if int(result.get("hydrology_source_segment_count", 0)) != int(result.get("hydrology_segment_count", -1)):
        failures.append(
            f"source/render segment mismatch: {result.get('hydrology_source_segment_count')} / {result.get('hydrology_segment_count')}"
        )
    if int(result.get("hydrology_node_count", 0)) < 1_000:
        failures.append("hydrology_node_count below 1000")
    if int(result.get("hydrology_render_node_count", 0)) <= 0:
        failures.append("hydrology render-node set is empty")
    if int(result.get("hydrology_render_node_count", 0)) >= int(result.get("hydrology_node_count", 0)):
        failures.append("hydrology still renders a round point at every source vertex")
    if int(result.get("hydrology_junction_count", 0)) <= 0:
        failures.append("hydrology junction set is empty")
    if result.get("hydrology_visual_join_gap_px") != 0:
        failures.append(f"hydrology join gap: {result.get('hydrology_visual_join_gap_px')}")
    if result.get("hydrology_visual_join_policy") != "overlapped-segments-and-degree-caps":
        failures.append(f"hydrology join policy: {result.get('hydrology_visual_join_policy')}")
    style = result.get("waterway_style") or {}
    if style.get("profile") != "network-directed-physical-width-v6":
        failures.append(f"waterway style profile: {style.get('profile')}")
    if style.get("width_mode") != "source-width-meters-projected-to-screen":
        failures.append(f"waterway width mode: {style.get('width_mode')}")
    upstream_m = float(style.get("mainstem_upstream_physical_width_m") or 0)
    midstream_m = float(style.get("mainstem_midstream_physical_width_m") or 0)
    downstream_m = float(style.get("mainstem_downstream_physical_width_m") or 0)
    if not 8.0 <= upstream_m <= 18.0:
        failures.append(f"mainstem upstream physical width {upstream_m:.3f}m")
    if not upstream_m < midstream_m < downstream_m:
        failures.append(f"mainstem physical width is not increasing: {upstream_m:.3f}, {midstream_m:.3f}, {downstream_m:.3f}")
    if downstream_m < 150.0:
        failures.append(f"mainstem downstream physical width too small: {downstream_m:.3f}m")
    upstream = float(style.get("mainstem_upstream_full_width_css_px") or 0)
    midstream = float(style.get("mainstem_midstream_full_width_css_px") or 0)
    downstream = float(style.get("mainstem_downstream_full_width_css_px") or 0)
    if not upstream <= midstream <= downstream:
        failures.append(f"projected mainstem width is not increasing: {upstream:.3f}, {midstream:.3f}, {downstream:.3f}")
    if int(style.get("li_gui_continuation_segment_count", 0)) <= 0:
        failures.append("Gui River continuation is missing")
    if int(style.get("li_south_of_yangshuo_segment_count", 0)) <= 0:
        failures.append("Li River stops at Yangshuo")
    if style.get("li_reaches_aoi_south_boundary") is not True:
        failures.append("Li and Gui mainstem does not reach AOI south boundary")
    if int(style.get("runtime_route_break_count", -1)) != 0:
        failures.append(f"distilled waterway route breaks: {style.get('runtime_route_break_count')}")
    if style.get("color_gradient") != "upstream-light-and-thin_to_downstream-dark-and-wide":
        failures.append(f"waterway color gradient: {style.get('color_gradient')}")
    if style.get("flow_direction") != "upstream_to_downstream":
        failures.append(f"waterway flow direction: {style.get('flow_direction')}")
    if style.get("flow_progress_monotonic") is not True:
        failures.append("waterway flow progress is not monotonic")
    if style.get("future_flow_animation_ready") is not True:
        failures.append("waterway flow animation direction contract is missing")
    mainstem_counts = style.get("mainstem_segment_counts") or {}
    for name in ("li", "xiang", "zi"):
        if int(mainstem_counts.get(name, 0)) <= 0:
            failures.append(f"missing {name} mainstem segments")
    explicit_mainstem_total = sum(int(mainstem_counts.get(name, 0)) for name in ("li", "xiang", "zi"))
    if not 1_000 <= explicit_mainstem_total <= 10_000:
        failures.append(f"explicit mainstem segment count outside reviewed range: {explicit_mainstem_total}")
    progress_ranges = style.get("mainstem_progress_ranges") or {}
    for name in ("li", "xiang", "zi"):
        values = progress_ranges.get(name)
        if not isinstance(values, list) or len(values) != 2 or values[0] > 0.02 or values[1] < 0.98:
            failures.append(f"invalid {name} upstream/downstream progress range: {values}")
    counts = result.get("waterway_record_counts") or {}
    if sum(int(counts.get(key, 0)) for key in ("river", "stream", "canal")) < 500:
        failures.append(f"waterway record count too small: {counts}")
    if require_detail:
        if result.get("native_detail_active") is not True:
            failures.append("native detail did not activate")
        if result.get("native_detail_grid") != [640, 640]:
            failures.append(f"native detail grid: {result.get('native_detail_grid')}")
        if int(result.get("loaded_native_tile_count", 0)) < 1:
            failures.append("no native tile loaded")
    return failures


def capture(cdp: CDP, path: Path) -> None:
    payload = cdp.command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}, 180)
    path.write_bytes(base64.b64decode(payload["data"]))



def waterway_pixel_metrics(cdp: CDP) -> dict:
    expression = r"""
    (() => {
      const canvas = document.getElementById('terrainCanvas');
      const gl = canvas && canvas.getContext('webgl2');
      if (!canvas || !gl) return {error:'missing canvas or WebGL2'};
      const width = canvas.width;
      const height = canvas.height;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let mask = new Uint8Array(width * height);
      let waterPixelCount = 0;
      for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const water = blue >= 82 && blue - green >= 5 && green - red >= 16;
        if (water) {
          mask[pixel] = 1;
          waterPixelCount += 1;
        }
      }
      const erode = input => {
        const output = new Uint8Array(input.length);
        let count = 0;
        for (let y = 1; y < height - 1; y += 1) {
          for (let x = 1; x < width - 1; x += 1) {
            const index = y * width + x;
            if (!input[index]) continue;
            let keep = 1;
            for (let dy = -1; dy <= 1 && keep; dy += 1) {
              for (let dx = -1; dx <= 1; dx += 1) {
                if (!input[index + dy * width + dx]) {
                  keep = 0;
                  break;
                }
              }
            }
            if (keep) {
              output[index] = 1;
              count += 1;
            }
          }
        }
        return {mask: output, count};
      };
      const eroded1 = erode(mask);
      const eroded2 = erode(eroded1.mask);
      return {
        width,
        height,
        water_pixel_count: waterPixelCount,
        eroded_one_pixel_count: eroded1.count,
        eroded_two_pixel_count: eroded2.count,
        core_after_two_fraction: waterPixelCount ? eroded2.count / waterPixelCount : 1,
      };
    })()
    """
    value = cdp.evaluate(expression)
    if not isinstance(value, dict):
        raise RuntimeError(f"invalid waterway pixel metrics: {value!r}")
    return value


def validate_waterway_pixels(metrics: dict) -> list[str]:
    failures: list[str] = []
    water_pixels = int(metrics.get("water_pixel_count", 0))
    if water_pixels < 1_000:
        failures.append(f"too few detected waterway pixels: {water_pixels}")
    core_fraction = float(metrics.get("core_after_two_fraction", 1.0))
    if core_fraction > 0.12:
        failures.append(f"waterway two-pixel core fraction too large: {core_fraction:.4f}")
    coverage = water_pixels / max(1, int(metrics.get("width", 1)) * int(metrics.get("height", 1)))
    if coverage > 0.025:
        failures.append(f"waterway screen coverage too large: {coverage:.4f}")
    return failures


def collect_errors(events: list[dict]) -> list[str]:
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
    return sorted(set(error for error in errors if error))


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
    log_path = args.evidence_dir / "chromium.log"
    command = [
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
    ]
    with log_path.open("wb") as log_handle:
        process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=log_handle)
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
        overview = wait_ready(cdp, args.timeout)
        overview_failures = validate(overview)
        dom_contract = cdp.evaluate(
            "({tileButtons:document.querySelectorAll('[data-tile]').length, title:document.title, fullButton:!!document.querySelector('[data-anchor=full]'), waterways:document.querySelector('#waterwaysToggle')?.checked})"
        )
        if dom_contract != {
            "tileButtons": 0,
            "title": "小桂林 · 桂林全域原生 12.5 米 DEM",
            "fullButton": True,
            "waterways": True,
        }:
            overview_failures.append(f"DOM contract mismatch: {dom_contract}")
        capture(cdp, args.evidence_dir / "desktop-full-map.png")
        overview_waterway_pixels = waterway_pixel_metrics(cdp)
        overview_failures.extend(validate_waterway_pixels(overview_waterway_pixels))

        anchor_state = cdp.evaluate("window.__GUILIN_FULL_MAP_TEST_API.focusAnchor('guilin')")
        time.sleep(0.5)
        detail = cdp.evaluate(
            "window.__GUILIN_FULL_MAP_TEST_API.activateNativeDetail()",
            await_promise=True,
            timeout=args.timeout,
        )
        detail_failures = validate(detail, require_detail=True)
        capture(cdp, args.evidence_dir / "desktop-guilin-native-detail.png")

        hidden = cdp.evaluate("window.__GUILIN_FULL_MAP_TEST_API.toggleWaterways(false)")
        shown = cdp.evaluate("window.__GUILIN_FULL_MAP_TEST_API.toggleWaterways(true)")
        toggle_failures: list[str] = []
        if hidden.get("osm_linear_waterways_loaded") is not True or shown.get("osm_linear_waterways_loaded") is not True:
            toggle_failures.append("waterway toggle damaged loaded hydrology state")

        cdp.command(
            "Emulation.setDeviceMetricsOverride",
            {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True},
        )
        cdp.evaluate("window.__GUILIN_FULL_MAP_TEST_API.resetFull()")
        cdp.evaluate("dispatchEvent(new Event('resize')); true")
        time.sleep(1.0)
        mobile = cdp.evaluate("window.__GUILIN_FULL_MAP_TEST_API.getState()")
        mobile_failures = validate(mobile)
        capture(cdp, args.evidence_dir / "mobile-full-map.png")

        browser_errors = collect_errors(cdp.events)
        payload = {
            "schema": "guilin-continuous-full-map-public-browser-qa/v1",
            "passed": not overview_failures and not detail_failures and not toggle_failures and not mobile_failures and not browser_errors,
            "url": args.url,
            "overview": overview,
            "overview_waterway_pixels": overview_waterway_pixels,
            "anchor_state": anchor_state,
            "native_detail": detail,
            "mobile": mobile,
            "dom_contract": dom_contract,
            "failures": overview_failures + detail_failures + toggle_failures + mobile_failures,
            "browser_errors": browser_errors,
        }
        (args.evidence_dir / "browser-qa.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        if not payload["passed"]:
            raise SystemExit(json.dumps(payload, ensure_ascii=False, indent=2))
        print(
            json.dumps(
                {
                    "passed": True,
                    "hydrology_segments": overview["hydrology_segment_count"],
                    "hydrology_nodes": overview["hydrology_node_count"],
                    "native_detail_grid": detail["native_detail_grid"],
                },
                ensure_ascii=False,
            )
        )
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
