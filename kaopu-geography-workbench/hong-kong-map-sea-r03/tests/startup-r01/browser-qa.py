from pathlib import Path
import hashlib, json, shutil, subprocess, sys, threading, functools, http.server, urllib.request, time
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageStat

ROOT=Path(sys.argv[1]).resolve()
OUT=Path(sys.argv[2]).resolve();OUT.mkdir(parents=True,exist_ok=True)
HERE=Path(__file__).resolve().parent
PUBLIC_URL=sys.argv[3].rstrip('/')+'/' if len(sys.argv)>3 else None
EXPECTED_HTML='54487b03d7314edb19ed3ed37aab47bb662c8633e05cf96fdef7d28ac10a4117'
EXPECTED_STATION='10ed6185af864245d4f865499e58040f8b9e0971d8271e6ec1ce4ee7c8d02e41'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(ROOT/'index.html')==EXPECTED_HTML, 'Frozen HTML differs; stop for review'
assert sha(ROOT/'station-data.js')==EXPECTED_STATION, 'Frozen station asset differs; stop for review'
serve=OUT/'served';serve.mkdir(exist_ok=True)
for name in ['baseline','candidate']:
 p=serve/name;p.mkdir(exist_ok=True)
 for f in ['index.html','station-data.js']:shutil.copyfile(ROOT/f,p/f)
subprocess.run([sys.executable,str(HERE/'replace-bootstrap.py'),str(serve/'candidate/index.html')],check=True)
handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(serve))
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
results={'kind':('Actual public GitHub Pages Chromium, not user device verification' if PUBLIC_URL else 'Actual isolated GitHub Actions Chromium, not user device verification'),'sourceSha256':EXPECTED_HTML,'stationSha256':EXPECTED_STATION,'scenarios':[],'comparisons':[],'passed':False}

if PUBLIC_URL:
 expected_candidate=sha(serve/'candidate/index.html')
 readbacks={}
 for name,expected in [('index.html',expected_candidate),('station-data.js',EXPECTED_STATION),('index.preboot-20261021.html',EXPECTED_HTML)]:
  content=urllib.request.urlopen(PUBLIC_URL+name+'?verify=c7d1593593ba',timeout=60).read()
  actual=hashlib.sha256(content).hexdigest();assert actual==expected, (name,actual,expected)
  readbacks[name]=actual
 results['publicUrl']=PUBLIC_URL
 results['publicReadbackSha256']=readbacks

INJECT=r'''({failCount}) => {
 window.__bootProbe={calls:[],nativeSuccesses:0,draws:0,failCount};
 const original=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(type,attrs){
  if(type!=='webgl2')return original.apply(this,arguments);
  const q=window.__bootProbe;q.calls.push({id:this.id,attributes:attrs||null});
  if(q.calls.length<=failCount){this.dispatchEvent(new WebGLContextEvent('webglcontextcreationerror',{statusMessage:'TEST INJECTION: bounded simulated null '+q.calls.length}));return null;}
  const gl=original.apply(this,arguments);
  if(gl){q.nativeSuccesses++;q.version=gl.getParameter(gl.VERSION);}
  return gl;
 };
 for(const name of ['drawArrays','drawElements','drawArraysInstanced']){
  const fn=WebGL2RenderingContext.prototype[name];
  WebGL2RenderingContext.prototype[name]=function(...args){window.__bootProbe.draws++;return fn.apply(this,args);};
 }
}'''

def state(page):
 return page.evaluate('''() => {const q=window.OceanMother?.qa;return {qa:q?{ready:q.ready,frames:q.frames,completedFrames:q.completedFrames,errors:q.errors,lastGLerror:q.lastGLerror,mapAssembled:q.mapAssembled,terrainTriangles:q.terrainTriangles,stationTriangles:q.kowloonStation?.renderTriangles,contextCreation:q.contextCreation,mapCamera:q.mapCamera}:null,probe:window.__bootProbe,error:document.querySelector('#error')?.textContent,errorVisible:!document.querySelector('#error')?.hidden,stationReady:window.HK_STATION_LOAD?.ready};}''')

