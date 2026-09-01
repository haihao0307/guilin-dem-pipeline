"""Actual Chromium checks, without mocked requests or substituted renderers."""
from pathlib import Path
import argparse,json,traceback
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium');a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
report={'url':a.url,'passed':False,'tests':[],'cases':[],'visualApproved':False,'productionApproved':False}
def write(): (a.out/'browser-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
def check(name,condition,detail=None):
 report['tests'].append({'name':name,'passed':bool(condition),'detail':detail});write()
 if not condition:raise AssertionError(name+': '+repr(detail))
def wait(page,js,timeout=90000):page.wait_for_function(js,timeout=timeout)
def terrain(page):return page.locator('#terrain').element_handle().content_frame()
def weather(page):return page.locator('#weather').element_handle().content_frame()
def native_ready(page,case):
 wait(page,f"window.__WZ_WORKBENCH__?.lastFrame?.identity.weather==={json.dumps(case)} && window.__WZ_WORKBENCH__?.bridgeStatus==='receiving'",150000)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=a.chromium or pw.chromium.executable_path,headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 report['browserVersion']=b.version
 try:
  for kind,w,h,mobile in [('desktop',1500,900,False),('mobile',390,844,True)]:
   ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=mobile,has_touch=mobile);page=ctx.new_page();page.set_default_timeout(30000)
   case={'name':kind,'viewport':[w,h],'consoleErrors':[],'pageErrors':[],'failedRequests':[],'badResponses':[],'imageRequests':[],'passed':False};report['cases'].append(case)
   page.on('console',lambda m:case['consoleErrors'].append(m.text) if m.type=='error' else None)
   page.on('pageerror',lambda e:case['pageErrors'].append(str(e)))
   page.on('requestfailed',lambda r:case['failedRequests'].append({'url':r.url,'error':r.failure}))
   page.on('response',lambda r:case['badResponses'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
   page.on('request',lambda r:case['imageRequests'].append(r.url) if r.resource_type=='image' and not r.url.startswith('data:') else None)
   try:
    print('OPEN',kind,a.url,flush=True);r=page.goto(a.url,wait_until='domcontentloaded',timeout=90000);check(kind+' HTTP entry',r.status==200)
    wait(page,"window.__WZ_WORKBENCH__?.ready || window.__WZ_WORKBENCH__?.errors.length",180000)
    q=page.evaluate('window.__WZ_WORKBENCH__');check(kind+' actual workbench ready',q['ready'],q.get('errors'))
    native_ready(page,'coast');t=terrain(page);wpage=weather(page)
    case['initial']=page.evaluate('window.__WZ_WORKBENCH__');check(kind+' complete domain',t.evaluate('window.__WZ_FULL__.overviewGrid.join()')=='276,281')
    check(kind+' source file identity',q['checks']['files']==12 and q['sourceIdentityVerified'])
    check(kind+' twenty cases ten genera',q['weatherCases']==20 and q['cloudGenera']==10)
    wait(page,"window.__WZ_WORKBENCH__.terrain?.weather.active===true")
    check(kind+' real shader linked',t.evaluate('window.__WZ_FULL__.shaderLinked'))
    page.screenshot(path=str(a.out/f'{kind}-workbench.png'))
    page.locator('#pause').click();page.wait_for_timeout(1500)
    t0=wpage.evaluate('WeatherMother.qa.simulationTimeS');page.wait_for_timeout(500);t1=wpage.evaluate('WeatherMother.qa.simulationTimeS');check(kind+' pause',t0==t1,[t0,t1])
    source_hash=t.evaluate('window.__WZ_API__.sourceHash()');case['sourceHashBefore']=source_hash
    if not mobile:
     t.locator('#gl').screenshot(path=str(a.out/'map-water-on.png'))
     t.evaluate("document.querySelector('#waterOn').checked=false")
     t.wait_for_function('window.__WZ_FULL__.renderedWater===false')
     t.locator('#gl').screenshot(path=str(a.out/'map-water-off.png'))
     aa=np.asarray(Image.open(a.out/'map-water-on.png').convert('RGB')).astype('int16');bb=np.asarray(Image.open(a.out/'map-water-off.png').convert('RGB')).astype('int16')
     count=int((np.max(np.abs(aa-bb),axis=2)>12).sum());check('actual sea pixels visible',count>2000,count)
     t.evaluate("document.querySelector('#waterOn').checked=true")
     t.wait_for_function('window.__WZ_FULL__.renderedWater===true')
     page.evaluate("WenzhouWorkbench.bridge.control('direction',270);WenzhouWorkbench.bridge.control('wind',18);WenzhouWorkbench.bridge.control('cloudSpeed',4)")
     wait(page,"Math.abs(window.__WZ_WORKBENCH__?.lastFrame?.wind.speedMps-18)<.03 && Math.abs(window.__WZ_WORKBENCH__?.lastFrame?.wind.fromDegrees-270)<.1")
     f=page.evaluate('window.__WZ_WORKBENCH__.lastFrame');check('actual wind vs cloud independence',abs(f['cloud']['speedMps']-4)<.03 and abs(f['wind']['velocityMps'][0]-18)<.05,f['wind'])
     wave_a=t.evaluate('window.__WZ_API__.getWindWaveAt(321.5,871.25)')
     page.evaluate("WenzhouWorkbench.bridge.control('direction',90)")
     wait(page,"Math.abs(window.__WZ_WORKBENCH__?.lastFrame?.wind.fromDegrees-90)<.1")
     wave_b=t.evaluate('window.__WZ_API__.getWindWaveAt(321.5,871.25)');check('real target wave consumes direction',abs(wave_a-wave_b)>1e-4,[wave_a,wave_b])
     for mode in ['neutral','studio','diagnostic']:
      page.evaluate(f"WenzhouWorkbench.terrain().setMode('{mode}')")
      t.wait_for_function(f"window.__WZ_FULL__.mode==='{mode}' && window.__WZ_FULL__.renderedMode==={['neutral','studio','diagnostic'].index(mode)}")
      page.screenshot(path=str(a.out/f'{kind}-{mode}.png'))
      check('source invariant '+mode,t.evaluate('window.__WZ_API__.sourceHash()')==source_hash)
     neutral=t.evaluate('window.__WZ_API__.getWindWaveAt(321.5,871.25)')
     page.evaluate("WenzhouWorkbench.bridge.control('wind',27)")
     wait(page,"Math.abs(window.__WZ_WORKBENCH__?.lastFrame?.wind.speedMps-27)<.03")
     check('diagnostic mode ignores environment wave',t.evaluate('window.__WZ_API__.getWindWaveAt(321.5,871.25)')==neutral)
     page.evaluate("WenzhouWorkbench.terrain().setMode('environment')")
     page.locator('#couple').uncheck();wait(page,"window.__WZ_WORKBENCH__.terrain?.weather.connected===false");check('disconnect target',not t.evaluate('window.__WZ_FULL__.weather.connected'))
     page.locator('#couple').check();wait(page,"window.__WZ_WORKBENCH__.terrain?.weather.active===true")
     for name in ['rain','iridescent','typhoon']:
      page.locator('#case').select_option(name);native_ready(page,name);case[name]=page.evaluate('window.__WZ_WORKBENCH__.lastFrame')
      check('actual native case '+name,case[name]['identity']['weather']==name)
     before=wpage.evaluate('WeatherMother.getState().eyeRadius')
     page.evaluate("WenzhouWorkbench.bridge.control('eyeRadius',3.1)")
     wait(page,"Math.abs(document.querySelector('#weather').contentWindow.WeatherMother.getState().eyeRadius-3.1)<.01 && document.querySelector('#weather').contentWindow.getComputedStyle(document.querySelector('#weather').contentWindow.document.getElementById('loading')).display==='none'",150000)
     check('cyclone shape native input event',abs(wpage.evaluate('WeatherMother.getState().eyeRadius')-3.1)<.01,before)
     page.screenshot(path=str(a.out/'desktop-typhoon.png'))
     page.locator('#case').select_option('coast');native_ready(page,'coast')
    page.locator('[data-layout="map-only"]').click();page.wait_for_timeout(500)
    if mobile:t.locator('#menu').click()
    t.locator('#ground').click();t.wait_for_function('window.__WZ_FULL__.ground && window.__WZ_FULL__.clearance>=1.6 && window.__WZ_FULL__.clearance<2')
    ground=t.evaluate('window.__WZ_FULL__');check(kind+' displayed-surface camera clearance',ground['clearance']>=1.6,ground['clearance'])
    check(kind+' no truth mutation',t.evaluate('window.__WZ_API__.sourceHash()')==source_hash)
    t.locator('#home').click()
    if mobile:t.locator('#menu').click()
    page.screenshot(path=str(a.out/f'{kind}-full-map.png'))
    page.locator('[data-layout="weather-only"]').click();page.wait_for_timeout(600);page.screenshot(path=str(a.out/f'{kind}-weather.png'))
    page.locator('#inspect').click();check(kind+' live receipt dialog',page.locator('#receipt').is_visible());page.locator('#close').click()
    case['final']=page.evaluate('window.__WZ_WORKBENCH__')
    for key in ['consoleErrors','pageErrors','failedRequests','badResponses','imageRequests']:check(kind+' '+key,len(case[key])==0,case[key])
    check(kind+' approvals false',not case['final']['visualApproved'] and not case['final']['productionApproved']);case['passed']=True;write();print('PASS',kind,flush=True)
   except Exception as e:
    case['error']=str(e);case['traceback']=traceback.format_exc()
    try:case['state']=page.evaluate('window.__WZ_WORKBENCH__');page.screenshot(path=str(a.out/f'{kind}-failure.png'))
    except Exception as e2:case['captureError']=str(e2)
    write();raise
   finally:ctx.close()
  report['passed']=True
 except Exception as e:report['error']=str(e);print(traceback.format_exc(),flush=True)
 finally:b.close();write()
print(json.dumps({'passed':report['passed'],'checks':len(report['tests'])},indent=2));raise SystemExit(0 if report['passed'] else 1)
