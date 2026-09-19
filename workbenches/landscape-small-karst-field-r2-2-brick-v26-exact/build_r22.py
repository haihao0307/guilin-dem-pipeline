from pathlib import Path
import hashlib
import json
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
R21 = ROOT / "workbenches/landscape-small-karst-field-r2-1-brick-v26/index.html"
OUT_DIR = ROOT / "workbenches/landscape-small-karst-field-r2-2-brick-v26-exact"
OUT = OUT_DIR / "index.html"
BUILD = OUT_DIR / "build.json"

BRICK_HTML_URL = "https://raw.githubusercontent.com/haihao0307/HOUSE/ea08bb33768f88f10ad9622075ddaa34cb8019c3/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/brick-mother-standalone-v2.6.html"
BRICK_DATA_URL = "https://raw.githubusercontent.com/haihao0307/HOUSE/ea08bb33768f88f10ad9622075ddaa34cb8019c3/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/data/brick-material-profiles-v2.json"


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Landscape-Mother-R2.2"})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read().decode("utf-8")


def extract_template(source: str, name: str) -> str:
    match = re.search(rf"const {re.escape(name)}\s*=\s*`(.*?)`;", source, re.S)
    if not match:
        raise RuntimeError(f"template {name} not found")
    return match.group(1)


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


r21 = R21.read_text(encoding="utf-8")
brick = fetch_text(BRICK_HTML_URL)
brick_data = json.loads(fetch_text(BRICK_DATA_URL))
stone = next(item for item in brick_data["profiles"] if item["id"] == "stone-block")

vs = extract_template(r21, "VS")
geometry_fs = extract_template(r21, "GEOMETRY_FS")

gaea_match = re.search(
    r"const glsl\s*=\s*String\.raw`(.*?)`;\s*window\.BrickMotherGaeaV1",
    brick,
    re.S,
)
if not gaea_match:
    raise RuntimeError("Brick Mother V2.6 Gaea GLSL block not found")
gaea_glsl = gaea_match.group(1)

fragment_match = re.search(
    r"const fragmentShader\s*=\s*`(.*?)`;\s*class BrickRenderer",
    brick,
    re.S,
)
if not fragment_match:
    raise RuntimeError("Brick Mother V2.6 fragment shader not found")
material_fs = fragment_match.group(1).replace("${gaeaGLSL}", gaea_glsl)

declaration_pattern = re.compile(
    r"in vec3 vWorldPos;\s*"
    r"in vec3 vLocalPos;\s*"
    r"in vec3 vNormal;\s*"
    r"out vec4 outColor;",
    re.S,
)
replacement_declarations = """in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPositionTex;
uniform sampler2D uNormalTex;
uniform float uKarstOverall;
uniform float uKarstHeight;
uniform float uKarstWidth;
vec3 vWorldPos;
vec3 vLocalPos;
vec3 vNormal;"""
material_fs, changed = declaration_pattern.subn(replacement_declarations, material_fs, count=1)
if changed != 1:
    raise RuntimeError("Brick Mother V2.6 varying declaration block not replaced")

material_fs = material_fs.replace("if (uGround == 1) {", "if (gp.w > 1.5) {", 1)

main_injection = """void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  vec4 gp = texelFetch(uPositionTex, pixel, 0);
  vec4 gn = texelFetch(uNormalTex, pixel, 0);
  if (gp.w < 0.5) {
    vec3 rd = normalize(gn.xyz);
    vec3 sky = mix(vec3(0.035, 0.040, 0.043), vec3(0.105, 0.116, 0.118), clamp(rd.y * 0.5 + 0.5, 0.0, 1.0));
    outColor = vec4(linearToSrgb(sky), 1.0);
    return;
  }
  vWorldPos = gp.xyz;
  vec3 karstLocal = vec3(
    gp.x / max(uKarstOverall * uKarstWidth * 3.20, 0.001),
    gp.y / max(uKarstOverall * uKarstHeight * 8.00, 0.001),
    gp.z / max(uKarstOverall * uKarstWidth * 3.20, 0.001)
  );
  vLocalPos = karstLocal * (uDimensions * 0.5);
  vNormal = normalize(gn.xyz);"""
material_fs = material_fs.replace("void main() {", main_injection, 1)

