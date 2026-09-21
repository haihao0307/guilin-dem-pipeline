from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-small-karst-field-r2-5-1-gpu-compat/index.html"
OUT_DIR = ROOT / "workbenches/landscape-karst-dem-field-r2-6-cracks"
OUT = OUT_DIR / "index.html"
BUILD = OUT_DIR / "build.json"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"R2.6 patch target missing: {label}")
    return source.replace(old, new, 1)


source = SRC.read_text(encoding="utf-8")
source_sha = sha256(source)

source = source.replace("PALAU_KARST_R251_GPU_COMPAT", "PALAU_KARST_DEM_FIELD_R26_CRACKS")
source = source.replace("帕劳海蚀卡斯特 R2.5.1 · GPU 兼容", "卡斯特 DEM 函数场 R2.6 · 几何裂隙", 2)
source = source.replace("LANDSCAPE MOTHER · PALAU LOWER SEA-CUT", "LANDSCAPE MOTHER · DEM KARST FIELD OPERATOR")
source = source.replace(
    "三种独立形态 · 下部陡切海蚀层 · 窄颈下行 · RGBA8 跨 GPU 兼容渲染",
    "DEM 连续山体默认 · 三个标本仅作算子探针 · 几何裂隙与次级孔洞 · RGBA8 兼容",
)
source = source.replace(
    "R2.5.1 · RGBA8 兼容渲染 · 海蚀形体不变 · 三形态",
    "R2.6 · DEM 连续函数场 · 几何裂隙 · 次级孔洞 · 海蚀算子",
)

old_modes = '''  <section class="group"><h3>三种帕劳形态</h3>
    <div class="variantGrid">
      <button class="variantBtn on" data-variant="0">P1 高瘦礁塔</button>
      <button class="variantBtn" data-variant="1">P2 宽厚岩岛</button>
      <button class="variantBtn" data-variant="2">P3 偏心双体</button>
    </div>
    <p class="note">三种形态共用同一套 V2.6 质感，仅改变连续场主形、孔洞位置和海蚀底部。</p>
  </section>'''
new_modes = '''  <section class="group"><h3>工作模式 / 连续场</h3>
    <div class="variantGrid">
      <button class="variantBtn on" data-variant="3">DEM 连续山体（默认生产验证）</button>
      <button class="variantBtn" data-variant="0">探针 P1 · 高瘦礁塔</button>
      <button class="variantBtn" data-variant="1">探针 P2 · 宽厚岩岛</button>
      <button class="variantBtn" data-variant="2">探针 P3 · 偏心双体</button>
    </div>
    <p class="note">默认显示一整座连续 DEM 岩体。P1–P3 只用于检查算子，不作为三个游戏资产搬运。</p>
  </section>'''
source = replace_once(source, old_modes, new_modes, "mode panel")

old_holes = '''  <section class="group"><h3>孔洞</h3>
    <div class="row"><label>孔洞大小</label><output id="holeSizeOut"></output></div><input id="holeSize" type="range" min=".35" max="1.85" step=".01" value="1">
    <div class="row"><label>孔洞深度</label><output id="cavityOut"></output></div><input id="cavity" type="range" min="0" max="2.2" step=".01" value="1.10">
  </section>'''
new_holes = '''  <section class="group"><h3>孔洞 / 次级溶蚀</h3>
    <div class="row"><label>主孔洞大小</label><output id="holeSizeOut"></output></div><input id="holeSize" type="range" min=".35" max="1.85" step=".01" value="1">
    <div class="row"><label>主孔洞深度</label><output id="cavityOut"></output></div><input id="cavity" type="range" min="0" max="2.2" step=".01" value="1.10">
    <div class="row"><label>次级孔洞</label><output id="pocketStrengthOut"></output></div><input id="pocketStrength" type="range" min="0" max="1.50" step=".01" value=".72">
  </section>
  <section class="group"><h3>几何裂隙（真实形体）</h3>
    <div class="row"><label>裂缝深度</label><output id="crackDepthOut"></output></div><input id="crackDepth" type="range" min="0" max=".90" step=".01" value=".38">
    <div class="row"><label>裂缝宽度</label><output id="crackWidthOut"></output></div><input id="crackWidth" type="range" min=".015" max=".16" step=".001" value=".058">
    <div class="row"><label>分叉强度</label><output id="crackBranchOut"></output></div><input id="crackBranch" type="range" min="0" max="1.50" step=".01" value=".78">
    <p class="note">裂隙直接从距离场中减去，只作用于岩体表面窄壳层；不是颜色线，也不会把整座岩体机械切穿。</p>
  </section>'''
