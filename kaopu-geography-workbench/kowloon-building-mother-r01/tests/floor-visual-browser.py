import asyncio,json,argparse,hashlib,sys,statistics
from pathlib import Path
from playwright.async_api import async_playwright
EXPECTED_RUNTIME={'whole-building-floor-study-r01.html': '0293d10ab9ce219aee902ec08396abd035177d8a953d94d1eb6d9109375c1113', 'whole-building-floor-study-r01/app.mjs': 'c03b00a6035ac1528abf2409ddcecec7ebe2f40e88c4e15c9c8a0608fae2a42e', 'whole-building-floor-study-r01/renderer.mjs': '131c87d88485bd2bf27589879eece16b43bdc7ba07adc3143dc615ab67e7b003', 'whole-building-floor-study-r01/floor-layout.mjs': '75b520f282ab418c5aee3bc8fc8bebe6f5bd0d4c276d5432a35dac37c28bfc55', 'whole-building-floor-study-r01/style.css': '775819cbfe6bf871cb9d1d7914a5710b6b6a3d8558827c9f3e924ac3bf2adee3', 'whole-building-floor-study-r01/sources/plan-registration.json': 'f84457e63cefe8fb781ce83830b404ab2951ec8f8a80b62d509308a54a913ad8', 'floor-materials-r01/material-adapter.mjs': '3dd9a6f45c89cd1ca882927d1cb361de21bb43e24b807001710ba0430b441d11', 'floor-materials-r01/sources/field-sources.mjs': '5dbede5b3a34d2ac81fcc562eaa68cafe4a8d06ed2df77090b1a75f52932be68', 'floor-materials-r01/periodic-coverage.mjs': '87c67410fcf3a6f61e6cc280d1f772834119af6ac3f0f5d530f9b6ed4a8df841', 'whole-building-floor-study-r01/finish-dispatch.mjs': '61f368897e5032e9d771bda0143b3be68c62ab50f06351876e412a5898bb143e', 'whole-building-floor-study-r01/bounded-hit-query.mjs': 'db7451ffc16f43e92ca6ee35f209991635d644a32cb33f2362b825c2796c01a6', 'whole-building-floor-study-r01/primary-tile-index.mjs': '36bd84f83b2d929883de2f9af67fd8763cc1e76db67f7b1d5de161775243e5d1', 'whole-building-floor-study-r01/primary-aperture-index.mjs': 'f1b4fbf9db0c8c300be2996da97185a81e59bd60638f57ab2b997accf9351983', 'whole-building-floor-study-r01/bounded-structural-shadow.mjs': '39ac781813fcceb0fa673633fdeda608644de7df52a32796267b1fe1f1b9cfa5'}
async def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);r={'passed':False,'errors':[],'baselineCommit':'9251f51351c68ab40655790402986a771d64bb89','scope':'Unit A finite-distance structural shadow, 25 existing wall fields; 1.6–2m smooth fade; not sunlight/full-scene visibility. Same geometry, camera, recipe, light and pixel resolution. Interior finishes are design, not reconstructed measurements.'}
 base='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/'
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await browser.new_page(viewport={'width':800,'height':650});page.on('pageerror',lambda e:r['errors'].append(str(e)))
  try:
   r['runtimeHashes']={}
   for path,expected in EXPECTED_RUNTIME.items():
    response=await page.request.get(base+path);assert response.status==200;actual=hashlib.sha256(await response.body()).hexdigest();assert actual==expected,path;r['runtimeHashes'][path]=actual
   await page.goto(base+'tests/floor-visual-probe.html');await page.wait_for_function('window.probe?.ready');r['setup']=await page.evaluate('probe.setup()');print('COMPILED',json.dumps(r['setup']['compile']),flush=True);r['gpu']=await page.evaluate('probe.renderer.gpu');r['probe']=await page.evaluate('probe.shadowProbe()');assert r['probe']['error']==0
   r['warmup']=await asyncio.wait_for(page.evaluate('probe.visual({width:32,shadow:true})'),90);assert r['warmup']['error']==0;print('WARMUP',r['warmup']['stats']['wallMs'],flush=True)
   async def draw(name,params,screenshot=True):
    v=await asyncio.wait_for(page.evaluate('(p)=>probe.visual(p)',params),90);assert v['error']==0;r[name]=v
    if screenshot:await page.locator('#view').screenshot(path=str(out/(name+'.png')))
    (out/'visual-control.json').write_text(json.dumps(r,indent=2));print('FRAME',name,json.dumps(v),flush=True);return v
   def equal_hit(a,b):assert r[a]['hitSha256']==r[b]['hitSha256'],a+' / '+b+' geometry changed'
   await draw('overview-original',{'coat':False,'shadow':False})
   assert r['overview-original']['rgbaSha256']=='e396d59d0438108a10a193cdb431a4765cf3ef264264cf018c85e11752ebd5f1','frozen9251 output changed with both visual controls off'
   await draw('overview-coat',{'coat':True,'shadow':False})
   await draw('overview-shadow',{'coat':False,'shadow':True})
   await draw('overview-combined',{'coat':True,'shadow':True});r['mainShadowPassReadback']=await page.evaluate('probe.shadowReadback()')
   await draw('overview-raw-linear-albedo',{'raw':True,'shadow':False})
   for key in ['overview-coat','overview-shadow','overview-combined','overview-raw-linear-albedo']:equal_hit('overview-original',key)
   assert r['overview-original']['rgbaSha256']!=r['overview-shadow']['rgbaSha256'],'No visible shadow consumption'
   for camera in ['room','inside','window']:
    await page.evaluate('(camera)=>probe.scene({camera})',camera)
    await draw(camera+'-original',{'coat':False,'shadow':False})
    await draw(camera+'-combined',{'coat':True,'shadow':True});equal_hit(camera+'-original',camera+'-combined')
   for opened in [0,.5,1]:
    await page.evaluate('(t)=>probe.scene({camera:"room",doorOpenT:t,windowOpenT:t})',opened)
    await draw('state-'+str(opened)+'-off',{'width':320,'coat':False,'shadow':False},False)
    await draw('state-'+str(opened)+'-on',{'width':320,'coat':True,'shadow':True},False);equal_hit('state-'+str(opened)+'-off','state-'+str(opened)+'-on')
   await page.evaluate('probe.scene({camera:"room"})');r['timingPairs']=[]
   for i in range(3):
    for shadow in ([False,True] if i%2==0 else [True,False]):await draw(('on' if shadow else 'off')+'-timing-'+str(i),{'coat':True,'shadow':shadow},False)
    r['timingPairs'].append({'off':r['off-timing-'+str(i)]['stats']['wallMs'],'on':r['on-timing-'+str(i)]['stats']['wallMs']})
   off=statistics.median(p['off'] for p in r['timingPairs']);on=statistics.median(p['on'] for p in r['timingPairs']);r['timingSummary']={'unshadowedMedianWallMs':off,'shadowedMedianWallMs':on,'additionalWallMs':on-off,'ratio':on/off,'notPhysicalPhone':True}
   await draw('room-shadow-stage-profile',{'coat':True,'shadow':True,'profile':True},False)
   assert not r['errors'];r['passed']=True
  except Exception as e:r['failure']=repr(e);print('FAIL',repr(e),flush=True)
  finally:
   (out/'visual-control.json').write_text(json.dumps(r,indent=2));await browser.close();sys.exit(0 if r['passed'] else 1)
asyncio.run(main())
