"""Real HTTP navigation, rendering and control checks in GitHub Actions."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import hashlib,json,os,sys,time
url,label=sys.argv[1:3];out=Path(os.environ['LM_EVIDENCE']);out.mkdir(parents=True,exist_ok=True)
expected=hashlib.sha256((Path(os.environ['LM_SITE'])/'index.html').read_bytes()).hexdigest()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    for mobile in (False,True):
        profile='mobile' if mobile else 'desktop';t=time.perf_counter()
        context=browser.new_context(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 840},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
        page=context.new_page();errors=[];requests=[];checks=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
        def check(name,ok):
            checks.append({'name':name,'passed':bool(ok)})
            assert ok,name
        try:
            response=page.goto(url,wait_until='domcontentloaded',timeout=60000)
            check('HTTP 200 and exact HTML',response.status==200 and hashlib.sha256(response.body()).hexdigest()==expected)
            page.wait_for_function('window.__LM_READY__||window.__LM_ERROR__',timeout=90000)
            check('WebGL2 generation ready',page.evaluate('window.__LM_READY__===true'))
            before=page.evaluate('window.__LM__.bufferFingerprint()');state=page.evaluate('window.__LM__.getState()')
            for view in ('hero','cliff','foot','back','section'):
                page.locator('[data-view="'+view+'"]').click(timeout=30000)
                audit=page.evaluate('window.__LM__.auditFrame()')
                check('render '+view,audit['nonzeroSamples']>100 and audit['unique']>100 and audit['glError']==0)
                if view in ('hero','cliff','foot'):page.screenshot(path=str(out/(label+'-'+profile+'-'+view+'.png')),timeout=30000)
            page.locator('#panelbtn').click()
            page.locator('#wet').evaluate('(e)=>{e.value=.8;e.dispatchEvent(new Event("input",{bubbles:true}))}')
            check('material slider and fixed geometry',page.evaluate('window.__LM__.state.wet===.8') and before==page.evaluate('window.__LM__.bufferFingerprint()'))
            with page.expect_download() as d:page.locator('#export').click()
            dest=out/(label+'-'+profile+'-state.json');d.value.save_as(str(dest));check('download JSON',json.loads(dest.read_text())==page.evaluate('window.__LM__.getState()'))
            page.locator('#file').set_input_files({'name':'state.json','mimeType':'application/json','buffer':json.dumps(state).encode()})
            page.wait_for_function('(s)=>JSON.stringify(window.__LM__.getState())===JSON.stringify(s)',arg=state,timeout=90000)
            check('restore exact state and geometry',before==page.evaluate('window.__LM__.bufferFingerprint()'))
            page.locator('#closepanel').click();check('no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            check('no script or GL errors',not errors and not page.evaluate('window.__LM__.errors'))
            check('no external model or runtime requests',len([u for u in requests if u.startswith('http') and u.split('?')[0]!=url.split('?')[0]])==0)
            report={'passed':True,'label':label,'profile':profile,'url':url,'sha256':expected,'checks':checks,'pageErrors':errors,'requests':requests,'seconds':round(time.perf_counter()-t,2),'physicalPhone':False,'GPU':'Chromium SwiftShader','buffers':page.evaluate('window.__LM__.report.generatedRenderBytes')}
            (out/(label+'-'+profile+'.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
        except Exception as e:
            (out/(label+'-'+profile+'.json')).write_text(json.dumps({'passed':False,'error':str(e),'checks':checks,'pageErrors':errors},indent=2));raise
        finally:context.close()
    browser.close()
