"""Actual R17 browser interaction/state captures. Simulation is explicitly accelerated for QA, not a real-time performance demo."""
import functools,http.server,json,os,threading,traceback,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent;OUT=Path('public-inspection-evidence');OUT.mkdir(exist_ok=True)
report={'passed':False,'errors':[],'views':{},'simulation':'accelerated state progression; captures are actual rendered frames, not real-time smoothness evidence','realFloorRegistration':False,'simulationStepSeconds':10,'controllerSubstepSeconds':0.05}
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  context=browser.new_context(viewport={'width':1366,'height':900},device_scale_factor=1)
  page=context.new_page();page.set_default_timeout(180000);page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(os.environ.get('R17_URL',f'http://127.0.0.1:{server.server_port}/index.html'))
  try:page.wait_for_function('window.semanticInspection&&(semanticInspection.ready||semanticInspection.errors.length)',timeout=20000)
  except Exception:pass
  report['startup20s']=page.evaluate('({errors:semanticInspection.errors,stats:semanticInspection.renderer?.currentFrameStats,compile:semanticInspection.renderer?.compileStats,options:semanticInspection.renderer?.options,display:semanticInspection.getDisplaySize(),phase:semanticInspection.phase,view:semanticInspection.view,renderRequests:semanticInspection.renderRequests,deferredBootRequests:semanticInspection.deferredBootRequests,bootDisplay:semanticInspection.bootDisplay,presentedFrames:semanticInspection.presentedFrames})');(OUT/'journey-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  def settled():
   page.wait_for_function('semanticInspection.errors.length||semanticInspection.ready&&!semanticInspection.busy&&!semanticInspection.renderer.busy')
   errors=page.evaluate('semanticInspection.errors')
   if errors:
    report['failureState']=page.evaluate('({errors:semanticInspection.errors,stats:semanticInspection.renderer?.currentFrameStats,compile:semanticInspection.renderer?.compileStats,display:semanticInspection.getDisplaySize(),phase:semanticInspection.phase})');(OUT/'journey-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
   assert not errors,errors
  def capture(name):
   settled();print('CAPTURE',name,flush=True);page.screenshot(path=str(OUT/(name+'.png')));report['views'][name]=page.evaluate('({frame:semanticInspection.lastStats, journey:semanticInspection.kccJourney.snapshot(),display:semanticInspection.presentedDisplay,camera:semanticInspection.presentedCamera})');(OUT/'journey-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  settled();assert page.locator('#semanticMode').is_hidden();capture('r17-default-grey')
  page.click('[data-building="kcc"]');settled();capture('r17-kcc-six-face-recessed')
  report['profiles']=[page.evaluate('''async()=>{const {profileAssemblyArchetypes}=await import('./qa-assembly-archetype-profiler.mjs');return await profileAssemblyArchetypes(semanticInspection.renderer,()=>semanticInspection.render(),{label:'kcc-whole-native'})}''')]
  page.evaluate('semanticInspection.liftPanel.setExternalClock(true); semanticInspection.kccJourney.journey.goToFloor(1)');capture('r17-entry-design-landing')
  for floor,name in [(4,'fourth'),(28,'top')]:
   result=page.evaluate('(f)=>semanticInspection.kccJourney.journey.goToFloor(f)',floor);assert result['accepted'],result;settled()
   batch=page.evaluate("""async()=>{const s=semanticInspection,j=s.kccJourney.journey,states=[],was=s.bootLayoutReady;s.bootLayoutReady=false;try{for(let n=0;n<120;n++){const q=j.tick(10),lift=s.lifts.snapshot('kcc');states.push({phase:q.phase,floor:q.currentFloorId,passenger:q.passenger,lift});if(q.phase==='blocked')throw Error(JSON.stringify(q));if(!q.active)return{states,final:q};}throw Error('Original controller journey did not finish');}finally{s.bootLayoutReady=was;}}""")
   states=batch['states'];q=batch['final'];report.setdefault('legs',[]).append({'to':floor,'samples':states,'rendering':'intermediate simulation states recorded, not rendered or presented as video'});assert q['currentFloorId']==('P04' if floor==4 else 'T24')
   page.evaluate('semanticInspection.render()');settled()
   capture('r17-arrived-'+name)
   report['profiles'].append(page.evaluate('''async()=>{const {profileAssemblyArchetypes}=await import('./qa-assembly-archetype-profiler.mjs');return await profileAssemblyArchetypes(semanticInspection.renderer,()=>semanticInspection.render(),{label:'kcc-design-arrival-native'})}'''));(OUT/'journey-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  for room in 'ABCDEF':
   page.locator('#kccJourneyPanel select').nth(1).select_option(room)
   page.get_by_role('button',name='开本房门',exact=True).click();settled()
   if room=='A':page.get_by_role('button',name='层走廊书签',exact=True).click();settled()
   progression=page.evaluate("""()=>{const s=semanticInspection,was=s.bootLayoutReady,states=[];s.bootLayoutReady=false;try{const b=[...document.querySelectorAll('#kccJourneyPanel button')].find(b=>b.textContent==='前进一段');for(let n=0;n<20;n++){b.click();states.push(document.querySelector('#kccJourneyPanel').innerText);}return states;}finally{s.bootLayoutReady=was;}}""")
   page.evaluate('semanticInspection.render()');settled()
   status=page.locator('#kccJourneyPanel').inner_text();assert '100%' in status,status
   report.setdefault('roomTraversal',[]).append({'room':room,'increments':20,'usedInteriorBookmark':False,'status':status,'pathProgress':progression})
   capture('r17-top-design-room-'+room)
   returned=page.evaluate("""()=>{const s=semanticInspection,was=s.bootLayoutReady,states=[];s.bootLayoutReady=false;try{const b=[...document.querySelectorAll('#kccJourneyPanel button')].find(b=>b.textContent==='退回一段');for(let n=0;n<20;n++){b.click();states.push(document.querySelector('#kccJourneyPanel').innerText);}return states;}finally{s.bootLayoutReady=was;}}""")
   assert ' 0%' in returned[-1],returned[-1]
   report['roomTraversal'][-1]['returnPathProgress']=returned
   page.evaluate('semanticInspection.render()');settled()
   if room in 'AF':capture('r17-returned-corridor-from-'+room)

  assert not report['errors'];report['passed']=True;context.close();browser.close()
except Exception:
 report['errors'].append(traceback.format_exc())
 try:
  report['failureState']=page.evaluate('({errors:semanticInspection.errors,stats:semanticInspection.renderer?.stats,compile:semanticInspection.renderer?.compileStats,display:semanticInspection.getDisplaySize(),phase:semanticInspection.phase})');page.screenshot(path=str(OUT/'journey-failure.png'))
 except Exception as e:report['diagnosticError']=str(e)
 raise
finally:
 (OUT/'journey-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));server.shutdown()
