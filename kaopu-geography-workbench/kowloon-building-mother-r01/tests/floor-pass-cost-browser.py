import asyncio,json,argparse,hashlib,ast
from pathlib import Path
from playwright.async_api import async_playwright
EXPECTED=next(ast.literal_eval(n.value) for n in ast.parse(Path(__file__).with_name('floor-study-browser.py').read_text()).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='EXPECTED_RUNTIME' for t in n.targets))

async def main():
 p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/');p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);r={'passed':False,'baseline':'ed015e34af0e967c3535f01b062da2de7c5bd6f2','errors':[],'scenes':{}}
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  page=await browser.new_page(viewport={'width':1000,'height':850});page.on('pageerror',lambda e:r['errors'].append(str(e)))
  def save(): (out/'pass-cost.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
  async def draw(options,profile=None):
   if profile:await page.evaluate('m=>profiler.begin(m)',profile)
   value=await page.evaluate('o=>probe.draw(o)',options)
   if profile:value['profile']=await page.evaluate('profiler.end()')
   assert value['error']==0
   return value
  def equal(a,b):
   for key in ['hitSha256','rgbaSha256']:assert a[key]==b[key],key+' changed by instrumentation'
  try:
   r['runtimeHashes']={}
   for path,expected in EXPECTED.items():
    response=await page.request.get(a.base+path);assert response.status==200;actual=hashlib.sha256(await response.body()).hexdigest();assert actual==expected,path;r['runtimeHashes'][path]=actual
   await page.goto(a.base+'tests/floor-lift-probe.html');await page.wait_for_function('probe?.ready');r['setup']=await page.evaluate('probe.setup()');print('COMPILE',json.dumps(r['setup']['compile']),flush=True)
   r['gpuTimer']=await page.evaluate("async()=>{const m=await import('./floor-pass-profiler.mjs');window.profiler=m.attachPassProfiler(probe.renderer);return profiler.supportedGpuTimer}")
   await page.evaluate("probe.camera('shaft')")
   r['cold32']=await draw({'width':32,'clip':True},'serial-finish');save();print('COLD',json.dumps(r['cold32']['profile']['groups']),flush=True)
   r['warm32']=await draw({'width':32,'clip':True},'serial-finish');equal(r['cold32'],r['warm32']);save();print('WARM32',json.dumps(r['warm32']['profile']['groups']),flush=True)
   for name in ['shaft','lower','room']:
    if name=='room':await page.evaluate("Object.assign(probe.renderer.options,{eye:[-18,22,18],target:[-5,0,0],fov:55*Math.PI/180,cut:false,sliceY:null})")
    else:await page.evaluate('n=>probe.camera(n)',name)
    options={'width':640,'clip':name=='shaft'};s=r['scenes'][name]={}
    s['before']=await draw(options);print('BEFORE',name,s['before']['stats']['wallMs'],flush=True)
    s['serial']=await draw(options,'serial-finish');equal(s['before'],s['serial']);print('SERIAL',name,json.dumps(s['serial']['profile']['groups']),flush=True);save()
    if r['gpuTimer']:
     s['timer']=await draw(options,'gpu-query');equal(s['before'],s['timer']);print('TIMER',name,json.dumps(s['timer']['profile']['groups']),flush=True);save()
    s['after']=await draw(options);equal(s['before'],s['after']);print('AFTER',name,s['after']['stats']['wallMs'],flush=True)
    await page.locator('#view').screenshot(path=str(out/(name+'.png')));save()
   # Same camera/scene with cab state changed only. Probe is the actual original controller.
   await page.evaluate("probe.camera('shaft');probe.act({action:{kind:'car',floor:'evidence-upper-reference'},seconds:6})")
   r['moving']=await draw({'width':640,'clip':True},'gpu-query' if r['gpuTimer'] else 'serial-finish');print('MOVING',json.dumps(r['moving']['profile']['groups']),flush=True)
   assert r['moving']['hitSha256']!=r['scenes']['shaft']['before']['hitSha256'];assert not r['errors'];r['passed']=True;save()
  except Exception as e:
   r['failure']=str(e);save();raise
  finally:await browser.close()

asyncio.run(main())
