"""Actual Chromium execution with an explicitly artificial fixture.
Never substitute this fixture for the uploaded cliff or claim its art is approved.
"""
import argparse,hashlib,json,subprocess,time
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',required=True);args=p.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
fixture=out/'QA_ONLY_SOURCE_FIT_FIXTURE.glb';subprocess.run(['node',str(Path(__file__).with_name('test.mjs')),'--fixture',str(fixture)],check=True)
r={'basis':'real Chromium, synthetic geometry fixture only','actualUserSourceTested':False,'url':args.url,'errors':[],'passed':False,'visualApproved':False,'productionReady':False}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':2048,'height':1152},device_scale_factor=1)
  page.on('pageerror',lambda e:r['errors'].append(str(e)))
  page.on('requestfailed',lambda q:r['errors'].append(str(q.failure)))
  page.on('request',lambda q:r['errors'].append('unexpected non-GET request: '+q.url) if q.method!='GET' else None)
  page.add_init_script("window.probe={textures:0,uploads:0};for(const name of ['createTexture','bufferData']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...a){window.probe[name==='createTexture'?'textures':'uploads']++;return original.apply(this,a)}}")
  page.goto(args.url,wait_until='networkidle');assert not page.evaluate('window.__FIT.error')
  assert not page.evaluate('__FIT.ready');assert page.locator('#empty').is_visible()
  page.set_input_files('#source',str(fixture));page.wait_for_function('__FIT.ready || __FIT.error',timeout=180000)
  error=page.evaluate('__FIT.error');assert not error,error
  page.wait_for_function('!!__FIT.geometryHash',timeout=30000)
  r['audit']=page.evaluate('__FIT.audit');r['identity']=page.evaluate('__FIT.identity');assert r['identity']['sha256']==hashlib.sha256(fixture.read_bytes()).hexdigest();assert r['audit']['inputUnchanged'];assert r['audit']['recipeOnlyGenerator']
  assert page.locator('.feature').count()>5;assert page.locator('#colorMode').is_disabled()
  page.evaluate('__FIT.view.gl.finish()');page.screenshot(path=str(out/'fixture-source-fit.png'),timeout=120000)
  before=page.evaluate('({probe:window.probe,snapshot:__FIT.snapshot(),hash:__FIT.geometryHash})');page.mouse.move(1300,430);page.mouse.down();page.mouse.move(1370,490,steps=10);page.mouse.up();page.mouse.wheel(0,-100);page.wait_for_timeout(150)
  after=page.evaluate('({probe:window.probe,snapshot:__FIT.snapshot(),hash:__FIT.geometryHash})');assert before['probe']['uploads']==after['probe']['uploads'];assert after['probe']['textures']==0;assert before['snapshot']['counts']==after['snapshot']['counts'];assert before['hash']==after['hash'];assert before['snapshot']['camera']!=after['snapshot']['camera']
  page.locator('[data-mode="2"]').click();page.locator('.feature').first.click();page.wait_for_timeout(100);assert page.evaluate('__FIT.view.selected')>=0;page.evaluate('__FIT.view.gl.finish()');page.screenshot(path=str(out/'fixture-feature.png'))
  with page.expect_download() as d:page.locator('#exportRecipe').click()
  path=out/'recipe.json';d.value.save_as(path);recipe=json.loads(path.read_text());assert recipe['source']['sha256']==r['identity']['sha256'];assert 'indices' not in recipe and 'positions' not in recipe
  page.locator('#save').click();page.wait_for_timeout(300)
  page.set_viewport_size({'width':390,'height':844});page.locator('[data-view="front"]').click();page.wait_for_timeout(100);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.evaluate('__FIT.snapshot().counts')==before['snapshot']['counts'];page.evaluate('__FIT.view.gl.finish()');page.screenshot(path=str(out/'fixture-mobile.png'),timeout=120000)
  assert page.evaluate('__FIT.view.gl.getError()')==0;r.update({'browserVersion':browser.version,'before':before,'after':after,'desktopFramebuffer':[2048,1152],'mobileViewport':[390,844],'passed':not r['errors'],'noSourceUpload':True});browser.close()
except Exception as e:r['errors'].append(str(e))
finally:
 (out/'browser.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps({'passed':r['passed'],'errors':r['errors'],'actualUserSourceTested':False},ensure_ascii=False))
raise SystemExit(0 if r['passed'] else 1)
