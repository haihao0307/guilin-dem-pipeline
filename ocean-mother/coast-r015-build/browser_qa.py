"""Real Chromium WebGL evidence. Portrait emulation is not Safari hardware QA."""
import json,shutil,sys,hashlib
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
url=sys.argv[1];root=Path(sys.argv[2]);root.mkdir(parents=True,exist_ok=True)
report={'url':url,'checks':{},'views':{},'errors':[],'failedRequests':[],'mobileSafariHardwareTested':False,'visualApproved':False}
def save(): (root/'BROWSER_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def summarize_image(name):
    im=Image.open(root/(name+'.png')).convert('RGB')
    box=(20,min(210,im.height//3),im.width-20,im.height-90)
    pixels=list(im.crop(box).resize((280,160)).getdata())
    return {'meanLuminance':sum(.2126*r+.7152*g+.0722*b for r,g,b in pixels)/len(pixels)/255,'blackRatio':sum(max(c)<15 for c in pixels)/len(pixels)}
try:
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path=shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        page=b.new_page(viewport={'width':1440,'height':900})
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
        page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
        response=page.goto(url,wait_until='load');page.wait_for_function('window.OceanCoast?.qa.ready',timeout=60000)
        report['checks']['http200']=response.status==200
        report['checks']['buildIdentity']=page.locator('#build').inner_text()=='coast-r015-daylight-glass'
        for view in ['overview','shore','rocks','fire','top','breaker']:
            page.evaluate('(v)=>OceanCoast.setView(v)',view)
            initial=page.evaluate('OceanCoast.qa.frames')
            page.wait_for_function('(n)=>OceanCoast.qa.frames>=n+3',arg=initial,timeout=60000)
            page.screenshot(path=str(root/(view+'.png')))
            state=page.evaluate('OceanCoast.getState()');qa=page.evaluate('OceanCoast.qa');stats=summarize_image(view)
            report['views'][view]={'state':state,'qa':qa,**stats}
            report['checks'][view+'Daylight']=stats['meanLuminance']>.27
            report['checks'][view+'NoBlackField']=stats['blackRatio']<.02
            report['checks'][view+'NoGlError']=qa.get('glError')==0 and not qa.get('glErrors')
            report['checks'][view+'GeometrySealed']=qa.get('rockDegenerateTriangles')==0 and qa.get('rockHeightCompiled')==1
            save()
        page.evaluate('OceanCoast.setView("overview")');page.click('#panelToggle');page.wait_for_timeout(450)
        page.screenshot(path=str(root/'glass-panel.png'))
        report['checks']['glassPanelOpens']=page.locator('#panel').is_visible()
        report['checks']['textNotBlurred']=page.locator('.panelHead h1').evaluate('(e)=>getComputedStyle(e).filter')=='none'
        before=page.evaluate('OceanCoast.getState().config.clarity')
        page.locator('#control-clarity').evaluate('(e)=>{e.value=1.25;e.dispatchEvent(new Event("input",{bubbles:true}))}')
        report['checks']['sliderUpdatesState']=abs(page.evaluate('OceanCoast.getState().config.clarity')-1.25)<.001
        page.locator('#control-clarity').evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}))}',before)
        page.click('#pause');t0=page.evaluate('OceanCoast.getState().physicalTime');page.wait_for_timeout(800);t1=page.evaluate('OceanCoast.getState().physicalTime')
        report['checks']['pausePreservesClock']=t0==t1
        page.click('#pause');page.wait_for_function('(t)=>OceanCoast.getState().physicalTime>t',arg=t1,timeout=20000);report['checks']['resumeAdvances']=True
        page.click('#panelToggle');report['checks']['glassPanelCloses']='closed' in page.locator('#panel').get_attribute('class')
        # Isolated portrait emulation; no physical iPhone/Safari claim.
        mobile=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
        mobile.on('pageerror',lambda e:report['errors'].append('mobile: '+str(e)))
        mobile.goto(url,wait_until='load');mobile.wait_for_function('window.OceanCoast?.qa.frames>3',timeout=60000)
        mobile.screenshot(path=str(root/'mobile.png'))
        mobile.click('#panelToggle');mobile.wait_for_timeout(400);mobile.screenshot(path=str(root/'mobile-panel.png'))
        report['checks']['mobilePanelVisible']=mobile.locator('#panel').is_visible()
        report['checks']['mobileFits']=mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
        report['checks']['mobileNoGlError']=not mobile.evaluate('OceanCoast.qa.glErrors||[]')
        report['mobileState']=mobile.evaluate('OceanCoast.getState()')
        report['checks']['runtimeErrorsAbsent']=not report['errors']
        report['checks']['noFailedRequests']=not report['failedRequests']
        b.close()
except Exception as e:
    report['errors'].append(str(e));report['checks']['completed']=False
report['passed']=sum(report['checks'].values());report['failed']=sum(not v for v in report['checks'].values())
report['status']='PASS' if report['failed']==0 and not report['errors'] else 'FAIL';save()
print(json.dumps({k:v for k,v in report.items() if k not in ['views','mobileState']},ensure_ascii=False,indent=2))
if report['status']!='PASS':raise SystemExit(1)
