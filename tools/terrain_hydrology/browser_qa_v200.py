#!/usr/bin/env python3
"""Browser QA for the direct three-region terrain hydrology workbench v2.0."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageStat
from playwright.sync_api import Page, sync_playwright

REGIONS = ("guilin", "wenzhou", "kunming")


def image_signal(path: Path) -> float:
    with Image.open(path) as image:
        rgb = image.convert("RGB").resize((160, 100))
        stat = ImageStat.Stat(rgb)
        return float(sum(stat.stddev) / len(stat.stddev))


def collect_state(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """
        () => {
          const state = window.__TERRAIN_HYDROLOGY_WORKBENCH_V200__;
          const common = {
            documentReadyState: document.readyState,
            workbenchDataset: document.documentElement.dataset.workbenchReady || null,
            title: document.title,
            globalStatus: document.getElementById('globalStatus')?.textContent || null,
            globalDetail: document.getElementById('globalDetail')?.textContent || null,
            regionCardCount: document.querySelectorAll('.region-card').length,
            moduleScripts: [...document.querySelectorAll('script[type="module"]')].map((item) => item.src),
          };
          if (!state) return { ...common, missing: true };
          return {
            ...common,
            ready: state.ready,
            failures: state.failures,
            regions: state.manifest.regions.map((region) => ({
              id: region.id,
              grid: region.grid,
              exactMetricSlice: region.exactMetricSlice,
              resampled: region.source.resampled,
            })),
            viewers: [...state.viewers.entries()].map(([id, viewer]) => ({
              id,
              loaded: viewer.loaded,
              backend: viewer.backend,
              heightSamples: viewer.height ? viewer.height.length : 0,
              maskSamples: viewer.mask ? viewer.mask.length : 0,
              meshCols: viewer.meshCols,
              meshRows: viewer.meshRows,
              distance: viewer.camera.distance,
              mode: viewer.mode,
            })),
          };
        }
        """
    )


def run_viewport(browser, url: str, output: Path, name: str, width: int, height: int, focus_checks: bool) -> dict[str, Any]:
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        locale="zh-CN",
    )
    page = context.new_page()
    console_errors: list[str] = []
    console_messages: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []
    response_errors: list[str] = []
    page.on("console", lambda message: (console_messages.append(f"{message.type}: {message.text}"), console_errors.append(message.text) if message.type == "error" else None))
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url}: {request.failure}"))
    page.on("response", lambda response: response_errors.append(f"{response.status} {response.url}") if response.status >= 400 else None)

    result: dict[str, Any] = {
        "viewport": f"{width}x{height}",
        "name": name,
        "consoleErrors": console_errors,
        "consoleMessages": console_messages,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "httpErrors": response_errors,
        "focusChecks": [],
        "canvasSignals": {},
    }
    try:
        response = page.goto(url, wait_until="networkidle", timeout=120_000)
        result["entryStatus"] = response.status if response else None
        page.wait_for_function(
            "['true', 'partial'].includes(document.documentElement.dataset.workbenchReady)",
            timeout=60_000,
        )
        page.wait_for_timeout(1000)
        state = collect_state(page)
        result["state"] = state
        if state.get("missing") or state.get("workbenchDataset") != "true" or not state.get("ready"):
            raise AssertionError(f"workbench did not become ready: {state}")
        if [item["id"] for item in state["regions"]] != list(REGIONS):
            raise AssertionError(f"region order mismatch: {state['regions']}")
        for region in state["regions"]:
            if region["grid"] != {"width": 800, "height": 800, "spacingMeters": [12.5, 12.5]}:
                raise AssertionError(f"{region['id']} grid mismatch: {region['grid']}")
            if region["exactMetricSlice"] is not True or region["resampled"] is not False:
                raise AssertionError(f"{region['id']} truth contract failed")
        if len(state["viewers"]) != 3:
            raise AssertionError(f"viewer count mismatch: {state['viewers']}")
        for viewer in state["viewers"]:
            if not viewer["loaded"]:
                raise AssertionError(f"{viewer['id']} did not load")
            if viewer["backend"] != "webgl2-r16ui-height-texture":
                raise AssertionError(f"{viewer['id']} backend is {viewer['backend']}")
            if viewer["heightSamples"] != 640_000 or viewer["maskSamples"] != 640_000:
                raise AssertionError(f"{viewer['id']} source sample count mismatch")
            if viewer["meshCols"] < 250 or viewer["meshRows"] < 250:
                raise AssertionError(f"{viewer['id']} card mesh is too low")

        overview_path = output / f"{name}-overview.png"
        page.screenshot(path=str(overview_path), full_page=False)
        result["overviewScreenshot"] = overview_path.name
        result["overviewSignal"] = image_signal(overview_path)
        if result["overviewSignal"] < 7.0:
            raise AssertionError(f"overview screenshot signal is too low: {result['overviewSignal']}")

        for region_id in REGIONS:
            canvas = page.locator(f"#{region_id} [data-canvas]")
            canvas.scroll_into_view_if_needed()
            canvas_path = output / f"{name}-{region_id}-canvas.png"
            canvas.screenshot(path=str(canvas_path))
            signal = image_signal(canvas_path)
            result["canvasSignals"][region_id] = signal
            if signal < 4.0:
                raise AssertionError(f"{region_id} canvas signal is too low: {signal}")

        first = page.locator("#guilin [data-canvas]")
        first.scroll_into_view_if_needed()
        first.hover()
        distance_before = page.evaluate("window.__TERRAIN_HYDROLOGY_WORKBENCH_V200__.viewers.get('guilin').camera.distance")
        page.mouse.wheel(0, -1200)
        page.wait_for_timeout(300)
        distance_after = page.evaluate("window.__TERRAIN_HYDROLOGY_WORKBENCH_V200__.viewers.get('guilin').camera.distance")
        result["zoom"] = {"before": distance_before, "after": distance_after}
        if not distance_after < distance_before:
            raise AssertionError("continuous zoom did not move closer")
        page.locator("#guilin [data-mode='hydrology']").click()
        page.wait_for_timeout(200)
        hydrology_mode = page.evaluate("window.__TERRAIN_HYDROLOGY_WORKBENCH_V200__.viewers.get('guilin').mode")
        result["hydrologyMode"] = hydrology_mode
        if hydrology_mode != 2:
            raise AssertionError("hydrology diagnostic mode did not activate")

        if focus_checks:
            for region_id in REGIONS:
                page.locator(f"#{region_id} [data-focus]").scroll_into_view_if_needed()
                page.locator(f"#{region_id} [data-focus]").click()
                page.wait_for_function(
                    f"window.__TERRAIN_HYDROLOGY_WORKBENCH_V200__.activeRegion === '{region_id}' && window.__TERRAIN_HYDROLOGY_WORKBENCH_V200__.focusViewer && window.__TERRAIN_HYDROLOGY_WORKBENCH_V200__.focusViewer.loaded",
                    timeout=90_000,
                )
                page.wait_for_timeout(500)
                focus = page.evaluate(
                    """
                    () => {
                      const viewer = window.__TERRAIN_HYDROLOGY_WORKBENCH_V200__.focusViewer;
                      return {
                        backend: viewer.backend,
                        heightSamples: viewer.height.length,
                        maskSamples: viewer.mask.length,
                        meshCols: viewer.meshCols,
                        meshRows: viewer.meshRows,
                        distance: viewer.camera.distance,
                      };
                    }
                    """
                )
                focus["region"] = region_id
                result["focusChecks"].append(focus)
                if focus["backend"] != "webgl2-r16ui-height-texture":
                    raise AssertionError(f"{region_id} focus backend is {focus['backend']}")
                if focus["heightSamples"] != 640_000 or focus["maskSamples"] != 640_000:
                    raise AssertionError(f"{region_id} focus source samples mismatch")
                if focus["meshCols"] < 700 or focus["meshRows"] < 700:
                    raise AssertionError(f"{region_id} focus mesh is too low: {focus}")
                page.locator("[data-focus-mode='hydrology']").click()
                page.locator("[data-focus-view='ground']").click()
                page.wait_for_timeout(350)
                focus_path = output / f"{name}-{region_id}-focus.png"
                page.locator("#focusDialog").screenshot(path=str(focus_path))
                focus["screenshot"] = focus_path.name
                focus["signal"] = image_signal(focus_path)
                if focus["signal"] < 4.0:
                    raise AssertionError(f"{region_id} focus screenshot signal is too low")
                page.locator("#closeFocus").click()
                page.wait_for_function("window.__TERRAIN_HYDROLOGY_WORKBENCH_V200__.focusViewer === null")

        if console_errors or page_errors or failed_requests or response_errors:
            raise AssertionError(
                f"browser errors: console={console_errors}, page={page_errors}, requests={failed_requests}, http={response_errors}"
            )
        result["passed"] = True
    except Exception as error:
        result["passed"] = False
        result["error"] = str(error)
        try:
            result["diagnosticState"] = collect_state(page)
        except Exception as diagnostic_error:
            result["diagnosticError"] = str(diagnostic_error)
        try:
            (output / f"{name}-page.html").write_text(page.content(), encoding="utf-8")
        except Exception:
            pass
        try:
            page.screenshot(path=str(output / f"{name}-failure.png"), full_page=False)
        except Exception:
            pass
    finally:
        context.close()
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        runs = [
            run_viewport(browser, args.url, output, "desktop", 1440, 1000, True),
            run_viewport(browser, args.url, output, "mobile", 390, 844, False),
        ]
        browser.close()
    report = {
        "schema": "terrain-hydrology-browser-qa@2.0.0",
        "url": args.url,
        "passed": all(run.get("passed") for run in runs),
        "runs": runs,
    }
    (output / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
