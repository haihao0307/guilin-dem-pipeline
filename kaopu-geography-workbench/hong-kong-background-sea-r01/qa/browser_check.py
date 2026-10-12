from playwright.sync_api import sync_playwright
from pathlib import Path
import json,time,hashlib,sys
ROOT=Path(__file__).resolve().parents[1]
base=sys.argv[1] if len(sys.argv)>1 else (ROOT/'index.html').as_uri()
report={'url':base,'candidateSha256':hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest(),'cases':[],'physicalPhoneTested':False,'visualAcceptance':False,'productionReady':False}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for name,size in [('desktop',{'width':1280,'height':800}),('mobile',{'width':390,'height':844})]:
  context=browser.new_context(viewport=size,device_scale_factor=1)
  page=context.new_page();errs=[];console=[];failed=[];requests=[]
  page.on('pageerror',lambda e:errs.append(str(e)))
  page.on('console',lambda m:console.append(m.text) if m.type=='error' else None)
  page.on('requestfailed',lambda r:failed.append({'url':r.url,'failure':r.failure}))
  page.on('request',lambda r:requests.append(r.url))
  t=time.time();page.goto(base,wait_until='load',timeout=30000)
  page.wait_for_function('window.OceanMother?.qa.ready && window.OceanMother?.qa.completedFrames>2',timeout=120000)
  ready=time.time()-t
  page.wait_for_timeout(1800)
  before=page.evaluate('HKBackgroundSea.getState()')
  assert before['mapAssembled'] is False
  cfg=before['configuration']['ocean'];weather=before['configuration']['weather']
  for k,v in {'swell':.3,'period':8.8,'chop':.4,'rough':.18,'foam':.04,'tint':.45,'seaSpeed':1}.items():assert abs(cfg[k]-v)<1e-6,(k,cfg[k])
  assert weather['wind']==4
  renderer=page.evaluate('''()=>{const g=document.querySelector('canvas').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return{renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),vendor:e?g.getParameter(e.UNMASKED_VENDOR_WEBGL):g.getParameter(g.VENDOR),version:g.getParameter(g.VERSION),depthBits:g.getParameter(g.DEPTH_BITS)};}''')
  page.evaluate('HKBackgroundSea.pause()');page.wait_for_timeout(900)
  t1=page.evaluate('OceanMother.qa.waveTime');page.wait_for_timeout(600);t2=page.evaluate('OceanMother.qa.waveTime');assert t1==t2
  # Normal perspective, sea-level camera. No orthographic scale tricks.
  page.evaluate("document.getElementById('panel').classList.add('closed')")
  page.screenshot(path=str(ROOT/'qa'/f'{name}-overview.png'))
  old=page.evaluate('HKBackgroundSea.getState().configuration.ocean.yaw')
  page.mouse.move(90,260);page.mouse.down();page.mouse.move(150,278,steps=3);page.mouse.up()
  changed=page.evaluate('HKBackgroundSea.getState().configuration.ocean.yaw');assert changed!=old
  page.click('#reset');page.wait_for_timeout(250)
  page.click('#togglePanel');assert page.locator('#panel').is_visible()
  page.click('#togglePanel');assert not page.locator('#panel').is_visible()
  page.evaluate('HKBackgroundSea.setConfig({rough:.21,tint:.40})')
  assert page.evaluate('HKBackgroundSea.getState().configuration.ocean.rough')==.21
  rejected=page.evaluate("()=>{try{HKBackgroundSea.setConfig({tint:.1,seaLevel:2});return false}catch(e){return HKBackgroundSea.getState().configuration.ocean.tint===.40}}")
  assert rejected
  page.evaluate('HKBackgroundSea.setConfig({rough:.18,tint:.45})')
  page.evaluate('HKBackgroundSea.setConfig({wind:6})');page.wait_for_timeout(300)
  assert page.evaluate('HKBackgroundSea.getState().configuration.weather.wind')==6
  seedBefore=page.evaluate('HKBackgroundSea.getState().configuration.ocean.seed')
  page.click('#togglePanel');page.click('#newSeed');page.click('#togglePanel')
  assert page.evaluate('HKBackgroundSea.getState().configuration.ocean.seed')==seedBefore+7919
  page.evaluate('HKBackgroundSea.setConfig({wind:4})');page.wait_for_timeout(300)
  heights=page.evaluate('Array.from({length:30},(_,i)=>HKBackgroundSea.sampleHeight(i*7,i*3,12.5))')
  assert all(isinstance(x,(int,float)) for x in heights)
  page.evaluate('HKBackgroundSea.play()');page.wait_for_timeout(2200)
  assert page.evaluate('OceanMother.qa.waveTime')>t2
  page.evaluate('HKBackgroundSea.pause()');page.wait_for_timeout(300)
  after=page.evaluate('HKBackgroundSea.getState()')
  screenshot=ROOT/'qa'/f'{name}-after-interaction.png';page.screenshot(path=str(screenshot))
  assert after['qa']['lastGLerror']==0
  assert after['qa']['spectralComponents']==24
  result={'name':name,'viewport':size,'readySeconds':ready,'renderer':renderer,'initialConfig':cfg,'weatherWind':weather['wind'],'pauseStable':t1==t2,'cameraDragPassed':old!=changed,'parameterEditPassed':True,'windAndSeedPassed':True,'invalidPatchAtomicRejectionPassed':rejected,'resumePassed':True,'finiteHeightSamples':len(heights),'qa':after['qa'],'pageErrors':errs,'consoleErrors':console,'failedRequests':failed,'externalHttpRequests':[u for u in requests if u.startswith('http')],'screenshots':[f'{name}-overview.png',f'{name}-after-interaction.png']}
  result['passed']=not errs and not console and not failed and after['qa']['lastGLerror']==0
  report['cases'].append(result);print(name,json.dumps({'readySeconds':ready,'renderer':renderer,'errors':errs,'console':console,'qaPerf':after['qa'].get('performance')},ensure_ascii=False),flush=True)
  (ROOT/'qa/BROWSER_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  context.close()
 browser.close()
report['passed']=all(c['passed'] for c in report['cases'])
(ROOT/'qa/BROWSER_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
assert report['passed'], report
