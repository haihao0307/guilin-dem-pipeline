"""Run against actual copied source-tree on GitHub, never substitute a mock.
Headless Chromium desktop/mobile-size QA is not physical iOS/Safari approval.
"""
from pathlib import Path
import hashlib, json, os, subprocess, threading, http.server, functools
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat
ROOT=Path(os.environ.get('CORAL_ROOT','kaopu-coral-fractal-lab')).resolve()
OUT=Path('coral-qa-evidence');OUT.mkdir(exist_ok=True)
anchor=ROOT/'source-tree/anchor-r01/index.html'
raw=anchor.read_bytes();sha=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
assert sha=='58c8d3dc16a0caf120aeb8805cbef777c6e5a1a6', ('source changed',sha)
(OUT/'SOURCE_ANCHOR.html').write_bytes(raw)
for name in ['index.html','app.js','coral-functions.js','scores.json','CORAL_MASTER.md']:
 assert (ROOT/name).is_file(), name
assert len(list((ROOT/'source-tree').rglob('*')))>9
handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT))
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for label,viewport,mobile in [('desktop',{'width':1440,'height':1000},False),('mobile',{'width':390,'height':844},True)]:
  context=browser.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8765/',wait_until='networkidle',timeout=60000)
  for kind in ['branch','soft','radial','massive','sheet','table']:
   page.click('[data-id="'+kind+'"]')
   page.wait_for_function('(id)=>window.coralState?.ready&&window.coralState.id===id',arg=kind,timeout=60000)
   page.wait_for_timeout(400)
   state=page.evaluate('window.coralState');assert state['triangles']>200
   frame=page.locator('#bench').content_frame
   state['finite']=page.evaluate('()=>{let g=document.getElementById("bench").contentWindow.CoralLab.getData();return g.bounds.min.concat(g.bounds.max).every(Number.isFinite)}')
   assert state['finite'];assert state['bounds']['max'][1]>state['bounds']['min'][1]
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'horizontal overflow'
   path=OUT/f'{label}-{kind}.png';page.screenshot(path=str(path),full_page=False)
   img=Image.open(path).convert('RGB');stat=ImageStat.Stat(img);assert max(stat.stddev)>15,'blank screenshot'
   deterministic=page.evaluate('()=>{let w=document.getElementById("bench").contentWindow,s=w.CoralLab.getScore(),a=JSON.stringify(w.CoralLab.getData().bounds);w.CoralLab.apply(s);return a===JSON.stringify(w.CoralLab.getData().bounds)}')
   assert deterministic;state['deterministic']=True
   frame.locator('#axes').click();page.wait_for_timeout(100)
   frame.locator('#solid').click()
   page.evaluate('()=>document.getElementById("bench").contentWindow.CoralLab.progress(.35)');page.wait_for_timeout(100)
   g=page.evaluate('document.getElementById("bench").contentWindow.studyState.growth');assert abs(g-.35)<.01
   page.evaluate('()=>document.getElementById("bench").contentWindow.CoralLab.progress(1)')
   results.append({'viewport':label,'kind':kind,**state})
  page.click('[data-id="massive"]');page.wait_for_function('window.coralState?.id==="massive"&&window.coralState.ready')
  changed=page.evaluate('()=>{let w=document.getElementById("bench").contentWindow,s=w.CoralLab.getScore();s.massive.ridgeHeight=0;w.CoralLab.apply(s);let a=JSON.stringify(w.CoralLab.getData().bounds);s.massive.ridgeHeight=.05;w.CoralLab.apply(s);return a!==JSON.stringify(w.CoralLab.getData().bounds)}');assert changed
  for original in ['anchor-r01','mobile-r02','mobile-r03-life','mobile-r04-selforg','mobile-r05-seasons','mobile-r06-annual','r01']:
   test=context.new_page();test.goto('http://127.0.0.1:8765/source-tree/'+original+'/index.html',wait_until='load');assert test.locator('canvas').count()>=1;test.close()
  assert not errors, errors
  context.close()
 browser.close()
server.shutdown()
report={'sourceBlob':sha,'tests':'12 architecture/viewport cases + deterministic replay + structural view + growth + brain geometry + 14 original workbench opens','results':results,'limits':['Headless Chromium only; not physical iPhone / Safari','Engineering morphology studies, not biological growth or approved species','Public Pages URL not exercised by this local-server QA']}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
(OUT/'SOURCE_ANCHOR.html').write_bytes(raw)
print(json.dumps(report,ensure_ascii=False,indent=2))
