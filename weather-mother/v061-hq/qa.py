"""Real Chromium QA, storing measurements only. No image files are written."""
import hashlib,io,json,math,os,sys,time,traceback,urllib.request
from pathlib import Path
from PIL import Image,ImageStat,ImageChops
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
URL=os.getenv('WEATHER_QA_URL','http://127.0.0.1:8765/weather-mother/v061-hq/')
report={'version':'0.6.1-hq','url':URL,'startedUTC':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'checks':[], 'storedImageFiles':0,'visualAcceptance':False,'aaaQualityApproved':False,'productionReady':False,'userHardwarePerformanceVerified':False,'method':'real Chromium / SwiftShader, numeric readouts and in-memory screenshot measurements'}
def check(name,ok,detail=None):
 report['checks'].append({'name':name,'passed':bool(ok),'detail':detail})
 print(name, 'PASS' if ok else 'FAIL',json.dumps(detail,ensure_ascii=False)[:250],flush=True)
 if not ok: raise AssertionError(name)
def snap(page):
 raw=page.locator('#scene').screenshot(timeout=120000)
 img=Image.open(io.BytesIO(raw)).convert('RGB')
 stat=ImageStat.Stat(img)
 return img,{'meanRGB':stat.mean,'stddevRGB':stat.stddev,'pixelSha256':hashlib.sha256(img.tobytes()).hexdigest(),'width':img.width,'height':img.height}
def frames(page,n=2):
 f=page.evaluate('WeatherMother.qa.frames')
 page.wait_for_function('(f)=>WeatherMother.qa.errors.length || WeatherMother.qa.frames>=f',arg=f+n,timeout=180000)
 errs=page.evaluate('WeatherMother.qa.errors')
 if errs:raise RuntimeError(errs)
def values(page,values):
 page.evaluate('(v)=>{WeatherMother.pause();for(const [k,x]of Object.entries(v))WeatherMother.set(k,x);window.__WEATHER_QA_SNAP__=true;}',values)
 frames(page,2)
def state(page):return page.evaluate('({ ...WeatherMother.getState(), time:WeatherMother.qa.simulationTimeS })')
def motion(page,duration=1):
 a=state(page)
 page.evaluate('WeatherMother.play()')
 page.wait_for_function('(t)=>WeatherMother.qa.simulationTimeS>=t',arg=a['time']+duration,timeout=120000)
 page.evaluate('WeatherMother.pause()')
 b=state(page)
 return a,b
