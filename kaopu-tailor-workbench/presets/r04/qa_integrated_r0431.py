"""Real browser, original Python pattern engine, real native solver; no simulated DOM."""
from pathlib import Path
import os,json,time,traceback,hashlib
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent
BASE=os.environ.get('R043_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r04/')
PUB=BASE.startswith('https:');OUT=P/('qa-r0431-public' if PUB else 'qa-r0431');OUT.mkdir(exist_ok=True)
R={'public':PUB,'url':BASE,'sourceCommit':os.environ.get('GITHUB_SHA'),'checks':[],'pageErrors':[],'httpErrors':[],'all60GarmentsAccepted':False,'mobileScope':'Chromium 390x844 viewport, not a physical phone'}
def check(n,ok,d=None):
 R['checks'].append({'name':n,'passed':bool(ok),'detail':d});print('CHECK',n,bool(ok),flush=True)
def state(p):return p.evaluate('__R04.state()')
def wait_result(p):
 end=time.monotonic()+420
 while time.monotonic()<end:
  s=state(p)
  if s['phase'] in ['done','failed','checkpoint']:return s
  if s['phase']=='paused':p.locator('#resume').click()
  p.wait_for_timeout(500)
 raise TimeoutError('Native solve exceeded test budget; not accepted.')
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  p=b.new_page(viewport={'width':1440,'height':1080});p.set_default_timeout(300000)
  p.on('pageerror',lambda e:R['pageErrors'].append(str(e)))
  p.on('response',lambda r:R['httpErrors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  p.goto(BASE+'?preset=S02',wait_until='domcontentloaded');p.wait_for_function('window.__R04?.state().ready',timeout=300000)
  original=state(p)['person'];lock=json.loads((P/'assets/identity.json').read_text())['person']
  check('original common person and exact collider identity',original==lock)
  check('runtime really contains the submitted R04.3.1 patch',state(p).get('release')=='R04.3.1')
  check('all source designs and pairing identities remain',state(p)['sourcePresets']==60 and len(p.evaluate('__R04.outfits()'))==432)
  for id in ['S02','P01','S06','S08','S09','S11','S12','T06','J06']:
   p.evaluate('id=>__R04.select(id)',id);s=state(p)
   check('actual source geometry or explicit diagnostic '+id,s['clothVertices']>0 and s['renderCoordinateErrorM']==0 and s['clothIndexMatchesNative'],{'phase':s['phase'],'staticPassed':bool(s.get('staticGate',{} ) and s['staticGate']['passed'])})
   p.evaluate('__R04.view("three")');p.locator('#stage').screenshot(path=str(OUT/(id+'.png')))
  p.evaluate('__R04.select("T01")');p.evaluate('__R04.setParameters({"shirt.width":1.2},3,0)')
  check('changing ease invalidates the old paper/garment claim',state(p)['parameterPending'])
  p.evaluate('__R04.generateParameters()');s=state(p)
  request=s.get('binding',{}).get('parameterRequestSHA256');material=s.get('binding',{}).get('materialSHA256')
  check('original generator produces a new request-bound material',s['phase']=='paper' and bool(request) and not s['parameterPending'])
  p.locator('#sew').click();p.wait_for_function('__R04.state().phase==="solving"')
  check('solver locks size and ease widgets',p.locator('#garment-ease').is_disabled() and p.locator('#waist-ease').is_disabled() and p.locator('[data-ease="6"]').is_disabled())
  check('direct API cannot change request during native solve',p.evaluate('async()=>{try{await __R04.setParameters({"shirt.width":1.3},6,0);return false}catch{return true}}'))
  p.locator('#pause').click();p.wait_for_function('__R04.state().phase==="paused"');check('pause retains input lock',p.locator('#garment-ease').is_disabled());p.locator('#resume').click();s=wait_result(p)
  check('real new variant returns its own unchanged native arrays',s['phase']=='done' and s['binding']['parameterRequestSHA256']==request and s['binding']['materialSHA256']==material and s['renderCoordinateErrorM']==0 and s['clothIndexMatchesNative'],{'phase':s['phase'],'gate':s['staticGate']})
  check('completed solve unlocks parameter controls',not p.locator('#garment-ease').is_disabled())
  R['variantState']=s
  img=p.locator('.card[data-id="T01"] img').get_attribute('src')
  check('variant card comes from its actual new render, not frozen base PNG',img.startswith('data:image/png;'))
  p.locator('#stage').screenshot(path=str(OUT/'T01-variant.png'))
  p.evaluate('__R04.select("T02")');p.evaluate('__R04.select("T01")');s=state(p)
  check('reselecting variant restores exact applied request',s['binding']['parameterRequestSHA256']==request and s['parameterEditor']['changedParameters']=={'shirt.width':1.2} and s['parameterEditor']['easeCm']==3 and not s['parameterPending'])
  p.evaluate('__R04.setCollection("outfits")');p.evaluate('__R04.select("T01-P01")');s=state(p);packets=p.evaluate('__R04.packets()')
  check('outfit uses the edited top plus genuine original bottom',s['phase']=='outfit' and packets[0]['binding']['parameterRequestSHA256']==request and packets[1]['binding']['presetId']=='P01' and s['renderCoordinateErrorM']==0)
  check('outfit edited member prevents stale default outfit thumbnail',p.locator('.card[data-id="T01-P01"] img').get_attribute('src').startswith('data:image/png;'))
  p.wait_for_function('Array.from(document.querySelectorAll(".card")).every(c=>c.querySelector("img")?.src.startsWith("data:image/png;"))',timeout=120000)
  check('all visible edited outfit cards regenerate automatically',p.locator('.card img').count()==24)
  check('automatic preview queue does not change selection or native geometry',state(p)['selectedId']=='T01-P01' and state(p)['renderCoordinateErrorM']==0 and state(p)['clothIndexMatchesNative'])
  p.screenshot(path=str(OUT/'outfit-variant.png'))
  p.evaluate('__R04.setCollection("single")');p.evaluate('__R04.select("T01")');p.locator('#read-paper').click();p.wait_for_function('__R04.state().phase==="paper"');s=state(p)
  check('restore original resets editor and request together',not s['binding'].get('parameterRequestSHA256') and s['parameterEditor']['changedParameters']=={} and s['parameterEditor']['easeCm']==0 and not s['parameterPending'])
  p.locator('#cancel').click();check('cancel clears stale material and unlocks fields',state(p)['clothVertices']==0 and not p.locator('#garment-ease').is_disabled())
  p.evaluate('__R04.select("T01")');before=state(p)
  check('nonfinite input is rejected before generation',p.evaluate('async()=>{try{await __R04.setParameters({"shirt.width":NaN},0,0);return false}catch{return true}}'))
  p.evaluate('Promise.all([__R04.select("T07"),__R04.select("T04")])');check('late read cannot overwrite latest selection',state(p)['selectedId']=='T04' and state(p)['binding']['presetId']=='T04')
  p.evaluate('__R04.select("T01-P01")');other=p.locator('#person option').nth(19).get_attribute('value');p.evaluate('id=>__R04.changePerson(id)',other)
  check('other person never receives the old collider or outfit',not state(p)['supportedPerson'] and state(p)['clothVertices']==0)
  p.evaluate('__R04.changePerson("default")');p.evaluate('__R04.select("S02")');p.evaluate('__R04.view("three")');p.screenshot(path=str(OUT/'desktop.png'))
  p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(200);p.screenshot(path=str(OUT/'mobile.png'))
  check('mobile viewport has no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check('single original viewer canvas',p.locator('canvas').count()==1)
  check('no failed page or HTTP resources',not R['pageErrors'] and not R['httpErrors'],{'pages':R['pageErrors'],'http':R['httpErrors']})
  R['finalState']=state(p);b.close()
 R['passed']=all(c['passed'] for c in R['checks'])
except Exception as e:R['passed']=False;R['exception']=str(e);R['traceback']=traceback.format_exc();print(R['traceback'],flush=True)
finally:(P/('R0431_PUBLIC_BROWSER_REPORT.json' if PUB else 'R0431_BROWSER_REPORT.json')).write_text(json.dumps(R,ensure_ascii=False,indent=2))
if not R['passed']:raise SystemExit(1)
