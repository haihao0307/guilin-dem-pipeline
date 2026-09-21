from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-karst-dem-field-r2-6-2-compact/index.html"
OUT_DIR = ROOT / "workbenches/landscape-karst-dem-field-r2-6-3-production"
OUT = OUT_DIR / "index.html"
BUILD = OUT_DIR / "build.json"
CONTRACT = OUT_DIR / "production_contract.json"
BRIDGE = OUT_DIR / "karst_field_runtime_bridge.js"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"R2.6.3 patch target missing: {label}")
    return source.replace(old, new, 1)


source = SRC.read_text(encoding="utf-8")
source_sha = sha256(source)

source = source.replace("PALAU_KARST_DEM_FIELD_R262_COMPACT", "PALAU_KARST_DEM_FIELD_R263_PRODUCTION")
source = source.replace("卡斯特 DEM 函数场 R2.6.2 · 紧凑生产版", "卡斯特 DEM 函数场 R2.6.3 · 生产候选", 2)
source = source.replace(
    "DEM 连续山体默认 · 几何裂隙与次级孔洞 · 紧凑材质 · 先显示界面后编译",
    "DEM 连续山体 · 真实凹切裂隙 · 礁盘连续连接 · 潮位运行时耦合",
)
source = source.replace(
    "R2.6.2 · DEM 连续函数场 · 紧凑材质 · 浏览器安全",
    "R2.6.3 · 生产候选 · 几何裂隙 · 礁盘连接 · 潮位接口",
)

old_cracks = '''  <section class="group"><h3>几何裂隙（真实形体）</h3>
    <div class="row"><label>裂缝深度</label><output id="crackDepthOut"></output></div><input id="crackDepth" type="range" min="0" max=".90" step=".01" value=".38">
    <div class="row"><label>裂缝宽度</label><output id="crackWidthOut"></output></div><input id="crackWidth" type="range" min=".015" max=".16" step=".001" value=".058">
    <div class="row"><label>分叉强度</label><output id="crackBranchOut"></output></div><input id="crackBranch" type="range" min="0" max="1.50" step=".01" value=".78">
    <p class="note">裂隙直接从距离场中减去，只作用于岩体表面窄壳层；不是颜色线，也不会把整座岩体机械切穿。</p>
  </section>'''
new_cracks = '''  <section class="group"><h3>几何裂隙（真实凹切）</h3>
    <div class="row"><label>裂缝切入深度</label><output id="crackDepthOut"></output></div><input id="crackDepth" type="range" min="0" max="2.20" step=".01" value=".95">
    <div class="row"><label>裂口宽度</label><output id="crackWidthOut"></output></div><input id="crackWidth" type="range" min=".015" max=".30" step=".001" value=".090">
    <div class="row"><label>分叉强度</label><output id="crackBranchOut"></output></div><input id="crackBranch" type="range" min="0" max="2.00" step=".01" value=".92">
    <p class="note">裂缝以楔形空腔从岩体距离场中真实扣除：表面较宽、向内逐渐收窄，并在设定深度闭合。滑块改变的是轮廓和阴影，不是颜色线。</p>
  </section>'''
source = replace_once(source, old_cracks, new_cracks, "crack controls")

old_sea = '''  <section class="group"><h3>海蚀底部</h3>
    <div class="row"><label>潮位高度</label><output id="seaLevelOut"></output></div><input id="seaLevel" type="range" min="-5.20" max="-2.80" step=".01" value="-4.08">
    <div class="row"><label>海蚀收腰</label><output id="seaNotchOut"></output></div><input id="seaNotch" type="range" min="0" max="2.00" step=".01" value="1.38">
    <div class="row"><label>湿痕黑边</label><output id="wetBandOut"></output></div><input id="wetBand" type="range" min="0" max="1.80" step=".01" value="1.08">
    <p class="note">切层位于岩体下部：先陡切入内，再形成窄颈向下，底脚随后平缓外展；仍保留不规则水位扰动。</p>
  </section>'''
