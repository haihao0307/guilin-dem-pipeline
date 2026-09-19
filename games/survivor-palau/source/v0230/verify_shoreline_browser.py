"""Real Chromium check for Stone Money Island v0.2.3.0 shoreline R01.
Screenshots are QA evidence only, not physical-device or user visual acceptance.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json,shutil,sys,threading,traceback
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
EVIDENCE=Path('/tmp/smi-shoreline-v0230');EVIDENCE.mkdir(parents=True,exist_ok=True)
REPORT=EVIDENCE/'BROWSER_QA.json'
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/releases/v0.2.3.0/index.html?qa=1'
report={'version':'0.2.3.0','profileId':'SMI_WAKE_BAY_R01','url':url,'browserPassed':False,'physicalDeviceTest':False,'visualAcceptance':False,'cases':[]}

def save():REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
def main():
  with sync_playwright() as pw:
    executable=shutil.which('google-chrome') or shutil.which('google-chrome-stable') or shutil.which('chromium')
    opts={'headless':True,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
    if executable:opts['executable_path']=executable
    browser=pw.chromium.launch(**opts);report['browserVersion']=browser.version
    for name,width,height in [('desktop',1280,720),('mobile',390,844)]:
      mobile=name=='mobile';ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
      page=ctx.new_page();page.set_default_timeout(30000)
      case={'name':name,'viewport':[width,height],'passed':False,'pageErrors':[],'consoleErrors':[],'failedRequests':[]};report['cases'].append(case)
      page.on('pageerror',lambda e,c=case:c['pageErrors'].append(str(e)))
      page.on('console',lambda m,c=case:c['consoleErrors'].append(m.text) if m.type=='error' else None)
      page.on('requestfailed',lambda r,c=case:c['failedRequests'].append(r.url))
      try:
        response=page.goto(url,wait_until='domcontentloaded',timeout=60000);assert response and response.status==200
        page.wait_for_function('window.OceanIsland?.qa.ready && window.StoneMoneySurvival && window.StoneMoneyShoreline',timeout=120000)
        assert page.evaluate('StoneMoneySurvival.version')=='0.2.3.0'
        assert page.evaluate('OceanIsland.qa.authoritativeShorelineProfileV1===true')
        assert page.evaluate('OceanIsland.qa.shorelineRenderContactShared===true')
        assert page.evaluate('OceanIsland.qa.shorelineGpuOceanBathymetryCoupled===false')
        assert not page.locator('#error').inner_text().strip()
        (page.locator('#smiStart').tap() if mobile else page.locator('#smiStart').click())
        page.wait_for_function('StoneMoneySurvival.getMode()==="playing"')
        measurements=page.evaluate("""() => {
          const th=.76, q=(r)=>StoneMoneyShoreline.shoreAt(Math.cos(th)*r,Math.sin(th)*r);
          let lo=10,hi=60;for(let i=0;i<60;i++){const m=(lo+hi)/2;if(q(m).signedDistance<0)lo=m;else hi=m;}
          const boundary=(lo+hi)/2, q0=q(boundary), ds=StoneMoneyShoreline.waterlineSignedDistance(q0.waterLevel);
          const r=boundary+ds,x=Math.cos(th)*r,z=Math.sin(th)*r,shore=StoneMoneyShoreline.shoreAt(x,z),ground=StoneMoneySurvival.ground(x,z);
          const dryR=boundary-5,dx=Math.cos(th)*dryR,dz=Math.sin(th)*dryR;
          StoneMoneySurvival.test.position(dx,dz,th+Math.PI/2,-.14);StoneMoneySurvival.cameraFrame(innerWidth/innerHeight);
          return {boundaryRadius:boundary,waterlineSignedDistance:ds,waterLevel:shore.waterLevel,directBed:shore.elevation,renderContactBed:ground,contactGap:Math.abs(shore.waterLevel-ground),profileWeight:shore.profileWeight,materialClass:shore.materialClass};
        }""")
        case['measurements']=measurements
        assert measurements['profileWeight']>.999
        assert measurements['contactGap']<=.05,measurements
        page.evaluate("Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('review timeout')),30000))])")
        shot=EVIDENCE/f'{name}-shoreline.png';page.screenshot(path=str(shot),full_page=True)
        case['screenshot']=shot.name
        assert shot.stat().st_size>10000
        assert not case['pageErrors'] and not case['consoleErrors'] and not case['failedRequests']
        case['passed']=True
      except Exception as e:
        case['failure']=str(e);case['trace']=traceback.format_exc()
        try:page.screenshot(path=str(EVIDENCE/f'{name}-failure.png'),full_page=True)
        except Exception:pass
      finally:
        save();ctx.close()
      if not case['passed']:break
    browser.close()
  report['browserPassed']=len(report['cases'])==2 and all(c['passed'] for c in report['cases']);save()
try:main()
except Exception as e:report['failure']=str(e);report['trace']=traceback.format_exc();save()
finally:server.shutdown()
print(json.dumps({'browserPassed':report['browserPassed'],'cases':report['cases']},ensure_ascii=False))
sys.exit(0 if report['browserPassed'] else 1)
