#!/usr/bin/env python3
"""Real R06 Chromium WebGL2 field validation, not a screenshot mockup."""
import argparse, hashlib, json, pathlib, time, urllib.request
from playwright.sync_api import sync_playwright
P=pathlib.Path(__file__).resolve().parents[1]
FILES=['r06.html','r06/app.mjs','r06/renderer.mjs','r06/field.mjs','r06/host.mjs','r06/material.mjs','r06/style.css','r06/cases.mjs','r06/profiles.mjs','r06/evidence-ledger.json','r06/README.md']
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
  page.goto(a.url,wait_until='networkidle',timeout=90000);page.wait_for_function('window.__IMPLICIT_BUILDING__',timeout=90000);state=page.evaluate('window.__IMPLICIT_BUILDING__.snapshot?.() ?? window.__IMPLICIT_BUILDING__');assert state['ready'],state
  report['initial']=state;print('STAGE ready',flush=True)
  def shot(name):
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
   assert c['parity']['passed'],c['parity'];assert c['rayParity']['passed'],c['rayParity'];assert c['diagnostics']['unresolved']==0;assert c['snapshot']['reconstruction']['allSourcePatchesRetained'];assert c['snapshot']['counts']['patches']=={'lowrise':176,'kcc':21,'warehouse':28}[case_id]
   page.evaluate("window.__IMPLICIT_BUILDING__.setView('corner')");shot('r06-source-'+case_id+'-roof');page.evaluate('window.__IMPLICIT_BUILDING__.setResolution(600,420)');c['performance']=page.evaluate('window.__IMPLICIT_BUILDING__.benchmark(4)');report['cases'][case_id]=c
  page.evaluate("window.__IMPLICIT_BUILDING__.setCase('design')")
  page.set_viewport_size({'width':390,'height':844});page.evaluate("window.__IMPLICIT_BUILDING__.setView('stairs')");shot('r06-mobile');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  report['runtimeAudit']=page.evaluate('window.__GL_AUDIT__');assert report['runtimeAudit']['buffers']==0;assert report['runtimeAudit']['indexDraws']==0;assert set(report['runtimeAudit']['drawCounts'])=={3}
  report['final']=page.evaluate('window.__IMPLICIT_BUILDING__.snapshot()');report['errors']=errors;assert not errors and not report['final']['errors'];report['status']='passed'
 except Exception as e:
  report['status']='failed';report['error']=str(e);report['pageErrors']=errors;page.screenshot(path=str(out/'failure.png'),full_page=True);raise
 finally:
  (out/'results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));b.close()
print(json.dumps({'status':report['status'],'screenshots':len(report['screenshots']),'parity':report.get('parity'),'performance':report.get('performance')},ensure_ascii=False))
