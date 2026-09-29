from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import json, sys, os, time, hashlib, re, base64, urllib.request, urllib.error

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'output'
REPO='haihao0307/guilin-dem-pipeline'
BRANCH='work/kaopu-bird-triad-r01-20260929'
URL='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-bird-triad/r01-20260929/'
TOKEN=os.environ.get('GITHUB_TOKEN','')

def api(path, data=None, method=None):
    body=None if data is None else json.dumps(data).encode()
    req=urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path, data=body, method=method or ('POST' if data is not None else 'GET'), headers={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json','Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=40) as r: return json.load(r)

def blob(data):
    return api('git/blobs',{'content':base64.b64encode(data).decode(),'encoding':'base64'})['sha']

def receipt(name,value):
    path='kaopu-bird-triad-r01/'+name
    sha=None
    try: sha=api('contents/'+path+'?ref='+BRANCH)['sha']
    except urllib.error.HTTPError as e:
        if e.code!=404: raise
    data={'message':'Bird Triad verification receipt '+name,'branch':BRANCH,'content':base64.b64encode(json.dumps(value,ensure_ascii=False,indent=2).encode()).decode()}
    if sha: data['sha']=sha
    return api('contents/'+path,data,'PUT')

def dump(name,value):
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2))

def ready(page):
    page.wait_for_function('window.KB2Ready === true',timeout=40000)
    assert page.evaluate('KAOPUBirdTriad.state.valid')

def page_test(browser,url,width,height,tag):
    ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,accept_downloads=True)
    page=ctx.new_page();errors=[];network=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:network.append(r.url) if r.url.startswith(('https:','http:')) else None)
    response=page.goto(url,wait_until='load');ready(page)
    page.wait_for_timeout(350)
    assert page.evaluate('document.body.scrollWidth <= innerWidth+1'), 'Horizontal overflow'
    metrics=page.evaluate('KaopuBirdInstrument.measure(KAOPUBirdTriad.state.result)')
    assert metrics['verticesIncludingDiagnostics']==11803
    assert metrics['visibleTriangles']==18040
    page.screenshot(path=str(OUT/(tag+'.png')),full_page=True)
    page.locator('#liveCanvas').screenshot(path=str(OUT/(tag+'-canvas.png')))
    im=Image.open(OUT/(tag+'-canvas.png')).convert('RGB')
    assert len(set(im.getdata()))>80, 'Canvas is empty or not a rendered bird'
    assert not errors, errors
    return ctx,page,{'viewport':[width,height],'metrics':metrics,'consoleErrors':errors,'httpRequests':network,'horizontalOverflow':False,'canvasHasRenderedGeometry':True,'httpStatus':response.status if response else None}

