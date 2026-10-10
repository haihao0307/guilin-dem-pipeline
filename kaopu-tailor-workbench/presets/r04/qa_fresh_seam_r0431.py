from pathlib import Path
import os,json,gzip,time,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;BASE=os.environ.get('R043_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r04/');PUB=BASE.startswith('https:');OUT=P/('qa-r0431-public' if PUB else 'qa-r0431');OUT.mkdir(exist_ok=True)
report={'public':PUB,'url':BASE,'checks':[],'errors':[],'http':[],'passed':False,'all60GarmentsAccepted':False}
def check(n,b,d=None):report['checks'].append({'name':n,'passed':bool(b),'detail':d});print('CHECK',n,bool(b),flush=True)
try:
 with sync_playwright()as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']);p=b.new_page(viewport={'width':1440,'height':1080});p.set_default_timeout(300000)
  p.on('pageerror',lambda e:report['errors'].append(str(e)));p.on('response',lambda r:report['http'].append(r.url) if r.status>=400 else None)
  p.goto(BASE+'?preset=P01',wait_until='domcontentloaded');p.wait_for_function('window.__R04?.state().ready',timeout=300000)
  start=p.evaluate('__R04.state()');saved=p.evaluate('__R04.packets()[0]');check('cached P01 native seam result passes unchanged static gate',start['staticGate']['passed'])
  p.locator('#read-paper').click();p.wait_for_function('__R04.state().phase==="paper"');p.locator('#sew').click();p.wait_for_function('__R04.state().phase==="solving"');t=time.monotonic()
  end=t+600
  while time.monotonic()<end:
   s=p.evaluate('__R04.state()')
   if s['phase'] in ['done','failed','checkpoint']:break
   if s['phase']=='paused':p.locator('#resume').click()
   p.wait_for_timeout(500)
  fresh=p.evaluate('__R04.packets()[0]');report['elapsedSeconds']=time.monotonic()-t;report['freshState']=s
  check('fresh browser P01 returns its own complete source result',s['phase']=='done' and s['renderCoordinateErrorM']==0 and s['clothIndexMatchesNative'])
  check('fresh P01 passes the original complete static gate',bool(s.get('staticGate')and s['staticGate']['passed']))
  a=fresh.get('record',{}).get('positionsMm',[]);z=saved['record']['positionsMm'];error=max((abs(x-y)for u,v in zip(a,z)for x,y in zip(u,v)),default=float('inf'))
  check('browser and stored P01 use the same native numerical route',len(a)==len(z) and error<1e-7,{'maxDifferenceMm':error})
  check('fresh result contains explicit material seam constraint provenance',bool(fresh.get('record',{}).get('r043',{}).get('continuousSeamSpans',{}).get('distanceRows')))
  for view in ['three','side','rear']:
   p.evaluate('v=>__R04.view(v)',view);p.locator('#stage').screenshot(path=str(OUT/('fresh-P01-'+view+'.png')))
  check('no browser or failed HTTP resources',not report['errors']and not report['http']);b.close()
 report['passed']=all(r['passed']for r in report['checks'])
except Exception as e:report['exception']=str(e);report['traceback']=traceback.format_exc();print(report['traceback'],flush=True)
finally:(P/('R0431_PUBLIC_FRESH_SEAM.json' if PUB else 'R0431_FRESH_SEAM.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2))
if not report['passed']:raise SystemExit(1)
