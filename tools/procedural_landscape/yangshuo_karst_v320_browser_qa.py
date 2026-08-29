#!/usr/bin/env python3
import argparse
import json
import time
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, sync_playwright

SOURCE_SHA = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
REFERENCE_SHA = "b1711f4c3c119e6a0620b6a06561cb2eab4c1823e251b52d8153b47d4674f7bd"


def snapshot(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """() => {
          const loading = document.querySelector('#loading');
          const style = loading ? getComputedStyle(loading) : null;
          return {
            qa: window.__terrainV320QA || null,
            title: document.title,
            heading: document.querySelector('#title')?.textContent || null,
            status: document.querySelector('#statusMain')?.textContent || null,
            statusSub: document.querySelector('#statusSub')?.textContent || null,
            peakCount: document.querySelector('#peakCount')?.textContent || null,
            ratioRange: document.querySelector('#ratioRange')?.textContent || null,
            valleyProtection: document.querySelector('#valleyProtection')?.textContent || null,
            riverSections: document.querySelector('#riverSections')?.textContent || null,
            canvasCount: document.querySelectorAll('#viewer canvas').length,
            canvasWidth: document.querySelector('#viewer canvas')?.width || 0,
            canvasHeight: document.querySelector('#viewer canvas')?.height || 0,
            loadingOpacity: style ? Number(style.opacity) : 0,
            loadingDisplay: style?.display || 'none',
            loadingVisibility: style?.visibility || 'hidden',
            loadingHidden: loading?.hidden ?? true,
            loadingVisible: loading ? (!loading.hidden && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .05) : false
          };
        }"""
    )


def wait_ready(page: Page, preset: str, timeout_ms: int = 300_000) -> dict[str, Any]:
    page.wait_for_function(
        f"window.__terrainV320QA?.ready === true && window.__terrainV320QA?.preset === '{preset}'",
        timeout=timeout_ms,
    )
    page.wait_for_function(
        """() => {
          const loading = document.querySelector('#loading');
          if (!loading || loading.hidden) return true;
          const style = getComputedStyle(loading);
          return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= .05;
        }""",
        timeout=45_000,
    )
    page.wait_for_timeout(800)
    return snapshot(page)


def assert_common(state: dict[str, Any], preset: str, mobile: bool = False) -> None:
    qa = state.get("qa") or {}
    if not qa.get("ready") or qa.get("preset") != preset:
        raise RuntimeError(f"{preset}: ready/preset gate failed: {state}")
    if qa.get("truthSourceSha256") != SOURCE_SHA or qa.get("referenceSha256") != REFERENCE_SHA:
        raise RuntimeError(f"{preset}: source/reference identity failed: {state}")
    if qa.get("sourceGrid") != [2048, 2048] or qa.get("sourceSpacingMeters") != 12.5:
        raise RuntimeError(f"{preset}: source grid failed: {state}")
    expected_regional = [129, 129] if mobile else [257, 257]
    expected_context = [257, 257] if mobile else [513, 513]
    expected_detail = [257, 257] if mobile else [513, 513]
    expected_spacing = 2 if mobile else 1
    if qa.get("regionalGrid") != expected_regional or qa.get("contextGrid") != expected_context:
        raise RuntimeError(f"{preset}: regional/context grid failed: {state}")
    if qa.get("detailGrid") != expected_detail or qa.get("detailSpacingMeters") != expected_spacing:
        raise RuntimeError(f"{preset}: local grid failed: {state}")
    if qa.get("truthMutationCount") != 0 or qa.get("vegetationInstances") != 0:
        raise RuntimeError(f"{preset}: truth/vegetation boundary failed: {state}")
    if qa.get("tubeGeometryUsed") is not False:
        raise RuntimeError(f"{preset}: tube geometry must remain disabled: {state}")
    if float(qa.get("valleyMeanMacroAbsMeters") or 0) > 0.12:
        raise RuntimeError(f"{preset}: valley macro protection failed: {state}")
    if int(qa.get("detectedPeakCount") or 0) < (8 if mobile else 14):
        raise RuntimeError(f"{preset}: insufficient tower peak candidates: {state}")
    ratio = qa.get("heightFootprintRatioRange") or [0, 0]
    if len(ratio) != 2 or float(ratio[0]) < 0.9 or float(ratio[1]) > 2.7:
        raise RuntimeError(f"{preset}: height/footprint envelope failed: {state}")
    if state.get("canvasCount", 0) < 1 or state.get("canvasWidth", 0) < 350 or state.get("canvasHeight", 0) < 500:
        raise RuntimeError(f"{preset}: canvas failed: {state}")
    if state.get("loadingVisible"):
        raise RuntimeError(f"{preset}: loading overlay remains visible: {state}")


def assert_paddy(state: dict[str, Any]) -> None:
    qa = state["qa"]
    if int(qa.get("paddyMaskVertices") or 0) < 500:
        raise RuntimeError(f"paddy parent mask too small: {state}")
    bund = float(qa.get("paddyBundMaximumMeters") or 0)
    if not 0.05 <= bund <= 0.46:
        raise RuntimeError(f"paddy bund envelope failed: {state}")


def assert_cliff(state: dict[str, Any]) -> None:
    qa = state["qa"]
    if int(qa.get("karstMaskVertices") or 0) < 500:
        raise RuntimeError(f"cliff karst mask too small: {state}")
    macro = qa.get("macroDeltaRangeMeters") or [0, 0]
    micro = qa.get("microDeltaRangeMeters") or [0, 0]
    if float(macro[1]) < 8 or float(macro[0]) > -0.5:
        raise RuntimeError(f"cliff macro profile did not produce both tower lift and foot contraction: {state}")
    if float(micro[1]) <= 0 or float(micro[0]) >= 0:
        raise RuntimeError(f"cliff process detail lacks positive/negative structure: {state}")


