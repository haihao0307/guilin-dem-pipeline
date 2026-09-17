from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r3-tiles-microscope/index.html"
OUT = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r3-tiles-v26/index.html"
BUILD = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r3-tiles-v26/build.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


raw = SRC.read_bytes()
source_sha = sha256(raw)
s = raw.decode("utf-8")
assert "R5.K2.G3.T1 Tiles Shape Microscope" in s
assert "Tiles Mother Shape Microscope · G3 Locked" in s
assert "float lmShapeBand" in s and "vec3 lmDomain" in s

# Keep the user-accepted G3/Tiles scene intact. Only strengthen the existing
# real vertex shell and map Brick Mother V2.6's rich multi-field color logic to limestone.
s = s.replace("R5.K2.G3.T1 Tiles Shape Microscope", "R5.K2.G3.T2 Tiles + V2.6 Wave", 1)
s = s.replace("水蚀岩壁 R5.K2.G3.T1", "水蚀岩壁 R5.K2.G3.T2", 1)
s = s.replace("Tiles Mother Shape Microscope · G3 Locked", "Tiles Shape + Brick V2.6 Wave/Color · G3 Locked", 1)
s = s.replace("<label for=\"scope\">Microscope 形体强度</label>", "<label for=\"scope\">V2.6 真实形体强度</label>", 1)
s = s.replace("<label for=\"shellScale\">壳层尺度</label>", "<label for=\"shellScale\">V2.6 造波尺度</label>", 1)
s = s.replace("<label for=\"shellContrast\">壳层对比</label>", "<label for=\"shellContrast\">造波对比</label>", 1)
s = s.replace("<label for=\"shellCoverage\">壳层覆盖率</label>", "<label for=\"shellCoverage\">形体覆盖率</label>", 1)
s = s.replace("<label for=\"shellWarp\">壳层 Warp</label>", "<label for=\"shellWarp\">V2.6 造波强度</label>", 1)
s = s.replace("<label for=\"shellBreakup\">连续破除</label>", "<label for=\"shellBreakup\">造波连续破除</label>", 1)
s = s.replace("<label for=\"breakContrast\">Breakaway 表面对比</label>", "<label for=\"breakContrast\">V2.6 色彩强度</label>", 1)
s = s.replace(
    "沿用 Tiles Mother 的做法：同一个 Microscope 场直接移动渲染顶点并重算法线；不是贴图。峰顶、峰脚和主洞口继续保护。",
    "Tiles Mother 继续负责真实顶点位移；Brick Mother V2.6 只补更强的多场造波与富色矿物分区。峰顶、峰脚、主洞口和 G3 大形不动。",
    1,
)

ui_values = {
    '<output id="scopeOut">1.55</output>': '<output id="scopeOut">2.15</output>',
    'id="scope" type="range" min="0" max="3.0" step=".05" value="1.55"': 'id="scope" type="range" min="0" max="3.0" step=".05" value="2.15"',
    '<output id="shellScaleOut">0.82</output>': '<output id="shellScaleOut">0.74</output>',
    'id="shellScale" type="range" min=".4" max="2.4" step=".05" value=".82"': 'id="shellScale" type="range" min=".4" max="2.4" step=".05" value=".74"',
    '<output id="shellContrastOut">1.65</output>': '<output id="shellContrastOut">2.20</output>',
    'id="shellContrast" type="range" min=".5" max="3" step=".05" value="1.65"': 'id="shellContrast" type="range" min=".5" max="3" step=".05" value="2.20"',
    '<output id="shellCoverageOut">0.88</output>': '<output id="shellCoverageOut">0.94</output>',
    'id="shellCoverage" type="range" min=".15" max="1" step=".05" value=".88"': 'id="shellCoverage" type="range" min=".15" max="1" step=".05" value=".94"',
    '<output id="shellWarpOut">1.35</output>': '<output id="shellWarpOut">1.90</output>',
    'id="shellWarp" type="range" min=".2" max="2.5" step=".05" value="1.35"': 'id="shellWarp" type="range" min=".2" max="2.5" step=".05" value="1.90"',
    '<output id="shellBreakupOut">0.90</output>': '<output id="shellBreakupOut">1.18</output>',
    'id="shellBreakup" type="range" min="0" max="1.5" step=".05" value=".90"': 'id="shellBreakup" type="range" min="0" max="1.5" step=".05" value="1.18"',
    '<output id="breakContrastOut">1.60</output>': '<output id="breakContrastOut">2.30</output>',
    'id="breakContrast" type="range" min="1" max="3.5" step=".05" value="1.60"': 'id="breakContrast" type="range" min="1" max="3.5" step=".05" value="2.30"',
}
for old, new in ui_values.items():
    assert old in s, old
    s = s.replace(old, new, 1)

