"""QA-only repair of six vacuous all-miss invalidation witnesses; frozen ff263 runtime."""
import asyncio,json,argparse,hashlib,ast
from pathlib import Path
from playwright.async_api import async_playwright
EXPECTED=next(ast.literal_eval(n.value) for n in ast.parse(Path(__file__).with_name('floor-study-browser.py').read_text()).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='EXPECTED_RUNTIME' for t in n.targets))
EXPECTED['whole-building-floor-study-r01/static-primary-hit-cache.mjs']='3926083b68353195111f1aae92ed00118ec3b6d906ca8e5191a6b9c52d3b2215'
AERIAL="Object.assign(probe.renderer.options,{eye:[-18,22,18],target:[-5,0,0],fov:55*Math.PI/180,cut:false,sliceY:null})"
CASES=[
 ('camera-follow',"probe.camera('inside')",False,160,"(()=>{probe.act({action:{kind:'car',floor:probe.binding.floors[1].id}});for(let i=0;i<1500;i++){const a=probe.act({seconds:.02});if(a.state.current===probe.binding.floors[1].id&&a.state.carDoor===1){probe.camera('inside');return;}}throw Error('No upper arrival');})()",False,160),
 ('rotate',AERIAL,False,160,"probe.renderer.options.eye[2]-=3",False,160),
 ('resize',AERIAL,False,160,"void 0",False,192),
 ('clip',"probe.camera('shaft')",True,160,"probe.renderer.options.clipOffset=1.55",True,160),
 ('slice',AERIAL,False,160,"probe.renderer.options.sliceY=[-.4,2.79]",False,160),
 ('floor',AERIAL,False,160,"probe.visible=['evidence-plan']",False,160),
]
async def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 base='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/'
 r={'passed':False,'runtimeCommit':'ff263a929197a64e82ce84482dbc2c3965b88350','parentQA':'567707cbc593fa8cf6a9061dac9f554d9e03083d','purpose':'replace six all-miss witnesses, not rerun full regression or change runtime','physicalPhoneTested':False,'errors':[],'cases':{}}
 def save():(out/'visible-invalidations.json').write_text(json.dumps(r,indent=2))
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await browser.new_page(viewport={'width':1000,'height':850});page.on('pageerror',lambda e:r['errors'].append(str(e)))
  async def draw(cache,width,clip):
   await page.evaluate('v=>probe.renderer.options.staticHitCache=v',cache)
   v=await page.evaluate('o=>probe.draw(o)',{'width':width,'clip':clip})
   assert v['error']==0,'WebGL error';assert not v['unresolved'],'Unresolved rays'
   assert v['status'].get('1',0)>=128,'No meaningful geometry: '+json.dumps(v['status'])
   return v
  def equal(a,b):
   assert a['hitSha256']==b['hitSha256'],'raw hit differs';assert a['rgbaSha256']==b['rgbaSha256'],'RGBA differs'
  try:
   r['runtimeHashes']={}
   for rel,sha in EXPECTED.items():
    res=await page.request.get(base+rel);assert res.status==200;actual=hashlib.sha256(await res.body()).hexdigest();assert actual==sha,rel;r['runtimeHashes'][rel]=actual
   await page.goto(base+'tests/floor-lift-probe.html');await page.wait_for_function('probe?.ready');r['setup']=await page.evaluate('probe.setup()')
   await page.evaluate("probe.camera('shaft')");r['initialWarmup']=await draw(False,32,True);save()
   for name,setup,clip0,w0,change,clip1,w1 in CASES:
    q=r['cases'][name]={'beforeSetup':setup,'change':change,'clipBefore':clip0,'clipAfter':clip1}
    await page.evaluate('probe.scene()');await page.evaluate(setup)
    q['before']=await draw(True,w0,clip0);assert not q['before']['stats']['staticPrimaryCache']['reused'];await page.locator('#view').screenshot(path=str(out/(name+'-before.png')))
    await page.evaluate(change)
    q['build']=await draw(True,w1,clip1);assert not q['build']['stats']['staticPrimaryCache']['reused'],'Did not invalidate '+name
    q['reuse']=await draw(True,w1,clip1);assert q['reuse']['stats']['staticPrimaryCache']['reused'],'Did not reuse '+name
    q['original']=await draw(False,w1,clip1);equal(q['build'],q['reuse']);equal(q['build'],q['original'])
    assert q['before']['hitSha256']!=q['build']['hitSha256'],'Change had no raw-hit effect '+name
    assert q['before']['rgbaSha256']!=q['build']['rgbaSha256'],'Change had no visible effect '+name
    assert q['build']['stats']['width']==w1 and q['build']['stats']['height']==int(w1*.85)
    assert q['build']['stats']['staticPrimaryCache']['bytes']==w1*int(w1*.85)*48
    q['meaningfulNonEmpty']=True;q['exactAfterChange']=True;q['changeVisible']=True
    await page.locator('#view').screenshot(path=str(out/(name+'-after.png')));save();print('VISIBLE INVALIDATION',name,q['before']['status'],q['build']['status'],flush=True)
   assert not r['errors'];r['passed']=True;save()
  except Exception as e:r['failure']=str(e);save();raise
  finally:await browser.close()
asyncio.run(main())
