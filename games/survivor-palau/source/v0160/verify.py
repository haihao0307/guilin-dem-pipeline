"""Real-browser diagnostics. A successful CI job is not itself an acceptance."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from PIL import Image,ImageChops,ImageStat
import threading,json,time,base64,io,textwrap,os,traceback
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'releases/v0.1.6.0'
EVIDENCE=Path('/tmp/stone-money-qa');EVIDENCE.mkdir(exist_ok=True)
ENTRY='releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html'
server=ThreadingHTTPServer(('127.0.0.1',8765),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={'version':'0.1.6.0','browserPassed':False,'publicHttpsPassed':False,'shareAllowed':False,'physicalDeviceTest':False,'visualAcceptance':False,'cases':[]}
def preview(path,name):
 im=Image.open(path).convert('RGB');im.thumbnail((360,240));b=io.BytesIO();im.save(b,format='JPEG',quality=42,optimize=True)
 (OUT/(name+'.b64')).write_text('\n'.join(textwrap.wrap(base64.b64encode(b.getvalue()).decode(),76))+'\n')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 for name,w,h in [('desktop',960,540),('mobile',390,844)]:
  ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=name=='mobile',has_touch=name=='mobile')
  page=ctx.new_page();errors=[];console=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:console.append(m.text) if m.type=='error' else None)
  page.on('requestfailed',lambda r:requests.append({'url':r.url,'failure':r.failure}))
  result={'name':name,'viewport':[w,h],'pageErrors':errors,'consoleErrors':console,'requestFailures':requests,'passed':False}
  try:
   page.goto('http://127.0.0.1:8765/'+ENTRY,wait_until='domcontentloaded',timeout=30000)
   page.wait_for_function("window.OceanIsland?.qa.ready || document.getElementById('error')?.textContent.trim()",timeout=100000)
   result['errorPanel']=page.locator('#error').inner_text()
   result['qa']=page.evaluate('window.OceanIsland?.qa || null')
   assert result['qa'] and result['qa']['ready'],result['errorPanel']
   page.wait_for_timeout(1800)
   image=EVIDENCE/(name+'-overview.png');page.screenshot(path=str(image));preview(image,name+'-overview-preview')
   result['cloudAtlasFrames']=page.evaluate('StoneMoneyFrozenOcean.qa.cloudAtlasFrames')
   assert result['cloudAtlasFrames']>0
   before=page.evaluate('[PalauSurvivalGame.state.x,PalauSurvivalGame.state.z]')
   page.locator('#canoeDrive').click()
   if name=='mobile':
    b=page.locator('[data-boat="forward"]').bounding_box();assert b and b['y']+b['height']<=h
    page.locator('[data-boat="forward"]').dispatch_event('pointerdown',{'pointerId':1,'pointerType':'touch','isPrimary':True})
    page.wait_for_timeout(2400)
    page.locator('[data-boat="forward"]').dispatch_event('pointerup',{'pointerId':1,'pointerType':'touch','isPrimary':True})
   else:
    page.keyboard.down('w');page.wait_for_timeout(2400);page.keyboard.up('w')
   after=page.evaluate('[PalauSurvivalGame.state.x,PalauSurvivalGame.state.z]')
   result['travelM']=sum((a-b)**2 for a,b in zip(after,before))**.5
   assert result['travelM']>.05,'Canoe did not move'
   image=EVIDENCE/(name+'-canoe.png');page.screenshot(path=str(image));preview(image,name+'-canoe-preview')
   page.locator('#canoeDrive').click()
   page.locator('[data-view="deepfish"]').click();page.wait_for_timeout(1600)
   image=EVIDENCE/(name+'-deep.png');page.screenshot(path=str(image));preview(image,name+'-deep-preview')
   result['finalQa']=page.evaluate('OceanIsland.qa')
   assert not result['finalQa'].get('glErrors'),str(result['finalQa'].get('glErrors'))
   assert not errors and not console and not requests
   assert page.evaluate('document.querySelectorAll("canvas").length')==1
   result['passed']=True
  except Exception as e:
   result['failure']=str(e);result['trace']=traceback.format_exc()
   try:
    result['errorPanel']=page.locator('#error').inner_text(timeout=1500)
    image=EVIDENCE/(name+'-failure.png');page.screenshot(path=str(image),timeout=10000);preview(image,name+'-failure-preview')
   except Exception:pass
  report['cases'].append(result);ctx.close()
  if not result['passed']:break
 report['browserPassed']=len(report['cases'])==2 and all(r['passed'] for r in report['cases'])
 browser.close()
server.shutdown()
(OUT/'BROWSER_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
