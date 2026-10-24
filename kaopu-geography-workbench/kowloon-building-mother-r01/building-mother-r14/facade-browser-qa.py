import functools,http.server,json,threading,traceback,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent;out=Path('public-inspection-evidence');out.mkdir(exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root.parent)));threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/building-mother-r14/index.html';report={'passed':False,'errors':[],'frames':{}}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);p=b.new_page(viewport={'width':1366,'height':900});p.set_default_timeout(240000);p.on('pageerror',lambda e:report['errors'].append(str(e)))
  for mode in ['off','R0','R180']:
   p.goto(url+'?facade='+mode);p.wait_for_function('window.semanticInspection&&(semanticInspection.errors.length||semanticInspection.ready&&!semanticInspection.busy)');assert not p.evaluate('semanticInspection.errors'),p.evaluate('semanticInspection.errors')
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
  assert not report['errors'];report['passed']=True;b.close()
except Exception:report['errors'].append(traceback.format_exc());raise
finally:(out/'r14-facade-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));server.shutdown()
