import json,hashlib,urllib.request,subprocess,sys,asyncio
from pathlib import Path
from playwright.async_api import async_playwright
root=Path(__file__).parent
request=json.loads((root/'public-whole-r02-request.json').read_text())
base='https://haihao0307.github.io/guilin-dem-pipeline/'
assert request['baseUrl']==base
out=root.parent/'evidence'/'whole-r02-public';out.mkdir(parents=True,exist_ok=True)
reports=[]
for path,expected in request['sha256'].items():
 assert path.startswith('kaopu-geography-workbench/kowloon-building-mother-r01/')
 with urllib.request.urlopen(base+path,timeout=45) as r:
  data=r.read();actual=hashlib.sha256(data).hexdigest();assert r.status==200
 assert actual==expected,(path,actual,expected)
 reports.append({'path':path,'sha256':actual,'bytes':len(data)})
(out/'https-hashes.json').write_text(json.dumps({'commit':request['publishedCommit'],'files':reports},indent=2))
urlbase=base+'kaopu-geography-workbench/kowloon-building-mother-r01/'
subprocess.run([sys.executable,'-u',str(root/'whole-r02-browser.py'),'--base',urlbase,'--output',str(out)],check=True)
async def regression():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  hashes={};errors=[];originals={}
  try:
   for name in ['whole-building-interaction-r01.html','whole-building-r02.html']:
    page=await browser.new_page(viewport={'width':1120,'height':850},device_scale_factor=1)
    page.on('pageerror',lambda e:errors.append(str(e)))
    await page.goto(urlbase+name);await page.wait_for_function('wholeBuilding.ready||wholeBuilding.error',timeout=120000);assert not await page.evaluate('wholeBuilding.error');await page.evaluate('wholeBuilding.pause()')
    await page.evaluate("document.getElementById('floor').value='T03'")
    await page.evaluate("wholeBuilding.setView('circulation')")
    hashes[name]=await page.evaluate("async()=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',wholeBuilding.renderer.readPixels()))].map(x=>x.toString(16).padStart(2,'0')).join('')")
    assert await page.evaluate('wholeBuilding.renderer.gl.getError()')==0
    if name=='whole-building-r02.html':
     for case in ['kcc','lowrise','warehouse']:
      if case!='kcc':await page.evaluate("id=>wholeBuilding.chooseCase(id,{preview:true})",case);await page.evaluate('wholeBuilding.pause()')
      await page.evaluate("wholeBuilding.setView('source')")
      originals[case]=await page.evaluate('({sourceHash:wholeBuilding.sourceHash,stats:wholeBuilding.lastStats,camera:wholeBuilding.getCamera(),caseId:wholeBuilding.caseId})')
      assert originals[case]['camera']['cut']==False
      assert await page.evaluate('wholeBuilding.renderer.gl.getError()')==0
      await page.screenshot(path=str(out/(case+'-original-source.png')))
    await page.close()
   assert len(set(hashes.values()))==1,hashes
   assert not errors,errors
   (out/'old-anchor-and-source-regression.json').write_text(json.dumps({'passed':True,'kccCorePixelHashes':hashes,'sources':originals,'pageErrors':errors},indent=2))
  finally:await browser.close()
asyncio.run(regression())