material_fs = material_fs.replace(
    "float mediumRing = smoothstep(mediumRadius * 0.76, mediumRadius, mediumCell.x) *\n"
    "                     (1.0 - smoothstep(mediumRadius, mediumRadius + 0.095, mediumCell.x));",
    "float mediumRing = smoothstep(mediumRadius * 0.76, mediumRadius, mediumCell.x) *\n"
    "                     (1.0 - smoothstep(mediumRadius, mediumRadius + 0.095, mediumCell.x)) *\n"
    "                     mediumGate;",
)
material_fs = material_fs.replace(
    "float largeRing = smoothstep(largeRadius * 0.70, largeRadius, largeCell.x) *\n"
    "                    (1.0 - smoothstep(largeRadius, largeRadius + 0.13, largeCell.x));",
    "float largeRing = smoothstep(largeRadius * 0.70, largeRadius, largeCell.x) *\n"
    "                    (1.0 - smoothstep(largeRadius, largeRadius + 0.13, largeCell.x)) *\n"
    "                    largeGate;",
)

ratio = stone["runtimeDNA"]["shapeRatio"]
longest = max(ratio)
dimension_scale = 3.4 / longest
dimensions = [round(value * dimension_scale, 9) for value in ratio]
runtime = stone["runtimeDNA"]
noise = stone["noiseDNA"]
palette = stone["paletteDNA"]
controls = stone["compositeDefaults"]
gaea = stone["gaeaDNA"]
base_seed = int(runtime["seedBase"])
offsets = stone["seedLayerOffsets"]
seeds = {key: base_seed + int(value) for key, value in offsets.items()}

material_config = {
    "low": runtime["colorLowSRGB"],
    "mean": runtime["colorMeanSRGB"],
    "high": runtime["colorHighSRGB"],
    "paletteDark": palette["darkSRGB"],
    "paletteWarm": palette["warmSRGB"],
    "paletteOxide": palette["oxideSRGB"],
    "paletteMineral": palette["mineralSRGB"],
    "paletteBio": palette["bioSRGB"],
    "paletteWet": palette["wetSRGB"],
    "paletteStraw": palette["strawSRGB"],
    "paletteHusk": palette["huskSRGB"],
    "paletteSeed": palette["seedSRGB"],
    "roughness": runtime["roughnessRange"],
    "dimensions": dimensions,
    "warpStrength": noise["warpStrength"],
    "macroScale": noise["macroScale"],
    "ridgedScale": noise["ridgedScale"],
    "cellScale": noise["cellScale"],
    "poreThreshold": noise["poreThreshold"],
    "poreSharpness": noise["poreSharpness"],
    "microScale": noise["microScale"],
    "colorContrast": noise["colorContrast"],
    "cavityStrength": noise["cavityStrength"],
    "bumpStrength": noise["bumpStrength"],
    "roughnessCorrelation": noise["roughnessCorrelation"],
    "mineralScale": noise["mineralScale"],
    "firingBand": runtime["firingBand"],
    "colorRichness": controls["colorRichness"],
    "waterStrength": controls["waterStain"],
    "weatherStrength": controls["weathering"],
    "inclusionStrength": controls["inclusion"],
    "poreDepth": controls["poreDepth"],
    "poreDensity": controls["poreDensity"],
    "poreVariety": controls["poreVariety"],
    "colorSeed": seeds["color"],
    "poreSeed": seeds["pore"],
    "waterSeed": seeds["water"],
    "weatherSeed": seeds["weather"],
    "inclusionSeed": seeds["inclusion"],
    "detailSeed": seeds["detail"],
    "gaeaRockDetail": controls["rockDetail"],
    "gaeaStrata": controls["strata"],
    "gaeaMicroErosion": controls["microErosion"],
    "gaeaColorClarity": controls["colorClarity"],
    "gaeaColorGamut": controls["colorGamut"],
    "gaeaMaskSharpness": controls["maskSharpness"],
    "gaeaRuggedScale": gaea["ruggedScale"],
    "gaeaStrataFrequency": gaea["strataFrequency"],
    "gaeaSurfaceScale": gaea["surfaceScale"],
    "family": 2,
}

