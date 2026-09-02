"""Real-browser QA for the compact map-first Wenzhou workbench.

The Weather renderer remains active offscreen. The user-facing viewport contains
one complete Wenzhou map, a 42 px toolbar and a small status strip.
"""
from pathlib import Path
import argparse, json, math, traceback
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument('--url', required=True)
p.add_argument('--out', type=Path, required=True)
p.add_argument('--chromium')
a = p.parse_args()
a.out.mkdir(parents=True, exist_ok=True)
report = {'schema': 'wenzhou-compact-workbench-browser-qa-1', 'url': a.url, 'passed': False, 'tests': [], 'cases': [], 'visualApproved': False, 'productionApproved': False}


def write():
    (a.out / 'browser-qa.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def check(name, condition, detail=None):
    report['tests'].append({'name': name, 'passed': bool(condition), 'detail': detail})
    write()
    if not condition:
        raise AssertionError(name + ': ' + repr(detail))


def wait(page, expression, timeout=90000):
    page.wait_for_function(expression, timeout=timeout)


def terrain(page):
    return page.locator('#terrain').element_handle().content_frame()


def weather(page):
    return page.locator('#weather').element_handle().content_frame()


def native_ready(page, case):
    wait(page, f"window.__WZ_WORKBENCH__?.lastFrame?.identity.weather==={json.dumps(case)} && window.__WZ_WORKBENCH__?.bridgeStatus==='receiving'", 150000)


def camera_distance(frame):
    q = frame.evaluate('window.__WZ_FULL__')
    return math.dist(q['eye'], q['target'])


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=a.chromium or pw.chromium.executable_path, headless=True, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'])
    report['browserVersion'] = browser.version
    try:
        for kind, width, height, mobile in [('ultrawide', 2560, 1080, False), ('mobile', 390, 844, True)]:
            context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
            page = context.new_page()
            page.set_default_timeout(120000)
            case = {'name': kind, 'viewport': [width, height], 'consoleErrors': [], 'pageErrors': [], 'failedRequests': [], 'badResponses': [], 'imageRequests': [], 'passed': False}
            report['cases'].append(case)
            page.on('console', lambda message: case['consoleErrors'].append(message.text) if message.type == 'error' else None)
            page.on('pageerror', lambda error: case['pageErrors'].append(str(error)))
            page.on('requestfailed', lambda request: case['failedRequests'].append({'url': request.url, 'error': request.failure}))
            page.on('response', lambda response: case['badResponses'].append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
            page.on('request', lambda request: case['imageRequests'].append(request.url) if request.resource_type == 'image' and not request.url.startswith('data:') else None)
            try:
                response = page.goto(a.url, wait_until='domcontentloaded', timeout=90000)
                check(kind + ' entry HTTP 200', response and response.status == 200, response.status if response else None)
                wait(page, "window.__WZ_WORKBENCH__?.ready || window.__WZ_WORKBENCH__?.errors.length", 180000)
                q = page.evaluate('window.__WZ_WORKBENCH__')
                check(kind + ' workbench ready', q['ready'], q.get('errors'))
                check(kind + ' compact version', q['version'] == 'wenzhou-workbench-0.2.0-compact-weather110', q['version'])
                native_ready(page, 'coast')
                t = terrain(page)
                w = weather(page)
                wait(page, "window.__WZ_WORKBENCH__.terrain?.weather.active===true")
                check(kind + ' complete V200 overview', t.evaluate('window.__WZ_FULL__.overviewGrid.join()') == '276,281')
                check(kind + ' source package identity', q['checks']['files'] == 12 and q['sourceIdentityVerified'], q['checks'])
                check(kind + ' weather catalog', q['weatherCases'] == 20 and q['cloudGenera'] == 10, [q['weatherCases'], q['cloudGenera']])
                check(kind + ' map shader linked', t.evaluate('window.__WZ_FULL__.shaderLinked'))

                top = page.locator('#topbar').bounding_box()
                status = page.locator('#statusbar').bounding_box()
                map_box = page.locator('#terrain').bounding_box()
                weather_box = page.locator('#weather').bounding_box()
                check(kind + ' top bar compact', top['height'] <= 44, top)
                check(kind + ' status strip compact', status['height'] <= (36 if mobile else 26), status)
                check(kind + ' map fills width', map_box['width'] >= width - 2, map_box)
                check(kind + ' map receives large height', map_box['height'] >= height - top['height'] - status['height'] - 2, map_box)
                check(kind + ' no visible weather panel', page.locator('.weather-pane').count() == 0 and weather_box['x'] + weather_box['width'] < 0, weather_box)
                check(kind + ' weather engine still running', w.evaluate('WeatherMother.qa.ready && WeatherMother.qa.frames>0'))
                check(kind + ' inner title removed', t.locator('header').evaluate("e=>getComputedStyle(e).display") == 'none')
                if not mobile:
                    panel_box = t.locator('#panel').bounding_box()
                    check('ultrawide inner panel narrow', panel_box['width'] <= 216, panel_box)
                page.screenshot(path=str(a.out / f'{kind}-compact-workbench.png'), timeout=120000)

                page.evaluate("WenzhouWorkbench.bridge.control('quality','balanced')")
                wait(page, "document.querySelector('#weather').contentWindow.WeatherMother.qa.steps===112")
                page.locator('#pause').click()
                page.wait_for_timeout(700)
                t0 = w.evaluate('WeatherMother.qa.simulationTimeS')
                page.wait_for_timeout(400)
                t1 = w.evaluate('WeatherMother.qa.simulationTimeS')
                check(kind + ' hidden weather pause works', t0 == t1, [t0, t1])
                source_hash = t.evaluate('window.__WZ_API__.sourceHash()')
                case['sourceHash'] = source_hash

                before = camera_distance(t)
                page.locator('#zoomIn').click()
                wait(page, f"(()=>{{const q=document.querySelector('#terrain').contentWindow.__WZ_FULL__;return Math.hypot(q.eye[0]-q.target[0],q.eye[1]-q.target[1],q.eye[2]-q.target[2])<{before * 0.85}}})()")
                after = camera_distance(t)
                check(kind + ' compact zoom-in control', after < before * 0.85, [before, after])
                page.locator('#viewHome').click()
                wait(page, "document.querySelector('#terrain').contentWindow.__WZ_FULL__.eye[1]>100000")

                page.locator('#panelToggle').click()
                if mobile:
                    wait(page, "document.querySelector('#terrain').contentWindow.document.querySelector('#panel').classList.contains('open')")
                else:
                    wait(page, "document.querySelector('#terrain').contentWindow.document.querySelector('#panel').classList.contains('hidden')")
                page.locator('#panelToggle').click()
                if mobile:
                    wait(page, "!document.querySelector('#terrain').contentWindow.document.querySelector('#panel').classList.contains('open')")
                else:
                    wait(page, "!document.querySelector('#terrain').contentWindow.document.querySelector('#panel').classList.contains('hidden')")
                check(kind + ' compact panel toggle', True)

                if not mobile:
                    page.screenshot(path=str(a.out / 'map-water-on.png'), clip=map_box, timeout=120000)
                    t.evaluate("document.querySelector('#waterOn').checked=false")
                    t.wait_for_function('window.__WZ_FULL__.renderedWater===false')
                    page.screenshot(path=str(a.out / 'map-water-off.png'), clip=map_box, timeout=120000)
                    image_a = np.asarray(Image.open(a.out / 'map-water-on.png').convert('RGB')).astype('int16')
                    image_b = np.asarray(Image.open(a.out / 'map-water-off.png').convert('RGB')).astype('int16')
                    changed = int((np.max(np.abs(image_a - image_b), axis=2) > 12).sum())
                    check('actual visible sea in large map', changed > 2000, changed)
                    t.evaluate("document.querySelector('#waterOn').checked=true")
                    t.wait_for_function('window.__WZ_FULL__.renderedWater===true')

                    page.evaluate("WenzhouWorkbench.bridge.control('direction',270);WenzhouWorkbench.bridge.control('wind',18);WenzhouWorkbench.bridge.control('cloudSpeed',4)")
                    wait(page, "Math.abs(window.__WZ_WORKBENCH__.lastFrame.wind.speedMps-18)<.03 && Math.abs(window.__WZ_WORKBENCH__.lastFrame.wind.fromDegrees-270)<.1")
                    frame = page.evaluate('window.__WZ_WORKBENCH__.lastFrame')
                    check('wind and cloud speed remain independent', abs(frame['cloud']['speedMps'] - 4) < .03 and abs(frame['wind']['velocityMps'][0] - 18) < .05, frame['wind'])
                    wave_a = t.evaluate('window.__WZ_API__.getWindWaveAt(321.5,871.25)')
                    page.evaluate("WenzhouWorkbench.bridge.control('direction',90)")
                    wait(page, "Math.abs(window.__WZ_WORKBENCH__.lastFrame.wind.fromDegrees-90)<.1")
                    wave_b = t.evaluate('window.__WZ_API__.getWindWaveAt(321.5,871.25)')
                    check('map wave consumes weather direction', abs(wave_a - wave_b) > 1e-4, [wave_a, wave_b])

                for mode, rendered in [('neutral', 0), ('studio', 1), ('diagnostic', 2), ('environment', 3)]:
                    page.locator('#mode').select_option(mode)
                    t.wait_for_function(f"window.__WZ_FULL__.mode==='{mode}' && window.__WZ_FULL__.renderedMode==={rendered}")
                    check(kind + ' source invariant ' + mode, t.evaluate('window.__WZ_API__.sourceHash()') == source_hash)
                page.locator('#case').select_option('rain')
                native_ready(page, 'rain')
                check(kind + ' hidden weather control changes active case', page.evaluate('window.__WZ_WORKBENCH__.lastFrame.identity.weather') == 'rain')
                page.locator('#case').select_option('coast')
                native_ready(page, 'coast')

                if mobile:
                    page.locator('#panelToggle').click()
                    wait(page, "document.querySelector('#terrain').contentWindow.document.querySelector('#panel').classList.contains('open')")
                else:
                    check('ultrawide ground control remains visible', t.locator('#ground').is_visible())
                t.locator('#ground').click()
                t.wait_for_function('window.__WZ_FULL__.ground && window.__WZ_FULL__.clearance>=1.6 && window.__WZ_FULL__.clearance<2')
                ground = t.evaluate('window.__WZ_FULL__')
                check(kind + ' 1.6 m collision', ground['clearance'] >= 1.6, ground['clearance'])
                check(kind + ' truth unchanged', t.evaluate('window.__WZ_API__.sourceHash()') == source_hash)
                page.locator('#viewHome').click()
                wait(page, "!document.querySelector('#terrain').contentWindow.__WZ_FULL__.ground")
                if mobile:
                    page.locator('#panelToggle').click()
                page.screenshot(path=str(a.out / f'{kind}-compact-full-map.png'), timeout=120000)

                page.locator('#inspect').click()
                check(kind + ' evidence dialog', page.locator('#receipt').is_visible())
                page.locator('#close').click()
                case['final'] = page.evaluate('window.__WZ_WORKBENCH__')
                for key in ['consoleErrors', 'pageErrors', 'failedRequests', 'badResponses', 'imageRequests']:
                    check(kind + ' ' + key, len(case[key]) == 0, case[key])
                check(kind + ' approvals remain false', not case['final']['visualApproved'] and not case['final']['productionApproved'])
                case['passed'] = True
                write()
                print('PASS', kind, flush=True)
            except Exception as error:
                case['error'] = str(error)
                case['traceback'] = traceback.format_exc()
                try:
                    case['state'] = page.evaluate('window.__WZ_WORKBENCH__')
                    page.screenshot(path=str(a.out / f'{kind}-failure.png'), timeout=30000)
                except Exception as capture_error:
                    case['captureError'] = str(capture_error)
                write()
                raise
            finally:
                context.close()
        report['passed'] = True
    except Exception as error:
        report['error'] = str(error)
        report['traceback'] = traceback.format_exc()
        print(report['traceback'], flush=True)
    finally:
        browser.close()
        write()

print(json.dumps({'passed': report['passed'], 'checks': len(report['tests'])}, indent=2))
raise SystemExit(0 if report['passed'] else 1)
