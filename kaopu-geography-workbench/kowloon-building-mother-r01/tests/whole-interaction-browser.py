import asyncio,json,time,argparse,sys
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/');p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);r={'passed':False,'errors':[]};start=time.time()
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await browser.new_page(viewport={'width':1120,'height':850},device_scale_factor=1);page.on('pageerror',lambda e:r['errors'].append(str(e)));page.on('console',lambda m:print('BROWSER',m.type,m.text,flush=True))
  async def clear():await page.wait_for_function('wholeBuilding.lastStats?.width===640 && !wholeBuilding.renderer.busy',timeout=120000)
  try:
   await page.goto(a.base+'whole-building-interaction-r01.html');await page.wait_for_function('wholeBuilding.ready||wholeBuilding.error',timeout=120000);assert not await page.evaluate('wholeBuilding.error');await page.evaluate('wholeBuilding.pause()');r['startup']=await page.evaluate('({stats:wholeBuilding.lastStats,compile:wholeBuilding.renderer.compileStats,sourceHash:wholeBuilding.sourceHash})');print('FIRST REAL FRAME',r['startup']['stats'],flush=True);await page.screenshot(path=str(out/'first-whole-preview.png'))
   # Same geometry and neighbouring frames at equal actual sampling.
   r['sameCameraProbes']={}
   for view in ['whole','circulation']:
    if view=='circulation':await page.evaluate("wholeBuilding.setView('circulation')")
    values=[]
    for _ in range(2):await page.evaluate('wholeBuilding.render(128)');values.append(await page.evaluate('wholeBuilding.lastStats'))
    r['sameCameraProbes'][view]=values
   await page.evaluate("wholeBuilding.setView('circulation')");before=await page.evaluate('({camera:wholeBuilding.getCamera(),frames:wholeBuilding.presentedFrames})');box=await page.locator('#view').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.5
   print('REAL POINTER ORBIT',flush=True);await page.mouse.move(x,y);await page.mouse.down()
   for i in range(1,11):await page.mouse.move(x+12*i,y+3*i);await page.wait_for_timeout(180)
   during=await page.evaluate('({camera:wholeBuilding.getCamera(),frames:wholeBuilding.presentedFrames,history:wholeBuilding.frames.slice(-15)})');await page.mouse.up();await clear();assert during['frames']>before['frames']+1,(before,during);assert during['camera']['eye']!=before['camera']['eye'];r['orbit']={'before':before,'during':during,'after':await page.evaluate('wholeBuilding.lastStats')};await page.screenshot(path=str(out/'orbited-live.png'))
   old=await page.evaluate('wholeBuilding.getCamera()');await page.mouse.wheel(0,420);await page.wait_for_timeout(250);await clear();new=await page.evaluate('wholeBuilding.getCamera()');assert old['eye']!=new['eye'];r['wheel']={'before':old,'after':new}
   old=new;await page.keyboard.down('Shift');await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+60,y-35,steps=6);await page.mouse.up();await page.keyboard.up('Shift');await page.wait_for_timeout(500);await clear();new=await page.evaluate('wholeBuilding.getCamera()');assert old['target']!=new['target'];r['pan']={'before':old,'after':new};await page.screenshot(path=str(out/'zoomed-panned.png'))
   # A new input cancels remaining clear tiles, rather than waiting all scene passes.
   count=await page.evaluate('wholeBuilding.cancellations.length');await page.evaluate('()=>{window.clearProbe=wholeBuilding.render(640)}');await page.wait_for_function('wholeBuilding.renderer.busy');await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+25,y+5);await page.wait_for_timeout(200);await page.mouse.up();await page.wait_for_function('(n)=>wholeBuilding.cancellations.length>n',arg=count,timeout=30000);await page.wait_for_timeout(500);await clear();cancel=await page.evaluate('wholeBuilding.cancellations.at(-1)');assert cancel['tilesCompleted']<cancel['tilesPlanned'];r['cancellation']=cancel
   print('AUTOMATIC LIFT PLAY',flush=True);await page.select_option('#floor','P02');await page.wait_for_timeout(500);await clear();startFrame=await page.evaluate('wholeBuilding.presentedFrames');await page.locator('#play').click();await page.wait_for_function('wholeBuilding.playing',timeout=10000);await page.wait_for_function("!wholeBuilding.playing && wholeBuilding.getLiftState().arrived && wholeBuilding.getLiftState().currentFloorId==='P02'",timeout=90000);await clear();history=await page.evaluate('n=>wholeBuilding.frames.filter(f=>f.intent&&f.liftState).slice(-(wholeBuilding.presentedFrames-n))',startFrame);assert any(f['liftState']['moving'] and not f['liftState']['doorOpen'] for f in history);assert history[-1]['liftState']['doorOpen'];r['playback']={'frames':history,'final':await page.evaluate('wholeBuilding.getLiftState()')};await page.screenshot(path=str(out/'automatic-lift-arrived.png'))
   # Clear same-camera field pixels must equal the frozen original material/geometry.
   await page.evaluate("wholeBuilding.setFloor('T03')");await page.evaluate("wholeBuilding.setView('circulation')")
   digest="async()=>{const b=wholeBuilding.renderer.readPixels();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('')}"
   newHash=await page.evaluate(digest);oldpage=await browser.new_page(viewport={'width':1120,'height':850},device_scale_factor=1);await oldpage.goto(a.base+'whole-building-r01.html');await oldpage.wait_for_function('wholeBuilding.ready||wholeBuilding.error',timeout=150000);assert not await oldpage.evaluate('wholeBuilding.error');await oldpage.evaluate("wholeBuilding.setView('circulation')");oldHash=await oldpage.evaluate(digest);r['frozenPixelParity']={'old':oldHash,'new':newHash,'equal':oldHash==newHash};assert oldHash==newHash,r['frozenPixelParity'];await oldpage.close();await page.screenshot(path=str(out/'clear-same-geometry.png'));r['glError']=await page.evaluate('wholeBuilding.renderer.gl.getError()');assert r['glError']==0;assert not r['errors'];r['passed']=True
  except Exception as e:
   r['failure']=str(e);print('FAIL',e,flush=True)
   try:await page.screenshot(path=str(out/'failure.png'),timeout=10000)
   except Exception as ex:r['captureFailure']=str(ex)
  finally:
   r['wallSeconds']=time.time()-start;(out/'results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));await browser.close()
 if not r['passed']:sys.exit(1)
asyncio.run(main())