old_state = "let state={theta:.50,phi:1.26,radius:116,target:[-3,20,0],mode:0,section:false,scope:1.55,shellScale:.82,shellContrast:1.65,shellCoverage:.88,shellDirection:18,shellWarp:1.35,shellBreakup:.90,micro:1.80,breakContrast:1.60,wet:0,exposure:1.08,grass:true,selected:0}"
new_state = "let state={theta:.50,phi:1.26,radius:116,target:[-3,20,0],mode:0,section:false,scope:2.15,shellScale:.74,shellContrast:2.20,shellCoverage:.94,shellDirection:18,shellWarp:1.90,shellBreakup:1.18,micro:1.80,breakContrast:2.30,wet:0,exposure:1.08,grass:true,selected:0}"
assert old_state in s
s = s.replace(old_state, new_state, 1)

old_reset = "state={...state,scope:1.55,shellScale:.82,shellContrast:1.65,shellCoverage:.88,shellDirection:18,shellWarp:1.35,shellBreakup:.90,micro:1.80,breakContrast:1.60,wet:0,exposure:1.08,mode:0,section:false,grass:true,selected:0}"
new_reset = "state={...state,scope:2.15,shellScale:.74,shellContrast:2.20,shellCoverage:.94,shellDirection:18,shellWarp:1.90,shellBreakup:1.18,micro:1.80,breakContrast:2.30,wet:0,exposure:1.08,mode:0,section:false,grass:true,selected:0}"
assert old_reset in s
s = s.replace(old_reset, new_reset, 1)

old_presets = "const surfacePresets={soft:{scope:.85,shellScale:1.15,shellContrast:.85,shellCoverage:.62,shellWarp:.70,shellBreakup:.35,micro:1.4,breakContrast:1.05},standard:{scope:1.55,shellScale:.82,shellContrast:1.65,shellCoverage:.88,shellWarp:1.35,shellBreakup:.90,micro:1.8,breakContrast:1.6},strong:{scope:2.15,shellScale:.67,shellContrast:2.15,shellCoverage:.94,shellWarp:1.75,shellBreakup:1.15,micro:2.55,breakContrast:2.25},extreme:{scope:2.75,shellScale:.54,shellContrast:2.75,shellCoverage:1,shellWarp:2.15,shellBreakup:1.40,micro:3.45,breakContrast:3.10}};"
new_presets = "const surfacePresets={soft:{scope:1.05,shellScale:1.10,shellContrast:1.10,shellCoverage:.72,shellWarp:.90,shellBreakup:.48,micro:1.4,breakContrast:1.25},standard:{scope:2.15,shellScale:.74,shellContrast:2.20,shellCoverage:.94,shellWarp:1.90,shellBreakup:1.18,micro:1.8,breakContrast:2.30},strong:{scope:2.60,shellScale:.64,shellContrast:2.55,shellCoverage:.97,shellWarp:2.20,shellBreakup:1.38,micro:2.55,breakContrast:2.80},extreme:{scope:3.0,shellScale:.54,shellContrast:2.90,shellCoverage:1,shellWarp:2.45,shellBreakup:1.50,micro:3.45,breakContrast:3.30}};"
assert old_presets in s
s = s.replace(old_presets, new_presets, 1)

