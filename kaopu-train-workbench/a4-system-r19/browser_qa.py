import asyncio,json,time
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True)
  page=await b.new_page(viewport={'width':1280,'height':940})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  start=time.time();await page.goto(Path('index.html').resolve().as_uri());await page.wait_for_function('window.testAPI!==undefined');state=await page.evaluate('testAPI.getState()');assert state['error'] is None,state
  await page.screenshot(path='whole-function-browser.png',full_page=True)
  first=time.time()-start
  before=state['yaw'];box=await page.locator('#view').bounding_box();await page.mouse.move(box['x']+200,box['y']+200);await page.mouse.down();await page.mouse.move(box['x']+220,box['y']+210);await page.mouse.up();assert (await page.evaluate('testAPI.getState()'))['yaw']!=before
  await page.click('#reset');await page.uncheck('#cut');await page.screenshot(path='closed-boiler-browser.png',full_page=True);await page.check('#cut')
  await page.locator('#phase').fill('2300');await page.locator('#phase').dispatch_event('input');assert abs((await page.evaluate('testAPI.getState()'))['t']-2.3)<1e-9
  await page.uncheck('#steam');await page.screenshot(path='drive-browser.png',full_page=True);await page.check('#steam')
  for sample in json.loads(Path('expected.json').read_text()):
   actual=await page.evaluate('(t)=>testAPI.pose(t)',sample['t'])
   for a,e in zip(actual,sample['pose']):
    for k in ['big','small']:assert max(abs(x-y) for x,y in zip(a[k],e[k]))<1e-12
  assert not errors,errors
  Path('BROWSER_QA.json').write_text(json.dumps({'pass':True,'page_errors':errors,'first_page_and_screenshot_seconds':first,'controls':['drag','reset','cutaway','angle','layer'],'animation_perf_not_verified':True,'scope':'documentary teacher plus inferred registration, not exact 60009','renderer':'WebGL2 raymarched analytic fields, no train triangle meshes','source_assets_published':False},indent=2))
  await b.close()
asyncio.run(main())
