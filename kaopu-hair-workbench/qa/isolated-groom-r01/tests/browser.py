import json,pathlib,time
from playwright.sync_api import sync_playwright
out=pathlib.Path(__file__).resolve().parents[1]/'evidence'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1200,'height':900},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8766/',wait_until='networkidle',timeout=90000)
 page.wait_for_function('window.hairDraft?.diagnostics().ready || window.hairDraft?.diagnostics().errors.length',timeout=120000)
 d=page.evaluate('window.hairDraft.diagnostics()');d['pageErrors']=errors
 (out/'initial.json').write_text(json.dumps(d,indent=2))
 page.screenshot(path=str(out/'front.png'))
 print(json.dumps({'ready':d['ready'],'errors':errors,'appErrors':d['errors'],'optics':d.get('optics'),'groom':d.get('groom')},indent=2),flush=True)
 b.close()
