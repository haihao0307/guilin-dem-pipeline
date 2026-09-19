"""Real-browser gate for Stone Money Island V0.2.3 rapid iteration."""
from __future__ import annotations
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import json,threading,traceback
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"releases"/"v0.2.3"
EVIDENCE=Path("/tmp/stone-money-v0230-qa");EVIDENCE.mkdir(parents=True,exist_ok=True)
ENTRY="releases/v0.2.3/index.html"
server=ThreadingHTTPServer(("127.0.0.1",8766),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={"version":"0.2.3","browserPassed":False,"visualAcceptance":False,"physicalDeviceTest":False,"cases":[]}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-dev-shm-usage"])
 for name,width,height in [("desktop",960,540),("mobile",390,844)]:
  context=browser.new_context(viewport={"width":width,"height":height},device_scale_factor=1,is_mobile=name=="mobile",has_touch=name=="mobile")
  page=context.new_page();page.set_default_timeout(30000)
  errors=[];failed=[]
  page.on("pageerror",lambda exc:errors.append(str(exc)))
  page.on("console",lambda msg:errors.append(msg.text) if msg.type=="error" else None)
  page.on("requestfailed",lambda request:failed.append(request.url))
  case={"name":name,"viewport":[width,height],"passed":False,"errors":errors,"failedRequests":failed};report["cases"].append(case)
  try:
   page.goto("http://127.0.0.1:8766/"+ENTRY,wait_until="domcontentloaded",timeout=60000)
   page.wait_for_function("window.OceanIsland?.qa.ready || document.getElementById('error')?.textContent.trim()",timeout=150000)
   assert not page.locator("#error").inner_text()
   assert page.evaluate("OceanIsland.qa.ready && !!window.StoneMoneyShoreline && !!window.StoneMoneySurvival")
   physical=page.evaluate("""() => {
    const dry=StoneMoneyShoreline.physicalWaterAt(45,0,0);
    const wet=StoneMoneyShoreline.physicalWaterAt(96,0,0);
    const trench=OceanIsland.sampleBed(176,-168);
    return {dry,wet,trench,label:OceanIsland.qa.shoreline};
   }""")
   assert physical["label"]=="physical-bed-water-permission-v023"
   assert physical["dry"]["allowed"] is False
   assert physical["wet"]["allowed"] is True
   assert physical["trench"] < -100
   case["physical"]=physical

   page.locator("#smiStart").click()
   page.wait_for_function("StoneMoneySurvival.getMode()==='playing'",timeout=25000)
   page.wait_for_timeout(1500)
   life=page.evaluate("""() => {
    const g=StoneMoneySurvival,defs=g.getDefinitions(),rai=defs.find(x=>x.type==='rai'),d=g.diagnostics();
    const fish=g.getFish().filter(f=>f.state==='swimming');
    return {rai,diag:d,fishCount:fish.length,submerged:fish.filter(f=>f.submerged).length};
   }""")
   assert life["rai"] and life["rai"]["x"]==-178 and life["rai"]["z"]==104
   assert life["rai"]["position"][1] > 1
   assert life["diag"]["fishWaterViolations"]==0
   assert life["submerged"]>0
   case["life"]=life

   page.evaluate("StoneMoneySurvival.setCameraMode('aerial')")
   page.wait_for_timeout(650)
   assert page.evaluate("StoneMoneySurvival.getCameraMode()==='aerial'")
   page.evaluate("Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('GPU aerial timeout')),30000))])")
   try: page.screenshot(path=str(EVIDENCE/f"{name}-aerial.png"),timeout=20000)
   finally: page.evaluate("OceanIsland.resumeFromReview()")

   page.evaluate("StoneMoneySurvival.setCameraMode('fish')")
   page.wait_for_timeout(650)
   assert page.evaluate("StoneMoneySurvival.getCameraMode()==='fish'")
   page.evaluate("Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('GPU fish timeout')),30000))])")
   try: page.screenshot(path=str(EVIDENCE/f"{name}-fish.png"),timeout=20000)
   finally: page.evaluate("OceanIsland.resumeFromReview()")

   assert not page.evaluate("OceanIsland.qa.glErrors || []")
   assert not errors and not failed
   if name=="mobile":
    for sel in ["#smiJoy","#smiPrimary","#smiAerial","#smiFishView"]:
     box=page.locator(sel).bounding_box();assert box and box["y"]+box["height"]<=height
   case["passed"]=True
  except Exception as exc:
   case["failure"]=str(exc);case["trace"]=traceback.format_exc()
   try: page.screenshot(path=str(EVIDENCE/f"{name}-failure.png"),timeout=10000)
   except Exception: pass
  finally: context.close()
  if not case["passed"]: break
 report["browserPassed"]=len(report["cases"])==2 and all(x["passed"] for x in report["cases"])
 browser.close()
server.shutdown()
(OUT/"RAPID_BROWSER_QA.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report["browserPassed"]: raise SystemExit(1)
