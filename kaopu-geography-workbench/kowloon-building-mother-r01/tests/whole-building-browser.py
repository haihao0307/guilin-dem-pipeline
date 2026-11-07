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
   await page.evaluate("wholeBuilding.setView('circulation')")
   await page.locator('#stairs').click();assert '楼梯' in await page.locator('#route').inner_text()
   await page.evaluate("wholeBuilding.advance(1,'T03')");moving=await page.evaluate('wholeBuilding.getLiftState()');assert moving['moving'] and not moving['doorOpen'];await page.screenshot(path=str(out/'lift-moving-locked.png'));report['screens'].append('lift-moving-locked.png')
   doorRay=await page.evaluate("(()=>{const m=wholeBuilding.model,s=m.interfaces.lifts[0].stops.find(s=>s.floorId==='T03'),z=[Math.sin(.375),0,Math.cos(.375)];return {origin:s.center.map((x,i)=>x-z[i]*2+(i===1?1:0)),direction:z};})()")
   locked=await page.evaluate("r=>wholeBuilding.probeRay(r.origin,r.direction,['T03'])",doorRay)
   await page.evaluate("wholeBuilding.advance(100)");arrived=await page.evaluate('wholeBuilding.getLiftState()');assert arrived['arrived'] and arrived['doorOpen'] and arrived['currentFloorId']=='T03';await page.screenshot(path=str(out/'lift-arrived-open.png'));report['screens'].append('lift-arrived-open.png')
   opened=await page.evaluate("r=>wholeBuilding.probeRay(r.origin,r.direction,['T03'])",doorRay);assert opened['gpu']['t']>locked['gpu']['t']+1
   report['liftMotion']={'moving':moving,'arrived':arrived,'lockedDoorRay':locked,'openedDoorRay':opened}
   rays=await page.evaluate("(()=>{const m=wholeBuilding.model,l=m.levels.find(l=>l.id==='T03'),r=m.sourceBinding.towerFootprint;return [0,3,10].map(i=>{const p=r.slice(i,i+3).reduce((s,p)=>[s[0]+p[0]/3,s[1]+p[1]/3],[0,0]);return {origin:[p[0],l.localY+.8,p[1]],direction:[0,-1,0]};});})()")
   report['cpuGpuRays']=[locked,opened]
   for ray in rays:report['cpuGpuRays'].append(await page.evaluate("r=>wholeBuilding.probeRay(r.origin,r.direction,['T03'])",ray))
   for pair in report['cpuGpuRays']:
    assert pair['cpu']['hit'] and pair['gpu']['status']==1,pair
    assert abs(pair['cpu']['t']-pair['gpu']['t'])<.0002,pair
    assert pair['cpu']['objectId']==pair['gpu']['objectId'],pair
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
