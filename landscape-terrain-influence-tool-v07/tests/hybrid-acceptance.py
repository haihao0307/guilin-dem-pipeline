import hashlib, json, os, pathlib, subprocess, threading, time, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path.cwd()
OUT = ROOT / 'qa-results'
OUT.mkdir(exist_ok=True)
BASE = 'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'
SOURCE = '26a701aecb29d802d9d5c832c8e05048bbc49db2'
PATH = '/landscape-terrain-influence-tool-v07/'
COMMIT = os.environ['QA_COMMIT']

def download(name, ref=COMMIT, destination=None):
    target = ROOT / (destination or name)
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(BASE + ref + PATH + name, timeout=120) as response:
        target.write_bytes(response.read())
    return target

for name in ['index.html', 'manifest-preview.json', 'BUILD_CONTRACT.json']:
    download(name)
download('generator.js', SOURCE)
download('cache-preview/P01.lmc', SOURCE)
download('manifest-preview.json', SOURCE, 'original-manifest.json')
manifest = json.loads((ROOT / 'original-manifest.json').read_text())
candidate = (ROOT / 'index.html').read_text()
assert "window.__LM__={cancelGeneration," in candidate
candidate = candidate.replace("window.__LM__={cancelGeneration,", "window.__LM__={auditData:()=>activeData,cancelGeneration,", 1)
# Test-only delay exposes the otherwise brief upload-to-first-frame cancellation window.
candidate = candidate.replace("async function completeFrame(){", "async function completeFrame(){if(window.__QA_DELAY_NEXT_FRAME__){const delay=window.__QA_DELAY_NEXT_FRAME__;window.__QA_DELAY_NEXT_FRAME__=0;window.__QA_FRAME_WAITING__=true;await new Promise(r=>setTimeout(r,delay));window.__QA_FRAME_WAITING__=false;}", 1)
(ROOT / 'index.html').write_text(candidate)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1',8765),QuietHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()
results = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--enable-precise-memory-info'])
    page = browser.new_page(viewport={'width':1280,'height':900},device_scale_factor=1)
    errors=[]; failed=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('requestfailed',lambda r:failed.append({'url':r.url,'failure':r.failure}))

    def read():
        return page.evaluate("""()=>{let a=window.__LM__;return {ready:window.__LM_READY__,error:window.__LM_ERROR__,busy:a?.busy,preset:a?.state.palauPreset,seed:a?.getState().recipe.seed,status:document.querySelector('#step')?.textContent,mode:document.documentElement.dataset.landscapeWorkerMode,triangles:a?.report?.parts.reduce((s,p)=>s+p.triangles,0),cacheEntries:a?.cacheSize,cacheLimit:a?.generatedCacheLimit,cacheBytes:a?.generatedCacheBytes,heap:performance.memory?.usedJSHeapSize||0,lastLoad:a?.performance.loads.slice(-1)[0],errors:a?.errors}}""")

    def ready(preset, timeout=180):
        start=time.monotonic();peak_heap=0;peak_rss=0;last=None
        while time.monotonic()-start<timeout:
            r=read();peak_heap=max(peak_heap,r['heap'])
            rss=sum(int(line.split()[-1])*1024 for line in subprocess.check_output(['ps','-eo','comm=,rss='],text=True).splitlines() if line.split()[0].startswith(('chrome','chromium')))
            peak_rss=max(peak_rss,rss)
            if r['status']!=last:
                print('STATUS',r,flush=True);last=r['status']
            assert not r['error'],r
            if r['ready'] and not r['busy'] and r['preset']==preset:
                assert r['triangles']==manifest['entries'][preset]['triangles'],r
                assert r['cacheEntries']<=1 and r['cacheLimit']==1,r
                r.update({'waitSeconds':time.monotonic()-start,'maxObservedJSHeapBytes':peak_heap,'maxObservedSummedBrowserRSSBytes':peak_rss})
                return r
            time.sleep(.5)
        raise AssertionError(f'Timeout waiting for {preset}: {read()}')

    def select(preset):
        page.locator('#ltiPresetGrid button').nth(preset).click()

    def record(name,result):
        results.append({'test':name,**result});(OUT/'hybrid-results.json').write_text(json.dumps({'candidateCommit':COMMIT,'results':results,'pageErrors':errors,'requestFailures':failed},indent=2));print('TEST_RESULT',name,json.dumps(result),flush=True)

    page.goto('http://127.0.0.1:8765/index.html',wait_until='domcontentloaded')
    r=ready(0,20);assert r['mode']=='published-cache';record('default_P01_fast_start',r)
    page.screenshot(path=str(OUT/'P01-default.png'))

    select(2);page.wait_for_timeout(1500);assert read()['busy'];page.locator('#cancelGeneration').click();r=ready(0,5)
    assert r['seed']==83 and r['cacheEntries']==0;record('worker_cancel_restores_P01',r)

    select(2);page.wait_for_timeout(800);select(3);page.wait_for_timeout(800);select(0)
    r=ready(0,20);page.wait_for_timeout(4000);assert read()['preset']==0 and read()['triangles']==manifest['entries'][0]['triangles'];record('rapid_switch_latest_wins',r)

    accepted=page.evaluate("()=>window.__LM__.getState()")
    imported={**accepted,'recipe':manifest['entries'][2]['recipe'],'view':{**accepted['view'],'heightScale':1.55,'theta':accepted['view']['theta']+.25}}
    page.evaluate("s=>{window.__QA_RESTORE_DONE__=false;window.__LM__.restoreState(s).then(()=>window.__QA_RESTORE_DONE__=true)}",imported)
    page.wait_for_timeout(1000);page.locator('#cancelGeneration').click();ready(0,8)
    page.wait_for_function("()=>window.__QA_RESTORE_DONE__")
    assert page.evaluate("()=>window.__LM__.getState()")['view']==accepted['view']
    record('cancelled_import_cannot_overwrite_view',read())

    select(2);r=ready(2,180);assert r['mode']=='generated';assert r['cacheEntries']==1
    resources=page.evaluate("()=>performance.getEntriesByType('resource').map(r=>r.name)")
    assert not any('/cache-preview/P03.lmc' in url for url in resources),resources
    record('P03_full_on_demand',r)
    page.screenshot(path=str(OUT/'P03-generated.png'))
    baseline=download('cache-preview/P03.lmc',SOURCE,'reference/P03.lmc')
    assert hashlib.sha256(baseline.read_bytes()).hexdigest()==manifest['entries'][2]['sha256']
    comparison=page.evaluate("""async()=>{let old=unpackData(await inflateResponse(await fetch('./reference/P03.lmc'))),now=window.__LM__.auditData(),maxAbs=0,unequal=0,indicesEqual=true;for(let j=0;j<old.parts.length;j++){let a=old.parts[j],b=now.parts[j];if(a.vertices.length!==b.vertices.length||a.indices.length!==b.indices.length)throw Error('Buffer shape changed');for(let k=0;k<a.vertices.length;k++){let d=Math.abs(a.vertices[k]-b.vertices[k]);maxAbs=Math.max(maxAbs,d);if(d!==0)unequal++;}for(let k=0;k<a.indices.length;k++)if(a.indices[k]!==b.indices[k])indicesEqual=false;}return {maxAbs,unequal,indicesEqual,finite:now.parts.every(p=>p.vertices.every(Number.isFinite)),gl:window.__LM__.auditFrame()}}""")
    assert comparison['maxAbs']==0 and comparison['unequal']==0 and comparison['indicesEqual'] and comparison['finite'] and comparison['gl']['glError']==0
    record('P03_all_geometry_and_material_equal',comparison)

    select(0);ready(0,20);select(2);r=ready(2,8);assert r['mode']=='bounded-memory';record('bounded_memory_revisit_P03',r)

    select(0);ready(0,20)
    fingerprint=page.evaluate("()=>window.__LM__.bufferFingerprint()")
    page.evaluate("()=>{window.__QA_DELAY_NEXT_FRAME__=2000}");select(2)
    page.wait_for_function("()=>window.__QA_FRAME_WAITING__===true")
    assert read()['triangles']==manifest['entries'][2]['triangles']
    page.locator('#cancelGeneration').click();r=ready(0,8)
    assert page.evaluate("()=>window.__LM__.bufferFingerprint()") == fingerprint
    page.wait_for_timeout(2500);assert read()['preset']==0 and read()['triangles']==manifest['entries'][0]['triangles']
    record('first_frame_cancel_restores_previous_mesh',r)

    select(1);r=ready(1,180);assert r['mode']=='generated' and r['cacheEntries']==1;record('P02_replaces_single_cached_result',r)
    select(2)
    page.wait_for_function("()=>document.querySelector('#step').textContent.includes('采样函数材质')",timeout=180000)
    assert read()['busy'];page.locator('#cancelGeneration').click();r=ready(1,8);page.wait_for_timeout(3000)
    assert read()['preset']==1 and read()['seed']==211 and read()['cacheEntries']==1
    record('GPU_material_cancel_restores_P02',r)
    fingerprint=page.evaluate("()=>window.__LM__.bufferFingerprint()")
    accepted=page.evaluate("()=>window.__LM__.getState()")
    page.evaluate("()=>window.__LM__.setMaterial({shellWarp:window.__LM__.state.shellWarp-.01})")
    page.wait_for_function("()=>window.__LM__.isSurfaceUpdating")
    select(2);page.wait_for_timeout(500);page.locator('#cancelGeneration').click();r=ready(1,8)
    page.wait_for_timeout(2000)
    assert page.evaluate("()=>window.__LM__.getState()")['view']==accepted['view']
    assert page.evaluate("()=>window.__LM__.bufferFingerprint()") == fingerprint
    record('surface_refresh_switch_cancel_is_consistent',r)
    assert not errors and not read()['errors'],errors
    page.screenshot(path=str(OUT/'P02-after-GPU-cancel.png'))
    record('final_no_errors',{'pageErrors':errors,'runtimeErrors':read()['errors'],'requestFailures':failed,'final':read()})
    browser.close()
server.shutdown()
print('HYBRID_ACCEPTANCE_COMPLETE',len(results),flush=True)
