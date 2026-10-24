from playwright.sync_api import sync_playwright
from pathlib import Path
import json,time,subprocess,sys
P=Path(__file__).parent
server=subprocess.Popen([sys.executable,"-m","http.server","8121","--directory",str(P)])
time.sleep(1)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1000,'height':720});page.on('console',lambda m:print(m.type,m.text,flush=True));page.goto('http://127.0.0.1:8121');
 try:page.wait_for_function('window.QA && (QA.done || QA.errors.length)',timeout=300000)
 except Exception as e:print(e,flush=True)
 q=page.evaluate('QA');print(json.dumps(q),flush=True);(P/'BROWSER_QA.json').write_text(json.dumps(q,indent=2));page.screenshot(path=str(P/'whole-private.png'));b.close();server.terminate()
 assert q.get('done') and not q['errors'] and q['draws']==513 and q.get('glError')==0, q
