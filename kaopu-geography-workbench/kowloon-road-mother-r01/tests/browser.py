import asyncio,json,sys,argparse,hashlib,urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'evidence';OUT.mkdir(exist_ok=True)
p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-road-mother-r01/');p.add_argument('--manifest');args=p.parse_args()
async def main():
 result={'passed':False,'errors':[],'cases':{},'base':args.base}
 if args.manifest:
  manifest=json.loads(Path(args.manifest).read_text());result['publicCommit']=manifest['commit'];result['verifiedFiles']=[]
  for item in manifest['files']:
   response=urllib.request.urlopen(args.base+item['path'],timeout=30);body=response.read();actual=hashlib.sha256(body).hexdigest();assert response.status==200 and actual==item['sha256'],('public bytes mismatch',item['path']);result['verifiedFiles'].append(item['path'])
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  try:
   for mobile in [False,True]:
    label='mobile' if mobile else 'desktop'
    page=await browser.new_page(viewport={'width':390,'height':844} if mobile else {'width':1440,'height':1100},device_scale_factor=3 if mobile else 1,is_mobile=mobile,has_touch=mobile)
    page.on('pageerror',lambda e:result['errors'].append(str(e)))
    await page.goto(args.base)
    await page.wait_for_function('window.__qa?.ready||!document.getElementById("error").hidden',timeout=60000)
    assert await page.locator('#error').is_hidden(),await page.locator('#error').text_content()
    assert await page.locator('#topology').text_content() and '片段边界' in await page.locator('#topology').text_content()
    await page.screenshot(path=str(OUT/(label+'-street.png')),full_page=True)
    q=await page.evaluate('window.__qa');assert q['width']>=350;q['renderMode']='analytic field + analytic primitives; screen triangle only'
    await page.locator('[data-n="3"]').click();assert await page.evaluate('roadTrial.state.lanes')==3
    assert await page.evaluate('roadTrial.spec.roads[0].lanes.length')==6
    await page.locator('#graph').click();assert await page.locator('#topology path').count()>=7
    assert await page.evaluate('roadTrial.spec.movements.length')==6
    await page.screenshot(path=str(OUT/(label+'-topology.png')),full_page=True)
    await page.locator('#pedestrian').check();assert await page.evaluate('roadTrial.spec.movements.length')==0
    await page.screenshot(path=str(OUT/(label+'-pedestrian.png')),full_page=True)
    await page.locator('#pedestrian').uncheck();await page.locator('[data-n="1"]').click();await page.locator('#orbit').click()
    await page.locator('#wet').check();await page.locator('#wear').focus();await page.locator('#wear').press('End')
    await page.locator('#reset').click()
    before=await page.evaluate('roadTrial.state.yaw')
    await page.locator('#view').scroll_into_view_if_needed();box=await page.locator('#view').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.5
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y+20,steps=3);await page.mouse.up()
    assert await page.evaluate('roadTrial.state.yaw')!=before
    assert await page.evaluate('__qa.width')==q['width'],'No blur switching after input'
    if mobile:
     session=await page.context.new_cdp_session(page);before_distance=await page.evaluate('roadTrial.state.distance')
     await session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x-35,'y':y,'id':1},{'x':x+35,'y':y,'id':2}]})
     await session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-60,'y':y,'id':1},{'x':x+60,'y':y,'id':2}]})
     await session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
     assert await page.evaluate('roadTrial.state.distance')<before_distance*.8
     q['touchPinchPassed']=True
    await page.screenshot(path=str(OUT/(label+'-after-input.png')),full_page=True)
    async with page.expect_download() as dl:await page.locator('#export').click()
    download=await dl.value;await download.save_as(str(OUT/(label+'-export.json')))
    exported=json.loads((OUT/(label+'-export.json')).read_text());assert exported['spec']['source']['crs']=='EPSG:2326'
    assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
    q['controlsPassed']=True;result['cases'][label]=q;await page.close();print(label,'passed',q,flush=True)
   assert not result['errors'];result['passed']=True
  except Exception as e:result['failure']=str(e);print('FAIL',repr(e),flush=True)
  finally:await browser.close();(OUT/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
 return 0 if result['passed'] else 1
sys.exit(asyncio.run(main()))
