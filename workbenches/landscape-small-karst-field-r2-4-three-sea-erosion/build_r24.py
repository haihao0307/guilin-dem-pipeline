from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-small-karst-field-r2-3-fast-karst-color/index.html"
OUT_DIR = ROOT / "workbenches/landscape-small-karst-field-r2-4-three-sea-erosion"
OUT = OUT_DIR / "index.html"
BUILD = OUT_DIR / "build.json"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"R2.4 patch target missing: {label}")
    return source.replace(old, new, 1)


source = SRC.read_text(encoding="utf-8")
source_sha = sha256(source)

source = source.replace("小尺度帕劳卡斯特 R2.3", "帕劳海蚀卡斯特 R2.4 · 三形态")
source = source.replace("LANDSCAPE MOTHER · FAST KARST ITERATION", "LANDSCAPE MOTHER · PALAU SEA-EROSION SET")
source = source.replace(
    "R2.2 严格材质保留 · 提速、卡斯特形体与强色彩快速迭代",
    "三种独立形态 · 自然海蚀收腰 · 潮位湿痕 · V2.6 材质保留",
)
source = source.replace(
    "默认约 16 m 高 / 12 m 宽 · 快速首帧 · 强蓝灰 V2.6 · 可显式缩放",
    "P1 高瘦 / P2 宽厚 / P3 偏心双体 · 海蚀线可调 · 强蓝灰 V2.6",
)
source = source.replace(
    'data-transfer="STRICT_BRICK_V26_STONE_BLOCK_R23_FAST"',
    'data-transfer="PALAU_KARST_R24_THREE_SEA_EROSION"',
    1,
)

source = replace_once(
    source,
    '<section class="group"><h3>形体比例</h3>',
    '''<section class="group"><h3>三种帕劳形态</h3>
    <div class="variantGrid">
      <button class="variantBtn on" data-variant="0">P1 高瘦礁塔</button>
      <button class="variantBtn" data-variant="1">P2 宽厚岩岛</button>
      <button class="variantBtn" data-variant="2">P3 偏心双体</button>
    </div>
    <p class="note">三种形态共用同一套 V2.6 质感，仅改变连续场主形、孔洞位置和海蚀底部。</p>
  </section>
  <section class="group"><h3>形体比例</h3>''',
    "variant controls",
)

source = replace_once(
    source,
    '<section class="group"><h3>仅形体细节</h3>',
    '''<section class="group"><h3>海蚀底部</h3>
    <div class="row"><label>潮位高度</label><output id="seaLevelOut"></output></div><input id="seaLevel" type="range" min="-4.60" max="-2.20" step=".01" value="-3.55">
    <div class="row"><label>海蚀收腰</label><output id="seaNotchOut"></output></div><input id="seaNotch" type="range" min="0" max="2.00" step=".01" value="1.18">
    <div class="row"><label>湿痕黑边</label><output id="wetBandOut"></output></div><input id="wetBand" type="range" min="0" max="1.80" step=".01" value="1.08">
    <p class="note">潮位线会随岩面噪声自然起伏，不形成机械水平圆环。</p>
  </section>
  <section class="group"><h3>仅形体细节</h3>''',
    "sea erosion controls",
)

source = source.replace(
    '.note{margin:8px 0 0;color:var(--muted);font-size:9px}',
    '.variantGrid{display:grid;grid-template-columns:1fr;gap:6px}.variantBtn{border:1px solid var(--line);background:rgba(255,255,255,.025);text-align:left}.variantBtn.on{background:#3d3528;color:#ffe4b8;border-color:#8d6a3f}.note{margin:8px 0 0;color:var(--muted);font-size:9px}',
    1,
)

source = replace_once(
    source,
    'uniform float uOverall,uHeight,uWidth,uHoleSize,uCavity,uMacro,uWarp,uDetail,uDetailScale,uSoil;',
    'uniform float uOverall,uHeight,uWidth,uHoleSize,uCavity,uMacro,uWarp,uDetail,uDetailScale,uSoil,uSeaLevel,uSeaNotch;\nuniform int uVariant;',
    "geometry uniforms",
)

