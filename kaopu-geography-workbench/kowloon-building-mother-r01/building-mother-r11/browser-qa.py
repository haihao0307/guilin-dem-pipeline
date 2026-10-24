"""Same-page three-building integration; real browser, no route overrides."""
import functools,http.server,json,threading,traceback,hashlib,concurrent.futures
from urllib.request import urlopen
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
out=Path('public-inspection-evidence');out.mkdir(exist_ok=True)
report={'passed':False,'scope':'R11 three actual source buildings, explicitly inferred interior','physicalDeviceTested':False,'errors':[],'frames':{},'httpFailures':[]}
def save():(out/'r11-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root.parent)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/building-mother-r11/index.html'
config=root/'public-manifest.json'
if config.exists():
 cfg=json.loads(config.read_text());url=cfg['url'];report['publicNoOverrides']=True
 def verify(item):
  p,sha=item;raw=urlopen(url.rsplit('/',1)[0]+'/'+p,timeout=60).read();assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==sha,p;return p
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:report['verifiedFiles']=list(pool.map(verify,cfg['files'].items()))
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1366,'height':900},device_scale_factor=1);page.set_default_timeout(180000)
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.on('response',lambda r:report['httpFailures'].append({'url':r.url,'status':r.status}) if r.status>=400 and not r.url.endswith('favicon.ico') else None)
  def settle(n=-1):
   page.wait_for_function('n=>window.semanticInspection&&(semanticInspection.errors.length||semanticInspection.ready&&!semanticInspection.busy&&semanticInspection.frames.length>n)',arg=n)
   assert not page.evaluate('semanticInspection.errors'),page.evaluate('semanticInspection.errors')
  def capture(name):
   settle();q=page.evaluate('''()=>{const s=semanticInspection,r=s.renderer,p=r.readPixels(),colors=new Set();for(let i=0;i<p.length;i+=4)colors.add(p[i]+256*p[i+1]+65536*p[i+2]);return{colors:colors.size,frame:s.frames.at(-1),caseId:s.caseId,canvas:{w:r.canvas.width,h:r.canvas.height},glError:r.gl.getError(),coverage:s.buildings.map(b=>b.localModel.buildingMother.retainedRelations),dimensions:s.inspectionDimensions};}''')
   assert q['colors']>10 and q['glError']==0,q;assert all(x['passed'] for x in q['coverage']);raw=page.locator('#view').screenshot(path=str(out/(name+'.png')));q['screenshotSHA256']=hashlib.sha256(raw).hexdigest();report['frames'][name]=q;save();print('CAPTURE',name,q['frame']['wallMs'],flush=True);return q
  def action(fn):
   n=page.evaluate('semanticInspection.frames.length');fn();settle(n)
  page.goto(url,wait_until='domcontentloaded');settle();capture('three-buildings-whole');page.screenshot(path=str(out/'three-buildings-full-page.png'),full_page=True)
  source=page.evaluate('JSON.stringify(semanticInspection.source)');levels=page.evaluate('JSON.stringify(semanticInspection.model.levels)')
  assert page.evaluate('semanticInspection.buildings.length')==3
  for case in ['lowrise','kcc','warehouse']:
   page.locator('[data-building='+case+']').click();action(lambda:page.locator('#focusBuilding').click());capture(case+'-source-context')
   action(lambda:page.locator('[data-view=design]').click());capture(case+'-retained-interior')
   assert len(page.locator('#coverageReport').inner_text())>100
   action(lambda:page.locator('[data-view=whole]').click())
  assert page.evaluate('JSON.stringify(semanticInspection.source)')==source and page.evaluate('JSON.stringify(semanticInspection.model.levels)')==levels
  page.locator('[data-building=lowrise]').click();action(lambda:page.locator('[data-floor-bookmark=slice]').click());capture('lowrise-whole-floor-relations');action(lambda:page.locator('[data-floor-bookmark=stair]').click());capture('lowrise-stair-rail-colors');action(lambda:page.locator('[data-view=whole]').click());action(lambda:page.locator('#inspect-source-windows').click());capture('lowrise-three-observed-windows')
  def lowSignature():return page.evaluate('JSON.stringify(semanticInspection.buildings.find(b=>b.caseId==="lowrise").localModel.archetypes)')
  page.locator('#inspection-wall').select_option('0.12');page.wait_for_url('**wall=0.12**');settle();first=capture('lowrise-wall012');signature=lowSignature()
  page.locator('#inspection-wall').select_option('0.18');page.wait_for_url('**wall=0.18**');settle();second=capture('lowrise-wall018');assert signature!=lowSignature()
  assert page.evaluate('semanticInspection.buildings.find(b=>b.caseId==="lowrise").localModel.hostedComponents.apertures.filter(a=>a.observationId).every(a=>a.config.wallThickness===.18&&a.config.frameDepth===.18)')
  page.locator('#inspection-wall').select_option('0.12');page.wait_for_url('**wall=0.12**');settle();back=capture('lowrise-wall012-restored');assert signature==lowSignature();assert back['screenshotSHA256']==first['screenshotSHA256']
  page.locator('#inspection-glass').select_option('0.009');page.wait_for_url('**glass=0.009**');settle();capture('lowrise-glass009');assert page.evaluate('semanticInspection.buildings.find(b=>b.caseId==="lowrise").localModel.hostedComponents.apertures.filter(a=>a.observationId).every(a=>a.config.glassThickness===.009)')
  assert page.evaluate('JSON.stringify(semanticInspection.source)')==source and page.evaluate('JSON.stringify(semanticInspection.model.levels)')==levels
  rail=page.evaluate('''()=>{const a=semanticInspection.registry;return{rails:a.filter(r=>r.classKey==='handrail').length,stairs:a.filter(r=>r.classKey==='stair').length};}''');assert rail['rails'] and rail['stairs'];report['railClassification']=rail
  page.screenshot(path=str(out/'lowrise-relations-full-page.png'),full_page=True)
  action(lambda:page.set_viewport_size({'width':390,'height':844}));capture('mobile-lowrise');assert page.locator('#view').bounding_box()['width']>=360;page.screenshot(path=str(out/'mobile-full-page.png'),full_page=True)
  assert not report['errors'] and not report['httpFailures'],report;report['passed']=True;save();browser.close()
except Exception:
 report['errors'].append(traceback.format_exc());save();raise
finally:server.shutdown()
