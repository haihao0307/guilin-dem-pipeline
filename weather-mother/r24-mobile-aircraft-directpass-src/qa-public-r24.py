from __future__ import annotations
import json
import os
import pathlib
import time
from playwright.sync_api import sync_playwright

url = os.environ['PUBLIC_URL']
page_sha = os.environ['PAGE_SHA']
root = pathlib.Path(os.environ['GITHUB_WORKSPACE'])
out = root / 'weather-mother' / 'full-weather-r24-mobile-aircraft-directpass-20260911'
out.mkdir(parents=True, exist_ok=True)
errors = []
report = {
    'schema': 'weather-mother-r24-mobile-aircraft-directpass-public-qa/1',
    'pageCommit': page_sha,
    'baseR22Commit': '8aeb8dac519f8bda851cfc998e07266870d3eaef',
    'acceptedR21CoreCommit': 'd6796df38a2cb872f58ff1f8ce72b5f36d8d2322',
    'provenR23CloudPageCommit': '001a9e3dc028b3a7719ff8ab96bacdd7b8b1cac8',
    'url': url,
    'target': '390x844 mobile aircraft direct-pass without cloud regression',
    'realIPhoneAcceptance': False,
    'sharedDepth': False,
    'productionReady': False,
}
iphone_ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'

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
    response = page.goto(url + '?qa=' + str(time.time_ns()), wait_until='domcontentloaded', timeout=90000)
    assert response and response.status == 200, response.status if response else None
    page.wait_for_selector('nav button[data-scene="silver"]', timeout=30000)
    page.wait_for_function("document.querySelector('iframe[data-key=aircraft]')?.dataset.mobileAircraftDirect==='r24'", timeout=30000)

    target = None
    deadline = time.time() + 90
    while time.time() < deadline and target is None:
        for frame in page.frames:
            try:
                if frame.evaluate('Boolean(window.WeatherMobileR24)'):
                    target = frame
                    break
            except Exception:
                pass
        if target is None:
            time.sleep(.2)
    assert target is not None, 'R24 mobile aircraft frame not found'
    target.wait_for_function('WeatherMobileR24.qa.ready && WeatherMobileR24.qa.frames>=8', timeout=120000)

    base_qa = target.evaluate('WeatherMobileR23.qa')
    aircraft_qa = target.evaluate('WeatherMobileR24.qa')
    state0 = target.evaluate('WeatherMobileR24.getState()')
    assert base_qa['ready'] and base_qa['errors'] == [], base_qa
    assert base_qa['variance'] > 12, base_qa
    assert aircraft_qa['ready'] and aircraft_qa['errors'] == [], aircraft_qa
    assert aircraft_qa['alphaPixels'] > 20, aircraft_qa
    assert aircraft_qa['directPass'] is True and aircraft_qa['sharedDepth'] is False, aircraft_qa
    assert target.locator('#aircraft-directpass-r24').count() == 1

    # Plane visibility must be independently switchable without touching the cloud renderer.
    target.evaluate('WeatherMobileR24.setAircraftVisible(false)')
    page.wait_for_timeout(180)
    hidden_state = target.evaluate('WeatherMobileR24.getState()')
    cloud_after_hide = target.evaluate('WeatherMobileR23.qa')
    assert hidden_state['aircraftVisible'] is False
    assert cloud_after_hide['ready'] and cloud_after_hide['variance'] > 12 and cloud_after_hide['errors'] == []
    target.evaluate('WeatherMobileR24.setAircraftVisible(true)')
    page.wait_for_timeout(220)

    # Flight input still changes the proven R23 state; overlay must follow bank/roll.
    target.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'d'}))")
    page.wait_for_timeout(420)
    target.evaluate("window.dispatchEvent(new KeyboardEvent('keyup',{key:'d'}))")
    page.wait_for_timeout(180)
    state1 = target.evaluate('WeatherMobileR24.getState()')
    aircraft_qa1 = target.evaluate('WeatherMobileR24.qa')
    assert abs(state1['yaw'] - state0['yaw']) > .01, (state0, state1)
    assert abs(state1['roll'] - state0['roll']) > .01, (state0, state1)
    assert abs(aircraft_qa1['lastRoll']) > .01, aircraft_qa1

    # Accepted cloud scenes remain connected through the wrapper.
    page.locator('nav button[data-scene="sea"]').click()
    target.wait_for_function("WeatherMobileR23.qa.scene==='sea'", timeout=15000)
    sea = target.evaluate('WeatherMobileR23.qa.scene')
    page.locator('nav button[data-scene="silver"]').click()
    target.wait_for_function("WeatherMobileR23.qa.scene==='silver'", timeout=15000)
    silver = target.evaluate('WeatherMobileR23.qa.scene')

    overflow = page.evaluate('({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})')
    nav = page.locator('nav').bounding_box()
    assert overflow['x'] <= 1, overflow
    assert nav and nav['x'] >= -1 and nav['x'] + nav['width'] <= 391, nav

    screenshot = out / 'PUBLIC_R24_MOBILE_AIRCRAFT_390x844.png'
    page.screenshot(path=str(screenshot), full_page=False, timeout=60000)
    report.update({
        'overallPass': not errors,
        'cloudQA': base_qa,
        'aircraftQA': aircraft_qa1,
        'beforeFlightInput': state0,
        'afterFlightInput': state1,
        'cloudStillVisibleWithAircraftHidden': cloud_after_hide['variance'] > 12,
        'seaSwitch': sea,
        'silverSwitch': silver,
        'overflow': overflow,
        'navBox': nav,
        'errors': errors,
        'screenshot': screenshot.name,
    })
    assert not errors, errors
    ctx.close()
    browser.close()

(out / 'PUBLIC_QA_MOBILE_AIRCRAFT_2026-09-11.json').write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
)
print(json.dumps(report, ensure_ascii=False, indent=2))
assert report['overallPass']
