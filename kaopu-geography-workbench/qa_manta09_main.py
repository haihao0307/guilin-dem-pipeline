"""Real browser QA: original homepage09 -> shared runtime/canvas; no standalone runner."""
import os,json,time,io,hashlib,traceback,math
from pathlib import Path
from PIL import Image,ImageStat
from playwright.sync_api import sync_playwright
BASE=os.environ.get('KAOPU_PUBLIC_URL','http://127.0.0.1:8765/kaopu-geography-workbench/')
ENGINE=os.environ.get('KAOPU_BROWSER','chromium');OUT=Path('manta09-browser-qa')/ENGINE;OUT.mkdir(parents=True,exist_ok=True)
report={'engine':ENGINE,'base':BASE,'commit':os.environ.get('GITHUB_SHA'),'scope':'actual main-workbench original09 browser rendering and controls','tests':[],'errors':[],'physicalPhoneTested':False,'passed':False}
def record(name,data=True):
 report['tests'].append({'name':name,'result':data});(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(name,json.dumps(data,ensure_ascii=False),flush=True)
def diag(p):return p.evaluate('KaoPuDiagnostics()')
def ready(p,before=-1):p.wait_for_function('(n)=>window.KaoPuDiagnostics&&KaoPuDiagnostics().scene==="mantaOriginal09"&&KaoPuDiagnostics().renderReady&&KaoPuDiagnostics().renderCount>n',arg=before,timeout=180000)
def pause(p):
 if diag(p)['playing']:p.locator('#playBtn').click()
 p.wait_for_function('KaoPuDiagnostics().manta09.framesInFlight===0',timeout=180000)
def seek(p,t):
 pause(p);before=diag(p)['renderCount'];p.locator('#seek').evaluate('(e,t)=>{e.value=String(t);e.dispatchEvent(new Event("input",{bubbles:true}));}',t);ready(p,before);pause(p);p.wait_for_function('(t)=>Math.abs(KaoPuDiagnostics().renderedTime-t)<1e-6&&Math.abs(KaoPuDiagnostics().time-t)<1e-6',arg=t);p.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
def shot(p,name):
 raw=p.locator('#liveCanvas').screenshot(timeout=180000);im=Image.open(io.BytesIO(raw)).convert('RGB');st=ImageStat.Stat(im);assert max(st.stddev)>8,(name,st.stddev);assert max(st.mean)>30,(name,st.mean);(OUT/(name+'.png')).write_bytes(raw);record('actual_pixels_'+name,{'size':im.size,'mean':st.mean,'stddev':st.stddev,'imageSha256':hashlib.sha256(raw).hexdigest()});return im.tobytes()
def back(p,url):
 p.locator('#backBtn').click();p.wait_for_function('KaoPuDiagnostics().homeVisible&&!KaoPuDiagnostics().detailVisible');assert p.url==url
try:
 with sync_playwright() as pw:
  options={'headless':True}
  if ENGINE=='chromium':options['args']=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
  browser=getattr(pw,ENGINE).launch(**options)
  for mobile in [False,True]:
   label='mobile' if mobile else 'desktop';p=browser.new_page(viewport={'width':390,'height':844} if mobile else {'width':1440,'height':1000},device_scale_factor=2 if mobile else 1,is_mobile=mobile,has_touch=mobile);p.set_default_timeout(180000)
   errors=[];writes=[];p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:writes.append(r.url) if r.method not in ['GET','HEAD'] else None)
   p.goto(BASE,wait_until='load',timeout=120000);url=p.url
   assert diag(p)['homeVisible'] and p.locator('canvas').count()==1
   old=set(p.locator('[data-scene]').evaluate_all('(es)=>es.map(e=>e.dataset.scene)'));assert old=={'more','cave','canyon','crater','snow','underwater','endless','mantaOriginal09','submarineOriginal10','canyonOriginal08'}
   card=p.locator('[data-scene="mantaOriginal09"]');assert card.evaluate('(e)=>e.tagName')=='BUTTON' and card.get_attribute('href') is None
   assert p.locator('[data-scene="canyonOriginal08"]').evaluate('(e)=>e.tagName')=='BUTTON'
   assert p.locator('[data-scene="submarineOriginal10"]').evaluate('(e)=>e.tagName')=='BUTTON'
   before=diag(p)['renderCount'];card.click();ready(p,before);pause(p)
   d=diag(p);assert d['manta09']['verified'] and d['manta09']['sourceBytes']==12150 and d['manta09']['channels']==[0,1,3]
   assert d['manta09']['sourceSha256']=='679e35942e1285cd4c5c2543896050fa6ab2326f73495d1e44be203435118c78'
   assert p.url==url and p.locator('#quality').input_value()=='auto' and p.locator('#speed').input_value()=='1'
   gpu=p.evaluate('''()=>{const g=document.getElementById('liveCanvas').getContext('webgl2'),x=g.getExtension('WEBGL_debug_renderer_info');return{version:g.getParameter(g.VERSION),renderer:x?g.getParameter(x.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)}}''');record(label+'_main_entry',{'diagnostic':d,'gpu':gpu,'sameURL':True,'sameCanvas':True})
   d=diag(p);expected=min(1920,max(720,math.ceil(d['canvasCss'][0]*min(d['dpr'],2)/8)*8));assert d['canvasPixels'][0]==expected and d['mantaObservation']['programKey']=='mantaOriginal09'
   assert p.evaluate("document.getElementById('liveCanvas').getContext('webgl2').drawingBufferWidth")==expected
   seek(p,2);high=shot(p,label+'_auto_high');p.screenshot(path=str(OUT/(label+'_workbench_high.png')),full_page=True);before=diag(p)['renderCount'];p.locator('#quality').select_option('480');ready(p,before);pause(p);low=shot(p,label+'_old480');assert high!=low and expected>480;record(label+'_actual_resolution_improvement',{'automaticWidth':expected,'priorWidth':480,'CSS':d['canvasCss'],'DPR':d['dpr']})
   before=diag(p)['renderCount'];p.locator('#quality').select_option('720');ready(p,before);pause(p)
   frames=[]
   for t in [0,2,6]:seek(p,t);frames.append(shot(p,label+'_t'+str(t)))
   assert len({hashlib.sha256(x).hexdigest()for x in frames})==3;record(label+'_original_animation_changes_with_time')
   original=shot(p,label+'_before_drag');box=p.locator('#liveCanvas').bounding_box();before=diag(p)['renderCount'];p.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5);p.mouse.down();p.mouse.move(box['x']+box['width']*.65,box['y']+box['height']*.55,steps=5);p.mouse.up();ready(p,before);pause(p);after=shot(p,label+'_after_drag');assert original!=after
   camera=diag(p)['mantaObservation'];assert camera['mode']=='observe' and camera['programKey']=='mantaObserve09';assert all(abs(a-b)<1e-4 for a,b in zip(camera['camera'],camera['uploadedCamera']));assert diag(p)['time']==6;record(label+'_real_camera_orbit',camera)
   radius=camera['camera'][2];before=diag(p)['renderCount'];p.mouse.wheel(0,120);ready(p,before);pause(p);assert diag(p)['mantaObservation']['camera'][2]>radius;shot(p,label+'_zoom')
   if mobile:
    p.touchscreen.tap(box['x']+box['width']*.5,box['y']+box['height']*.5);record(label+'_native_touch')
    if ENGINE=='chromium':
     session=p.context.new_cdp_session(p);x=box['x']+box['width']*.5;y=box['y']+box['height']*.5;radius=diag(p)['mantaObservation']['camera'][2];before=diag(p)['renderCount']
     session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x-35,'y':y,'id':1},{'x':x+35,'y':y,'id':2}]});session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-65,'y':y,'id':1},{'x':x+65,'y':y,'id':2}]});session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});ready(p,before);pause(p);assert diag(p)['mantaObservation']['camera'][2]<radius;record(label+'_native_pinch');session.detach()
   before=diag(p)['renderCount'];p.locator('#mantaOriginalMode').click();ready(p,before);pause(p);restored=shot(p,label+'_restored_original');assert restored==original and diag(p)['mantaObservation']['programKey']=='mantaOriginal09';record(label+'_original_pixels_restored_exactly')
   p.locator('#mantaObserveMode').click();pause(p);p.locator('#mantaResetView').click();pause(p);assert diag(p)['mantaObservation']['mode']=='observe' and abs(diag(p)['mantaObservation']['camera'][1])<1e-9
   p.locator('#speed').select_option('0.02');p.locator('#playBtn').click();start=diag(p)['time'];p.wait_for_timeout(650);pause(p);assert diag(p)['time']>start
   stopped=diag(p)['time'];p.wait_for_timeout(200);assert abs(diag(p)['time']-stopped)<.01
   before=diag(p)['renderCount'];p.locator('#quality').select_option('720');ready(p,before);pause(p);assert p.locator('#liveCanvas').evaluate('(e)=>[e.width,e.height]')==[720,404]
   aspect=p.locator('#liveCanvas').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.width/r.height}');assert abs(aspect-1200/674)<.02
   p.locator('#resetBtn').click();p.wait_for_function('KaoPuDiagnostics().time===0&&!KaoPuDiagnostics().playing');pause(p);back(p,url)
   for _ in range(2):
    before=diag(p)['renderCount'];card.click();ready(p,before);pause(p);assert p.url==url and diag(p)['manta09']['verified'] and diag(p)['mantaObservation']['mode']=='observe';assert p.locator('#speed').input_value()=='0.02' and p.locator('#quality').input_value()=='720';back(p,url)
   assert not errors,errors;assert not writes,writes;assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
   record(label+'_pause_time_speed_resolution_reset_back_reopen',{'sameMainURL':True,'noImportsOrUploads':True,'pageErrors':errors});p.close()
  browser.close()
 report['passed']=True
except Exception as e:
 report['errors'].append(str(e));report['traceback']=traceback.format_exc();print(report['traceback'],flush=True)
finally:
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('MANTA09_MAIN_REPORT',json.dumps(report,ensure_ascii=False),flush=True)
if not report['passed']:raise SystemExit(1)
