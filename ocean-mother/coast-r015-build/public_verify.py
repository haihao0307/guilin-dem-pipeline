"""Read published bytes back and exercise the real public URL."""
import hashlib,json,shutil,time,urllib.request,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path('evidence');url='https://haihao0307.github.io/guilin-dem-pipeline/ocean-mother/coast-glass-r015/'
manifest=json.loads((root/'SOURCE.json').read_text());checks={};http={}
for attempt in range(30):
    try:
        data=urllib.request.urlopen(urllib.request.Request(url+'?verify='+str(time.time_ns()),headers={'Cache-Control':'no-cache'}),timeout=20).read()
        if hashlib.sha256(data).hexdigest()==manifest['index.html']['sha256']:break
    except Exception:pass
    time.sleep(6)
else:raise SystemExit('Published entry did not match verified candidate; do not deliver URL')
for name,meta in manifest.items():
    with urllib.request.urlopen(urllib.request.Request(url+name+'?verify='+str(time.time_ns()),headers={'Cache-Control':'no-cache'}),timeout=30) as response:
        data=response.read();mime=response.headers.get('Content-Type','')
        http[name]={'httpStatus':response.status,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'contentType':mime}
        assert http[name]['httpStatus']==200 and len(data)==meta['bytes'] and http[name]['sha256']==meta['sha256'],name
checks['allPublicFilesExact']=True
report={'url':url,'http':http,'checks':checks,'errors':[],'failedRequests':[],'mobileSafariHardwareTested':False,'visualApproved':False}
def save(): (root/'PUBLIC_VERIFY.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
try:
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path=shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        page=b.new_page(viewport={'width':1440,'height':900})
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
        page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
        page.goto(url,wait_until='load');page.wait_for_function('window.OceanCoast?.qa.frames>=4',timeout=60000)
        checks['correctVersion']=page.evaluate('OceanCoast.qa.version')=='0.2.5-coast-r015'
        checks['correctBuild']=page.locator('#build').inner_text()=='coast-r015-daylight-glass'
        checks['clockAdvancing']=page.evaluate('OceanCoast.qa.physicalTime')>0
        page.screenshot(path=str(root/'public-overview.png'))
        page.click('#panelToggle');page.wait_for_timeout(450);page.screenshot(path=str(root/'public-glass.png'));checks['glassControlsVisible']=page.locator('#panel').is_visible()
        page.click('#panelToggle')
        page.evaluate('OceanCoast.setView("shore")');n=page.evaluate('OceanCoast.qa.frames');page.wait_for_function('(n)=>OceanCoast.qa.frames>n+2',arg=n,timeout=60000)
        page.screenshot(path=str(root/'public-shore.png'))
        checks['noGlErrors']=not page.evaluate('OceanCoast.qa.glErrors||[]') and page.evaluate('OceanCoast.qa.glError')==0
        report['publicState']=page.evaluate('OceanCoast.getState()')
        t=page.evaluate('OceanCoast.getState().physicalTime');page.click('#deepTab');page.wait_for_timeout(4000)
        frame=page.frame_locator('#deepFrame')
        checks['deepCanvasVisible']=frame.locator('canvas').first.is_visible()
        page.screenshot(path=str(root/'public-deep.png'))
        page.click('#coastTab');page.wait_for_function('(t)=>OceanCoast.getState().physicalTime>t',arg=t,timeout=30000)
        checks['returnToCoastPreservesState']=page.evaluate('OceanCoast.getState().physicalTime')>=t
        mobile=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
        mobile.on('pageerror',lambda e:report['errors'].append('mobile: '+str(e)))
        mobile.goto(url,wait_until='load');mobile.wait_for_function('window.OceanCoast?.qa.frames>=4',timeout=60000)
        mobile.screenshot(path=str(root/'public-mobile.png'))
        mobile.click('#panelToggle');mobile.wait_for_timeout(400);mobile.screenshot(path=str(root/'public-mobile-glass.png'))
        checks['mobileControlsVisible']=mobile.locator('#panel').is_visible()
        checks['mobileNoOverflow']=mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
        checks['mobileNoGlErrors']=not mobile.evaluate('OceanCoast.qa.glErrors||[]')
        checks['noPageErrors']=not report['errors'];checks['noFailedRequests']=not report['failedRequests']
        b.close()
except Exception as e:report['errors'].append(str(e));checks['completed']=False
report['passed']=sum(checks.values());report['failed']=sum(not v for v in checks.values());report['status']='PUBLIC_VERIFIED' if report['failed']==0 and not report['errors'] else 'PUBLIC_VERIFY_FAILED';save()
print(json.dumps(report,ensure_ascii=False,indent=2))
if report['status']!='PUBLIC_VERIFIED':raise SystemExit(1)
