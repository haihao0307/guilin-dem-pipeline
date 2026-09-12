"""Actual browser interaction. LOCAL mode loads the full HTML document.
CI mode navigates real HTTP and verifies its bytes before rendering.
Never treats software rendering as a physical-phone performance test.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import hashlib,json,os,sys,time
root=Path(__file__).resolve().parents[1]
local=os.environ.get('LM_LOCAL')=='1'
url=sys.argv[1] if len(sys.argv)>1 else ''
label=sys.argv[2] if len(sys.argv)>2 else 'local'
site=Path(os.environ.get('LM_SITE',str(root)))
out=Path(os.environ.get('LM_EVIDENCE',str(root/'qa')));out.mkdir(parents=True,exist_ok=True)
file=site/('Landscape_Mother_Erosion.html' if local else 'index.html')
raw=file.read_bytes();expected=hashlib.sha256(raw).hexdigest()
with sync_playwright() as p:
 args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']
 options={'headless':not local,'args':args}
 if local:options['executable_path']='/usr/bin/chromium'
 browser=p.chromium.launch(**options)
 for mobile in (False,True):
  profile='mobile' if mobile else 'desktop';started=time.perf_counter()
  ctx=browser.new_context(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 840},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
  page=ctx.new_page();page.set_default_timeout(30000);errors=[];requests=[];checks=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
  def check(name,ok,data=None):
   checks.append({'name':name,'passed':bool(ok),'data':data});print(profile,name,ok,flush=True)
   assert ok,name
  def ready(seed=83):
   page.wait_for_function('(s)=>window.__LM_ERROR__||(window.__LM_READY__&&window.__LM__.report.config.seed===s)',arg=seed,timeout=180000)
   check('generation ready '+str(seed),page.evaluate('window.__LM_READY__===true'),page.evaluate('window.__LM_ERROR__||null'))
  def audit(name,shot=False):
   a=page.evaluate('window.__LM__.auditFrame()');check('render '+name,a['nonzeroSamples']>100 and a['unique']>25 and a['glError']==0,a)
   if shot:page.screenshot(path=str(out/(label+'-'+profile+'-'+name+'.png')),timeout=30000)
  try:
   if local:page.set_content(raw.decode(),wait_until='domcontentloaded')
   else:
    r=page.goto(url,wait_until='domcontentloaded',timeout=60000)
    check('exact HTTP 200 payload',r.status==200 and hashlib.sha256(r.body()).hexdigest()==expected)
   ready()
   check('correct candidate',page.evaluate("window.__LM__.release==='limestone-water-2'"))
   before=page.evaluate('window.__LM__.bufferFingerprint()');saved=page.evaluate('window.__LM__.getState()')
   check('all static contacts supported',page.evaluate('window.__LM__.report.supports.every(s=>s.centerInsideSupportHull&&s.minimumGapM<=0&&s.minimumGapM>=-.221)'))
   for v in ('hero','cliff','cave','foot','back','section','stone'):
    page.locator('[data-view="'+v+'"]').click();audit(v,v in ('hero','cave','foot','stone'))
   check('camera leaves geometry unchanged',page.evaluate('window.__LM__.bufferFingerprint()')==before)
   page.locator('#panelbtn').click()
   for mode in (1,2,3,4,0):
    page.locator('[data-mode="'+str(mode)+'"]').click();audit('mode'+str(mode))
   page.locator('#wet').evaluate('(e)=>{e.value=.8;e.dispatchEvent(new Event("input",{bubbles:true}))}')
   page.locator('#micro').evaluate('(e)=>{e.value=.45;e.dispatchEvent(new Event("input",{bubbles:true}))}')
   check('material controls preserve geometry',page.evaluate('window.__LM__.state.wet===.8&&window.__LM__.state.micro===.45') and page.evaluate('window.__LM__.bufferFingerprint()')==before)
   with page.expect_download() as d:page.locator('#export').click()
   dest=out/(label+'-'+profile+'-view.json');d.value.save_as(str(dest))
   check('real JSON export',json.loads(dest.read_text())==page.evaluate('window.__LM__.getState()'))
   page.locator('#closepanel').click()
   if mobile:
    theta=page.evaluate('window.__LM__.state.theta');cdp=ctx.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':170,'y':330}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':220,'y':350}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    check('native touch rotation',theta!=page.evaluate('window.__LM__.state.theta'))
    radius=page.evaluate('window.__LM__.state.radius')
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':140,'y':370},{'x':230,'y':370}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':110,'y':370},{'x':265,'y':370}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    check('native pinch zoom',radius>page.evaluate('window.__LM__.state.radius'))
   else:
    theta=page.evaluate('window.__LM__.state.theta');page.mouse.move(840,330);page.mouse.down();page.mouse.move(905,365);page.mouse.up()
    check('mouse rotation',theta!=page.evaluate('window.__LM__.state.theta'))
    radius=page.evaluate('window.__LM__.state.radius');page.mouse.wheel(0,-100);page.wait_for_timeout(100)
    check('wheel zoom',radius>page.evaluate('window.__LM__.state.radius'))
   page.locator('#nextseed').click();ready(211)
   check('one-click seed changes actual mesh',before!=page.evaluate('window.__LM__.bufferFingerprint()'))
   check('new seed contacts verified',page.evaluate('window.__LM__.report.supports.every(s=>s.centerInsideSupportHull)'))
   audit('seed211',True)
   page.locator('#file').set_input_files({'name':'saved.json','mimeType':'application/json','buffer':json.dumps(saved).encode()});ready(83)
   check('real JSON restores same geometry',before==page.evaluate('window.__LM__.bufferFingerprint()'))
   check('restored view state exact',page.evaluate('window.__LM__.getState()')==saved)
   bad=page.evaluate('''async()=>{let s=window.__LM__.getState(),t=JSON.parse(JSON.stringify(s));t.recipe.seed=0;try{await window.__LM__.restoreState(t);return false}catch(e){return JSON.stringify(s)===JSON.stringify(window.__LM__.getState())}}''')
   check('invalid seed refused without mutation',bad)
   check('no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   if mobile:
    sizes=page.locator('header button,nav.views button').evaluate_all('(es)=>es.filter(e=>e.getBoundingClientRect().width>0).map(e=>[e.getBoundingClientRect().width,e.getBoundingClientRect().height])')
    check('44px primary touch targets',all(a>=44 and b>=44 for a,b in sizes),sizes)
   check('single active CPU candidate',page.evaluate('window.__LM__.cacheSize')==1)
   check('no script/GL errors',not errors and not page.evaluate('window.__LM__.errors'),errors)
   check('no external runtime assets',not [r for r in requests if r.startswith('http') and r.split('?')[0]!=url.split('?')[0]],requests)
   report={'passed':True,'label':label,'profile':profile,'sha256':expected,'checks':checks,'requests':requests,'errors':errors,'seconds':round(time.perf_counter()-started,2),'startupBuildMs':page.evaluate('window.__LM__.report.builtInMs'),'buffers':page.evaluate('window.__LM__.report.generatedRenderBytes'),'load':'set_content' if local else 'HTTP','physicalPhone':False,'renderer':'Chromium SwiftShader'}
   (out/(label+'-'+profile+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2))
  except Exception as e:
   (out/(label+'-'+profile+'.json')).write_text(json.dumps({'passed':False,'error':str(e),'checks':checks,'pageErrors':errors},ensure_ascii=False,indent=2));raise
  finally:ctx.close()
 browser.close()