shape_block = r'''vec3 lmRot(vec3 v,vec3 axis,float a){axis=normalize(axis);float c=cos(a),ss=sin(a);return c*v+ss*cross(axis,v)+(1.-c)*axis*dot(axis,v);}
float lmV26Fbm(vec3 p){float v=0.,a=.52,total=0.;for(int i=0;i<5;i++){v+=bmN(p)*a;total+=a;p=p*2.03+vec3(19.1,7.7,13.4);a*=.49;}return v/total;}
float lmV26Ridged(vec3 p){float v=0.,a=.56,total=0.;for(int i=0;i<5;i++){float n=1.-abs(bmN(p)*2.-1.);v+=n*n*a;total+=a;p=p*2.11+vec3(11.7,5.3,17.9);a*=.47;}return v/total;}
float lmV26Turb(vec3 p){float v=0.,a=.54,total=0.;for(int i=0;i<4;i++){v+=abs(bmN(p)*2.-1.)*a;total+=a;p=p*2.07+vec3(3.7,17.2,9.1);a*=.50;}return v/total;}
vec3 lmV26Warp(vec3 p){return vec3(lmV26Fbm(p+vec3(17.1,3.8,9.2)),lmV26Fbm(p+vec3(4.4,19.7,12.1)),lmV26Fbm(p+vec3(13.8,7.2,23.4)))-.5;}
float lmShapeBand(vec3 p,float seed,float density,float footprint){
 vec3 q0=vec3(p.x+(fract(sin(seed*12.9898+78.233)*43758.5453)-.5)*.11,p.z+.40,p.y+.27);
 float r=max(length(q0),.0001);
 vec3 xi=vec3(log2(r)-2.,-q0.z/r,atan(q0.x,q0.y))*density;
 float span=footprint*density/max(length(q0.xy),.20),scale=1.,value=0.;
 for(int j=0;j<17;j++){
  if(span*scale>=2.4)break;
  float weight=1.-smoothstep(.8,2.4,span*scale);
  vec3 c=cos(xi*scale);value+=weight*(cos(dot(c.zyy,c.xyx))-.6556965)/scale;scale*=2.;
 }
 return value;
}
vec3 lmDomain(vec3 rawQ){
 float a=radians(uShellDirection),ca=cos(a),sa=sin(a);
 vec3 q0=vec3(ca*rawQ.x-sa*rawQ.z,rawQ.y,sa*rawQ.x+ca*rawQ.z);
 vec3 low=vec3(bmN(rawQ*.021+vec3(3.1,7.2,-2.4)),bmN(rawQ*.0187+vec3(-8.3,2.7,4.6)),bmN(rawQ*.0243+vec3(1.5,-6.4,9.1)))-.5;
 vec3 low2=vec3(bmN(rawQ*.0119+vec3(-13.7,6.2,18.1)),bmN(rawQ*.0141+vec3(9.8,-11.4,2.7)),bmN(rawQ*.0127+vec3(4.2,15.3,-8.9)))-.5;
 float zone=bmN(rawQ*.0137+vec3(17.1,-5.3,8.7));
 vec3 axis=normalize(vec3(.41,.79,.46)+low*.92+low2*.38);
 q0+=low*(.82+.78*uShellWarp)+low2*(.26+.42*uShellBreakup);
 q0=lmRot(q0,axis,(zone-.5)*(.78+1.18*uShellWarp));
 vec3 warpA=lmV26Warp(q0*.072+vec3(2.7,-6.1,9.3));
 q0+=warpA*(.72+1.08*uShellWarp);
 vec3 warpB=lmV26Warp((q0+warpA*2.1)*.143+vec3(-7.4,11.2,3.6));
 q0+=warpB*(.24+.46*uShellBreakup);
 q0.x+=sin(q0.y*.31+q0.z*.13+zone*2.1)*.14*uShellBreakup;
 q0.y+=sin(q0.z*.27-q0.x*.09-zone*1.7)*.10*uShellBreakup;
 q0.z+=sin(q0.x*.29+q0.y*.07+zone*1.3)*.13*uShellBreakup;
 return q0*max(.2,uShellScale);
}
float lmMouthProtect(vec3 x,vec3 c,vec3 r){float q0=length((x-c)/r);float shell=1.-smoothstep(.045,.28,abs(q0-1.));float front=smoothstep(c.z-2.,c.z+3.4,x.z);return shell*front;}
float lmRockGate(vec3 x,vec3 n){
 float t=clamp((x.y+5.82)/52.94,0.,1.);
 float height=smoothstep(.105,.205,t)*(1.-smoothstep(.835,.935,t));
 float wall=smoothstep(.055,.40,1.-abs(n.y));
 float cave=lmMouthProtect(x,vec3(-6.,5.4,8.8),vec3(6.8,4.7,9.));
 float notch=lmMouthProtect(x,vec3(12.,7.,8.),vec3(10.,3.7,8.));
 return clamp(height*wall*(1.-max(cave,notch)),0.,1.);
}
float lmCoverage(vec3 x){float zone=bmN(x*.027+vec3(23.7,-8.4,16.2));float edge=clamp(1.-uShellCoverage,0.,.85);return smoothstep(edge,min(1.,edge+.24),zone);}
float lmRockShell(vec3 rawQ,vec3 n){
 if(uScope<=0.)return 0.;
 vec3 p0=lmDomain(rawQ);
 vec3 v26p=p0*.070+lmV26Warp(p0*.036+vec3(4.1,-9.7,13.2))*(.78+.46*uShellWarp);
 float broad=clamp(lmShapeBand(p0,83.,6.,.0012),-1.,1.);
 float middle=clamp(lmShapeBand(p0,83.,26.,.0012),-1.,1.);
 float pores=smoothstep(.56,.67,lmShapeBand(p0,83.,80.,.0012));
 float macro=lmV26Fbm(v26p*1.08+vec3(7.3,2.1,-5.8));
 float ridge=lmV26Ridged(v26p*2.42+vec3(-3.7,11.9,4.2));
 float turbul=lmV26Turb(v26p*1.67+vec3(9.1,-6.4,14.3));
 float cavityA=smoothstep(.59,.84,lmV26Fbm(v26p*4.2+vec3(15.1,3.7,-8.2)));
 float cavityB=smoothstep(.64,.89,lmV26Ridged(v26p*5.7+vec3(-11.3,7.2,19.4)));
 float wave=(macro-.5)*.080+(ridge-.5)*.058+(turbul-.5)*.038;
 float shellValue=.040*broad+.018*middle-.034*pores+wave-cavityA*(.026+.015*uShellBreakup)-cavityB*.015;
 float amp=.095*uScope*(.70+.15*uShellContrast+.10*uShellWarp);
 float rawShell=clamp(tanh(shellValue*4.0)*amp,-.180,.160);
 return rawShell*lmRockGate(rawQ,n)*lmCoverage(rawQ);
}
float lmSoilShell(vec3 rawQ,vec3 n){
 if(uGroundMicro<=0.)return 0.;
 vec3 p0=lmDomain(rawQ*.72+vec3(5.3,-2.1,8.7));
 vec3 v26p=p0*.095+lmV26Warp(p0*.052+vec3(-6.3,8.2,14.7))*(.42+.24*uShellWarp);
 float broad=clamp(lmShapeBand(p0,211.,5.,.0012),-1.,1.);
 float middle=clamp(lmShapeBand(p0,211.,19.,.0012),-1.,1.);
 float pores=smoothstep(.58,.70,lmShapeBand(p0,211.,58.,.0012));
 float wave=(lmV26Fbm(v26p*1.3)-.5)*.045+(lmV26Ridged(v26p*2.7)-.5)*.030+(lmV26Turb(v26p*1.9)-.5)*.018;
 float shellValue=.021*broad+.009*middle-.012*pores+wave;
 float rawShell=clamp(tanh(shellValue*3.4)*.052*uGroundMicro*(.78+.12*uShellWarp),-.065,.060);
 return rawShell*smoothstep(.30,.86,n.y);
}
float lmShell(vec3 rawQ,vec3 n,float kind){if(kind<.5)return lmRockShell(rawQ,n);if(kind>2.5&&kind<3.5)return lmSoilShell(rawQ,n);return 0.;}'''

