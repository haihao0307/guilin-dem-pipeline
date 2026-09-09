from __future__ import annotations
import json
import os
import pathlib
import time
from playwright.sync_api import sync_playwright

url = os.environ["PUBLIC_URL"]
page_sha = os.environ["PAGE_SHA"]
root = pathlib.Path(os.environ["GITHUB_WORKSPACE"])
out = root / "weather-mother/full-weather-r23-mobile-cloud-first-20260910"
errors: list[dict] = []
report = {
    "schema": "weather-mother-r23-mobile-public-qa/2",
    "pageCommit": page_sha,
    "baseR22Commit": "8aeb8dac519f8bda851cfc998e07266870d3eaef",
    "acceptedR21CoreCommit": "d6796df38a2cb872f58ff1f8ce72b5f36d8d2322",
    "url": url,
    "target": "iPhone mobile cloud-first recovery",
    "productionReady": False,
}
iphone_ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--enable-webgl",
            "--use-gl=angle",
            "--use-angle=swiftshader-webgl",
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
            "--disable-dev-shm-usage",
        ],
    )
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=1,
        is_mobile=True,
        has_touch=True,
        user_agent=iphone_ua,
    )
    ctx.add_cookies([
        {
            "name": "__Http-phish",
            "value": "1",
            "url": "https://raw.githack.com/",
            "secure": True,
            "httpOnly": True,
            "sameSite": "Lax",
        }
    ])
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append({"type": "pageerror", "message": str(e)}))
    page.on("requestfailed", lambda r: errors.append({"type": "request", "url": r.url, "message": str(r.failure or "")}))
    response = page.goto(url + "?qa=" + str(time.time_ns()), wait_until="domcontentloaded", timeout=90000)
    assert response and response.status == 200, response.status if response else None
    page.wait_for_selector('nav button[data-scene="silver"]', timeout=30000)
    page.wait_for_function("document.querySelector('iframe[data-key=aircraft]')?.dataset.mobileCloudFirst==='r23'", timeout=30000)

    target = None
    deadline = time.time() + 90
    while time.time() < deadline and target is None:
        for frame in page.frames:
            try:
                if frame.evaluate("Boolean(window.WeatherMobileR23)"):
                    target = frame
                    break
            except Exception:
                pass
        if target is None:
            time.sleep(0.2)
    assert target is not None, "mobile fallback frame not found"

    target.wait_for_function("WeatherMobileR23.qa.ready && WeatherMobileR23.qa.frames>=3", timeout=120000)
    qa = target.evaluate("WeatherMobileR23.qa")
    state0 = target.evaluate("WeatherMobileR23.getState()")
    assert qa["errors"] == [], qa
    assert qa["renderSize"][0] > 100 and qa["renderSize"][1] > 200, qa
    assert qa["variance"] > 12, qa

    target.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'d'}))")
    page.wait_for_timeout(350)
    target.evaluate("window.dispatchEvent(new KeyboardEvent('keyup',{key:'d'}))")
    state1 = target.evaluate("WeatherMobileR23.getState()")
    assert abs(state1["yaw"] - state0["yaw"]) > 0.01, (state0, state1)

    page.locator('nav button[data-scene="sea"]').click()
    target.wait_for_function("WeatherMobileR23.qa.scene==='sea'", timeout=15000)
    sea = target.evaluate("WeatherMobileR23.qa.scene")
    page.locator('nav button[data-scene="silver"]').click()
    target.wait_for_function("WeatherMobileR23.qa.scene==='silver'", timeout=15000)

    overflow = page.evaluate("({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})")
    nav = page.locator("nav").bounding_box()
    assert overflow["x"] <= 1, overflow
    assert nav and nav["x"] >= -1 and nav["x"] + nav["width"] <= 391, nav

    shot = out / "PUBLIC_R23_MOBILE_390x844.png"
    page.screenshot(path=str(shot), full_page=False, timeout=60000)
    report.update(
        {
            "overallPass": not errors,
            "fallbackQA": qa,
            "beforeFlightInput": state0,
            "afterFlightInput": state1,
            "seaSwitch": sea,
            "overflow": overflow,
            "navBox": nav,
            "errors": errors,
            "screenshot": shot.name,
        }
    )
    assert not errors, errors
    ctx.close()
    browser.close()

(out / "PUBLIC_QA_MOBILE_2026-09-10.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
