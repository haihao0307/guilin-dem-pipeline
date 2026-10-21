#!/usr/bin/env python3
"""Actual same-window corner/whole rendering; first image is independently collectible."""
import argparse,json,pathlib,time,traceback
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--url',required=True);ap.add_argument('--output',required=True);a=ap.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
A='window.__IMPLICIT_BUILDING__';Q='window.__MATERIAL_QUALITY__';start=time.monotonic();r={'status':'running','coverage':'Chromium SwiftShader only, authored design details not measured joinery','stages':[],'errors':[],'screenshots':[]}
def save():(out/'corner-results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def log(message):print(f'{time.monotonic()-start:.2f}s {message}',flush=True)
def check(v,m):
 if not v:raise AssertionError(m)
def stage(name):r['stages'].append({'name':name,'atSeconds':time.monotonic()-start});save();log(name)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=browser.new_page(viewport={'width':1060,'height':830},device_scale_factor=1);page.set_default_timeout(120000);page.on('pageerror',lambda e:r['errors'].append(str(e)))
 def settle():return page.evaluate(A+'.awaitSettled({timeoutMs:90000})')
 def capture(name):
  page.screenshot(path=str(out/(name+'.png')));page.locator('#view').screenshot(path=str(out/(name+'-canvas.png')));r['screenshots'] += [name+'.png',name+'-canvas.png'];save();log('CAPTURE '+name)
 def sample(name,width=640):
  stage('SAMPLING '+name);page.evaluate('w=>{window.__cornerPromise=window.__MATERIAL_QUALITY__.render({width:w,height:508,samplesPerAxis:2,tileSide:64}).then(v=>({ok:true,v}),e=>({ok:false,message:e.message,name:e.name}));}',width)
  last=-1;deadline=time.monotonic()+360
  while True:
   q=page.evaluate(Q+'.snapshot()');job=q.get('job') or {};done=job.get('done',0)
   if done//32!=last:last=done//32;log(f"TILE {name} {job.get('status')} {done}/{job.get('total')} ")
   if job.get('status') in ['complete','failed','cancelled']:break
   if time.monotonic()>deadline:page.evaluate(Q+'.cancel()');raise TimeoutError('Bounded 360s corner sampling wall deadline; no completed frame claimed')
   page.wait_for_timeout(1000)
  value=page.evaluate('window.__cornerPromise');check(value['ok'],'quality result '+str(value));settle();state=page.evaluate(Q+'.snapshot()');scale=state['samplingScale'];check(abs(scale['sourcePixelsPerCSSPixel'][0]-1)<.005 and abs(scale['sourcePixelsPerCSSPixel'][1]-1)<.005,'native 1:1 CSS/output ratio');r[name]=value['v'];r[name]['samplingScale']=scale;capture(name)
 try:
  stage('ordinary cold initialization');page.goto(a.url,wait_until='networkidle');page.wait_for_function(A+'?.ready || '+A+'?.errors?.length',timeout=120000);check(page.evaluate(A+'?.ready'),'normal cold initialization failed');settle();r['cold']=page.evaluate('window.__GPU_RECOVERY__.snapshot()')
  # No postprocessing enlargement: 640x508 drawing buffer is shown at exactly 640x508 CSS px.
  page.add_style_tag(content='main{grid-template-columns:642px 350px!important}.viewport{width:642px!important;height:510px!important;min-height:0!important;position:relative!important;top:0!important}.canvas-note,.viewbar,.render-label{display:none!important}')
  page.evaluate(A+'.setResolution(32,25)');settle()
  cameras=page.evaluate("""()=>{const a=window.__IMPLICIT_BUILDING__,s=a.snapshot(),b=s.hosted.bindings.find(x=>x.key==='residentialWindow'),f=b.apertureFrame??b.frame;const point=(x,y,z)=>f.origin.map((p,i)=>p+f.u[i]*x+f.v[i]*y+f.w[i]*z);return {corner:{eye:point(.38,.48,.47),target:point(.24,.45,.105),fov:Math.PI/4},whole:{eye:point(.34,.14,1.80),target:point(0,0,.12),fov:Math.PI/4}};}""");r['cameras']=cameras
  page.evaluate('(c)=>window.__IMPLICIT_BUILDING__.setRenderOptions({...c,studyLighting:1,studyExposure:1,localContactVisibility:1})',cameras['corner']);page.evaluate(Q+'.setMaterial({frameMaterialMode:1,doorMaterialMode:1})');settle();r['case']=page.evaluate(A+'.snapshot()');sample('window-corner-timber-640aa');(out/'first-ready').write_text('first actual complete timber corner available');log('FIRST_IMAGE_READY')
  page.evaluate(A+'.setResolution(32,25)');settle();page.evaluate(Q+'.setMaterial({frameMaterialMode:2,doorMaterialMode:2,paintRoughness:.31,paintClearcoat:.45,paintClearcoatRoughness:.23})');settle();sample('window-corner-painted-640aa');(out/'pair-ready').write_text('actual wood paint pair available');log('PAIR_READY')
  page.evaluate(A+'.setResolution(32,25)');settle();page.evaluate('(c)=>window.__IMPLICIT_BUILDING__.setRenderOptions(c)',cameras['whole']);settle();sample('window-whole-painted-640aa')
  page.evaluate(A+'.setResolution(32,25)');settle();page.evaluate(Q+'.setMaterial({frameMaterialMode:1,doorMaterialMode:1})');settle();sample('window-whole-timber-640aa')
  stage('actual GPU chamfer distance and ray parity after first images')
  page.evaluate(A+'.setResolution(32,25)');settle()
  r['bevelParity']=page.evaluate("""async()=>{const a=window.__IMPLICIT_BUILDING__,m=await import('./material-quality-r01/apertures.mjs'),rays=m.apertureBevelProbeRays(a.spec().apertures),cpu=rays.map(r=>a.intersectRay(r.origin,r.direction)),gpu=await a.probe(rays.map(r=>r.origin),4,rays.map(r=>r.direction)),mismatches=[];let maxTErrorM=0;for(let i=0;i<rays.length;i++){const c=cpu[i],g=gpu[i],e=c.hit?Math.abs(c.t-g[0]):0;maxTErrorM=Math.max(maxTErrorM,e);if((c.hit?1:2)!==Math.round(g[2])||e>.00005||(c.hit&&c.objectId!==Math.round(g[1])))mismatches.push({ray:rays[i],cpu:c,gpu:g});}return {rays:rays.length,maxTErrorM,mismatches,passed:!mismatches.length,pointParity:await a.parity(rays.map(r=>r.expectedPoint))};}""")
  check(r['bevelParity']['passed'],'actual GPU chamfer ray parity');check(r['bevelParity']['pointParity']['passed'],'actual GPU chamfer distance/normal/identity parity')
  check(not r['errors'],'no browser page errors');r['status']='actual_corner_and_whole_captured_pending_visual_acceptance';save();log('COMPLETE')
 except Exception as e:
  r['status']='failed';r['failure']=str(e);r['traceback']=traceback.format_exc();save();log('FAILED '+str(e))
  try:capture('corner-failure');r['failureState']=page.evaluate('({gpu:window.__GPU_RECOVERY__?.snapshot(),quality:window.__MATERIAL_QUALITY__?.snapshot()})');save()
  except Exception:pass
 finally:
  (out/'done').write_text(r['status']);save();browser.close()
raise SystemExit(0 if r['status'].startswith('actual_') else 1)
