"""Real v0.2.1 Chromium regression. QA only relocates the player/advances time.
Terrain, rocks, water, spear intersection and capture transactions are unmodified.
Mobile is touch emulation, not a physical-device or human visual acceptance.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
import json, os, shutil, sys, threading, traceback
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = Path('/tmp/smi-fish-qa')
EVIDENCE.mkdir(parents=True, exist_ok=True)
REPORT = EVIDENCE / 'REPORT.json'
server = None
base = os.environ.get('SMI_PUBLIC_URL')
if not base:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}/releases/v0.2.1/index.html'
parts = urlsplit(base)
query = dict(parse_qsl(parts.query)); query['qa'] = '1'
url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
report = {'version': '0.2.1', 'url': url, 'browserPassed': False, 'physicalDeviceTest': False,
          'visualAcceptance': False, 'cases': [], 'notes': [
              'Live WebGL terrain/water; no environment mocks.',
              'QA player placement; visible UI pickups/craft/spear hit.',
              'Controlled 0.05s inspections: desktop 120s / touch 30s, each plus a 180s advance.',
              'Finite spatial/time sampling cannot prove arbitrary terrain or waveforms.']}


def save():
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2))


def hold(page):
    page.evaluate("Promise.race([OceanIsland.holdForReview(),new Promise((_,r)=>setTimeout(()=>r(Error('GPU review timeout')),30000))])")


def resume(page):
    page.evaluate('OceanIsland.resumeFromReview()')


CHECK = """() => {
 const g=StoneMoneySurvival, all=g.getFish(), d=g.diagnostics(), live=all.filter(f=>f.state==='swimming');
 if(all.some(f=>['stranded','unavailable'].includes(f.state)))throw Error('Fish failed to remain in water: '+JSON.stringify(d.fishNavigation));
 if(all.length<12 || new Set(all.map(f=>f.id)).size!==all.length)throw Error('Fish identity/count regression');
 const problems=d.fishNavigation.filter(n=>live.some(f=>f.id===n.id) && (n.status!=='swimming'||!n.clearance.safe));
 if(problems.length)throw Error('Invalid fish: '+JSON.stringify(problems));
 if(!all.every(f=>f.pos.every(Number.isFinite)))throw Error('Nonfinite fish coordinates');
 return {time:g.getState().worldSeconds,total:all.length,live:live.length,ids:all.map(f=>f.id),
  minBodyClearance:Math.min(...d.fishNavigation.filter(n=>live.some(f=>f.id===n.id)).map(n=>Math.min(
   all.find(f=>f.id===n.id).pos[1]-n.clearance.lo,n.clearance.hi-all.find(f=>f.id===n.id).pos[1])))};
}"""


def main():
    with sync_playwright() as pw:
        executable = (os.environ.get('SMI_CHROME_PATH') or shutil.which('google-chrome') or
                      shutil.which('google-chrome-stable') or shutil.which('chromium'))
        options = {'headless': True, 'args': ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
                   '--enable-unsafe-swiftshader', '--disable-dev-shm-usage']}
        if executable:
            options['executable_path'] = executable
        browser = pw.chromium.launch(**options)
        report['browserVersion'] = browser.version
        for name, width, height in [('desktop', 960, 540), ('touch', 390, 844)]:
            mobile = name == 'touch'
            ctx = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                                      is_mobile=mobile, has_touch=mobile)
            page = ctx.new_page(); page.set_default_timeout(20000)
            case = {'name': name, 'viewport': [width, height], 'passed': False, 'phase': 'load',
                    'pageErrors': [], 'consoleErrors': [], 'failedRequests': []}
            report['cases'].append(case)
            page.on('pageerror', lambda e, c=case: c['pageErrors'].append(str(e)))
            page.on('console', lambda m, c=case: c['consoleErrors'].append(m.text) if m.type == 'error' else None)
            page.on('requestfailed', lambda r, c=case: c['failedRequests'].append(r.url))

            def tap(selector):
                node = page.locator(selector)
                node.tap() if mobile else node.click()

            def phase(label):
                case['phase'] = label; save(); print(f'{name}: {label}', flush=True)

            def aim(object_id):
                page.evaluate('StoneMoneySurvival.test.advance(.6)')
                page.evaluate("""id=>{const g=StoneMoneySurvival,p=g.getDefinitions().find(o=>o.id===id).position,
                 x=p[0]+.65,z=p[2]+.9,y=g.ground(x,z)+1.64;
                 g.test.position(x,z,Math.atan2(p[0]-x,-(p[2]-z)),Math.atan2(p[1]-y,Math.hypot(p[0]-x,p[2]-z)));}""", object_id)
                page.wait_for_function('id=>StoneMoneySurvival.diagnostics().target===id', arg=object_id)

            try:
                response = page.goto(url, wait_until='domcontentloaded', timeout=60000)
                assert response and response.status == 200, 'Entry did not return HTTP 200'
                page.wait_for_function('window.OceanIsland?.qa.ready && window.StoneMoneySurvival', timeout=120000)
                assert page.evaluate('StoneMoneySurvival.version') == '0.2.1', 'Wrong runtime version'
                assert not page.locator('#error').inner_text().strip(), 'Runtime error panel'
                tap('#smiStart'); page.wait_for_function('StoneMoneySurvival.getMode()==="playing"')
                page.evaluate('StoneMoneySurvival.test.advance(3)')
                case['initial'] = page.evaluate(CHECK)
                assert case['initial']['live'] >= 12, 'Fewer than the original twelve live fish'
                phase('visible pickups and spear capture')
                for object_id in ['driftwood-01', 'stone-01']:
                    aim(object_id); tap('#smiPrimary')
                    page.wait_for_function('id=>StoneMoneySurvival.getState().objects[id].location==="inventory"', arg=object_id)
                tap('#smiCraft'); page.wait_for_function('StoneMoneySurvival.getState().spear')
                caught = None
                hold(page)  # Stable QA aiming; fish and terrain geometry are unchanged.
                for attempt in range(8):
                    page.evaluate('StoneMoneySurvival.test.advance(.6)')
                    fish_id = page.evaluate("""i=>{const g=StoneMoneySurvival,fs=g.getFish().filter(f=>f.state==='swimming'&&f.nav?.status==='swimming'),f=fs[i%fs.length];
                     if(!f)throw Error('No fish available to spear');const p=f.pos,x=p[0]-.72,z=p[2]+.86,y=g.ground(x,z)+1.64;
                     g.test.position(x,z,Math.atan2(p[0]-x,-(p[2]-z)),Math.atan2(p[1]-y,Math.hypot(p[0]-x,p[2]-z)));g.cameraFrame(innerWidth/innerHeight);g.tick(0,g.getState().worldSeconds);return f.id;}""", attempt)
                    try:
                        # The HUD target is throttled; action() itself recomputes the geometric ray.
                        page.locator('#smiPrimary').click(force=True)
                        page.wait_for_function('id=>StoneMoneySurvival.getState().fish[id]==="kept"', arg=fish_id, timeout=2500)
                        caught = fish_id; break
                    except Exception:
                        pass
                assert caught, 'Visible spear action never registered a geometric hit'
                case['caughtFishId'] = caught
                resume(page)
                phase('pause freezes navigation')
                tap('#smiBag'); paused = page.evaluate('({fish:StoneMoneySurvival.getFish(),time:StoneMoneySurvival.getState().worldSeconds,frames:OceanIsland.qa.sceneFrames})')
                page.wait_for_function('n=>OceanIsland.qa.sceneFrames>=n+3', arg=paused['frames'], timeout=30000)
                after = page.evaluate('({fish:StoneMoneySurvival.getFish(),time:StoneMoneySurvival.getState().worldSeconds})')
                assert after['fish'] == paused['fish'] and after['time'] == paused['time'], 'Paused fish moved'
                case['pausePassed'] = True; tap('#smiCloseJournal'); hold(page)
                phase(('30' if mobile else '120')+' seconds controlled live water progression')
                page.evaluate('StoneMoneySurvival.test.position(25.2,12.1)')
                checks = []
                for batch in range(3 if mobile else 12):
                    checks.append(page.evaluate("""checkSource=>{const check=eval('('+checkSource+')'),g=StoneMoneySurvival;
                     const started=performance.now();let min=Infinity;for(let i=0;i<200;i++){g.test.advance(.05);const s=check();min=Math.min(min,s.minBodyClearance);
                     if(g.getMode()!=='playing')throw Error('Game stopped during fish progression');}
                     return {time:g.getState().worldSeconds,minBodyClearance:min,wallMilliseconds:performance.now()-started};}""", CHECK))
                    case['continuousChecks'] = checks; save()
                case['continuousChecks'] = checks
                phase('180 second elapsed-time jump')
                page.evaluate('StoneMoneySurvival.test.advance(180)')
                case['after180Seconds'] = page.evaluate(CHECK)
                assert page.evaluate('id=>StoneMoneySurvival.getState().fish[id]', caught) == 'kept', 'Caught fish resurrected'
                phase('exact fish identity and position after reload')
                before = page.evaluate("""()=>{const g=StoneMoneySurvival;if(!g.commit())throw Error('Save failed');
                 document.getElementById('smiMenuButton').click();return {fish:g.getFish(),state:g.getState()};}""")
                page.reload(wait_until='domcontentloaded', timeout=60000)
                page.wait_for_function('window.OceanIsland?.qa.ready && window.StoneMoneySurvival', timeout=120000)
                hold(page)
                restored = page.evaluate("""()=>{document.getElementById('smiContinue').click();
                 return {fish:StoneMoneySurvival.getFish(),state:StoneMoneySurvival.getState()};}""")
                assert restored['state']['worldSeconds'] == before['state']['worldSeconds'], 'Restore time changed'
                assert restored['state']['fish'] == before['state']['fish'], 'Capture inventory changed'
                for old, new in zip(before['fish'], restored['fish']):
                    assert old['id'] == new['id'] and old['pos'] == new['pos'] and old['yaw'] == new['yaw'], 'Restore relocated a fish'
                case['restored'] = page.evaluate(CHECK); case['restorePassed'] = True
                assert case['restored']['ids'] == case['initial']['ids'], 'Fish identities changed'
                assert case['restored']['live'] == case['initial']['live']-1, 'Captured fish revived or live fish disappeared'
                frame_before_resume = page.evaluate('OceanIsland.qa.sceneFrames')
                resume(page)
                page.wait_for_function('n=>OceanIsland.qa.sceneFrames>=n+2', arg=frame_before_resume, timeout=30000)
                case['finalDiagnostics'] = page.evaluate('StoneMoneySurvival.diagnostics()')
                assert not page.evaluate('OceanIsland.qa.glErrors||[]'), 'WebGL errors'
                assert not case['pageErrors'] and not case['consoleErrors'] and not case['failedRequests'], 'Browser runtime errors'
                assert page.locator('canvas').count() == 1
                case['passed'] = True; phase('passed')
            except Exception as error:
                case['failure'] = str(error); case['trace'] = traceback.format_exc()
                try:
                    case['failureDiagnostics'] = page.evaluate('window.StoneMoneySurvival?.diagnostics()')
                    case['failureFish'] = page.evaluate('window.StoneMoneySurvival?.getFish()')
                except Exception:
                    pass
                print(f'FAIL {name}: {error}\n{case["trace"]}', flush=True); save()
            finally:
                ctx.close()
            if not case['passed']:
                break
        browser.close()
    report['browserPassed'] = len(report['cases']) == 2 and all(c['passed'] for c in report['cases'])


try:
    main()
except Exception as error:
    report['failure'] = str(error); report['trace'] = traceback.format_exc()
    print(report['trace'], flush=True)
finally:
    if server:
        server.shutdown()
    save()
print(json.dumps({'browserPassed': report['browserPassed'], 'evidence': str(REPORT)}, ensure_ascii=False), flush=True)
sys.exit(0 if report['browserPassed'] else 1)