browser=None
try:
 manifest=json.loads((ROOT/'MANIFEST.json').read_text())
 sources={}
 for name,wanted in manifest['files'].items():
  with urllib.request.urlopen(URL+name+'?qa='+str(time.time_ns()),timeout=30) as r:
   data=r.read();code=r.status
  digest=hashlib.sha256(data).hexdigest()
  sources[name]={'httpStatus':code,'sha256':digest,'matchesBuild':digest==wanted['sha256']}
 check('served files match generated build',all(v['matchesBuild'] and v['httpStatus']==200 for v in sources.values()),sources)
 report['sources']=sources
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  report['browserVersion']=browser.version
  page=browser.new_page(viewport={'width':400,'height':280},device_scale_factor=1)
  page.set_default_timeout(120000)
  errors=[];bad=[];assets=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('requestfailed',lambda r:bad.append(r.url))
  page.on('response',lambda r:assets.append({'url':r.url,'status':r.status}))
  page.add_init_script('window.WeatherMotherBoot={weather:"fair",quality:"balanced",still:true};')
  page.goto(URL+'?qa=061hq',wait_until='domcontentloaded',timeout=90000)
  page.wait_for_function('window.WeatherMother?.qa.ready && WeatherMother.qa.frames>=3 || window.WeatherMother?.qa.errors.length',timeout=240000)
  page.add_style_tag(content='.panel,.footer,#loading{visibility:hidden!important}')
  q=page.evaluate('WeatherMother.qa')
  check('WebGL startup and nonzero frames',q.get('ready') and q.get('frames',0)>=3 and not q.get('errors'),q)
  check('density support does not touch boundaries',q.get('borderInputMax')==0 and q.get('supportSafe') is True)
  check('ten cloud genera preserved',page.locator('#kind option').count()==10)
  check('eight weather cases preserved',page.locator('#weather option').count()==8)
  for key in ['wind','cloudSpeed','direction','gust','turbulence','timeScale','evolution','silver','groundLight','sunlight','skylight','scatter','rain','fog','humidity','instability','shear','quality','windLink','follow','temporal','mountains','aircraft','rainbow']:
   check('control '+key,page.locator('#'+key).count()==1)
  _,img=snap(page)
  check('first frame contains nonuniform visible radiance',max(img['stddevRGB'])>7 and max(img['meanRGB'])>18,img)
  report['firstFrame']=img
  values(page,{'wind':0,'cloudSpeed':24,'direction':270,'gust':0,'timeScale':1,'evolution':0})
  a,b=motion(page)
  dt=b['time']-a['time'];vx=(b['windOffset'][0]-a['windOffset'][0])*1000/dt;vz=(b['windOffset'][2]-a['windOffset'][2])*1000/dt
  check('cloud drift independent of wind force',abs(vx-24)<.6 and abs(vz)<.1,{'actualMps':[vx,vz],'windMps':b['wind'],'cloudMps':b['cloudSpeed'],'dt':dt})
  values(page,{'wind':50,'cloudSpeed':0,'turbulence':.7})
  a,b=motion(page,.6)
  moved=math.dist(a['windOffset'],b['windOffset'])*1000
  check('zero cloud speed stops transport while wind remains',moved<.002 and b['wind']==50,{'movedM':moved,'windMps':b['wind']})
  values(page,{'cloudSpeed':15,'direction':0})
  a,b=motion(page,.6);dt=b['time']-a['time'];dx=(b['windOffset'][0]-a['windOffset'][0])*1000/dt;dz=(b['windOffset'][2]-a['windOffset'][2])*1000/dt
  check('north wind transports south in world coordinates',abs(dx)<.1 and abs(dz-15)<.5,{'mps':[dx,dz]})
  values(page,{'wind':20,'cloudSpeed':2})
  page.evaluate('document.getElementById("windLink").checked=true;document.getElementById("windLink").dispatchEvent(new Event("change"));window.__WEATHER_QA_SNAP__=true;')
  frames(page,2);a,b=motion(page,.6);speed=math.dist(a['windOffset'],b['windOffset'])*1000/(b['time']-a['time'])
  check('optional wind/cloud speed linkage',abs(speed-20)<.5,{'mps':speed})
  page.evaluate('document.getElementById("windLink").checked=false;document.getElementById("windLink").dispatchEvent(new Event("change"))')
  values(page,{'wind':12,'cloudSpeed':12,'direction':270,'timeScale':0})
  a=state(page);page.evaluate('WeatherMother.play()');page.wait_for_timeout(600);page.evaluate('WeatherMother.pause()');b=state(page)
  check('zero simulation rate freezes simulation clock',abs(b['time']-a['time'])<1e-5)
  values(page,{'timeScale':1,'evolution':1})
  genera=['Cu','Cb','Sc','St','Ns','Ac','As','Ci','Cc','Cs']
  for k in genera:
   f=page.evaluate('WeatherMother.qa.frames')
   page.evaluate('(k)=>WeatherMother.setKind(k)',k)
   page.wait_for_function('(v)=>WeatherMother.qa.errors.length || WeatherMother.qa.activeCloudKind===v.k && WeatherMother.qa.frames>=v.f+2',arg={'k':k,'f':f},timeout=240000)
   q=page.evaluate('WeatherMother.qa')
   check('cloud renderer '+k,not q['errors'] and q['borderInputMax']==0 and q['supportSafe'],{'lobes':q.get('lobes'),'kind':q.get('activeCloudKind'),'frames':q.get('frames')})
  for w in ['fair','coast','mountain','rain','storm','rainbow','snow','high']:
   f=page.evaluate('WeatherMother.qa.frames')
   page.evaluate('(w)=>WeatherMother.setWeather(w)',w)
   page.wait_for_function('(f)=>WeatherMother.qa.errors.length || document.getElementById("loading").style.display==="none" && WeatherMother.qa.frames>=f+2',arg=f,timeout=240000)
   check('weather renderer '+w,not page.evaluate('WeatherMother.qa.errors'))
  page.evaluate('WeatherMother.setWeather("fair")')
  frames(page,4)
  colors=[]
  for hr in [6.6,12,17.5,22]:
   values(page,{'hour':hr})
   _,img=snap(page);colors.append(img['meanRGB'])
   check('daylight state '+str(hr),min(img['meanRGB'])>=0 and max(img['meanRGB'])>1,img)
  check('dawn noon dusk night produce different lighting',len({tuple(round(v,1) for v in x) for x in colors})==4,colors)
  values(page,{'hour':14.1,'density':.86})
  for quality,steps in [('fine',192),('ultra',320),('cinema',480)]:
   page.evaluate('(q)=>{document.getElementById("quality").value=q;document.getElementById("quality").dispatchEvent(new Event("change"));}',quality)
   frames(page,2)
   q=page.evaluate('WeatherMother.qa')
   _,img=snap(page)
   check('quality tier '+quality,q['steps']==steps and max(img['stddevRGB'])>5,{'qa':q,'image':img})
  page.evaluate('document.getElementById("quality").value="balanced";document.getElementById("quality").dispatchEvent(new Event("change"));document.getElementById("temporal").checked=false;document.getElementById("temporal").dispatchEvent(new Event("change"));')
  frames(page,3)
  page.wait_for_function('WeatherMother.qa.temporalFrames>=24',timeout=240000)
  first,m1=snap(page);page.wait_for_timeout(500);second,m2=snap(page)
  delta=max(ImageStat.Stat(ImageChops.difference(first,second)).mean)
  check('paused settled frame is stable',delta<.001,{'meanPixelDifference':delta})
  values(page,{'density':0})
  _,clear=snap(page)
  check('density slider changes actual rendered image',clear['pixelSha256']!=m2['pixelSha256'],clear)
  check('no page or WebGL errors',not errors and not page.evaluate('WeatherMother.qa.errors'),errors)
  check('no failed requests',not bad,bad)
  images=[x for x in assets if any(ext in x['url'].split('?')[0].lower() for ext in ['.png','.jpg','.jpeg','.webp','.hdr','.exr','.glb'])]
  check('no downloaded image or mesh assets',not images,images)
  report['requests']=assets;report['mobileQA']=page.evaluate('WeatherMother.qa')
  desktop=browser.new_page(viewport={'width':800,'height':450},device_scale_factor=.5)
  desktop.add_init_script('window.WeatherMotherBoot={quality:"fine",still:true};')
  desktop.goto(URL,wait_until='domcontentloaded',timeout=90000)
  desktop.wait_for_function('window.WeatherMother?.qa.ready && WeatherMother.qa.frames>=2 || window.WeatherMother?.qa.errors.length',timeout=240000)
  dq=desktop.evaluate('WeatherMother.qa')
  check('desktop high-resolution density field',dq.get('cloudVolumeBytes')==320*192*256 and not dq.get('errors'),dq)
  report['desktopQA']=dq;desktop.close();browser.close();browser=None
 report['status']='AUTOMATIC_QA_PASS'
except Exception as e:
 report['status']='AUTOMATIC_QA_FAILED';report['failure']=traceback.format_exc();print(report['failure'],flush=True)
finally:
 if browser:
  try:browser.close()
  except Exception:pass
 report['finishedUTC']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
 (ROOT/('PUBLIC_QA.json' if URL.startswith('https:') else 'QA.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'status':report['status'],'checks':len(report['checks'])}),flush=True)
if report['status']!='AUTOMATIC_QA_PASS':sys.exit(1)
