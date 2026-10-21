"""Run only on the authorized Actions runner, never as a local-browser fallback."""
import hashlib,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from range_fixture_server import make_server,LOCK

ROOT=Path(__file__).resolve().parent
VERSIONS=json.loads((ROOT/'candidate/ASSET_VERSIONS.json').read_text())

def ready(page):
 page.wait_for_function('window.__GUILIN_FULL_MAP_TEST_API && window.__GUILIN_FULL_MAP_TEST_API.getState().passed',timeout=120000)

def activate(page,anchor='guilin'):
 page.evaluate('(id)=>window.__GUILIN_FULL_MAP_TEST_API.focusAnchor(id)',anchor)
 page.evaluate('async()=>await window.__GUILIN_FULL_MAP_TEST_API.activateNativeDetail()')
 page.wait_for_function('window.__GUILIN_FULL_MAP_TEST_API.getState().native_detail_active && document.getElementById("detailLoading").hidden',timeout=120000)
 page.wait_for_load_state('networkidle',timeout=120000)

def verify_versioned_scripts(page):
 scripts=page.locator('script[src]').evaluate_all('(nodes)=>nodes.map(n=>n.getAttribute("src"))')
 assert scripts==[VERSIONS['adapter_file'],VERSIONS['app_file']+'?'+VERSIONS['app_query']],scripts
 assert page.evaluate('typeof globalThis.createGuilinCanonicalTileSource')=='function'
 return scripts

def cached_transition(browser,server,viewport):
 # Exercise the same URL and ordinary browser cache, no cache disabling or SW.
 context=browser.new_context(viewport=viewport,device_scale_factor=1,has_touch=viewport['width']==390,is_mobile=viewport['width']==390)
 page=context.new_page();requests=[];errors=[]
 cdp=context.new_cdp_session(page);cdp.send('Network.enable');cache_hits=[];request_urls={}
 cdp.on('Network.requestWillBeSent',lambda e:request_urls.__setitem__(e['requestId'],e['request']['url']))
 cdp.on('Network.requestServedFromCache',lambda e:cache_hits.append(e['requestId']))
 cdp.on('Network.responseReceived',lambda e:cache_hits.append(e['requestId']) if e['response'].get('fromDiskCache') else None)
 def old_app_server_count():
  with LOCK:
   rows=[json.loads(line) for line in (ROOT/'reports/HTTP_FIXTURE_ACCESS.jsonl').read_text().splitlines()]
  return sum(r['path']=='/transition/guilin/app.js' for r in rows)
 page.on('request',lambda r:requests.append(r.url))
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 server.transition_phase='baseline'
 url=f'http://127.0.0.1:{server.server_port}/transition/guilin/'
 try:
  page.goto(url,wait_until='networkidle',timeout=120000);ready(page)
  assert page.locator('script[src]').evaluate_all('(n)=>n.map(x=>x.getAttribute("src"))')==['app.js']
  assert page.evaluate('typeof globalThis.createGuilinCanonicalTileSource')=='undefined'
  # Verify the browser actually retained old app bytes before changing fixtures.
  server_app_reads_before=old_app_server_count();assert server_app_reads_before>=1
  old_app_sha=page.evaluate("""async()=>{const b=await(await fetch('app.js',{cache:'force-cache'})).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');}""")
  page.wait_for_timeout(100)
  assert old_app_sha=='79d0e2cef6407dddb2c6d9896f44377666e78e5711973720934adb2dcddfa777'
  old_cached_urls=[request_urls.get(i) for i in cache_hits if request_urls.get(i,'').endswith('/app.js')]
  server_app_reads_after=old_app_server_count()
  assert server_app_reads_after==server_app_reads_before,'force-cache fetched app.js from server again'
  # Response hash + no second server request proves reuse even if Chromium omits a CDP cache event.
  server.transition_phase='candidate'
  # An already open old page does NOT acquire the new loader by itself.
  assert page.evaluate('typeof globalThis.createGuilinCanonicalTileSource')=='undefined'
  checks=[]
  for phase in ['old_cached_page_ordinary_reload','second_ordinary_reload']:
   requests.clear();page.reload(wait_until='networkidle',timeout=120000);ready(page)
   scripts=verify_versioned_scripts(page);activate(page)
   assert not [u for u in requests if 'guilin-truth-data' in u or '.tif' in u],requests
   canonical=[u for u in requests if '.i16pack' in u];assert canonical,'No canonical ranges after ordinary reload'
   assert page.evaluate('()=>window.__GUILIN_FULL_MAP_TEST_API.getState().passed')
   assert not errors,errors
   checks.append({'phase':phase,'scripts':scripts,'canonical_request_count':len(canonical),'no_legacy_or_tiff_request':True})
  return {'passed':True,'cache_disabled':False,'old_app_cache_hit_verified':True,'cache_hit_evidence':'force-cache returned exact old app SHA with zero additional server request','server_app_reads_before':server_app_reads_before,'server_app_reads_after':server_app_reads_after,'cdp_cached_urls':old_cached_urls,'old_app_sha256':old_app_sha,'same_url':url,'old_open_page_requires_reload':True,'checks':checks}
 finally:context.close()

