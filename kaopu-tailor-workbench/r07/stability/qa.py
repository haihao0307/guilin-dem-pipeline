"""Live-source R07.1 browser checks. Never loads a solved garment for new-style tests."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time,traceback,os,hashlib,math
OUT=Path('evidence-r071');OUT.mkdir(exist_ok=True)
BASE=os.environ.get('TAILOR_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/')
CASES=[('default',{}),('length35',{'skirt.length':.35}),('ruffle115',{'skirt.ruffle':1.15}),('ruffle145',{'skirt.ruffle':1.45}),('default-repeat',{})]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];responses=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:responses.append({'url':r.url,'status':r.status}))
 state=lambda:page.evaluate('window.__TAILOR_CATALOGUE_QA__?.getState()')
 reports=[];first_positions=None;repeat_mm=None
 try:
  for name,params in CASES:
   page.goto(BASE+'r07/stability/?case=MetaGarmentDress')
   page.wait_for_function("['paper','error'].includes(window.__TAILOR_CATALOGUE_QA__?.getState().phase)",timeout=180000)
   assert state()['phase']=='paper',state()
   assert state()['version']=='R07.1'
   for key,value in params.items():
    page.locator('#parameters-list details').evaluate_all('(els)=>els.forEach(el=>el.open=true)')
    control=page.locator(f'[data-control="{key}"]');assert control.is_enabled(),key
    control.fill(str(value));control.dispatch_event('change')
   started=time.perf_counter();page.locator('#sew').click()
   page.wait_for_function("['complete','error'].includes(window.__TAILOR_CATALOGUE_QA__.getState().phase)",timeout=240000)
   wall=time.perf_counter()-started;ss=state();record=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getRecord()')
   report={'name':name,'params':params,'endToEndSeconds':wall,'state':ss,'status':page.locator('#catalogue-status').inner_text(),'runtime':page.locator('#runtime-summary').inner_text()}
   print('CASE',name,json.dumps(report,ensure_ascii=False),flush=True)
   if record:
    assert record['trial']['physicalFitAccepted'] is False
    assert record['trial']['jointSteps']==1600
    assert record['jointRefinement']['finalEnergy']<=record['jointRefinement']['initialEnergy']
    report['joint']=record['jointRefinement'];report['gate']=record['staticGate'];report['triangleCount']=sum(len(x['triangles']) for x in record['snapshot']['spec']['panels'])
    (OUT/(name+'-result.json')).write_text(json.dumps(record))
    analytic=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getAnalytic()');(OUT/(name+'-analytic.json')).write_text(json.dumps(analytic))
    if name=='default':first_positions=record['positionsMm']
    if name=='default-repeat' and first_positions is not None:
     assert len(first_positions)==len(record['positionsMm']);repeat_mm=max(abs(a-b) for p,q in zip(first_positions,record['positionsMm']) for a,b in zip(p,q));report['repeatMaxCoordinateDifferenceMm']=repeat_mm
    page.locator('[data-tab=evidence]').click()
    for camera in ['front','back','side']:
     page.locator('[data-camera='+camera+']').click();page.wait_for_timeout(200);page.screenshot(path=str(OUT/(name+'-'+camera+'.png')))
   else:
    report['gate']={'passed':False,'failures':['incomplete-solve']};page.screenshot(path=str(OUT/(name+'-failure.png')))
   reports.append(report)
   (OUT/'progress.json').write_text(json.dumps({'reports':reports,'errors':errors},indent=2))
  # Generate all retained default paper entries, not 23 claims of accepted clothing.
  page.locator('[data-tab=styles]').click();ids=page.locator('.style-card[data-kind=analytic]').evaluate_all('(els)=>els.map(e=>e.dataset.style)');assert len(ids)==23
  catalogue=[]
  for id in ids:
   page.evaluate('(id)=>window.__TAILOR_CATALOGUE_QA__.select(id)',id)
   page.wait_for_function("['paper','error'].includes(window.__TAILOR_CATALOGUE_QA__.getState().phase)",timeout=180000)
   catalogue.append({'id':id,'phase':state()['phase'],'error':state().get('error')})
  legacy=[]
  for id in ['shorts','sleeveless','shortsleeve']:
   page.evaluate('(id)=>window.__TAILOR_CATALOGUE_QA__.select(id)',id)
   page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='historical'",timeout=40000)
   assert state()['workerMode']=='reference';legacy.append(state()['caseId'])
  page.evaluate("window.__TAILOR_CATALOGUE_QA__.select('MetaGarmentDress')")
  page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paper'",timeout=180000)
  page.locator('#sew').click();page.wait_for_function('window.__TAILOR_CATALOGUE_QA__.getState().running',timeout=120000)
  page.locator('#pause').click();page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paused'",timeout=45000)
  coords=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getPositions()');page.wait_for_timeout(200);assert coords==page.evaluate('window.__TAILOR_CATALOGUE_QA__.getPositions()')
  page.locator('#resume').click();page.wait_for_timeout(300);page.locator('#cancel').click();assert not state()['running']
  page.set_viewport_size({'width':390,'height':844});page.locator('#arrange').click();page.wait_for_timeout(200)
  box=page.locator('#sew').bounding_box();assert box and box['x']>=0 and box['x']+box['width']<=391 and box['y']+box['height']<=844
  assert page.evaluate('document.documentElement.scrollWidth')<=391
  page.screenshot(path=str(OUT/'mobile-390x844.png'))
  report={'version':'R07.1','sourceCommit':os.environ.get('GITHUB_SHA'),'public':False,'desktopViewport':[1440,1000],'mobileViewport':[390,844],'physicalMobileDeviceTested':False,'cases':reports,'allTestedStaticGatesPassed':all(r['gate']['passed'] for r in reports),'repeatMaxCoordinateDifferenceMm':repeat_mm,'repeatPassed':repeat_mm is not None and repeat_mm<1e-5,'catalogue':catalogue,'legacyPreserved':legacy,'pauseResumeCancelPassed':True,'pageErrors':errors,'failedHTTP':[r for r in responses if r['status']>=400 and not r['url'].endswith('favicon.ico')],'allGarmentsAccepted':False,'dynamicWearCertified':False}
  (OUT/'R071_REPORT.json').write_text(json.dumps(report,indent=2))
  print('SUMMARY',json.dumps({k:v for k,v in report.items() if k not in ['cases','catalogue']},ensure_ascii=False),flush=True)
  assert not errors,errors
  assert not report['failedHTTP'],report['failedHTTP']
  assert all(x['phase']=='paper' for x in catalogue),catalogue
  assert report['repeatPassed'],report['repeatMaxCoordinateDifferenceMm']
 except Exception:
  (OUT/'FAILURE.txt').write_text(traceback.format_exc());print(traceback.format_exc(),flush=True)
  try:page.screenshot(path=str(OUT/'failure.png'))
  except Exception:pass
  raise
 finally:browser.close()
