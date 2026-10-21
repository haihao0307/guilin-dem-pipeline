"""Actual Pages read-only acceptance. Run only in the authorized Actions runner.
Production files are never written; the accepted baseline is served locally for A/B.
"""
import hashlib,json,os,threading,urllib.request
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
from range_fixture_server import make_server
from ci_browser_qa import ready,activate,verify_versioned_scripts,VERSIONS

ROOT=Path(__file__).resolve().parent
BASE_URL='https://haihao0307.github.io/guilin-dem-pipeline/'

def digest_url(relative,expected_bytes,expected_sha):
 request=urllib.request.Request(urljoin(BASE_URL,relative),headers={'User-Agent':'GuilinStorageReadOnlyPublicQA/1.0','Cache-Control':'no-cache'})
 digest=hashlib.sha256();total=0
 with urllib.request.urlopen(request,timeout=180) as response:
  status=response.status;headers=dict(response.headers)
  assert status==200,(relative,status)
  assert response.headers.get('Content-Encoding','identity')=='identity',headers
  while data:=response.read(1<<20):
   total+=len(data);assert total<=expected_bytes,(relative,total,expected_bytes);digest.update(data)
 assert total==expected_bytes and digest.hexdigest()==expected_sha,(relative,total,digest.hexdigest(),expected_sha)
 return {'path':relative,'bytes':total,'sha256':digest.hexdigest(),'status':status}

