# Executed by the workflow with page/browser/out/json/Path provided.
import time
base='http://127.0.0.1:8765/kaopu-tailor-workbench/r06/'
errors=[]
page.on('pageerror',lambda e:errors.append(str(e)))
page.goto(base+'?case=MetaGarmentDress')
page.wait_for_function("window.__TAILOR_CATALOGUE_QA__?.getState().version==='R06.2'",timeout=30000)
page.wait_for_function("['paper','error'].includes(window.__TAILOR_CATALOGUE_QA__.getState().phase)",timeout=180000)
state=lambda:page.evaluate('window.__TAILOR_CATALOGUE_QA__.getState()')
assert state()['phase']=='paper',state()
assert state()['canSew'] and state()['bodyCached']
assert page.locator('#sew').is_visible() and page.locator('#sew').is_enabled()
page.screenshot(path=str(out/'r06-paper-desktop.png'))
page.locator('#arrange').click();page.wait_for_timeout(200)
page.screenshot(path=str(out/'r06-placed-desktop.png'))
for tab in ['styles','evidence','parameters']:
 page.locator('[data-tab='+tab+']').click()
 assert page.locator('#sew').is_visible()
page.locator('.wb-controls-scroll').evaluate('(el)=>el.scrollTop=el.scrollHeight')
assert page.locator('#sew').is_visible()
page.locator('.wb-controls-scroll').evaluate('(el)=>el.scrollTop=0')
page.locator('#sew').click()
page.wait_for_function('window.__TAILOR_CATALOGUE_QA__.getState().running',timeout=180000)
page.wait_for_timeout(1500)
page.locator('#pause').click()
page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paused'",timeout=20000)
p0=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getPositions()')
page.wait_for_timeout(250)
assert p0==page.evaluate('window.__TAILOR_CATALOGUE_QA__.getPositions()'),'pause moved geometry'
page.screenshot(path=str(out/'r06-paused-desktop.png'))
page.locator('#resume').click()
start=time.time();stages=set()
while state()['phase'] not in ['complete','error']:
 if time.time()-start>780:raise AssertionError('Dress trial exceeded 13-minute QA limit')
 page.wait_for_timeout(2500)
 ss=state();label=page.locator('#catalogue-status').inner_text();key=label.split(' · ')[0]
 if key not in stages and ss['running']:
  stages.add(key)
  if len(stages)<12:page.screenshot(path=str(out/('r06-stage-'+str(len(stages))+'.png')))
assert state()['phase']=='complete',state()
record=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getRecord()')
assert record['trial']['physicalFitAccepted'] is False
assert record['frameCount']>=2000
assert record['trial']['runtimeSelfContact'] is False
(out/'r06-dress-result.json').write_text(json.dumps(record))
(out/'r06-dress-state.json').write_text(json.dumps(state()))
page.locator('[data-tab=evidence]').click()
page.screenshot(path=str(out/'r06-result-desktop.png'))
page.locator('[data-camera=front]').click();page.wait_for_timeout(200)
page.screenshot(path=str(out/'r06-result-front.png'))
page.locator('[data-camera=back]').click();page.wait_for_timeout(200)
page.screenshot(path=str(out/'r06-result-back.png'))
with page.expect_download() as dl:page.locator('#save-result').click()
dl.value.save_as(str(out/'r06-exported-result.json'))
page.locator('[data-tab=styles]').click()
ids=page.locator('.style-card[data-kind=analytic]').evaluate_all('(els)=>els.map(e=>e.dataset.style)')
assert len(ids)==23 and len(set(ids))==23
catalogue=[]
for id in ids:
 page.evaluate('(id)=>window.__TAILOR_CATALOGUE_QA__.select(id)',id)
 page.wait_for_function("['paper','error'].includes(window.__TAILOR_CATALOGUE_QA__.getState().phase)",timeout=180000)
 ss=state();catalogue.append({'id':id,**ss})
 if ss['phase']=='paper':
  spec=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getSpec()')
  assert ss['canSew'] and ss['panelCount']>0
  assert len(spec['seams'])>0
 else: print('STYLE_GENERATION_FAILURE',json.dumps(ss))
