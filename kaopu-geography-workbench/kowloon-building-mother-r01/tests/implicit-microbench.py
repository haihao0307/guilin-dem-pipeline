#!/usr/bin/env python3
"""Bounded real-GPU path isolation. Does not accept high resolution by timeout."""
import argparse,json,pathlib,time
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',required=True);a=p.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True);report={'url':a.url,'paths':{},'errors':[],'interpretation':'Diagnostic modes isolate work and are not alternate production geometry.'}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1200,'height':900});page.on('pageerror',lambda e:report['errors'].append(str(e)))
 try:
  page.goto(a.url+'?qa-warmup=1',wait_until='networkidle',timeout=90000);page.wait_for_function('window.__IMPLICIT_BUILDING__?.ready',timeout=90000)
  report['initial']=page.evaluate('window.__IMPLICIT_BUILDING__.snapshot().renderer');api='window.__IMPLICIT_BUILDING__'
  for mode,name in [(4,'empty'),(1,'structure'),(2,'rail'),(3,'conservative-march'),(0,'combined')]:
   print('MICRO '+name,flush=True);page.evaluate(f'{api}.setResolution(1,1);{api}.setTraceVariant({mode});{api}.setRenderOptions({{renderMode:1,traceMode:0}})')
   r={'compile':page.evaluate(f'{api}.snapshot().renderer.compileProfile'),'1x1':page.evaluate(f'{api}.benchmark(1)')};page.evaluate(f'{api}.setResolution(32,32)');r['32x32']=page.evaluate(f'{api}.benchmark(3)')
   if r['32x32']['medianMs']<25:
    page.evaluate(f'{api}.setResolution(160,112)');r['160x112']=page.evaluate(f'{api}.benchmark(3)')
   report['paths'][name]=r;(out/'microbench.json').write_text(json.dumps(report,indent=2));print(json.dumps({'path':name,'timings':{k:round(v['medianMs'],2) for k,v in r.items() if 'medianMs' in v}}),flush=True)
  report['cases']={}
  for case in ['kcc','lowrise','warehouse']:
   print('MICRO source '+case,flush=True);page.evaluate(f'{api}.setResolution(1,1)');page.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id)',case);page.evaluate(f'{api}.setRenderOptions({{renderMode:1,traceMode:0}})')
   r={'compile':page.evaluate(f'{api}.snapshot().renderer.compileProfile'),'1x1':page.evaluate(f'{api}.benchmark(1)')};page.evaluate(f'{api}.setResolution(32,32)');r['32x32']=page.evaluate(f'{api}.benchmark(3)')
   if r['32x32']['medianMs']<25:
    page.evaluate(f'{api}.setResolution(160,112)');r['160x112']=page.evaluate(f'{api}.benchmark(3)')
   report['cases'][case]=r;(out/'microbench.json').write_text(json.dumps(report,indent=2));print(json.dumps({'case':case,'timings':{k:round(v['medianMs'],2) for k,v in r.items() if 'medianMs' in v}}),flush=True)
  report['status']='measured';assert not report['errors'],report['errors'];assert report['paths']['combined'].get('160x112',{}).get('medianMs',1e20)<600,'Combined path exceeds staged160 budget; full QA withheld'
 except Exception as e:
  report['status']='failed';report['error']=str(e);raise
 finally:
  (out/'microbench.json').write_text(json.dumps(report,indent=2));browser.close()
