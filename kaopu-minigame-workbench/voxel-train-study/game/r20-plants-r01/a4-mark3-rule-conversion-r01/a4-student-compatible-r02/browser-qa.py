import asyncio,json,pathlib,hashlib,time
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parent;OUT=ROOT/'evidence';OUT.mkdir(exist_ok=True)
BASE='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/a4-mark3-rule-conversion-r01/'
ENTRY=BASE+'a4-student-compatible-r02/'
EXPECTED='829caf7934c5d58d59a35f0e2125ae1ccc1c551447a62fed22bf4bd2170673b2'
async def run():
 report={'engine':'Chromium SwiftShader software GPU, not user device verification','cases':[],'production_modified':False}
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for mode in ['normal','reject-aa','reject-all']:
   context=await browser.new_context(viewport={'width':1280,'height':800},device_scale_factor=1)
   await context.add_init_script("""(mode=>{const original=HTMLCanvasElement.prototype.getContext;window.CONTEXT_PROBES=[];HTMLCanvasElement.prototype.getContext=function(type,options){if(type==='webgl2'){CONTEXT_PROBES.push({type,options});if(mode==='reject-all'||(mode==='reject-aa'&&options?.antialias))return null;}return original.call(this,type,options);};})("""+json.dumps(mode)+');')
   async def serve(route):
    name=route.request.url.split('?',1)[0].removeprefix(ENTRY) or 'index.html'
    if name not in ['index.html','view.mjs','webgl-compat.mjs']:await route.continue_();return
    await route.fulfill(status=200,body=(ROOT/name).read_bytes(),content_type='text/html' if name.endswith('.html') else 'text/javascript')
   await context.route(ENTRY+'**',serve)
   page=await context.new_page();requests=[];errors=[]
   page.on('request',lambda req:requests.append(req.url));page.on('pageerror',lambda err:errors.append(str(err)))
   case={'mode':mode,'started':time.time()}
   try:
    await page.goto(ENTRY,wait_until='domcontentloaded',timeout=120000)
    if mode=='reject-all':
     await page.wait_for_function("window.CONVERSION_QA?.failureCode==='WEBGL_CONTEXT_UNAVAILABLE'",timeout=30000)
     result=await page.evaluate("({ready:CONVERSION_QA.ready,code:CONVERSION_QA.failureCode,diagnostics:CONVERSION_QA.contextDiagnostics,status:document.querySelector('#status').textContent,disabled:[...document.querySelectorAll('[data-view-control]')].every(b=>b.disabled),canvases:document.querySelectorAll('canvas').length})")
     assert result['ready'] is False and result['disabled'] and result['canvases']==0
     assert len(result['diagnostics']['attempts'])==2
     assert not any('/generated/a4/' in u for u in requests), 'model fetched after context failure'
     case['result']=result
    else:
     await page.wait_for_function("window.CONVERSION_QA?.ready||window.CONVERSION_QA?.errors?.length",timeout=600000)
     state=await page.evaluate("({ready:CONVERSION_QA.ready,errors:CONVERSION_QA.errors,a4:CONVERSION_QA.a4,diagnostics:CONVERSION_QA.contextDiagnostics,clips:CONVERSION_QA.animationClips,tracks:CONVERSION_QA.animationTracks})")
     assert state['ready'],state
     assert state['a4']['fieldPayloadSHA256']==EXPECTED
     assert state['a4']['nodeCount']==331 and state['a4']['meshCount']==200
     assert state['clips']==1 and state['tracks']==71
     assert state['diagnostics']['selected']==('standard' if mode=='normal' else 'reduced-context')
     assert state['diagnostics']['attempts'][-1]['actual']['preserveDrawingBuffer'] is False
     forbidden=['/a4-full-source-replica-r01/source-assets/','original-recovery','/generated/mark3/','/student-native-r','/a6-native-r']
     assert not any(any(x in u for x in forbidden) for u in requests), 'unwanted teacher/other model request'
     rest=await page.evaluate("CONVERSION_QA.sources[0].nodes.map(n=>n.matrixWorld.elements.slice())")
     await page.click('#play');await page.wait_for_timeout(1600);await page.click('#play')
     changed=await page.evaluate("rest=>CONVERSION_QA.sources[0].nodes.filter((n,i)=>n.matrixWorld.elements.some((v,j)=>Math.abs(v-rest[i][j])>1e-6)).length",rest)
     assert changed>0,'original animation did not change transforms'
     await page.click('#rest')
     for button in ['front','top','side','free']:await page.click('#'+button)
     await page.click('#side');await page.evaluate('CONVERSION_QA.render()')
     renderer=await page.evaluate("(()=>{const gl=CONVERSION_QA.renderer.getContext();const ext=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),pixelRatio:CONVERSION_QA.renderer.getPixelRatio(),triangles:CONVERSION_QA.renderer.info.render.triangles};})()")
     assert renderer['triangles']>0
     case.update(result=state,changed_animation_nodes=changed,renderer=renderer)
    await page.screenshot(path=str(OUT/(mode+'.png')),full_page=True)
    case['passed']=True
   except Exception as error:
    case['passed']=False;case['error']=str(error)
    case['status']=await page.locator('#status').inner_text() if await page.locator('#status').count() else ''
    await page.screenshot(path=str(OUT/(mode+'-failure.png')),full_page=True)
   finally:
    case.update(seconds=time.time()-case['started'],page_errors=errors,requests=requests)
    report['cases'].append(case);(OUT/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    await context.close()
  await browser.close()
 assert all(c['passed'] for c in report['cases']),json.dumps(report,ensure_ascii=False)
asyncio.run(run())
