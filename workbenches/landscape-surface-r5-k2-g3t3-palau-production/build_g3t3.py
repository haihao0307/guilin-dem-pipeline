from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r3-tiles-v26/index.html"
OUT = ROOT / "workbenches/landscape-surface-r5-k2-g3t3-palau-production/index.html"
BUILD = ROOT / "workbenches/landscape-surface-r5-k2-g3t3-palau-production/build.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


raw = SRC.read_bytes()
source_sha = sha256(raw)
s = raw.decode("utf-8")
assert "R5.K2.G3.T2 Tiles + V2.6 Wave" in s
assert "Tiles Shape + Brick V2.6 Wave/Color · G3 Locked" in s
assert "vec3 lmV26Color" in s

# Keep the accepted G3.T2 rock/cave baseline. Add only production controls,
# independent colour warping, ten deterministic Palau-family recipes, and an
# explicit sky-open karst soil eligibility rule.
s = s.replace("R5.K2.G3.T2 Tiles + V2.6 Wave", "R5.K2.G3.T3 Palau Production", 1)
s = s.replace("水蚀岩壁 R5.K2.G3.T2", "帕劳卡斯特母体 R5.K2.G3.T3", 1)
s = s.replace("Tiles Shape + Brick V2.6 Wave/Color · G3 Locked", "10 Forms · Size Controls · Karst Soil Rule", 1)
s = s.replace(
    "<p><b>G3.T2：</b>保留 G3.T1 的 Tiles 真实顶点形变，只把 Brick Mother V2.6 的 domain warp、fBm、ridged、turbulence 与富色分区映射到石灰岩；不照搬砖红色，不更换大形。</p>",
    "<p><b>G3.T3：</b>在 G3.T2 冻结基线上增加十个帕劳风格配方、高度/宽度/整体大小、独立色彩 Warp，并把积土限制到向天开口的山顶、平台和裂隙承托区；深洞、洞顶和封闭凹腔不生成积土囊。</p><p><b>G3.T2：</b>保留 G3.T1 的 Tiles 真实顶点形变，只把 Brick Mother V2.6 的 domain warp、fBm、ridged、turbulence 与富色分区映射到石灰岩；不照搬砖红色，不更换大形。</p>",
    1,
)

s = s.replace(
    "</style>",
    ".palau-presets{display:grid!important;grid-template-columns:1fr 1fr;gap:5px!important}.palau-presets button{min-height:38px;padding:7px 6px;font-size:9px;line-height:1.25}.production-note{padding:9px 10px;border-radius:8px;background:#dfe8dc;font-size:10px;line-height:1.65;margin:8px 0 12px}</style>",
    1,
)

production_ui = '''<details open class="stage-controls"><summary><b>帕劳山体生产参数</b></summary><h4>十个同源异形配方</h4><div class="buttons palau-presets"><button data-palau="0" class="active">P01 高耸礁塔</button><button data-palau="1">P02 宽顶岛丘</button><button data-palau="2">P03 穿洞高峰</button><button data-palau="3">P04 双峰脊塔</button><button data-palau="4">P05 蘑菇基座</button><button data-palau="5">P06 细腰孤峰</button><button data-palau="6">P07 阶台岩岛</button><button data-palau="7">P08 偏心斜塔</button><button data-palau="8">P09 洞群厚峰</button><button data-palau="9">P10 复合群峰</button></div><div class="production-note">当前：<b id="palauName">P01 高耸礁塔</b><br>配方切换会重新生成主岩体；大小滑杆实时改变可见山体，不改相机。</div><div class="row"><label for="heightScale">山体高度</label><output id="heightScaleOut">1.00</output></div><input id="heightScale" type="range" min=".65" max="1.55" step=".01" value="1"><div class="row"><label for="widthScale">山体宽度</label><output id="widthScaleOut">1.00</output></div><input id="widthScale" type="range" min=".65" max="1.60" step=".01" value="1"><div class="row"><label for="overallScale">整体大小</label><output id="overallScaleOut">1.00</output></div><input id="overallScale" type="range" min=".60" max="1.60" step=".01" value="1"><h4>色彩去重复</h4><div class="row"><label for="colorWarp">色彩 Warp</label><output id="colorWarpOut">1.55</output></div><input id="colorWarp" type="range" min="0" max="3" step=".05" value="1.55"><div class="row"><label for="colorScale">色彩区域尺度</label><output id="colorScaleOut">1.00</output></div><input id="colorScale" type="range" min=".35" max="3" step=".05" value="1"><div class="row"><label for="colorBreakup">色彩连续破除</label><output id="colorBreakupOut">1.15</output></div><input id="colorBreakup" type="range" min="0" max="2" step=".05" value="1.15"><small>形体 Warp 与色彩 Warp 已分离；改变色彩不再重复同一套几何节律。</small></details>'''
anchor = "</details><h4>表面 / 实时调节</h4>"
assert anchor in s
s = s.replace(anchor, "</details>" + production_ui + "<h4>表面 / 实时调节</h4>", 1)

