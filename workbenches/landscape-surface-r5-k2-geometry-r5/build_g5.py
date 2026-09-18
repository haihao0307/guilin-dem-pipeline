from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r4/index.html"
OUT = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r5/index.html"
BUILD = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r5/build.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


raw = SRC.read_bytes()
source_sha = sha256(raw)
s = raw.decode("utf-8")
assert "R5.K2.G4" in s and "Source SDF Microscope + Source Soil" in s, "G4 source contract missing"

# G5 is a form-first candidate. The default view is gray and all shader-only relief is disabled.
s = s.replace("R5.K2.G4 Source-Coupled Form", "R5.K2.G5 Volumetric Form", 1)
s = s.replace("水蚀岩壁 R5.K2.G4", "水蚀岩壁 R5.K2.G5", 1)
s = s.replace("Source SDF Microscope + Source Soil", "Volumetric Domain Warp + Real Cavity Geometry", 1)
s = s.replace("R5.K2.G4 先改写源隐式场", "R5.K2.G5 先扭曲完整体积域并改写源隐式场", 1)

old_default = "const DEFAULT=Object.freeze({schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,sourceForm:1.15,sourceScale:6.4,sourceWarp:1.30,sourceErosion:.90,geo:.80,concavity:.70,spikeGuard:.95,soilMicro:.85});"
new_default = "const DEFAULT=Object.freeze({schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,sourceForm:1.30,sourceScale:7.5,sourceWarp:1.40,sourceErosion:1.10,geo:.60,concavity:.60,spikeGuard:.95,soilMicro:1.00});"
assert old_default in s, "worker DEFAULT missing"
s = s.replace(old_default, new_default, 1)

old_recipe = "let recipe={schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,sourceForm:1.15,sourceScale:6.4,sourceWarp:1.30,sourceErosion:.90,geo:.80,concavity:.70,spikeGuard:.95,soilMicro:.85};"
new_recipe = "let recipe={schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,sourceForm:1.30,sourceScale:7.5,sourceWarp:1.40,sourceErosion:1.10,geo:.60,concavity:.60,spikeGuard:.95,soilMicro:1.00};"
assert old_recipe in s, "app recipe missing"
s = s.replace(old_recipe, new_recipe, 1)

