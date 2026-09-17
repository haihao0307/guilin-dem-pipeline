"""Actual desktop/mobile browser diagnostics at production settings; no physical-device FPS claim."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import threading,json,time,base64,traceback,os
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'releases/v0.1.6.0';EVIDENCE=Path('/tmp/stone-money-qa');EVIDENCE.mkdir(exist_ok=True)
ENTRY='releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html'
server=ThreadingHTTPServer(('127.0.0.1',8765),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=os.environ.get('STONE_MONEY_PUBLIC_URL','http://127.0.0.1:8765/'+ENTRY)
report={'version':'0.1.6.0','testedUrl':base,'browserPassed':False,'publicHttpsPassed':False,'shareAllowed':False,'physicalDeviceTest':False,'visualAcceptance':False,'cases':[]}
def snapshot(page,name):
 page.evaluate('OceanIsland.holdForReview()')
 try:
  page.screenshot(path=str(EVIDENCE/(name+'.png')),timeout=15000)
 finally:page.evaluate('OceanIsland.resumeFromReview()')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 for name,w,h in [('desktop',960,540),('mobile',390,844)]:
  ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=name=='mobile',has_touch=name=='mobile');page=ctx.new_page();page.set_default_timeout(60000)
  errors=[];console=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:console.append(m.text) if m.type=='error' else None)
  page.on('requestfailed',lambda r:requests.append({'url':r.url,'failure':r.failure}))
  result={'name':name,'viewport':[w,h],'pageErrors':errors,'consoleErrors':console,'requestFailures':requests,'passed':False}
  try:
   page.goto(base,wait_until='domcontentloaded',timeout=45000)
   page.wait_for_function("window.OceanIsland?.qa.ready || document.getElementById('error')?.textContent.trim()",timeout=140000)
   result['errorPanel']=page.locator('#error').inner_text();result['qa']=page.evaluate('window.OceanIsland?.qa || null')
   assert result['qa'] and result['qa']['ready'],result['errorPanel']
   snapshot(page,name+'-overview')
   result['cloudAtlasFrames']=page.evaluate('StoneMoneyFrozenOcean.qa.cloudAtlasFrames');assert result['cloudAtlasFrames']>0
   before=page.evaluate('[PalauSurvivalGame.state.x,PalauSurvivalGame.state.z]')
   page.locator('#canoeDrive').click()
   if name=='mobile':
    box=page.locator('[data-boat="forward"]').bounding_box();assert box and box['y']+box['height']<=h
    page.locator('[data-boat="forward"]').dispatch_event('pointerdown',{'pointerId':1,'pointerType':'touch','isPrimary':True})
   else:page.keyboard.down('w')
   page.wait_for_function('p=>Math.hypot(PalauSurvivalGame.state.x-p[0],PalauSurvivalGame.state.z-p[1])>.06',arg=before,timeout=70000)
   if name=='mobile':page.locator('[data-boat="forward"]').dispatch_event('pointerup',{'pointerId':1,'pointerType':'touch','isPrimary':True})
   else:page.keyboard.up('w')
   after=page.evaluate('[PalauSurvivalGame.state.x,PalauSurvivalGame.state.z]');result['travelM']=sum((a-b)**2 for a,b in zip(after,before))**.5
   snapshot(page,name+'-canoe')
   page.locator('#canoeDrive').click();page.locator('[data-view="deepfish"]').click()
   page.wait_for_timeout(1200);snapshot(page,name+'-deep')
   result['finalQa']=page.evaluate('OceanIsland.qa');assert not result['finalQa'].get('glErrors')
   assert not errors and not console and not requests
   assert page.evaluate('document.querySelectorAll("canvas").length')==1
   result['passed']=True
  except Exception as e:
   result['failure']=str(e);result['trace']=traceback.format_exc()
   try:result['errorPanel']=page.locator('#error').inner_text(timeout=1000)
   except Exception:pass
  report['cases'].append(result);ctx.close()
  if not result['passed']:break
 report['browserPassed']=len(report['cases'])==2 and all(r['passed'] for r in report['cases']);browser.close()
server.shutdown()
filename='PUBLIC_BROWSER_QA.json' if base.startswith('https://') else 'BROWSER_QA.json'
(OUT/filename).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
