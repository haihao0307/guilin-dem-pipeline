import asyncio,json,time,pathlib
from playwright.async_api import async_playwright
OUT=pathlib.Path('/tmp/r08-evidence');OUT.mkdir(exist_ok=True)
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
  await page.add_init_script('''window.__r08Long=[];new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__r08Long.push({start:e.startTime,duration:e.duration});if(e.duration>1000)console.log('R08_LONG',e.startTime,e.duration)}}).observe({type:'longtask',buffered:true});setInterval(()=>console.log('R08_HEARTBEAT',performance.now(),document.getElementById('loadingText')?.textContent||document.getElementById('load-status')?.textContent,window.OceanMother?.qa?.ready),5000);''')
  cdp=await page.context.new_cdp_session(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{'interval':5000});await cdp.send('Profiler.start')
  await page.goto(URL,wait_until='commit',timeout=30000)
  ready=False
  try:
   await page.wait_for_function('window.OceanMother?.qa?.ready && window.HKGameInterfaceR08',timeout=180000);ready=True
  except Exception as e:result['waitError']=str(e)
  result['ready']=ready;result['elapsed']=time.monotonic()-start
  try:
   profile=await asyncio.wait_for(cdp.send('Profiler.stop'),20);(OUT/'profile.json').write_text(json.dumps(profile));nodes=profile['profile']['nodes'];result['profileTop']=sorted([{'function':n['callFrame']['functionName'],'url':n['callFrame']['url'],'line':n['callFrame']['lineNumber'],'hits':n.get('hitCount',0)}for n in nodes],key=lambda x:x['hits'],reverse=True)[:35]
  except Exception as e:result['profileError']=str(e)
  try:
   result['state']=await asyncio.wait_for(page.evaluate('''()=>({qa:window.OceanMother?.qa,boot:window.HKBootR08,long:window.__r08Long,fatal:window.HKNextFatal,title:document.title,tunnel:window.HKLionRockTunnelScene?.stats(),terrain:window.HKKaopuTerrain?.stats()})'''),20)
   await page.screenshot(path=str(OUT/'baseline.png'),timeout=15000)
  except Exception as e:result['stateError']=str(e)
  (OUT/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2)[:20000],flush=True)
  await browser.close()
asyncio.run(main())
