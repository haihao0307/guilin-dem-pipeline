from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds

from common import read_json, sha256_file, utc_now, write_json


class PipelineError(RuntimeError):
    pass


def json_if_exists(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return read_json(path)
    except Exception:
        return default


def downsample_height(dem_path: Path, assets: Path, max_side: int = 321) -> dict[str, Any]:
    with rasterio.open(dem_path) as dataset:
        scale = max(dataset.width / max_side, dataset.height / max_side, 1.0)
        width = max(2, int(round(dataset.width / scale)))
        height = max(2, int(round(dataset.height / scale)))
        data = dataset.read(1, out_shape=(height, width), masked=True, resampling=Resampling.bilinear)
        mask = (~np.ma.getmaskarray(data)).astype(np.uint8)
        values = np.asarray(data.filled(np.nan), dtype=np.float32)
        valid = values[np.isfinite(values) & (mask == 1)]
        if valid.size == 0:
            raise PipelineError("DEM preview grid contains no valid pixels")
        minimum = float(np.nanmin(valid))
        maximum = float(np.nanmax(valid))
        value_range = max(maximum - minimum, 1e-6)
        normalized = np.clip((np.nan_to_num(values, nan=minimum) - minimum) / value_range, 0.0, 1.0)
        quantized = np.round(normalized * 65535.0).astype("<u2")
        height_path = assets / "height_u16.bin"
        mask_path = assets / "mask_u8.bin"
        height_path.write_bytes(quantized.tobytes(order="C"))
        mask_path.write_bytes(mask.tobytes(order="C"))
        bounds = list(dataset.bounds)
        wgs84_bounds = list(transform_bounds(dataset.crs, "EPSG:4326", *dataset.bounds, densify_pts=21)) if dataset.crs else None
        resolution = [abs(dataset.transform.a), abs(dataset.transform.e)]
        width_m = float(bounds[2] - bounds[0])
        height_m = float(bounds[3] - bounds[1])
        height_sha256 = sha256_file(height_path)
        mask_sha256 = sha256_file(mask_path)
        return {
            "schemaVersion": "terrain-manifest/v1",
            "assetVersion": f"guilin-{height_sha256[:12]}",
            "ready": True,
            "gridWidth": width,
            "gridHeight": height,
            "minimumElevation": minimum,
            "maximumElevation": maximum,
            "bounds": bounds,
            "wgs84Bounds": wgs84_bounds,
            "crs": dataset.crs.to_string() if dataset.crs else None,
            "resolution": resolution,
            "widthMeters": width_m,
            "heightMeters": height_m,
            "axisConvention": {"x": "east", "y": "up", "z": "south"},
            "rowOrder": "north-to-south",
            "columnOrder": "west-to-east",
            "heightEncoding": {
                "sampleType": "uint16",
                "byteOrder": "little-endian",
                "quantizationMinimumMeters": minimum,
                "quantizationMaximumMeters": maximum,
                "decodeFormula": "min_m + sample_u16 / 65535 * (max_m - min_m)",
            },
            "heightBinary": "assets/height_u16.bin",
            "heightByteLength": height_path.stat().st_size,
            "heightSha256": height_sha256,
            "maskBinary": "assets/mask_u8.bin",
            "maskByteLength": mask_path.stat().st_size,
            "maskSha256": mask_sha256,
            "noDataPolicy": "mask_u8: 1=valid elevation, 0=outside or NoData",
            "validFraction": float(mask.mean()),
        }


def build_html(meta: dict[str, Any], provisional_uri: str, preview_uri: str) -> str:
    template = r'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>桂林扩展 DEM 完整范围预览</title>
  <style>
    :root{color-scheme:dark;--bg:#07100e;--panel:rgba(14,27,23,.86);--line:rgba(188,221,202,.16);--text:#eef5f0;--muted:#9fb2a8;--accent:#e7b760;--good:#61c58d;--warn:#e99b61;--bad:#e27474}
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:radial-gradient(circle at 68% 0,#193226 0,#0b1612 31%,#050908 100%);font-family:Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--text)}
    body{overflow-x:hidden}.shell{max-width:1540px;margin:0 auto;padding:22px}.top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:end;margin-bottom:18px}
    .eyebrow{font-size:12px;letter-spacing:.18em;color:var(--accent);text-transform:uppercase}.title{font-size:clamp(28px,4vw,56px);line-height:1.04;margin:8px 0 10px;font-weight:760}.subtitle{color:var(--muted);max-width:900px;line-height:1.75}
    .badge{display:inline-flex;align-items:center;gap:9px;padding:10px 14px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.04);font-size:13px;white-space:nowrap}.dot{width:9px;height:9px;border-radius:50%;background:var(--warn);box-shadow:0 0 18px currentColor}.badge.good .dot{background:var(--good)}
    .grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px}.viewer{position:relative;min-height:720px;border:1px solid var(--line);border-radius:24px;overflow:hidden;background:#020504;box-shadow:0 24px 80px rgba(0,0,0,.32)}
    #gl,#flat{position:absolute;inset:0;width:100%;height:100%;display:block}#flat{object-fit:contain;background:#f5f4ef;padding:18px}.hidden{display:none!important}
    .toolbar{position:absolute;z-index:5;left:18px;top:18px;display:flex;flex-wrap:wrap;gap:8px}.btn{border:1px solid rgba(255,255,255,.16);background:rgba(5,12,9,.72);backdrop-filter:blur(14px);color:var(--text);padding:10px 13px;border-radius:12px;cursor:pointer;font:inherit}.btn:hover,.btn.active{border-color:rgba(231,183,96,.7);background:rgba(67,48,20,.54)}
    .hud{position:absolute;z-index:5;left:18px;right:18px;bottom:18px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end}.hud-card{max-width:680px;padding:15px 16px;border:1px solid var(--line);background:rgba(4,10,7,.74);backdrop-filter:blur(15px);border-radius:16px}.hud-title{font-weight:700;margin-bottom:6px}.hud-copy{font-size:13px;color:var(--muted);line-height:1.6}.control{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line);background:rgba(4,10,7,.76);backdrop-filter:blur(15px);border-radius:14px;font-size:12px}.control input{width:150px}
    .side{display:flex;flex-direction:column;gap:14px}.card{border:1px solid var(--line);border-radius:18px;background:var(--panel);padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.18)}.card h2{margin:0 0 13px;font-size:15px}.metric{display:grid;grid-template-columns:1fr auto;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.075);font-size:13px}.metric:last-child{border-bottom:0}.metric span:first-child{color:var(--muted)}.metric strong{text-align:right;font-weight:650}
    .statusline{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.55;color:var(--muted);margin:11px 0}.statusline i{width:8px;height:8px;margin-top:6px;border-radius:50%;background:var(--good);flex:0 0 auto}.statusline.warn i{background:var(--warn)}.statusline.bad i{background:var(--bad)}
    .sources{font-size:12px;line-height:1.7;color:var(--muted);word-break:break-word}.footer{margin:18px 0 6px;color:#7f9288;font-size:12px;line-height:1.8}.empty{position:absolute;inset:0;display:grid;place-items:center;padding:40px;text-align:center;background:linear-gradient(155deg,#0c1c17,#050907)}.empty img{max-width:min(90%,760px);max-height:72vh;border-radius:18px;background:white}.empty h3{margin:18px 0 8px;font-size:21px}.empty p{margin:0;color:var(--muted);max-width:650px;line-height:1.8}
    @media(max-width:1080px){.grid{grid-template-columns:1fr}.side{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.viewer{min-height:680px}}@media(max-width:700px){.shell{padding:12px}.top{grid-template-columns:1fr}.viewer{min-height:590px;border-radius:18px}.side{grid-template-columns:1fr}.hud{grid-template-columns:1fr}.control{justify-content:space-between}.toolbar{left:10px;top:10px}.hud{left:10px;right:10px;bottom:10px}.title{font-size:34px}}
  </style>
</head>
<body>
<div class="shell">
  <header class="top">
    <div><div class="eyebrow">DEM MAP PIPELINE · GUILIN</div><h1 class="title">真宝鼎北延至阳朔平乐交界</h1><div class="subtitle">北端覆盖真宝鼎峰顶向真北延伸十五公里，南端沿阳朔县与平乐县共享边界，旧有五张源片能找到时直接复用，缺失时由云端重新检索下载。网页显示当前已经完成的实际数据层级和来源状态。</div></div>
    <div id="statusBadge" class="badge"><span class="dot"></span><span id="statusText">读取状态</span></div>
  </header>
  <main class="grid">
    <section class="viewer">
      <canvas id="gl"></canvas>
      <img id="flat" class="hidden" alt="DEM 二维预览">
      <div id="empty" class="empty hidden"><div><img id="scopeImage" alt="任务范围"><h3>云端 DEM 构建已经登记</h3><p>当前页面先显示任务范围。GitHub Actions 完成源片下载、拼接、裁切和质检后，这里会自动切换为可旋转的真实三维地形。</p></div></div>
      <div class="toolbar"><button class="btn active" data-view="3d">三维地形</button><button class="btn" data-view="2d">二维高程图</button><button class="btn" id="reset">重置视角</button></div>
      <div class="hud"><div class="hud-card"><div class="hud-title" id="hudTitle">完整范围地形</div><div class="hud-copy" id="hudCopy">拖动旋转，滚轮缩放。页面只把有真实高程数据的区域做成立体网格。</div></div><label class="control">垂直倍率 <input id="exaggeration" type="range" min="0.6" max="8" step="0.1" value="3.2"><strong id="exValue">3.2×</strong></label></div>
    </section>
    <aside class="side">
      <section class="card"><h2>范围</h2><div class="metric"><span>北端</span><strong id="north">读取中</strong></div><div class="metric"><span>南端</span><strong>阳朔与平乐共享边界</strong></div><div class="metric"><span>任务面积</span><strong id="area">读取中</strong></div><div class="metric"><span>目标坐标系</span><strong>EPSG:32649</strong></div></section>
      <section class="card"><h2>成果</h2><div class="metric"><span>当前数据源</span><strong id="source">读取中</strong></div><div class="metric"><span>输出像元</span><strong id="spacing">读取中</strong></div><div class="metric"><span>有效覆盖</span><strong id="coverage">读取中</strong></div><div class="metric"><span>高程范围</span><strong id="elev">读取中</strong></div></section>
      <section class="card"><h2>构建状态</h2><div id="statusLines"></div></section>
      <section class="card"><h2>源片与谱系</h2><div id="sourceDetail" class="sources"></div></section>
    </aside>
  </main>
  <div class="footer">成果登记规则：ASF RTC 产品按“12.5 米输出像元参考 DEM”记录，不登记为原生 12.5 米测绘高程。临时公开数据源会在页面中明确标注，并在 Earthdata 凭据可用后整体替换。</div>
</div>
<script>
const META=__META_JSON__;
const PROVISIONAL='__PROVISIONAL_DATA__';
const PREVIEW='__PREVIEW_DATA__';
const $=s=>document.querySelector(s);
const fmt=(n,d=2)=>Number.isFinite(Number(n))?Number(n).toLocaleString('zh-CN',{maximumFractionDigits:d}):'待生成';
function setStatus(){
  const t=META.terrain||{}; const s=META.runtimeSource||{}; const ready=!!t.ready;
  $('#statusText').textContent=ready?(s.temporaryFallback?'临时完整范围图已生成':'ASF 完整范围图已生成'):'等待云端构建';
  $('#statusBadge').classList.toggle('good',ready&&!s.temporaryFallback);
  $('#north').textContent=`真宝鼎北 ${fmt(META.scope?.northExtensionMeters/1000,0)} km`;
  $('#area').textContent=`${fmt(META.scope?.areaSquareKilometers,1)} km²`;
  $('#source').textContent=s.productLabel||'等待下载';
  $('#spacing').textContent=t.resolution?`${fmt(t.resolution[0],1)} m`:(s.outputPixelSpacingMeters?`${fmt(s.outputPixelSpacingMeters,1)} m`:'待生成');
  $('#coverage').textContent=t.ready?`${fmt((t.validFraction||0)*100,3)}%`:'待质检';
  $('#elev').textContent=t.ready?`${fmt(t.minimumElevation,1)} 至 ${fmt(t.maximumElevation,1)} m`:'待生成';
  const lines=[];
  lines.push([META.boundaryExact?'good':'warn',META.boundaryExact?'阳朔平乐共享边界已精确解析':'当前仍使用离线范围预览']);
  lines.push([META.asfPlanCreated?'good':'warn',META.asfPlanCreated?`ASF 新增选片计划已生成，共 ${META.selectedProductCount||0} 项`:'ASF 选片计划等待云端检索']);
  lines.push([ready?'good':'warn',ready?'拼接、裁切、COG 与网页高度网格已生成':'真实 DEM 尚未生成']);
  if(s.temporaryFallback) lines.push(['warn','当前显示公开约30米临时完整范围图，ASF 下载完成后会替换']);
  $('#statusLines').innerHTML=lines.map(([c,x])=>`<div class="statusline ${c==='warn'?'warn':c==='bad'?'bad':''}"><i></i><span>${x}</span></div>`).join('');
  const detail=[];
  detail.push(`<b>模式</b>：${s.mode||'pending'}`);
  detail.push(`<b>提供方</b>：${s.provider||'等待数据'}`);
  if(META.existingResolvedCount!=null) detail.push(`<b>旧源片复用</b>：${META.existingResolvedCount}/5`);
  if(META.sourceFileCount!=null) detail.push(`<b>实际参与拼接</b>：${META.sourceFileCount} 张`);
  if(s.replacementPolicy) detail.push(`<b>替换规则</b>：${s.replacementPolicy}`);
  $('#sourceDetail').innerHTML=detail.join('<br>');
}
setStatus();
const canvas=$('#gl'),flat=$('#flat'),empty=$('#empty'),scopeImage=$('#scopeImage');
flat.src=PREVIEW||PROVISIONAL; scopeImage.src=PROVISIONAL;
let renderer=null;
function showView(view){
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='2d'){canvas.classList.add('hidden');empty.classList.add('hidden');flat.classList.remove('hidden');}
  else{flat.classList.add('hidden');if(META.terrain?.ready){canvas.classList.remove('hidden');empty.classList.add('hidden');renderer?.resize();}else{canvas.classList.add('hidden');empty.classList.remove('hidden');}}
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
$('#reset').onclick=()=>renderer?.reset();
const slider=$('#exaggeration');slider.oninput=()=>{ $('#exValue').textContent=`${Number(slider.value).toFixed(1)}×`; if(renderer) renderer.exaggeration=Number(slider.value); };

function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0])}
function lookAt(e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],zl=Math.hypot(zx,zy,zz)||1;zx/=zl;zy/=zl;zz/=zl;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx,xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xy/=xl;xz/=xl;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1])}
class TerrainRenderer{
 constructor(canvas,meta,height,mask){this.canvas=canvas;this.meta=meta;this.height=height;this.mask=mask;this.yaw=.72;this.pitch=.68;this.distance=2.35;this.exaggeration=Number(slider.value);this.drag=false;this.init();this.bind();this.resize();requestAnimationFrame(()=>this.draw())}
 reset(){this.yaw=.72;this.pitch=.68;this.distance=2.35}
 shader(type,src){const g=this.gl,s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));return s}
 init(){const g=this.gl=this.canvas.getContext('webgl2',{antialias:true});if(!g)throw new Error('WebGL2 unavailable');
 const vs=`#version 300 es\nin vec3 p;in float h;uniform mat4 vp;uniform float ex;out float vh;out vec3 wp;void main(){vec3 q=vec3(p.x,p.y*ex,p.z);wp=q;vh=h;gl_Position=vp*vec4(q,1.);}`;
 const fs=`#version 300 es\nprecision highp float;in float vh;in vec3 wp;out vec4 o;vec3 pal(float t){vec3 a=mix(vec3(.035,.12,.10),vec3(.20,.38,.19),smoothstep(0.,.38,t));vec3 b=mix(vec3(.20,.38,.19),vec3(.62,.50,.27),smoothstep(.32,.72,t));vec3 c=mix(b,vec3(.90,.88,.78),smoothstep(.68,1.,t));return mix(a,c,smoothstep(.28,.8,t));}void main(){vec3 n=normalize(cross(dFdx(wp),dFdy(wp)));if(!gl_FrontFacing)n=-n;vec3 l=normalize(vec3(-.4,.85,.25));float d=.28+.72*max(dot(n,l),0.);float rim=pow(1.-max(n.y,0.),2.)*.12;vec3 col=pal(vh)*(d+rim);o=vec4(col,1.);}`;
 const pr=g.createProgram();g.attachShader(pr,this.shader(g.VERTEX_SHADER,vs));g.attachShader(pr,this.shader(g.FRAGMENT_SHADER,fs));g.linkProgram(pr);if(!g.getProgramParameter(pr,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(pr));this.program=pr;
 const w=this.meta.gridWidth,H=this.meta.gridHeight,maxDim=Math.max(this.meta.widthMeters,this.meta.heightMeters),verts=new Float32Array(w*H*4);let k=0;for(let r=0;r<H;r++)for(let c=0;c<w;c++){const i=r*w+c,n=this.height[i]/65535,valid=this.mask[i]>0;verts[k++]=(c/(w-1)-.5)*2*this.meta.widthMeters/maxDim;verts[k++]=valid?n*(this.meta.maximumElevation-this.meta.minimumElevation)/maxDim*2:0;verts[k++]=(r/(H-1)-.5)*2*this.meta.heightMeters/maxDim;verts[k++]=n}
 const idx=[];for(let r=0;r<H-1;r++)for(let c=0;c<w-1;c++){const a=r*w+c,b=a+1,d=(r+1)*w+c,e=d+1;if(this.mask[a]&&this.mask[b]&&this.mask[d]&&this.mask[e])idx.push(a,d,b,b,d,e)}this.count=idx.length;
 const vao=g.createVertexArray();g.bindVertexArray(vao);const vb=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,vb);g.bufferData(g.ARRAY_BUFFER,verts,g.STATIC_DRAW);const pl=g.getAttribLocation(pr,'p'),hl=g.getAttribLocation(pr,'h');g.enableVertexAttribArray(pl);g.vertexAttribPointer(pl,3,g.FLOAT,false,16,0);g.enableVertexAttribArray(hl);g.vertexAttribPointer(hl,1,g.FLOAT,false,16,12);const ib=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,ib);g.bufferData(g.ELEMENT_ARRAY_BUFFER,new Uint32Array(idx),g.STATIC_DRAW);this.vao=vao;this.vp=g.getUniformLocation(pr,'vp');this.ex=g.getUniformLocation(pr,'ex');g.enable(g.DEPTH_TEST);g.enable(g.CULL_FACE);g.cullFace(g.BACK)}
 bind(){this.canvas.addEventListener('pointerdown',e=>{this.drag=true;this.x=e.clientX;this.y=e.clientY;this.canvas.setPointerCapture(e.pointerId)});this.canvas.addEventListener('pointermove',e=>{if(!this.drag)return;this.yaw+=(e.clientX-this.x)*.008;this.pitch=Math.max(.18,Math.min(1.35,this.pitch+(e.clientY-this.y)*.006));this.x=e.clientX;this.y=e.clientY});this.canvas.addEventListener('pointerup',()=>this.drag=false);this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.distance=Math.max(1.15,Math.min(5,this.distance*Math.exp(e.deltaY*.001)))},{passive:false});window.addEventListener('resize',()=>this.resize())}
 resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);if(this.canvas.width!==Math.round(w*d)||this.canvas.height!==Math.round(h*d)){this.canvas.width=Math.round(w*d);this.canvas.height=Math.round(h*d);this.gl?.viewport(0,0,this.canvas.width,this.canvas.height)}}
 draw(){const g=this.gl;this.resize();g.clearColor(.012,.025,.021,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);const cp=Math.cos(this.pitch),eye=[Math.sin(this.yaw)*cp*this.distance,Math.sin(this.pitch)*this.distance+.2,Math.cos(this.yaw)*cp*this.distance],vp=mul(perspective(.78,this.canvas.width/this.canvas.height,.01,20),lookAt(eye,[0,.06,0],[0,1,0]));g.useProgram(this.program);g.bindVertexArray(this.vao);g.uniformMatrix4fv(this.vp,false,vp);g.uniform1f(this.ex,this.exaggeration);g.drawElements(g.TRIANGLES,this.count,g.UNSIGNED_INT,0);requestAnimationFrame(()=>this.draw())}
}
async function startTerrain(){if(!META.terrain?.ready){showView('3d');return}try{const [hb,mb]=await Promise.all([fetch(META.terrain.heightBinary).then(r=>r.arrayBuffer()),fetch(META.terrain.maskBinary).then(r=>r.arrayBuffer())]);renderer=new TerrainRenderer(canvas,META.terrain,new Uint16Array(hb),new Uint8Array(mb));showView('3d')}catch(e){console.error(e);showView('2d');$('#hudCopy').textContent='三维高度网格载入失败，已切换二维预览。'}}
startTerrain();
</script>
</body></html>'''
    return (
        template.replace("__META_JSON__", json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
        .replace("__PROVISIONAL_DATA__", provisional_uri)
        .replace("__PREVIEW_DATA__", preview_uri)
    )


def run(config_path: Path, root: Path, site: Path) -> int:
    config = read_json(config_path)
    site.mkdir(parents=True, exist_ok=True)
    assets = site / "assets"
    assets.mkdir(parents=True, exist_ok=True)

    provisional_json = assets / "AOI_PREVIEW_PROVISIONAL.json"
    provisional_png = assets / "AOI_PREVIEW_PROVISIONAL.png"
    resolved_path = root / config["outputs"]["resolvedAoiJson"]
    resolved = json_if_exists(resolved_path, json_if_exists(provisional_json, {}))
    runtime_source = json_if_exists(root / "metadata" / "runtime_source.json", {"mode": "pending", "productLabel": "等待云端下载", "temporaryFallback": False})
    qa = json_if_exists(root / config["outputs"]["qaReport"], {})
    plan = json_if_exists(root / config["outputs"]["downloadPlan"], {})
    existing = json_if_exists(root / config["outputs"]["existingResolved"], {})
    source_manifest = json_if_exists(root / config["outputs"]["sourceManifest"], {})

    dem_path = root / config["outputs"]["finalDem"]
    preview_path = root / config["outputs"]["preview"]
    terrain: dict[str, Any] = {"ready": False}
    preview_uri = ""
    if dem_path.exists():
        terrain = downsample_height(dem_path, assets)
        terrain["manifestUrl"] = "assets/terrain-manifest.json"
        write_json(assets / "terrain-manifest.json", terrain)
        if preview_path.exists():
            shutil.copy2(preview_path, assets / "DEM_PREVIEW.png")
            preview_uri = "assets/DEM_PREVIEW.png"

    scope = {
        "northExtensionMeters": float(config.get("aoi", {}).get("northExtensionMeters", 15000)),
        "areaSquareKilometers": resolved.get("final", {}).get("areaSquareKilometersProjected"),
        "bounds": resolved.get("final", {}).get("bounds"),
    }
    selected = plan.get("selectedNewProducts", []) if isinstance(plan, dict) else []
    source_files = qa.get("sourceLineage", {}).get("files", []) if isinstance(qa, dict) else []
    cloud_status = json_if_exists(root / "reports" / "CLOUD_RUN_STATUS.json", {})
    meta = {
        "generatedAt": utc_now(),
        "project": config["project"],
        "scope": scope,
        "boundaryExact": resolved.get("status") == "exact_boundary_resolved",
        "runtimeSource": runtime_source,
        "terrain": terrain,
        "asfPlanCreated": bool(selected) or bool(cloud_status.get("asfPlanCreated")),
        "selectedProductCount": len(selected),
        "existingResolvedCount": int(existing.get("resolvedCount", 0) or 0),
        "sourceFileCount": len(source_files) if source_files else len(source_manifest.get("tiles", [])) if isinstance(source_manifest, dict) else 0,
        "qaStatus": qa.get("status"),
    }
    write_json(site / "status.json", meta)
    provisional_uri = "assets/AOI_PREVIEW_PROVISIONAL.png" if provisional_png.exists() else ""
    html = build_html(meta, provisional_uri, preview_uri)
    (site / "index.html").write_text(html, encoding="utf-8")
    print(f"网页预览：{site / 'index.html'}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the self-contained DEM web preview")
    parser.add_argument("--config", required=True)
    parser.add_argument("--root", required=True)
    parser.add_argument("--site", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        return run(Path(args.config).resolve(), Path(args.root).resolve(), Path(args.site).resolve())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
