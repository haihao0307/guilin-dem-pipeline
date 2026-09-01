"""Rendered evidence and source isolation. No source images are used by runtime."""
from pathlib import Path
import os,sys,json,hashlib,io,math,subprocess,traceback
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
R=Path(sys.argv[1]);URL=sys.argv[2];BASE=sys.argv[3];public=os.environ.get('PUBLIC_CHECK')=='1'
report={'version':'wm-lighting-0.1.1','status':'RUNNING','url':URL,'checks':[],'errors':[],'runtimeImageAssets':0,'visualApproved':False,'productionApproved':False,'aaaQualityApproved':False,'userHardwarePerformanceVerified':False}
def check(n,v,d=None):
 report['checks'].append({'name':n,'pass':bool(v),'details':d});print(('PASS ' if v else 'FAIL ')+n,flush=True)
 if not v:raise AssertionError(n+': '+str(d))
def diff(a,b):
 v=ImageStat.Stat(ImageChops.difference(a,b));return {'max':max(x[1] for x in v.extrema),'rms':math.sqrt(sum(x*x for x in v.rms)/3)}
try:
 m=json.loads((R/'MANIFEST.json').read_text())
 for n,f in m['files'].items():assert hashlib.sha256((R/n).read_bytes()).hexdigest()==f['sha256']
 check('runtime file identities',True)
 for n,pin in m['parentRuntime'].items():assert hashlib.sha256((R.parent/n).read_bytes()).hexdigest()==pin
 check('parent policy state profile and baseline runtime unchanged',True)
 for name in ['studio.js','runtime.js']:subprocess.check_call(['node','--check',str(R/name)])
 tests=r"""const S=require('./studio.js');let checks=[];function t(n,f){checks.push({name:n,pass:!!f()})}for(const n of Object.keys(S.presets))t('valid preset '+n,()=>{const p=S.preset(n);return p.lights.length===3&&p.lights.every(S.validateLight)});for(const v of [{power:99},{size:99},{unknown:1},{color:'red'},{enabled:1},{azimuth:Infinity}])t('reject invalid light '+JSON.stringify(v),()=>{try{S.validateLight(v);return false}catch(e){return true}});let p=S.preset('daylight');p.lights[0].power=0;t('preset clone isolation',()=>S.preset('daylight').lights[0].power!==0);t('rotation wraps without full spin',()=>S.wrapAngle(181)===-179);console.log(JSON.stringify(checks));if(checks.some(c=>!c.pass))process.exit(1)"""
 local=json.loads(subprocess.check_output(['node','-e',tests],cwd=R,text=True));report['unitChecks']=local;check('presentation validation and preset isolation',all(t['pass'] for t in local),len(local))
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':800,'height':540},device_scale_factor=1);page.set_default_timeout(120000)
  errors=[];con=[];failed=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:con.append(e.text) if e.type=='error' else None);page.on('requestfailed',lambda r:failed.append(r.url))
  def ready():
   page.wait_for_function('window.WeatherMethod?.qa?.errors.length||(window.WeatherMethod?.qa?.ready&&WeatherMethod.qa.frames>0)',timeout=160000)
   assert not page.evaluate('WeatherMethod.qa.errors'),page.evaluate('WeatherMethod.qa.errors')
  def act(js,arg=None):
   n=page.evaluate('WeatherMethod.qa.frames');page.evaluate(js,arg);page.wait_for_function('(n)=>WeatherMethod.qa.errors.length||WeatherMethod.qa.frames>n',arg=n,timeout=120000)
   assert not page.evaluate('WeatherMethod.qa.errors')
  def img():
   page.evaluate("document.body.classList.add('qaPixel')")
   try:return Image.open(io.BytesIO(page.screenshot(timeout=120000))).convert('RGB')
   finally:page.evaluate("document.body.classList.remove('qaPixel')")
  def hidecss():page.add_style_tag(content='body.qaPixel header,body.qaPixel aside,body.qaPixel nav,body.qaPixel footer,body.qaPixel .top,body.qaPixel .badge,body.qaPixel #legend,body.qaPixel #frameLabel{visibility:hidden!important}')
  r=page.goto(BASE,wait_until='domcontentloaded',timeout=60000);assert r.status==200;ready();hidecss();act("()=>WeatherMethod.setMode('neutral_inspection')");baseline=img();data0=page.evaluate('WeatherMethod.qa.dataHashes')
  r=page.goto(URL+'?mode=neutral_inspection&quality=balanced',wait_until='domcontentloaded',timeout=60000);check('candidate HTTP 200',r.status==200);ready();hidecss();neutral=img()
  check('new shaders actually render',page.evaluate('WeatherMethod.qa.lastGLerror===0'))
  d=diff(baseline,neutral);check('neutral pixels match previous candidate on same renderer',d['max']<=1,d)
  check('generated density and noise bytes match previous candidate',data0==page.evaluate('WeatherMethod.qa.dataHashes'))
  original=page.evaluate('WeatherMethod.getState()');hashes=page.evaluate('WeatherMethod.qa.dataHashes')
  frames={};report['presetPixels']={}
  for name in ['daylight','dawn','sunset','silver','moon']:
   act('(n)=>WeatherMethod.setLighting(n)',name);frames[name]=img();st=ImageStat.Stat(frames[name]);check('render '+name,sum(st.stddev)>12,st.stddev)
   if not public:
    out=Path('/tmp/weather-lighting-inspection');out.mkdir(exist_ok=True);page.screenshot(path=str(out/(name+'-preview.png')),timeout=120000)
   report['presetPixels'][name]={'rgbSHA256':hashlib.sha256(frames[name].tobytes()).hexdigest(),'native':page.evaluate('WeatherMethod.qa.nativeRenderSize'),'stateUnchanged':page.evaluate('WeatherMethod.getState()')==original}
   check('lighting preserves source state '+name,page.evaluate('WeatherMethod.getState()')==original)
  for name in ['dawn','sunset','silver','moon']:
   d=diff(frames['daylight'],frames[name]);check('preset visibly differs '+name,d['rms']>.8,d)
  check('all presets preserve density/shape hashes',page.evaluate('WeatherMethod.qa.dataHashes')==hashes)
  act("()=>WeatherMethod.setLighting('daylight')");full=img();lights=page.evaluate('WeatherMethod.getPresentation().lights')
  for k in range(3):
   act('(k)=>WeatherMethod.setLight(k,{enabled:false})',k);off=img();d=diff(full,off);check('independent light '+str(k),d['rms']>.1,d)
   act('(a)=>WeatherMethod.setLight(a[0],a[1])',[k,lights[k]])
  act('()=>WeatherMethod.setExposure(.5)');dim=img();check('exposure affects only presentation',diff(full,dim)['rms']>1 and page.evaluate('WeatherMethod.getState()')==original)
  act('()=>WeatherMethod.setExposure(1)');act('()=>WeatherMethod.setRotation(55)');rot=img();check('group rotation changes lighting',diff(full,rot)['rms']>1)
  check('rotation preserves source state',page.evaluate('WeatherMethod.getState()')==original)
  act("()=>WeatherMethod.setMode('diagnostic')");thickness=img();check('actual optical-thickness diagnostic',diff(rot,thickness)['rms']>1)
  act('()=>WeatherMethod.setDiagnostic(2)');cut=img();check('actual volume section',diff(cut,thickness)['rms']>1)
  act('()=>WeatherMethod.setDiagnostic(3)');depth=img();check('depth differs from concentration',diff(depth,cut)['rms']>1)
  act("()=>WeatherMethod.setMode('neutral_inspection')");n2=img();d=diff(neutral,n2);check('neutral roundtrip restores exact image',d['max']<=1,d)
  act("()=>WeatherMethod.setLighting('daylight')");act("()=>WeatherMethod.setQuality('fine')");check('fine sample count is 224',page.evaluate('WeatherMethod.qa.samples')==224)
  act("()=>WeatherMethod.setQuality('inspection')");check('inspection sample count is 384',page.evaluate('WeatherMethod.qa.samples')==384)
  act("()=>WeatherMethod.setQuality('balanced')");export=page.evaluate('WeatherMethod.exportState()');check('export includes presentation and effective source hash',len(export['effectiveParametersSha256'])==64 and export['presentation']['version']=='wm-studio-0.1.1' and 'rotationDegrees' in export['presentation'])
  rejected=page.evaluate("(()=>{const old=JSON.stringify(WeatherMethod.getPresentation());try{WeatherMethod.setLight(0,{size:99});return false}catch(e){return old===JSON.stringify(WeatherMethod.getPresentation())}})()");check('invalid light update is atomic and rejected',rejected)
  check('production approval remains blocked',page.evaluate("(()=>{try{WeatherMethod.attemptProduction();return false}catch(e){return true}})()"))
  act("()=>WeatherMethod.setMode('diagnostic')");act('()=>WeatherMethod.setDiagnostic(1)');act("()=>WeatherMethod.setDriver('humidity',0)");act('()=>WeatherMethod.seek(60)');dry=img();check('same humidity history still drives cloud removal',page.evaluate('WeatherMethod.getState().concentration')<.01)
  act('()=>WeatherMethod.seek(0)');check('history replay remains available',page.evaluate('WeatherMethod.getState().concentration')==original['concentration'])
  if not public:
   out=Path('/tmp/weather-lighting-inspection');out.mkdir(exist_ok=True);page.set_viewport_size({'width':1280,'height':800});act("()=>WeatherMethod.setQuality('fine')")
   for name in ['daylight','sunset','silver']:
    act('(n)=>WeatherMethod.setLighting(n)',name);page.screenshot(path=str(out/(name+'.png')),timeout=120000)
   report['inspectionCapture']={'native':page.evaluate('WeatherMethod.qa.nativeRenderSize'),'display':[1280,800],'runtimeImages':0,'temporaryOnly':True}
  report['desktop']={'browser':browser.version,'state':page.evaluate('WeatherMethod.getState()'),'qa':page.evaluate('WeatherMethod.qa'),'errors':errors,'consoleErrors':con,'failedRequests':failed}
  check('zero desktop page errors',not errors,errors);check('zero desktop console errors',not con,con);check('zero desktop failed requests',not failed,failed)
  page.close();mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1);mobile.goto(URL+'?lighting=sunset&quality=balanced',wait_until='domcontentloaded',timeout=60000);mobile.wait_for_function('window.WeatherMethod?.qa?.errors.length||window.WeatherMethod?.qa?.ready&&WeatherMethod.qa.frames>0',timeout=180000)
  check('mobile independently renders',mobile.evaluate('WeatherMethod.qa.ready&&!WeatherMethod.qa.errors.length'))
  check('mobile panel initially unobstructed',mobile.locator('#panel').get_attribute('class')=='closed')
  mobile.locator('#togglePanel').click();check('mobile panel opens',mobile.locator('#panel').get_attribute('class')!='closed')
  report['mobile']={'native':mobile.evaluate('WeatherMethod.qa.nativeRenderSize'),'display':[390,844]};browser.close()
 report['status']='BROWSER_QA_PASS'
except Exception:
 report['status']='QA_FAILED';report['errors'].append(traceback.format_exc());print(report['errors'][-1],flush=True)
finally:
 (R/('PUBLIC_TESTS.json' if public else 'TESTS.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(report['status'],len(report['checks']),flush=True)
if report['status']!='BROWSER_QA_PASS':raise SystemExit(1)
