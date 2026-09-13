from __future__ import annotations

import json
import os
import pathlib
import time
from playwright.sync_api import sync_playwright

url = os.environ['PUBLIC_URL']
page_sha = os.environ['PAGE_SHA']
root = pathlib.Path(os.environ['GITHUB_WORKSPACE'])
out = root / 'weather-mother' / 'full-weather-r27-cumulus-clouddna-20260913'
out.mkdir(parents=True, exist_ok=True)
report_path = out / 'PUBLIC_QA_R27_CUMULUS_DETAIL_POLICY_2026-09-13.json'
errors = []
iphone_ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=[
        '--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader-webgl',
        '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'
    ])
    ctx = browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1,
                              is_mobile=True, has_touch=True, user_agent=iphone_ua)
    ctx.add_cookies([{'name':'__Http-phish','value':'1','url':'https://raw.githack.com/',
                      'secure':True,'httpOnly':True,'sameSite':'Lax'}])
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append({'type':'pageerror','message':str(e)}))
    response = page.goto(url + '?detailPolicyQA=' + str(time.time_ns()), wait_until='domcontentloaded', timeout=90000)
    assert response and response.status == 200

    target = None
    deadline = time.time()+120
    while time.time()<deadline and target is None:
        for frame in page.frames:
            try:
                if frame.evaluate('Boolean(window.WeatherMobileR27CumulusDNA && window.WeatherMobileR25)'):
                    target=frame
                    break
            except Exception:
                pass
        if target is None:
            time.sleep(.1)
    assert target is not None, 'cumulus DNA frame unavailable'
    target.wait_for_function('WeatherMobileR27CumulusDNA.qa.ready && WeatherMobileR25.qa.ready', timeout=120000)

    metrics = target.evaluate("""() => {
      const api=WeatherMobileR27CumulusDNA;
      api.setScene('silver');api.setWorldPlaying(false);api.setViewMode('observe');
      const t=api.getWorldClockState().timeS;
      const points=[];
      for(let y=1.5;y<=7.0;y+=.75)for(let z=-18;z<=0;z+=1.5)for(let x=-8;x<=8;x+=1.5)points.push([x,y,z]);
      const snap=()=>points.map(p=>({d:api.CloudQuery.sample(p,'silver',t),e:api.CloudQuery.envelope(p,'silver')}));
      const compare=(a,b)=>{let densityAbs=0,densityMax=0,envelopeAbs=0,envelopeMax=0;for(let i=0;i<a.length;i++){const dd=Math.abs(a[i].d-b[i].d),de=Math.abs(a[i].e-b[i].e);densityAbs+=dd;envelopeAbs+=de;densityMax=Math.max(densityMax,dd);envelopeMax=Math.max(envelopeMax,de);}return{densityAbs,densityMax,envelopeAbs,envelopeMax,count:a.length};};
      api.setSeeds(73017,991);const base=snap(),baseDNA=api.getCloudDNA();
      api.setSeeds(73018,991);const object=snap(),objectDNA=api.getCloudDNA();
      api.setSeeds(73017,992);const detail=snap(),detailDNA=api.getCloudDNA();
      api.setSeeds(73017,991);const restoredDNA=api.getCloudDNA();
      return {baseDNA,objectDNA,detailDNA,restoredDNA,objectDelta:compare(base,object),detailDelta:compare(base,detail),timeS:t};
    }""")

    assert metrics['objectDelta']['densityAbs'] > 1e-5, metrics
    assert metrics['objectDelta']['envelopeAbs'] > 1e-5, metrics
    assert metrics['detailDelta']['densityAbs'] > 1e-5, metrics
    assert metrics['detailDelta']['envelopeAbs'] == 0 and metrics['detailDelta']['envelopeMax'] == 0, metrics
    assert metrics['restoredDNA']['objectSeed'] == 73017 and metrics['restoredDNA']['detailSeed'] == 991, metrics

    q = target.evaluate('WeatherMobileR27CumulusDNA.qa')
    oq = target.evaluate('WeatherMobileR25.qa')
    assert q.get('detailSeedHighBandsOnly') is True and q.get('detailSeedEnvelopeInvariant') is True, q
    assert oq.get('detailSeedHighBandsOnly') is True and oq.get('detailSeedEnvelopeInvariant') is True, oq
    assert not errors, errors
    ctx.close();browser.close()

report = {
    'schema':'weather-mother-r27-cumulus-detail-policy-public-qa/1',
    'pageCommit':page_sha,
    'url':url,
    'sameGridRuntimeProbe':True,
    'detailSeedHighBandsOnlyStaticContract':True,
    'detailSeedEnvelopeInvariant':True,
    'metrics':metrics,
    'errors':errors,
    'realDeviceQA':False,
    'visualAcceptance':False,
    'productionReady':False,
}
report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
