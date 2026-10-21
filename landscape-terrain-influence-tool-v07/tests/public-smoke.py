import hashlib,json,pathlib,time,urllib.request
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path.cwd();OUT=ROOT/'qa-results';OUT.mkdir(exist_ok=True)
BASE='https://haihao0307.github.io/guilin-dem-pipeline/landscape-terrain-influence-tool-v07/'
RELEASE='a663e7e07e7794029422f85a80e5d500ead42a60'
EXPECTED={'index.html':'a0959036d046404d2e001e6f7db290b68743c2752f94bda915c6f127216f30e4','manifest-preview.json':'9ce062313b5264331864547c7be061365ecfa6a0f2199b867ee21f70fa5d3814','generator.js':'1b1bee3510c92e2c5ed685391ae0b7ce039f4c2ed9aee5e04ba67d9dc28117d7'}
files={}
for name,digest in EXPECTED.items():
    with urllib.request.urlopen(BASE+name+'?release='+RELEASE,timeout=90) as r:data=r.read()
    files[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()};assert files[name]['sha256']==digest,files
    if name=='manifest-preview.json':manifest=json.loads(data)
assert [e['id'] for e in manifest['entries'] if e.get('file')]==['P01']
results=[];errors=[];failures=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--enable-precise-memory-info'])
    page=browser.new_page(viewport={'width':1280,'height':900},device_scale_factor=1)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('requestfailed',lambda r:failures.append({'url':r.url,'failure':r.failure}))
    def read():
        return page.evaluate("""()=>{const a=window.__LM__;return {ready:window.__LM_READY__,error:window.__LM_ERROR__,busy:a?.busy,preset:a?.state.palauPreset,seed:a?.getState().recipe.seed,status:document.querySelector('#step')?.textContent,mode:document.documentElement.dataset.landscapeWorkerMode,triangles:a?.report?.parts.reduce((s,p)=>s+p.triangles,0),cacheEntries:a?.cacheSize,cacheLimit:a?.generatedCacheLimit,cacheBytes:a?.generatedCacheBytes,lastLoad:a?.performance.loads.slice(-1)[0],runtimeErrors:a?.errors}}""")
    def ready(preset,timeout=240):
        start=time.monotonic();last=None
        while time.monotonic()-start<timeout:
            r=read()
            assert not r.get('error'),r
            if r.get('status')!=last:print('STATUS',json.dumps(r),flush=True);last=r.get('status')
            if r.get('ready') and not r.get('busy') and r.get('preset')==preset:
                assert r['triangles']==manifest['entries'][preset]['triangles'] and r['cacheEntries']<=1 and r['cacheLimit']==1,r
                return r
            time.sleep(.5)
        raise AssertionError(read())
    def record(name,r):
        results.append({'test':name,**r});(OUT/'public-results.json').write_text(json.dumps({'release':RELEASE,'url':BASE,'files':files,'results':results,'pageErrors':errors,'requestFailures':failures},indent=2));print('TEST_RESULT',name,json.dumps(r),flush=True)
    page.goto(BASE+'?release='+RELEASE,wait_until='domcontentloaded')
    r=ready(0,120);assert r['mode']=='published-cache';record('public_P01_default',r);page.screenshot(path=str(OUT/'public-P01.png'))
    page.locator('#ltiPresetGrid button').nth(2).click();page.wait_for_timeout(1200);assert read()['busy'];page.locator('#cancelGeneration').click();r=ready(0,10);assert r['seed']==83;record('public_cancel_restores_P01',r)
    page.locator('#ltiPresetGrid button').nth(2).click();r=ready(2);assert r['mode']=='generated' and r['cacheEntries']==1
    resources=page.evaluate("()=>performance.getEntriesByType('resource').map(x=>({name:x.name,bytes:x.transferSize}))")
    assert any('/cache-preview/P01.lmc' in x['name'] for x in resources)
    assert not any('/cache-preview/P03.lmc' in x['name'] for x in resources)
    assert not errors and not r['runtimeErrors'],(errors,r)
    frame=page.evaluate("()=>window.__LM__.auditFrame()");assert frame['glError']==0 and frame['nonzeroSamples']>1000,frame
    record('public_P03_full_generation',dict(r,frame=frame,resources=resources));page.screenshot(path=str(OUT/'public-P03.png'))
    browser.close()
print('PUBLIC_ACCEPTANCE_COMPLETE',len(results),flush=True)
