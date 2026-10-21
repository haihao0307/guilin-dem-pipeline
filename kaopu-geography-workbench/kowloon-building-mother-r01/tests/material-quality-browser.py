#!/usr/bin/env python3
import argparse,hashlib,json,pathlib,time,traceback
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',required=True);a=p.parse_args();o=pathlib.Path(a.output);o.mkdir(parents=True,exist_ok=True);A='window.__IMPLICIT_BUILDING__';Q='window.__MATERIAL_QUALITY__';r={'status':'running','scope':'same hosted cases and unchanged field geometry; actual material and subpixel rendering','coldStartCoverage':'QA uses explicit 1px blocking warmup, NOT ordinary-start/recovery acceptance','screenshots':[],'cases':{},'errors':[],'failures':[]}
def save():(o/'results.json').write_text(json.dumps(r,indent=2,ensure_ascii=False))
def check(ok,label):
 if not ok:raise AssertionError(label)
with sync_playwright() as w:
 b=w.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);page.set_default_timeout(180000);page.on('pageerror',lambda e:r['errors'].append(str(e)))
 page.add_init_script("""window.__audit={buffers:0,indexed:0,draws:0,counts:[]};for(const [n,k]of[['createBuffer','buffers'],['drawElements','indexed']]){const f=WebGL2RenderingContext.prototype[n];WebGL2RenderingContext.prototype[n]=function(...a){window.__audit[k]++;return f.apply(this,a);};}const f=WebGL2RenderingContext.prototype.drawArrays;WebGL2RenderingContext.prototype.drawArrays=function(m,s,n){window.__audit.draws++;if(!window.__audit.counts.includes(n))window.__audit.counts.push(n);return f.call(this,m,s,n);};""")
 def capture(name):page.screenshot(path=str(o/(name+'.png')));r['screenshots'].append(name+'.png');save()
 def render(width=640,samples=2):
  result=page.evaluate('([width,samplesPerAxis])=>window.__MATERIAL_QUALITY__.render({width,samplesPerAxis})',[width,samples]);check(result['status']=='complete','quality render completed');check(result['done']==result['total'],'all tiles completed');return result
 try:
  started=time.monotonic();page.goto(a.url+'?qa-warmup=1',wait_until='networkidle',timeout=180000);page.wait_for_function(A+'?.ready || '+A+'?.errors?.length',timeout=180000);check(page.evaluate(A+'?.ready'),'initial material shader ready: '+str(page.evaluate(A+'?.errors')));r['qaWarmupWallSeconds']=time.monotonic()-started;r['warmup']=page.evaluate(A+'.snapshot().renderer.compileProfile')
  # Actual owned wood and paint shading on the SAME already-hosted lowrise window.
  c=r['cases']['lowrise']={};page.evaluate(A+'.setResolution(64,48)');page.evaluate(Q+'.setMaterial({frameMaterialMode:1,doorMaterialMode:1})');page.evaluate(A+'.awaitSettled()');c['woodMaterial']=page.evaluate(Q+'.snapshot()');c['woodFrame']=render();capture('window-original-timber-4spp')
  c['woodField']=page.evaluate(A+'.probePoints().slice(0,16).map(p=>'+A+'.query(p))');page.evaluate(Q+'.setMaterial({frameMaterialMode:2,doorMaterialMode:2})');c['paintFrame']=render();capture('window-opaque-paint-4spp');c['paintField']=page.evaluate(A+'.probePoints().slice(0,16).map(p=>'+A+'.query(p))');check(c['woodField']==c['paintField'],'finish choices did not change field geometry')
  page.evaluate(A+'.applyHosted("residentialWindow",{openT:.6})');c['openFrame']=render();capture('window-open-reflection-4spp');page.evaluate(A+'.setResolution(64,48)');c['finiteGlassParity']=page.evaluate(A+'.opticalParity()');check(c['finiteGlassParity']['passed'],'finite glass transport unchanged');c['fieldParity']=page.evaluate(A+'.parity('+A+'.probePoints().slice(0,24))');check(c['fieldParity']['passed'],'same field coordinates/identities')
  # Cancel before presentation: old full image stays intact; no partial different-camera picture.
  page.evaluate(A+'.resumeViewport()');page.evaluate(A+'.awaitSettled()');page.evaluate('()=>{window.__qualityPending=window.__MATERIAL_QUALITY__.render({width:320}).then(x=>({resolved:true,x}),e=>({rejected:true,name:e.name,message:e.message}));}')
  page.wait_for_function(Q+'.snapshot().job?.status==="rendering"');page.evaluate(Q+'.cancel()');c['cancel']=page.evaluate('window.__qualityPending');check(c['cancel'].get('rejected'),'quality render cancels');page.evaluate(A+'.awaitSettled()');c['afterCancel']=page.evaluate(Q+'.snapshot()')
  for case,key in [('kcc','unitDoor'),('warehouse','personnelDoor')]:
   print('CASE',case,flush=True)
   try:
    page.evaluate(A+'.setResolution(1,1)');page.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id+"-hosted")',case);page.evaluate('(key)=>window.__IMPLICIT_BUILDING__.selectHostedComponent(key)',key);page.evaluate(A+'.awaitSettled()');z=r['cases'][case]={'snapshot':page.evaluate(A+'.snapshot()')};z['frame']=render(480);capture(case+'-hosted-material-4spp');page.evaluate(A+'.setResolution(64,48)');z['parity']=page.evaluate(A+'.parity('+A+'.probePoints().slice(0,24))');check(z['parity']['passed'],case+' field parity')
   except Exception as e:r['failures'].append({'case':case,'error':str(e)});capture(case+'-failure')
  r['audit']=page.evaluate('window.__audit');check(r['audit']['buffers']==0 and r['audit']['indexed']==0 and r['audit']['counts']==[3],'no object vertex/index geometry');check(not r['errors'],'no uncaught page errors');check(not r['failures'],'all case QA');r['status']='passed_bounded_material_render_checks_not_visual_acceptance'
 except Exception as e:r['status']='failed';r['failure']=str(e);r['traceback']=traceback.format_exc();capture('material-quality-failure')
 finally:save();b.close()
print(json.dumps({'status':r['status'],'cases':list(r['cases']),'screenshots':r['screenshots']}));raise SystemExit(0 if r['status'].startswith('passed') else 1)
