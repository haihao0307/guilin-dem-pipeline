"""Fresh T08 native solve through published UI; not a screenshot/cache substitute."""
from pathlib import Path
import json,os,time,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;BASE=os.environ['R0433_BASE'];OUT=P/'qa-r0433-fresh-public';OUT.mkdir(exist_ok=True)
R={'public':BASE.startswith('https:'),'url':BASE,'checks':[],'errors':[],'httpErrors':[],'passed':False,'allGarmentsAccepted':False}
def check(n,b,d=None):R['checks'].append({'name':n,'passed':bool(b),'detail':d});print(n,bool(b),flush=True)
try:
 assert R['public']
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  p=b.new_page(viewport={'width':1440,'height':1080});p.set_default_timeout(300000)
  p.on('pageerror',lambda e:R['errors'].append(str(e)));p.on('response',lambda r:R['httpErrors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  p.goto(BASE+'?preset=T08',wait_until='domcontentloaded');p.wait_for_function('window.__R04?.state().ready',timeout=300000)
  s=p.evaluate('__R04.state()');old=p.evaluate('__R04.packet()')
  check('published reviewed R0433 and all original styles available',s['release']=='R04.3.3' and s['actualResultCount']==60 and s['baselineStaticPassCount']==22)
  p.locator('#read-paper').click();p.wait_for_function('__R04.state().phase==="paper"');check('actual original material initialized',p.evaluate('__R04.materialPacket().binding.paperSHA256')==old['binding']['paperSHA256'])
  p.locator('#sew').click();start=time.monotonic()
  while time.monotonic()-start<900:
   s=p.evaluate('__R04.state()')
   if s['phase'] in ['done','failed','checkpoint']:break
   if s['phase']=='paused':p.locator('#resume').click()
   p.wait_for_timeout(500)
  R['freshSeconds']=time.monotonic()-start;fresh=p.evaluate('__R04.packet()');R['state']=s
  check('fresh T08 uses real solver coordinates and original topology',s['phase']=='done' and s['renderCoordinateErrorM']==0 and s['clothIndexMatchesNative'])
  check('unchanged static thresholds still pass',bool(fresh and fresh['record']['staticGate']['passed'] and fresh['record']['staticGate']['thresholds']==old['record']['staticGate']['thresholds']))
  a=fresh['record']['positionsMm'];c=old['record']['positionsMm'];error=max(abs(x-y)for u,v in zip(a,c)for x,y in zip(u,v));check('browser and stored native recomputation agree',len(a)==len(c) and error<1e-5,{'maximumDifferenceMm':error})
  check('original person and source paper identity unchanged',fresh['binding']['person']==old['binding']['person'] and fresh['binding']['paperSHA256']==old['binding']['paperSHA256'])
  p.evaluate('__R04.focus("garment")')
  for view in ['three','rear','side']:
   p.evaluate('v=>__R04.view(v)',view);p.locator('#stage').screenshot(path=str(OUT/('T08-'+view+'.png')))
  p.evaluate('__R04.select("T08-S06")');s=p.evaluate('__R04.state()');check('fresh top remains usable in an original outfit',s['phase']=='outfit' and s['display']['garmentMeshes']==2 and s['renderCoordinateErrorM']==0)
  check('no public page or HTTP errors',not R['errors'] and not R['httpErrors']);b.close()
 R['passed']=all(c['passed'] for c in R['checks'])
except Exception as e:R.update(exception=str(e),traceback=traceback.format_exc());print(R['traceback'],flush=True)
finally:(P/'R0433_FRESH_PUBLIC_REPORT.json').write_text(json.dumps(R,ensure_ascii=False,indent=2))
if not R['passed']:raise SystemExit(1)