new_base = '''float baseForm(vec3 p){
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
  }else{
    d=sdEllipsoid(p-vec3(-1.18,-.35,.18),vec3(2.72,7.28,2.52));
    d=smin(d,sdEllipsoid(p-vec3(2.05,-.78,-.50),vec3(2.18,6.08,2.02)),.28);
    d=smin(d,sdEllipsoid(p-vec3(-1.82,3.22,.42),vec3(2.12,3.92,2.02)),.32);
    d=smin(d,sdEllipsoid(p-vec3(1.38,4.52,-.54),vec3(1.82,2.98,1.72)),.28);
    d=smin(d,sdEllipsoid(p-vec3(.18,-4.38,.76),vec3(2.26,2.82,2.08)),.30);
  }
  return d;
}'''
source, count = re.subn(r"float baseForm\(vec3 p\)\{.*?\}(?=float caveField)", new_base, source, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("R2.4 baseForm replacement failed")

new_caves = '''float caveField(vec3 p){
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
  }else{
    float c1=sdEllipsoid(p-vec3(.18,-2.88,1.92),vec3(2.78,2.06,3.34)*hs);
    float c2=sdEllipsoid(p-vec3(1.26,.86,1.52),vec3(1.36,1.22,2.36)*hs);
    float c3=sdEllipsoid(p-vec3(-2.40,1.92,-.38),vec3(1.18,1.46,1.64)*hs);
    float c4=sdEllipsoid(p-vec3(.28,3.96,1.04),vec3(.76,.68,1.04)*hs);
    return min(min(c1,c2),min(c3,c4));
  }
}'''
source, count = re.subn(r"float caveField\(vec3 p\)\{.*?\}(?=float mapRock)", new_caves, source, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("R2.4 caveField replacement failed")

new_map = '''float mapRock(vec3 wp){
  float s=max(uOverall,.1);
  vec3 p=wp/s;
  p.x/=max(uWidth,.1);p.z/=max(uWidth,.1);p.y/=max(uHeight,.1);
  vec3 q=p,w0=domainWarp(p*.18+vec3(2.4,-3.1,5.7)+float(uVariant)*3.17);
  q+=w0*(.76*uWarp);
  vec3 w1=domainWarp((q+w0)*.43+vec3(-7.7,8.3,2.1)+float(uVariant)*1.91);
  q+=w1*(.12*uWarp);
  float d=baseForm(q),cave=caveField(q);
  d=max(d,-(cave+.15*(valueNoise3(q*.7+float(uVariant)*2.3)-.5)*uCavity));
  float f=max(.16,uDetailScale);
  float macro=(fbmGradient(q*.23*f)-.5)*.82+(ridgedFbm(q*.46*f)-.5)*.45;
  float mid=(ridgedFbm(q*1.10*f)-.5)*.34+(valueNoise3(q*2.15*f)-.5)*.19;
  float fine=(valueNoise3(q*5.2*f)-.5)*.082;
  float verticalA=ridgedFbm(vec3(q.x*1.12,q.y*.13,q.z*1.12)+w1*1.8);
  float verticalB=ridgedFbm(vec3(q.x*1.78,q.y*.085,q.z*1.78)+w0*2.15);
  float fissures=smoothstep(.68,.93,verticalA);
  float flutes=smoothstep(.64,.90,verticalB);
  float radial=length(q.xz);
  float seaNoise=(fbmValueFast(vec3(q.x*.42,q.z*.42,4.1+float(uVariant)*2.7))-.5)*.46;
  seaNoise+=sin(q.x*.63+q.z*.37+float(uVariant))*0.10;
  float localSea=uSeaLevel+seaNoise;
  float seaBand=exp(-pow((q.y-localSea)/.54,2.0));
  float exposure=smoothstep(1.05,3.28,radial);
  float notchVariation=.58+.42*fbmValueFast(vec3(q.x*.74,q.z*.74,8.3)+w0*1.2);
  float notch=seaBand*exposure*notchVariation*uSeaNotch;
  float lowerGate=1.-smoothstep(localSea-.86,localSea+.10,q.y);
  float lowerUndercut=lowerGate*smoothstep(1.20,3.30,radial)*(.52+.48*valueNoise3(vec3(q.x*.58,q.z*.58,2.7)));
  float crownBreak=smoothstep(3.7,6.9,q.y)*smoothstep(.68,.92,ridgedFbm(q*.68+w0*1.55));
  d+=uMacro*macro*.49+uDetail*(mid+fine)*.21;
  d+=fissures*.14+flutes*.095+crownBreak*.07;
  d+=notch*.33+lowerUndercut*.15*uSeaNotch;
  return d*s*min(uWidth,uHeight);
}'''
source, count = re.subn(r"float mapRock\(vec3 wp\)\{.*?\}(?=float mapGround)", new_map, source, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("R2.4 mapRock replacement failed")

source = replace_once(
    source,
    'uniform float uBlueStrength;\nvec3 vWorldPos;',
    'uniform float uBlueStrength;\nuniform float uSeaLevel;\nuniform float uWetBand;\nvec3 vWorldPos;',
    "material sea uniforms",
)

old_color = '''  albedo = adjustSaturation(albedo, familySaturation * uColorStrength);
  albedo *= mix(vec3(1.0), vec3(0.90, 1.025, 1.18), uBlueStrength);
  albedo = clamp(albedo, vec3(0.004), vec3(1.0));'''
new_color = '''  albedo = adjustSaturation(albedo, familySaturation * uColorStrength);
  albedo *= mix(vec3(1.0), vec3(0.90, 1.025, 1.18), uBlueStrength);
  float seaWorld=uSeaLevel*uKarstOverall*uKarstHeight;
  float wetNoise=(fbmValueFast(vWorldPos*.12+vec3(uWaterSeed*.001))-0.5)*.34*uKarstOverall;
  float seaDy=vWorldPos.y-(seaWorld+wetNoise);
  float wetLine=(1.0-smoothstep(.05,.78,abs(seaDy)))*uWetBand;
  float lowerWet=(1.0-smoothstep(-.95,.12,seaDy))*(.55+.45*fbmValueFast(vWorldPos*.20+vec3(3.2,7.1,9.4)));
  float saltLine=(1.0-smoothstep(.04,.34,abs(seaDy-.36*uKarstOverall)))*(.55+.45*ridgedFbm(vWorldPos*.28));
  vec3 tidalDark=srgbToLinear(vec3(.024,.055,.074));
  vec3 saltPale=srgbToLinear(vec3(.60,.63,.59));
  albedo=mix(albedo,tidalDark,clamp(wetLine*.62+lowerWet*.18*uWetBand,0.0,.72));
  albedo=mix(albedo,saltPale,clamp(saltLine*.13*uWetBand,0.0,.20));
  albedo = clamp(albedo, vec3(0.004), vec3(1.0));'''
source = replace_once(source, old_color, new_color, "tidal material")

source = replace_once(
    source,
    '"uSeaLevel","uSeaNotch"',
    '"uSeaLevel","uSeaNotch","uVariant"',
    "geometry location list marker",
) if '"uSeaLevel","uSeaNotch"' in source else source

source = replace_once(
    source,
    'UG=locs(geometryProgram,["uRes","uCam","uBasis","uOverall","uHeight","uWidth","uHoleSize","uCavity","uMacro","uWarp","uDetail","uDetailScale","uSoil"]);',
    'UG=locs(geometryProgram,["uRes","uCam","uBasis","uOverall","uHeight","uWidth","uHoleSize","uCavity","uMacro","uWarp","uDetail","uDetailScale","uSoil","uSeaLevel","uSeaNotch","uVariant"]);',
    "geometry locations",
)
source = replace_once(
    source,
    '"uKarstOverall","uKarstHeight","uKarstWidth","uColorStrength","uBlueStrength","uLowColor"',
    '"uKarstOverall","uKarstHeight","uKarstWidth","uColorStrength","uBlueStrength","uSeaLevel","uWetBand","uLowColor"',
    "material locations",
)

source = replace_once(
    source,
    'const state={overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,quality:.78,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]};',
    'const state={overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,seaLevel:-3.55,seaNotch:1.18,wetBand:1.08,variant:0,quality:.78,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]};',
    "state",
)
source = replace_once(
    source,
    'const ids=["overall","height","width","holeSize","cavity","macro","warp","detail","detailScale","colorStrength","blueStrength"];',
    'const ids=["overall","height","width","holeSize","cavity","macro","warp","detail","detailScale","colorStrength","blueStrength","seaLevel","seaNotch","wetBand"];',
    "control ids",
)
source = replace_once(
    source,
    'Object.assign(state,{overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,quality:.78,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]})',
    'Object.assign(state,{overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,seaLevel:-3.55,seaNotch:1.18,wetBand:1.08,variant:0,quality:.78,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]})',
    "reset state",
)

quality_handler = 'document.getElementById("qualityBtn").onclick=e=>{qualityIndex=(qualityIndex+1)%qualityLevels.length;state.quality=qualityLevels[qualityIndex].v;e.currentTarget.textContent=qualityLevels[qualityIndex].n;targetW=0;targetH=0;dirty=true};'
source = replace_once(
    source,
    quality_handler,
    quality_handler + '''
document.querySelectorAll(".variantBtn").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".variantBtn").forEach(b=>b.classList.remove("on"));btn.classList.add("on");state.variant=+btn.dataset.variant;dirty=true});''',
    "variant handlers",
)

source = replace_once(
    source,
    'set1(UM.uColorStrength,state.colorStrength);set1(UM.uBlueStrength,state.blueStrength);',
    'set1(UM.uColorStrength,state.colorStrength);set1(UM.uBlueStrength,state.blueStrength);set1(UM.uSeaLevel,state.seaLevel);set1(UM.uWetBand,state.wetBand);',
    "material sea binding",
)
source = replace_once(
    source,
    'if(UG.uSoil!==null)gl.uniform1f(UG.uSoil,0);gl.drawArrays(gl.TRIANGLES,0,3)',
    'if(UG.uSoil!==null)gl.uniform1f(UG.uSoil,0);if(UG.uVariant!==null)gl.uniform1i(UG.uVariant,state.variant);gl.drawArrays(gl.TRIANGLES,0,3)',
    "variant geometry binding",
)

source = source.replace(
    'window.__KARST_DIAGNOSTICS__={renderer:"two-pass-r23-adaptive",material:"Brick Mother V2.6 stone-block + controlled color gain",shape:"Palau karst fluting and undercut"};',
    'window.__KARST_DIAGNOSTICS__={renderer:"two-pass-r24-three-sea-erosion",material:"Brick Mother V2.6 + tidal wet/salt band",shape:"three Palau karst variants with irregular marine notch"};',
    1,
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(source, encoding="utf-8")
report = {
    "schema": "LANDSCAPE_PALAU_KARST_R24_THREE_SEA_EROSION",
    "source": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "output": str(OUT.relative_to(ROOT)),
    "outputSha256": sha256(source),
    "variants": [
        {"id": 0, "name": "P1 高瘦礁塔"},
        {"id": 1, "name": "P2 宽厚岩岛"},
        {"id": 2, "name": "P3 偏心双体"},
    ],
    "marineErosion": {
        "irregularWaterline": True,
        "naturalNotch": True,
        "lowerUndercut": True,
        "wetDarkBand": True,
        "saltLine": True,
        "seaLevelDefault": -3.55,
        "notchDefault": 1.18,
    },
    "material": "Brick Mother V2.6 preserved with R2.3 controlled blue/colour gain",
    "performance": "R2.3 adaptive three-quality renderer retained",
    "stoneMoneyIntegration": "pending visual acceptance of the three-source set",
    "visualApproved": False,
}
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
