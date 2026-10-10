"""Actual HTTPS UI -> original paper -> original worker -> new native solve.
Checks pause/resume/cancel and display-only toggles, not just cached playback.
"""
from pathlib import Path
import gzip,hashlib,json,os,time,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;D=P/'qa-public-controls';D.mkdir(exist_ok=True)
LOCK=json.loads((P/'assets/identity.json').read_text())
BASE='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r041-8e98936acb85/'
ALIAS='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r04/'
R={'public':True,'fixedURL':BASE,'aliasURL':ALIAS,'sourceCommit':os.environ.get('GITHUB_SHA'),'checks':[],'errors':[],'httpErrors':[],'passed':False,'all60GarmentsAccepted':False,'physicalFitAccepted':False}
def check(name,value,detail=None):
 R['checks'].append({'name':name,'passed':bool(value),'detail':detail});print('PUBLIC_CONTROL',name,bool(value),flush=True)
def state(p):return p.evaluate('__R04.state()')
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  p=b.new_page(viewport={'width':1440,'height':1080})
  p.on('pageerror',lambda e:R['errors'].append(str(e)));p.on('response',lambda r:R['httpErrors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  p.goto(BASE+'?preset=T01',wait_until='domcontentloaded',timeout=120000);p.wait_for_function('window.__R04?.state().ready',timeout=300000)
  before=state(p);check('Fixed snapshot opens the exact original person',before['person']==LOCK['person'] and before['phase']=='done')
  cached=p.evaluate('__R04.packet()')
  p.locator('#read-paper').click();p.wait_for_function('__R04.state().phase==="paper"||__R04.state().phase==="failed"',timeout=60000)
  material=state(p);check('UI reads and remeshes the actual source paper',material['phase']=='paper' and material['staticGate'] is None and material['binding']['materialSHA256']==cached['binding']['materialSHA256'])
  assert material['phase']=='paper'
  start=time.perf_counter();p.locator('#sew').click();p.wait_for_function('__R04.state().workerEvents.includes("started")',timeout=60000)
  p.locator('#pause').click();p.wait_for_function('__R04.state().phase==="paused"',timeout=60000)
  image1=p.evaluate('__R04.canvasPNG()');p.wait_for_timeout(400);image2=p.evaluate('__R04.canvasPNG()')
  check('Original running solver really pauses',state(p)['phase']=='paused' and image1==image2)
  p.locator('#resume').click();p.wait_for_function('["done","failed"].includes(__R04.state().phase)',timeout=150000)
  result=state(p);R['freshSolveElapsedSeconds']=time.perf_counter()-start;R['freshState']=result
  check('Fresh public T01 solve reaches original static gate',result['phase']=='done' and result['staticGate']['passed'],result.get('error'))
  check('Fresh public result retains exact original geometry ordering',result['renderCoordinateErrorM']==0 and result['clothIndexMatchesNative'] and result['person']==LOCK['person'])
  packet=p.evaluate('__R04.packet()');assert packet
  raw=gzip.compress(json.dumps(packet,separators=(',',':')).encode(),mtime=0);(D/'T01-fresh-native-result.json.gz').write_bytes(raw)
  delta=max(abs(a-b) for x,y in zip(packet['record']['positionsMm'],cached['record']['positionsMm']) for a,b in zip(x,y))
  check('New solve agrees with the previous original input/result',packet['binding']==cached['binding'] and delta<.000001,{'maximumPositionDifferenceMm':delta})
  p.locator('#stage').screenshot(path=str(D/'fresh-T01.png'))
  beforeBytes=json.dumps(packet,sort_keys=True);plain=p.evaluate('__R04.canvasPNG()')
  p.locator('#panel-colors').click();colored=p.evaluate('__R04.canvasPNG()')
  check('Panel-color control changes only appearance',plain!=colored and p.locator('#panel-colors').get_attribute('aria-pressed')=='true' and json.dumps(p.evaluate('__R04.packet()'),sort_keys=True)==beforeBytes)
  p.locator('#panel-colors').click();p.locator('#wire').check();wire=p.evaluate('__R04.canvasPNG()');check('Original material wireframe is a real display control',wire!=plain and state(p)['renderCoordinateErrorM']==0);p.locator('#wire').uncheck()
  p.locator('[data-view=rear]').click();p.locator('#stage').screenshot(path=str(D/'fresh-T01-back.png'))
  p.evaluate('__R04.select("T03")');p.locator('#read-paper').click();p.wait_for_function('__R04.state().phase==="paper"',timeout=60000)
  started=state(p)['workerEvents'].count('started');p.locator('#sew').click();p.wait_for_function('n=>__R04.state().workerEvents.filter(x=>x==="started").length>n',arg=started,timeout=60000)
  p.locator('#cancel').click();p.wait_for_timeout(400);c=state(p);check('Cancelling actual work clears stale cloth and result',c['phase']=='idle' and c['clothVertices']==0 and c['staticGate'] is None)
  p.goto(ALIAS+'?preset=T01',wait_until='domcontentloaded',timeout=120000);p.wait_for_function('window.__R04?.state().ready',timeout=300000);a=state(p)
  check('Latest public entrance also opens the exact original system',a['person']==LOCK['person'] and a['selectedId']=='T01' and a['phase']=='done' and a['actualResultCount']==37)
  p.screenshot(path=str(D/'public-latest-desktop.png'));check('No public UI/worker HTTP or page errors',not R['errors'] and not R['httpErrors'])
  b.close()
 R['passed']=all(c['passed'] for c in R['checks'])
except Exception as e:R['exception']=str(e);R['traceback']=traceback.format_exc();print(R['traceback'],flush=True)
(P/'PUBLIC_LIVE_CONTROLS_REPORT.json').write_text(json.dumps(R,ensure_ascii=False,indent=2))
print('PUBLIC_LIVE_CONTROLS',R['passed'],flush=True)
if not R['passed']:raise SystemExit(1)
