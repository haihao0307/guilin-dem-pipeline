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
    for _ in range(100):
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                return json.load(response)
        except Exception as exc:  # pragma: no cover - CI retry path
            last = exc
            time.sleep(0.2)
    raise last  # type: ignore[misc]


def run_view(root: Path, label: str, width: int, height: int, port: int) -> dict:
    chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    if not chrome:
        raise RuntimeError("Chrome/Chromium unavailable")
    profile = f"/tmp/coral-t04-{label}"
    shutil.rmtree(profile, ignore_errors=True)
    process = subprocess.Popen(
        [
            chrome,
            "--headless=new",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            f"--remote-debugging-port={port}",
            "--remote-allow-origins=*",
            "--use-angle=swiftshader",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
            f"--window-size={width},{height}",
            f"--user-data-dir={profile}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        target = next(t for t in wait_json(f"http://127.0.0.1:{port}/json/list") if t.get("type") == "page")
        ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=20, origin="http://127.0.0.1")
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
        call(
            "Page.addScriptToEvaluateOnNewDocument",
            {
                "source": "window.__qaErrors=[];addEventListener('error',e=>window.__qaErrors.push(String(e.message||e.error||e)));addEventListener('unhandledrejection',e=>window.__qaErrors.push(String(e.reason||e)));"
            },
        )
        call("Page.navigate", {"url": "http://127.0.0.1:8768/"})
        time.sleep(9)
        expression = r'''JSON.stringify((()=>{const c=document.querySelector('canvas');let gl=false;try{gl=!!(c&&(c.getContext('webgl2')||c.getContext('webgl')))}catch(e){}const s=document.querySelector('#stage')?.getBoundingClientRect(),i=document.querySelector('#stageInfo')?.getBoundingClientRect(),k=document.querySelector('#controls')?.getBoundingClientRect();return{ready:document.readyState,gl,canvas:document.querySelectorAll('canvas').length,controls:document.querySelectorAll('button,input,select').length,palettes:document.querySelectorAll('[data-palette]').length,stageOverlay:document.querySelectorAll('#stage .label,#stage #hud,#stage #status').length,stageInfo:!!i,stageBeforeInfo:!!(s&&i&&s.bottom<=i.top+2),infoBeforeControls:!!(i&&k&&i.bottom<=k.top+20),overflow:document.documentElement.scrollWidth>innerWidth+1,errors:window.__qaErrors||[],qa:window.__CORAL_R06_QA__||{},t04:window.__CORAL_R06_T04__||{},body:(document.body.innerText||'').slice(0,6000)}})())'''
        result = call("Runtime.evaluate", {"expression": expression, "returnByValue": True})
        query = json.loads(result["result"]["value"])
        assert query["ready"] == "complete" and query["gl"] and query["canvas"] == 1, query
        assert query["controls"] >= 24 and query["palettes"] == 7, query
        assert query["stageOverlay"] == 0 and query["stageInfo"], query
        assert query["stageBeforeInfo"] and query["infoBeforeControls"], query
        assert not query["overflow"] and not query["errors"], query
        assert query["qa"].get("ready") is True, query
        assert query["qa"].get("runtimeGLB") == 0 and query["qa"].get("networkFetches") == 0, query
        assert query["t04"].get("ready") is True and query["t04"].get("surfaceTextureBytes") == 0, query

        call(
            "Runtime.evaluate",
            {
                "expression": "document.querySelector('#microscope').click();document.querySelector('[data-palette=cyan]').click();document.querySelector('#micro').value=.95;document.querySelector('#micro').dispatchEvent(new Event('input'));"
            },
        )
        time.sleep(1.5)
        second = call(
            "Runtime.evaluate",
            {"expression": "JSON.stringify({errors:window.__qaErrors||[],qa:window.__CORAL_R06_QA__||{}})", "returnByValue": True},
        )
        after = json.loads(second["result"]["value"])
        assert not after["errors"] and not after["qa"].get("errors"), after

        screenshot = call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        image = base64.b64decode(screenshot["data"])
        if len(image) <= 15000:
            raise RuntimeError("screenshot unexpectedly small")
        (root / f"QA_SCREENSHOT_{label.upper()}.png").write_bytes(image)
        ws.close()
        return {
            "passed": True,
            "viewport": f"{width}x{height}",
            "webgl": True,
            "runtimeErrors": 0,
            "paletteButtons": query["palettes"],
            "stageOverlayText": query["stageOverlay"],
            "horizontalOverflow": False,
            "screenshotBytes": len(image),
        }
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


def main() -> None:
    root = Path(sys.argv[1])
    desktop = run_view(root, "desktop_1440x1100", 1440, 1100, 9251)
    mobile = run_view(root, "mobile_390x844", 390, 844, 9252)
    path = root / "QA_DIRECT.json"
    qa = json.loads(path.read_text(encoding="utf-8"))
    qa["desktopBrowserQA"] = True
    qa["mobile390x844QA"] = True
    qa["browserQA"] = {"desktop": desktop, "mobile": mobile}
    path.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(qa, ensure_ascii=False))


if __name__ == "__main__":
    main()