def settle(page):
 page.wait_for_function('''() => {const q=window.OceanMother?.qa;return q?.errors?.length || (q?.ready&&q.mapAssembled&&q.completedFrames>=2);}''',timeout=180000)
 st=state(page);assert not st['qa']['errors'],st
 assert st['qa']['ready'] and st['qa']['mapAssembled'] and st['stationReady'],st
 assert st['probe']['nativeSuccesses']==1 and st['probe']['draws']>0 and st['probe']['version'].startswith('WebGL 2.'),st
 assert st['qa']['lastGLerror']==0,st
 page.wait_for_timeout(1000)
 return state(page)

try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader'])
  results['browserVersion']=browser.version
  for label,source,failCount,views in [
   ('baseline','baseline',0,['overview','north','harbour','kowloon']),
   ('candidate-normal','candidate',0,['overview','north','harbour','kowloon']),
   ('candidate-default','candidate',1,['overview']),
   ('candidate-low-power','candidate',2,['overview']),
   ('candidate-all-null','candidate',99,[])]:
   context=browser.new_context(viewport={'width':1280,'height':800},device_scale_factor=1)
   context.add_init_script('('+INJECT+')('+json.dumps({'failCount':failCount})+');')
   page=context.new_page();page.set_default_timeout(15000)
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   entry={'label':label,'injectedNullCount':failCount,'source':source,'views':[]}
   results['scenarios'].append(entry)
   print('START',label,flush=True)
   url=(PUBLIC_URL+'?still=1&verify=c7d1593593ba') if PUBLIC_URL and source=='candidate' else f'http://127.0.0.1:8765/{source}/?still=1'
   entry['actualUrl']=url
   page.goto(url,wait_until='load',timeout=60000)
   if failCount==99:
    page.wait_for_function('window.OceanMother?.qa.errors.length>0',timeout=15000)
    entry['state']=state(page);st=entry['state']
    assert st['qa']['ready'] is False and st['qa']['frames']==0 and st['probe']['draws']==0,st
    assert len(st['probe']['calls'])==3 and st['probe']['nativeSuccesses']==0 and st['errorVisible'],st
    assert st['qa']['contextCreation']['ready'] is False and len(st['qa']['contextCreation']['attempts'])==3,st
    assert 'WebGL2 三维启动未成功' in st['error'] and 'TEST INJECTION' in st['error'],st
    page.screenshot(path=str(OUT/(label+'.png')))
   else:
    entry['state']=settle(page)
    assert len(entry['state']['probe']['calls'])==failCount+1,entry
    if source=='candidate':
     assert len(entry['state']['qa']['contextCreation']['attempts'])==failCount+1,entry
    for view in views:
     if view!='overview':
      old=page.evaluate('window.OceanMother.qa.frames')
      page.locator(f'[data-map-view="{view}"]').click()
      page.wait_for_function('(n)=>window.OceanMother.qa.frames>n',arg=old,timeout=60000)
      page.wait_for_timeout(1200)
     entry['views'].append({'view':view,'state':state(page)})
     page.screenshot(path=str(OUT/(label+'-'+view+'.png')))
     assert not state(page)['qa']['errors']
   assert not errors,errors
   entry['passed']=True
   (OUT/'results.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
   print('PASS',label,flush=True)
   context.close()
  browser.close()
 # Compare same real rendering with frozen time, data, viewport and scene controls.
 for label,views in [('candidate-normal',['overview','north','harbour','kowloon']),('candidate-default',['overview']),('candidate-low-power',['overview'])]:
  for view in views:
   a=Image.open(OUT/('baseline-'+view+'.png')).convert('RGB');b=Image.open(OUT/(label+'-'+view+'.png')).convert('RGB')
   d=ImageChops.difference(a,b);st=ImageStat.Stat(d);mean=sum(st.mean)/3
   changed=sum(1 for px in d.getdata() if max(px)>8)/(a.width*a.height)
   assert ImageStat.Stat(a).stddev[0]>5,'Baseline image lacks meaningful variation'
   record={'candidate':label,'view':view,'meanAbsoluteChannelDifference':mean,'fractionPixelsDifferenceAbove8':changed,'pass':mean<1 and changed<0.01}
   results['comparisons'].append(record)
   assert record['pass'],record
 results['passed']=True
finally:
 (OUT/'results.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
 print(json.dumps({k:v for k,v in results.items() if k!='scenarios'},ensure_ascii=False),flush=True)
 server.shutdown()
