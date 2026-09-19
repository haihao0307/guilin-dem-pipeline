"""Verify exact immutable public Stone Money Island V0.2.8 bytes and browser entry."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,json,hashlib,urllib.request,time,traceback
URL=os.environ['SMI_PUBLIC_URL'];EXPECTED=os.environ['SMI_EXPECTED_SHA256']
OUT=Path('games/survivor-palau/releases/v0.2.8');SHOTS=Path('/tmp/smi-public028');SHOTS.mkdir(exist_ok=True)
proof={'version':'0.2.8','url':URL,'entrySha256':EXPECTED,'sourceCommit':os.environ['SMI_SOURCE_COMMIT'],'pagesCommit':os.environ['SMI_PAGES_COMMIT'],'publicHttpsPassed':False,'browserPassed':False,'shareAllowed':False,'visualAcceptance':False,'physicalDeviceTest':False,'cases':[]}
def save():
 (OUT/'PUBLICATION_PROOF.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'http':proof['publicHttpsPassed'],'cases':[(x['name'],x.get('phase'),x['passed']) for x in proof['cases']]},ensure_ascii=False),flush=True)
try:
 for attempt in range(24):
  try:
   with urllib.request.urlopen(URL,timeout=25) as r:data=r.read();status=r.status
   proof['httpStatus']=status;proof['actualSha256']=hashlib.sha256(data).hexdigest();assert status==200 and proof['actualSha256']==EXPECTED
   proof['publicHttpsPassed']=True;save();break
  except Exception:
   if attempt==23:raise
   time.sleep(5)
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  for name,w,h in [('desktop',960,540),('mobile',390,844)]:
   ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=name=='mobile',has_touch=name=='mobile');page=ctx.new_page();page.set_default_timeout(30000)
   errors=[];failed=[];case={'name':name,'passed':False,'phase':'load','errors':errors,'failedRequests':failed};proof['cases'].append(case)
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('requestfailed',lambda q:failed.append(q.url))
   try:
    page.goto(URL,wait_until='domcontentloaded',timeout=60000);page.wait_for_function("window.OceanIsland?.qa.ready || document.getElementById('error')?.textContent.trim()",timeout=150000)
    assert not page.locator('#error').inner_text();assert page.evaluate("OceanIsland.qa.ready && StoneMoneySurvival && StoneMoneyShoreline")
    page.locator('#smiStart').click();page.wait_for_function("StoneMoneySurvival.getMode()==='playing'",timeout=25000)
    diag=page.evaluate('StoneMoneySurvival.diagnostics()');assert diag['archGeometry']=='dissolved-mushroom-rock-island-v028-revealed';assert diag['archPosition']==[96,208];assert diag['archOpening']['nominalMainSpan']>=23.9;assert diag['archOpening']['secondarySeaCave'] is True;assert diag['archMass']['minimumRoofThickness']>=4.9;case['arch']={'position':diag['archPosition'],'opening':diag['archOpening'],'mass':diag['archMass']}
    assert diag['fishWaterViolations']==0
    for mode in ['aerial','arch','fish']:
     case['phase']=mode;save();page.evaluate('(m)=>StoneMoneySurvival.setCameraMode(m)',mode);page.wait_for_timeout(600);assert page.evaluate('StoneMoneySurvival.getCameraMode()')==mode
     page.evaluate("Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('frame timeout')),30000))])")
     try:page.screenshot(path=str(SHOTS/f'{name}-{mode}.png'),timeout=20000)
     finally:page.evaluate('OceanIsland.resumeFromReview()')
    if name=='mobile':
     for sel in ['#smiAerial','#smiArchView','#smiFishView','#smiPrimary']:
      box=page.locator(sel).bounding_box();assert box and box['y']+box['height']<=h,(sel,box)
    assert page.locator('canvas').count()==1
    assert not page.evaluate('OceanIsland.qa.glErrors || []')
    assert not errors and not failed,(errors,failed)
    case['phase']='passed';case['passed']=True;save()
   except Exception as e:
    case['failure']=str(e);case['trace']=traceback.format_exc();case['phase']='failed';save()
   finally:ctx.close()
   if not case['passed']:break
  browser.close()
 proof['browserPassed']=len(proof['cases'])==2 and all(x['passed'] for x in proof['cases'])
 proof['shareAllowed']=proof['publicHttpsPassed'] and proof['browserPassed']
except Exception as e:
 proof['failure']=str(e);proof['trace']=traceback.format_exc()
finally:save()
if not proof['shareAllowed']:raise SystemExit(1)