html = """<!doctype html>
<html lang="zh-CN" data-transfer="STRICT_BRICK_V26_STONE_BLOCK_EXACT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Landscape Mother · 小尺度帕劳卡斯特 R2.2</title>
<style>
:root{color-scheme:dark;--panel:rgba(13,16,15,.92);--line:rgba(255,255,255,.13);--text:#eee9df;--muted:#a7aaa5;--accent:#d0a365}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#0d1110;color:var(--text);font:12px/1.45 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
canvas{display:block;width:100%;height:100%;touch-action:none}
.brand,.tools,.panel,.badge{position:fixed;z-index:4;border:1px solid var(--line);background:var(--panel);box-shadow:0 14px 42px rgba(0,0,0,.34);backdrop-filter:blur(12px)}
.brand{left:14px;top:14px;padding:11px 13px;border-radius:12px}.brand small{display:block;color:var(--accent);font-size:8px;letter-spacing:.13em;font-weight:800}.brand b{display:block;margin-top:3px;font-size:17px}.brand span{display:block;margin-top:3px;color:var(--muted);font-size:9px}
.tools{right:14px;top:14px;display:flex;gap:5px;padding:5px;border-radius:11px}button{border:0;border-radius:8px;padding:8px 11px;background:transparent;color:inherit;cursor:pointer}button:hover,button.on{background:#3d3528;color:#ffe4b8}
.panel{right:14px;top:72px;width:286px;max-height:calc(100vh - 104px);overflow:auto;padding:15px 17px;border-radius:13px}.panel.hide{display:none}
.group+ .group{margin-top:15px;padding-top:13px;border-top:1px solid var(--line)}h3{margin:0 0 8px;color:var(--accent);font-size:10px;letter-spacing:.08em}
.row{display:flex;align-items:center;justify-content:space-between;margin-top:10px}.row output{color:#d8aa6f;font-variant-numeric:tabular-nums}input[type=range]{width:100%;accent-color:#bd8c52;margin:5px 0 0}
.note{margin:8px 0 0;color:var(--muted);font-size:9px}.badge{left:14px;bottom:14px;padding:8px 10px;border-radius:9px;color:var(--muted);font-size:9px}
.error{display:none;position:fixed;z-index:8;left:50%;top:50%;transform:translate(-50%,-50%);max-width:min(760px,86vw);padding:15px 17px;border-radius:11px;background:#3c1612;color:#ffd9cf;white-space:pre-wrap}
@media(max-width:720px){.brand{left:8px;top:8px}.tools{right:8px;top:8px}.panel{left:8px;right:8px;top:88px;width:auto;max-height:48vh}.badge{left:8px;bottom:8px}}
</style>
</head>
<body>
<canvas id="view"></canvas>
<div class="brand"><small>LANDSCAPE MOTHER · EXACT TRANSFER</small><b>小尺度帕劳卡斯特 R2.2</b><span>形体沿用 R2.1 · 材质原样执行 Brick Mother V2.6 stone-block</span></div>
<div class="tools"><button id="reset">复位</button><button id="panelBtn">调节</button><button id="gray">灰模</button></div>
<aside class="panel" id="panel">
  <section class="group"><h3>形体比例</h3>
    <div class="row"><label>整体大小</label><output id="overallOut"></output></div><input id="overall" type="range" min=".55" max="2.20" step=".01" value="1">
    <div class="row"><label>高度</label><output id="heightOut"></output></div><input id="height" type="range" min=".60" max="1.70" step=".01" value="1">
    <div class="row"><label>宽度</label><output id="widthOut"></output></div><input id="width" type="range" min=".60" max="1.80" step=".01" value="1">
  </section>
  <section class="group"><h3>孔洞</h3>
    <div class="row"><label>孔洞大小</label><output id="holeSizeOut"></output></div><input id="holeSize" type="range" min=".35" max="1.85" step=".01" value="1">
    <div class="row"><label>孔洞深度</label><output id="cavityOut"></output></div><input id="cavity" type="range" min="0" max="2.2" step=".01" value="1.10">
  </section>
  <section class="group"><h3>仅形体细节</h3>
    <div class="row"><label>大变形</label><output id="macroOut"></output></div><input id="macro" type="range" min="0" max="2.5" step=".01" value="1.05">
    <div class="row"><label>域 Warp</label><output id="warpOut"></output></div><input id="warp" type="range" min="0" max="3" step=".01" value="1.20">
    <div class="row"><label>细节强度</label><output id="detailOut"></output></div><input id="detail" type="range" min="0" max="2.4" step=".01" value="1">
    <div class="row"><label>细节尺度</label><output id="detailScaleOut"></output></div><input id="detailScale" type="range" min=".35" max="2.6" step=".01" value="1">
    <p class="note">颜色、花纹、粗糙度、微法线、照明和所有材料种子均锁定为历史 V2.6，不加入 Landscape 自定义混合。</p>
  </section>
</aside>
<div class="badge">默认约 16 m 高 / 12 m 宽 · 材质严格锁定 · 顶部土壤关闭</div>
<div class="error" id="error"></div>
<script>
(()=>{"use strict";
const canvas=document.getElementById("view");
const gl=canvas.getContext("webgl2",{antialias:false,alpha:false,preserveDrawingBuffer:true,powerPreference:"high-performance"});
if(!gl){const e=document.getElementById("error");e.style.display="block";e.textContent="需要 WebGL2";return}
const VS=`__VS__`;
const GEOMETRY_FS=`__GEOMETRY_FS__`;
const MATERIAL_FS=`__MATERIAL_FS__`;
const MATERIAL=__MATERIAL_JSON__;

function shader(type,src,label){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(label+" shader compile:\n"+(gl.getShaderInfoLog(s)||"(empty)"));return s}
function program(vs,fs,label){const p=gl.createProgram(),v=shader(gl.VERTEX_SHADER,vs,label+" vertex"),f=shader(gl.FRAGMENT_SHADER,fs,label+" fragment");gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);const ok=gl.getProgramParameter(p,gl.LINK_STATUS),log=gl.getProgramInfoLog(p)||"";gl.deleteShader(v);gl.deleteShader(f);if(!ok)throw Error(label+" program link:\n"+(log||"(empty)"));return p}
function locs(p,names){const o={};for(const n of names)o[n]=gl.getUniformLocation(p,n);return o}
let geometryProgram,materialProgram,UG,UM,vao,framebuffer,positionTex,normalTex,targetW=0,targetH=0;
try{
 if(!gl.getExtension("EXT_color_buffer_float"))throw Error("浏览器缺少 EXT_color_buffer_float");
 geometryProgram=program(VS,GEOMETRY_FS,"geometry");
 materialProgram=program(VS,MATERIAL_FS,"Brick Mother V2.6 exact");
 UG=locs(geometryProgram,["uRes","uCam","uBasis","uOverall","uHeight","uWidth","uHoleSize","uCavity","uMacro","uWarp","uDetail","uDetailScale","uSoil"]);
 UM=locs(materialProgram,["uRes","uPositionTex","uNormalTex","uCamera","uKarstOverall","uKarstHeight","uKarstWidth","uLowColor","uMeanColor","uHighColor","uPaletteDark","uPaletteWarm","uPaletteOxide","uPaletteMineral","uPaletteBio","uPaletteWet","uPaletteStraw","uPaletteHusk","uPaletteSeedColor","uRoughness","uDimensions","uWarpStrength","uMacroScale","uRidgedScale","uCellScale","uPoreThreshold","uPoreSharpness","uMicroScale","uColorContrast","uCavityStrength","uBumpStrength","uRoughnessCorrelation","uMineralScale","uFiringBand","uColorRichness","uWaterStrength","uWeatherStrength","uInclusionStrength","uPoreDepth","uPoreDensity","uPoreVariety","uColorSeed","uPoreSeed","uWaterSeed","uWeatherSeed","uInclusionSeed","uDetailSeed","uGaeaRockDetail","uGaeaStrata","uGaeaMicroErosion","uGaeaColorClarity","uGaeaColorGamut","uGaeaMaskSharpness","uGaeaRuggedScale","uGaeaStrataFrequency","uGaeaSurfaceScale","uFamily","uDebugMode","uGround","uShadowPos0","uShadowPos1","uShadowPos2","uShadowSize0","uShadowSize1","uShadowSize2"]);
 vao=gl.createVertexArray();framebuffer=gl.createFramebuffer();positionTex=gl.createTexture();normalTex=gl.createTexture();
}catch(err){const e=document.getElementById("error");e.style.display="block";e.textContent=err.stack||err;document.documentElement.dataset.karstFailure="true";return}

function tex(t,w,h){gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null)}
function targets(w,h){if(w===targetW&&h===targetH)return;targetW=w;targetH=h;tex(positionTex,w,h);tex(normalTex,w,h);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,positionTex,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,normalTex,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);const s=gl.checkFramebufferStatus(gl.FRAMEBUFFER);gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(s!==gl.FRAMEBUFFER_COMPLETE)throw Error("framebuffer incomplete 0x"+s.toString(16))}
const state={overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]};
const ids=["overall","height","width","holeSize","cavity","macro","warp","detail","detailScale"];
const scaled=new Set(["overall","height","width","holeSize","detailScale"]);
function sync(){for(const k of ids){const e=document.getElementById(k),o=document.getElementById(k+"Out");e.value=state[k];o.textContent=Number(state[k]).toFixed(2)+(scaled.has(k)?"×":"")}}
ids.forEach(k=>document.getElementById(k).oninput=e=>{state[k]=+e.target.value;document.getElementById(k+"Out").textContent=state[k].toFixed(2)+(scaled.has(k)?"×":"");dirty=true});
document.getElementById("reset").onclick=()=>{Object.assign(state,{overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]});document.getElementById("gray").classList.remove("on");sync();dirty=true};
document.getElementById("panelBtn").onclick=()=>document.getElementById("panel").classList.toggle("hide");
document.getElementById("gray").onclick=e=>{state.gray=1-state.gray;e.currentTarget.classList.toggle("on",!!state.gray);dirty=true};
let dirty=true,drag=false,lx=0,ly=0;
canvas.onpointerdown=e=>{drag=true;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{if(!drag)return;state.theta-=(e.clientX-lx)*.005;state.phi=Math.max(.22,Math.min(2.9,state.phi-(e.clientY-ly)*.004));lx=e.clientX;ly=e.clientY;dirty=true};
canvas.onpointerup=()=>drag=false;canvas.onpointercancel=()=>drag=false;
canvas.onwheel=e=>{e.preventDefault();state.radius=Math.max(11,Math.min(62,state.radius*Math.exp(e.deltaY*.0012)));dirty=true};
function resize(){const dpr=Math.min(devicePixelRatio||1,1.25),w=Math.max(1,Math.floor(innerWidth*dpr)),h=Math.max(1,Math.floor(innerHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;targets(w,h);dirty=true}}
addEventListener("resize",()=>{try{resize()}catch(err){const e=document.getElementById("error");e.style.display="block";e.textContent=err.stack||err;document.documentElement.dataset.karstFailure="true"}});
function norm(v){const l=Math.hypot(...v)||1;return v.map(x=>x/l)}function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function set1(loc,v){if(loc!==null)gl.uniform1f(loc,v)}function set1i(loc,v){if(loc!==null)gl.uniform1i(loc,v)}function set2(loc,v){if(loc!==null)gl.uniform2fv(loc,v)}function set3(loc,v){if(loc!==null)gl.uniform3fv(loc,v)}
function materialUniforms(eye){
 set3(UM.uCamera,eye);set1(UM.uKarstOverall,state.overall);set1(UM.uKarstHeight,state.height);set1(UM.uKarstWidth,state.width);
 set3(UM.uLowColor,MATERIAL.low);set3(UM.uMeanColor,MATERIAL.mean);set3(UM.uHighColor,MATERIAL.high);
 set3(UM.uPaletteDark,MATERIAL.paletteDark);set3(UM.uPaletteWarm,MATERIAL.paletteWarm);set3(UM.uPaletteOxide,MATERIAL.paletteOxide);set3(UM.uPaletteMineral,MATERIAL.paletteMineral);set3(UM.uPaletteBio,MATERIAL.paletteBio);set3(UM.uPaletteWet,MATERIAL.paletteWet);set3(UM.uPaletteStraw,MATERIAL.paletteStraw);set3(UM.uPaletteHusk,MATERIAL.paletteHusk);set3(UM.uPaletteSeedColor,MATERIAL.paletteSeed);
 set2(UM.uRoughness,MATERIAL.roughness);set3(UM.uDimensions,MATERIAL.dimensions);
 for(const k of ["warpStrength","macroScale","ridgedScale","cellScale","poreThreshold","poreSharpness","microScale","colorContrast","cavityStrength","bumpStrength","roughnessCorrelation","mineralScale","firingBand","colorRichness","waterStrength","weatherStrength","inclusionStrength","poreDepth","poreDensity","poreVariety","colorSeed","poreSeed","waterSeed","weatherSeed","inclusionSeed","detailSeed","gaeaRockDetail","gaeaStrata","gaeaMicroErosion","gaeaColorClarity","gaeaColorGamut","gaeaMaskSharpness","gaeaRuggedScale","gaeaStrataFrequency","gaeaSurfaceScale"]){const u="u"+k[0].toUpperCase()+k.slice(1);set1(UM[u],MATERIAL[k])}
 set1i(UM.uFamily,2);set1i(UM.uDebugMode,state.gray?4:0);set1i(UM.uGround,0);
 set3(UM.uShadowPos0,[0,-7.85,0]);set3(UM.uShadowPos1,[1000,0,1000]);set3(UM.uShadowPos2,[-1000,0,-1000]);set2(UM.uShadowSize0,[6.5,6.5]);set2(UM.uShadowSize1,[1,1]);set2(UM.uShadowSize2,[1,1]);
}
function drawGeometry(eye,basis){gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(geometryProgram);gl.bindVertexArray(vao);gl.uniform2f(UG.uRes,canvas.width,canvas.height);gl.uniform3fv(UG.uCam,eye);gl.uniformMatrix3fv(UG.uBasis,false,basis);for(const k of ids){const u=UG["u"+k[0].toUpperCase()+k.slice(1)];if(u!==null&&u!==undefined)gl.uniform1f(u,state[k])}if(UG.uSoil!==null)gl.uniform1f(UG.uSoil,0);gl.drawArrays(gl.TRIANGLES,0,3)}
function drawMaterial(eye){gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(materialProgram);gl.bindVertexArray(vao);gl.uniform2f(UM.uRes,canvas.width,canvas.height);materialUniforms(eye);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,positionTex);gl.uniform1i(UM.uPositionTex,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,normalTex);gl.uniform1i(UM.uNormalTex,1);gl.drawArrays(gl.TRIANGLES,0,3)}
let first=true;
function frame(){requestAnimationFrame(frame);try{resize();if(!dirty)return;dirty=false;const cp=Math.cos(state.phi),sp=Math.sin(state.phi),ct=Math.cos(state.theta),st=Math.sin(state.theta),eye=[state.target[0]+state.radius*sp*st,state.target[1]+state.radius*cp,state.target[2]+state.radius*sp*ct],f=norm([state.target[0]-eye[0],state.target[1]-eye[1],state.target[2]-eye[2]]),r=norm(cross(f,[0,1,0])),u=cross(r,f),basis=new Float32Array([r[0],r[1],r[2],u[0],u[1],u[2],f[0],f[1],f[2]]);drawGeometry(eye,basis);drawMaterial(eye);if(first){first=false;window.__KARST_READY__=true;document.documentElement.dataset.karstReady="true"}}catch(err){const e=document.getElementById("error");e.style.display="block";e.textContent=err.stack||err;document.documentElement.dataset.karstFailure="true";dirty=false}}
sync();resize();requestAnimationFrame(frame);window.__KARST_STATE__=state;window.__KARST_DIAGNOSTICS__={renderer:"two-pass-exact-v26",material:"Brick Mother V2.6 stone-block unmodified fragment path"};
})();
</script>
</body>
</html>"""

