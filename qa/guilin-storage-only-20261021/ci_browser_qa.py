"""Run only on the authorized Actions runner, never as a local-browser fallback."""
import hashlib,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from range_fixture_server import make_server

ROOT=Path(__file__).resolve().parent
def main():
 assert os.environ.get('GITHUB_ACTIONS')=='true','This browser test is restricted to the authorized Actions runner'
 evidence=ROOT/'reports/browser';evidence.mkdir(parents=True,exist_ok=True)
 server=make_server(0);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
 report={'head_sha':os.environ.get('GITHUB_SHA'),'baseline_sha':'d0c6b02979829bb5876026967910eda012e4951f',
         'passed':False,'public_deployment_completed':False,'visualAcceptance':False,'productionReady':False,'views':[]}
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
      page.wait_for_function('window.__GUILIN_FULL_MAP_TEST_API && window.__GUILIN_FULL_MAP_TEST_API.getState().passed',timeout=120000)
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
      page.locator('#terrainCanvas').hover();page.mouse.wheel(0,120);page.wait_for_timeout(300)
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
      variants[variant]={'views':views,'browser_errors':errors,'native_range_response_count':len(responses),'requests':requests}
      context.close()
     for before,after in zip(variants['baseline']['views'],variants['candidate']['views']):
      assert before['state']==after['state'],f'{label} {before["anchor"]}: runtime state changed'
      assert before['canvas_sha256']==after['canvas_sha256'],f'{label} {before["anchor"]}: canvas pixels differ'
     report['views'].append({'viewport':viewport,'baseline_candidate_states_identical':True,'all_five_canvas_hashes_identical':True,'variants':variants})
    report['passed']=True
   finally:browser.close()
 finally:
  server.shutdown();server.server_close()
  (evidence/'BROWSER_STORAGE_ONLY_REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'passed':report['passed'],'viewports':len(report['views']),'head_sha':report['head_sha'],'public_deployment_completed':False},indent=2))

if __name__=='__main__':main()
