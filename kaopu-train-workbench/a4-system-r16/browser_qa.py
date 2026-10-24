import asyncio,json,math
from pathlib import Path
from playwright.async_api import async_playwright
from system import system_pose
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  page=await browser.new_page(viewport={'width':1600,'height':1100},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(Path('index.html').resolve().as_uri());await page.screenshot(path='whole-system-browser.png',full_page=True)
  initial=await page.evaluate('testAPI.getState()');await page.click('#play');await page.wait_for_timeout(500);played=await page.evaluate('testAPI.getState()');await page.click('#play');paused=await page.evaluate('testAPI.getState()');await page.wait_for_timeout(150);paused2=await page.evaluate('testAPI.getState()')
  await page.select_option('#part','superheater');assert '过热器' in await page.locator('#detail').inner_text()
  await page.select_option('#layer','drive');await page.screenshot(path='drive-layout-browser.png',full_page=True)
  for t in [0,.3,1.5,3.8,6.1]:
   js=await page.evaluate('(t)=>testAPI.pose(t)',t);py=system_pose(t,[0,1.7,4.3],[0,.11,0])
   for s in ['left','middle','right']:
    for k in ['big','small']:assert max(abs(a-b) for a,b in zip(js[s][k],py[s][k]))<1e-12
  await page.select_option('#layer','all');await page.click('#reset');await page.select_option('#part','driver_middle');await page.screenshot(path='whole-system-browser.png',full_page=True)
  await page.set_viewport_size({'width':430,'height':932});await page.screenshot(path='mobile-layout-browser.png',full_page=True)
  report={'browser':'pinned Playwright Chromium in isolated Actions job, local file','page_errors':errors,'play_advances':played['t']>initial['t'],'pause_holds':paused['t']==paused2['t'],'part_selection':True,'layer_selection':True,'python_js_pose_agreement_5_angles':True,'desktop_and_mobile_captured':True,'live_site_published':False,'renderer':'Canvas projected analytic curves/relationship lines, not full 3D solids'}
  assert not errors and report['play_advances'] and report['pause_holds'];Path('BROWSER_QA.json').write_text(json.dumps(report,indent=2));print(report);await browser.close()
asyncio.run(main())