source = replace_once(source, old_holes, new_holes, "crack and pocket controls")

source = replace_once(
    source,
    "uniform float uOverall,uHeight,uWidth,uHoleSize,uCavity,uMacro,uWarp,uDetail,uDetailScale,uSoil,uSeaLevel,uSeaNotch;",
    "uniform float uOverall,uHeight,uWidth,uHoleSize,uCavity,uPocketStrength,uCrackDepth,uCrackWidth,uCrackBranch,uMacro,uWarp,uDetail,uDetailScale,uSoil,uSeaLevel,uSeaNotch;",
    "geometry uniforms",
)

new_forms = r'''float demHeight(vec2 xz){
  vec2 a=(xz-vec2(-1.45,.35))/vec2(4.35,3.55);
  vec2 b=(xz-vec2(2.55,-.55))/vec2(3.25,2.85);
  vec2 c=(xz-vec2(-3.15,-2.25))/vec2(2.45,2.15);
  float h=-5.92;
  h+=9.25*exp(-dot(a,a)*1.42);
  h+=6.15*exp(-dot(b,b)*1.70);
  h+=3.95*exp(-dot(c,c)*1.88);
  float ridge=ridgedFbm(vec3(xz*.19,2.7))-.5;
  float broad=fbmGradient(vec3(xz*.105,7.3))-.5;
  return h+ridge*1.12+broad*.78;
}
float demFieldBase(vec3 p){
  float terrain=p.y-demHeight(p.xz);
  float domain=length((p.xz-vec2(0.,.12))/vec2(7.85,6.45))-1.;
  float bottom=-p.y-7.34;
  return max(max(terrain,domain*3.25),bottom);
}
float baseForm(vec3 p){
  float d;
  if(uVariant==0){
    d=sdEllipsoid(p-vec3(-.22,-.28,.08),vec3(2.48,8.18,2.38));
    d=smin(d,sdEllipsoid(p-vec3(-1.28,2.05,.24),vec3(1.82,4.55,1.86)),.34);
    d=smin(d,sdEllipsoid(p-vec3(1.46,-1.18,-.36),vec3(1.92,4.25,1.78)),.32);
    d=smin(d,sdEllipsoid(p-vec3(.10,5.55,-.34),vec3(1.88,2.62,1.70)),.30);
    d=smin(d,sdEllipsoid(p-vec3(-.72,-4.46,.66),vec3(1.46,2.92,1.44)),.26);
  }else if(uVariant==1){
    d=sdEllipsoid(p-vec3(-.12,-.70,.02),vec3(3.58,6.62,3.14));
    d=smin(d,sdEllipsoid(p-vec3(-2.15,.82,.56),vec3(2.48,4.52,2.32)),.46);
    d=smin(d,sdEllipsoid(p-vec3(2.28,-.96,-.42),vec3(2.62,4.20,2.28)),.44);
    d=smin(d,sdEllipsoid(p-vec3(.18,4.62,-.30),vec3(3.18,2.46,2.68)),.42);
    d=smin(d,sdEllipsoid(p-vec3(-.54,-4.18,.74),vec3(2.66,2.72,2.38)),.38);
  }else if(uVariant==2){
    d=sdEllipsoid(p-vec3(-1.18,-.35,.18),vec3(2.72,7.28,2.52));
    d=smin(d,sdEllipsoid(p-vec3(2.05,-.78,-.50),vec3(2.18,6.08,2.02)),.28);
    d=smin(d,sdEllipsoid(p-vec3(-1.82,3.22,.42),vec3(2.12,3.92,2.02)),.32);
    d=smin(d,sdEllipsoid(p-vec3(1.38,4.52,-.54),vec3(1.82,2.98,1.72)),.28);
    d=smin(d,sdEllipsoid(p-vec3(.18,-4.38,.76),vec3(2.26,2.82,2.08)),.30);
  }else{
    d=demFieldBase(p);
  }
  return d;
}
float caveField(vec3 p){
  float hs=max(.20,uHoleSize);
  if(uVariant==0){
    float c1=sdEllipsoid(p-vec3(-.92,-2.72,1.92),vec3(2.12,1.92,2.90)*hs);
    float c2=sdEllipsoid(p-vec3(1.52,.92,1.36),vec3(1.12,1.02,1.76)*hs);
    float c3=sdEllipsoid(p-vec3(-2.12,2.42,-.18),vec3(.88,1.28,1.18)*hs);
    return min(c1,min(c2,c3));
  }else if(uVariant==1){
    float c1=sdEllipsoid(p-vec3(-1.72,-2.92,2.18),vec3(2.62,1.78,3.18)*hs);
    float c2=sdEllipsoid(p-vec3(2.28,-1.18,1.18),vec3(1.62,1.18,2.22)*hs);
    float c3=sdEllipsoid(p-vec3(.20,2.78,-2.18),vec3(1.46,1.62,2.08)*hs);
    return min(c1,min(c2,c3));
  }else if(uVariant==2){
    float c1=sdEllipsoid(p-vec3(.18,-2.88,1.92),vec3(2.78,2.06,3.34)*hs);
    float c2=sdEllipsoid(p-vec3(1.26,.86,1.52),vec3(1.36,1.22,2.36)*hs);
    float c3=sdEllipsoid(p-vec3(-2.40,1.92,-.38),vec3(1.18,1.46,1.64)*hs);
    float c4=sdEllipsoid(p-vec3(.28,3.96,1.04),vec3(.76,.68,1.04)*hs);
    return min(min(c1,c2),min(c3,c4));
  }else{
    float c1=sdEllipsoid(p-vec3(-4.55,-1.70,1.85),vec3(2.18,1.38,2.72)*hs);
    float c2=sdEllipsoid(p-vec3(3.62,-.72,1.42),vec3(1.72,1.22,2.18)*hs);
    float c3=sdEllipsoid(p-vec3(.72,1.58,-4.48),vec3(1.88,1.42,2.48)*hs);
    float c4=sdEllipsoid(p-vec3(-.45,2.82,3.72),vec3(1.10,.92,1.62)*hs);
    return min(min(c1,c2),min(c3,c4));
  }
}
float pocketField(vec3 p){
  float ps=mix(.46,1.28,clamp(uPocketStrength/1.5,0.,1.));
  if(uVariant==3){
    float a=sdEllipsoid(p-vec3(-5.25,.18,1.88),vec3(.62,.54,.88)*ps);
    float b=sdEllipsoid(p-vec3(-2.15,2.65,3.45),vec3(.54,.72,.70)*ps);
    float c=sdEllipsoid(p-vec3(2.82,1.15,2.72),vec3(.78,.60,.92)*ps);
    float d=sdEllipsoid(p-vec3(4.72,-1.55,-.35),vec3(.64,.48,.82)*ps);
    float e=sdEllipsoid(p-vec3(.85,3.95,-2.86),vec3(.52,.66,.72)*ps);
    return min(min(a,b),min(c,min(d,e)));
  }
  float vv=float(uVariant);
  float a=sdEllipsoid(p-vec3(-1.65+.20*sin(vv*2.1),1.35,2.05),vec3(.48,.66,.74)*ps);
  float b=sdEllipsoid(p-vec3(1.25,3.02-.24*vv,1.68),vec3(.54,.48,.82)*ps);
  float c=sdEllipsoid(p-vec3(2.18-.32*vv,-.45,-1.62),vec3(.42,.62,.58)*ps);
  float d=sdEllipsoid(p-vec3(-2.18,3.75-.35*vv,-.48),vec3(.40,.52,.62)*ps);
  return min(min(a,b),min(c,d));
}
float crackWindow(float y,float lo,float hi){return max(lo-y,y-hi);}
float crackNetwork(vec3 q,float localSea){
  float w=max(.010,uCrackWidth);
  float seed=float(uVariant)*1.73;
  float n1=(fbmValueFast(vec3(q.y*.19,q.z*.24,seed+3.1))-.5)*(.24+.18*uCrackBranch);
  float n2=(fbmGradient(vec3(q.y*.23,q.x*.19,seed+7.4))-.5)*(.20+.16*uCrackBranch);
  float c1=abs(q.x*.88+q.z*.21+.14*sin(q.y*.82+seed)+n1-.18)-w;
  c1=max(c1,crackWindow(q.y,localSea+.52,6.65));
  float c2=abs(q.x*.34-q.z*.94-.22+.16*sin(q.y*1.03+seed*.7)+n2)-w*.78;
  c2=max(c2,crackWindow(q.y,localSea+1.15,5.20));
  float yb=q.y-2.10;
  float branch=abs(q.z*.72+q.x*.62+.18*yb+.15*sin(q.x*1.28+seed)+n1*.55)-w*.64;
  branch=max(branch,abs(yb)-1.42);
  branch=max(branch,.30-uCrackBranch);
  float crown=abs(q.x*.58-q.z*.82+.22*sin(q.y*1.36+seed*1.7)+n2*.62)-w*.58;
  crown=max(crown,crackWindow(q.y,3.55,7.05));
  crown=max(crown,.62-uCrackBranch);
  return min(min(c1,c2),min(branch,crown));
}
float mapRock'''
source, count = re.subn(
    r"float baseForm\(vec3 p\)\{.*?\n\}\nfloat mapRock",
    new_forms,
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("R2.6 base/cave field replacement failed")

old_tail = '''  d+=cut*.50;
  d-=baseFlare*flareVariation*.23*uSeaNotch;
  return d*s*min(uWidth,uHeight);'''
new_tail = '''  d+=cut*.50;
  d-=baseFlare*flareVariation*.23*uSeaNotch;
  if(uPocketStrength>.001){
    float pocket=pocketField(q);
    d=max(d,-pocket);
  }
  float crackCore=crackNetwork(q,localSea);
  float crackShell=abs(d)-max(0.,uCrackDepth)*(.34+.10*clamp(uCrackBranch,0.,1.5));
  float crackVolume=max(crackCore,crackShell);
  d=max(d,-crackVolume);
  return d*s*min(uWidth,uHeight);'''
source = replace_once(source, old_tail, new_tail, "geometry crack carve")

source = replace_once(
    source,
    '["uRes","uCam","uBasis","uOverall","uHeight","uWidth","uHoleSize","uCavity","uMacro","uWarp","uDetail","uDetailScale","uSoil","uSeaLevel","uSeaNotch","uVariant"]',
    '["uRes","uCam","uBasis","uOverall","uHeight","uWidth","uHoleSize","uCavity","uPocketStrength","uCrackDepth","uCrackWidth","uCrackBranch","uMacro","uWarp","uDetail","uDetailScale","uSoil","uSeaLevel","uSeaNotch","uVariant"]',
    "uniform location list",
)
source = replace_once(
    source,
    'const state={overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,seaLevel:-4.08,seaNotch:1.38,wetBand:1.08,variant:0,quality:.78,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]};',
    'const state={overall:1,height:1,width:1,holeSize:1,cavity:1.10,pocketStrength:.72,crackDepth:.38,crackWidth:.058,crackBranch:.78,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,seaLevel:-4.08,seaNotch:1.38,wetBand:1.08,variant:3,quality:.78,gray:0,theta:.72,phi:1.15,radius:31,target:[0,-.35,0]};',
    "default state",
)
source = replace_once(
    source,
    'const ids=["overall","height","width","holeSize","cavity","macro","warp","detail","detailScale","colorStrength","blueStrength","seaLevel","seaNotch","wetBand"];',
    'const ids=["overall","height","width","holeSize","cavity","pocketStrength","crackDepth","crackWidth","crackBranch","macro","warp","detail","detailScale","colorStrength","blueStrength","seaLevel","seaNotch","wetBand"];',
    "control ids",
)
old_reset = 'document.getElementById("reset").onclick=()=>{Object.assign(state,{overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,seaLevel:-4.08,seaNotch:1.38,wetBand:1.08,variant:0,quality:.78,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]});document.getElementById("gray").classList.remove("on");sync();dirty=true};'
new_reset = 'document.getElementById("reset").onclick=()=>{Object.assign(state,{overall:1,height:1,width:1,holeSize:1,cavity:1.10,pocketStrength:.72,crackDepth:.38,crackWidth:.058,crackBranch:.78,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,seaLevel:-4.08,seaNotch:1.38,wetBand:1.08,variant:3,quality:.78,gray:0,theta:.72,phi:1.15,radius:31,target:[0,-.35,0]});document.getElementById("gray").classList.remove("on");document.querySelectorAll(".variantBtn").forEach(b=>b.classList.toggle("on",+b.dataset.variant===3));sync();dirty=true};'
source = replace_once(source, old_reset, new_reset, "reset handler")
source = source.replace(
    'renderer:"two-pass-r251-rgba8-packed-gpu-compat",material:"Brick Mother V2.6 + RGBA8 packed geometry buffers",shape:"three Palau karst variants with irregular marine notch"',
    'renderer:"two-pass-r26-rgba8-packed-dem-field",material:"Brick Mother V2.6 + RGBA8 packed geometry buffers",shape:"continuous DEM karst field plus specimen probes, geometric cracks and secondary cavities"',
)
source = source.replace(
    'document.getElementById("badge").textContent=`首帧 ${loadMs} ms · RGBA8 GPU兼容 · 强蓝灰 V2.6 · 滚轮/按钮缩放`',
    'document.getElementById("badge").textContent=`首帧 ${loadMs} ms · DEM 连续场 · 几何裂隙 · RGBA8 兼容`',
)
source = source.replace(
    'window.__KARST_STATE__=state;window.__KARST_DIAGNOSTICS__=',
    'window.__KARST_STATE__=state;window.__KARST_FIELD_CONTRACT__={identity:"fixed-after-approval",defaultMode:"DEM_CONTINUOUS_FIELD",specimensAreProbes:true,geometryOperators:["cavity","secondaryPocket","marineNotch","surfaceShellCrack"],runtimeBands:["demMacro","karstStructure","surfaceMicroscope"]};window.__KARST_DIAGNOSTICS__=',
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(source, encoding="utf-8")
report = {
    "schema": "LANDSCAPE_KARST_DEM_FIELD_R26_CRACKS",
    "source": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "output": str(OUT.relative_to(ROOT)),
    "outputSha256": sha256(source),
    "defaultMode": "DEM_CONTINUOUS_FIELD",
    "specimensAreProbes": True,
    "geometryOperators": {
        "primaryCavities": True,
        "secondaryPockets": True,
        "marineNotch": True,
        "surfaceShellCracks": True,
        "cracksAffectGeometry": True,
        "cracksAreNotMaterialLines": True,
    },
    "productionIdentity": "fixed after approval; deterministic function field",
    "runtimeBands": ["demMacro", "karstStructure", "surfaceMicroscope"],
    "renderer": "WebGL2 RGBA8 packed three-target compatibility path",
    "visualApproved": False,
}
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
