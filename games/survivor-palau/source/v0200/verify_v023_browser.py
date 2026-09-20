"""Real-browser gate for the V0.2.3 archipelago/flyview iteration."""
from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
import traceback

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "releases" / "v0.2.3"
EVIDENCE = Path("/tmp/stone-money-v0230-qa")
EVIDENCE.mkdir(parents=True, exist_ok=True)
ENTRY = "releases/v0.2.3/index.html?qa=1"

server = ThreadingHTTPServer(
    ("127.0.0.1", 8765), partial(SimpleHTTPRequestHandler, directory=str(ROOT))
)
threading.Thread(target=server.serve_forever, daemon=True).start()

report = {
    "version": "0.2.3",
    "browserPassed": False,
    "visualAcceptance": False,
    "physicalDeviceTest": False,
    "cases": [],
}


def review_shot(page, path: Path) -> None:
    page.evaluate(
        "Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('GPU review timeout')),30000))])"
    )
    try:
        page.screenshot(path=str(path), timeout=20_000)
    finally:
        page.evaluate("OceanIsland.resumeFromReview()")


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
        page.set_default_timeout(35_000)
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
                timeout=160_000,
            )
            error_panel = page.locator("#error").inner_text()
            assert not error_panel, error_panel
            assert page.evaluate(
                "OceanIsland.qa.ready && !!window.StoneMoneyShoreline && !!window.StoneMoneyWorld && !!window.StoneMoneySurvival"
            )

            world = page.evaluate(
                """() => {
                  const cfg=OceanIsland.getState().config;
                  const radial=[];
                  for(let r=0;r<=190;r+=1) radial.push(StoneMoneyShoreline.physicalWaterAt(r,0,0));
                  const dry=radial.find(q=>q.bed>q.runupCeiling+.05 && q.allowed===false);
                  const wet=radial.find(q=>q.depth>.16 && q.allowed===true);
                  const trench=OceanIsland.sampleBed(...StoneMoneyWorld.deepProbe);
                  const flank=OceanIsland.sampleBed(-95,-132);
                  return {
                    radius:cfg.radius,beachWidth:cfg.beachWidth,shelfWidth:cfg.shelfWidth,
                    runup:cfg.runup,foam:cfg.foam,curl:[cfg.curlOuter,cfg.curlMiddle,cfg.curlInner],
                    dry,wet,label:OceanIsland.qa.shoreline,world:StoneMoneyWorld,
                    trench,flank,karstCount:OceanIsland.qa.karstFormationCount,
                    canvases:document.querySelectorAll('canvas').length
                  };
                }"""
            )
            assert world["radius"] == 92
            assert world["beachWidth"] == 50
            assert world["shelfWidth"] == 84
            assert world["runup"] <= 0.18
            assert world["label"] == "physical-bed-water-permission-v023"
            assert world["canvases"] == 1
            assert world["dry"] and world["dry"]["allowed"] is False
            assert world["wet"] and world["wet"]["allowed"] is True
            assert world["curl"] == [0, 0, 0]
            assert world["foam"] <= 0.06
            assert world["world"]["aerialReview"] is True
            assert world["world"]["archSeeds"] == [1163, 1181, 1201]
            assert world["trench"] < world["flank"] - 8, (world["trench"], world["flank"])
            assert world["karstCount"] >= 19
            case["worldRelations"] = world

            page.locator("#smiStart").click()
            page.wait_for_function("StoneMoneySurvival.getMode()==='playing'", timeout=25_000)
            page.wait_for_timeout(2_000)
            life = page.evaluate(
                """() => {
                  const g=StoneMoneySurvival,d=g.diagnostics(),state=g.getState();
                  const defs=g.getDefinitions(),rai=defs.find(x=>x.id==='rai-01');
                  const rock=OceanIsland.sampleRock(rai.x,rai.z);
                  const live=g.getFish().filter(f=>f.state==='swimming');
                  const checks=live.map(f=>{
                    const w=OceanIsland.sampleWater(f.pos[0],f.pos[2],state.worldSeconds);
                    const bed=OceanIsland.sampleBed(f.pos[0],f.pos[2]);
                    return {id:f.id,submerged:f.submerged,y:f.pos[1],surface:w.eta,bed,depth:w.eta-bed,
                      valid:f.submerged&&f.pos[1]<w.eta-.05&&f.pos[1]>bed+.05};
                  });
                  return {diag:d,rai,rock,raiSupported:rai.x===112&&rai.z===23&&rai.position[1]>rock+.7,
                    checks,valid:checks.length>0&&checks.every(x=>x.valid)};
                }"""
            )
            assert life["diag"]["shelterSlabCount"] == 0
            assert life["diag"]["fishWaterViolations"] == 0
            assert life["diag"]["submergedFishCount"] > 0
            assert life["diag"]["fishBoneSegments"] == 9
            assert life["diag"]["fishSource"] == "ocean-life-mother-r02-fixed-chain-method"
            assert life["raiSupported"], life
            assert life["valid"], life["checks"]
            case["lifeRelations"] = life

            review_shot(page, EVIDENCE / f"{name}-shore-v023.png")

            page.locator("#smiAerial").click()
            page.wait_for_function("StoneMoneySurvival.isAerial()===true", timeout=10_000)
            page.wait_for_timeout(1_500)
            assert "返回地面" in page.locator("#smiAerial").inner_text()
            case["aerialViewActive"] = True
            review_shot(page, EVIDENCE / f"{name}-aerial-v023.png")

            if name == "mobile":
                joy = page.locator("#smiJoy").bounding_box()
                primary = page.locator("#smiPrimary").bounding_box()
                aerial = page.locator("#smiAerial").bounding_box()
                assert joy and primary and aerial
                assert joy["y"] + joy["height"] <= height
                assert primary["y"] + primary["height"] <= height
                assert aerial["y"] + aerial["height"] <= height
                case["touchControlsInViewport"] = True

            gl_errors = page.evaluate("OceanIsland.qa.glErrors || []")
            assert not gl_errors, gl_errors
            assert not errors and not failed_requests
            case["passed"] = True
        except Exception as exc:
            case["failure"] = str(exc)
            case["trace"] = traceback.format_exc()
            try:
                page.screenshot(path=str(EVIDENCE / f"{name}-failure-v023.png"), timeout=10_000)
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
(OUT / "WORLD_BROWSER_QA.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(report, ensure_ascii=False, indent=2))
if not report["browserPassed"]:
    raise SystemExit(1)
