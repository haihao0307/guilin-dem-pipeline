"""Exact local or public N02 browser execution. --public-url must be an actual deployed entry."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import argparse,json,os,hashlib,time,urllib.request
R=Path(__file__).resolve().parents[1];(R/'qa').mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--public-url');args=a.parse_args()
report={'version':'OLM-N02-20260919','publicUrl':args.public_url,'http':[],'viewports':[],'shareAllowed':False,'scope':'headed Chromium software WebGL2, desktop/mobile-size layout, not real phone or biological validation'}
if args.public_url:
 for name in ['index.html','src/life-core.js','src/viewer.js']:
  url=args.public_url.rsplit('/',1)[0]+'/'+name
  with urllib.request.urlopen(url,timeout=45) as response:
   data=response.read();assert response.status==200;status=response.status
  expected=(R/name).read_bytes();assert hashlib.sha256(data).digest()==hashlib.sha256(expected).digest(), name+' remote mismatch'
  report['http'].append({'url':url,'status':status,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
else:
 html=(R/'index.html').read_text()
 for name in ['life-core.js','viewer.js']:html=html.replace('<script src="src/'+name+'"></script>','<script>'+(R/'src'/name).read_text()+'</script>')
with sync_playwright() as p:
 kw={'headless':False,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
 if Path('/usr/bin/chromium').exists():kw['executable_path']='/usr/bin/chromium'
 b=p.chromium.launch(**kw)
 for W,H in [(1280,900),(390,844)]:
  page=b.new_page(viewport={'width':W,'height':H},has_touch=W<750,device_scale_factor=1);errors=[];failed=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda req:failed.append({'url':req.url,'error':req.failure}))
  if args.public_url:
   response=page.goto(args.public_url,wait_until='load',timeout=90000);assert response.status==200
  else:page.set_content(html,wait_until='load')
  page.wait_for_function('!!window.OceanLifeN02',timeout=90000);page.wait_for_function('OceanLifeN02.state().frames>1',timeout=90000)
  page.evaluate('OceanLifeN02.freeze()');states=[];page.screenshot(path=str(R/f'qa/scene-{W}.png'))
  for i in range(8):
   page.evaluate('(i)=>OceanLifeN02.select(i)',i);page.wait_for_timeout(150)
   s=page.evaluate('OceanLifeN02.state()');assert s['webglError']==0;states.append(s)
   if i in [1,4,7]:page.screenshot(path=str(R/f'qa/fish-{i}-{W}.png'))
  if W<750:page.click('#toggle')
  page.select_option('#palette',value='3');assert page.evaluate('OceanLifeN02.state().palette')==3;page.select_option('#palette',value='-1')
  if W<750:page.click('#toggle')
  for i in range(3):
   page.evaluate('(i)=>OceanLifeN02.setCoral(i)',i);page.wait_for_timeout(150);s=page.evaluate('OceanLifeN02.state()');assert s['webglError']==0;states.append(s);page.screenshot(path=str(R/f'qa/coral-{i}-{W}.png'))
  page.evaluate("OceanLifeN02.setMode('scene');OceanLifeN02.approach();OceanLifeN02.advance(4);OceanLifeN02.leave();OceanLifeN02.advance(120);")
  behavioral=page.evaluate('OceanLifeN02.state()');assert behavioral['metrics']['flees']>0 and behavioral['metrics']['returns']>0 and behavioral['metrics']['invalid']==0
  before=behavioral['time'];page.wait_for_timeout(200);assert page.evaluate('OceanLifeN02.state().time')==before
  page.evaluate("document.querySelector('#count').value='40';document.querySelector('#count').dispatchEvent(new Event('change'));");assert page.evaluate('OceanLifeN02.state().count')==40
  if W<750:
   page.click('#toggle');assert page.locator('#panel').is_visible();page.locator('[data-recipe="1"]').tap();assert page.evaluate('OceanLifeN02.state().selected')==1;assert not page.locator('#panel').is_visible()
  page.evaluate("OceanLifeN02.select(1)");page.mouse.move(W*.6,H*.4);page.mouse.down();page.mouse.move(W*.65,H*.43);page.mouse.up();page.mouse.wheel(0,-90);page.wait_for_timeout(200)
  legacy='not-tested-locally'
  if args.public_url:
   page.click('#legacyBtn');frame=page.frame_locator('#legacy iframe');frame.locator('canvas').wait_for(timeout=90000);awaited=page.frames[-1];awaited.wait_for_function("Boolean(window.__OCEAN_LIFE_QA__)",timeout=90000);legacy='canvas-and-QA-started';page.click('#closeLegacy')
  page.screenshot(path=str(R/f'qa/final-{W}.png'));overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth');assert not overflow;assert not errors;assert not failed
  report['viewports'].append({'size':[W,H],'errors':errors,'failedRequests':failed,'states':states,'behavioral':behavioral,'overflow':overflow,'legacy':legacy,'pass':True});page.close()
 b.close()
report['browserPassed']=True;report['shareAllowed']=bool(args.public_url and len(report['http'])==3);(R/'qa/PUBLICATION_PROOF.json'if args.public_url else R/'qa/BROWSER.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('N02_BROWSER_RECEIPT '+json.dumps(report,ensure_ascii=False))
