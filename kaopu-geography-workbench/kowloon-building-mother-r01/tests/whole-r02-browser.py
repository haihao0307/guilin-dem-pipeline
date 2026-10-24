import asyncio,json,time,argparse,sys,hashlib
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/');p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);report={'passed':False,'cases':{}};started=time.time()
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  for case in ['kcc','lowrise','warehouse']:
   r={'passed':False,'errors':[]};report['cases'][case]=r;page=await browser.new_page(viewport={'width':1120,'height':850},device_scale_factor=1);page.on('pageerror',lambda e,rr=r:rr['errors'].append(str(e)));page.on('console',lambda m:print('BROWSER',m.type,m.text,flush=True))
   try:
    await page.goto(a.base+'whole-building-r02.html');await page.wait_for_function('wholeBuilding.ready||wholeBuilding.error',timeout=120000);assert not await page.evaluate('wholeBuilding.error');await page.evaluate('wholeBuilding.pause()')
    if case!='kcc':
     locked=await page.evaluate("id=>{window.switchProbe=wholeBuilding.chooseCase(id,{preview:true});return [...document.querySelectorAll('aside button,aside input,aside select')].every(e=>e.disabled)}",case);assert locked;r['caseSwitchControlsLocked']=True;await page.evaluate('window.switchProbe');await page.evaluate('wholeBuilding.pause()')
    assert await page.evaluate('wholeBuilding.caseId')==case
    print('CASE',case,'WHOLE',flush=True);await page.evaluate('wholeBuilding.render(640)');r['whole']=await page.evaluate('wholeBuilding.lastStats');await page.screenshot(path=str(out/(case+'-whole.png')))
    r['model']=await page.evaluate('()=>{const s=wholeBuilding.getModel();return {caseId:s.caseId,levels:s.levels.map(f=>({id:f.id,y:f.localY})),stairs:s.interfaces.stairs.length,lifts:s.interfaces.lifts.length,source:wholeBuilding.sourceHash,counts:s.counts,summary:s.summary,fit:s.fitReport}}')
    if case=='lowrise':assert len(r['model']['levels'])==2 and r['model']['lifts']==0;assert await page.locator('#play').is_disabled()
    elif case=='warehouse':assert len(r['model']['levels'])==14 and r['model']['stairs']==15 and r['model']['lifts']==1;assert r['model']['summary']['officialTotalStoreysVerified']==False;await page.locator('#loading').click();assert await page.evaluate('wholeBuilding.lastLoadingRoute.pedestrianRouteSeparate')
    else:assert len(r['model']['levels'])==28 and r['model']['lifts']==3
    top=r['model']['levels'][-1]['id'];await page.evaluate("id=>document.getElementById('floor').value=id",top);route=await page.evaluate('wholeBuilding.route()');r['route']=route;assert len([s for s in route['segments'] if s['kind']=='stairs'])==r['model']['stairs']
    target={'kcc':'T03','lowrise':'L01','warehouse':'P02'}[case];await page.evaluate("id=>document.getElementById('floor').value=id",target);print('CASE',case,'CORE',flush=True);await page.evaluate("wholeBuilding.setView('circulation')");r['core']=await page.evaluate('wholeBuilding.lastStats');await page.screenshot(path=str(out/(case+'-core.png')))
    # Same mother controls alter actual rendered pixels, not just camera state.
    async def pixels():return await page.evaluate("async()=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',wholeBuilding.renderer.readPixels()))].map(x=>x.toString(16).padStart(2,'0')).join('')")
    before=await pixels();box=await page.locator('#view').bounding_box();await page.mouse.move(box['x']+320,box['y']+270);await page.mouse.down();await page.mouse.move(box['x']+355,box['y']+275,steps=4);await page.mouse.up();await page.wait_for_timeout(600);await page.wait_for_function('wholeBuilding.lastStats.width===640&&!wholeBuilding.renderer.busy',timeout=120000);after=await pixels();assert before!=after;r['dragPixelsChanged']=True
    if case=='lowrise':
     print('CASE lowrise HEIGHT CHAIN',flush=True);await page.evaluate('wholeBuilding.rebuild({floorHeight:3.5,stairWidth:1.2,stairTreadDepth:.32})');s=await page.evaluate('()=>{const m=wholeBuilding.getModel();return {height:m.levels[1].elevation-m.levels[0].elevation,stair:m.interfaces.stairs[0].rise,rail:m.rails.templates[0].dimensions.treadDepth}}');assert abs(s['height']-3.5)<1e-8 and abs(s['stair']-3.5)<1e-8 and abs(s['rail']-.32)<1e-8;r['heightChain']=s;await page.screenshot(path=str(out/'lowrise-height-changed.png'))
    if case=='warehouse':
     print('CASE warehouse FREIGHT PLAY',flush=True);await page.evaluate("wholeBuilding.setView('lift')");await page.screenshot(path=str(out/'warehouse-freight-locked.png'));await page.select_option('#floor','P02');await page.wait_for_timeout(600);await page.wait_for_function('wholeBuilding.lastStats.width===640&&!wholeBuilding.renderer.busy',timeout=120000);lockedPixels=await pixels();await page.locator('#play').click();await page.wait_for_function('wholeBuilding.playing',timeout=10000);await page.wait_for_function("!wholeBuilding.playing&&wholeBuilding.getLiftState().currentFloorId==='P02'",timeout=120000);await page.wait_for_function('wholeBuilding.lastStats.width===640&&!wholeBuilding.renderer.busy',timeout=120000);r['freight']=await page.evaluate('({state:wholeBuilding.getLiftState(),history:wholeBuilding.frames.filter(x=>x.liftState?.moving).map(x=>({phase:x.liftState.phase,door:x.liftState.doorOpen}))})');assert r['freight']['state']['doorOpen'];assert lockedPixels!=await pixels(),'Freight arrival must change visible door pixels';assert r['freight']['history'] and all(not s['door'] for s in r['freight']['history']);await page.screenshot(path=str(out/'warehouse-freight-arrived.png'))
    r['glError']=await page.evaluate('wholeBuilding.renderer.gl.getError()');assert r['glError']==0 and not r['errors'];r['passed']=True
   except Exception as e:
    r['failure']=str(e);print('FAIL',case,e,flush=True)
    try:await page.screenshot(path=str(out/(case+'-failure.png')),timeout=10000)
    except Exception as e2:r['captureFailure']=str(e2)
   finally:await page.close();(out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  await browser.close()
 report['passed']=all(c['passed'] for c in report['cases'].values());report['wallSeconds']=time.time()-started;(out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));sys.exit(0 if report['passed'] else 1)
asyncio.run(main())
