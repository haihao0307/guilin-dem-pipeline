"""Real Chromium QA. Local verification never claims that a public deployment passed."""
from __future__ import annotations
import argparse,json,random,shutil,socket,subprocess,sys,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'pipeline'))
from canonical_elevation_store import CanonicalElevationStore
from playwright.sync_api import sync_playwright

def require(value:bool,message:str)->None:
    if not value:raise RuntimeError(message)

def main()->int:
    p=argparse.ArgumentParser(description=__doc__)
    g=p.add_mutually_exclusive_group(required=True);g.add_argument('--site',type=Path);g.add_argument('--url')
    p.add_argument('--payload',type=Path,required=True);p.add_argument('--evidence',type=Path,required=True)
    p.add_argument('--chromium',default=shutil.which('chromium') or shutil.which('google-chrome'))
    a=p.parse_args();a.evidence.mkdir(parents=True,exist_ok=True)
    server=None;server_log=None
    evidence={'schema':'guilin-clean-browser-qa/v1','passed':False,'publicDeploymentCompleted':False,
      'visualAcceptance':False,'productionReady':False,'screenshots_are_qa_only':True,'checks':[],'errors':[]}
    if a.site:
        with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        url=f'http://127.0.0.1:{port}/guilin/'
        server_log=(a.evidence/'http.log').open('wb')
        server=subprocess.Popen([sys.executable,str(ROOT/'tests/range_static_server.py'),'--root',str(a.site),'--port',str(port)],stdout=server_log,stderr=subprocess.STDOUT)
        for _ in range(100):
            try:
                with urllib.request.urlopen(url,timeout=2):break
            except Exception:time.sleep(.1)
        else:raise RuntimeError('Local test server failed to start')
    else:url=a.url
    evidence['url']=url;evidence['scope']='local' if a.site else 'public'
    requests=[];responses=[];browser_errors=[]
    instrument='''(() => {
      window.__qaTextureUploads=0;window.__qaNativeBuffer=null;
      for (const name of ['texImage2D','texImage3D','texStorage2D','texStorage3D']) {
        const old=WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name]=function(...a){window.__qaTextureUploads++;return old.apply(this,a);};
      }
      const old=WebGL2RenderingContext.prototype.bufferData;
      WebGL2RenderingContext.prototype.bufferData=function(target,data,usage){
        if(data instanceof Float32Array && data.length===640*640*8) window.__qaNativeBuffer=new Float32Array(data);
        return old.call(this,target,data,usage);
      };
    })();'''
    try:
        with CanonicalElevationStore(a.payload/'canonical/CANONICAL_ELEVATION_MANIFEST.json') as store,sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=a.chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            evidence['browser_version']=browser.version
            page=browser.new_page(viewport={'width':1280,'height':900},device_scale_factor=1)
            page.add_init_script(instrument)
            page.on('pageerror',lambda error:browser_errors.append(str(error)))
            page.on('console',lambda msg:browser_errors.append(msg.text) if msg.type=='error' else None)
            page.on('requestfailed',lambda r:browser_errors.append(f'{r.url}: {r.failure}'))
            page.on('request',lambda r:requests.append({'url':r.url,'range':r.headers.get('range')}))
            page.on('response',lambda r:responses.append({'url':r.url,'status':r.status,'content_length':int(r.headers.get('content-length','0')),'content_range':r.headers.get('content-range')}))
            page.goto(url,wait_until='load',timeout=90000)
            page.wait_for_function('window.__GUILIN_FULL_MAP_QA_RESULT?.passed===true',timeout=90000)
            page.wait_for_timeout(500)
            initial=page.evaluate('window.__GUILIN_FULL_MAP_TEST_API.getState()')
            require(initial['native_chunk_count']==840,'Wrong logical chunk count')
            require(initial['canonical_range_request_count']==0,'Initial full map fetched detailed elevation')
            require(initial['one_continuous_map'] and initial['full_aoi_overview'],'Full map missing')
            require(not initial['height_image_texture_used'],'Height image used')
            require(page.locator('#tileSelect').count()==0,'Legacy tile selector visible')
            evidence['initial_state']=initial
            evidence['initial_response_body_bytes']=sum(r['content_length'] for r in responses if r['status']==200)
            page.screenshot(path=str(a.evidence/'desktop-full-map.png'))
            anchors=[];sample_checks=0
            for name in ['guilin','yangshuo','yangtang','zhenbaoding']:
                page.evaluate('(name)=>window.__GUILIN_FULL_MAP_TEST_API.focusAnchor(name)',name)
                page.wait_for_timeout(350)
                page.evaluate('window.__GUILIN_FULL_MAP_TEST_API.activateNativeDetail()')
                page.wait_for_function('window.__GUILIN_FULL_MAP_QA_RESULT?.native_detail_active===true',timeout=90000)
                page.wait_for_timeout(400)
                state=page.evaluate('window.__GUILIN_FULL_MAP_TEST_API.getState()')
                window=page.evaluate('window.__GUILIN_FULL_MAP_TEST_API.detailWindow()')
                require(state['passed'] and state['native_detail_grid']==[640,640],f'{name} native detail failed')
                values=store.read_aoi_window(window['startColumn'],window['startRow'],window['width'],window['height'])
                rng=random.Random(20260831)
                cells=[[rng.randrange(640),rng.randrange(640)] for _ in range(64)]
                actual=page.evaluate('''({cells,w})=>cells.map(([r,c])=>({value:window.__GUILIN_FULL_MAP_TEST_API.sampleLoaded(w.startRow+r,w.startColumn+c),
                    gpuElevation:window.__qaNativeBuffer[(r*640+c)*8+6],gpuY:window.__qaNativeBuffer[(r*640+c)*8+1]}))''',{'cells':cells,'w':window})
                for (r,c),record in zip(cells,actual):
                    expected=int(values[r,c]);require(record['value']==expected,f'{name} canonical sample mismatch')
                    if expected!=0:require(record['gpuElevation']==expected,f'{name} uploaded geometry elevation mismatch')
                    sample_checks+=1
                anchors.append({'anchor':name,'detail_window':window,'state':state,'sample_checks':len(cells)})
                if name=='guilin':page.screenshot(path=str(a.evidence/'desktop-native-detail.png'))
            # Variable-sized east/south edge blocks and a corner crossing.
            page.evaluate('window.__GUILIN_FULL_MAP_TEST_API.focusAOIPixel(17620,11930)')
            page.wait_for_timeout(500)
            edge=page.evaluate('window.__GUILIN_FULL_MAP_TEST_API.getState()')
            require(edge['passed'] and edge['native_detail_active'],'Variable edge detail failed')
            evidence['edge_state']=edge
            before=page.screenshot()
            page.mouse.move(620,460);page.mouse.down();page.mouse.move(715,500,steps=12);page.mouse.up();page.wait_for_timeout(600)
            after=page.screenshot();require(before!=after,'Mouse rotation did not change rendered frame')
            page.mouse.wheel(0,-300);page.wait_for_timeout(600)
            require(page.evaluate('window.__GUILIN_FULL_MAP_TEST_API.getState().passed'),'Zoom failed')
            page.evaluate('window.__GUILIN_FULL_MAP_TEST_API.toggleWaterways(false)');page.wait_for_timeout(250)
            no_water=page.screenshot()
            page.evaluate('window.__GUILIN_FULL_MAP_TEST_API.toggleWaterways(true)');page.wait_for_timeout(250)
            require(no_water!=page.screenshot(),'Waterway toggle did not change rendered pixels')
            page.evaluate('window.__GUILIN_FULL_MAP_TEST_API.resetFull()');page.wait_for_timeout(500)
            require(page.evaluate('window.__GUILIN_FULL_MAP_TEST_API.getState().full_aoi_overview'),'Reset lost full map')
            require(page.evaluate('window.__qaTextureUploads')==0,'A GPU texture was uploaded')
            ranges=[r for r in requests if '.i16pack' in r['url']]
            partial=[r for r in responses if '.i16pack' in r['url']]
            require(ranges and all(r['range'] for r in ranges),'Missing byte-range request')
            require(partial and all(r['status']==206 and 0<r['content_length']<=524288 for r in partial),'Whole shard or invalid chunk response')
            require(not any('.tif' in r['url'].lower() or 'guilin-truth-data' in r['url'] or 'native-r' in r['url'] for r in requests),'TIFF/legacy tile network dependency')
            evidence['desktop_anchor_checks']=anchors;evidence['native_sample_checks']=sample_checks
            evidence['range_responses']=partial;evidence['maximum_range_response_bytes']=max(r['content_length'] for r in partial)
            evidence['range_response_count']=len(partial);evidence['source_tiff_requests']=0;evidence['legacy_tile_requests']=0
            evidence['texture_uploads']=0;evidence['rotation_zoom_reset_and_layer_toggle_verified']=True
            page.close()
            mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
            mobile.on('pageerror',lambda error:browser_errors.append(str(error)))
            mobile.goto(url,wait_until='load',timeout=90000)
            mobile.wait_for_function('window.__GUILIN_FULL_MAP_QA_RESULT?.passed===true',timeout=90000)
            mobile.wait_for_timeout(500);mobile.screenshot(path=str(a.evidence/'mobile-full-map.png'))
            require(mobile.evaluate('window.__GUILIN_FULL_MAP_TEST_API.getState().canonical_range_request_count')==0,'Mobile first load fetched full detail')
            mobile.evaluate("window.__GUILIN_FULL_MAP_TEST_API.focusAnchor('yangshuo')");mobile.wait_for_timeout(350)
            mobile.evaluate('window.__GUILIN_FULL_MAP_TEST_API.activateNativeDetail()');mobile.wait_for_timeout(500)
            mstate=mobile.evaluate('window.__GUILIN_FULL_MAP_TEST_API.getState()')
            require(mstate['passed'] and mstate['native_detail_active'],'Mobile native detail failed')
            mobile.screenshot(path=str(a.evidence/'mobile-native-detail.png'));evidence['mobile_state']=mstate
            browser.close()
        require(not browser_errors,'Browser errors: '+repr(browser_errors))
        evidence['checks']=['full-map-first','zero-canonical-bytes-on-first-load','four-landmarks','256-native-values-match-store',
           'uploaded-geometry-height-matches-store','variable-edge-chunks','mouse-rotation','wheel-zoom','reset-full-map',
           'actual-layer-toggle','zero-GPU-textures','HTTP-206-only','no-TIFF-no-legacy-tiles','390x844-mobile']
        evidence['passed']=True
        if not a.site:evidence['public_endpoint_browser_verified']=True
    except Exception as e:
        evidence['errors'].append(str(e));raise
    finally:
        evidence['browser_errors']=browser_errors
        (a.evidence/'BROWSER_QA.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        if server:
            server.terminate()
            try:server.wait(timeout=5)
            except subprocess.TimeoutExpired:server.kill()
        if server_log:server_log.close()
    print(json.dumps({'passed':True,'scope':evidence['scope'],'range_responses':evidence['range_response_count'],
                     'initial_response_body_bytes':evidence['initial_response_body_bytes'],'native_sample_checks':sample_checks},indent=2))
    return 0
if __name__=='__main__':raise SystemExit(main())
