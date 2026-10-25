"""Actual R17 browser interaction/state captures. Simulation is explicitly accelerated for QA, not a real-time performance demo."""
import functools,http.server,json,os,threading,traceback,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent;OUT=Path('public-inspection-evidence');OUT.mkdir(exist_ok=True)
report={'passed':False,'errors':[],'views':{},'simulation':'accelerated state progression; captures are actual rendered frames, not real-time smoothness evidence','realFloorRegistration':False}
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
  report['startup20s']=page.evaluate('({errors:semanticInspection.errors,stats:semanticInspection.renderer?.currentFrameStats,compile:semanticInspection.renderer?.compileStats,options:semanticInspection.renderer?.options,display:semanticInspection.getDisplaySize(),phase:semanticInspection.phase,view:semanticInspection.view,renderRequests:semanticInspection.renderRequests,presentedFrames:semanticInspection.presentedFrames})');(OUT/'journey-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
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
  report['profiles']=[page.evaluate('''async()=>{const {profileRendererGpu}=await import('./qa-gpu-stage-profiler.mjs');return await profileRendererGpu(semanticInspection.renderer,()=>semanticInspection.render(),{label:'kcc-whole-native'})}''')]
  page.evaluate('semanticInspection.liftPanel.setExternalClock(true); semanticInspection.kccJourney.journey.goToFloor(1)');capture('r17-entry-design-landing')
  for floor,name in [(4,'fourth'),(28,'top')]:
   result=page.evaluate('(f)=>semanticInspection.kccJourney.journey.goToFloor(f)',floor);assert result['accepted'],result
   states=[]
   for n in range(120):
    q=page.evaluate('(()=>{const j=semanticInspection.kccJourney.journey;j.tick(2);return j.snapshot()})()');settled()
    states.append({'phase':q['phase'],'floor':q['currentFloorId'],'passenger':q['passenger'],'liftState':q['liftState']})
    if q['phase']=='blocked':raise AssertionError(q)
    if not q['active']:break
   else:raise AssertionError('Lift did not complete original state journey')
   report.setdefault('legs',[]).append({'to':floor,'samples':states});assert q['currentFloor']['designOrdinal']==floor if 'designOrdinal' in q['currentFloor'] else q['currentFloorId']==('P04' if floor==4 else 'T24')
   capture('r17-arrived-'+name)
   report['profiles'].append(page.evaluate('''async()=>{const {profileRendererGpu}=await import('./qa-gpu-stage-profiler.mjs');return await profileRendererGpu(semanticInspection.renderer,()=>semanticInspection.render(),{label:'kcc-design-arrival-native'})}'''))
  for room in 'ABCDEF':
   page.locator('#kccJourneyPanel select').nth(1).select_option(room)
   page.get_by_role('button',name='开本房门',exact=True).click();settled()
   page.get_by_role('button',name='层走廊书签',exact=True).click();settled()
   page.get_by_role('button',name='前进一段',exact=True).click();settled()
   page.get_by_role('button',name='房区内书签',exact=True).click();capture('r17-top-design-room-'+room)
  assert not report['errors'];report['passed']=True;context.close();browser.close()
except Exception:
 report['errors'].append(traceback.format_exc())
 try:
  report['failureState']=page.evaluate('({errors:semanticInspection.errors,stats:semanticInspection.renderer?.stats,compile:semanticInspection.renderer?.compileStats,display:semanticInspection.getDisplaySize(),phase:semanticInspection.phase})');page.screenshot(path=str(OUT/'journey-failure.png'))
 except Exception as e:report['diagnosticError']=str(e)
 raise
finally:
 (OUT/'journey-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));server.shutdown()
