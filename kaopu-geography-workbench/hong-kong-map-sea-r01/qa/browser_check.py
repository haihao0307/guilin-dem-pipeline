from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time,sys,hashlib
R=Path(__file__).resolve().parents[1];url=sys.argv[1] if len(sys.argv)>1 else (R/'index.html').as_uri();report={'url':url,'htmlSha256':hashlib.sha256((R/'index.html').read_bytes()).hexdigest(),'cases':[],'physicalGpuTested':False,'visualAcceptance':False}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for name,size in [('desktop',{'width':1600,'height':1000}),('mobile',{'width':844,'height':390})]:
  page=b.new_page(viewport=size,device_scale_factor=1);errs=[];logs=[];page.on('pageerror',lambda e:errs.append(str(e)));page.on('console',lambda m:logs.append(m.text) if m.type=='error' else None)
  t=time.time();page.goto(url,wait_until='load',timeout=60000);page.wait_for_function('window.HKMap?.getState().ready && window.OceanMother?.qa.ready && OceanMother.qa.completedFrames>2',timeout=180000);ready=time.time()-t
  page.evaluate('HKBackgroundSea.pause()');page.wait_for_timeout(1000);state=page.evaluate('HKMap.getState()');assert state['heightExaggeration']==1;assert state['resolutionM']==30;assert state['qa']['lastGLerror']==0
  for view in ['overview','harbour','harboursea','lion','shatin']:
   page.click('[data-map-view='+view+']');page.wait_for_timeout(900);page.screenshot(path=str(R/'qa'/f'{name}-{view}.png'))
  page.click('[data-map-view=overview]');page.wait_for_timeout(500)
  yaw=page.evaluate('HKMap.getState().mapState.yaw');page.mouse.move(400,200);page.mouse.down();page.mouse.move(470,230,steps=3);page.mouse.up();page.wait_for_timeout(400);assert page.evaluate('HKMap.getState().mapState.yaw')!=yaw
  page.click('#showStory');assert page.evaluate('HKMap.getState().mapState.story') is False;page.click('#showStory')
  page.click('#showRail');assert page.evaluate('HKMap.getState().mapState.rail') is False;page.click('#showRail')
  page.click('#showLabels');assert page.evaluate('HKMap.getState().mapState.labels') is False;page.click('#showLabels')
  page.click('#togglePanel');assert page.locator('#panel').is_visible();page.click('#togglePanel');assert not page.locator('#panel').is_visible()
  page.click('#reset');page.wait_for_timeout(500);assert page.evaluate('HKMap.getState().mapState.yaw')==state['mapState']['yaw']
  page.evaluate('HKBackgroundSea.play()');page.wait_for_timeout(1000);assert page.evaluate('OceanMother.qa.waveTime')>state['qa']['waveTime'];page.evaluate('HKBackgroundSea.pause()');page.wait_for_timeout(400)
  last=page.evaluate('HKMap.getState()');assert last['qa']['lastGLerror']==0
  report['cases'].append({'name':name,'viewport':size,'readySeconds':ready,'errors':errs,'consoleErrors':logs,'state':last,'passed':not errs and not logs});(R/'qa/BROWSER_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(name,ready,errs,logs,flush=True);page.close()
 b.close()
report['passed']=all(c['passed'] for c in report['cases']);(R/'qa/BROWSER_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));assert report['passed']
