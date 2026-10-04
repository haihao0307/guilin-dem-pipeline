from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,hashlib,sys
T=sys.argv[1];O=Path(sys.argv[2]);O.mkdir(parents=True,exist_ok=True);local=not T.startswith('http')
R={'scope':'local actual shader set_content' if local else 'public HTTP actual shader and input','checks':{},'errors':[],'physicalPhone':False,'screenshots':[]}
def ck(n,v):
 R['checks'][n]=bool(v);print(n,bool(v),flush=True)
 if not v:raise AssertionError(n)
def settled(f,n=None):
 if n is not None:f.wait_for_function('YoungStudyState.frame>'+str(n),timeout=60000)
 f.wait_for_function('window.YoungStudyState?.ready||window.YoungStudyState?.error',timeout=60000)
 assert f.evaluate('YoungStudyState.ready'),f.evaluate('YoungStudyState')
 f.evaluate('YoungStudy.pixelSignature()')
def run(f,s,v=None):
 n=f.evaluate('YoungStudyState.frame');f.evaluate(s,v);settled(f,n)
def clk(f,s):
 n=f.evaluate('YoungStudyState.frame');f.locator(s).click();settled(f,n)
def pic(p,n):p.screenshot(path=str(O/(n+'.png')));R['screenshots'].append(n+'.png')
def child(p):
 p.locator('#youngFrame').wait_for(state='visible');f=p.locator('#youngFrame').element_handle().content_frame();settled(f);return f