def main():
 assert os.environ.get('GITHUB_ACTIONS')=='true','Restricted to authorized Actions runner'
 expected_commit=os.environ['GUILIN_PUBLIC_COMMIT'];assert len(expected_commit)==40
 out=ROOT/'reports/public-browser';out.mkdir(parents=True,exist_ok=True)
 report={'passed':False,'qa_head_sha':os.environ.get('GITHUB_SHA'),'expected_published_commit':expected_commit,
  'public_url':BASE_URL+'guilin/','asset_versions':VERSIONS,'public_artifact_hashes':[],'views':[],
  'ordinary_reloads':[],'public_shard_range_checks':[],'source_release_deleted':False,
  'old_tab_limitation':'Already-open old pages need reload; automatic migration is not claimed.'}
 server=make_server(0);threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  # Independently stream every published canonical byte; this is QA, not page startup.
  manifest=json.loads((ROOT/'CANONICAL_ELEVATION_MANIFEST.json').read_text())
  payload=ROOT/'payload/guilin-elevation-store-v1'
  for item in [{'file':'CANONICAL_ELEVATION_MANIFEST.json','bytes':999668,'sha256':VERSIONS['canonical_manifest_sha256']},*manifest['physical_shards']['shards']]:
   report['public_artifact_hashes'].append(digest_url('guilin-elevation-store-v1/'+item['file'],item['bytes'],item['sha256']))
  for shard in manifest['physical_shards']['shards']:
   for start in [0,shard['bytes']//2,shard['bytes']-16]:
    end=start+15;expected_range=f"bytes {start}-{end}/{shard['bytes']}"
    request=urllib.request.Request(urljoin(BASE_URL,'guilin-elevation-store-v1/'+shard['file']),headers={'Range':f'bytes={start}-{end}','Cache-Control':'no-cache','User-Agent':'GuilinStorageReadOnlyPublicQA/1.0'})
    with urllib.request.urlopen(request,timeout=120) as response:
     assert response.status==206 and response.headers.get('Content-Range')==expected_range
     assert response.headers.get('Content-Encoding','identity')=='identity'
     assert int(response.headers['Content-Length'])==16
     chunk=response.read(17);assert len(chunk)==16
    with (payload/shard['file']).open('rb') as f:f.seek(start);expected=f.read(16)
    assert chunk==expected
    report['public_shard_range_checks'].append({'shard':shard['file'],'start':start,'end':end,'status':206,'bytes_match':True})
  for name in ['index.html','app.js',VERSIONS['adapter_file'],'styles.css','data/NATIVE_ELEVATION_MANIFEST.json','data/overview-direct-samples-manifest.json','data/overview-direct-heights.i16.bin','data/osm-waterways-manifest.json','data/osm-waterway-segments.f32.bin','data/osm-waterway-nodes.f32.bin']:
   raw=(ROOT/'candidate/guilin'/name).read_bytes()
   report['public_artifact_hashes'].append(digest_url('guilin/'+name+('?' + VERSIONS['app_query'] if name=='app.js' else ''),len(raw),hashlib.sha256(raw).hexdigest()))
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True)
   try:
    for viewport in [{'width':1440,'height':900},{'width':390,'height':844}]:
     label=f"{viewport['width']}x{viewport['height']}";variants={}
     for variant in ['baseline','public']:
      context=browser.new_context(viewport=viewport,device_scale_factor=1,has_touch=viewport['width']==390,is_mobile=viewport['width']==390)
      page=context.new_page();errors=[];requests=[];ranges=[];ancillary_icon_errors=[]
      page.on('pageerror',lambda e:errors.append(str(e)))
      def console_message(message):
       if message.type!='error':return
       location=message.location.get('url','')
       if location.endswith('/favicon.ico') and '404' in message.text:
        ancillary_icon_errors.append({'url':location,'message':message.text,'scope':'Missing existing origin favicon, not a data/JS/storage failure; not hidden or fixed here.'})
       else:errors.append(message.text)
      page.on('console',console_message)
      page.on('request',lambda r:requests.append(r.url))
      page.on('response',lambda r:ranges.append({'url':r.url,'status':r.status,'headers':r.headers}) if '.i16pack' in r.url else None)
      url=(f'http://127.0.0.1:{server.server_port}/baseline/guilin/' if variant=='baseline' else BASE_URL+'guilin/')
      page.goto(url,wait_until='networkidle',timeout=180000);ready(page)
      assert not [u for u in requests if '.i16pack' in u or '-2048x2048-' in u],'Native data loaded on startup'
      if variant=='public':verify_versioned_scripts(page)
      if viewport['width']==390:
       # Existing mobile UI control: expose terrain for both sides of the visual comparison.
       page.locator('#togglePanel').click()
       page.wait_for_function('document.getElementById("controlPanel").classList.contains("collapsed")')
      views=[]
      for anchor in ['overview','zhenbaoding','guilin','yangtang','yangshuo']:
       if anchor!='overview':activate(page,anchor)
       page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
       state=page.evaluate('()=>window.__GUILIN_FULL_MAP_TEST_API.getState()')
       assert state['passed'] and not state['runtime_errors'],state
       image=page.locator('#terrainCanvas').screenshot(timeout=120000)
       filename=f'{variant}-{label}-{anchor}.png';(out/filename).write_bytes(image)
       views.append({'anchor':anchor,'state':state,'canvas_sha256':hashlib.sha256(image).hexdigest(),'internal_qa_image':filename})
      assert not errors,errors
      if variant=='public':
       assert not [u for u in requests if 'guilin-truth-data' in u or '.tif' in u],requests
       assert ranges,'No published canonical range reads'
       for item in ranges:
        h=item['headers'];assert item['status']==206 and h['content-range'].startswith('bytes '),item
        assert int(h['content-length'])<=524288 and h.get('content-encoding','identity')=='identity',item
       # Ordinary reload of a now-cached production page, without disabling cache.
       requests.clear();page.reload(wait_until='networkidle',timeout=180000);ready(page)
       scripts=verify_versioned_scripts(page);activate(page)
       assert not [u for u in requests if 'guilin-truth-data' in u or '.tif' in u]
       assert any('.i16pack' in u for u in requests)
       assert not errors,errors
       report['ordinary_reloads'].append({'viewport':viewport,'scripts':scripts,'passed':True,'cache_disabled':False,'legacy_or_tiff_requests':0})
      variants[variant]={'views':views,'errors':errors,'range_count':len(ranges),'ranges':ranges,'ancillary_icon_errors':ancillary_icon_errors}
      context.close()
     for a,b in zip(variants['baseline']['views'],variants['public']['views']):
      assert a['state']==b['state'],(label,a['anchor'],'runtime differs')
      assert a['canvas_sha256']==b['canvas_sha256'],(label,a['anchor'],'canvas differs')
     report['views'].append({'viewport':viewport,'all_5_state_and_canvas_pairs_identical':True,'variants':variants})
    report['passed']=True
   finally:browser.close()
 except Exception as e:
  report['failure']={'type':type(e).__name__,'message':str(e)};raise
 finally:
  server.shutdown();server.server_close();(out/'PUBLIC_BROWSER_STORAGE_ONLY_REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'passed':report['passed'],'viewports':len(report['views']),'expected_published_commit':expected_commit,'qa_head_sha':report['qa_head_sha']},indent=2))

if __name__=='__main__':main()
