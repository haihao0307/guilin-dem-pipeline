"""Unmodified original vs integrated renderer at identical camera/time; UI only hidden for comparison."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from PIL import Image,ImageChops,ImageStat
import threading,json,hashlib,traceback
ROOT=Path(__file__).resolve().parents[2];OUT=Path('/tmp/stone-money-reference');OUT.mkdir(exist_ok=True)
server=ThreadingHTTPServer(('127.0.0.1',8766),partial(SimpleHTTPRequestHandler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
entry=ROOT/'releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html'
r={'candidateSha256':hashlib.sha256(entry.read_bytes()).hexdigest(),'originalSha256':'3498800d4bb287eadf448f01fb8fa8cf1b1f07eb3eab57f1428d824a62b55fd1','passed':False,'cases':[],'visualAcceptance':False}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'],headless=True)
  for name,uri in [('original','source/v0160/frozen/original-deep-v001.html?still'),('integrated','releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html?reference')]:
   ctx=browser.new_context(viewport={'width':960,'height':540},device_scale_factor=1);page=ctx.new_page();errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
   page.goto('http://127.0.0.1:8766/'+uri,wait_until='domcontentloaded')
   page.add_style_tag(content='body > :not(canvas):not(main):not(script):not(style){visibility:hidden!important}')
   if name=='original':
    page.wait_for_function('OceanMother.qa.ready && !OceanMother.getReadiness().baking',timeout=130000);page.wait_for_timeout(500)
    state=page.evaluate('({qa:OceanMother.qa,config:OceanMother.getConfiguration(),samples:[[0,0],[10,50],[-40,90],[300,-230]].map(p=>OceanMother.sampleHeight(p[0],p[1]+8000))})')
   else:
    page.wait_for_function('window.OceanIsland?.qa.ready',timeout=130000)
    page.evaluate("Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('reference GPU timeout')),30000))])")
    state=page.evaluate('({qa:StoneMoneyFrozenOcean.qa,config:StoneMoneyFrozenOcean.getOriginalConfiguration(),samples:[[0,0],[10,50],[-40,90],[300,-230]].map(p=>StoneMoneyFrozenOcean.sampleHeight(p[0],p[1],0))})')
   assert page.locator('canvas').is_visible(),'Live canvas unexpectedly hidden by test harness'
   page.screenshot(path=str(OUT/(name+'.png')),timeout=20000);r['cases'].append({'name':name,'state':state,'pageErrors':errs});ctx.close()
  browser.close()
 a=Image.open(OUT/'original.png').convert('RGB');b=Image.open(OUT/'integrated.png').convert('RGB');d=ImageChops.difference(a,b);d.save(OUT/'pixel-difference.png')
 r['normalizedPixelMAE']=sum(ImageStat.Stat(d).mean)/3/255;r['maxSampleHeightError']=max(abs(x-y) for x,y in zip(r['cases'][0]['state']['samples'],r['cases'][1]['state']['samples']))
 r['passed']=r['normalizedPixelMAE']<.01 and r['maxSampleHeightError']<1e-9 and not any(c['pageErrors'] for c in r['cases'])
except Exception as e:r['failure']=str(e);r['trace']=traceback.format_exc()
finally:
 server.shutdown();(OUT/'ORIGINAL_REFERENCE_QA.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items() if k!='cases'},ensure_ascii=False),flush=True)
