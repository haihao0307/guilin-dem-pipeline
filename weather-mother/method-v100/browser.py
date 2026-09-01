"""Real browser regression. Render pixels remain in memory; store hashes and numbers only."""
import io,os,json,time,math,traceback,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
R=Path(__file__).resolve().parent
URL=os.environ.get('WEATHER_URL','http://127.0.0.1:8810/weather-mother/method-v100/')
report={'status':'RUNNING','checks':[],'url':URL,'visualApproved':False,'productionApproved':False,'wholeLineIntegrated':False,'rendererScope':'SwiftShader functional testing only; no user device FPS approval','storedImageFiles':0,'renderEvidence':{}}
def check(n,b,d=None):
 report['checks'].append({'name':n,'pass':bool(b),'details':d});print(('PASS ' if b else 'FAIL ')+n,flush=True)
 if not b:raise AssertionError(n+': '+repr(d))
def diff(a,b):
 st=ImageStat.Stat(ImageChops.difference(a,b));return {'max':max(e[1] for e in st.extrema),'rms':math.sqrt(sum(v*v for v in st.rms)/3)}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':600,'height':400},device_scale_factor=1);errors=[];requests=[];console=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:requests.append(r.url));page.on('console',lambda m:console.append(m.text) if m.type=='error' else None)
  res=page.goto(URL,wait_until='domcontentloaded',timeout=60000);check('document HTTP 200',res.status==200)
  page.wait_for_function('window.WeatherMethod?.qa?.errors?.length||window.WeatherMethod?.qa?.ready&&WeatherMethod.qa.frames>0',timeout=120000)
  check('actual WebGL shader and first frame',page.evaluate('WeatherMethod.qa.ready&&WeatherMethod.qa.lastGLerror===0'),page.evaluate('WeatherMethod.qa.errors'))
  page.add_style_tag(content='body.testing header,body.testing aside,body.testing .badge,body.testing #legend{visibility:hidden!important}')
  def img():
   page.evaluate("document.body.classList.add('testing')")
   b=page.locator('canvas').screenshot(timeout=120000)
   page.evaluate("document.body.classList.remove('testing')")
   return Image.open(io.BytesIO(b)).convert('RGB')
  def render(js):
   n=page.evaluate('WeatherMethod.qa.frames');page.evaluate(js);page.wait_for_function('(n)=>WeatherMethod.qa.errors.length||WeatherMethod.qa.frames>n',arg=n,timeout=90000)
   if page.evaluate('WeatherMethod.qa.errors'):raise RuntimeError(page.evaluate('WeatherMethod.qa.errors'))
  def evidence(name,image):
   report['renderEvidence'][name]={'nativePixels':page.evaluate('WeatherMethod.qa.nativeRenderSize'),'displayPixels':page.evaluate('WeatherMethod.qa.displaySize'),'rgbPixelSHA256':hashlib.sha256(image.tobytes()).hexdigest(),'imageByteArrayStored':False,'dataHashes':page.evaluate('WeatherMethod.qa.dataHashes'),'state':page.evaluate('WeatherMethod.getState()'),'presentation':page.evaluate('WeatherMethod.getPresentation()')}
  initial=page.evaluate('WeatherMethod.getState()');hashes=page.evaluate('WeatherMethod.qa.dataHashes');neutral=img();evidence('neutral_inspection',neutral)
  check('nonblank cloud render',sum(ImageStat.Stat(neutral).stddev)>15,ImageStat.Stat(neutral).stddev)
  render("WeatherMethod.setMode('studio_beauty')");beauty=img();evidence('studio_beauty',beauty);check('studio produces distinct pixels',diff(neutral,beauty)['rms']>.1)
  for k in range(3):
   render(f'WeatherMethod.setLight({k},{{enabled:false}})');off=img();check('light '+str(k)+' independently affects pixels',diff(beauty,off)['rms']>.03,diff(beauty,off));render(f'WeatherMethod.setLight({k},{{enabled:true}})')
  check('presentation never changes source state',page.evaluate('WeatherMethod.getState()')==initial)
  check('presentation never changes source data hashes',page.evaluate('WeatherMethod.qa.dataHashes')==hashes)
  render("WeatherMethod.setMode('diagnostic')");tau=img();evidence('diagnostic',tau);check('diagnostic actual optical thickness',diff(beauty,tau)['rms']>5)
  render('WeatherMethod.setDiagnostic(2)');density=img();check('volume cross-section renders',diff(tau,density)['rms']>1)
  render('WeatherMethod.setDiagnostic(3)');depth=img();check('depth diagnostic differs',diff(density,depth)['rms']>1)
  render("WeatherMethod.setMode('neutral_inspection')");restore=img();check('neutral roundtrip restores exact frame on same GPU',diff(neutral,restore)['max']<=1,diff(neutral,restore))
  expected=[1.644118884812544,1.9013271546806005,11.66688032990602];actual=page.evaluate('WeatherMethod.qa.camera');check('neutral fixes comparison camera',max(abs(a-b) for a,b in zip(actual,expected))<1e-12,actual)
  state=page.evaluate('WeatherMethod.exportState()');check('effective parameter hash exported',len(state['effectiveParametersSha256'])==64)
  check('policy gates generation and export',page.evaluate('WeatherMethod.guard.counts.generate')>=2 and page.evaluate('WeatherMethod.guard.counts.export')>=1)
  check('production approval blocked',page.evaluate("(()=>{try{WeatherMethod.attemptProduction();return false}catch(e){return e.message.includes('ACCEPTANCE_BLOCKED')}})()"))
  check('unknown domain control blocked',page.evaluate("(()=>{try{WeatherMethod.setDriver('overrideCore',true);return false}catch(e){return true}})()"))
  render("WeatherMethod.setDriver('cloudSpeedMps',0);WeatherMethod.setDriver('humidity',0);WeatherMethod.advance(60,1)")
  dry=img();check('humidity history visibly reduces cloud',diff(neutral,dry)['rms']>1,diff(neutral,dry))
  check('same driver reduces shared concentration',page.evaluate('WeatherMethod.getState().concentration')<.01)
  render("WeatherMethod.setMode('diagnostic');WeatherMethod.setDiagnostic(1)");tauDry=img();evidence('causal_output_dry',tauDry);check('same driver reduces optical-thickness output',diff(tau,tauDry)['rms']>1)
  render("WeatherMethod.seek(0);WeatherMethod.setMode('neutral_inspection')");replay=img();check('replay at initial time restores pixels',diff(neutral,replay)['max']<=1,diff(neutral,replay))
  old=page.evaluate('WeatherMethod.qa.dataHashes.density');n=page.evaluate('WeatherMethod.qa.frames');page.evaluate('WeatherMethod.rebuild()');page.wait_for_function('(n)=>WeatherMethod.qa.ready&&WeatherMethod.qa.frames>n',arg=n,timeout=120000)
  check('same identity regenerates same density bytes',page.evaluate('WeatherMethod.qa.dataHashes.density')==old)
  check('source boundary zero',page.evaluate('WeatherMethod.qa.borderMax')==0)
  check('no browser errors',not errors,errors);check('no failed requests',not requests,requests);check('no console errors',not console,console)
  report['desktop']={'browserVersion':browser.version,'renderer':page.evaluate("(()=>{const g=document.getElementById('scene').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()"),'nativePixels':page.evaluate('WeatherMethod.qa.nativeRenderSize'),'displayPixels':page.evaluate('WeatherMethod.qa.displaySize'),'qa':page.evaluate('WeatherMethod.qa'),'consoleErrors':console,'failedRequests':requests};page.close()
  mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1);mobile.goto(URL,wait_until='domcontentloaded');mobile.wait_for_function('WeatherMethod.qa.errors.length||WeatherMethod.qa.ready&&WeatherMethod.qa.frames>0',timeout=120000);check('mobile independently renders',mobile.evaluate('WeatherMethod.qa.ready&&WeatherMethod.qa.lastGLerror===0'));report['mobile']={'nativePixels':mobile.evaluate('WeatherMethod.qa.nativeRenderSize'),'displayPixels':mobile.evaluate('WeatherMethod.qa.displaySize')};mobile.close()
  broken=browser.new_page();broken.route('**/policy.json',lambda route:route.fulfill(status=200,content_type='application/json',body='{}'));broken.goto(URL,wait_until='domcontentloaded');broken.wait_for_function('WeatherMethod.qa.errors.length',timeout=30000);check('tampered policy blocks browser generation',not broken.evaluate('WeatherMethod.qa.ready') and broken.evaluate('WeatherMethod.qa.frames')==0);broken.close();browser.close()
 report['status']='PASS'
except Exception:
 report['status']='FAIL';report['error']=traceback.format_exc();print(report['error'],flush=True)
finally:
 name='PUBLIC_TESTS.json' if os.environ.get('WEATHER_URL') else 'BROWSER_TESTS.json';(R/name).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(report['status'],len(report['checks']),flush=True)
if report['status']!='PASS':raise SystemExit(1)
