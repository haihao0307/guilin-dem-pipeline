#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


OUT = Path(os.environ["LANDSCAPE_OUT"])
URL = os.environ["LANDSCAPE_URL"]
PROFILES = [
    {
        "name": "mobile-390x844",
        "viewport": {"width": 390, "height": 844},
        "device_scale_factor": 3,
        "is_mobile": True,
        "has_touch": True,
    },
    {
        "name": "desktop-1365x900",
        "viewport": {"width": 1365, "height": 900},
        "device_scale_factor": 1,
        "is_mobile": False,
        "has_touch": False,
    },
]


def launch_browser(playwright):
    executable = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    kwargs = {
        "headless": True,
        "args": [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--ignore-gpu-blocklist",
            "--enable-webgl",
            "--enable-unsafe-swiftshader",
            "--use-gl=angle",
            "--use-angle=swiftshader-webgl",
            "--disable-gpu-sandbox",
        ],
    }
    if executable:
        kwargs["executable_path"] = executable
    return playwright.chromium.launch(**kwargs)


def profile_run(browser, profile):
    context = browser.new_context(
        viewport=profile["viewport"],
        device_scale_factor=profile["device_scale_factor"],
        is_mobile=profile["is_mobile"],
        has_touch=profile["has_touch"],
    )
    page = context.new_page()
    errors = []
    warnings = []
    failed_requests = []
    http_errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: warnings.append(message.text) if message.type == "warning" else None)
    page.on("requestfailed", lambda request: failed_requests.append({"url": request.url, "failure": request.failure}))
    page.on("response", lambda response: http_errors.append({"url": response.url, "status": response.status}) if response.status >= 400 else None)

    started = time.monotonic()
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_function("window.__LANDSCAPE_READY__ === true", timeout=90000)
    ready_seconds = round(time.monotonic() - started, 3)
    page.evaluate("window.__setLandscapeTour__(false); window.__setLandscapeView__('hero')")
    page.wait_for_timeout(800)
    hero = page.evaluate("window.__requestLandscapeFrameMetrics__()")
    page.screenshot(path=str(OUT / f"{profile['name']}-hero.png"), full_page=True)

    page.evaluate("window.__setLandscapeView__('forest')")
    page.wait_for_timeout(600)
    forest = page.evaluate("window.__requestLandscapeFrameMetrics__()")

    page.evaluate("window.__setLandscapeView__('cliff')")
    page.wait_for_timeout(600)
    cliff = page.evaluate("window.__requestLandscapeFrameMetrics__()")
    page.screenshot(path=str(OUT / f"{profile['name']}-cliff.png"), full_page=True)

    page.click("#settings")
    page.wait_for_timeout(150)
    sheet_open = page.evaluate("!document.getElementById('sheet').classList.contains('hidden')")
    page.click("#closeSheet")
    page.click("#home")
    hub_open = page.evaluate("!document.getElementById('hub').classList.contains('hidden')")
    page.click("#enterScene")
    returned = page.evaluate("document.getElementById('hub').classList.contains('hidden')")

    stats = hero["stats"]
    passed = all(
        [
            stats["version"] == "V015P1",
            stats["vertices"] >= 300000,
            stats["triangles"] >= 600000,
            stats["towerCount"] == 18,
            stats["textureSampling"] is False,
            stats["images"] == 0,
            stats["externalModels"] == 0,
            stats["fog"] is False,
            stats["distantMountains"] is False,
            stats["runtimeLOD"] is False,
            stats["deviceDependentGeometry"] is False,
            hero["glError"] == 0,
            forest["glError"] == 0,
            cliff["glError"] == 0,
            hero["count"] > 10000,
            cliff["count"] > 10000,
            sheet_open,
            hub_open,
            returned,
            len(errors) == 0,
            len(failed_requests) == 0,
            len(http_errors) == 0,
        ]
    )
    result = {
        "name": profile["name"],
        "viewport": [profile["viewport"]["width"], profile["viewport"]["height"]],
        "deviceScaleFactor": profile["device_scale_factor"],
        "mobile": profile["is_mobile"],
        "readySeconds": ready_seconds,
        "hero": hero,
        "forest": forest,
        "cliff": cliff,
        "navigation": {"sheetOpen": sheet_open, "hubOpen": hub_open, "returnedToScene": returned},
        "errors": errors,
        "warnings": warnings,
        "failedRequests": failed_requests,
        "httpErrors": http_errors,
        "passed": passed,
    }
    context.close()
    return result


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = launch_browser(playwright)
        try:
            results = [profile_run(browser, profile) for profile in PROFILES]
        finally:
            browser.close()
    report = {
        "schema": "landscape-mother-v015-progress-browser-qa/1",
        "url": URL,
        "profiles": results,
        "passed": all(item["passed"] for item in results),
    }
    (OUT / "BROWSER_QA.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["passed"]:
        raise SystemExit("V015 browser QA failed")


if __name__ == "__main__":
    main()