def main():
 assert os.environ.get('GITHUB_ACTIONS')=='true','This browser test is restricted to the authorized Actions runner'
 evidence=ROOT/'reports/browser';evidence.mkdir(parents=True,exist_ok=True)
 server=make_server(0);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
 report={'head_sha':os.environ.get('GITHUB_SHA'),'baseline_sha':'d0c6b02979829bb5876026967910eda012e4951f',
         'passed':False,'public_deployment_completed':False,'visualAcceptance':False,'productionReady':False,'views':[],'cache_transition':[], 'asset_versions':VERSIONS,'old_open_page_limitation':'Already open old tabs keep the old reader until reload; no automatic migration or service worker is claimed.'}
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True)
   try:
    for viewport in [{'width':1440,'height':900},{'width':390,'height':844}]:
     label=f"{viewport['width']}x{viewport['height']}";variants={}
     for variant in ['baseline','candidate']:
      context=browser.new_context(viewport=viewport,device_scale_factor=1,has_touch=viewport['width']==390,is_mobile=viewport['width']==390)
      page=context.new_page();errors=[];requests=[];responses=[]
      page.on('pageerror',lambda e:errors.append(str(e)))
      page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
      page.on('request',lambda r:requests.append({'url':r.url,'range':r.headers.get('range')}))
      page.on('response',lambda r:responses.append({'url':r.url,'status':r.status,'headers':r.headers}) if '.i16pack' in r.url else None)
      url=f'http://127.0.0.1:{server.server_port}/{variant}/guilin/'
      page.goto(url,wait_until='networkidle',timeout=120000)
      ready(page)
      if variant=='candidate':verify_versioned_scripts(page)
      assert not [r for r in requests if '.i16pack' in r['url'] or '-2048x2048-' in r['url']],'Native data fetched on first load'
      views=[]
      for anchor in ['overview','zhenbaoding','guilin','yangtang','yangshuo']:
       if anchor!='overview':
        page.evaluate('(id)=>window.__GUILIN_FULL_MAP_TEST_API.focusAnchor(id)',anchor)
        page.evaluate('async()=>await window.__GUILIN_FULL_MAP_TEST_API.activateNativeDetail()')
        page.wait_for_function('window.__GUILIN_FULL_MAP_TEST_API.getState().native_detail_active && document.getElementById("detailLoading").hidden',timeout=120000)
        page.wait_for_load_state('networkidle',timeout=120000)
       page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
       state=page.evaluate('()=>window.__GUILIN_FULL_MAP_TEST_API.getState()')
       assert state['passed'] and not state['runtime_errors'],state
       image=page.locator('#terrainCanvas').screenshot(timeout=120000)
       filename=f'{variant}-{label}-{anchor}.png';(evidence/filename).write_bytes(image)
       views.append({'anchor':anchor,'state':state,'canvas_sha256':hashlib.sha256(image).hexdigest(),'internal_qa_image':filename})
      # Actual browser interaction, without changing production controls or models.
      if viewport['width']==390:
       # Use the existing mobile panel toggle, not force-click or product CSS edits.
       page.locator('#togglePanel').click()
       page.wait_for_function('document.getElementById("controlPanel").classList.contains("collapsed")')
      point=page.evaluate("""()=>{const c=document.getElementById('terrainCanvas');for(let y=130;y<innerHeight-90;y+=40)for(let x=20;x<innerWidth-20;x+=40)if(document.elementFromPoint(x,y)===c)return {x,y};return null;}""")
      assert point,'No exposed interactive canvas point'
      before_scale=page.locator('#cameraScale').inner_text()
      page.mouse.move(point['x'],point['y']);page.mouse.wheel(0,120)
      page.wait_for_function('(before)=>document.getElementById("cameraScale").textContent!==before',arg=before_scale,timeout=10000)
      after_scale=page.locator('#cameraScale').inner_text()
      assert page.evaluate('()=>window.__GUILIN_FULL_MAP_TEST_API.getState().passed')
      page.evaluate('()=>window.__GUILIN_FULL_MAP_TEST_API.toggleWaterways(false)')
      page.evaluate('()=>window.__GUILIN_FULL_MAP_TEST_API.toggleWaterways(true)')
      page.evaluate('()=>window.__GUILIN_FULL_MAP_TEST_API.setWaterwayEmphasis(1.1)')
      assert page.evaluate('()=>window.__GUILIN_FULL_MAP_TEST_API.getState().passed')
      assert not errors,errors
      if variant=='candidate':
       assert not [r for r in requests if 'guilin-truth-data' in r['url'] or '.tif' in r['url']]
       assert responses,'No real browser canonical requests observed'
       for response in responses:
        assert response['status']==206,response
        h=response['headers'];assert int(h['content-length'])<=524288 and h['content-range'].startswith('bytes ')
        assert h.get('content-encoding','identity')=='identity'
      variants[variant]={'views':views,'browser_errors':errors,'native_range_response_count':len(responses),'requests':requests,'wheel_interaction':{'point':point,'camera_scale_before':before_scale,'camera_scale_after':after_scale,'changed':before_scale!=after_scale}}
      context.close()
     for before,after in zip(variants['baseline']['views'],variants['candidate']['views']):
      assert before['state']==after['state'],f'{label} {before["anchor"]}: runtime state changed'
      assert before['canvas_sha256']==after['canvas_sha256'],f'{label} {before["anchor"]}: canvas pixels differ'
     report['views'].append({'viewport':viewport,'baseline_candidate_states_identical':True,'all_five_canvas_hashes_identical':True,'variants':variants})
     report['cache_transition'].append({'viewport':viewport,'result':cached_transition(browser,server,viewport)})
    report['passed']=True
   finally:browser.close()
 except Exception as e:
  report['failure']={'type':type(e).__name__,'message':str(e)}
  raise
 finally:
  server.shutdown();server.server_close()
  (evidence/'BROWSER_STORAGE_ONLY_REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'passed':report['passed'],'viewports':len(report['views']),'head_sha':report['head_sha'],'public_deployment_completed':False},indent=2))

if __name__=='__main__':main()
