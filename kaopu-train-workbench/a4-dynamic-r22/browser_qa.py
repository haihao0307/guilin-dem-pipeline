from playwright.sync_api import sync_playwright
from pathlib import Path
import json,time,subprocess,sys,base64
P=Path(__file__).parent
server=subprocess.Popen([sys.executable,'-m','http.server','8121','--directory',str(P)])
time.sleep(1)
try:
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=b.new_page(viewport={'width':1000,'height':720});page.on('console',lambda m:print(m.type,m.text,flush=True));page.goto('http://127.0.0.1:8121')
  page.wait_for_function('window.QA && (QA.done || QA.errors.length)',timeout=300000)
  first=page.evaluate('QA');assert first.get('done')and not first['errors'],first
  views=[]
  for name,eye,cut,theta in [('phase0',[16,5,-4],100,.4),('phase1',[16,5,-4],100,1.4),('phase_collision',[16,5,-4],0,3.3545228223),('phase_return',[16,5,-4],100,.4)]:
   start=time.monotonic();page.evaluate('async v=>{await renderAt(v.theta-.4,{eye:v.eye},{cut:v.cut,initialTheta:.4,angularSpeed:1})}',{'eye':eye,'cut':cut,'theta':theta})
   raw=page.evaluate('c.toDataURL("image/png")');(P/(name+'-whole.png')).write_bytes(base64.b64decode(raw.split(',')[1]))
   q=page.evaluate('QA');q['pixel_readback_wall_s']=time.monotonic()-start;q['view']=name;views.append(q);print(json.dumps(q),flush=True)
   assert q.get('done')and not q['errors']and q['draws']==519 and q.get('glError')==0,q
  (P/'BROWSER_QA.json').write_text(json.dumps({'views':views,'scope':'reconstructed drive/actuation theta poses in whole assembly; valve gear frozen; known swept collision failure; no historical-exact or full mechanical acceptance'},indent=2));b.close()
finally:server.terminate()
