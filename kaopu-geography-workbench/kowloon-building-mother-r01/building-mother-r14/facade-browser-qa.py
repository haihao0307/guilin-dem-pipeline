import functools,http.server,json,threading,traceback,hashlib,concurrent.futures
from urllib.request import urlopen
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent;out=Path('public-inspection-evidence');out.mkdir(exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root.parent)));threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/building-mother-r14/index.html';report={'passed':False,'errors':[],'frames':{}}
config=root/'r14-public-manifest.json'
if config.exists():
 cfg=json.loads(config.read_text());url=cfg['url'];report['publicNoOverrides']=True
 def verify(item):
  path,sha=item;raw=urlopen(url.rsplit('/',1)[0]+'/'+path,timeout=60).read();assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==sha,path;return path
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:report['verifiedFiles']=list(pool.map(verify,cfg['files'].items()))
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);p=b.new_page(viewport={'width':1366,'height':900});p.set_default_timeout(240000);p.on('pageerror',lambda e:report['errors'].append(str(e)))
  for mode in ['off','R0','R180']:
   p.goto(url+'?facade='+mode);p.wait_for_function('window.semanticInspection&&(semanticInspection.errors.length||semanticInspection.ready&&!semanticInspection.busy)');report['diagnostic-'+mode]=p.evaluate('({errors:semanticInspection.errors,compiles:semanticInspection.renderer.compileStats,frame:semanticInspection.renderer.currentFrameStats})');assert not p.evaluate('semanticInspection.errors'),p.evaluate('semanticInspection.errors')
   assert p.evaluate('semanticInspection.caseId')=='kcc';n=p.evaluate('semanticInspection.model.hostedComponents.apertures.filter(a=>a.caseId==="kcc").length');assert n==(0 if mode=='off' else 176),n
   assert p.locator('[data-opening-observation]').count()==0
   p.locator('#view').screenshot(path=str(out/f'kcc-main-{mode}.png'));p.screenshot(path=str(out/f'kcc-main-{mode}-page.png'),full_page=True)
   report['frames'][mode]=p.evaluate('({camera:semanticInspection.renderer.options,stats:semanticInspection.lastStats,registration:semanticInspection.buildings.find(b=>b.caseId==="kcc").localModel.facadeRegistration})')
  assert report['frames']['off']['camera']['eye']==report['frames']['R0']['camera']['eye'];assert (out/'kcc-main-off.png').read_bytes()!=(out/'kcc-main-R0.png').read_bytes()
  p.get_by_role('button',name='R0 候选',exact=True).click();p.wait_for_url('**facade=R0');p.wait_for_function('semanticInspection.ready&&!semanticInspection.busy')
  # Fit a physically bound window through existing inspector, not detached viewer.
  rec=p.evaluate('semanticInspection.registry.find(r=>r.caseId==="kcc"&&r.classKey==="window"&&r.part==="glass")');assert rec
  p.locator('#objects').select_option(str(rec['objectId']));p.get_by_role('button',name='拉近所选构件',exact=True).click();p.wait_for_function('!semanticInspection.busy');p.locator('#view').screenshot(path=str(out/'kcc-main-window-close.png'));p.screenshot(path=str(out/'kcc-main-window-source-page.png'),full_page=True)
  for name in ['lowrise','warehouse','kcc']:
   p.locator('[data-building='+name+']').click();p.wait_for_function('id=>semanticInspection.caseId===id&&!semanticInspection.busy',arg=name);assert p.locator('#view').bounding_box()['height']>=350;p.screenshot(path=str(out/f'switch-{name}-page.png'),full_page=True)
  p.locator('[data-building=warehouse]').click();p.wait_for_function('semanticInspection.caseId==="warehouse"&&!semanticInspection.busy')
  panel=p.evaluate('semanticInspection.registry.find(r=>r.caseId==="warehouse"&&r.archetypeId==="warehouse-observed-facade-panels")');assert panel
  p.locator('#objects').select_option(str(panel['objectId']));p.get_by_role('button',name='拉近所选构件',exact=True).click();p.wait_for_function('!semanticInspection.busy');p.screenshot(path=str(out/'warehouse-main-panel-source-page.png'),full_page=True)
  report['warehouseProjection']=p.evaluate('semanticInspection.buildings.find(b=>b.caseId==="warehouse").localModel.facadePanelProjection')
  assert report['warehouseProjection']['wallCuts']==0 and report['warehouseProjection']['glass']==0
  assert not report['errors'];report['passed']=True;b.close()
except Exception:report['errors'].append(traceback.format_exc());raise
finally:(out/'r14-facade-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));server.shutdown()
