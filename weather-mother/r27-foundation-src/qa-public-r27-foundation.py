from __future__ import annotations

import json
import math
import os
import pathlib
import time
from playwright.sync_api import sync_playwright

url = os.environ['PUBLIC_URL']
page_sha = os.environ['PAGE_SHA']
root = pathlib.Path(os.environ['GITHUB_WORKSPACE'])
out = root / 'weather-mother' / 'full-weather-r27-foundation-20260913'
out.mkdir(parents=True, exist_ok=True)
errors = []
report = {
    'schema': 'weather-mother-r27-foundation-public-qa/1',
    'pageCommit': page_sha,
    'url': url,
    'target': '390x844 R26-regression-preserving units/clock/optics foundation',
    'baseR22Commit': '8aeb8dac519f8bda851cfc998e07266870d3eaef',
    'provenR23CloudPageCommit': '001a9e3dc028b3a7719ff8ab96bacdd7b8b1cac8',
    'r26ObservationPageCommit': '26c1b48fc48172ba64fe2d867f4f59a6584ccb33',
    'publicBrowserQA': False,
    'realDeviceQA': False,
    'visualAcceptance': False,
    'productionReady': False,
}
iphone_ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'


def dist(a, b):
    return math.sqrt(sum((x-y)**2 for x, y in zip(a, b)))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=[
        '--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader-webgl',
        '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'
    ])
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1,
                              is_mobile=True, has_touch=True, user_agent=iphone_ua)
    ctx.add_cookies([{'name':'__Http-phish','value':'1','url':'https://raw.githack.com/',
                      'secure':True,'httpOnly':True,'sameSite':'Lax'}])
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append({'type':'pageerror','message':str(e)}))
    page.on('requestfailed', lambda r: errors.append({'type':'request','url':r.url,'message':str(r.failure or '')}))

    nav_start = time.perf_counter()
    response = page.goto(url + '?qa=' + str(time.time_ns()), wait_until='domcontentloaded', timeout=90000)
    assert response and response.status == 200, response.status if response else None
    page.wait_for_selector('nav button[data-scene="silver"]', timeout=30000)

    target = None
    first_cloud_ms = None
    deadline = time.time() + 120
    while time.time() < deadline and target is None:
        for frame in page.frames:
            try:
                if frame.evaluate('Boolean(window.WeatherMobileR27Foundation && window.WeatherMobileR25)'):
                    target = frame
                    break
            except Exception:
                pass
        if target is None:
            time.sleep(.1)
    assert target is not None, 'R27 foundation mobile frame not found'

    target.wait_for_function('WeatherMobileR27Foundation.qa.ready && WeatherMobileR27Foundation.qa.frames>=1', timeout=120000)
    first_cloud_ms = (time.perf_counter() - nav_start) * 1000
    target.wait_for_function('WeatherMobileR27Foundation.qa.frames>=10 && WeatherMobileR25.qa.ready', timeout=120000)
    stable_ms = (time.perf_counter() - nav_start) * 1000

    q = target.evaluate('WeatherMobileR27Foundation.qa')
    oq = target.evaluate('WeatherMobileR25.qa')
    assert q['ready'] and q['errors'] == [], q
    assert q['units'] == {'position':'km','speed':'m/s','time':'s','extinction':'km^-1'}, q
    assert q['speedIntegration'] == 'mps-to-kmps-1e-3', q
    assert q['worldClockIndependent'] is True and q['opticalStepIntegration'] is True, q
    assert q['observationBandwidth'] is True and q['detailPolicy'] == 'prefix-preserving', q
    assert q['visualAcceptance'] is False and q['realDeviceQA'] is False and q['productionReady'] is False, q
    assert oq['ready'] and oq['errors'] == [], oq
    assert oq.get('opticalUnits') == 'km-km^-1', oq
    assert oq['depthFBO'] is False and oq['sharedDepth'] is False, oq

    # Freeze Cloud time but keep flight observer advancing. This is the core
    # frame-diff/pause-clock gate missing from R23-R26.
    target.evaluate('WeatherMobileR27Foundation.setWorldPlaying(false); WeatherMobileR27Foundation.setFlying(true)')
    before = target.evaluate('({state:WeatherMobileR27Foundation.getState(),clock:WeatherMobileR27Foundation.getWorldClockState()})')
    target.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'d'}))")
    page.wait_for_timeout(650)
    target.evaluate("window.dispatchEvent(new KeyboardEvent('keyup',{key:'d'}))")
    page.wait_for_timeout(100)
    after = target.evaluate('({state:WeatherMobileR27Foundation.getState(),clock:WeatherMobileR27Foundation.getWorldClockState()})')
    frozen_dt = after['clock']['timeS'] - before['clock']['timeS']
    observer_move_km = dist(after['state']['position'], before['state']['position'])
    yaw_delta = abs(after['state']['yaw'] - before['state']['yaw'])
    assert abs(frozen_dt) < 1e-9, (before, after)
    assert observer_move_km > 0.002 and yaw_delta > 0.01, (observer_move_km, yaw_delta)

    target.evaluate('WeatherMobileR27Foundation.setWorldPlaying(true)')
    resume0 = target.evaluate('WeatherMobileR27Foundation.getWorldClockState().timeS')
    page.wait_for_timeout(350)
    resume1 = target.evaluate('WeatherMobileR27Foundation.getWorldClockState().timeS')
    assert resume1 > resume0, (resume0, resume1)

    # R25 optical ordering must remain intact after making units explicit.
    probes = target.evaluate("""({
      free: WeatherMobileR25.probeTransmittance([0,4.4,4.8],'silver',0,0,-.02),
      edge: WeatherMobileR25.probeTransmittance([0,4.0,-3.5],'silver',0,0,-.02),
      inside: WeatherMobileR25.probeTransmittance([0,4.0,-6.0],'silver',0,0,-.02)
    })""")
    assert probes['free'] > .95 and .15 < probes['edge'] < .85 and probes['inside'] < .20, probes
    assert probes['free'] > probes['edge'] > probes['inside'], probes

    # Record a SwiftShader browser throughput baseline, not a real-device FPS claim.
    f0 = target.evaluate('WeatherMobileR27Foundation.qa.frames')
    t0 = time.perf_counter()
    page.wait_for_timeout(1000)
    elapsed = time.perf_counter() - t0
    f1 = target.evaluate('WeatherMobileR27Foundation.qa.frames')
    browser_fps = (f1 - f0) / max(elapsed, 1e-6)
    assert browser_fps > 0, browser_fps

    outer_overflow = page.evaluate('({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})')
    inner_overflow = target.evaluate('({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})')
    nav = page.locator('nav').bounding_box()
    assert outer_overflow['x'] <= 1, outer_overflow
    assert inner_overflow['x'] <= 1, inner_overflow
    assert nav and nav['x'] >= -1 and nav['x'] + nav['width'] <= 391, nav

    shot = out / 'PUBLIC_R27_FOUNDATION_390x844.png'
    page.screenshot(path=str(shot), full_page=False, timeout=60000)
    report.update({
        'publicBrowserQA': not errors,
        'cloudQA': q,
        'opticalQA': oq,
        'firstCloudFrameMs': first_cloud_ms,
        'stableReadyMs': stable_ms,
        'frozenWorldDeltaS': frozen_dt,
        'observerMoveWhileFrozenKm': observer_move_km,
        'yawDeltaWhileFrozenRad': yaw_delta,
        'resumeWorldDeltaS': resume1 - resume0,
        'r25TransmittanceProbes': probes,
        'swiftShaderBrowserFps': browser_fps,
        'outerOverflow': outer_overflow,
        'innerOverflow': inner_overflow,
        'navBox': nav,
        'errors': errors,
        'screenshot': shot.name,
    })
    assert not errors, errors
    ctx.close()
    browser.close()

report_path = out / 'PUBLIC_QA_R27_FOUNDATION_2026-09-13.json'
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
assert report['publicBrowserQA']
