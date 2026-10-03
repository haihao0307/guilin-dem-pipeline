"""Verify actual HTTPS content, WebGL2 renders and interactions. Never substitute mock frames."""
import os,time,json,io,traceback,hashlib,urllib.request
from pathlib import Path
from PIL import Image,ImageStat
from playwright.sync_api import sync_playwright
OUT=Path('geography-qa');OUT.mkdir(exist_ok=True)
BASE=os.environ.get('KAOPU_PUBLIC_URL','https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/')
report={'version':'R16.5','url':BASE,'commit':os.environ.get('GITHUB_SHA'),'tests':[],'errors':[],'phone_hardware_tested':False,'environment':'GitHub Actions Ubuntu Chromium, SwiftShader software GPU','passed':False}
def record(name,data=True):
 report['tests'].append({'name':name,'result':data});print(name,json.dumps(data,ensure_ascii=False),flush=True)
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'Cache-Control':'no-cache'}),timeout=30) as r:return r.status,r.read()
def wait_site():
 for _ in range(60):
  try:
   status,body=get(BASE+'?qa='+str(time.time()))
   if status==200 and b'underwater.js?v=R16' in body:
    record('public_https_200',{'status':status,'html_sha256':hashlib.sha256(body).hexdigest()});return
  except Exception as e:print('Waiting for Pages:',e,flush=True)
  time.sleep(10)
 raise RuntimeError('R16 public page did not become available')
def diag(p):return p.evaluate('window.KaoPuDiagnostics()')
def rendered(p,scene,count=-1,timeout=120000):
 p.wait_for_function('(a)=>window.KaoPuDiagnostics&&KaoPuDiagnostics().scene===a.scene&&KaoPuDiagnostics().renderReady&&KaoPuDiagnostics().renderCount>a.count',arg={'scene':scene,'count':count},timeout=timeout)
 assert not p.locator('#notice.error').is_visible(),p.locator('#notice').inner_text()
def pause(p):
 if diag(p)['playing']:p.locator('#playBtn').click()
def seek(p,value):
 pause(p);old=diag(p)['renderCount'];p.locator('#seek').evaluate('(el,v)=>{el.value=String(v);el.dispatchEvent(new Event("input",{bubbles:true}));}',value);rendered(p,diag(p)['scene'],old)
def shot(p,name):
 p.evaluate('window.scrollTo(0,0)');p.wait_for_timeout(150)
 box=p.locator('#liveCanvas').bounding_box()
 raw=p.screenshot(full_page=True,animations='disabled',timeout=120000)
 im=Image.open(io.BytesIO(raw)).convert('RGB');x,y,w,h=box['x'],box['y'],box['width'],box['height']
 im=im.crop((round(x),round(y),round(x+w),round(y+h)));im.save(OUT/(name+'.png'));stat=ImageStat.Stat(im)
 assert max(stat.stddev)>3,('Unexpected blank or uniform canvas',name,stat.stddev)
 record('render_'+name,{'mean':stat.mean,'stddev':stat.stddev,'pixels':im.size,'diagnostics':diag(p)})
def layout(p,name):
 d=p.evaluate('''()=>{const b=document.getElementById('backBtn').getBoundingClientRect();return ['playBtn','resetBtn','quality','teacherBtn'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,overlap:Math.max(0,Math.min(b.right,r.right)-Math.max(b.left,r.left))*Math.max(0,Math.min(b.bottom,r.bottom)-Math.max(b.top,r.top))};});}''');assert all(x['overlap']==0 for x in d),d
 assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+2');record(name,d)
def back(p):
 url=p.url;p.locator('#backBtn').click();p.wait_for_function('KaoPuDiagnostics().homeVisible && !KaoPuDiagnostics().detailVisible');assert p.url==url and p.locator('[data-scene]').count()==6
