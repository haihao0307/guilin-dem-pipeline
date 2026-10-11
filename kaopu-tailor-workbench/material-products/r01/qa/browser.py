from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageStat,ImageChops
import json,os,time,hashlib,subprocess,traceback
P=Path(__file__).resolve().parent.parent
BASE=os.environ.get('MP01_BASE','http://127.0.0.1:8768/');PUBLIC=BASE.startswith('https:');GEN=os.environ.get('MP01_GENERATE')=='1'
OUT=P/'qa'/('public' if PUBLIC else 'candidate');OUT.mkdir(exist_ok=True)
R={'url':BASE,'public':PUBLIC,'networkMocked':False,'sourceCommit':os.environ.get('GITHUB_SHA'),'checks':[],'looks':[],'pageErrors':[],'shaderErrors':[],'passed':False,'physicalWearAccepted':False}
def check(name,value,detail=None):
 R['checks'].append({'name':name,'passed':bool(value),'detail':detail});print(name,bool(value),flush=True)
def inspect(a):return a['ready'] and len(a['rows'])==2 and all(r['maxCoordinateErrorM']==0 and r['indexUnchanged'] and r['uvErrorM']==0 and r['sourceStaticPassed'] and r['textureSize']==2048 for r in a['rows']) and a['bodyVisible'] and a['bodyVertexCount']==25417 and a['glError']==0
def wait_boot(page):
 start=time.monotonic()
 while time.monotonic()-start<180:
  status=page.locator('#status').inner_text()
  if R['pageErrors'] or status.startswith('工作台初始化未完成') or status.startswith('载入 K02 失败'):
   R['initialStatus']=status;page.screenshot(path=str(OUT/'boot-failure.png'))
   raise AssertionError({'status':status,'pageErrors':R['pageErrors']})
  if page.evaluate('!!window.__MP01__ && __MP01__.audit().rows.length===2 && !__MP01__.audit().pending'):return
  page.wait_for_timeout(500)
 R['initialStatus']=page.locator('#status').inner_text();page.screenshot(path=str(OUT/'boot-timeout.png'))
 raise AssertionError('Initial display exceeded bounded wait: '+R['initialStatus'])
