"""New P06 solve through the actual browser UI, independent of frozen images."""
from pathlib import Path
import os,json,time,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;BASE=os.environ.get('R043_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r04/');PUB=BASE.startswith('https:');OUT=P/('qa-r0432-public' if PUB else 'qa-r0432');OUT.mkdir(exist_ok=True)
R={'public':PUB,'url':BASE,'sourceCommit':os.environ.get('GITHUB_SHA'),'checks':[],'errors':[],'httpErrors':[],'passed':False,'all60GarmentsAccepted':False}
def check(n,b,d=None):R['checks'].append({'name':n,'passed':bool(b),'detail':d});print('CHECK',n,bool(b),flush=True)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']);p=browser.new_page(viewport={'width':1440,'height':1080});p.set_default_timeout(300000)
  p.on('pageerror',lambda e:R['errors'].append(str(e)));p.on('response',lambda r:R['httpErrors'].append({'url':r.url,'status':r.status})if r.status>=400 else None)
  p.goto(BASE+'?preset=P06',wait_until='domcontentloaded');p.wait_for_function('window.__R04?.state().ready',timeout=300000)
  old=p.evaluate('__R04.packets()[0]');s=p.evaluate('__R04.state()');check('R04.3.2 original identity and all results',s['release']=='R04.3.2' and s['actualResultCount']==60 and s['baselineStaticPassCount']==22)
  check('stored P06 genuinely passes unchanged static gate',s['staticGate']['passed'])
  p.locator('#read-paper').click();p.wait_for_function('__R04.state().phase==="paper"');p.locator('#sew').click();start=time.monotonic();end=start+600
  while time.monotonic()<end:
   s=p.evaluate('__R04.state()')
   if s['phase']in['done','failed','checkpoint']:break
   if s['phase']=='paused':p.locator('#resume').click()
   p.wait_for_timeout(500)
  R['freshSeconds']=time.monotonic()-start;fresh=p.evaluate('__R04.packets()[0]');R['freshState']=s
  check('fresh P06 has original material and solver arrays',s['phase']=='done' and s['renderCoordinateErrorM']==0 and s['clothIndexMatchesNative'])
  check('fresh P06 passes full unchanged static gate',bool(s.get('staticGate')and s['staticGate']['passed']))
  a=fresh.get('record',{}).get('positionsMm',[]);b=old['record']['positionsMm'];err=max((abs(x-y)for u,v in zip(a,b)for x,y in zip(u,v)),default=float('inf'))
  check('stored and fresh P06 follow identical reviewed numerical route',len(a)==len(b)and err<1e-7,{'maximumDifferenceMm':err})
  check('correction has actual source-seam provenance',fresh.get('record',{}).get('r043',{}).get('constructionSideClearance',{}).get('changedBoundaryRows',0)>0)
  for view in['three','side','rear']:
   p.evaluate('v=>__R04.view(v)',view);p.locator('#stage').screenshot(path=str(OUT/('fresh-P06-'+view+'.png')))
  for id in['S02','T08','T01-P01','T04-S03']:
   p.evaluate('id=>__R04.select(id)',id);p.evaluate('__R04.view("three")');p.locator('#stage').screenshot(path=str(OUT/(id+'.png')))
  p.evaluate('__R04.setCollection("outfits")');p.evaluate('__R04.select("T01-P01")');p.screenshot(path=str(OUT/'outfits-desktop.png'))
  p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(200);p.screenshot(path=str(OUT/'outfits-mobile.png'));check('mobile viewport no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check('no page or HTTP errors',not R['errors']and not R['httpErrors']);browser.close()
 R['passed']=all(x['passed']for x in R['checks'])
except Exception as e:R['exception']=str(e);R['traceback']=traceback.format_exc();print(R['traceback'],flush=True)
finally:(P/('R0432_PUBLIC_FRESH_REPORT.json'if PUB else'R0432_FRESH_REPORT.json')).write_text(json.dumps(R,ensure_ascii=False,indent=2))
if not R['passed']:raise SystemExit(1)