html = (
    html.replace("__VS__", vs)
    .replace("__GEOMETRY_FS__", geometry_fs)
    .replace("__MATERIAL_FS__", material_fs)
    .replace("__MATERIAL_JSON__", json.dumps(material_config, ensure_ascii=False, separators=(",", ":")))
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(html, encoding="utf-8")

report = {
    "schema": "LANDSCAPE_SMALL_KARST_BRICK_V26_R22_EXACT",
    "sourceGeometry": str(R21.relative_to(ROOT)),
    "brickMotherSource": BRICK_HTML_URL,
    "brickMotherData": BRICK_DATA_URL,
    "brickMotherHtmlSha256": sha256(brick),
    "brickMotherFragmentSha256": sha256(fragment_match.group(1)),
    "gaeaGlslSha256": sha256(gaea_glsl),
    "profile": "stone-block",
    "profileSha256": sha256(json.dumps(stone, sort_keys=True, ensure_ascii=False)),
    "output": str(OUT.relative_to(ROOT)),
    "outputSha256": sha256(html),
    "renderer": "two-pass continuous field + exact Brick Mother V2.6 fragment pipeline",
    "removedLandscapeMaterialMixing": True,
    "fixedUngatedPoreRings": True,
    "holeSizeControl": [0.35, 1.85],
    "originalR1Changed": False,
    "visualApproved": False,
}
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))