s, n = re.subn(r"vec3 lmRot\(.*?\nvoid main\(\)\{", shape_block + "\nvoid main(){", s, count=1, flags=re.S)
assert n == 1, "G3.T1 shape block not found"

color_block = r'''float lmV26ColorFbm(vec3 p){float v=0.,a=.52,total=0.;for(int i=0;i<5;i++){v+=bmN(p)*a;total+=a;p=p*2.03+vec3(19.1,7.7,13.4);a*=.49;}return v/total;}
float lmV26ColorRidged(vec3 p){float v=0.,a=.56,total=0.;for(int i=0;i<5;i++){float n=1.-abs(bmN(p)*2.-1.);v+=n*n*a;total+=a;p=p*2.11+vec3(11.7,5.3,17.9);a*=.47;}return v/total;}
float lmV26ColorTurb(vec3 p){float v=0.,a=.54,total=0.;for(int i=0;i<4;i++){v+=abs(bmN(p)*2.-1.)*a;total+=a;p=p*2.07+vec3(3.7,17.2,9.1);a*=.50;}return v/total;}
vec3 lmV26ColorWarp(vec3 p){return vec3(lmV26ColorFbm(p+vec3(17.1,3.8,9.2)),lmV26ColorFbm(p+vec3(4.4,19.7,12.1)),lmV26ColorFbm(p+vec3(13.8,7.2,23.4)))-.5;}
vec3 lmV26Color(vec3 base,vec3 rawQ,vec3 baseN){
 float richness=clamp((uBreakContrast-1.)/2.5,0.,1.);
 vec3 p0=rawQ*.055;
 vec3 warped=p0+lmV26ColorWarp(p0*.78+vec3(7.1,-3.8,11.4))*(.78+.44*uShellWarp);
 vec3 warped2=warped+lmV26ColorWarp(warped*1.67+vec3(-9.3,14.2,4.7))*(.22+.28*uShellBreakup);
 float macro=lmV26ColorFbm(warped2*1.08+vec3(2.7,9.1,-5.3));
 float macroB=lmV26ColorFbm(warped2*.67+vec3(-8.4,3.6,13.7));
 float ridge=lmV26ColorRidged(warped2*2.55+vec3(11.2,-7.1,5.9));
 float turbul=lmV26ColorTurb(warped2*1.82+vec3(-4.1,16.3,8.7));
 float patchA=lmV26ColorFbm(warped2*3.45+vec3(17.2,4.3,-9.1));
 float patchB=lmV26ColorRidged(warped2*5.8+vec3(-13.6,8.7,21.1));
 float patchC=lmV26ColorFbm(warped2*8.7+vec3(6.9,-18.4,12.5));
 float eventPatch=smoothstep(.38,.77,patchA*.52+patchB*.31+patchC*.17);
 float coolMask=smoothstep(.56,.84,(1.-macro)*.50+ridge*.30+(1.-patchA)*.20);
 float warmMask=smoothstep(.55,.82,macro*.55+macroB*.30+eventPatch*.15);
 float oxideMask=smoothstep(.62,.86,macroB*.35+turbul*.25+patchC*.24+eventPatch*.16);
 float mineralMask=smoothstep(.66,.90,ridge*.42+(1.-turbul)*.20+patchB*.25+eventPatch*.13);
 float oliveMask=smoothstep(.64,.87,patchA*.37+macroB*.31+(1.-baseN.y)*.18+ridge*.14);
 float darkMask=smoothstep(.57,.85,(1.-macroB)*.40+turbul*.27+patchC*.18+(1.-eventPatch)*.15);
 float wetMask=smoothstep(.58,.84,(1.-patchA)*.36+turbul*.26+(1.-baseN.y)*.22+macroB*.16)*( .18+.82*clamp(uWet+.18,0.,1.));
 vec3 cool=vec3(.25,.30,.31),neutral=vec3(.47,.45,.39),warm=vec3(.55,.39,.22),oxide=vec3(.46,.22,.075);
 vec3 mineral=vec3(.74,.71,.59),olive=vec3(.29,.34,.22),dark=vec3(.105,.125,.118),wet=vec3(.065,.105,.105);
 float tone=clamp(macro*.48+macroB*.24+ridge*.16+eventPatch*.12,0.,1.);
 float scale=mix(.68,1.43,smoothstep(.14,.87,tone));
 base*=mix(1.,scale,.50+.36*richness);
 base=mix(base,neutral,.10+.08*eventPatch);
 base=mix(base,cool,coolMask*(.18+.18*richness));
 base=mix(base,warm,warmMask*(.18+.20*richness));
 base=mix(base,oxide,oxideMask*(.10+.22*richness));
 base=mix(base,mineral,mineralMask*(.15+.24*richness));
 base=mix(base,olive,oliveMask*(.08+.15*richness));
 base=mix(base,dark,darkMask*(.12+.19*richness));
 base=mix(base,wet,wetMask*(.18+.25*richness));
 float l=dot(base,vec3(.2126,.7152,.0722));
 base=mix(vec3(l),base,1.02+.24*richness);
 return clamp(base,vec3(.025),vec3(.92));
}'''