try:
 with sync_playwright() as pw:
  opts=dict(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist'],env={**os.environ,'DISPLAY':':99'}) if local else dict(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  b=pw.chromium.launch(**opts);c=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
  p=c.new_page();p.set_default_timeout(45000);p.on('pageerror',lambda e:R['errors'].append(str(e)))
  if local:p.set_content(Path(T).read_text());f=p;settled(f)
  else:
   r=p.goto(T.rstrip('/')+'/?v=inspect-r03-20261004#view=young',wait_until='domcontentloaded',timeout=60000)
   ck('public_http200',r.status==200);ck('public_html_mime','text/html' in r.headers.get('content-type',''));f=child(p)
  ck('version',f.evaluate('YoungStudyState.version')=='young-inspect-r03-20261004')
  original=f.locator('#shader').text_content().strip();color=f.locator('#colorShader').text_content().strip()
  ck('teacher_hash_unchanged',hashlib.sha256(original.encode()).hexdigest()=='60f2ed28f199c435ffac60a6f9fde0426ff64246e69d5016eaf7fe65b5f5da2f')
  ck('color_R02_unchanged',hashlib.sha256(color.encode()).hexdigest()=='a395ddf1ab5b5bfa6a24d4a98fb63fe087219c0c730a179b04e1d750043c024a')
  ck('no_fake_images',f.locator('img,video').count()==0);ck('two_actual_canvases',f.locator('canvas').count()==2)
  ck('equal_comparison_removed_from_toolbar',not f.locator('.toolbar #equal').count())
  base=f.evaluate('YoungStudy.pixelSignature()');teacher=f.evaluate('YoungStudy.pixelSignature("teacher")');R['defaultState']=f.evaluate('YoungStudyState')
  pic(p,'01_DEFAULT')
  for n in [1,2]:
   run(f,'(n)=>YoungStudy.setInspection({light:n})',n);ck('light_changes_'+str(n),f.evaluate('YoungStudy.pixelSignature()')!=base);ck('teacher_unchanged_light_'+str(n),f.evaluate('YoungStudy.pixelSignature("teacher")')==teacher);pic(p,'02_LIGHT_'+str(n))
  light=f.evaluate('YoungStudy.pixelSignature()')
  run(f,'YoungStudy.setInspection({warm:0})');ck('warm_power_works',f.evaluate('YoungStudy.pixelSignature()')!=light)
  run(f,'YoungStudy.setInspection({warm:1,cool:0})');ck('cool_power_works',f.evaluate('YoungStudy.pixelSignature()')!=light)
  run(f,'YoungStudy.resetInspection()');ck('exact_R02_return',f.evaluate('YoungStudy.pixelSignature()')==base)
  # Actual mouse rotation at a fixed time.
  box=f.locator('#studentCanvas').bounding_box();x=box['x']+box['width']*.53;y=box['y']+box['height']*.45
  p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+65,y+35,steps=5);p.mouse.up();settled(f)
  ck('drag_state',abs(f.evaluate('YoungStudyState.inspection.yaw'))>.2);ck('drag_changes_pixels',f.evaluate('YoungStudy.pixelSignature()')!=base);ck('teacher_unchanged_angle',f.evaluate('YoungStudy.pixelSignature("teacher")')==teacher)
  pic(p,'03_DRAG')
  run(f,'YoungStudy.resetInspection()')
  f.locator('#play').click();f.wait_for_function('YoungStudyState.playing && YoungStudyState.time>0.1',timeout=60000)
  box=f.locator('#studentCanvas').bounding_box();x=box['x']+box['width']*.53;y=box['y']+box['height']*.45
  p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+45,y-24,steps=5);p.mouse.up();ck('playing_during_drag',f.evaluate('YoungStudyState.playing'));ck('angle_while_playing',abs(f.evaluate('YoungStudyState.inspection.yaw'))>.1)
  p.mouse.wheel(0,-95);f.wait_for_function('YoungStudyState.inspection.zoom>1',timeout=60000);ck('wheel_during_play',f.evaluate('YoungStudyState.playing'))
  f.locator('#play').click();ck('pause_input_works',not f.evaluate('YoungStudyState.playing'))
  run(f,'YoungStudy.resetInspection()');clk(f,'#reset')
  vals=[]
  for z in [1,2,5,10,20,50,100]:
   n=f.evaluate('YoungStudyState.frame');f.locator('#zoomPreset').select_option(str(z));settled(f,n)
   ck('zoom_'+str(z),f.evaluate('YoungStudyState.inspection.zoom')==z);vals.append(f.evaluate('YoungStudy.pixelSignature()'))
   ck('teacher_stays_at_base_'+str(z),f.evaluate('YoungStudy.pixelSignature("teacher")')==teacher)
   if z in [5,100]:pic(p,'04_ZOOM_'+str(z))
  ck('zoom_distinct_rerenders',len(set(vals))==len(vals));ck('not_css_zoom',f.locator('#studentCanvas').evaluate('(e)=>getComputedStyle(e).transform')=='none')
  clk(f,'#cameraReset');ck('reset_camera_pixels',f.evaluate('YoungStudy.pixelSignature()')==base)
  box=f.locator('#studentCanvas').bounding_box();x=box['x']+box['width']*.45;y=box['y']+box['height']*.4
  p.keyboard.down('Shift');p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+22,y+19,steps=3);p.mouse.up();p.keyboard.up('Shift');settled(f)
  ck('pan_state',abs(f.evaluate('YoungStudyState.inspection.pan[0]'))>.01);ck('pan_pixels',f.evaluate('YoungStudy.pixelSignature()')!=base)
  run(f,'YoungStudy.resetInspection()')
  p.mouse.dblclick(x,y);settled(f);ck('double_click_focus',f.evaluate('YoungStudyState.inspection.zoom')==2 and any(abs(v)>.01 for v in f.evaluate('YoungStudyState.inspection.pan')))
  run(f,'YoungStudy.resetInspection()');run(f,'YoungStudy.setInspection({depth:5})');ck('depth_changes_pixels',f.evaluate('YoungStudy.pixelSignature()')!=base)
  run(f,'YoungStudy.resetInspection()')
  # Simulated touch PointerEvents, distinct from phone hardware tests.
  f.locator('#studentCanvas').evaluate('''e=>{const r=e.getBoundingClientRect(),p=(t,id,x,y)=>e.dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',isPrimary:id===101,clientX:r.x+x,clientY:r.y+y,button:0,buttons:t==='pointerup'?0:1,bubbles:true}));e.setPointerCapture=()=>{};p('pointerdown',101,80,80);p('pointerdown',102,180,80);p('pointermove',102,185,80);p('pointermove',102,220,85);p('pointerup',101,80,80);p('pointerup',102,220,85);}''');settled(f)
  ck('simulated_pinch_zoom',f.evaluate('YoungStudyState.inspection.zoom')>1)
  run(f,'YoungStudy.resetInspection()');clk(f,'[data-palette="0"]');ck('original_mode_neutral_exact',f.evaluate('YoungStudy.pixelSignature()')==teacher)
  for k in [1,2,3,4]:clk(f,'[data-palette="'+str(k)+'"]');ck('palette_'+str(k),f.evaluate('YoungStudyState.palette')==k)
  clk(f,'[data-palette="1"]')
  f.locator('#branchStudy').click();ck('branch_knowledge_visible',f.locator('#branchKnowledge').get_attribute('open') is not None)
  ck('source_732_frames',f.evaluate('CoralBranchSource.frames')==732);ck('source_sha',f.evaluate('CoralBranchSource.source_sha256')=='b5bd4cedda00c23e1018108e0a69348dfab9c711ee8c2b937792a1e367e6ae89')
  f.locator('[data-chapter="3"]').click();ck('Turtle_source_correct','MoSpline' in f.locator('#chapterTitle').inner_text());ck('no_fake_video_claim','不冒充' in f.locator('#branchKnowledge').inner_text())
  f.locator('#branchKnowledge').evaluate('(e)=>e.open=false');f.evaluate('window.scrollTo(0,0)')
  if not local:
   for v in ['blue','color','rosette','home','ledger','young']:
    p.locator('[data-view='+v+']').click();ck('nav_'+v,p.locator('#view-'+v).is_visible())
   f=child(p);f.locator('#back').click();p.locator('#view-home').wait_for(state='visible');ck('return_home',True)
   p.locator('[data-view=young]').click();f=child(p)
  for w,h in [(390,844),(320,844),(834,900)]:
   p.set_viewport_size({'width':w,'height':h});f.wait_for_function("()=>{const s=YoungStudyState,r=document.querySelector('#studentView').getBoundingClientRect();return s.resolution[0]===Math.ceil(r.width*devicePixelRatio*s.quality)}",timeout=60000);f.evaluate('YoungStudy.pixelSignature()')
   ck('root_no_overflow_'+str(w),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   ck('child_no_overflow_'+str(w),f.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   if w==390:pic(p,'05_MOBILE_VIEWPORT');R['mobileViewport']=f.evaluate('YoungStudyState')
  ck('no_script_errors',not R['errors']);c.close();b.close()
 R['passed']=True
except Exception as e:R['passed']=False;R['exception']=str(e);raise
finally:(O/'INSPECTION_QA.json').write_text(json.dumps(R,ensure_ascii=False,indent=2));print(json.dumps(R,ensure_ascii=False,indent=2),flush=True)
