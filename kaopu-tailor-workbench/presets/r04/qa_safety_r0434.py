"""Real browser fault-injection tests. Synthetic faults are distinguished from actual native sewing."""
from pathlib import Path
import os,json,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent
BASE=os.environ.get('R0434_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r04/')
PUBLIC=BASE.startswith('https:');OUT=P/('qa-r0434-safety-public' if PUBLIC else 'qa-r0434-safety');OUT.mkdir(exist_ok=True)
R={'url':BASE,'actualPublicBrowser':PUBLIC,'scope':'real Chromium UI with intentional HTTP/cancellation/stale-worker faults; not a native-solver substitute','checks':[],'pageErrors':[],'unfrozenCommonModules':[],'passed':False}
INDEX=json.loads((P/'assets/results/index.json').read_text())
def check(n,b,d=None):R['checks'].append({'name':n,'passed':bool(b),'detail':d});print(n,bool(b),flush=True)
def state(p):return p.evaluate('(()=>{let s=__R04.state();return {id:s.selectedId,pending:s.pendingSelectionId,failed:s.failedSelectionId,vertices:s.clothVertices,coords:s.renderCoordinateErrorM,indices:s.clothIndexMatchesNative,phase:s.phase,error:s.error}})()')
def resource(id):return BASE+'assets/results/'+INDEX['rows'][id]['file']
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  page=browser.new_page(viewport={'width':1440,'height':1080});page.set_default_timeout(300000)
  page.on('pageerror',lambda e:R['pageErrors'].append(str(e)))
  page.on('request',lambda r:R['unfrozenCommonModules'].append(r.url) if r.url.startswith('https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/full/') and r.url.split('?')[0].endswith(('.js','.mjs')) else None)
  page.goto(BASE+'?preset=T01-P01',wait_until='domcontentloaded');page.wait_for_function('window.__R04?.state().ready')
  calls=[0]
  def transient(route):
   calls[0]+=1
   if calls[0]==1:route.fulfill(status=503,body='intentional transient fault')
   else:route.continue_()
  page.route(resource('P05'),transient);page.evaluate('__R04.select("P05")');s=state(page)
  check('one transient 503 retries then displays exact requested native garment',calls[0]==2 and s['id']=='P05' and s['vertices']>0 and s['coords']==0,s)
  page.unroute(resource('P05'),transient)
  before=state(page);oldurl=page.url;oldtitle=page.locator('#selected-title').inner_text();calls=[0]
  def missing(route):calls[0]+=1;route.fulfill(status=404,body='intentional missing result')
  page.route(resource('J05'),missing);page.evaluate('__R04.select("J05")');s=state(page)
  check('permanent load failure retains current geometry, label and deep link',calls[0]==1 and s['id']==before['id'] and s['vertices']==before['vertices'] and page.url==oldurl and page.locator('#selected-title').inner_text()==oldtitle,s)
  check('failed request remains explicit and retry is usable',s['failed']=='J05' and page.locator('#retry-selection').is_visible() and 'J05' in page.locator('#status').inner_text())
  page.screenshot(path=str(OUT/'retained-after-load-failure.png'))
  page.unroute(resource('J05'),missing);page.locator('#retry-selection').click();page.wait_for_function('__R04.state().selectedId==="J05"&&!__R04.state().pendingSelectionId');s=state(page)
  check('retry recovers real requested garment without refreshing whole workbench',s['vertices']>0 and s['coords']==0 and s['failed'] is None and not page.locator('#retry-selection').is_visible(),s)
  before=state(page);calls=[0]
  def corrupt(route):
   calls[0]+=1;response=route.fetch();data=bytearray(response.body());data[-1]^=1;route.fulfill(response=response,body=bytes(data))
  page.route(resource('D11'),corrupt);page.evaluate('__R04.select("D11")');s=state(page)
  check('integrity mismatch is not retried, cached or promoted over valid display',calls[0]==1 and s['failed']=='D11' and s['id']==before['id'] and s['vertices']==before['vertices'] and '身份' in s['error'],s)
  page.unroute(resource('D11'),corrupt)
  page.evaluate('''url=>{
   window.__realFetch=window.fetch;window.__sawAbort=false;
   window.fetch=(input,options={})=>new URL(typeof input==='string'?input:input.url,location.href).href===url?new Promise((resolve,reject)=>{const cancel=()=>{window.__sawAbort=true;reject(new DOMException('Intentional cancelled request','AbortError'));};options.signal.addEventListener('abort',cancel,{once:true});if(options.signal.aborted)cancel();}):window.__realFetch(input,options);
   window.__pendingSelection=__R04.select('J04');return true;
  }''',resource('J04'))
  page.wait_for_function('__R04.state().pendingSelectionId==="J04"');s=state(page)
  check('loading retains last real garment and reports separate requested identity',s['id']=='J05' and s['pending']=='J04' and s['vertices']>0,s)
  page.evaluate('__R04.select("S03")');page.evaluate('async()=>{await window.__pendingSelection;window.fetch=window.__realFetch;}');s=state(page)
  check('new selection aborts stale fetch and keeps newest garment',page.evaluate('window.__sawAbort') and s['id']=='S03' and s['vertices']>0 and s['coords']==0,s)
  page.evaluate('''()=>{
   window.__originalPacket=__R04.packet();window.__realWorker=window.Worker;
   window.Worker=class{
    constructor(){window.__fakeWorker=this;}
    postMessage(data){if(data.type==='boot')queueMicrotask(()=>this.onmessage({data:{type:'ready'}}));else if(data.type==='load-native-paper')this.input=data;}
    terminate(){this.terminated=true;}
   };
   window.__oldLoad=__R04.loadPaper();return true;
  }''')
  page.wait_for_function('window.__fakeWorker?.input')
  page.evaluate('''()=>{
   window.__realDigest=crypto.subtle.digest.bind(crypto.subtle);let first=true;
   crypto.subtle.digest=(...args)=>{if(!first)return window.__realDigest(...args);first=false;window.__validationStarted=true;return new Promise((resolve,reject)=>{window.__releaseDigest=()=>window.__realDigest(...args).then(resolve,reject);});};
   const d=structuredClone(window.__originalPacket);d.binding.materialSHA256='0'.repeat(64);
   window.__oldValidation=window.__fakeWorker.onmessage({data:{type:'paper',requestId:window.__fakeWorker.input.requestId,binding:d.binding,spec:d.spec,positionsM:d.record.positionsMm.flat().map(x=>x*.001),canSew:true}});return true;
  }''')
  page.wait_for_function('window.__validationStarted');page.evaluate('__R04.select("T01-P01")')
  page.evaluate('async()=>{window.__releaseDigest();await window.__oldValidation;await window.__oldLoad;window.Worker=window.__realWorker;crypto.subtle.digest=window.__realDigest;}');s=state(page)
  check('late rejected validation from cancelled old worker cannot clear newest outfit',s['id']=='T01-P01' and s['phase']=='outfit' and s['vertices']>0 and s['coords']==0 and s['indices'] and s['pending'] is None,s)
  check('original person runtime is independent of mutable common-workbench modules',not R['unfrozenCommonModules'],R['unfrozenCommonModules'])
  page.evaluate('__R04.focus("scene");__R04.view("three")');page.screenshot(path=str(OUT/'recovered-display.png'))
  check('no unhandled page errors during intentional faults',not R['pageErrors'],R['pageErrors'])
  browser.close()
 R['passed']=all(c['passed'] for c in R['checks'])
except Exception as e:R.update(exception=str(e),traceback=traceback.format_exc());print(R['traceback'],flush=True)
finally:(P/('R0434_SAFETY_PUBLIC_REPORT.json' if PUBLIC else 'R0434_SAFETY_REPORT.json')).write_text(json.dumps(R,ensure_ascii=False,indent=2))
if not R['passed']:raise SystemExit(1)
