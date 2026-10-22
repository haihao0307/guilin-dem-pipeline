import asyncio,json,argparse,hashlib,ast
from pathlib import Path
from playwright.async_api import async_playwright
EXPECTED=next(ast.literal_eval(n.value) for n in ast.parse(Path(__file__).with_name('floor-study-browser.py').read_text()).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='EXPECTED_RUNTIME' for t in n.targets))
async def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);base='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/';r={'passed':False,'errors':[],'pairs':{},'invalidations':{},'physicalPhoneTested':False};save=lambda:(out/'static-cache.json').write_text(json.dumps(r,indent=2))
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await browser.new_page(viewport={'width':1000,'height':850});page.on('pageerror',lambda e:r['errors'].append(str(e)))
  async def draw(cache,width=640,profile=False,**options):
   await page.evaluate('v=>probe.renderer.options.staticHitCache=v',cache)
   if profile:await page.evaluate("profiler.begin('gpu-query')")
   value=await page.evaluate('o=>probe.draw(o)',{'width':width,**options})
   if profile:value['profile']=await page.evaluate('profiler.end()')
   assert value['error']==0;return value
  def equal(a,b,label):
   for key in ['hitSha256','rgbaSha256']:assert a[key]==b[key],label+' '+key
  async def pair(name,width=640,clip=True,expect_reuse=None):
   s=r['pairs'][name]={};s['A1']=await draw(False,width,True,clip=clip);s['buildOrReuse']=await draw(True,width,False,clip=clip)
   if expect_reuse is not None:assert s['buildOrReuse']['stats']['staticPrimaryCache']['reused']==expect_reuse,name
   s['B1']=await draw(True,width,True,clip=clip);s['B2']=await draw(True,width,False,clip=clip);s['A2']=await draw(False,width,False,clip=clip)
   for k in ['buildOrReuse','B1','B2','A2']:equal(s['A1'],s[k],name+' '+k)
   assert s['B1']['stats']['staticPrimaryCache']['reused'];assert not s['B1']['profile']['disjoint'];assert not s['A1']['profile']['disjoint'];save();print('PAIR',name,{k:round(v['stats']['wallMs'],2)for k,v in s.items()},flush=True);await page.locator('#view').screenshot(path=str(out/(name+'.png')))
  try:
   r['runtimeHashes']={}
   for path,h in EXPECTED.items():
    q=await page.request.get(base+path);assert q.status==200;actual=hashlib.sha256(await q.body()).hexdigest();assert actual==h,path;r['runtimeHashes'][path]=actual
   await page.goto(base+'tests/floor-lift-probe.html');await page.wait_for_function('probe?.ready');r['setup']=await page.evaluate('probe.setup()');r['gpuTimer']=await page.evaluate("async()=>{const m=await import('./floor-pass-profiler.mjs');window.profiler=m.attachPassProfiler(probe.renderer);return profiler.supportedGpuTimer}");assert r['gpuTimer'],'No GPU timer for attribution';await page.evaluate("probe.camera('shaft')")
   r['cold32']=await draw(False,32,True,clip=True);r['warm32']=await draw(False,32,True,clip=True);equal(r['cold32'],r['warm32'],'cold/warm');save();print('COLD GPU',json.dumps(r['cold32']['profile']['groups']),flush=True)
   await pair('fixed-closed',expect_reuse=False)
   r['open']=await page.evaluate("probe.act({action:{kind:'hall',floor:probe.binding.floors[0].id,direction:1},seconds:2})");assert r['open']['state']['carDoor']==1;await pair('fixed-open',expect_reuse=True)
   r['moving']=await page.evaluate("(()=>{probe.act({action:{kind:'car',floor:probe.binding.floors[1].id}});for(let i=0;i<1200;i++){const a=probe.act({seconds:.02});if(a.state.motion&&a.state.y>1.4)return a;}throw Error('No motion');})()");await pair('fixed-moving',expect_reuse=True)
   assert r['pairs']['fixed-moving']['B1']['hitSha256']!=r['pairs']['fixed-closed']['B1']['hitSha256']
   r['arrived']=await page.evaluate("(()=>{for(let i=0;i<1200;i++){const a=probe.act({seconds:.02});if(a.state.current===probe.binding.floors[1].id&&a.state.carDoor===1)return a;}throw Error('No arrival');})()");await pair('fixed-upper-open',expect_reuse=True)
   # Exact views/key invalidations, smaller image only for combinatorial diagnostics.
   edits=[('camera-follow',"probe.camera('inside')",{}),('rotate',"probe.renderer.options.eye[0]+=.4",{}),('resize','',{'width':192}),('clip',"probe.renderer.options.clipOffset+=.07",{}),('slice',"probe.renderer.options.sliceY=[.01,5.5]",{}),('floor',"probe.visible=['evidence-plan']",{}),('open-window',"probe.scene({windowOpenT:.81});probe.camera('shaft')",{}),('sampling-index',"probe.renderer.options.primitiveTileIndex=false",{}),('aperture-index',"probe.renderer.options.apertureTileIndex=false",{}),('tile-cull','',{'cullTiles':False})]
   for name,js,opts in edits:
    if js:await page.evaluate(js)
    options={'width':160,'clip':True,**opts};s=r['invalidations'][name]={};s['build']=await draw(True,**options);assert not s['build']['stats']['staticPrimaryCache']['reused'],name+' invalidation';s['reuse']=await draw(True,**options);s['original']=await draw(False,**options);equal(s['original'],s['build'],name);equal(s['original'],s['reuse'],name);assert s['reuse']['stats']['staticPrimaryCache']['reused'];save();print('INVALIDATION',name,flush=True)
   # Glass secondary rays stay live and full-scene, never use primary cached hits.
   await page.evaluate("probe.scene();Object.assign(probe.renderer.options,{eye:[-18,22,18],target:[-5,0,0],fov:55*Math.PI/180,cut:false,sliceY:null,primitiveTileIndex:true,apertureTileIndex:true})")
   await pair('glass-secondary',width=640,clip=False,expect_reuse=False);assert r['pairs']['glass-secondary']['B1']['stats']['opticalTiles']>0;assert r['pairs']['glass-secondary']['B1']['profile']['groups']['assembly:secondary']['draws']>0
   # Cancellation after one complete tile cannot publish partially built cache.
   r['cancel']=await page.evaluate("async()=>{const r=probe.renderer;const original=r.complete.bind(r);r.staticPrimaryCache.invalidate();r.options.staticHitCache=true;let n=0;r.complete=async(...a)=>{await original(...a);if(++n===1)r.requestRevision++;};try{return await r.render({width:160,height:136,presentWidth:160,presentHeight:136,tileSize:96,source:false,design:true,dynamicFields:probe.fields});}finally{r.complete=original;}}")
   assert r['cancel']['cancelled'];assert not await page.evaluate('probe.renderer.staticPrimaryCache.snapshot().valid');await pair('after-cancel',width=160,clip=False,expect_reuse=False)
   # Forced cache-only allocation refusal falls back to original renderer path.
   r['fallback']=await page.evaluate("async()=>{const c=probe.renderer.staticPrimaryCache,f=c.ensure.bind(c);c.release();c.ensure=()=>{c.failure='injected cache allocation unavailable';return false;};probe.renderer.options.staticHitCache=true;try{return await probe.draw({width:160});}finally{c.ensure=f;}}")
   assert r['fallback']['stats']['staticPrimaryCache']['fallback'];v=await draw(False,160);equal(r['fallback'],v,'allocation fallback')
   r['memory']=await page.evaluate('probe.renderer.staticPrimaryCache.snapshot()');assert r['memory']['bytes']==0
   await draw(True,160)
   r['contextLoss']=await page.evaluate("async()=>{const r=probe.renderer,e=r.gl.getExtension('WEBGL_lose_context');if(!e)throw Error('No loss test extension');e.loseContext();await new Promise(resolve=>setTimeout(resolve,50));let failure=null;try{await probe.draw({width:160});}catch(x){failure=x.message;}return{failure,cache:r.staticPrimaryCache.snapshot(),lifecycle:r.lifecycle.snapshot()};}")
   assert r['contextLoss']['failure'];assert not r['contextLoss']['cache']['valid'];save()
   # Recreate the app, then switch the actual three-case interface with the lift cache used.
   await page.goto(base+'whole-building-floor-study-r01.html');await page.wait_for_function('wholeBuilding?.ready||wholeBuilding?.error',timeout=180000);assert not await page.evaluate('wholeBuilding.error');await page.evaluate('wholeBuilding.enableStudyLift()');r['caseSwitch']={}
   for case in ['lowrise','warehouse','kcc']:
    await page.evaluate('id=>wholeBuilding.chooseCase(id)',case)
    v=await page.evaluate('({caseId:wholeBuilding.caseId,cache:wholeBuilding.renderer.staticPrimaryCache.snapshot(),sourceHash:wholeBuilding.sourceHash,stats:wholeBuilding.lastStats})');assert v['caseId']==case;assert not v['cache']['valid'];assert v['sourceHash'];r['caseSwitch'][case]=v;save()
   assert not r['errors'];r['passed']=True;save()
  except Exception as e:r['failure']=str(e);save();raise
  finally:await browser.close()
asyncio.run(main())