# Vertex controls: shape height/width/overall size affect the main rendered
# mountain vertices only. The microscope field and normals remain geometric.
old_vs_uniform = "uniform float uScope,uShellScale,uShellContrast,uShellCoverage,uShellDirection,uShellWarp,uShellBreakup,uGroundMicro;"
new_vs_uniform = "uniform float uScope,uShellScale,uShellContrast,uShellCoverage,uShellDirection,uShellWarp,uShellBreakup,uGroundMicro,uHeightScale,uWidthScale,uOverallScale,uPalauSeed;"
assert old_vs_uniform in s
s = s.replace(old_vs_uniform, new_vs_uniform, 1)

s = s.replace(
    "vec3 p0=lmDomain(rawQ);\n float broad=clamp(lmShapeBand(p0,83.,6.,.0012),-1.,1.);\n float middle=clamp(lmShapeBand(p0,83.,26.,.0012),-1.,1.);\n float pores=smoothstep(.56,.67,lmShapeBand(p0,83.,80.,.0012));",
    "vec3 p0=lmDomain(rawQ);\n float rockSeed=83.+mod(uPalauSeed,997.)*.017;\n float broad=clamp(lmShapeBand(p0,rockSeed,6.,.0012),-1.,1.);\n float middle=clamp(lmShapeBand(p0,rockSeed,26.,.0012),-1.,1.);\n float pores=smoothstep(.56,.67,lmShapeBand(p0,rockSeed,80.,.0012));",
    1,
)
s = s.replace(
    "vec3 p0=lmDomain(rawQ*.72+vec3(5.3,-2.1,8.7));\n vec3 v26p=p0*.095+lmV26Warp(p0*.052+vec3(-6.3,8.2,14.7))*(.42+.24*uShellWarp);\n float broad=clamp(lmShapeBand(p0,211.,5.,.0012),-1.,1.);\n float middle=clamp(lmShapeBand(p0,211.,19.,.0012),-1.,1.);\n float pores=smoothstep(.58,.70,lmShapeBand(p0,211.,58.,.0012));",
    "vec3 p0=lmDomain(rawQ*.72+vec3(5.3,-2.1,8.7));\n vec3 v26p=p0*.095+lmV26Warp(p0*.052+vec3(-6.3,8.2,14.7))*(.42+.24*uShellWarp);\n float soilSeed=211.+mod(uPalauSeed,991.)*.019;\n float broad=clamp(lmShapeBand(p0,soilSeed,5.,.0012),-1.,1.);\n float middle=clamp(lmShapeBand(p0,soilSeed,19.,.0012),-1.,1.);\n float pores=smoothstep(.58,.70,lmShapeBand(p0,soilSeed,58.,.0012));",
    1,
)

old_main_tail = """ if(shaped){
  local+=aN*shell;
  vec3 tangent=normalize(cross(abs(aN.z)<.9?vec3(0,0,1):vec3(1,0,0),aN));
  vec3 bitangent=normalize(cross(aN,tangent));float eps=aD.x<.5?.075:.11;
  float sx=lmShell(aRest+tangent*eps,aN,aD.x),sz=lmShell(aRest+bitangent*eps,aN,aD.x);
  vec3 tx=tangent*eps+aN*(sx-shell),tz=bitangent*eps+aN*(sz-shell);
  localN=normalize(cross(tx,tz));if(dot(localN,aN)<0.)localN=-localN;
 }
 p=local;n0=localN;q=aRest;d=aD;e=aE;gl_Position=uVP*vec4(p,1.);"""
