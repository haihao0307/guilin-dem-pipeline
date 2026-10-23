#!/usr/bin/env python3
"""R05 exact-byte shared-scene acceptance. Software GPU, not hardware FPS."""
import argparse,base64,hashlib,json,mimetypes,time,traceback
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,TimeoutError as PlaywrightTimeoutError
root=Path(__file__).resolve().parent;cfg=json.loads((root/'unified-config.json').read_text())
args,_=argparse.ArgumentParser().parse_known_args()
# Existing workflow supplies --output and unrelated historical flags.
import sys
out=Path(sys.argv[sys.argv.index('--output')+1] if '--output' in sys.argv else 'public-inspection-evidence');out.mkdir(parents=True,exist_ok=True)
url=cfg['targetUrl'].rstrip('/')+'/'
r={'passed':False,'url':url,'candidateRouting':bool(cfg.get('overrides')),'scope':'Actual Chromium SwiftShader shared-ray-scene acceptance; not physical-device FPS','startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'files':{},'frames':{},'checks':[],'screenshots':[],'pageErrors':[],'failedRequests':[]}
def save():(out/'unified-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def fetch(ctx,target):
 for n in range(3):
  try:
   response=ctx.request.get(target,timeout=30000)
   if response.status not in (429,502,503,504) or n==2:return response
  except PlaywrightTimeoutError:
   if n==2:raise
  time.sleep(2**(n+1))
def handler(body,typ):
 def fulfill(route,request):route.fulfill(status=200,body=body,content_type=typ)
 return fulfill
def matcher(target):
 expected=urlsplit(target);paths={expected.path}
 if expected.path.endswith('/index.html'):paths.add(expected.path[:-10])
 def match(actual):
  actual=urlsplit(actual);return (actual.scheme,actual.netloc)==(expected.scheme,expected.netloc) and actual.path in paths
 return match
def stable(n=-1):
 page.wait_for_function('''n=>{const s=window.semanticInspection;if(window.__qaPageError)throw Error(window.__qaPageError);if(s?.errors?.length)throw Error(String(s.errors));const ok=s?.ready&&s.phase==='ready'&&!s.busy&&!s.renderer.busy&&s.frames.length>n;if(!ok){window.__qaSettled=null;return false;}const b=s.renderer.canvas.getBoundingClientRect(),key=JSON.stringify([s.presentedFrames,s.presentedDisplay,b.width,b.height,devicePixelRatio]);if(window.__qaSettled?.key!==key){window.__qaSettled={key,since:performance.now()};return false;}return performance.now()-window.__qaSettled.since>=120;}''',arg=n,timeout=180000)
def frames():return page.evaluate('semanticInspection.frames.length')
def action(fn):
 n=frames();fn();stable(n)
def shot(name):
 page.screenshot(path=str(out/(name+'.png')));r['screenshots'].append(name+'.png');save()
CAPTURE='''()=>{const s=semanticInspection,g=s.renderer,f=s.lastStats,rect=g.canvas.getBoundingClientRect(),camera=s.presentedCamera??g.options;
 const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((q,v,k)=>q+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n)},forward=norm(sub(camera.target,camera.eye)),right=norm(cross(forward,Math.abs(forward[1])>.999?[0,0,1]:[0,1,0])),up=cross(right,forward),aspect=f.width/f.height,tan=Math.tan(camera.fov/2),bounds=s.getBounds(),projected=[];
 for(let i=0;i<8;i++){const p=bounds.min.map((v,k)=>i&(1<<k)?bounds.max[k]:v),d=sub(p,camera.eye),z=dot(d,forward);projected.push({p,z,x:dot(d,right)/(z*tan*aspect),y:dot(d,up)/(z*tan)});}
 const counts={},picks={},sourceSamples=[],ids=s.registry.map(q=>q.objectId),stableIds=s.registry.map(q=>q.id);let bad=0;
 for(let y=7;y<f.height-7;y+=Math.max(1,Math.floor(f.height/38)))for(let x=7;x<f.width-7;x+=Math.max(1,Math.floor(f.width/66))){const h=g.readHit(x,y);if(h.status>2.5)bad++;if(h.status>.5&&h.status<1.5){const q=s.registry.find(q=>q.objectId===h.objectId);if(!q){bad++;continue;}const k=q.caseId??q.buildingCaseId??q.buildingId;counts[k]=(counts[k]??0)+1;if(q.sourcePatchId){picks[k]??={x,y,hit:h,record:q};if(sourceSamples.filter(p=>p.record.caseId===q.caseId).length<10)sourceSamples.push({x,y,hit:h,record:q});}}}
 const gl=g.gl;return{version:s.version,buildingCount:s.buildings.length,buildings:s.buildings.map(b=>({caseId:b.caseId??b.id,sourceModelId:b.localSource.sourceModelId,translation:b.transform.translation,patches:b.localSource.patches.length})),registryCount:s.registry.length,sourceCount:g.measured.patches.length,uniqueObjectIds:new Set(ids).size,uniqueStableIds:new Set(stableIds).size,canvasCount:document.querySelectorAll('canvas').length,canvas:{width:g.canvas.width,height:g.canvas.height,cssWidth:rect.width,cssHeight:rect.height,x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom},viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},stats:f,display:s.display,camera,bounds,projected,counts,picks,sourceSamples,bad,selected:s.selected,gpu:g.gpu,glError:gl.getError(),modelTriangles:g.stats.modelTriangles,modelVertexBuffers:g.stats.modelVertexBuffers,imageRendering:getComputedStyle(g.canvas).imageRendering};}'''
def capture(label,whole=True):
 q=page.evaluate(CAPTURE);r['frames'][label]=q;save();c=q['canvas'];f=q['stats']
 assert q['buildingCount']==3 and q['canvasCount']==1,('not three buildings in one canvas',q['buildingCount'],q['canvasCount'])
 assert q['sourceCount']==225,('original source patches not all retained',q['sourceCount'])
 assert q['uniqueObjectIds']==q['registryCount']==q['uniqueStableIds'],('identity collision',label)
 assert c['width']==f['width'] and c['height']==f['height'],('backing/render mismatch',label)
 assert f['tilesCompleted']==f['tilesPlanned'] and f['tilesSubmitted']==f['tilesPlanned'],('incomplete frame',label)
 assert abs(c['width']/c['height']-c['cssWidth']/c['cssHeight'])<.004,('aspect stretch',label)
 assert abs(c['width']-c['cssWidth']*q['viewport']['dpr'])<=2 and abs(c['height']-c['cssHeight']*q['viewport']['dpr'])<=2,('non-native output',label)
 assert q['bad']==q['glError']==q['modelTriangles']==q['modelVertexBuffers']==0,('invalid field or mesh substitution',label)
 assert q['imageRendering']!='pixelated'
 if whole:
  assert q['camera'].get('cut') is False and q['camera'].get('sliceY') is None,('whole view contains inherited clipping',label,q['camera'])
  assert len(q['counts'])==3 and len(q['picks'])==3,('not all three source buildings visible',q['counts'],list(q['picks']))
  assert all(p['z']>0 and abs(p['x'])<.98 and abs(p['y'])<.98 for p in q['projected']),('whole bounds clipped',label)
  assert c['x']>=0 and c['y']>=0 and c['right']<=q['viewport']['width']+1 and c['bottom']<=q['viewport']['height']+1,('canvas clipped by screen',label,c)
 print('CAPTURE',label,c['width'],c['height'],round(f['wallMs']),q['counts'],flush=True);return q

def click_pick(hit,q):
 b=page.locator('#view').bounding_box();before=page.evaluate('semanticInspection.selectionRevision??0');before_frames=frames();page.mouse.click(b['x']+(hit['x']+.5)/q['stats']['width']*b['width'],b['y']+(q['stats']['height']-hit['y']-.5)/q['stats']['height']*b['height']);page.wait_for_function('n=>semanticInspection.selectionRevision>n',arg=before);stable();assert frames()==before_frames,'selection retraced the whole scene'
 got=page.evaluate('semanticInspection.selected');expected=hit['record']
 assert got and all(got.get(k)==expected.get(k) for k in ['objectId','id','caseId','buildingId','sourcePatchId','localObjectId','localId','localOwnerId']),('canvas selected wrong identity',expected,got)
 panel=page.locator('#evidencePanel').inner_text();assert panel.strip(),('evidence panel empty',got)
 evidence=page.evaluate('({face:semanticInspection.selectedFace,photos:semanticInspection.photoEvidence,repaint:semanticInspection.selectionRepaint})');assert evidence['face']['caseId']==expected['caseId'] and evidence['face']['sourcePatchId']==expected['sourcePatchId'];assert evidence['photos']['caseId']==expected['caseId'];assert evidence['repaint']['tracePasses']==0;evidence['traceFrameCountUnchanged']=True;assert page.locator('#evidencePanel').evaluate('(e)=>e.scrollTop')<2,'newly picked evidence is left offscreen'
 r['checks'].append({'label':'True canvas click retains building/object/original facade identity','passed':True,'expected':expected,'selected':got,'evidencePanel':panel,'evidence':evidence});save()

with sync_playwright() as pw:
 browser=None;page=None
 try:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);r['browserVersion']=browser.version
  verify=browser.new_context()
  if cfg.get('publicSmoke'):
   deadline=time.monotonic()+180
   while True:
    response=fetch(verify,url+'index.html')
    if response.status==200 and hashlib.sha256(response.body()).hexdigest()==cfg['files']['index.html']:break
    if time.monotonic()>deadline:raise AssertionError('Expected public R05 index not yet served')
    time.sleep(5)
  for rel,wanted in cfg['files'].items():
   override=cfg.get('overrides',{}).get(rel)
   if override:
    p=(root/override).resolve();assert p.is_relative_to(root);body=p.read_bytes();status=200;origin='frozen-candidate'
   else:
    response=fetch(verify,url+rel);body=response.body();status=response.status;origin='exact-public'
   digest=hashlib.sha256(body).hexdigest();r['files'][rel]={'status':status,'sha256':digest,'origin':origin,'passed':status==200 and digest==wanted};assert r['files'][rel]['passed'],('closure mismatch',rel)
  verify.close();save()
  context=browser.new_context(viewport={'width':1920,'height':1080},device_scale_factor=1)
  for rel,asset in cfg.get('overrides',{}).items():context.route(matcher(url+rel),handler((root/asset).read_bytes(),'text/javascript' if rel.endswith(('.mjs','.js')) else mimetypes.guess_type(rel)[0] or 'text/plain'))
  page=context.new_page();page.add_init_script("window.addEventListener('error',e=>window.__qaPageError=e.message);window.addEventListener('unhandledrejection',e=>window.__qaPageError=String(e.reason));");page.set_default_timeout(180000)
  page.on('pageerror',lambda e:r['pageErrors'].append(str(e)));page.on('requestfailed',lambda q:r['failedRequests'].append({'url':q.url,'failure':q.failure}))
  navigation=page.goto(url,wait_until='domcontentloaded');assert hashlib.sha256(navigation.body()).hexdigest()==cfg['files']['index.html'],'wrong directory candidate index';stable()
  q=capture('all-three-initial-native');shot('all-three-initial-native')
  for case,hit in q['picks'].items():
   click_pick(hit,q);after=capture('clicked-'+case);assert after['registryCount']==q['registryCount'] and after['sourceCount']==q['sourceCount'];shot('clicked-'+case)
  if cfg.get('testLocalPhotos'):
   page.evaluate("semanticInspection.selectFace('lowrise','p112')");page.wait_for_function("semanticInspection.localPhotoState?.key==='lowrise|source-face:p112'&&semanticInspection.localPhotoState?.count===0")
   local_requests=[]
   listener=lambda request:local_requests.append({'method':request.method,'url':request.url}) if request.url.startswith(('https:','http:')) else None
   page.on('request',listener);n=frames()
   fixture=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=')
   page.locator('#localPhotoInput').set_input_files([{'name':'qa-local-face-a.png','mimeType':'image/png','buffer':fixture},{'name':'qa-local-face-b.png','mimeType':'image/png','buffer':fixture}])
   page.wait_for_function("semanticInspection.localPhotoState?.count===2&&document.querySelector('.local-reference-image')?.naturalWidth>0");assert page.locator('.local-photo-tabs button').count()==2;page.locator('.local-photo-tabs button').nth(1).click();assert page.evaluate('semanticInspection.localPhotos.state.activeIndex')==1
   saved=page.evaluate('semanticInspection.localPhotoState');assert saved['persisted'] and saved['storage']=='indexeddb' and saved['networkUploads']==0 and frames()==n;assert page.locator('.local-reference-image').get_attribute('src').startswith('blob:');shot('local-user-photo-preview-synthetic-fixture')
   page.evaluate("semanticInspection.selectFace('kcc','p001')");page.wait_for_function("semanticInspection.localPhotoState?.key==='kcc|source-face:p001'&&semanticInspection.localPhotoState?.count===0");assert page.locator('.local-reference-image').count()==0
   page.evaluate("semanticInspection.selectFace('lowrise','p097')");page.wait_for_function("semanticInspection.localPhotoState?.key==='lowrise|source-face:p097'&&semanticInspection.localPhotoState?.count===0")
   page.evaluate("semanticInspection.selectFace('lowrise','p112')");page.wait_for_function("semanticInspection.localPhotoState?.count===2&&document.querySelector('.local-reference-image')?.naturalWidth>0");assert not local_requests,('local photos caused network traffic',local_requests);assert frames()==n,'local reference flow retraced geometry';page.remove_listener('request',listener)
   page.reload(wait_until='domcontentloaded');stable();page.evaluate("semanticInspection.selectFace('lowrise','p112')");page.wait_for_function("semanticInspection.localPhotoState?.key==='lowrise|source-face:p112'&&semanticInspection.localPhotoState?.count===2&&document.querySelector('.local-reference-image')?.naturalWidth>0");assert page.evaluate('semanticInspection.localPhotoState.persisted')
   page.locator('#clearLocalPhotos').click();page.wait_for_function("semanticInspection.localPhotoState?.count===0");assert page.locator('.local-reference-image').count()==0
   disk_count=page.evaluate("""()=>new Promise((resolve,reject)=>{const r=indexedDB.open('building-r05-local-references',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('references').objectStore('references').get('lowrise|source-face:p112');q.onsuccess=()=>{resolve(q.result?.photos?.length??0);db.close()};q.onerror=()=>reject(q.error)};r.onerror=()=>reject(r.error)})""");assert disk_count==0
   r['checks'].append({'label':'Local user photos persist by exact building/facade, multi-photo tabs, no upload, no geometry retrace, reload recovery and true stored deletion','passed':True,'fixture':'two synthetic 1-pixel PNGs only, not user photos','saved':saved,'networkRequestsDuringImportAndSwitch':local_requests,'reloadPersisted':True,'deletedFromIndexedDB':True});save()
  if not cfg.get('publicSmoke') and not cfg.get('targetedImages'):
   action(lambda:page.locator('[data-view="source"]').click());source_q=capture('all-three-source-only');shot('all-three-source-only')
   gpu_rays=page.evaluate('''async()=>{const {intersectCaseRay}=await import('./kowloon-building-mother-r01/r07/cases.mjs'),s=semanticInspection,g=s.renderer,c=s.presentedCamera,f=s.lastStats,norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n)},sub=(a,b)=>a.map((v,k)=>v-b[k]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],forward=norm(sub(c.target,c.eye)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward),tan=Math.tan(c.fov/2),counts={},failures=[];let checked=0;for(let y=9;y<f.height-9;y+=Math.floor(f.height/29))for(let x=9;x<f.width-9;x+=Math.floor(f.width/51)){const hit=g.readHit(x,y);if(hit.status<.5)continue;const u=(2*(x+.5)-f.width)/f.height,v=(2*(y+.5)-f.height)/f.height,rd=norm(forward.map((w,k)=>w+tan*(u*right[k]+v*up[k]))),expected=intersectCaseRay(s.source,c.eye,rd),record=s.registry.find(q=>q.objectId===hit.objectId);checked++;counts[record?.caseId]=(counts[record?.caseId]??0)+1;if(!expected.hit||Math.abs(expected.t-hit.t)>.01||expected.objectId!==hit.objectId)failures.push({x,y,hit,expected});}return{checked,counts,failures};}''')
   assert gpu_rays['checked']>25 and len(gpu_rays['counts'])==3 and not gpu_rays['failures'],('GPU nearest source hit mismatch',gpu_rays);r['checks'].append({'label':'Actual shared source GPU hits match nearest analytic source across three buildings','passed':True,**gpu_rays});save()
  if not cfg.get('publicSmoke') and not cfg.get('targetedImages'):
   action(lambda:page.locator('#fitView').click());q=capture('reset-all-three');shot('reset-all-three')
   n=frames();page.set_viewport_size({'width':1366,'height':900});stable(n);capture('laptop-native-fullframe');shot('laptop-native-fullframe')
  if cfg.get('targetedImages'):
   mapped=page.evaluate("""async()=>{const {OFFICIAL_FACE_TEXTURES:d}=await import('./official-face-textures.mjs');return{cases:Object.fromEntries(Object.entries(d.cases).map(([id,c])=>[id,{count:c.faces.length,registered:c.registeredPlaneCount,total:c.totalPlaneCount,overview:c.overviewIds,faces:c.faces.map(p=>({id:p.id,caseId:p.caseId,sourcePatchId:p.sourcePatchId,imageUrl:p.imageUrl,kind:p.evidenceKind,sourceModelId:p.sourceModelId,texturedModelId:p.texturedModelId,atlasSize:p.atlasSize,atlasCropXYXY:p.atlasCropXYXY,rotation:p.atlasRotationCCW,triangleCount:p.atlasUVTriangles.length,attribution:p.attribution,licenseUrl:p.licenseUrl,captureDate:p.captureDate,caveat:p.caveat}))}])),files:d.files};}""")
   assert sum(c['count'] for c in mapped['cases'].values())==175
   chosen=[('lowrise','p112'),('lowrise','p120'),('kcc','p002'),('warehouse','p024')]
   r['officialImageChecks']=[]
   for case,pid in chosen:
    before=frames();page.locator('#evidencePanel').evaluate('(e)=>e.scrollTop=e.scrollHeight');page.evaluate('([c,p])=>semanticInspection.selectFace(c,p)',[case,pid]);page.wait_for_function("document.querySelector('#photoGallery svg.official-texture-image image')!==null")
    e=page.evaluate("""async()=>{const s=semanticInspection,p=s.photoEvidence.photos[0],svg=document.querySelector('#photoGallery svg.official-texture-image'),im=svg.querySelector('image'),src=im.getAttribute('href'),probe=new Image();probe.src=src;await probe.decode();return{caseId:s.caseId,sourcePatchId:s.selected.sourcePatchId,photo:p,svgPatch:svg.dataset.sourcePatchId,svgModel:svg.dataset.texturedModelId,atlasHref:src,decodedWidth:probe.naturalWidth,decodedHeight:probe.naturalHeight,polygons:svg.querySelectorAll('clipPath polygon').length,rect:svg.getBoundingClientRect().toJSON(),scrollTop:document.querySelector('#evidencePanel').scrollTop,text:document.querySelector('#photoGallery').innerText};}""")
    assert e['caseId']==case and e['sourcePatchId']==pid and e['svgPatch']==pid and e['photo']['sourcePatchId']==pid and e['photo']['caseId']==case
    assert e['photo']['evidenceKind']=='official_model_appearance_texture' and e['svgModel']==e['photo']['texturedModelId'] and e['atlasHref']==e['photo']['imageUrl'];assert [e['decodedWidth'],e['decodedHeight']]==e['photo']['atlasSize'];assert e['polygons']==len(e['photo']['atlasUVTriangles']);assert e['photo']['attribution'] and e['photo']['licenseUrl']=='https://portal.csdi.gov.hk/csdi-webpage/doc/TNC';assert e['photo']['captureDate'] is None;assert e['scrollTop']<2 and frames()==before;assert '非原始相机照片' in e['text'] and '未知' in e['text'];r['officialImageChecks'].append(e);save();shot('official-'+case+'-'+pid)
   for pid in ['p172','p173']:
    page.evaluate('p=>semanticInspection.selectFace("lowrise",p)',pid);assert page.locator('#photoGallery svg.official-texture-image').count()==0;assert page.evaluate('semanticInspection.photoEvidence.status')!='image_available'
   for case in ['lowrise','kcc','warehouse']:
    page.locator('[data-building="'+case+'"]').click();page.wait_for_function('c=>semanticInspection.caseId===c',arg=case);overview=page.evaluate('semanticInspection.photoEvidence');assert len(overview['photos'])>=3 and all(p['caseId']==case for p in overview['photos']);assert page.locator('#photoGallery svg.official-texture-image').count()==1 and page.locator('#buildingPhotoOverview .building-photo-thumb').count()==len(overview['photos']);shot('official-overview-'+case)
   r['officialMapping']=mapped;r['checks'].append({'label':'Five exact official atlases,175 source-face UV bindings, same-building overviews, no images for failed-registration faces, original-camera/capture-date/rights labels','passed':True});save()
  r['photoMatrix']=page.evaluate('''async()=>{const {PHOTO_EVIDENCE,resolvePhotoEvidence}=await import('./photo-evidence.mjs');return{legacyInlinePhotoCount:PHOTO_EVIDENCE.photos.filter(p=>p.imageUrl).length,publicPhotoDisplayComplete:PHOTO_EVIDENCE.publicPhotoDisplayComplete,cases:[['lowrise','p112'],['lowrise','p097'],['lowrise','p999'],['kcc','p001'],['warehouse','p001']].map(([c,p])=>resolvePhotoEvidence(c,{sourcePatchId:p}))};}''');assert all(all(p['caseId']==e['caseId'] for p in e['photos']+e['otherBuildingPhotos']) for e in r['photoMatrix']['cases']),'cross-building photo leakage';assert r['photoMatrix']['cases'][2]['photos']==[],'nonexistent surface gained false photo matches';save()
  r['hierarchy']=page.evaluate('''()=>{const s=semanticInspection;return s.registry.filter(q=>q.classKey==='elevator').map(q=>({caseId:q.caseId,buildingId:q.buildingId,objectId:q.objectId,localObjectId:q.localObjectId,id:q.id,ownerId:q.ownerId,nodeId:q.nodeId,sourceOwnerId:q.sourceOwnerId}));}''')
  assert r['hierarchy'],'existing elevator hierarchy missing'
  assert not r['pageErrors'],r['pageErrors'];assert not [q for q in r['failedRequests'] if q['url'].startswith(url)],r['failedRequests']
  r['passed']=True
 except Exception:
  r['error']=traceback.format_exc()
  if page:
   try:shot('failure')
   except Exception as e:r['screenshotError']=repr(e)
 finally:
  r['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save()
  if browser:browser.close()
if not r['passed']:print(json.dumps(r,ensure_ascii=False));raise SystemExit(1)
print('R05 shared canvas native render and exact identities passed.',flush=True)