# Replace the small scalar SDF offset with a shared volumetric domain. This domain is used by the
# outer body, joints, grooves, explicit cave/notch cutters, collision field and section extraction.
source_pattern = re.compile(
    r"function sourceMicroscopeOffset\(x,y,z\)\{.*?const soilMicroscope=\{.*?cameraAffectsGeometry:false\};\nfunction substrate",
    re.S,
)
source_kernel = r'''function sourceFormGate(x,y,z){
  let height=smooth(-3.0,2.2,y)*(1-smooth(44.0,51.5,y));
  let radial=1-smooth(39.0,49.0,Math.hypot(x*.82,z));
  return clamp(height*radial);
}
function sourceDomain(x,y,z){
  const gate=sourceFormGate(x,y,z),strength=c.sourceForm,warp=c.sourceWarp,sc=c.sourceScale;
  if(strength<=0||warp<=0||gate<=0)return{x,y,z,gate,warpM:0};
  let n0=noise(x*.021+3.7,y*.015-7.1,z*.019+11.9,c.seed+1701)-.5;
  let n1=noise(x*.014-9.3,y*.026+4.8,z*.017-6.4,c.seed+1723)-.5;
  let n2=noise(x*.027+13.1,y*.012-2.6,z*.024+5.7,c.seed+1739)-.5;
  let n3=noise(x*.009-6.2,y*.011+8.7,z*.010+2.8,c.seed+1747)-.5;
  let amp=gate*strength*warp*(.52+.065*sc);
  let dx=amp*(.92*n0+.38*n1*n2+.20*n3);
  let dy=amp*(.54*n1+.20*n0*n2-.12*n3);
  let dz=amp*(.88*n2-.31*n0*n1+.18*n3);
  let ang=gate*warp*(.22+.055*strength)*(n1*.86+n0*.36+n3*.24),ca=Math.cos(ang),sa=Math.sin(ang),cx=-3,cz=1;
  let px=x-cx,pz=z-cz,X=cx+ca*px-sa*pz+dx,Z=cz+sa*px+ca*pz+dz,Y=y+dy;
  return{x:X,y:Y,z:Z,gate,warpM:Math.hypot(X-x,Y-y,Z-z)};
}
function sourceFormOffset(x,y,z,D){
  const strength=c.sourceForm;if(strength<=0||D.gate<=0)return 0;
  const sc=c.sourceScale,X=D.x,Y=D.y,Z=D.z;
  let broad=noise(X/(sc*1.12),Y/(sc*1.62),Z/(sc*1.08),c.seed+1751)-.5;
  let mid=noise((X+.19*Y)/(sc*.53)+4.3,(Y-.12*Z)/(sc*.88)-3.1,(Z+.16*X)/(sc*.51)+7.7,c.seed+1771)-.5;
  let flow=noise((X+.27*Y)/(sc*.74)+8.2,Y/(sc*2.35)-1.9,(Z-.23*Y)/(sc*.69)-5.4,c.seed+1787)-.5;
  let breakup=.74+.58*(noise(X*.031-2.7,Y*.021+6.8,Z*.028+1.9,c.seed+1799)-.5);
  let f=(.78*broad+.37*mid+.26*flow)*breakup;
  let cavity=smooth(.08,.36,f+.055*mid),channel=smooth(.16,.43,.68*flow+.32*mid),bulge=smooth(.09,.34,-f-.015);
  return D.gate*(strength*(.86*f-.48*bulge*bulge)+c.sourceErosion*(1.42*cavity*cavity+.66*channel*channel));
}
function soilSourceOffset(x,z){
  const strength=c.soilMicro;if(strength<=0)return 0;
  let w0=noise(x*.031+5.2,0,z*.028-8.1,c.seed+1843)-.5;
  let w1=noise(x*.019-9.7,0,z*.023+3.4,c.seed+1859)-.5;
  let sx=x+4.1*w0+1.8*w1,sz=z+3.7*w1-1.4*w0;
  let broad=noise(sx*.105,0,sz*.096,c.seed+1871)-.5;
  let mid=noise(sx*.245+4.7,0,sz*.216-6.2,c.seed+1883)-.5;
  let fine=noise(sx*.52-3.4,0,sz*.46+8.3,c.seed+1897)-.5;
  return strength*(.46*broad+.20*mid+.075*fine);
}
let sourceMax=0,sourceSum2=0,domainMax=0,domainSum2=0,sourceCount=0;
for(let yy=2;yy<=46;yy+=3.2)for(let j=0;j<36;j++){
  let a=j*Math.PI/18,r=8+yy*.20+(j%4)*1.35,x=-3+Math.cos(a)*r,z=Math.sin(a)*r*.82,D=sourceDomain(x,yy,z),v=sourceFormOffset(x,yy,z,D);
  sourceMax=Math.max(sourceMax,Math.abs(v));sourceSum2+=v*v;domainMax=Math.max(domainMax,D.warpM);domainSum2+=D.warpM*D.warpM;sourceCount++;
}
let soilMax=0,soilSum2=0,soilCount=0;
for(let x=-48;x<=48;x+=6)for(let z=-40;z<=40;z+=5){let v=soilSourceOffset(x,z);soilMax=Math.max(soilMax,Math.abs(v));soilSum2+=v*v;soilCount++}
const sourceMicroscope={schema:'LANDSCAPE_VOLUMETRIC_MICROSCOPE_R2',fieldCoupled:true,domainWarpBeforeMeshing:true,sourceOffsetBeforeMeshing:true,appliesBeforeMeshing:true,strength:c.sourceForm,scaleM:c.sourceScale,warp:c.sourceWarp,erosionBias:c.sourceErosion,maxDomainWarpM:domainMax,rmsDomainWarpM:Math.sqrt(domainSum2/Math.max(1,sourceCount)),maxFieldOffsetM:sourceMax,rmsFieldOffsetM:Math.sqrt(sourceSum2/Math.max(1,sourceCount)),maxSampleOffsetM:Math.max(domainMax,sourceMax),sampleCount:sourceCount,changesSilhouette:true,changesCavityBoundary:true,changesCollisionField:true,changesCrossSection:true,caveDomainWarped:true,jointDomainWarped:true,cameraAffectsGeometry:false};
const soilMicroscope={schema:'LANDSCAPE_SOIL_SOURCE_FIELD_R3',fieldCoupled:true,appliesBeforeMeshing:true,strength:c.soilMicro,maxSampleOffsetM:soilMax,rmsSampleOffsetM:Math.sqrt(soilSum2/Math.max(1,soilCount)),sampleCount:soilCount,topographyFunction:'groundBed + volumetric soilSourceOffset',terrainSupportUsesSourceMesh:true,cameraAffectsGeometry:false};
function substrate'''
s, n = source_pattern.subn(source_kernel, s, count=1)
assert n == 1, "G4 source kernel not found"

