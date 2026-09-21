from __future__ import annotations

import base64
import json
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

import websocket


DEFAULTS = {
    "thickness": 0.92,
    "fine": 0.22,
    "tip": 1.0,
    "rough": 0.58,
    "point": 1.55,
    "verrucae": 0.55,
    "cupScale": 24.0,
    "cupDepth": 0.90,
    "grain": 0.55,
    "micro": 0.84,
    "glow": 0.68,
    "saturation": 1.22,
}


def wait_json(url: str) -> Any:
    last: Exception | None = None
    for _ in range(150):
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                return json.load(response)
        except Exception as exc:  # pragma: no cover - only used in CI startup
            last = exc
            time.sleep(0.2)
    if last is None:
        raise RuntimeError(f"timed out waiting for {url}")
    raise last


def run_view(
    root: Path,
    label: str,
    width: int,
    height: int,
    debug_port: int,
    require_all_visible: bool,
) -> dict[str, Any]:
    chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    if not chrome:
        raise RuntimeError("Chrome/Chromium unavailable")

    profile = f"/tmp/coral-t07-{label}"
    shutil.rmtree(profile, ignore_errors=True)
    process = subprocess.Popen(
        [
            chrome,
            "--headless=new",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            f"--remote-debugging-port={debug_port}",
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
        target = next(
            t for t in wait_json(f"http://127.0.0.1:{debug_port}/json/list") if t.get("type") == "page"
        )
        ws = websocket.create_connection(
            target["webSocketDebuggerUrl"], timeout=45, origin="http://127.0.0.1"
        )
        seq = 0

        def call(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
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

        def evaluate(expression: str) -> Any:
            result = call(
                "Runtime.evaluate",
                {
                    "expression": expression,
                    "returnByValue": True,
                    "awaitPromise": True,
                },
            )
            remote = result.get("result", {})
            if remote.get("subtype") == "error":
                raise RuntimeError(remote.get("description", "browser evaluation failed"))
            return remote.get("value")

        call("Page.enable")
        call("Runtime.enable")
        call(
            "Page.addScriptToEvaluateOnNewDocument",
            {
                "source": (
                    "window.__qaErrors=[];"
                    "addEventListener('error',e=>window.__qaErrors.push(String(e.message||e.error||e)));"
                    "addEventListener('unhandledrejection',e=>window.__qaErrors.push(String(e.reason||e)));"
                )
            },
        )
        call("Page.navigate", {"url": "http://127.0.0.1:8771/"})
        time.sleep(9)

        initial = json.loads(
            evaluate(
                r'''JSON.stringify((()=>{
                  const c=document.querySelector('canvas');let gl=false;
                  try{gl=!!(c&&(c.getContext('webgl2')||c.getContext('webgl')))}catch(e){}
                  const sliders=[...document.querySelectorAll('#parameterDock input[type=range]')],
                    rects=sliders.map(el=>el.getBoundingClientRect()),
                    dock=document.querySelector('#parameterDock')?.getBoundingClientRect(),
                    controls=document.querySelector('#controls')?.getBoundingClientRect(),
                    main=document.querySelector('main')?.getBoundingClientRect(),
                    fine=document.querySelector('#fine');
                  return {
                    ready:document.readyState,title:document.title,gl,
                    canvas:document.querySelectorAll('canvas').length,
                    errors:window.__qaErrors||[],
                    qa:window.__CORAL_R06_QA__||{},
                    t07:window.__CORAL_R06_T07__||{},
                    build:window.__CORAL_R06_T07_BUILD__||{},
                    sliders:sliders.length,
                    allVisible:rects.every(r=>r.top>=0&&r.bottom<=innerHeight),
                    dockVisible:!!dock&&dock.top>=0&&dock.bottom<=innerHeight,
                    controlsBottom:controls?.bottom,
                    mainWidthRatio:(main?.width||0)/innerWidth,
                    overflow:document.documentElement.scrollWidth>innerWidth+1,
                    fine:{min:fine?.min,max:fine?.max,step:fine?.step,value:fine?.value},
                    body:(document.body.innerText||'').slice(0,4200)
                  };
                })())'''
            )
        )

        assert initial["ready"] == "complete", initial
        assert initial["gl"] and initial["canvas"] == 1, initial
        assert not initial["errors"], initial
        assert "启动失败" not in initial["body"] and "Failed to fetch" not in initial["body"], initial
        assert "T07" in initial["title"], initial
        assert initial["sliders"] == 12, initial
        assert initial["t07"].get("ready") is True, initial
        assert initial["t07"].get("microscopeAffectsGeometry") is True, initial
        assert initial["t07"].get("rootConnectedPruning") is True, initial
        assert initial["build"].get("runtimeGLB") == 0, initial
        assert initial["build"].get("runtimeTextures") == 0, initial
        assert initial["build"].get("networkFetches") == 0, initial
        fine = initial["fine"]
        assert fine == {"min": "0", "max": "1", "step": "0.001", "value": "0.220"}, initial
        assert not initial["overflow"], initial

        qa = initial["qa"]
        assert qa.get("runtimeGLB") == 0 and qa.get("runtimeTextures") == 0, initial
        assert qa.get("networkFetches") == 0 and qa.get("continuousTube") is True, initial
        assert qa.get("microscopeGeometry") is True, initial
        assert qa.get("allActiveRootConnected") is True, initial
        assert qa.get("disconnectedActiveEdges") == 0, initial
        assert qa.get("visualAcceptance") is False and qa.get("productionReady") is False, initial
        assert qa.get("growthPaths", 0) > 0 and qa.get("activeEdges", 0) > 0, initial

        if require_all_visible:
            assert initial["mainWidthRatio"] >= 0.985, initial
            assert initial["allVisible"] and initial["dockVisible"], initial
            assert initial["controlsBottom"] <= height + 2, initial
        else:
            assert initial["mainWidthRatio"] >= 0.96, initial

        def probe(slider_id: str, value: float) -> dict[str, Any]:
            sid = json.dumps(slider_id)
            sval = json.dumps(str(value))
            expression = f'''JSON.stringify((()=>{{
              const e=document.getElementById({sid});
              if(!e)throw new Error('missing slider '+{sid});
              e.value={sval};
              e.dispatchEvent(new Event('input',{{bubbles:true}}));
              const q=window.__CORAL_R06_QA__||{{}};
              return {{
                id:{sid},value:Number(e.value),
                geometrySignature:q.geometrySignature,
                mediumDisplacementRms:q.mediumDisplacementRms,
                microDisplacementRms:q.microDisplacementRms,
                maxMediumDisplacement:q.maxMediumDisplacement,
                maxMicroDisplacement:q.maxMicroDisplacement,
                tipExtensionMean:q.tipExtensionMean,
                tipCount:q.tipCount,
                verrucaeCount:q.verrucaeCount,
                paths:q.growthPaths,activeEdges:q.activeEdges,
                candidateEdges:q.candidateEdges,
                prunedDisconnectedEdges:q.rootConnectedPrunedEdges,
                rootConnected:q.allActiveRootConnected,
                disconnectedActiveEdges:q.disconnectedActiveEdges,
                fineThreshold:q.fineThreshold
              }};
            }})())'''
            return json.loads(evaluate(expression))

        micro_0 = probe("micro", 0)
        micro_1 = probe("micro", 1)
        assert abs(micro_0["microDisplacementRms"]) < 1e-10, (micro_0, micro_1)
        assert micro_1["microDisplacementRms"] > 0.003, (micro_0, micro_1)
        assert micro_1["maxMicroDisplacement"] > 0.015, (micro_0, micro_1)
        assert micro_0["geometrySignature"] != micro_1["geometrySignature"], (micro_0, micro_1)

        rough_0 = probe("rough", 0)
        rough_1 = probe("rough", 1)
        assert abs(rough_0["mediumDisplacementRms"]) < 1e-10, (rough_0, rough_1)
        assert rough_1["mediumDisplacementRms"] > 0.008, (rough_0, rough_1)
        assert rough_1["maxMediumDisplacement"] > 0.03, (rough_0, rough_1)
        assert rough_0["geometrySignature"] != rough_1["geometrySignature"], (rough_0, rough_1)

        tip_low = probe("tip", 0.45)
        tip_high = probe("tip", 1.45)
        assert tip_low["tipCount"] > 0 and tip_high["tipCount"] == tip_low["tipCount"], (tip_low, tip_high)
        assert tip_high["tipExtensionMean"] > tip_low["tipExtensionMean"] * 1.35, (tip_low, tip_high)
        assert tip_low["geometrySignature"] != tip_high["geometrySignature"], (tip_low, tip_high)

        verrucae_0 = probe("verrucae", 0)
        verrucae_1 = probe("verrucae", 1)
        assert verrucae_0["verrucaeCount"] == 0, (verrucae_0, verrucae_1)
        assert verrucae_1["verrucaeCount"] > 0, (verrucae_0, verrucae_1)
        assert verrucae_0["geometrySignature"] != verrucae_1["geometrySignature"], (verrucae_0, verrucae_1)

        probe("micro", 1)
        grain_0 = probe("grain", 0)
        grain_1 = probe("grain", 1)
        assert grain_0["geometrySignature"] != grain_1["geometrySignature"], (grain_0, grain_1)

        cup_depth_0 = probe("cupDepth", 0)
        cup_depth_1 = probe("cupDepth", 1)
        assert cup_depth_0["geometrySignature"] != cup_depth_1["geometrySignature"], (cup_depth_0, cup_depth_1)

        cup_scale_low = probe("cupScale", 8)
        cup_scale_high = probe("cupScale", 42)
        assert cup_scale_low["geometrySignature"] != cup_scale_high["geometrySignature"], (
            cup_scale_low,
            cup_scale_high,
        )

        fine_0 = probe("fine", 0)
        fine_1 = probe("fine", 1)
        assert fine_0["paths"] < fine_1["paths"], (fine_0, fine_1)
        for state in (fine_0, fine_1):
            assert state["rootConnected"] is True, state
            assert state["disconnectedActiveEdges"] == 0, state
            assert state["activeEdges"] > 0, state
        assert fine_0["fineThreshold"] > fine_1["fineThreshold"], (fine_0, fine_1)

        for slider_id, value in DEFAULTS.items():
            probe(slider_id, value)
        restored = json.loads(
            evaluate(
                "JSON.stringify({qa:window.__CORAL_R06_QA__,t07:window.__CORAL_R06_T07__,errors:window.__qaErrors||[]})"
            )
        )
        assert not restored["errors"], restored
        assert restored["qa"].get("allActiveRootConnected") is True, restored
        assert restored["qa"].get("disconnectedActiveEdges") == 0, restored
        time.sleep(1)

        shot = call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        image = base64.b64decode(shot["data"])
        assert len(image) > 15000, len(image)
        screenshot_name = f"QA_SCREENSHOT_{label.upper()}.png"
        (root / screenshot_name).write_bytes(image)
        ws.close()

        probes = {
            "microscope_0": micro_0,
            "microscope_1": micro_1,
            "roughness_0": rough_0,
            "roughness_1": rough_1,
            "tip_low": tip_low,
            "tip_high": tip_high,
            "verrucae_0": verrucae_0,
            "verrucae_1": verrucae_1,
            "grain_0": grain_0,
            "grain_1": grain_1,
            "cup_depth_0": cup_depth_0,
            "cup_depth_1": cup_depth_1,
            "cup_scale_low": cup_scale_low,
            "cup_scale_high": cup_scale_high,
            "fine_retention_0": fine_0,
            "fine_retention_1": fine_1,
        }
        return {
            "passed": True,
            "viewport": f"{width}x{height}",
            "webgl": True,
            "runtimeErrors": 0,
            "sliderCount": 12,
            "allSlidersVisible": initial["allVisible"],
            "mainWidthRatio": initial["mainWidthRatio"],
            "defaultPaths": qa["growthPaths"],
            "defaultActiveEdges": qa["activeEdges"],
            "rootConnected": qa["allActiveRootConnected"],
            "screenshot": screenshot_name,
            "screenshotBytes": len(image),
            "probes": probes,
        }
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: coral_r06_t07_browser_qa.py <build-dir>")
    root = Path(sys.argv[1])
    results = {
        "ultrawide_2560x1080": run_view(root, "ultrawide_2560x1080", 2560, 1080, 9371, True),
        "desktop_1536x960": run_view(root, "desktop_1536x960", 1536, 960, 9372, True),
        "mobile_390x844": run_view(root, "mobile_390x844", 390, 844, 9373, False),
    }

    build_path = root / "BUILD_T07.json"
    build = json.loads(build_path.read_text(encoding="utf-8"))
    build["browserQA"] = results
    build["functionalGates"] = {
        "microscopeGeometryDifference": True,
        "mediumReliefDifference": True,
        "tipLowHighDifference": True,
        "verrucaeZeroHighDifference": True,
        "grainGeometryDifference": True,
        "cupDepthGeometryDifference": True,
        "cupScaleFrequencyDifference": True,
        "fineRetentionPathDifference": True,
        "rootConnectedAtRetentionExtremes": True,
        "runtimeErrors": 0,
    }
    build["ultrawideAllAdjustablesVisible"] = True
    build["desktopAllAdjustablesVisible"] = True
    build["mobile390x844QA"] = True
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(build, ensure_ascii=False))


if __name__ == "__main__":
    main()