new_main_tail = """ if(shaped){
  local+=aN*shell;
  vec3 tangent=normalize(cross(abs(aN.z)<.9?vec3(0,0,1):vec3(1,0,0),aN));
  vec3 bitangent=normalize(cross(aN,tangent));float eps=aD.x<.5?.075:.11;
  float sx=lmShell(aRest+tangent*eps,aN,aD.x),sz=lmShell(aRest+bitangent*eps,aN,aD.x);
  vec3 tx=tangent*eps+aN*(sx-shell),tz=bitangent*eps+aN*(sz-shell);
  localN=normalize(cross(tx,tz));if(dot(localN,aN)<0.)localN=-localN;
 }
 if(aD.x<.5){
  float ws=max(.12,uWidthScale*uOverallScale),hs=max(.12,uHeightScale*uOverallScale),baseY=-5.20;
  local=vec3(local.x*ws,baseY+(local.y-baseY)*hs,local.z*ws);
  localN=normalize(vec3(localN.x/ws,localN.y/hs,localN.z/ws));
 }
 p=local;n0=localN;q=aRest;d=aD;e=aE;gl_Position=uVP*vec4(p,1.);"""
assert old_main_tail in s
s = s.replace(old_main_tail, new_main_tail, 1)

# Independent colour domain warp. Geometry parameters no longer dictate the
# visible colour repetition scale.
old_fs_uniform = "uniform vec3 uEye;uniform float uExposure,uWet,uMicro,uScope,uShellScale,uShellContrast,uShellCoverage,uShellDirection,uShellWarp,uShellBreakup,uBreakContrast,uGroundMicro;uniform int uMode,uSection,uSelect;uniform float uStage;"
new_fs_uniform = "uniform vec3 uEye;uniform float uExposure,uWet,uMicro,uScope,uShellScale,uShellContrast,uShellCoverage,uShellDirection,uShellWarp,uShellBreakup,uBreakContrast,uGroundMicro,uColorWarp,uColorScale,uColorBreakup,uPalauSeed;uniform int uMode,uSection,uSelect;uniform float uStage;"
assert old_fs_uniform in s
s = s.replace(old_fs_uniform, new_fs_uniform, 1)

old_color_head = """ float richness=clamp((uBreakContrast-1.)/2.5,0.,1.);
 vec3 p0=rawQ*.055;
 vec3 warped=p0+lmV26ColorWarp(p0*.78+vec3(7.1,-3.8,11.4))*(.78+.44*uShellWarp);
 vec3 warped2=warped+lmV26ColorWarp(warped*1.67+vec3(-9.3,14.2,4.7))*(.22+.28*uShellBreakup);"""
new_color_head = """ float richness=clamp((uBreakContrast-1.)/2.5,0.,1.);
 float cscale=max(.18,uColorScale),seedPhase=fract(uPalauSeed*.0137);
 vec3 p0=rawQ*(.055*cscale)+vec3(seedPhase*7.1,-seedPhase*3.7,seedPhase*5.3);
 vec3 phaseWarp=lmV26ColorWarp(p0*.31+vec3(13.7,-8.2,5.1));
 p0+=phaseWarp*(.08+.30*uColorWarp);
 vec3 warped=p0+lmV26ColorWarp(p0*.78+vec3(7.1,-3.8,11.4))*(.18+.82*uColorWarp);
 vec3 warped2=warped+lmV26ColorWarp(warped*1.67+vec3(-9.3,14.2,4.7))*(.08+.42*uColorBreakup);
 float colourRegion=bmN(rawQ*.0093+vec3(19.1,-7.3,11.6)+seedPhase*4.0);
 warped2=mmRot(warped2,normalize(vec3(.47,.81,-.34)),(colourRegion-.5)*1.55*uColorBreakup);"""
assert old_color_head in s
s = s.replace(old_color_head, new_color_head, 1)

