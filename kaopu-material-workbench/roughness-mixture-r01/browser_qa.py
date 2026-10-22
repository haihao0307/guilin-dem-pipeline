import asyncio,json,pathlib,hashlib,math,sys,time,os
import reference_experiment as reference
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parent
BASE=sys.argv[1] if len(sys.argv)>1 else (ROOT/'index.html').as_uri()
OUT=ROOT/'qa'/('public' if BASE.startswith('https') else 'local');OUT.mkdir(parents=True,exist_ok=True)
async def run():
 report={'source':BASE,'utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'html_sha256':hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest(),'cases':[],'browser':'Chromium headless, CPU analytical rendering; viewport emulation is not physical device testing','route_overrides':False}
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or None,headless=True,args=['--no-sandbox','--disable-gpu'])
  for name,width,height in [('desktop',1440,1050),('mobile',390,844)]:
   ctx=await browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=name=='mobile',has_touch=name=='mobile')
   await ctx.add_init_script("window.CONTEXT_REQUESTS=[];const saved=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){CONTEXT_REQUESTS.push(type);if(type.startsWith('webgl'))throw Error('WebGL explicitly prohibited in QA');return saved.call(this,type,...args)}")
   page=await ctx.new_page();errors=[];requests=[];failed=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('request',lambda r:requests.append(r.url))
   page.on('requestfailed',lambda r:failed.append(r.url))
   await page.goto(BASE,wait_until='load');await page.wait_for_function('window.MIXTURE_QA?.ready')
   await page.wait_for_timeout(100)
   async def snap(label):
    await page.screenshot(path=str(OUT/f'{name}-{label}.png'),full_page=True)
    return await page.evaluate('({state:{...MIXTURE_QA.state},measurement:MIXTURE_QA.measurement,pixels:MIXTURE_QA.pixels,renderMs:MIXTURE_QA.renderMs})')
   result={'viewport':name,'errors':errors,'requests':requests,'failed_requests':failed}
   result['initial']=await snap('initial');m=result['initial']['measurement'];assert abs(m['mixture']-.12141888865308904)<1e-12;assert abs(m['errorPercent']+82.81918329812503)<1e-7,m
   for part in result['initial']['pixels'].values(): assert part['hits']>5000 and part['max']-part['min']>25 and part['nonBackground']>1000,part
   assert result['initial']['pixels']['mixture']['centerRGB'][0]>result['initial']['pixels']['average']['centerRGB'][0]+20
   await page.click('#offpeak');await page.wait_for_function('MIXTURE_QA.measurement.angle===30');result['offpeak']=await snap('offpeak');assert result['offpeak']['measurement']['errorPercent']>100
   await page.click('#actual');await page.click('#front');await page.wait_for_function('MIXTURE_QA.measurement.angle===0 && MIXTURE_QA.measurement.weight>.98');result['actual']=await snap('actual');assert abs(result['actual']['measurement']['errorPercent']+10.524303167018855)<1e-7
   await page.click('[data-layout="average"]');await page.wait_for_function('MIXTURE_QA.state.layout==="average"');assert await page.locator('#mixPanel').is_hidden();assert not await page.locator('#avgPanel').is_hidden()
   await page.click('[data-layout="mixture"]');await page.wait_for_function('MIXTURE_QA.state.layout==="mixture"');assert await page.locator('#avgPanel').is_hidden();assert not await page.locator('#mixPanel').is_hidden()
   await page.click('[data-layout="split"]');await page.click('#half');await page.click('[data-shading="specular"]');await page.wait_for_function('MIXTURE_QA.state.shading==="specular" && MIXTURE_QA.measurement.weight===.5');result['specular']=await snap('specular')
   await page.locator('#weight').focus();await page.locator('#weight').press('Home');await page.wait_for_function('MIXTURE_QA.measurement.weight===0');assert abs(await page.evaluate('MIXTURE_QA.measurement.errorPercent'))<1e-12
   same=await page.evaluate("(()=>{let a=document.querySelector('#average').getContext('2d').getImageData(0,0,average.width,average.height).data,b=document.querySelector('#mixture').getContext('2d').getImageData(0,0,mixture.width,mixture.height).data;return a.length===b.length&&a.every((x,i)=>x===b[i])})()")
   assert same,'pure material pixel buffers differ'
   await page.locator('#weight').focus();await page.locator('#weight').press('End');await page.wait_for_function('MIXTURE_QA.measurement.weight===1');assert abs(await page.evaluate('MIXTURE_QA.measurement.errorPercent'))<1e-12
   await page.locator('#angle').evaluate('(el)=>{el.value=-44;el.dispatchEvent(new Event("input",{bubbles:true}))}');await page.wait_for_function('MIXTURE_QA.measurement.angle===-44');assert (await page.locator('#angleOut').inner_text())=='-44°'
   await page.click('#sweep');start=await page.evaluate('MIXTURE_QA.frame');await page.wait_for_timeout(500);assert await page.evaluate('MIXTURE_QA.frame')>start;await page.click('#sweep');assert not await page.evaluate('MIXTURE_QA.state.sweep')
   await page.click('[data-shading="material"]');await page.click('#half');await page.click('#front');await page.wait_for_function('MIXTURE_QA.measurement.angle===0');
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'horizontal overflow'
   assert not errors and not failed,(errors,failed)
   assert all(t=='2d' for t in await page.evaluate('CONTEXT_REQUESTS'))
   assert all(u==BASE for u in requests),requests
   result['final']=await snap('final');result['core_network_requests']=len([u for u in requests if u!=BASE]);result['passed']=True;report['cases'].append(result)
   await ctx.close()
  # Actual file:// offline execution and full original reference cross-check use live runtime scalar functions.
  ctx=await browser.new_context();page=await ctx.new_page();await page.goto(BASE);await page.wait_for_function('window.MIXTURE_QA?.ready')
  test=[{'r1':r1,'r2':r2,'w':w,'v':v,'l':l,'reference':reference.mixture(r1,r2,w,v,l)} for _,r1,r2,w in reference.cases() for v in (0,30,60,80) for l in range(-85,86)]
  diffs=await page.evaluate('(rows)=>rows.map(x=>{const value=x.w*MIXTURE_QA.response(x.r1,x.v,x.l)+(1-x.w)*MIXTURE_QA.response(x.r2,x.v,x.l);return Math.abs(value-x.reference)/Math.max(1e-12,Math.abs(x.reference))})',test)
  assert max(diffs)<1e-10
  report['numerical_reference']={'comparisons':len(diffs),'max_relative_error':max(diffs),'all_passed':True}
  await ctx.close()
  # Failure injection is local test only, must be visibly failed, not a false success.
  ctx=await browser.new_context();await ctx.add_init_script("HTMLCanvasElement.prototype.getContext=function(){return null}")
  page=await ctx.new_page();await page.goto(BASE);await page.wait_for_function('window.MIXTURE_QA?.state.error');assert not await page.evaluate('MIXTURE_QA.ready');assert await page.locator('#error').is_visible();assert await page.locator('#angle').is_disabled();await page.screenshot(path=str(OUT/'explicit-failure.png'),full_page=True);report['failure_injection']='passed: visible error, ready false, controls disabled'
  await browser.close()
 report['passed']=True;(OUT/'REPORT.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));print(json.dumps(report,indent=2,ensure_ascii=False))
asyncio.run(run())
