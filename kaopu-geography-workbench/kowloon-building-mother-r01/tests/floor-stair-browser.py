import asyncio,json,argparse,sys,hashlib,ast,statistics
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True);base='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/';report={'passed':False,'errors':[],'physicalPhoneTested':False};expected=next(ast.literal_eval(n.value)for n in ast.parse(Path(__file__).with_name('floor-study-browser.py').read_text()).body if isinstance(n,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='EXPECTED_RUNTIME'for t in n.targets))
 async with async_playwright()as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await browser.new_page(viewport={'width':800,'height':650});page.on('pageerror',lambda e:report['errors'].append(str(e)))
  def save():(out/'stairs.json').write_text(json.dumps(report,indent=2))
  async def capture(name,width=640,clip=False,shadow=True,diagnostic=0):
   v=await asyncio.wait_for(page.evaluate('(o)=>probe.draw(o)',{'width':width,'clip':clip,'shadow':shadow,'diagnostic':diagnostic}),90);report.setdefault('views',{})[name]=v;await page.locator('#view').screenshot(path=str(out/(name+'.png')));save();print('CAPTURED',name,v['stats']['wallMs'],'IDS',v['ids'],'UNRESOLVED',v['status'].get('3',0),flush=True);assert v['error']==0;return v
  try:
   report['runtimeHashes']={}
   for path,sha in expected.items():
    response=await page.request.get(base+path);assert response.status==200;actual=hashlib.sha256(await response.body()).hexdigest();assert actual==sha,path;report['runtimeHashes'][path]=actual
   controls=await(await page.request.get(base+'evidence/floor-stair-connection-r01/guards.json')).json();await page.goto(base+'tests/floor-stair-probe.html');await page.wait_for_function('typeof probe?.setup==="function"');report['setup']=await page.evaluate('probe.setup()');print('STAIR REAL COMPILE/LINK',flush=True);report['cold']=await asyncio.wait_for(page.evaluate('probe.draw({width:32})'),90);save();print('COLD',report['cold']['stats']['wallMs'],flush=True)
   await page.evaluate('Object.assign(probe.renderer.options,{cut:true,clipNormal:[0,0,-1],clipOffset:-2.85})');v=await capture('stairs-two-level-cutaway',clip=True);assert all(v['ids'].get(str(i),0)>15 for i in [2950,2951,2952,2900,30000]),'Both flights, landing, rail and upper plate must be visible'
   for witness in v['witnesses']:
    assert witness['hit']['objectId']==2900 and witness['hit']['normal']==[0,1,0],witness
   for name,mode,shadow in [('diagnostic-identity',1,False),('diagnostic-normal',2,False),('diagnostic-no-shadow',0,False)]:await capture(name,clip=True,diagnostic=mode,shadow=shadow)
   report['walk']={}
   for t,name in[(.30,'lower-first-flight'),(.54,'midlanding-turn'),(.94,'upper-receiver')]:
    report['walk'][str(t)]=await page.evaluate('(t)=>probe.walk(t)',t);await capture(name)
   report['rays']=await asyncio.wait_for(page.evaluate('(c)=>probe.fixtures(c)',controls['controls']),120);save();print('RAY PARITY',len(report['rays']['points']),flush=True)
   report['equivalence']={}
   for t in [0,.5,1]:
    await page.evaluate('(t)=>probe.scene({windowOpenT:t,doorOpenT:t})',t);await page.evaluate('probe.walk(.54)');a=await page.evaluate('probe.draw({width:160,indexed:true})');b=await page.evaluate('probe.draw({width:160,indexed:false})');assert a['hitSha256']==b['hitSha256']and a['rgbaSha256']==b['rgbaSha256'];report['equivalence'][str(t)]={'indexed':a,'fullScan':b};save()
   # Matched room camera: isolate added connection cost without pretending output is identical.
   report['cost']={'before':[],'connected':[]};camera={'eye':[-14.8,1.6,-2.65],'target':[-11.863706542414217,1,-.41303863936532004],'fov':60*3.141592653589793/180,'cut':False,'sliceY':None}
   for order in [['before','connected'],['connected','before']]:
    for name in order:
     await page.evaluate('(c)=>probe.scene({connected:c})',name=='connected');await page.evaluate('(c)=>Object.assign(probe.renderer.options,c)',camera);report['cost'][name].append(await page.evaluate('probe.draw({width:640})'));save()
   report['cost']['medianMs']={k:statistics.median(x['stats']['wallMs']for x in report['cost'][k])for k in ['before','connected']}
   # Real UI's route changes camera, preserves identity/geometry and excludes the unregistered official shell.
   await page.goto(base+'whole-building-floor-study-r01.html');await page.wait_for_function('wholeBuilding?.ready||wholeBuilding?.error',timeout=180000);assert not await page.evaluate('wholeBuilding.error');await page.evaluate('wholeBuilding.pause()');await page.locator('#stairView').click();await page.wait_for_function("wholeBuilding.view==='study-stairs'&&!wholeBuilding.renderer.busy",timeout=90000);await page.locator('#view').screenshot(path=str(out/'app-stair-core.png'));nodes=await page.evaluate('wholeBuilding.getFloorStudy().graph.nodes.map(n=>n.id)');report['appWalk']=[]
   for t in [0,.54,1]:
    pose=await page.evaluate('(t)=>wholeBuilding.setStairProgress(t)',t);state=await page.evaluate('({view:wholeBuilding.view,stats:wholeBuilding.lastStats,nodes:wholeBuilding.getFloorStudy().graph.nodes.map(n=>n.id),camera:wholeBuilding.getCamera()})');assert state['nodes']==nodes;assert len(state['stats']['visibleFloorIds'])==2;report['appWalk'].append({'pose':pose,'state':state})
   assert report['appWalk'][0]['pose']['foot'][1]==0 and report['appWalk'][-1]['pose']['foot'][1]==3;await page.locator('#view').screenshot(path=str(out/'app-upper-arrival.png'));save()
   await page.close();context=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True);page=await context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)));await page.goto(base+'whole-building-floor-study-r01.html');await page.wait_for_function('wholeBuilding?.ready||wholeBuilding?.error',timeout=180000);assert not await page.evaluate('wholeBuilding.error');await page.evaluate("wholeBuilding.setView('study-stairs')");await page.locator('#view').scroll_into_view_if_needed();before=await page.evaluate('({camera:wholeBuilding.getCamera(),stats:wholeBuilding.lastStats})');box=await page.locator('#view').bounding_box();cdp=await context.new_cdp_session(page);x=box['x']+box['width']*.5;y=box['y']+box['height']*.5;await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
   for i in range(1,4):await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+i*5,'y':y+i*2,'id':1}]});await asyncio.sleep(.05)
   await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_function('wholeBuilding.frames.at(-1)?.intent===wholeBuilding.latestIntent.number&&!wholeBuilding.renderer.busy',timeout=120000);report['mobile']=await page.evaluate('({camera:wholeBuilding.getCamera(),stats:wholeBuilding.lastStats,cssWidth:document.getElementById("view").getBoundingClientRect().width,dpr:devicePixelRatio})');assert report['mobile']['camera']!=before['camera']and report['mobile']['stats']['width']==before['stats']['width']and report['mobile']['stats']['width']>=report['mobile']['cssWidth'];await page.locator('#view').screenshot(path=str(out/'mobile-stair-touch.png'));await page.evaluate('wholeBuilding.setStairProgress(.54)');await page.locator('#view').screenshot(path=str(out/'mobile-midlanding.png'));assert not report['errors'];assert not any(v['status'].get('3',0) for v in report['views'].values()),'Unresolved rail rays remain; coverage completed but overall gate FAILED';report['passed']=True;print('STAIR CONNECTION ACTUAL QA PASSED',flush=True)
  except Exception as e:
   report['failure']=repr(e);print('FAIL',repr(e),flush=True)
   try:await page.screenshot(path=str(out/'failure.png'),timeout=10000)
   except Exception:pass
  finally:save();await browser.close();sys.exit(0 if report['passed']else 1)
asyncio.run(main())
