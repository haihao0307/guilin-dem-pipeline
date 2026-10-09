from pathlib import Path
import gzip,json,os,time,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent
BASE=os.environ.get('R074_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/r07/continuation/')
PUBLIC=BASE.startswith('https://');OUT=P/'qa'/('public' if PUBLIC else 'browser');OUT.mkdir(parents=True,exist_ok=True)
report={'version':'R07.4','public':PUBLIC,'checks':[],'physicalPhoneTested':False,'dynamicWearCertified':False,'garmentQualityAccepted':False}
def save(name,value):
 (OUT/name).write_bytes(gzip.compress(json.dumps(value,ensure_ascii=False).encode()))
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];failed=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:failed.append([r.status,r.url]) if r.status>=400 else None)
 def state():return page.evaluate('window.__TAILOR_CATALOGUE_QA__.getState()')
 def paper():return page.evaluate('window.__TAILOR_CATALOGUE_QA__.getAnalytic()')
 def info():return page.evaluate('window.__TAILOR_CONTINUATION_QA__.getEditInfo()')
 def check(name,condition,data=None):
  assert condition,(name,data);report['checks'].append({'name':name,'passed':True,'data':data});print('R074_BROWSER_PASS',name,flush=True)
 def wait_paper(revision=None):
  page.wait_for_function('()=>{const s=window.__TAILOR_CATALOGUE_QA__?.getState();return s&&!s.generating&&(s.phase==="paper"||s.phase==="error")}',timeout=180000)
  s=state();assert s['phase']=='paper',s
  if revision is not None:assert s['editRevision']>revision,s
 def click_edit(button):
  r=state()['editRevision'];page.locator(button).click();wait_paper(r)
 def solve(name):
  start=time.perf_counter();page.locator('#sew').click()
  page.wait_for_function('()=>{const s=window.__TAILOR_CATALOGUE_QA__.getState();return s.phase==="complete"||s.phase==="error"}',timeout=180000)
  s=state();assert s['phase']=='complete',s
  record=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getRecord()');save(name+'-result.json.gz',record)
  span=record['staticGate']['wholeSeamAudit'];check(name+' complete original sewing and full-edge audit','error' not in span and span['measuredSeams']==len(record['activeSeams']),{'seconds':time.perf_counter()-start,'needleGapMm':span['maxNeedleGapMm'],'wholeSpanLowerMm':span['maxSpanLowerBoundMm'],'wholeSpanUpperMm':span['maxSpanUpperBoundMm'],'separatedSeams':span['separatedSeamIds'],'gatePassed':record['staticGate']['passed'],'failures':record['staticGate']['failures']})
  if span['separatedSeamIds']:check(name+' cannot falsely accept separated seams',not record['staticGate']['passed'])
  return record
 try:
  response=page.goto(BASE+'?case=MetaGarmentDress',wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('window.__TAILOR_CONTINUATION_QA__&&window.__TAILOR_CATALOGUE_QA__?.getState().ready',timeout=120000);wait_paper()
  check('original real workbench and R074 entry',response.status==200 and state()['version']=='R07.4' and state()['rendererCount']==1)
  base=paper();save('original-paper.json.gz',base);body=base['bodyCm'];identities=info()['panelIdentities'];ids=[p['id'] for p in identities]
  page.evaluate('window.__TAILOR_CONTINUATION_QA__.showEditor()')
  check('all four inherited edit buttons exposed',all(page.locator(i).is_visible() for i in ['#continuation-scale','#continuation-curve','#continuation-place','#continuation-remove']))
  page.locator('#continuation-panels').select_option(ids);click_edit('#continuation-scale');scaled=paper()
  check('real material scale, new recipe and unchanged human',scaled['recipeHash']!=base['recipeHash'] and scaled['bodyCm']==body and state()['editOperationCount']==1)
  for a in scaled['panels']:
   b=next(p for p in base['panels'] if p['id']==a['id'])
   assert abs(a['edges'][0]['lengthMm']/b['edges'][0]['lengthMm']-1.02)<1e-5
  save('scaled-paper.json.gz',scaled);save('scaled-mesh.json.gz',page.evaluate('window.__TAILOR_CATALOGUE_QA__.getSpec()'))
  click_edit('#continuation-undo');check('undo restores material vertices',all(p['verticesMm']==next(q for q in base['panels'] if q['id']==p['id'])['verticesMm'] for p in paper()['panels']))
  # Remove the first canonical panel; curve selection below must preserve source identity after removal.
  first=ids[0];page.locator('#continuation-panels').select_option(first);click_edit('#continuation-remove');removed=paper()
  removed_name=identities[0]['sourcePanelId'];check('only explicit panel and incident seams removed',len(removed['panels'])==len(base['panels'])-1 and all(s['a']['panelId']!=removed_name and s['b']['panelId']!=removed_name for s in removed['seams']))
  identity=next(p for p in info()['panelIdentities'] if any(e['kind'] in ['quadratic','cubic'] for e in p['edges']));edge=next(e for e in identity['edges'] if e['kind'] in ['quadratic','cubic'])
  before=next(p for p in removed['panels'] if p['id']==identity['sourcePanelId'])['edges'][edge['id']]['controlPointsMm'][0]
  page.locator('#continuation-panels').select_option(identity['id']);page.locator('#continuation-edge').select_option(str(edge['id']));click_edit('#continuation-curve');curved=paper()
  after=next(p for p in curved['panels'] if p['id']==identity['sourcePanelId'])['edges'][edge['id']]['controlPointsMm'][0]
  check('curve edit uses stable source identity after removal',after==[before[0],before[1]+1] and curved['bodyCm']==body)
  save('curved-after-removal.json.gz',curved)
  click_edit('#continuation-reset');restored=paper();check('reset restores every original panel and seam',len(restored['panels'])==len(base['panels']) and len(restored['seams'])==len(base['seams']) and state()['editOperationCount']==0)
  r=solve('default-reset')
  check('reset paper was not overwritten by another source generation',r['snapshot']['spec']['source']['recipeHash']==restored['recipeHash'])
  page.locator('[data-camera="front"]').click();page.screenshot(path=str(OUT/'default-front.jpg'),type='jpeg',quality=82)
  # A placement edit must leave UV unchanged, invalidate the old result, and actually resew.
  page.evaluate('window.__TAILOR_CONTINUATION_QA__.showEditor()');page.locator('#continuation-panels').select_option(ids[0]);click_edit('#continuation-place');moved=paper()
  check('placement changes source pose but not material',moved['bodyCm']==body and all(p['verticesMm']==next(q for q in base['panels'] if q['id']==p['id'])['verticesMm'] for p in moved['panels']) and page.evaluate('window.__TAILOR_CATALOGUE_QA__.getRecord()') is None)
  r2=solve('placement-edited');check('edited current material survives actual sewing',r2['snapshot']['spec']['source']['recipeHash']==moved['recipeHash'] and bool(r2['snapshot']['spec']['source']['r07Preparation']['explicitEditedPlacementsPreserved']))
  for camera in ['front','back','side','full']:
   page.locator('[data-camera="'+camera+'"]').click();page.wait_for_timeout(150);page.screenshot(path=str(OUT/('edited-'+camera+'.jpg')),type='jpeg',quality=82)
  report['garmentQualityAccepted']=False
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(250)
  layout=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})');check('mobile viewport has no horizontal overflow',layout['scrollWidth']<=layout['width'],layout)
  page.screenshot(path=str(OUT/'mobile.jpg'),type='jpeg',quality=82)
  check('no page errors or failed resources',not errors and not failed,{'errors':errors,'failedHTTP':failed})
  report.update(passed=True,checkCount=len(report['checks']),bodyChanged=False,workerCount=state()['workerCount'],rendererCount=state()['rendererCount'],newEditingWorkflowTested=True,wholeSeamPhysicsFixed=False)
 except Exception:
  report.update(passed=False,error=traceback.format_exc(),pageErrors=errors,failedHTTP=failed)
  try:report['state']=state();page.screenshot(path=str(OUT/'failure.jpg'),type='jpeg',quality=80)
  except Exception:pass
  raise
 finally:
  (P/('PUBLIC_REPORT.json' if PUBLIC else 'BROWSER_REPORT.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close();print('R074_BROWSER_REPORT',json.dumps(report,ensure_ascii=False),flush=True)