def local():
    html=(OUT/'index.html').read_text()
    for ident,name in [('instrumentCore','bird-instrument.js'),('stageCore','stage.js'),('composerCore','composer.js'),('appCore','workbench-app.js'),('baseScore','grey-heron.resolved.kscore')]:
        hit=re.search(r'<script[^>]*id="'+ident+r'"[^>]*>([\s\S]*?)</script>',html)
        assert hit,ident
        (OUT/name).write_text(hit.group(1))
    checks=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        ctx,page,desk=page_test(browser,(OUT/'index.html').as_uri(),1600,1000,'workbench-desktop')
        checks.append({'test':'desktop-local-file','result':desk})
        assert len(desk['httpRequests'])==0
        before=page.locator('#geometryHash').inner_text()
        page.locator('#billLengthNumber').fill('0.18');page.locator('#billLengthNumber').press('Tab')
        page.wait_for_function('KAOPUBirdTriad.state.valid && KAOPUBirdTriad.state.resolved.construction.head.stations[7][0] > .24')
        changed=page.locator('#geometryHash').inner_text();assert changed!=before
        assert int(page.locator('#differenceCount').inner_text())>0
        checks.append({'test':'score-only-edit-changes-geometry','passed':True,'before':before,'after':changed})
        page.locator('#verify').click();page.wait_for_function('KAOPUBirdTriad.state.lastReport !== null')
        assert page.evaluate('KAOPUBirdTriad.state.lastReport.actualTypedArraysEqual')
        with page.expect_download() as d: page.locator('#exportPlayer').click()
        d.value.save_as(OUT/'fixture-player.html')
        changed_expected=changed
        with page.expect_download() as d: page.locator('#exportResolved').click()
        d.value.save_as(OUT/'fixture.resolved.kscore')
        with page.expect_download() as d: page.locator('#saveProject').click()
        d.value.save_as(OUT/'fixture.kproject')
        with page.expect_download() as d: page.locator('#exportWorkbench').click()
        d.value.save_as(OUT/'fixture-workbench.html')
        page.locator('#neckLengthNumber').fill('-1');page.locator('#neckLengthNumber').press('Tab')
        page.wait_for_function('!KAOPUBirdTriad.state.valid && document.getElementById("compileStatus").textContent.includes("校验失败")')
        assert page.locator('#exportResolved').is_disabled()
        assert page.locator('#geometryHash').inner_text()==changed
        checks.append({'test':'invalid-draft-cannot-export-last-good-output-as-current','passed':True})
        page.locator('#reset').click()
        page.wait_for_function('KAOPUBirdTriad.state.valid && KAOPUBirdTriad.state.resolved.construction.head.stations[7][0] === .205')
        assert page.locator('#geometryHash').inner_text()==before
        page.locator('#verify').click();page.wait_for_function('KAOPUBirdTriad.state.lastReport !== null')
        page.screenshot(path=str(OUT/'workbench-desktop.png'),full_page=True)
        with page.expect_download() as d: page.locator('#exportPlayer').click()
        d.value.save_as(OUT/'standalone-player.html')
        page.locator('[data-view="head"]').click();page.screenshot(path=str(OUT/'workbench-head.png'),full_page=True)
        page.locator('[data-mode="white"]').click();page.screenshot(path=str(OUT/'workbench-white-head.png'),full_page=True)
        ctx.close()
        # The creator context is gone. Fresh context reads exported player bytes only.
        pc=browser.new_context(viewport={'width':1300,'height':900});pl=pc.new_page();perr=[];pnet=[]
        pl.on('pageerror',lambda e:perr.append(str(e)))
        pl.on('request',lambda r:pnet.append(r.url) if r.url.startswith(('http:','https:')) else None)
        pl.goto((OUT/'fixture-player.html').as_uri());pl.wait_for_function('window.KB2PlayerReady')
        result=pl.evaluate('KB2Player.verify()');assert result['equal'];assert result['outputFingerprint']==changed_expected
        assert pl.evaluate('typeof KaopuComposer')=='undefined'
        assert not perr and not pnet
        checks.append({'test':'independent-file-replay-after-creator-closed','passed':True,'metrics':result,'httpRequests':pnet,'consoleErrors':perr})
        pl.goto((OUT/'standalone-player.html').as_uri());pl.wait_for_function('window.KB2PlayerReady');pl.screenshot(path=str(OUT/'standalone-player.png'),full_page=True)
        pc.close()
        ec=browser.new_context(viewport={'width':1440,'height':900});ep=ec.new_page();ep.goto((OUT/'fixture-workbench.html').as_uri());ready(ep)
        assert ep.locator('#geometryHash').inner_text()==changed_expected
        checks.append({'test':'exported-workbench-restores-current-project-without-local-cache','passed':True});ec.close()
        mc,mp,mobile=page_test(browser,(OUT/'index.html').as_uri(),390,844,'workbench-mobile')
        assert not mobile['httpRequests']
        mp.locator('[data-panel="author"]').click();mp.screenshot(path=str(OUT/'workbench-mobile-author.png'),full_page=True)
        assert mp.locator('#billLengthNumber').is_visible()
        mp.locator('[data-panel="score"]').click();assert mp.locator('#exportResolved').is_visible()
        mp.screenshot(path=str(OUT/'workbench-mobile-score.png'),full_page=True)
        checks.append({'test':'mobile-local-file-and-panels','result':mobile});mc.close();browser.close()
    value={'schema':'kaopu.bird.browser-verification/1','passed':True,'sourceSha':os.environ.get('GITHUB_SHA'),'htmlSha256':hashlib.sha256((OUT/'index.html').read_bytes()).hexdigest(),'checks':checks,'fileProtocolTested':True,'externalRuntimeRequests':0,'physicalMobileDeviceTested':False,'visualAcceptance':False,'productionReady':False}
    dump('BROWSER_TEST_REPORT.json',value)
    publish={'sourceSha':os.environ.get('GITHUB_SHA'),'passed':True,'htmlSha256':value['htmlSha256'],'htmlBlobSha':blob((OUT/'index.html').read_bytes()),'browserReportBlobSha':blob((OUT/'BROWSER_TEST_REPORT.json').read_bytes()),'publicUrl':URL,'visualAcceptance':False,'productionReady':False}
    receipt('BUILD_RECEIPT.json',publish)
    print(json.dumps(publish))

def public():
    expected=(OUT/'index.html').read_bytes();ok=False
    for attempt in range(150):
        try:
            with urllib.request.urlopen(URL+'?verify='+str(attempt),timeout=15) as r:
                data=r.read()
                if r.status==200 and data==expected: ok=True;break
        except Exception: pass
        time.sleep(3)
    assert ok,'No exact public bytes observed after promotion window'
    with sync_playwright() as p:
        b=p.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        ctx,page,result=page_test(b,URL,1440,900,'public-desktop');assert result['httpStatus']==200
        page.locator('#verify').click();page.wait_for_function('KAOPUBirdTriad.state.lastReport !== null');assert page.evaluate('KAOPUBirdTriad.state.lastReport.actualTypedArraysEqual');ctx.close()
        mc,mp,mresult=page_test(b,URL,390,844,'public-mobile');assert mresult['httpStatus']==200;mc.close();b.close()
    proof={'schema':'kaopu.publication-proof/1','sourceSha':os.environ.get('GITHUB_SHA'),'publicUrl':URL,'httpStatus':200,'exactPublicBytesMatched':True,'htmlSha256':hashlib.sha256(expected).hexdigest(),'realBrowserPassed':True,'fileProtocolTested':True,'desktop':result,'mobile':mresult,'physicalMobileDeviceTested':False,'shareAllowed':True,'visualAcceptance':False,'productionReady':False}
    dump('PUBLICATION_PROOF.json',proof);receipt('PUBLICATION_PROOF.json',proof);print(json.dumps(proof))

try:
    if sys.argv[1]=='local': local()
    else: public()
except Exception as e:
    dump('FAILURE_'+sys.argv[1]+'.json',{'passed':False,'error':str(e),'sourceSha':os.environ.get('GITHUB_SHA')})
    print('FAILED',repr(e),flush=True)
    raise
