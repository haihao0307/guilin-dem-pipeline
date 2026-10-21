#!/usr/bin/env python3
"""Actual candidate source-field screenshots only; NOT full release acceptance."""
import argparse,pathlib,json,hashlib,time
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',required=True);a=p.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
r={'url':a.url,'scope':'actual three source-field runtime captures; interior assembly and full GPU parity acceptance remain pending','screenshots':[],'cases':{},'errors':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:r['errors'].append(str(e)))
 try:
  page.goto(a.url+'?qa-warmup=1',wait_until='networkidle',timeout=90000);page.wait_for_function('window.__IMPLICIT_BUILDING__');assert page.evaluate('window.__IMPLICIT_BUILDING__.ready')
  for case in ['lowrise','kcc','warehouse']:
   page.evaluate('window.__IMPLICIT_BUILDING__.setResolution(1,1)');page.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id)',case);page.evaluate('window.__IMPLICIT_BUILDING__.resumeViewport()');page.evaluate('window.__IMPLICIT_BUILDING__.awaitSettled()');page.evaluate('window.__IMPLICIT_BUILDING__.benchmark(1)')
   name='r06-source-'+case+'-candidate.png';page.screenshot(path=str(out/name),full_page=False);r['screenshots'].append(name)
   r['cases'][case]={'snapshot':page.evaluate('window.__IMPLICIT_BUILDING__.snapshot()'),'diagnostics':page.evaluate('window.__IMPLICIT_BUILDING__.diagnostics()')};assert r['cases'][case]['snapshot']['reconstruction']['allSourcePatchesRetained'];assert r['cases'][case]['diagnostics']['unresolved']==0
   print('CAPTURED '+name,flush=True)
  assert not r['errors'];r['status']='captures_complete_not_release_acceptance'
 except Exception as e:r['status']='failed';r['error']=str(e);raise
 finally:(out/'source-preview.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));b.close()