# Replace only the former loose rock-pocket sampler. Deep/closed cave regions
# cannot receive soil; sky-open summit, ledge and fissure traps can.
pocket_pattern = re.compile(r"const pocketLocations=\[\];\nif\(config\.stage===4\)\{.*?\n\}\nconst stoneRecords=", re.S)
pocket_block = r'''const pocketLocations=[],soilEcology={schema:'LANDSCAPE_KARST_SOIL_ELIGIBILITY_R1',candidateSamples:0,rejectedSteep:0,rejectedClosedSky:0,rejectedCaveInterior:0,rejectedLowEligibility:0,rejectedUnsupported:0,acceptedPockets:0,treeEligiblePockets:0,rules:['sky-open','upward-facing ledge','outside principal cave/notch volumes','supported by rock','summit/ledge/fissure accumulation']};
if(config.stage===4){let pp=[],ii=[],rr=[];for(let i=0;i<main.positions.length/3&&pocketLocations.length<30;i+=53){let k=i*3,x=main.positions[k],y=main.positions[k+1],z=main.positions[k+2];soilEcology.candidateSamples++;
let ny=main.N[k+1];if(ny<.72||y<5||y>49){soilEcology.rejectedSteep++;continue}
let skyOpen=0;for(const off of[[0,0],[.42,0],[-.42,0],[0,.42],[0,-.42]]){let open=true;for(let hh of[1.5,4,8,15,28])if(grid.at(x+off[0],y+hh,z+off[1])<-.04){open=false;break}if(open)skyOpen++}skyOpen/=5;
if(skyOpen<.80){soilEcology.rejectedClosedSky++;continue}
let caveQ=Math.hypot((x+6)/6.8,(y-5.4)/4.7,(z-8.8)/9),notchQ=Math.hypot((x-12)/10,(y-7)/3.7,(z-8)/8);if(caveQ<1.30||notchQ<1.28){soilEcology.rejectedCaveInterior++;continue}
if(pocketLocations.some(q=>Math.hypot(x-q.x,y-q.y,z-q.z)<4.3))continue;
let summit=W.smooth(8,44,y),ledge=W.smooth(.72,.97,ny),fissure=W.noise(x*.19+7.3,y*.11-2.8,z*.17+5.4,config.seed+1409),catchment=W.fbm(x*.055,y*.022,z*.055,config.seed+1423),eligibility=skyOpen*(.30+.31*summit+.22*ledge+.12*fissure+.15*catchment);
if(eligibility<.56){soilEcology.rejectedLowEligibility++;continue}
let rad=.58+W.noise(x,y,z,config.seed+112)*.92,h=.12+W.noise(x,y,z,config.seed+171)*.18,support=0;for(let j=0;j<10;j++){let a=j*Math.PI/5;if(grid.at(x+Math.cos(a)*rad*.78,y-.24,z+Math.sin(a)*rad*.62)<-.05)support++}
if(support<9||grid.at(x,y-.20,z)>-.05){soilEcology.rejectedUnsupported++;continue}
let field=(a,b,c)=>Math.max((Math.sqrt(((a-x)/rad)**2+((b-y-.08)/h)**2+((c-z)/(rad*.75))**2)-1)*h,-grid.at(a,b,c));let m=W.mesh(field,[x-rad-.3,y-h-.3,z-rad],[x+rad+.3,y+h+.4,z+rad],.22);if(!m.indices.length){soilEcology.rejectedUnsupported++;continue}
let first=pp.length/3;pp.push(...m.positions);rr.push(...m.positions);for(let v of m.indices)ii.push(v+first);let treeEligible=skyOpen>.95&&ny>.80&&y>9&&eligibility>.67;pocketLocations.push({x,y,z,radiusM:rad,thicknessM:h,skyOpen,eligibility,treeEligible})}
if(pp.length){let p={name:'向天开口的积土与植被资格囊',kind:3,event:0,pocket:true,positions:Float32Array.from(pp),rest:Float32Array.from(rr),indices:Uint32Array.from(ii)};p.N=W.normals(p.positions,p.indices);parts.push(p)}
}
soilEcology.acceptedPockets=pocketLocations.length;soilEcology.treeEligiblePockets=pocketLocations.filter(p=>p.treeEligible).length;
const stoneRecords='''
s, n = pocket_pattern.subn(pocket_block, s, count=1)
assert n == 1, "soil pocket block not found"

# Attach the ecological boundary to the generated report.
report_anchor = "report.numericalDust=numericalDust;report.supports=supports;"
assert report_anchor in s
s = s.replace(report_anchor, "report.soilEcology=soilEcology;report.vegetationEligibility=pocketLocations.filter(p=>p.treeEligible);" + report_anchor, 1)

# Application state, uniforms, export/import and the ten deterministic recipes.
old_state = "let state={theta:.50,phi:1.26,radius:116,target:[-3,20,0],mode:0,section:false,scope:2.15,shellScale:.74,shellContrast:2.20,shellCoverage:.94,shellDirection:18,shellWarp:1.90,shellBreakup:1.18,micro:1.80,breakContrast:2.30,wet:0,exposure:1.08,grass:true,selected:0}"
new_state = "let state={theta:.50,phi:1.26,radius:116,target:[-3,20,0],mode:0,section:false,scope:2.15,shellScale:.74,shellContrast:2.20,shellCoverage:.94,shellDirection:18,shellWarp:1.90,shellBreakup:1.18,micro:1.80,breakContrast:2.30,heightScale:1,widthScale:1,overallScale:1,colorWarp:1.55,colorScale:1,colorBreakup:1.15,palauPreset:0,wet:0,exposure:1.08,grass:true,selected:0}"
assert old_state in s
s = s.replace(old_state, new_state, 1)

