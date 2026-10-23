#!/usr/bin/env python3
"""Actual public WebGL QA for pastel semantic inspection. Existing CI runner only."""
import argparse,json,time,hashlib,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
pa=argparse.ArgumentParser();pa.add_argument('--output',default='public-inspection-evidence');args,_=pa.parse_known_args()
config=json.loads(Path(__file__).with_name('semantic-qa-config.json').read_text());url=config['targetUrl'].rstrip('/')+'/'
out=Path(args.output);out.mkdir(parents=True,exist_ok=True);timeout=config.get('frameTimeoutMs',240000)
r={'url':url,'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'passed':False,'realBrowser':True,'mobileScope':'viewport simulation only, not physical phone','checks':[],'screenshots':[],'pageErrors':[],'failedRequests':[],'publishObservations':[]}
def save():(out/'semantic-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def stable(id,n=-1,view=None):
 page.wait_for_function("""({id,n,view})=>{const s=window.semanticInspection;if(s?.errors?.length)throw Error(s.errors.join('\\n'));return s?.ready&&s.caseId===id&&!s.renderer.busy&&s.frames.length>n&&(!view||s.view===view)}""",arg={'id':id,'n':n,'view':view},timeout=timeout)
def frames():return page.evaluate('window.semanticInspection.frames.length')
def shot(name):page.screenshot(path=str(out/(name+'.png')),full_page=True);r['screenshots'].append(name+'.png')
def check(label):
 x=page.evaluate("""()=>{const s=window.semanticInspection,r=s.renderer,p=r.readPixels(),pal=[...new Set(s.registry.map(x=>x.color))].map(h=>h.slice(1).match(/../g).map(x=>parseInt(x,16))),bg=[233,237,240],counts={},off=[],unique=new Set(),near=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<=1);let visible=0;for(let i=0;i<p.length;i+=4){const c=[p[i],p[i+1],p[i+2]];if(near(c,bg))continue;visible++;unique.add(c.join(','));const k=pal.findIndex(a=>{const scale=c.reduce((n,v,j)=>n+v*a[j],0)/a.reduce((n,v)=>n+v*v,0);return scale>=.45&&scale<=1.1&&c.every((v,j)=>Math.abs(v-a[j]*scale)<=2.2)});if(k<0){if(off.length<10)off.push(c)}else counts[k]=(counts[k]||0)+1;}const f=s.lastStats;let pick=null,bad=0;for(let y=Math.floor(f.height*.12);y<f.height*.88;y+=Math.floor(f.height/18))for(let x=Math.floor(f.width*.12);x<f.width*.88;x+=Math.floor(f.width/18)){const h=r.readHit(x,y);if(h.status>2.5)bad++;if(!pick&&h.status>.5&&h.status<1.5&&s.registry.some(q=>q.objectId===h.objectId))pick={x,y,...h};}return {caseId:s.caseId,view:s.view,width:r.canvas.width,height:r.canvas.height,visible,counts,colorVariants:unique.size,offPalette:off,invalidTraceHits:bad,pick,gpu:r.gpu,frameWallMs:f.wallMs,modelTriangles:r.stats.modelTriangles,modelVertexBuffers:r.stats.modelVertexBuffers,modelFrame:s.model.placementMode??'source-local',registryCount:s.registry.length,sourcePatches:s.source.patches.length,errors:s.errors};}""")
 assert x['visible']>500,(label,'empty output',x)
 assert len(x['counts'])>=2,(label,'insufficient class hues',x)
 assert x['colorVariants']>=3,(label,'no readable form variation')
 assert not x['offPalette'],(label,'output differs from specified tint/form palette',x['offPalette'])
 assert not x['invalidTraceHits'],(label,'unresolved ray solver hits')
 assert x['modelTriangles']==x['modelVertexBuffers']==0
 assert x['pick'] and not x['errors']
 r['checks'].append({'label':label,'passed':True,**x});save();print(label,round(x['frameWallMs']),x['gpu'],flush=True);return x
def pick(x):
 b=page.locator('#view').bounding_box();n=frames();q=x['pick'];page.mouse.click(b['x']+(q['x']+.5)/x['width']*b['width'],b['y']+(x['height']-q['y']-.5)/x['height']*b['height'])
 page.wait_for_function('id=>window.semanticInspection.selected?.objectId===id',arg=q['objectId'],timeout=timeout);stable(x['caseId'],n,x['view']);s=page.evaluate('window.semanticInspection.selected');assert s['id'] and s['ownerId'] and s['classEvidence'];assert page.evaluate('window.semanticInspection.renderer.options.selectedId')==q['objectId'];r['checks'].append({'label':x['caseId']+' actual canvas selection and outline ID','passed':True,'selected':s})
with sync_playwright() as pw:
 browser=None;page=None
 try:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  r['browserVersion']=browser.version;context=browser.new_context(viewport={'width':1280,'height':900},device_scale_factor=1);page=context.new_page();page.set_default_timeout(timeout)
  page.on('pageerror',lambda e:r['pageErrors'].append(str(e)));page.on('requestfailed',lambda q:r['failedRequests'].append({'url':q.url,'failure':q.failure}))
  deadline=time.monotonic()+180
  while True:
   a=context.request.get(url+'semantic-app.mjs',timeout=30000);sha=hashlib.sha256(a.body()).hexdigest();r['publishObservations'].append({'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'status':a.status,'sha256':sha});save()
   if a.status==200 and sha==config['expectedAppSha256']:break
   if time.monotonic()>=deadline:raise AssertionError('Expected public app version did not become available during 180-second observation window')
   time.sleep(10)
  r['appSha256']=sha;page.goto(url,wait_until='domcontentloaded',timeout=timeout);stable('lowrise',view='whole')
  for id in ['lowrise','kcc','warehouse']:
   if id!='lowrise':n=frames();page.locator('#case').select_option(id);stable(id,n,'whole')
   x=check(id+' whole original shape');shot(id+'-desktop-whole');pick(x);shot(id+'-desktop-selected')
   n=frames();page.locator('[data-view="cut"]').click();stable(id,n,'cut');check(id+' section form');shot(id+'-desktop-section')
   if id=='lowrise':
    for key in ['door','window']:
     page.locator('[data-class="'+key+'"]').click()
     page.wait_for_function("k=>{const s=window.semanticInspection;return s.selected?.classKey===k&&s.focusedId===s.selected.objectId&&!s.renderer.busy}",arg=key,timeout=timeout)
     visible=page.evaluate("""()=>{const s=window.semanticInspection,r=s.renderer,f=s.lastStats,id=s.selected.objectId;let hits=0;for(let y=Math.floor(f.height*.15);y<f.height*.85;y+=Math.max(1,Math.floor(f.height/28)))for(let x=Math.floor(f.width*.15);x<f.width*.85;x+=Math.max(1,Math.floor(f.width/28))){const h=r.readHit(x,y);if(h.status>.5&&h.status<1.5&&h.objectId===id)hits++;}return {hits,id,selected:s.selected,view:s.view,camera:r.options};}""")
     assert visible['hits']>0,(key,'Quick focus target is occluded or offscreen',visible)
     assert visible['view']=='whole' and visible['camera']['cut']==False and visible['camera']['sliceY'] is None
     r['checks'].append({'label':'lowrise '+key+' quick focus visible original hit','passed':True,**visible});shot('lowrise-'+key+'-focus');save()
  n=frames();page.locator('#case').select_option('kcc');stable('kcc',n,'whole')
  n=frames();page.locator('#plan').click();stable('kcc',n,'plan');x=check('kcc plan');assert x['modelFrame']=='UNREGISTERED_evidence_plan_NOT_part_of_measured_mother';shot('kcc-plan-desktop')
  # Exact authored wall thickness is shown, while actual thickness remains unknown.
  page.locator('#classFilter').select_option('wall');wallid=page.evaluate("window.semanticInspection.registry.find(r=>r.prototypeNodeId?.startsWith('study-wall:')).objectId");n=frames();page.locator('#objects').select_option(str(wallid));stable('kcc',n,'plan');selected=page.evaluate('window.semanticInspection.selected');assert abs(selected['designWallThicknessM']-.11)<1e-8 and selected['actualThicknessM'] is None;shot('kcc-design-wall-thickness');r['checks'].append({'label':'design wall thickness not actual','passed':True,'selected':selected})
  n=frames();options=page.locator('#floor option').evaluate_all('(o)=>o.map(e=>e.value)');page.locator('#floor').select_option(options[-1]);stable('kcc',n,'level');x=check('kcc plan to floor');assert x['modelFrame']!='UNREGISTERED_evidence_plan_NOT_part_of_measured_mother'
  n=frames();page.locator('#plan').click();stable('kcc',n,'plan')
  n=frames();page.locator('#cutPosition').focus();page.keyboard.press('ArrowRight');page.keyboard.press('Tab');stable('kcc',n,'cut');x=check('kcc plan to cut');assert x['modelFrame']!='UNREGISTERED_evidence_plan_NOT_part_of_measured_mother';shot('kcc-frame-transitions')
  n=frames();page.locator('#case').select_option('lowrise');stable('lowrise',n,'whole');page.set_viewport_size({'width':390,'height':844});n=frames();page.locator('#reset').click();stable('lowrise',n,'whole');check('lowrise phone viewport');shot('lowrise-phone-viewport')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Phone horizontal overflow'
  assert not r['pageErrors'],r['pageErrors'];assert not r['failedRequests'],r['failedRequests'];r['passed']=True
 except Exception as e:
  r['error']=traceback.format_exc()
  if page:
   try:shot('failure');r['failureText']=page.locator('body').inner_text();r['failureState']=page.evaluate('window.semanticInspection?{ready:window.semanticInspection.ready,caseId:window.semanticInspection.caseId,view:window.semanticInspection.view,errors:window.semanticInspection.errors}:null')
   except Exception as capture:r['failureCaptureError']=repr(capture)
 finally:
  r['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save()
  if browser:browser.close()
if not r['passed']:print(json.dumps(r,ensure_ascii=False),file=sys.stderr);sys.exit(1)
print('Actual browser QA passed.',flush=True)
