#!/usr/bin/env python3
"""Exact-byte R04 native desktop framebuffer, full-frame camera and picking gate."""
import argparse, hashlib, json, mimetypes, time, traceback
from urllib.parse import urlsplit
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
cfg=json.loads((root/'semantic-desktop-config.json').read_text())
pa=argparse.ArgumentParser();pa.add_argument('--output',default='public-inspection-evidence');args,_=pa.parse_known_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True);url=cfg['targetUrl'].rstrip('/')+'/'
r={'passed':False,'candidateRouting':bool(cfg.get('overrides')),'url':url,'scope':'Actual Chromium SwiftShader native desktop framebuffer, whole-frame bounds and exact-ID picking. Not a physical-device performance claim.','startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'files':{},'checks':[],'frames':{},'screenshots':[],'pageErrors':[],'failedRequests':[]}
def save():(out/'desktop-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def handler(body,typ):
 def fulfill(route,request):route.fulfill(status=200,body=body,content_type=typ)
 return fulfill
def matcher(target):
 expected=urlsplit(target);paths={expected.path}
 if expected.path.endswith('/index.html'):paths.add(expected.path[:-10])
 def match(actual):
  actual=urlsplit(actual);return (actual.scheme,actual.netloc)==(expected.scheme,expected.netloc) and actual.path in paths
 return match
class Mock:
 def fulfill(self,**kw):self.kw=kw
for body in [b'candidate bytes',b'\x00test']:
 mock=Mock();handler(body,'text/plain')(mock,object());assert mock.kw['body'] is body
for target,accepted,rejected in [
 ('https://example.invalid/candidate/index.html',['https://example.invalid/candidate/','https://example.invalid/candidate/index.html','https://example.invalid/candidate/?v=1','https://example.invalid/candidate/index.html?v=1'],['https://example.invalid/other/','https://other.invalid/candidate/']),
 ('https://example.invalid/candidate/semantic-app.mjs',['https://example.invalid/candidate/semantic-app.mjs','https://example.invalid/candidate/semantic-app.mjs?v=1'],['https://example.invalid/candidate/other.mjs'])]:
 check=matcher(target)
 for value in accepted:assert check(value),('missed expected route',target,value)
 for value in rejected:assert not check(value),('overbroad route',target,value)
r['routeCallbackTwoArgumentsVerified']=True
r['routeDirectoryIndexModuleQueryMatchVerified']=True

def stable(case=None,n=-1):
 page.wait_for_function("""a=>{const s=window.semanticInspection;if(window.__qaPageError)throw Error(window.__qaPageError);if(s?.errors?.length)throw Error(String(s.errors));const ok=s?.ready&&s.phase==='ready'&&!s.busy&&!s.renderer.busy&&!document.querySelector('#case').disabled&&(!a.case||s.caseId===a.case)&&s.frames.length>a.n;if(!ok){window.__qaSettled=null;return false;}const box=s.renderer.canvas.getBoundingClientRect(),key=JSON.stringify([a,s.presentedFrames,s.presentedDisplay,box.width,box.height,devicePixelRatio]);if(window.__qaSettled?.key!==key){window.__qaSettled={key,since:performance.now()};return false;}return performance.now()-window.__qaSettled.since>=160;}""",arg={'case':case,'n':n},timeout=240000)

def frames():return page.evaluate('window.semanticInspection.frames.length')
def action(fn,case=None):
 n=frames();fn();stable(case,n)
def shot(name):
 page.screenshot(path=str(out/(name+'.png')),full_page=False);r['screenshots'].append(name+'.png');save()
CAPTURE='''()=>{const s=window.semanticInspection,g=s.renderer,f=s.lastStats,rect=g.canvas.getBoundingClientRect(),vp=document.querySelector('#viewport').getBoundingClientRect(),camera=s.presentedCamera??g.options;
 const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((q,v,k)=>q+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n)},forward=norm(sub(camera.target,camera.eye)),right=norm(cross(forward,Math.abs(forward[1])>.999?[0,0,1]:[0,1,0])),up=cross(right,forward),aspect=f.width/f.height,tan=Math.tan(camera.fov/2);
 const source=s.source.bounds,model=s.model.bounds,baseBounds={min:[0,1,2].map(k=>Math.min(source.min[k],model.min[k])),max:[0,1,2].map(k=>Math.max(source.max[k],model.max[k]))},bounds=s.getBounds(),projected=[];
 for(let i=0;i<8;i++){const p=bounds.min.map((v,k)=>i&(1<<k)?bounds.max[k]:v),d=sub(p,camera.eye),z=dot(d,forward);projected.push({p,z,x:dot(d,right)/(z*tan*aspect),y:dot(d,up)/(z*tan)});}
 const hits=[],counts={},ids={},picks={};let bad=0;for(let y=5;y<f.height-5;y+=Math.max(1,Math.floor(f.height/26)))for(let x=5;x<f.width-5;x+=Math.max(1,Math.floor(f.width/26))){const h=g.readHit(x,y);if(h.status>2.5)bad++;if(h.status>.5&&h.status<1.5){const q=s.registry.find(q=>q.objectId===h.objectId);if(!q)bad++;const k=q?.classKey??'MISSING';counts[k]=(counts[k]??0)+1;ids[h.objectId]=(ids[h.objectId]??0)+1;picks[k]??={x,y,id:h.objectId,stableId:q?.id,ownerId:q?.ownerId};}}
 const gl=g.gl;return{caseId:s.caseId,view:s.view,canvas:{width:g.canvas.width,height:g.canvas.height,cssWidth:rect.width,cssHeight:rect.height,x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom},viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,rect:vp.toJSON()},stats:f,display:s.display,fit:s.fit,camera,bounds,baseBounds,projected,counts,ids,picks,bad,selected:s.selected,gpu:g.gpu,glError:gl.getError(),maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),modelTriangles:g.stats.modelTriangles,modelVertexBuffers:g.stats.modelVertexBuffers,imageRendering:getComputedStyle(g.canvas).imageRendering,frames:s.frames.map(q=>({width:q.width,height:q.height}))};}'''
def capture(label,whole=False,native=True):
 q=page.evaluate(CAPTURE);r['frames'][label]=q;save();c=q['canvas'];f=q['stats'];assert c['width']==f['width'] and c['height']==f['height'],('backing/render mismatch',label)
 assert f['tilesCompleted']==f['tilesPlanned'] and f['tilesSubmitted']==f['tilesPlanned'],('incomplete GPU tile frame',label)
 assert abs(c['width']/c['height']-c['cssWidth']/c['cssHeight'])<.004,('aspect stretched',label,c)
 assert q['bad']==0 and q['glError']==0 and q['modelTriangles']==q['modelVertexBuffers']==0 and q['counts'],('invalid/empty scene',label,q['counts'])
 if native:
  assert abs(c['width']-c['cssWidth']*q['viewport']['dpr'])<=2 and abs(c['height']-c['cssHeight']*q['viewport']['dpr'])<=2,('not native pixels',label,c,q.get('display'))
 assert q['imageRendering']!='pixelated'
 if whole:
  assert all(q['bounds']['min'][k]<=q['baseBounds']['min'][k]+1e-6 and q['bounds']['max'][k]>=q['baseBounds']['max'][k]-1e-6 for k in range(3)),('bounds omit source/design',label)
  assert all(p['z']>0 and abs(p['x'])<.98 and abs(p['y'])<.98 for p in q['projected']),('whole AABB clipped',label,q['projected'])
  assert c['x']>=0 and c['y']>=0 and c['right']<=q['viewport']['width']+1 and c['bottom']<=q['viewport']['height']+1,('canvas outside screen',label,c)
 print('CAPTURE',label,c['width'],c['height'],round(f['wallMs']),flush=True);return q

def pick(q,key):
 hit=q['picks'][key];box=page.locator('#view').bounding_box();n=frames();page.mouse.click(box['x']+(hit['x']+.5)/q['stats']['width']*box['width'],box['y']+(q['stats']['height']-hit['y']-.5)/q['stats']['height']*box['height']);stable(n=n)
 got=page.evaluate('window.semanticInspection.selected');assert got['objectId']==hit['id'] and got['id']==hit['stableId'] and got['ownerId']==hit['ownerId'],('pick ID changed',hit,got);r['checks'].append({'label':'CSS-to-backing exact original ID','passed':True,'expected':hit,'selected':got});save()

with sync_playwright() as pw:
 browser=None;page=None
 try:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);r['browserVersion']=browser.version
  verify=browser.new_context()
  for rel,wanted in cfg['files'].items():
   override=cfg.get('overrides',{}).get(rel)
   if override:
    p=(root/override).resolve();assert p.is_relative_to(root);body=p.read_bytes();status=200;origin='frozen-candidate'
   else:
    response=verify.request.get(url+rel,timeout=30000);body=response.body();status=response.status;origin='exact-public'
   digest=hashlib.sha256(body).hexdigest();r['files'][rel]={'status':status,'sha256':digest,'origin':origin,'passed':status==200 and digest==wanted};assert r['files'][rel]['passed'],('closure mismatch',rel)
  verify.close();save()
  for dpr in ([1] if cfg.get('publicSmoke') else [1,2]):
   context=browser.new_context(viewport={'width':1920,'height':1080},device_scale_factor=dpr)
   for rel,asset in cfg.get('overrides',{}).items():context.route(matcher(url+rel),handler((root/asset).read_bytes(),'text/javascript' if rel.endswith(('.mjs','.js')) else mimetypes.guess_type(rel)[0] or 'text/plain'))
   page=context.new_page();page.add_init_script("window.addEventListener('error',e=>window.__qaPageError=e.message);window.addEventListener('unhandledrejection',e=>window.__qaPageError=String(e.reason));");page.set_default_timeout(240000);page.on('pageerror',lambda e:r['pageErrors'].append(str(e)));page.on('requestfailed',lambda q:r['failedRequests'].append({'url':q.url,'failure':q.failure}));navigation=page.goto(url,wait_until='domcontentloaded');assert hashlib.sha256(navigation.body()).hexdigest()==cfg['files']['index.html'],'directory navigation did not serve exact candidate index';assert page.title()=='三栋建筑 · 桌面原生像素检查';assert all(page.locator('#'+id).count()==1 for id in ['fitView','fullscreen','displayInfo','resolutionWarning']),'candidate toolbar missing';stable('lowrise')
   if dpr==2:
    q=capture('desktop-DPR2-native',whole=True);assert q['canvas']['width']>2500;shot('desktop-DPR2-native')
    action(lambda:page.locator('#reset').click());capture('desktop-DPR2-reset',whole=True);context.close();continue
   cases=['lowrise'] if cfg.get('publicSmoke') else ['lowrise','kcc','warehouse']
   for case in cases:
    if case!='lowrise':action(lambda:page.locator('#case').select_option(case),case)
    q=capture(case+'-desktop-whole',whole=True);assert q['canvas']['width']>1400 and q['canvas']['height']>700;shot(case+'-desktop-whole')
    action(lambda:page.locator('#reset').click());capture(case+'-desktop-reset',whole=True)
   if page.evaluate('window.semanticInspection.caseId')!='lowrise':action(lambda:page.locator('#case').select_option('lowrise'),'lowrise')
   if not cfg.get('publicSmoke'):
    action(lambda:page.locator('[data-class="window"]').click());q=capture('lowrise-window-close');shot('lowrise-window-close');assert q['counts'].get('window',0)>0;pick(q,'window')
    action(lambda:page.locator('#reset').click());capture('lowrise-after-close-reset',whole=True)
    before=frames();box=page.locator('#view').bounding_box();page.mouse.move(box['x']+box['width']*.48,box['y']+box['height']*.55);page.mouse.down();page.mouse.move(box['x']+box['width']*.53,box['y']+box['height']*.57,steps=3);page.mouse.up();stable(n=before);q=capture('lowrise-after-drag');sizes=page.evaluate('n=>window.semanticInspection.frames.slice(n).map(f=>[f.width,f.height])',before);assert sizes and all(x==[q['canvas']['width'],q['canvas']['height']] for x in sizes),('hidden drag downresolution',sizes);r['checks'].append({'label':'Drag preserves native framebuffer size','passed':True,'frames':sizes});save()
    action(lambda:page.locator('#reset').click());capture('lowrise-drag-reset',whole=True)
    before=frames();page.set_viewport_size({'width':1100,'height':900});stable(n=before);q=capture('narrow-resize-fullframe',whole=True);shot('narrow-resize-fullframe');pick(q,next(iter(q['picks'])))
    before=frames();page.set_viewport_size({'width':1920,'height':1080});stable(n=before);capture('wide-resize-fullframe',whole=True);shot('wide-resize-fullframe')
    action(lambda:page.locator('[data-class="floor"]').click());q=capture('lowrise-floor-regression');assert q['counts'].get('floor',0)>10 and q['counts'].get('stair',0)>10;pick(q,'stair');shot('lowrise-floor-regression')
    action(lambda:page.locator('#fitView').click());q=capture('complete-from-floor',whole=True);assert q['view']=='whole' and not q['camera']['cut'] and q['camera']['sliceY'] is None
    action(lambda:page.locator('[data-view="cut"]').click());action(lambda:page.locator('#fitView').click());q=capture('complete-from-cut',whole=True);assert q['view']=='whole' and not q['camera']['cut'] and q['camera']['sliceY'] is None;shot('complete-from-cut')
   context.close()
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
print('Desktop R04 exact bytes, native framebuffer, full frame and picking passed.',flush=True)
