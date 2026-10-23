#!/usr/bin/env python3
"""Independent frozen A/C/D1/D2 exact native-output experiments in one existing CI installation."""
import argparse,hashlib,json,mimetypes,time,traceback
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
cfg=json.loads((root/'unified-perf-config.json').read_text())
pa=argparse.ArgumentParser();pa.add_argument('--output',default='public-inspection-evidence');args,_=pa.parse_known_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
url=cfg['targetUrl'].rstrip('/')+'/'
r={'passed':False,'scope':'Actual Chromium/SwiftShader software GPU. Frozen R06A versus isolated C batching and D aperture-neighbor modes. Identical native resolution, full geometry, final shading and CSS. No physical-device FPS or acceptance claim. Warm measurements only; shared browser driver caches prevent independent cold comparison.','baselineDescription':cfg['baselineDescription'],'variants':{},'comparisons':[],'errors':[],'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
def save():(out/'unified-perf-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def stable(page,n=-1):
 page.wait_for_function("""n=>{const s=window.semanticInspection;if(window.__qaError)throw Error(window.__qaError);if(s?.errors?.length)throw Error(String(s.errors));const ok=s?.ready&&s.phase==='ready'&&!s.busy&&!s.renderer.busy&&s.frames.length>n;if(!ok){window.__qaStable=null;return false}const b=s.renderer.canvas.getBoundingClientRect(),key=JSON.stringify([s.presentedFrames,b.width,b.height,devicePixelRatio]);if(window.__qaStable?.key!==key){window.__qaStable={key,t:performance.now()};return false}return performance.now()-window.__qaStable.t>150}""",arg=n,timeout=180000)

def frames(page):return page.evaluate('semanticInspection.frames.length')

def action(page,fn):
 n=frames(page);fn();stable(page,n)

def route_site(context,variant,common_css=True):
 files=cfg['variants'][variant]['files'];data={rel:(root/spec['file']).read_bytes() for rel,spec in files.items()}
 if common_css:data['semantic-style.css']=(root/cfg['variants']['baseline']['files']['semantic-style.css']['file']).read_bytes()
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
 print('FRAME',variant,label,b['width'],b['height'],round(f['wallMs']),q['counts'],flush=True);return q
NEAR="""async key=>{const s=semanticInspection,g=s.renderer;if(s.view!=='whole')await s.setView('whole');const q=s.registry.find(q=>q.caseId==='lowrise'&&q.classKey===key&&q.bounds&&(key!=='window'||q.part==='glass'));if(!q)throw Error('Missing '+key);const b=q.bounds,c=b.min.map((v,k)=>(v+b.max[k])/2),d=Math.max(1.6,...b.max.map((v,k)=>v-b.min[k])),n=q.focusNormal,eye=key==='stair'?[c[0]-2,c[1]+1.5,c[2]-1]:(n?c.map((v,k)=>v+n[k]*d*1.8+(k===1?d*.12:0)):[c[0]+d*.85,c[1]+d*.55,c[2]-d*1.05]);s.cameraFraming='manual';s.fit=null;Object.assign(g.options,{eye,target:c,cut:false,sliceY:null,selectedId:-1});await s.render();return{objectId:q.objectId,id:q.id,bounds:q.bounds};}"""
def assert_feature(variant,q):
 f=q['stats'];spec=cfg['variants'][variant];feature=spec['feature'];assert f['primaryTileIndex']['enabled'],('primary index disabled',variant)
 if feature=='assemblyBatching':
  b=f['assemblyBatching'];assert b['enabled'] is True and b['fallback'] is None and b['actualDraws']>0,('C new shader not active',variant,b)
 elif feature=='apertureNeighbors':
  b=f['apertureNeighbors'];assert b['aabbFirst'] is True and b['indexEnabled']==spec['options']['apertureNeighborIndex'] and b['records']>0 and b['token']>0,('D intended path not active',variant,b)
  if b['indexEnabled']:assert (b['fullPairs'],b['retainedPairs'],b['records'])==(1892,152,285),('D2 neighbor table differs from frozen expected scene',b)
 elif feature!='baseline':raise AssertionError(('unknown feature',feature))

def compare(variant,label,q):
 if variant=='baseline':return
 x=r['variants']['baseline']['frames'][label]
 cmp={'variant':variant,'label':label,'sameCamera':x['camera']==q['camera'],'sameResolution':(x['stats']['width'],x['stats']['height'])==(q['stats']['width'],q['stats']['height']),'sameRGBA':x['rgbaHash']==q['rgbaHash'],'sameFullFloatHitNormalLocal':x['fieldHashes']==q['fieldHashes'],'beforeMs':x['stats']['wallMs'],'afterMs':q['stats']['wallMs'],'speedup':x['stats']['wallMs']/q['stats']['wallMs']}
 r['comparisons'].append(cmp);save();assert all(cmp[k] for k in ['sameCamera','sameResolution','sameRGBA','sameFullFloatHitNormalLocal']),('exact output mismatch',cmp)

def run_variant(browser,variant):
 context=None;page=None;errors=[]
 entry=r['variants'][variant]={'passed':False,'frames':{},'pageErrors':errors,'errors':[],'options':cfg['variants'][variant]['options']};save()
 try:
  context=browser.new_context(viewport={'width':1920,'height':1080},device_scale_factor=1);route_site(context,variant);page=context.new_page();page.set_default_timeout(180000);page.add_init_script("window.addEventListener('error',e=>window.__qaError=e.message);window.addEventListener('unhandledrejection',e=>window.__qaError=String(e.reason));")
  page.on('pageerror',lambda e:errors.append(str(e)));start=time.monotonic();page.goto(url,wait_until='domcontentloaded');stable(page);entry['initialPageToCompleteMs']=(time.monotonic()-start)*1000
  page.evaluate('opts=>Object.assign(semanticInspection.renderer.options,opts)',entry['options'])
  action(page,lambda:page.evaluate('semanticInspection.render()'));q=capture(page,variant,'warm-whole',whole=True);assert_feature(variant,q);compare(variant,'warm-whole',q)
  for key in ['stair','window']:
   target=page.evaluate(NEAR,key);stable(page);label='near-'+key;q=capture(page,variant,label);q['focusRecord']=target;q['targetHitPixels']=q['hitObjectPixels'].get(str(target['objectId']),0);save()
   assert q['targetHitPixels']>0,('target not actually visible',variant,key,target,q['hitObjectPixels']);assert_feature(variant,q);compare(variant,label,q)
  assert not errors;entry['passed']=True
 except Exception:
  entry['errors'].append(traceback.format_exc());print('VARIANT_FAILED',variant,entry['errors'][-1],flush=True)
  if page:
   try:page.screenshot(path=str(out/(variant+'-failure.png')),timeout=10000)
   except Exception:pass
 finally:
  save()
  if context:context.close()
 return entry['passed']

with sync_playwright() as pw:
 browser=None
 try:
  for variant,v in cfg['variants'].items():
   for rel,spec in v['files'].items():assert hashlib.sha256((root/spec['file']).read_bytes()).hexdigest()==spec['sha256'],('frozen closure changed',variant,rel)
  r['frozenClosure']={v:len(s['files']) for v,s in cfg['variants'].items()};save()
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);r['browserVersion']=browser.version
  assert run_variant(browser,'baseline'),'Reference A failed; candidate comparisons cannot be established'
  for variant in cfg['variants']:
   if variant!='baseline':run_variant(browser,variant)
  r['passed']=all(x['passed'] for x in r['variants'].values()) and len(r['variants'])==len(cfg['variants'])
 except Exception:r['errors'].append(traceback.format_exc())
 finally:
  r['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save()
  if browser:browser.close()
if not r['passed']:print(json.dumps(r,ensure_ascii=False));raise SystemExit(1)
print('Three-pose exact-output gates passed for each isolated candidate; measured latency is not acceptance.',flush=True)
