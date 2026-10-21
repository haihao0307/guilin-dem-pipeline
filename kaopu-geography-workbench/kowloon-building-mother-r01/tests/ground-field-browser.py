import asyncio,json,argparse,time,sys
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/');p.add_argument('--output',required=True);p.add_argument('--compile-only',action='store_true');a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);r={'passed':False,'errors':[],'cases':{}}
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  try:
   for id in ['kcc','lowrise','warehouse']:
    page=await browser.new_page(viewport={'width':1100,'height':850});page.on('pageerror',lambda e:r['errors'].append(str(e)));await page.goto(a.base+'tests/ground-renderer-probe.html');await page.wait_for_function('window.probe?.ready');c=await page.evaluate('id=>probe.setup(id)',id);r['cases'][id]={'compile':c};print('COMPILE',id,json.dumps(c),flush=True)
    if not a.compile_only:
     v=await page.evaluate('probe.sourceParity()');assert v['old']['sha']==v['ground']['sha'];assert v['old']['error']==v['ground']['error']==0;r['cases'][id]['sourceParity']=v;print('SOURCE UNCHANGED',id,flush=True)
     rays=await page.evaluate('probe.basementRayParity()');r['cases'][id]['rayParity']=rays
     for ray in rays:assert ray['cpu']['hit'] and ray['gpu']['status']==1 and abs(ray['cpu']['t']-ray['gpu']['t'])<.0005 and ray['error']==0 and ray['kept']['status']==1 and abs(ray['gpu']['t']-ray['kept']['t'])<.0005 and ray['clipped']['status']==0,ray
     print('BASEMENT CPU GPU RAYS',id,len(rays),flush=True)
    await page.close()
   if not a.compile_only:
    page=await browser.new_page(viewport={'width':1100,'height':850});page.on('pageerror',lambda e:r['errors'].append(str(e)));await page.goto(a.base+'whole-building-ground-r01.html');await page.wait_for_function('window.wholeBuilding?.ready||window.wholeBuilding?.error',timeout=120000);assert not await page.evaluate('wholeBuilding.error')
    for id,count in [('kcc',1),('lowrise',0),('warehouse',2)]:
     if id!='kcc':await page.evaluate('id=>wholeBuilding.chooseCase(id)',id)
     await page.evaluate('wholeBuilding.pause()');s=await page.evaluate('({metadata:wholeBuilding.groundMetadata,levels:wholeBuilding.model.levels,stats:wholeBuilding.lastStats,system:wholeBuilding.getGroundSystem().additions,error:wholeBuilding.error,glError:wholeBuilding.renderer.gl.getError()})');assert s['glError']==0 and not s['error'];assert len([l for l in s['levels'] if l['id'].startswith('B')])==count;await page.screenshot(path=str(out/(id+'-ground.png')));r['cases'][id]['ground']=s;print('GROUND FRAME',id,s['stats']['wallMs'],flush=True)
     if count:
      route=await page.evaluate("wholeBuilding.route('stairs')");r['cases'][id]['route']=route;assert route['segments'];before=await page.evaluate('wholeBuilding.model.graph.nodes.length');await page.evaluate('wholeBuilding.setBasementVisibility(false)');assert await page.evaluate('wholeBuilding.model.graph.nodes.length')==before;await page.evaluate('wholeBuilding.setBasementVisibility(true)');await page.evaluate("wholeBuilding.setView('circulation')");await page.screenshot(path=str(out/(id+'-basement-core.png')))
      if id=='warehouse':
       await page.evaluate('wholeBuilding.setBasementDepth(3.3)');r['cases'][id]['edited']=await page.evaluate('({metadata:wholeBuilding.groundMetadata,levels:wholeBuilding.model.levels,stats:wholeBuilding.lastStats})');await page.screenshot(path=str(out/'warehouse-depth-edit.png'))
    await page.close()
    mobile=await browser.new_page(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True);mobile.on('pageerror',lambda e:r['errors'].append(str(e)));await mobile.goto(a.base+'whole-building-ground-r01.html');await mobile.wait_for_function('window.wholeBuilding?.ready||window.wholeBuilding?.error',timeout=120000);assert not await mobile.evaluate('wholeBuilding.error');r['mobile']=await mobile.evaluate('({sampling:wholeBuilding.sampling,stats:wholeBuilding.lastStats,metadata:wholeBuilding.groundMetadata})');assert r['mobile']['sampling']['gestureWidth']==r['mobile']['sampling']['settledWidth'];await mobile.screenshot(path=str(out/'mobile-ground.png'));await mobile.close()
   assert not r['errors'];r['passed']=True
  except Exception as e:r['failure']=str(e);print('FAIL',repr(e),flush=True)
  finally:await browser.close();(out/('compile.json' if a.compile_only else 'results.json')).write_text(json.dumps(r,indent=2));sys.exit(0 if r['passed'] else 1)
asyncio.run(main())