substrate_pattern = re.compile(r"function substrate\(x,y,z\)\{.*?\}\nconst erosion=", re.S)
substrate_new = r'''function substrate(x,y,z){let D=sourceDomain(x,y,z),X=D.x,Y=D.y,Z=D.z,d=env(X,Y,Z);if(d>5||Y< -5.6)return d;d=d+(fbm(X*.091,Y*.13,Z*.107,c.seed)-.5)*4.5+1.1*detail(X*.44+3,Y*.49,Z*.48+7,4);return d+sourceFormOffset(x,y,z,D)}
const erosion='''
s, n = substrate_pattern.subn(substrate_new, s, count=1)
assert n == 1, "substrate block missing"

rock_pattern = re.compile(r"function rockBeforeDetach\(x,y,z\)\{.*?\n\}\nfunction rock\(x,y,z\)", re.S)
rock_new = r'''function rockBeforeDetach(x,y,z){let D=sourceDomain(x,y,z),X=D.x,Y0=D.y,Z=D.z,d=substrate(x,y,z);if(d>5||Y0< -5.6||stage===0)return d;
for(const j of J){let Y=Y0-j.cy;if(Math.abs(Y)>j.length+2)continue;let protect=smooth(2,7,Y0)*(1-smooth(38,47,Y0)),ang=j.turn*protect,ca=Math.cos(ang),sa=Math.sin(ang),tx=j.tx*ca-j.tz*sa,tz=j.tx*sa+j.tz*ca,U=(X-j.cx)*tx+(Z-j.cz)*tz+j.tilt*Y,V=-(X-j.cx)*tz+(Z-j.cz)*tx;if(Math.abs(V-1)>j.depth+8||Math.abs(U)>4)continue;
let wander=(noise(Y0*.093,j.phase,V*.089,j.wseed)-.5)*1.55+j.bend*Y*.035,taper=1-smooth(j.length*.55,j.length,Math.abs(Y)),width=j.width*jointFactor*(.33+.67*noise(Y0*.18+3,V*.14,j.phase,j.wseed+7))*(.25+.75*taper),ell=(Math.hypot(Y/j.length,(V-1)/(j.depth+6))-1)*Math.min(j.length,j.depth+6);
let slit=smax(Math.abs(U+wander)-width,ell,.17);d=Math.max(d,-slit);
if(j.branch&&Y>-.3&&Y<j.length*.58){const fork=Math.max(Math.abs(U+wander+(Y-1)*.40)-width*.64,Math.abs(Y-j.length*.22)-j.length*.25,Math.abs(V)-j.depth*.86);d=Math.max(d,-fork)}
}
if(stage>=2){let f1=noise(X*.41+noise(X*.047,Y0*.052,Z*.047,c.seed+91)*1.6,Y0*.065,Z*.44,c.seed+101),f2=noise(X*.9,Y0*.12,Z*.94,c.seed+117),groove=smooth(.56,.8,f1)*(.3+.65*smooth(.34,.7,f2)),runoff=smooth(1,12,Y0)*(1-smooth(40,52,Y0));
let [cavity,channel]=erosion.sample(x,y,z);d+=er*c.relief*(1.25*groove*runoff+.40*detail(X*1.3,Y0*.59,Z*1.21,4)+channel*1.65);d=Math.max(d,-cavity);
let caveIrregular=(noise(X*.112+4.7,Y0*.081-2.9,Z*.103+8.1,c.seed+1913)-.5)*c.sourceForm*(.72+.42*c.sourceErosion),a=(X+6)/6.8,b=(Y0-5.4)/4.7,q=(Z-8.8)/9.,cave=(Math.sqrt(a*a+b*b+q*q)-1)*4.7+caveIrregular+.24*detail(X*.59,Y0*.67,Z*.53,3);d=Math.max(d,-cave);
let notchIrregular=(noise(X*.147-6.1,Y0*.097+3.7,Z*.131-4.8,c.seed+1931)-.5)*c.sourceForm*(.52+.35*c.sourceErosion),notch=(Math.sqrt(((X-12)/10)**2+((Y0-7)/3.7)**2+((Z-8)/8)**2)-1)*3.7+notchIrregular+.18*detail(X*.84,Y0*.78,Z*.92,3);d=Math.max(d,-notch);
}return d;
}
function rock(x,y,z)'''
s, n = rock_pattern.subn(rock_new, s, count=1)
assert n == 1, "rockBeforeDetach block missing"

