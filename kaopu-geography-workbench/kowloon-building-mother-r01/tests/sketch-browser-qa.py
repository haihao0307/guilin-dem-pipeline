"""Actual WebGL functional-sketch regression, authorized unchanged QA workflow."""
import functools,http.server,json,threading,traceback,hashlib,concurrent.futures
from urllib.request import urlopen
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
out=Path('public-inspection-evidence');out.mkdir(exist_ok=True)
report={'passed':False,'scope':'Independent function-only building rule sketches, not actual buildings','errors':[],'frames':{},'physicalDeviceTested':False}
def save():(out/'sketch-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root.parent)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/building-rule-sketch-r05/sketches.html'
config=root/'sketch-r05-public-url.json'
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
  first=capture('connected-default-four');assert page.evaluate('sketchInspection.result.levels.length')==4;assert all(first['checks'][k] for k in ['foundationJointsContinuous','landingRearContact','landingFrameSupport','handrailsContinuous','handrailRouteClearance','wallSlabBeamContacts','centeredPlatformJunction']);assert page.locator('#retainedLiftPanel [data-lift-car-floor]').count()==4;page.screenshot(path=str(out/'sketch-full-page.png'),full_page=True)
  assert '当前剖视' in page.locator('#roof').inner_text()
  action(lambda:page.locator('#roof').click());roof=capture('four-storey-roof-shown');assert roof['values']['roofVisible'] and roof['sha256']!=first['sha256']
  action(lambda:page.locator('#roof').click());roofback=capture('four-storey-roof-cut-restored');assert not roofback['values']['roofVisible'] and roofback['sha256']==first['sha256']
  assert page.locator('[data-legacy]').count()==2
  action(lambda:page.locator('#joint').click());capture('r05-platform-column-junction')
  jointVisible=page.evaluate('''()=>{const s=sketchInspection,r=s.renderer,id=s.result.stair.connections[1].landingSupport.beamId,record=r.semanticRegistry.find(n=>n.nodeId===id);if(!record)return false;for(let y=0;y<r.canvas.height;y+=3)for(let x=0;x<r.canvas.width;x+=3)if(Math.abs(r.readHit(x,y).objectId-record.objectId)<.1)return true;return false;}''');assert jointVisible,'The actual second-floor platform beam must be visible in its named inspection view'
  action(lambda:page.locator('#ghost').click());capture('r05-junction-transparent')
  action(lambda:page.locator('#ghost').click())
  action(lambda:page.locator('#fit').click())
  action(lambda:page.locator('#storeys').select_option('2'))
  for case in ['connected']:
   action(lambda case=case:page.locator(f'[data-case={case}]').click())
   if case!='connected':assert page.locator('#retainedLiftPanel [data-lift-car-floor]:visible').count()==0
   for stage in ['1','4','7']:
    action(lambda stage=stage:page.locator('#stage').select_option(stage));capture(case+'-stage'+stage)
  capture('connected-roof-off')
  action(lambda:page.locator('[data-case=connected]').click());action(lambda:page.locator('#stage').select_option('4'))
  action(lambda:page.evaluate('sketchInspection.setCamera({eye:[7,4,-8],target:[2,3.6,2.5],fov:.5})'));capture('column-joints-close')
  action(lambda:page.locator('[data-case=connected]').click());action(lambda:page.locator('#stage').select_option('6'))
  action(lambda:page.evaluate('sketchInspection.setCamera({eye:[-7,2.4,2.8],target:[1.55,2.2,2.8],fov:.65})'));capture('thin-stair-underflight')
  # Back-to-back changes must settle on the final requested model, not a stale frame.
  n=page.evaluate('sketchInspection.frames.length')
  page.evaluate("""()=>{for(const value of ['3','5','4']){const e=document.querySelector('#stage');e.value=value;e.dispatchEvent(new Event('change'));}for(const key of ['connected'])document.querySelector('[data-case='+key+']').click();}""")
  settle(n);page.wait_for_function('sketchInspection.renderedValues.caseId==="connected"&&sketchInspection.renderedValues.stage===4&&!sketchInspection.busy');capture('rapid-final-connected-frame')
  action(lambda:page.locator('#stage').select_option('7'))
  action(lambda:page.locator('#top').click());capture('lift-corridor-top')
  action(lambda:page.locator('#fit').click())
  action(lambda:page.evaluate('sketchInspection.setCamera({eye:[7,1.5,11],target:[7,1.5,5],fov:.7})'));capture('window-door-openings-close')
  action(lambda:page.locator('#fit').click())
  action(lambda:page.evaluate('sketchInspection.setCamera({eye:[-2,-.1,-2],target:[0,-.3,0],fov:.6})'));capture('foundation-column-core-close')
  action(lambda:page.evaluate('sketchInspection.setCamera({eye:[3.5,2.8,3],target:[1.6,1.9,4.8],fov:.75})'));capture('landing-wall-support-rails-close')
  action(lambda:page.locator('#fit').click())
  # Preserve baseline geometry and exact restore across a single propagated input.
  sig=page.evaluate('JSON.stringify(sketchInspection.model.archetypes)')
  baseline=capture('connected-height36')
  def height(v):page.locator('#groundHeight').fill(v);page.locator('#groundHeight').press('Tab')
  action(lambda:height('4'));changed=capture('connected-height40');assert changed['sha256']!=baseline['sha256']
  action(lambda:height('3.6'));restored=capture('connected-height-restored');assert page.evaluate('JSON.stringify(sketchInspection.model.archetypes)')==sig
  # Actual visible +/- controls and true 2 -> 3 -> 5 -> 8 -> 2 regeneration.
  action(lambda:page.locator('#addFloor').click());capture('connected-three-storeys')
  assert page.evaluate('sketchInspection.result.levels.length')==3
  for count in ['5','8']:
   action(lambda count=count:page.locator('#storeys').select_option(count));capture('connected-'+count+'-storeys')
   multi=page.evaluate('({levels:sketchInspection.result.levels.length,connections:sketchInspection.result.stair.connections.length,lift:sketchInspection.result.lift})')
   assert multi['levels']==int(count) and multi['connections']==int(count)-1 and len(multi['lift']['stops'])==int(count)
   assert multi['lift']['shaftBottom']<0 and multi['lift']['directAttachment']
  action(lambda:page.locator('#removeFloor').click());assert page.evaluate('sketchInspection.result.levels.length')==7
  action(lambda:page.locator('#storeys').select_option('2'));capture('connected-two-storeys-restored')
  assert page.evaluate('JSON.stringify(sketchInspection.model.archetypes)')==sig
  semantic=page.evaluate("({portals:sketchInspection.result.portals,primitives:sketchInspection.model.archetypes.flatMap(a=>a.primitives)})")
  assert any(p.get('openingType')=='window' and p.get('sill',0)>0 for p in semantic['portals'])
  assert any(p.get('role')=='empty_doorway' and not p['leafIds'] for p in semantic['portals'])
  assert not any(':bridge' in p['nodeId'] for p in semantic['primitives'])
  action(lambda:page.locator('#focus').click());capture('desktop-expanded-workspace');page.screenshot(path=str(out/'desktop-expanded-full-page.png'),full_page=True)
  action(lambda:page.locator('#focus').click())
  # Use the retained elevator state machine, with inspectable paused checkpoints.
  action(lambda:page.locator('#liftPause').click())
  assert page.locator('#retainedLiftPanel [data-lift-car-floor]').count()==2
  action(lambda:page.locator('#retainedLiftPanel [data-lift-car-floor="teaching-sketch:connected:L1"]').click())
  action(lambda:page.evaluate('sketchInspection.advanceLift(2)'));capture('retained-lift-in-motion')
  moving=page.evaluate('sketchInspection.lift');assert moving['y']>0 and moving['y']<3.6 and moving['carDoor']==0
  assert all(v==0 for v in moving['landingDoors'].values())
  # Real timer-driven continuation is tested, not just direct output assignment.
  action(lambda:page.locator('#liftPause').click())
  page.wait_for_function('sketchInspection.lift.y===3.6 && sketchInspection.lift.carDoor>0')
  action(lambda:page.locator('#liftPause').click());capture('retained-lift-arrived')
  action(lambda:page.locator('#retainedLiftPanel [data-lift-door=open]').click())
  action(lambda:page.evaluate('sketchInspection.advanceLift(1.8)'));capture('connected-lift-doors-open')
  arrival=page.evaluate('sketchInspection.lift');assert arrival['y']==3.6 and arrival['carDoor']>0
  action(lambda:page.evaluate('sketchInspection.setCamera({eye:[10,5,-5],target:[8.2,4.5,.8],fov:.65})'));capture('lift-direct-threshold-close')
  action(lambda:page.locator('#fit').click())
  # Four-storey full-shaft trip uses original car-panel command and substep dynamics.
  action(lambda:page.locator('#storeys').select_option('4'))
  action(lambda:page.locator('#retainedLiftPanel [data-lift-car-floor="teaching-sketch:connected:L3"]').click())
  action(lambda:page.evaluate('sketchInspection.advanceLift(4)'));fourmoving=capture('four-storey-lift-travel')
  assert 0<fourmoving['lift']['y']<9.6 and fourmoving['lift']['carDoor']==0
  assert all(v==0 for v in fourmoving['lift']['landingDoors'].values())
  action(lambda:page.evaluate('''()=>{const s=sketchInspection;for(let i=0;i<200;i++){s.advanceLift(.2);const q=s.liftController.snapshot();if(q.y===9.6&&q.carDoor>0)break;}}'''))
  top=capture('four-storey-lift-top-arrival');assert top['lift']['y']==9.6 and top['lift']['carDoor']>0
  assert all(v==0 for k,v in top['lift']['landingDoors'].items() if not k.endswith(':L3'))
  action(lambda:page.locator('#storeys').select_option('2'))
  action(lambda:page.locator('#cut').click());cut=capture('connected-cutaway')
  # Display-only ghosting must expose inner structures without changing the model.
  physical=page.evaluate('JSON.stringify(sketchInspection.model)')
  action(lambda:page.locator('#ghost').click());ghost=capture('transparent-inspection');assert page.evaluate('JSON.stringify(sketchInspection.model)')==physical
  assert ghost['sha256']!=cut['sha256'];assert ghost['frame'].get('ghostInspection')
  action(lambda:page.locator('#ghost').click());opaque=capture('opaque-restored');assert page.evaluate('JSON.stringify(sketchInspection.model)')==physical
  assert opaque['sha256']==cut['sha256']
  # A real canvas hit must surface typed ownership/dependency information.
  hit=cut['hits'][len(cut['hits'])//2];box=page.locator('#sketch').bounding_box()
  action(lambda:page.mouse.click(box['x']+hit['x'],box['y']+cut['canvas']['h']-hit['y']))
  assert page.evaluate('Boolean(sketchInspection.selected)');assert len(page.locator('#selection').inner_text())>20
  page.screenshot(path=str(out/'sketch-selected-full-page.png'),full_page=True)
  n=page.evaluate('sketchInspection.frames.length');page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']/2+55,box['y']+box['height']/2+15,steps=2);page.mouse.up();settle(n);capture('connected-drag')
  action(lambda:page.locator('#cut').click());n=page.evaluate('sketchInspection.frames.length');page.set_viewport_size({'width':390,'height':844});settle(n);capture('mobile-viewport-connected');assert page.locator('#sketch').bounding_box()['width']>=360;assert page.locator('#sketch').bounding_box()['y']<300;page.screenshot(path=str(out/'mobile-viewport-full-page.png'),full_page=True)
  assert not report['errors'];assert not any(u.endswith(('.jpg','.png','.gltf','.glb')) for u in requests)
  report['checks']=['R05 connected-only joint repair, original prototypes linked unchanged','three growth stages each','footing-column and landing frame support interfaces','retained original lift panel commands, closed-door travel and aligned arrival','no source image/model asset requests','single height regeneration changed actual image and exact geometry rollback','empty door/window holes and direct lift doors','canvas picking ownership','actual camera drag'];report['requests']=requests;report['passed']=True;save();browser.close()
except Exception:
 report['errors'].append(traceback.format_exc());save();raise
finally:server.shutdown()

