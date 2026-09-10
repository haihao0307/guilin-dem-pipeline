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
out = root / 'weather-mother' / 'full-weather-r26-observation-bandwidth-20260911'
out.mkdir(parents=True, exist_ok=True)
errors = []
report = {
    'schema': 'weather-mother-r26-observation-bandwidth-public-qa/1',
    'pageCommit': page_sha,
    'baseR22Commit': '8aeb8dac519f8bda851cfc998e07266870d3eaef',
    'provenR23CloudPageCommit': '001a9e3dc028b3a7719ff8ab96bacdd7b8b1cac8',
    'r25EvidenceHead': 'fc84a4b8603af0dceb0b548990c7c80b811b3219',
    'yoheiCloudAtlasR02Commit': '029d2e564b65a0874af439232ca8856c42981a14',
    'url': url,
    'target': '390x844 prefix-preserving observation bandwidth with R25 optical aircraft attenuation',
    'realIPhoneAcceptance': False,
    'sharedDepth': False,
    'depthFBO': False,
    'productionReady': False,
}
iphone_ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'


def corr(a, b):
    ma, mb = sum(a)/len(a), sum(b)/len(b)
    da = [x-ma for x in a]
    db = [x-mb for x in b]
    num = sum(x*y for x, y in zip(da, db))
    den = math.sqrt(sum(x*x for x in da) * sum(y*y for y in db))
    return num/den if den > 1e-9 else 1.0


