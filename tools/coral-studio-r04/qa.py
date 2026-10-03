from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,gzip,hashlib,json,sys
base=sys.argv[1].rstrip('/')+'/';out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
# Generic host fixture only. Real flower source is tested locally and not published here.
frag='#version 300 es\nprecision highp float;uniform vec3 iResolution;uniform float iTime;uniform int iFrame;out vec4 c;void main(){vec2 p=gl_FragCoord.xy/iResolution.xy;c=vec4(p,0.5+0.4*sin(iTime),1.);}'
data={'schema':'coral-user-source-replay/1','sourceFile':'SYNTHETIC_HOST_TEST_NOT_CORAL','sha256':hashlib.sha256(frag.encode()).hexdigest(),'fragment':frag}
packed=base64.urlsafe_b64encode(gzip.compress(json.dumps(data).encode(),mtime=0)).decode().rstrip('=');url=base+'?qa=studio-r04#view=rosette&replay='+packed
R={'scope':'HTTP host/UI test using synthetic shader, NOT flower visual acceptance','base':base,'checks':{},'errors':[]}
def ck(n,v):
 R['checks'][n]=bool(v)
 if not v:raise AssertionError(n)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  c=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1);p=c.new_page();p.on('pageerror',lambda e:R['errors'].append(str(e)))
  response=p.goto(url,wait_until='domcontentloaded',timeout=60000);ck('HTTP_200',response.status==200);ck('HTML_content_type','text/html' in response.headers.get('content-type',''))
  p.wait_for_function('window.CoralRecoveryState?.ready||window.CoralRecoveryState?.error',timeout=30000);ck('started',p.evaluate('CoralRecoveryState.ready'))
  s=p.evaluate('CoralRecovery.pixelSignature()');z=p.evaluate('CoralStudio.measure()');R['defaultSize']=z;ck('small_reference',z['teacher']['width']<z['student']['width']);ck('same_source_pair',s==p.evaluate('CoralRecovery.pixelSignature("teacher")'))
  p.locator('#equalView').click();z=p.evaluate('CoralStudio.measure()');ck('equal_limit',abs(z['teacher']['width']-z['student']['width'])<1 and z['teacher']['height']<=z['student']['height']+1);ck('max_disabled',p.locator('#referenceLarger').is_disabled());ck('resize_preserves_student_pixels',s==p.evaluate('CoralRecovery.pixelSignature()'))
  p.locator('#referenceSmaller').click();ck('smaller',p.evaluate('CoralStudio.referenceRatio')<1);p.locator('#referenceLarger').click();ck('larger',p.evaluate('CoralStudio.referenceRatio')==1)
  p.locator('#resetLayout').click();p.locator('#referenceClose').click();ck('closed',not p.locator('#teacherPanel').is_visible());ck('student_expands',p.evaluate('CoralStudio.measure().student.width')>R['defaultSize']['student']['width'])
  n=p.evaluate('CoralRecoveryState.draws');a=p.evaluate('CoralRecoveryState.drawByRole.A');p.evaluate('CoralRecovery.seek(6)');p.wait_for_function('CoralRecoveryState.draws>'+str(n),timeout=15000)
  ck('hidden_reference_not_rendered',a==p.evaluate('CoralRecoveryState.drawByRole.A'));ck('student_keeps_rendering',p.evaluate('CoralRecoveryState.draws')>n);ck('time_changes_pixels',p.evaluate('CoralRecovery.pixelSignature()')!=s)
  p.locator('#referenceToggle').click();p.wait_for_function('CoralRecoveryState.drawByRole.A>'+str(a),timeout=15000);ck('reopen_sync',p.evaluate('CoralRecovery.pixelSignature()===CoralRecovery.pixelSignature("teacher")'))
  n=p.evaluate('CoralRecoveryState.draws');p.locator('#reset').click();p.wait_for_function('CoralRecoveryState.draws>'+str(n),timeout=15000);ck('reset_exact_pixels',p.evaluate('CoralRecovery.pixelSignature()')==s)
  p.locator('#referenceClose').click();p.reload(wait_until='domcontentloaded');p.wait_for_function('CoralRecoveryState.ready',timeout=20000);ck('reload_remembers_closed',not p.locator('#teacherPanel').is_visible())
  p.goto(base+'?qa=stored#view=rosette',wait_until='domcontentloaded');p.wait_for_function('CoralRecoveryState.ready',timeout=20000);ck('stored_source_auto_restores',p.evaluate('CoralRecoveryState.sourceSHA256')==data['sha256']);ck('stored_layout_restores',not p.locator('#teacherPanel').is_visible())
  p.locator('#resetLayout').click();ck('default_layout_restored',p.evaluate('CoralStudio.referenceRatio===.4&&!CoralStudio.referenceHidden'))
  for x in ['home','blue','color','staghorn','ledger','rosette']:
   p.locator('[data-view="'+x+'"]').click();ck('nav_'+x,p.locator('#view-'+x).is_visible());p.locator('#know').click();ck('knowledge_'+x,p.locator('#drawer').is_visible());p.locator('#closeKnow').click()
  p.locator('#play').click();p.wait_for_function('CoralRecoveryState.time>0',timeout=15000);p.locator('#home').click();n=p.evaluate('CoralRecoveryState.draws');p.wait_for_timeout(250);ck('home_stops_draw',n==p.evaluate('CoralRecoveryState.draws'))
  p.locator('[data-view="rosette"]').click();p.keyboard.press('t');ck('keyboard_toggle',not p.locator('#teacherPanel').is_visible());p.keyboard.press('t')
  for w in [320,390,834,1440,1920]:
   p.set_viewport_size({'width':w,'height':844 if w<800 else 1050});ck('no_horizontal_overflow_'+str(w),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   for ratio in [.25,.4,.6,.8,1]:
    p.evaluate('(r)=>CoralStudio.setRatio(r)',ratio);z=p.evaluate('CoralStudio.measure()');ck('teacher_limit_'+str(w)+'_'+str(ratio),z['teacher']['width']<=z['student']['width']+1 and z['teacher']['height']<=z['student']['height']+1)
  ck('no_image_standin',p.locator('img').count()==0);ck('no_import_required',p.locator('input[type=file]').count()==0);ck('no_script_errors',not R['errors']);R['state']=p.evaluate('CoralRecoveryState');c.close()
  c=b.new_context();c.add_init_script("const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl2'?null:orig.call(this,t,...a)}");p=c.new_page();p.goto(url,wait_until='domcontentloaded');p.wait_for_function('CoralRecoveryState.error',timeout=15000);ck('explicit_failure_no_WebGL',p.evaluate('!CoralRecoveryState.ready'));ck('failure_not_replaced_by_image',p.locator('img').count()==0);c.close();b.close()
 R['passed']=True
except Exception as e:R['passed']=False;R['exception']=str(e);raise
finally:(out/'HOST_QA.json').write_text(json.dumps(R,ensure_ascii=False,indent=2));print(json.dumps(R,ensure_ascii=False,indent=2),flush=True)
