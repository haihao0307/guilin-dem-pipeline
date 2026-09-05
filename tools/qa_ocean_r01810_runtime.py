#!/usr/bin/env python3
"""Exercise the actual file URL offline; record failures without changing the test gate."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import argparse,hashlib,json,time,traceback

p=argparse.ArgumentParser();p.add_argument('html',type=Path);p.add_argument('evidence',type=Path);a=p.parse_args()
a.evidence.mkdir(parents=True,exist_ok=True)
report={'format':'ocean-r01810-runtime-qa','htmlSha256':hashlib.sha256(a.html.read_bytes()).hexdigest(),'passed':False,'cases':{},'visualApproved':False,'productionApproved':False,'hardwarePerformanceApproved':False}
started=time.monotonic()
def save():
    report['elapsedSeconds']=round(time.monotonic()-started,3)
    (a.evidence/'BROWSER_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def snapshot(page): return page.evaluate('({...window.__OCEAN_QA__})')
def case(browser,name,w,h):
    state={'viewport':[w,h],'stage':'opening','errors':[],'externalRequests':[]}
    report['cases'][name]=state;save()
    c=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,offline=True)
    page=c.new_page();page.set_default_timeout(180000)
    page.on('pageerror',lambda e:state['errors'].append(str(e)))
    page.on('console',lambda m:state['errors'].append(m.text) if m.type=='error' else None)
    page.on('request',lambda r:state['externalRequests'].append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.goto(a.html.resolve().as_uri(),wait_until='domcontentloaded',timeout=90000)
    page.wait_for_function('window.__OCEAN_QA__?.ready && window.__OCEAN_QA__.completedFrames>=2',timeout=240000)
    q=snapshot(page);state['initial']=q;state['stage']='nearshore';save()
    assert q['time']>=0 and q['error'] is None,q
    assert q['version']=='0.3.10-island-r018-runtime-repair'
    assert page.evaluate("document.getElementById('deepFrame').srcdoc.length")==0
    assert not page.locator('#fallback').is_visible()
    assert page.evaluate("getComputedStyle(document.getElementById('loading')).visibility")=='hidden'
    page.locator('[data-view="shore"]').click()
    page.wait_for_function('n=>window.__OCEAN_QA__.completedFrames>n+1',arg=q['completedFrames'])
    page.locator('#pause').click();page.wait_for_function('window.__OCEAN_QA__.paused')
    q=snapshot(page);t=q['time']
    page.wait_for_function('n=>window.__OCEAN_QA__.completedFrames>n',arg=q['completedFrames'])
    assert snapshot(page)['time']==t
    page.evaluate("()=>{const e=document.querySelector('[data-param=waveHeight]');e.value='1.10';e.dispatchEvent(new Event('input',{bubbles:true}));}")
    page.wait_for_function('window.__OCEAN_QA__.parameters.waveHeight===1.1')
    page.locator('#pause').click();page.wait_for_function('t=>window.__OCEAN_QA__.time>t',arg=t)
    state['nearshoreResumed']=snapshot(page);cam=state['nearshoreResumed']['camera']
    page.screenshot(path=str(a.evidence/(name+'_nearshore.png')),timeout=180000)
    state['stage']='original-deep';save()
    page.locator('[data-zone="deep"]').click()
    page.wait_for_function("window.__OCEAN_DEEP_READY__===true || document.getElementById('deepFrame').contentWindow?.OceanMother?.qa?.errors?.length>0",timeout=360000)
    deep=page.evaluate("document.getElementById('deepFrame').contentWindow.OceanMother.qa")
    state['deep']=deep;save()
    assert not deep['errors'],deep['errors']
    assert deep['ready'] and deep['completedFrames']>0 and deep['baselineVerified'],deep
    assert deep['version']=='0.1.0' and deep['lastGLerror']==0,deep
    assert page.evaluate("document.getElementById('deepFrame').contentWindow.__OCEAN_DEEP_RESTORED__.source")=='frozen-ocean-mother-v001'
    page.locator('#pause').click()
    page.wait_for_function("document.getElementById('deepFrame').contentDocument.getElementById('pause').textContent.includes('继续')")
    t0=page.evaluate("document.getElementById('deepFrame').contentWindow.OceanMother.qa.waveTime")
    page.wait_for_timeout(1000)
    assert page.evaluate("document.getElementById('deepFrame').contentWindow.OceanMother.qa.waveTime")==t0
    page.screenshot(path=str(a.evidence/(name+'_deep.png')),timeout=180000)
    state['stage']='workspace-roundtrip';save()
    page.locator('[data-zone="island"]').click()
    n=snapshot(page)['completedFrames']
    page.wait_for_function('n=>window.__OCEAN_QA__.completedFrames>n+1',arg=n)
    q=snapshot(page);assert q['camera']==cam,(q['camera'],cam)
    assert q['parameters']['waveHeight']==1.1
    page.locator('[data-zone="deep"]').click()
    assert page.evaluate("document.getElementById('deepFrame').contentDocument.getElementById('pause').textContent.includes('继续')")
    page.locator('#pause').click()
    page.wait_for_function("t=>document.getElementById('deepFrame').contentWindow.OceanMother.qa.waveTime>t",arg=t0,timeout=180000)
    page.locator('[data-zone="island"]').click()
    assert not state['errors'],state['errors']
    assert not state['externalRequests'],state['externalRequests']
    state['stage']='passed';state['passed']=True;save();c.close()

try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
        case(browser,'desktop',800,560)
        case(browser,'mobile',390,844)
        browser.close()
    report['passed']=True
except Exception:
    report['failure']=traceback.format_exc();raise
finally:
    save();print(json.dumps(report,ensure_ascii=False))
