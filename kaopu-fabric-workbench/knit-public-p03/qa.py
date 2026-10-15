from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import os,json,hashlib,time,traceback

OUT=Path(os.environ.get('QA_OUT','p03-evidence'));OUT.mkdir(exist_ok=True,parents=True)
BASE=os.environ.get('BASE_URL','http://127.0.0.1:8873/knit-public-p03/index.html')
P02=os.environ.get('P02_URL','http://127.0.0.1:8873/knit-public-p02/index.html')
report={'version':'KNIT-PUBLIC-P03','url':BASE,'sourceCommit':os.getenv('GITHUB_SHA'),'checks':{},'errors':[],'console':[],'visualAccepted':False,'referenceMatched':False,'device':'Chromium SwiftShader; no consumer GPU FPS or phone-hardware claim'}
def ck(name,value):
 report['checks'][name]=bool(value)
 if not value:raise AssertionError(name)
def delta(a,b):
 a=Image.open(OUT/a).convert('RGB');b=Image.open(OUT/b).convert('RGB');d=ImageChops.difference(a,b);stat=ImageStat.Stat(d);hist=d.convert('L').histogram();n=a.width*a.height
 return {'meanAbsBytes':sum(stat.mean)/3,'fractionAbove4':sum(hist[5:])/n,'fractionAbove12':sum(hist[13:])/n}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1400,'height':1000},device_scale_factor=1);page.set_default_timeout(180000)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.on('console',lambda e:report['console'].append(e.text) if e.type=='error' else None)
 try:
  start=time.monotonic();page.goto(BASE,wait_until='domcontentloaded',timeout=180000);page.wait_for_function('window.KnitPublic&&KnitPublic.report().ready',timeout=300000);report['loadWallSeconds']=time.monotonic()-start
  initial=page.evaluate('KnitPublic.report()');report['initial']=initial
  ck('newVersion',initial['version']=='KNIT-PUBLIC-P03')
  ck('strongerDefaultEnvelope',abs(initial['settings']['fuzz']-1.18)<1e-7 and abs(initial['settings']['length']-1.15)<1e-7)
  coat=initial['woolEnvelope'];ck('finiteStaplesBuilt',coat['stapleFibres']==56320 and coat['stapleSegments']==12)
  ck('haloBuilt',coat['haloFibres']==102400 and coat['haloSegments']==4)
  ck('shellsBuilt',coat['shellLayers']==2)
  ck('legacyRegularLayerDisabled',initial['jacket'] is None and initial['hairCount']==0)
  def shot(name,view='whole',values=None,viewport=None):
   if viewport:page.set_viewport_size(viewport)
   page.evaluate('p=>{if(p[1])KnitPublic.set(p[1]);KnitPublic.view(p[0]);KnitPublic.render();}',[view,values]);page.wait_for_timeout(1000)
   bounds=page.locator('#stage canvas').bounding_box();page.screenshot(path=str(OUT/(name+'.png')),clip=bounds,timeout=240000)
   state=page.evaluate('KnitPublic.report()');ck(name+'_gl',state['glError']==0);return state
  shot('default-wool');page.screenshot(path=str(OUT/'default-ui.png'),timeout=240000)
  shot('default-carrier',values={'mode':'carrier'});report['defaultEnvelopeContribution']=delta('default-wool.png','default-carrier.png')
  ck('envelopeClearlyVisible',report['defaultEnvelopeContribution']['meanAbsBytes']>1.2 and report['defaultEnvelopeContribution']['fractionAbove4']>.04)
  shot('close-wool','close',{'mode':'fiber'});shot('close-carrier','close',{'mode':'carrier'});report['closeEnvelopeContribution']=delta('close-wool.png','close-carrier.png')
  ck('closeEnvelopeVisible',report['closeEnvelopeContribution']['meanAbsBytes']>1.4)
  shot('low-fuzz','close',{'mode':'fiber','fuzz':.35,'length':.75});shot('high-fuzz','close',{'fuzz':1.35,'length':1.35});report['fuzzRangeContribution']=delta('high-fuzz.png','low-fuzz.png')
  ck('fuzzControlHasRange',report['fuzzRangeContribution']['meanAbsBytes']>.55 and report['fuzzRangeContribution']['fractionAbove4']>.015)
  shot('grazing-wool','edge',{'fuzz':1.18,'length':1.15})
  ck('materialDoesNotResetEB1',page.evaluate('KnitPublic.report().lighting.fingerprint')==initial['lighting']['fingerprint'])
  ck('fibreSlidersAvoidRebuild',page.evaluate('KnitPublic.report().builds')==initial['builds'])
  page.locator('[data-param="fuzz"]').evaluate('el=>{el.value="1.27";el.dispatchEvent(new Event("input",{bubbles:true}));}')
  ck('actualSliderEvent',abs(page.evaluate('KnitPublic.report().settings.fuzz')-1.27)<1e-7)
  ck('rejectInvalid',page.evaluate('()=>{try{KnitPublic.set({fuzz:2.2});return false}catch(e){return true}}'))
  page.reload(wait_until='domcontentloaded',timeout=180000);page.wait_for_function('window.KnitPublic&&KnitPublic.report().ready',timeout=300000)
  ck('reloadPersists',abs(page.evaluate('KnitPublic.report().settings.fuzz')-1.27)<1e-7)
  page.evaluate('document.getElementById("reset").click();KnitPublic.render()');page.wait_for_timeout(700)
  shot('user-scale-wool','whole',None,{'width':855,'height':866});shot('user-scale-carrier','whole',{'mode':'carrier'});report['userScaleDifference']=delta('user-scale-wool.png','user-scale-carrier.png');ck('userScaleVisible',report['userScaleDifference']['meanAbsBytes']>1)
  page.evaluate('KnitPublic.set({mode:"fiber"});KnitPublic.render()');page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(900);page.screenshot(path=str(OUT/'narrow-viewport.png'),timeout=240000)
  ck('narrowNoHorizontalOverflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  final=page.evaluate('KnitPublic.report()');report['final']=final;ck('noPageErrors',not report['errors']);ck('noConsoleErrors',not report['console'])
  if BASE.startswith('http://127.'):
   page.set_viewport_size({'width':855,'height':866});page.goto(BASE,wait_until='domcontentloaded',timeout=180000);page.wait_for_function('window.KnitPublic&&KnitPublic.report().ready',timeout=300000);page.evaluate('document.getElementById("reset").click();KnitPublic.view("frontal");KnitPublic.render()');page.wait_for_timeout(900);page.screenshot(path=str(OUT/'P03-frontal.png'),clip=page.locator('#stage canvas').bounding_box(),timeout=240000)
   page.goto(P02,wait_until='domcontentloaded',timeout=180000);page.wait_for_function('window.KnitPublic&&KnitPublic.report().ready',timeout=300000);page.evaluate('document.getElementById("reset").click();KnitPublic.view("frontal");KnitPublic.render()');page.wait_for_timeout(900);page.screenshot(path=str(OUT/'P02-frontal.png'),clip=page.locator('#stage canvas').bounding_box(),timeout=240000)
   report['P02vsP03']=delta('P03-frontal.png','P02-frontal.png');ck('notByteEquivalentToP02',report['P02vsP03']['meanAbsBytes']>.35)
  report['passed']=True
 except Exception as exc:
  report['passed']=False;report['error']=str(exc);report['trace']=traceback.format_exc()
  try:page.screenshot(path=str(OUT/'failure.png'),timeout=60000)
  except Exception:pass
 finally:
  report['images']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.glob('*.png')};(OUT/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
print(json.dumps(report,ensure_ascii=False));raise SystemExit(0 if report.get('passed') else 1)
