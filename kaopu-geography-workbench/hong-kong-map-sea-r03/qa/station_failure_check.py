from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json
R=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(R)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1600,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/station-data.js',lambda route:route.abort('failed'))
 page.goto(f'http://127.0.0.1:{server.server_port}/index.html',wait_until='load',timeout=120000)
 page.wait_for_function('window.HKMap?.getState().ready',timeout=300000)
 page.evaluate('HKBackgroundSea.pause()');page.wait_for_timeout(500)
 state=page.evaluate('HKMap.getState()');load=page.evaluate('window.HK_STATION_LOAD')
 assert not load['ready'] and load['error']
 assert state['qa']['kowloonStation']['status']=='load-failed'
 assert not state['qa']['kowloonStation'].get('renderTriangles')
 assert state['qa']['terrainTriangles']>100000 and state['qa']['lastGLerror']==0
 assert page.locator('[data-map-view=kowloon]').is_disabled()
 assert page.locator('[data-map-view=kowloon]').inner_text()=='九龙站未加载'
 assert not errors
 page.screenshot(path=str(R/'qa/station-load-failure.png'))
 (R/'qa/STATION_FAILURE_QA.json').write_text(json.dumps({'passed':True,'injectedFailure':'station-data.js request aborted','terrainReady':state['ready'],'terrainTriangles':state['qa']['terrainTriangles'],'stationLoad':load,'pageErrors':errors},ensure_ascii=False,indent=2))
 b.close()
server.shutdown();print('Station resource failure is explicit; terrain stays interactive.')
