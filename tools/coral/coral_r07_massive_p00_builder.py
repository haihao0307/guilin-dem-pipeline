from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

HTML = r'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Coral Mother R07 · NOAA Massive Coral P00</title>
<style>
:root{color-scheme:dark;--bg:#070b0d;--panel:#10181ddd;--line:#ffffff18;--text:#eef4f4;--muted:#93a5aa;--accent:#e3b16d;--stage:510px}
*{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%;background:radial-gradient(circle at 50% -10%,#133038 0,#081116 46%,#05080a 100%);color:var(--text);font:12px/1.42 Inter,system-ui,"PingFang SC","Microsoft YaHei",sans-serif}
body{overflow-x:hidden}main{width:100%;padding:5px 6px 12px}button,input{font:inherit}#stage{height:var(--stage);min-height:390px;position:relative;overflow:hidden;border:1px solid var(--line);border-radius:15px;background:linear-gradient(#061319,#071015 52%,#111717);box-shadow:0 22px 80px #000b}
#gl{display:block;width:100%;height:100%;touch-action:none;cursor:grab}#gl:active{cursor:grabbing}
#stageInfo{position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;justify-content:space-between;pointer-events:none;z-index:2}.chipRow{display:flex;gap:6px;flex-wrap:wrap}.chip,.titleBox{background:#0a1116d9;border:1px solid var(--line);backdrop-filter:blur(10px);border-radius:10px;padding:7px 10px;box-shadow:0 12px 34px #0007}.titleBox{max-width:640px}.titleBox b{font-size:14px}.titleBox small,.chip small{color:var(--muted)}.chip strong{color:var(--accent)}
#hud{position:absolute;right:12px;bottom:10px;padding:7px 10px;border-radius:9px;background:#071015d9;border:1px solid var(--line);text-align:right;color:var(--muted);pointer-events:none}#hud b{color:var(--text)}
#controls{margin-top:5px;border:1px solid var(--line);background:var(--panel);border-radius:14px;padding:10px 12px}.head{display:flex;align-items:center;justify-content:space-between;gap:12px}.head h1{font-size:16px;margin:0}.head p{margin:3px 0 0;color:var(--muted);font-size:10px}.badge{white-space:nowrap;border:1px solid #e3b16d44;background:#e3b16d0d;color:#f0c58c;border-radius:9px;padding:7px 9px;font-size:9px;font-weight:800;letter-spacing:.08em}
.toolbar{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.toolbar button{border:1px solid var(--line);background:#ffffff06;color:var(--text);padding:6px 10px;border-radius:8px;cursor:pointer}.toolbar button:hover,.toolbar button.on{border-color:#e3b16d88;background:#e3b16d18;color:#ffe3b7}
.sectionTitle{margin-top:9px;color:var(--accent);font-size:9px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin-top:5px}.param{display:block;border:1px solid var(--line);background:#0710158c;border-radius:9px;padding:7px 8px;min-width:0}.paramHead{display:flex;justify-content:space-between;gap:6px;align-items:center}.paramHead b{font-size:10px}.param output{color:#f0c58c;font-variant-numeric:tabular-nums}.param small{display:block;color:var(--muted);font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.param input{width:100%;accent-color:#d6a05c;margin:4px 0 2px}.qa{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:5px}.qaCard{border:1px solid var(--line);background:#0710158c;border-radius:8px;padding:7px 8px}.qaCard span{display:block;color:var(--muted);font-size:8px}.qaCard b{display:block;margin-top:2px;font-size:10px;font-variant-numeric:tabular-nums}.note{margin-top:7px;color:var(--muted);font-size:9px}.note strong{color:#e6c08c}
#error{display:none;position:fixed;inset:20% 12%;z-index:20;background:#421a16;border:1px solid #ff806d66;border-radius:12px;padding:18px;white-space:pre-wrap}
@media(max-width:1100px){:root{--stage:440px}.grid{grid-template-columns:repeat(4,minmax(0,1fr))}.qa{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:720px){:root{--stage:54vh}main{padding:3px}.head{align-items:flex-start}.head p,.badge{display:none}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.qa{grid-template-columns:repeat(2,minmax(0,1fr))}.titleBox{max-width:245px}.chipRow{display:none}#controls{padding:8px}}
@media(min-width:2000px) and (max-height:1200px){:root{--stage:500px}}
</style>
</head>
<body><main>
<section id="stage">
<canvas id="gl" aria-label="NOAA massive coral procedural workbench"></canvas>
<div id="stageInfo"><div class="titleBox"><b>Coral Mother R07 · Massive Coral P00</b><br><small>Porites lutea morphology prototype · NOAA Hard / stony coral → Massive coral</small></div><div class="chipRow"><div class="chip"><strong>NOAA TYPE</strong><br><small>HARD / STONY</small></div><div class="chip"><strong>NOAA FORM</strong><br><small>MASSIVE CORAL</small></div><div class="chip"><strong>PALAU</strong><br><small>UNRESOLVED</small></div><div class="chip"><strong>RUNTIME</strong><br><small>0 GLB / 0 TEX / 0 FETCH</small></div></div></div>
<div id="hud"><b id="viewName">45° massive profile</b><br><span id="fps">-- FPS</span><br><span id="meshStats">-- TRIANGLES</span></div>
</section>
<section id="controls">
<div class="head"><div><h1>NOAA Massive / Boulder Growth Form</h1><p>球状或巨石状稳定轮廓；当前只是 Porites lutea 形态候选，不宣称帕劳出现记录。</p></div><div class="badge">R07-P00 · visualAcceptance=false</div></div>
<div class="toolbar" id="views"><button data-view="persp" class="on">45°</button><button data-view="front">正面</button><button data-view="side">侧面</button><button data-view="top">顶面</button><button id="resetCamera">重置镜头</button><button id="resetParams">恢复参数</button></div>
<div class="sectionTitle">Massive coral parameters / 全部可调项</div>
<div class="grid" id="parameterDock">
<label class="param"><span class="paramHead"><b>整体宽度</b><output id="widthO">1.75</output></span><input id="width" type="range" min="1.10" max="2.40" step="0.01" value="1.75"><small>巨石珊瑚横向尺度</small></label>
<label class="param"><span class="paramHead"><b>整体高度</b><output id="heightO">1.20</output></span><input id="height" type="range" min="0.65" max="1.80" step="0.01" value="1.20"><small>控制穹顶高度</small></label>
<label class="param"><span class="paramHead"><b>穹顶圆钝</b><output id="domeO">1.05</output></span><input id="dome" type="range" min="0.55" max="1.70" step="0.01" value="1.05"><small>低值扁平，高值圆钝</small></label>
<label class="param"><span class="paramHead"><b>基底展开</b><output id="baseO">0.34</output></span><input id="base" type="range" min="0" max="0.85" step="0.01" value="0.34"><small>保持基底贴附，不悬空</small></label>
<label class="param"><span class="paramHead"><b>宏观团块</b><output id="lobesO">0.52</output></span><input id="lobes" type="range" min="0" max="1" step="0.01" value="0.52"><small>巨石表面的缓慢隆起</small></label>
<label class="param"><span class="paramHead"><b>Warp 形体扭曲</b><output id="warpO">0.24</output></span><input id="warp" type="range" min="0" max="1" step="0.01" value="0.24"><small>连续扭曲整体穹顶</small></label>
<label class="param"><span class="paramHead"><b>表面起伏</b><output id="undulationO">0.44</output></span><input id="undulation" type="range" min="0" max="1" step="0.01" value="0.44"><small>中尺度轮廓变化</small></label>
<label class="param"><span class="paramHead"><b>Microscope 尺度</b><output id="microScaleO">1.00</output></span><input id="microScale" type="range" min="0.45" max="2.10" step="0.01" value="1"><small>杯体分布尺度</small></label>
<label class="param"><span class="paramHead"><b>杯口凹凸</b><output id="microDepthO">0.72</output></span><input id="microDepth" type="range" min="0" max="1" step="0.01" value="0.72"><small>真实表面位移</small></label>
<label class="param"><span class="paramHead"><b>杯缘脊线</b><output id="ridgesO">0.58</output></span><input id="ridges" type="range" min="0" max="1" step="0.01" value="0.58"><small>杯缘与细脊</small></label>
<label class="param"><span class="paramHead"><b>骨骼颗粒</b><output id="grainO">0.34</output></span><input id="grain" type="range" min="0" max="1" step="0.01" value="0.34"><small>高频骨骼颗粒</small></label>
<label class="param"><span class="paramHead"><b>色彩饱和</b><output id="saturationO">1.00</output></span><input id="saturation" type="range" min="0.55" max="1.45" step="0.01" value="1"><small>整株保持统一主色</small></label>
</div>
<div class="sectionTitle">Numerical QA / 数值自检</div>
<div class="qa"><div class="qaCard"><span>NOAA class</span><b>HARD_MASSIVE</b></div><div class="qaCard"><span>Generated W:H:D</span><b id="extent">--</b></div><div class="qaCard"><span>Vertices / triangles</span><b id="meshCount">--</b></div><div class="qaCard"><span>Microscope coverage</span><b id="microCoverage">--</b></div><div class="qaCard"><span>Warp RMS</span><b id="warpRms">--</b></div><div class="qaCard"><span>Base anchor error</span><b id="baseError">--</b></div></div>
<div class="note"><strong>分类边界：</strong>Massive 是 NOAA 生长形态，不是属或种。Porites lutea 仅作本轮太平洋巨石形态候选；Palau occurrence 仍为 UNRESOLVED。</div>
</section></main><div id="error"></div>
<script>
'use strict';
const $=id=>document.getElementById(id),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,TAU=Math.PI*2;
const canvas=$('gl'),gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
if(!gl){$('error').style.display='block';$('error').textContent='WebGL2 unavailable';throw new Error('WebGL2 unavailable')}
const cfg={width:1.75,height:1.20,dome:1.05,base:.34,lobes:.52,warp:.24,undulation:.44,microScale:1,microDepth:.72,ridges:.58,grain:.34,saturation:1};
const defaults={...cfg};
const controls=Object.keys(defaults);
const VS=`#version 300 es
precision highp float;layout(location=0)in vec3 aPos;layout(location=1)in vec3 aNormal;layout(location=2)in vec4 aColor;uniform mat4 uMVP;uniform mat4 uModel;out vec3 vN;out vec3 vP;out vec4 vC;void main(){vec4 w=uModel*vec4(aPos,1.);vP=w.xyz;vN=normalize(mat3(uModel)*aNormal);vC=aColor;gl_Position=uMVP*vec4(aPos,1.);}`;
const FS=`#version 300 es
precision highp float;in vec3 vN;in vec3 vP;in vec4 vC;out vec4 outColor;uniform vec3 uLight;uniform vec3 uEye;void main(){vec3 n=normalize(vN),l=normalize(uLight-vP),v=normalize(uEye-vP),h=normalize(l+v);float diff=max(dot(n,l),0.),spec=pow(max(dot(n,h),0.),32.),rim=pow(1.-max(dot(n,v),0.),2.2);vec3 c=vC.rgb*(.20+.78*diff)+vec3(.17,.22,.22)*rim*.42+vec3(1.,.78,.52)*spec*.20;outColor=vec4(pow(max(c,0.),vec3(.86)),1.);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,VS));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));
const vao=gl.createVertexArray(),vbo=gl.createBuffer(),ebo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ebo);for(let i=0;i<3;i++){gl.enableVertexAttribArray(i)}gl.vertexAttribPointer(0,3,gl.FLOAT,false,40,0);gl.vertexAttribPointer(1,3,gl.FLOAT,false,40,12);gl.vertexAttribPointer(2,4,gl.FLOAT,false,40,24);gl.bindVertexArray(null);
const locMVP=gl.getUniformLocation(prog,'uMVP'),locModel=gl.getUniformLocation(prog,'uModel'),locLight=gl.getUniformLocation(prog,'uLight'),locEye=gl.getUniformLocation(prog,'uEye');
let indexCount=0,geometrySignature=0,lastBuild=0;
function v3(x=0,y=0,z=0){return[x,y,z]}function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]}function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}function len(a){return Math.hypot(a[0],a[1],a[2])}function norm(a){const l=len(a)||1;return[a[0]/l,a[1]/l,a[2]/l]}
function smooth(t){t=clamp(t,0,1);return t*t*(3-2*t)}
function field(phi,t){
  const fade=Math.pow(Math.sin(Math.PI*t),.72),baseFade=1-smooth((t-.80)/.20),
    w=cfg.warp*baseFade,
    wp=.18*w*(Math.sin(phi*2.1+t*5.7)+.45*Math.sin(phi*4.3-t*2.2)),
    wt=.035*w*(Math.sin(phi*3.2-t*4.6)+.5*Math.sin(phi*.9+t*7.1)),
    p=phi+wp,tt=clamp(t+wt,0,1),
    macro=cfg.lobes*fade*(.085*Math.sin(p*3+tt*4.1)+.055*Math.sin(p*5-tt*6.4+1.2)+.025*Math.sin(p*8+tt*3.3)),
    med=cfg.undulation*fade*(.050*Math.sin(p*7+tt*13.0)+.028*Math.sin(p*11-tt*9.0+2.4)),
    k=18*cfg.microScale,
    c0=.5+.5*Math.cos(p*k+tt*k*.53),c1=.5+.5*Math.cos(p*k*.52-tt*k*1.13+2.1),
    cell=Math.pow(clamp(c0*c1,0,1),2.25),rim=Math.pow(clamp(1-Math.abs(Math.sqrt(cell)-.56)/.19,0,1),1.8),
    ridge=cfg.ridges*.040*Math.sin(p*k*1.41+tt*k*.77),
    grain=cfg.grain*.023*Math.sin(p*k*3.2-tt*k*2.1)*Math.sin(p*k*1.3+tt*k*2.7),
    micro=cfg.microDepth*fade*(.095*rim-.112*cell+ridge+grain);
  return{p,tt,macro,med,micro};
}
function baseColor(){const c=[.67,.47,.25],l=.2126*c[0]+.7152*c[1]+.0722*c[2],s=cfg.saturation;return[c[0]*s+l*(1-s),c[1]*s+l*(1-s),c[2]*s+l*(1-s),1]}
function generate(){
  const start=performance.now(),LAT=72,LON=128,grid=[],positions=[],normals=[],colors=[],indices=[],col=baseColor();
  let min=[1e9,1e9,1e9],max=[-1e9,-1e9,-1e9],microSq=0,microAffected=0,warpSq=0,warpCount=0;
  for(let i=0;i<=LAT;i++){
    const row=[],t=i/LAT,theta=t*Math.PI*.5;
    for(let j=0;j<LON;j++){
      const phi=j/LON*TAU,f=field(phi,t),th=f.tt*Math.PI*.5,
        domePow=mix(1.55,.62,clamp((cfg.dome-.55)/1.15,0,1)),
        radialBase=cfg.width*Math.pow(Math.sin(th),mix(.86,1.22,cfg.base)),
        baseSpread=1+cfg.base*.22*Math.pow(t,5),
        radius=radialBase*baseSpread*(1+f.macro+f.med+f.micro),
        y=cfg.height*Math.pow(Math.cos(th),domePow)*(1-.055*cfg.base*Math.pow(t,4)),
        x=radius*Math.cos(f.p),z=radius*Math.sin(f.p),p=[x,Math.max(0,y),z],idx=positions.length;
      positions.push(p);row.push(idx);colors.push(col);
      for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k])}
      microSq+=f.micro*f.micro;if(Math.abs(f.micro)>.002)microAffected++;
      const wp=Math.abs(f.p-phi)+Math.abs(f.tt-t);warpSq+=wp*wp;warpCount++;
    }
    grid.push(row);
  }
  const baseCenter=positions.length;positions.push([0,0,0]);colors.push(col);
  for(let i=0;i<LAT;i++)for(let j=0;j<LON;j++){const k=(j+1)%LON,a=grid[i][j],b=grid[i][k],c=grid[i+1][k],d=grid[i+1][j];indices.push(a,d,c,a,c,b)}
  for(let j=0;j<LON;j++){const k=(j+1)%LON;indices.push(baseCenter,grid[LAT][k],grid[LAT][j])}
  normals.length=positions.length;for(let i=0;i<normals.length;i++)normals[i]=[0,0,0];
  for(let i=0;i<indices.length;i+=3){const ia=indices[i],ib=indices[i+1],ic=indices[i+2],n=cross(sub(positions[ib],positions[ia]),sub(positions[ic],positions[ia]));for(const id of[ia,ib,ic]){normals[id][0]+=n[0];normals[id][1]+=n[1];normals[id][2]+=n[2]}}
  let normalDeviationSq=0;for(let i=0;i<normals.length;i++){normals[i]=norm(normals[i]);if(i<baseCenter){const radial=norm([positions[i][0],Math.max(.001,positions[i][1]),positions[i][2]]),d=1-clamp(normals[i][0]*radial[0]+normals[i][1]*radial[1]+normals[i][2]*radial[2],-1,1);normalDeviationSq+=d*d}}
  const data=new Float32Array(positions.length*10);for(let i=0;i<positions.length;i++){const o=i*10;data.set(positions[i],o);data.set(normals[i],o+3);data.set(colors[i],o+6)}
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ebo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.DYNAMIC_DRAW);indexCount=indices.length;
  geometrySignature=0;for(let i=0;i<data.length;i+=97)geometrySignature+=Math.abs(data[i]||0)*.73+Math.abs(data[i+1]||0)*1.31+Math.abs(data[i+2]||0)*2.17;geometrySignature=Number(geometrySignature.toFixed(6));lastBuild=performance.now()-start;
  const ext=max.map((v,i)=>v-min[i]),microRms=Math.sqrt(microSq/(warpCount||1)),microCoverage=100*microAffected/(warpCount||1),warpRms=Math.sqrt(warpSq/(warpCount||1)),baseErr=Math.abs(min[1]);
  $('extent').textContent=ext.map(x=>x.toFixed(3)).join(' : ');$('meshCount').textContent=positions.length+' / '+(indices.length/3);$('microCoverage').textContent=microCoverage.toFixed(1)+'%';$('warpRms').textContent=warpRms.toFixed(4);$('baseError').textContent=baseErr.toExponential(1);$('meshStats').textContent=(indices.length/3)+' TRIANGLES';
  window.__CORAL_R07_QA__={ready:true,errors:window.__qaErrors||[],noaaBroadType:'Hard / stony coral',noaaGrowthForm:'Massive coral',noaaMorphologyId:'HARD_MASSIVE',candidateSpecies:'Porites lutea morphology prototype',palauOccurrenceEvidence:'UNRESOLVED',ecologicalPlacementReady:false,runtimeGLB:0,runtimeTextures:0,networkFetches:0,uniformSpeciesColor:true,meshColorCount:1,vertexCount:positions.length,triangleCount:indices.length/3,extent:ext,baseAnchorError:baseErr,microscopeGeometry:true,microDisplacementRms:microRms,microCoveragePct:microCoverage,warpGeometry:true,warpDisplacementRms:warpRms,normalDeviationRms:Math.sqrt(normalDeviationSq/Math.max(1,baseCenter)),geometrySignature,rebuildMs:lastBuild,visualAcceptance:false,productionReady:false};
}
function m4mul(a,b){const o=new Float32Array(16);for(let r=0;r<4;r++)for(let c=0;c<4;c++)o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];return o}
function perspective(fov,aspect,n,f){const t=1/Math.tan(fov/2),nf=1/(n-f);return new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0])}
function lookAt(e,t,u){const z=norm(sub(e,t)),x=norm(cross(u,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-(x[0]*e[0]+x[1]*e[1]+x[2]*e[2]),-(y[0]*e[0]+y[1]*e[1]+y[2]*e[2]),-(z[0]*e[0]+z[1]*e[1]+z[2]*e[2]),1])}
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),camera={yaw:.72,pitch:.38,dist:5.4,target:[0,.55,0]};let drag=false,lx=0,ly=0;
function resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.floor(canvas.clientWidth*d)),h=Math.max(1,Math.floor(canvas.clientHeight*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h)}
function eye(){const cp=Math.cos(camera.pitch);return[camera.target[0]+camera.dist*cp*Math.sin(camera.yaw),camera.target[1]+camera.dist*Math.sin(camera.pitch),camera.target[2]+camera.dist*cp*Math.cos(camera.yaw)]}
let frames=0,lastFps=performance.now();function render(now){resize();gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(.025,.055,.065,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const e=eye(),p=perspective(.72,canvas.width/canvas.height,.05,50),v=lookAt(e,camera.target,[0,1,0]),mvp=m4mul(p,m4mul(v,identity));gl.useProgram(prog);gl.uniformMatrix4fv(locMVP,false,mvp);gl.uniformMatrix4fv(locModel,false,identity);gl.uniform3fv(locLight,new Float32Array([3.8,5.5,4.2]));gl.uniform3fv(locEye,new Float32Array(e));gl.bindVertexArray(vao);gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_INT,0);frames++;if(now-lastFps>800){$('fps').textContent=Math.round(frames*1000/(now-lastFps))+' FPS';frames=0;lastFps=now}requestAnimationFrame(render)}
canvas.addEventListener('pointerdown',e=>{drag=true;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(!drag)return;camera.yaw-=(e.clientX-lx)*.008;camera.pitch=clamp(camera.pitch-(e.clientY-ly)*.008,-1.15,1.25);lx=e.clientX;ly=e.clientY});canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('wheel',e=>{e.preventDefault();camera.dist=clamp(camera.dist*Math.exp(e.deltaY*.001),2.4,12)},{passive:false});
function setView(v){document.querySelectorAll('#views [data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));if(v==='front'){camera.yaw=0;camera.pitch=.12;camera.dist=5.2;$('viewName').textContent='Front massive profile'}else if(v==='side'){camera.yaw=Math.PI/2;camera.pitch=.12;camera.dist=5.2;$('viewName').textContent='Side massive profile'}else if(v==='top'){camera.yaw=0;camera.pitch=1.46;camera.dist=5.2;$('viewName').textContent='Top massive profile'}else{camera.yaw=.72;camera.pitch=.38;camera.dist=5.4;$('viewName').textContent='45° massive profile'}}
document.querySelectorAll('#views [data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('resetCamera').onclick=()=>setView('persp');
function bind(){for(const id of controls){const el=$(id),out=$(id+'O');el.oninput=()=>{cfg[id]=Number(el.value);out.value=cfg[id].toFixed(2);generate()}}$('resetParams').onclick=()=>{for(const[id,v]of Object.entries(defaults)){const el=$(id);el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}))}}}
bind();generate();setView('persp');window.__CORAL_R07_BUILD__={ready:true,version:'R07-P00',noaaBroadType:'Hard / stony coral',noaaGrowthForm:'Massive coral',noaaMorphologyId:'HARD_MASSIVE',candidateSpecies:'Porites lutea morphology prototype',palauOccurrenceEvidence:'UNRESOLVED',runtimeGLB:0,runtimeTextures:0,networkFetches:0,visualAcceptance:false,productionReady:false};requestAnimationFrame(render);
</script>
</body></html>'''


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('usage: coral_r07_massive_p00_builder.py <output-dir>')
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    (out / 'index.html').write_text(HTML, encoding='utf-8')
    build = {
        'schema': 'CORAL_MOTHER_R07_MASSIVE_P00_BUILD',
        'releaseId': 'CORAL_R07_P00_NOAA_MASSIVE_PORITES',
        'bytes': len(HTML.encode('utf-8')),
        'sha256': hashlib.sha256(HTML.encode('utf-8')).hexdigest(),
        'classification': {
            'noaaBroadType': 'Hard / stony coral',
            'noaaGrowthForm': 'Massive coral',
            'noaaMorphologyId': 'HARD_MASSIVE',
            'formalOrder': 'Scleractinia',
            'candidateFamily': 'Poritidae',
            'candidateGenus': 'Porites',
            'candidateSpecies': 'Porites lutea morphology prototype',
            'palauOccurrenceEvidence': 'UNRESOLVED',
            'ecologicalPlacementReady': False,
        },
        'geometry': {
            'parametricDome': True,
            'anchoredBase': True,
            'macroLobes': True,
            'sharedDomainWarp': True,
            'microscopeSurfaceDisplacement': True,
            'recomputedNormals': True,
            'uniformSpeciesColor': True,
        },
        'adjustableControls': 12,
        'runtimeGLB': 0,
        'runtimeTextures': 0,
        'networkFetchCalls': 0,
        'visualAcceptance': False,
        'productionReady': False,
    }
    (out / 'BUILD_R07_P00.json').write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (out / 'NOAA_CLASSIFICATION.json').write_text(json.dumps(build['classification'], ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (out / 'P00_STATUS_ZH.md').write_text(
        '# Coral Mother R07-P00 状态\n\n'
        '- NOAA 大类：Hard / stony coral。\n'
        '- NOAA 生长形态：Massive coral。\n'
        '- 候选形态：Porites lutea morphology prototype。\n'
        '- 球状／巨石状稳定轮廓，基底固定贴附。\n'
        '- 具有宏观团块、Warp、中尺度起伏与 Microscope 真实表面位移。\n'
        '- Palau occurrence=UNRESOLVED；不得直接投放帕劳生态层。\n'
        '- visualAcceptance=false；productionReady=false。\n',
        encoding='utf-8',
    )
    print(json.dumps(build, ensure_ascii=False))


if __name__ == '__main__':
    main()
