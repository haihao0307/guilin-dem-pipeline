import asyncio,json,time,pathlib,sys,hashlib
from playwright.async_api import async_playwright
OUT=pathlib.Path('/tmp/r08-evidence');OUT.mkdir(exist_ok=True)
CANDIDATE=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else None
URL='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/hong-kong-main-city-r08/'
async def main():
 result={'url':URL,'events':[],'responses':[],'failed':[]};start=time.monotonic()
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader'])
  page=await browser.new_page(viewport={'width':1280,'height':900})
  page.on('console',lambda m:result['events'].append({'at':time.monotonic()-start,'type':m.type,'text':m.text[:3000]}))
  page.on('pageerror',lambda e:result['events'].append({'at':time.monotonic()-start,'error':str(e)}))
  page.on('requestfailed',lambda r:result['failed'].append({'url':r.url,'failure':r.failure}))
  page.on('response',lambda r:result['responses'].append({'at':time.monotonic()-start,'status':r.status,'url':r.url}))
  if CANDIDATE:
   async def overlay(route):
    rel=route.request.url.split('?')[0].removeprefix(URL) or 'index.html'
    path=CANDIDATE/rel
    if path.is_file():
     mime={'.html':'text/html','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml'}[path.suffix]
     await route.fulfill(body=path.read_bytes(),content_type=mime)
    else:await route.continue_()
   await page.route(URL+'**',overlay)
   result['candidateFiles']={str(f.relative_to(CANDIDATE)):hashlib.sha256(f.read_bytes()).hexdigest()for f in CANDIDATE.rglob('*')if f.is_file()}
  await page.add_init_script('''window.__r08Long=[];new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__r08Long.push({start:e.startTime,duration:e.duration});if(e.duration>1000)console.log('R08_LONG',e.startTime,e.duration)}}).observe({type:'longtask',buffered:true});setInterval(()=>console.log('R08_HEARTBEAT',performance.now(),document.getElementById('loadingText')?.textContent||document.getElementById('load-status')?.textContent,window.OceanMother?.qa?.ready),5000);''')
  cdp=await page.context.new_cdp_session(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{'interval':5000});await cdp.send('Profiler.start')
  await page.goto(URL,wait_until='commit',timeout=30000)
  ready=False
  try:
   await page.wait_for_function("window.OceanMother?.qa?.ready && window.HKGameInterfaceR08 && getComputedStyle(document.getElementById('loading')).display==='none'",timeout=180000);ready=True
  except Exception as e:result['waitError']=str(e)
  result['ready']=ready;result['elapsed']=time.monotonic()-start
  try:
   profile=await asyncio.wait_for(cdp.send('Profiler.stop'),20);(OUT/'profile.json').write_text(json.dumps(profile));nodes=profile['profile']['nodes'];result['profileTop']=sorted([{'function':n['callFrame']['functionName'],'url':n['callFrame']['url'],'line':n['callFrame']['lineNumber'],'hits':n.get('hitCount',0)}for n in nodes],key=lambda x:x['hits'],reverse=True)[:35]
  except Exception as e:result['profileError']=str(e)
  try:
   result['state']=await asyncio.wait_for(page.evaluate('''()=>({qa:window.OceanMother?.qa,boot:window.HKBootR08,long:window.__r08Long,fatal:window.HKNextFatal,title:document.title,tunnel:window.HKLionRockTunnelScene?.stats(),terrain:window.HKKaopuTerrain?.stats()})'''),20)
   await page.screenshot(path=str(OUT/('candidate.png' if CANDIDATE else 'baseline.png')),timeout=20000)
  except Exception as e:result['stateError']=str(e)
  if CANDIDATE and ready:
   try:
    async def game_state():return await page.evaluate('''()=>({game:HKGameR08.state(),camera:HKTrainCamerasR08.stats(),consist:HKConsistR05.stats(),tunnel:HKLionRockTunnelScene.stats(),qa:{ready:OceanMother.qa.ready,frames:OceanMother.qa.frames,completedFrames:OceanMother.qa.completedFrames,errors:OceanMother.qa.errors,lastGLerror:OceanMother.qa.lastGLerror,initialSceneCompleted:OceanMother.qa.initialSceneCompleted,startupShaderPrewarm:OceanMother.qa.startupShaderPrewarm,loadingBakePasses:OceanMother.qa.loadingBakePasses}})''')
    result['initial']=await game_state();assert result['initial']['consist']['coachCount']==4;assert result['initial']['consist']['sourceGeometry']['mergedTriangles']==938396;assert result['initial']['qa']['initialSceneCompleted']
    await page.locator('#depart').click();await page.wait_for_function('HKGameR08.state().physicsTimeS>=11',timeout=150000);await page.locator('#drivePause').click();result['driving']=await game_state();assert result['driving']['game']['positionM']>result['initial']['game']['positionM'];assert result['driving']['game']['speedMps']>0
    before=result['driving']['game']['physicsTick'];await asyncio.sleep(1);assert (await game_state())['game']['physicsTick']==before
    result['tunnelReview']=await page.evaluate('''()=>{const span=HKLionRockTunnelScene.stats().portals.mainCoveredInterval,d=(span[0]+span[1])/2;HKTrain88.reviewChainage(d);HKGameInterfaceR08.select('front');return{d,span,method:'existing review positioning, then original actual drive'}}''')
    await page.wait_for_timeout(1000);t=await game_state();await page.locator('#depart').click();await page.wait_for_function('(start)=>HKGameR08.state().physicsTimeS>=start+10',arg=t['game']['physicsTimeS'],timeout=150000);await page.locator('#drivePause').click();result['tunnelDriving']=await game_state();assert result['tunnelDriving']['game']['positionM']>t['game']['positionM'];assert result['tunnelDriving']['camera']['mode']=='front';assert result['tunnelDriving']['tunnel']['portals']['resolved'];await page.screenshot(path=str(OUT/'tunnel-driving.png'),timeout=30000)
    result['interactionsPassed']=True
   except Exception as e:result['interactionError']=str(e)
  (OUT/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2)[:20000],flush=True)
  await browser.close()
  if CANDIDATE:assert result.get('interactionsPassed'),result.get('interactionError',result.get('waitError'))
asyncio.run(main())
