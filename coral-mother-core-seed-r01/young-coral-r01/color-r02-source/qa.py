from pathlib import Path
from playwright.sync_api import sync_playwright
import hashlib,json,sys,os
target=sys.argv[1];O=Path(sys.argv[2]);O.mkdir(parents=True,exist_ok=True)
local=not target.startswith('http')
R={'scope':'local set_content actual shader' if local else 'public HTTP actual shader','checks':{},'errors':[],'realPhoneTested':False,'paletteSamples':[]}
def ck(n,v):
 R['checks'][n]=bool(v);print(n,bool(v),flush=True)
 if not v:raise AssertionError(n)
def ready(f):
 f.wait_for_function('window.YoungStudyState?.ready||window.YoungStudyState?.error',timeout=60000)
 ck('ready',f.evaluate('YoungStudyState.ready'));f.evaluate('YoungStudy.pixelSignature()')
def sync(f,n):
 f.wait_for_function('YoungStudyState.frame>'+str(n),timeout=60000);f.evaluate('YoungStudy.pixelSignature()')
def child(p):
 p.locator('#youngFrame').wait_for(state='visible')
 f=p.locator('#youngFrame').element_handle().content_frame();ready(f);return f
def click(f,s):
 n=f.evaluate('YoungStudyState.frame');f.locator(s).click();sync(f,n)
def val(f,id,v):
 n=f.evaluate('YoungStudyState.frame');f.locator('#'+id).evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}))}',str(v));sync(f,n)
