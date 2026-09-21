from __future__ import annotations

import base64
import json
import shutil
import subprocess
import sys
import time
import urllib.request
from io import BytesIO
from pathlib import Path
from typing import Any

import websocket
from PIL import Image, ImageChops, ImageStat


def wait_json(url: str) -> Any:
    last: Exception | None = None
    for _ in range(180):
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                return json.load(response)
        except Exception as exc:
            last = exc
            time.sleep(0.2)
    raise last or RuntimeError(f'timed out waiting for {url}')


def image_difference(a: bytes, b: bytes) -> dict[str, float]:
    ia = Image.open(BytesIO(a)).convert('RGB')
    ib = Image.open(BytesIO(b)).convert('RGB')
    if ia.size != ib.size:
        raise AssertionError((ia.size, ib.size))
    diff = ImageChops.difference(ia, ib)
    stat = ImageStat.Stat(diff)
    mean = sum(stat.mean) / 3.0
    pixels = list(diff.getdata())
    changed = sum(1 for px in pixels if max(px) >= 8)
    return {'meanAbsRgb': mean, 'changedPixelPct': 100.0 * changed / max(1, len(pixels))}


def run_view(root: Path, label: str, width: int, height: int, port: int, all_visible: bool, functional: bool) -> dict[str, Any]:
    chrome = shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
    if not chrome:
        raise RuntimeError('Chrome/Chromium unavailable')
    profile = f'/tmp/coral-t08-{label}'
    shutil.rmtree(profile, ignore_errors=True)
    process = subprocess.Popen(
        [chrome, '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', f'--remote-debugging-port={port}',
         '--remote-allow-origins=*', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist',
         f'--window-size={width},{height}', f'--user-data-dir={profile}', 'about:blank'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        target = next(t for t in wait_json(f'http://127.0.0.1:{port}/json/list') if t.get('type') == 'page')
        ws = websocket.create_connection(target['webSocketDebuggerUrl'], timeout=60, origin='http://127.0.0.1')
        seq = 0

        def call(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
            nonlocal seq
            seq += 1
            ident = seq
            ws.send(json.dumps({'id': ident, 'method': method, 'params': params or {}}))
            while True:
                message = json.loads(ws.recv())
                if message.get('id') == ident:
                    if 'error' in message:
                        raise RuntimeError(message['error'])
                    return message.get('result', {})

        def evaluate(expression: str) -> Any:
            result = call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
            remote = result.get('result', {})
            if remote.get('subtype') == 'error':
                raise RuntimeError(remote.get('description', 'browser evaluation failed'))
            return remote.get('value')

        def capture(name: str, canvas_only: bool = False) -> bytes:
            params: dict[str, Any] = {'format': 'png', 'captureBeyondViewport': False}
            if canvas_only:
                rect = json.loads(evaluate("JSON.stringify((()=>{const r=document.querySelector('#gl').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})())"))
                params['clip'] = {**rect, 'scale': 1}
            shot = call('Page.captureScreenshot', params)
            data = base64.b64decode(shot['data'])
            assert len(data) > 12000, len(data)
            (root / name).write_bytes(data)
            return data

        call('Page.enable')
        call('Runtime.enable')
        call('Page.addScriptToEvaluateOnNewDocument', {'source': "window.__qaErrors=[];addEventListener('error',e=>window.__qaErrors.push(String(e.message||e.error||e)));addEventListener('unhandledrejection',e=>window.__qaErrors.push(String(e.reason||e)));"})
        call('Page.navigate', {'url': 'http://127.0.0.1:8772/'})
        time.sleep(12)

        initial = json.loads(evaluate(r'''JSON.stringify((()=>{
          const c=document.querySelector('canvas');let gl=false;try{gl=!!(c&&(c.getContext('webgl2')||c.getContext('webgl')))}catch(e){}
          const sliders=[...document.querySelectorAll('#parameterDock input[type=range]')],rects=sliders.map(el=>el.getBoundingClientRect()),
            dock=document.querySelector('#parameterDock')?.getBoundingClientRect(),controls=document.querySelector('#controls')?.getBoundingClientRect(),main=document.querySelector('main')?.getBoundingClientRect();
          return {ready:document.readyState,title:document.title,gl,canvas:document.querySelectorAll('canvas').length,errors:window.__qaErrors||[],
            qa:window.__CORAL_R06_QA__||{},t08:window.__CORAL_R06_T08__||{},build:window.__CORAL_R06_T08_BUILD__||{},
            sliders:sliders.length,sliderIds:sliders.map(e=>e.id),allVisible:rects.every(r=>r.top>=0&&r.bottom<=innerHeight),
            dockVisible:!!dock&&dock.top>=0&&dock.bottom<=innerHeight,controlsBottom:controls?.bottom,mainWidthRatio:(main?.width||0)/innerWidth,
            overflow:document.documentElement.scrollWidth>innerWidth+1,body:(document.body.innerText||'').slice(0,4500)};
        })())'''))
        assert initial['ready'] == 'complete' and initial['gl'] and initial['canvas'] == 1, initial
        assert not initial['errors'] and '启动失败' not in initial['body'] and 'Failed to fetch' not in initial['body'], initial
        assert 'T08' in initial['title'], initial
        assert initial['sliders'] == 12 and 'warp' in initial['sliderIds'] and 'point' not in initial['sliderIds'], initial
        assert initial['t08'].get('ready') is True and initial['t08'].get('uniformSpeciesColor') is True, initial
        assert initial['t08'].get('microscopeAffectsWholeSurface') is True and initial['t08'].get('warpAffectsGeometry') is True, initial
        assert initial['build'].get('runtimeGLB') == 0 and initial['build'].get('runtimeTextures') == 0 and initial['build'].get('networkFetches') == 0, initial
        assert not initial['overflow'], initial
        qa = initial['qa']
        assert qa.get('runtimeGLB') == 0 and qa.get('runtimeTextures') == 0 and qa.get('networkFetches') == 0, initial
        assert qa.get('continuousTube') is True and qa.get('allActiveRootConnected') is True and qa.get('disconnectedActiveEdges') == 0, initial
        assert qa.get('uniformSpeciesColor') is True and qa.get('meshColorCount') == 1, initial
        assert qa.get('microscopeGeometry') is True and qa.get('recomputedSurfaceNormals') is True, initial
        assert qa.get('warpGeometry') is True and qa.get('tubeSides') == 18 and qa.get('pathSubdivision') == 5, initial
        assert qa.get('growthPaths', 0) > 15 and qa.get('activeEdges', 0) > 50, initial
        assert qa.get('visualAcceptance') is False and qa.get('productionReady') is False, initial
        assert qa.get('rebuildMs', 99999) < 8000, initial
        if all_visible:
            assert initial['mainWidthRatio'] >= .985 and initial['allVisible'] and initial['dockVisible'] and initial['controlsBottom'] <= height + 2, initial
        else:
            assert initial['mainWidthRatio'] >= .96, initial

        full = capture(f'QA_SCREENSHOT_{label.upper()}.png')
        result: dict[str, Any] = {
            'passed': True, 'viewport': f'{width}x{height}', 'webgl': True, 'runtimeErrors': 0,
            'sliderCount': 12, 'allSlidersVisible': initial['allVisible'], 'mainWidthRatio': initial['mainWidthRatio'],
            'defaultPaths': qa['growthPaths'], 'defaultActiveEdges': qa['activeEdges'], 'defaultRebuildMs': qa['rebuildMs'],
            'rootConnected': qa['allActiveRootConnected'], 'uniformSpeciesColor': qa['uniformSpeciesColor'],
            'screenshotBytes': len(full),
        }

        if functional:
            evaluate("document.querySelector('[data-mode=gen]')?.click();camera.dist=4.8;true")
            time.sleep(1)

            def probe(slider: str, value: float) -> dict[str, Any]:
                sid=json.dumps(slider);sval=json.dumps(str(value))
                return json.loads(evaluate(f'''JSON.stringify((()=>{{const e=document.getElementById({sid});if(!e)throw new Error('missing '+{sid});e.value={sval};e.dispatchEvent(new Event('input',{{bubbles:true}}));const q=window.__CORAL_R06_QA__;return{{id:{sid},value:Number(e.value),signature:q.geometrySignature,microRms:q.microDisplacementRms,microCoverage:q.microCoveragePct,normalDeviation:q.normalDeviationRms,warpRms:q.warpDisplacementRms,maxWarp:q.maxWarpDisplacement,meshColorCount:q.meshColorCount,paths:q.growthPaths,edges:q.activeEdges,rootConnected:q.allActiveRootConnected,disconnected:q.disconnectedActiveEdges,rebuildMs:q.rebuildMs}}}})())'''))

            micro0=probe('micro',0);time.sleep(.5);micro0png=capture('QA_MICROSCOPE_0.png',True)
            micro1=probe('micro',1);time.sleep(.5);micro1png=capture('QA_MICROSCOPE_1.png',True)
            mdiff=image_difference(micro0png,micro1png)
            assert abs(micro0['microRms']) < 1e-10 and micro0['microCoverage'] == 0, (micro0,micro1)
            assert micro1['microRms'] > .025 and micro1['microCoverage'] > 80 and micro1['normalDeviation'] > .01, (micro0,micro1)
            assert micro0['signature'] != micro1['signature'] and mdiff['meanAbsRgb'] > .6 and mdiff['changedPixelPct'] > 1.5, (micro0,micro1,mdiff)

            warp0=probe('warp',0);time.sleep(.5);warp0png=capture('QA_WARP_0.png',True)
            warp1=probe('warp',1);time.sleep(.5);warp1png=capture('QA_WARP_1.png',True)
            wdiff=image_difference(warp0png,warp1png)
            assert abs(warp0['warpRms']) < 1e-10 and abs(warp0['maxWarp']) < 1e-10, (warp0,warp1)
            assert warp1['warpRms'] > .04 and warp1['maxWarp'] > .08, (warp0,warp1)
            assert warp0['paths']==warp1['paths'] and warp0['edges']==warp1['edges'] and warp1['rootConnected'] and warp1['disconnected']==0, (warp0,warp1)
            assert warp0['signature'] != warp1['signature'] and wdiff['meanAbsRgb'] > .6 and wdiff['changedPixelPct'] > 1.5, (warp0,warp1,wdiff)

            evaluate("document.querySelector('[data-palette=cyan]')?.click();true")
            cyan=json.loads(evaluate("JSON.stringify(window.__CORAL_R06_QA__)"))
            assert cyan.get('meshColorCount') == 1 and cyan.get('uniformSpeciesColor') is True, cyan
            evaluate("document.querySelector('[data-palette=magenta]')?.click();true")
            defaults={'micro':.84,'warp':.38,'rough':.58,'cupScale':24,'cupDepth':.90,'grain':.55}
            for sid,val in defaults.items():probe(sid,val)
            result['functional']={'microscope0':micro0,'microscope1':micro1,'microscopeImageDifference':mdiff,'warp0':warp0,'warp1':warp1,'warpImageDifference':wdiff,'paletteUniformAfterSwitch':True}

        ws.close()
        return result
    finally:
        process.terminate()
        try: process.wait(timeout=5)
        except subprocess.TimeoutExpired: process.kill()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('usage: coral_r06_t08_browser_qa.py <build-dir>')
    root=Path(sys.argv[1])
    results={
        'ultrawide_2560x1080':run_view(root,'ultrawide_2560x1080',2560,1080,9471,True,True),
        'desktop_1536x960':run_view(root,'desktop_1536x960',1536,960,9472,True,False),
        'mobile_390x844':run_view(root,'mobile_390x844',390,844,9473,False,False),
    }
    path=root/'BUILD_T08.json';build=json.loads(path.read_text(encoding='utf-8'))
    build['browserQA']=results
    build['functionalGates']={'uniformSpeciesColor':True,'microscopeWholeSurface':True,'microscopeVisiblePixelDifference':True,'recomputedSurfaceNormals':True,'warpGeometry':True,'warpVisiblePixelDifference':True,'rootConnected':True,'runtimeErrors':0}
    path.write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(build,ensure_ascii=False))


if __name__=='__main__':main()