old_cutters = "function rock(x,y,z){let d=rockBeforeDetach(x,y,z);if(stage>=3)for(const e of events)d=Math.max(d,-cut(e,x,y,z));return d}\nfunction sourceFragment(e,x,y,z){return Math.max(rockBeforeDetach(x,y,z),cut(e,x,y,z))}"
new_cutters = "function rock(x,y,z){let d=rockBeforeDetach(x,y,z);if(stage>=3){let D=sourceDomain(x,y,z);for(const e of events)d=Math.max(d,-cut(e,D.x,D.y,D.z))}return d}\nfunction sourceFragment(e,x,y,z){let D=sourceDomain(x,y,z);return Math.max(rockBeforeDetach(x,y,z),cut(e,D.x,D.y,D.z))}"
assert old_cutters in s, "rock cutter block missing"
s = s.replace(old_cutters, new_cutters, 1)

# UI semantics and defaults: the page opens as a shape-only gray model.
replacements = {
    '<label for="sourceForm">源形体强度</label><output id="sourceFormOut">1.15</output></div><input id="sourceForm" type="range" min="0" max="2.4" step=".05" value="1.15">': '<label for="sourceForm">实体形变幅度</label><output id="sourceFormOut">1.30</output></div><input id="sourceForm" type="range" min="0" max="2.4" step=".05" value="1.30">',
    '<label for="sourceScale">源形体尺度</label><output id="sourceScaleOut">6.40 m</output></div><input id="sourceScale" type="range" min="3" max="12" step=".1" value="6.4">': '<label for="sourceScale">实体变化尺度</label><output id="sourceScaleOut">7.50 m</output></div><input id="sourceScale" type="range" min="3" max="12" step=".1" value="7.5">',
    '<label for="sourceWarp">源形体 Warp</label><output id="sourceWarpOut">1.30</output></div><input id="sourceWarp" type="range" min="0" max="2.5" step=".05" value="1.30">': '<label for="sourceWarp">体积域 Warp</label><output id="sourceWarpOut">1.40</output></div><input id="sourceWarp" type="range" min="0" max="2.5" step=".05" value="1.40">',
    '<label for="sourceErosion">源溶蚀偏置</label><output id="sourceErosionOut">0.90</output></div><input id="sourceErosion" type="range" min="0" max="1.6" step=".05" value=".90">': '<label for="sourceErosion">洞壁与凹坑切削</label><output id="sourceErosionOut">1.10</output></div><input id="sourceErosion" type="range" min="0" max="1.6" step=".05" value="1.10">',
    '<label for="geo">次级网格修饰</label><output id="geoOut">0.80</output></div><input id="geo" type="range" min=".6" max="1.8" step=".05" value=".80">': '<label for="geo">次级顶点细节</label><output id="geoOut">0.60</output></div><input id="geo" type="range" min=".6" max="1.8" step=".05" value=".60">',
    '<output id="concavityOut">0.70</output></div><input id="concavity" type="range" min=".2" max="1.25" step=".05" value=".70">': '<output id="concavityOut">0.60</output></div><input id="concavity" type="range" min=".2" max="1.25" step=".05" value=".60">',
    '<label for="soilMicro">土壤源形体</label><output id="soilMicroOut">0.85</output></div><input id="soilMicro" type="range" min="0" max="1.5" step=".05" value=".85">': '<label for="soilMicro">土壤真实地形</label><output id="soilMicroOut">1.00</output></div><input id="soilMicro" type="range" min="0" max="1.5" step=".05" value="1.00">',
    '<label for="scope">Microscope 壳层强度</label><output id="scopeOut">1.55</output></div><input id="scope" type="range" min=".6" max="3.0" step=".05" value="1.55">': '<label for="scope">着色壳层（默认关闭）</label><output id="scopeOut">0.00</output></div><input id="scope" type="range" min="0" max="3.0" step=".05" value="0">',
    '<label for="micro">Breakaway / Brick 微表面</label><output id="microOut">1.80</output></div><input id="micro" type="range" min="1.4" max="4" step=".05" value="1.80">': '<label for="micro">微表面法线（默认关闭）</label><output id="microOut">0.00</output></div><input id="micro" type="range" min="0" max="4" step=".05" value="0">',
    '<button data-mode="0" class="active">彩色</button><button data-mode="1">灰模</button>': '<button data-mode="0">彩色</button><button data-mode="1" class="active">灰模形体验收</button>',
}
for old, new in replacements.items():
    assert old in s, old[:80]
    s = s.replace(old, new, 1)