new_sea = '''  <section class="group"><h3>海蚀 / 潮位耦合</h3>
    <div class="row"><label>长期海蚀基准</label><output id="seaLevelOut"></output></div><input id="seaLevel" type="range" min="-5.80" max="-2.20" step=".01" value="-4.08">
    <div class="row"><label>实时潮位偏移</label><output id="tideOffsetOut"></output></div><input id="tideOffset" type="range" min="-1.50" max="1.50" step=".01" value="0">
    <div class="row"><label>海蚀收腰幅度</label><output id="seaNotchOut"></output></div><input id="seaNotch" type="range" min="0" max="4.50" step=".01" value="2.15">
    <div class="row"><label>湿痕黑边</label><output id="wetBandOut"></output></div><input id="wetBand" type="range" min="0" max="1.80" step=".01" value="1.08">
    <p class="note">长期海蚀基准参与冻结形体；实时潮位只由 Ocean Mother 驱动湿痕与礁盘干湿边界，不会让几万年尺度的岩体随每次涨落潮变形。</p>
  </section>
  <section class="group"><h3>礁盘连续连接</h3>
    <p class="note">岩体底脚与礁盘使用同一连续场平滑并集，不再作为悬空石块摆放；礁盘继续使用退潮时的冷灰褐色。</p>
  </section>'''
source = replace_once(source, old_sea, new_sea, "sea and tide controls")

# Material tide input is separate from the frozen geomorphic sea-notch baseline.
source = replace_once(
    source,
    "uniform float uColorStrength,uBlueStrength,uSeaLevel,uWetBand;",
    "uniform float uColorStrength,uBlueStrength,uSeaLevel,uTideOffset,uWetBand;",
    "material tide uniform",
)
source = replace_once(
    source,
    " float seaWorld=uSeaLevel*uKarstOverall*uKarstHeight;",
    " float seaWorld=(uSeaLevel+uTideOffset)*uKarstOverall*uKarstHeight;",
    "runtime tide wetline",
)

# Tide also changes the visible wet/dry boundary on the reef platform.
old_reef_material = ' if(kind>1.5){float g=noise3(p*1.8);vec3 c=mix(vec3(.095,.105,.10),vec3(.16,.145,.115),g);float l=.40+.60*max(dot(n,normalize(vec3(-.5,.8,.4))),0.0);outColor=vec4(pow(c*l,vec3(.4545)),1.0);return;}'
new_reef_material = ''' if(kind>1.5){
  float g=noise3(p*1.8);vec3 c=mix(vec3(.095,.105,.10),vec3(.16,.145,.115),g);
  float tideWorld=(uSeaLevel+uTideOffset)*uKarstOverall*uKarstHeight;
  float reefWet=1.0-smoothstep(.06,.52,abs(p.y-tideWorld));
  reefWet+=1.0-smoothstep(-.82,.10,p.y-tideWorld);
  c=mix(c,vec3(.025,.070,.073),clamp(reefWet*.42,0.0,.62));
  float l=.40+.60*max(dot(n,normalize(vec3(-.5,.8,.4))),0.0);
  outColor=vec4(pow(max(c*l,0.0),vec3(.4545)),1.0);return;
 }'''
source = replace_once(source, old_reef_material, new_reef_material, "reef tide material")

# Stronger but still adjustable marine notch. Its baseline is frozen into production DNA.
source = replace_once(
    source,
    "  float cut=(steepLip*.62+neck*.42)*exposure*azBreak*uSeaNotch;",
    "  float cut=(steepLip*.82+neck*.60)*exposure*azBreak*uSeaNotch;",
    "expanded sea notch weights",
)
source = replace_once(source, "  d+=cut*.50;", "  d+=cut*.66;", "expanded sea notch amplitude")
source = replace_once(
    source,
    "  d-=baseFlare*flareVariation*.23*uSeaNotch;",
    "  d-=baseFlare*flareVariation*.20*uSeaNotch;",
    "reefward base flare",
)

