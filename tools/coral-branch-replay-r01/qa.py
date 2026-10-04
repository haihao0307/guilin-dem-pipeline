from pathlib import Path
from playwright.sync_api import sync_playwright
import json,hashlib,base64,re,os,sys
T=sys.argv[1];O=Path(sys.argv[2]);O.mkdir(parents=True,exist_ok=True);local=not T.startswith('http')
R={'scope':'local set_content/Blob worker' if local else 'HTTP actual worker-generated mesh','checks':{},'errors':[],'phone_hardware_tested':False,'stageMetrics':[]}
def check(n,v):
 R['checks'][n]=bool(v);print(n,v,flush=True)
 if not v:raise AssertionError(n)
def ready(f):
 f.wait_for_function('window.BranchReplayState?.ready||window.BranchReplayState?.error',timeout=60000)
 assert f.evaluate('BranchReplayState.ready'),f.evaluate('BranchReplayState.error')
 f.evaluate('BranchReplay.pixelHash()')
def stage(f,x):
 f.evaluate('(x)=>BranchReplay.setGrowth(x)',x)
 f.wait_for_function('(x)=>!BranchReplayState.pending&&BranchReplayState.completedGrowth===x',arg=x,timeout=60000)
 f.evaluate('BranchReplay.pixelHash()')
def embed(root):
 h=(root/'index.html').read_text();j=(root/'app.js').read_text();w=(root/'branch-worker.js').read_text()
 j=j.replace("new Worker('branch-worker.js?v=branch-r01')","new Worker(URL.createObjectURL(new Blob(["+json.dumps(w)+"],{type:'text/javascript'})))")
 data={x:'data:image/webp;base64,'+base64.b64encode((root/('teacher-'+x+'.webp')).read_bytes()).decode() for x in ['blue','clear','early']}
 j=j.replace("'teacher-'+(mode==='clear'?'clear':'blue')+'.webp'","(mode==='clear'?"+json.dumps(data['clear'])+":"+json.dumps(data['blue'])+")")
 for n,d in data.items():h=h.replace('teacher-'+n+'.webp',d);j=j.replace("'teacher-"+n+".webp'",json.dumps(d))
 h=h.replace('<link rel="stylesheet" href="style.css?v=branch-r01">','<style>'+(root/'style.css').read_text()+'</style>').replace('<script src="app.js?v=branch-r01"></script>','<script>'+j+'</script>')
 return h
