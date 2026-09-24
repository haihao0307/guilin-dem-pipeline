#!/usr/bin/env python3
from playwright.sync_api import sync_playwright
from pathlib import Path
import argparse,json,hashlib
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True);rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox'])
 for label,w,h in [('desktop',1440,1000),('mobile',390,844)]:
  c=b.new_context(viewport={'width':w,'height':h},has_touch=label=='mobile');page=c.new_page();errs=[];failed=[];page.on('pageerror',lambda e:errs.append(str(e)));page.on('console',lambda e:errs.append(e.text) if e.type=='error' else None);page.on('requestfailed',lambda r:failed.append(r.url));page.goto(a.url,wait_until='load',timeout=60000);page.wait_for_function("SMI_BOOT.state==='ready'||SMI_BOOT.state==='failed'",timeout=60000);s=page.evaluate('SMI_DIAGNOSTICS.snapshot()');assert s['boot']['state']=='ready' and s['boot']['loaded']==10 and s['boot']['firstFrame'];gpu=page.evaluate('SMI_DIAGNOSTICS.checkCoreGPU()');reef=page.evaluate('SMI_DIAGNOSTICS.checkReefTexture()');assert gpu['rawMismatch']==0 and gpu['maxCoordinateErrorM']<.001 and gpu['webglError']==0;assert all(x['rgbaMismatch']==0 for x in reef['layers']) and reef['webglError']==0;page.locator('#top').click();axes=page.evaluate("(()=>{let d=SMI_DIAGNOSTICS,q=d.snapshot().query;return {o:d.geoProject(q.E,q.N),e:d.geoProject(q.E+100,q.N),n:d.geoProject(q.E,q.N+100)}})()");assert axes['e'][0]>axes['o'][0] and axes['n'][1]<axes['o'][1];assert not errs and not failed, {'errors':errs,'failedRequests':failed,'viewport':label};(a.out/f'{label}.png').write_bytes(page.screenshot());rows.append({'viewport':label,'boot':s['boot'],'gpu':gpu,'reef':reef,'axes':axes,'errors':errs,'failedRequests':failed});c.close()
 b.close()
(a.out/'BROWSER_QA.json').write_text(json.dumps({'url':a.url,'passed':True,'sourceSHA256':'5d3167af1127a9a9f2eeaa47957158312060e0bff114020befec6703bc88001c','checks':rows,'realIPhoneTested':False},ensure_ascii=False,indent=2))