anchor = "vec3 linearize(vec3 c){"
assert anchor in s
s = s.replace(anchor, color_block + "\n" + anchor, 1)

rain_anchor = "float rain=clamp(e.z,0.,1.),stain="
assert rain_anchor in s
s = s.replace(rain_anchor, "if(!cap&&family!=6)albedo=lmV26Color(albedo,q,n0);\n" + rain_anchor, 1)

s = s.replace("release:'limestone-water-surface-r5-g3t1-tiles-shape'", "release:'limestone-water-surface-r5-g3t2-v26-wave'", 1)

info_anchor = "<p><b>G3.T1：</b>"
assert info_anchor in s
s = s.replace(
    info_anchor,
    "<p><b>G3.T2：</b>保留 G3.T1 的 Tiles 真实顶点形变，只把 Brick Mother V2.6 的 domain warp、fBm、ridged、turbulence 与富色分区映射到石灰岩；不照搬砖红色，不更换大形。</p>" + info_anchor,
    1,
)

raw_out = s.encode("utf-8")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(raw_out)

build = {
    "schema": "LANDSCAPE_R5_K2_G3T2_TILES_V26_WAVE_V1",
    "date": "2026-09-17",
    "sourcePath": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "candidatePath": str(OUT.relative_to(ROOT)),
    "candidateSha256": sha256(raw_out),
    "candidateBytes": len(raw_out),
    "acceptedVisualBaseline": "R5.K2.G3.T1",
    "tilesShape": {
        "sourceRepo": "haihao0307/HOUSE",
        "sourceCommit": "397e94b85fa9c16a01afed319595e0022d12a74b",
        "method": "17-octave scalar field moves rock and soil render vertices and recomputes normals",
        "rockClampM": [-0.180, 0.160],
        "soilClampM": [-0.065, 0.060],
        "wholeObjectDomainWarp": False,
    },
    "brickV26Transfer": {
        "sourceRepo": "haihao0307/HOUSE",
        "sourceBranch": "codex/brick-mother-r3-13-shell-v275-v26-unified-20260917",
        "sourceCommit": "cfdda86c60076a0418fe1921eb3e8dff466ce266",
        "sourcePage": "brick-mother-standalone-v2.6.html",
        "sourceRenderer": "brick-mother-renderer-v2.js",
        "transferred": ["domain warp", "five-octave fBm", "five-octave ridged fBm", "four-octave turbulence", "broad value range", "rich mineral color masks"],
        "literalBrickPaletteCopied": False,
        "limestonePaletteMapping": True,
    },
    "preserved": ["G3 macro rock", "G3 caves and notches", "G3 camera", "G3 lighting", "G3 ground layout", "G3 controls", "G3 source generator"],
    "visualApproved": False,
    "productionReady": False,
}
BUILD.write_text(json.dumps(build, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(build, ensure_ascii=False))
