"""Real-browser gate for the V0.2.2 physical beach correction."""
from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
import traceback

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "releases" / "v0.2.2"
EVIDENCE = Path("/tmp/stone-money-v0220-qa")
EVIDENCE.mkdir(parents=True, exist_ok=True)
ENTRY = "releases/v0.2.2/index.html"

server = ThreadingHTTPServer(
    ("127.0.0.1", 8765), partial(SimpleHTTPRequestHandler, directory=str(ROOT))
)
threading.Thread(target=server.serve_forever, daemon=True).start()

report = {
    "version": "0.2.2",
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
        page.set_default_timeout(30_000)
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
                timeout=60_000,
            )
            page.wait_for_function(
                "window.OceanIsland?.qa.ready || document.getElementById('error')?.textContent.trim()",
                timeout=150_000,
            )
            error_panel = page.locator("#error").inner_text()
            assert not error_panel, error_panel
            assert page.evaluate(
                "OceanIsland.qa.ready && !!window.StoneMoneyShoreline && !!window.StoneMoneySurvival"
            )

            relation = page.evaluate(
                """() => {
                  const cfg=OceanIsland.getState().config;
                  const radial=[];
                  for(let r=0;r<=170;r+=1) radial.push(StoneMoneyShoreline.physicalWaterAt(r,0,0));
                  const dry=radial.find(q=>q.bed>q.runupCeiling+.05 && q.allowed===false);
                  const wet=radial.find(q=>q.depth>.20 && q.allowed===true);
                  return {
                    radius:cfg.radius,beachWidth:cfg.beachWidth,shelfWidth:cfg.shelfWidth,
                    foam:cfg.foam,curl:[cfg.curlOuter,cfg.curlMiddle,cfg.curlInner],
                    dry,wet,label:OceanIsland.qa.shoreline,
                    canvases:document.querySelectorAll('canvas').length
                  };
                }"""
            )
            assert relation["radius"] == 92
            assert relation["beachWidth"] == 50
            assert relation["shelfWidth"] == 84
            assert relation["label"] == "physical-bed-water-permission-v022"
            assert relation["canvases"] == 1
            assert relation["dry"] and relation["dry"]["allowed"] is False
            assert relation["wet"] and relation["wet"]["allowed"] is True
            assert relation["curl"] == [0, 0, 0]
            assert relation["foam"] <= 0.06
            case["physicalShore"] = relation

            page.locator("#smiStart").click()
            page.wait_for_function("StoneMoneySurvival.getMode()==='playing'", timeout=25_000)
            page.wait_for_timeout(2_000)
            life = page.evaluate(
                """() => {
                  const g=StoneMoneySurvival,d=g.diagnostics(),state=g.getState();
                  const live=g.getFish().filter(f=>f.state==='swimming');
                  const checks=live.map(f=>{
                    const w=OceanIsland.sampleWater(f.pos[0],f.pos[2],state.worldSeconds);
                    const bed=OceanIsland.sampleBed(f.pos[0],f.pos[2]);
                    return {id:f.id,submerged:f.submerged,y:f.pos[1],surface:w.eta,bed,depth:w.eta-bed,
                      valid:f.submerged&&f.pos[1]<w.eta-.05&&f.pos[1]>bed+.05};
                  });
                  return {diag:d,checks,valid:checks.length>0&&checks.every(x=>x.valid)};
                }"""
            )
            assert life["diag"]["shelterSlabCount"] == 0
            assert life["diag"]["fishWaterViolations"] == 0
            assert life["diag"]["submergedFishCount"] > 0
            assert life["valid"], life["checks"]
            case["lifeRelations"] = life

            if name == "mobile":
                joy = page.locator("#smiJoy").bounding_box()
                primary = page.locator("#smiPrimary").bounding_box()
                assert joy and primary
                assert joy["y"] + joy["height"] <= height
                assert primary["y"] + primary["height"] <= height
                case["touchControlsInViewport"] = True

            page.evaluate(
                "Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('GPU review timeout')),30000))])"
            )
            try:
                page.screenshot(
                    path=str(EVIDENCE / f"{name}-physical-beach.png"), timeout=20_000
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
(OUT / "PHYSICAL_BROWSER_QA.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(report, ensure_ascii=False, indent=2))
if not report["browserPassed"]:
    raise SystemExit(1)
