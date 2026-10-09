"""Verify the actual public R072 assets and recompute two complete garments."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,json,time,hashlib,traceback
OUT=Path('public-r072-evidence');OUT.mkdir(exist_ok=True)
BASE='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/'
EXPECTED=os.environ['EXPECTED_SOURCE']
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];http=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:http.append({'url':r.url,'status':r.status}))
 state=lambda:page.evaluate('window.__TAILOR_CATALOGUE_QA__?.getState()')
 try:
  manifest=None
  for attempt in range(60):
   response=page.request.get(BASE+'r07/stability/R072_MANIFEST.json?check='+str(time.time()))
   if response.status==200:
    candidate=response.json()
    if candidate.get('sourceCommit')==EXPECTED:manifest=candidate;break
   time.sleep(10)
  assert manifest,'Expected R072 source has not reached public hosting'
  checks=[]
  for filename,digest in manifest['runtimeFiles'].items():
   url='https://haihao0307.github.io/guilin-dem-pipeline/'+filename
   r=page.request.get(url);assert r.status==200,(filename,r.status)
   actual=hashlib.sha256(r.body()).hexdigest();assert actual==digest,(filename,actual,digest)
   checks.append({'file':filename,'sha256':actual})
  r=page.goto(BASE+'r07/stability/r072.html?case=MetaGarmentDress')
  assert r.status==200
  page.wait_for_function("window.__TAILOR_CATALOGUE_QA__?.getState().phase==='paper'",timeout=180000)
  assert state()['version']=='R07.2'
  t=time.perf_counter();page.locator('#sew').click()
  page.wait_for_function("['complete','error'].includes(window.__TAILOR_CATALOGUE_QA__.getState().phase)",timeout=240000)
  elapsed=time.perf_counter()-t
  assert state()['phase']=='complete' and state()['staticGate']['passed'],state()
  record=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getRecord()')
  (OUT/'public-default-result.json').write_text(json.dumps(record))
  page.locator('[data-tab=evidence]').click();views=[]
  for name in ['front','back','side','full']:
   page.locator('[data-camera='+name+']').click();page.wait_for_timeout(250)
   frame=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getFraming()');assert frame['outsideViewport']==0,frame
   views.append({'camera':name,**frame});page.screenshot(path=str(OUT/('public-'+name+'.png')))
  page.locator('[data-tab=parameters]').click()
  page.locator('#parameters-list details').evaluate_all('(els)=>els.forEach(el=>el.open=true)')
  control=page.locator('[data-control="skirt.ruffle"]');control.fill('1.15');control.dispatch_event('change')
  page.locator('#generate').click();page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paper'",timeout=180000)
  sizing=state()['fitPreflight'];assert sizing['blocking'] and page.locator('#sew').is_disabled()
  assert not state()['running'] and page.evaluate('window.__TAILOR_CATALOGUE_QA__.getRecord()') is None
  page.set_viewport_size({'width':390,'height':844});page.locator('#arrange').click();page.wait_for_timeout(250)
  page.locator('[data-camera=front]').click();page.wait_for_timeout(250)
  frame=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getFraming()');assert frame['outsideViewport']==0,frame
  button=page.locator('#fit-adjust').bounding_box();assert button and button['y']+button['height']<=844,button
  assert page.evaluate('document.documentElement.scrollWidth')<=391
  page.screenshot(path=str(OUT/'public-mobile-warning.png'))
  old=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getAnalytic().recipeHash')
  page.locator('#fit-adjust').click();page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paper'",timeout=180000)
  assert not state()['fitPreflight']['blocking']
  assert page.evaluate('window.__TAILOR_CATALOGUE_QA__.getDesign().skirt.ruffle.v')==1.3
  assert old!=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getAnalytic().recipeHash')
  t=time.perf_counter();page.locator('#sew').click()
  page.wait_for_function('window.__TAILOR_CATALOGUE_QA__.getState().running',timeout=120000)
  page.locator('#pause').click();page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paused'",timeout=45000)
  pos=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getPositions()');page.wait_for_timeout(300);assert pos==page.evaluate('window.__TAILOR_CATALOGUE_QA__.getPositions()')
  page.locator('#resume').click()
  page.wait_for_function("['complete','error'].includes(window.__TAILOR_CATALOGUE_QA__.getState().phase)",timeout=240000)
  corrected_seconds=time.perf_counter()-t
  assert state()['phase']=='complete' and state()['staticGate']['passed'],state()
  corrected=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getRecord()')
  (OUT/'public-corrected-result.json').write_text(json.dumps(corrected))
  page.locator('#arrange').click();page.wait_for_timeout(250);page.locator('[data-camera=front]').click();page.wait_for_timeout(250)
  frame=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getFraming()');assert frame['outsideViewport']==0,frame
  page.screenshot(path=str(OUT/'public-mobile-result.png'))
  page.locator('#sew').click();page.wait_for_function('window.__TAILOR_CATALOGUE_QA__.getState().running',timeout=120000)
  page.locator('#cancel').click();assert not state()['running']
  failed=[r for r in http if r['status']>=400 and not r['url'].endswith('favicon.ico')]
  report={'version':'R07.2','sourceCommit':EXPECTED,'publicURL':BASE+'r07/stability/r072.html?case=MetaGarmentDress','HTMLstatus':200,'verifiedRuntimeAssets':checks,'defaultEndToEndSeconds':elapsed,'defaultGate':record['staticGate'],'correctedEndToEndIncludingPauseSeconds':corrected_seconds,'correctedGate':corrected['staticGate'],'preflight':sizing,'explicitSizingButtonTested':True,'pauseResumeCancelTested':True,'cameraChecks':views,'mobileFraming':frame,'desktopViewport':[1440,1000],'mobileViewport':[390,844],'physicalMobileDeviceTested':False,'publicFullSolves':2,'pageErrors':errors,'failedHTTP':failed,'dynamicWearCertified':False,'allGarmentsAccepted':False}
  (OUT/'PUBLIC_R072_REPORT.json').write_text(json.dumps(report,indent=2))
  print(json.dumps(report,ensure_ascii=False),flush=True)
  assert not errors and not failed,(errors,failed)
 except Exception:
  (OUT/'FAILURE.txt').write_text(traceback.format_exc());print(traceback.format_exc(),flush=True)
  try:page.screenshot(path=str(OUT/'failure.png'))
  except Exception:pass
  raise
 finally:browser.close()
