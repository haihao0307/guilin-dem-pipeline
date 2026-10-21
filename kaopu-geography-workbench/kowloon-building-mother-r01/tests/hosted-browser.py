#!/usr/bin/env python3
"""R07 actual WebGL hosted-component QA; never relabel frozen R06 acceptance."""
import argparse,hashlib,json,pathlib,time,urllib.request
from playwright.sync_api import sync_playwright
P=pathlib.Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--url',required=True);a.add_argument('--output',required=True);a=a.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True);base=a.url.rsplit('/',1)[0]+'/'
r={'url':a.url,'status':'running','scope':'bounded hosted components, not whole buildings','hashes':{},'cases':{},'errors':[],'screenshots':[],'frozenR06FullAcceptance':'FAILED_KNOWN_ONE_UNRESOLVED_GRAZING_PIXEL'}
def save():(out/'results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
paths=[P/'r07.html']+sorted((P/'r07').rglob('*.mjs'))+[P/'r07/style.css']
for p in paths:
 rel=str(p.relative_to(P));b=urllib.request.urlopen(base+rel+'?r07qa='+str(time.time_ns()),timeout=60).read();got=hashlib.sha256(b).hexdigest();expected=hashlib.sha256(p.read_bytes()).hexdigest();assert got==expected,(rel,got,expected);r['hashes'][rel]=got
locked=json.loads((P/'r06/evidence/candidate13-browser-results.json').read_text());r['frozenR06Hashes']={}
for rel,expected in locked['hashes'].items():
 got=hashlib.sha256(urllib.request.urlopen(base+rel+'?r07-regression='+str(time.time_ns()),timeout=60).read()).hexdigest();assert got==expected,('R06 changed',rel);r['frozenR06Hashes'][rel]=got
save()
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page.on('pageerror',lambda e:r['errors'].append(str(e)))
 page.add_init_script("""window.__GL_AUDIT__={buffers:0,indexDraws:0,drawCounts:[]};for(const [name,kind] of [['createBuffer','buffers'],['drawElements','indexDraws']]){const f=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){window.__GL_AUDIT__[kind]++;return f.apply(this,args);};}const f=WebGL2RenderingContext.prototype.drawArrays;WebGL2RenderingContext.prototype.drawArrays=function(mode,first,count){window.__GL_AUDIT__.drawCounts.push(count);return f.call(this,mode,first,count);};""")
 A='window.__IMPLICIT_BUILDING__'
 def capture(name):
  page.evaluate(A+'.resumeViewport()');state=page.evaluate(A+'.awaitSettled()');page.screenshot(path=str(out/(name+'.png')));r['screenshots'].append(name+'.png');save();return state
 try:
  page.goto(a.url+'?qa-warmup=1',wait_until='networkidle',timeout=90000);page.wait_for_function(A,timeout=120000);assert page.evaluate(A+'.ready'),page.evaluate(A)
  assert page.evaluate(A+'.snapshot().fieldKind')=='hosted-context'
  for case,key in [('lowrise','residentialWindow'),('kcc','unitDoor'),('warehouse','personnelDoor')]:
   print('BEGIN',case,flush=True);page.evaluate(A+'.setResolution(1,1)');page.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id+"-hosted")',case);page.evaluate('(key)=>window.__IMPLICIT_BUILDING__.selectHostedComponent(key)',key)
   c={'snap':page.evaluate(A+'.snapshot()'),'stages':[],'poses':{}};r['cases'][case]=c
   for w,h in [(32,24),(160,127)]:
    page.evaluate('([w,h])=>window.__IMPLICIT_BUILDING__.setResolution(w,h)',[w,h]);bench=page.evaluate(A+'.benchmark(2)');c['stages'].append(bench);save();print('STAGE',case,w,json.dumps(bench),flush=True);assert bench['medianMs']<5000,'Small-frame safety budget exceeded; no HD dispatch'
   c['pointParity']=page.evaluate(A+'.parity()');c['rayParity']=page.evaluate(A+'.rayParity()');assert c['pointParity']['passed'],c['pointParity'];assert c['rayParity']['passed'],c['rayParity']
   # Focused actual field points near each primitive side, depth face and thin pane edge.
   c['componentParity']=page.evaluate("""()=>{const a=window.__IMPLICIT_BUILDING__,s=a.spec(),points=[];for(const c of s.apertures)for(const p of c.primitives){const to=q=>p.origin.map((x,i)=>x+p.u[i]*q[0]+p.v[i]*q[1]+p.w[i]*q[2]);for(const sign of [-1,1])for(const q of [[p.outer.center[0]+sign*(p.outer.half[0]+.0003),p.outer.center[1]+.017,0],[p.outer.center[0]+.013,p.outer.center[1]+sign*(p.outer.half[1]+.0003),0],[p.outer.center[0]+.019,p.outer.center[1]+.023,sign*(p.halfDepth+.0003)]])points.push(to(q).map(Math.fround));}return a.parity(points.slice(0,128));}""");assert c['componentParity']['passed'],c['componentParity']
   for t in [0,.5,1]:
    page.evaluate('([key,t])=>window.__IMPLICIT_BUILDING__.applyHosted(key,{openT:t})',[key,t]);c['poses'][str(t)]={'diagnostics':page.evaluate(A+'.diagnostics()'),'rayParity':page.evaluate(A+'.rayParity()')};assert c['poses'][str(t)]['diagnostics']['unresolved']==0;assert c['poses'][str(t)]['rayParity']['passed'];save()
    if t in [0,1]:c['poses'][str(t)]['frame']=capture('r07-'+case+('-closed' if t==0 else '-open'));page.evaluate(A+'.setResolution(160,127)')
   before=page.evaluate(A+'.snapshot().hosted.edits');rejected=page.evaluate("""key=>{try{window.__IMPLICIT_BUILDING__.applyHosted(key,{width:999});return false;}catch(e){return true;}}""",key);assert rejected;assert page.evaluate(A+'.snapshot().hosted.edits')==before
   page.evaluate(A+'.setHostedEnabled(false)');c['disabled']=page.evaluate(A+'.snapshot()');assert c['disabled']['hosted']['mode']=='baseline';assert c['disabled']['counts']['apertures']==0
   page.evaluate(A+'.resetHosted()');c['reset']=page.evaluate(A+'.snapshot()');assert c['reset']['hosted']['mode']=='design';assert all(x['config']['openT']==0 for x in c['reset']['hosted']['components']);save()
   if case=='lowrise':
    page.evaluate(A+'.applyHosted("residentialWindow",{roundRadius:0})');c['straightFrame']=page.evaluate(A+'.parity()');assert c['straightFrame']['passed'];capture('r07-lowrise-straight-frame');page.evaluate(A+'.setResolution(160,127)');page.evaluate(A+'.resetHosted()')
   if case=='warehouse':page.evaluate(A+".setView('door')");capture('r07-warehouse-separated-entries');page.evaluate(A+'.setResolution(160,127)')
   page.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id)',case);c['originalSource']=page.evaluate(A+'.snapshot()');assert c['originalSource']['reconstruction']['allSourcePatchesRetained'];save()
  page.evaluate(A+'.setResolution(160,127)');page.evaluate(A+".setCase('lowrise-hosted')");page.set_viewport_size({'width':390,'height':844});capture('r07-mobile-layout');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');r['mobile']='desktop CSS viewport; not an iOS device test'
  audit=page.evaluate('window.__GL_AUDIT__');r['runtimeAudit']={'buffers':audit['buffers'],'indexDraws':audit['indexDraws'],'drawCalls':len(audit['drawCounts']),'drawCounts':sorted(set(audit['drawCounts']))};assert audit['buffers']==0 and audit['indexDraws']==0 and set(audit['drawCounts'])=={3};assert not r['errors'];r['status']='passed_bounded_hosted_component_checks_not_whole_building_acceptance'
 except Exception as e:r['status']='failed';r['failure']=str(e);page.screenshot(path=str(out/'failure.png'));raise
 finally:save();b.close()
print(json.dumps({'status':r['status'],'cases':len(r['cases']),'screenshots':len(r['screenshots'])}))
