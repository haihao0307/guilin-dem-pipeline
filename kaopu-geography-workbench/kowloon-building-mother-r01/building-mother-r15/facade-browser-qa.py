import functools,http.server,json,threading,traceback,hashlib,concurrent.futures
from urllib.request import urlopen
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent;out=Path('public-inspection-evidence');out.mkdir(exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root.parent)));threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/building-mother-r15/index.html';report={'passed':False,'errors':[],'frames':{}}
config=root/'r15-public-manifest.json'
if config.exists():
 cfg=json.loads(config.read_text());url=cfg['url'];report['publicNoOverrides']=True
 def verify(item):
  path,sha=item;raw=urlopen(url.rsplit('/',1)[0]+'/'+path,timeout=60).read();assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==sha,path;return path
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:report['verifiedFiles']=list(pool.map(verify,cfg['files'].items()))
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);p=b.new_page(viewport={'width':1366,'height':900});p.set_default_timeout(240000);p.on('pageerror',lambda e:report['errors'].append(str(e)))
  for mode in ['R0']:
   p.goto(url+'?facade='+mode);p.wait_for_function('window.semanticInspection&&(semanticInspection.errors.length||semanticInspection.ready&&!semanticInspection.busy)');report['diagnostic-'+mode]=p.evaluate('({errors:semanticInspection.errors,compiles:semanticInspection.renderer.compileStats,frame:semanticInspection.renderer.currentFrameStats})');assert not p.evaluate('semanticInspection.errors'),p.evaluate('semanticInspection.errors')
   assert p.evaluate('semanticInspection.caseId')=='kcc';n=p.evaluate('semanticInspection.model.hostedComponents.apertures.filter(a=>a.caseId==="kcc").length');assert n==(0 if mode=='off' else 176),n
   assert p.locator('[data-opening-observation]').count()==0
   p.locator('#view').screenshot(path=str(out/f'kcc-main-{mode}.png'));p.screenshot(path=str(out/f'kcc-main-{mode}-page.png'),full_page=True)
   report['frames'][mode]=p.evaluate('({camera:semanticInspection.renderer.options,stats:semanticInspection.lastStats,registration:semanticInspection.buildings.find(b=>b.caseId==="kcc").localModel.facadeRegistration})')
  # Main source scene: identical panel close-up before/after, no detached demo.
  for detail in ['off','on']:
   p.goto(url+'?facade=R0&warehouseDetail='+detail);p.wait_for_function('window.semanticInspection&&semanticInspection.ready&&!semanticInspection.busy');assert not p.evaluate('semanticInspection.errors')
   p.locator('[data-building=warehouse]').click();p.wait_for_function('semanticInspection.caseId==="warehouse"&&!semanticInspection.busy');assert not p.locator('.facade-controls').is_visible()
   panel=p.evaluate('semanticInspection.registry.find(r=>r.caseId==="warehouse"&&r.prototypeNodeId==="warehouse-p012-grid-candidate-01:mapped-boundary")');assert panel
   p.locator('#objects').select_option(str(panel['objectId']));p.get_by_role('button',name='拉近所选构件',exact=True).click();p.wait_for_function('!semanticInspection.busy')
   if detail=='off':
    comparisonCamera=p.evaluate('({...structuredClone(semanticInspection.renderer.options),selectedId:-1})');p.evaluate('async c=>{Object.assign(semanticInspection.renderer.options,c);await semanticInspection.render()}',comparisonCamera)
   else:
    p.evaluate('async c=>{Object.assign(semanticInspection.renderer.options,c);await semanticInspection.render()}',comparisonCamera);p.wait_for_function('!semanticInspection.busy')
   p.locator('#view').screenshot(path=str(out/f'warehouse-grid-{detail}.png'));p.screenshot(path=str(out/f'warehouse-grid-{detail}-page.png'),full_page=True)
   report['frames']['warehouse-'+detail]=p.evaluate('({camera:semanticInspection.renderer.options,stats:semanticInspection.lastStats})')
   if detail=='on':
    proj=p.evaluate('semanticInspection.buildings.find(b=>b.caseId==="warehouse").localModel.facadePanelProjection');assert len(proj['unitRecords'])==12;assert proj['glass']==0 and proj['wallCuts']==0;report['warehouseProjection']=proj
    unit=p.evaluate('semanticInspection.registry.find(r=>r.caseId==="warehouse"&&r.prototypeNodeId==="warehouse-p012:external-unit-01")');assert unit
    p.locator('#objects').select_option(str(unit['objectId']));p.get_by_role('button',name='拉近所选构件',exact=True).click();p.wait_for_function('!semanticInspection.busy');p.screenshot(path=str(out/'warehouse-unit-visible-front.png'),full_page=True)
  assert report['frames']['warehouse-off']['camera']['eye']==report['frames']['warehouse-on']['camera']['eye']
  assert report['frames']['warehouse-off']['camera']['target']==report['frames']['warehouse-on']['camera']['target']
  for name in ['lowrise','warehouse','kcc']:
   p.locator('[data-building='+name+']').click();p.wait_for_function('id=>semanticInspection.caseId===id&&!semanticInspection.busy',arg=name);assert p.locator('#view').bounding_box()['height']>=350;p.screenshot(path=str(out/f'switch-{name}-page.png'),full_page=True)
  # Color-only toggle: geometry identities, camera and building state are unchanged.
  p.locator('[data-building=lowrise]').click();p.wait_for_function('semanticInspection.caseId==="lowrise"&&!semanticInspection.busy')
  baseline=p.evaluate('({ids:semanticInspection.registry.map(r=>r.objectId),bounds:semanticInspection.source.bounds,camera:structuredClone(semanticInspection.renderer.options)})')
  p.locator('#semanticMode').click();p.wait_for_function('semanticInspection.semanticMode&&!semanticInspection.busy');p.screenshot(path=str(out/'lowrise-semantic-colors.png'),full_page=True)
  assert p.evaluate('semanticInspection.registry.map(r=>r.objectId)')==baseline['ids']
  assert p.evaluate('semanticInspection.renderer.options.eye')==baseline['camera']['eye']
  p.locator('#semanticMode').click();p.wait_for_function('!semanticInspection.semanticMode&&!semanticInspection.busy')
  assert not report['errors'];report['passed']=True;report['scope']='R15 warehouse source-hosted visible lattice and clipped unit fronts; same camera before/after; three building switches';b.close()
except Exception:report['errors'].append(traceback.format_exc());raise
finally:(out/'r15-facade-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));server.shutdown()
