import asyncio,json,argparse,hashlib,sys,statistics
from pathlib import Path
from playwright.async_api import async_playwright

EXPECTED_RUNTIME={'whole-building-floor-study-r01.html': '0293d10ab9ce219aee902ec08396abd035177d8a953d94d1eb6d9109375c1113', 'whole-building-floor-study-r01/app.mjs': 'c03b00a6035ac1528abf2409ddcecec7ebe2f40e88c4e15c9c8a0608fae2a42e', 'whole-building-floor-study-r01/renderer.mjs': '2c980fb6e4e202e963b5419406f82b5709b58871c5a91f3343d9c52e598d1d9e', 'whole-building-floor-study-r01/floor-layout.mjs': '75b520f282ab418c5aee3bc8fc8bebe6f5bd0d4c276d5432a35dac37c28bfc55', 'whole-building-floor-study-r01/style.css': '775819cbfe6bf871cb9d1d7914a5710b6b6a3d8558827c9f3e924ac3bf2adee3', 'whole-building-floor-study-r01/sources/plan-registration.json': 'f84457e63cefe8fb781ce83830b404ab2951ec8f8a80b62d509308a54a913ad8', 'floor-materials-r01/material-adapter.mjs': '3dd9a6f45c89cd1ca882927d1cb361de21bb43e24b807001710ba0430b441d11', 'floor-materials-r01/sources/field-sources.mjs': '5dbede5b3a34d2ac81fcc562eaa68cafe4a8d06ed2df77090b1a75f52932be68', 'floor-materials-r01/periodic-coverage.mjs': '87c67410fcf3a6f61e6cc280d1f772834119af6ac3f0f5d530f9b6ed4a8df841', 'whole-building-floor-study-r01/finish-dispatch.mjs': '61f368897e5032e9d771bda0143b3be68c62ab50f06351876e412a5898bb143e', 'whole-building-floor-study-r01/bounded-hit-query.mjs': 'db7451ffc16f43e92ca6ee35f209991635d644a32cb33f2362b825c2796c01a6', 'whole-building-floor-study-r01/primary-tile-index.mjs': '36bd84f83b2d929883de2f9af67fd8763cc1e76db67f7b1d5de161775243e5d1'}

