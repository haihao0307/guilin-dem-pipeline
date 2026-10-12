from playwright.sync_api import sync_playwright
from pathlib import Path
import time,json,hashlib,sys
R=Path(__file__).resolve().parents[1];url=sys.argv[1] if len(sys.argv)>1 else (R/'index.html').as_uri()
results={'build':'HK-BACKGROUND-SEA-R01B-20261012','candidateSha256':hashlib.sha256((R/'index.html').read_bytes()).hexdigest(),'backend':'Chromium ANGLE SwiftShader software renderer','physicalGpuVerified':False,'physicalPhoneVerified':False,'cases':[],'checks':{},'visualAcceptance':False,'productionReady':False}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for live in [True,False]:
  c=b.new_context(viewport={'width':960,'height':600},device_scale_factor=1);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url+('?liveWeather=1' if live else ''),wait_until='load');page.wait_for_function('OceanMother.qa.ready && OceanMother.qa.completedFrames>4',timeout=120000)
  page.locator('#togglePanel').click();page.wait_for_timeout(1500)
  start=page.evaluate('({frames:OceanMother.qa.completedFrames,atlas:OceanMother.qa.cloudAtlasFrames,time:OceanMother.qa.waveTime,weather:OceanWeather.snapshot().time,stamp:performance.now()})')
  page.wait_for_timeout(10000)
  end=page.evaluate('({frames:OceanMother.qa.completedFrames,atlas:OceanMother.qa.cloudAtlasFrames,time:OceanMother.qa.waveTime,weather:OceanWeather.snapshot().time,stamp:performance.now(),qa:OceanMother.qa})')
  assert end['time']>start['time'];assert not errors
  if not live:assert end['atlas']==start['atlas'] and end['weather']==start['weather']
  else:assert end['atlas']>start['atlas'] and end['weather']>start['weather']
  case={'mode':'live-weather' if live else 'background-snapshot','viewport':[960,600],'deviceScaleFactor':1,'quality':page.evaluate('OceanMother.getConfiguration().ocean.quality'),'completedFrameFps':(end['frames']-start['frames'])*1000/(end['stamp']-start['stamp']),'elapsedMs':end['stamp']-start['stamp'],'newAtlasFrames':end['atlas']-start['atlas'],'seaSecondsAdvanced':end['time']-start['time'],'weatherSecondsAdvanced':end['weather']-start['weather'],'inheritedPerf':end['qa']['performance'],'errors':errors}
  results['cases'].append(case)
  if not live:
   page.click('#pause');page.wait_for_timeout(300)
   page.screenshot(path=str(R/'qa/background-normal-perspective.png'))
   # Every sky-affecting numeric control explicitly invalidates/rebakes the inherited cache.
   for k,v in {'hour':17.4,'density':.7,'wind':5,'direction':235,'cloudSpeed':8,'exposure':1.1,'height':12}.items():
    n=page.evaluate('OceanMother.qa.cloudAtlasFrames');page.evaluate('([k,v])=>HKBackgroundSea.setConfig({[k]:v})',[k,v]);page.wait_for_function('(n)=>OceanMother.qa.cloudAtlasFrames>n&&!OceanMother.getReadiness().baking',arg=n,timeout=120000)
    if k=='hour':assert abs(page.evaluate('OceanMother.qa.atlasHour')-v)<1e-6
    results['checks'][k+'InvalidatesAtlas']=True
   page.click('#togglePanel')
   for control,value in [('weather','coast'),('kind','Cu')]:
    n=page.evaluate('OceanMother.qa.cloudAtlasFrames');page.locator('#'+control).select_option(value)
    page.wait_for_function('(n)=>OceanMother.qa.cloudAtlasFrames>n&&!HKBackgroundSea.getState().readiness.weatherWorkerBusy&&OceanMother.qa.atlasWeatherRevision===OceanMother.qa.weatherAppliedRevision',arg=n,timeout=120000)
    results['checks'][control+'WorkerRevisionAndAtlas']=True
   n=page.evaluate('OceanMother.qa.cloudAtlasFrames');page.click('#cloudSeed');page.wait_for_function('(n)=>OceanMother.qa.cloudAtlasFrames>n&&!HKBackgroundSea.getState().readiness.weatherWorkerBusy&&OceanMother.qa.atlasWeatherRevision===OceanMother.qa.weatherAppliedRevision',arg=n,timeout=120000);results['checks']['cloudSeedWorkerRevisionAndAtlas']=True
   page.locator('#togglePanel').click();page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(1000)
   assert page.evaluate('document.querySelector("canvas").width')>0
   results['checks']['resize']=True
   page.set_viewport_size({'width':960,'height':600});page.wait_for_timeout(500)
   with page.expect_download() as dl:
    page.locator('#togglePanel').click();page.locator('summary').filter(has_text='显示与校验').click();page.click('#save')
   download=dl.value;out=R/'qa/exported-scene.json';download.save_as(out);saved=json.loads(out.read_text());assert saved['format']=='ocean-mother-scene';results['checks']['configurationExport']=True
  print(json.dumps(case,ensure_ascii=False),flush=True)
  c.close()
 b.close()
results['speedup']=results['cases'][1]['completedFrameFps']/results['cases'][0]['completedFrameFps']
results['passed']=all(results['checks'].values()) and not any(c['errors'] for c in results['cases'])
(R/'qa/BACKGROUND_CACHE_QA.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':results['passed'],'speedup':results['speedup']},ensure_ascii=False))
assert results['passed']
