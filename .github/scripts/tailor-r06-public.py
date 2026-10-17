from pathlib import Path
import hashlib,json,time
from playwright.sync_api import sync_playwright
BASE='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/'
EXPECTED_SOURCE='19be79eece64cbce7ef495c5e905eb46ff72f644'
out=Path('public-evidence');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];failed=[];net=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:net.append({'url':r.url,'status':r.status}))
 page.on('requestfailed',lambda r:failed.append({'url':r.url,'error':r.failure}))
 try:
  manifest=None
  for attempt in range(24):
   resp=page.request.get(BASE+'r06/BUILD_MANIFEST.json?qa='+str(time.time()))
   if resp.status==200:
    candidate=resp.json()
    if candidate.get('version')=='R06.2' and candidate.get('sourceCommit')==EXPECTED_SOURCE:
     manifest=candidate;break
   time.sleep(10)
  assert manifest, 'Expected version has not reached the public Pages host'
  checks=[]
  for path,expected in manifest['files'].items():
   if path.endswith(('.mjs','.css','.html','.gz','.json')):
    response=page.request.get('https://haihao0307.github.io/guilin-dem-pipeline/'+path)
    assert response.status==200,(path,response.status)
    actual=hashlib.sha256(response.body()).hexdigest()
    assert actual==expected,(path,actual,expected)
    checks.append({'path':path,'sha256':actual,'status':response.status})
  response=page.goto(BASE+'r06/?case=MetaGarmentDress&qa=R06.2')
  assert response.status==200
  page.wait_for_function("window.__TAILOR_CATALOGUE_QA__?.getState().phase==='paper'",timeout=180000)
  st=lambda:page.evaluate('window.__TAILOR_CATALOGUE_QA__.getState()')
  assert st()['version']=='R06.2' and st()['bodyCached'] and st()['canSew']
  page.screenshot(path=str(out/'public-desktop-paper.png'))
  page.locator('#arrange').click();page.wait_for_timeout(250)
  page.screenshot(path=str(out/'public-desktop-placed.png'))
  page.locator('#sew').click();page.wait_for_function('window.__TAILOR_CATALOGUE_QA__.getState().running',timeout=120000)
  page.locator('#pause').click()
  page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paused'",timeout=60000)
  paused=st();assert paused['source']=='current-input';page.screenshot(path=str(out/'public-desktop-paused.png'))
  page.locator('#resume').click();page.wait_for_timeout(1000);page.locator('#cancel').click();assert not st()['running']
  page.evaluate("window.__TAILOR_CATALOGUE_QA__.select('shortsleeve')")
  page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='historical'",timeout=40000)
  legacy=st();page.screenshot(path=str(out/'public-preserved-short-sleeve.png'))
  page.set_viewport_size({'width':390,'height':844})
  page.evaluate("window.__TAILOR_CATALOGUE_QA__.select('MetaGarmentDress')")
  page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paper'",timeout=180000)
  page.locator('#arrange').click();page.wait_for_timeout(250)
  box=page.locator('#sew').bounding_box();assert box and box['x']+box['width']<=391 and box['y']+box['height']<=844
  assert page.evaluate('document.documentElement.scrollWidth')<=391
  page.screenshot(path=str(out/'public-mobile-390x844.png'))
  page.locator('#sew').click();page.wait_for_function('window.__TAILOR_CATALOGUE_QA__.getState().running',timeout=120000)
  page.locator('#pause').click();page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paused'",timeout=60000)
  page.screenshot(path=str(out/'public-mobile-paused.png'));page.locator('#cancel').click()
  bad=[r for r in net if r['status']>=400 and not r['url'].endswith('/favicon.ico')]
  assert not errors and not bad,(errors,bad)
  report={'publicUrl':BASE+'r06/?case=MetaGarmentDress','version':'R06.2','sourceCommit':EXPECTED_SOURCE,'publicHtmlStatus':200,'verifiedAssetChecksums':checks,'desktopViewport':[1440,1000],'mobileViewport':[390,844],'physicalMobileDeviceTested':False,'publicGeneratedNewPaper':True,'publicStartedPausedResumedCancelledLiveSolve':True,'publicFullSolveRevalidated':False,'fullSolveEvidence':'R06_BROWSER_REPORT.json','newStylePhysicalFitAccepted':False,'pausedPublicState':paused,'preservedShortSleeve':legacy,'browserErrors':errors,'failedHttpResponses':bad,'cancelledRequests':failed}
  (out/'PUBLIC_DELIVERY_REPORT.json').write_text(json.dumps(report,indent=2))
  print(json.dumps(report,ensure_ascii=False))
 except Exception:
  import traceback
  (out/'failure.txt').write_text(traceback.format_exc())
  page.screenshot(path=str(out/'failure.png'))
  raise
 finally:b.close()
