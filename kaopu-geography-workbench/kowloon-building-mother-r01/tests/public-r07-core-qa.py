"""Public R07 hash closure and actual browser core smoke, no request routing."""
import ast,concurrent.futures,hashlib,json,time,traceback
from pathlib import Path
from urllib.request import Request,urlopen
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
cfg=json.loads((root/'unified-perf-config.json').read_text())
entry='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/kowloon-building-mother-r01/building-complete-floor-r07-20261023/'
url=entry+'viewer/'
out=Path('public-inspection-evidence');out.mkdir(exist_ok=True)
r={'passed':False,'scope':'Actual published R07 resource hashes, entry, native1366 three-building/photos/floor/stair core smoke. Full ride and all-frame equivalence are separately frozen QA evidence, not rerun here.','variants':{'candidate':{'frames':{}}},'checks':[],'errors':[]}
module=ast.parse((root/'unified-perf-qa.py').read_text())
selected=[n for n in module.body if isinstance(n,ast.FunctionDef) or isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='CAPTURE' for t in n.targets)]
exec(compile(ast.Module(body=selected,type_ignores=[]),'frozen-qa-functions','exec'),globals())
def fetch(url):
 with urlopen(Request(url,headers={'User-Agent':'Building-R07-Public-Verification'}),timeout=60) as q:return q.read()
def verify(item):
 rel,spec=item;raw=fetch(url+rel);actual=hashlib.sha256(raw).hexdigest();assert actual==spec['sha256'],('Public byte mismatch',rel);return {'path':rel,'sha256':actual,'bytes':len(raw)}
page=None;browser=None
try:
 raw=fetch(entry);text=raw.decode();assert all(s in text for s in ['卡顿仍未解决','内部设计非实测','仓库电梯未绑定','北窗内部分格缺失','href="viewer/"'])
 r['entrySha256']=hashlib.sha256(raw).hexdigest();assert r['entrySha256']==cfg['publicEntrySha256'],'Wrong public entry bytes'
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:r['publicFiles']=list(pool.map(verify,cfg['variants']['candidate']['files'].items()))
 assert len(r['publicFiles'])==111;save()
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  r['browserVersion']=browser.version;context=browser.new_context(viewport={'width':1366,'height':768},device_scale_factor=1);page=context.new_page();page.set_default_timeout(180000)
  page.add_init_script("window.addEventListener('error',e=>window.__qaError=e.message);window.addEventListener('unhandledrejection',e=>window.__qaError=String(e.reason));")
  errors=[];failed=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda req:failed.append({'url':req.url,'failure':req.failure}))
  page.goto(entry,wait_until='domcontentloaded');assert page.locator('#enterInspection').count()==1;page.screenshot(path=str(out/'public-r07-entry.png'));page.locator('#enterInspection').click();page.wait_for_url(url);stable(page)
  whole=capture(page,'candidate','public-whole',whole=True);layout_live(page,'public1366-dpr1');click_source(page,whole);photo_checks(page)
  page.locator('[data-building=lowrise]').click();panel=page.locator('#completeFloorPanel');floor=panel.locator("xpath=./label[normalize-space(text())='楼层实例']/select");assert floor.count()==1;floor.select_option('L02');stable(page);capture_native(page,'public-floor-L02');panel.locator('[data-floor-bookmark=stair]').click();stable(page);q=capture_native(page,'public-stair-L02');assert q['hitObjectPixels'].get('1022514',0)>0
  page.locator('[data-building=warehouse]').click();guard=panel.evaluate("p=>[...p.querySelectorAll('button,select,input')].every(e=>e.disabled&&!e.checkVisibility({checkVisibilityCSS:true}))");assert guard
  page.locator('[data-building=kcc]').click();assert page.locator('[data-lift-panel=building-owned] [data-lift-car-floor]').count()==28
  assert not errors and not failed,{'errors':errors,'requests':failed};r['errors']=errors;r['requestFailures']=failed;r['passed']=True;save();browser.close();browser=None
except Exception:r['errors'].append(traceback.format_exc())
finally:
 save()
 if browser:browser.close()
if not r['passed']:print(json.dumps(r['errors']));raise SystemExit(1)
print('Published R07 entry, exact111 resource closure and actual native core smoke passed.',flush=True)
