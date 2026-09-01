"""Validate an extracted, relocated package against its pinned renderer source."""
from pathlib import Path
from functools import partial
import http.server, threading, tempfile, shutil, json, io, hashlib, os, sys, traceback, zipfile
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
PKG=Path(sys.argv[1]).resolve();SRC=Path(sys.argv[2]).resolve()
report={'status':'RUNNING','packageVersion':'1.1.0-clean','checks':[], 'upstream':{'evidenceRef':'970aa25814e5d5f98cf10091da69666f62dbcd28','automaticChecks':52,'publicChecks':52,'scope':'Upstream evidence, not new package tests'},'visualApproved':False,'productionApproved':False,'aaaQualityApproved':False,'userGPUPerformanceVerified':False,'screenshotsStoredInPackage':0}
def check(n,ok,details=None):
 report['checks'].append({'name':n,'pass':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+n,flush=True)
 if not ok:raise AssertionError(n+': '+repr(details))
def rgba(page):
 page.add_style_tag(content='.panel,.footer,#loading{visibility:hidden!important}')
 return Image.open(io.BytesIO(page.screenshot(timeout=120000))).convert('RGB')
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
try:
 m=json.loads((PKG/'MANIFEST.json').read_text());h=json.loads((PKG/'HANDOFF.json').read_text())
 for n,d in m['files'].items():assert hashlib.sha256((PKG/n).read_bytes()).hexdigest()==d['sha256'],n
 check('all package source hashes valid',True)
 for n in ['engine.js','cloud.glsl','field-worker.js','motion.js','optics.js']:assert (PKG/n).read_bytes()==(SRC/n).read_bytes(),n
 check('all five computation files byte identical',True)
 old='../method-v100/lighting/?lighting=silver&quality=fine';new='https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/method-v100/lighting/?lighting=silver&quality=fine'
 check('HTML differs only in optional lighting URL',(PKG/'index.html').read_text()==(SRC/'index.html').read_text().replace(old,new))
 check('no images archives old engines or build tools',set(p.name for p in PKG.iterdir()) <= {'index.html','engine.js','cloud.glsl','field-worker.js','motion.js','optics.js','POLICY.json','START_HERE.md','INTEGRATION.md','HANDOFF.json','MANIFEST.json','QA.json'})
 check('one policy snapshot retains core hash',hashlib.sha256((PKG/'POLICY.json').read_bytes()).hexdigest()=='80aef698e30a6378e25d6eeb7c6ee67c1df24e6ae96faef5f4df4ef62d19c8d3')
 check('partial rule adoption and absent APIs disclosed',h['policy']['runtimeAdoption'].startswith('partial') and 'getEnvironment' in h['notProvided'])
 with tempfile.TemporaryDirectory() as td:
  root=Path(td);a=root/'source';b=root/'another-project/modules/weather';shutil.copytree(SRC,a)
  transport=root/'transport.zip'
  with zipfile.ZipFile(transport,'w',zipfile.ZIP_DEFLATED) as z:
   for f in PKG.iterdir():z.write(f,f.name)
  with zipfile.ZipFile(transport) as z:
   assert z.testzip() is None;z.extractall(b)
  for f in PKG.iterdir():assert f.read_bytes()==(b/f.name).read_bytes()
  check('ZIP extraction preserves every file',True)
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
  origin=f'http://127.0.0.1:{server.server_port}'
  with sync_playwright() as p:
   launch={'headless':True,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
   if os.environ.get('CHROMIUM_PATH'):launch['executable_path']=os.environ['CHROMIUM_PATH']
   browser=p.chromium.launch(**launch);errs=[];external=[];responses=[]
   def load(path,case='fair',viewport=(480,320)):
    context=browser.new_context(viewport={'width':viewport[0],'height':viewport[1]},device_scale_factor=1)
    allowed=origin+path
    def route(r):
     if r.request.url.startswith(allowed):r.continue_()
     else:external.append(r.request.url);r.abort()
    context.route('**/*',route)
    page=context.new_page();page.set_default_timeout(120000)
    page.on('pageerror',lambda e:errs.append(str(e)));page.on('console',lambda e:errs.append(e.text) if e.type=='error' else None)
    page.on('response',lambda r:responses.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
    page.add_init_script('window.WeatherMotherBoot='+json.dumps({'still':True,'weather':case,'quality':'balanced','seed':4217})+';')
    r=page.goto(allowed,wait_until='domcontentloaded');assert r.status==200
    page.wait_for_function('window.WeatherMother?.qa.errors.length || (window.WeatherMother?.qa.ready && WeatherMother.qa.frames>0)',timeout=180000)
    assert not page.evaluate('WeatherMother.qa.errors'),page.evaluate('WeatherMother.qa.errors')
    n=page.evaluate('WeatherMother.qa.frames')
    page.evaluate("document.getElementById('temporal').checked=false;document.getElementById('temporal').dispatchEvent(new Event('change'));WeatherMother.setTestTime(0);WeatherMother.setLoopPhase(0);")
    page.wait_for_function('(n)=>WeatherMother.qa.frames>n',arg=n,timeout=120000)
    return page
   report['pixelComparisons']={}
   for case in ['fair','iridescent','typhoon','nightstorm']:
    x=load('/source/',case);px=rgba(x);x.context.close()
    y=load('/another-project/modules/weather/',case);py=rgba(y)
    stat=ImageStat.Stat(ImageChops.difference(px,py));d={'max':max(v[1] for v in stat.extrema),'rmsRGB':stat.rms,'nativeRenderSize':y.evaluate('WeatherMother.qa.renderSize'),'displayBufferSize':y.evaluate('[document.getElementById("scene").width,document.getElementById("scene").height]')}
    report['pixelComparisons'][case]=d;check('relocated package matches source pixels '+case,d['max']<=1,d);y.context.close()
   page=load('/another-project/modules/weather/')
   page.evaluate("document.getElementById('panel').classList.remove('collapsed')")
   check('20 cases and 10 genera retained',page.locator('#weather option').count()==20 and page.locator('#kind option').count()==10)
   check('wind seed loop optics events and lighting controls retained',all(page.locator('#'+n).count()==1 for n in ['wind','direction','cloudSpeed','seed','loopEnabled','loopSeconds','iriStrength','lightningOnce','cycloneSpin','eyeRadius','lightScene']))
   for case in h['weatherCases']:
    page.select_option('#weather',case)
    page.wait_for_function('(c)=>WeatherMother.qa.errors.length||(WeatherMother.qa.weatherCase===c&&document.getElementById("loading").style.display==="none"&&WeatherMother.getState().blend>.999)',arg=case,timeout=180000)
    q=page.evaluate('WeatherMother.qa');check('case independently runs '+case,not q['errors'] and q['supportSafe'] and q['lastGLerror']==0)
   page.evaluate("WeatherMother.set('wind',33);WeatherMother.set('cloudSpeed',5);")
   page.wait_for_function('Math.abs(WeatherMother.getState().wind-33)<.01&&Math.abs(WeatherMother.getState().cloudSpeed-5)<.01',timeout=120000)
   check('independent wind and cloud controls',page.evaluate('!WeatherMother.qa.motionLinked'))
   page.evaluate("const e=document.getElementById('eyeRadius');e.value='3.1';e.dispatchEvent(new Event('input'));")
   page.wait_for_function('document.getElementById("loading").style.display==="none"&&WeatherMother.getState().blend>.999&&Math.abs(WeatherMother.getState().eyeRadius-3.1)<.01',timeout=180000)
   check('documented cyclone DOM adapter works',page.evaluate('Math.abs(WeatherMother.qa.cyclone.eyeRadiusKm-3.1)<.01'))
   api=page.evaluate('Object.keys(WeatherMother)');check('documented API matches actual runtime',set(h['nativeAPI']).issubset(api) and not any(n in api for n in ['getEnvironment','getConfiguration','applyConfiguration']))
   check('all approval flags remain false',page.evaluate('WeatherMother.qa.visualAcceptance===false&&WeatherMother.qa.productionReady===false'))
   page.context.close()
   page=load('/another-project/modules/weather/',viewport=(900,600));check('desktop standalone boot',page.evaluate('WeatherMother.qa.ready&&!WeatherMother.qa.errors.length'))
   report['desktop']={'viewport':[900,600],'nativeRenderSize':page.evaluate('WeatherMother.qa.renderSize')};page.context.close()
   page=load('/another-project/modules/weather/','typhoon',(390,844));check('mobile standalone boot',page.evaluate('WeatherMother.qa.ready&&!WeatherMother.qa.errors.length'))
   report['mobile']={'viewport':[390,844],'nativeRenderSize':page.evaluate('WeatherMother.qa.renderSize')};report['browserVersion']=browser.version
   check('no external runtime requests',not external,external);check('no runtime errors',not errs,errs);check('no HTTP failures',not responses,responses)
   browser.close();server.shutdown()
 report['status']='PASS'
except Exception:
 report['status']='FAIL';report['error']=traceback.format_exc();print(report['error'],flush=True)
finally:
 (PKG/'QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('RESULT',report['status'],len(report['checks']),flush=True)
if report['status']!='PASS':raise SystemExit(1)
