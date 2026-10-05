"""KAOPU R17 speed-control verification. Scene shaders and R16.2 responsive shell remain anchored."""
import os,time,json,hashlib,urllib.request,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('KAOPU_PUBLIC_URL','https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/')
OUT=Path('geography-qa/speed-r16-3');OUT.mkdir(parents=True,exist_ok=True)
FROZEN={
'settings.js':'0ba24c343cefbb20eba8dd5d6d86e1d288e88253','post.js':'048305b127bfb6770e3df2541cd4bbaf398c9645',
'crater.js':'1316fd4c4b56f941cab0e90aaa4f39730bd87111','underwater.js':'1f97a36952ebfd04969e2c7d2f61e68a1c4198a5',
'cave.js':'811e69b450d63f0ffea627f9da2322a9b78e6606','canyon.js':'d9e12711c4186356b34f9e458f029b771b837622',
'style.css':'7f48293ed2ce65cea1fded7bea1997ac692a8aae','caveBake.js':'c88a4dd81a7ca7bf5325080900d52f6847d7223d',
'more.js':'53316a56059e122246d293b6c1b6d94aff91db8f','snow.js':'6b5fe324549596c52b47bda1f5d53a723b569fed',
'detail-r16-2.css':'321f9e1b75ae0b700162913c16abb161912208ed'}
report={'ui_version':'R17','public_url':BASE,'physical_phone_tested':False,'tests':[],'errors':[],'passed':False}
def get(name=''):
 with urllib.request.urlopen(urllib.request.Request(BASE+name+'?r165='+str(time.time()),headers={'Cache-Control':'no-cache'}),timeout=30) as r:
  assert r.status==200
  return r.read()
def blob_sha(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def wait_render(p,scene,count=-1,timeout=180000):
 p.wait_for_function('(a)=>window.KaoPuDiagnostics&&KaoPuDiagnostics().scene===a.scene&&KaoPuDiagnostics().renderReady&&KaoPuDiagnostics().renderCount>a.count',arg={'scene':scene,'count':count},timeout=timeout)
 assert not p.locator('#notice.error').is_visible(),p.locator('#notice').inner_text()
try:
 for _ in range(72):
  try:
   html=get().decode()
   runtime_bytes=get('runtime.js')
   if 'data-original-studies-revision="O1"' in html and html==Path(__file__).with_name('index.html').read_text() and 'data-ui-version="R17"' in html and '0.01× 极慢观察' in html and blob_sha(runtime_bytes)=='06904231c24537f81dba620d9e1472a6c7fae30c':break
  except Exception as e:print('waiting R17',e,flush=True)
  time.sleep(10)
 else:raise RuntimeError('R17 did not reach public hosting')
 for name,sha in FROZEN.items():assert blob_sha(get(name))==sha,('anchored file changed',name)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
  # Desktop: all new speed gears visible; non-cave defaults to half-speed.
  p=browser.new_page(viewport={'width':1440,'height':1000})
  p.goto(BASE+'?ui=R17',wait_until='load',timeout=120000)
  assert p.evaluate('KaoPuDiagnostics().homeVisible') and not p.evaluate('KaoPuDiagnostics().detailVisible')
  assert p.locator('[data-scene]').count()==7
  before=p.evaluate('KaoPuDiagnostics().renderCount');p.locator('[data-scene="underwater"]').click();wait_render(p,'underwater',before)
  assert p.locator('#speed').input_value()=='0.5'
  opts=p.locator('#speed option').evaluate_all('(xs)=>xs.map(x=>x.value)')
  assert opts==['0.01','0.02','0.05','0.1','0.2','0.25','0.35','0.5','0.75','1','1.5','2'],opts
  # Verify the runtime accepted the selected speed values directly; do not infer speed from overloaded software-GPU wall clock.
  assert abs(p.evaluate('KaoPuDiagnostics().speed')-0.5)<1e-9
  p.locator('#speed').select_option('0.01');assert abs(p.evaluate('KaoPuDiagnostics().speed')-0.01)<1e-9
  p.locator('#speed').select_option('0.02');assert abs(p.evaluate('KaoPuDiagnostics().speed')-0.02)<1e-9
  p.locator('#speed').select_option('0.05');assert abs(p.evaluate('KaoPuDiagnostics().speed')-0.05)<1e-9
  p.locator('#speed').select_option('0.1');assert abs(p.evaluate('KaoPuDiagnostics().speed')-0.1)<1e-9
  p.locator('#speed').select_option('1');assert abs(p.evaluate('KaoPuDiagnostics().speed')-1.0)<1e-9
  p.locator('#backBtn').click();p.wait_for_function('KaoPuDiagnostics().homeVisible')
  before=p.evaluate('KaoPuDiagnostics().renderCount');p.locator('[data-scene="cave"]').click();wait_render(p,'cave',before,timeout=720000)
  assert p.locator('#speed').input_value()=='0.25',p.locator('#speed').input_value()
  p.locator('#speed').select_option('0.01');assert p.locator('#speed').input_value()=='0.01'
  p.locator('#speed').select_option('0.05');assert p.locator('#speed').input_value()=='0.05'
  p.locator('#speed').select_option('0.1');assert p.locator('#speed').input_value()=='0.1'
  p.locator('#speed').select_option('0.35');assert p.locator('#speed').input_value()=='0.35'
  p.locator('#backBtn').click();p.wait_for_function('KaoPuDiagnostics().homeVisible')
  report['tests'].append({'desktop_speed_options':opts,'underwater_default':'0.5','cave_default':'0.25','runtime_speed_selection':'passed'})
  # Mobile viewport: speed selector remains reachable below canvas, no overflow.
  m=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
  m.goto(BASE+'?ui=R17',wait_until='load',timeout=120000)
  assert m.evaluate('KaoPuDiagnostics().homeVisible') and m.locator('[data-scene]').count()==7
  before=m.evaluate('KaoPuDiagnostics().renderCount');m.locator('[data-scene="underwater"]').click();wait_render(m,'underwater',before)
  assert m.locator('#speed').is_visible()
  assert m.locator('#liveCanvas').bounding_box()['y'] < m.locator('#speed').bounding_box()['y']
  assert m.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  m.locator('#speed').select_option('0.02');assert m.locator('#speed').input_value()=='0.02'
  report['tests'].append({'mobile_viewport':[390,844],'dpr':2,'real_phone':False,'home_first':True,'speed_selector':'passed'})
  m.close();p.close();browser.close()
 report['passed']=True
except Exception as e:
 report['errors'].append(str(e));report['traceback']=traceback.format_exc();print(traceback.format_exc(),flush=True)
finally:
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('R16_3_SPEED_QA',json.dumps(report,ensure_ascii=False),flush=True)
if not report['passed']:raise SystemExit(1)