def assert_river(state: dict[str, Any]) -> None:
    qa = state["qa"]
    if qa.get("riverGeometry") != "multi-cross-section-water-surface":
        raise RuntimeError(f"river geometry identity failed: {state}")
    if qa.get("riverSampleMeters") != 4 or qa.get("riverCrossSectionVertices") != 11:
        raise RuntimeError(f"river sampling/cross-section failed: {state}")
    if int(qa.get("riverSectionCount") or 0) < 20 or int(qa.get("riverVertexCount") or 0) < 220:
        raise RuntimeError(f"river mesh density failed: {state}")
    minimum = float(qa.get("minimumRiverClearanceMeters") or 0)
    maximum = float(qa.get("maximumRiverClearanceMeters") or 0)
    mean = float(qa.get("meanRiverClearanceMeters") or 0)
    penetration = float(qa.get("maximumWaterTerrainPenetrationMeters") or 0)
    samples = int(qa.get("riverClearanceSampleCount") or 0)
    if not 0.2 <= minimum <= mean <= maximum <= 4.5:
        raise RuntimeError(f"river clearance envelope failed: {state}")
    if samples < 250 or penetration > 0.01:
        raise RuntimeError(f"river water/terrain intersection failed: {state}")


def capture(page: Page, path: Path) -> None:
    page.screenshot(path=str(path), full_page=False, animations="disabled", caret="hide", timeout=120_000)


def run(args: argparse.Namespace) -> int:
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    console: list[dict[str, str]] = []
    page_errors: list[str] = []
    request_failures: list[dict[str, str | None]] = []
    states: dict[str, Any] = {}
    failure: str | None = None
    started = time.time()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
        )
        context = browser.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
        page = context.new_page()
        page.on("console", lambda msg: console.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))
        page.on("requestfailed", lambda request: request_failures.append({"url": request.url, "method": request.method, "failure": request.failure}))
        try:
            response = page.goto(f"{args.url}?preset=atlas&qa=1&webgl=1", wait_until="domcontentloaded", timeout=120_000)
            if response is None or response.status != 200:
                raise RuntimeError(f"desktop HTTP status: {None if response is None else response.status}")
            states["atlasDesktop"] = wait_ready(page, "atlas")
            assert_common(states["atlasDesktop"], "atlas")
            capture(page, output / "atlas-desktop.png")

            page.locator('[data-preset="paddy"]').click()
            states["paddyDesktop"] = wait_ready(page, "paddy")
            assert_common(states["paddyDesktop"], "paddy")
            assert_paddy(states["paddyDesktop"])
            capture(page, output / "paddy-desktop.png")

            page.locator('[data-preset="cliff"]').click()
            states["cliffDesktop"] = wait_ready(page, "cliff")
            assert_common(states["cliffDesktop"], "cliff")
            assert_cliff(states["cliffDesktop"])
            capture(page, output / "cliff-desktop.png")

            page.locator('[data-preset="river"]').click()
            states["riverDesktop"] = wait_ready(page, "river")
            assert_common(states["riverDesktop"], "river")
            assert_river(states["riverDesktop"])
            capture(page, output / "river-desktop.png")

            page.locator('#truthToggle').click()
            page.wait_for_function("window.__terrainV320QA?.ready === true && window.__terrainV320QA?.enhanceMix === 0", timeout=300_000)
            states["truthRollback"] = wait_ready(page, "river")
            if states["truthRollback"]["qa"].get("truthMutationCount") != 0:
                raise RuntimeError(f"truth rollback mutated source: {states['truthRollback']}")
            capture(page, output / "truth-rollback-desktop.png")
            context.close()

            mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
            mobile = mobile_context.new_page()
            mobile.on("console", lambda msg: console.append({"type": msg.type, "text": msg.text}))
            mobile.on("pageerror", lambda exc: page_errors.append(str(exc)))
            mobile.on("requestfailed", lambda request: request_failures.append({"url": request.url, "method": request.method, "failure": request.failure}))
            response = mobile.goto(f"{args.url}?preset=atlas&qa=1&webgl=1&mobile=1", wait_until="domcontentloaded", timeout=120_000)
            if response is None or response.status != 200:
                raise RuntimeError(f"mobile HTTP status: {None if response is None else response.status}")
            states["atlasMobile"] = wait_ready(mobile, "atlas")
            assert_common(states["atlasMobile"], "atlas", mobile=True)
            capture(mobile, output / "atlas-mobile-390x844.png")
            mobile_context.close()
        except Exception as exc:  # noqa: BLE001
            failure = str(exc)
            try:
                states["failureState"] = snapshot(page)
                capture(page, output / "failure-desktop.png")
            except Exception as capture_exc:  # noqa: BLE001
                failure += f"; capture failed: {capture_exc}"
        finally:
            browser.close()

    hard_console_errors = [entry for entry in console if entry["type"] == "error"]
    passed = failure is None and not page_errors and not hard_console_errors and not request_failures
    report = {
        "schema": "guilin-yangshuo-karst-distilled-browser-qa/v3.2.0",
        "url": args.url,
        "elapsedSeconds": round(time.time() - started, 3),
        "states": states,
        "failure": failure,
        "pageErrors": page_errors,
        "consoleErrors": hard_console_errors,
        "requestFailures": request_failures,
        "console": console,
        "passed": passed,
    }
    (output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if passed else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", default="reports/yangshuo-karst-distilled-v320-browser")
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(run(parse_args()))