try:
 wait_site()
 public=OUT/'public_source';public.mkdir(exist_ok=True);manifest={}
 for name in ['index.html','style.css','settings.js','more.js','cave.js','canyon.js','crater.js','snow.js','post.js','caveBake.js','underwater.js','runtime.js','README.md']:
  status,body=get(BASE+name+'?qa='+str(time.time()));assert status==200; (public/name).write_bytes(body);manifest[name]=hashlib.sha256(body).hexdigest()
 record('public_source_checksums',manifest)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
  p=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1);p.set_default_timeout(120000)
  errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(BASE,wait_until='load',timeout=90000)
  assert diag(p)['homeVisible'] and not diag(p)['detailVisible'] and p.locator('[data-scene]').count()==6
  record('home_first_desktop',{'diagnostics':diag(p),'entries':p.locator('[data-scene]').count()})
  before=diag(p)['renderCount'];p.locator('[data-scene="underwater"]').click();rendered(p,'underwater',before);pause(p);record('desktop_browser',{'version':browser.version,'diagnostics':diag(p)})
  gpu=p.evaluate('''()=>{const g=document.getElementById('liveCanvas').getContext('webgl2'),x=g.getExtension('WEBGL_debug_renderer_info');return{version:g.getParameter(g.VERSION),renderer:x?g.getParameter(x.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)};}''');record('actual_gpu_backend',gpu)
  assert abs(diag(p)['underwater']['horizontal']-2/3)<1e-10 and diag(p)['underwater']['depth']==2
  seek(p,72);shot(p,'underwater_overview');layout(p,'desktop_button_layout')
  for b,n in [('rimBtn','underwater_rim'),('floorBtn','underwater_floor')]:
   old=diag(p)['renderCount'];p.locator('#'+b).click();rendered(p,'underwater',old);shot(p,n)
  old=diag(p)['renderCount'];p.locator('#overviewBtn').click();rendered(p,'underwater',old)
  for sel,val in [('diameterFactor','0.5'),('depthFactor','1.5')]:
   old=diag(p)['renderCount'];p.locator('#'+sel).select_option(val);rendered(p,'underwater',old)
  assert diag(p)['underwater']['horizontal']==.5 and diag(p)['underwater']['depth']==1.5
  p.locator('#resetShape').click();p.wait_for_function('KaoPuDiagnostics().underwater.depth===2&&Math.abs(KaoPuDiagnostics().underwater.horizontal-2/3)<1e-10');record('scale_controls_and_reset')
  box=p.locator('#liveCanvas').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.5;a=diag(p)['underwater'];p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+70,y+10,steps=6);p.mouse.up();p.mouse.wheel(0,-130);p.wait_for_timeout(150);b=diag(p)['underwater'];assert a['yaw']!=b['yaw'] and a['zoom']!=b['zoom'];record('drag_and_zoom',b)
  p.locator('#enlargeBtn').click();assert p.locator('.work.enlarged').count()==1;p.locator('#enlargeBtn').click();record('enlarge_restore')
  p.locator('#teacherBtn').click();assert p.locator('#teacherPanel').is_visible();p.locator('#teacherBtn').click();assert not p.locator('#teacherPanel').is_visible();record('reference_panel_toggle')
  p.locator('#playBtn').click();start=diag(p)['time'];p.wait_for_timeout(500);pause(p);assert diag(p)['time']>start;stopped=diag(p)['time'];p.wait_for_timeout(200);assert abs(diag(p)['time']-stopped)<.01;record('play_pause')
  old=diag(p)['renderCount'];p.locator('#compareOriginal').click();rendered(p,'crater',old);pause(p);shot(p,'original_crater');back(p)
  assert p.locator('[data-scene="crater"]').count()==1 and p.locator('[data-scene="underwater"]').count()==1
  bad=p.locator('#home img').evaluate_all('(xs)=>xs.filter(x=>!x.complete||!x.naturalWidth).map(x=>x.dataset.thumbnail)');assert not bad,bad
  p.screenshot(path=str(OUT/'home_desktop.png'),full_page=True);record('six_entries_and_thumbnails')
  for key in ['more','canyon','crater','snow','underwater','cave']:
   before=diag(p)['renderCount'];p.locator('[data-scene="'+key+'"]').click();rendered(p,key,before,timeout=720000 if key=='cave' else 120000);pause(p)
   if key in ['more','snow']:seek(p,6)
   shot(p,key+'_entry');back(p);record('entry_and_return_'+key)
  for _ in range(3):
   old=diag(p)['renderCount'];p.locator('[data-scene="underwater"]').click();rendered(p,'underwater',old);back(p)
  record('repeated_return');assert not errors,errors
  mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mobile.set_default_timeout(120000)
  mobile.goto(BASE,wait_until='load',timeout=90000)
  assert diag(mobile)['homeVisible'] and mobile.locator('[data-scene]').count()==6
  mobile.screenshot(path=str(OUT/'mobile_viewport_home_first.png'),full_page=True)
  before=diag(mobile)['renderCount'];mobile.locator('[data-scene="underwater"]').click();rendered(mobile,'underwater',before);pause(mobile);layout(mobile,'mobile_viewport_layout_390x844');seek(mobile,72);shot(mobile,'mobile_viewport_underwater');mobile.screenshot(path=str(OUT/'mobile_viewport_page.png'),full_page=True);back(mobile);mobile.screenshot(path=str(OUT/'mobile_viewport_home.png'),full_page=True);record('mobile_viewport_not_real_phone',True);browser.close()
 report['passed']=True
except Exception as e:
 report['errors'].append(str(e));report['traceback']=traceback.format_exc();print(traceback.format_exc(),flush=True)
finally:
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('KAOPU_QA_REPORT',json.dumps(report,ensure_ascii=False),flush=True)
if not report['passed']:raise SystemExit(1)
