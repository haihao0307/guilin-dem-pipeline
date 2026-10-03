"""R16.1 catalog-only checks against the actual public page. No renderer substitution."""
import os,time,json,hashlib,urllib.request,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('KAOPU_PUBLIC_URL','https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/')
OUT=Path('geography-qa/catalog-r16-1');OUT.mkdir(parents=True,exist_ok=True)
EXPECTED={'settings.js':'0ba24c343cefbb20eba8dd5d6d86e1d288e88253','post.js':'048305b127bfb6770e3df2541cd4bbaf398c9645','crater.js':'1316fd4c4b56f941cab0e90aaa4f39730bd87111','underwater.js':'1f97a36952ebfd04969e2c7d2f61e68a1c4198a5','cave.js':'811e69b450d63f0ffea627f9da2322a9b78e6606','canyon.js':'d9e12711c4186356b34f9e458f029b771b837622','runtime.js':'4563dd3bd7ceaba97ce42de8960d075382793ca6','style.css':'7f48293ed2ce65cea1fded7bea1997ac692a8aae','caveBake.js':'c88a4dd81a7ca7bf5325080900d52f6847d7223d','more.js':'53316a56059e122246d293b6c1b6d94aff91db8f','snow.js':'6b5fe324549596c52b47bda1f5d53a723b569fed'}
report={'ui_version':'R16.1','scene_version':'R16','public_url':BASE,'physical_phone_tested':False,'tests':[],'errors':[],'passed':False}
def get(name=''):
 with urllib.request.urlopen(urllib.request.Request(BASE+name+'?catalog='+str(time.time()),headers={'Cache-Control':'no-cache'}),timeout=30) as response:
  assert response.status==200
  return response.read()
def blob_sha(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
try:
 for attempt in range(72):
  try:
   html=get()
   if blob_sha(html)=='275e9cb0cd1ef2f8078b7f349ff5ce625a37bc55':break
  except Exception as e:print('Waiting for exact public UI:',e,flush=True)
  time.sleep(10)
 else:raise RuntimeError('Exact R16.1 index did not reach public hosting')
 for name,sha in EXPECTED.items():assert blob_sha(get(name))==sha,('Unexpected scene file change',name)
 tail=html.decode().split('<section hidden id="detail">',1)[1]
 assert hashlib.sha256(('<section hidden id="detail">'+tail).encode()).hexdigest()=='0c49e758d8821973359e1aa839d9e3ce1956b58f9c490f2c82486c539f52fab3'
 report['unchanged_original_files']=EXPECTED;report['detail_markup_and_scripts_unchanged']=True
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
  for width,height,dpr in [(1470,1024,1),(1440,1000,2),(390,844,2),(360,800,2)]:
   p=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=dpr,is_mobile=width<500,has_touch=width<500)
   errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
   p.goto(BASE+'?ui=R16.1',wait_until='load',timeout=120000)
   p.wait_for_function('window.KaoPuDiagnostics&&KaoPuDiagnostics().renderReady&&KaoPuDiagnostics().renderCount>0',timeout=120000)
   assert p.locator('#home').get_attribute('data-ui-version')=='R16.1'
   p.locator('#backBtn').click();p.wait_for_function('KaoPuDiagnostics().homeVisible')
   p.locator('#home .thumb').evaluate_all('(xs)=>Promise.all(xs.map(x=>x.decode()))')
   previews=p.locator('#home .thumb').evaluate_all('(xs)=>xs.map(x=>({path:x.getAttribute("src"),naturalWidth:x.naturalWidth,naturalHeight:x.naturalHeight,width:x.width,height:x.height,density:x.naturalWidth/x.width}))')
   assert len(previews)==6 and all(x['naturalWidth']==384 and x['naturalHeight']==240 and x['width']<=148 and x['density']>=2.5 for x in previews),previews
   assert p.locator('[data-scene]').count()==6
   assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
   if width>1000:
    a=p.locator('[data-scene="crater"]').bounding_box();b=p.locator('[data-scene="underwater"]').bounding_box();assert abs(a['y']-b['y'])<1
   p.screenshot(path=str(OUT/f'home_{width}_dpr{dpr}.png'),full_page=True,timeout=120000)
   for key in ['crater','underwater']:
    count=p.evaluate('KaoPuDiagnostics().renderCount');p.locator('[data-scene="'+key+'"]').click()
    p.wait_for_function('(v)=>KaoPuDiagnostics().scene===v.key&&KaoPuDiagnostics().renderReady&&KaoPuDiagnostics().renderCount>v.count',arg={'key':key,'count':count},timeout=120000)
    p.locator('#backBtn').click();p.wait_for_function('KaoPuDiagnostics().homeVisible')
   assert not errors,errors
   report['tests'].append({'viewport':[width,height],'device_pixel_ratio':dpr,'real_phone':False,'previews':previews,'original_and_underwater_navigation':'passed','runtime_errors':errors})
   p.close()
  browser.close()
 report['passed']=True
except Exception as e:
 report['errors'].append(str(e));report['traceback']=traceback.format_exc();print(traceback.format_exc(),flush=True)
finally:
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('CATALOG_QA',json.dumps(report,ensure_ascii=False),flush=True)
if not report['passed']:raise SystemExit(1)
