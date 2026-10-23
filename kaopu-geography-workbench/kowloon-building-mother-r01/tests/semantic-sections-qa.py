#!/usr/bin/env python3
"""Real existing-runner WebGL inspection QA. Candidate routing is explicitly reported."""
import argparse, hashlib, json, mimetypes, sys, time, traceback
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--output',default='public-inspection-evidence');args,_=p.parse_known_args()
config=json.loads(Path(__file__).with_name('semantic-sections-config.json').read_text());url=config['targetUrl'].rstrip('/')+'/'
root=Path(__file__).parent;candidate=(root/config['candidateDir']).resolve() if config.get('candidateDir') else None
out=Path(args.output);out.mkdir(parents=True,exist_ok=True);timeout=config.get('frameTimeoutMs',240000)
r={'url':url,'candidateRouting':bool(candidate),'publicDeploymentTest':not bool(candidate),'realBrowser':True,'passed':False,'checks':[],'failures':[],'screenshots':[],'pageErrors':[],'failedRequests':[],'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
def save():(out/'sections-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def shot(name):page.screenshot(path=str(out/(name+'.png')),full_page=True);r['screenshots'].append(name+'.png');save()
def frames():return page.evaluate('window.semanticInspection.frames.length')
def wait(id,n=-1,view=None):page.wait_for_function("""({id,n,view})=>{const s=window.semanticInspection;if(s?.errors?.length)throw Error(String(s.errors));return s?.ready&&s.caseId===id&&s.frames.length>n&&!s.renderer.busy&&(!view||s.view===view)}""",arg={'id':id,'n':n,'view':view},timeout=timeout)
def click(selector,id,view=None):n=frames();page.locator(selector).click();wait(id,n,view)
def record(label,value):r['checks'].append({'label':label,'passed':True,**value});save()
def hit_counts():return page.evaluate("""()=>{const s=window.semanticInspection,r=s.renderer,f=s.lastStats,counts={},ids={},picks={};let invalid=0,sourceHits=0;for(let y=8;y<f.height-8;y+=Math.max(1,Math.floor(f.height/40)))for(let x=8;x<f.width-8;x+=Math.max(1,Math.floor(f.width/40))){const h=r.readHit(x,y);if(h.status>2.5)invalid++;if(h.status>.5&&h.status<1.5){const q=s.registry.find(q=>q.objectId===h.objectId);if(q?.sourcePatchId)sourceHits++;const k=q?.classKey??'MISSING';counts[k]=(counts[k]??0)+1;ids[h.objectId]=(ids[h.objectId]??0)+1;picks[k]??={x,y,objectId:h.objectId};}}return {counts,ids,picks,invalid,sourceHits,width:f.width,height:f.height,frameWallMs:f.wallMs,gpu:r.gpu,visibleFloorIds:f.visibleFloorIds,inspection:s.floorInspection,selected:s.selected,selectedId:r.options.selectedId,camera:r.options,modelFrame:s.model.placementMode??'source-local'};}""")
def actual_pick(id,data,key='stair'):
 q=data['picks'][key];b=page.locator('#view').bounding_box();n=frames();page.mouse.click(b['x']+(q['x']+.5)/data['width']*b['width'],b['y']+(data['height']-q['y']-.5)/data['height']*b['height']);wait(id,n);selected=page.evaluate('window.semanticInspection.selected');assert selected['objectId']==q['objectId'];return selected
with sync_playwright() as pw:
 browser=None;page=None
 try:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);r['browserVersion']=browser.version
  context=browser.new_context(viewport={'width':1280,'height':900},device_scale_factor=1)
  manifest=config.get('expectedFiles',{})
  if candidate:
   r['candidateHashes']={}
   for rel,expected in manifest.items():
    digest=hashlib.sha256((candidate/rel).read_bytes()).hexdigest();assert digest==expected,('candidate mismatch',rel,digest);r['candidateHashes'][rel]=digest
   def route(req,_request=None):
    relative=unquote(req.request.url[len(url):].split('?')[0]) or 'index.html';target=(candidate/relative).resolve()
    if not target.is_relative_to(candidate):raise AssertionError('Candidate path escaped scope')
    if target.is_file():req.fulfill(status=200,body=target.read_bytes(),content_type='text/javascript' if target.suffix in ['.js','.mjs'] else mimetypes.guess_type(target.name)[0] or 'application/octet-stream')
    else:req.continue_()
   context.route(url+'**',route)
  else:
   for rel,expected in manifest.items():
    response=context.request.get(url+rel);digest=hashlib.sha256(response.body()).hexdigest();assert response.status==200 and digest==expected,('public mismatch',rel,response.status,digest)
  page=context.new_page();page.set_default_timeout(timeout);page.on('pageerror',lambda e:r['pageErrors'].append(str(e)));page.on('requestfailed',lambda q:r['failedRequests'].append({'url':q.url,'failure':q.failure}));page.goto(url,wait_until='domcontentloaded',timeout=timeout);wait('lowrise',view='whole')
  for case in ['lowrise','kcc','warehouse']:
   try:
    if case!='lowrise':
     n=frames();page.locator('#case').select_option(case);wait(case,n,'whole')
     stale=page.evaluate("({selected:window.semanticInspection.selected,text:document.querySelector('#selected').textContent,filter:document.querySelector('#classFilter').value})");assert stale['selected'] is None and stale['filter']=='';assert '原始渲染ID' not in stale['text'];record(case+' switch clears inspector',stale)
    click('[data-class="floor"]',case,'level');page.wait_for_function("()=>window.semanticInspection.selected?.classKey==='floor'&&!window.semanticInspection.renderer.busy",timeout=timeout);data=hit_counts();assert data['ids'].get(str(data['selectedId']),0)>0,('floor quick action hid selected slab',case,data);assert data['invalid']==0;assert data['counts'].get('stair',0)>20 and data['counts'].get('floor',0)>20,('stair/floor unreadable',data);assert len(data['visibleFloorIds'])==2;assert data['camera']['eye'][1]==data['inspection']['lowerElevation']+1.65;shot(case+'-floor-stair-section');record(case+' local floor/stair actual hits',data)
    selected=actual_pick(case,data);stableid=selected['id'];record(case+' actual stair selection',{'selected':selected})
    for view in ['cut','whole','level']:
     click('[data-view="'+view+'"]',case,view);assert page.evaluate('window.semanticInspection.selected?.id')==stableid,('selection lost',case,view)
    record(case+' same stable ID across section/exterior/floor',{'id':stableid})
    before=page.evaluate('window.semanticInspection.renderer.options.sliceY');n=frames();page.locator('#sliceTop').scroll_into_view_if_needed();box=page.locator('#sliceTop').bounding_box();page.mouse.click(box['x']+box['width']*.65,box['y']+box['height']/2);wait(case,n,'level');after=page.evaluate('window.semanticInspection.renderer.options.sliceY');assert after[1]<before[1];shot(case+'-upper-cut');record(case+' adjustable upper clipping',{'before':before,'after':after})
    n=frames();page.locator('#showShell').uncheck();wait(case,n,'level');assert page.locator('#showShell').is_checked()==False;assert hit_counts()['sourceHits']==0;shot(case+'-shell-hidden');record(case+' source shell visibility control',{'hidden':True})
    n=frames();page.locator('#showShell').check();wait(case,n,'level')
    if case=='kcc':
     click('#plan',case,'plan');assert page.evaluate('window.semanticInspection.selected') is None
     click('[data-view="level"]',case,'level');assert page.evaluate("window.semanticInspection.model.placementMode??'source-local'")!='UNREGISTERED_evidence_plan_NOT_part_of_measured_mother';assert page.evaluate('window.semanticInspection.selected') is None;shot('kcc-plan-to-source-floor');record('KCC plan to floor uses source frame and clears selection',{})
   except Exception:
    r['failures'].append({'case':case,'error':traceback.format_exc()});shot(case+'-failure');save()
  n=frames();page.locator('#case').select_option('lowrise');wait('lowrise',n,'whole')
  for group,size in [('balcony',9),('cover',5)]:
   click('[data-assembly="'+group+'"]','lowrise','whole');data=page.evaluate('({group:window.semanticInspection.selectedAssembly,relation:window.semanticInspection.relationshipReport})');assert len(data['group']['objectIds'])==size;assert abs(data['relation']['verticalMismatchM']-1.242)<.00001;assert data['relation']['traversableConnection']==False;hits=hit_counts();assert sum(hits['ids'].get(str(i),0) for i in data['group']['objectIds'])>5;assert hits['ids'].get(str(hits['selectedId']),0)>0,('group primary face hidden',group,hits);shot('lowrise-source-'+group);record('source '+group+' group visible without moving geometry',data)
  for key in ['door','window']:
   page.locator('[data-class="'+key+'"]').click();page.wait_for_function("k=>{const s=window.semanticInspection;return s.selected?.classKey===k&&s.focusedId===s.selected.objectId&&!s.renderer.busy}",arg=key,timeout=timeout);data=hit_counts();assert data['ids'].get(str(data['selectedId']),0)>0,('focus target hidden',key,data);shot('lowrise-'+key+'-focus');record(key+' original target visible',data)
  click('[data-view="level"]','lowrise','level');page.set_viewport_size({'width':390,'height':844});click('#reset','lowrise','level');shot('lowrise-phone-floor-viewport');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');record('phone viewport only, not physical-device performance',{'width':390,'height':844})
  assert not r['pageErrors'] and not r['failedRequests'],(r['pageErrors'],r['failedRequests']);r['passed']=not r['failures']
 except Exception:r['failures'].append({'error':traceback.format_exc()});shot('failure') if page else None
 finally:
  r['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save()
  if browser:browser.close()
if not r['passed']:print(json.dumps(r,ensure_ascii=False),file=sys.stderr);sys.exit(1)
print('Actual sections browser QA passed',flush=True)
