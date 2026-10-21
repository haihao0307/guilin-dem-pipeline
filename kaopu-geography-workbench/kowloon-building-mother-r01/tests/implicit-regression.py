"""Actual immutable R03/R04/R05 browser regression, separate from R06 zero-model-buffer audit."""
import argparse,hashlib,json,pathlib,urllib.request
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--base-url',required=True);p.add_argument('--output',required=True);a=p.parse_args();base=a.base_url.rstrip('/')+'/';out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True);root=pathlib.Path(__file__).resolve().parents[1];report={'baseUrl':base,'oldFileHashes':{},'versions':{},'screenshots':[]}
files=[root/'index.html',root/'r04.html',root/'r05.html',*(root/'r03').glob('*.mjs'),*(root/'r04').glob('*.mjs'),*(root/'r05').glob('*.mjs'),*(root/'r03').glob('*.css'),*(root/'r04').glob('*.css'),*(root/'r05').glob('*.css')]
for path in files:
 name=path.relative_to(root).as_posix();body=urllib.request.urlopen(base+name,timeout=60).read();assert body==path.read_bytes(),name;report['oldFileHashes'][name]=hashlib.sha256(body).hexdigest()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for version,url in [('r03',''),('r04','r04.html'),('r05','r05.html')]:
  page=browser.new_page(viewport={'width':1280,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+url,wait_until='networkidle');page.wait_for_function('window.__BUILDING_MOTHER__?.ready');state=page.evaluate('window.__BUILDING_MOTHER__.snapshot()');assert not errors and not state.get('errors');report['versions'][version]={'metaBuild':page.locator('meta[name="kaopu-build"]').get_attribute('content'),'renderer':state['renderer'],'errors':errors};assert state['renderer']['triangles']>0
  if version=='r05':page.locator('#interiorFocus').click()
  page.screenshot(path=str(out/(version+'-unchanged.png')));report['screenshots'].append(version+'-unchanged.png');page.close()
 browser.close()
report['status']='passed';(out/'results.json').write_text(json.dumps(report,indent=2));print(json.dumps({'status':'passed','oldFiles':len(files),'versions':list(report['versions'])}))
