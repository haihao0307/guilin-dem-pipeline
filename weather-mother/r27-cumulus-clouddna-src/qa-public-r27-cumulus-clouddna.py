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
out = root / 'weather-mother' / 'full-weather-r27-cumulus-clouddna-20260913'
out.mkdir(parents=True, exist_ok=True)
errors = []
report = {
    'schema': 'weather-mother-r27-cumulus-clouddna-public-qa/1',
    'pageCommit': page_sha,
    'url': url,
    'target': '390x844 same seeded cumulus density for observation and flight on R27 foundation',
    'foundationPageCommit': 'd2575ab765dbceeebcb3544cdc52927f60cac86f',
    'r26ObservationPageCommit': '26c1b48fc48172ba64fe2d867f4f59a6584ccb33',
    'publicBrowserQA': False,
    'realDeviceQA': False,
    'visualAcceptance': False,
    'productionReady': False,
}
iphone_ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'


def max_abs(values):
    return max(abs(float(v)) for v in values)


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
    deadline = time.time() + 120
    while time.time() < deadline and target is None:
        for frame in page.frames:
            try:
                if frame.evaluate('Boolean(window.WeatherMobileR27CumulusDNA && window.WeatherMobileR25)'):
                    target = frame
                    break
            except Exception:
                pass
        if target is None:
            time.sleep(.1)
    assert target is not None, 'R27 cumulus DNA mobile frame not found'

    target.wait_for_function('WeatherMobileR27CumulusDNA.qa.ready && WeatherMobileR27CumulusDNA.qa.frames>=1', timeout=120000)
    first_cloud_ms = (time.perf_counter() - nav_start) * 1000
    target.wait_for_function('WeatherMobileR27CumulusDNA.qa.frames>=10 && WeatherMobileR25.qa.ready', timeout=120000)
    stable_ms = (time.perf_counter() - nav_start) * 1000

    q = target.evaluate('WeatherMobileR27CumulusDNA.qa')
    oq = target.evaluate('WeatherMobileR25.qa')
    assert q['ready'] and q['errors'] == [], q
    assert q['units'] == {'position':'km','speed':'m/s','time':'s','extinction':'km^-1'}, q
    assert q['speedIntegration'] == 'mps-to-kmps-1e-3', q
    assert q['worldClockIndependent'] is True and q['opticalStepIntegration'] is True, q
    assert q['observationBandwidth'] is True and q['detailPolicy'] == 'prefix-preserving', q
    assert q['cumulusCloudDNA'] is True and q['sameCloudForObserveAndFlight'] is True, q
    assert q['canonicalDensityQuery'] is True and q['cpuGpuDNAParametersShared'] is True, q
    assert q['visualAcceptance'] is False and q['realDeviceQA'] is False and q['productionReady'] is False, q
    assert oq['ready'] and oq['errors'] == [], oq
    assert oq.get('sharedCumulusCloudDNA') is True, oq
    assert oq.get('opticalUnits') == 'km-km^-1', oq
    assert oq['depthFBO'] is False and oq['sharedDepth'] is False, oq

    # The reference seed is deliberately a zero-delta continuation of the
    # foundation so this step cannot silently replace the accepted cloud shape.
    dna0 = target.evaluate('WeatherMobileR27CumulusDNA.getCloudDNA()')
    assert dna0['objectSeed'] == 73017 and dna0['detailSeed'] == 991, dna0
    assert max_abs(dna0['objectParams'][:3]) < 1e-12, dna0
    assert abs(float(dna0['objectParams'][3]) - 1.0) < 1e-12, dna0
    assert max_abs(dna0['detailParams']) < 1e-12, dna0

    # Freeze the world clock, then prove that observation and flight query the
    # same non-zero canonical density field. Only the observer mode changes.
    target.evaluate("WeatherMobileR27CumulusDNA.setScene('silver');WeatherMobileR27CumulusDNA.setWorldPlaying(false);WeatherMobileR27CumulusDNA.setViewMode('observe')")
    clock0 = target.evaluate('WeatherMobileR27CumulusDNA.getWorldClockState().timeS')
    default_field = target.evaluate("""() => {
      let best={point:[0,0,0],value:-1},sum=0,sum2=0,n=0;
      for(let y=1.5;y<=7.0;y+=.5)for(let z=-18;z<=0;z+=1)for(let x=-8;x<=8;x+=1){
        const point=[x,y,z],value=WeatherMobileR27CumulusDNA.CloudQuery.sample(point,'silver',WeatherMobileR27CumulusDNA.getWorldClockState().timeS);
        if(value>best.value)best={point,value};sum+=value;sum2+=value*value;n++;
      }
      return {best,sum,sum2,n};
    }""")
    assert default_field['best']['value'] > .01, default_field
    observe_value = target.evaluate("p=>WeatherMobileR27CumulusDNA.CloudQuery.sample(p,'silver',WeatherMobileR27CumulusDNA.getWorldClockState().timeS)", default_field['best']['point'])
    target.evaluate("WeatherMobileR27CumulusDNA.setViewMode('flight')")
    flight_value = target.evaluate("p=>WeatherMobileR27CumulusDNA.CloudQuery.sample(p,'silver',WeatherMobileR27CumulusDNA.getWorldClockState().timeS)", default_field['best']['point'])
    clock1 = target.evaluate('WeatherMobileR27CumulusDNA.getWorldClockState().timeS')
    assert abs(clock1-clock0) < 1e-9, (clock0, clock1)
    assert observe_value == flight_value and observe_value > .01, (observe_value, flight_value)

    # The outer Watch/Drive coordinator must keep exactly the same iframe alive.
    coordinator = page.evaluate("""async()=>{
      const f0=AircraftClouds.frame('aircraft');
      await AircraftClouds.watch();
      const f1=AircraftClouds.frame('aircraft');
      const observe=f1.contentWindow.WeatherMobileR27CumulusDNA.getViewMode();
      await AircraftClouds.drive();
      const f2=AircraftClouds.frame('aircraft');
      const flight=f2.contentWindow.WeatherMobileR27CumulusDNA.getViewMode();
      return {sameFrame:f0===f1&&f1===f2,observe,flight,qa:AircraftClouds.qa};
    }""")
    assert coordinator['sameFrame'] is True, coordinator
    assert coordinator['observe'] == 'observe' and coordinator['flight'] == 'flight', coordinator
    assert coordinator['qa'].get('unifiedCumulusCloudDNA') is True, coordinator
    assert coordinator['qa'].get('observeFlightRenderer') == 'same-aircraft-iframe', coordinator

    # Object seed changes the stable macro envelope; detail seed changes only
    # the frequency coordinates. Compare canonical field signatures, then restore.
    dna_object = target.evaluate('WeatherMobileR27CumulusDNA.setSeeds(73018,991)')
    field_object = target.evaluate("""() => {
      let sum=0,sum2=0,n=0;
      const t=WeatherMobileR27CumulusDNA.getWorldClockState().timeS;
      for(let y=1.5;y<=7.0;y+=.75)for(let z=-18;z<=0;z+=1.5)for(let x=-8;x<=8;x+=1.5){const v=WeatherMobileR27CumulusDNA.CloudQuery.sample([x,y,z],'silver',t);sum+=v;sum2+=v*v;n++;}
      return {sum,sum2,n};
    }""")
    dna_detail = target.evaluate('WeatherMobileR27CumulusDNA.setSeeds(73017,992)')
    field_detail = target.evaluate("""() => {
      let sum=0,sum2=0,n=0;
      const t=WeatherMobileR27CumulusDNA.getWorldClockState().timeS;
      for(let y=1.5;y<=7.0;y+=.75)for(let z=-18;z<=0;z+=1.5)for(let x=-8;x<=8;x+=1.5){const v=WeatherMobileR27CumulusDNA.CloudQuery.sample([x,y,z],'silver',t);sum+=v;sum2+=v*v;n++;}
      return {sum,sum2,n};
    }""")
    target.evaluate('WeatherMobileR27CumulusDNA.setSeeds(73017,991)')
    restored = target.evaluate('WeatherMobileR27CumulusDNA.getCloudDNA()')
    assert max_abs(dna_object['objectParams'][:3]) > 1e-6 or abs(dna_object['objectParams'][3]-1) > 1e-6, dna_object
    assert max_abs(dna_detail['detailParams']) > 1e-6, dna_detail
    assert abs(field_object['sum']-default_field['sum']) > 1e-5 or abs(field_object['sum2']-default_field['sum2']) > 1e-5, (default_field, field_object)
    assert abs(field_detail['sum']-default_field['sum']) > 1e-5 or abs(field_detail['sum2']-default_field['sum2']) > 1e-5, (default_field, field_detail)
    assert restored['objectSeed'] == 73017 and restored['detailSeed'] == 991, restored

    # Foundation optical ordering must remain unchanged at the reference seed.
    probes = target.evaluate("""({
      free: WeatherMobileR25.probeTransmittance([0,4.4,4.8],'silver',0,0,-.02),
      edge: WeatherMobileR25.probeTransmittance([0,4.0,-3.5],'silver',0,0,-.02),
      inside: WeatherMobileR25.probeTransmittance([0,4.0,-6.0],'silver',0,0,-.02)
    })""")
    assert probes['free'] > .95 and .15 < probes['edge'] < .85 and probes['inside'] < .20, probes
    assert probes['free'] > probes['edge'] > probes['inside'], probes

    # Resume world time to reconfirm the foundation clock contract.
    target.evaluate("WeatherMobileR27CumulusDNA.setViewMode('flight');WeatherMobileR27CumulusDNA.setWorldPlaying(true)")
    resume0 = target.evaluate('WeatherMobileR27CumulusDNA.getWorldClockState().timeS')
    page.wait_for_timeout(350)
    resume1 = target.evaluate('WeatherMobileR27CumulusDNA.getWorldClockState().timeS')
    assert resume1 > resume0, (resume0, resume1)

    f0 = target.evaluate('WeatherMobileR27CumulusDNA.qa.frames')
    t0 = time.perf_counter()
    page.wait_for_timeout(1000)
    elapsed = time.perf_counter() - t0
    f1 = target.evaluate('WeatherMobileR27CumulusDNA.qa.frames')
    browser_fps = (f1-f0)/max(elapsed,1e-6)
    assert browser_fps > 0, browser_fps

    outer_overflow = page.evaluate('({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})')
    inner_overflow = target.evaluate('({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})')
    nav = page.locator('nav').bounding_box()
    assert outer_overflow['x'] <= 1, outer_overflow
    assert inner_overflow['x'] <= 1, inner_overflow
    assert nav and nav['x'] >= -1 and nav['x']+nav['width'] <= 391, nav

    # Evidence screenshot is left in observation mode so reviewers can see the
    # new same-cloud state; this is evidence, not visual acceptance.
    await_state = page.evaluate("AircraftClouds.watch().then(()=>AircraftClouds.frame('aircraft').contentWindow.WeatherMobileR27CumulusDNA.getViewMode())")
    assert await_state == 'observe', await_state
    page.wait_for_timeout(300)
    shot = out / 'PUBLIC_R27_CUMULUS_DNA_OBSERVE_390x844.png'
    page.screenshot(path=str(shot), full_page=False, timeout=60000)

    report.update({
        'publicBrowserQA': not errors,
        'cloudQA': q,
        'opticalQA': oq,
        'referenceDNA': dna0,
        'defaultField': default_field,
        'probePoint': default_field['best']['point'],
        'observeDensity': observe_value,
        'flightDensity': flight_value,
        'identicalDensityAcrossModes': observe_value == flight_value,
        'outerCoordinator': coordinator,
        'objectSeedCandidate': dna_object,
        'detailSeedCandidate': dna_detail,
        'objectSeedFieldSignature': field_object,
        'detailSeedFieldSignature': field_detail,
        'restoredDNA': restored,
        'r25TransmittanceProbes': probes,
        'resumeWorldDeltaS': resume1-resume0,
        'firstCloudFrameMs': first_cloud_ms,
        'stableReadyMs': stable_ms,
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

report_path = out / 'PUBLIC_QA_R27_CUMULUS_DNA_2026-09-13.json'
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
assert report['publicBrowserQA'] and report['identicalDensityAcrossModes']
