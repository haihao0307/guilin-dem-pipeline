from playwright.sync_api import sync_playwright
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
js=(root/'src'/'anatomy-kernel.js').read_text()
spec={"schema":"kaopu-fish-anatomy-articulation/0.1","parts":[
 {"id":"head","kind":"rigid-fixed","parent":None,"anchor":[0,0,0]},
 {"id":"lower-jaw","kind":"rigid-hinge","parent":"head","anchor":[0,-.02,.12],"axis":[1,0,0],"angleRange":[-.1,.65]},
 {"id":"gill-cover-left","kind":"rigid-hinge","parent":"head","anchor":[.035,0,.02],"axis":[0,1,0],"angleRange":[-.18,.18]},
 {"id":"eye-left","kind":"rigid-hinge","parent":"head","anchor":[.04,.035,.10],"axis":[0,1,0],"angleRange":[-.5,.5]},
 {"id":"pectoral-fin-left","kind":"rigid-hinge","parent":"head","anchor":[.055,-.005,-.015],"axis":[0,0,1],"angleRange":[-.8,.8]}
]}
html=f'''<!doctype html><canvas id=c width=320 height=240></canvas><script>{js}
const spec={json.dumps(spec)};const K=AnatomyKernel.compile(spec);const gl=c.getContext('webgl2');
if(!gl)throw Error('WebGL2 unavailable');
const src=`#version 300 es\nin vec3 p;void main(){{gl_Position=vec4(p.xy*5.,0.,1.);gl_PointSize=12.;}}`;
const fs=`#version 300 es\nprecision highp float;out vec4 o;void main(){{o=vec4(1.,.4,.1,1.);}}`;
function sh(t,s){{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x}}
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,src));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));gl.useProgram(pr);
const state={{'lower-jaw':.55,'gill-cover-left':.14,'eye-left':-.25,'pectoral-fin-left':.45}};
const samples=[['lower-jaw',[0,-.08,.20]],['gill-cover-left',[.08,.02,.02]],['eye-left',[.055,.04,.11]],['pectoral-fin-left',[.08,-.04,-.02]]];
const positions=[];const rest=[];for(const [id,p] of samples){{rest.push(...p);positions.push(...K.apply(id,p,[0,1,0],state).point)}}
const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(positions),gl.STATIC_DRAW);const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);gl.clearColor(.02,.03,.04,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.POINTS,0,samples.length);
const pix=new Uint8Array(320*240*4);gl.readPixels(0,0,320,240,gl.RGBA,gl.UNSIGNED_BYTE,pix);window.RESULT={{glError:gl.getError(),positions,rest,state,identity:K.apply('lower-jaw',samples[0][1],[0,1,0],{{}}),unknownBindingsRemainUnknown:K.unknownBindingsRemainUnknown,pixel:Array.from(pix)}};
</script>'''
report={"revision":"R03.A-run5","engine":"Chromium/SwiftShader","viewports":[]}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    for w,h in [(1280,900),(390,844)]:
        page=browser.new_page(viewport={"width":w,"height":h});errs=[];page.on('pageerror',lambda e: errs.append(str(e)))
        page.set_content(html,wait_until='load');r=page.evaluate('RESULT');
        moved=max(abs(a-b) for a,b in zip(r['positions'],r['rest']))
        ident=max(abs(a-b) for a,b in zip(r['identity']['point'],r['rest'][:3]))
        lit=sum(1 for x in range(0,len(r['pixel']),4) if r['pixel'][x]>150 and r['pixel'][x+1]>40)
        report['viewports'].append({"size":[w,h],"pageErrors":errs,"glError":r['glError'],"maxArticulatedDelta":moved,"restIdentityError":ident,"unknownBindingsRemainUnknown":r['unknownBindingsRemainUnknown'],"nonzeroAlphaPixels":lit})
        page.close()
    browser.close()
report['pass']=all(not v['pageErrors'] and v['glError']==0 and v['maxArticulatedDelta']>0 and v['restIdentityError']<1e-12 and v['unknownBindingsRemainUnknown'] and v['nonzeroAlphaPixels']>0 for v in report['viewports'])
report['scope']='synthetic jaw/gill/eye/fin interface and browser execution only; no FISH-REF-001 semantic patch binding'
(root/'qa'/'ANATOMY_BROWSER_R03A_RUN5.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
if not report['pass']: raise SystemExit(1)
