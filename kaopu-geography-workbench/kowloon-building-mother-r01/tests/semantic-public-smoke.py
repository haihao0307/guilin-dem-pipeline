#!/usr/bin/env python3
"""Bounded actual public R03 dependency closure and three-case browser smoke."""
import argparse, hashlib, json, time, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
cfg=json.loads((root/'semantic-public-smoke-config.json').read_text())
pa=argparse.ArgumentParser();pa.add_argument('--output',default='public-inspection-evidence');args,_=pa.parse_known_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True);url=cfg['targetUrl'].rstrip('/')+'/'
r={'passed':False,'publicDeploymentTest':True,'candidateRouting':False,'url':url,'expectedProductionCommit':cfg['productionCommit'],'scope':'Exact public file closure and browser interaction, not architectural validation or physical-device performance','startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'files':{},'checks':[],'screenshots':[],'pageErrors':[],'failedRequests':[]}
def save():(out/'public-smoke-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def wait(case,view,n=-1):page.wait_for_function("a=>{const s=window.semanticInspection;if(s?.errors?.length)throw Error(String(s.errors));return s?.ready&&s.caseId===a.case&&s.view===a.view&&!s.renderer.busy&&s.frames.length>a.n}",arg={'case':case,'view':view,'n':n},timeout=240000)
def frames():return page.evaluate('window.semanticInspection.frames.length')
def shot(name):page.screenshot(path=str(out/(name+'.png')),full_page=True);r['screenshots'].append(name+'.png');save()
def sample():return page.evaluate("""()=>{const s=window.semanticInspection,g=s.renderer,f=s.lastStats,counts={},ids={},picks={};let bad=0;for(let y=8;y<f.height-8;y+=Math.max(1,Math.floor(f.height/40)))for(let x=8;x<f.width-8;x+=Math.max(1,Math.floor(f.width/40))){const h=g.readHit(x,y);if(h.status>2.5)bad++;if(h.status>.5&&h.status<1.5){const q=s.registry.find(q=>q.objectId===h.objectId),k=q?.classKey??'MISSING';counts[k]=(counts[k]??0)+1;ids[h.objectId]=(ids[h.objectId]??0)+1;picks[k]??={x,y,id:h.objectId};}}return {caseId:s.caseId,view:s.view,width:f.width,height:f.height,counts,ids,picks,bad,selectedId:g.options.selectedId,visibleFloorIds:f.visibleFloorIds,wallMs:f.wallMs,gpu:g.gpu,modelTriangles:g.stats.modelTriangles,modelVertexBuffers:g.stats.modelVertexBuffers};}""")
with sync_playwright() as pw:
 browser=None;page=None
 try:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);r['browserVersion']=browser.version
  context=browser.new_context(viewport={'width':1280,'height':900},device_scale_factor=1)
  deadline=time.monotonic()+180
  while True:
   response=context.request.get(url+'semantic-app.mjs',timeout=30000);digest=hashlib.sha256(response.body()).hexdigest()
   if response.status==200 and digest==cfg['files']['semantic-app.mjs']:break
   if time.monotonic()>=deadline:raise AssertionError('Exact public R03 app not available within bounded observation window')
   time.sleep(10)
  for rel,wanted in cfg['files'].items():
   response=context.request.get(url+rel,timeout=30000);digest=hashlib.sha256(response.body()).hexdigest();r['files'][rel]={'status':response.status,'sha256':digest,'passed':response.status==200 and digest==wanted};save();assert r['files'][rel]['passed'],('public closure mismatch',rel)
  page=context.new_page();page.set_default_timeout(240000);page.on('pageerror',lambda e:r['pageErrors'].append(str(e)));page.on('requestfailed',lambda q:r['failedRequests'].append({'url':q.url,'failure':q.failure}));page.goto(url,wait_until='domcontentloaded');wait('lowrise','whole')
  for case in ['lowrise','kcc','warehouse']:
   if case!='lowrise':n=frames();page.locator('#case').select_option(case);wait(case,'whole',n)
   shot(case+'-public-whole')
   n=frames();page.locator('[data-class="floor"]').click();wait(case,'level',n);data=sample();assert data['bad']==0 and data['counts'].get('stair',0)>20 and data['counts'].get('floor',0)>20;assert data['ids'].get(str(data['selectedId']),0)>0;assert data['modelTriangles']==data['modelVertexBuffers']==0 and len(data['visibleFloorIds'])==2;r['checks'].append({'label':case+' actual public floor/stair UI','passed':True,**data});shot(case+'-public-floor')
   q=data['picks']['stair'];box=page.locator('#view').bounding_box();n=frames();page.mouse.click(box['x']+(q['x']+.5)/data['width']*box['width'],box['y']+(data['height']-q['y']-.5)/data['height']*box['height']);wait(case,'level',n);selected=page.evaluate('window.semanticInspection.selected');assert selected['objectId']==q['id'] and selected['id'] and selected['ownerId'];r['checks'].append({'label':case+' public canvas original-ID selection','passed':True,'selected':selected});save()
   if case=='lowrise':n=frames();page.locator('#showShell').uncheck();wait(case,'level',n);shot('lowrise-public-shell-hidden')
  assert not r['pageErrors'] and not r['failedRequests'],(r['pageErrors'],r['failedRequests']);r['passed']=True
 except Exception:
  r['error']=traceback.format_exc()
  if page:
   try:shot('failure')
   except Exception as error:r['screenshotError']=repr(error)
 finally:
  r['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save()
  if browser:browser.close()
if not r['passed']:print(json.dumps(r,ensure_ascii=False));raise SystemExit(1)
print('Actual public R03: all88 exact files and three-case floor/pick smoke passed.',flush=True)
