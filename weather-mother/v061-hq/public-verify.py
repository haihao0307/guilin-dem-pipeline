"""Verify the actual public release; screenshots are used only in memory."""
import hashlib,io,json,math,time,traceback,sys,urllib.request
from pathlib import Path
from PIL import Image,ImageStat
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
URL='https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/v061-hq/'
manifest=json.loads((R/'MANIFEST.json').read_text())
result={'version':'0.6.1-hq','publicURL':URL,'storedImageFiles':0,'visualAcceptance':False,'aaaQualityApproved':False,'productionReady':False,'userHardwarePerformanceVerified':False,'sources':{},'checks':[]}
def check(name,ok,detail=None):
 result['checks'].append({'name':name,'passed':bool(ok),'detail':detail});print(name,ok,flush=True)
 if not ok:raise AssertionError(name)
try:
 for retry in range(50):
  try:
   for name,meta in manifest['files'].items():
    req=urllib.request.Request(URL+name+'?verify='+str(time.time_ns()),headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=20) as r:data=r.read();code=r.status
    digest=hashlib.sha256(data).hexdigest()
    result['sources'][name]={'httpStatus':code,'sha256':digest,'matchesBuild':digest==meta['sha256']}
   if all(v['matchesBuild'] for v in result['sources'].values()):break
  except Exception as e:print('Waiting for Pages:',e,flush=True)
  time.sleep(6)
 check('four public source files match build exactly',len(result['sources'])==4 and all(v['matchesBuild'] and v['httpStatus']==200 for v in result['sources'].values()),result['sources'])
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  result['browser']=browser.version
  page=browser.new_page(viewport={'width':900,'height':600},device_scale_factor=.5)
  errors=[];failed=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('requestfailed',lambda r:failed.append(r.url))
  page.on('response',lambda r:requests.append({'url':r.url,'status':r.status}))
  page.add_init_script('window.WeatherMotherBoot={quality:"fine",still:true};')
  page.goto(URL+'?v=061hq-public',wait_until='domcontentloaded',timeout=90000)
  page.wait_for_function('window.WeatherMother?.qa.ready && WeatherMother.qa.frames>=5 || window.WeatherMother?.qa.errors.length',timeout=240000)
  q=page.evaluate('WeatherMother.qa')
  check('live WebGL initialization and rendering',q.get('ready') and q.get('frames',0)>=5 and not q.get('errors'),q)
  page.add_style_tag(content='.panel,.footer,#loading{visibility:hidden!important}')
  raw=page.locator('#scene').screenshot(timeout=120000);image=Image.open(io.BytesIO(raw)).convert('RGB');stat=ImageStat.Stat(image)
  check('live cloud scene has visible nonuniform radiance',max(stat.mean)>18 and max(stat.stddev)>7,{'meanRGB':stat.mean,'stddevRGB':stat.stddev,'pixelSha256':hashlib.sha256(image.tobytes()).hexdigest()})
  check('full cloud and weather workbench delivered',page.locator('#kind option').count()==10 and page.locator('#weather option').count()==8)
  page.evaluate('WeatherMother.set("wind",0);WeatherMother.set("cloudSpeed",30);WeatherMother.set("gust",0);WeatherMother.set("timeScale",1);WeatherMother.set("direction",270);window.__WEATHER_QA_SNAP__=true;')
  page.wait_for_function('Math.abs(WeatherMother.getState().cloudSpeed-30)<.01',timeout=120000)
  a=page.evaluate('({...WeatherMother.getState(),time:WeatherMother.qa.simulationTimeS})')
  page.evaluate('WeatherMother.play()')
  page.wait_for_function('(t)=>WeatherMother.qa.simulationTimeS>=t',arg=a['time']+1,timeout=120000)
  page.evaluate('WeatherMother.pause()')
  b=page.evaluate('({...WeatherMother.getState(),time:WeatherMother.qa.simulationTimeS})')
  speed=math.dist(a['windOffset'],b['windOffset'])*1000/(b['time']-a['time'])
  check('independent cloud transport works on public page',abs(speed-30)<.6 and b['wind']==0,{'cloudActualMps':speed,'windMps':b['wind']})
  page.evaluate('WeatherMother.set("hour",17.5);window.__WEATHER_QA_SNAP__=true;')
  page.wait_for_function('Math.abs(WeatherMother.getState().hour-17.5)<.01',timeout=120000)
  check('public dusk light control updates runtime',abs(page.evaluate('WeatherMother.getState().hour')-17.5)<.01)
  check('public requests and JavaScript are clean',not errors and not failed,{'pageErrors':errors,'failedRequests':failed})
  check('public runtime fetches zero image assets',not any(x['url'].split('?')[0].lower().endswith(('.png','.jpg','.webp','.hdr','.exr','.glb')) for x in requests),requests)
  result['qa']=page.evaluate('WeatherMother.qa');browser.close()
 result['status']='PUBLIC_BROWSER_VERIFIED'
except Exception:
 result['status']='PUBLIC_VERIFICATION_FAILED';result['failure']=traceback.format_exc();print(result['failure'],flush=True)
result['finishedUTC']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
(R/'PUBLIC_QA.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'],flush=True)
if result['status']!='PUBLIC_BROWSER_VERIFIED':sys.exit(1)
