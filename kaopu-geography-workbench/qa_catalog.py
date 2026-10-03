"""KAOPU R16.2 responsive-shell verification. Scene shaders are Gram-anchored and must not regress."""
import os,time,json,hashlib,urllib.request,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('KAOPU_PUBLIC_URL','https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/')
OUT=Path('geography-qa/responsive-r16-2');OUT.mkdir(parents=True,exist_ok=True)
FROZEN={
'settings.js':'0ba24c343cefbb20eba8dd5d6d86e1d288e88253',
'post.js':'048305b127bfb6770e3df2541cd4bbaf398c9645',
'crater.js':'1316fd4c4b56f941cab0e90aaa4f39730bd87111',
'underwater.js':'1f97a36952ebfd04969e2c7d2f61e68a1c4198a5',
'cave.js':'811e69b450d63f0ffea627f9da2322a9b78e6606',
'canyon.js':'d9e12711c4186356b34f9e458f029b771b837622',
'style.css':'7f48293ed2ce65cea1fded7bea1997ac692a8aae',
'caveBake.js':'c88a4dd81a7ca7bf5325080900d52f6847d7223d',
'more.js':'53316a56059e122246d293b6c1b6d94aff91db8f',
'snow.js':'6b5fe324549596c52b47bda1f5d53a723b569fed'}
EXPECTED_INDEX='2db85004db80b083c06962960558bcc0a481616a'
EXPECTED_RUNTIME='c98bf2ba62a77a7c602356d26ee15fa6b9a4f85f'
EXPECTED_DETAIL_CSS='321f9e1b75ae0b700162913c16abb161912208ed'
report={'ui_version':'R16.2','scene_anchor':'R16/R16.1','public_url':BASE,'physical_phone_tested':False,'tests':[],'errors':[],'passed':False}
def get(name=''):
 with urllib.request.urlopen(urllib.request.Request(BASE+name+'?r162='+str(time.time()),headers={'Cache-Control':'no-cache'}),timeout=30) as r:
  assert r.status==200
  return r.read()
def blob_sha(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def wait_ready(p,scene='underwater',count=-1,timeout=180000):
 p.wait_for_function('(a)=>window.KaoPuDiagnostics&&KaoPuDiagnostics().scene===a.scene&&KaoPuDiagnostics().renderReady&&KaoPuDiagnostics().renderCount>a.count',arg={'scene':scene,'count':count},timeout=timeout)
 assert not p.locator('#notice.error').is_visible(),p.locator('#notice').inner_text()
try:
 for _ in range(72):
  try:
   html=get()
   if blob_sha(html)==EXPECTED_INDEX:break
  except Exception as e:print('waiting for R16.2 Pages',e,flush=True)
  time.sleep(10)
 else:raise RuntimeError('Exact R16.2 index did not reach public hosting')
 assert blob_sha(get('runtime.js'))==EXPECTED_RUNTIME
 assert blob_sha(get('detail-r16-2.css'))==EXPECTED_DETAIL_CSS
 for name,sha in FROZEN.items():
  actual=blob_sha(get(name));assert actual==sha,('Gram anchor changed',name,actual,sha)
 report['frozen_scene_files']=FROZEN
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
  # Desktop: established desktop arrangement remains controls-before-canvas and 16:9.
  p=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
  errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(BASE+'?ui=R16.2',wait_until='load',timeout=120000);wait_ready(p)
  assert p.locator('#home').get_attribute('data-ui-version')=='R16.2'
  canvas=p.locator('#liveCanvas').bounding_box();controls=p.locator('#detail>.controls').first.bounding_box()
  assert controls['y'] < canvas['y'],(controls,canvas)
  assert abs(canvas['width']/canvas['height']-16/9)<.03,canvas
  assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  p.screenshot(path=str(OUT/'detail_desktop_1440.png'),full_page=True)
  report['tests'].append({'mode':'desktop','viewport':[1440,1000],'canvas':canvas,'controls':controls,'aspect':canvas['width']/canvas['height']})
  p.locator('#backBtn').click();p.wait_for_function('KaoPuDiagnostics().homeVisible');assert p.locator('[data-scene]').count()==6
  p.screenshot(path=str(OUT/'home_desktop_1440.png'),full_page=True);p.close()
  # Mobile portrait: canvas is promoted above controls and rendered 4:3 for more usable visual area.
  m=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
  merr=[];m.on('pageerror',lambda e:merr.append(str(e)))
  m.goto(BASE+'?ui=R16.2',wait_until='load',timeout=120000);wait_ready(m)
  canvas=m.locator('#liveCanvas').bounding_box();controls=m.locator('#detail>.controls').first.bounding_box();nav=m.locator('.nav').bounding_box()
  assert canvas['y'] < controls['y'],(canvas,controls)
  assert canvas['width'] >= 388,canvas
  assert abs(canvas['width']/canvas['height']-4/3)<.03,canvas
  assert nav['height'] <= 54,nav
  assert m.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
  assert not merr,merr
  m.screenshot(path=str(OUT/'detail_mobile_390_dpr2.png'),full_page=True)
  report['tests'].append({'mode':'mobile_portrait_viewport','viewport':[390,844],'dpr':2,'real_phone':False,'canvas':canvas,'controls':controls,'nav':nav,'aspect':canvas['width']/canvas['height']})
  # Exercise controls after canvas and return.
  before=m.evaluate('KaoPuDiagnostics().renderCount');m.locator('#quality').select_option('720');wait_ready(m,'underwater',before)
  r=m.locator('#renderState').inner_text();assert '720×540' in r,r
  m.locator('#backBtn').click();m.wait_for_function('KaoPuDiagnostics().homeVisible');assert m.locator('[data-scene]').count()==6
  m.screenshot(path=str(OUT/'home_mobile_390_dpr2.png'),full_page=True)
  # Re-enter canyon and return: responsive shell must not break scene navigation.
  before=m.evaluate('KaoPuDiagnostics().renderCount');m.locator('[data-scene="canyon"]').click();wait_ready(m,'canyon',before);assert m.locator('#liveCanvas').bounding_box()['width']>=388
  m.locator('#backBtn').click();m.wait_for_function('KaoPuDiagnostics().homeVisible')
  m.close();browser.close()
  report['passed']=True
except Exception as e:
 report['errors'].append(str(e));report['traceback']=traceback.format_exc();print(traceback.format_exc(),flush=True)
finally:
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('R16_2_RESPONSIVE_QA',json.dumps(report,ensure_ascii=False),flush=True)
if not report['passed']:raise SystemExit(1)
