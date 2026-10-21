#!/usr/bin/env python3
"""Real R06 Chromium WebGL2 field validation, not a screenshot mockup."""
import argparse, hashlib, json, pathlib, time, urllib.request
from playwright.sync_api import sync_playwright
P=pathlib.Path(__file__).resolve().parents[1]
FILES=['r06.html','r06/app.mjs','r06/renderer.mjs','r06/field.mjs','r06/host.mjs','r06/material.mjs','r06/style.css','r06/cases.mjs','r06/profiles.mjs','r06/assemblies.mjs','r06/evidence-ledger.json','r06/README.md','r06/context.mjs','r06/sources/official-footprints.json','r06/frame-scheduler.mjs']
a=argparse.ArgumentParser();a.add_argument('--url',required=True);a.add_argument('--output',required=True);a=a.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True);report={'url':a.url,'hashes':{},'screenshots':[]}
base=a.url.rsplit('/',1)[0]+'/'
for f in FILES:
 data=urllib.request.urlopen(base+f+'?r06-qa='+str(time.time_ns()),timeout=60).read();expected=(P/f).read_bytes();assert data==expected,'Served file differs: '+f;report['hashes'][f]=hashlib.sha256(data).hexdigest()
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page.add_init_script("""window.__GL_AUDIT__={buffers:0,indexDraws:0,drawCounts:[]};for(const [name,kind] of [['createBuffer','buffers'],['drawElements','indexDraws']]){const f=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){window.__GL_AUDIT__[kind]++;return f.apply(this,args);};}const draw=WebGL2RenderingContext.prototype.drawArrays;WebGL2RenderingContext.prototype.drawArrays=function(mode,first,count){window.__GL_AUDIT__.drawCounts.push(count);return draw.call(this,mode,first,count);};""")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  page.goto(a.url+('&' if '?' in a.url else '?')+'qa-warmup=1',wait_until='networkidle',timeout=90000);page.wait_for_function('window.__IMPLICIT_BUILDING__',timeout=90000);state=page.evaluate('window.__IMPLICIT_BUILDING__.snapshot?.() ?? window.__IMPLICIT_BUILDING__');assert state['ready'],state
  report['initial']=state;print('STAGE ready',flush=True)
  report['startupScaleTimings']=[]
  for w,h in [(1,1),(32,32),(160,112)]:
   print('STAGE startup '+str(w)+'x'+str(h),flush=True);page.evaluate('(s)=>window.__IMPLICIT_BUILDING__.setResolution(...s)',[w,h]);report['startupScaleTimings'].append(page.evaluate('window.__IMPLICIT_BUILDING__.benchmark(1)'))
  report['geometryOnlyTiming']=page.evaluate('window.__IMPLICIT_BUILDING__.setRenderOptions({renderMode:1});window.__IMPLICIT_BUILDING__.benchmark(3)');page.evaluate('window.__IMPLICIT_BUILDING__.setRenderOptions({renderMode:0})')
  assert report['startupScaleTimings'][-1]['medianMs']<600,'160x112 exceeds600ms warmed frame budget; high-resolution run withheld rather than queued blindly'
  page.evaluate('window.__IMPLICIT_BUILDING__.resumeViewport()')
  def shot(name):
   page.evaluate('window.__IMPLICIT_BUILDING__.resumeViewport()');page.evaluate('window.__IMPLICIT_BUILDING__.awaitSettled()')
   page.screenshot(path=str(out/(name+'.png')),full_page=False);report['screenshots'].append(name+'.png');print('STAGE screenshot '+name,flush=True)
  shot('r06-field-stairs')
  print('STAGE parity',flush=True);report['parity']=page.evaluate('window.__IMPLICIT_BUILDING__.parity()');assert report['parity']['passed'],report['parity'];report['rayParity']=page.evaluate('window.__IMPLICIT_BUILDING__.rayParity()');assert report['rayParity']['passed'],report['rayParity']
  report['diagnostics']=page.evaluate('window.__IMPLICIT_BUILDING__.diagnostics()');assert report['diagnostics']['hits']>1000;assert report['diagnostics']['unresolved']/report['diagnostics']['pixels']<.02,report['diagnostics']
  for view,name in [('corner','r06-continuous-rail'),('door','r06-through-opening'),('whole','r06-measured-footprint'),('underside','r06-stair-underside')]:
   page.evaluate('(v)=>window.__IMPLICIT_BUILDING__.setView(v)',view);shot(name)
   if view=='underside':
    report['undersideDiagnostics']=page.evaluate('window.__IMPLICIT_BUILDING__.diagnostics()');assert report['undersideDiagnostics']['unresolved']==0,report['undersideDiagnostics']
  page.evaluate("window.__IMPLICIT_BUILDING__.setView('corner');window.__IMPLICIT_BUILDING__.apply({railCornerMode:'angular'})");shot('r06-angular-rule');assert page.evaluate('window.__IMPLICIT_BUILDING__.snapshot().rail.tangentContinuous') is False
  page.evaluate("window.__IMPLICIT_BUILDING__.apply({railCornerMode:'rounded',floorHeight:3.4,slabThickness:.24,doorWidth:1.0,railBendRadius:.28})");report['editedParity']=page.evaluate('window.__IMPLICIT_BUILDING__.parity()');assert report['editedParity']['passed'],report['editedParity'];page.evaluate("window.__IMPLICIT_BUILDING__.setView('stairs')");shot('r06-parameter-propagation')
  report['invalid']=page.evaluate("""()=>{const a=window.__IMPLICIT_BUILDING__,before=JSON.stringify(a.snapshot().config);let rejected=false;try{a.apply({doorWidth:3})}catch(e){rejected=true;}return {rejected,unchanged:before===JSON.stringify(a.snapshot().config)}}""");assert all(report['invalid'].values())
  # World placement must not rescale the material coordinate query.
  report['rigidMaterial']=page.evaluate("""()=>{const a=window.__IMPLICIT_BUILDING__,p=[[-.7,.31,2.14],[.83,3.4,.6]],world=a.localToWorld(p),local=a.probe(p,2),placed=a.worldProbe(world,undefined,2);return {maxError:Math.max(...local.flatMap((v,i)=>v.map((x,j)=>Math.abs(x-placed[i][j]))))};}""");assert report['rigidMaterial']['maxError']<1e-5
  page.evaluate("window.__IMPLICIT_BUILDING__.setRenderOptions({cutaway:1});window.__IMPLICIT_BUILDING__.setView('stairs')");shot('r06-explicit-display-cutaway');page.evaluate('window.__IMPLICIT_BUILDING__.setRenderOptions({cutaway:0})')
  page.evaluate("window.__IMPLICIT_BUILDING__.setView('inside')");report['insideDiagnostics']=page.evaluate('window.__IMPLICIT_BUILDING__.diagnostics()');assert report['insideDiagnostics']['hits']>0
  page.click('#reset');page.evaluate('window.__IMPLICIT_BUILDING__.setResolution(600,420)');print('STAGE benchmark',flush=True);report['performance']=page.evaluate('window.__IMPLICIT_BUILDING__.benchmark(8)');report['performanceDiagnostics']=page.evaluate('window.__IMPLICIT_BUILDING__.diagnostics()')
  report['cases']={}
  for case_id in ['lowrise','kcc','warehouse']:
   print('STAGE measured case '+case_id,flush=True);page.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id)',case_id);page.evaluate('window.__IMPLICIT_BUILDING__.setResolution(900,720)');shot('r06-source-'+case_id)
   c={'snapshot':page.evaluate('window.__IMPLICIT_BUILDING__.snapshot()'),'parity':page.evaluate('window.__IMPLICIT_BUILDING__.parity()'),'rayParity':page.evaluate('window.__IMPLICIT_BUILDING__.rayParity()'),'diagnostics':page.evaluate('window.__IMPLICIT_BUILDING__.diagnostics()')}
   c['boundaryRayStress']=page.evaluate((P/'tests/implicit-source-ray-stress.js').read_text());assert c['boundaryRayStress']['passed'],c['boundaryRayStress'];assert c['parity']['passed'],c['parity'];assert c['rayParity']['passed'],c['rayParity'];assert c['diagnostics']['unresolved']==0;assert c['snapshot']['reconstruction']['allSourcePatchesRetained'];assert c['snapshot']['counts']['patches']=={'lowrise':176,'kcc':21,'warehouse':28}[case_id]
   page.evaluate("window.__IMPLICIT_BUILDING__.setView('corner')");shot('r06-source-'+case_id+'-roof');page.evaluate('window.__IMPLICIT_BUILDING__.setResolution(600,420)');c['performance']=page.evaluate('window.__IMPLICIT_BUILDING__.benchmark(4)');report['cases'][case_id]=c
  report['assemblies']={}
  for case_id in ['lowrise','kcc','warehouse']:
   print('STAGE relation assembly '+case_id,flush=True);page.evaluate('window.__IMPLICIT_BUILDING__.setResolution(160,112)');page.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id+"-assembly")',case_id)
   c={'warmTiming':page.evaluate('window.__IMPLICIT_BUILDING__.benchmark(2)'),'parity':page.evaluate('window.__IMPLICIT_BUILDING__.parity()'),'rayParity':page.evaluate('window.__IMPLICIT_BUILDING__.rayParity()')};assert c['warmTiming']['medianMs']<600,c['warmTiming'];assert c['parity']['passed'],c['parity'];assert c['rayParity']['passed'],c['rayParity']
   page.evaluate('window.__IMPLICIT_BUILDING__.setResolution(900,720)');shot('r06-relations-'+case_id);page.evaluate("window.__IMPLICIT_BUILDING__.setView('corner')");shot('r06-relations-'+case_id+'-plan');page.evaluate("window.__IMPLICIT_BUILDING__.setView('door')");shot('r06-relations-'+case_id+'-entry')
   c['diagnostics']=page.evaluate('window.__IMPLICIT_BUILDING__.diagnostics()');assert c['diagnostics']['unresolved']==0;c['snapshot']=page.evaluate('window.__IMPLICIT_BUILDING__.snapshot()');assert c['snapshot']['registrationStatus']=='unverified_editable_design';assert not c['snapshot']['actualInterior']
   c['edit']=page.evaluate('''()=>{const a=window.__IMPLICIT_BUILDING__;a.applyAssembly({doorWidth:1.1,alignmentTransform:{translation:[2,.5,-1],yawRadians:.7}});const p=[[.3,1,-5],[2.4,.05,3]],q=a.assemblyToSource(p),x=a.probe(p,2),y=a.assemblySourceProbe(q,2),before=JSON.stringify(a.snapshot().config);let rejected=false;try{a.applyAssembly({doorWidth:5})}catch(e){rejected=true;}return {materialMaxError:Math.max(...x.flatMap((v,i)=>v.map((n,j)=>Math.abs(n-y[i][j])))),invalidRejected:rejected,unchanged:before===JSON.stringify(a.snapshot().config)};}''');assert c['edit']['invalidRejected'] and c['edit']['unchanged'];assert c['edit']['materialMaxError']<1e-5
   page.evaluate('window.__IMPLICIT_BUILDING__.setResolution(600,420)');c['performance']=page.evaluate('window.__IMPLICIT_BUILDING__.benchmark(4)');report['assemblies'][case_id]=c
  report['sourceBoundContexts']={}
  for case_id in ['lowrise','kcc','warehouse']:
   print('STAGE source-bound context '+case_id,flush=True);page.evaluate('window.__IMPLICIT_BUILDING__.setResolution(160,112)');page.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id+"-assembled")',case_id)
   c={'warmTiming':page.evaluate('window.__IMPLICIT_BUILDING__.benchmark(3)'),'parity':page.evaluate('window.__IMPLICIT_BUILDING__.parity()'),'rayParity':page.evaluate('window.__IMPLICIT_BUILDING__.rayParity()')};assert c['warmTiming']['medianMs']<600,c['warmTiming'];assert c['parity']['passed'],c['parity'];assert c['rayParity']['passed'],c['rayParity']
   c['snapshot']=page.evaluate('window.__IMPLICIT_BUILDING__.snapshot()');assert c['snapshot']['fitReport']['status']=='source_bound_design_checks_passed';assert c['snapshot']['sourceBinding']['originalMeasuredSourceUnchanged'];assert not c['snapshot']['actualInterior'];assert c['snapshot']['sourceDisplay']['capsGenerated'] is False
   page.evaluate('window.__IMPLICIT_BUILDING__.setResolution(900,720)');shot('r06-assembled-'+case_id)
   for view,suffix in [('corner','plan'),('door','entry'),('stairs','circulation')]:
    page.evaluate('(v)=>window.__IMPLICIT_BUILDING__.setView(v)',view);shot('r06-assembled-'+case_id+'-'+suffix)
   c['diagnostics']=page.evaluate('window.__IMPLICIT_BUILDING__.diagnostics()');assert c['diagnostics']['unresolved']==0
   c['invalid']=page.evaluate("""()=>{const a=window.__IMPLICIT_BUILDING__,before=JSON.stringify(a.snapshot().config);let rejected=false;try{a.applyAssembly({interiorTranslationXZ:[95,95]})}catch(e){rejected=true;}return {rejected,unchanged:before===JSON.stringify(a.snapshot().config)}}""");assert all(c['invalid'].values())
   page.evaluate('window.__IMPLICIT_BUILDING__.setResolution(600,420)');c['performance']=page.evaluate('window.__IMPLICIT_BUILDING__.benchmark(4)');report['sourceBoundContexts'][case_id]=c
   page.click('#open-source');page.wait_for_function('(id)=>window.__IMPLICIT_BUILDING__.snapshot().caseId===id',arg=case_id);assert page.evaluate('window.__IMPLICIT_BUILDING__.snapshot().reconstruction.allSourcePatchesRetained')
  # Real Chromium interaction, not a claim about iOS GPU or 60fps.
  page.evaluate("window.__IMPLICIT_BUILDING__.setCase('kcc-assembled')");page.evaluate('window.__IMPLICIT_BUILDING__.resumeViewport()');page.evaluate('window.__IMPLICIT_BUILDING__.awaitSettled()')
  box=page.locator('#view').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.5;page.mouse.move(x,y);page.mouse.down();start=time.monotonic();page.mouse.move(x+36,y+18,steps=12)
  page.wait_for_function("()=>{const s=window.__IMPLICIT_BUILDING__.scheduling();return s.interacting&&s.lastDispatch?.quality==='interaction'&&s.lastDispatch.revision===s.revision}",timeout=120000)
  page.screenshot(path=str(out/'r06-interaction-moving.png'));moving_seconds=time.monotonic()-start;moving=page.evaluate('window.__IMPLICIT_BUILDING__.scheduling()');assert moving['currentResolution']['width']<=160;assert moving['maxPendingCallbacks']<=2;assert moving['geometryLod'] is False
  start=time.monotonic();page.mouse.up();settled=page.evaluate('window.__IMPLICIT_BUILDING__.awaitSettled()');page.screenshot(path=str(out/'r06-interaction-settled.png'));settled_seconds=time.monotonic()-start;assert settled['caseId']=='kcc-assembled';assert settled['scheduling']['pendingCallbacks']==0;assert settled['scheduling']['currentResolution']==settled['scheduling']['settledViewportResolution']
  report['interaction']={'moving':moving,'settled':settled,'inputToMovingScreenshotWallSeconds':moving_seconds,'pointerUpToSettledScreenshotWallSeconds':settled_seconds,'measurement':'Playwright input, readiness wait and completed screenshot wall time; includes tool/capture overhead, not isolated GPU/presentation latency; desktop software Chromium, not iOS device','sameFieldAtBothResolutions':True};report['screenshots']+=['r06-interaction-moving.png','r06-interaction-settled.png']
  page.evaluate('window.__IMPLICIT_BUILDING__.resumeViewport();window.__IMPLICIT_BUILDING__.setResolution(64,64)');page.wait_for_timeout(350);pinned=page.evaluate('window.__IMPLICIT_BUILDING__.scheduling()');assert pinned['resolutionMode']=='explicit-pinned' and pinned['currentResolution']=={'width':64,'height':64} and pinned['pendingCallbacks']==0;report['interaction']['explicitPinCancelledAutomaticWork']=True
  page.evaluate("window.__IMPLICIT_BUILDING__.setCase('design')")
  page.set_viewport_size({'width':390,'height':844});page.evaluate("window.__IMPLICIT_BUILDING__.setView('stairs')");shot('r06-mobile');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  report['runtimeAudit']=page.evaluate('window.__GL_AUDIT__');assert report['runtimeAudit']['buffers']==0;assert report['runtimeAudit']['indexDraws']==0;assert set(report['runtimeAudit']['drawCounts'])=={3}
  report['final']=page.evaluate('window.__IMPLICIT_BUILDING__.snapshot()');report['errors']=errors;assert not errors and not report['final']['errors'];report['status']='passed'
 except Exception as e:
  report['status']='failed';report['error']=str(e);report['pageErrors']=errors;page.screenshot(path=str(out/'failure.png'),full_page=True);raise
 finally:
  (out/'results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));b.close()
print(json.dumps({'status':report['status'],'screenshots':len(report['screenshots']),'parity':report.get('parity'),'performance':report.get('performance')},ensure_ascii=False))
