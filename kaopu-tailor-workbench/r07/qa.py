from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time,traceback,hashlib,os
import numpy as np
OUT=Path('evidence-r07');OUT.mkdir(exist_ok=True)
BASE=os.environ.get('TAILOR_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/')
PUBLIC=BASE.startswith('https:')
def strain(record):
 x=np.array(record['positionsMm']);off=0;largest=0;smallest=1;areas=[];values=[]
 for p in record['snapshot']['spec']['panels']:
  ids=np.array(p['triangles']);u=np.array(p['uvMm'])[ids];y=x[off+ids]
  D=np.stack((u[:,1]-u[:,0],u[:,2]-u[:,0]),axis=-1)
  F=np.stack((y[:,1]-y[:,0],y[:,2]-y[:,0]),axis=-1)@np.linalg.inv(D)
  singular=np.linalg.svd(F,compute_uv=False);largest=max(largest,float(singular[:,0].max()-1));smallest=min(smallest,float(singular[:,1].min()));off+=len(p['uvMm'])
  area=abs(np.linalg.det(D))*.5;areas.extend(area.tolist());values.extend((singular[:,0]-1).tolist())
 order=np.argsort(values);v=np.array(values)[order];a=np.array(areas)[order];p95=float(v[np.searchsorted(np.cumsum(a),sum(a)*.95)])
 return {'maximumTensilePercent':largest*100,'maximumCompressionPercent':(1-smallest)*100,'p95AreaWeightedTensilePercent':p95*100,'materialAreaMm2':sum(areas)}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];network=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:network.append({'url':r.url,'status':r.status}))
 state=lambda:page.evaluate('window.__TAILOR_CATALOGUE_QA__.getState()')
 def paper():
  page.wait_for_function("['paper','error'].includes(window.__TAILOR_CATALOGUE_QA__?.getState().phase)",timeout=180000)
  assert state()['phase']=='paper',state()
 def solve(mode,name,interrupt=False):
  page.evaluate('(m)=>window.__TAILOR_CATALOGUE_QA__.setMode(m)',mode)
  design=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getDesign()');t=time.perf_counter()
  page.locator('#sew').click()
  page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().running||window.__TAILOR_CATALOGUE_QA__.getState().phase==='error'",timeout=180000)
  assert state()['phase']!='error',state()
  if interrupt:
   page.locator('#pause').click();page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paused'",timeout=60000)
   x=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getPositions()');page.wait_for_timeout(150);assert x==page.evaluate('window.__TAILOR_CATALOGUE_QA__.getPositions()')
   page.locator('#resume').click()
  page.wait_for_function("['complete','error'].includes(window.__TAILOR_CATALOGUE_QA__.getState().phase)",timeout=720000)
  assert state()['phase']=='complete',state()
  wall=time.perf_counter()-t;record=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getRecord()');ss=state()
  (OUT/(name+'-result.json')).write_text(json.dumps(record))
  page.locator('[data-tab=evidence]').click()
  for camera in ['front','back','side']:
   page.locator('[data-camera='+camera+']').click();page.wait_for_timeout(180);page.screenshot(path=str(OUT/(name+'-'+camera+'.png')))
  page.locator('#show-body').uncheck();page.screenshot(path=str(OUT/(name+'-without-body.png')));page.locator('#show-body').check()
  data={'mode':mode,'endToEndSeconds':wall,'intersections':ss['intersections'],'metrics':record['metrics'],'strain':strain(record),'recipeHash':record['snapshot']['spec']['source']['recipeHash'],'geometryHash':record['snapshot']['spec']['source']['geometryHash'],'frameCount':record['frameCount'],'solver':record['solver'],'physicalFitAccepted':False,'design':design,'statusText':page.locator('#catalogue-status').inner_text(),'runtimeText':page.locator('#runtime-summary').inner_text()}
  (OUT/(name+'-report.json')).write_text(json.dumps(data,indent=2));return data
 try:
  response=page.goto(BASE+'r07/?case=MetaGarmentDress');assert response.status==200
  paper();assert state()['version']=='R07.0'
  page.screenshot(path=str(OUT/'initial-paper.png'))
  reference=solve('reference','reference') if not PUBLIC else None
  fast=solve('fast','fast',interrupt=True)
  assert fast['metrics']['finite']
  assert fast['metrics']['activeMaxGapMm']<2,fast['metrics']['activeMaxGapMm']
  assert fast['intersections']['bodyIntersectingFaceCount']==0,fast['intersections']
  if reference:
   assert reference['design']==fast['design'] and reference['geometryHash']==fast['geometryHash']
   assert abs(reference['strain']['materialAreaMm2']-fast['strain']['materialAreaMm2'])<1e-5
   assert fast['endToEndSeconds']<reference['endToEndSeconds']*.65,(reference['endToEndSeconds'],fast['endToEndSeconds'])
   assert fast['strain']['maximumTensilePercent']<reference['strain']['maximumTensilePercent']*.6
   assert fast['intersections']['selfStrictTriangleIntersectionCount']<reference['intersections']['selfStrictTriangleIntersectionCount']*.25
  # Defaults retained; meshing tests are not physical acceptance of the 23 clothes.
  page.locator('[data-tab=styles]').click();ids=page.locator('.style-card[data-kind=analytic]').evaluate_all('(els)=>els.map(e=>e.dataset.style)');assert len(ids)==23
  generated=[]
  for id in ids if not PUBLIC else ['MetaGarmentDress']:
   page.evaluate('(id)=>window.__TAILOR_CATALOGUE_QA__.select(id)',id);paper();generated.append(state())
  page.evaluate("window.__TAILOR_CATALOGUE_QA__.select('MetaGarmentDress')");paper()
  oldhash=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getSpec().source.recipeHash')
  page.locator('[data-control="skirt.length"]').fill('0.7');page.locator('[data-control="skirt.length"]').dispatch_event('change');assert state()['dirty']
  assert page.evaluate('window.__TAILOR_CATALOGUE_QA__.getRecord()') is None
  page.locator('#generate').click();paper();assert oldhash!=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getSpec().source.recipeHash')
  with page.expect_download() as dl:page.locator('#save-problem').click()
  dl.value.save_as(str(OUT/'exported-problem.json'))
  # A composition without an upper must not claim to display a complete dress.
  page.locator('#parameters-list details').evaluate_all('(els)=>els.forEach(el=>el.open=true)');page.locator('#parameters-list details').evaluate_all('(els)=>els.forEach(el=>el.open=true)');control=page.locator('[data-control="meta.upper"]');control.select_option('null');control.dispatch_event('change');assert '未选上装' in page.locator('#current-title').inner_text()
  page.locator('#generate').click();paper();assert page.evaluate('window.__TAILOR_CATALOGUE_QA__.getSpec().panels.every(p=>!p.id.includes("torso"))')
  for id in ['shorts','sleeveless','shortsleeve']:
   page.evaluate('(id)=>window.__TAILOR_CATALOGUE_QA__.select(id)',id);page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='historical'",timeout=45000)
   assert state()['source']=='baseline' and state()['workerMode']=='reference'
  page.set_viewport_size({'width':390,'height':844})
  page.evaluate("window.__TAILOR_CATALOGUE_QA__.select('Shirt')");paper();page.locator('#arrange').click();page.wait_for_timeout(200)
  rect=page.locator('#sew').bounding_box();assert rect and rect['x']>=0 and rect['x']+rect['width']<=391 and rect['y']+rect['height']<=844
  canvas=page.locator('#catalogue-scene').bounding_box();assert canvas['height']>=100
  assert page.evaluate('document.documentElement.scrollWidth')<=391
  page.screenshot(path=str(OUT/'mobile-390x844.png'))
  page.locator('#sew').click();page.wait_for_function('window.__TAILOR_CATALOGUE_QA__.getState().running',timeout=180000);page.locator('#pause').click();page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paused'",timeout=45000);page.locator('#cancel').click();assert not state()['running']
  bad=[r for r in network if r['status']>=400 and not r['url'].endswith('favicon.ico')]
  assert not errors and not bad,(errors,bad)
  report={'version':'R07.0','sourceCommit':os.environ.get('GITHUB_SHA'),'public':PUBLIC,'baseURL':BASE,'desktopViewport':[1440,1000],'mobileViewport':[390,844],'physicalMobileDeviceTested':False,'reference':reference,'fast':fast,'generated':generated,'fieldCount':state()['parameterCount'],'sameInputComparison':bool(reference),'wallSpeedup':reference['endToEndSeconds']/fast['endToEndSeconds'] if reference else None,'allNewGarmentsAccepted':False,'errors':errors,'failedHTTP':bad,'noUpperCompositionLabelVerified':True,'recipeChangeInvalidationVerified':True,'originalLegacyWorkerRoutingVerified':True}
  (OUT/'R07_REPORT.json').write_text(json.dumps(report,indent=2));print('R07_REPORT',json.dumps({k:v for k,v in report.items() if k not in ['reference','fast','generated']},ensure_ascii=False))
 except Exception:
  (OUT/'FAILURE.txt').write_text(traceback.format_exc());page.screenshot(path=str(OUT/'failure.png'))
  try:(OUT/'failure-state.json').write_text(json.dumps(state()))
  except Exception:pass
  raise
 finally:browser.close()
