"""Browser QA for the primary Weather Mother workbench.

Rendered pixels are held in memory. Temporary inspection images are never runtime assets.
"""
from pathlib import Path
import hashlib,io,json,math,os,sys,traceback
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
ROOT=Path(sys.argv[1]);URL=sys.argv[2];PUBLIC=os.environ.get('PUBLIC_CHECK')=='1'
REPORT=ROOT/('PUBLIC_QA.json' if PUBLIC else 'QA.json')
report={'productionLine':'Weather Mother','version':'1.1.0-world','url':URL,'status':'RUNNING','checks':[],'errors':[],'runtimeImageAssets':0,'primaryWorkbenchOnly':True,'visualApproved':False,'aaaQualityApproved':False,'productionReady':False,'userHardwarePerformanceVerified':False}
def save():REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
def check(name,ok,details=None):
 report['checks'].append({'name':name,'pass':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+': '+repr(details))
def delta(a,b):
 s=ImageStat.Stat(ImageChops.difference(a,b));return {'rms':math.sqrt(sum(x*x for x in s.rms)/3),'max':max(v[1] for v in s.extrema),'mean':sum(s.mean)/3}
def image(page):return Image.open(io.BytesIO(page.locator('canvas').screenshot(timeout=120000))).convert('RGB')
try:
 m=json.loads((ROOT/'MANIFEST.json').read_text())
 for n,f in m['files'].items():
  raw=(ROOT/n).read_bytes();assert len(raw)==f['bytes'] and hashlib.sha256(raw).hexdigest()==f['sha256'],n
 check('manifest source identities',True)
 check('no runtime image assets',not any(p.suffix.lower() in {'.png','.jpg','.jpeg','.hdr','.exr','.webp','.gif','.ktx','.ktx2'} for p in ROOT.iterdir()))
 check('twenty declared weather cases',m['weatherCaseCount']==20)
 check('primary workbench hides evidence tabs',m['mainWorkbenchContainsNeutralOrDiagnosticTabs'] is False and 'neutral_inspection' not in (ROOT/'index.html').read_text() and '体积诊断' not in (ROOT/'index.html').read_text())
 for n in ['engine.js','field-worker.js','motion.js','optics.js']:
  import subprocess;subprocess.check_call(['node','--check',str(ROOT/n)])
 check('JavaScript syntax',True)
 rules=json.loads((ROOT/'WORLD_RULES.json').read_text())
 check('methodology evidence remains external',len(rules['evidenceModesExternal'])==3 and rules['policyVersion']=='1.0.0')
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':480,'height':320},device_scale_factor=1);page.set_default_timeout(150000)
  page_errors=[];console_errors=[];failed=[]
  page.on('pageerror',lambda e:page_errors.append(str(e)))
  page.on('console',lambda e:console_errors.append(e.text) if e.type=='error' else None)
  page.on('requestfailed',lambda r:failed.append({'url':r.url,'error':r.failure}))
  page.add_init_script("window.WeatherMotherBoot={still:true,quality:'balanced',weather:'fair',hour:16};")
  response=page.goto(URL,wait_until='domcontentloaded',timeout=60000);check('document HTTP 200',response.status==200,response.status)
  page.wait_for_function('window.WeatherMother?.qa?.errors?.length || (window.WeatherMother?.qa?.ready&&WeatherMother.qa.frames>0)',timeout=180000)
  check('WebGL shader and first frame',page.evaluate('WeatherMother.qa.ready&&!WeatherMother.qa.errors.length&&WeatherMother.qa.lastGLerror===0'),page.evaluate('WeatherMother.qa.errors'))
  page.add_style_tag(content='.panel,.footer,#loading{visibility:hidden!important}')
  page.evaluate("document.getElementById('temporal').checked=false;document.getElementById('temporal').dispatchEvent(new Event('change'));WeatherMother.set('cloudSpeed',0);WeatherMother.set('wind',0);WeatherMother.set('gust',0);WeatherMother.setLoopPhase(0);")
  def wait_frame(old=None):
   if old is None:old=page.evaluate('WeatherMother.qa.frames')
   page.wait_for_function('(n)=>WeatherMother.qa.errors.length||WeatherMother.qa.frames>n',arg=old,timeout=150000)
   assert not page.evaluate('WeatherMother.qa.errors'),page.evaluate('WeatherMother.qa.errors')
  def settle_volume(kind=None):
   if kind:page.wait_for_function('(k)=>WeatherMother.qa.errors.length||(WeatherMother.qa.activeCloudKind===k&&WeatherMother.getState().blend>=.999)',arg=kind,timeout=200000)
   else:page.wait_for_function("WeatherMother.qa.errors.length||(document.getElementById('loading').style.display==='none'&&WeatherMother.getState().blend>=.999)",timeout=200000)
   assert not page.evaluate('WeatherMother.qa.errors')
   old=page.evaluate('WeatherMother.qa.frames');page.evaluate('WeatherMother.setLoopPhase(WeatherMother.getState().loopPhase)');wait_frame(old)
  def weather(case):
   old=page.evaluate('WeatherMother.qa.frames');page.evaluate('(x)=>WeatherMother.setWeather(x)',case);settle_volume();wait_frame(old)
  def setv(k,v):
   old=page.evaluate('WeatherMother.qa.frames');page.evaluate('(x)=>WeatherMother.set(x[0],x[1])',[k,v]);wait_frame(old)
  base=image(page);st=ImageStat.Stat(base);check('nonblank varied cloud render',sum(st.stddev)>20,st.stddev)
  check('primary selectors complete',page.locator('#weather option').count()==20 and page.locator('#kind option').count()==10)
  check('wind cloud speed seed and cycle controls present',all(page.locator('#'+x).count()==1 for x in ['wind','cloudSpeed','direction','seed','loopEnabled','loopSeconds','loopAmount']))
  cases=['fair','coast','mountain','rain','storm','rainbow','snow','high','iridescent','irisEdge','lenticular','mackerel','dawn','sunset','fogbank','nightstorm','warmfront','coldfront','squall','typhoon']
  case_frames={}
  for case in cases:
   weather(case);q=page.evaluate('WeatherMother.qa');ok=q['lastGLerror']==0 and q['supportSafe'] and q['weatherCase']==case
   check('weather case '+case,ok,{'genus':q['activeCloudKind'],'lobes':q.get('lobes'),'groups':q.get('groups'),'cyclone':q.get('cyclone')})
   if case in {'fair','iridescent','squall','typhoon'}:case_frames[case]=image(page)
  check('typhoon is an organized distinct volume',delta(case_frames['typhoon'],case_frames['fair'])['rms']>2,delta(case_frames['typhoon'],case_frames['fair']))
  q=page.evaluate('WeatherMother.qa');check('typhoon contract reports eye and rainband controls',q['cyclone']['active'] and q['cyclone']['eyeRadiusKm']>1 and q['cyclone']['stormRadiusKm']>7,q['cyclone'])
  before=case_frames['typhoon'];setv('eyeRadius',3.1);settle_volume('Cb');after=image(page);d=delta(before,after);check('typhoon eye radius changes actual pixels',d['rms']>.15,d)
  setv('rainbandCurl',1.7);settle_volume('Cb');curled=image(page);d=delta(after,curled);check('rainband curvature changes actual pixels',d['rms']>.12,d)
  weather('iridescent');page.evaluate("document.getElementById('iridescence').checked=true;document.getElementById('iridescence').dispatchEvent(new Event('change'))");wait_frame();iris=image(page)
  page.evaluate("document.getElementById('iridescence').checked=false;document.getElementById('iridescence').dispatchEvent(new Event('change'))");wait_frame();plain=image(page);d=delta(iris,plain);check('iridescence is bound to cloud pixels',d['rms']>.04,d)
  setv('hour',22);page.evaluate("document.getElementById('iridescence').checked=true;document.getElementById('iridescence').dispatchEvent(new Event('change'))");wait_frame();night_on=image(page);page.evaluate("document.getElementById('iridescence').checked=false;document.getElementById('iridescence').dispatchEvent(new Event('change'))");wait_frame();night_off=image(page);d=delta(night_on,night_off);check('solar cloud iridescence is absent at night',d['max']<=1,d)
  weather('fair');page.evaluate("document.getElementById('lightScene').value='natural';document.getElementById('lightScene').dispatchEvent(new Event('change'))");wait_frame();natural=image(page)
  page.evaluate("document.getElementById('lightScene').value='sunset';document.getElementById('lightScene').dispatchEvent(new Event('change'))");wait_frame();sunset=image(page);d=delta(natural,sunset);check('integrated lighting scene changes full weather render',d['rms']>1,d)
  state=page.evaluate('WeatherMother.getState()');check('lighting remains a small presentation control',state['kind']=='Cu' and page.locator('#lightScene').count()==1)
  setv('wind',33);setv('cloudSpeed',5);state=page.evaluate('WeatherMother.getState()');check('wind strength and cloud drift remain independent',state['wind']==33 and state['cloudSpeed']==5,state)
  setv('direction',270);page.evaluate('WeatherMother.play()');t0=page.evaluate('WeatherMother.qa.simulationTimeS');x0=page.evaluate('WeatherMother.getState().windOffset[0]');page.wait_for_function('(t)=>WeatherMother.qa.errors.length||WeatherMother.qa.simulationTimeS>t+.12',arg=t0,timeout=150000);page.evaluate('WeatherMother.pause()');x1=page.evaluate('WeatherMother.getState().windOffset[0]');check('west-origin cloud drift moves east',x1>x0,{'before':x0,'after':x1})
  page.evaluate("WeatherMother.setWeather('fair')");settle_volume();seed0=page.evaluate('WeatherMother.getState().seed');frame0=image(page);page.locator('#seed').click();page.wait_for_function('(s)=>WeatherMother.getState().seed!==s',arg=seed0,timeout=30000);settle_volume();frame1=image(page);check('new seed changes cloud family',page.evaluate('WeatherMother.getState().seed')!=seed0 and delta(frame0,frame1)['rms']>.3)
  page.evaluate('WeatherMother.setLoopPhase(0)');wait_frame();l0=image(page);page.evaluate('WeatherMother.setLoopPhase(.5)');wait_frame();lm=image(page);page.evaluate('WeatherMother.setLoopPhase(1)');wait_frame();l1=image(page);check('continuous morphology changes inside loop',delta(l0,lm)['rms']>.04);check('shape loop closes at endpoint',delta(l0,l1)['max']<=1,delta(l0,l1))
  weather('nightstorm');setv('rain',0);page.evaluate("document.getElementById('lightningEnabled').checked=false;WeatherMother.setTestTime(10)");wait_frame();dark=image(page);page.evaluate('WeatherMother.triggerLightning();WeatherMother.setTestTime(10.025)');wait_frame();flash=image(page);d=delta(dark,flash);check('connected lightning and cloud illumination change real pixels',d['rms']>.04,d)
  check('performance readout uses actual completed frames','completed GPU-frame cadence' in page.evaluate('WeatherMother.qa.performance.method'))
  check('independent light inspection remains linked',page.locator('a[href*="method-v100/lighting"]').count()==1)
  report['inspection']={'fair':hashlib.sha256(case_frames['fair'].tobytes()).hexdigest(),'iridescent':hashlib.sha256(case_frames['iridescent'].tobytes()).hexdigest(),'squall':hashlib.sha256(case_frames['squall'].tobytes()).hexdigest(),'typhoon':hashlib.sha256(case_frames['typhoon'].tobytes()).hexdigest(),'temporaryOnly':True}
  if not PUBLIC:
   out=Path('/tmp/weather-v110-inspection');out.mkdir(exist_ok=True)
   for name,im in case_frames.items():im.save(out/(name+'.png'))
   sunset.save(out/'sunset-light.png');flash.save(out/'night-lightning.png')
  report['desktop']={'browser':browser.version,'renderer':page.evaluate("(()=>{const g=document.getElementById('scene').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()"),'qa':page.evaluate('WeatherMother.qa')}
  check('no page errors',not page_errors,page_errors);check('no console errors',not console_errors,console_errors);check('no failed requests',not failed,failed)
  page.close();mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1);mobile.add_init_script("window.WeatherMotherBoot={still:true,quality:'balanced',weather:'typhoon'};");mobile.goto(URL,wait_until='domcontentloaded',timeout=60000);mobile.wait_for_function('window.WeatherMother?.qa?.errors?.length||(window.WeatherMother?.qa?.ready&&WeatherMother.qa.frames>0)',timeout=200000);check('mobile typhoon first frame',mobile.evaluate('WeatherMother.qa.ready&&!WeatherMother.qa.errors.length&&WeatherMother.qa.weatherCase==="typhoon"'));check('mobile primary controls available',mobile.locator('#weather').count()==1 and mobile.locator('#collapse').count()==1)
  browser.close()
 report['status']='BROWSER_QA_PASS'
except Exception:
 report['status']='QA_FAILED';report['errors'].append(traceback.format_exc());print(report['errors'][-1],flush=True)
finally:save();print(report['status'],len(report['checks']),flush=True)
if report['status']!='BROWSER_QA_PASS':raise SystemExit(1)
