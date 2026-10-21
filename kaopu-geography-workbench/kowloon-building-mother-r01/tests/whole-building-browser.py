import asyncio,json,sys,time,argparse,hashlib
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);report={'passed':False,'screens':[],'measurements':[],'errors':[]};start=time.time()
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await browser.new_page(viewport={'width':1120,'height':850},device_scale_factor=1)
  page.on('console',lambda msg:print('BROWSER',msg.type,msg.text,flush=True));page.on('pageerror',lambda e:report['errors'].append(str(e)))
  try:
   print('Opening whole-building field',flush=True);await page.goto(a.url,wait_until='networkidle');await page.wait_for_function('window.wholeBuilding?.ready || window.wholeBuilding?.error',timeout=150000);error=await page.evaluate('window.wholeBuilding.error');assert not error,error
   print('FIRST WHOLE FRAME',time.time()-start,flush=True);await page.screenshot(path=str(out/'whole-building.png'));report['screens'].append('whole-building.png');report['measurements'].append(await page.evaluate('window.wholeBuilding.lastStats'));(out/'first-ready').write_text('ready');(out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
   for name,view in [('connected-levels','levels'),('stairs-lift-core','circulation'),('preserved-source','source')]:
    print('Rendering',name,flush=True);await page.evaluate('(v)=>window.wholeBuilding.setView(v)',view);await page.screenshot(path=str(out/(name+'.png')));report['screens'].append(name+'.png');report['measurements'].append(await page.evaluate('window.wholeBuilding.lastStats'))
   graph=await page.evaluate('({summary:wholeBuilding.model.summary,fit:wholeBuilding.model.fitReport,counts:wholeBuilding.model.counts,source:wholeBuilding.sourceHash,compile:wholeBuilding.renderer.compileStats})');report['model']=graph;assert graph['summary']['floorCount']==28;assert graph['summary']['stairConnectorCount']==27;assert graph['counts']['modelTriangles']==0
   await page.evaluate("window.wholeBuilding.setView('levels')");before=await page.evaluate('wholeBuilding.getModel().levels.map(l=>[l.id,l.elevation])');await page.evaluate('wholeBuilding.rebuild({towerFloorCount:20,podiumFloorCount:4,towerFloorHeight:3.1})');after=await page.evaluate('wholeBuilding.getModel().levels.map(l=>[l.id,l.elevation])');assert len(after)==24 and before!=after;await page.screenshot(path=str(out/'parameter-propagation.png'));report['screens'].append('parameter-propagation.png');report['parameterChange']={'before':before,'after':after}
   report['route']=await page.evaluate('wholeBuilding.route("stairs")');report['glError']=await page.evaluate('wholeBuilding.renderer.gl.getError()');assert report['glError']==0;assert not report['errors'];report['passed']=True
  except Exception as e:
   report['failure']=str(e);print('FAIL',e,flush=True)
   try:await page.screenshot(path=str(out/'failure.png'),timeout=10000)
   except Exception as ex:report['captureFailure']=str(ex)
  finally:
   report['wallSeconds']=time.time()-start;(out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));(out/'done').write_text('passed'if report['passed'] else 'failed');await browser.close()
 if not report['passed']:sys.exit(1)
asyncio.run(main())
