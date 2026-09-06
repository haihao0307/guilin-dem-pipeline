"""Local shader readback test in Chromium; not a smoke renderer or device benchmark.
Requires Playwright and a local Chromium executable, with no downloaded web assets.
Run with python webgl_probe.py --chromium /usr/bin/chromium.
"""
from __future__ import annotations
import argparse,json,hashlib,platform
from pathlib import Path
from playwright.sync_api import sync_playwright

JS=r'''() => {
const c=document.createElement('canvas');c.width=1;c.height=1;document.body.appendChild(c);
const gl=c.getContext('webgl2',{antialias:false});
if(!gl)throw Error('WebGL2 unavailable');
if(!gl.getExtension('EXT_color_buffer_float'))throw Error('Float color buffer unavailable');
const ext=gl.getExtension('WEBGL_debug_renderer_info');
const renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
const vs=`#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.,1.);}`;
const fs=`#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D density;
uniform float lengthM;
uniform float extinction;
uniform int steps;
out vec4 result;
void main(){
 float T=1.0;float ds=lengthM/float(steps);
 for(int i=0;i<256;i++){
  if(i>=steps)break;
  float z=(float(i)+.5)/float(steps);
  float c=max(texture(density,vec3(.5,.5,z)).r,0.0);
  T*=exp(-extinction*c*ds);
 }
 float fw=pow((1.33-1.0)/(1.33+1.0),2.0);
 float fg=pow((1.52-1.0)/(1.52+1.0),2.0);
 result=vec4(T,fw,fg,1.0);
}`;
function compile(type,text){const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const vertex=compile(gl.VERTEX_SHADER,vs),fragment=compile(gl.FRAGMENT_SHADER,fs);
const pr=gl.createProgram();gl.attachShader(pr,vertex);gl.attachShader(pr,fragment);gl.linkProgram(pr);
if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));gl.useProgram(pr);
const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const field=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,field);
gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
for(const param of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,param,gl.CLAMP_TO_EDGE);
gl.texImage3D(gl.TEXTURE_3D,0,gl.R32F,8,8,8,0,gl.RED,gl.FLOAT,new Float32Array(512).fill(.7));
gl.uniform1i(gl.getUniformLocation(pr,'density'),0);
const target=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,target);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,1,1,0,gl.RGBA,gl.FLOAT,null);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);
if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete FBO');
gl.viewport(0,0,1,1);
function draw(steps,lengthM,extinction){
 gl.uniform1i(gl.getUniformLocation(pr,'steps'),steps);gl.uniform1f(gl.getUniformLocation(pr,'lengthM'),lengthM);gl.uniform1f(gl.getUniformLocation(pr,'extinction'),extinction);
 gl.drawArrays(gl.TRIANGLES,0,3);const out=new Float32Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,out);return Array.from(out);
}
const rows=[16,64,128].map(n=>({steps:n,pixel:draw(n,5,1)}));
const zero=draw(32,5,0),twice=draw(64,5,2),half=draw(64,2.5,1);
const names=[];function check(name,yes){if(!yes)throw Error(name);names.push(name);}
check('shader_compiles_and_links',true);
check('homogeneous_3d_density_matches_beer_transmission',rows.every(r=>Math.abs(r.pixel[0]-Math.exp(-3.5))<1e-5));
check('ray_step_count_preserves_optical_thickness',Math.abs(rows[0].pixel[0]-rows[2].pixel[0])<1e-5);
check('zero_extinction_is_transparent',Math.abs(zero[0]-1)<1e-7);
check('larger_extinction_reduces_beam_transmission',twice[0]<rows[1].pixel[0]);
check('shorter_path_transmits_more',half[0]>rows[1].pixel[0]);
check('water_and_glass_example_f0_are_distinct',Math.abs(rows[0].pixel[1]-.0200593122)<1e-6&&Math.abs(rows[0].pixel[2]-.042579995)<1e-6);
check('all_readback_channels_are_finite',rows.every(r=>r.pixel.every(Number.isFinite)));
check('no_webgl_errors',gl.getError()===gl.NO_ERROR);
gl.deleteFramebuffer(fbo);gl.deleteTexture(target);gl.deleteTexture(field);gl.deleteVertexArray(vao);gl.deleteProgram(pr);gl.deleteShader(vertex);gl.deleteShader(fragment);
return {status:'passed',checks:names.length,names,renderer,webglVersion:gl.getParameter(gl.VERSION),rows,zero,twice,half,
 scope:'Own 1-pixel floating-point shader readback using a constant 8^3 density texture. No fluid solver or visual quality test.',
 nativeGPUPerformanceValidated:false,productionIntegration:false,visualAcceptance:false,productionReady:false};
}'''

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--chromium',default='/usr/bin/chromium');args=ap.parse_args()
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content('<!doctype html><title>Internal scalar shader probe</title>')
        try:
            result=page.evaluate(JS)
        except Exception as exc:
            result={'status':'blocked','checks':0,'error':str(exc),'scope':'Browser launched; no WebGL2 context obtained, so shader compile/run/readback not reached.',
                    'nativeGPUPerformanceValidated':False,'productionIntegration':False,'visualAcceptance':False,'productionReady':False}
        finally:
            result['browserVersion']=browser.version;result['pageErrors']=errors
            result['python']=platform.python_version();result['script_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
            browser.close()
    print(json.dumps(result,indent=2,allow_nan=False))
if __name__=='__main__':main()
