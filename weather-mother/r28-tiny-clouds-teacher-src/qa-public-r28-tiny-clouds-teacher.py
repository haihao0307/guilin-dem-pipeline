from __future__ import annotations

import json
import os
import pathlib
import time
from playwright.sync_api import sync_playwright

URL = os.environ["PUBLIC_URL"]
PAGE_SHA = os.environ["PAGE_SHA"]
ROOT = pathlib.Path(os.environ["GITHUB_WORKSPACE"])
OUT = ROOT / "weather-mother" / "full-weather-r28-tiny-clouds-teacher-20261001"
OUT.mkdir(parents=True, exist_ok=True)

report = {
    "schema": "weather-mother-r28-tiny-clouds-teacher-public-qa/1",
    "pageCommit": PAGE_SHA,
    "url": URL,
    "target": "single Weather Mother workbench with exact 2017 Tiny Clouds teacher formula",
    "publicBrowserQA": False,
    "realDeviceQA": False,
    "visualAcceptance": False,
    "productionReady": False,
}
errors: list[dict] = []


def allow_raw_githack(context) -> None:
    context.add_cookies([
        {
            "name": "__Http-phish",
            "value": "1",
            "url": "https://raw.githack.com/",
            "secure": True,
            "httpOnly": True,
            "sameSite": "Lax",
        }
    ])


def attach_errors(page, label: str) -> None:
    page.on("pageerror", lambda e: errors.append({"target": label, "type": "pageerror", "message": str(e)}))
    page.on(
        "requestfailed",
        lambda r: errors.append({"target": label, "type": "request", "url": r.url, "message": str(r.failure or "")}),
    )


def teacher_frame(page):
    page.wait_for_selector('iframe[data-key="tiny-teacher"]', timeout=120000)
    handle = page.locator('iframe[data-key="tiny-teacher"]').element_handle()
    assert handle is not None
    frame = handle.content_frame()
    assert frame is not None
    return frame