old_seeds = "const SEEDS=[83,211,509,8231,9298,13007];"
new_seeds = """const PALAU_PRESETS=Object.freeze([
{name:'P01 高耸礁塔',seed:83,heightScale:1.30,widthScale:.82,overallScale:1,scope:2.20,shellScale:.72,shellContrast:2.25,shellCoverage:.94,shellDirection:18,shellWarp:1.95,shellBreakup:1.18,colorWarp:1.62,colorScale:.94,colorBreakup:1.18,breakContrast:2.34,geo:1.68,concavity:.87,soilMicro:.86},
{name:'P02 宽顶岛丘',seed:211,heightScale:.94,widthScale:1.30,overallScale:1,scope:1.92,shellScale:.88,shellContrast:1.92,shellCoverage:.91,shellDirection:-12,shellWarp:1.55,shellBreakup:.92,colorWarp:1.35,colorScale:1.22,colorBreakup:1.08,breakContrast:2.12,geo:1.52,concavity:.74,soilMicro:1.02},
{name:'P03 穿洞高峰',seed:509,heightScale:1.22,widthScale:1.02,overallScale:1,scope:2.38,shellScale:.68,shellContrast:2.40,shellCoverage:.96,shellDirection:27,shellWarp:2.08,shellBreakup:1.30,colorWarp:1.80,colorScale:.86,colorBreakup:1.34,breakContrast:2.48,geo:1.82,concavity:1.02,soilMicro:.72},
{name:'P04 双峰脊塔',seed:8231,heightScale:1.12,widthScale:1.18,overallScale:1,scope:2.12,shellScale:.76,shellContrast:2.18,shellCoverage:.95,shellDirection:43,shellWarp:1.92,shellBreakup:1.24,colorWarp:1.70,colorScale:1.08,colorBreakup:1.22,breakContrast:2.30,geo:1.72,concavity:.90,soilMicro:.92},
{name:'P05 蘑菇基座',seed:9298,heightScale:.91,widthScale:1.14,overallScale:1,scope:2.28,shellScale:.64,shellContrast:2.42,shellCoverage:.97,shellDirection:-31,shellWarp:2.18,shellBreakup:1.37,colorWarp:1.92,colorScale:.78,colorBreakup:1.42,breakContrast:2.52,geo:1.88,concavity:1.08,soilMicro:.66},
{name:'P06 细腰孤峰',seed:13007,heightScale:1.38,widthScale:.76,overallScale:1,scope:2.48,shellScale:.62,shellContrast:2.55,shellCoverage:.96,shellDirection:9,shellWarp:2.22,shellBreakup:1.35,colorWarp:1.88,colorScale:.82,colorBreakup:1.38,breakContrast:2.50,geo:1.90,concavity:1.06,soilMicro:.64},
{name:'P07 阶台岩岛',seed:17011,heightScale:.88,widthScale:1.36,overallScale:1,scope:1.86,shellScale:1.02,shellContrast:1.84,shellCoverage:.90,shellDirection:66,shellWarp:1.46,shellBreakup:.88,colorWarp:1.26,colorScale:1.38,colorBreakup:.96,breakContrast:2.02,geo:1.48,concavity:.68,soilMicro:1.12},
{name:'P08 偏心斜塔',seed:23117,heightScale:1.18,widthScale:.94,overallScale:1,scope:2.25,shellScale:.70,shellContrast:2.30,shellCoverage:.95,shellDirection:-58,shellWarp:2.05,shellBreakup:1.28,colorWarp:1.74,colorScale:.90,colorBreakup:1.30,breakContrast:2.38,geo:1.78,concavity:.94,soilMicro:.82},
{name:'P09 洞群厚峰',seed:31013,heightScale:1.05,widthScale:1.24,overallScale:1,scope:2.42,shellScale:.66,shellContrast:2.52,shellCoverage:.98,shellDirection:34,shellWarp:2.24,shellBreakup:1.43,colorWarp:2.02,colorScale:.76,colorBreakup:1.52,breakContrast:2.62,geo:1.94,concavity:1.12,soilMicro:.70},
{name:'P10 复合群峰',seed:47051,heightScale:1.15,widthScale:1.10,overallScale:1,scope:2.30,shellScale:.72,shellContrast:2.36,shellCoverage:.96,shellDirection:21,shellWarp:2.04,shellBreakup:1.32,colorWarp:1.86,colorScale:.92,colorBreakup:1.40,breakContrast:2.46,geo:1.84,concavity:.98,soilMicro:.88}
]);const SEEDS=PALAU_PRESETS.map(p=>p.seed);"""
assert old_seeds in s
s = s.replace(old_seeds, new_seeds, 1)

