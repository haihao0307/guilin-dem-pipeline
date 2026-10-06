"""Real browser QA: original homepage10 -> shared runtime/canvas; no standalone runner."""
import os,json,time,io,hashlib,traceback
from pathlib import Path
from PIL import Image,ImageStat
from playwright.sync_api import sync_playwright
BASE=os.environ.get('KAOPU_PUBLIC_URL','http://127.0.0.1:8765/kaopu-geography-workbench/')
ENGINE=os.environ.get('KAOPU_BROWSER','chromium');OUT=Path('submarine10-browser-qa')/ENGINE;OUT.mkdir(parents=True,exist_ok=True)
report={'engine':ENGINE,'base':BASE,'commit':os.environ.get('GITHUB_SHA'),'scope':'actual main-workbench original10 browser rendering and controls','tests':[],'errors':[],'physicalPhoneTested':False,'passed':False}
def record(name,data=True):
 report['tests'].append({'name':name,'result':data});(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(name,json.dumps(data,ensure_ascii=False),flush=True)
def diag(p):return p.evaluate('KaoPuDiagnostics()')
def ready(p,before=-1):p.wait_for_function('(n)=>window.KaoPuDiagnostics&&KaoPuDiagnostics().scene==="submarineOriginal10"&&KaoPuDiagnostics().renderReady&&KaoPuDiagnostics().renderCount>n',arg=before,timeout=180000)
def pause(p):
 if diag(p)['playing']:p.locator('#playBtn').click()
 p.wait_for_function('KaoPuDiagnostics().submarine10.framesInFlight===0',timeout=180000)
def seek(p,t):
 pause(p);before=diag(p)['renderCount'];p.locator('#seek').evaluate('(e,t)=>{e.value=String(t);e.dispatchEvent(new Event("input",{bubbles:true}));}',t);ready(p,before);pause(p);p.wait_for_function('(t)=>Math.abs(KaoPuDiagnostics().renderedTime-t)<1e-6&&Math.abs(KaoPuDiagnostics().time-t)<1e-6',arg=t);p.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
def shot(p,name):
 raw=p.locator('#liveCanvas').screenshot(timeout=180000);im=Image.open(io.BytesIO(raw)).convert('RGB');st=ImageStat.Stat(im);(OUT/(name+'.png')).write_bytes(raw);record('frame_inputs_'+name,{'diagnostic':diag(p),'gpuTime':p.evaluate("()=>{const g=document.getElementById('liveCanvas').getContext('webgl2'),pr=g.getParameter(g.CURRENT_PROGRAM);return g.getUniform(pr,g.getUniformLocation(pr,'iTime'));}")});assert (max(st.mean)<1 if name.endswith('_t0') else max(st.stddev)>8),(name,st.mean,st.stddev);(OUT/(name+'.png')).write_bytes(raw);record('actual_pixels_'+name,{'size':im.size,'mean':st.mean,'stddev':st.stddev,'imageSha256':hashlib.sha256(raw).hexdigest()});return im.tobytes()
def back(p,url):
 p.locator('#backBtn').click();p.wait_for_function('KaoPuDiagnostics().homeVisible&&!KaoPuDiagnostics().detailVisible');assert p.url==url
try:
 with sync_playwright() as pw:
  options={'headless':True}
  if ENGINE=='chromium':options['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
  browser=getattr(pw,ENGINE).launch(**options)
  for mobile in [False,True]:
   label='mobile' if mobile else 'desktop';p=browser.new_page(viewport={'width':390,'height':844} if mobile else {'width':1440,'height':1000},device_scale_factor=1,is_mobile=mobile,has_touch=mobile);p.set_default_timeout(180000)
   errors=[];writes=[];p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:writes.append(r.url) if r.method not in ['GET','HEAD'] else None)
   p.goto(BASE,wait_until='load',timeout=120000);url=p.url
   assert diag(p)['homeVisible'] and p.locator('canvas').count()==1
   old=set(p.locator('[data-scene]').evaluate_all('(es)=>es.map(e=>e.dataset.scene)'));assert old=={'more','cave','canyon','crater','snow','underwater','endless','mantaOriginal09','submarineOriginal10'}
   card=p.locator('[data-scene="submarineOriginal10"]');assert card.evaluate('(e)=>e.tagName')=='BUTTON' and card.get_attribute('href') is None
   assert p.locator('[data-teacher-original="08"]').get_attribute('href')=='teacher-original/index.html?case=08'
   assert p.locator('[data-scene="submarineOriginal10"]').evaluate('(e)=>e.tagName')=='BUTTON'
   before=diag(p)['renderCount'];card.click();ready(p,before);pause(p)
   d=diag(p);assert d['submarine10']['verified'] and d['submarine10']['sourceBytes']==16497 and d['submarine10']['channels']==[0,2,3]
   assert d['submarine10']['sourceSha256']=='571642c54667eb5a015a535172e988e0e59a7f37ab807546f7dc0e35e7440bf3'
   assert p.url==url and p.locator('#quality').input_value()=='480' and p.locator('#speed').input_value()=='1'
   gpu=p.evaluate('''()=>{const g=document.getElementById('liveCanvas').getContext('webgl2'),x=g.getExtension('WEBGL_debug_renderer_info');return{version:g.getParameter(g.VERSION),renderer:x?g.getParameter(x.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)}}''');record(label+'_main_entry',{'diagnostic':d,'gpu':gpu,'sameURL':True,'sameCanvas':True})
   frames=[]
   for t in [0,4,20]:seek(p,t);frames.append(shot(p,label+'_t'+str(t)))
   assert len({hashlib.sha256(x).hexdigest()for x in frames})==3;record(label+'_original_animation_changes_with_time')
   seek(p,4);p.screenshot(path=str(OUT/(label+'_workbench_t4.png')),full_page=True)
   original=shot(p,label+'_before_drag');box=p.locator('#liveCanvas').bounding_box();before=diag(p)['renderCount'];p.mouse.move(box['x']+box['width']*.25,box['y']+box['height']*.5);p.mouse.down();p.mouse.move(box['x']+box['width']*.3,box['y']+box['height']*.55,steps=5);p.mouse.up();ready(p,before);pause(p);after=shot(p,label+'_after_drag');assert original!=after;assert abs(diag(p)['submarine10']['mouse'][0]-288)<2 and diag(p)['time']==4;record(label+'_original_mouse_route',{'routeChangesWithOriginalIMouse':True,'freeOrbitInvented':False,'originalTimeUnchanged':True})
   if mobile:
    before=diag(p)['renderCount'];p.touchscreen.tap(box['x']+box['width']*.4,box['y']+box['height']*.5);ready(p,before);pause(p);assert abs(diag(p)['submarine10']['mouse'][0]-384)<2;record(label+'_touch_tap_original_route')
   p.locator('#speed').select_option('0.02');p.locator('#playBtn').click();start=diag(p)['time'];p.wait_for_timeout(650);pause(p);assert diag(p)['time']>start
   stopped=diag(p)['time'];p.wait_for_timeout(200);assert abs(diag(p)['time']-stopped)<.01
   before=diag(p)['renderCount'];p.locator('#quality').select_option('720');ready(p,before);pause(p);assert p.locator('#liveCanvas').evaluate('(e)=>[e.width,e.height]')==[720,405]
   aspect=p.locator('#liveCanvas').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.width/r.height}');assert abs(aspect-16/9)<.02
   p.locator('#resetBtn').click();p.wait_for_function('KaoPuDiagnostics().time===0&&!KaoPuDiagnostics().playing');pause(p);assert diag(p)['submarine10']['mouse']==[0,0,0,0];back(p,url)
   for _ in range(2):
    before=diag(p)['renderCount'];card.click();ready(p,before);pause(p);assert p.url==url and diag(p)['submarine10']['verified'];assert p.locator('#speed').input_value()=='0.02' and p.locator('#quality').input_value()=='720';back(p,url)
   before=diag(p)['renderCount'];p.evaluate("()=>{document.querySelector('[data-scene=\"submarineOriginal10\"]').click();document.getElementById('backBtn').click();document.querySelector('[data-scene=\"mantaOriginal09\"]').click();}")
   p.wait_for_function('(n)=>KaoPuDiagnostics().scene==="mantaOriginal09"&&KaoPuDiagnostics().renderReady&&KaoPuDiagnostics().renderCount>n',arg=before,timeout=180000)
   if diag(p)['playing']:p.locator('#playBtn').click()
   p.wait_for_function('KaoPuDiagnostics().manta09.framesInFlight===0');assert diag(p)['manta09']['verified'] and diag(p)['manta09']['sourceBytes']==12150;p.wait_for_timeout(200);assert diag(p)['scene']=='mantaOriginal09';back(p,url);record(label+'_interrupted10_keeps_newer09_navigation')
   assert not errors,errors;assert not writes,writes;assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
   record(label+'_pause_time_speed_resolution_reset_back_reopen',{'sameMainURL':True,'noImportsOrUploads':True,'pageErrors':errors});p.close()
  browser.close()
 report['passed']=True
except Exception as e:
 report['errors'].append(str(e));report['traceback']=traceback.format_exc();print(report['traceback'],flush=True)
finally:
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('SUBMARINE10_MAIN_REPORT',json.dumps(report,ensure_ascii=False),flush=True)
if not report['passed']:raise SystemExit(1)
