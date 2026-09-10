from __future__ import annotations
import json
import os
import pathlib
import time
from playwright.sync_api import sync_playwright

url = os.environ['PUBLIC_URL']
page_sha = os.environ['PAGE_SHA']
root = pathlib.Path(os.environ['GITHUB_WORKSPACE'])
out = root / 'weather-mother' / 'full-weather-r25-mobile-cloud-occlusion-20260911'
out.mkdir(parents=True, exist_ok=True)
errors = []
report = {
    'schema': 'weather-mother-r25-mobile-cloud-occlusion-public-qa/1',
    'pageCommit': page_sha,
    'baseR22Commit': '8aeb8dac519f8bda851cfc998e07266870d3eaef',
    'acceptedR21CoreCommit': 'd6796df38a2cb872f58ff1f8ce72b5f36d8d2322',
    'provenR23CloudPageCommit': '001a9e3dc028b3a7719ff8ab96bacdd7b8b1cac8',
    'r24EvidenceCommit': '9466cce7ea0c0ad38b24324aa9ea2800872c99c5',
    'url': url,
    'target': '390x844 mobile cloud-aware aircraft attenuation without FBO regression',
    'realIPhoneAcceptance': False,
    'sharedDepth': False,
    'depthFBO': False,
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
    page.wait_for_function("document.querySelector('iframe[data-key=aircraft]')?.dataset.mobileAircraftDirect==='r25'", timeout=30000)

    target = None
    deadline = time.time() + 90
    while time.time() < deadline and target is None:
        for frame in page.frames:
            try:
                if frame.evaluate('Boolean(window.WeatherMobileR25)'):
                    target = frame
                    break
            except Exception:
                pass
        if target is None:
            time.sleep(.2)
    assert target is not None, 'R25 mobile cloud-occlusion frame not found'
    target.wait_for_function('WeatherMobileR25.qa.ready && WeatherMobileR25.qa.frames>=8', timeout=120000)

    base_qa = target.evaluate('WeatherMobileR23.qa')
    qa0 = target.evaluate('WeatherMobileR25.qa')
    state0 = target.evaluate('WeatherMobileR25.getState()')
    assert base_qa['ready'] and base_qa['errors'] == [], base_qa
    assert base_qa['variance'] > 12, base_qa
    assert qa0['ready'] and qa0['errors'] == [], qa0
    assert qa0['alphaPixels'] > 20, qa0
    assert qa0['opticalOcclusion'] is True and qa0['sharedDepth'] is False and qa0['depthFBO'] is False, qa0
    assert qa0['cloudVisibleInvariant'] is True
    assert target.locator('#aircraft-cloud-occlusion-r25').count() == 1

    # The CPU mirror must produce a monotone optical transition from clear air,
    # through a cloud edge, to a dense cloud interior. This is a numerical gate,
    # not a claim of calibrated atmospheric extinction in SI units.
    probes = target.evaluate("""({
      free: WeatherMobileR25.probeTransmittance([0,4.4,4.8],'silver',0,0,-.02),
      edge: WeatherMobileR25.probeTransmittance([0,4.0,-3.5],'silver',0,0,-.02),
      inside: WeatherMobileR25.probeTransmittance([0,4.0,-6.0],'silver',0,0,-.02)
    })""")
    assert probes['free'] > .95, probes
    assert .15 < probes['edge'] < .85, probes
    assert probes['inside'] < .20, probes
    assert probes['free'] > probes['edge'] > probes['inside'], probes

    # Verify that transmittance actually attenuates aircraft pixels while the
    # proven R23 cloud renderer stays untouched. The override is only a QA hook.
    target.evaluate('WeatherMobileR25.setDebugTransmittanceOverride(1)')
    page.wait_for_timeout(350)
    clear_alpha = target.evaluate('WeatherMobileR25.measureNow()')
    cloud_before_occlusion = target.evaluate('WeatherMobileR23.qa')
    target.evaluate('WeatherMobileR25.setDebugTransmittanceOverride(.08)')
    page.wait_for_timeout(350)
    thick_alpha = target.evaluate('WeatherMobileR25.measureNow()')
    cloud_after_occlusion = target.evaluate('WeatherMobileR23.qa')
    assert clear_alpha['alphaSum'] > 1000, clear_alpha
    assert thick_alpha['alphaSum'] < clear_alpha['alphaSum'] * .35, (clear_alpha, thick_alpha)
    assert cloud_before_occlusion['variance'] == cloud_after_occlusion['variance'], (cloud_before_occlusion, cloud_after_occlusion)
    assert cloud_after_occlusion['ready'] and cloud_after_occlusion['errors'] == []
    target.evaluate('WeatherMobileR25.setDebugTransmittanceOverride(null)')
    page.wait_for_timeout(250)

    # Plane visibility remains independently switchable and must never affect cloud state.
    target.evaluate('WeatherMobileR25.setAircraftVisible(false)')
    page.wait_for_timeout(180)
    hidden_state = target.evaluate('WeatherMobileR25.getState()')
    cloud_after_hide = target.evaluate('WeatherMobileR23.qa')
    assert hidden_state['aircraftVisible'] is False
    assert cloud_after_hide['ready'] and cloud_after_hide['variance'] > 12 and cloud_after_hide['errors'] == []
    target.evaluate('WeatherMobileR25.setAircraftVisible(true)')
    page.wait_for_timeout(220)

    # Flight input still changes the accepted R23 state and R25 follows it.
    target.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'d'}))")
    page.wait_for_timeout(420)
    target.evaluate("window.dispatchEvent(new KeyboardEvent('keyup',{key:'d'}))")
    page.wait_for_timeout(180)
    state1 = target.evaluate('WeatherMobileR25.getState()')
    qa1 = target.evaluate('WeatherMobileR25.qa')
    assert abs(state1['yaw'] - state0['yaw']) > .01, (state0, state1)
    assert abs(state1['roll'] - state0['roll']) > .01, (state0, state1)
    assert abs(qa1['lastRoll']) > .01, qa1
    assert 0 <= state1['cloudTransmittance'] <= 1, state1

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

    screenshot = out / 'PUBLIC_R25_MOBILE_CLOUD_OCCLUSION_390x844.png'
    page.screenshot(path=str(screenshot), full_page=False, timeout=60000)
    report.update({
        'overallPass': not errors,
        'cloudQA': base_qa,
        'occlusionQA': qa1,
        'transmittanceProbes': probes,
        'clearAircraftAlpha': clear_alpha,
        'thickCloudAircraftAlpha': thick_alpha,
        'cloudVarianceBeforeOcclusion': cloud_before_occlusion['variance'],
        'cloudVarianceAfterOcclusion': cloud_after_occlusion['variance'],
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

(out / 'PUBLIC_QA_MOBILE_CLOUD_OCCLUSION_2026-09-11.json').write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
)
print(json.dumps(report, ensure_ascii=False, indent=2))
assert report['overallPass']
