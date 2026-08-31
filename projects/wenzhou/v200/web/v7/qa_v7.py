"""Exercise the actual served site; retain screenshots and errors even on failure."""
from pathlib import Path
import argparse,json,traceback
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--url',required=True);ap.add_argument('--out',required=True);ap.add_argument('--chromium',default='/usr/bin/chromium');args=ap.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
result={'schema':'wenzhou-v7-real-browser-qa-2','url':args.url,'passed':False,'cases':[],'visualAcceptance':False,'productionReady':False}
def save():
 (out/'browser-qa.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
def state(page):
 return page.evaluate('window.__WENZHOU_V7_QA__ || null')
def wait_window(page,name,size):
 page.wait_for_function('([name,size])=>{const q=window.__WENZHOU_V7_QA__;return q?.errors?.length || (q?.ready && q.activeWindow===name && q.terrainSourceGrid?.[0]===size)}',arg=[name,size],timeout=120000)
 q=state(page);assert q and q['ready'] and not q['errors'],q
 page.wait_for_timeout(700)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 result['browserVersion']=browser.version
 try:
  for name,width,height,mobile in [('desktop',1440,960,False),('mobile',390,844,True)]:
   case={'name':name,'viewport':[width,height],'passed':False,'step':'open','consoleErrors':[],'consoleWarnings':[],'pageErrors':[],'failedRequests':[],'badResponses':[],'imageRequests':[]};result['cases'].append(case)
   ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=mobile,has_touch=mobile);page=ctx.new_page()
   def log(m):
    if m.type in ('warning','error'):
     case['consoleErrors' if m.type=='error' else 'consoleWarnings'].append(m.text)
     print('BROWSER',name,m.type,m.text,flush=True)
   page.on('console',log)
   page.on('pageerror',lambda e:case['pageErrors'].append(str(e)))
   page.on('requestfailed',lambda r:case['failedRequests'].append({'url':r.url,'failure':r.failure}))
   page.on('response',lambda r:case['badResponses'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
   page.on('request',lambda r:case['imageRequests'].append(r.url) if r.resource_type=='image' and not r.url.startswith('data:') else None)
   try:
    print('OPEN',name,args.url,flush=True);res=page.goto(args.url,wait_until='domcontentloaded',timeout=120000);assert res and res.status==200;case['httpStatus']=res.status
    case['step']='native-dongtou';wait_window(page,'dongtou',513);q=state(page);case['initial']=q
    assert q['version']=='v7-numeric-repair-r2' and q['sourceSpacingM']==12.5 and q['geometryGrid']==[513,513],q
    assert q['imageRequests']==0 and q['surfaceTriangles']>0 and q['riverSourceParts']==6797 and q['shaderProgramLinked'],q
    page.screenshot(path=str(out/f'{name}-dongtou.png'))
    case['step']='visible-water';page.evaluate('document.querySelector("#waterOn").checked=false;window.__V7__.draw()');page.wait_for_timeout(400);page.screenshot(path=str(out/f'{name}-water-off.png'))
    a=np.array(Image.open(out/f'{name}-dongtou.png').convert('RGB'));c=np.array(Image.open(out/f'{name}-water-off.png').convert('RGB'));x0=int(width*.38) if not mobile else 0;y0=int(height*.18);delta=np.max(np.abs(a[y0:height-80,x0:].astype('int16')-c[y0:height-80,x0:].astype('int16')),axis=2);changed=int((delta>12).sum());case['waterToggleChangedPixels']=changed;assert changed>2000,changed
    page.evaluate('document.querySelector("#waterOn").checked=true');old=state(page)['eye'];page.mouse.move(width*.75,height*.55);page.mouse.wheel(0,-120);page.wait_for_timeout(600);new=state(page)['eye'];assert np.linalg.norm(np.array(new)-old)>1
    if mobile:page.locator('#menu').click()
    case['step']='native-feiyun';page.locator('[data-window="feiyun"]').click();wait_window(page,'feiyun',129);q=state(page);case['nativeDetail']=q;assert q['sourceSpacingM']==12.5 and q['nativeDetailLoaded'] and q['geometryGrid']==[129,129] and q['riverVisibleParts']>0,q
    case['step']='tide-high';page.locator('[data-tide="1.36"]').click();page.wait_for_function('window.__WENZHOU_V7_QA__.tide===1.36',timeout=30000);page.wait_for_timeout(350);page.screenshot(path=str(out/f'{name}-feiyun-high.png'))
    case['step']='tide-low';page.locator('[data-tide="-1.15"]').click();page.wait_for_function('window.__WENZHOU_V7_QA__.tide===-1.15',timeout=30000);page.wait_for_timeout(350);page.screenshot(path=str(out/f'{name}-feiyun-low.png'))
    case['step']='ground-collision';page.locator('#ground').click();page.wait_for_function('window.__WENZHOU_V7_QA__.groundMode && window.__WENZHOU_V7_QA__.clearanceM>=1.6 && window.__WENZHOU_V7_QA__.clearanceM<2',timeout=30000)
    page.keyboard.down('KeyW');page.wait_for_timeout(800);page.keyboard.up('KeyW');page.wait_for_timeout(500);q=state(page);case['ground']=q;assert q['clearanceM']>=1.6 and q['minClearanceM']>=1.6,q
    if mobile:page.locator('#menu').click()
    page.screenshot(path=str(out/f'{name}-ground.png'))
    for key in ['consoleErrors','pageErrors','failedRequests','badResponses','imageRequests']:assert not case[key],(key,case[key])
    assert not q['errors'],q['errors'];case['passed']=True;case['step']='complete';save();print('PASS',name,'water pixels',changed,'clearance',q['clearanceM'],flush=True)
   except Exception as e:
    case['error']=str(e);case['traceback']=traceback.format_exc()
    try:
     case['state']=state(page);case['visibleError']=page.locator('#errorText').inner_text();case['status']=page.locator('#status').inner_text();page.screenshot(path=str(out/f'{name}-failure.png'))
    except Exception as capture:case['evidenceCaptureError']=str(capture)
    save();print(json.dumps(case,indent=2,ensure_ascii=False),flush=True);raise
   finally:ctx.close()
  result['passed']=True
 except Exception as e:
  result['error']=str(e);result['traceback']=traceback.format_exc()
 finally:browser.close();save()
print(json.dumps({'passed':result['passed'],'cases':len(result['cases']),'out':str(out)},indent=2))
if not result['passed']:raise SystemExit(1)
