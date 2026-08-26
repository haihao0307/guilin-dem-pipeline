#!/usr/bin/env python3
"""Real Chromium QA for terrain/hydrology workbench v1.0."""

from __future__ import annotations

import argparse
import base64
import contextlib
import json
import threading
from dataclasses import asdict, dataclass
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        return


@contextlib.contextmanager
def serve(root: Path):
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(root), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/web/terrain-hydrology-workbench-v100/index.html"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


@dataclass
class ViewportResult:
    name: str
    width: int
    height: int
    passed: bool
    screenshot: str
    assertions: dict[str, bool]
    consoleErrors: list[str]
    pageErrors: list[str]
    failedRequests: list[str]


def inspect(browser, url: str, output: Path, name: str, width: int, height: int) -> ViewportResult:
    context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1, locale="zh-CN")
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []
    try:
        page = context.new_page()
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url}: {request.failure}"))
        page.goto(url, wait_until="networkidle", timeout=45_000)
        page.wait_for_function("document.documentElement.dataset.workbenchReady === 'true'", timeout=30_000)
        page.wait_for_function("window.__TERRAIN_HYDROLOGY_WORKBENCH__.viewers.get('guilin').grid !== null", timeout=30_000)

        assertions: dict[str, bool] = {}
        assertions["threeRegions"] = page.locator(".region-card").count() == 3
        assertions["fourTextInputs"] = page.locator("textarea[data-note]").count() == 4
        assertions["fourImageInputs"] = page.locator("input[data-images]").count() == 4
        assertions["vegetationControlsAbsent"] = page.locator('[data-layer="vegetation"], [data-layer="ecology"]').count() == 0
        assertions["guilinRealHeightLoaded"] = "真实 12.5 m 裁片" in page.locator('[data-region="guilin"] [data-readout]').inner_text()
        assertions["wenzhouLocked"] = "等待生成" in page.locator('[data-region="wenzhou"] [data-overlay]').inner_text()
        assertions["kunmingLocked"] = "等待生成" in page.locator('[data-region="kunming"] [data-overlay]').inner_text()

        canvas = page.locator('[data-region="guilin"] [data-canvas]')
        box = canvas.bounding_box()
        before = page.evaluate("window.__TERRAIN_HYDROLOGY_WORKBENCH__.viewers.get('guilin').camera.distance")
        if box:
            page.mouse.move(box["x"] + box["width"] * 0.45, box["y"] + box["height"] * 0.45)
            page.mouse.down()
            page.mouse.move(box["x"] + box["width"] * 0.58, box["y"] + box["height"] * 0.36, steps=8)
            page.mouse.up()
            page.mouse.wheel(0, -420)
            page.wait_for_timeout(500)
        after = page.evaluate("window.__TERRAIN_HYDROLOGY_WORKBENCH__.viewers.get('guilin').camera.distance")
        yaw = page.evaluate("window.__TERRAIN_HYDROLOGY_WORKBENCH__.viewers.get('guilin').camera.yaw")
        assertions["zoomWorks"] = after < before
        assertions["rotationWorks"] = abs(yaw + 0.62) > 0.05

        page.locator('[data-region="guilin"] [data-focus]').click()
        page.wait_for_timeout(350)
        assertions["focusOpens"] = page.locator("#focusDialog").evaluate("element => element.open") is True
        page.locator("#closeFocus").click()
        page.wait_for_timeout(250)
        assertions["focusCloses"] = page.locator("#focusDialog").evaluate("element => element.open") is False

        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4mQAAAAASUVORK5CYII=")
        test_image = output / "qa-reference.png"
        test_image.write_bytes(png)
        page.locator('[data-region="guilin"] input[data-images]').set_input_files(str(test_image))
        page.wait_for_timeout(600)
        assertions["referenceUploadWorks"] = page.locator('[data-region="guilin"] .image-card').count() == 1

        screenshot = output / f"{name}.png"
        page.screenshot(path=str(screenshot), full_page=True)
        passed = all(assertions.values()) and not console_errors and not page_errors and not failed_requests
        return ViewportResult(name, width, height, passed, str(screenshot), assertions, console_errors, page_errors, failed_requests)
    finally:
        context.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--output", type=Path, default=Path("reports/terrain-hydrology-workbench-v100"))
    args = parser.parse_args()
    root = args.root.resolve()
    output = args.output if args.output.is_absolute() else root / args.output
    output.mkdir(parents=True, exist_ok=True)

    with serve(root) as url, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            results = [
                inspect(browser, url, output, "desktop-1440x1000", 1440, 1000),
                inspect(browser, url, output, "mobile-390x844", 390, 844),
            ]
        finally:
            browser.close()

    report = {
        "schema": "terrain-hydrology-workbench-browser-qa@1.0.0",
        "passed": all(item.passed for item in results),
        "url": url,
        "viewports": [asdict(item) for item in results],
    }
    (output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