old_uniform_list = "['uVP','uEye','uExposure','uWet','uMicro','uScope','uShellScale','uShellContrast','uShellCoverage','uShellDirection','uShellWarp','uShellBreakup','uBreakContrast','uGroundMicro','uMode','uSection','uSelect','uStage']"
new_uniform_list = "['uVP','uEye','uExposure','uWet','uMicro','uScope','uShellScale','uShellContrast','uShellCoverage','uShellDirection','uShellWarp','uShellBreakup','uBreakContrast','uGroundMicro','uHeightScale','uWidthScale','uOverallScale','uColorWarp','uColorScale','uColorBreakup','uPalauSeed','uMode','uSection','uSelect','uStage']"
assert old_uniform_list in s
s = s.replace(old_uniform_list, new_uniform_list, 1)

old_draw = "gl.uniform1f(U.uBreakContrast,state.breakContrast);gl.uniform1f(U.uGroundMicro,recipe.soilMicro);gl.uniform1f(U.uStage,recipe.stage);"
new_draw = "gl.uniform1f(U.uBreakContrast,state.breakContrast);gl.uniform1f(U.uGroundMicro,recipe.soilMicro);gl.uniform1f(U.uHeightScale,state.heightScale);gl.uniform1f(U.uWidthScale,state.widthScale);gl.uniform1f(U.uOverallScale,state.overallScale);gl.uniform1f(U.uColorWarp,state.colorWarp);gl.uniform1f(U.uColorScale,state.colorScale);gl.uniform1f(U.uColorBreakup,state.colorBreakup);gl.uniform1f(U.uPalauSeed,recipe.seed);gl.uniform1f(U.uStage,recipe.stage);"
assert old_draw in s
s = s.replace(old_draw, new_draw, 1)

old_sync_loop = "for(let k of ['scope','shellScale','shellContrast','shellCoverage','shellWarp','shellBreakup','micro','breakContrast','wet','exposure']){$('#'+k).value=state[k];$('#'+k+'Out').textContent=state[k].toFixed(2)}"
new_sync_loop = "for(let k of ['scope','shellScale','shellContrast','shellCoverage','shellWarp','shellBreakup','micro','breakContrast','heightScale','widthScale','overallScale','colorWarp','colorScale','colorBreakup','wet','exposure']){$('#'+k).value=state[k];$('#'+k+'Out').textContent=state[k].toFixed(2)}$('#palauName').textContent=PALAU_PRESETS[state.palauPreset]?.name||'自定义';$$('[data-palau]').forEach((e,i)=>e.classList.toggle('active',i===state.palauPreset));"
assert old_sync_loop in s
s = s.replace(old_sync_loop, new_sync_loop, 1)

old_restore_keys = "'breakContrast,exposure,grass,micro,mode,phi,radius,scope,section,selected,shellBreakup,shellContrast,shellCoverage,shellDirection,shellScale,shellWarp,target,theta,wet'"
new_restore_keys = "'breakContrast,colorBreakup,colorScale,colorWarp,exposure,grass,heightScale,micro,mode,overallScale,palauPreset,phi,radius,scope,section,selected,shellBreakup,shellContrast,shellCoverage,shellDirection,shellScale,shellWarp,target,theta,wet,widthScale'"
assert old_restore_keys in s
s = s.replace(old_restore_keys, new_restore_keys, 1)

