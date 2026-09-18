"""Actual Chromium tests; QA relocation is labelled, actions use the visible interface."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import threading,json,traceback,os,signal
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'releases/v0.2.0';EVIDENCE=Path('/tmp/stone-money-v0200-qa');EVIDENCE.mkdir(exist_ok=True)
server=ThreadingHTTPServer(('127.0.0.1',8765),partial(SimpleHTTPRequestHandler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
base=os.environ.get('SMI_PUBLIC_URL','http://127.0.0.1:8765/releases/v0.2.0/index.html')
report={'version':'0.2.0','url':base,'browserPassed':False,'physicalDeviceTest':False,'visualAcceptance':False,'cases':[],'notes':['Rendered UI and movement tested. QA relocation used between stations to bound software-GPU duration. Controlled-timestep tests separately cover patrol and transaction logic.']}
file=OUT/('PUBLIC_BROWSER_QA.json' if base.startswith('https://') else 'BROWSER_QA.json')
def save():
 file.write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'cases':[(v['name'],v.get('step'),v.get('passed')) for v in report['cases']]}),flush=True)
def phase(r,step):r['step']=step;save()
def snapshot(page,name):
 page.evaluate("Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('GPU review timeout')),25000))])")
 try:page.screenshot(path=str(EVIDENCE/(name+'.png')),timeout=15000)
 finally:page.evaluate('OceanIsland.resumeFromReview()')
def aim(page,id):
 page.evaluate('StoneMoneySurvival.test.advance(.6)')
 page.evaluate('StoneMoneySurvival.test.advance(.6)')
 page.evaluate('''id=>{const g=StoneMoneySurvival,d=g.getDefinitions().find(o=>o.id===id),p=d.position,x=p[0]+.65,z=p[2]+.9,y=g.ground(x,z)+1.64;g.test.position(x,z,Math.atan2(p[0]-x,-(p[2]-z)),Math.atan2(p[1]-y,Math.hypot(p[0]-x,p[2]-z)));}''',id)
 page.wait_for_function('id=>StoneMoneySurvival.diagnostics().target===id',arg=id,timeout=20000)
def pick(page,id):
 aim(page,id);page.locator('#smiPrimary').click();page.wait_for_function('id=>StoneMoneySurvival.getState().objects[id].location==="inventory"',arg=id,timeout=15000)
def guard(signum,frame):raise TimeoutError('Case wall-clock budget exceeded')
signal.signal(signal.SIGALRM,guard)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 for name,w,h in [('desktop',960,540),('mobile',390,844)]:
  signal.alarm(380)
  ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,has_touch=name=='mobile',is_mobile=name=='mobile');page=ctx.new_page();page.set_default_timeout(25000)
  errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('requestfailed',lambda r:requests.append(r.url))
  r={'name':name,'viewport':[w,h],'errors':errors,'failedRequests':requests,'passed':False};report['cases'].append(r)
  try:
   phase(r,'loading');page.goto(base+'?qa',wait_until='domcontentloaded',timeout=45000)
   page.wait_for_function("window.OceanIsland?.qa.ready || document.getElementById('error')?.textContent.trim()",timeout=110000)
   error=page.locator('#error').inner_text();assert not error,error
   assert page.evaluate('!!window.StoneMoneySurvival'),'Game kernel missing';assert page.evaluate('OceanIsland.qa.ready')
   phase(r,'menu');snapshot(page,name+'-menu');page.locator('#smiMusic').click();page.locator('#smiStart').click();page.wait_for_function('StoneMoneySurvival.getMode()==="playing"');page.evaluate('StoneMoneySurvival.test.advance(3)')
   phase(r,'walk');start=page.evaluate('[StoneMoneySurvival.getState().player.x,StoneMoneySurvival.getState().player.z]')
   if name=='desktop':page.keyboard.down('s')
   else:
    b=page.locator('#smiJoy').bounding_box();touch=ctx.new_cdp_session(page);touch.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':b['x']+b['width']/2,'y':b['y']+b['height']/2+30,'id':9}]})
   page.wait_for_function('p=>Math.hypot(StoneMoneySurvival.getState().player.x-p[0],StoneMoneySurvival.getState().player.z-p[1])>.09',arg=start,timeout=35000)
   if name=='desktop':page.keyboard.up('s')
   else:touch.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   end=page.evaluate('[StoneMoneySurvival.getState().player.x,StoneMoneySurvival.getState().player.z]');r['walkDistance']=sum((a-b)**2 for a,b in zip(start,end))**.5
   snapshot(page,name+'-beach');r['noInjury']=page.evaluate('StoneMoneySurvival.diagnostics().injury===false')
   phase(r,'pickup craft');pick(page,'driftwood-01');pick(page,'stone-01');page.locator('#smiCraft').click();page.wait_for_function('StoneMoneySurvival.getState().spear')
   count=page.evaluate('StoneMoneySurvival.getState().events.length');page.evaluate('StoneMoneySurvival.test.craft()');assert page.evaluate('StoneMoneySurvival.getState().events.length')==count
   pick(page,'coconut-01');water=page.evaluate('StoneMoneySurvival.getState().player.water');page.locator('#smiEat').click();page.wait_for_function('v=>StoneMoneySurvival.getState().player.water>v+20',arg=water);r['coconutConsumedOnce']=page.evaluate('StoneMoneySurvival.getState().objects["coconut-01"].location==="used"')
   pick(page,'shell-01');pick(page,'leaves-01')
   phase(r,'actual spear hit');caught=False
   for attempt in range(4):
    fishid=page.evaluate('''()=>{const g=StoneMoneySurvival,f=g.getFish().find(f=>f.state==='swimming'),p=f.pos,x=p[0]-.72,z=p[2]+.86,y=g.ground(x,z)+1.64;g.test.position(x,z,Math.atan2(p[0]-x,-(p[2]-z)),Math.atan2(p[1]-y,Math.hypot(p[0]-x,p[2]-z)));return f.id;}''')
    try:
     page.wait_for_function('id=>StoneMoneySurvival.diagnostics().target===id',arg=fishid,timeout=6000);page.locator('#smiPrimary').click();page.wait_for_function('id=>StoneMoneySurvival.getState().fish[id]==="kept"',arg=fishid,timeout=3000);caught=True;break
    except Exception:pass
   assert caught,'No geometric spear hit registered';r['caughtFishId']=fishid;snapshot(page,name+'-spearfishing')
   phase(r,'radio');pick(page,'radio-01');assert page.evaluate('StoneMoneySurvival.getState().radio')=='damaged'
   phase(r,'cave camp');aim(page,'shelter-01');page.locator('#smiPrimary').click();page.wait_for_function('StoneMoneySurvival.getState().bed');page.evaluate('StoneMoneySurvival.test.advance(.8)');aim(page,'shelter-01');snapshot(page,name+'-shelter');page.locator('#smiPrimary').click();page.wait_for_function('StoneMoneySurvival.getState().day===2',timeout=10000)
   r['firstChapterCompleted']=page.evaluate('StoneMoneySurvival.getState().completed');assert r['firstChapterCompleted']
   phase(r,'journal and save');page.locator('#smiBag').click();assert '未烹饪' in page.locator('#smiInventory').inner_text();snapshot(page,name+'-journal');page.locator('#smiCloseJournal').click();page.evaluate('StoneMoneySurvival.commit()')
   before=page.evaluate('StoneMoneySurvival.getState()');page.reload(wait_until='domcontentloaded');page.wait_for_function('window.OceanIsland?.qa.ready',timeout=110000);page.locator('#smiContinue').click();page.wait_for_function('StoneMoneySurvival.getMode()==="playing"');after=page.evaluate('StoneMoneySurvival.getState()');assert after['day']==2 and after['fish']==before['fish'] and after['objects']==before['objects'] and after['bed'];r['saveRestore']=True
   phase(r,'patrol relation tests');page.evaluate('StoneMoneySurvival.test.position(25.2,12.1);StoneMoneySurvival.test.time(220);StoneMoneySurvival.test.advance(3)');r['shelterOccludesPatrol']=page.evaluate('!StoneMoneySurvival.diagnostics().patrol.visible && StoneMoneySurvival.getState().threat===0');assert r['shelterOccludesPatrol']
   page.evaluate('StoneMoneySurvival.test.position(32,24);StoneMoneySurvival.test.time(220);StoneMoneySurvival.test.advance(12)');r['exposureFails']=page.evaluate('StoneMoneySurvival.getMode()==="failed"');assert r['exposureFails']
   r['lastGLerror']=page.evaluate('OceanIsland.qa.glError');r['glErrors']=page.evaluate('OceanIsland.qa.glErrors||[]');assert not r['glErrors'];assert not errors and not requests;r['canvasCount']=page.locator('canvas').count();assert r['canvasCount']==1;r['qa']=page.evaluate('StoneMoneySurvival.diagnostics()');r['passed']=True;phase(r,'passed')
  except Exception as e:
   r['failure']=str(e);r['trace']=traceback.format_exc()
   try:r['state']=page.evaluate('window.StoneMoneySurvival?.getState()||null');r['diag']=page.evaluate('window.StoneMoneySurvival?.diagnostics()||null');r['errorPanel']=page.locator('#error').inner_text();snapshot(page,name+'-failure')
   except Exception:pass
   phase(r,'failed')
  finally:signal.alarm(0);ctx.close()
  if not r['passed']:break
 browser.close()
server.shutdown();report['browserPassed']=len(report['cases'])==2 and all(r['passed'] for r in report['cases']);save()
