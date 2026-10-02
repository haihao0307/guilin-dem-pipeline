from __future__ import annotations

import json
import os
import pathlib
import time
from playwright.sync_api import sync_playwright

URL = os.environ["PUBLIC_URL"]
PAGE_SHA = os.environ["PAGE_SHA"]
ROOT = pathlib.Path(os.environ["GITHUB_WORKSPACE"])
OUT = ROOT / "weather-mother" / "full-weather-r29-protean-clouds-teacher-20261002"
OUT.mkdir(parents=True, exist_ok=True)

report = {
    "schema": "weather-mother-r29-protean-clouds-teacher-public-qa/1",
    "pageCommit": PAGE_SHA,
    "url": URL,
    "target": "one Weather Mother workbench preserving R27 + Tiny Clouds and adding exact Protean Clouds teacher",
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


def frame_by_key(page, key: str):
    selector = f'iframe[data-key="{key}"]'
    page.wait_for_selector(selector, timeout=120000)
    handle = page.locator(selector).element_handle()
    assert handle is not None
    frame = handle.content_frame()
    assert frame is not None
    return frame


signature_js = """() => {
  const api=WeatherProteanCloudsTeacher, gl=api.gl(), c=document.querySelector('canvas');
  const vals=[];
  for(let gy=1;gy<=5;gy++) for(let gx=1;gx<=7;gx++){
    const px=new Uint8Array(4);
    gl.readPixels(Math.floor(c.width*gx/8),Math.floor(c.height*gy/6),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
    vals.push(px[0],px[1],px[2],px[3]);
  }
  return {sum:vals.reduce((a,b)=>a+b,0),sum2:vals.reduce((a,b)=>a+b*b,0),n:vals.length};
}"""

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
    start = time.perf_counter()
    response = desktop.goto(URL + "?scene=protean&qa=" + str(time.time_ns()), wait_until="domcontentloaded", timeout=120000)
    assert response and response.status == 200, response.status if response else None
    desktop.wait_for_function("window.WeatherR29ProteanWorkbench && WeatherR29ProteanWorkbench.isProteanActive()", timeout=120000)
    protean = frame_by_key(desktop, "protean-teacher")
    protean.wait_for_function("window.WeatherProteanCloudsTeacher && WeatherProteanCloudsTeacher.qa.ready", timeout=240000)
    ready_ms = (time.perf_counter() - start) * 1000
    pq = protean.evaluate("WeatherProteanCloudsTeacher.qa")
    shell_q = desktop.evaluate("WeatherR29ProteanWorkbench.qa")
    assert pq["context"] == "webgl2" and pq["errors"] == [], pq
    assert pq["teacherFormulaExact"] is True and pq["teacherConstantsFrozen"] is True, pq
    assert pq["raySteps"] == 130 and pq["mapLayers"] == 5, pq
    assert pq["dynamicMarchStep"] is True and pq["differentialFogIntegral"] is True, pq
    assert pq["mouseSteering"] is True and pq["externalAssets"] is False, pq
    assert pq["license"] == "CC BY-NC-SA 3.0" and pq["commercialProductionAllowed"] is False, pq
    assert pq["variance"] > 4, pq
    assert shell_q["r27Preserved"] is True and shell_q["tinyTeacherPreserved"] is True, shell_q

    state0 = protean.evaluate("WeatherProteanCloudsTeacher.getState()")
    desktop.wait_for_timeout(450)
    state1 = protean.evaluate("WeatherProteanCloudsTeacher.getState()")
    assert state1["timeS"] > state0["timeS"], (state0, state1)
    protean.evaluate("WeatherProteanCloudsTeacher.setPlaying(false)")
    frozen0 = protean.evaluate("WeatherProteanCloudsTeacher.getState().timeS")
    desktop.wait_for_timeout(350)
    frozen1 = protean.evaluate("WeatherProteanCloudsTeacher.getState().timeS")
    assert abs(frozen1 - frozen0) < 1e-9, (frozen0, frozen1)

    protean.evaluate("WeatherProteanCloudsTeacher.setTime(2.0);WeatherProteanCloudsTeacher.centerMouse()")
    center_sig = protean.evaluate(signature_js)
    dims = protean.evaluate("({w:document.querySelector('canvas').width,h:document.querySelector('canvas').height})")
    protean.evaluate(f"WeatherProteanCloudsTeacher.setMousePixels({dims['w']}*0.78,{dims['h']}*0.58,true)")
    mouse_sig = protean.evaluate(signature_js)
    mouse_delta = abs(mouse_sig["sum"] - center_sig["sum"]) + abs(mouse_sig["sum2"] - center_sig["sum2"])
    assert mouse_delta > 0, (center_sig, mouse_sig)
    protean.evaluate("WeatherProteanCloudsTeacher.centerMouse();WeatherProteanCloudsTeacher.setCode(true)")
    code_state = protean.evaluate("WeatherProteanCloudsTeacher.getState()")
    assert code_state["codeOpen"] is True and abs(code_state["timeS"] - 2.0) < 1e-9, code_state
    protean.evaluate("WeatherProteanCloudsTeacher.setCode(false);WeatherProteanCloudsTeacher.setPlaying(true)")

    outer_overflow = desktop.evaluate("({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})")
    inner_overflow = protean.evaluate("({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})")
    assert outer_overflow["x"] <= 1 and inner_overflow["x"] <= 1, (outer_overflow, inner_overflow)
    desktop_shot = OUT / "PUBLIC_R29_PROTEAN_CLOUDS_DESKTOP_960x540.png"
    desktop.screenshot(path=str(desktop_shot), full_page=False, timeout=120000)

    # Preserve the first teacher exactly and prove teacher-to-teacher round trips
    # reuse both existing iframes rather than rebuilding or replacing them.
    protean_frame_id = desktop.evaluate("WeatherR29ProteanWorkbench.frame()")
    desktop.locator("#tinyTeacherTab").click()
    desktop.wait_for_function("window.WeatherR28TinyCloudsWorkbench && WeatherR28TinyCloudsWorkbench.isTeacherActive()", timeout=120000)
    tiny = frame_by_key(desktop, "tiny-teacher")
    tiny.wait_for_function("window.WeatherTinyCloudsTeacher && WeatherTinyCloudsTeacher.qa.ready", timeout=240000)
    tq = tiny.evaluate("WeatherTinyCloudsTeacher.qa")
    assert tq["teacherFormulaExact"] is True and tq["errors"] == [], tq
    reuse = desktop.evaluate(
        """async()=>{
          const p0=WeatherR29ProteanWorkbench.frame();
          const t0=WeatherR28TinyCloudsWorkbench.frame();
          await WeatherR29ProteanWorkbench.showProtean();
          return {
            proteanSame:p0===WeatherR29ProteanWorkbench.frame(),
            tinySame:t0===WeatherR28TinyCloudsWorkbench.frame(),
            active:WeatherR29ProteanWorkbench.isProteanActive()
          };
        }"""
    )
    assert reuse["proteanSame"] is True and reuse["tinySame"] is True and reuse["active"] is True, reuse
    protean.evaluate("WeatherProteanCloudsTeacher.setPlaying(false);WeatherProteanCloudsTeacher.centerMouse();WeatherProteanCloudsTeacher.setTime(2.0)")

    report["desktop960x540"] = {
        "proteanQA": pq,
        "shellQA": shell_q,
        "tinyTeacherQA": tq,
        "readyMs": ready_ms,
        "timeAdvanceS": state1["timeS"] - state0["timeS"],
        "frozenTimeDeltaS": frozen1 - frozen0,
        "centerSignature": center_sig,
        "mouseSignature": mouse_sig,
        "mouseSignatureDelta": mouse_delta,
        "codePanelState": code_state,
        "roundTripReuse": reuse,
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
    response = mobile.goto(URL + "?scene=protean&mobile=1&qa=" + str(time.time_ns()), wait_until="domcontentloaded", timeout=120000)
    assert response and response.status == 200, response.status if response else None
    mobile.wait_for_function("window.WeatherR29ProteanWorkbench && WeatherR29ProteanWorkbench.isProteanActive()", timeout=120000)
    mp = frame_by_key(mobile, "protean-teacher")
    mp.wait_for_function("window.WeatherProteanCloudsTeacher && WeatherProteanCloudsTeacher.qa.ready", timeout=240000)
    mpq = mp.evaluate("WeatherProteanCloudsTeacher.qa")
    assert mpq["context"] == "webgl2" and mpq["variance"] > 4 and mpq["errors"] == [], mpq
    mobile_outer = mobile.evaluate("({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})")
    mobile_inner = mp.evaluate("({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})")
    nav_box = mobile.locator("nav").bounding_box()
    controls_box = mp.locator(".controls").bounding_box()
    assert mobile_outer["x"] <= 1 and mobile_inner["x"] <= 1, (mobile_outer, mobile_inner)
    assert nav_box and nav_box["x"] >= -1 and nav_box["x"] + nav_box["width"] <= 391, nav_box
    assert controls_box and controls_box["x"] >= -1 and controls_box["x"] + controls_box["width"] <= 391, controls_box
    mp.evaluate("WeatherProteanCloudsTeacher.setCode(false);WeatherProteanCloudsTeacher.setPlaying(false);WeatherProteanCloudsTeacher.setTime(2.0);WeatherProteanCloudsTeacher.centerMouse()")
    mobile.wait_for_timeout(250)
    mobile_shot = OUT / "PUBLIC_R29_PROTEAN_CLOUDS_MOBILE_390x844.png"
    mobile.screenshot(path=str(mobile_shot), full_page=False, timeout=120000)
    report["mobile390x844"] = {
        "proteanQA": mpq,
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
report_path = OUT / "PUBLIC_QA_R29_PROTEAN_CLOUDS_TEACHER_2026-10-02.json"
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
assert report["publicBrowserQA"]