(out/'r06-catalogue-generation-audit.json').write_text(json.dumps(catalogue))
assert len(catalogue)==23
page.evaluate("window.__TAILOR_CATALOGUE_QA__.select('MetaGarmentDress')")
page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paper'",timeout=120000)
oldhash=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getSpec().source.recipeHash')
page.locator('[data-control="skirt.length"]').fill('0.7')
page.locator('[data-control="skirt.length"]').dispatch_event('change')
assert state()['dirty']
assert page.evaluate('window.__TAILOR_CATALOGUE_QA__.getRecord()') is None
page.locator('#generate').click()
page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paper'",timeout=120000)
newhash=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getSpec().source.recipeHash')
assert oldhash!=newhash
legacy=[]
for id in ['shorts','sleeveless','shortsleeve']:
 page.evaluate('(id)=>window.__TAILOR_CATALOGUE_QA__.select(id)',id)
 page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='historical'",timeout=45000)
 assert state()['source']=='baseline'
 assert len(page.evaluate('window.__TAILOR_CATALOGUE_QA__.getPositions()'))>100
 page.screenshot(path=str(out/('r06-preserved-'+id+'.png')))
 legacy.append(state())
page.locator('#sew').click()
page.wait_for_function('window.__TAILOR_CATALOGUE_QA__.getState().running',timeout=45000)
page.locator('#cancel').click()
assert not state()['running']
page.evaluate("window.__TAILOR_CATALOGUE_QA__.select('Shirt')")
page.wait_for_function("['paper','error'].includes(window.__TAILOR_CATALOGUE_QA__.getState().phase)",timeout=180000)
assert state()['caseId']=='Shirt'
page.wait_for_timeout(750)
assert state()['caseId']=='Shirt'
page.set_viewport_size({'width':390,'height':844})
page.evaluate("window.__TAILOR_CATALOGUE_QA__.select('MetaGarmentDress')")
page.wait_for_function("['paper','error'].includes(window.__TAILOR_CATALOGUE_QA__.getState().phase)",timeout=120000)
page.locator('#arrange').click();page.wait_for_timeout(250)
box=page.locator('#sew').bounding_box();canvas=page.locator('#catalogue-scene').bounding_box()
assert box and box['x']>=0 and box['x']+box['width']<=391 and box['y']+box['height']<=844
assert canvas and canvas['width']>250 and canvas['height']>=100
assert page.evaluate('document.documentElement.scrollWidth')<=391
page.screenshot(path=str(out/'r06-mobile-390x844.png'))
page.locator('#sew').click()
page.wait_for_function('window.__TAILOR_CATALOGUE_QA__.getState().running',timeout=120000)
page.locator('#pause').click()
page.wait_for_function("window.__TAILOR_CATALOGUE_QA__.getState().phase==='paused'",timeout=20000)
assert page.locator('#resume').is_visible()
page.locator('#cancel').click()
summary={'version':'R06.2','desktopViewport':[1440,1000],'mobileViewport':[390,844],'physicalMobileDeviceTested':False,'entryCount':len(ids),'fieldCount':state()['parameterCount'],'allDefaultPaperGenerationPassed':all(x['phase']=='paper' for x in catalogue),'liveDressSolveCompleted':True,'newStylePhysicalFitAccepted':False,'preservedLegacyBaselines':legacy,'recipeHashChanged':oldhash!=newhash,'pauseResumeCancelTested':True,'browserErrors':errors,'mobileCanvasBounds':canvas,'mobilePrimaryButtonBounds':box}
(out/'R06_BROWSER_REPORT.json').write_text(json.dumps(summary,indent=2))
print('R06_BROWSER_REPORT',json.dumps(summary,ensure_ascii=False))
assert not errors,errors
