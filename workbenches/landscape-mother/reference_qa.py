"""HTTPS/local-server reference-viewer QA with a labelled synthetic fixture.
The user's original GLB is not committed, downloaded or uploaded by this test.
Actual user-source inspection is separately recorded in the intake receipt.
"""
from pathlib import Path
import argparse,hashlib,json,subprocess
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',required=True);a=p.parse_args()
out=Path(a.output);out.mkdir(parents=True,exist_ok=True);fixture=out/'qa-static-fixture.glb'
subprocess.run(['node',str(Path(__file__).with_name('reference.test.mjs')),'--fixture',str(fixture)],check=True)
r={'basis':'synthetic fixture in actual Chromium; no user-source upload','url':a.url,'errors':[],'passed':False,'visualApproved':False,'productionReady':False}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':960})
  page.on('pageerror',lambda e:r['errors'].append(str(e)))
  page.on('requestfailed',lambda q:r['errors'].append(str(q.failure)))
  page.on('request',lambda q:r['errors'].append('unexpected POST '+q.url) if q.method!='GET' else None)
  page.add_init_script("window.probe={textures:0,uploads:0};for(const n of ['createTexture','bufferData']){const f=WebGL2RenderingContext.prototype[n];WebGL2RenderingContext.prototype[n]=function(...v){window.probe[n==='createTexture'?'textures':'uploads']++;return f.apply(this,v)}}")
  page.goto(a.url,wait_until='networkidle');page.set_input_files('#source',str(fixture));page.wait_for_function('window.__SOURCE?.state.ready || window.__SOURCE?.state.error',timeout=30000)
  assert not page.evaluate('window.__SOURCE.state.error')
  receipt=page.evaluate('window.__SOURCE.report()');assert receipt['sha256']==hashlib.sha256(fixture.read_bytes()).hexdigest();assert receipt['triangles']==1
  page.wait_for_timeout(200);before=page.evaluate('window.probe');page.mouse.move(850,400);page.mouse.down();page.mouse.move(950,470,steps=8);page.mouse.up();page.mouse.wheel(0,-100);page.wait_for_timeout(200);after=page.evaluate('window.probe');assert before['uploads']==after['uploads'] and after['textures']==0
  page.click('#save');page.wait_for_function("document.querySelector('#custody').textContent.includes('完整保存')")
  page.click('#clear');assert not page.evaluate('window.__SOURCE.state.ready');page.click('#restore');page.wait_for_function('window.__SOURCE.state.ready');assert page.evaluate('window.__SOURCE.report().sha256')==receipt['sha256']
  page.screenshot(path=str(out/'reference-fixture-desktop.png'));page.set_viewport_size({'width':390,'height':844});page.click('[data-view="fit"]');page.wait_for_timeout(200);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(out/'reference-fixture-mobile.png'))
  r.update({'passed':not r['errors'],'browserVersion':b.version,'receipt':receipt,'textures':after['textures'],'uploadsDuringMotion':after['uploads']-before['uploads'],'saveRestoreHashMatched':True,'sourceAssetPubliclyUploaded':False});b.close()
except Exception as e:r['errors'].append(str(e))
finally:
 (out/'reference-browser.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps(r,ensure_ascii=False))
raise SystemExit(0 if r['passed'] else 1)
