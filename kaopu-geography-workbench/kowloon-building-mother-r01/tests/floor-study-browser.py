import asyncio,json,argparse,sys,hashlib
from pathlib import Path
from playwright.async_api import async_playwright

EXPECTED_RUNTIME={'whole-building-floor-study-r01.html': '975ccf0adb118cae27aa93b50d493e61039d0e9de95c8c35a1f43c862c1d2688', 'whole-building-floor-study-r01/app.mjs': 'beaed54a01731c14f1c150d7576cf906155de0a4993e23c47bac6a8d492a4275', 'whole-building-floor-study-r01/renderer.mjs': '04edd4f7b9d934f27f32b1e751f9826a6c95bc686608e909b27c62371b1fc953', 'whole-building-floor-study-r01/floor-layout.mjs': '2e91fa35e6b194e95461b3cdf7117636b6af9afc46299adb32871443c16a230c', 'whole-building-floor-study-r01/style.css': '775819cbfe6bf871cb9d1d7914a5710b6b6a3d8558827c9f3e924ac3bf2adee3', 'whole-building-floor-study-r01/sources/plan-registration.json': 'f84457e63cefe8fb781ce83830b404ab2951ec8f8a80b62d509308a54a913ad8', 'floor-materials-r01/material-adapter.mjs': '3dd9a6f45c89cd1ca882927d1cb361de21bb43e24b807001710ba0430b441d11', 'floor-materials-r01/sources/field-sources.mjs': '5dbede5b3a34d2ac81fcc562eaa68cafe4a8d06ed2df77090b1a75f52932be68', 'floor-materials-r01/periodic-coverage.mjs': '87c67410fcf3a6f61e6cc280d1f772834119af6ac3f0f5d530f9b6ed4a8df841', 'whole-building-floor-study-r01/finish-dispatch.mjs': '61f368897e5032e9d771bda0143b3be68c62ab50f06351876e412a5898bb143e', 'whole-building-floor-study-r01/bounded-hit-query.mjs': 'db7451ffc16f43e92ca6ee35f209991635d644a32cb33f2362b825c2796c01a6', 'whole-building-floor-study-r01/primary-tile-index.mjs': '36bd84f83b2d929883de2f9af67fd8763cc1e76db67f7b1d5de161775243e5d1', 'whole-building-floor-study-r01/primary-aperture-index.mjs': 'f1b4fbf9db0c8c300be2996da97185a81e59bd60638f57ab2b997accf9351983', 'whole-building-floor-study-r01/bounded-structural-shadow.mjs': '39ac781813fcceb0fa673633fdeda608644de7df52a32796267b1fe1f1b9cfa5', 'whole-building-floor-study-r01/stair-connection.mjs': '5de547084a10300aeeb58d264407fc718b5bfd2c4f0743c30215095d9bbcb6ef'}

