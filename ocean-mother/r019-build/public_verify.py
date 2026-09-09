#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright

ONE_FRAME_RAF = """(()=>{let n=0;window.requestAnimationFrame=(cb)=>{if(n++<1){return setTimeout(()=>cb(performance.now()),0)}return 0};window.cancelAnimationFrame=(id)=>clearTimeout(id);})()"""


def rect(page, selector: str) -> dict[str, float]:
    return page.eval_on_selector(selector, "e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,top:r.top,right:r.right,bottom:r.bottom,left:r.left,width:r.width,height:r.height}}")


def exercise(page, *, mobile: bool, evidence: Path) -> dict[str, Any]:
    console_errors: list[str] = []
    page_errors: list[str] = []
    request_failures: list[str] = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: page_errors.append(str(e)))
    page.on("requestfailed", lambda r: request_failures.append(f"{r.url}: {r.failure}"))

    page.goto(URL, wait_until="domcontentloaded", timeout=120_000)
    notice_seen = page.locator("button.url-action-button").count() > 0
    if notice_seen:
        with page.expect_navigation(wait_until="domcontentloaded", timeout=120_000):
            page.locator("button.url-action-button").click()
    page.wait_for_function("window.__OCEAN_READY__ === true || (window.__OCEAN_QA__ && window.__OCEAN_QA__.error)", timeout=120_000)
    if not page.evaluate("window.__OCEAN_READY__ === true"):
        raise RuntimeError("R019 startup failed: " + json.dumps(page.evaluate("window.__OCEAN_QA__"), ensure_ascii=False))
    page.wait_for_function("window.__OCEAN_QA__ && window.__OCEAN_QA__.gpuQuery === true", timeout=120_000)
    page.wait_for_timeout(650)

    title = page.title()
    identity = page.locator(".brand small").text_content() or ""
    qa0 = page.evaluate("window.__OCEAN_QA__")
    dims0 = page.evaluate("(()=>{const c=document.getElementById('ocean'),q=document.getElementById('quality');return {iw:innerWidth,ih:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,cw:c.width,ch:c.height,q:q.value}})()")

    page.locator('[data-zone="deep"]').click()
    page.locator('[data-view="fire"]').click()
    page.locator('[data-page="query"]').click()
    page.locator('#queryDeep').click()
    page.wait_for_timeout(100)
    readout = page.locator('#queryReadout').inner_text()
    qa1 = page.evaluate("window.__OCEAN_QA__")

    page.locator('#pause').click()
    paused_label = page.locator('#pause').inner_text()
    page.locator('#pause').click()
    resumed_label = page.locator('#pause').inner_text()

    page.locator('#closePanel').click()
    expanded_closed = page.locator('#panelToggle').get_attribute('aria-expanded')
    page.locator('#panelToggle').click()
    expanded_open = page.locator('#panelToggle').get_attribute('aria-expanded')

    panel = rect(page, '#panel')
    views = rect(page, '#views')
    dims1 = page.evaluate("(()=>{const c=document.getElementById('ocean'),q=document.getElementById('quality');return {iw:innerWidth,ih:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,cw:c.width,ch:c.height,q:q.value}})()")
    shot = evidence / ("mobile-390x844.png" if mobile else "desktop-1440x900.png")
    page.screenshot(path=str(shot), full_page=True, timeout=120_000)

    checks = {
        "raw_githack_notice_handled": notice_seen,
        "ready": page.evaluate("window.__OCEAN_READY__ === true"),
        "identity": "R019" in title and "R019" in identity and "KAOPU" in identity,
        "gpu_query_initial": bool(qa0 and qa0.get("pass")),
        "gpu_query_after_interaction": bool(qa1 and qa1.get("pass")),
        "shared_recipe": bool(qa1 and qa1.get("recipe") == "KAOPU-WATER-R1"),
        "query_readout": "KAOPU-WATER-R1" in readout and "exact shared recipe" in readout,
        "deep_zone_selected": page.locator('[data-zone="deep"]').get_attribute("class") and "selected" in (page.locator('[data-zone="deep"]').get_attribute("class") or ""),
        "fire_view_selected": page.locator('[data-view="fire"]').get_attribute("class") and "selected" in (page.locator('[data-view="fire"]').get_attribute("class") or ""),
        "pause_resume": paused_label == "继续" and resumed_label == "暂停",
        "panel_close_open": expanded_closed == "false" and expanded_open == "true",
        "no_horizontal_overflow": dims1["sw"] == dims1["iw"],
        "no_vertical_overflow": dims1["sh"] == dims1["ih"],
        "canvas_nonzero": dims1["cw"] > 2 and dims1["ch"] > 2,
        "no_console_errors": not console_errors,
        "no_page_errors": not page_errors,
        "no_request_failures": not request_failures,
    }
    if mobile:
        checks["mobile_default_quality"] = dims0["q"] == "0"
        checks["mobile_panel_view_non_overlap"] = panel["bottom"] <= views["top"] + 2
        checks["mobile_view_bar_inside_viewport"] = views["bottom"] <= dims1["ih"]
    else:
        checks["desktop_default_quality"] = dims0["q"] == "1"
        checks["desktop_panel_inside_viewport"] = panel["right"] <= dims1["iw"] and panel["bottom"] <= dims1["ih"]

    return {
        "viewport": [dims1["iw"], dims1["ih"]],
        "canvas": [dims1["cw"], dims1["ch"]],
        "quality": dims1["q"],
        "noticeSeen": notice_seen,
        "renderCaptureMode": "full-shader-single-frame",
        "qaInitial": qa0,
        "qaAfterInteraction": qa1,
        "panelRect": panel,
        "viewsRect": views,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "requestFailures": request_failures,
        "checks": checks,
        "pass": all(checks.values()),
        "screenshot": shot.name,
    }


if len(sys.argv) != 3:
    raise SystemExit("usage: public_verify.py URL EVIDENCE_DIR")
URL = sys.argv[1]
evidence = Path(sys.argv[2])
evidence.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"])
    desktop_context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    desktop_context.add_init_script(script=ONE_FRAME_RAF)
    desktop = exercise(desktop_context.new_page(), mobile=False, evidence=evidence)
    desktop_context.close()

    mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    mobile_context.add_init_script(script=ONE_FRAME_RAF)
    mobile = exercise(mobile_context.new_page(), mobile=True, evidence=evidence)
    mobile_context.close()
    browser.close()

receipt = {
    "schema": "ocean-mother-public-browser-qa-v1",
    "url": URL,
    "fixedCommit": "0f94007bbc55463e74c5ebbf42fcf2f3b1e75f82",
    "desktop": desktop,
    "mobile": mobile,
    "status": "PASS" if desktop["pass"] and mobile["pass"] else "FAIL",
    "visualAcceptance": False,
    "productionReady": False,
    "note": "This confirms the raw.githack notice flow, fixed public URL, full WebGL2 shader startup, one rendered frame and required interactions in GitHub-hosted Chromium/ANGLE SwiftShader under Xvfb. Continuous software-rendered frame rate is intentionally excluded and target iPhone/Mac performance is still unmeasured.",
}
(evidence / "PUBLIC_BROWSER_QA.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(receipt, ensure_ascii=False, indent=2))
if receipt["status"] != "PASS":
    raise SystemExit(1)
