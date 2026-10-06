"""Public-safe08 UI only. Never includes original08 source or texture payloads."""
import os,json,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('KAOPU_PUBLIC_URL','http://127.0.0.1:8765/kaopu-geography-workbench/');ENGINE=os.environ.get('KAOPU_BROWSER','chromium');OUT=Path('canyon08-ui-qa')/ENGINE;OUT.mkdir(parents=True,exist_ok=True)
report={'base':BASE,'engine':ENGINE,'originalPayloadUsed':False,'original08BrowserRendered':False,'scope':'08 same-workbench empty cache, invalid file and corrupt-cache recovery only','tests':[],'errors':[],'passed':False}
def record(name):report['tests'].append({'name':name,'result':True});print(name,flush=True)
def enter(p):
 p.locator('[data-scene="canyonOriginal08"]').click();p.wait_for_function('KaoPuDiagnostics().scene==="canyonOriginal08"&&KaoPuDiagnostics().canyon08.phase==="needs-import"')
 assert p.locator('#canyonLocalControls').is_visible()and p.locator('#canyonOriginalFile').is_visible();assert p.locator('#liveCanvas').is_hidden()and p.locator('#playBtn').is_disabled();assert not p.evaluate('KaoPuDiagnostics().renderReady')
try:
 with sync_playwright()as pw:
  options={'headless':True}
  if ENGINE=='chromium':options['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
  browser=getattr(pw,ENGINE).launch(**options)
  for mobile in [False,True]:
   label='mobile'if mobile else'desktop';p=browser.new_page(viewport={'width':390,'height':844}if mobile else{'width':1440,'height':1000});p.set_default_timeout(60000);p.goto(BASE,wait_until='load');url=p.url;assert p.locator('[data-scene]').count()==10;enter(p);assert p.url==url and p.locator('canvas').count()==1;record(label+'_same_main_import_UI')
   requests=[];p.on('request',lambda r:requests.append((r.method,r.url)));p.locator('#canyonOriginalFile').set_input_files({'name':'invalid08.json','mimeType':'application/json','buffer':b'{"invalid":"neutral test data; no original payload"}'});p.wait_for_function('KaoPuDiagnostics().canyon08.error.includes("校验未通过")');assert not p.evaluate('KaoPuDiagnostics().canyon08.verified');assert not requests,requests;record(label+'_invalid_file_rejected_without_network')
   p.evaluate("""()=>new Promise((resolve,reject)=>{const q=indexedDB.open('kaopu-geography-private-originals-v1',1);q.onsuccess=()=>{const db=q.result,tx=db.transaction('packs','readwrite');tx.objectStore('packs').put({invalid:'neutral corrupt cache'},'canyon08');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};q.onerror=()=>reject(q.error);})""")
   p.reload(wait_until='load');enter(p);assert p.evaluate('KaoPuDiagnostics().canyon08.cacheMayRemain');assert p.locator('#canyonClearCache').is_enabled();p.locator('#canyonClearCache').click();p.wait_for_function('!KaoPuDiagnostics().canyon08.cacheMayRemain&&KaoPuDiagnostics().canyon08.phase==="needs-import"');assert p.locator('#playBtn').is_disabled();record(label+'_real_IndexedDB_corrupt_cache_clear')
   p.screenshot(path=str(OUT/(label+'_import_UI.png')),full_page=True);p.locator('#backBtn').click();p.wait_for_function('KaoPuDiagnostics().homeVisible');assert p.url==url;p.reload(wait_until='load');enter(p);assert not p.evaluate('KaoPuDiagnostics().canyon08.cached||KaoPuDiagnostics().canyon08.verified');assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+2');record(label+'_clear_reload_requires_file_truthfully');p.close()
  browser.close()
 report['passed']=True
except Exception as e:report['errors'].append(str(e));report['traceback']=traceback.format_exc();print(report['traceback'],flush=True)
finally:(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('CANYON08_UI_REPORT',json.dumps(report,ensure_ascii=False),flush=True)
if not report['passed']:raise SystemExit(1)