def aircraft_frame(page):
    page.wait_for_selector('iframe[data-key="aircraft"]', timeout=120000)
    handle = page.locator('iframe[data-key="aircraft"]').element_handle()
    assert handle is not None
    frame = handle.content_frame()
    assert frame is not None
    return frame


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

    desktop_ctx = browser.new_context(viewport={"width": 960, "height": 540}, device_scale_factor=1)
    allow_raw_githack(desktop_ctx)
    desktop = desktop_ctx.new_page()
    attach_errors(desktop, "desktop")
    nav_start = time.perf_counter()
    response = desktop.goto(URL + "?scene=tiny&qa=" + str(time.time_ns()), wait_until="domcontentloaded", timeout=120000)
    assert response and response.status == 200, response.status if response else None
    desktop.wait_for_function("window.WeatherR28TinyCloudsWorkbench && WeatherR28TinyCloudsWorkbench.isTeacherActive()", timeout=120000)
    teacher = teacher_frame(desktop)
    teacher.wait_for_function("window.WeatherTinyCloudsTeacher && WeatherTinyCloudsTeacher.qa.ready", timeout=180000)
    ready_ms = (time.perf_counter() - nav_start) * 1000
    tq = teacher.evaluate("WeatherTinyCloudsTeacher.qa")
    shell_q = desktop.evaluate("WeatherR28TinyCloudsWorkbench.qa")
    assert tq["context"] == "webgl2", tq
    assert tq["teacherFormulaExact"] is True and tq["teacherConstantsFrozen"] is True, tq
    assert tq["noiseBytes"] == 264082 and tq["noiseGitBlob"] == "32a561c7f6847e7c0a668e9a684af5dc969c72fc", tq
    assert tq["variance"] > 4 and tq["errors"] == [], tq
    assert tq["visualAcceptance"] is False and tq["realDeviceQA"] is False and tq["productionReady"] is False, tq
    assert shell_q["r27Preserved"] is True and shell_q["oneWeatherMotherWorkbench"] is True, shell_q

    state0 = teacher.evaluate("WeatherTinyCloudsTeacher.getState()")
    desktop.wait_for_timeout(450)
    state1 = teacher.evaluate("WeatherTinyCloudsTeacher.getState()")
    assert state1["timeS"] > state0["timeS"], (state0, state1)
    teacher.evaluate("WeatherTinyCloudsTeacher.setPlaying(false)")
    frozen0 = teacher.evaluate("WeatherTinyCloudsTeacher.getState().timeS")
    desktop.wait_for_timeout(350)
    frozen1 = teacher.evaluate("WeatherTinyCloudsTeacher.getState().timeS")
    assert abs(frozen1 - frozen0) < 1e-9, (frozen0, frozen1)
    teacher.evaluate("WeatherTinyCloudsTeacher.setTime(1.75);WeatherTinyCloudsTeacher.setCode(true)")
    code_state = teacher.evaluate("WeatherTinyCloudsTeacher.getState()")
    assert code_state["codeOpen"] is True and abs(code_state["timeS"] - 1.75) < 1e-9, code_state
    teacher.evaluate("WeatherTinyCloudsTeacher.setCode(false)")
    desktop.wait_for_timeout(250)

    outer_overflow = desktop.evaluate("({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})")
    inner_overflow = teacher.evaluate("({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})")
    assert outer_overflow["x"] <= 1 and inner_overflow["x"] <= 1, (outer_overflow, inner_overflow)
    desktop_shot = OUT / "PUBLIC_R28_TINY_CLOUDS_DESKTOP_960x540.png"
    desktop.screenshot(path=str(desktop_shot), full_page=False, timeout=120000)

    # Desktop R27 uses the original AircraftWorld surface; the dedicated mobile
    # R27 regression is run as its own preceding workflow gate. Here we prove
    # that leaving the teacher resumes the accepted Weather workbench and that
    # reopening the teacher reuses the same iframe rather than spawning another app.
    desktop.locator('button[data-scene="silver"]').click()
    desktop.wait_for_function("!WeatherR28TinyCloudsWorkbench.isTeacherActive()", timeout=30000)
    aircraft = aircraft_frame(desktop)
    aircraft.wait_for_function("window.AircraftWorld && AircraftWorld.qa.ready", timeout=120000)
    desktop_aircraft_q = aircraft.evaluate("AircraftWorld.qa")
    assert desktop_aircraft_q["ready"] is True and desktop_aircraft_q.get("errors", []) == [], desktop_aircraft_q
    coordinator_q = desktop.evaluate("AircraftClouds.qa")
    assert coordinator_q.get("active") == "silver" and coordinator_q.get("errors", []) == [], coordinator_q
    reuse = desktop.evaluate(
        """async()=>{
          const f0=WeatherR28TinyCloudsWorkbench.frame();
          await WeatherR28TinyCloudsWorkbench.showTeacher();
          return {same:f0===WeatherR28TinyCloudsWorkbench.frame(),active:WeatherR28TinyCloudsWorkbench.isTeacherActive()};
        }"""
    )
    assert reuse["same"] is True and reuse["active"] is True, reuse
    teacher.evaluate("WeatherTinyCloudsTeacher.setCode(false);WeatherTinyCloudsTeacher.setPlaying(true)")

    report["desktop960x540"] = {
        "teacherQA": tq,
        "shellQA": shell_q,
        "desktopAircraftQA": desktop_aircraft_q,
        "coordinatorQA": coordinator_q,
        "readyMs": ready_ms,
        "timeAdvanceS": state1["timeS"] - state0["timeS"],
        "frozenTimeDeltaS": frozen1 - frozen0,
        "codePanelState": code_state,
        "sameTeacherFrameAfterR27RoundTrip": reuse["same"],
        "outerOverflow": outer_overflow,
        "innerOverflow": inner_overflow,
        "screenshot": desktop_shot.name,
    }
    desktop_ctx.close()

    iphone_ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
    mobile_ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=1,
        is_mobile=True,
        has_touch=True,
        user_agent=iphone_ua,
    )
    allow_raw_githack(mobile_ctx)
    mobile = mobile_ctx.new_page()
    attach_errors(mobile, "mobile")
    response = mobile.goto(URL + "?scene=tiny&mobile=1&qa=" + str(time.time_ns()), wait_until="domcontentloaded", timeout=120000)
    assert response and response.status == 200, response.status if response else None
    mobile.wait_for_function("window.WeatherR28TinyCloudsWorkbench && WeatherR28TinyCloudsWorkbench.isTeacherActive()", timeout=120000)
    mt = teacher_frame(mobile)
    mt.wait_for_function("window.WeatherTinyCloudsTeacher && WeatherTinyCloudsTeacher.qa.ready", timeout=180000)
    mtq = mt.evaluate("WeatherTinyCloudsTeacher.qa")
    assert mtq["context"] == "webgl2" and mtq["variance"] > 4 and mtq["errors"] == [], mtq
    mobile_outer = mobile.evaluate("({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})")
    mobile_inner = mt.evaluate("({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})")
    nav_box = mobile.locator("nav").bounding_box()
    controls_box = mt.locator(".controls").bounding_box()
    assert mobile_outer["x"] <= 1 and mobile_inner["x"] <= 1, (mobile_outer, mobile_inner)
    assert nav_box and nav_box["x"] >= -1 and nav_box["x"] + nav_box["width"] <= 391, nav_box
    assert controls_box and controls_box["x"] >= -1 and controls_box["x"] + controls_box["width"] <= 391, controls_box
    mt.evaluate("WeatherTinyCloudsTeacher.setCode(false);WeatherTinyCloudsTeacher.setPlaying(false)")
    mobile.wait_for_timeout(250)
    mobile_shot = OUT / "PUBLIC_R28_TINY_CLOUDS_MOBILE_390x844.png"
    mobile.screenshot(path=str(mobile_shot), full_page=False, timeout=120000)
    report["mobile390x844"] = {
        "teacherQA": mtq,
        "outerOverflow": mobile_outer,
        "innerOverflow": mobile_inner,
        "navBox": nav_box,
        "controlsBox": controls_box,
        "screenshot": mobile_shot.name,
    }
    mobile_ctx.close()
    browser.close()

report["errors"] = errors
report["publicBrowserQA"] = not errors
report_path = OUT / "PUBLIC_QA_R28_TINY_CLOUDS_TEACHER_2026-10-01.json"
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
assert report["publicBrowserQA"]
