#!/usr/bin/env python3
from __future__ import annotations
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse, json, threading, traceback
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE / 'evidence'
EVIDENCE.mkdir(exist_ok=True)

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

def review(page, path: Path):
    page.screenshot(path=str(path), full_page=False, timeout=30_000)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url')
    args = ap.parse_args()
    server = None
    if args.url:
        url = args.url
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 8765), partial(Quiet, directory=str(HERE)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = 'http://127.0.0.1:8765/index.html'
    report = {'version':'R03C','url':url,'browserPassed':False,'visualAcceptance':False,'physicalDeviceTest':False,'cases':[]}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=[
            '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
            '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
        ])
        for name,w,h in [('desktop',1365,768),('mobile',390,844)]:
            ctx = browser.new_context(viewport={'width':w,'height':h}, device_scale_factor=1,
                                      is_mobile=name=='mobile', has_touch=name=='mobile')
            page = ctx.new_page(); page.set_default_timeout(60_000)
            errors=[]; failed=[]
            page.on('pageerror', lambda exc: errors.append(str(exc)))
            page.on('console', lambda msg: errors.append(msg.text) if msg.type=='error' else None)
            page.on('requestfailed', lambda req: failed.append(req.url))
            case={'name':name,'viewport':[w,h],'passed':False,'errors':errors,'failedRequests':failed}
            report['cases'].append(case)
            try:
                page.goto(url, wait_until='domcontentloaded', timeout=120_000)
                page.wait_for_function("window.PalauWorld && window.__PALAU_R03C_QA__ && getComputedStyle(document.querySelector('#loading')).display==='none'", timeout=240_000)
                assert page.locator('#fatal').evaluate("e=>getComputedStyle(e).display") == 'none'
                state = page.evaluate("""() => {
                  const qa=window.__PALAU_R03C_QA__, W=window.PalauWorld;
                  const low=W.sample(0,0,0), high=W.sample(0,0,3), edge=W.sample(1100,1100,3), far=W.sample(3000,3000,3);
                  return {qa, version:W.meta.version, candidate:W.meta.markers.candidate,
                    airport:W.meta.markers.airport, enc:W.meta.enc,
                    low,high,edge,far, canvas:document.querySelectorAll('canvas').length,
                    title:document.title, loading:getComputedStyle(document.querySelector('#loading')).display};
                }""")
                assert state['version']=='PALAU_AIRAI_STONE_MONEY_R03C_FOCUSED'
                assert state['canvas']==1
                assert state['candidate']['x']==0 and state['candidate']['z']==0
                assert state['enc']['cell']=='US4TB3P0'
                assert state['enc']['soundingCount']==391
                assert state['qa']['quantization']['localInteriorRMSEM'] < 0.08
                assert state['qa']['visualAcceptance'] is False
                assert state['high']['source']=='global+local-wave'
                assert state['far']['source']=='global-wave'
                assert abs(state['high']['height']-state['low']['height']) > 0.01
                case['worldContract']=state
                review(page, EVIDENCE/f'{name}-island.png')
                page.locator('[data-view="overview"]').click(); page.wait_for_timeout(800)
                review(page, EVIDENCE/f'{name}-overview.png')
                page.locator('[data-view="bathy"]').click(); page.locator('#soundings').click(); page.locator('#contours').click(); page.wait_for_timeout(800)
                review(page, EVIDENCE/f'{name}-bathy.png')
                assert not failed, failed
                assert not errors, errors
                case['passed']=True
            except Exception as exc:
                case['failure']=str(exc); case['trace']=traceback.format_exc()
                try: page.screenshot(path=str(EVIDENCE/f'{name}-failure.png'), timeout=10_000)
                except Exception: pass
            finally:
                ctx.close()
            if not case['passed']: break
        report['browserPassed']=len(report['cases'])==2 and all(c['passed'] for c in report['cases'])
        browser.close()
    if server: server.shutdown()
    (HERE/'BROWSER_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if not report['browserPassed']: raise SystemExit(1)

if __name__=='__main__': main()
