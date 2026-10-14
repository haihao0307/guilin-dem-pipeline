from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import os,json,hashlib,time,traceback
OUT=Path(os.environ.get('QA_OUT','p02-evidence'));OUT.mkdir(exist_ok=True,parents=True)
BASE=os.environ.get('BASE_URL','http://127.0.0.1:8873/knit-public-p02/index.html')
P01='http://127.0.0.1:8873/knit-public-p01/index.html'
report={'version':'KNIT-PUBLIC-P02','url':BASE,'sourceCommit':os.getenv('GITHUB_SHA'),'checks':{},'errors':[],'console':[],'visualAccepted':False,'referenceMatched':False,'device':'Chromium SwiftShader; no consumer GPU FPS or phone-hardware claim'}
def ck(k,v):
 report['checks'][k]=bool(v)
 if not v:raise AssertionError(k)
def delta(a,b):
 a=Image.open(OUT/a).convert('RGB');b=Image.open(OUT/b).convert('RGB');d=ImageChops.difference(a,b)
 stat=ImageStat.Stat(d);hist=d.convert('L').histogram();n=a.width*a.height
 return {'meanAbsBytes':sum(stat.mean)/3,'fractionAbove4':sum(hist[5:])/n}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1400,'height':1000},device_scale_factor=1);page.set_default_timeout(120000)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.on('console',lambda e:report['console'].append(e.text) if e.type=='error' else None)
 try:
  start=time.monotonic();page.goto(BASE,wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('window.KnitPublic&&KnitPublic.report().ready',timeout=240000)
  report['loadWallSeconds']=time.monotonic()-start
  ck('newVersion',page.evaluate('KnitPublic.version')=='KNIT-PUBLIC-P02')
  initial=page.evaluate('KnitPublic.report()');report['initial']=initial
  ck('defaultFibreOn',initial['settings']['mode']=='fiber' and initial['settings']['detail']==1)
  ck('jacketDrawn',initial['jacket']['fibres']==30720)
  def shot(name,view='whole',values=None):
   print('RENDER',name,flush=True)
   page.evaluate('p=>{if(p[1])KnitPublic.set(p[1]);KnitPublic.view(p[0]);KnitPublic.render();}',[view,values]);page.wait_for_timeout(700)
   bounds=page.locator('#stage canvas').bounding_box()
   page.screenshot(path=str(OUT/(name+'.png')),clip=bounds,timeout=180000)
   state=page.evaluate('KnitPublic.report()');ck(name+'_gl',state['glError']==0);return state
  shot('default-fibre');page.screenshot(path=str(OUT/'default-ui.png'),timeout=180000)
  shot('default-without-laid-fibres',values={'detail':0})
  report['defaultLaidContribution']=delta('default-fibre.png','default-without-laid-fibres.png')
  ck('visibleAtDefaultScale',report['defaultLaidContribution']['meanAbsBytes']>.75 and report['defaultLaidContribution']['fractionAbove4']>.025)
  shot('close-fibre','close',{'detail':1});shot('close-carrier','close',{'mode':'carrier'})
  report['closeDifference']=delta('close-fibre.png','close-carrier.png')
  shot('grazing-fibre','edge',{'mode':'fiber'});shot('back-fibre','back')
  ck('materialDoesNotResetEB1',page.evaluate('KnitPublic.report().lighting.fingerprint')==initial['lighting']['fingerprint'])
  ck('noRebuildForFibreSliders',page.evaluate('KnitPublic.report().builds')==initial['builds'])
  page.locator('[data-param="fuzz"]').evaluate('el=>{el.value=".6";el.dispatchEvent(new Event("input",{bubbles:true}));}')
  ck('actualSliderEvent',abs(page.evaluate('KnitPublic.report().settings.fuzz')-.6)<1e-7)
  ck('rejectInvalid',page.evaluate('()=>{try{KnitPublic.set({fuzz:NaN});return false}catch(e){return true}}'))
  page.reload(wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.KnitPublic&&KnitPublic.report().ready',timeout=240000)
  ck('reloadPersists',abs(page.evaluate('KnitPublic.report().settings.fuzz')-.6)<1e-7)
  page.evaluate('document.getElementById("reset").click();KnitPublic.render()')
  page.set_viewport_size({'width':855,'height':866});page.wait_for_timeout(800)
  report['screenshotSized']=shot('user-scale-fibre')
  shot('user-scale-carrier',values={'mode':'carrier'})
  report['userScaleDifference']=delta('user-scale-fibre.png','user-scale-carrier.png')
  ck('userScaleVisible',report['userScaleDifference']['meanAbsBytes']>1)
  page.evaluate('KnitPublic.set({mode:"fiber",pattern:"stripe"});KnitPublic.render()');page.wait_for_timeout(500)
  ck('patternChangesAndEB1Stable',page.evaluate('KnitPublic.report().settings.pattern')=='stripe' and page.evaluate('KnitPublic.report().lighting.fingerprint')==initial['lighting']['fingerprint'])
  page.evaluate('document.getElementById("reset").click();KnitPublic.view("whole");KnitPublic.render()')
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(700);page.screenshot(path=str(OUT/'narrow-viewport.png'),timeout=180000)
  ck('narrowNoHorizontalOverflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  report['final']=page.evaluate('KnitPublic.report()');ck('noPageErrors',not report['errors']);ck('noConsoleErrors',not report['console'])
  if BASE.startswith('http://127.'):
   page.set_viewport_size({'width':855,'height':866});shot('P02-frontal-for-P01','frontal');page.goto(P01,wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.KnitPublic&&KnitPublic.report().ready',timeout=120000)
   page.evaluate('document.getElementById("reset").click();KnitPublic.view("whole");KnitPublic.render()');page.wait_for_timeout(700)
   page.screenshot(path=str(OUT/'P01-same-scale.png'),clip=page.locator('#stage canvas').bounding_box(),timeout=180000)
   report['oldVsNew']=delta('P02-frontal-for-P01.png','P01-same-scale.png')
  report['passed']=True
 except Exception as e:
  report['passed']=False;report['error']=str(e);report['trace']=traceback.format_exc()
  try:page.screenshot(path=str(OUT/'failure.png'),timeout=60000)
  except:pass
 finally:
  report['images']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.glob('*.png')};(OUT/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
print(json.dumps(report,ensure_ascii=False));raise SystemExit(0 if report.get('passed') else 1)
