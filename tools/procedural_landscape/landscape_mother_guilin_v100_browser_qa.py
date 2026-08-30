#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright


def run_case(browser: Any, url: str, out_dir: Path, name: str, viewport: dict[str, int]) -> dict[str, Any]:
    context = browser.new_context(viewport=viewport, device_scale_factor=1)
    page = context.new_page()
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: page_errors.append(str(exc)))
    page.on("requestfailed", lambda req: failed_requests.append(f"{req.url}: {req.failure}"))
    page.goto(url, wait_until="domcontentloaded", timeout=120_000)
    page.wait_for_function("window.__landscapeMotherQA && window.__landscapeMotherQA.ready === true", timeout=240_000)
    page.wait_for_timeout(2_000)
    qa = page.evaluate("window.__landscapeMotherQA")
    perf = page.evaluate("window.__landscapeMotherPerf.sample(45)")
    screenshot = out_dir / f"{name}.png"
    page.screenshot(path=str(screenshot), full_page=True)
    context.close()
    return {
        "name": name,
        "url": url,
        "viewport": viewport,
        "qa": qa,
        "performance": perf,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "failedRequests": failed_requests,
        "screenshot": screenshot.name,
    }


def assert_case(case: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    qa = case["qa"]
    checks = {
        "truth sha locked": isinstance(qa.get("truthSha256"), str) and len(qa["truthSha256"]) == 64,
        "native source grid": qa.get("sourceGrid") == [2048, 2048],
        "source spacing": qa.get("sourceSpacingMeters") == 12.5,
        "truth immutable": qa.get("truthMutationCount") == 0,
        "global seed continuity": qa.get("tileSeedRestartCount") == 0,
        "protected morphology": qa.get("protectedMorphologyViolationCount") == 0,
        "river continuity": qa.get("riverInternalBreakCount") == 0,
        "river sampling": int(qa.get("riverSectionCount", 0)) >= 100,
        "water profile": qa.get("waterProfileReversalCount") == 0,
        "adaptive or continuous fallback": bool(qa.get("adaptiveMesh")) or qa.get("meshFallbackReason") is not None,
        "mesh vertices": 5_000 <= int(qa.get("vertexCount", 0)) <= 1_500_000,
        "mesh triangles": 8_000 <= int(qa.get("triangleCount", 0)) <= 2_500_000,
        "visual approval remains false": qa.get("visualApproved") is False,
        "production ready remains false": qa.get("productionReady") is False,
        "visual flow is not hydrology": qa.get("visualFlowRepresentsRealHydrology") is False,
    }
    for label, passed in checks.items():
        if not passed:
            errors.append(label)
    if case["consoleErrors"]:
        errors.append(f"console errors: {case['consoleErrors']}")
    if case["pageErrors"]:
        errors.append(f"page errors: {case['pageErrors']}")
    critical_failed = [item for item in case["failedRequests"] if "favicon" not in item]
    if critical_failed:
        errors.append(f"failed requests: {critical_failed}")
    fps = float(case["performance"].get("fps", 0))
    min_fps = 5.0 if case["viewport"]["width"] >= 1000 else 3.0
    if fps < min_fps:
        errors.append(f"interaction sample fps {fps:.2f} < {min_fps}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    base = args.url.rstrip("/") + "/"
    cases_spec = [
        ("desktop-overview", f"{base}?view=overview&qa=1", {"width": 1440, "height": 900}),
        ("desktop-river", f"{base}?view=river&qa=1", {"width": 1440, "height": 900}),
        ("desktop-paddy", f"{base}?view=paddy&qa=1", {"width": 1440, "height": 900}),
        ("desktop-cliff", f"{base}?view=cliff&qa=1", {"width": 1440, "height": 900}),
        ("mobile-overview", f"{base}?view=overview&qa=1", {"width": 390, "height": 844}),
    ]
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=["--enable-webgl", "--ignore-gpu-blocklist"])
        cases = [run_case(browser, base_url, out_dir, name, viewport) for name, base_url, viewport in cases_spec]
        browser.close()
    failures: dict[str, list[str]] = {}
    for case in cases:
        errors = assert_case(case)
        if errors:
            failures[case["name"]] = errors
    report = {
        "schema": "landscape_mother_browser_qa@1.0.0",
        "url": base,
        "cases": cases,
        "failures": failures,
        "passed": not failures,
        "truthApproved": False,
        "visualApproved": False,
        "productionReady": False,
    }
    (out_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"passed": report["passed"], "failures": failures}, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
