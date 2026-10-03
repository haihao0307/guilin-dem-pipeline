"""HTTP QA with the actual new shader, not a synthetic test image."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys,time,hashlib
base=sys.argv[1].rstrip('/')+'/';out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
R={'basis':'actual user-provided compact shader, deterministic initialization only','base':base,'checks':{},'errors':[],'phoneHardwareTested':False}
def ck(n,v):
 R['checks'][n]=bool(v);print(n,v,flush=True)
 if not v:raise AssertionError(n)
def get_frame(p):
 p.locator('#youngFrame').wait_for(state='visible');p.wait_for_timeout(200)
 f=p.locator('#youngFrame').element_handle().content_frame()
 f.wait_for_function('window.YoungStudyState?.ready||window.YoungStudyState?.error',timeout=45000)
 ck('actual_shader_ready',f.evaluate('YoungStudyState.ready'));return f

def seek(f,t):
 n=f.evaluate('YoungStudyState.frame');f.evaluate('(t)=>YoungStudy.seek(t)',t);f.wait_for_function('YoungStudyState.frame>'+str(n),timeout=30000);f.wait_for_timeout(100)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  c=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1);p=c.new_page();p.set_default_timeout(15000);p.on('pageerror',lambda e:R['errors'].append(str(e)))
  r=p.goto(base+'?qa=young-r01#view=young',wait_until='domcontentloaded',timeout=60000)
  ck('http200',r.status==200);ck('html_content_type','text/html' in r.headers.get('content-type',''))
  f=get_frame(p);ck('right_version',f.evaluate('YoungStudyState.version')=='young-study-r01-20261003')
  ck('top_tab_present',p.locator('[data-view=young]').is_visible());ck('top_tabs_preserved',all(p.locator('[data-view='+s+']').count()==1 for s in ['tree','blue','color','rosette','staghorn','ledger']))
  ck('actual_gl_canvas',f.locator('canvas').count()==2);ck('not_images',f.locator('img').count()==0);ck('not_videos',f.locator('video').count()==0);ck('no_file_import',p.locator('input[type=file]').count()+f.locator('input[type=file]').count()==0)
  raw=f.locator('#shader').text_content().strip();sha=hashlib.sha256(raw.encode()).hexdigest();ck('compiled_source_matches_manifest',sha==f.evaluate('YoungStudyState.sourceHash'));R['shaderSHA256']=sha
  sig=f.evaluate('YoungStudy.pixelSignature()');ck('teacher_student_same_source_frame',sig==f.evaluate('YoungStudy.pixelSignature("teacher")'))
  bright=f.evaluate('''()=>{const c=document.querySelector('#studentCanvas'),g=c.getContext('webgl2'),a=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,a);let lo=255,hi=0,n=0;for(let i=0;i<a.length;i+=52){lo=Math.min(lo,a[i]);hi=Math.max(hi,a[i]);if(a[i]>40)n++;}return {lo,hi,litSamples:n};}''')
  ck('real_nonblank_render',bright['hi']-bright['lo']>120 and bright['litSamples']>100);R['imageStatistics']=bright
  s=f.evaluate('YoungStudyState');ck('native_DPR_size',s['resolution'][0]>=s['cssSize'][0]*s['dpr']);R['desktopResolution']=s['resolution']
  p.screenshot(path=str(out/'PUBLIC_DESKTOP.png'));f.locator('#studentCanvas').screenshot(path=str(out/'PUBLIC_STUDENT.png'))
  seek(f,6);ck('time_changes_live_pixels',sig!=f.evaluate('YoungStudy.pixelSignature()'));seek(f,0);ck('reset_reproduces',sig==f.evaluate('YoungStudy.pixelSignature()'))
  seek(f,19);f.locator('#play').click();f.wait_for_function('YoungStudyState.time>20.1',timeout=30000);f.locator('#play').click();ck('unbounded_past_recording',f.evaluate('YoungStudyState.time')>20.1)
  f.locator('#refClose').click();a=f.evaluate('YoungStudyState.drawByRole.teacher');seek(f,32);ck('reference_closed',not f.locator('#teacherPanel').is_visible());ck('hidden_reference_stops',a==f.evaluate('YoungStudyState.drawByRole.teacher'))
  n=f.evaluate('YoungStudyState.frame');f.locator('#refToggle').click();f.wait_for_function('YoungStudyState.frame>'+str(n));ck('reference_reopens_synced',f.evaluate('YoungStudy.pixelSignature()===YoungStudy.pixelSignature("teacher")'))
  f.locator('#equal').click();f.wait_for_timeout(250);z=f.evaluate('YoungStudy.measure()');ck('reference_size_cap',z['teacherPanel']['width']<=z['studentPanel']['width']+2 and z['teacherPanel']['height']<=z['studentPanel']['height']+2);ck('plus_disabled_at_max',f.locator('#larger').is_disabled())
  f.locator('#smaller').click();ck('minus_works',f.evaluate('YoungStudyState.ratio')<1);f.locator('#layoutReset').click()
  p.locator('#know').click();ck('right_knowledge', '98' in p.locator('#knowText').inner_text());p.locator('#closeKnow').click()
  f.locator('#play').click();p.locator('[data-view=blue]').click();n=f.evaluate('YoungStudyState.frame');p.wait_for_timeout(400);ck('leaving_stops_hidden_program',n==f.evaluate('YoungStudyState.frame') and not f.evaluate('YoungStudyState.active'))
  for s in ['color','rosette','home','ledger','young']:
   p.locator('[data-view='+s+']').click();ck('navigation_'+s,p.locator('#view-'+s).is_visible())
  f=get_frame(p);ck('return_to_young_active',f.evaluate('YoungStudyState.active'));f.locator('#back').click();ck('child_return_to_home',p.locator('#view-home').is_visible())
  p.locator('[data-view=young]').click();f=get_frame(p);f.locator('#refClose').click();p.reload(wait_until='domcontentloaded');f=get_frame(p);ck('reload_preserves_reference_state',not f.locator('#teacherPanel').is_visible());f.locator('#layoutReset').click()
  p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(350);f=get_frame(p);ck('mobile_root_no_overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'));ck('mobile_study_no_overflow',f.evaluate('document.documentElement.scrollWidth<=innerWidth'));p.screenshot(path=str(out/'PUBLIC_MOBILE_VIEWPORT.png'));ck('no_script_errors',not R['errors']);c.close()
  c=b.new_context();c.add_init_script("const o=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl2'?null:o.call(this,t,...a)}");p=c.new_page();p.goto(base+'young-coral-r01/',wait_until='domcontentloaded');p.wait_for_function('YoungStudyState.error',timeout=20000);ck('failed_gl_is_explicit',not p.evaluate('YoungStudyState.ready'));ck('failed_gl_no_fake_image',p.locator('img').count()==0);c.close();b.close()
 R['passed']=True
except Exception as e:
 R['passed']=False;R['exception']=str(e);raise
finally:
 (out/'ACTUAL_HTTP_QA.json').write_text(json.dumps(R,ensure_ascii=False,indent=2));print(json.dumps(R,ensure_ascii=False,indent=2),flush=True)
