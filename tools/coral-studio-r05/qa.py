from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,gzip,hashlib,json,sys,re,os
base=sys.argv[1];out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
actual=len(sys.argv)>3
if actual:
 payload=Path(sys.argv[3]).read_text().strip().split('#',1)[1].split('replay=',1)[1]
 decoded=json.loads(gzip.decompress(base64.urlsafe_b64decode(payload+'='*((-len(payload))%4))))
else:
 frag='#version 300 es\nprecision highp float;uniform vec3 iResolution;uniform float iTime;uniform int iFrame;out vec4 c;void main(){vec2 p=gl_FragCoord.xy/iResolution.xy;c=vec4(p,0.5+0.4*sin(iTime),1.);}'
 decoded={'schema':'coral-user-source-replay/1','sourceFile':'SYNTHETIC_HOST_TEST_NOT_CORAL','sha256':hashlib.sha256(frag.encode()).hexdigest(),'fragment':frag}
 payload=base64.urlsafe_b64encode(gzip.compress(json.dumps(decoded).encode(),mtime=0)).decode().rstrip('=')
R={'scope':'ACTUAL flower shader, local set_content' if actual else 'HTTP host synthetic shader; NOT coral visual verification','checks':{},'errors':[],'shaderSHA256':decoded['sha256']}
def ck(n,v):
 R['checks'][n]=bool(v)
 if not v:raise AssertionError(n)
def wait(p,n):p.wait_for_function('CoralRecoveryState.draws>'+str(n),timeout=45000);p.wait_for_timeout(150)
def seek(p,t):
 n=p.evaluate('CoralRecoveryState.draws');p.evaluate('(t)=>CoralRecovery.seek(t)',t);wait(p,n)
def load(p):
 if actual:
  B=Path(base);s=(B/'index.html').read_text()
  s=re.sub(r'<link rel="stylesheet" href="studio.css[^\"]*">',lambda _: '<style>'+(B/'studio.css').read_text()+'</style>',s)
  for n in ['studio.js','runtime.js']:s=re.sub(r'<script src="'+n+r'[^\"]*"></script>',lambda _,n=n:'<script>'+(B/n).read_text()+'</script>',s)
  p.evaluate('(s)=>location.hash=s','view=rosette&replay='+payload);p.set_content(s,wait_until='domcontentloaded')
 else:
  r=p.goto(base.rstrip('/')+'/?v=qa-r05#view=rosette&replay='+payload,wait_until='domcontentloaded',timeout=60000)
  ck('HTTP_200',r.status==200);ck('HTML_content_type','text/html' in r.headers.get('content-type',''))
 p.wait_for_function('window.CoralRecoveryState?.ready||window.CoralRecoveryState?.error',timeout=60000);ck('ready',p.evaluate('CoralRecoveryState.ready'));p.wait_for_timeout(180)
