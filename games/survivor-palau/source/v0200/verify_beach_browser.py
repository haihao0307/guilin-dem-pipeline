"""Real-browser smoke gate for the V0.2.1 beach/contact increment."""
from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
import traceback

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "releases" / "v0.2.1"
EVIDENCE = Path("/tmp/stone-money-v0210-qa")
EVIDENCE.mkdir(parents=True, exist_ok=True)
ENTRY = "releases/v0.2.1/index.html"

server = ThreadingHTTPServer(
    ("127.0.0.1", 8765), partial(SimpleHTTPRequestHandler, directory=str(ROOT))
)
threading.Thread(target=server.serve_forever, daemon=True).start()

report = {
    "version": "0.2.1",
    "browserPassed": False,
    "visualAcceptance": False,
    "physicalDeviceTest": False,
    "cases": [],
}

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--disable-dev-shm-usage",
        ],
    )
    for name, width, height in [("desktop", 960, 540), ("mobile", 390, 844)]:
        context = browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=1,
            is_mobile=name == "mobile",
            has_touch=name == "mobile",
        )
        page = context.new_page()
        errors: list[str] = []
        failed_requests: list[str] = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on(
            "console", lambda msg: errors.append(msg.text) if msg.type == "error" else None
        )
        page.on("requestfailed", lambda request: failed_requests.append(request.url))
        case = {
            "name": name,
            "viewport": [width, height],
            "passed": False,
            "errors": errors,
            "failedRequests": failed_requests,
        }
        report["cases"].append(case)
        try:
            page.goto(
                "http://127.0.0.1:8765/" + ENTRY,
                wait_until="domcontentloaded",
                timeout=45_000,
            )
            page.wait_for_function(
                "window.OceanIsland?.qa.ready || document.getElementById('error')?.textContent.trim()",
                timeout=120_000,
            )
            error_panel = page.locator("#error").inner_text()
            assert not error_panel, error_panel
            assert page.evaluate(
                "OceanIsland.qa.ready && !!window.StoneMoneyShoreline && !!window.StoneMoneySurvival"
            )
            query = page.evaluate(
                """() => {
                  const q = StoneMoneyShoreline.shoreAt(36, 0, 0);
                  return {q, label: OceanIsland.qa.shoreline, canvases: document.querySelectorAll('canvas').length};
                }"""
            )
            assert query["label"] == "bed-and-water-shared"
            assert query["canvases"] == 1
            assert all(
                isinstance(query["q"][key], (int, float))
                for key in ["surface", "bed", "depth", "signedDistance", "slope"]
            )
            case["shoreAt"] = query["q"]

            page.locator("#smiStart").click()
            page.wait_for_function("StoneMoneySurvival.getMode()==='playing'", timeout=20_000)
            page.wait_for_timeout(1_500)
            assert "DAY 1" in page.locator("#smiDay").inner_text()
            if name == "mobile":
                joy = page.locator("#smiJoy").bounding_box()
                primary = page.locator("#smiPrimary").bounding_box()
                assert joy and primary
                assert joy["y"] + joy["height"] <= height
                assert primary["y"] + primary["height"] <= height
                case["touchControlsInViewport"] = True

            page.evaluate(
                "Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('GPU review timeout')),25000))])"
            )
            try:
                page.screenshot(
                    path=str(EVIDENCE / f"{name}-beach-contact.png"), timeout=15_000
                )
            finally:
                page.evaluate("OceanIsland.resumeFromReview()")

            gl_errors = page.evaluate("OceanIsland.qa.glErrors || []")
            assert not gl_errors, gl_errors
            assert not errors and not failed_requests
            case["passed"] = True
        except Exception as exc:
            case["failure"] = str(exc)
            case["trace"] = traceback.format_exc()
            try:
                page.screenshot(
                    path=str(EVIDENCE / f"{name}-failure.png"), timeout=10_000
                )
            except Exception:
                pass
        finally:
            context.close()
        if not case["passed"]:
            break
    report["browserPassed"] = len(report["cases"]) == 2 and all(
        case["passed"] for case in report["cases"]
    )
    browser.close()

server.shutdown()
(OUT / "BEACH_BROWSER_QA.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(report, ensure_ascii=False, indent=2))
if not report["browserPassed"]:
    raise SystemExit(1)
