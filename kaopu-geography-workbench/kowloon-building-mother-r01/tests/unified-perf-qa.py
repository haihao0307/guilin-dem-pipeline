#!/usr/bin/env python3
"""Frozen R07 end-to-end browser gate; same scene, native pixel resolution, no hardware FPS claim."""
import argparse,hashlib,json,math,mimetypes,time,traceback,runpy
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
cfg=json.loads((root/'unified-perf-config.json').read_text())
pa=argparse.ArgumentParser();pa.add_argument('--output',default='public-inspection-evidence');args,_=pa.parse_known_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
url=cfg['targetUrl'].rstrip('/')+'/'
r={'passed':False,'scope':'R07 complete self-designed floors and retained-controller lift end-to-end gate on actual Chromium SwiftShader. Full native dimensions, no reduced movement resolution/LOD/mesh. Exact all-pixel Float32+RGBA conservative-index tests. This does not certify actual building plans, structural fitness, or smooth hardware animation.','variants':{'candidate':{'frames':{}}},'checks':[],'errors':[],'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
def save():(out/'r07-browser-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def stable(page,n=-1):
 page.wait_for_function("""n=>{const s=window.semanticInspection;if(window.__qaError)throw Error(window.__qaError);if(s?.errors?.length)throw Error(String(s.errors));const ok=s?.ready&&s.phase==='ready'&&!s.busy&&!s.renderer.busy&&s.frames.length>n;if(!ok){window.__qaStable=null;return false}const b=s.renderer.canvas.getBoundingClientRect(),key=JSON.stringify([s.presentedFrames,b.width,b.height,devicePixelRatio]);if(window.__qaStable?.key!==key){window.__qaStable={key,t:performance.now()};return false}return performance.now()-window.__qaStable.t>150}""",arg=n,timeout=180000)

def frames(page):return page.evaluate('semanticInspection.frames.length')

def action(page,fn):
 n=frames(page);fn();stable(page,n)

def route_site(context,variant,common_css=True):
 files=cfg['variants'][variant]['files'];data={rel:(root/spec['file']).read_bytes() for rel,spec in files.items()}
 if common_css:data['semantic-style.css']=(root/cfg['variants']['candidate']['files']['semantic-style.css']['file']).read_bytes()
 def fulfill(route,request):
  u=urlsplit(request.url);base=urlsplit(url)
  if u.netloc!=base.netloc or not u.path.startswith(base.path):return route.abort('blockedbyclient')
  rel=u.path[len(base.path):] or 'index.html'
  if rel not in data:raise AssertionError(('Unexpected dependency',rel))
  typ='text/javascript' if rel.endswith(('.mjs','.js')) else mimetypes.guess_type(rel)[0] or 'application/octet-stream'
  route.fulfill(status=200,body=data[rel],content_type=typ)
 context.route('**/*',fulfill)

CAPTURE="""async()=>{const s=semanticInspection,g=s.renderer,f=s.lastStats,gl=g.gl,hex=b=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join(''),digest=async b=>hex(await crypto.subtle.digest('SHA-256',b));const rgba=g.readPixels(),rgbaHash=await digest(rgba),tileHashes=[[],[],[]],hitObjectPixels={};let covered=0,bad=0;for(const tile of g.hitTiles){gl.bindFramebuffer(gl.FRAMEBUFFER,tile.target.fbo);covered+=tile.width*tile.height;for(let i=0;i<3;i++){gl.readBuffer(gl.COLOR_ATTACHMENT0+i);const a=new Float32Array(tile.width*tile.height*4);gl.readPixels(tile.x,tile.y,tile.width,tile.height,gl.RGBA,gl.FLOAT,a);tileHashes[i].push([tile.x,tile.y,tile.width,tile.height,await digest(a)]);if(i===0)for(let k=3;k<a.length;k+=4){if(a[k]>2.5||!Number.isFinite(a[k]))bad++;if(a[k]>.5&&a[k]<1.5){const id=a[k-2];hitObjectPixels[id]=(hitObjectPixels[id]??0)+1;}}}}gl.bindFramebuffer(gl.FRAMEBUFFER,null);const fieldHashes=await Promise.all(tileHashes.map(a=>digest(new TextEncoder().encode(JSON.stringify(a))))),counts={},picks={},byId=new Map(s.registry.map(q=>[q.objectId,q]));for(let y=7;y<f.height-7;y+=Math.max(1,Math.floor(f.height/27)))for(let x=7;x<f.width-7;x+=Math.max(1,Math.floor(f.width/49))){const hit=g.readHit(x,y);if(hit.status>.5&&hit.status<1.5){const record=byId.get(hit.objectId);if(!record){bad++;continue}counts[record.caseId]=(counts[record.caseId]??0)+1;if(record.sourcePatchId&&!picks[record.caseId])picks[record.caseId]={x,y,hit,record};}}const b=g.canvas.getBoundingClientRect(),panel=document.querySelector('#evidencePanel').getBoundingClientRect(),camera=Object.fromEntries(['eye','target','fov','cut','sliceY','clipNormal','clipOffset'].map(k=>[k,f.camera[k]??null]));return{stats:f,camera,rgbaHash,fieldHashes,fieldHashMeaning:['all pixels: t,objectId,materialRole,status','all pixels: normal and auxiliary normal channel','all pixels: local coordinates and auxiliary local channel'],coveredPixels:covered,bad,counts,picks,hitObjectPixels,gpu:g.gpu,glError:gl.getError(),modelTriangles:g.stats.modelTriangles,modelVertexBuffers:g.stats.modelVertexBuffers,buildings:s.buildings.map(b=>({caseId:b.caseId,patches:b.localSource.patches.length})),sourceCount:g.measured.patches.length,registryCount:s.registry.length,uniqueIds:new Set(s.registry.map(q=>q.objectId)).size,canvasCount:document.querySelectorAll('canvas').length,canvas:{width:g.canvas.width,height:g.canvas.height,rect:b.toJSON()},panel:panel.toJSON(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},display:s.display,doc:{scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},imageRendering:getComputedStyle(g.canvas).imageRendering,projected:s.projectedBounds};}"""

def capture(page,variant,label,whole=False,shot=True):
 q=page.evaluate(CAPTURE);r['variants'][variant]['frames'][label]=q;save();f=q['stats'];b=q['canvas'];rect=b['rect'];vp=q['viewport']
 assert q['canvasCount']==1 and len(q['buildings'])==3 and q['sourceCount']==225 and q['registryCount']==q['uniqueIds']==cfg['expectedRegistryCount'],('scene loss',variant,label)
 assert q['modelTriangles']==q['modelVertexBuffers']==q['bad']==q['glError']==0,(variant,label,'invalid hit/GL/mesh')
 assert q['coveredPixels']==f['width']*f['height'] and f['tilesCompleted']==f['tilesSubmitted']==f['tilesPlanned'],('incomplete field',label)
 assert b['width']==f['width'] and b['height']==f['height'] and abs(b['width']-rect['width']*vp['dpr'])<=2 and abs(b['height']-rect['height']*vp['dpr'])<=2,('non-native output',label)
 assert q['display']['native'] and q['imageRendering']!='pixelated',('quality changed',label)
 if whole:
  assert len(q['counts'])==len(q['picks'])==3 and not q['camera']['cut'] and q['camera']['sliceY'] is None,('all three not visible',label,q['counts'])
  p=q['projected'];assert p['minDepth']>0 and max(abs(p[k]) for k in ['minX','maxX','minY','maxY'])<.98,('whole bounds clipped',label,p)
 if shot:page.screenshot(path=str(out/(variant+'-'+label+'.png')))
 print('FRAME',variant,label,b['width'],b['height'],round(f['wallMs']),q['counts'],flush=True);return q

def layout_live(page,label):
 q=page.evaluate("""()=>{const box=id=>document.querySelector(id).getBoundingClientRect().toJSON();return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},doc:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},canvas:box('#view'),panel:box('#evidencePanel'),toolbar:box('.scene-toolbar'),buttons:['#fitView','#focusBuilding','#fullscreen'].map(box),status:box('#status'),display:semanticInspection.display};}""")
 vp=q['viewport'];assert q['doc']['width']<=vp['width']+1 and q['doc']['height']<=vp['height']+2,('live document overflow',label,q)
 for k in ['canvas','panel','status']:
  b=q[k];assert b['left']>=-1 and b['right']<=vp['width']+1 and b['top']>=-1 and b['bottom']<=vp['height']+1,('live control offscreen',label,k,b,vp)
 for b in q['buttons']:assert b['left']>=0 and b['right']<=vp['width']+1 and b['top']>=0 and b['bottom']<=vp['height']+1,('live toolbar clipped',label,b)
 r['checks'].append({'label':'Actual native runtime layout '+label,'passed':True,'measurements':q});save();return q

def photo_checks(page):
 data=page.evaluate("""async()=>{const {OFFICIAL_FACE_TEXTURES:d}=await import('./official-face-textures.mjs'),{resolvePhotoEvidence}=await import('./photo-evidence.mjs');const rows=[];for(const [id,c] of Object.entries(d.cases))for(const p of c.faces){const e=resolvePhotoEvidence(id,{sourcePatchId:p.sourcePatchId});rows.push({caseId:id,patch:p.sourcePatchId,matched:e.photos.some(q=>q.id===p.id&&q.caseId===id&&q.sourcePatchId===p.sourcePatchId),attribution:!!p.attribution,license:p.licenseUrl});}return{rows,count:rows.length,cases:Object.fromEntries(Object.entries(d.cases).map(([id,c])=>[id,c.faces.length]))};}""")
 assert data['count']==175 and all(q['matched'] and q['attribution'] and q['license']=='https://portal.csdi.gov.hk/csdi-webpage/doc/TNC' for q in data['rows'])
 n=frames(page);render_calls=page.evaluate('semanticInspection.renderRequests');results=[]
 for case,pid in [('lowrise','p112'),('lowrise','p120'),('kcc','p002'),('warehouse','p024')]:
  rev=page.evaluate('semanticInspection.selectionRevision??0');page.locator('#evidencePanel').evaluate('(e)=>e.scrollTop=e.scrollHeight');page.evaluate('([c,p])=>semanticInspection.selectFace(c,p)',[case,pid]);page.wait_for_function('n=>semanticInspection.selectionRevision>n',arg=rev)
  q=page.evaluate("""async()=>{const s=semanticInspection,p=s.photoEvidence.photos[0],svg=document.querySelector('#photoGallery svg.official-texture-image'),im=svg.querySelector('image'),probe=new Image();probe.src=im.getAttribute('href');await probe.decode();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=svg.getBoundingClientRect(),panel=document.querySelector('#evidencePanel').getBoundingClientRect(),visibleWidth=Math.max(0,Math.min(b.right,panel.right,innerWidth)-Math.max(b.left,panel.left,0)),visibleHeight=Math.max(0,Math.min(b.bottom,panel.bottom,innerHeight)-Math.max(b.top,panel.top,0));return{evidenceOpen:document.querySelector('#sourceEvidence').open,imageBox:b.toJSON(),visibleWidth,visibleHeight,visible:svg.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),case:s.caseId,patch:s.selected.sourcePatchId,photoPatch:p.sourcePatchId,svgPatch:svg.dataset.sourcePatchId,photoCase:p.caseId,atlas:[probe.naturalWidth,probe.naturalHeight],expectedAtlas:p.atlasSize,polygons:svg.querySelectorAll('clipPath polygon').length,expectedPolygons:p.atlasUVTriangles.length,scrollTop:document.querySelector('#evidencePanel').scrollTop,repaint:s.selectionRepaint};}""")
  assert q['case']==q['photoCase']==case and q['patch']==q['photoPatch']==q['svgPatch']==pid and q['atlas']==q['expectedAtlas'] and q['polygons']==q['expectedPolygons'] and q['evidenceOpen'] and q['visible'] and q['visibleWidth']>32 and q['visibleHeight']>32 and q['repaint']['tracePasses']==0,q
  results.append(q);page.screenshot(path=str(out/('photo-'+case+'-'+pid+'.png')))
 assert frames(page)==n and page.evaluate('semanticInspection.renderRequests')==render_calls,'photo selection retraced geometry'
 r['checks'].append({'label':'175 exact face bindings and four actually visible decoded photo selections with zero geometry retrace','passed':True,'mapping':data,'selections':results});save()

def click_source(page,q):
 before=frames(page);calls=page.evaluate('semanticInspection.renderRequests')
 for case,pick in q['picks'].items():
  rect=page.locator('#view').bounding_box();f=q['stats'];rev=page.evaluate('semanticInspection.selectionRevision??0');page.mouse.click(rect['x']+(pick['x']+.5)/f['width']*rect['width'],rect['y']+(f['height']-pick['y']-.5)/f['height']*rect['height']);page.wait_for_function('n=>semanticInspection.selectionRevision>n',arg=rev)
  got=page.evaluate('semanticInspection.selected');assert all(got.get(k)==pick['record'].get(k) for k in ['objectId','id','caseId','buildingId','sourcePatchId','localObjectId','localId','localOwnerId']),('wrong hit identity',case,got,pick)
 assert frames(page)==before and page.evaluate('semanticInspection.renderRequests')==calls,'canvas selection retraced geometry'
 r['checks'].append({'label':'All three actual canvas picks retain original building/facade/object IDs without geometry retrace','passed':True});save()

def drag_check(page):
 action(page,lambda:page.evaluate('semanticInspection.showComplete()'));warm=page.evaluate('semanticInspection.lastStats.wallMs');duration=max(8,min(30,warm*2.7/1000));page.evaluate("""()=>{const s=semanticInspection;window.__drag={before:s.presentedFrames,events:0,samples:[],renderCalls:[]};const old=s.renderer.render.bind(s.renderer);s.renderer.render=async opts=>{const item={width:opts.width,height:opts.height,start:performance.now()};__drag.renderCalls.push(item);const result=await old(opts);Object.assign(item,{end:performance.now(),cancelled:result.cancelled});return result};window.__dragListener=()=>__drag.events++;window.addEventListener('pointermove',__dragListener);window.__dragTimer=setInterval(()=>__drag.samples.push({t:performance.now(),frames:s.presentedFrames,width:s.renderer.canvas.width,height:s.renderer.canvas.height,busy:s.busy,camera:s.presentedCamera}),50);}""")
 b=page.locator('#view').bounding_box();x=b['x']+b['width']*.5;y=b['y']+b['height']*.5;page.mouse.move(x,y);page.mouse.down();start=time.monotonic();i=0
 while time.monotonic()-start<duration:
  page.mouse.move(x+45*math.sin(i*.12),y+20*math.sin(i*.17));page.wait_for_timeout(50);i+=1
 during=page.evaluate('({frames:semanticInspection.presentedFrames,camera:semanticInspection.renderer.options,events:__drag.events})');released=time.monotonic();page.mouse.up();stable(page);settle=(time.monotonic()-released)*1000
 result=page.evaluate("""()=>{clearInterval(__dragTimer);window.removeEventListener('pointermove',__dragListener);const s=semanticInspection;return{...__drag,after:s.presentedFrames,desired:s.renderer.options,presented:s.presentedCamera,lastStats:s.lastStats,coalescedRequests:s.coalescedRequests,errors:s.errors};}""");result.update(durationSeconds=time.monotonic()-start,commandedMoves=i,during=during,settleAfterReleaseMs=settle)
 assert result['events']>=10 and during['frames']>result['before'],'continuous input starved presentation'
 for key in ['eye','target','fov']:assert result['desired'][key]==result['presented'][key],('last pose not displayed',key,result)
 sizes={(x['width'],x['height']) for x in result['renderCalls']};assert len(sizes)==1 and sizes=={(result['lastStats']['width'],result['lastStats']['height'])},('resolution changed during movement',sizes)
 assert all(not q.get('cancelled') for q in result['renderCalls']),'input cancelled coherent frames'
 assert not result['errors'];r['checks'].append({'label':'Continuous drag presents coherent full-native frames and settles on latest pose without starvation','passed':True,'result':result});save();page.screenshot(path=str(out/'candidate-drag-final.png'));print('DRAG',duration,'s, frames',during['frames']-result['before'],'settle',round(settle),flush=True)
def capture_native(page,label):return capture(page,'candidate',label)
def exact_pair(page,label):
 original=page.evaluate("({primitive:semanticInspection.renderer.options.primitiveTileIndex??true,aperture:semanticInspection.renderer.options.apertureTileIndex??true})")
 action(page,lambda:page.evaluate("async()=>{const s=semanticInspection;Object.assign(s.renderer.options,{primitiveTileIndex:false,apertureTileIndex:false});await s.render();}"))
 a=page.evaluate(CAPTURE)
 action(page,lambda:page.evaluate("async()=>{const s=semanticInspection;Object.assign(s.renderer.options,{primitiveTileIndex:true,apertureTileIndex:true});await s.render();}"))
 b=page.evaluate(CAPTURE);feature={'primitive':b['stats']['primaryTileIndex'],'aperture':b['stats']['primaryApertureIndex']}
 q={'label':label,'scope':'Frozen original R06A shader; conservative primary indices on/off, not withdrawn D2 neighbor optimization','sameCamera':a['camera']==b['camera'],'sameResolution':a['canvas']['width']==b['canvas']['width'] and a['canvas']['height']==b['canvas']['height'],'sameRGBA':a['rgbaHash']==b['rgbaHash'],'sameAllFloatFields':a['fieldHashes']==b['fieldHashes'],'beforeMs':a['stats']['wallMs'],'afterMs':b['stats']['wallMs'],'feature':feature}
 r['checks'].append(q);save();assert all(q[k] for k in ['sameCamera','sameResolution','sameRGBA','sameAllFloatFields']),q
 assert not a['stats']['primaryTileIndex']['enabled'] and not a['stats']['primaryApertureIndex']['enabled'],q
 assert feature['primitive']['enabled'] and feature['aperture']['enabled'],q
 page.evaluate("o=>Object.assign(semanticInspection.renderer.options,{primitiveTileIndex:o.primitive,apertureTileIndex:o.aperture})",original)
 return q

def diagnostics_check(page,requests):
 def snapshot():return page.evaluate("""()=>{const s=semanticInspection,c=s.renderer.canvas,b=c.getBoundingClientRect();return{frames:s.presentedFrames,renderRequests:s.renderRequests,camera:s.renderer.options,revision:s.renderer.requestRevision,css:[b.width,b.height],backing:[c.width,c.height]};}""")
 before=snapshot();n=len(requests)
 page.locator('#localRenderDiagnostics summary').click();page.locator('#localRenderDiagnostics button').click();page.wait_for_timeout(100)
 value=page.evaluate('semanticInspection.localDiagnostics.getSnapshot()');after=snapshot()
 assert before==after and len(requests)==n,('diagnostics altered renderer or made a request',before,after,requests[n:])
 assert value['display']['canvasWidth']==before['backing'][0] and value['frame']['available'] and value['backend']['contextAvailable'],value
 assert page.locator('#localRenderDiagnostics pre').inner_text().strip()
 r['checks'].append({'label':'Local diagnostic open/refresh changes no frame, camera, dimensions or request count','passed':True,'snapshot':value});save()
 page.locator('#localRenderDiagnostics summary').click()

def window_proposals_check(page):
 rows=[]
 action(page,lambda:page.evaluate("semanticInspection.setView('whole')"))
 for key in ['N-U01','N-U02','N-U03']:
  target=page.evaluate("""async key=>{const s=semanticInspection,g=s.renderer,a=s.model.hostedComponents.apertures.find(a=>a.caseId==='lowrise'&&a.bindingKey===key),part=a?.primitives.find(p=>p.part==='glass'),q=s.registry.find(r=>r.objectId===part?.objectId);if(!q)throw Error('Missing physical proposed window '+key);const b=q.bounds,c=b.min.map((v,k)=>(v+b.max[k])/2),d=Math.max(1.6,...b.max.map((v,k)=>v-b.min[k])),n=q.focusNormal??a.host.normal;if(!n)throw Error('Window outward normal unavailable');const eye=c.map((v,k)=>v+n[k]*d*1.8+(k===1?d*.12:0));s.cameraFraming='manual';s.fit=null;Object.assign(g.options,{eye,target:c,cut:false,sliceY:null,selectedId:-1});await s.render();return{binding:key,objectId:q.objectId,sourcePatchId:a.host.sourcePatchId,caseId:q.caseId,bounds:q.bounds};}""",key)
  stable(page);q=capture_native(page,'north-window-'+key);pixels=q['hitObjectPixels'].get(str(target['objectId']),0);assert pixels>0,('new window not actually visible',target)
  assert target['sourcePatchId']=='p120' and target['caseId']=='lowrise',target
  rows.append({**target,'hitPixels':pixels,'wallMs':q['stats']['wallMs']})
  if key=='N-U01':exact_pair(page,'north-window-N-U01')
 r['checks'].append({'label':'Three separately owned north-window design proposals have actual glass hit coverage; not presented as verified actual opening dimensions','passed':True,'windows':rows});save()

with sync_playwright() as pw:
 browser=None;page=None
 try:
  for variant,v in cfg['variants'].items():
   for rel,spec in v['files'].items():assert hashlib.sha256((root/spec['file']).read_bytes()).hexdigest()==spec['sha256'],('frozen closure changed',variant,rel)
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);r['browserVersion']=browser.version
  r['layoutMatrix']=runpy.run_path(str(root/'layout-qa.py'))['run_layout_matrix'](browser,root/'layout-baseline',root/'perf-candidate',r,out);save();assert r['layoutMatrix']['passed'],'R07 DOM layout gate failed'
  context=browser.new_context(viewport={'width':1920,'height':1080},device_scale_factor=1);route_site(context,'candidate');page=context.new_page();page.set_default_timeout(300000);page.add_init_script("window.addEventListener('error',e=>window.__qaError=e.message);window.addEventListener('unhandledrejection',e=>window.__qaError=String(e.reason));")
  errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda req:requests.append(req.url));page.goto(url,wait_until='domcontentloaded');stable(page)
  action(page,lambda:page.evaluate('semanticInspection.render()'));whole=capture(page,'candidate','warm-whole',whole=True);layout_live(page,'1920x1080-dpr1');click_source(page,whole);photo_checks(page);diagnostics_check(page,requests)
  for view in ['source','cut','design']:
   action(page,lambda view=view:page.evaluate('v=>semanticInspection.setView(v)',view));capture_native(page,'mode-'+view)
   if view!='source':exact_pair(page,'mode-'+view)
  window_proposals_check(page)
  action(page,lambda:page.evaluate('semanticInspection.showComplete()'));capture(page,'candidate','restored-large-whole',whole=True);drag_check(page);assert not errors,errors
  r['largeDesktopStage']={'passed':True,'viewport':{'width':1920,'height':1080,'dpr':1},'scope':'Native output, all three buildings, 175 photo bindings, three north-window proposals and continuous-drag latency. No viewport change during movement.'};save();context.close()
  # A separate fixed native desktop context, not a movement-time quality reduction.
  # Functional frame timings here must never be compared with the larger viewport.
  context=browser.new_context(viewport={'width':1366,'height':768},device_scale_factor=1);route_site(context,'candidate');page=context.new_page();page.set_default_timeout(300000);page.add_init_script("window.addEventListener('error',e=>window.__qaError=e.message);window.addEventListener('unhandledrejection',e=>window.__qaError=String(e.reason));")
  page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url,wait_until='domcontentloaded');stable(page);capture_native(page,'functional-native-start');layout_live(page,'1366x768-dpr1-functional')
  r['floor']=runpy.run_path(str(root/'floor-integration-qa.py'))['run_floor_qa'](page,out,stable,capture_native,exact_pair);save()
  r['lift']=runpy.run_path(str(root/'lift-integration-qa.py'))['run_lift_integration_qa'](page,out);save()
  action(page,lambda:page.evaluate('semanticInspection.showComplete()'));capture(page,'candidate','functional-restored-whole',whole=True);assert not errors,errors
  r['functionalDesktopStage']={'passed':True,'viewport':{'width':1366,'height':768,'dpr':1},'scope':'Full floor, room-door, stair and elevator state/route tests at this fixed desktop native size only.'};save();context.close()
  context=browser.new_context(viewport={'width':1366,'height':768},device_scale_factor=1.25);route_site(context,'candidate');page=context.new_page();page.set_default_timeout(300000);page.goto(url,wait_until='domcontentloaded');stable(page);capture(page,'candidate','native-high-dpr',whole=True);layout_live(page,'1366x768-dpr1.25');context.close()
  r['highDprStage']={'passed':True,'viewport':{'width':1366,'height':768,'dpr':1.25},'scope':'Separate fixed native high-DPR desktop context; not a physical-device or browser UI zoom test.'};save()
  r['passed']=True
 except Exception:
  r['errors'].append(traceback.format_exc())
  if page:
   try:page.screenshot(path=str(out/'r07-failure.png'),timeout=10000)
   except Exception:pass
 finally:
  r['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save()
  if browser:browser.close()
if not r['passed']:print(json.dumps({'errors':r['errors'],'completedFrames':list(r['variants']['candidate']['frames'])},ensure_ascii=False));raise SystemExit(1)
print('R07 native end-to-end correctness gates passed. Actual latency is recorded, not a smoothness claim.',flush=True)