old_state = "let state={theta:.50,phi:1.26,radius:116,target:[-3,20,0],mode:0,section:false,scope:1.05,shellScale:.94,shellContrast:1.20,shellCoverage:.78,shellDirection:18,shellWarp:1.10,shellBreakup:.72,micro:1.45,breakContrast:1.25,wet:0,exposure:1.08,grass:true,selected:0}"
new_state = "let state={theta:.50,phi:1.26,radius:116,target:[-3,20,0],mode:1,section:false,scope:0,shellScale:.94,shellContrast:1.20,shellCoverage:.78,shellDirection:18,shellWarp:1.10,shellBreakup:.72,micro:0,breakContrast:1.00,wet:0,exposure:1.08,grass:true,selected:0}"
assert old_state in s, "state defaults missing"
s = s.replace(old_state, new_state, 1)

old_reset = "state={...state,scope:1.05,shellScale:.94,shellContrast:1.20,shellCoverage:.78,shellDirection:18,shellWarp:1.10,shellBreakup:.72,micro:1.45,breakContrast:1.25,wet:0,exposure:1.08,mode:0,section:false,grass:true,selected:0}"
new_reset = "state={...state,scope:0,shellScale:.94,shellContrast:1.20,shellCoverage:.78,shellDirection:18,shellWarp:1.10,shellBreakup:.72,micro:0,breakContrast:1.00,wet:0,exposure:1.08,mode:1,section:false,grass:true,selected:0}"
assert old_reset in s, "reset defaults missing"
s = s.replace(old_reset, new_reset, 1)

s = s.replace("v.scope<.6", "v.scope<0", 1)
s = s.replace("v.micro<1.4", "v.micro<0", 1)

old_presets = "const formPresets={off:{sourceForm:0,sourceScale:6.4,sourceWarp:0,sourceErosion:0},standard:{sourceForm:1.15,sourceScale:6.4,sourceWarp:1.30,sourceErosion:.90},strong:{sourceForm:1.90,sourceScale:7.2,sourceWarp:1.75,sourceErosion:1.25}};"
new_presets = "const formPresets={off:{sourceForm:0,sourceScale:7.5,sourceWarp:0,sourceErosion:0},standard:{sourceForm:1.30,sourceScale:7.5,sourceWarp:1.40,sourceErosion:1.10},strong:{sourceForm:2.10,sourceScale:8.6,sourceWarp:1.85,sourceErosion:1.45}};"
assert old_presets in s, "form presets missing"
s = s.replace(old_presets, new_presets, 1)

info_anchor = "<p><b>G4 核心：</b>"
assert info_anchor in s, "G4 info paragraph missing"
s = s.replace(
    info_anchor,
    "<p><b>G5 形体验收：</b>页面默认关闭壳层和微法线并使用灰模。体积域 Warp 同时作用于外轮廓、节理、溶沟、主洞口、凹坑、剖面和碰撞场；只有重新生成后的真实三角网格变化才计为成功。</p><p><b>G4 核心：</b>",
    1,
)

raw_out = s.encode("utf-8")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(raw_out)

build = {
    "schema": "LANDSCAPE_R5_K2_G5_VOLUMETRIC_FORM_V1",
    "date": "2026-09-17",
    "sourcePath": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "candidatePath": str(OUT.relative_to(ROOT)),
    "candidateSha256": sha256(raw_out),
    "candidateBytes": len(raw_out),
    "volumetricGeometry": {
        "schema": "LANDSCAPE_VOLUMETRIC_MICROSCOPE_R2",
        "fieldCoupled": True,
        "applicationPoint": "shared sourceDomain() before body, joint, groove, cave, notch, section and collision extraction",
        "defaultStrength": 1.30,
        "defaultScaleM": 7.5,
        "defaultWarp": 1.40,
        "defaultErosionBias": 1.10,
        "controls": ["sourceForm", "sourceScale", "sourceWarp", "sourceErosion"],
        "affects": ["silhouette", "cavity boundary", "joint geometry", "cross-section", "collision/SDF", "detachment cutters"],
    },
    "soilGeometry": {
        "schema": "LANDSCAPE_SOIL_SOURCE_FIELD_R3",
        "fieldCoupled": True,
        "applicationPoint": "groundBed() before W.mesh",
        "defaultStrength": 1.00,
        "terrainSupportUsesSourceMesh": True,
    },
    "shapeProofView": {
        "defaultMode": "gray geometry",
        "shaderShellDefault": 0,
        "microNormalDefault": 0,
    },
    "macroGeometryReplacement": False,
    "cameraAffectsGeometry": False,
    "timeAffectsStaticRock": False,
    "geometryFieldCoupled": True,
    "visualApproved": False,
    "productionReady": False,
}
BUILD.write_text(json.dumps(build, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(build, ensure_ascii=False))
