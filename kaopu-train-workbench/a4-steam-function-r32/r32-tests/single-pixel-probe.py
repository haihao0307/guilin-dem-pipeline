"""DIAGNOSTIC ONLY: first actual whole-scene pressure shader, one native pixel.
Not a low-resolution renderer, not whole-frame acceptance, not a published change.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import threading,json,time,os
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent
report={'status':'RUNNING','diagnostic_only':True,'whole_frame_accepted':False,'tested_commit':os.getenv('GITHUB_SHA'),'native_buffer':[720,400],'events':[]}
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(P.parent)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,channel='chrome',chromium_sandbox=True,ignore_default_args=['--enable-unsafe-swiftshader','--no-sandbox','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection'])
  report['browser_command']=browser.new_browser_cdp_session().send('Browser.getBrowserCommandLine')['arguments']
  assert not any(a.split('=')[0] in ['--no-sandbox','--disable-setuid-sandbox','--disable-web-security','--ignore-certificate-errors','--enable-unsafe-swiftshader','--disable-gpu-watchdog'] for a in report['browser_command'])
  page=browser.new_page(viewport={'width':1100,'height':1000})
  def event(data):report['events'].append(data);print('NATIVE_PIXEL_PROBE',json.dumps(data),flush=True)
  page.expose_function('reportNativePixelProbe',event)
  page.on('console',lambda m:print('CONSOLE',m.type,m.text,flush=True))
  page.add_init_script(path=str(P/'single-pixel-probe.js'))
  page.goto('http://127.0.0.1:'+str(server.server_port),wait_until='load')
  page.wait_for_function('window.__A4_NATIVE_PIXEL_RESULT',timeout=480000)
  report['result']=page.evaluate('__A4_NATIVE_PIXEL_RESULT');report['compiled']=page.evaluate('QA.compiled')
  # Synchronous GL return can precede the queued contextlost event. Never accept zeros.
  page.wait_for_timeout(500)
  report['post_event_turn']=page.evaluate('({contextLost:document.getElementById("c").getContext("webgl2").isContextLost(),startup:window.A4_STARTUP?.state,qa:window.QA})')
  report['status']='DIAGNOSTIC_SINGLE_PIXEL_RETURNED' if report['result']['glError']==0 and not report['result']['contextLost'] and not report['post_event_turn']['contextLost'] and report['result']['rgba'][3]==255 else 'DIAGNOSTIC_GPU_FAILURE'
  print(json.dumps(report),flush=True);browser.close()
except Exception as e:
 report['status']='DIAGNOSTIC_FAILED_OR_TIMED_OUT';report['failure']=repr(e);raise
finally:
 server.shutdown();server.server_close();(P/'SINGLE_PIXEL_RESULT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
