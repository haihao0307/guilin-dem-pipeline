import asyncio,json,hashlib,argparse,sys,time
from pathlib import Path
from playwright.async_api import async_playwright
ROOT='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/kowloon-building-mother-r01/inspection-ed015e34/'
async def visible_layout(page):
 result=await page.evaluate("""()=>{const c=document.getElementById('view'),v=document.getElementById('viewport'),a=document.querySelector('aside'),m=document.querySelector('main'),r=c.getBoundingClientRect();return {grid:getComputedStyle(m).display,rect:r.toJSON(),window:[innerWidth,innerHeight],scrollY,visibleFraction:Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0))*Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0))/(r.width*r.height),articleBeforeAside:document.querySelector('article').getBoundingClientRect().top<a.getBoundingClientRect().top,asideScroll:getComputedStyle(a).overflowY,overlayHidden:document.getElementById('renderStatus').hidden};}""")
 assert result['grid']=='grid' and result['scrollY']==0,result
 assert result['rect']['width']>=300 and result['visibleFraction']>.98,result
 assert result['overlayHidden'],result
 if result['window'][0]<800:assert result['articleBeforeAside'],result
 else:assert result['asideScroll']=='auto',result
 return result
async def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--manifest',required=True);a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);r={'passed':False,'productionCommit':'e31011edbb3e64dbbbbc0787b002275c218af239','runtime':'ed015e34af0e967c3535f01b062da2de7c5bd6f2','url':ROOT,'errors':[],'physicalPhoneTested':False};save=lambda:(out/'public-inspection.json').write_text(json.dumps(r,indent=2))
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await browser.new_page(viewport={'width':1280,'height':900});page.on('pageerror',lambda e:r['errors'].append(str(e)))
  try:
   r['publicHashes']={};r['cssResponses']=[]
   page.on('response',lambda x:r['cssResponses'].append({'url':x.url,'status':x.status}) if x.url.split('?')[0].endswith('.css') else None)
   expected=next(x['sha256'] for x in json.loads(Path(a.manifest).read_text()) if x['path']=='kowloon-building-mother-r01/index.html')
   for attempt in range(41):
    check=await page.request.get(ROOT+'kowloon-building-mother-r01/index.html?layout-check=e31011e')
    if check.status==200 and hashlib.sha256(await check.body()).hexdigest()==expected:break
    if attempt==40:raise RuntimeError('Public layout correction not deployed after bounded 10 minute wait')
    print('WAITING FOR EXACT PUBLIC LAYOUT',attempt,flush=True);await asyncio.sleep(15)

   for item in json.loads(Path(a.manifest).read_text()):
    x=await page.request.get(ROOT+item['path']+('?v=ed015-layout-20261022' if item['path'].endswith('.css') else ''));assert x.status==200,item['path'];data=await x.body();h=hashlib.sha256(data).hexdigest()
    assert h==item['sha256'],item['path']
    r['publicHashes'][item['path']]={'sha256':h,'bytes':len(data),'status':x.status}
   print('PUBLIC HASHES',len(r['publicHashes']),flush=True);save()
   await page.goto(ROOT);await page.wait_for_url('**/kowloon-building-mother-r01/index.html');await page.wait_for_function('window.wholeBuilding?.ready||window.wholeBuilding?.error',timeout=180000);assert not await page.evaluate('wholeBuilding.error');assert '当前未完成检查版' in await page.title();r['desktopDefaultLayout']=await visible_layout(page);assert len(r['cssResponses'])==4 and all(x['status']==200 for x in r['cssResponses']),r['cssResponses'];r['loaded']=await page.evaluate('({stats:wholeBuilding.lastStats,hash:wholeBuilding.sourceHash})');assert not r['loaded']['stats'].get('staticPrimaryCache');await page.screenshot(path=str(out/'public-current-floor.png'));print('APP FIRST FRAME VISIBLE WITH FOUR CSS RESPONSES',flush=True)
   r['views']={}
   for view in ['whole','source','ground','study']:
    await page.locator('[data-view='+view+']' if view!='study' else '#studyView').click();await page.wait_for_function('!wholeBuilding.renderer.busy&&wholeBuilding.frames.at(-1)?.intent===wholeBuilding.latestIntent.number',timeout=120000);await page.evaluate('scrollTo(0,0)');await visible_layout(page);r['views'][view]=await page.evaluate('({view:wholeBuilding.view,stats:wholeBuilding.lastStats,sourceHash:wholeBuilding.sourceHash})');assert r['views'][view]['view']==view;assert r['views'][view]['sourceHash']==r['loaded']['hash'];await page.screenshot(path=str(out/('public-view-'+view+'.png')))
   print('WHOLE AND PLAN VIEWS PASS',flush=True)
   await page.locator('#stairView').click();await page.wait_for_function('!wholeBuilding.renderer.busy&&wholeBuilding.frames.at(-1)?.intent===wholeBuilding.latestIntent.number',timeout=120000);await page.screenshot(path=str(out/'public-solid-stair.png'))
   await page.evaluate('wholeBuilding.enableStudyLift()');r['closed']=await page.evaluate('wholeBuilding.getBoundLift()');await page.evaluate("wholeBuilding.boundCommand({kind:'hall',floor:'evidence-plan',direction:1},{seconds:2})");await page.evaluate('wholeBuilding.enterBound()');await page.screenshot(path=str(out/'public-board-lower.png'));print('BOARDED',flush=True)
   r['moving']=await page.evaluate("wholeBuilding.boundCommand({kind:'car',floor:'evidence-upper-reference'},{seconds:6})");assert r['moving']['state']['motion'];r['openDenied']=await page.evaluate("wholeBuilding.boundCommand({kind:'door',value:'open'})");assert not r['openDenied']['accepted'];save()
   r['playback']=await asyncio.wait_for(page.evaluate('async()=>{const n=wholeBuilding.frames.length;await wholeBuilding.playBound();return wholeBuilding.frames.slice(n).map(f=>({state:f.boundLift,wallMs:f.wallMs,width:f.width,height:f.height}));}'),180);assert len(r['playback'])>=3;assert any(x['state']['motion'] for x in r['playback']);r['arrived']=await page.evaluate('wholeBuilding.getBoundLift()');assert r['arrived']['current']=='evidence-upper-reference' and r['arrived']['carDoor']==1;await page.evaluate('wholeBuilding.exitBound()');await page.screenshot(path=str(out/'public-exit-upper.png'));await page.evaluate('wholeBuilding.returnBound(.5)');await page.screenshot(path=str(out/'public-return-stair.png'));await page.evaluate('wholeBuilding.returnBound(1)');r['loop']=await page.evaluate('({passenger:wholeBuilding.studyPassenger,foot:wholeBuilding.stairPose.foot,sourceHash:wholeBuilding.sourceHash,stats:wholeBuilding.lastStats})');assert r['loop']['passenger']=='lower' and abs(r['loop']['foot'][1])<1e-8;assert r['loop']['sourceHash']==r['loaded']['hash'];print('PUBLIC LOOP PASS',flush=True);save()
   for id in ['lowrise','warehouse']:
    await page.evaluate('id=>wholeBuilding.chooseCase(id)',id);assert await page.evaluate('wholeBuilding.caseId')==id
   await page.close();context=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True);page=await context.new_page();page.on('pageerror',lambda e:r['errors'].append(str(e)));await page.goto(ROOT);await page.wait_for_url('**/kowloon-building-mother-r01/index.html');await page.wait_for_function('window.wholeBuilding?.ready||window.wholeBuilding?.error',timeout=180000);assert not await page.evaluate('wholeBuilding.error');r['mobileDefaultLayout']=await visible_layout(page);await page.screenshot(path=str(out/'public-mobile-default.png'));print('MOBILE DEFAULT FRAME VISIBLE',flush=True);await page.locator('#boundLiftEnable').tap();await page.wait_for_function('wholeBuilding.studyLiftEnabled&&!wholeBuilding.renderer.busy&&wholeBuilding.frames.at(-1)?.intent===wholeBuilding.latestIntent.number',timeout=120000);await page.locator('#boundLiftLower').tap();await page.wait_for_function('wholeBuilding.getBoundLift()?.carDoor===1&&!wholeBuilding.renderer.busy',timeout=120000);await page.locator('#boundLiftEnter').tap();await page.wait_for_function('wholeBuilding.studyPassenger==="car"&&!wholeBuilding.renderer.busy',timeout=120000);await page.locator('#view').scroll_into_view_if_needed();r['mobile']=await page.evaluate('({stats:wholeBuilding.lastStats,sampling:wholeBuilding.sampling,passenger:wholeBuilding.studyPassenger})');assert r['mobile']['stats']['dynamicLiftFields']==40 and r['mobile']['stats']['width']>=390;await page.screenshot(path=str(out/'public-mobile-car.png'));assert not r['errors'];r['viewportFixPassed']=True
   # Failure visibility is tested by an explicit synthetic status, not claimed to be a real GPU fault.
   await page.evaluate("()=>{document.getElementById('status').textContent='QA synthetic failure visibility';document.getElementById('status').className='error';}");await page.wait_for_function("!document.getElementById('renderStatus').hidden&&document.getElementById('renderStatus').textContent.includes('QA synthetic failure')");await page.locator('#viewport').scroll_into_view_if_needed();await page.screenshot(path=str(out/'public-synthetic-error-visible.png'));r['syntheticErrorVisible']=True;r['passed']=True;print('PUBLIC MOBILE PASS',flush=True)
  except Exception as e:r['failure']=str(e);print('FAIL',repr(e),flush=True)
  finally:save();await browser.close();sys.exit(0 if r['passed'] else 1)
asyncio.run(main())
