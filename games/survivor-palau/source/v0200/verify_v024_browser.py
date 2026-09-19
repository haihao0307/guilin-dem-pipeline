"""Real-browser gate for Stone Money Island V0.2.4."""
from __future__ import annotations
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import json,threading,traceback
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'releases'/'v0.2.4'
EVIDENCE=Path('/tmp/stone-money-v0240-qa');EVIDENCE.mkdir(parents=True,exist_ok=True)
ENTRY='releases/v0.2.4/index.html'
server=ThreadingHTTPServer(('127.0.0.1',8767),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={'version':'0.2.4','browserPassed':False,'visualAcceptance':False,'physicalDeviceTest':False,'cases':[]}

def pale_fraction(path:Path,box):
 im=Image.open(path).convert('RGB').crop(box)
 px=list(im.getdata())
 return sum(1 for r,g,b in px if (r+g+b)/3>210)/max(1,len(px))

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 for name,width,height in [('desktop',960,540),('mobile',390,844)]:
  ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=name=='mobile',has_touch=name=='mobile')
  page=ctx.new_page();page.set_default_timeout(30000)
  errors=[];failed=[]
  page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
  page.on('requestfailed',lambda request:failed.append(request.url))
  case={'name':name,'viewport':[width,height],'passed':False,'errors':errors,'failedRequests':failed};report['cases'].append(case)
  try:
   page.goto('http://127.0.0.1:8767/'+ENTRY,wait_until='domcontentloaded',timeout=60000)
   page.wait_for_function("window.OceanIsland?.qa.ready || document.getElementById('error')?.textContent.trim()",timeout=150000)
   assert not page.locator('#error').inner_text()
   assert page.evaluate("OceanIsland.qa.ready && StoneMoneyShoreline && StoneMoneySurvival")
   shore=page.evaluate("""() => {
    const out=[];
    for(const t of [0,3,6,9,12]){
      let dry=0,wet=0,bad=0;
      for(let r=60;r<=120;r+=1){
        const q=StoneMoneyShoreline.physicalWaterAt(r,0,t);
        if(q.allowed) wet++; else dry++;
        if(q.allowed && (q.physicalDepth<=.008 || q.bed>=q.runupCeiling)) bad++;
      }
      out.push({t,dry,wet,bad});
    }
    return {label:OceanIsland.qa.shoreline,out};
   }""")
   assert shore['label']=='physical-bed-water-permission-v024'
   assert all(x['dry']>0 and x['wet']>0 and x['bad']==0 for x in shore['out']),shore
   case['shorelineSweep']=shore

   page.locator('#smiStart').click();page.wait_for_function("StoneMoneySurvival.getMode()==='playing'",timeout=25000);page.wait_for_timeout(1200)
   life=page.evaluate("""() => {
    const g=StoneMoneySurvival,d=g.diagnostics(),fish=g.getFish().filter(f=>f.state==='swimming');
    const rai=g.getDefinitions().find(x=>x.type==='rai');
    return {diag:d,rai,fish:fish.length,submerged:fish.filter(f=>f.submerged).length};
   }""")
   assert life['rai'] and life['rai']['x']==-178 and life['rai']['z']==104
   assert life['diag']['fishWaterViolations']==0 and life['submerged']>0
   case['life']=life

   page.evaluate("StoneMoneySurvival.setCameraMode('aerial')");page.wait_for_timeout(700)
   assert page.evaluate("StoneMoneySurvival.getCameraMode()==='aerial'")
   page.evaluate("Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('GPU aerial timeout')),30000))])")
   aerial=EVIDENCE/f'{name}-aerial.png'
   try: page.screenshot(path=str(aerial),timeout=20000)
   finally: page.evaluate('OceanIsland.resumeFromReview()')
   if name=='desktop':
    left=pale_fraction(aerial,(0,270,40,370));right=pale_fraction(aerial,(920,270,960,370))
    case['aerialPaleEdgeFraction']={'left':left,'right':right}
    assert left<.25 and right<.25,case['aerialPaleEdgeFraction']

   page.evaluate("StoneMoneySurvival.setCameraMode('arch')");page.wait_for_timeout(700)
   assert page.evaluate("StoneMoneySurvival.getCameraMode()==='arch'")
   page.evaluate("Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('GPU arch timeout')),30000))])")
   arch=EVIDENCE/f'{name}-arch.png'
   try: page.screenshot(path=str(arch),timeout=20000)
   finally: page.evaluate('OceanIsland.resumeFromReview()')

   page.evaluate("StoneMoneySurvival.setCameraMode('fish')");page.wait_for_timeout(700)
   assert page.evaluate("StoneMoneySurvival.getCameraMode()==='fish'")
   page.evaluate("Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('GPU fish timeout')),30000))])")
   fishshot=EVIDENCE/f'{name}-fish.png'
   try: page.screenshot(path=str(fishshot),timeout=20000)
   finally: page.evaluate('OceanIsland.resumeFromReview()')

   if name=='mobile':
    for sel in ['#smiJoy','#smiPrimary','#smiAerial','#smiArchView','#smiFishView']:
     box=page.locator(sel).bounding_box();assert box and box['y']+box['height']<=height,(sel,box)
   assert not page.evaluate('OceanIsland.qa.glErrors || []')
   assert not errors and not failed,(errors,failed)
   case['passed']=True
  except Exception as exc:
   case['failure']=str(exc);case['trace']=traceback.format_exc()
   try: page.screenshot(path=str(EVIDENCE/f'{name}-failure.png'),timeout=10000)
   except Exception: pass
  finally: ctx.close()
  if not case['passed']: break
 report['browserPassed']=len(report['cases'])==2 and all(x['passed'] for x in report['cases'])
 browser.close()
server.shutdown()
(OUT/'BROWSER_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['browserPassed']: raise SystemExit(1)
