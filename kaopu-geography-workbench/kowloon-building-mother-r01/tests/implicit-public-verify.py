#!/usr/bin/env python3
"""Verify delivery of the frozen limited preview, NOT full geometric acceptance.
The original candidate13 comprehensive acceptance stays FAILED for one rail ray.
"""
import argparse,hashlib,json,pathlib,time,urllib.request
from playwright.sync_api import sync_playwright
P=pathlib.Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--url',required=True);a.add_argument('--output',required=True);a=a.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
assert a.url=='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/kowloon-building-mother-r01/r06.html','Only the approved preview URL is allowed'
locked=json.loads((P/'r06/evidence/candidate13-browser-results.json').read_text());base=a.url.rsplit('/',1)[0]+'/'
r={'scope':'post-deployment delivery identity and normal-case runtime checks; not repeated full acceptance','url':a.url,'testedCandidate':'2b6213d9ef34a6f55f5ac6e67fc75f7885d7e650','overallGeometricAcceptance':'FAILED','preservedCandidateFailures':locked['validationFailures'],'publicHashes':{},'sourceCases':{},'assembledCases':{},'screenshots':[]}
def save():(out/'public-results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
for name,expected in locked['hashes'].items():
 body=urllib.request.urlopen(base+name+'?r06-public='+str(time.time_ns()),timeout=90).read();got=hashlib.sha256(body).hexdigest();assert got==expected,(name,got,expected);r['publicHashes'][name]=got
save()
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("""window.__GL_AUDIT__={buffers:0,indexDraws:0,drawCounts:[]};for(const [name,kind] of [['createBuffer','buffers'],['drawElements','indexDraws']]){const f=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){window.__GL_AUDIT__[kind]++;return f.apply(this,args);};}const f=WebGL2RenderingContext.prototype.drawArrays;WebGL2RenderingContext.prototype.drawArrays=function(mode,first,count){window.__GL_AUDIT__.drawCounts.push(count);return f.call(this,mode,first,count);};""")
 api='window.__IMPLICIT_BUILDING__'
 def capture(name):
  page.evaluate(api+'.resumeViewport()');ready=page.evaluate(api+'.awaitSettled()');page.screenshot(path=str(out/(name+'.png')));r['screenshots'].append(name+'.png');save();return ready
 try:
  page.goto(a.url+'?qa-warmup=1',wait_until='networkidle',timeout=90000);page.wait_for_function(api,timeout=90000);assert page.evaluate(api+'.ready');assert '未全过' in page.locator('.badge').inner_text()
  r['knownIssueVisible']=page.locator('#known-render-limit').inner_text();assert '1个未决像素' in r['knownIssueVisible']
  # This reproduces, rather than waives, the failed comprehensive criterion.
  page.evaluate(api+'.setResolution(840,667)');page.evaluate(api+".setView('underside')");page.screenshot(path=str(out/'r06-public-known-underside.png'));r['screenshots'].append('r06-public-known-underside.png')
  r['knownUnderside']=page.evaluate(api+'.diagnostics()');assert r['knownUnderside']['unresolved']==1,r['knownUnderside'];assert [(x['x'],x['y']) for x in r['knownUnderside']['unresolvedPixelSamples']]==[(161,525)]
  for case in ['lowrise','kcc','warehouse']:
   page.evaluate(api+'.setResolution(160,112)');page.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id)',case)
   c={'pointParity':page.evaluate(api+'.parity()'),'rayParity':page.evaluate(api+'.rayParity()')};r['sourceCases'][case]=c;assert c['pointParity']['passed'] and c['rayParity']['passed'];c['frame']=capture('r06-public-source-'+case);c['diagnostics']=page.evaluate(api+'.diagnostics()');assert c['diagnostics']['unresolved']==0;c['snapshot']=page.evaluate(api+'.snapshot()');assert c['snapshot']['reconstruction']['allSourcePatchesRetained'];save()
  for case,view in [('lowrise','stairs'),('kcc','corner'),('warehouse','door')]:
   page.evaluate(api+'.setResolution(160,112)');page.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id+"-assembled")',case);page.evaluate('(v)=>window.__IMPLICIT_BUILDING__.setView(v)',view)
   c={'pointParity':page.evaluate(api+'.parity()'),'rayParity':page.evaluate(api+'.rayParity()')};r['assembledCases'][case]=c;assert c['pointParity']['passed'] and c['rayParity']['passed'];c['frame']=capture('r06-public-assembled-'+case);c['diagnostics']=page.evaluate(api+'.diagnostics()');assert c['diagnostics']['unresolved']==0;c['snapshot']=page.evaluate(api+'.snapshot()');assert c['snapshot']['sourceBinding']['originalMeasuredSourceUnchanged'] and not c['snapshot']['actualInterior'];save()
  page.set_viewport_size({'width':390,'height':844});capture('r06-public-narrow-viewport');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');r['narrowViewport']='desktop Chromium CSS viewport only; not iOS device performance'
  audit=page.evaluate('window.__GL_AUDIT__');r['runtimeAudit']={'buffers':audit['buffers'],'indexDraws':audit['indexDraws'],'drawCalls':len(audit['drawCounts']),'drawCounts':sorted(set(audit['drawCounts']))};assert audit['buffers']==0 and audit['indexDraws']==0 and set(audit['drawCounts'])=={3};assert not errors;r['errors']=errors;r['deliveryVerification']='PASSED_EXACT_FROZEN_CANDIDATE_WITH_PRESERVED_KNOWN_FAILURE';r['fullAcceptancePassed']=False
 except Exception as e:r['deliveryVerification']='FAILED';r['error']=str(e);r['errors']=errors;page.screenshot(path=str(out/'public-failure.png'));raise
 finally:save();b.close()
print(json.dumps({'deliveryVerification':r['deliveryVerification'],'overallGeometricAcceptance':r['overallGeometricAcceptance'],'hashes':len(r['publicHashes']),'caseCounts':[len(r['sourceCases']),len(r['assembledCases'])]},ensure_ascii=False))
