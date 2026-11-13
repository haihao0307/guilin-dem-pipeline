import asyncio,json,argparse,time,sys
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);r={'passed':False,'label':'Per-stage wall time with synchronous 1-pixel readback, not GPU timer query; synchronization changes scheduling','runs':[]}
 async with async_playwright() as pw:
  b=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await b.new_page()
  try:
   await page.goto('http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/tests/mobile-renderer-probe.html');await page.wait_for_function('probe?.ready');r['compile']=await page.evaluate("probe.setup('kcc')")
   for width,tile,profile in [(32,96,False),(320,96,False),(320,96,True),(585,96,False),(585,96,True),(585,64,False),(585,128,False)]:
    print('STAGE START',width,tile,profile,flush=True);v=await page.evaluate('x=>probe.render(...x)',['optimized',width,True,tile,profile]);r['runs'].append(v);print('STAGE RESULT',json.dumps(v),flush=True);(out/'stages.json').write_text(json.dumps(r,indent=2));assert v['glError']==0
   assert r['runs'][1]['sha']==r['runs'][2]['sha'];assert len(set(v['sha'] for v in r['runs'][3:]))==1;r['passed']=True
  except Exception as e:r['failure']=str(e);print('FAIL',e,flush=True)
  finally:await b.close();(out/'stages.json').write_text(json.dumps(r,indent=2));sys.exit(0 if r['passed'] else 1)
asyncio.run(main())
