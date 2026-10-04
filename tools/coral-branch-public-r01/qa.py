from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys
T=sys.argv[1].rstrip('/');O=Path(sys.argv[2]);O.mkdir(parents=True,exist_ok=True)
R={'scope':'actual generated mesh over HTTP','url':T,'checks':{},'errors':[],'phoneHardware':False,'stages':[]}
def ck(n,v):
 R['checks'][n]=bool(v);print(n,bool(v),flush=True)
 if not v:raise AssertionError(n)
def settled(f):
 f.wait_for_function('window.BranchStudyState?.error||(window.BranchStudyState?.ready&&!BranchStudyState.busy&&Math.abs(BranchStudyState.stats.growth-BranchStudyState.growth)<.0015&&BranchStudyState.output===BranchStudyState.stats.mode)',timeout=90000)
 assert not f.evaluate('BranchStudyState.error'),f.evaluate('BranchStudyState.error')
 f.evaluate('BranchStudy.pixelSignature()')
def seek(f,t):f.evaluate('(t)=>BranchStudy.seek(t)',t);settled(f)
def child(p):
 p.locator('#branchFrame').wait_for(state='visible');f=p.locator('#branchFrame').element_handle().content_frame();settled(f);return f
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1);p=ctx.new_page();p.set_default_timeout(30000);p.on('pageerror',lambda e:R['errors'].append(str(e)))
  r=p.goto(T+'/?v=branch-public-r01-20261004#view=branch',wait_until='domcontentloaded',timeout=60000)
  ck('http200',r.status==200);ck('html_mime','text/html' in r.headers.get('content-type',''));f=child(p)
  ck('version',f.evaluate('BranchStudyState.version')=='branch-reproduction-r01-20261004');ck('actual_geometry',f.evaluate('BranchStudyState.stats.triangles')>10000)
  ck('student_not_image',f.locator('.student img,.student video').count()==0)
  f.wait_for_function('document.querySelector("#refImage").complete&&document.querySelector("#refImage").naturalWidth>0')
  ck('reference_exists',True);ck('three_initial_branches',f.evaluate('BranchStudy.graph().filter(b=>b.parent<0).length')==3)
  ck('actual_depth',f.evaluate('Math.max(...BranchStudy.graph().map(b=>b.c[2]))-Math.min(...BranchStudy.graph().map(b=>b.c[2]))')>.15)
  parent_ok=f.evaluate('''()=>{const a=BranchStudy.graph();return a.every(b=>{if(b.parent<0)return true;const p=a[b.parent],t=b.attachmentFraction??1,q=p.a.map((v,i)=>(1-t)*(1-t)*v+2*t*(1-t)*p.b[i]+t*t*p.c[i]);return b.birth+1e-7>=p.birth+t*(p.end-p.birth)&&Math.hypot(...q.map((v,i)=>v-b.a[i]))<1e-6})}''')
  ck('parent_attachment_before_child_birth',parent_ok)
  fullhash=f.evaluate('BranchStudyState.geometryHash');fullpixel=f.evaluate('BranchStudy.pixelSignature()');counts=[];geometry=[]
  for t in [0,.2,.45,.7,1]:
   seek(f,t);st=f.evaluate('BranchStudyState');counts.append(st['stats']['activeBranches']);geometry.append(st['geometryHash']);R['stages'].append(st);p.screenshot(path=str(O/('growth-'+str(t)+'.png')))
  ck('branches_accumulate',counts==sorted(counts) and counts[-1]>counts[0]);ck('growth_changes_geometry',len(set(geometry))==5);ck('repeat_full_geometry_exact',f.evaluate('BranchStudyState.geometryHash')==fullhash);ck('repeat_full_pixels_exact',f.evaluate('BranchStudy.pixelSignature()')==fullpixel)
  f.locator('[data-output="1"]').click();settled(f);ck('output1_geometry_distinct',f.evaluate('BranchStudyState.geometryHash')!=fullhash);ck('output1_loaded',f.evaluate('BranchStudyState.output')==1);p.screenshot(path=str(O/'output1.png'));R['output1']=f.evaluate('BranchStudyState')
  f.locator('[data-output="2"]').click();settled(f);ck('output2_restores',f.evaluate('BranchStudyState.geometryHash')==fullhash);p.screenshot(path=str(O/'output2.png'));R['output2']=f.evaluate('BranchStudyState')
  f.locator('#skeleton').click();ck('skeleton_rendered',f.evaluate('BranchStudyState.skeleton') and f.evaluate('BranchStudy.pixelSignature()')!=fullpixel);p.screenshot(path=str(O/'skeleton.png'));f.locator('#skeleton').click();ck('surface_returns',f.evaluate('BranchStudy.pixelSignature()')==fullpixel)
  box=f.locator('#canvas').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.5;p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+110,y+30,steps=8);p.mouse.up();ck('drag_camera',abs(f.evaluate('BranchStudyState.yaw'))>.4);ck('camera_only_preserves_geometry',f.evaluate('BranchStudyState.geometryHash')==fullhash);ck('rotation_changes_pixels',f.evaluate('BranchStudy.pixelSignature()')!=fullpixel);p.screenshot(path=str(O/'rotated.png'))
  p.mouse.wheel(0,-200);f.wait_for_function('BranchStudyState.zoom>1');ck('wheel_zoom',True);f.locator('#camera').click();ck('camera_reset_exact',f.evaluate('BranchStudy.pixelSignature()')==fullpixel)
  f.locator('#glass').click();ck('glass_changes_pixels',f.evaluate('BranchStudy.pixelSignature()')!=fullpixel);f.locator('#glass').click();ck('glass_off_exact',f.evaluate('BranchStudy.pixelSignature()')==fullpixel)
  f.locator('#play').click();f.wait_for_function('BranchStudyState.growth>.06',timeout=20000);p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+50,y-15,steps=3);p.mouse.up();ck('drag_during_growth',f.evaluate('BranchStudyState.playing') and abs(f.evaluate('BranchStudyState.yaw'))>.1);f.locator('#play').click();ck('pause_works',not f.evaluate('BranchStudyState.playing'));seek(f,1);f.locator('#camera').click()
  f.locator('#closeRef').click();ck('reference_hides',not f.locator('#reference').is_visible());f.locator('#teacher').click();ck('reference_reopens',f.locator('#reference').is_visible())
  f.locator('#sourceTrace').evaluate('(e)=>e.open=true');ck('trace_contains_primary_sources',f.locator('#sourceTrace a').count()>=3);ck('source_truth_boundary','尚未取得' in f.locator('#sourceTrace').inner_text());f.locator('#sourceTrace').evaluate('(e)=>e.open=false')
  p.locator('#know').click();ck('knowledge_is_branch','分叉' in p.locator('#knowTitle').inner_text());p.locator('#closeKnow').click()
  for v in ['young','home','blue','color','rosette','branch']:
   p.locator('[data-view='+v+']').click();ck('nav_'+v,p.locator('#view-'+v).is_visible())
  f=child(p);f.locator('#back').click();p.locator('#view-home').wait_for(state='visible');ck('back_home',True);p.locator('[data-view=branch]').click();f=child(p)
  for w,h in [(390,844),(320,844),(834,1000)]:
   p.set_viewport_size({'width':w,'height':h});f.wait_for_timeout(200);f.evaluate('BranchStudy.draw()');ck('root_no_overflow_'+str(w),p.evaluate('document.documentElement.scrollWidth<=innerWidth'));ck('child_no_overflow_'+str(w),f.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   if w==390:p.screenshot(path=str(O/'phone-viewport.png'));R['mobileViewport']=f.evaluate('BranchStudyState')
  ck('no_errors',not R['errors']);ctx.close();browser.close()
 R['passed']=True
except Exception as e:R['passed']=False;R['exception']=str(e);raise
finally:(O/'BRANCH_QA.json').write_text(json.dumps(R,ensure_ascii=False,indent=2));print(json.dumps({'passed':R.get('passed'),'checks':R['checks'],'errors':R['errors'],'exception':R.get('exception')},ensure_ascii=False,indent=2))