async def main():
 p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/');p.add_argument('--output',required=True);p.add_argument('--stage',choices=['compile','probe','app'],default='probe');a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);r={'passed':False,'stage':a.stage,'errors':[]}
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  page=await browser.new_page(viewport={'width':1100,'height':850})
  def observe(page):
   page.on('pageerror',lambda e:r['errors'].append(str(e)));page.on('console',lambda m:print('BROWSER',m.type,m.text,flush=True) if m.type=='error' else None)
  observe(page)
  try:
   r['runtimeHashes']={}
   for path,expected in EXPECTED_RUNTIME.items():
    response=await page.request.get(a.base+path);assert response.status==200
    actual=hashlib.sha256(await response.body()).hexdigest();assert actual==expected,path+' changed runtime';r['runtimeHashes'][path]=actual
   if a.stage in ['compile','probe']:
    await page.goto(a.base+'tests/floor-study-probe.html');await page.wait_for_function('window.probe?.ready');r['compile']=await page.evaluate('probe.setup()');print('COMPILED',json.dumps(r['compile']['compile']),flush=True)
   if a.stage=='probe':
    r['materials']=await page.evaluate('probe.materialProbe()');assert r['materials']['error']==0;print('MATERIAL GPU READBACK',flush=True)
    for width in [32,160,640]:
     r[str(width)]=await page.evaluate('w=>probe.draw(w)',width);assert r[str(width)]['error']==0;print('DRAW',width,r[str(width)]['stats']['wallMs'],flush=True)
     if width==640:await page.locator('#view').screenshot(path=str(out/'first-floor-field.png'));print('FIRST IMAGE READY',flush=True)
   if a.stage=='app':
    await page.goto(a.base+'whole-building-floor-study-r01.html');await page.wait_for_function('wholeBuilding?.ready||wholeBuilding?.error',timeout=180000);assert not await page.evaluate('wholeBuilding.error');await page.evaluate('async()=>{await wholeBuilding.pause();await wholeBuilding.setCamera({boundedShadow:true})}');r['app']=await page.evaluate('({stats:wholeBuilding.lastStats,metadata:wholeBuilding.getFloorStudy().metadata})');await page.screenshot(path=str(out/'floor-app.png'));print('APP',r['app']['stats']['wallMs'],flush=True)
    await page.evaluate("wholeBuilding.setView('study-room')");await page.screenshot(path=str(out/'floor-rooms.png'))
    await page.evaluate("wholeBuilding.setView('study-window')");await page.evaluate('wholeBuilding.setWindowOpen(0)');await page.screenshot(path=str(out/'floor-window-closed.png'));await page.evaluate('wholeBuilding.setWindowOpen(.65)');await page.screenshot(path=str(out/'floor-window-open.png'));print('ROOM AND HOSTED WINDOW CAPTURES READY',flush=True)
    r['cases']={}
    for case in ['lowrise','warehouse','kcc']:
     await page.evaluate('id=>wholeBuilding.chooseCase(id)',case)
     r['cases'][case]=await page.evaluate('({hash:wholeBuilding.sourceHash,caseId:wholeBuilding.getModel().caseId,stats:wholeBuilding.lastStats})');assert r['cases'][case]['caseId']==case;assert r['cases'][case]['hash'];print('CASE SWITCH',case,flush=True)
    assert not await page.evaluate('wholeBuilding.errors.length')
    await page.close()
    context=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
    page=await context.new_page();observe(page);await page.goto(a.base+'whole-building-floor-study-r01.html');await page.wait_for_function('wholeBuilding?.ready||wholeBuilding?.error',timeout=180000);assert not await page.evaluate('wholeBuilding.error');await page.evaluate('async()=>{await wholeBuilding.pause();await wholeBuilding.setCamera({boundedShadow:true})}')
    before=await page.evaluate('({camera:wholeBuilding.getCamera(),stats:wholeBuilding.lastStats,frames:wholeBuilding.frames.length})');box=await page.locator('#view').bounding_box();assert box
    await page.locator('#view').scroll_into_view_if_needed();box=await page.locator('#view').bounding_box();cdp=await context.new_cdp_session(page);x=box['x']+box['width']*.55;y=box['y']+box['height']*.48
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
    for i in range(1,5):await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+5*i,'y':y+2*i,'id':1}]});await asyncio.sleep(.05)
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    await page.wait_for_function('wholeBuilding.frames.at(-1)?.intent===wholeBuilding.latestIntent.number&&!wholeBuilding.renderer.busy',timeout=120000)
    r['mobile']=await page.evaluate('({camera:wholeBuilding.getCamera(),stats:wholeBuilding.lastStats,frames:wholeBuilding.frames,cancellations:wholeBuilding.cancellations,cssWidth:document.getElementById("view").getBoundingClientRect().width,dpr:devicePixelRatio})')
    assert r['mobile']['camera']!=before['camera'];assert r['mobile']['stats']['width']==before['stats']['width'];assert r['mobile']['stats']['width']>=r['mobile']['cssWidth'];assert not await page.evaluate('wholeBuilding.errors.length');await page.screenshot(path=str(out/'floor-mobile-touch.png'));print('MOBILE VIEWPORT TOUCH PASSED, NOT PHYSICAL IPHONE',flush=True)
   assert not r['errors'];r['passed']=True
  except Exception as e:
   r['failure']=str(e);print('FAIL',repr(e),flush=True)
   try:await page.screenshot(path=str(out/'failure.png'),timeout=10000)
   except Exception as screenshot_error:r['screenshotFailure']=str(screenshot_error)
  finally:
   (out/(a.stage+'.json')).write_text(json.dumps(r,indent=2));await browser.close();sys.exit(0 if r['passed'] else 1)
asyncio.run(main())
