"""Actual Chromium QA for the single-scene Wenzhou weather workbench."""
from __future__ import annotations

from pathlib import Path
import argparse
import json
import math
import traceback

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

VERSION = "wenzhou-workbench-0.3.0-single-scene-weather110"
FIELD_WORKER_SHA256 = "a93ed87ddda5e656e377b95719571cd334a167047931bcfe2e584f068227ce2d"

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
parser.add_argument("--out", type=Path, required=True)
parser.add_argument("--chromium")
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)

report = {
    "schema": "wenzhou-single-scene-weather-browser-qa-1",
    "url": args.url,
    "version": VERSION,
    "passed": False,
    "tests": [],
    "cases": [],
    "visualApproved": False,
    "productionApproved": False,
}


def write() -> None:
    (args.out / "browser-qa.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def check(name: str, condition: bool, detail=None) -> None:
    report["tests"].append({"name": name, "passed": bool(condition), "detail": detail})
    write()
    if not condition:
        raise AssertionError(f"{name}: {detail!r}")


def wait(page, expression: str, timeout: int = 180000) -> None:
    page.wait_for_function(expression, timeout=timeout)


def state(page) -> dict:
    return page.evaluate("window.__WZ_FULL__")


def source_hash(page) -> str:
    return page.evaluate("window.__WZ_API__.sourceHash()")


def set_range(page, element_id: str, value: float) -> None:
    page.evaluate(
        """([id,value])=>{const e=document.getElementById(id);e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));}""",
        [element_id, value],
    )


def wait_weather(page, weather_id: str) -> dict:
    wait(
        page,
        f"window.__WZ_FULL__?.ready && window.__WZ_FULL__?.weather?.caseId==={json.dumps(weather_id)} && window.__WZ_FULL__?.weather?.ready && window.__WZ_FULL__?.cloudRendered",
        240000,
    )
    page.wait_for_timeout(900)
    return state(page)


def changed_pixels(path_a: Path, path_b: Path, threshold: int = 12) -> int:
    image_a = np.asarray(Image.open(path_a).convert("RGB")).astype("int16")
    image_b = np.asarray(Image.open(path_b).convert("RGB")).astype("int16")
    if image_a.shape != image_b.shape:
        return 0
    return int((np.max(np.abs(image_a - image_b), axis=2) > threshold).sum())


write()
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=args.chromium or playwright.chromium.executable_path,
        headless=True,
        args=[
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--disable-dev-shm-usage",
        ],
    )
    report["browserVersion"] = browser.version
    try:
        for name, width, height, mobile in [
            ("ultrawide", 2560, 1080, False),
            ("mobile", 390, 844, True),
        ]:
            context = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=1,
                is_mobile=mobile,
                has_touch=mobile,
            )
            page = context.new_page()
            page.set_default_timeout(180000)
            observed = {
                "name": name,
                "viewport": [width, height],
                "consoleErrors": [],
                "pageErrors": [],
                "failedRequests": [],
                "badResponses": [],
                "imageRequests": [],
                "weatherCases": [],
                "passed": False,
            }
            report["cases"].append(observed)
            page.on(
                "console",
                lambda message, observed=observed: observed["consoleErrors"].append(message.text)
                if message.type == "error"
                else None,
            )
            page.on("pageerror", lambda error, observed=observed: observed["pageErrors"].append(str(error)))
            page.on(
                "requestfailed",
                lambda request, observed=observed: observed["failedRequests"].append(
                    {"url": request.url, "error": request.failure}
                ),
            )
            page.on(
                "response",
                lambda response, observed=observed: observed["badResponses"].append(
                    {"url": response.url, "status": response.status}
                )
                if response.status >= 400
                else None,
            )
            page.on(
                "request",
                lambda request, observed=observed: observed["imageRequests"].append(request.url)
                if request.resource_type == "image" and not request.url.startswith("data:")
                else None,
            )
            try:
                response = page.goto(args.url, wait_until="domcontentloaded", timeout=120000)
                check(f"{name} entry HTTP 200", response is not None and response.status == 200, response.status if response else None)
                wait(page, "window.__WZ_FULL__?.ready || window.__WZ_FULL__?.errors?.length", 240000)
                initial = state(page)
                check(f"{name} runtime ready", initial["ready"], initial.get("errors"))
                check(f"{name} exact runtime version", initial["version"] == VERSION, initial["version"])

                build = page.evaluate("fetch('./BUILD.json',{cache:'no-store'}).then(r=>r.json())")
                check(f"{name} exact build version", build["version"] == VERSION, build["version"])
                check(f"{name} build one canvas", build["renderArchitecture"]["mainCanvasCount"] == 1)
                check(f"{name} build one renderer", build["renderArchitecture"]["rendererCount"] == 1)
                check(f"{name} build shared depth", build["renderArchitecture"]["sharedWebGLDepth"] is True)
                check(f"{name} Weather kernel unchanged", build["weatherKernelModified"] is False)
                check(f"{name} native LOD honestly pending", build["truth"]["fullNativeOnline"] is False)

                worker_hash = page.evaluate(
                    "fetch('./modules/weather-mother/field-worker.js',{cache:'no-store'}).then(r=>r.arrayBuffer()).then(async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join(''))"
                )
                check(f"{name} original field worker exact hash", worker_hash == FIELD_WORKER_SHA256, worker_hash)

                topbar = page.locator("#topbar").bounding_box()
                panel = page.locator("#panel").bounding_box()
                canvas = page.locator("#gl").bounding_box()
                check(f"{name} top bar at most 40 px", topbar is not None and topbar["height"] <= 40, topbar)
                check(f"{name} compact panel width", panel is not None and panel["width"] <= 230, panel)
                check(f"{name} canvas fills viewport", canvas is not None and canvas["width"] >= width - 1 and canvas["height"] >= height - 1, canvas)
                check(f"{name} exactly one canvas", page.locator("canvas").count() == 1)
                check(f"{name} zero iframe", page.locator("iframe").count() == 0)
                check(f"{name} WebGL2 context", page.evaluate("!!document.getElementById('gl').getContext('webgl2')"))

                initial = state(page)
                check(f"{name} complete V200 overview", initial["overviewGrid"] == [276, 281], initial["overviewGrid"])
                check(f"{name} native source identity", initial["sourceGrid"] == [17555, 17918] and initial["sourceSpacingM"] == 12.5, [initial["sourceGrid"], initial["sourceSpacingM"]])
                check(f"{name} OSM rivers retained", initial["riverSourceParts"] == 6797 and initial["riverRenderedParts"] > 0, [initial["riverSourceParts"], initial["riverRenderedParts"]])
                check(f"{name} shader contains 3D sampler", initial["samplerCount"] >= 1, initial["samplerCount"])
                check(f"{name} one scene state", initial["oneCanvas"] and initial["oneCamera"] and initial["iframeCount"] == 0, initial)
                check(f"{name} same WebGL context state", initial["sameWebGLContext"] is True)
                check(f"{name} shared depth state", initial["sharedDepth"] is True)
                check(f"{name} logarithmic cloud depth", initial["cloudPassUsesLogDepth"] is True)
                check(f"{name} zero image requests in runtime state", initial["imageRequests"] == 0, initial["imageRequests"])
                check(f"{name} approvals remain false", not initial["visualApproved"] and not initial["productionApproved"])

                truth_hash = source_hash(page)
                observed["sourceHash"] = truth_hash
                check(f"{name} decoded overview hash exists", len(truth_hash) == 64, truth_hash)

                if mobile:
                    page.locator("#panelToggle").click()
                    wait(page, "document.getElementById('panel').classList.contains('open')")
                    check("mobile panel opens", page.locator("#panel").is_visible())
                    page.locator("#panelToggle").click()
                    wait(page, "!document.getElementById('panel').classList.contains('open')")
                    page.locator("#panelToggle").click()
                    wait(page, "document.getElementById('panel').classList.contains('open')")
                else:
                    page.locator("#panelToggle").click()
                    wait(page, "document.getElementById('panel').classList.contains('hidden')")
                    page.locator("#panelToggle").click()
                    wait(page, "!document.getElementById('panel').classList.contains('hidden')")
                check(f"{name} compact panel toggle", True)

                page.locator("#coast").click()
                coast = wait_weather(page, "coast")
                for weather_id, expected_kind, minimum_rain, expected_wind in [
                    ("coast", "Sc", 0.04, 12),
                    ("rain", "Ns", 0.70, 12),
                    ("typhoon", "Cb", 0.88, 32),
                ]:
                    if weather_id != "coast":
                        page.locator("#weatherCase").select_option(weather_id)
                        current = wait_weather(page, weather_id)
                    else:
                        current = coast
                    metrics = current["weather"]["fieldMetrics"]
                    profile = current["weather"]["profile"]
                    weather_record = {
                        "id": weather_id,
                        "kind": profile["kind"],
                        "fieldMetrics": metrics,
                        "dimensions": current["weather"]["dimensions"],
                        "wind": current["weather"]["wind"],
                        "workerReceipt": current["weather"]["workerReceipt"],
                    }
                    observed["weatherCases"].append(weather_record)
                    check(f"{name} {weather_id} source kind", profile["kind"] == expected_kind, profile)
                    check(f"{name} {weather_id} source rain", profile["source"]["rain"] >= minimum_rain - 1e-9, profile["source"])
                    check(f"{name} {weather_id} field is ready", current["weather"]["ready"] and current["weather"]["workerReceipt"] is not None)
                    check(f"{name} {weather_id} measured cloud base and top", metrics is not None and metrics["baseM"] < metrics["topM"] and metrics["topM"] > 1000, metrics)
                    check(f"{name} {weather_id} occupied horizontal range", metrics["eastWestKm"] > 5 and metrics["northSouthKm"] > 5, metrics)
                    check(f"{name} {weather_id} expected default wind", abs(current["weather"]["wind"]["speedMps"] - expected_wind) < 0.01, current["weather"]["wind"])
                    check(f"{name} {weather_id} cloud pass rendered", current["cloudRendered"] is True)
                    check(f"{name} {weather_id} truth invariant", source_hash(page) == truth_hash)
                    page.screenshot(path=str(args.out / f"{name}-{weather_id}.png"), timeout=120000)

                page.locator("#weatherCase").select_option("coast")
                wait_weather(page, "coast")
                set_range(page, "wind", 18)
                set_range(page, "cloudSpeed", 4)
                set_range(page, "direction", 270)
                wait(page, "Math.abs(window.__WZ_FULL__.weather.wind.speedMps-18)<.01 && Math.abs(window.__WZ_FULL__.weather.wind.cloudSpeedMps-4)<.01")
                controlled = state(page)
                check(f"{name} wind and cloud speed independent", controlled["weather"]["wind"]["speedMps"] == 18 and controlled["weather"]["wind"]["cloudSpeedMps"] == 4, controlled["weather"]["wind"])
                wave_a = page.evaluate("window.__WZ_API__.getWindWaveAt(321.5,871.25)")
                set_range(page, "direction", 90)
                wait(page, "Math.abs(window.__WZ_FULL__.weather.wind.fromDegrees-90)<.01")
                wave_b = page.evaluate("window.__WZ_API__.getWindWaveAt(321.5,871.25)")
                check(f"{name} sea consumes wind direction", abs(wave_a - wave_b) > 1e-5, [wave_a, wave_b])

                before_pause = state(page)["weather"]["clock"]["simulationSeconds"]
                page.locator("#playPause").click()
                page.wait_for_timeout(700)
                after_pause = state(page)["weather"]["clock"]["simulationSeconds"]
                check(f"{name} real pause", abs(after_pause - before_pause) < 0.08, [before_pause, after_pause])
                page.locator("#playPause").click()
                wait(page, f"window.__WZ_FULL__.weather.clock.simulationSeconds>{after_pause + 0.08}")

                for mode, numeric in [("neutral", 0), ("studio", 1), ("diagnostic", 2), ("environment", 3)]:
                    page.locator(f'[data-mode="{mode}"]').click()
                    wait(page, f"window.__WZ_FULL__.mode==={json.dumps(mode)} && window.__WZ_FULL__.renderedMode==={numeric}")
                    check(f"{name} source invariant in {mode}", source_hash(page) == truth_hash)

                page.locator('[data-mode="environment"]').click()
                wait(page, "window.__WZ_FULL__.renderedMode===3")
                start_frames = state(page)["frames"]
                page.wait_for_timeout(2400)
                end_frames = state(page)["frames"]
                check(f"{name} animation remains live", end_frames - start_frames >= 3, [start_frames, end_frames])

                page.locator("#ground").click()
                wait(page, "window.__WZ_FULL__.ground && window.__WZ_FULL__.clearance>=1.6 && window.__WZ_FULL__.clearance<2.1")
                ground = state(page)
                check(f"{name} 1.6 metre camera clearance", 1.6 <= ground["clearance"] < 2.1, ground["clearance"])
                check(f"{name} truth unchanged after ground camera", source_hash(page) == truth_hash)
                page.locator("#viewHome").click()
                wait(page, "!window.__WZ_FULL__.ground")

                if not mobile:
                    page.locator("#coast").click()
                    wait_weather(page, "coast")
                    environment_path = args.out / "ultrawide-environment.png"
                    neutral_path = args.out / "ultrawide-neutral.png"
                    page.screenshot(path=str(environment_path), timeout=120000)
                    page.locator('[data-mode="neutral"]').click()
                    wait(page, "window.__WZ_FULL__.renderedMode===0")
                    page.wait_for_timeout(500)
                    page.screenshot(path=str(neutral_path), timeout=120000)
                    changed = changed_pixels(environment_path, neutral_path)
                    check("ultrawide visible same-scene weather contribution", changed > 5000, changed)
                    page.locator('[data-mode="environment"]').click()
                    wait(page, "window.__WZ_FULL__.renderedMode===3")

                    coast_path = args.out / "ultrawide-coast.png"
                    rain_path = args.out / "ultrawide-rain.png"
                    typhoon_path = args.out / "ultrawide-typhoon.png"
                    check("ultrawide coast and rain visibly differ", changed_pixels(coast_path, rain_path) > 5000)
                    check("ultrawide rain and typhoon visibly differ", changed_pixels(rain_path, typhoon_path) > 5000)

                final = state(page)
                observed["final"] = final
                for key in ["consoleErrors", "pageErrors", "failedRequests", "badResponses", "imageRequests"]:
                    check(f"{name} zero {key}", len(observed[key]) == 0, observed[key])
                check(f"{name} final runtime errors empty", final["errors"] == [], final["errors"])
                check(f"{name} final approvals remain false", not final["visualApproved"] and not final["productionApproved"])
                observed["passed"] = True
                write()
                print("PASS", name, flush=True)
            except Exception as error:
                observed["error"] = str(error)
                observed["traceback"] = traceback.format_exc()
                try:
                    observed["state"] = page.evaluate("window.__WZ_FULL__")
                    page.screenshot(path=str(args.out / f"{name}-failure.png"), timeout=30000)
                except Exception as capture_error:
                    observed["captureError"] = str(capture_error)
                write()
                raise
            finally:
                context.close()
        report["passed"] = True
    except Exception as error:
        report["error"] = str(error)
        report["traceback"] = traceback.format_exc()
        print(report["traceback"], flush=True)
    finally:
        browser.close()
        write()

print(json.dumps({"passed": report["passed"], "checks": len(report["tests"])}, indent=2))
raise SystemExit(0 if report["passed"] else 1)
