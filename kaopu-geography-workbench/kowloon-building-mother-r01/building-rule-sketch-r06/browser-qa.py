"""Actual WebGL functional-sketch regression, authorized unchanged QA workflow."""
import functools,http.server,json,threading,traceback,hashlib,concurrent.futures
from urllib.request import urlopen
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
out=Path('public-inspection-evidence');out.mkdir(exist_ok=True)
report={'passed':False,'scope':'Independent function-only building rule sketches, not actual buildings','errors':[],'frames':{},'physicalDeviceTested':False}
def save():(out/'r06-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root.parent)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/building-rule-sketch-r06/sketches.html'
config=root/'sketch-r06-public-url.json'
if config.exists():
 cfg=json.loads(config.read_text());url=cfg['url'];report['scope']='Actual public independent sketches, no route overrides'
 def verify(item):
  raw=urlopen(url.rsplit('/',1)[0]+'/'+item['path'],timeout=60).read();actual=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest();assert actual==item['sha'],item['path'];return item['path']
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:report['verifiedPublicFiles']=list(pool.map(verify,cfg['files']))
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
   settle();q=page.evaluate('''()=>{const s=sketchInspection,r=s.renderer,p=r.readPixels(),colors=new Set(),hits=[];for(let i=0;i<p.length;i+=4)colors.add(p[i]+256*p[i+1]+65536*p[i+2]);for(let y=16;y<r.canvas.height;y+=24)for(let x=16;x<r.canvas.width;x+=24){const h=r.readHit(x,y);if(h.objectId>=10000)hits.push({x,y,id:h.objectId});}return{values:s.values,lift:s.lift,checks:s.result.checks,counts:s.result.counts,frame:s.frames.at(-1),colors:colors.size,hits,gpu:r.gpu,glError:r.gl.getError(),canvas:{w:r.canvas.width,h:r.canvas.height},sourcePatches:r.measured.patches.length};}''')
   assert not q['frame'].get('cancelled');assert q['colors']>=4,(name,q['colors']);assert len({h['id'] for h in q['hits']})>=2,name;assert q['glError']==0;assert q['sourcePatches']==0
   raw=page.locator('#sketch').screenshot(path=str(out/(name+'.png')));q['sha256']=hashlib.sha256(raw).hexdigest();report['frames'][name]=q;save();print('CAPTURE',name,round(q['frame']['wallMs']),flush=True);return q
  def action(fn):
   n=page.evaluate('sketchInspection.frames.length');fn();settle(n)
  first=capture('connected-default-four');assert page.evaluate('sketchInspection.result.levels.length')==4;assert all(first['checks'][k] for k in ['foundationJointsContinuous','landingRearContact','landingFrameSupport','handrailsContinuous','handrailRouteClearance','wallSlabBeamContacts','centeredPlatformJunction']);assert page.locator('#retainedLiftPanel [data-lift-car-floor]').count()==4;page.screenshot(path=str(out/'r06-full-page.png'),full_page=True)
  assert page.evaluate('sketchInspection.result.counts.windows')==8
  action(lambda:page.evaluate('sketchInspection.setCamera({eye:[14,6,7],target:[6,4,3.5],fov:.65})'));capture('r06-added-side-windows')
  action(lambda:page.evaluate('sketchInspection.setCamera({eye:[5,6,1],target:[1.6,4.5,3.3],fov:.65})'));capture('r06-stairs-handrails-distinct')
  colors=page.evaluate("""()=>{const r=sketchInspection.renderer.semanticRegistry;return{handrails:r.filter(x=>x.classKey==='handrail').length,stairs:r.filter(x=>x.classKey==='stair').length};}""");assert colors['handrails']>0 and colors['stairs']>0;report['classification']=colors
  action(lambda:page.locator('#ghost').click());capture('r06-transparent-inspection')
  action(lambda:page.locator('#ghost').click());action(lambda:page.locator('#fit').click())
  for n in ['2','5','4']:
   action(lambda n=n:page.locator('#storeys').select_option(n));q=capture('r06-storeys-'+n);assert q['counts']['windows']==int(n)*2
  box=page.locator('#sketch').bounding_box();n=page.evaluate('sketchInspection.frames.length');page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']/2+50,box['y']+box['height']/2+12,steps=2);page.mouse.up();settle(n);capture('r06-desktop-drag')
  action(lambda:page.set_viewport_size({'width':390,'height':844}));capture('r06-mobile');assert page.locator('#sketch').bounding_box()['width']>=360;page.screenshot(path=str(out/'r06-mobile-full-page.png'),full_page=True)
  assert not report['errors'];assert not any(u.endswith(('.jpg','.png','.gltf','.glb')) for u in requests);report['passed']=True;report['requests']=requests;save();browser.close()
except Exception:
 report['errors'].append(traceback.format_exc());save();raise
finally:server.shutdown()