async def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 result={'passed':False,'errors':[],'baselineCommit':'3d251360bb1c7ffe4ed1da055c093a83599b1ca1','baselineRendererSha256':'685af8964d783eb019aaa527f67308d6014f9855f3081d344c85dcd0f9eb6984','resolutionPolicy':'Identical geometry, materials, cameras and fixed sampling; not physical iPhone performance.'}
 base='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/'
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);pages={}
  try:
   checker=await browser.new_page();result['runtimeHashes']={}
   for path,expected in EXPECTED_RUNTIME.items():
    response=await checker.request.get(base+path);assert response.status==200;actual=hashlib.sha256(await response.body()).hexdigest();assert actual==expected,path;result['runtimeHashes'][path]=actual
   await checker.close()
   for name in ['frozen','candidate']:
    page=await browser.new_page(viewport={'width':800,'height':650});pages[name]=page;page.on('pageerror',lambda e:result['errors'].append(str(e)))
    await page.goto(base+'tests/floor-spatial-probe.html?variant='+name);await page.wait_for_function('window.probe?.ready');result[name+'Setup']=await page.evaluate('probe.setup()');print('COMPILED',name,json.dumps(result[name+'Setup']['compile']),flush=True)
    if name=='frozen':
     response=await page.request.get(base+'whole-building-floor-study-r01/renderer.baseline-3d251360.mjs');assert hashlib.sha256(await response.body()).hexdigest()==result['baselineRendererSha256']
    result[name+'Warmup']=await asyncio.wait_for(page.evaluate('probe.measure({width:32,indexed:false})'),90);assert result[name+'Warmup']['error']==0;print('WARMUP',name,result[name+'Warmup']['stats']['wallMs'],flush=True)
   async def draw(name,which='candidate',width=640,indexed=True,profile=False,screenshot=False,corrupt=None):
    r=await asyncio.wait_for(pages[which].evaluate('(p)=>probe.measure(p)',{'width':width,'indexed':indexed,'profile':profile,'corrupt':corrupt}),90);assert r['error']==0
    result[name]=r
    if screenshot:await pages[which].locator('#view').screenshot(path=str(out/(name+'.png')))
    (out/'spatial.json').write_text(json.dumps(result,indent=2));print('FRAME',name,json.dumps(r),flush=True);return r
   def equal(a,b):
    assert result[a]['hitSha256']==result[b]['hitSha256'],a+' / '+b+' raw hit/normal/ID/role/local mismatch'
    assert result[a]['rgbaSha256']==result[b]['rgbaSha256'],a+' / '+b+' final RGBA mismatch'
   await draw('frozen-overview','frozen',screenshot=True)
   await draw('new-fullscan-overview',indexed=False)
   await draw('indexed-overview',screenshot=True)
   equal('frozen-overview','new-fullscan-overview');equal('frozen-overview','indexed-overview')
   assert result['frozen-overview']['rgbaSha256']=='e396d59d0438108a10a193cdb431a4765cf3ef264264cf018c85e11752ebd5f1','frozen baseline drift'
   cases=[('room',{'camera':'room'}),('tilted',{'camera':'tilted'}),('inside',{'camera':'inside'}),('window-closed',{'camera':'window','windowOpenT':0}),('window-open',{'camera':'window','windowOpenT':.65}),('doors-closed',{'camera':'room','doorOpenT':0}),('doors-half',{'camera':'room','doorOpenT':.5})]
   for name,scene in cases:
    for page in pages.values():await page.evaluate('(scene)=>probe.scene(scene)',scene)
    await draw('frozen-'+name,'frozen',width=320)
    await draw('indexed-'+name,width=320,screenshot=name in ['window-open','doors-closed'])
    equal('frozen-'+name,'indexed-'+name)
   for page in pages.values():await page.evaluate('probe.scene({})')
   await draw('corruption-baseline','frozen',width=160)
   for kind in ['magic','token','range','index','order']:
    name='fallback-'+kind;await draw(name,width=160,corrupt=kind);assert result[name]['corruptUploads']==1;equal('corruption-baseline',name)
   result['timingPairs']=[]
   for i in range(3):
    # Alternating order reduces systematic warm-up/thermal ordering bias.
    for indexed in ([False,True] if i%2==0 else [True,False]):await draw(('indexed' if indexed else 'fullscan')+'-steady-'+str(i),indexed=indexed)
    a='fullscan-steady-'+str(i);b='indexed-steady-'+str(i);equal(a,b);equal('frozen-overview',b);result['timingPairs'].append({'baselineWallMs':result[a]['stats']['wallMs'],'indexedWallMs':result[b]['stats']['wallMs']})
   med_base=statistics.median(p['baselineWallMs'] for p in result['timingPairs']);med_index=statistics.median(p['indexedWallMs'] for p in result['timingPairs']);result['measuredFrameResult']={'baselineMedianWallMs':med_base,'indexedMedianWallMs':med_index,'ratioBaselineToIndexed':med_base/med_index,'reductionFraction':1-med_index/med_base,'notGPUTime':True,'notInteractionAcceptance':True,'decisionThreshold':'>=20% median whole-frame reduction, exact hits/pixels; experiment result, not product acceptance','significantWholeFrameReduction':med_index<=med_base*.8}
   for indexed in [False,True]:
    name=('indexed' if indexed else 'fullscan')+'-stage-profile';await draw(name,indexed=indexed,profile=True);equal('frozen-overview',name)
   assert not result['errors'];result['passed']=True
  except Exception as e:result['failure']=repr(e);print('FAIL',repr(e),flush=True)
  finally:(out/'spatial.json').write_text(json.dumps(result,indent=2));await browser.close();sys.exit(0 if result['passed'] else 1)
asyncio.run(main())