try:
 with sync_playwright() as pw:
  opts={'executable_path':'/usr/bin/chromium','headless':False,'args':['--no-sandbox','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl'],'env':{**os.environ,'DISPLAY':':99'}} if local else {'headless':True,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
  b=pw.chromium.launch(**opts);ctx=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
  p=ctx.new_page();p.set_default_timeout(30000);p.on('pageerror',lambda e:R['errors'].append(str(e)))
  if local:p.set_content(Path(target).read_text());f=p;ready(f)
  else:
   res=p.goto(target.rstrip('/')+'/?v=color-r02-20261004#view=young',wait_until='domcontentloaded',timeout=60000)
   ck('http200',res.status==200);ck('html_mime','text/html' in res.headers.get('content-type',''));f=child(p)
  ck('version',f.evaluate('YoungStudyState.version')=='young-color-r02-20261004')
  raw=f.locator('#shader').text_content().strip()
  ck('teacher_exact_R01',hashlib.sha256(raw.encode()).hexdigest()=='60f2ed28f199c435ffac60a6f9fde0426ff64246e69d5016eaf7fe65b5f5da2f')
  cp=f.locator('#colorShader').text_content().strip()
  ck('color_shader_hash',hashlib.sha256(cp.encode()).hexdigest()==f.evaluate('YoungStudyState.colorShaderHash'))
  geom=[line.strip() for line in raw.splitlines() if any(k in line for k in ['for(float','vec3 r','p = vec3','A = vec3','p.y++','p =  A','p.xz *=','s = 6.','for( int','s *= e','g +='])]
  ck('geometry_unchanged',all(line in cp for line in geom));R['geometryStatements']=geom
  ck('real_canvases',f.locator('canvas').count()==2);ck('no_images_videos_import',f.locator('img,video,input[type=file]').count()==0)
  d=f.evaluate('YoungStudyState');ck('native_pixels',d['resolution'][0]>=d['cssSize'][0]*d['dpr'])
  teacher=f.evaluate('YoungStudy.pixelSignature("teacher")');t=d['time'];hashes=[]
  for k in [1,2,3,4,0]:
   click(f,'[data-palette="'+str(k)+'"]');h=f.evaluate('YoungStudy.pixelSignature()')
   ck('teacher_preserved_'+str(k),teacher==f.evaluate('YoungStudy.pixelSignature("teacher")'))
   ck('time_preserved_'+str(k),f.evaluate('YoungStudyState.time')==t)
   ck('palette_button_'+str(k),f.locator('[data-palette="'+str(k)+'"]').get_attribute('aria-pressed')=='true')
   if k:
    ck('real_color_'+str(k),h!=teacher);hashes.append(h)
    f.locator('#studentCanvas').screenshot(path=str(O/('PALETTE_'+str(k)+'.png')))
    R['paletteSamples'].append({'palette':k,'hash':h})
   else:ck('original_exact_rollback',h==teacher)
  ck('four_distinct_colors',len(set(hashes))==4)
  click(f,'[data-palette="1"]');val(f,'pigment',0);ck('zero_exact_rollback',f.evaluate('YoungStudy.pixelSignature()')==teacher)
  val(f,'pigment',1);h=f.evaluate('YoungStudy.pixelSignature()')
  f.locator('#paletteEvidence').evaluate('(e)=>e.open=true')
  val(f,'mottle',0);ck('mottle_changes_pixels',f.evaluate('YoungStudy.pixelSignature()')!=h)
  val(f,'mottle',.75);val(f,'pale',0);ck('pale_changes_pixels',f.evaluate('YoungStudy.pixelSignature()')!=h)
  click(f,'#colorReset');ck('palette_reset_exact',f.evaluate('YoungStudy.pixelSignature()')==h)
  f.locator('#paletteEvidence').evaluate('(e)=>e.open=false')
  n=f.evaluate('YoungStudyState.frame');f.evaluate('YoungStudy.seek(6)');sync(f,n)
  ck('time_changes_view',f.evaluate('YoungStudy.pixelSignature()')!=h)
  click(f,'#reset');ck('time_reset_exact_color',f.evaluate('YoungStudy.pixelSignature()')==h)
  n=f.evaluate('YoungStudyState.frame');f.evaluate('YoungStudy.seek(600)');sync(f,n);ck('unbounded',f.evaluate('YoungStudyState.time')==600)
  click(f,'#reset')
  f.locator('#play').click();f.wait_for_function('YoungStudyState.time>.3',timeout=60000);f.locator('#play').click()
  ck('pause_works',not f.evaluate('YoungStudyState.playing'));click(f,'#reset')
  click(f,'#refClose');a=f.evaluate('YoungStudyState.drawByRole.teacher')
  n=f.evaluate('YoungStudyState.frame');f.evaluate('YoungStudy.seek(2)');sync(f,n)
  ck('hidden_teacher_stops',a==f.evaluate('YoungStudyState.drawByRole.teacher'))
  click(f,'#refToggle');ck('reference_reopens',f.locator('#teacherPanel').is_visible())
  click(f,'#equal');z=f.evaluate('YoungStudy.measure()')
  ck('reference_bound',z['teacherPanel']['width']<=z['studentPanel']['width']+2 and z['teacherPanel']['height']<=z['studentPanel']['height']+2)
  click(f,'#layoutReset');click(f,'#reset');f.evaluate('window.scrollTo(0,0)')
  p.screenshot(path=str(O/'WORKBENCH_DESKTOP.png'));R['desktop']=f.evaluate('YoungStudyState')
  if not local:
   p.locator('#know').click();ck('updated_knowledge','色彩 R02' in p.locator('#knowTitle').inner_text());p.locator('#closeKnow').click()
   for v in ['blue','color','rosette','home','ledger','young']:
    p.locator('[data-view='+v+']').click();ck('nav_'+v,p.locator('#view-'+v).is_visible())
   f=child(p);f.locator('#back').click();p.locator('#view-home').wait_for(state='visible');ck('back_home',True)
   p.locator('[data-view=young]').click();f=child(p);click(f,'[data-palette="4"]')
   p.reload(wait_until='domcontentloaded');f=child(p);ck('palette_reload',f.evaluate('YoungStudyState.palette')==4)
   click(f,'[data-palette="1"]')
  for width in [390,320,834]:
   p.set_viewport_size({'width':width,'height':844})
   f.wait_for_function("()=>{const s=YoungStudyState,r=document.querySelector('#studentView').getBoundingClientRect();return s.resolution[0]===Math.ceil(r.width*devicePixelRatio*s.quality)}",timeout=60000)
   f.evaluate('YoungStudy.pixelSignature()')
   ck('root_no_overflow_'+str(width),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   ck('child_no_overflow_'+str(width),f.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   if width==390:p.screenshot(path=str(O/'WORKBENCH_MOBILE_VIEWPORT.png'));R['mobileViewport']=f.evaluate('YoungStudyState')
  ck('no_script_errors',not R['errors']);ctx.close();b.close()
 R['passed']=True
except Exception as e:R['passed']=False;R['exception']=str(e);raise
finally:
 (O/'COLOR_QA.json').write_text(json.dumps(R,ensure_ascii=False,indent=2));print(json.dumps(R,ensure_ascii=False,indent=2),flush=True)