try:
 with sync_playwright() as pw:
  args=['--no-sandbox','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl'] if actual else ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
  b=pw.chromium.launch(**({'executable_path':'/usr/bin/chromium','headless':False} if actual else {'headless':True}),args=args)
  c=b.new_context(viewport={'width':1600,'height':1000},device_scale_factor=1);p=c.new_page();p.on('pageerror',lambda e:R['errors'].append(str(e)));load(p)
  ck('source_hash_unchanged',p.evaluate('CoralRecoveryState.sourceSHA256')==decoded['sha256']);ck('top_tabs_no_sidebar',p.locator('.nav').bounding_box()['width']>1500 and p.locator('.nav').bounding_box()['height']<60)
  z=p.evaluate('CoralStudio.measure()');R['nativeLayout']=z;ck('larger_student',z['student']['width']>1150);ck('reference_quarter',z['ratio']==.25);ck('transport_in_first_screen',p.locator('.transport').bounding_box()['y']+p.locator('.transport').bounding_box()['height']<1002)
  s=p.evaluate('CoralRecoveryState');ck('native_pixel_dimensions',s['resolution'][0]>=s['displaySize'][0]*s['devicePixelRatio'] and s['resolution'][1]>=s['displaySize'][1]*s['devicePixelRatio']);ck('not_fixed_960',s['resolution'][0]>960);ck('same_pixels_two_views',p.evaluate('CoralRecovery.pixelSignature()===CoralRecovery.pixelSignature("teacher")'))
  sig=p.evaluate('CoralRecovery.pixelSignature()');R['nativeResolution']=s['resolution']
  if actual:p.screenshot(path=str(out/'R05_fullview_native.png'));p.locator('#replica').screenshot(path=str(out/'R05_student_native.png'))
  for t in [15.5,16.5,60,600,3600]:
   seek(p,t);ck('unbounded_seek_'+str(t),p.evaluate('CoralRecoveryState.time')==t);ck('unmodified_source_time_'+str(t),p.evaluate('CoralRecoveryState.lastSourceTime')==t+45);ck('timeline_expands_'+str(t),float(p.locator('#timeline').get_attribute('max'))>t)
  if actual:p.screenshot(path=str(out/'R05_original_camera_3600.png'))
  seek(p,15.5);p.locator('#play').click();p.wait_for_function('CoralRecoveryState.time>17',timeout=45000);p.locator('#play').click();ck('play_crosses_recording_end',p.evaluate('CoralRecoveryState.time')>17)
  n=p.evaluate('CoralRecoveryState.draws');p.locator('#reset').click();wait(p,n);ck('reset_native_identical',p.evaluate('CoralRecovery.pixelSignature()')==sig)
  p.locator('#quality').select_option('hq');p.wait_for_timeout(350);R['hqResolution']=p.evaluate('CoralRecoveryState.resolution');ck('hq_really_more_pixels',R['hqResolution'][0]>=R['nativeResolution'][0]*1.49);ck('source_unchanged_hq',p.evaluate('CoralRecoveryState.sourceSHA256')==decoded['sha256'])
  p.locator('#quality').select_option('native');p.wait_for_timeout(250)
  p.locator('#equalView').click();p.wait_for_timeout(250);z=p.evaluate('CoralStudio.measure()');ck('ref_not_larger',z['teacher']['width']<=z['student']['width']+2 and z['teacher']['height']<=z['student']['height']+2)
  p.locator('#referenceClose').click();p.wait_for_timeout(250);z=p.evaluate('CoralStudio.measure()');ck('focus_fills_width',z['student']['width']>1540);a=p.evaluate('CoralRecoveryState.drawByRole.A');seek(p,30);ck('hidden_teacher_not_drawn',p.evaluate('CoralRecoveryState.drawByRole.A')==a)
  if actual:p.screenshot(path=str(out/'R05_student_full_width.png'))
  p.locator('#referenceToggle').click();p.wait_for_timeout(250);ck('reopen_synced',p.evaluate('CoralRecovery.pixelSignature()===CoralRecovery.pixelSignature("teacher")'))
  p.locator('#resetLayout').click();p.wait_for_timeout(180)
  for x in ['home','blue','color','staghorn','ledger','rosette']:
   p.locator('[data-view="'+x+'"]').click();ck('nav_'+x,p.locator('#view-'+x).is_visible());p.locator('#know').click();ck('knowledge_'+x,p.locator('#drawer').is_visible());p.locator('#closeKnow').click()
  p.locator('#play').click();p.wait_for_timeout(300);p.locator('#home').click();n=p.evaluate('CoralRecoveryState.draws');p.wait_for_timeout(250);ck('home_stops_render',p.evaluate('CoralRecoveryState.draws')==n);p.locator('[data-view=rosette]').click();p.wait_for_timeout(250)
  for w,h in [(320,844),(390,844),(834,1050),(1920,1080)]:
   p.set_viewport_size({'width':w,'height':h});p.wait_for_timeout(250);ck('no_overflow_'+str(w),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   for r in [.18,.25,1]:
    p.evaluate('(r)=>CoralStudio.setRatio(r)',r);p.wait_for_timeout(160);z=p.evaluate('CoralStudio.measure()');ck('ref_limit_'+str(w)+'_'+str(r),z['teacher']['width']<=z['student']['width']+2 and z['teacher']['height']<=z['student']['height']+2)
   p.locator('#resetLayout').click();p.wait_for_timeout(180)
   if actual and w==390:p.screenshot(path=str(out/'R05_mobile_native.png'))
  ck('no_images',p.locator('img').count()==0);ck('no_file_picker',p.locator('input[type=file]').count()==0);ck('no_errors',not R['errors']);R['finalState']=p.evaluate('CoralRecoveryState');c.close()
  c=b.new_context(viewport={'width':1024,'height':800},device_scale_factor=2);p=c.new_page();load(p);s=p.evaluate('CoralRecoveryState');ck('DPR2_native',s['resolution'][0]>=s['displaySize'][0]*2 and s['resolution'][1]>=s['displaySize'][1]*2);R['DPR2Resolution']=s['resolution'];c.close();b.close()
 R['passed']=True
except Exception as e:R['passed']=False;R['exception']=str(e);raise
finally:(out/'QA.json').write_text(json.dumps(R,ensure_ascii=False,indent=2));print(json.dumps(R,ensure_ascii=False,indent=2),flush=True)
