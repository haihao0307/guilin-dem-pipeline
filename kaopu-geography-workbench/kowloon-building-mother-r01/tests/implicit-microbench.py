#!/usr/bin/env python3
"""Bounded real-GPU path isolation. Failures stay failures; other cases still get measured."""
import argparse,json,pathlib
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',required=True);a=p.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
report={'url':a.url,'paths':{},'cases':{},'errors':[],'interpretation':'Diagnostic modes isolate work and are not alternate production geometry. Each case uses a fresh page so context loss does not hide other results.'}
def save(): (out/'microbench.json').write_text(json.dumps(report,indent=2))
api='window.__IMPLICIT_BUILDING__'
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 def boot():
  page=browser.new_page(viewport={'width':1200,'height':900});page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(a.url+('&' if '?' in a.url else '?')+'qa-warmup=1',wait_until='networkidle',timeout=90000);page.wait_for_function(api,timeout=90000)
  state=page.evaluate(f'{api}.snapshot?.() ?? {api}');assert state['ready'],state
  return page,state
 def measure(page):
  r={'compile':page.evaluate(f'{api}.snapshot().renderer.compileProfile'),'1x1':page.evaluate(f'{api}.benchmark(1)')}
  page.evaluate(f'{api}.setResolution(32,32)');r['32x32']=page.evaluate(f'{api}.benchmark(3)')
  if r['32x32']['medianMs']<75:
   page.evaluate(f'{api}.setResolution(160,112)');r['160x112']=page.evaluate(f'{api}.benchmark(3)')
  return r
 try:
  page,state=boot();report['initial']=state
  for mode,name in [(4,'empty'),(1,'structure'),(2,'rail'),(3,'conservative-march'),(0,'combined')]:
   print('MICRO '+name,flush=True)
   try:
    page.evaluate(f'{api}.setResolution(1,1);{api}.setTraceVariant({mode});{api}.setRenderOptions({{renderMode:1,traceMode:0}})');r=measure(page)
    if name=='combined':r['diagnostics']=page.evaluate(f'{api}.diagnostics()')
   except Exception as e:
    r={'error':str(e)};page.close();page,_=boot()
   report['paths'][name]=r;save();print(json.dumps({'path':name,'timings':{k:round(v['medianMs'],2) for k,v in r.items() if isinstance(v,dict) and 'medianMs' in v},'error':r.get('error')}),flush=True)
  page.close()
  for case in ['kcc','lowrise','warehouse','lowrise-assembly','kcc-assembly','warehouse-assembly','lowrise-assembled','kcc-assembled','warehouse-assembled']:
   print('MICRO case '+case,flush=True);page=None
   try:
    page,_=boot();page.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id)',case);page.evaluate(f'{api}.setRenderOptions({{renderMode:1,traceMode:0}})');r=measure(page)
   except Exception as e:r={'error':str(e)}
   finally:
    if page:page.close()
   report['cases'][case]=r;save();print(json.dumps({'case':case,'timings':{k:round(v['medianMs'],2) for k,v in r.items() if isinstance(v,dict) and 'medianMs' in v},'error':r.get('error')}),flush=True)
  if report['paths']['combined'].get('160x112',{}).get('medianMs',1e20)<600:
   page,_=boot();page.evaluate(f"{api}.setView('stairs');{api}.setRenderOptions({{renderMode:0,traceMode:0}});{api}.setResolution(600,420)");page.screenshot(path=str(out/'kernel-after-isolation.png'));report['kernelScreenshot']='kernel-after-isolation.png';page.close()
  report['status']='measured';assert not report['errors'],report['errors'];assert report['paths']['combined'].get('160x112',{}).get('medianMs',1e20)<600,'Combined path exceeds staged160 budget; full QA withheld'
  assert all(r.get('160x112',{}).get('medianMs',1e20)<600 for r in report['cases'].values()),'At least one case failed or exceeded staged160 budget; full QA withheld'
 except Exception as e:report['status']='failed';report['error']=str(e);raise
 finally:save();browser.close()