old_restore_loop = "for(let k of ['theta','phi','radius','scope','shellScale','shellContrast','shellCoverage','shellDirection','shellWarp','shellBreakup','micro','breakContrast','wet','exposure'])if(!Number.isFinite(v[k]))throw Error('显示参数无效');"
new_restore_loop = "for(let k of ['theta','phi','radius','scope','shellScale','shellContrast','shellCoverage','shellDirection','shellWarp','shellBreakup','micro','breakContrast','heightScale','widthScale','overallScale','colorWarp','colorScale','colorBreakup','wet','exposure'])if(!Number.isFinite(v[k]))throw Error('显示参数无效');if(!Number.isInteger(v.palauPreset)||v.palauPreset<0||v.palauPreset>9)throw Error('帕劳配方编号无效');"
assert old_restore_loop in s
s = s.replace(old_restore_loop, new_restore_loop, 1)

old_bounds = "v.breakContrast<1||v.breakContrast>3.5||v.wet<0"
new_bounds = "v.breakContrast<1||v.breakContrast>3.5||v.heightScale<.65||v.heightScale>1.55||v.widthScale<.65||v.widthScale>1.60||v.overallScale<.60||v.overallScale>1.60||v.colorWarp<0||v.colorWarp>3||v.colorScale<.35||v.colorScale>3||v.colorBreakup<0||v.colorBreakup>2||v.wet<0"
assert old_bounds in s
s = s.replace(old_bounds, new_bounds, 1)

old_control_loop = "for(let k of ['scope','shellScale','shellContrast','shellCoverage','shellWarp','shellBreakup','micro','breakContrast','wet','exposure'])$('#'+k).oninput=e=>{state[k]=+e.target.value;$('#'+k+'Out').textContent=state[k].toFixed(2);dirty=true};"
new_control_loop = "for(let k of ['scope','shellScale','shellContrast','shellCoverage','shellWarp','shellBreakup','micro','breakContrast','heightScale','widthScale','overallScale','colorWarp','colorScale','colorBreakup','wet','exposure'])$('#'+k).oninput=e=>{state[k]=+e.target.value;state.palauPreset=-1;$('#'+k+'Out').textContent=state[k].toFixed(2);$('#palauName').textContent='自定义';$$('[data-palau]').forEach(x=>x.classList.remove('active'));dirty=true};"
assert old_control_loop in s
s = s.replace(old_control_loop, new_control_loop, 1)

# palauPreset=-1 is valid while the user edits sliders, so restore permits it.
s = s.replace("v.palauPreset<0||v.palauPreset>9", "v.palauPreset<-1||v.palauPreset>9", 1)

old_nextseed = "$('#nextseed').onclick=async()=>{if(busy)return;let index=SEEDS.indexOf(recipe.seed),seed=SEEDS[(index+1)%SEEDS.length];goView('hero');try{await build({...recipe,seed});toast('已生成种子 '+seed)}catch(e){fail(e)}};"
new_nextseed = "$('#nextseed').onclick=async()=>{if(busy)return;let index=PALAU_PRESETS.findIndex(p=>p.seed===recipe.seed),next=(index+1)%PALAU_PRESETS.length;try{await applyPalauPreset(next)}catch(e){fail(e)}};"
assert old_nextseed in s
s = s.replace(old_nextseed, new_nextseed, 1)

apply_fn_anchor = "function controls(){"
assert apply_fn_anchor in s
apply_fn = """async function applyPalauPreset(index){
 index=Math.max(0,Math.min(9,index|0));const p=PALAU_PRESETS[index];state.palauPreset=index;Object.assign(state,{heightScale:p.heightScale,widthScale:p.widthScale,overallScale:p.overallScale,scope:p.scope,shellScale:p.shellScale,shellContrast:p.shellContrast,shellCoverage:p.shellCoverage,shellDirection:p.shellDirection,shellWarp:p.shellWarp,shellBreakup:p.shellBreakup,colorWarp:p.colorWarp,colorScale:p.colorScale,colorBreakup:p.colorBreakup,breakContrast:p.breakContrast});sync();goView('hero');await build({...recipe,seed:p.seed,geo:p.geo,concavity:p.concavity,soilMicro:p.soilMicro});sync();toast('已生成 '+p.name);return report}
"""
s = s.replace(apply_fn_anchor, apply_fn + apply_fn_anchor, 1)

# Bind the ten buttons immediately after surface preset binding.
preset_bind_anchor = "$$('[data-surface]').forEach(b=>b.onclick=()=>{Object.assign(state,surfacePresets[b.dataset.surface]);$$('[data-surface]').forEach(x=>x.classList.toggle('active',x===b));sync()});"
assert preset_bind_anchor in s
s = s.replace(preset_bind_anchor, preset_bind_anchor + "$$('[data-palau]').forEach(b=>b.onclick=()=>{if(busy)return;applyPalauPreset(+b.dataset.palau).catch(fail)});", 1)

