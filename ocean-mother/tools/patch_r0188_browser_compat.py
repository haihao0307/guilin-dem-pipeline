#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

BASE_VERSION = "0.3.8-island-r018-wave-refinement"
VERSION = "0.3.8.1-island-r018-browser-compat"
BUILD_ID = "island-r018-wave-refinement-link-repair"

OLD_LINK_BLOCK = """function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){throw new Error(gl.getShaderInfoLog(s)||'Shader compilation failed');}return s;}
let program;
try{program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERT));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Program link failed');}
catch(err){document.getElementById('fallback').classList.add('show');document.getElementById('fallback').innerHTML='<div><h1>海岛着色器启动失败</h1><pre style=\"white-space:pre-wrap;text-align:left\">'+String(err.message||err)+'</pre></div>';document.getElementById('loading').classList.add('done');return;}
"""

NEW_LINK_BLOCK = """// R018.8.1 browser-compatibility ladder. The full R018.8 shader remains first choice.
// Some Windows/ANGLE drivers accept both shader stages but fail while linking the
// monolithic volumetric program. Lower tiers preserve the same controls and fields,
// reducing static loop expansion only when the complete program cannot be linked.
const VERT_LINK_SAFE=VERT.replace('out vec2 vUv;\\n','').replace('vUv=aPosition*.5+.5;','');
const FRAG_LINK_SAFE=FRAG.replace('in vec2 vUv;\\n','');
const FRAG_COMPAT=FRAG_LINK_SAFE
  .replace('for(int i=0;i<5;i++)','for(int i=0;i<4;i++)')
  .replaceAll('for(int i=0;i<3;i++){','for(int i=0;i<2;i++){')
  .replace('for(int i=0;i<82;i++){','for(int i=0;i<52;i++){')
  .replace('for(int i=0;i<7;i++){','for(int i=0;i<4;i++){')
  .replace('const int STEPS=22;','const int STEPS=8;');
const FRAG_SAFE=FRAG_LINK_SAFE
  .replace('for(int i=0;i<5;i++)','for(int i=0;i<3;i++)')
  .replaceAll('for(int i=0;i<3;i++){','for(int i=0;i<1;i++){')
  .replace('for(int i=0;i<2;i++){','for(int i=0;i<1;i++){')
  .replace('for(int i=0;i<82;i++){','for(int i=0;i<34;i++){')
  .replace('for(int i=0;i<7;i++){','for(int i=0;i<3;i++){')
  .replace('const int STEPS=22;','const int STEPS=1;')
  .replace('float curl=curlDensity(p);\\n    float spray=sprayDensity(p);\\n    float smoke=smokeDensityAt(p);\\n    float dens=curl*.22+spray*.085+smoke*.084;',
           'float curl=0.,spray=0.,smoke=0.,dens=0.;');

const shaderDiagnostics=[];
function rendererInfo(){
  const ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {
    vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),
    renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
    version:gl.getParameter(gl.VERSION),
    shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    maxFragmentUniformVectors:gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
    maxVaryingVectors:gl.getParameter(gl.MAX_VARYING_VECTORS)
  };
}
function compileShader(type,source,label){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    const log=gl.getShaderInfoLog(shader)||'Shader compilation failed without a driver log';
    gl.deleteShader(shader);
    throw new Error(label+': '+log);
  }
  return shader;
}
function tryProgram(candidate){
  let vertex=null,fragment=null,p=null;
  try{
    vertex=compileShader(gl.VERTEX_SHADER,candidate.vert,candidate.label+' vertex');
    fragment=compileShader(gl.FRAGMENT_SHADER,candidate.frag,candidate.label+' fragment');
    p=gl.createProgram();
    gl.attachShader(p,vertex);gl.attachShader(p,fragment);
    gl.bindAttribLocation(p,0,'aPosition');
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)){
      throw new Error(candidate.label+': '+(gl.getProgramInfoLog(p)||'Program link failed without a driver log'));
    }
    gl.detachShader(p,vertex);gl.detachShader(p,fragment);gl.deleteShader(vertex);gl.deleteShader(fragment);
    shaderDiagnostics.push({tier:candidate.label,ok:true});
    return p;
  }catch(error){
    const glError=gl.getError();
    shaderDiagnostics.push({tier:candidate.label,ok:false,error:String(error.message||error),glError});
    if(p)gl.deleteProgram(p);if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);
    return null;
  }
}
const requestedTier=(new URLSearchParams(location.search).get('shader')||window.__OCEAN_FORCE_SHADER_TIER__||'auto').toLowerCase();
const shaderCandidates=[
  {label:'full',vert:VERT,frag:FRAG},
  {label:'full-link-safe',vert:VERT_LINK_SAFE,frag:FRAG_LINK_SAFE},
  {label:'compat',vert:VERT_LINK_SAFE,frag:FRAG_COMPAT},
  {label:'safe',vert:VERT_LINK_SAFE,frag:FRAG_SAFE}
];
let program=null,shaderTier='none';
for(const candidate of shaderCandidates){
  if(requestedTier!=='auto'&&requestedTier!==candidate.label)continue;
  program=tryProgram(candidate);
  if(program){shaderTier=candidate.label;break;}
}
window.__OCEAN_SHADER_DIAGNOSTICS__={requestedTier,selectedTier:shaderTier,renderer:rendererInfo(),attempts:shaderDiagnostics};
if(!program){
  const details=shaderDiagnostics.map(x=>x.tier+': '+(x.error||'failed')+' [GL '+x.glError+']').join('\\n');
  document.getElementById('fallback').classList.add('show');
  document.getElementById('fallback').innerHTML='<div><h1>海岛着色器启动失败</h1><p>浏览器已尝试完整、兼容和安全渲染路径。</p><pre style=\"white-space:pre-wrap;text-align:left;max-width:min(760px,90vw);font-size:11px\">'+details+'</pre></div>';
  document.getElementById('loading').classList.add('done');return;
}
"""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def patch_html(text: str) -> str:
    if VERSION in text and "const FRAG_COMPAT=" in text:
        raise RuntimeError("input is already patched")
    if OLD_LINK_BLOCK not in text:
        raise RuntimeError("the frozen R018.8 program-link block was not found")

    text = text.replace(OLD_LINK_BLOCK, NEW_LINK_BLOCK, 1)
    text = text.replace(
        "<title>Ocean Mother | R018.8 海岛金岸真实感工作台</title>",
        "<title>Ocean Mother | R018.8.1 海岛金岸兼容修复</title>",
        1,
    )
    text = text.replace("ISLAND GOLD COAST / R018.8", "ISLAND GOLD COAST / R018.8.1", 1)
    text = text.replace("<b>R018.8</b></div></section>", "<b>R018.8.1</b></div></section>", 1)
    text = text.replace(
        "<span>R018.8 · 真实感候选</span></footer>",
        "<span>R018.8.1 · 浏览器兼容修复</span></footer>",
        1,
    )
    text = text.replace(
        "version:'0.3.8-island-r018-wave-refinement',buildId:'island-r018-wave-refinement-deep-restore'",
        f"version:'{VERSION}',buildId:'{BUILD_ID}'",
        1,
    )
    text = text.replace(
        "deepModel:'frozen Ocean Mother V001'}",
        "deepModel:'frozen Ocean Mother V001',shaderTier,shaderDiagnostics:window.__OCEAN_SHADER_DIAGNOSTICS__}",
        1,
    )
    text = text.replace(
        "const dt=Math.min(.05,(now-last)/1000);",
        "const dt=Math.max(0,Math.min(.05,(now-last)/1000));",
        1,
    )
    text = text.replace(
        "syncEffects();resize();setTimeout(()=>document.getElementById('loading').classList.add('done'),550);requestAnimationFrame(draw);",
        "syncEffects();resize();if(shaderTier!=='full'){document.getElementById('status').textContent='兼容渲染 · 实时运行';}setTimeout(()=>document.getElementById('loading').classList.add('done'),550);requestAnimationFrame(draw);",
        1,
    )
    required = [
        VERSION,
        BUILD_ID,
        "const FRAG_COMPAT=",
        "const FRAG_SAFE=",
        "window.__OCEAN_SHADER_DIAGNOSTICS__",
        "full-link-safe",
        "Program link failed without a driver log",
    ]
    for marker in required:
        if marker not in text:
            raise RuntimeError(f"missing patched marker: {marker}")
    return text


def main() -> None:
    parser = argparse.ArgumentParser(description="Patch the frozen Ocean Mother R018.8 HTML with a deterministic WebGL2 link fallback ladder.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--receipt", required=True, type=Path)
    args = parser.parse_args()

    source = args.input.read_bytes()
    patched = patch_html(source.decode("utf-8")).encode("utf-8")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(patched)

    receipt = {
        "format": "ocean-r0188-browser-compat-patch",
        "baseVersion": BASE_VERSION,
        "version": VERSION,
        "buildId": BUILD_ID,
        "sourceBytes": len(source),
        "sourceSha256": sha256(source),
        "outputBytes": len(patched),
        "outputSha256": sha256(patched),
        "visualFieldMutation": False,
        "repairScope": [
            "WebGL2 program-link retry ladder",
            "unused varying removal in second tier",
            "reduced static loop expansion in compatibility tiers",
            "driver and link diagnostics",
            "negative frame-delta clamp",
        ],
        "shaderTiers": ["full", "full-link-safe", "compat", "safe"],
        "generatedImagesUsed": False,
        "externalModels": 0,
        "externalCdn": 0,
        "visualApproved": False,
        "productionApproved": False,
    }
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False))


if __name__ == "__main__":
    main()
