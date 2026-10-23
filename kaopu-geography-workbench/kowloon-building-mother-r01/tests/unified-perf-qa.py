#!/usr/bin/env python3
"""Frozen R06A versus R06B scissor experiment; real Chromium SwiftShader, not hardware FPS."""
import argparse,hashlib,json,math,mimetypes,time,traceback
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
cfg=json.loads((root/'unified-perf-config.json').read_text())
pa=argparse.ArgumentParser();pa.add_argument('--output',default='public-inspection-evidence');args,_=pa.parse_known_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
url=cfg['targetUrl'].rstrip('/')+'/'
r={'passed':False,'scope':'Actual Chromium/SwiftShader software-GPU A/B, frozen R06A vs isolated R06B scissor experiment; no physical-device or hardware-FPS claim. Same final CSS ensures equal native dimensions. Diagnostic omitted subsets are private cost probes, never candidate output.','baselineProductionCommit':cfg['baselineProductionCommit'],'baselineDescription':cfg.get('baselineDescription'),'variants':{},'comparisons':[],'checks':[],'errors':[],'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
def save():(out/'unified-perf-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def stable(page,n=-1):
 page.wait_for_function("""n=>{const s=window.semanticInspection;if(window.__qaError)throw Error(window.__qaError);if(s?.errors?.length)throw Error(String(s.errors));const ok=s?.ready&&s.phase==='ready'&&!s.busy&&!s.renderer.busy&&s.frames.length>n;if(!ok){window.__qaStable=null;return false}const b=s.renderer.canvas.getBoundingClientRect(),key=JSON.stringify([s.presentedFrames,b.width,b.height,devicePixelRatio]);if(window.__qaStable?.key!==key){window.__qaStable={key,t:performance.now()};return false}return performance.now()-window.__qaStable.t>150}""",arg=n,timeout=180000)
def frames(page):return page.evaluate('semanticInspection.frames.length')
def action(page,fn):
 n=frames(page);fn();stable(page,n)
def handler(body,typ):
 def fulfill(route,request):route.fulfill(status=200,body=body,content_type=typ)
 return fulfill
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
 assert q['canvasCount']==1 and len(q['buildings'])==3 and q['sourceCount']==225 and q['registryCount']==q['uniqueIds']==1292,('scene loss',variant,label)
 assert q['modelTriangles']==q['modelVertexBuffers']==q['bad']==q['glError']==0,(variant,label,'invalid hit/GL/mesh')
 assert q['coveredPixels']==f['width']*f['height'] and f['tilesCompleted']==f['tilesSubmitted']==f['tilesPlanned'],('incomplete field',label)
 assert b['width']==f['width'] and b['height']==f['height'] and abs(b['width']-rect['width']*vp['dpr'])<=2 and abs(b['height']-rect['height']*vp['dpr'])<=2,('non-native output',label)
 assert q['display']['native'] and q['imageRendering']!='pixelated',('quality changed',label)
 if whole:
  assert len(q['counts'])==len(q['picks'])==3 and not q['camera']['cut'] and q['camera']['sliceY'] is None,('all three not visible',label,q['counts'])
  p=q['projected'];assert p['minDepth']>0 and max(abs(p[k]) for k in ['minX','maxX','minY','maxY'])<.98,('whole bounds clipped',label,p)
 if shot:page.screenshot(path=str(out/(variant+'-'+label+'.png')))
 if variant=='candidate' and label in r['variants'].get('baseline',{}).get('frames',{}):
  old=r['variants']['baseline']['frames'][label];assert old['camera']==q['camera'] and old['rgbaHash']==q['rgbaHash'] and old['fieldHashes']==q['fieldHashes'] and (old['stats']['width'],old['stats']['height'])==(f['width'],f['height']),('immediate exact-output gate failure',label)
 print('FRAME',variant,label,b['width'],b['height'],round(f['wallMs']),q['counts'],flush=True);return q

def layout_live(page,label):
 q=page.evaluate("""()=>{const box=id=>document.querySelector(id).getBoundingClientRect().toJSON();return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},doc:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},canvas:box('#view'),panel:box('#evidencePanel'),toolbar:box('.scene-toolbar'),buttons:['#fitView','#focusBuilding','#fullscreen'].map(box),status:box('#status'),display:semanticInspection.display};}""")
 vp=q['viewport'];assert q['doc']['width']<=vp['width']+1 and q['doc']['height']<=vp['height']+2,('live document overflow',label,q)
 for k in ['canvas','panel','status']:
  b=q[k];assert b['left']>=-1 and b['right']<=vp['width']+1 and b['top']>=-1 and b['bottom']<=vp['height']+1,('live control offscreen',label,k,b,vp)
 for b in q['buttons']:assert b['left']>=0 and b['right']<=vp['width']+1 and b['top']>=0 and b['bottom']<=vp['height']+1,('live toolbar clipped',label,b)
 r['checks'].append({'label':'Actual native runtime layout '+label,'passed':True,'measurements':q});save();return q

NEAR="""async key=>{const s=semanticInspection,g=s.renderer;const mode=key==='stair'&&window.__qaKeyGate?'design':'whole';if(s.view!==mode)await s.setView(mode);const q=s.registry.find(q=>q.caseId==='lowrise'&&q.classKey===key&&q.bounds&&(key!=='window'||q.part==='glass'));if(!q)throw Error('Missing '+key);const b=q.bounds,c=b.min.map((v,k)=>(v+b.max[k])/2),d=Math.max(1.6,...b.max.map((v,k)=>v-b.min[k])),n=q.focusNormal,eye=n?c.map((v,k)=>v+n[k]*d*1.8+(k===1?d*.12:0)):[c[0]+d*.85,c[1]+d*.55,c[2]-d*1.05];s.cameraFraming='manual';s.fit=null;Object.assign(g.options,{eye,target:c,cut:false,sliceY:null,selectedId:-1});await s.render();return{objectId:q.objectId,id:q.id,bounds:q.bounds};}"""

def photo_checks(page):
 data=page.evaluate("""async()=>{const {OFFICIAL_FACE_TEXTURES:d}=await import('./official-face-textures.mjs'),{resolvePhotoEvidence}=await import('./photo-evidence.mjs');const rows=[];for(const [id,c] of Object.entries(d.cases))for(const p of c.faces){const e=resolvePhotoEvidence(id,{sourcePatchId:p.sourcePatchId});rows.push({caseId:id,patch:p.sourcePatchId,matched:e.photos.some(q=>q.id===p.id&&q.caseId===id&&q.sourcePatchId===p.sourcePatchId),attribution:!!p.attribution,license:p.licenseUrl});}return{rows,count:rows.length,cases:Object.fromEntries(Object.entries(d.cases).map(([id,c])=>[id,c.faces.length]))};}""")
 assert data['count']==175 and all(q['matched'] and q['attribution'] and q['license']=='https://portal.csdi.gov.hk/csdi-webpage/doc/TNC' for q in data['rows'])
 n=frames(page);render_calls=page.evaluate('semanticInspection.renderRequests');results=[]
 for case,pid in [('lowrise','p112'),('lowrise','p120'),('kcc','p002'),('warehouse','p024')]:
  rev=page.evaluate('semanticInspection.selectionRevision??0');page.locator('#evidencePanel').evaluate('(e)=>e.scrollTop=e.scrollHeight');page.evaluate('([c,p])=>semanticInspection.selectFace(c,p)',[case,pid]);page.wait_for_function('n=>semanticInspection.selectionRevision>n',arg=rev)
  q=page.evaluate("""async()=>{const s=semanticInspection,p=s.photoEvidence.photos[0],svg=document.querySelector('#photoGallery svg.official-texture-image'),im=svg.querySelector('image'),probe=new Image();probe.src=im.getAttribute('href');await probe.decode();return{case:s.caseId,patch:s.selected.sourcePatchId,photoPatch:p.sourcePatchId,svgPatch:svg.dataset.sourcePatchId,photoCase:p.caseId,atlas:[probe.naturalWidth,probe.naturalHeight],expectedAtlas:p.atlasSize,polygons:svg.querySelectorAll('clipPath polygon').length,expectedPolygons:p.atlasUVTriangles.length,scrollTop:document.querySelector('#evidencePanel').scrollTop,repaint:s.selectionRepaint};}""")
  assert q['case']==q['photoCase']==case and q['patch']==q['photoPatch']==q['svgPatch']==pid and q['atlas']==q['expectedAtlas'] and q['polygons']==q['expectedPolygons'] and q['scrollTop']<2 and q['repaint']['tracePasses']==0,q
  results.append(q)
 assert frames(page)==n and page.evaluate('semanticInspection.renderRequests')==render_calls,'photo selection retraced geometry'
 r['checks'].append({'label':'175 exact face bindings and four live decoded photo selections with zero geometry retrace','passed':True,'mapping':data,'selections':results});save()

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

def diagnostic_subsets(page):
 """Private cost isolation only. Subset images are NOT candidate render output."""
 rows=[]
 for pose in ['whole','near-window']:
  if pose=='whole':action(page,lambda:page.evaluate('semanticInspection.showComplete()'))
  else:page.evaluate(NEAR,'window');stable(page)
  reference=page.evaluate(CAPTURE)
  for part,field in [('rails','railGroups'),('apertures','apertures'),('assemblies','archetypes')]:
   result=page.evaluate("""async field=>{const s=semanticInspection,g=s.renderer,original=g[field];try{g[field]=[];await s.render();return{stats:s.lastStats,omitted:field,diagnosticOnly:true};}finally{g[field]=original;}}""",field);stable(page);rows.append({'pose':pose,'without':part,**result});print('PRIVATE_COST_PROBE',pose,part,round(result['stats']['wallMs']),flush=True)
  action(page,lambda:page.evaluate('semanticInspection.render()'));restored=page.evaluate(CAPTURE);assert reference['rgbaHash']==restored['rgbaHash'] and reference['fieldHashes']==restored['fieldHashes'],('diagnostic restore changed output',pose)
 r['diagnosticSubsets']={'scope':'Private cost isolation with exact restoration. Omitted components are NEVER candidate/public output and not a quality tradeoff.','rows':rows};save()

with sync_playwright() as pw:
 browser=None;page=None
 try:
  for variant,v in cfg['variants'].items():
   for rel,spec in v['files'].items():assert hashlib.sha256((root/spec['file']).read_bytes()).hexdigest()==spec['sha256'],('frozen closure changed',variant,rel)
  r['frozenClosure']={v:len(s['files']) for v,s in cfg['variants'].items()};save()
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);r['browserVersion']=browser.version
  layout_script=root/'layout-qa.py'
  if layout_script.exists() and not cfg.get('keyGate'):
   import runpy
   r['layoutMatrix']=runpy.run_path(str(layout_script))['run_layout_matrix'](browser,root/'perf-baseline',root/'perf-candidate',r,out);save();assert r['layoutMatrix']['passed'],'DOM layout matrix failed'
  for variant in ['baseline','candidate']:
   context=browser.new_context(viewport={'width':1920,'height':1080},device_scale_factor=1);route_site(context,variant);page=context.new_page();page.set_default_timeout(180000);page.add_init_script("window.addEventListener('error',e=>window.__qaError=e.message);window.addEventListener('unhandledrejection',e=>window.__qaError=String(e.reason));")
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)));r['variants'][variant]={'frames':{},'pageErrors':errors};start=time.monotonic();page.goto(url,wait_until='domcontentloaded');stable(page);r['variants'][variant]['initialPageToCompleteMs']=(time.monotonic()-start)*1000
   if not cfg.get('keyGate'):capture(page,variant,'first-context-whole',whole=True,shot=False)
   action(page,lambda:page.evaluate('semanticInspection.render()'));whole=capture(page,variant,'warm-whole',whole=True)
   for view in ([] if cfg.get('keyGate') else ['cut','design','source']):
    action(page,lambda view=view:page.evaluate('v=>semanticInspection.setView(v)',view));capture(page,variant,view,whole=view=='source')
   page.evaluate('v=>window.__qaKeyGate=v',bool(cfg.get('keyGate')))
   for key in ['stair','window']:
    target=page.evaluate(NEAR,key);stable(page);label='near-stair-interior' if key=='stair' and cfg.get('keyGate') else 'near-'+key;q=capture(page,variant,label);q['focusRecord']=target;save()
    if key=='stair' and not cfg.get('keyGate'):
     action(page,lambda:page.evaluate("semanticInspection.setView('design')"));q=capture(page,variant,'near-stair-interior');q['focusRecord']=target;q['targetHitPixels']=q['hitObjectPixels'].get(str(target['objectId']),0);save();assert q['targetHitPixels']>0,('stair fixture never actually visible',variant,target,q['hitObjectPixels'])
    else:
     q['targetHitPixels']=q['hitObjectPixels'].get(str(target['objectId']),0);save();assert q['targetHitPixels']>0,('focused fixture never actually visible',variant,key,target,q['hitObjectPixels'])
   if variant=='candidate' and not cfg.get('keyGate'):
    action(page,lambda:page.evaluate('semanticInspection.showComplete()'));q=capture(page,variant,'restored-whole',whole=True);layout_live(page,'1920x1080-dpr1');click_source(page,q);photo_checks(page);drag_check(page)
   if variant=='candidate' and cfg.get('diagnosticSubsets'):diagnostic_subsets(page)
   assert not errors;context.close()
  a=r['variants']['baseline'];b=r['variants']['candidate']
  for label,x in a['frames'].items():
   y=b['frames'][label];cmp={'label':label,'sameCamera':x['camera']==y['camera'],'sameResolution':(x['stats']['width'],x['stats']['height'])==(y['stats']['width'],y['stats']['height']),'sameRGBA':x['rgbaHash']==y['rgbaHash'],'sameFullFloatHitNormalLocal':x['fieldHashes']==y['fieldHashes'],'beforeMs':x['stats']['wallMs'],'afterMs':y['stats']['wallMs'],'speedup':x['stats']['wallMs']/y['stats']['wallMs']};r['comparisons'].append(cmp);save();assert all(cmp[k] for k in ['sameCamera','sameResolution','sameRGBA','sameFullFloatHitNormalLocal']),('A/B changed authoritative result',cmp)
  assert b['frames']['warm-whole']['stats']['primaryTileIndex']['enabled'],'candidate index inactive'
  assert bool(a['frames']['warm-whole']['stats']['primaryTileIndex']['enabled'])==bool(cfg.get('expectedBaselineIndex',False)),'baseline index mode differs from frozen intended variant'
  r['performanceSummary']={'wholeWarmReductionFraction':1-b['frames']['warm-whole']['stats']['wallMs']/a['frames']['warm-whole']['stats']['wallMs'],'interpretation':'Measured latency only, not a user acceptance threshold or physical GPU FPS. Parent reviews whether this is a useful gain.'};save()
  if not cfg.get('keyGate'):
   context=browser.new_context(viewport={'width':1366,'height':768},device_scale_factor=1.25);route_site(context,'candidate');page=context.new_page();page.set_default_timeout(180000);page.goto(url,wait_until='domcontentloaded');stable(page);r['variants']['candidate-high-dpr']={'frames':{}};capture(page,'candidate-high-dpr','native-whole',whole=True);layout_live(page,'1366x768-dpr1.25');context.close()
  r['passed']=True
 except Exception:
  r['errors'].append(traceback.format_exc())
  if page:
   try:page.screenshot(path=str(out/'failure.png'))
   except Exception:pass
 finally:
  r['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save()
  if browser:browser.close()
if not r['passed']:print(json.dumps(r,ensure_ascii=False));raise SystemExit(1)
print('R06 key exact-output gate passed; performance remains measured, not accepted.' if cfg.get('keyGate') else 'R06 complete exact-output, native interaction, identity/photo and layout gates passed.',flush=True)
