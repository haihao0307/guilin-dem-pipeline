import os,sys,json,time,traceback,io,math
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
URL=sys.argv[1];OUT=Path(sys.argv[2]);OUT.mkdir(parents=True,exist_ok=True)
report={'status':'RUNNING','url':URL,'checks':[],'errors':[],'visualApproved':False,'productionApproved':False,'userHardwarePerformanceVerified':False,'source':'real Chromium browser','performanceScope':'software-rendered paused views; no hardware speed claim','version':'0.1.1-coast'}
def check(name,condition,details=None):
 report['checks'].append({'name':name,'passed':bool(condition),'details':details});print(('PASS ' if condition else 'FAIL ')+name,flush=True)
 if not condition:raise AssertionError(name+': '+repr(details))
def rms(a,b):return sum(ImageStat.Stat(ImageChops.difference(a,b)).rms)/3
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':1100,'height':720},device_scale_factor=1)
  errors=[];console=[];failed=[];imageReq=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:console.append(e.text) if e.type=='error' else None);page.on('requestfailed',lambda e:failed.append(e.url));page.on('request',lambda e:imageReq.append(e.url) if e.resource_type=='image' and not e.url.startswith('data:,') else None)
  response=page.goto(URL+'?still',wait_until='domcontentloaded',timeout=60000);check('document 200',response.status==200)
  page.wait_for_function('OceanCoast.qa.ready||OceanCoast.qa.errors.length',timeout=300000)
  check('real water, terrain and volume shaders compile',page.evaluate('OceanCoast.qa.ready&&!OceanCoast.qa.errors.length'),page.evaluate('OceanCoast.qa.errors'))
  page.wait_for_function('OceanCoast.qa.completedFrames>1',timeout=180000)
  check('frozen environment bytes verified',page.evaluate('OceanCoast.qa.sourceIdentity'))
  check('one coast scene canvas',page.locator('canvas').count()==1)
  check('four presentation choices',page.locator('#mode option').count()==4)
  check('separate deep and coast tabs',page.locator('#deepTab').count()==1 and page.locator('#coastTab').count()==1)
  check('domain expanded 2.25 times without coarsening',page.evaluate('(()=>{const s=OceanCoast.getState();return s.nx===216&&s.nz===168&&Math.abs(s.dx-64/144)<1e-10&&Math.abs(s.dz-56/112)<1e-10&&s.stats().domainAreaM2===8064})()'))
  check('lateral solver boundary is explicitly open and accounted',page.evaluate("OceanCoast.getState().stats().lateralBoundary==='open_extrapolated'"))
  check('visible water side joins actual top boundary',page.evaluate('OceanCoast.qa.sectionSeamMaxM<1e-5&&OceanCoast.qa.boundaryVertexMissingCount===0&&OceanCoast.qa.boundaryVerticesChecked>900'),page.evaluate('({seam:OceanCoast.qa.sectionSeamMaxM,missing:OceanCoast.qa.boundaryVertexMissingCount,count:OceanCoast.qa.boundaryVerticesChecked})'))
  check('real solid shadow pass is available',page.evaluate('OceanCoast.qa.solidShadowResolution[0]===2048&&OceanCoast.qa.solidShadowPasses>0'))
  check('ten independent closed rock solids rendered',page.evaluate('OceanCoast.qa.rockSolids===10&&OceanCoast.qa.rockTriangles>200'))
  check('domain dimensions and runtime version match',page.evaluate("OceanCoast.qa.version==='0.1.1-coast'&&OceanCoast.qa.domainMetres[0]===96&&OceanCoast.qa.domainMetres[1]===84"))
  def image(label):
   page.screenshot(path=str(OUT/(label+'.png')),timeout=180000)
   return Image.open(io.BytesIO(page.locator('canvas').screenshot(timeout=180000))).convert('RGB')
  def render(js):
   count=page.evaluate('OceanCoast.qa.frames');page.evaluate(js);page.wait_for_function('(n)=>OceanCoast.qa.frames>n+1',arg=count,timeout=180000)
  base=image('coast_environment');check('nonblank varied scene',sum(ImageStat.Stat(base).stddev)>25)
  original=page.evaluate('OceanCoast.fingerprint()')
  render('OceanCoast.mode(1)');neutral=image('coast_neutral');check('neutral mode changes pixels',rms(base,neutral)>.8)
  render('OceanCoast.mode(2)');studio=image('coast_studio');check('studio changes pixels',rms(neutral,studio)>.8)
  render('OceanCoast.setLight(0,0)');noKey=image('coast_studio_key_off');check('independent key light changes rendered scene',rms(studio,noKey)>.1)
  render('OceanCoast.setLight(0,1.15);OceanCoast.mode(3)');diag=image('coast_diagnostic');check('diagnostic legend visible',page.locator('#legend').is_visible())
  check('all presentation changes preserve water and smoke source state',page.evaluate('OceanCoast.fingerprint()')==original)
  check('diagnostic distinct from beauty',rms(studio,diag)>.8)
  render("OceanCoast.mode(0);OceanCoast.cameraPreset('shore')");near=image('coast_shore');check('shore close-up changes camera',rms(base,near)>1)
  render("OceanCoast.cameraPreset('fire')");fire=image('coast_fire');check('fire view differs from shore',rms(near,fire)>1)
  stats=page.evaluate('OceanCoast.getState().stats()');check('source-tracked water balance',abs(stats['massResidualM3'])<1e-4,stats)
  check('no unexplained negative-water correction',stats['numericalCorrectionM3']==0)
  check('foam and smoke generated by simulation history',stats['foamCoverageMean']>.001 and stats['smokeParticles']>2)
  before=page.evaluate('OceanCoast.getState().t');render('OceanCoast.advanceSteps(240)');after=page.evaluate('OceanCoast.getState().t');check('fixed-step water and smoke advance together',abs(after-before-2)<1e-8)
  changed=image('coast_fire_advanced');check('actual animated render changes',rms(fire,changed)>.1)
  freeze=page.evaluate('OceanCoast.fingerprint()');page.wait_for_timeout(600);check('paused source state stays fixed',page.evaluate('OceanCoast.fingerprint()')==freeze)
  render("OceanCoast.set('direction',90)");env=page.evaluate('OceanCoast.getEnvironment()');check('wind change uses shared convention',env['wind']['velocityMps'][0]<0)
  render("OceanCoast.set('fire',0);OceanCoast.advanceSteps(480)");check('stopped fuel input cools existing fire',page.evaluate('OceanCoast.getState().heat')<.01)
  check('existing smoke persists after fire input stops',page.evaluate('OceanCoast.getState().smokeParticles.length')>0)
  # Runtime replay, including recorded input history, has deterministic source state.
  page.evaluate('OceanCoast.replay()');page.wait_for_function('OceanCoast.qa.lastReplay',timeout=300000)
  check('actual runtime history replay matches state',page.evaluate('OceanCoast.qa.lastReplay.matches'),page.evaluate('OceanCoast.qa.lastReplay'))
  with page.expect_download(timeout=10000) as download:
   page.locator('details').evaluate('(e)=>e.open=true');page.locator('#save').click()
  path=download.value.path();export=json.loads(Path(path).read_text());check('parameter and history JSON export',export['format']=='ocean-coast-history' and export['targetStep']>0 and len(export['events'])>0)
  check('export retains unapproved state',export['visualApproved'] is False and export['productionApproved'] is False)
  check('no imported image requests',not imageReq,imageReq)
  check('no page errors',not errors,errors);check('no console errors',not console,console);check('no failed requests',not failed,failed)
  render("OceanCoast.cameraPreset('all')")
  perf=[]
  for i in range(3):
   a=page.evaluate('OceanCoast.qa.completedFrames');t=time.monotonic();page.wait_for_timeout(6000);b=page.evaluate('OceanCoast.qa.completedFrames');perf.append({'seconds':time.monotonic()-t,'completedFrames':b-a,'physicalTime':page.evaluate('OceanCoast.getState().t'),'paused':True})
  report['desktopPerformanceWindows']=perf
  report['browser']={'version':browser.version,'qa':page.evaluate('OceanCoast.qa'),'viewport':[1100,720],'renderer':page.evaluate("(()=>{const g=document.getElementById('scene').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()")}
  # Avoid changing the preserved deep-sea source; load its ordinary public entry in the tab.
  page.locator('#deepTab').click();page.frame_locator('#deep').locator('#sea').wait_for(timeout=60000);check('deep workbench HTML is reachable inside tab',page.frame_locator('#deep').locator('#presets button').count()==6);page.locator('#coastTab').click();check('return to coast restores controls',page.locator('#coastTab').is_visible())
  page.close()
  mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
  mr=mobile.goto(URL+'?still',wait_until='domcontentloaded',timeout=60000);mobile.wait_for_function('OceanCoast.qa.ready||OceanCoast.qa.errors.length',timeout=300000);check('mobile viewport genuine first frame',mr.status==200 and mobile.evaluate('OceanCoast.qa.ready&&!OceanCoast.qa.errors.length'))
  mobile.wait_for_function('OceanCoast.qa.completedFrames>0',timeout=180000);check('mobile controls initially unobstructed',not mobile.locator('#panel').is_visible());mobile.locator('#panelToggle').click();check('mobile panel opens',mobile.locator('#panel').is_visible());mobile.locator('#panelToggle').click();mobile.screenshot(path=str(OUT/'coast_mobile.png'),timeout=180000)
  mp=[]
  for i in range(3):
   a=mobile.evaluate('OceanCoast.qa.completedFrames');t=time.monotonic();mobile.wait_for_timeout(6000);b=mobile.evaluate('OceanCoast.qa.completedFrames');mp.append({'seconds':time.monotonic()-t,'completedFrames':b-a,'paused':True})
  report['mobilePerformanceWindows']=mp;report['mobileScope']='emulated viewport, controls and render cadence, not a phone hardware test';report['status']='BROWSER_QA_PASS';browser.close()
except Exception:
 report['status']='QA_FAILED';report['errors'].append(traceback.format_exc());print(report['errors'][-1],flush=True)
finally:
 (OUT/'QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(report['status'],len(report['checks']),flush=True)
if report['status']!='BROWSER_QA_PASS':raise SystemExit(1)
