#!/usr/bin/env python3
"""Real Chromium compile/link preflight only. Never draws, waits for fences or claims pixels."""
import json,pathlib,subprocess,argparse,time
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
sources=json.loads(subprocess.check_output(['node',str(pathlib.Path(__file__).with_suffix('.mjs'))],text=True));report={}
with sync_playwright() as w:
 b=w.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page();page.set_default_timeout(90000)
 report=page.evaluate('''sources=>{const gl=document.createElement('canvas').getContext('webgl2'),r={stages:[],passed:true,drawCalls:0,fenceCalls:0};if(!gl)throw Error('WebGL2 unavailable');const ext=gl.getExtension('WEBGL_debug_renderer_info');r.gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);const vs='#version 300 es\\nprecision highp float;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}';for(const [scene,programs]of Object.entries(sources))for(const[name,source]of Object.entries(programs)){const at=performance.now(),shaders=[],item={scene,name,characters:source.length,compiled:false,linked:false};try{for(const[type,text]of[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,source]]){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));}const p=gl.createProgram();for(const s of shaders)gl.attachShader(p,s);gl.linkProgram(p);item.compiled=true;item.linked=gl.getProgramParameter(p,gl.LINK_STATUS);if(!item.linked)item.error=gl.getProgramInfoLog(p);gl.deleteProgram(p);}catch(e){item.error=e.message;}for(const s of shaders)gl.deleteShader(s);item.wallMs=performance.now()-at;r.stages.push(item);if(!item.linked)r.passed=false;}return r;}''',sources)
 b.close()
(out/'compile-link.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2),flush=True)
raise SystemExit(0 if report['passed'] else 1)