def image_metrics(frame):
    return frame.evaluate("""() => {
      const gl=AircraftWorld.gl(), c=document.getElementById('c'), w=c.width, h=c.height;
      const px=new Uint8Array(w*h*4); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);
      const lum=(x,y)=>{const i=(y*w+x)*4;return .2126*px[i]+.7152*px[i+1]+.0722*px[i+2];};
      let hf=0,n=0,mean=0,mn=255,mx=0;
      for(let y=1;y<h-1;y+=3)for(let x=1;x<w-1;x+=3){const l=lum(x,y);mean+=l;mn=Math.min(mn,l);mx=Math.max(mx,l);hf+=Math.abs(l-lum(x+1,y))+Math.abs(l-lum(x,y+1));n++;}
      const grid=[];const gxN=12,gyN=20;
      for(let gy=0;gy<gyN;gy++)for(let gx=0;gx<gxN;gx++){
        const x0=Math.floor(gx*w/gxN),x1=Math.max(x0+1,Math.floor((gx+1)*w/gxN));
        const y0=Math.floor(gy*h/gyN),y1=Math.max(y0+1,Math.floor((gy+1)*h/gyN));
        let s=0,k=0;for(let y=y0;y<y1;y+=3)for(let x=x0;x<x1;x+=3){s+=lum(x,y);k++;}grid.push(k?s/k:0);
      }
      return {w,h,hf:hf/Math.max(n,1),mean:mean/Math.max(n,1),range:mx-mn,grid};
    }""")


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
    page.wait_for_function("document.querySelector('iframe[data-key=aircraft]')?.dataset.mobileAircraftDirect==='r26'", timeout=30000)

    target = None
    deadline = time.time() + 90
    while time.time() < deadline and target is None:
        for frame in page.frames:
            try:
                if frame.evaluate('Boolean(window.WeatherMobileR26 && window.WeatherMobileR25)'):
                    target = frame
                    break
            except Exception:
                pass
        if target is None:
            time.sleep(.2)
    assert target is not None, 'R26 mobile frame not found'
    target.wait_for_function('WeatherMobileR26.qa.ready && WeatherMobileR26.qa.frames>=10 && WeatherMobileR25.qa.ready', timeout=120000)

    cloud0 = target.evaluate('WeatherMobileR26.qa')
    optical0 = target.evaluate('WeatherMobileR25.qa')
    state0 = target.evaluate('WeatherMobileR26.getState()')
    assert cloud0['ready'] and cloud0['errors'] == [], cloud0
    assert cloud0['variance'] > 12, cloud0
    assert cloud0['observationBandwidth'] is True and cloud0['detailPolicy'] == 'prefix-preserving', cloud0
    assert optical0['ready'] and optical0['errors'] == [], optical0
    assert optical0['opticalOcclusion'] is True and optical0['depthFBO'] is False and optical0['sharedDepth'] is False, optical0

    weights = target.evaluate("""({
      near:WeatherMobileR26.observationWeight(2),
      transition:WeatherMobileR26.observationWeight(20),
      far:WeatherMobileR26.observationWeight(30)
    })""")
    assert abs(weights['near']-1) < 1e-9, weights
    assert 0 < weights['transition'] < 1, weights
    assert abs(weights['far']) < 1e-9, weights

    # Freeze world state and compare only the observation bandwidth. The cloud
    # envelope/identity is unchanged; only detail terms are allowed to differ.
    target.evaluate('window.cloudModuleHidden=true; WeatherMobileR25.setAircraftVisible(false); WeatherMobileR26.setObservationOverride(1)')
    page.wait_for_timeout(450)
    full = image_metrics(target)
    target.evaluate('WeatherMobileR26.setObservationOverride(0)')
    page.wait_for_timeout(450)
    coarse = image_metrics(target)
    structural_corr = corr(full['grid'], coarse['grid'])
    grid_mae = sum(abs(a-b) for a,b in zip(full['grid'], coarse['grid'])) / len(full['grid'])
    assert full['range'] > 25 and coarse['range'] > 25, (full['range'], coarse['range'])
    assert structural_corr > .72, structural_corr
    assert grid_mae > .08, grid_mae
    # The far representation must not gain high-frequency energy. A small 4%
    # numerical allowance covers tone-mapping edge shifts on SwiftShader.
    assert coarse['hf'] <= full['hf'] * 1.04, (full['hf'], coarse['hf'])
    target.evaluate('WeatherMobileR26.setObservationOverride(null); WeatherMobileR25.setAircraftVisible(true); window.cloudModuleHidden=false')
    page.wait_for_timeout(300)

    # R25 optical attenuation remains live after the cloud representation change.
    probes = target.evaluate("""({
      free: WeatherMobileR25.probeTransmittance([0,4.4,4.8],'silver',0,0,-.02),
      edge: WeatherMobileR25.probeTransmittance([0,4.0,-3.5],'silver',0,0,-.02),
      inside: WeatherMobileR25.probeTransmittance([0,4.0,-6.0],'silver',0,0,-.02)
    })""")
    assert probes['free'] > .95 and .15 < probes['edge'] < .85 and probes['inside'] < .20, probes
    assert probes['free'] > probes['edge'] > probes['inside'], probes

    target.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'d'}))")
    page.wait_for_timeout(420)
    target.evaluate("window.dispatchEvent(new KeyboardEvent('keyup',{key:'d'}))")
    page.wait_for_timeout(180)
    state1 = target.evaluate('WeatherMobileR26.getState()')
    assert abs(state1['yaw'] - state0['yaw']) > .01, (state0, state1)
    assert abs(state1['roll'] - state0['roll']) > .01, (state0, state1)

    page.locator('nav button[data-scene="sea"]').click()
    target.wait_for_function("WeatherMobileR26.qa.scene==='sea'", timeout=15000)
    sea = target.evaluate('WeatherMobileR26.qa.scene')
    page.locator('nav button[data-scene="silver"]').click()
    target.wait_for_function("WeatherMobileR26.qa.scene==='silver'", timeout=15000)
    silver = target.evaluate('WeatherMobileR26.qa.scene')

    overflow = page.evaluate('({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})')
    nav = page.locator('nav').bounding_box()
    assert overflow['x'] <= 1, overflow
    assert nav and nav['x'] >= -1 and nav['x'] + nav['width'] <= 391, nav

    screenshot = out / 'PUBLIC_R26_MOBILE_OBSERVATION_BANDWIDTH_390x844.png'
    page.screenshot(path=str(screenshot), full_page=False, timeout=60000)
    report.update({
        'overallPass': not errors,
        'cloudQA': cloud0,
        'opticalQA': optical0,
        'observationWeights': weights,
        'fullDetailMetrics': {k:v for k,v in full.items() if k != 'grid'},
        'coarseDetailMetrics': {k:v for k,v in coarse.items() if k != 'grid'},
        'largeScaleGridCorrelation': structural_corr,
        'largeScaleGridMAE': grid_mae,
        'r25TransmittanceProbes': probes,
        'beforeFlightInput': state0,
        'afterFlightInput': state1,
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

(out / 'PUBLIC_QA_MOBILE_OBSERVATION_BANDWIDTH_2026-09-11.json').write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
)
print(json.dumps(report, ensure_ascii=False, indent=2))
assert report['overallPass']
