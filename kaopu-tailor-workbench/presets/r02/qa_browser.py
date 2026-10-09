from pathlib import Path
import json, os, time, traceback
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
BASE=os.environ.get('R02_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r02/')
PUBLIC=BASE.startswith('https://')
OUT=HERE/'qa'/('public' if PUBLIC else 'browser')
OUT.mkdir(parents=True,exist_ok=True)
REPORT={
    'version':'R02','public':PUBLIC,'baseURL':BASE,
    'desktopViewport':[1440,1000],'mobileViewport':[390,844],
    'physicalMobileDeviceTested':False,'clothSimulationRun':False,
    'physicalFitAccepted':False,'dynamicWearCertified':False,'checks':[]
}

def save():
    (HERE/('PUBLIC_REPORT.json' if PUBLIC else 'BROWSER_REPORT.json')).write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[];failed=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('response',lambda r: failed.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
    state=lambda: page.evaluate('window.__TAILOR_R02_QA__.getState()')
    def check(name,condition,data=None):
        assert condition,(name,data)
        REPORT['checks'].append({'name':name,'passed':True,'data':data})
        print('R02_BROWSER_PASS',name,flush=True)
    try:
        response=page.goto(BASE+'?preset=J06',wait_until='domcontentloaded',timeout=120000)
        page.wait_for_function('window.__TAILOR_R02_QA__?.getState().ready',timeout=120000)
        check('R02 HTML and 60 inherited presets',response.status==200 and state()['presetCount']==60 and page.locator('.card').count()==60,state())
        check('requested J06 opens in the three-dimensional detail view',state()['selectedId']=='J06' and state()['activeTab']=='3d')
        check('one interactive WebGL cabinet canvas is mounted',state()['canvasCount']==1 and state()['activeRendererCount']==1,state())
        page.wait_for_function('''()=>{const s=window.__TAILOR_R02_QA__.getState();return s.thumbnailCount===60&&s.thumbnailRendererDisposed}''',timeout=180000)
        s=state()
        check('all 60 thumbnails generated and temporary renderer released',s['thumbnailCount']==60 and s['thumbnailRendererDisposed'] and s['thumbnailError'] is None,s)
        check('still only one active canvas after thumbnail authoring',s['canvasCount']==1 and s['activeRendererCount']==1,s)
        page.wait_for_function('''()=>Array.from(document.querySelectorAll('.card img')).length===60&&Array.from(document.querySelectorAll('.card img')).every(i=>i.complete&&i.naturalWidth>0)''',timeout=60000)
        sources=page.locator('.card img').evaluate_all('(imgs)=>imgs.map(i=>i.src)')
        check('card images are cached WebGL renders, not paper SVG files',len(sources)==60 and all(x.startswith('data:image/') for x in sources),{'count':len(sources),'sample':sources[0][:32]})
        check('no editable technical sliders exposed in the selection cabinet',page.locator('input[type=range],input[type=number]').count()==0)
        for view in ['front','side','back','angle']:
            page.locator(f'[data-view="{view}"]').click();page.wait_for_timeout(80)
        check('front, side, back and angle controls remain interactive',page.locator('[data-view][aria-pressed=true]').get_attribute('data-view')=='angle')
        page.locator('#tab-paper').click()
        page.wait_for_function('window.__TAILOR_R02_QA__.getState().paperReady',timeout=30000)
        panels=page.locator('#paper-host svg [data-panel]').count()
        check('secondary view loads the actual inherited millimetre paper',panels>0,{'panels':panels,'preset':state()['selectedId']})
        page.locator('#paper-plus').click();page.locator('#paper-fit').click();page.locator('#tab-3d').click()
        check('paper and 3D tabs return to the same selected preset',state()['selectedId']=='J06' and state()['activeTab']=='3d')
        page.locator('[data-category="连衣裙"]').click()
        check('dress category filters the real library',page.locator('.card').count()==12,{'cards':page.locator('.card').count()})
        page.locator('[data-category="全部"]').click();page.locator('#search').fill('连体')
        check('search finds six jumpsuit presets',page.locator('.card').count()==6)
        page.locator('#search').fill('');page.evaluate('window.__TAILOR_R02_QA__.select("D04")')
        page.wait_for_function('window.__TAILOR_R02_QA__.getState().selectedId==="D04"')
        check('card selection replaces the actual 3D form in the shared renderer',state()['selectedId']=='D04' and state()['detail']['currentId']=='D04',state()['detail'])
        r01=page.locator('#open-r01').get_attribute('href');r074=page.locator('#open-sewing').get_attribute('href')
        r01_status=page.request.get(r01).status
        r074_route='/kaopu-tailor-workbench/r07/continuation/' in r074 and 'case=MetaGarmentDress' in r074
        r074_status=page.request.get(r074).status if PUBLIC else None
        check('paper and sewing paths remain available',r01_status==200 and r074_route and (not PUBLIC or r074_status==200),{'r01':r01,'r01Status':r01_status,'r074':r074,'r074Status':r074_status,'publicHTTPChecked':PUBLIC})
        page.locator('body').evaluate('(b)=>b.scrollTop=0')
        page.screenshot(path=str(OUT/'desktop.jpg'),type='jpeg',quality=82,full_page=False)
        layout=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})')
        check('desktop has no horizontal overflow',layout['scrollWidth']<=layout['width'],layout)
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(300)
        mobile=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})')
        check('mobile viewport has no horizontal overflow',mobile['scrollWidth']<=mobile['width'],mobile)
        page.screenshot(path=str(OUT/'mobile-detail.jpg'),type='jpeg',quality=82,full_page=False)
        page.locator('#cards').scroll_into_view_if_needed();page.screenshot(path=str(OUT/'mobile-gallery.jpg'),type='jpeg',quality=82,full_page=False)
        check('no page errors or failed HTTP resources',not errors and not failed,{'errors':errors,'failedHTTP':failed})
        final=state()
        check('page does not claim cloth or motion certification',not final['clothSimulationRun'] and not final['physicalFitAccepted'] and not final['dynamicWearCertified'],final)
        REPORT.update(passed=True,checkCount=len(REPORT['checks']),finalState=final,pageErrors=errors,failedHTTP=failed)
    except Exception:
        REPORT.update(passed=False,error=traceback.format_exc(),pageErrors=errors,failedHTTP=failed)
        try: page.screenshot(path=str(OUT/'failure.jpg'),type='jpeg',quality=78,full_page=True)
        except Exception: pass
        raise
    finally:
        save();browser.close()
        print('R02_BROWSER_REPORT',json.dumps({'public':PUBLIC,'passed':REPORT.get('passed'),'checks':len(REPORT['checks']),'error':REPORT.get('error')},ensure_ascii=False),flush=True)
