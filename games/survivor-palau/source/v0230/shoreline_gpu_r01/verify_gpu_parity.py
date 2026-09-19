#!/usr/bin/env python3
import json, pathlib, subprocess, sys
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent
probe=json.loads(subprocess.check_output(['node',str(ROOT/'gpu_parity_probe.cjs')],text=True))
samples=probe['samples']; glsl=probe['glsl']
VS='#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}'
FS='#version 300 es\nprecision highp float;uniform vec2 uP;out vec4 O;\n'+glsl+'\nvoid main(){vec3 f=smiWakeFrameG(uP);O=vec4(smiAuthoritativeBedG(uP),f.z,f.x,bedH(uP));}'
html='''<!doctype html><meta charset=utf-8><pre id=result>pending</pre><canvas id=c width=1 height=1></canvas><script>\n'''+f'''const VS={json.dumps(VS)},FS={json.dumps(FS)},samples={json.dumps(samples)};\n'''+r'''
function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
try{
 const c=document.getElementById('c'),gl=c.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});if(!gl)throw new Error('WEBGL2_UNAVAILABLE');
 const ext=gl.getExtension('EXT_color_buffer_float');if(!ext)throw new Error('EXT_color_buffer_float unavailable');
 const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,1,1,0,gl.RGBA,gl.FLOAT,null);
 const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('FLOAT_FBO_INCOMPLETE');
 gl.useProgram(p);const u=gl.getUniformLocation(p,'uP'),out=new Float32Array(4),rows=[];let maxBedError=0,maxWeightError=0,maxSignedError=0,maxLegacyError=0;
 for(const s of samples){gl.uniform2f(u,s.x,s.z);gl.viewport(0,0,1,1);gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,out);const row={label:s.label,gpuBed:out[0],cpuBed:s.expected,gpuWeight:out[1],cpuWeight:s.weight,gpuSignedDistance:out[2],cpuSignedDistance:s.signedDistance,gpuLegacy:out[3],cpuLegacy:s.legacy};row.bedError=Math.abs(row.gpuBed-row.cpuBed);row.weightError=Math.abs(row.gpuWeight-row.cpuWeight);row.signedError=Math.abs(row.gpuSignedDistance-row.cpuSignedDistance);row.legacyError=Math.abs(row.gpuLegacy-row.cpuLegacy);maxBedError=Math.max(maxBedError,row.bedError);maxWeightError=Math.max(maxWeightError,row.weightError);maxSignedError=Math.max(maxSignedError,row.signedError);maxLegacyError=Math.max(maxLegacyError,row.legacyError);rows.push(row);}
 const dbg=gl.getExtension('WEBGL_debug_renderer_info');const renderer=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 const contact=rows.find(x=>x.label.startsWith('center_s_-2.218277'));const contactGap=Math.abs(contact.gpuBed-0.18),legacyContactGap=Math.abs(contact.gpuLegacy-0.18);const thresholds={bedMeters:.001,weight:2e-5,signedDistanceMeters:.005,legacyMeters:.001,contactMeters:.05};const result={webgl2:true,renderer,glVersion:gl.getParameter(gl.VERSION),samples:rows.length,maxBedError,maxWeightError,maxSignedError,maxLegacyError,contactGap,legacyContactGap,thresholds,contact,pass:maxBedError<=thresholds.bedMeters&&maxWeightError<=thresholds.weight&&maxSignedError<=thresholds.signedDistanceMeters&&maxLegacyError<=thresholds.legacyMeters&&contactGap<=thresholds.contactMeters,rows};document.getElementById('result').textContent=JSON.stringify(result);
}catch(e){document.getElementById('result').textContent=JSON.stringify({pass:false,error:String(e.stack||e)});}
</script>'''
with sync_playwright() as p:
    browser=p.chromium.launch(headless=False,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    page=browser.new_page(viewport={'width':1280,'height':720});page.set_content(html,wait_until='load');text=page.locator('#result').inner_text();browser.close()
result=json.loads(text);result['profileId']=probe['profileId'];print(json.dumps(result,indent=2))
sys.exit(0 if result.get('pass') else 1)
