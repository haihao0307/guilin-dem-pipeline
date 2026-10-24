import functools,http.server,json,threading,traceback,hashlib,concurrent.futures
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent;out=Path('public-inspection-evidence');out.mkdir(exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root.parent)));threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/building-mother-r16/index.html';report={'passed':False,'errors':[],'frames':{}}
config=root/'r16-public-manifest.json'
if config.exists():
 cfg=json.loads(config.read_text());url=cfg['url'];report['publicNoOverrides']=True
 def verify(item):
  path,sha=item;raw=urlopen(url.rsplit('/',1)[0]+'/'+path,timeout=60).read();assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==sha,path;return path
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:report['verifiedFiles']=list(pool.map(verify,cfg['files'].items()))
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);p=b.new_page(viewport={'width':1366,'height':900});p.set_default_timeout(240000);p.on('pageerror',lambda e:report['errors'].append(str(e)))
  p.goto(url);p.wait_for_function('window.semanticInspection&&semanticInspection.ready&&!semanticInspection.busy');assert not p.evaluate('semanticInspection.errors')
  ids=p.evaluate('semanticInspection.registry.map(r=>r.objectId)')
  for name in ['kcc','warehouse','lowrise']:
   p.locator('[data-building='+name+']').click();p.wait_for_function('id=>semanticInspection.caseId===id&&!semanticInspection.busy',arg=name)
   p.screenshot(path=str(out/f'{name}-material.png'),full_page=True);report['frames'][name]=p.evaluate('semanticInspection.lastStats');assert p.locator('#view').bounding_box()['height']>=350
   camera=p.evaluate('structuredClone(semanticInspection.renderer.options)');p.locator('#materialMode').click();p.wait_for_function('semanticInspection.materialMode===false&&!semanticInspection.busy');p.screenshot(path=str(out/f'{name}-r15-colors.png'),full_page=True)
   assert p.evaluate('semanticInspection.renderer.options.eye')==camera['eye'];assert p.evaluate('semanticInspection.registry.map(r=>r.objectId)')==ids
   p.locator('#materialMode').click();p.wait_for_function('semanticInspection.materialMode===true&&!semanticInspection.busy')
  p.locator('[data-building=kcc]').click();p.wait_for_function('semanticInspection.caseId==="kcc"&&!semanticInspection.busy')
  w=p.evaluate('semanticInspection.registry.find(r=>r.caseId==="kcc"&&r.classKey==="window"&&r.localFloorId==="T20"&&r.part!=="glass")');assert w
  p.locator('#objects').select_option(str(w['objectId']));p.locator('#focus').click();p.wait_for_function('!semanticInspection.busy');p.screenshot(path=str(out/'kcc-filtered-joints-close.png'),full_page=True)
  report['closeFrame']=p.evaluate('semanticInspection.lastStats')
  p.locator('[data-building=lowrise]').click();p.wait_for_function('semanticInspection.caseId==="lowrise"&&!semanticInspection.busy')
  p.locator('#semanticMode').click();p.wait_for_function('semanticInspection.semanticMode&&!semanticInspection.busy');p.screenshot(path=str(out/'semantic-colors.png'),full_page=True)
  p.locator('#semanticMode').click();p.wait_for_function('!semanticInspection.semanticMode&&!semanticInspection.busy')
  p.locator('#materialColor').evaluate("e=>e.value='#cddcea'");p.locator('#materialColor').dispatch_event('change');p.wait_for_function('!semanticInspection.busy');p.screenshot(path=str(out/'lowrise-edited-color.png'),full_page=True)
  p.locator('#resetMaterial').click();p.wait_for_function('!semanticInspection.busy');assert p.locator('#materialColor').input_value()=='#e4dfcb';assert p.evaluate('semanticInspection.registry.map(r=>r.objectId)')==ids
  assert not report['errors'];report['passed']=True;b.close()
except Exception:report['errors'].append(traceback.format_exc());raise
finally:(out/'r16-material-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));server.shutdown()
