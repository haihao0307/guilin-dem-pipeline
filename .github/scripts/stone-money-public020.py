"""Verify normal public URL, not a QA-only entrance. Private isolated browser contexts."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,json,hashlib,urllib.request,time,traceback
URL=os.environ['SMI_PUBLIC_URL'];EXPECTED=os.environ['SMI_EXPECTED_SHA256']
OUT=Path('games/survivor-palau/releases/v0.2.0');SHOTS=Path('/tmp/smi-public020');SHOTS.mkdir(exist_ok=True)
proof={'name':'Stone Money Island','subtitle':'Survivor Palau','version':'0.2.0','url':URL,'entrySha256':EXPECTED,'sourceCommit':os.environ['SMI_SOURCE_COMMIT'],'pagesCommit':os.environ['SMI_PAGES_COMMIT'],'sourceModified':True,'interactive3D':True,'staticImageSubstitute':False,'publicHttpsPassed':False,'browserPassed':False,'shareAllowed':False,'physicalDeviceTest':False,'visualAcceptance':False,'productionReady':False,'normalUrlNoQA':True,'cases':[]}
def save():
 (OUT/'PUBLICATION_PROOF.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'http':proof['publicHttpsPassed'],'cases':[(r['name'],r.get('phase'),r['passed']) for r in proof['cases']]}),flush=True)
try:
 for attempt in range(20):
  try:
   with urllib.request.urlopen(URL,timeout=25) as response:
    data=response.read();proof['httpStatus']=response.status;proof['actualSha256']=hashlib.sha256(data).hexdigest()
   assert response.status==200 and proof['actualSha256']==EXPECTED
   proof['publicHttpsPassed']=True;save();break
  except Exception:
   if attempt==19:raise
   time.sleep(5)
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  for name,w,h in [('desktop',960,540),('mobile',390,844)]:
   ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,has_touch=name=='mobile',is_mobile=name=='mobile');page=ctx.new_page();page.set_default_timeout(25000)
   errors=[];failures=[];r={'name':name,'viewport':[w,h],'passed':False,'errors':errors,'requestFailures':failures};proof['cases'].append(r)
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('requestfailed',lambda q:failures.append(q.url))
   try:
    r['phase']='loading';save();page.goto(URL,wait_until='domcontentloaded',timeout=45000);page.wait_for_function("window.OceanIsland?.qa.ready || document.getElementById('error')?.textContent.trim()",timeout=120000)
    error=page.locator('#error').inner_text();assert not error,error;assert page.evaluate('OceanIsland.qa.ready && !!StoneMoneySurvival')
    assert page.evaluate('!StoneMoneySurvival.test'),'Normal URL must not expose QA relocation';r['noDebugMode']=True
    assert 'STONE MONEY' in page.locator('#smiMenu h1').inner_text();assert page.locator('#smiMenu h2').inner_text()=='SURVIVOR PALAU'
    page.locator('#smiMusic').click();page.locator('#smiStart').click();page.wait_for_function('StoneMoneySurvival.getMode()==="playing"');r['phase']='walking';save()
    before=page.evaluate('[StoneMoneySurvival.getState().player.x,StoneMoneySurvival.getState().player.z]')
    if name=='desktop':page.keyboard.down('s')
    else:
     b=page.locator('#smiJoy').bounding_box();assert b and b['y']+b['height']<=h
     touch=ctx.new_cdp_session(page);touch.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':b['x']+b['width']/2,'y':b['y']+b['height']/2+28,'id':1}]})
    page.wait_for_function('p=>Math.hypot(StoneMoneySurvival.getState().player.x-p[0],StoneMoneySurvival.getState().player.z-p[1])>.09',arg=before,timeout=50000)
    if name=='desktop':page.keyboard.up('s')
    else:touch.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    after=page.evaluate('[StoneMoneySurvival.getState().player.x,StoneMoneySurvival.getState().player.z]');r['walkDistance']=sum((a-b)**2 for a,b in zip(after,before))**.5
    page.locator('#smiCrouch').click();assert page.evaluate('StoneMoneySurvival.getState().player.crouched');r['crouch']=True
    r['audioContext']=page.evaluate('StoneMoneySurvival.diagnostics().audioState')
    page.evaluate("Promise.race([OceanIsland.holdForReview(),new Promise((_,reject)=>setTimeout(()=>reject(Error('completed-frame wait timeout')),25000))])")
    page.screenshot(path=str(SHOTS/(name+'-public-beach.png')),timeout=15000);page.evaluate('OceanIsland.resumeFromReview()')
    page.locator('#smiBag').click();assert page.locator('#smiJournal').is_visible();page.locator('#smiCloseJournal').click();assert page.evaluate('StoneMoneySurvival.getMode()==="playing"');r['journal']=True
    r['lastGLerror']=page.evaluate('OceanIsland.qa.glError');r['glErrors']=page.evaluate('OceanIsland.qa.glErrors||[]');assert not r['lastGLerror'] and not r['glErrors'];assert not errors and not failures
    assert page.locator('canvas').count()==1;r['singleCanvas']=True;r['passed']=True;r['phase']='passed';save()
   except Exception as e:r['failure']=str(e);r['trace']=traceback.format_exc();r['phase']='failed';save()
   finally:ctx.close()
   if not r['passed']:break
  browser.close()
 local=json.loads((OUT/'BROWSER_QA.json').read_text());build=json.loads((OUT/'BUILD_RECEIPT.json').read_text())
 proof['chapterLoopPassed']=local.get('browserPassed',False)
 proof['frozenSourceUnchanged']=build['frozenShaderAndWorkerStringsUnchanged']
 proof['qaChangesGeometry']=build.get('qaChangesGeometry',None)
 proof['browserPassed']=len(proof['cases'])==2 and all(r['passed'] for r in proof['cases'])
 proof['shareAllowed']=proof['browserPassed'] and proof['publicHttpsPassed'] and proof['chapterLoopPassed'] and build['entrySha256']==EXPECTED
except Exception as e:proof['failure']=str(e);proof['trace']=traceback.format_exc()
finally:save()
