"""Reproducible actual Chromium/WebGL QA. Requires existing Playwright+Chromium.
This test does not claim to have run merely because the file is present.
"""
import argparse,json,pathlib
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/');p.add_argument('--output',default='evidence/browser');a=p.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
checks=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto(a.url,wait_until='networkidle');page.wait_for_function('window.__BUILDING_MOTHER__?.ready')
 for index in range(3):
  page.locator(f'[data-building="{index}"]').click();page.screenshot(path=str(out/f'baseline-{index}.png'));checks.append({'baseline':index,'state':page.evaluate('window.__BUILDING_MOTHER__.snapshot().assemblies')})
 page.locator('#windowFocus').click();page.screenshot(path=str(out/'window-closed.png'))
 for angle in [40,80,0]:
  page.locator('#window-angleDegrees').press('Home')
  for _ in range(angle): page.locator('#window-angleDegrees').press('ArrowRight')
  page.screenshot(path=str(out/f'window-{angle}.png'))
 page.locator('[data-visible="p003"]').uncheck();s=page.evaluate('window.__BUILDING_MOTHER__.snapshot()');assert len(s['export']['operations'])==21
 page.locator('[data-visible="p003"]').check();page.locator('[data-enabled="p003"]').uncheck();s=page.evaluate('window.__BUILDING_MOTHER__.snapshot()');assert len(s['export']['operations'])==20 and s['export']['designWindow']['suppressedByHost']
 page.locator('#floorInspect').click();page.screenshot(path=str(out/'floor-cutaway.png'));s=page.evaluate('window.__BUILDING_MOTHER__.snapshot()');assert s['floors']['slabCount']==21 and len(s['floors']['openings'])==21
 page.locator('#windowFocus').click();assert page.evaluate('window.__BUILDING_MOTHER__.snapshot().assemblies[1].visiblePatches')==20
 page.locator('#reset').click();assert page.evaluate('window.__BUILDING_MOTHER__.snapshot().window.enabled') is False
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'mobile.png'));assert page.locator('#failure').is_hidden();assert errors==[]
 assert page.evaluate('window.__BUILDING_MOTHER__.snapshot().errors')==[]
 assert page.evaluate('window.__BUILDING_MOTHER__.snapshot().renderer.triangles')>100
 assert page.evaluate("window.__BUILDING_MOTHER__.snapshot().pbr.enabled") is True
 (out/'results.json').write_text(json.dumps({'checks':checks,'errors':errors,'status':'passed'},indent=2));browser.close()
