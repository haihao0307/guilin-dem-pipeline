#!/usr/bin/env python3
"""Independent actual case-assembly GPU check; does not accept the separate rail kernel."""
import argparse,pathlib,json
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',required=True);a=p.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
r={'url':a.url,'scope':'source-bound authored interiors, not as-built reconstruction; independent from unaccepted rail kernel','cases':{},'errors':[]};api='window.__IMPLICIT_BUILDING__'
def save():(out/'case-preview.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 try:
  for case in ['lowrise','kcc','warehouse']:
   page=b.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:r['errors'].append(str(e)));c={'screenshots':[]};r['cases'][case]=c
   try:
    page.goto(a.url+'?qa-warmup=1',wait_until='networkidle',timeout=90000);page.wait_for_function(api);assert page.evaluate(api+'.ready')
    page.evaluate(api+'.setResolution(1,1)');page.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id+"-assembled")',case);page.evaluate(api+'.benchmark(1)');page.evaluate(api+'.setResolution(160,112)');c['warmTiming']=page.evaluate(api+'.benchmark(3)');assert c['warmTiming']['medianMs']<600,c['warmTiming']
    for view in ['whole','corner','door','stairs']:
     page.evaluate('(v)=>window.__IMPLICIT_BUILDING__.setView(v)',view);page.evaluate(api+'.resumeViewport()');name=f'r06-assembled-{case}-{view}-candidate.png';page.screenshot(path=str(out/name));c['screenshots'].append(name);save();print('CAPTURED '+name,flush=True)
    c['snapshot']=page.evaluate(api+'.snapshot()');c['diagnostics']=page.evaluate(api+'.diagnostics()');assert c['diagnostics']['unresolved']==0;assert c['snapshot']['sourceBinding']['originalMeasuredSourceUnchanged'];assert not c['snapshot']['actualInterior'];assert c['snapshot']['sourceDisplay']['capsGenerated'] is False
    c['parity']=page.evaluate(api+'.parity()');c['rayParity']=page.evaluate(api+'.rayParity()');assert c['parity']['passed'],c['parity'];assert c['rayParity']['passed'],c['rayParity'];c['status']='case_gpu_checks_passed_not_full_release'
   except Exception as e:c['status']='failed';c['error']=str(e);print('CASE FAILED '+case+' '+str(e),flush=True)
   finally:save();page.close()
  assert not r['errors'] and all(c['status']=='case_gpu_checks_passed_not_full_release' for c in r['cases'].values()),'One or more case GPU checks failed; retained screenshots are diagnostic only'
  r['status']='case_checks_complete_not_full_release'
 finally:save();b.close()
