from pathlib import Path
import concurrent.futures,hashlib,json,os,time,urllib.request
from playwright.sync_api import sync_playwright
SOURCE=Path(os.environ['B24_SOURCE']);OUT=Path('verification');OUT.mkdir(exist_ok=True)
URL='https://haihao0307.github.io/guilin-dem-pipeline/aircraft/b24-v0171-clean-effects/'
EXPECTED=json.loads((SOURCE/'reports/BUILD.json').read_text())['files']
report={'url':URL,'revision':'20260905-loader-r1','files':[],'checks':[],'errors':[],'visualAcceptance':False}
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'Cache-Control':'no-cache','User-Agent':'B24-startup-check'}),timeout=45) as r:return r.read()
def check(name,value):report['checks'].append({'name':name,'passed':bool(value)});print(name,bool(value),flush=True)
try:
 deadline=time.monotonic()+540
 while True:
  try:
   if blob(get(URL+'index.html?boot=20260905-loader-r1'))==EXPECTED['index.html']:break
  except Exception:pass
  if time.monotonic()>=deadline:raise TimeoutError('Expected startup revision was not served within nine minutes')
  time.sleep(8)
 def filecheck(item):
  name,want=item;data=get(URL+name+'?verify='+want);return {'path':name,'bytes':len(data),'expected':want,'actual':blob(data),'passed':blob(data)==want}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:report['files']=list(pool.map(filecheck,EXPECTED.items()))
 check('37 served files match tested build',len(report['files'])==37 and all(f['passed'] for f in report['files']))
 old=get('https://haihao0307.github.io/guilin-dem-pipeline/aircraft/b24-v017-clean-restart/index.html?verify=preserve')
 check('accepted V017 page unchanged',blob(old)=='4668be04ca97f92406dbdfcb6f10957df512bc7b')
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for w,h in [(1440,900),(390,844)]:
   page=browser.new_page(viewport={'width':w,'height':h});errors=[];requests=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
   page.on('request',lambda r:requests.append(r.url))
   response=page.goto(URL+'?boot=20260905-loader-r1',wait_until='domcontentloaded')
   page.wait_for_function("window.__B24_STARTUP__?.status==='ready'",timeout=180000)
   check(f'{w} public HTTP success',response.status==200)
   check(f'{w} exact new loader active',page.evaluate("__B24_STARTUP__.revision==='20260905-loader-r1'"))
   check(f'{w} original geometry hash',page.evaluate("__B24_WORKBENCH__.plane.digest==='7ba1b923844f5161911e9aa63b18191e0d08ff8de4b3750204aa544320bd34c2'"))
   check(f'{w} download completed and checked',page.evaluate('__B24_STARTUP__.completedParts===18&&__B24_STARTUP__.verifiedBytes===8917196'))
   check(f'{w} no monolithic gzip requests',not any('.gz' in u for u in requests))
   check(f'{w} loading overlay removed',page.locator('#loading').evaluate("e=>e.classList.contains('hidden')"))
   page.screenshot(path=str(OUT/f'startup-public-{w}.png'))
   page.locator('#play').click();page.wait_for_function('__B24_WORKBENCH__.mission.time>0');check(f'{w} play starts',page.evaluate('__B24_WORKBENCH__.mission.running'))
   page.locator('#play').click();page.wait_for_function('!__B24_WORKBENCH__.mission.running');check(f'{w} pause stops',True)
   page.locator('#reset').click();page.wait_for_function('__B24_WORKBENCH__.mission.time===0');check(f'{w} reset works',True)
   check(f'{w} no weather or fog',page.evaluate('__B24_WORKBENCH__.scene.fog===null&&!__B24_WORKBENCH__.productionEffects.weather'))
   check(f'{w} no browser errors',not errors)
   check(f'{w} no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   report['errors']+=errors;page.close()
  browser.close()
except Exception as e:report['errors'].append(repr(e));check('public suite completed',False)
finally:
 report['passed_count']=sum(c['passed'] for c in report['checks']);report['total']=len(report['checks']);report['passed']=not report['errors'] and all(c['passed'] for c in report['checks']) and report['total']==26
 (OUT/'STARTUP_PUBLIC_QA.json').write_text(json.dumps(report,indent=2));print('PUBLIC_STARTUP_RESULT',json.dumps(report),flush=True)
raise SystemExit(0 if report['passed'] else 1)
