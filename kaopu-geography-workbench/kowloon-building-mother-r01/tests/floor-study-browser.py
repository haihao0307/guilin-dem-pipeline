import asyncio,json,argparse,sys,time
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/');p.add_argument('--output',required=True);p.add_argument('--compile-only',action='store_true');a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);r={'passed':False,'errors':[]}
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  page=await browser.new_page(viewport={'width':1100,'height':850});page.on('pageerror',lambda e:r['errors'].append(str(e)));page.on('console',lambda m:print('BROWSER',m.type,m.text,flush=True) if m.type=='error' else None)
  try:
   await page.goto(a.base+'tests/floor-study-probe.html');await page.wait_for_function('window.probe?.ready');r['compile']=await page.evaluate('probe.setup()');print('COMPILED',json.dumps(r['compile']['compile']),flush=True)
   if not a.compile_only:
    r['materials']=await page.evaluate('probe.materialProbe()');print('MATERIAL GPU READBACK',flush=True)
    for width in [32,160,640]:
     r[str(width)]=await page.evaluate('w=>probe.draw(w)',width);assert r[str(width)]['error']==0;print('DRAW',width,r[str(width)]['stats']['wallMs'],flush=True)
     if width==640:await page.locator('#view').screenshot(path=str(out/'first-floor-field.png'))
    await page.goto(a.base+'whole-building-floor-study-r01.html');await page.wait_for_function('wholeBuilding?.ready||wholeBuilding?.error',timeout=180000);assert not await page.evaluate('wholeBuilding.error');await page.evaluate('wholeBuilding.pause()');r['app']=await page.evaluate('({stats:wholeBuilding.lastStats,metadata:wholeBuilding.getFloorStudy().metadata})');await page.screenshot(path=str(out/'floor-app.png'));print('APP',r['app']['stats']['wallMs'],flush=True)
    await page.evaluate("wholeBuilding.setView('study-room')");await page.screenshot(path=str(out/'floor-rooms.png'))
    await page.evaluate("wholeBuilding.setView('study-window')");await page.evaluate('wholeBuilding.setWindowOpen(0)');await page.screenshot(path=str(out/'floor-window-closed.png'));await page.evaluate('wholeBuilding.setWindowOpen(.65)');await page.screenshot(path=str(out/'floor-window-open.png'))
    r['finalStats']=await page.evaluate('wholeBuilding.lastStats');assert not await page.evaluate('wholeBuilding.errors.length');
   assert not r['errors'];r['passed']=True
  except Exception as e:r['failure']=str(e);print('FAIL',repr(e),flush=True);await page.screenshot(path=str(out/'failure.png'))
  finally:(out/('compile.json' if a.compile_only else 'results.json')).write_text(json.dumps(r,indent=2));await browser.close();sys.exit(0 if r['passed'] else 1)
asyncio.run(main())
