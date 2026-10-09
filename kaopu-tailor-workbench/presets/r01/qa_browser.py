from pathlib import Path
import hashlib,json,os,time,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent
BASE=os.environ.get('P01_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r01/')
PUBLIC=BASE.startswith('https://')
OUT=P/'qa'/('public' if PUBLIC else 'browser');OUT.mkdir(parents=True,exist_ok=True)
REPORT={'scope':'paper presets, no cloth solver','public':PUBLIC,'baseURL':BASE,'desktopViewport':[1440,1000],'mobileViewport':[390,844],'physicalMobileDeviceTested':False,'tests':[]}
def save_report():
 (P/('PUBLIC_REPORT.json' if PUBLIC else 'BROWSER_REPORT.json')).write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
 errors=[];bad=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:bad.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
 page.on('request',lambda r:requests.append(r.url))
 state=lambda:page.evaluate('window.__TAILOR_PRESETS_QA__.getState()')
 def check(name,condition,extra=None):
  assert condition,(name,extra);REPORT['tests'].append({'name':name,'passed':True,'data':extra});print('BROWSER_PASS',name,flush=True)
 def selected(pid):
  page.evaluate('(id)=>window.__TAILOR_PRESETS_QA__.select(id)',pid)
  page.wait_for_function('(id)=>window.__TAILOR_PRESETS_QA__.getState().selectedId===id&&window.__TAILOR_PRESETS_QA__.getState().paperReady',arg=pid,timeout=30000)
 try:
  response=page.goto(BASE+'?preset=T05',wait_until='networkidle',timeout=120000)
  page.wait_for_function('window.__TAILOR_PRESETS_QA__?.getState().ready',timeout=120000)
  check('HTML200 and 60 actual cards',response.status==200 and state()['presetCount']==60 and page.locator('.card').count()==60)
  check('no technical editing sliders',page.locator('input[type=range], input[type=number]').count()==0)
  page.locator('.card img').evaluate_all('(imgs)=>imgs.forEach(i=>i.loading="eager")')
  page.wait_for_function('Array.from(document.querySelectorAll(".card img")).every(i=>i.complete&&i.naturalWidth>0)',timeout=60000)
  check('all 60 real paper thumbnails load',True)
  before_runtime=[u for u in requests if any(x in u for x in ['pyodide','pattern-runtime.zip','.wasm'])]
  check('preset browsing has no Python/WASM download or solver',not before_runtime and state()['workerStarts']==0 and not state()['clothSolverStarted'])
  rows=page.evaluate('window.__TAILOR_PRESETS_QA__.getRows()');seen=set()
  for row in rows:
   selected(row['id']);s=state();count=page.locator('#paper-host svg [data-panel]').count()
   check('paper '+row['id'],s['patternRecipeHash']==row['recipeHash'] and count==row['panelCount'],{'id':row['id'],'panels':count})
   seen.add(row['shapeFingerprint'])
  check('60 distinct source paper geometries',len(seen)==60)
  page.locator('[data-category="裤装"]').click();check('pants category',page.locator('.card').count()==10)
  page.locator('[data-category="全部"]').click();page.locator('#search').fill('连体');check('search jumpsuits',page.locator('.card').count()==6)
  page.locator('#search').fill('没有此款型xyz');check('empty search',page.locator('#empty').is_visible() and page.locator('.card').count()==0)
  page.locator('#search').fill('');selected('P07')
  pattern=page.evaluate('window.__TAILOR_PRESETS_QA__.getPattern()');sid=pattern['seams'][0]['id']
  page.locator('#seam-select').select_option(sid);check('source seam highlights two edges',page.locator('#paper-host path[stroke="#f5dd84"]').count()==2)
  page.locator('#recipe-details summary').click();page.locator('#parameter-filter').select_option('all');check('all 122 fields readable',page.locator('.parameter-row').count()==122)
  page.locator('#recipe-details summary').click()
  with page.expect_download() as info:page.locator('#export-preset').click()
  out=info.value;target=OUT/out.suggested_filename;out.save_as(target);preset=json.loads(target.read_text())
  check('export design without fixed body or solved shell',preset['bodyBinding'] is None and preset['includesSolvedClothes'] is False and preset['id']=='P07')
  with page.expect_download() as info:page.locator('#export-paper').click()
  out=info.value;target=OUT/out.suggested_filename;out.save_as(target)
  check('actual millimetre SVG export','mm"' in target.read_text() and '<path' in target.read_text())
  selected('T05');native_recipe=state()['patternRecipeHash'];start=time.perf_counter();page.locator('#regenerate').click()
  page.wait_for_function('window.__TAILOR_PRESETS_QA__.getState().running',timeout=10000)
  page.wait_for_function('!window.__TAILOR_PRESETS_QA__.getState().running',timeout=300000)
  s=state();check('current-input original browser paper generation',not s['cachedPaper'] and s['patternRecipeHash']==native_recipe and s['activeWorkers']==0,{'seconds':time.perf_counter()-start,'state':s})
  check('result is paper not certified clothing',not s['physicalFitAccepted'] and not s['dynamicWearCertified'] and not s['clothSolverStarted'])
  check('missing measurements rejected',page.evaluate('()=>{let p=window.__TAILOR_PRESETS_QA__.getReferenceBody();delete p.bodyCm.hips;try{window.__TAILOR_PRESETS_QA__.applyBodyProfile(p);return false}catch{return true}}'))
  check('wrong units rejected',page.evaluate('()=>{let p=window.__TAILOR_PRESETS_QA__.getReferenceBody();p.units="mm";try{window.__TAILOR_PRESETS_QA__.applyBodyProfile(p);return false}catch{return true}}'))
  page.evaluate('''async()=>{const q=window.__TAILOR_PRESETS_QA__,b=q.getReferenceBody();b.id='qa-synthetic-six-percent';b.revision='fixture-2';b.kind='synthetic-dependency-fixture';b.bodyGeometrySHA256='a'.repeat(64);const angles=new Set(['shoulder_incl','arm_pose_angle','hip_inclination']);for(const k of Object.keys(b.bodyCm))if(!angles.has(k))b.bodyCm[k]*=1.06;b.sourceSHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(b.bodyCm)))),v=>v.toString(16).padStart(2,'0')).join('');q.applyBodyProfile(b);}''')
  check('body change invalidates old paper',state()['dirty'] and state()['patternBodyId']!=state()['selectedBodyId'])
  start=time.perf_counter();page.locator('#regenerate').click();page.wait_for_function('window.__TAILOR_PRESETS_QA__.getState().running',timeout=10000);page.wait_for_function('!window.__TAILOR_PRESETS_QA__.getState().running',timeout=300000)
  s=state();check('same preset rebuilt for changed measurements',not s['dirty'] and not s['cachedPaper'] and s['patternBodyId']=='qa-synthetic-six-percent' and s['patternRecipeHash']!=native_recipe,{'seconds':time.perf_counter()-start,'syntheticOnly':True,'realCharacterIntegration':False})
  page.evaluate('window.__TAILOR_PRESETS_QA__.applyBodyProfile(window.__TAILOR_PRESETS_QA__.getReferenceBody())');selected('T05')
  page.locator('#regenerate').click();page.locator('#cancel').click();page.wait_for_timeout(200);check('immediate cancellation releases worker',not state()['running'] and state()['activeWorkers']==0)
  page.locator('#regenerate').click();selected('S09');page.wait_for_timeout(500);check('switch cancels old generation and rejects late result',state()['selectedId']=='S09' and state()['cachedPaper'] and state()['activeWorkers']==0)
  selected('T05');page.locator('header').scroll_into_view_if_needed();page.screenshot(path=str(OUT/'desktop.png'));page.screenshot(path=str(OUT/'desktop.jpg'),type='jpeg',quality=75)
  desktop_layout=page.evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})');check('desktop no horizontal overflow',desktop_layout['scroll']<=desktop_layout['w'],desktop_layout)
  page.set_viewport_size({'width':390,'height':844});page.locator('header').scroll_into_view_if_needed();page.wait_for_timeout(300)
  mobile_layout=page.evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})');check('mobile viewport no horizontal overflow',mobile_layout['scroll']<=mobile_layout['w'],mobile_layout)
  page.screenshot(path=str(OUT/'mobile-inspector.jpg'),type='jpeg',quality=75)
  page.locator('#cards').scroll_into_view_if_needed();page.screenshot(path=str(OUT/'mobile-gallery.jpg'),type='jpeg',quality=75)
  page.locator('[data-preset="P01"]').click();page.wait_for_function('window.__TAILOR_PRESETS_QA__.getState().selectedId==="P01"&&window.__TAILOR_PRESETS_QA__.getState().paperReady')
  check('mobile preset selection',state()['selectedId']=='P01')
  check('no page errors or failed HTTP responses',not errors and not bad,{'errors':errors,'badHTTP':bad})
  REPORT.update({'passed':True,'testCount':len(REPORT['tests']),'pageErrors':errors,'badHTTP':bad,'clothSimulationRun':False,'finalState':state()})
 except Exception:
  REPORT.update({'passed':False,'error':traceback.format_exc(),'pageErrors':errors,'badHTTP':bad})
  try:page.screenshot(path=str(OUT/'failure.jpg'),type='jpeg',quality=70)
  except Exception:pass
  raise
 finally:
  save_report();browser.close();print('P01_BROWSER_REPORT',json.dumps({'passed':REPORT.get('passed'),'tests':len(REPORT['tests']),'public':PUBLIC,'error':REPORT.get('error')},ensure_ascii=False),flush=True)
