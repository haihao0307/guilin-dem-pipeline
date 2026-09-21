from __future__ import annotations

import base64
import json
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import websocket


def wait_json(url: str):
    last = None
    for _ in range(120):
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                return json.load(response)
        except Exception as exc:
            last = exc
            time.sleep(0.2)
    raise last  # type: ignore[misc]


def run_view(root: Path, label: str, width: int, height: int, port: int, require_all_visible: bool) -> dict:
    chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    if not chrome:
        raise RuntimeError("Chrome/Chromium unavailable")
    profile = f"/tmp/coral-t06-v2-{label}"
    shutil.rmtree(profile, ignore_errors=True)
    process = subprocess.Popen(
        [chrome, "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", f"--remote-debugging-port={port}",
         "--remote-allow-origins=*", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist",
         f"--window-size={width},{height}", f"--user-data-dir={profile}", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        target = next(t for t in wait_json(f"http://127.0.0.1:{port}/json/list") if t.get("type") == "page")
        ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=30, origin="http://127.0.0.1")
        seq = 0

        def call(method: str, params: dict | None = None):
            nonlocal seq
            seq += 1
            ident = seq
            ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
            while True:
                message = json.loads(ws.recv())
                if message.get("id") == ident:
                    if "error" in message:
                        raise RuntimeError(message["error"])
                    return message.get("result", {})

        call("Page.enable")
        call("Runtime.enable")
        call("Page.addScriptToEvaluateOnNewDocument", {"source": "window.__qaErrors=[];addEventListener('error',e=>window.__qaErrors.push(String(e.message||e.error||e)));addEventListener('unhandledrejection',e=>window.__qaErrors.push(String(e.reason||e)));"})
        call("Page.navigate", {"url": "http://127.0.0.1:8770/"})
        time.sleep(9)
        expression = r'''JSON.stringify((()=>{
          const c=document.querySelector('canvas');let gl=false;try{gl=!!(c&&(c.getContext('webgl2')||c.getContext('webgl')))}catch(e){}
          const sliders=[...document.querySelectorAll('#parameterDock input[type=range]')],rects=sliders.map(el=>el.getBoundingClientRect());
          const dock=document.querySelector('#parameterDock')?.getBoundingClientRect(),controls=document.querySelector('#controls')?.getBoundingClientRect(),main=document.querySelector('main')?.getBoundingClientRect(),fine=document.querySelector('#fine');
          return {ready:document.readyState,title:document.title,gl,canvas:document.querySelectorAll('canvas').length,errors:window.__qaErrors||[],qa:window.__CORAL_R06_QA__||{},t06:window.__CORAL_R06_T06__||{},sliders:sliders.length,allVisible:rects.every(r=>r.top>=0&&r.bottom<=innerHeight),dockVisible:!!dock&&dock.top>=0&&dock.bottom<=innerHeight,controlsBottom:controls?.bottom,mainWidthRatio:(main?.width||0)/innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,fine:{min:fine?.min,max:fine?.max,step:fine?.step,value:fine?.value},body:(document.body.innerText||'').slice(0,3500)};
        })())'''
        query = json.loads(call("Runtime.evaluate", {"expression": expression, "returnByValue": True})["result"]["value"])
        assert query["ready"] == "complete" and query["gl"] and query["canvas"] == 1, query
        assert not query["errors"] and "启动失败" not in query["body"] and "Failed to fetch" not in query["body"], query
        assert query["sliders"] == 12 and query["t06"].get("ready") is True and query["t06"].get("allAdjustablesGrouped") is True, query
        fine = query["fine"]
        assert fine["min"] == "0" and fine["max"] == "1" and fine["step"] == "0.001" and abs(float(fine["value"]) - 0.22) < 1e-9, query
        assert not query["overflow"], query
        qa = query["qa"]
        assert qa.get("runtimeGLB") == 0 and qa.get("runtimeTextures") == 0 and qa.get("networkFetches") == 0, query
        assert qa.get("continuousTube") is True and abs(qa.get("fineRetention") - 0.22) < 1e-9, query
        assert 0.07 < qa.get("fineThreshold", 0) < 0.10, query
        assert 15 < qa.get("growthPaths", 0) < 216, query
        if require_all_visible:
            assert query["mainWidthRatio"] >= 0.985, query
            assert query["allVisible"] and query["dockVisible"] and query["controlsBottom"] <= height + 2, query
        else:
            assert query["mainWidthRatio"] >= 0.96, query

        def fine_paths(value: float) -> dict:
            expr = f"""(()=>{{const e=document.querySelector('#fine');e.value='{value:.3f}';e.oninput();return JSON.stringify({{paths:window.__CORAL_R06_QA__.growthPaths,threshold:window.__CORAL_R06_QA__.fineThreshold,retention:window.__CORAL_R06_QA__.fineRetention}})}})()"""
            result = json.loads(call("Runtime.evaluate", {"expression": expr, "returnByValue": True})["result"]["value"])
            time.sleep(0.5)
            return result

        low, high = fine_paths(0.0), fine_paths(1.0)
        assert low["threshold"] > high["threshold"] and low["paths"] < high["paths"], (low, high)
        fine_paths(0.22)

        shot = call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        image = base64.b64decode(shot["data"])
        assert len(image) > 15000
        (root / f"QA_SCREENSHOT_{label.upper()}.png").write_bytes(image)
        ws.close()
        return {"passed": True, "viewport": f"{width}x{height}", "webgl": True, "sliderCount": 12,
                "allSlidersVisible": query["allVisible"], "mainWidthRatio": query["mainWidthRatio"], "defaultPaths": qa["growthPaths"],
                "zeroRetentionPaths": low["paths"], "fullRetentionPaths": high["paths"], "defaultFineThreshold": qa["fineThreshold"],
                "runtimeErrors": 0, "screenshotBytes": len(image)}
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


def main() -> None:
    root = Path(sys.argv[1])
    results = {
        "ultrawide_2560x1080": run_view(root, "ultrawide_2560x1080", 2560, 1080, 9271, True),
        "desktop_1536x960": run_view(root, "desktop_1536x960", 1536, 960, 9272, True),
        "mobile_390x844": run_view(root, "mobile_390x844", 390, 844, 9273, False),
    }
    path = root / "BUILD_T06.json"
    qa = json.loads(path.read_text(encoding="utf-8"))
    qa["browserQA"] = results
    qa["ultrawideAllAdjustablesVisible"] = True
    qa["desktopAllAdjustablesVisible"] = True
    qa["mobile390x844QA"] = True
    path.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(qa, ensure_ascii=False))


if __name__ == "__main__":
    main()
