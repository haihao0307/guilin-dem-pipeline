"""Diagnostic only: hidden 1-pixel cold dispatch distinguishes first-use compilation from native-frame workload. Not a rendering-quality or performance acceptance test."""
import functools,http.server,json,threading,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent;OUT=Path('public-inspection-evidence');OUT.mkdir(exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={'diagnosticOnly':True,'notNativeQualityAcceptance':True,'passed':False}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1366,'height':900},device_scale_factor=1);page.set_default_timeout(180000)
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html?startupProbe=1')
  page.wait_for_function('window.semanticInspection?.phase==="startup-probe-ready"')
  report['probe']=page.evaluate('''async()=>{const r=semanticInspection.renderer;try{return {result:await r.render({width:1,height:1,presentWidth:1,presentHeight:1,tileSize:32,gpuBatchTiles:1,source:true,design:true})}}catch(e){return{error:String(e),stats:r.currentFrameStats}}}''')
  report['passed']='error' not in report['probe'];browser.close()
finally:
 (OUT/'startup-probe.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));server.shutdown()
