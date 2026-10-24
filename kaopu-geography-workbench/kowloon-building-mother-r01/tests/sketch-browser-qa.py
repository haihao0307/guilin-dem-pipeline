"""Actual WebGL functional-sketch regression, authorized unchanged QA workflow."""
import functools,http.server,json,threading,traceback,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
out=Path('public-inspection-evidence');out.mkdir(exist_ok=True)
report={'passed':False,'scope':'Independent function-only building rule sketches, not actual buildings','errors':[],'frames':{},'physicalDeviceTested':False}
def save():(out/'sketch-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root.parent)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/building-mother-r10/sketches.html'
config=root/'sketch-public-url.json'
if config.exists():url=json.loads(config.read_text())['url'];report['scope']='Actual public independent sketches, no route overrides'
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1280,'height':900},device_scale_factor=1);page.set_default_timeout(180000)
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  requests=[];page.on('request',lambda r:requests.append(r.url))
  page.goto(url,wait_until='domcontentloaded')
  def settle(before=-1):
   page.wait_for_function('n=>window.sketchInspection&&(sketchInspection.errors.length||sketchInspection.ready&&!sketchInspection.busy&&sketchInspection.frames.length>n)',arg=before)
   assert not page.evaluate('sketchInspection.errors'),page.evaluate('sketchInspection.errors')
  def capture(name):
   settle();q=page.evaluate('''()=>{const s=sketchInspection,r=s.renderer,p=r.readPixels(),colors=new Set(),hits=[];for(let i=0;i<p.length;i+=4)colors.add(p[i]+256*p[i+1]+65536*p[i+2]);for(let y=16;y<r.canvas.height;y+=24)for(let x=16;x<r.canvas.width;x+=24){const h=r.readHit(x,y);if(h.objectId>=10000)hits.push({x,y,id:h.objectId});}return{values:s.values,checks:s.result.checks,counts:s.result.counts,frame:s.frames.at(-1),colors:colors.size,hits,gpu:r.gpu,glError:r.gl.getError(),canvas:{w:r.canvas.width,h:r.canvas.height},sourcePatches:r.measured.patches.length};}''')
   assert q['colors']>=4,(name,q['colors']);assert len({h['id'] for h in q['hits']})>=2,name;assert q['glError']==0;assert q['sourcePatches']==0
   raw=page.locator('#sketch').screenshot(path=str(out/(name+'.png')));q['sha256']=hashlib.sha256(raw).hexdigest();report['frames'][name]=q;save();print('CAPTURE',name,round(q['frame']['wallMs']),flush=True);return q
  def action(fn):
   n=page.evaluate('sketchInspection.frames.length');fn();settle(n)
  first=capture('cell-frame');page.screenshot(path=str(out/'sketch-full-page.png'),full_page=True)
  for case in ['cell','vertical','connected']:
   action(lambda case=case:page.locator(f'[data-case={case}]').click())
   for stage in ['1','4','7']:
    action(lambda stage=stage:page.locator('#stage').select_option(stage));capture(case+'-stage'+stage)
  action(lambda:page.locator('#roof').click());capture('connected-roof-off')
  # Preserve baseline geometry and exact restore across a single propagated input.
  sig=page.evaluate('JSON.stringify(sketchInspection.model.archetypes)')
  baseline=capture('connected-height36')
  def height(v):page.locator('#groundHeight').fill(v);page.locator('#groundHeight').press('Tab')
  action(lambda:height('4'));changed=capture('connected-height40');assert changed['sha256']!=baseline['sha256']
  action(lambda:height('3.6'));restored=capture('connected-height-restored');assert page.evaluate('JSON.stringify(sketchInspection.model.archetypes)')==sig
  action(lambda:page.locator('#door').click());capture('connected-doors-open')
  action(lambda:page.locator('#lift').click());capture('connected-lift-upper')
  action(lambda:page.locator('#liftDoor').click());capture('connected-lift-doors-open')
  action(lambda:page.locator('#cut').click());cut=capture('connected-cutaway')
  # A real canvas hit must surface typed ownership/dependency information.
  hit=cut['hits'][len(cut['hits'])//2];box=page.locator('#sketch').bounding_box()
  page.mouse.click(box['x']+hit['x'],box['y']+cut['canvas']['h']-hit['y']);settle()
  assert page.evaluate('Boolean(sketchInspection.selected)');assert len(page.locator('#selection').inner_text())>20
  page.screenshot(path=str(out/'sketch-selected-full-page.png'),full_page=True)
  n=page.evaluate('sketchInspection.frames.length');page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']/2+55,box['y']+box['height']/2+15,steps=2);page.mouse.up();settle(n);capture('connected-drag')
  assert not report['errors'];assert not any(u.endswith(('.jpg','.png','.gltf','.glb')) for u in requests)
  report['checks']=['three real WebGL sketches','three growth stages each','no source image/model asset requests','single height regeneration changed actual image and exact geometry rollback','door and lift illustrative controls','canvas picking ownership','actual camera drag'];report['requests']=requests;report['passed']=True;save();browser.close()
except Exception:
 report['errors'].append(traceback.format_exc());save();raise
finally:server.shutdown()
