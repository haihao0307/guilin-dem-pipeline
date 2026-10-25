"""Whole-train remote QA contract. DO NOT run in the denied local browser sandbox.
Requires the authorized CI/browser environment, Playwright 1.57.0 and Chromium.
This checks whole locomotive+tender frames, never isolated part demonstrations.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json, time, subprocess, sys, base64, os
P = Path(__file__).parent
EXPECTED = json.loads((P/'STEAM_WHOLE_INTEGRATION_QA.json').read_text())
report = {'status': 'RUNNING', 'revision': 'R31 minimal whole steam connection research', 'tested_commit': os.getenv('GITHUB_SHA'),
          'backend_requested': 'Chromium ANGLE SwiftShader software WebGL', 'hardware_gpu_benchmark': False,
          'mechanical_acceptance': False, 'geometry_displacement': 0, 'views': [], 'console_errors': []}
server = subprocess.Popen([sys.executable, '-m', 'http.server', '8121', '--directory', str(P)])
time.sleep(1)
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width': 1240, 'height': 1100})
        page.on('console', lambda m: print(m.type, m.text, flush=True))
        page.on('pageerror', lambda e: report['console_errors'].append(str(e)))
        report['stage'] = 'compile and initial whole frame'
        page.goto('http://127.0.0.1:8121')
        page.wait_for_function('window.QA && (QA.done || QA.errors.length)', timeout=300000)
        first = page.evaluate('QA'); report['first'] = first
        assert first.get('done') and not first['errors'], first
        assert page.locator('#installation').input_value() == 'baseline'
        assert page.locator('#appearance').input_value() == 'waves'
        assert page.locator('#installation option').count() == 2
        report['backend_observed'] = page.evaluate("""()=>{let e=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:gl.getParameter(e?e.UNMASKED_VENDOR_WEBGL:gl.VENDOR),renderer:gl.getParameter(e?e.UNMASKED_RENDERER_WEBGL:gl.RENDERER),version:gl.getParameter(gl.VERSION)};}""")
        samples = [
            ('baseline_diagnostic', [12,3.5,-4], 100, .4, 'baseline', 'diagnostic', 1),
            ('baseline_waves', [12,3.5,-4], 100, .4, 'baseline', 'waves', 1),
            ('candidate_diagnostic', [12,3.5,-4], 100, .4, 'candidate', 'diagnostic', 1),
            ('candidate_waves', [12,3.5,-4], 100, .4, 'candidate', 'waves', 1),
            ('candidate_flat_reference', [12,3.5,-4], 100, .4, 'candidate', 'waves', 0),
            ('candidate_motion', [12,3.5,-4], 100, 1.4, 'candidate', 'waves', 1),
            ('candidate_opposite', [-12,3.5,-4], 100, 1.4, 'candidate', 'waves', 1),
            ('baseline_collision', [12,3.5,-4], 0, 3.3545228223, 'baseline', 'diagnostic', 1),
            ('candidate_collision', [12,3.5,-4], 0, 3.3545228223, 'candidate', 'waves', 1),
            ('candidate_waves_return', [12,3.5,-4], 100, .4, 'candidate', 'waves', 1),
            ('baseline_waves_return', [12,3.5,-4], 100, .4, 'baseline', 'waves', 1),
            ('baseline_diagnostic_return', [12,3.5,-4], 100, .4, 'baseline', 'diagnostic', 1),
        ]
        by_name = {}
        for name, eye, cut, theta, mode, appearance, detail in samples:
            report['stage'] = name
            start = time.monotonic()
            page.evaluate('async v=>{await renderAt(v.theta-.4,{eye:v.eye},{cut:v.cut,initialTheta:.4,angularSpeed:1,installation:{mode:v.mode,beta:.126},appearance:{mode:v.appearance,detailScale:v.detail}})}',
                          dict(eye=eye,cut=cut,theta=theta,mode=mode,appearance=appearance,detail=detail))
            raw = page.evaluate('c.toDataURL("image/png")')
            (P/(name+'-whole.png')).write_bytes(base64.b64decode(raw.split(',')[1]))
            q = page.evaluate('QA')
            q['pixels'] = page.evaluate("""async name=>{
              const a=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,a);
              const mask=new Uint8Array(c.width*c.height);let x0=c.width,y0=c.height,x1=-1,y1=-1,n=0;
              for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){let i=4*(y*c.width+x);
                if(a[i]!=a[0]||a[i+1]!=a[1]||a[i+2]!=a[2]){mask[y*c.width+x]=1;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);n++;}}
              window.__wholePixels=window.__wholePixels||{};__wholePixels[name]=a;
              const h=await crypto.subtle.digest('SHA-256',mask);
              return {x0,y0,x1,y1,foregroundPixels:n,silhouetteMaskSha256:Array.from(new Uint8Array(h),x=>x.toString(16).padStart(2,'0')).join(''),glErrorAfterReadback:gl.getError()};
            }""", name)
            q['pixel_readback_wall_s'] = time.monotonic()-start
            q['surface']['pixelReadbackVerified'] = True
            q['view'] = name; report['views'].append(q); by_name[name] = q
            print(json.dumps(q), flush=True)
            assert q.get('done') and not q['errors'] and q['draws'] == (EXPECTED['candidateFields'] if mode=='candidate' else 519) and q.get('glError') == 0, q
            assert q['installation']['mode'] == mode and q['appearance']['mode'] == appearance, q
            assert q['surface']['visible'] == q['draws'] and q['surface']['assignedWaveFields'] == q['draws'], q
            assert q['surface']['geometryDisplacement'] == 0 and not q['mechanicalAcceptance'], q
            bnd = q['pixels']
            assert bnd['glErrorAfterReadback'] == 0 and bnd['x0']>2 and bnd['x1']<717 and bnd['y0']>2 and bnd['y1']<397 and bnd['foregroundPixels']>10000, bnd
            if mode=='candidate':
                assert q['steamPath']['candidateInstalled'] and q['steamPath']['parts'] == EXPECTED['steamFields'] and not q['steamPath']['completeSteamNetwork'], q
                assert all(abs(ch['theta']-q['theta'])<1e-12 for ch in q['steamPath']['sameTimeChambers']), q
                assert q['outsideValves']['reconstructed'] and not q['outsideValves']['middleFrozen'], q
                assert q['centralControl']['sideOffsetMiddleValve'] and q['centralControl']['middleChestPresent'] and q['centralControl']['candidateExplicitMount']
                assert q['centralControl']['baselinePlateOverlapKnown'] and q['centralControl']['candidateFiniteStack'], q
                assert not q['centralControl']['verifiedFrameMount'] and not q['centralControl']['verifiedEndLocks'], q
        for a,b in [('baseline_diagnostic','baseline_diagnostic_return'),('baseline_waves','baseline_waves_return'),('candidate_waves','candidate_waves_return')]:
            assert (P/(a+'-whole.png')).read_bytes() == (P/(b+'-whole.png')).read_bytes(), 'Non-reversible whole-frame appearance/state '+a
        for a,b in [('baseline_diagnostic','baseline_waves'),('candidate_diagnostic','candidate_waves'),('candidate_flat_reference','candidate_waves')]:
            assert by_name[a]['pixels']['silhouetteMaskSha256'] == by_name[b]['pixels']['silhouetteMaskSha256'], 'Appearance changed coverage/silhouette '+a
        report['wave_pixel_difference'] = page.evaluate("""()=>{let a=__wholePixels.candidate_waves,b=__wholePixels.candidate_flat_reference,n=0,max=0;for(let i=0;i<a.length;i+=4){let d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));if(d){n++;max=Math.max(max,d);}}return {changedPixels:n,maximumChannelDifference:max};}""")
        assert report['wave_pixel_difference']['changedPixels'] > 0, 'No resolved whole-surface wave signal; do not claim visible waves'
        report['stage'] = 'whole UI state, appearance, repeated controls'
        page.locator('#example').click()
        page.wait_for_function('!RESEARCH_UI.busy && QA.installation.mode==="candidate"', timeout=300000)
        assert '推断' in page.locator('#rendered').inner_text()
        page.locator('#appearance').select_option('diagnostic')
        page.wait_for_function('!RESEARCH_UI.busy && QA.appearance.mode==="diagnostic"', timeout=300000)
        assert page.evaluate('QA.installation.mode') == 'candidate'
        # Rapid appearance/time input must coalesce without changing mechanics.
        page.evaluate("""()=>{for(const [id,value]of [['time','1'],['appearance','waves'],['time','2'],['time','1']]){let e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}}""")
        page.wait_for_function('!RESEARCH_UI.busy && QA.appearance.mode==="waves" && Math.abs(QA.theta-1.4)<1e-8', timeout=300000)
        assert '明确断点' in page.locator('#steam-path-state').inner_text()
        assert not page.evaluate('STEAM_INSPECTION.last.wholeSteamNetworkComplete')
        page.locator('#baseline').click()
        page.wait_for_function('!RESEARCH_UI.busy && QA.installation.mode==="baseline"', timeout=300000)
        assert 'FAIL' in page.locator('.lede .badge').inner_text()
        assert page.locator('#whole-failures').is_visible()
        assert '中阀胸' in page.locator('#whole-failures').inner_text()
        report.update(render_views_pass=True, baseline_and_candidate_return_exact_png=True, appearance_preserves_silhouette=True, ui_repeated_controls_pass=True)
        report['stage'] = 'full research interface screenshot'
        screenshot_start = time.monotonic()
        page.screenshot(path=str(P/'r31-whole-interface.png'), full_page=True, timeout=120000)
        report['interface_screenshot_wall_s'] = time.monotonic() - screenshot_start
        report['stage'] = 'native 1440 whole-train views and legacy720 equivalence'
        # Compare the old and new sampling implementation on the SAME R30 mechanics.
        legacy_html = (P/'index.html').read_text().replace('src="app.js"','src="resolution-study/legacy/app.js"').replace('src="material-renderer.js"','src="resolution-study/legacy/material-renderer.js"')
        (P/'qa-legacy720.html').write_text(legacy_html)
        legacy = browser.new_page(viewport={'width': 1240, 'height': 1100})
        legacy.goto('http://127.0.0.1:8121/qa-legacy720.html')
        legacy.wait_for_function('window.QA && (QA.done || QA.errors.length)', timeout=300000)
        legacy.evaluate('async()=>await renderAt(0,{eye:[12,3.5,-4]},{cut:100,initialTheta:.4,angularSpeed:1,installation:{mode:"candidate",beta:.126},appearance:{mode:"waves",detailScale:1}})')
        legacy_bytes=base64.b64decode(legacy.evaluate('c.toDataURL("image/png")').split(',')[1])
        assert legacy_bytes == (P/'candidate_waves-whole.png').read_bytes(), 'Sampling-only patch changed old720 pixels on same R30 geometry'
        report['legacy720_same_mechanics_exact_png'] = True
        legacy.close()
        high = browser.new_page(viewport={'width': 1500, 'height': 1100})
        high.on('pageerror', lambda e: report['console_errors'].append(str(e)))
        high.goto('http://127.0.0.1:8121/?resolution=1440x800')
        high.wait_for_function('window.QA && (QA.done || QA.errors.length)', timeout=300000)
        report['high_resolution_views']=[]
        for name,cut,theta in [('candidate_native1440',100,1.4),('candidate_cut_native1440',0,3.3545228223)]:
            started=time.monotonic()
            high.evaluate('async v=>await renderAt(v.theta-.4,{eye:[12,3.5,-4]},{cut:v.cut,initialTheta:.4,angularSpeed:1,installation:{mode:"candidate",beta:.126},appearance:{mode:"waves",detailScale:1}})',dict(theta=theta,cut=cut))
            pixels=base64.b64decode(high.evaluate('c.toDataURL("image/png")').split(',')[1])
            import struct
            assert struct.unpack('>II',pixels[16:24])==(1440,800)
            (P/(name+'-whole.png')).write_bytes(pixels)
            result=high.evaluate('()=>({qa:QA,canvas:[c.width,c.height],buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],viewport:Array.from(gl.getParameter(gl.VIEWPORT)),glError:gl.getError(),joint:!!DYNAMIC.outerCrossheadCandidate})')
            assert result['canvas']==[1440,800] and result['buffer']==[1440,800] and result['viewport']==[0,0,1440,800]
            assert result['glError']==0 and result['qa']['done'] and not result['qa']['errors'] and result['qa']['draws']==EXPECTED['candidateFields'] and result['joint']
            assert result['qa']['surface']['assignedWaveFields']==EXPECTED['candidateFields'] and result['qa']['surface']['geometryDisplacement']==0 and not result['qa']['mechanicalAcceptance']
            bounds=high.evaluate("""()=>{const a=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,a);let x0=c.width,y0=c.height,x1=-1,y1=-1,n=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){let i=4*(y*c.width+x);if(a[i]!=a[0]||a[i+1]!=a[1]||a[i+2]!=a[2]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);n++;}}return{x0,y0,x1,y1,foregroundPixels:n,glError:gl.getError()};}""")
            assert bounds['glError']==0 and bounds['x0']>2 and bounds['x1']<1437 and bounds['y0']>2 and bounds['y1']<797 and bounds['foregroundPixels']>40000
            result.update(view=name,pixel_readback_wall_s=time.monotonic()-started,native_png_size=[1440,800],pixels=bounds)
            report['high_resolution_views'].append(result)
            print(json.dumps(result),flush=True)
        high.add_script_tag(path=str(P/'gpu_parity_probe.js'))
        packet=json.loads((P/'GPU_PARITY_SAMPLES.json').read_text())
        report['outside_joint_gpu_parity']=high.evaluate('async packet=>await runOuterCrossheadGPUParity({scene:SCENE,dynamic:DYNAMIC,packet})',packet)
        (P/'OUTER_GPU_PARITY_QA.json').write_text(json.dumps(report['outside_joint_gpu_parity'],indent=2)+'\n')
        assert report['outside_joint_gpu_parity']['status'] in ['PASS','NOT_RUN'], report['outside_joint_gpu_parity']
        high.add_script_tag(path=str(P/'steam-gpu-probe.js'))
        steam_packet=json.loads((P/'STEAM_GPU_SAMPLES.json').read_text())
        report['steam_gpu_parity']=high.evaluate('async packet=>await runSteamGPUParity(packet)',steam_packet)
        (P/'STEAM_GPU_QA.json').write_text(json.dumps(report['steam_gpu_parity'],indent=2)+'\n')
        assert report['steam_gpu_parity']['status']=='PASS', report['steam_gpu_parity']
        report['steam_current_scope']={'candidate_fields':EXPECTED['candidateFields'],'new_fields':EXPECTED['steamFields'],'host_cuts_subtract_only':True,'complete_steam_network':False,'upstream_element_loop_exhaust_breaks_explicit':True,'historical_valve_events_verified':False}
        high.close()
        assert not report['console_errors'], report['console_errors']
        report.update(status='PASS_BROWSER_ONLY',stage='complete',baseline_and_candidate_return_exact_png=True,
                      appearance_preserves_silhouette=True,ui_repeated_controls_pass=True,
                      scope='Whole analytic locomotive/tender research; driver/pixel/UI checks only. Historical failures retained; conditional/sampled current geometry checks are not overall mechanical acceptance.')
        browser.close()
except Exception as exc:
    report.update(status='FAIL',error=str(exc))
    raise
finally:
    (P/'BROWSER_QA.json').write_text(json.dumps(report,indent=2)+'\n')
    server.terminate()
