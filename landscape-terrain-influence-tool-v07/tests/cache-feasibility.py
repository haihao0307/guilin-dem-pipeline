import hashlib, json, pathlib, subprocess, threading, time, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path.cwd()
OUT = ROOT / 'qa-results'
OUT.mkdir(exist_ok=True)
SOURCE = '26a701aecb29d802d9d5c832c8e05048bbc49db2'
BASE = f'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/{SOURCE}/landscape-terrain-influence-tool-v07/'

def download(name):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(BASE + name, timeout=120) as response:
        path.write_bytes(response.read())
    return path

for name in ['index.html', 'generator.js', 'manifest-preview.json']:
    download(name)
manifest = json.loads((ROOT / 'manifest-preview.json').read_text())
source = (ROOT / 'index.html').read_text()
assert source.count("if(entry){\n   const response=await fetch") == 1
source = source.replace("if(entry){\n   const response=await fetch", "if(entry && !new URLSearchParams(location.search).has('regenerate')){\n   const response=await fetch", 1)
source = source.replace("window.__LM__={release:", "window.__LM__={auditData:()=>activeData, auditGl:()=>gl, release:", 1)
original_boot = "build(recipe).catch(fail)}catch(e){fail(e)}"
assert source.count(original_boot) == 1
source = source.replace(original_boot, "(Number(new URLSearchParams(location.search).get('preset')||0)>0 ? applyPalauPreset(Number(new URLSearchParams(location.search).get('preset'))) : build(recipe)).catch(fail)}catch(e){fail(e)}", 1)
(ROOT / 'index.html').write_text(source)

subprocess.run(['node', 'test-generator.cjs'], check=True)
(OUT / 'generator-results.json').write_bytes((ROOT / 'generator-results.json').read_bytes())

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 8765), QuietHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()
results = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader', '--js-flags=--expose-gc'])
    for i, entry in enumerate(manifest['entries']):
        cache_path = download(entry['file'])
        assert cache_path.stat().st_size == entry['bytes']
        assert hashlib.sha256(cache_path.read_bytes()).hexdigest() == entry['sha256']
        case = {'id': entry['id'], 'expectedTriangles': entry['triangles'], 'runs': []}
        for regenerate in [False, True]:
            context = browser.new_context(viewport={'width': 1280, 'height': 900}, device_scale_factor=1)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda err: errors.append(str(err)))
            start = time.monotonic()
            page.goto(f'http://127.0.0.1:8765/index.html?preset={i}' + ('&regenerate=1' if regenerate else ''), wait_until='domcontentloaded')
            max_js_heap = 0
            last_status = None
            while time.monotonic() - start < 900:
                state = page.evaluate("""() => ({ready:window.__LM_READY__, error:window.__LM_ERROR__, status:document.querySelector('#ltiStatus')?.textContent, heap:performance.memory?.usedJSHeapSize||0})""")
                max_js_heap = max(max_js_heap, state['heap'])
                if state['status'] != last_status:
                    print(entry['id'], 'generated' if regenerate else 'cached', state['status'], flush=True)
                    last_status = state['status']
                if state['error']:
                    raise RuntimeError(state['error'])
                if state['ready']:
                    break
                time.sleep(2)
            assert state['ready'], 'Timed out before completed frame'
            elapsed = time.monotonic() - start
            metrics = page.evaluate("""() => {const a=window.__LM__,d=a.auditData(),gl=a.auditGl();return {triangles:d.report.parts.reduce((s,p)=>s+p.triangles,0),signatures:d.report.parts.map(p=>p.signature),strides:[...new Set(d.parts.map(p=>p.stride))],allFinite:d.parts.every(p=>p.vertices.every(Number.isFinite)),renderBytes:d.parts.reduce((s,p)=>s+p.vertices.byteLength+p.indices.byteLength,0),frame:a.auditFrame(),performance:a.performance,errors:a.errors,material:d.report.materialPreview,renderer:gl.getParameter(gl.RENDERER),resources:performance.getEntriesByType('resource').map(r=>({name:r.name,bytes:r.transferSize})),heap:performance.memory?.usedJSHeapSize||0}}""")
            metrics.update({'generated': regenerate, 'wallSeconds': elapsed, 'maxObservedJSHeapBytes': max_js_heap, 'pageErrors': errors})
            assert metrics['triangles'] == entry['triangles']
            assert metrics['signatures'] == entry['originalSignatures']
            assert metrics['strides'] == [30] and metrics['allFinite']
            assert not metrics['errors'] and not errors and metrics['frame']['glError'] == 0
            if regenerate:
                assert not any('.lmc' in r['name'] for r in metrics['resources']), 'Generation performance contaminated by cache load'
                metrics['comparison'] = page.evaluate("""async file => {
                    const old=unpackData(await inflateResponse(await fetch('./'+file))), now=window.__LM__.auditData();
                    const groups={position:[0,3],normal:[3,6],rest:[6,9],fields:[9,25],material:[25,30]};
                    const stats={}; for(const k of Object.keys(groups))stats[k]={maxAbs:0,sumAbs:0,sumSq:0,count:0,unequal:0};
                    let indicesEqual=true,shapeEqual=old.parts.length===now.parts.length;
                    for(let j=0;j<old.parts.length;j++){
                        const a=old.parts[j],b=now.parts[j];if(a.vertices.length!==b.vertices.length||a.stride!==b.stride||a.indices.length!==b.indices.length){shapeEqual=false;continue;}
                        for(let k=0;k<a.indices.length;k++)if(a.indices[k]!==b.indices[k])indicesEqual=false;
                        for(let n=0;n<a.vertices.length;n+=30)for(const [key,[lo,hi]] of Object.entries(groups))for(let k=lo;k<hi;k++){const delta=Math.abs(a.vertices[n+k]-b.vertices[n+k]),s=stats[key];s.maxAbs=Math.max(s.maxAbs,delta);s.sumAbs+=delta;s.sumSq+=delta*delta;s.count++;if(delta!==0)s.unequal++;}
                    }
                    for(const s of Object.values(stats)){s.meanAbs=s.sumAbs/s.count;s.rms=Math.sqrt(s.sumSq/s.count);delete s.sumAbs;delete s.sumSq;}
                    return {shapeEqual,indicesEqual,stats};
                }""", entry['file'])
                assert metrics['comparison']['shapeEqual'] and metrics['comparison']['indicesEqual']
            del metrics['signatures']
            page.screenshot(path=str(OUT / (entry['id'] + ('-generated.png' if regenerate else '-cached.png'))))
            case['runs'].append(metrics)
            (OUT / 'results.json').write_text(json.dumps(results + [case], indent=2))
            print('RESULT', json.dumps({'id': entry['id'], **metrics}), flush=True)
            context.close()
        results.append(case)
        cache_path.unlink()
    browser.close()

server.shutdown()
print('ALL_CASES_COMPLETE', len(results), flush=True)
