import asyncio,json,argparse,hashlib,sys
from pathlib import Path
from playwright.async_api import async_playwright
EXPECTED={'whole-building-floor-study-r01.html': '0293d10ab9ce219aee902ec08396abd035177d8a953d94d1eb6d9109375c1113', 'whole-building-floor-study-r01/app.mjs': 'c03b00a6035ac1528abf2409ddcecec7ebe2f40e88c4e15c9c8a0608fae2a42e', 'whole-building-floor-study-r01/renderer.mjs': '0303f12f3c6db7f6e4b45f505592af595b8c48ab151d27fb6353a2a43ec17bfd', 'whole-building-floor-study-r01/floor-layout.mjs': '75b520f282ab418c5aee3bc8fc8bebe6f5bd0d4c276d5432a35dac37c28bfc55', 'whole-building-floor-study-r01/style.css': '775819cbfe6bf871cb9d1d7914a5710b6b6a3d8558827c9f3e924ac3bf2adee3', 'whole-building-floor-study-r01/sources/plan-registration.json': 'f84457e63cefe8fb781ce83830b404ab2951ec8f8a80b62d509308a54a913ad8', 'floor-materials-r01/material-adapter.mjs': 'aa54a78a5a0be66822c11ff8f1d0c96938e455f90dec242fb1d9cf27bf2dc6c6', 'floor-materials-r01/sources/field-sources.mjs': '5dbede5b3a34d2ac81fcc562eaa68cafe4a8d06ed2df77090b1a75f52932be68'}
async def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);result={'passed':False,'errors':[]};base='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/'
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await browser.new_page(viewport={'width':800,'height':650});page.on('pageerror',lambda e:result['errors'].append(str(e)))
  try:
   result['runtimeHashes']={}
   for path,expected in EXPECTED.items():
    response=await page.request.get(base+path);assert response.status==200;actual=hashlib.sha256(await response.body()).hexdigest();assert actual==expected;result['runtimeHashes'][path]=actual
   await page.goto(base+'tests/floor-study-probe.html');await page.wait_for_function('probe?.ready');result['setup']=await page.evaluate('probe.setup()')
   async def draw(name,mode=0,cull=True,width=640):
    await page.evaluate('(p)=>Object.assign(probe.renderer.options,{diagnostic:p.mode,opticalTileCull:p.cull})',{'mode':mode,'cull':cull});r=await page.evaluate('w=>probe.draw(w)',width);assert r['error']==0;r['rgbaSha256']=await page.evaluate("async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',probe.renderer.readPixels()))).map(b=>b.toString(16).padStart(2,'0')).join('')");result[name]=r;await page.locator('#view').screenshot(path=str(out/(name+'.png')));print(name,json.dumps(r),flush=True)
   await draw('warmup',width=32)
   await draw('baseline-full-optics',cull=False)
   await draw('conservative-optical-tiles',cull=True)
   assert result['baseline-full-optics']['rgbaSha256']==result['conservative-optical-tiles']['rgbaSha256'],'optical broadphase changed pixels'
   for name,mode in [('flat-object-id',1),('geometric-normal',2),('unlit-material',3),('material-no-bump',4)]:await draw(name,mode)
   await page.evaluate("()=>{const h=probe.study.windowBinding.config.host;probe.renderer.options.eye=h.origin.map((v,i)=>v+3*h.w[i]+.55*h.v[i]);probe.renderer.options.target=h.origin;}")
   await draw('window-full-optics',cull=False,width=320);await draw('window-optical-tiles',cull=True,width=320)
   assert result['window-full-optics']['rgbaSha256']==result['window-optical-tiles']['rgbaSha256'],'window optics pixels changed'
   assert not result['errors'];result['passed']=True
  except Exception as e:result['failure']=str(e);print('FAIL',repr(e),flush=True)
  finally:(out/'diagnostic.json').write_text(json.dumps(result,indent=2));await browser.close();sys.exit(0 if result['passed'] else 1)
asyncio.run(main())