# Replace the visually weak surface-shell slit with a one-sided wedge cavity.
new_crack_network = r'''float crackWindow(float y,float lo,float hi){return max(lo-y,y-hi);}
float crackNetwork(vec3 q,float localSea,float w){
  float seed=float(uVariant)*1.73;
  float n1=sin(q.y*.79+q.z*.31+seed)*(.075+.045*uCrackBranch)
          +sin(q.y*1.71-q.z*.23+seed*1.9)*.028;
  float n2=sin(q.y*.91+q.x*.27+seed*.7)*(.068+.040*uCrackBranch)
          +cos(q.y*1.43+q.x*.19-seed)*.024;
  float c1=abs(q.x*.88+q.z*.21+.14*sin(q.y*.82+seed)+n1-.18)-w;
  c1=max(c1,crackWindow(q.y,localSea+.62,6.65));
  float c2=abs(q.x*.34-q.z*.94-.22+.16*sin(q.y*1.03+seed*.7)+n2)-w*.82;
  c2=max(c2,crackWindow(q.y,localSea+1.05,5.35));
  float yb=q.y-2.10;
  float branch=abs(q.z*.72+q.x*.62+.18*yb+.15*sin(q.x*1.28+seed)+n1*.55)-w*.72;
  branch=max(branch,abs(yb)-1.55);
  branch=max(branch,.28-uCrackBranch);
  float crown=abs(q.x*.58-q.z*.82+.22*sin(q.y*1.36+seed*1.7)+n2*.62)-w*.66;
  crown=max(crown,crackWindow(q.y,3.35,7.10));
  crown=max(crown,.58-uCrackBranch);
  float crossBranch=abs(q.x*.76+q.z*.54-.20*(q.y-3.0)+.10*sin(q.z*1.7+seed))-w*.48;
  crossBranch=max(crossBranch,abs(q.y-3.15)-1.05);
  crossBranch=max(crossBranch,.72-uCrackBranch);
  return min(min(c1,c2),min(branch,min(crown,crossBranch)));
}
'''
source, count = re.subn(
    r"float crackWindow\(float y,float lo,float hi\)\{.*?\n\}\n(?=float mapRock)",
    new_crack_network,
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("R2.6.3 crack-network replacement failed")

old_carve = '''  float crackCore=crackNetwork(q,localSea);
  float crackShell=abs(d)-max(0.,uCrackDepth)*(.34+.10*clamp(uCrackBranch,0.,1.5));
  float crackVolume=max(crackCore,crackShell);
  d=max(d,-crackVolume);'''
new_carve = '''  float beforeCrack=d;
  float crackDepth=max(0.,uCrackDepth);
  if(crackDepth>.001){
    float inward=clamp((-beforeCrack)/max(crackDepth,.001),0.,1.);
    float wedgeWidth=max(.008,uCrackWidth)*mix(1.0,.18,inward);
    float crackCore=crackNetwork(q,localSea,wedgeWidth);
    // Intersect the crack lines with a one-sided band from the visible surface
    // into the rock.  CSG subtraction creates a real void and a closed crack floor.
    float inwardBand=max(-beforeCrack-crackDepth,beforeCrack-.025);
    float crackVoid=max(crackCore,inwardBand);
    d=max(beforeCrack,-crackVoid);
  }'''
source = replace_once(source, old_carve, new_carve, "one-sided geometric crack carve")

# The reef platform and the DEM body are one continuous field.
old_scene = "}float mapGround(vec3 p){return p.y+7.85+.18*sin(p.x*.24)+.14*sin(p.z*.31);}vec2 mapScene(vec3 p){float r=mapRock(p),g=mapGround(p);return r<g?vec2(r,1.):vec2(g,2.);}vec3 normalAt"
new_scene = r'''}
float reefPlatform(vec3 p){
  float ang=atan(p.z,p.x);
  float edgeVariation=.035*sin(ang*5.0)+.022*sin(ang*9.0+1.3);
  vec2 rq=p.xz/vec2(10.45,8.85);
  float edge=(length(rq)-(1.0+edgeVariation))*2.15;
  float top=(p.y+7.16+.07*sin(p.x*.33)+.05*sin(p.z*.41))*.58;
  float bottom=(-p.y-8.65)*.46;
  return max(max(edge,top),bottom);
}
float mapGround(vec3 p){return p.y+9.28+.12*sin(p.x*.18)+.10*sin(p.z*.24);}
vec2 mapScene(vec3 p){
  float r=mapRock(p),reef=reefPlatform(p);
  float joined=smin(r,reef,.40);
  float g=mapGround(p);
  if(joined<g)return vec2(joined,reef<r?2.:1.);
  return vec2(g,2.);
}
vec3 normalAt'''
source = replace_once(source, old_scene, new_scene, "continuous reef-platform union")

# Runtime state and public tide input.
old_state = 'const state={overall:1,height:1,width:1,holeSize:1,cavity:1.10,pocketStrength:.72,crackDepth:.38,crackWidth:.058,crackBranch:.78,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,seaLevel:-4.08,seaNotch:1.38,wetBand:1.08,variant:3,quality:.58,gray:0,theta:.72,phi:1.18,radius:25,target:[0,-.85,0]};'
new_state = 'const state={overall:1,height:1,width:1,holeSize:1,cavity:1.10,pocketStrength:.72,crackDepth:.95,crackWidth:.090,crackBranch:.92,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,seaLevel:-4.08,tideOffset:0,seaNotch:2.15,wetBand:1.08,variant:3,quality:.58,gray:0,theta:.72,phi:1.18,radius:25,target:[0,-.85,0]};'
source = replace_once(source, old_state, new_state, "production defaults")
source = replace_once(
    source,
    'const ids=["overall","height","width","holeSize","cavity","pocketStrength","crackDepth","crackWidth","crackBranch","macro","warp","detail","detailScale","colorStrength","blueStrength","seaLevel","seaNotch","wetBand"];',
    'const ids=["overall","height","width","holeSize","cavity","pocketStrength","crackDepth","crackWidth","crackBranch","macro","warp","detail","detailScale","colorStrength","blueStrength","seaLevel","tideOffset","seaNotch","wetBand"];',
    "runtime control ids",
)
old_reset = 'document.getElementById("reset").onclick=()=>{Object.assign(state,{overall:1,height:1,width:1,holeSize:1,cavity:1.10,pocketStrength:.72,crackDepth:.38,crackWidth:.058,crackBranch:.78,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,seaLevel:-4.08,seaNotch:1.38,wetBand:1.08,variant:3,quality:.58,gray:0,theta:.72,phi:1.18,radius:25,target:[0,-.85,0]});document.getElementById("gray").classList.remove("on");document.querySelectorAll(".variantBtn").forEach(b=>b.classList.toggle("on",+b.dataset.variant===3));sync();dirty=true};'
new_reset = 'document.getElementById("reset").onclick=()=>{Object.assign(state,{overall:1,height:1,width:1,holeSize:1,cavity:1.10,pocketStrength:.72,crackDepth:.95,crackWidth:.090,crackBranch:.92,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,seaLevel:-4.08,tideOffset:0,seaNotch:2.15,wetBand:1.08,variant:3,quality:.58,gray:0,theta:.72,phi:1.18,radius:25,target:[0,-.85,0]});document.getElementById("gray").classList.remove("on");document.querySelectorAll(".variantBtn").forEach(b=>b.classList.toggle("on",+b.dataset.variant===3));sync();dirty=true};'
source = replace_once(source, old_reset, new_reset, "production reset")

source = replace_once(
    source,
    'UM=locs(materialProgram,["uRes","uPositionTex","uNormalTex","uMetaTex","uCamera","uKarstOverall","uKarstHeight","uKarstWidth","uColorStrength","uBlueStrength","uSeaLevel","uWetBand",',
    'UM=locs(materialProgram,["uRes","uPositionTex","uNormalTex","uMetaTex","uCamera","uKarstOverall","uKarstHeight","uKarstWidth","uColorStrength","uBlueStrength","uSeaLevel","uTideOffset","uWetBand",',
    "material uniform locations",
)
source = replace_once(
    source,
    'set1(UM.uBlueStrength,state.blueStrength);set1(UM.uSeaLevel,state.seaLevel);set1(UM.uWetBand,state.wetBand);',
    'set1(UM.uBlueStrength,state.blueStrength);set1(UM.uSeaLevel,state.seaLevel);set1(UM.uTideOffset,state.tideOffset);set1(UM.uWetBand,state.wetBand);',
    "material tide upload",
)

# Deterministic QA and Game Mother hooks.
query_hook = '''const query=new URLSearchParams(location.search);
if(query.has("noCracks"))state.crackDepth=0;
if(query.has("tide"))state.tideOffset=Math.max(-1.5,Math.min(1.5,Number(query.get("tide"))||0));
'''
source = replace_once(source, new_state + "\n", new_state + "\n" + query_hook, "query QA hook")

old_contract = 'sync();resize();requestAnimationFrame(frame);window.__KARST_STATE__=state;window.__KARST_FIELD_CONTRACT__={identity:"fixed-after-approval",defaultMode:"DEM_CONTINUOUS_FIELD",specimensAreProbes:true,geometryOperators:["cavity","secondaryPocket","marineNotch","surfaceShellCrack"],runtimeBands:["demMacro","karstStructure","surfaceMicroscope"]};window.__KARST_DIAGNOSTICS__={renderer:"two-pass-r262-rgba8-compact-material",material:"Brick Mother V2.6 + RGBA8 packed geometry buffers",shape:"continuous DEM karst field plus specimen probes, geometric cracks and secondary cavities"};'
new_contract = '''sync();resize();requestAnimationFrame(frame);
window.__KARST_STATE__=state;
window.KarstFieldRuntime={
 setTideLevel(offset){state.tideOffset=Math.max(-1.5,Math.min(1.5,Number(offset)||0));sync();dirty=true;return state.tideOffset;},
 exportProductionDNA(){return {schema:"KARST_FIELD_DNA_R263",frozen:{seaLevel:state.seaLevel,seaNotch:state.seaNotch,holeSize:state.holeSize,cavity:state.cavity,pocketStrength:state.pocketStrength,crackDepth:state.crackDepth,crackWidth:state.crackWidth,crackBranch:state.crackBranch,macro:state.macro,warp:state.warp,detail:state.detail,detailScale:state.detailScale},runtime:{tideOffset:state.tideOffset,wetBand:state.wetBand,colorStrength:state.colorStrength,blueStrength:state.blueStrength}};}
};
window.__KARST_FIELD_CONTRACT__={identity:"fixed-after-approval",defaultMode:"DEM_CONTINUOUS_FIELD",specimensAreProbes:true,geometryOperators:["primaryCavity","secondaryPocket","frozenMarineNotch","oneSidedWedgeCrack","continuousReefUnion"],runtimeInputs:["tideOffset","wetBand"],runtimeBands:["demMacro","karstStructure","surfaceMicroscope"]};
window.__KARST_DIAGNOSTICS__={renderer:"two-pass-r263-rgba8-production-candidate",material:"compact blue-gray stone and tide-coupled reef",shape:"continuous DEM karst field joined to reef platform with true wedge crack cavities"};'''
source = replace_once(source, old_contract, new_contract, "production runtime contract")
source = source.replace(
    'document.getElementById("badge").textContent=`首帧 ${loadMs} ms · DEM 连续场 · 紧凑材质 · 三维工作台`',
    'document.getElementById("badge").textContent=`首帧 ${loadMs} ms · 生产候选 · 真裂隙 · 礁盘连续 · 潮位接口`',
)
source = source.replace(
    'renderer:"two-pass-r262-rgba8-compact-material"',
    'renderer:"two-pass-r263-rgba8-production-candidate"',
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(source, encoding="utf-8")

contract = {
    "schema": "KARST_FIELD_PRODUCTION_CONTRACT_R263",
    "fieldIdentity": "freeze after visual approval",
    "sourceMode": "DEM_CONTINUOUS_FIELD",
    "specimensAreProbes": True,
    "frozenGeometryInputs": [
        "demCanonical",
        "seaLevelBaseline",
        "seaNotchAmplitude",
        "primaryCavities",
        "secondaryPockets",
        "oneSidedWedgeCracks",
        "reefPlatformUnion",
        "macroWarp",
    ],
    "runtimeInputs": {
        "tideOffset": {"source": "Ocean Mother", "min": -1.5, "max": 1.5, "affects": ["wetBand", "reefWetDryBoundary"], "changesGeometry": False},
        "wetBand": {"affects": ["rockWetBand", "reefWetDryBoundary"], "changesGeometry": False},
    },
    "runtimeBands": ["demMacro", "karstStructure", "surfaceMicroscope"],
    "cacheKey": "demHash + operatorHash + frozenParameterHash + formatVersion",
    "visualApproved": False,
}
CONTRACT.write_text(json.dumps(contract, ensure_ascii=False, indent=2), encoding="utf-8")

bridge = '''export const KARST_FIELD_PRODUCTION_CONTRACT = Object.freeze({
  schema: "KARST_FIELD_PRODUCTION_CONTRACT_R263",
  frozenGeometry: true,
  runtimeInputs: ["tideOffset", "wetBand"],
  runtimeBands: ["demMacro", "karstStructure", "surfaceMicroscope"],
});

export function selectKarstBands(projectedPixels) {
  if (!Number.isFinite(projectedPixels) || projectedPixels < 1) return ["demMacro"];
  if (projectedPixels < 96) return ["demMacro", "karstStructure"];
  return ["demMacro", "karstStructure", "surfaceMicroscope"];
}

export function applyTideSample(workbenchRuntime, tideOffsetMeters) {
  if (!workbenchRuntime || typeof workbenchRuntime.setTideLevel !== "function") {
    throw new TypeError("Karst runtime must expose setTideLevel(offset)");
  }
  return workbenchRuntime.setTideLevel(tideOffsetMeters);
}
'''
BRIDGE.write_text(bridge, encoding="utf-8")

report = {
    "schema": "LANDSCAPE_KARST_DEM_FIELD_R263_PRODUCTION",
    "source": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "output": str(OUT.relative_to(ROOT)),
    "outputSha256": sha256(source),
    "outputBytes": len(source.encode("utf-8")),
    "defaultMode": "DEM_CONTINUOUS_FIELD",
    "productionCandidate": True,
    "geometry": {
        "cracksAffectDistanceField": True,
        "crackProfile": "one-sided wedge, wide at surface and closed at depth",
        "reefPlatformContinuousUnion": True,
        "seaNotchMax": 4.5,
    },
    "tide": {
        "frozenSeaLevelBaseline": True,
        "runtimeTideOffset": True,
        "runtimeTideChangesGeometry": False,
        "consumer": "Ocean Mother",
    },
    "renderer": "WebGL2 RGBA8 packed geometry + compact production material",
    "visualApproved": False,
}
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