old_reset = "$('#reset').onclick=()=>{state={...state,scope:2.15,shellScale:.74,shellContrast:2.20,shellCoverage:.94,shellDirection:18,shellWarp:1.90,shellBreakup:1.18,micro:1.80,breakContrast:2.30,wet:0,exposure:1.08,mode:0,section:false,grass:true,selected:0};goView('hero');sync()};"
new_reset = "$('#reset').onclick=()=>{if(busy)return;state={...state,micro:1.80,wet:0,exposure:1.08,mode:0,section:false,grass:true,selected:0};applyPalauPreset(0).catch(fail)};"
assert old_reset in s
s = s.replace(old_reset, new_reset, 1)

old_setmaterial = "for(let k of ['scope','shellScale','shellContrast','shellCoverage','shellDirection','micro','breakContrast','wet','exposure'])if(k in o)state[k]=o[k];"
new_setmaterial = "for(let k of ['scope','shellScale','shellContrast','shellCoverage','shellDirection','shellWarp','shellBreakup','micro','breakContrast','heightScale','widthScale','overallScale','colorWarp','colorScale','colorBreakup','wet','exposure'])if(k in o)state[k]=o[k];"
assert old_setmaterial in s
s = s.replace(old_setmaterial, new_setmaterial, 1)

s = s.replace("release:'limestone-water-surface-r5-g3t2-v26-wave'", "release:'palau-karst-production-g3t3-ten-forms'", 1)

# Static build evidence.
presets = [
    {"id": "P01", "name": "高耸礁塔", "seed": 83},
    {"id": "P02", "name": "宽顶岛丘", "seed": 211},
    {"id": "P03", "name": "穿洞高峰", "seed": 509},
    {"id": "P04", "name": "双峰脊塔", "seed": 8231},
    {"id": "P05", "name": "蘑菇基座", "seed": 9298},
    {"id": "P06", "name": "细腰孤峰", "seed": 13007},
    {"id": "P07", "name": "阶台岩岛", "seed": 17011},
    {"id": "P08", "name": "偏心斜塔", "seed": 23117},
    {"id": "P09", "name": "洞群厚峰", "seed": 31013},
    {"id": "P10", "name": "复合群峰", "seed": 47051},
]
raw_out = s.encode("utf-8")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(raw_out)

build = {
    "schema": "LANDSCAPE_R5_K2_G3T3_PALAU_PRODUCTION_V1",
    "date": "2026-09-18",
    "sourcePath": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "candidatePath": str(OUT.relative_to(ROOT)),
    "candidateSha256": sha256(raw_out),
    "candidateBytes": len(raw_out),
    "acceptedVisualBaseline": "R5.K2.G3.T2",
    "productionControls": {
        "heightScale": [0.65, 1.55],
        "widthScale": [0.65, 1.60],
        "overallScale": [0.60, 1.60],
        "colorWarp": [0.0, 3.0],
        "colorScale": [0.35, 3.0],
        "colorBreakup": [0.0, 2.0],
    },
    "palauPresets": presets,
    "shapeMethod": "Tiles/V2.6 vertex displacement plus independent anisotropic mountain scale",
    "colourMethod": "independent V2.6 colour domain warp; not tied to geometry warp",
    "karstSoilRule": {
        "skyOpenRequired": True,
        "principalCaveVolumesExcluded": True,
        "upwardLedgeRequired": True,
        "rockSupportRequired": True,
        "treeEligibilityRecorded": True,
        "evidence": [
            "NPS Karst Landscapes: surface water enters cracks, fractures and dissolved openings",
            "Jones 2013 Physical Structure of the Epikarst: soil and organics accumulate at near-surface soil/rock contact and within fractures",
            "Su et al. 2017 Scientific Reports: surface-connected tiankeng habitats can support forest communities",
        ],
    },
    "preserved": [
        "G3.T2 macro rock and cave baseline",
        "G3.T2 V2.6 wave and limestone colour mapping",
        "camera and lighting",
        "fixed geometry resolution",
        "no external mesh or texture",
    ],
    "actualTreeGeometry": False,
    "visualApproved": False,
    "productionReady": False,
}
BUILD.write_text(json.dumps(build, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(build, ensure_ascii=False))
