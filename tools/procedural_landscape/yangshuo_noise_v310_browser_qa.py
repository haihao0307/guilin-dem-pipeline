#!/usr/bin/env python3
import argparse
import json
import time
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, sync_playwright


def snapshot(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """() => ({
          qa: window.__terrainQA || null,
          title: document.title,
          heading: document.querySelector('#title')?.textContent || null,
          status: document.querySelector('#statusMain')?.textContent || null,
          statusSub: document.querySelector('#statusSub')?.textContent || null,
          detailGrid: document.querySelector('#detailGrid')?.textContent || null,
          detailSpacing: document.querySelector('#detailSpacing')?.textContent || null,
          riverSampling: document.querySelector('#riverSampling')?.textContent || null,
          riverWidth: document.querySelector('#riverWidth')?.textContent || null,
          canvasCount: document.querySelectorAll('#viewer canvas').length,
          canvasWidth: document.querySelector('#viewer canvas')?.width || 0,
          canvasHeight: document.querySelector('#viewer canvas')?.height || 0,
          loadingOpacity: Number(getComputedStyle(document.querySelector('#loading')).opacity)
        })"""
    )


def assert_common(state: dict[str, Any], expected_preset: str, expected_grid: int, expected_spacing: float) -> None:
    qa = state.get("qa") or {}
    if not qa.get("ready"):
        raise RuntimeError(f"{expected_preset}: ready flag missing: {state}")
    if qa.get("preset") != expected_preset:
        raise RuntimeError(f"{expected_preset}: preset mismatch: {state}")
    if qa.get("truthSourceSha256") != "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4":
        raise RuntimeError(f"{expected_preset}: truth SHA mismatch: {state}")
    if qa.get("sourceGrid") != [2048, 2048] or qa.get("sourceSpacingMeters") != 12.5:
        raise RuntimeError(f"{expected_preset}: source grid contract failed: {state}")
    if qa.get("detailGrid") != [expected_grid, expected_grid] or qa.get("detailSpacingMeters") != expected_spacing:
        raise RuntimeError(f"{expected_preset}: enhanced grid contract failed: {state}")
    if qa.get("truthMutationCount") != 0 or qa.get("vegetationInstances") != 0:
        raise RuntimeError(f"{expected_preset}: truth or vegetation gate failed: {state}")
    if qa.get("riverGeometry") != "triangle-ribbon-water-surface" or qa.get("tubeGeometryUsed") is not False:
        raise RuntimeError(f"{expected_preset}: river geometry gate failed: {state}")
    if qa.get("riverSampleMeters") != 4 or int(qa.get("riverVertexCount") or 0) < 40:
        raise RuntimeError(f"{expected_preset}: river sampling gate failed: {state}")
    width = float(qa.get("riverAverageWidthMeters") or 0)
    if not 35 <= width <= 110:
        raise RuntimeError(f"{expected_preset}: river width out of range: {state}")
    bed_depth = float(qa.get("minimumRiverBedDepthMeters") or 0)
    if not 0.25 <= bed_depth <= 6:
        raise RuntimeError(f"{expected_preset}: riverbed clearance failed: {state}")
    if state.get("canvasCount", 0) < 1 or state.get("canvasWidth", 0) < 350 or state.get("canvasHeight", 0) < 500:
        raise RuntimeError(f"{expected_preset}: canvas failed: {state}")
    if state.get("loadingOpacity", 1) > 0.05:
        raise RuntimeError(f"{expected_preset}: loading overlay remains visible: {state}")


def wait_ready(page: Page, preset: str, timeout: int = 240_000) -> dict[str, Any]:
    page.wait_for_function(
        f"window.__terrainQA?.ready === true && window.__terrainQA?.preset === '{preset}'",
        timeout=timeout,
    )
    page.wait_for_timeout(1200)
    return snapshot(page)


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
            args=[
                "--use-gl=swiftshader",
                "--enable-unsafe-swiftshader",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
            ],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        page = context.new_page()
        page.on("console", lambda msg: console.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))
        page.on(
            "requestfailed",
            lambda request: request_failures.append(
                {"url": request.url, "method": request.method, "failure": request.failure}
            ),
        )
        try:
            response = page.goto(f"{args.url}?preset=karst&qa=1&webgl=1", wait_until="domcontentloaded", timeout=120_000)
            if response is None or response.status != 200:
                raise RuntimeError(f"desktop page HTTP status: {None if response is None else response.status}")
            states["karstDesktop"] = wait_ready(page, "karst")
            assert_common(states["karstDesktop"], "karst", 513, 1)
            if int(states["karstDesktop"]["qa"].get("karstMaskVertices") or 0) < 100:
                raise RuntimeError(f"karst parent mask too small: {states['karstDesktop']}")
            page.screenshot(path=str(output / "karst-desktop.png"), full_page=True)

            page.locator('[data-preset="paddy"]').click()
            states["paddyDesktop"] = wait_ready(page, "paddy")
            assert_common(states["paddyDesktop"], "paddy", 513, 1)
            if int(states["paddyDesktop"]["qa"].get("paddyMaskVertices") or 0) < 100:
                raise RuntimeError(f"paddy parent mask too small: {states['paddyDesktop']}")
            page.screenshot(path=str(output / "paddy-desktop.png"), full_page=True)

            page.locator('[data-preset="river"]').click()
            states["riverDesktop"] = wait_ready(page, "river")
            assert_common(states["riverDesktop"], "river", 513, 1)
            page.screenshot(path=str(output / "river-desktop.png"), full_page=True)

            page.locator("#truthToggle").click()
            page.wait_for_function("window.__terrainQA?.enhanceMix === 0", timeout=10_000)
            states["truthRollback"] = snapshot(page)
            page.screenshot(path=str(output / "truth-rollback-desktop.png"), full_page=True)
            context.close()

            mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
            mobile = mobile_context.new_page()
            mobile.on("console", lambda msg: console.append({"type": msg.type, "text": msg.text}))
            mobile.on("pageerror", lambda exc: page_errors.append(str(exc)))
            mobile.on(
                "requestfailed",
                lambda request: request_failures.append(
                    {"url": request.url, "method": request.method, "failure": request.failure}
                ),
            )
            response = mobile.goto(f"{args.url}?preset=paddy&qa=1&webgl=1&mobile=1", wait_until="domcontentloaded", timeout=120_000)
            if response is None or response.status != 200:
                raise RuntimeError(f"mobile page HTTP status: {None if response is None else response.status}")
            states["paddyMobile"] = wait_ready(mobile, "paddy")
            assert_common(states["paddyMobile"], "paddy", 257, 2)
            mobile.screenshot(path=str(output / "paddy-mobile-390x844.png"), full_page=True)
            mobile_context.close()
        except Exception as exc:  # noqa: BLE001
            failure = str(exc)
            try:
                page.screenshot(path=str(output / "failure-desktop.png"), full_page=True)
                states["failureState"] = snapshot(page)
            except Exception as capture_exc:  # noqa: BLE001
                failure += f"; capture failed: {capture_exc}"
        finally:
            browser.close()

    hard_console_errors = [entry for entry in console if entry["type"] == "error"]
    passed = failure is None and not page_errors and not hard_console_errors and not request_failures
    report = {
        "schema": "yangshuo-noise-terrain-browser-qa/v3.1.0",
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
    parser.add_argument("--output", default="reports/yangshuo-noise-terrain-v310-browser")
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(run(parse_args()))
