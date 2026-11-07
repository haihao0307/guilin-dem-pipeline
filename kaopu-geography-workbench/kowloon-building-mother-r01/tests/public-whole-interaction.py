import json,hashlib,time,urllib.request,subprocess,sys
from pathlib import Path
root=Path(__file__).parent
request=json.loads((root/'public-whole-interaction-request.json').read_text())
base='https://haihao0307.github.io/guilin-dem-pipeline/'
assert request['baseUrl']==base
reports=[]
for path,expected in request['sha256'].items():
 assert path.startswith('kaopu-geography-workbench/kowloon-building-mother-r01/')
 url=base+path
 with urllib.request.urlopen(url,timeout=45) as r:
  data=r.read();actual=hashlib.sha256(data).hexdigest();assert r.status==200
 assert actual==expected,(path,actual,expected)
 reports.append({'path':path,'sha256':actual,'bytes':len(data)})
out=root.parent/'evidence'/'whole-interaction-public';out.mkdir(parents=True,exist_ok=True)
(out/'https-hashes.json').write_text(json.dumps({'commit':request['publishedCommit'],'files':reports},indent=2))
subprocess.run([sys.executable,'-u',str(root/'whole-interaction-browser.py'),'--base',base+'kaopu-geography-workbench/kowloon-building-mother-r01/','--output',str(out)],check=True)
# Also measure the default all-28-level settled frame, not just the core view.
import asyncio
from playwright.async_api import async_playwright
async def whole_default():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  page=await browser.new_page(viewport={'width':1120,'height':850},device_scale_factor=1)
  failures=[];page.on('pageerror',lambda e:failures.append(str(e)));begun=time.perf_counter()
  try:
   await page.goto(base+'kaopu-geography-workbench/kowloon-building-mother-r01/whole-building-interaction-r01.html')
   await page.wait_for_function('wholeBuilding.ready||wholeBuilding.error',timeout=120000)
   assert not await page.evaluate('wholeBuilding.error')
   first=time.perf_counter()-begun
   await page.wait_for_function('wholeBuilding.lastStats?.width===640&&!wholeBuilding.renderer.busy',timeout=120000)
   result=await page.evaluate('({stats:wholeBuilding.lastStats,frames:wholeBuilding.presentedFrames,error:wholeBuilding.renderer.gl.getError(),view:wholeBuilding.view})')
   result.update({'firstPreviewWallSeconds':first,'settledWallSeconds':time.perf_counter()-begun,'pageErrors':failures})
   assert result['error']==0 and result['view']=='whole' and not failures
   (out/'whole-default.json').write_text(json.dumps(result,indent=2))
   await page.screenshot(path=str(out/'whole-default-clear.png'))
  finally:await browser.close()
asyncio.run(whole_default())
