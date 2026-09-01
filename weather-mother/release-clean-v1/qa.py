"""Exact-kernel cleanup regression. Screenshots are compared in memory only."""
import os,io,json,hashlib,sys,math,time,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
ROOT=Path(sys.argv[1]); URL=sys.argv[2]; BASE=sys.argv[3] if len(sys.argv)>3 else None
report={'packageVersion':'1.0.0-clean','status':'RUNNING','checks':[], 'errors':[], 'storedImageFiles':0,'userHardwarePerformanceVerified':False,'aaaQualityApproved':False,'productionReady':False,'testURL':URL}
def check(name,ok,details=None):
 report['checks'].append({'name':name,'pass':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name+': '+repr(details))
def image(page):return Image.open(io.BytesIO(page.locator('canvas').screenshot(timeout=90000))).convert('RGB')
def diff(a,b):
 s=ImageStat.Stat(ImageChops.difference(a,b));return {'max':max(v[1] for v in s.extrema),'rms':math.sqrt(sum(v*v for v in s.rms)/3)}
def wait_ready(page):
 page.wait_for_function("window.WeatherMother?.qa?.errors?.length || (window.WeatherMother?.qa?.ready&&WeatherMother.qa.frames>0 && document.getElementById('loading').style.display==='none')",timeout=120000)
 assert not page.evaluate('WeatherMother.qa.errors'),page.evaluate('WeatherMother.qa.errors')
def draw_after(page,js,arg=None):
 n=page.evaluate('WeatherMother.qa.frames');page.evaluate(js,arg);page.wait_for_function('(n)=>WeatherMother.qa.errors.length || WeatherMother.qa.frames>n',arg=n,timeout=90000)
 assert not page.evaluate('WeatherMother.qa.errors'),page.evaluate('WeatherMother.qa.errors')
def apply(page,cfg):
 page.evaluate('(x)=>WeatherMother.applyConfiguration(x)',cfg);wait_ready(page)
 page.wait_for_function('WeatherMother.getState().blend>=.999',timeout=90000)
 draw_after(page,'()=>WeatherMother.setLoopPhase(WeatherMother.getState().loopPhase)')
try:
 m=json.loads((ROOT/'MANIFEST.json').read_text())
 for n,f in m['files'].items():check('file integrity '+n,hashlib.sha256((ROOT/n).read_bytes()).hexdigest()==f['sha256'])
 for n in ['cloud.glsl','field-worker.js','motion.js']:check('unchanged accepted kernel '+n,m['files'][n]['sha256']==m['baselineSHA256'][n])
 check('one runtime only',not any(p.is_dir() for p in ROOT.iterdir()))
 check('no image files',not any(p.suffix.lower() in ['.png','.jpg','.jpeg','.hdr','.webp','.ktx','.exr','.gif'] for p in ROOT.iterdir()))
 check('test time injection removed','setTestTime:' not in (ROOT/'engine.js').read_text() and '__WEATHER_QA_SNAP__' not in (ROOT/'engine.js').read_text())
 with sync_playwright() as p:
  args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
  launch={'headless':True,'args':args}
  if os.environ.get('WEATHER_CHROMIUM'):launch['executable_path']=os.environ['WEATHER_CHROMIUM']
  browser=p.chromium.launch(**launch);context=browser.new_context(viewport={'width':480,'height':320},device_scale_factor=1)
  context.add_init_script("window.WeatherMotherBoot={still:true,quality:'balanced',hour:16};")
  baseline_image=None
  if BASE:
   page=context.new_page();r=page.goto(BASE,wait_until='domcontentloaded',timeout=60000);assert r.status==200;wait_ready(page)
   page.add_style_tag(content='.panel,.footer,#loading{visibility:hidden!important}')
   draw_after(page,"()=>{document.getElementById('temporal').checked=false;document.getElementById('temporal').dispatchEvent(new Event('change'));WeatherMother.setLoopPhase(0);}")
   baseline_image=image(page);page.close()
  page=context.new_page();errors=[];failed=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('request',lambda r:requests.append(r.url))
  response=page.goto(URL,wait_until='domcontentloaded',timeout=60000);check('HTML HTTP 200',response.status==200)
  wait_ready(page);check('first real frame',page.evaluate('WeatherMother.qa.lastGLerror')==0)
  check('eight weather cases',page.locator('#weather option').count()==8)
  check('ten cloud genera',page.locator('#kind option').count()==10)
  check('all quality tiers',page.locator('#quality option').count()==4)
  page.add_style_tag(content='.panel,.footer,#loading{visibility:hidden!important}')
  draw_after(page,"()=>{document.getElementById('temporal').checked=false;document.getElementById('temporal').dispatchEvent(new Event('change'));WeatherMother.setLoopPhase(0);}")
  first=image(page)
  if baseline_image:
   d=diff(baseline_image,first);report['acceptedBaselinePixelDifference']=d;check('cleanup retains accepted pixels',d['max']<=1,d)
  cfg=page.evaluate('WeatherMother.getConfiguration()');report['configurationBytes']=len(json.dumps(cfg).encode())
  check('configuration JSON serializable',cfg['format']=='weather-mother-configuration' and cfg['schemaVersion']==1)
  invalid=json.loads(json.dumps(cfg));invalid['controls']['wind']=9999
  rejected=page.evaluate('(x)=>{let before=JSON.stringify(WeatherMother.getConfiguration());try{WeatherMother.applyConfiguration(x);return false;}catch(e){return JSON.stringify(WeatherMother.getConfiguration())===before;}}',invalid)
  check('invalid configuration rejected without side effects',rejected)
  apply(page,json.loads(json.dumps(cfg)));restored=image(page);d=diff(first,restored)
  check('paused configuration roundtrip retains tested pixels',d['max']<=1,d)
  draw_after(page,'()=>WeatherMother.setLoopPhase(.5)');middle=image(page)
  draw_after(page,'()=>WeatherMother.setLoopPhase(1)');end=image(page)
  check('loop has visible internal change',diff(first,middle)['rms']>.05)
  check('loop endpoints unchanged',diff(first,end)['max']<=1,diff(first,end))
  for kind in ['Cu','Cb','Sc','St','Ns','Ac','As','Ci','Cc','Cs']:
   c=json.loads(json.dumps(cfg));c['kind']=kind;apply(page,c);q=page.evaluate('WeatherMother.qa');check('render genus '+kind,q['activeCloudKind']==kind and q['borderInputMax']==0 and q['lastGLerror']==0)
  for case in ['fair','coast','mountain','rain','storm','rainbow','snow','high']:
   page.evaluate('(v)=>WeatherMother.setWeather(v)',case)
   page.wait_for_function("document.getElementById('loading').style.display==='none'&&WeatherMother.getState().blend>=.999",timeout=120000)
   check('render weather '+case,page.evaluate('WeatherMother.qa.lastGLerror===0&&WeatherMother.qa.supportSafe'))
  for hour in [6.6,12,17.5,22]:
   c=json.loads(json.dumps(cfg));c['controls']['hour']=hour;apply(page,c);env=page.evaluate('WeatherMother.getEnvironment()');expected=math.cos((hour-12)/12*math.pi)*math.cos(math.pi/6)
   check('shared solar clock '+str(hour),abs(env['sun']['direction'][1]-expected)<1e-9 and abs(env['hour']-hour)<1e-9)
  c=json.loads(json.dumps(cfg));c['controls'].update({'wind':20,'cloudSpeed':7,'direction':270,'gust':0});apply(page,c);env=page.evaluate('WeatherMother.getEnvironment()')
  check('ocean contract west wind points east',abs(env['wind']['velocityMps'][0]-20)<1e-10 and abs(env['wind']['velocityMps'][2])<1e-10)
  check('independent cloud velocity preserved',abs(env['cloud']['velocityMps'][0]-7)<1e-10)
  check('ocean coordinate units explicit',env['units']['length']=='metre' and env['axes']['north']=='-Z')
  before=page.evaluate('WeatherMother.getState()');draw_after(page,'()=>WeatherMother.play()');n=page.evaluate('WeatherMother.qa.frames')
  page.wait_for_function('(n)=>WeatherMother.qa.frames>=n+3',arg=n,timeout=120000)
  page.evaluate('WeatherMother.pause()');after=page.evaluate('WeatherMother.getState()');check('animation advances cloud advection',after['windOffset'][0]>before['windOffset'][0])
  phase=after['loopPhase'];page.wait_for_timeout(200);check('pause freezes simulation phase',page.evaluate('WeatherMother.getState().loopPhase')==phase)
  check('configuration UI present',page.locator('#saveConfig').count()==1 and page.locator('#loadConfig').count()==1)
  check('no page errors',not errors,errors);check('no failed requests',not failed,failed)
  remote=[u for u in requests if not u.startswith(URL.split('?',1)[0]) and not u.startswith('blob:')]
  check('runtime requests self-contained',not remote,remote)
  report['browser']={'version':browser.version,'viewport':[480,320],'renderer':page.evaluate("(()=>{const g=document.getElementById('scene').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()"),'qa':page.evaluate('WeatherMother.qa')}
  page.close()
  desktop=context.new_page();desktop.set_viewport_size({'width':960,'height':600});desktop.goto(URL,wait_until='domcontentloaded',timeout=60000);wait_ready(desktop)
  check('desktop density resolution preserved',desktop.evaluate('WeatherMother.qa.cloudVolumeBytes')==320*192*256)
  check('desktop framebuffer valid',desktop.evaluate('WeatherMother.qa.framebufferComplete&&WeatherMother.qa.lastGLerror===0'))
  browser.close()
 report['status']='AUTOMATIC_QA_PASS'
except Exception:
 report['status']='FAILED';report['errors'].append(traceback.format_exc());print(report['errors'][-1],flush=True)
finally:
 dest=Path(os.environ.get('WEATHER_QA_REPORT',str(ROOT/'QA.json')));dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(report['status'],len(report['checks']),'checks',flush=True)
if report['status']!='AUTOMATIC_QA_PASS':sys.exit(1)
