"""R32 whole train in a supported normal-sandbox browser. No unsafe flags.
This CI route does not retry the denied local sandbox or claim user-phone acceptance.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import threading, json, time, os, traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent; ROOT=P.parent
report={'status':'RUNNING','tested_commit':os.getenv('GITHUB_SHA'),'frames':[],'errors':[],
 'diagnostic_run':'whole R32 GPU interval-state integration; unchanged fields and native resolution','trace':[],'phone_verified':False,'whole_mechanical_acceptance':False,'fixed_render_buffer':[720,400]}
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,channel="chrome",chromium_sandbox=True,
   ignore_default_args=['--enable-unsafe-swiftshader','--no-sandbox','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection'])
  command=browser.new_browser_cdp_session().send('Browser.getBrowserCommandLine')['arguments']
  report['browser_command']=command
  forbidden=['--no-sandbox','--disable-setuid-sandbox','--disable-web-security','--ignore-certificate-errors','--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection']
  assert not any(a.split('=')[0] in forbidden for a in command),'Unsafe browser flag'
  page=browser.new_page(viewport={'width':1100,'height':1100})
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.on('console',lambda m:print('BROWSER_CONSOLE',m.type,m.text,flush=True))
  def trace(data):
   report['trace'].append(data)
   report['trace']=report['trace'][-1500:]
   if data.get('phase') in ['source-start','interval-batch']:(P/'BROWSER_R32_RESULT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
   print('A4_RENDER_TRACE',json.dumps(data,ensure_ascii=False),flush=True)
  page.expose_function('reportA4Trace',trace)
  # Actual app emits run-guarded part/stage progress; no legacy draw-wrapper mapping.
  page.goto('http://127.0.0.1:'+str(server.server_port),wait_until='load')
  page.wait_for_function('window.QA && (QA.done || QA.errors.length || window.A4_STARTUP?.state.errors.length)' ,timeout=180000)
  q=page.evaluate('QA');report['first']=q;report['firstStartup']=page.evaluate('A4_STARTUP.state')
  if not q['done'] or q['errors']:
   report['failureSnapshot']=page.evaluate('({qa:window.QA,startup:window.A4_STARTUP?.state,trace:window.__A4_TRACE,status:document.getElementById("status")?.textContent,rendered:document.getElementById("rendered")?.textContent})')
   try:page.screenshot(path=str(P/'failure-diagnostic-page.png'),full_page=True,timeout=10000)
   except Exception as screenshot_error:report['screenshot_error']=repr(screenshot_error)
   raise AssertionError(q)
  report['backend']=page.evaluate("""()=>{const e=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:gl.getParameter(e?e.UNMASKED_VENDOR_WEBGL:gl.VENDOR),renderer:gl.getParameter(e?e.UNMASKED_RENDERER_WEBGL:gl.RENDERER),version:gl.getParameter(gl.VERSION)};}""")
  report['hardware_gpu_claim']=False
  print('A4_FIRST_FRAME',json.dumps(q,ensure_ascii=False),flush=True)
  for name,mode,revision,open_,theta,eye,cut in [
   ('r32-whole','candidate','r32',1,.4,[24,13,15],100),
   ('r32-cut-closed','candidate','r32',0,1.7,[12,3.5,-4],0),
   ('r32-opposite','candidate','r32',1,2.5,[-12,3.5,-4],100),
   ('retained-r31','candidate','r31',1,.4,[24,13,15],100),
   ('retained-baseline','baseline','r31',1,.4,[24,13,15],100)]:
   t=time.monotonic()
   q=page.evaluate("""async o=>await renderAt(o.theta-.4,{eye:o.eye},{cut:o.cut,initialTheta:.4,angularSpeed:1,installation:{mode:o.mode,beta:.126,steamRevision:o.revision,regulatorOpen:o.open},appearance:{mode:'waves',detailScale:1}})""",dict(mode=mode,revision=revision,open=open_,theta=theta,eye=eye,cut=cut))
   assert q['done'] and q['frameValid'] and not q['errors'] and q['glError']==0,q
   assert q['draws']==(519 if mode=='baseline' else 703 if revision=='r32' else 693),q
   pixels=page.evaluate("""()=>{const a=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,a);let n=0;const colors=new Set();for(let i=0;i<a.length;i+=4){if(Math.max(Math.abs(a[i]-a[0]),Math.abs(a[i+1]-a[1]),Math.abs(a[i+2]-a[2]))>4)n++;colors.add((a[i]<<16)|(a[i+1]<<8)|a[i+2]);}return {nonBackgroundPixels:n,colors:colors.size,glError:gl.getError()};}""")
   assert pixels['nonBackgroundPixels']>1000 and pixels['colors']>20 and pixels['glError']==0,pixels
   page.locator('#c').screenshot(path=str(P/(name+'.png')))
   report['frames'].append({'name':name,'qa':q,'pixelReadback':pixels,'wall_seconds':time.monotonic()-t})
  page.add_script_tag(path=str(P/'gpu-scalar-probe.js'))
  report['new_geometry_gpu']=page.evaluate('async()=>await runR32ScalarProbe()')
  assert report['new_geometry_gpu']['status']=='PASS',report['new_geometry_gpu']
  # Real page input events: camera-only drag and rapid zoom coalescing.
  page.select_option('#installation','candidate')
  page.wait_for_function('RESEARCH_UI.ready && !RESEARCH_UI.busy && QA.done',timeout=180000)
  before_eye=page.evaluate('RESEARCH_UI.cameraEye()')
  box=page.locator('#c').bounding_box()
  page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5)
  page.mouse.down();page.mouse.move(box['x']+box['width']*.5+28,box['y']+box['height']*.5+9);page.mouse.up()
  page.wait_for_function('!RESEARCH_UI.busy && QA.done',timeout=180000)
  after_eye=page.evaluate('RESEARCH_UI.cameraEye()')
  assert after_eye!=before_eye,'Drag did not change camera'
  page.evaluate("""()=>{const e=document.getElementById('camera-distance');for(const v of ['1.1','1.2','1.05']){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}}""")
  page.wait_for_function('!RESEARCH_UI.busy && QA.done',timeout=180000)
  ui=page.evaluate("({qa:QA,zoom:document.getElementById('camera-distance').value,eye:RESEARCH_UI.cameraEye(),playing:RESEARCH_UI.playing})")
  assert ui['zoom']=='1.05' and ui['qa']['done'] and ui['qa']['frameValid'] and ui['qa']['draws']==703,ui
  report['interaction']={'pointer_drag':True,'before_eye':before_eye,'after_eye':after_eye,'rapid_zoom_final':ui,'mobile_hardware_verified':False}
  page.locator('#c').screenshot(path=str(P/'r32-interaction-final.png'))
  # Actual context loss after a successful frame must invalidate QA and UI.
  page.evaluate("gl.getExtension('WEBGL_lose_context').loseContext()")
  page.wait_for_function('!QA.done && !QA.frameValid && A4_STARTUP.state.errors.length>0',timeout=10000)
  report['post_success_context_loss']=page.evaluate('({done:QA.done,frameValid:QA.frameValid,rendered:document.getElementById("rendered").textContent,errors:A4_STARTUP.state.errors})')
  # One supported restoration must create a new generation and rebuild actual GPU resources.
  old_run=page.evaluate('A4_STARTUP.state.runId')
  page.evaluate("gl.getExtension('WEBGL_lose_context').restoreContext()")
  page.wait_for_function('(old)=>A4_STARTUP.state.runId>old && QA.done && QA.frameValid',arg=old_run,timeout=180000)
  report['restored_frame']=page.evaluate('({qa:QA,startup:A4_STARTUP.state,rendererRun:A4_RENDERER.runId})')
  assert report['restored_frame']['qa']['draws']==703 and report['restored_frame']['qa']['glError']==0
  page.locator('#c').screenshot(path=str(P/'r32-restored-generation.png'))
  # Repeated loss is not allowed to create an automatic refresh/restart loop.
  restored_run=page.evaluate('A4_STARTUP.state.runId')
  page.evaluate("gl.getExtension('WEBGL_lose_context').loseContext()")
  page.wait_for_function('!QA.done && A4_STARTUP.state.errors.length>0',timeout=10000)
  page.evaluate("gl.getExtension('WEBGL_lose_context').restoreContext()")
  page.wait_for_timeout(1000)
  report['second_restore_stopped']=page.evaluate('({runId:A4_STARTUP.state.runId,done:QA.done,errors:A4_STARTUP.state.errors})')
  assert report['second_restore_stopped']['runId']==restored_run and not report['second_restore_stopped']['done']
  browser.close();report['status']='PASS' 
except Exception as e:
 try:
  report['failureSnapshot']=page.evaluate('({qa:window.QA,startup:window.A4_STARTUP?.state,trace:window.__A4_TRACE,status:document.getElementById("status")?.textContent,rendered:document.getElementById("rendered")?.textContent})')
  page.screenshot(path=str(P/'failure-diagnostic-page.png'),full_page=True,timeout=10000)
 except Exception as snapshot_error:report['snapshot_error']=repr(snapshot_error)
 report['status']='FAIL_OR_ENVIRONMENT_BLOCKED';report['failure']=repr(e);report['traceback']=traceback.format_exc()
 raise
finally:
 server.shutdown();server.server_close()
 (P/'BROWSER_R32_RESULT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps({'status':report['status'],'frames':len(report['frames']),'failure':report.get('failure')},ensure_ascii=False),flush=True)
