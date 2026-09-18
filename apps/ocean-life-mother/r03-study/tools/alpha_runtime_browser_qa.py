from playwright.sync_api import sync_playwright
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
policy=(R/'src/alpha-policy.js').read_text();runtime=(R/'src/study-runtime.js').read_text()
rows=[[-.12,0,0,0,0,1,1,0,0,1,.5,.06,0,0,1,0,0,0],[0,0,0,0,0,1,1,0,0,.5,.5,.06,0,0,1,0,0,0],[.12,0,0,0,0,1,1,0,0,.005,.5,.06,0,0,1,0,0,0]]
flat=[v for row in rows for v in row]
stub=f'''const FieldKernel={{decode:x=>x,fish:()=>({{data:new Float32Array({flat}),count:3}})}};const CoralKernel={{brain:()=>FieldKernel.fish(),staghorn:()=>FieldKernel.fish()}};window.FISH_FIELD_DATA={{}};'''
html=f'''<!doctype html><html><body style="margin:0"><div id="top" style="height:100px"><div id="detail"></div><button data-mode="fish"></button><button data-mode="brain"></button><button data-mode="brain-purple"></button><button data-mode="staghorn"></button><select id="palette"><option value="0"></option></select><div id="paletteNote"></div><button id="pause"></button><button id="motion"></button><button id="side"></button><button id="three"></button><button id="head"></button><input id="scale" value="1"></div><canvas id="canvas"></canvas><div id="status"></div><div id="boot"></div><script>{policy}\n{stub}\n{runtime}</script></body></html>'''
report={'revision':'R03.A-run4','scope':'exact study-runtime shader/state execution with synthetic surfels; not source black-bass fidelity','viewports':[]}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    for W,H in [(1280,900),(390,844)]:
        page=b.new_page(viewport={'width':W,'height':H});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(html,wait_until='load');page.wait_for_function('!!window.FunctionStudy',timeout=30000);page.wait_for_timeout(250);r=page.evaluate('FunctionStudy.getState()')
        assert not errors and r['glError']==0 and r['alphaPolicy']['orderIndependent']==False and r['alphaPolicy']['refractive']==False and abs(r['alphaPolicy']['opaqueThreshold']-.985)<1e-12
        report['viewports'].append({'size':[W,H],'errors':errors,'state':r,'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')});page.close()
    b.close()
(R/'qa/ALPHA_RUNTIME_BROWSER_R03A_RUN4.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
