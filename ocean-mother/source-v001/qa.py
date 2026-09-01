import sys,os,json,io,hashlib,math,time,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
ROOT=Path(sys.argv[1]);URL=sys.argv[2];PUBLIC=os.environ.get('PUBLIC_CHECK')=='1'
report={'productionLine':'Ocean Mother','version':'0.1.0','url':URL,'checks':[],'errors':[],'status':'RUNNING','visualAcceptance':False,'aaaQualityApproved':False,'productionReady':False,'userHardwarePerformanceVerified':False,'runtimeImageAssets':0,'pixelComparisonExcludesUI':True}
def check(n,ok,d=None):
 report['checks'].append({'name':n,'pass':bool(ok),'details':d});print(('PASS ' if ok else 'FAIL ')+n,flush=True)
 if not ok:raise AssertionError(n+': '+repr(d))
def delta(a,b):
 s=ImageStat.Stat(ImageChops.difference(a,b));return {'rms':math.sqrt(sum(x*x for x in s.rms)/3),'max':max(x[1] for x in s.extrema)}
try:
 m=json.loads((ROOT/'MANIFEST.json').read_text())
 for n,f in m['files'].items():
  raw=(ROOT/n).read_bytes();assert len(raw)==f['bytes'] and hashlib.sha256(raw).hexdigest()==f['sha256'],n
 check('all source hashes',True)
 baseline=json.loads((ROOT/'weather/MANIFEST.json').read_text())
 for n,f in baseline['files'].items():assert hashlib.sha256((ROOT/'weather'/n).read_bytes()).hexdigest()==f['sha256']
 check('weather original files byte identical',True)
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=b.new_page(viewport={'width':960,'height':600},device_scale_factor=1)
  errors=[];console=[];failed=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda x:console.append(x.text) if x.type=='error' else None);page.on('requestfailed',lambda x:failed.append(x.url))
  r=page.goto(URL+'?still',wait_until='domcontentloaded',timeout=60000);check('document 200',r.status==200)
  page.wait_for_function('window.OceanMother?.qa?.errors?.length || window.OceanMother?.qa?.ready',timeout=240000)
  check('real first frame and shader compile',page.evaluate('OceanMother.qa.ready&&!OceanMother.qa.errors.length'),page.evaluate('OceanMother.qa.errors'))
  page.add_style_tag(content='body.qaClean #mast,body.qaClean #panel,body.qaClean #titleCard,body.qaClean footer,body.qaClean #loading{visibility:hidden!important}')
  def settle():
   page.wait_for_function('OceanMother.qa.errors.length || (!OceanMother.getReadiness().baking&&!OceanMother.getReadiness().envForce&&!OceanMother.getReadiness().lightBusy&&OceanMother.getReadiness().envMix>=1)',timeout=200000)
   assert not page.evaluate('OceanMother.qa.errors')
  def img():
   page.evaluate("document.body.classList.add('qaClean')")
   try:return Image.open(io.BytesIO(page.locator('canvas').screenshot(timeout=90000))).convert('RGB')
   finally:page.evaluate("document.body.classList.remove('qaClean')")
  def render_after(js,arg=None):
   n=page.evaluate('OceanMother.qa.frames');page.evaluate(js,arg);page.wait_for_function('(n)=>OceanMother.qa.errors.length||OceanMother.qa.frames>n',arg=n,timeout=90000);settle()
  settle();base=img();stat=ImageStat.Stat(base);check('nonblank varied real image without UI',sum(stat.stddev)>20,stat.stddev)
  check('one shared canvas',page.locator('canvas').count()==1)
  check('six sea cases',page.locator('[data-preset]').count()==6)
  check('ten cloud genera retained',page.locator('#kind option').count()==10)
  check('weather shader validated in browser',page.evaluate('OceanMother.qa.baselineVerified'))
  check('empty boundary remains valid',page.evaluate('OceanMother.qa.borderInputMax')==0)
  check('water geometry rendered',page.evaluate('OceanMother.qa.meshTriangles')>10000)
  check('wave steepness bound below folding',page.evaluate('OceanMother.qa.maxSteepnessBound')<.71)
  if not PUBLIC:
   Path('/tmp/ocean-preview').mkdir(exist_ok=True);page.screenshot(path='/tmp/ocean-preview/breeze.png',timeout=90000)
  original=page.evaluate('OceanMother.getConfiguration()')
  render_after("()=>OceanMother.set('direction',270)");render_after("()=>OceanMother.set('wind',14)");env=page.evaluate('OceanMother.getEnvironment()')
  check('west wind points east',env['wind']['direction'][0]>.999 and abs(env['wind']['direction'][2])<1e-8)
  render_after("()=>OceanMother.set('cloudSpeed',3)");env=page.evaluate('OceanMother.getEnvironment()');check('wind and cloud drift independent',env['wind']['forceMps']==14 and env['cloud']['driftMps']==3)
  render_after("()=>OceanMother.set('swell',4)");large=img();d=delta(base,large);check('wave scale changes actual pixels',d['rms']>1,d)
  render_after("()=>OceanMother.set('tint',.95)");color=img();d=delta(large,color);check('water colour changes actual pixels',d['rms']>.3,d)
  for key in ['calm','swell','golden','gale','lagoon','breeze']:
   n=page.evaluate('OceanMother.qa.cloudAtlasFrames');page.evaluate('(k)=>OceanMother.setPreset(k)',key)
   page.wait_for_function('(n)=>OceanMother.qa.errors.length||OceanMother.qa.cloudAtlasFrames>n',arg=n,timeout=200000);settle()
   q=page.evaluate('OceanMother.qa');check('sea preset '+key,q['lastGLerror']==0 and not q['errors'],{'atlasHour':q.get('atlasHour'),'cloud':q['cloudKind']})
   if not PUBLIC and key in ['golden','lagoon']:page.screenshot(path='/tmp/ocean-preview/'+key+'.png',timeout=90000)
  frozen=img();n=page.evaluate('OceanMother.qa.frames');t0=page.evaluate('OceanMother.qa.waveTime');page.evaluate('OceanMother.play()')
  page.wait_for_function('(n)=>OceanMother.qa.errors.length||OceanMother.qa.frames>=n+8',arg=n,timeout=200000)
  check('animation runs without errors',not page.evaluate('OceanMother.qa.errors'),page.evaluate('OceanMother.qa.errors'))
  report['activePerformance']=page.evaluate('OceanMother.qa.performance');page.evaluate('OceanMother.pause()');settle();moving=img();d=delta(frozen,moving);check('water actually animates',d['rms']>.2,d)
  t=page.evaluate('OceanMother.qa.waveTime');check('wave clock advanced',t>t0);page.wait_for_timeout(250);check('pause freezes wave clock',page.evaluate('OceanMother.qa.waveTime')==t)
  render_after('()=>OceanMother.setView(-1.0,-.24,4)');changed=img();check('camera view changes image',delta(moving,changed)['rms']>.5)
  check('camera stays above surface',page.evaluate('OceanMother.qa.camera.cam[1]')>=1.6)
  check('configuration is JSON data',page.evaluate('OceanMother.getConfiguration().format')=='ocean-mother-scene')
  report['browser']={'version':b.version,'renderer':page.evaluate("(()=>{const g=document.getElementById('sea').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()"),'qa':page.evaluate('OceanMother.qa')}
  check('no page errors',not errors,errors);check('no console errors',not console,console);check('no failed requests',not failed,failed)
  page.close();mobile=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1);mobile.goto(URL+'?still',wait_until='domcontentloaded',timeout=60000);mobile.wait_for_function('window.OceanMother?.qa?.ready||window.OceanMother?.qa?.errors?.length',timeout=200000);check('mobile first frame',mobile.evaluate('OceanMother.qa.ready&&!OceanMother.qa.errors.length'));check('mobile controls available',mobile.locator('#togglePanel').count()==1)
  b.close()
 report['status']='BROWSER_QA_PASS'
except Exception:
 report['status']='QA_FAILED';report['errors'].append(traceback.format_exc());print(report['errors'][-1],flush=True)
finally:
 (ROOT/('PUBLIC_QA.json' if PUBLIC else 'QA.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print('RESULT',report['status'],len(report['checks']),flush=True)
if report['status']!='BROWSER_QA_PASS':raise SystemExit(1)