try:
 with sync_playwright() as pw:
  opts=dict(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist'],env={**os.environ,'DISPLAY':':99'}) if local else dict(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  b=pw.chromium.launch(**opts);c=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1);p=c.new_page();p.set_default_timeout(15000);p.on('pageerror',lambda e:R['errors'].append(str(e)))
  if local:p.set_content(embed(Path(T)));f=p;ready(f)
  else:
   r=p.goto(T.rstrip('/')+'/?v=branch-r01-20261004#view=branch',wait_until='domcontentloaded',timeout=60000)
   check('HTTP200',r.status==200);check('HTML_MIME','text/html' in r.headers.get('content-type',''))
   p.locator('#branchFrame').wait_for(state='visible');f=p.locator('#branchFrame').element_handle().content_frame();ready(f)
  check('version',f.evaluate('BranchReplayState.version')=='branch-replay-r01-20261004')
  check('mesh_real',f.evaluate('BranchReplayState.generated&&BranchReplayState.metrics.triangles>10000'))
  check('three_seeds',f.evaluate('BranchReplayState.metrics.seedCount')==3)
  check('student_no_video_or_image',f.locator('.student img,.student video').count()==0)
  check('teacher_image_loaded',f.locator('#teacherImage').evaluate('(e)=>e.complete&&e.naturalWidth>0'))
  check('graph_children_attached',f.evaluate('BranchReplayState.graph.every(n=>n.parent<0||n.start.every((v,i)=>Math.abs(v-BranchReplayState.graph[n.parent].end[i])<1e-7))'))
  baseline=f.evaluate('BranchReplayState.geometryHash');pixels=f.evaluate('BranchReplay.pixelHash()');p.screenshot(path=str(O/'01_BLUE.png'))
  f.locator('#clear').click();f.evaluate('BranchReplay.pixelHash()')
  check('second_output_pixels',f.evaluate('BranchReplay.pixelHash()')!=pixels)
  check('same_generated_mesh',f.evaluate('BranchReplayState.geometryHash')==baseline)
  p.screenshot(path=str(O/'02_TRANSPARENT.png'))
  f.locator('#blue').click();check('blue_exact_return',f.evaluate('BranchReplay.pixelHash()')==pixels)
  stages=[]
  for g in [8,29,50,73,100]:
   stage(f,g);m=f.evaluate('BranchReplayState.metrics');m['hash']=f.evaluate('BranchReplayState.geometryHash');R['stageMetrics'].append(m);stages.append(m['activeBranches']);p.screenshot(path=str(O/('STAGE_'+str(g)+'.png')))
  check('increasing_branches',all(a<b for a,b in zip(stages,stages[1:])))
  check('different_geometry_per_stage',len({m['hash'] for m in R['stageMetrics']})==5)
  check('same_seed_start_not_global_scaling',f.evaluate('BranchReplayState.graph.filter(x=>x.parent<0).map(x=>x.start)')==[[-.6,-.43,.06],[.15,-.55,-.02],[-.55,-.67,.13]])
  stage(f,72);check('deterministic_regenerate',f.evaluate('BranchReplayState.geometryHash')==baseline)
  n=f.evaluate('BranchReplayState.meshUpdates');f.evaluate('BranchReplay.setParams({angle:47})');f.wait_for_function('BranchReplayState.meshUpdates>'+str(n),timeout=60000)
  check('rule_parameter_changes_mesh',f.evaluate('BranchReplayState.geometryHash')!=baseline)
  f.locator('#adjust').evaluate('(e)=>e.open=true');f.locator('#resetAll').click();f.locator('#adjust').evaluate('(e)=>e.open=false');f.evaluate('window.scrollTo(0,0)')
  f.wait_for_function('!BranchReplayState.pending&&BranchReplayState.completedGrowth===72',timeout=60000)
  check('parameter_reset_exact',f.evaluate('BranchReplayState.geometryHash')==baseline)
  box=f.locator('#canvas').bounding_box();x=box['x']+box['width']*.53;y=box['y']+box['height']*.45
  p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+75,y+35,steps=6);p.mouse.up()
  check('drag_changes_view',f.evaluate('BranchReplay.pixelHash()')!=pixels)
  check('drag_keeps_mesh',f.evaluate('BranchReplayState.geometryHash')==baseline)
  p.mouse.wheel(0,-100);f.wait_for_function('BranchReplayState.camera.zoom>1',timeout=10000);check('wheel_works',True);p.screenshot(path=str(O/'03_ROTATED_ZOOM.png'))
  f.locator('#resetView').click();check('camera_reset_exact',f.evaluate('BranchReplay.pixelHash()')==pixels)
  f.locator('#skeleton').click();check('skeleton_changes_pixels',f.evaluate('BranchReplay.pixelHash()')!=pixels);p.screenshot(path=str(O/'04_BRANCH_AXES.png'));f.locator('#skeleton').click()
  stage(f,8);f.locator('#play').click();f.wait_for_function('BranchReplayState.completedGrowth>12',timeout=60000)
  check('actual_growth_play',f.evaluate('BranchReplayState.playing'));f.locator('#play').click();check('pause',not f.evaluate('BranchReplayState.playing'))
  f.locator('#learning').evaluate('(e)=>e.open=true')
  for g,count in [(1,8),(2,64),(3,512)]:
   f.locator('[data-rule="'+str(g)+'"]').click();check('source_rule_'+str(g),f.evaluate('BranchReplayState.ruleDemo.segments')==count)
  f.locator('#learning').evaluate('(e)=>e.open=false');f.evaluate('window.scrollTo(0,0)')
  f.locator('#reference').click();check('teacher_hides',not f.locator('#teacherPanel').is_visible());f.locator('#reference').click()
  if not local:
   for tab in ['young','blue','color','rosette','ledger','home','branch']:
    p.locator('[data-view="'+tab+'"]').click();check('tab_'+tab,p.locator('#view-'+tab).is_visible())
   f=p.locator('#branchFrame').element_handle().content_frame();ready(f);f.locator('#back').click();p.locator('#view-home').wait_for(state='visible');check('return_to_home',True)
   p.locator('[data-view=branch]').click();f=p.locator('#branchFrame').element_handle().content_frame();ready(f)
  stage(f,72)
  for w in [390,320,834]:
   p.set_viewport_size({'width':w,'height':844});p.wait_for_timeout(250);f.evaluate('BranchReplay.pixelHash()')
   check('root_no_overflow_'+str(w),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   check('child_no_overflow_'+str(w),f.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   if w==390:p.screenshot(path=str(O/'05_MOBILE_VIEWPORT.png'))
  check('no_script_errors',not R['errors']);R['passed']=True;c.close();b.close()
except Exception as e:R['passed']=False;R['exception']=str(e);raise
finally:
 (O/'BRANCH_QA.json').write_text(json.dumps(R,ensure_ascii=False,indent=2))
 print(json.dumps({k:v for k,v in R.items() if k!='stageMetrics'},ensure_ascii=False,indent=2))
