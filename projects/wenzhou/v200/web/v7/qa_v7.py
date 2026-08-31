from pathlib import Path
import argparse,json,time,traceback
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--url',required=True);ap.add_argument('--out',required=True);ap.add_argument('--chromium',default='/usr/bin/chromium');args=ap.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
result={'schema':'wenzhou-v7-real-browser-qa-1','url':args.url,'passed':False,'cases':[],'visualAcceptance':False,'productionReady':False};page=None
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  result['browserVersion']=b.version
  for name,width,height,mobile in [('desktop',1440,960,False),('mobile',390,844,True)]:
   ctx=b.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
   page=ctx.new_page();errors=[];warnings=[];failed=[];bad=[];images=[];logs=[]
   page.on('console',lambda m: logs.append({'type':m.type,'text':m.text}) if m.type in ('warning','error') else None)
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('requestfailed',lambda r:failed.append({'url':r.url,'failure':r.failure}))
   page.on('response',lambda r:bad.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
   page.on('request',lambda r:images.append(r.url) if r.resource_type=='image' and not r.url.startswith('data:') else None)
   print('OPEN',name,args.url,flush=True);res=page.goto(args.url,wait_until='domcontentloaded',timeout=180000);assert res.status==200
   page.wait_for_function('window.__WENZHOU_V7_QA__?.ready && window.__WENZHOU_V7_QA__.activeWindow==="dongtou" && window.__WENZHOU_V7_QA__.terrainSourceGrid[0]===513',timeout=180000);page.wait_for_timeout(1800)
   state=page.evaluate('window.__WENZHOU_V7_QA__');assert state['version']=='v7-numeric-first-view-r1';assert state['sourceSpacingM']==12.5 and state['imageRequests']==0 and state['surfaceTriangles']>0 and state['riverSourceParts']==6797
   page.screenshot(path=str(out/f'{name}-dongtou.png'))
   page.evaluate('document.querySelector("#waterOn").checked=false;window.__V7__.draw()');page.wait_for_timeout(600);page.screenshot(path=str(out/f'{name}-water-off.png'))
   a=np.array(Image.open(out/f'{name}-dongtou.png').convert('RGB'));c=np.array(Image.open(out/f'{name}-water-off.png').convert('RGB'));x0=int(width*.38) if not mobile else 0;y0=int(height*.18);diff=np.max(np.abs(a[y0:height-80,x0:].astype('int16')-c[y0:height-80,x0:].astype('int16')),axis=2);changed=int((diff>12).sum());assert changed>2000,changed
   page.evaluate('document.querySelector("#waterOn").checked=true');old=page.evaluate('window.__WENZHOU_V7_QA__.eye');page.mouse.move(width*.75,height*.55);page.mouse.wheel(0,-120);page.wait_for_timeout(600);new=page.evaluate('window.__WENZHOU_V7_QA__.eye');assert np.linalg.norm(np.array(new)-old)>1
   if mobile:page.locator('#menu').click()
   page.locator('[data-window="feiyun"]').click();page.wait_for_function('window.__WENZHOU_V7_QA__?.activeWindow==="feiyun" && window.__WENZHOU_V7_QA__.terrainSourceGrid[0]===129',timeout=180000);page.wait_for_timeout(1200)
   detail=page.evaluate('window.__WENZHOU_V7_QA__');assert detail['sourceSpacingM']==12.5 and detail['nativeDetailLoaded'] and detail['riverVisibleParts']>0
   page.locator('[data-tide="1.36"]').click();page.wait_for_function('window.__WENZHOU_V7_QA__.tide===1.36',timeout=30000);page.wait_for_timeout(350);page.screenshot(path=str(out/f'{name}-feiyun-high.png'))
   page.locator('[data-tide="-1.15"]').click();page.wait_for_function('window.__WENZHOU_V7_QA__.tide===-1.15',timeout=30000);page.wait_for_timeout(350);page.screenshot(path=str(out/f'{name}-feiyun-low.png'))
   page.locator('#ground').click();page.wait_for_function('window.__WENZHOU_V7_QA__.groundMode && window.__WENZHOU_V7_QA__.clearanceM>=1.6 && window.__WENZHOU_V7_QA__.clearanceM<2',timeout=30000)
   page.keyboard.down('KeyW');page.wait_for_timeout(800);page.keyboard.up('KeyW');page.wait_for_timeout(500)
   ground=page.evaluate('window.__WENZHOU_V7_QA__');assert ground['clearanceM']>=1.6 and ground['minClearanceM']>=1.6
   if mobile:page.locator('#menu').click()
   page.screenshot(path=str(out/f'{name}-ground.png'));console_errors=[m for m in logs if m['type']=='error'];assert not errors and not console_errors and not failed and not bad and not images and not ground['errors'],[errors,console_errors,failed,bad]
   result['cases'].append({'name':name,'viewport':[width,height],'httpStatus':res.status,'initial':state,'nativeDetail':detail,'ground':ground,'waterToggleChangedPixels':changed,'consoleErrors':console_errors,'pageErrors':errors,'failedRequests':failed,'badResponses':bad,'imageRequests':images,'consoleWarnings':[m for m in logs if m['type']=='warning'],'passed':True})
   (out/'browser-qa.json').write_text(json.dumps(result,indent=2,ensure_ascii=False));ctx.close();print('PASS',name,'waterPixels',changed,'clearance',ground['clearanceM'],flush=True)
  b.close();result['passed']=True
except Exception as e:
 result['error']=str(e);result['traceback']=traceback.format_exc()
 try:
  result['state']=page.evaluate('window.__WENZHOU_V7_QA__');page.screenshot(path=str(out/'failure.png'))
 except Exception:pass
 (out/'browser-qa.json').write_text(json.dumps(result,indent=2,ensure_ascii=False));print(json.dumps(result,ensure_ascii=False,indent=2));raise
(out/'browser-qa.json').write_text(json.dumps(result,indent=2,ensure_ascii=False));print(json.dumps({'passed':result['passed'],'cases':len(result['cases']),'out':str(out)},indent=2))