server=None
try:
 if not PUBLIC:server=subprocess.Popen(['python','-m','http.server','8768','--directory',str(P)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  c=b.new_context(viewport={'width':1440,'height':1040},device_scale_factor=1);page=c.new_page();page.set_default_timeout(300000)
  page.on('pageerror',lambda e:R['pageErrors'].append(str(e)))
  page.on('console',lambda e:R['shaderErrors'].append(e.text) if e.type=='error' and ('Shader' in e.text or 'VALIDATE_STATUS' in e.text) else None)
  page.goto(BASE+'?look=K02',wait_until='domcontentloaded');wait_boot(page)
  check('actual original human and first material outfit render',inspect(page.evaluate('__MP01__.audit()')))
  looks=page.evaluate('__MP01__.looks()')
  for look in looks:
   assert page.evaluate('id=>__MP01__.select(id)',look['id']);a=page.evaluate('__MP01__.audit()');row={'id':look['id'],'passed':inspect(a),'materials':[r['material'] for r in a['rows']],'geometry':a['rows']};R['looks'].append(row)
   check(look['id']+' exact original two garments + metric UV + both real maps',row['passed'],{'materials':row['materials'],'vertexCounts':[r['vertices'] for r in a['rows']]})
   for v in ['front','rear','side','three']:
    page.evaluate('v=>__MP01__.frame("whole",v)',v);page.wait_for_timeout(70)
    if v in ['front','side']:page.locator('#stage').screenshot(path=str(OUT/(look['id']+'-'+v+'.png')))
   if GEN:
    (P/'thumbs').mkdir(exist_ok=True);page.locator('#stage').evaluate("e=>{e.dataset.old=e.getAttribute('style')||'';e.style.width='320px';e.style.height='400px';e.style.minHeight='0';}");page.wait_for_timeout(100);page.evaluate('__MP01__.frame("whole","three")');page.locator('#stage').screenshot(path=str(P/'thumbs'/(look['id']+'.png')));page.locator('#stage').evaluate("e=>e.setAttribute('style',e.dataset.old)");page.wait_for_timeout(100)
   if look['id'] in ['K02','K03','L01','L03','L04','D01','D02','D03']:
    for role in ['top','bottom']:
     page.evaluate('r=>__MP01__.macro(r)',role);page.locator('#stage').screenshot(path=str(OUT/(look['id']+'-'+role+'-detail.png')))
  assert page.evaluate('__MP01__.select("K02")');page.evaluate('__MP01__.frame("top","front")');page.locator('#stage').screenshot(path=str(OUT/'material-on.png'));page.locator('#compare').click();page.locator('#stage').screenshot(path=str(OUT/'material-off.png'));check('beige comparison retains exact geometry',inspect(page.evaluate('__MP01__.audit()')) and page.evaluate('__MP01__.audit().comparison'));page.locator('#compare').click()
  diff=ImageChops.difference(Image.open(OUT/'material-on.png').convert('RGB'),Image.open(OUT/'material-off.png').convert('RGB'));check('source materials cause a visible real pixel change',max(ImageStat.Stat(diff).mean)>1)
  page.locator('#top-material').select_option('leather-patent');page.wait_for_function('__MP01__.audit().selected.topMaterial==="leather-patent"&&!__MP01__.audit().pending');check('independent top material switch',inspect(page.evaluate('__MP01__.audit()')))
  page.locator('#bottom-material').select_option('knit-reverse-3');page.wait_for_function('__MP01__.audit().selected.bottomMaterial==="knit-reverse-3"&&!__MP01__.audit().pending');check('independent bottom material switch',inspect(page.evaluate('__MP01__.audit()')))
  page.evaluate('async()=>{await Promise.all([__MP01__.select("D01"),__MP01__.select("L01"),__MP01__.select("K02")]);}');a=page.evaluate('__MP01__.audit()');check('rapid selection newest result wins',inspect(a) and a['selected']['id']=='K02' and not a['pending'])
  check('bounded material cache',a['materialCacheCount']<=4,a['materialCacheCount'])
  before=page.evaluate('__MP01__.audit()');oldurl=page.url;result=page.evaluate('__MP01__.select("D01",{topMaterial:"unregistered-material"})');after=page.evaluate('__MP01__.audit()');check('unregistered material cannot replace a valid displayed look',result is False and before['selected']==after['selected'] and inspect(after) and page.url==oldurl)
  assert page.evaluate('__MP01__.select("K02")')
  for group in ['knit','leather','denim','all']:
   page.locator('[data-filter='+group+']').click();check('product gallery filter '+group,page.locator('.look-card').count()==(12 if group=='all' else 4))
  if PUBLIC or not GEN:
   decoded=page.evaluate('async()=>{const ids=__MP01__.looks().map(l=>l.id);return Promise.all(ids.map(async id=>{const i=new Image();i.src="thumbs/"+id+".png";await i.decode();return {id,w:i.naturalWidth,h:i.naturalHeight};}));}')
   check('all twelve current look previews decode at full portrait aspect',len(decoded)==12 and all(r['w']==320 and r['h']==400 for r in decoded))
  page.evaluate('__MP01__.frame("whole","three")');page.screenshot(path=str(OUT/'desktop.png'))
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(250);page.evaluate('__MP01__.frame("whole","three")');check('390x844 viewport no horizontal page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));check('mobile viewport still exact native material result',inspect(page.evaluate('__MP01__.audit()')));page.screenshot(path=str(OUT/'mobile.png'));R['mobileScope']='390x844 Chromium viewport, not a physical phone'
  check('no unhandled page or shader errors',not R['pageErrors'] and not R['shaderErrors'],{'page':R['pageErrors'],'shader':R['shaderErrors']});b.close()
 R['passed']=all(r['passed'] for r in R['checks'])
except Exception as e:R.update(exception=str(e),traceback=traceback.format_exc());print(R['traceback'],flush=True)
finally:
 if server:server.terminate()
 (P/('PUBLIC_REPORT.json' if PUBLIC else 'CANDIDATE_REPORT.json')).write_text(json.dumps(R,ensure_ascii=False,indent=2))
if not R['passed']:raise SystemExit(1)
