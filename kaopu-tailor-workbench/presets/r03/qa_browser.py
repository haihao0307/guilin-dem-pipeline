"""Actual Chromium app tests, not mocked render success."""
from pathlib import Path
import os,json,base64,hashlib,traceback,io
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw
HERE=Path(__file__).resolve().parent
BASE=os.environ.get('R03_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r03/')
PUBLIC=BASE.startswith('https:');OUT=HERE/'qa'/('public' if PUBLIC else 'candidate');OUT.mkdir(parents=True,exist_ok=True)
report={'public':PUBLIC,'url':BASE,'sourceCommit':os.environ.get('GITHUB_SHA'),'checks':[],'passed':False,'pageErrors':[],'httpErrors':[],'physicalFitAccepted':False,'dynamicWearCertified':False,'mobileScope':'Chromium 390x844 viewport; not a physical phone'}
def check(name,ok,detail=None):
 report['checks'].append({'name':name,'passed':bool(ok),'detail':detail})
 if not ok:print('CHECK_FAILED',name,detail,flush=True)
def js(page,exp,arg=None):return page.evaluate(exp,arg)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  page=browser.new_page(viewport={'width':1440,'height':1080},device_scale_factor=1)
  page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
  page.on('response',lambda r:report['httpErrors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  page.on('console',lambda m:report.setdefault('consoleErrors',[]).append(m.text) if m.type=='error' else None)
  page.goto(BASE+'?preset=J06',wait_until='networkidle',timeout=120000)
  page.wait_for_function('window.__TAILOR_R03_QA__?.getState().ready',timeout=120000)
  page.wait_for_function('window.__TAILOR_R03_QA__.getState().originalThumbnailCount===60',timeout=300000)
  state=js(page,'__TAILOR_R03_QA__.getState()');report['initialState']=state
  check('60 original presets / 432 source-linked combinations',state['originalCount']==60 and state['combinationCount']==432)
  check('All 60 thumbnails rendered by real WebGL',state['originalThumbnailCount']==60)
  check('One live WebGL canvas',state['canvasCount']==1 and state['renderer']['webglContexts']==1)
  check('J06 deep link and full original mannequin topology',state['selectedId']=='J06' and state['renderer']['mannequinVertexCount']==13718 and state['renderer']['mannequinTriangleCount']==27420)
  page.screenshot(path=str(OUT/'desktop.png'))
  thumbnails=js(page,"Array.from(document.querySelectorAll('.card')).map(c=>({id:c.dataset.preset,src:c.querySelector('img').src}))")
  contact=Image.new('RGB',(6*240,10*340),'#f5f4f0');draw=ImageDraw.Draw(contact);hashes=[]
  for i,t in enumerate(thumbnails):
   raw=base64.b64decode(t['src'].split(',')[1]);im=Image.open(io.BytesIO(raw)).convert('RGB');im.resize((234,312)).save(OUT/(t['id']+'-thumb.jpg'));contact.paste(im.resize((234,312)),((i%6)*240,(i//6)*340));draw.text(((i%6)*240+6,(i//6)*340+315),t['id'],fill='#343a31');hashes.append(hashlib.sha256(raw).hexdigest())
  contact.save(OUT/'contact-60.jpg',quality=93);check('60 non-identical real render captures',len(set(hashes))==60)
  mesh=js(page,'__TAILOR_R03_QA__.generateAllGeometry()');report['geometry']=[{k:r[k] for k in ['id','vertices','triangles','geometrySignature']} for r in mesh];signatures={}
  for r in mesh[:60]:signatures.setdefault(r['geometrySignature'],[]).append(r['id'])
  duplicates=[v for v in signatures.values() if len(v)>1]
  check('All 60 original garment geometry signatures differ without colors',not duplicates,duplicates)
  check('All 432 combination geometries built from original members',len(mesh)==492 and all(r['vertices']>0 and r['triangles']>0 for r in mesh))
  m11=next(r for r in mesh if r['id']=='T11')
  check('Sleeve hems do not extend over fingers',m11.get('topLowestY',0)>.91,m11.get('topLowestY'))
  check('Every preset has an actual connected garment shell',all(r.get('connectedShells',0)>=1 for r in mesh))
  check('Runtime identifies the reviewed R03.4 revision',state['version']=='R03.4')
  for id in ['J06','T01','T03','T04','T08','T09','T10','T13','T15','T18','P05','P06','S09','S12','D09','D11']:
   js(page,'id=>__TAILOR_R03_QA__.select(id)',id);js(page,'__TAILOR_R03_QA__.view("angle")');page.locator('#showcase').screenshot(path=str(OUT/(id+'-detail.png')))
  js(page,'__TAILOR_R03_QA__.select("J06")');viewhash=[]
  for view in ['front','side','back','detail']:
   page.locator('[data-view='+view+']').click();shot=page.locator('#showcase').screenshot(path=str(OUT/('J06-'+view+'.png')));viewhash.append(hashlib.sha256(shot).hexdigest())
  check('Actual camera controls render four different views',len(set(viewhash))==4)
  page.locator('#show-body').uncheck();check('Mannequin visibility toggles',not js(page,'__TAILOR_R03_QA__.getState().renderer.showBody'));page.locator('#show-body').check()
  page.locator('#show-seams').uncheck();check('Structural seams toggles',not js(page,'__TAILOR_R03_QA__.getState().renderer.showSeams'));page.locator('#show-seams').check()
  page.locator('#tab-paper').click();page.wait_for_selector('#paper-host svg',timeout=60000);check('Original J06 paper identity preserved',js(page,'__TAILOR_R03_QA__.getState().paperId')=='J06');page.locator('#tab-3d').click()
  page.locator('[data-mode=combination]').click();page.locator('#pair-top').select_option('T09');page.locator('#pair-bottom').select_option('S09');page.locator('#pair-view').click();check('Pair picker selects two actual sources',js(page,'__TAILOR_R03_QA__.getState().selectedId')=='T09-S09');page.locator('#showcase').screenshot(path=str(OUT/'combination.png'))
  page.locator('#tab-paper').click();page.wait_for_selector('#paper-host svg');page.locator('#paper-source').select_option('S09');page.wait_for_function('__TAILOR_R03_QA__.getState().paperId==="S09"');check('Combination retains independently selectable source papers',True);page.locator('#tab-3d').click()
  page.locator('#favorite').click();page.locator('[data-mode=favorites]').click();check('Favorites are selectable persisted IDs',page.locator('.card[data-preset="T09-S09"]').count()==1)
  page.locator('[data-mode=original]').click();page.locator('#search').fill('方领');check('Search filters source names',js(page,'__TAILOR_R03_QA__.getState().visibleCards')==1);page.locator('#clear-search').click()
  page.set_viewport_size({'width':390,'height':844});js(page,'__TAILOR_R03_QA__.select("J06")');js(page,'__TAILOR_R03_QA__.view("angle")');page.wait_for_timeout(300);page.screenshot(path=str(OUT/'mobile-390x844.png'));check('390x844 has no horizontal overflow',js(page,'document.documentElement.scrollWidth<=innerWidth'))
  page.set_viewport_size({'width':1440,'height':1080});page.screenshot(path=str(OUT/'final-desktop.png'));report['finalState']=js(page,'__TAILOR_R03_QA__.getState()')
  check('No page or failed HTTP errors',not report['pageErrors'] and not report['httpErrors'],{'pageErrors':report['pageErrors'],'httpErrors':report['httpErrors']});check('No shader or browser console errors',not report.get('consoleErrors'),report.get('consoleErrors'));browser.close()
 report['passed']=all(c['passed'] for c in report['checks'])
except Exception as exc:report['exception']=str(exc);report['traceback']=traceback.format_exc();print(report['traceback'],flush=True)
finally:(HERE/('PUBLIC_REPORT.json' if PUBLIC else 'BROWSER_REPORT.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('R03_BROWSER_RESULT',report['passed'],len(report['checks']),flush=True)
if not report['passed']:raise SystemExit(1)
