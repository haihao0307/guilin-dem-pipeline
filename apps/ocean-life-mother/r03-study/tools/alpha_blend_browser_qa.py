from playwright.sync_api import sync_playwright
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
policy=(R/'src/alpha-policy.js').read_text()
html=f'''<!doctype html><html><body style="margin:0"><canvas id="c" width="120" height="40"></canvas><script>{policy}
const gl=document.getElementById('c').getContext('webgl2',{{antialias:false,alpha:false}});if(!gl)throw Error('WebGL2 unavailable');
const vs=`#version 300 es\nprecision highp float;in vec2 pos;in float a;out float alpha;void main(){{gl_Position=vec4(pos,0.,1.);gl_PointSize=24.;alpha=a;}}`;
const fs=`#version 300 es\nprecision highp float;in float alpha;uniform int renderPass;uniform float opaqueThreshold,alphaFloor;out vec4 outColor;void main(){{float d=length(gl_PointCoord-.5);if(d>.48)discard;float cov=clamp(alpha,0.,1.);if(renderPass==0){{if(cov<opaqueThreshold)discard;cov=1.;}}else{{if(cov<alphaFloor||cov>=opaqueThreshold)discard;}}outColor=vec4(1.,0.,0.,cov);}}`;
function sh(t,s){{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x}}const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
const data=new Float32Array([-.66,0,1,0,0,.5,.66,0,.005]);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const ap=gl.getAttribLocation(p,'pos'),aa=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(ap);gl.vertexAttribPointer(ap,2,gl.FLOAT,false,12,0);gl.enableVertexAttribArray(aa);gl.vertexAttribPointer(aa,1,gl.FLOAT,false,12,8);const rp=gl.getUniformLocation(p,'renderPass');gl.uniform1f(gl.getUniformLocation(p,'opaqueThreshold'),AlphaPolicy.opaqueThreshold);gl.uniform1f(gl.getUniformLocation(p,'alphaFloor'),AlphaPolicy.alphaFloor);
gl.viewport(0,0,120,40);gl.clearColor(0,0,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);AlphaPolicy.beginOpaque(gl);gl.uniform1i(rp,0);gl.drawArrays(gl.POINTS,0,3);AlphaPolicy.beginTranslucent(gl);gl.uniform1i(rp,1);gl.drawArrays(gl.POINTS,0,3);AlphaPolicy.restore(gl);
function pixel(x){{const q=new Uint8Array(4);gl.readPixels(x,20,1,1,gl.RGBA,gl.UNSIGNED_BYTE,q);return Array.from(q)}}window.result={{opaque:pixel(20),half:pixel(60),discard:pixel(100),depthMask:gl.getParameter(gl.DEPTH_WRITEMASK),blend:gl.isEnabled(gl.BLEND),glError:gl.getError(),classification:[AlphaPolicy.classify(1),AlphaPolicy.classify(.5),AlphaPolicy.classify(.005)]}};window.ready=true;</script></body></html>'''
report={'revision':'R03.A-run4','scope':'synthetic dual-pass alpha blend policy; not black-bass source replay, refraction, or order-independent transparency','viewports':[]}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    for W,H in [(1280,900),(390,844)]:
        page=b.new_page(viewport={'width':W,'height':H});errors=[];page.on('pageerror',lambda e: errors.append(str(e)));page.set_content(html,wait_until='load');page.wait_for_function('window.ready===true');r=page.evaluate('window.result')
        assert not errors and r['glError']==0 and r['depthMask'] and not r['blend']
        assert r['classification']==['opaque','translucent','discard']
        assert r['opaque'][0]>245 and r['opaque'][2]<10
        assert 115<=r['half'][0]<=140 and 115<=r['half'][2]<=140
        assert r['discard'][0]<10 and r['discard'][2]>245
        report['viewports'].append({'size':[W,H],'errors':errors,'result':r});page.close()
    b.close()
(R/'qa/ALPHA_BLEND_R03A_RUN4.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
