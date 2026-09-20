from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-small-karst-field-r2-2-brick-v26-exact/index.html"
OUT_DIR = ROOT / "workbenches/landscape-small-karst-field-r2-3-fast-karst-color"
OUT = OUT_DIR / "index.html"
BUILD = OUT_DIR / "build.json"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"R2.3 patch target missing: {label}")
    return source.replace(old, new, 1)


source = SRC.read_text(encoding="utf-8")
source_sha = sha256(source)

source = source.replace("小尺度帕劳卡斯特 R2.2", "小尺度帕劳卡斯特 R2.3")
source = source.replace("LANDSCAPE MOTHER · EXACT TRANSFER", "LANDSCAPE MOTHER · FAST KARST ITERATION")
source = source.replace(
    "形体沿用 R2.1 · 材质原样执行 Brick Mother V2.6 stone-block",
    "R2.2 严格材质保留 · 提速、卡斯特形体与强色彩快速迭代",
)
source = source.replace(
    "默认约 16 m 高 / 12 m 宽 · 材质严格锁定 · 顶部土壤关闭",
    "默认约 16 m 高 / 12 m 宽 · 快速首帧 · 强蓝灰 V2.6 · 可显式缩放",
)
source = source.replace(
    '<html lang="zh-CN" data-transfer="STRICT_BRICK_V26_STONE_BLOCK_EXACT">',
    '<html lang="zh-CN" data-transfer="STRICT_BRICK_V26_STONE_BLOCK_R23_FAST">',
    1,
)

old_tools = '<div class="tools"><button id="reset">复位</button><button id="panelBtn">调节</button><button id="gray">灰模</button></div>'
new_tools = '<div class="tools"><button id="zoomOut" title="缩小">−</button><button id="zoomIn" title="放大">＋</button><button id="qualityBtn">标准</button><button id="reset">复位</button><button id="panelBtn">调节</button><button id="gray">灰模</button></div>'
source = replace_once(source, old_tools, new_tools, "tools")

old_note = '<p class="note">颜色、花纹、粗糙度、微法线、照明和所有材料种子均锁定为历史 V2.6，不加入 Landscape 自定义混合。</p>'
new_note = '''<p class="note">颜色、花纹、粗糙度、微法线、照明和所有材料种子仍来自历史 V2.6；本轮只提高蓝灰综合色彩强度。</p>
  </section>
  <section class="group"><h3>V2.6 色彩增益</h3>
    <div class="row"><label>色彩强度</label><output id="colorStrengthOut"></output></div><input id="colorStrength" type="range" min=".80" max="1.90" step=".01" value="1.42">
    <div class="row"><label>冷蓝倾向</label><output id="blueStrengthOut"></output></div><input id="blueStrength" type="range" min="0" max=".75" step=".01" value=".32">
    <p class="note">不更换历史 V2.6 色板，只在同一色板内增强饱和度与冷蓝层。</p>'''
source = replace_once(source, old_note, new_note, "color controls")
source = source.replace('<div class="badge">', '<div class="badge" id="badge">', 1)
source = source.replace('preserveDrawingBuffer:true', 'preserveDrawingBuffer:false', 1)
source = source.replace('#define MAX_STEPS 104', '#define MAX_STEPS 88', 1)
source = source.replace('t+=max(hit.x*.70,.006);', 't+=max(hit.x*.80,.008);', 1)
source = source.replace('for(int i=1;i<=3;i++)', 'for(int i=1;i<=2;i++)', 1)

new_base = '''float baseForm(vec3 p){
  float d=sdEllipsoid(p-vec3(-.35,-.20,.05),vec3(2.72,7.90,2.66));
  d=smin(d,sdEllipsoid(p-vec3(-1.42,1.92,.30),vec3(2.18,4.88,2.14)),.44);
  d=smin(d,sdEllipsoid(p-vec3(1.78,-1.30,-.42),vec3(2.34,4.18,2.08)),.40);
  d=smin(d,sdEllipsoid(p-vec3(.22,5.42,-.42),vec3(2.16,2.78,1.94)),.36);
  d=smin(d,sdEllipsoid(p-vec3(-.82,-4.22,.82),vec3(1.70,3.22,1.72)),.34);
  d=smin(d,sdEllipsoid(p-vec3(-2.14,-2.62,.10),vec3(1.12,2.28,1.22)),.28);
  d=smin(d,sdEllipsoid(p-vec3(.08,6.12,-.20),vec3(2.52,1.42,2.24)),.32);
  return d;
}'''
source, count = re.subn(r"float baseForm\(vec3 p\)\{.*?\}(?=float caveField)", new_base, source, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("R2.3 baseForm replacement failed")

new_map = '''float mapRock(vec3 wp){
  float s=max(uOverall,.1);
  vec3 p=wp/s;
  p.x/=max(uWidth,.1);p.z/=max(uWidth,.1);p.y/=max(uHeight,.1);
  vec3 q=p,w0=domainWarp(p*.18+vec3(2.4,-3.1,5.7));
  q+=w0*(.78*uWarp);
  vec3 w1=domainWarp((q+w0)*.43+vec3(-7.7,8.3,2.1));
  q+=w1*(.13*uWarp);
  float d=baseForm(q),cave=caveField(q);
  d=max(d,-(cave+.15*(valueNoise3(q*.7)-.5)*uCavity));
  float f=max(.16,uDetailScale);
  float macro=(fbmGradient(q*.23*f)-.5)*.86+(ridgedFbm(q*.46*f)-.5)*.48;
  float mid=(ridgedFbm(q*1.10*f)-.5)*.36+(valueNoise3(q*2.15*f)-.5)*.20;
  float fine=(valueNoise3(q*5.2*f)-.5)*.085;
  float directional=(valueNoise3(vec3(q.x*.45,q.y*.15,q.z*.45)+w0*1.4)-.5)*.18;
  float verticalA=ridgedFbm(vec3(q.x*1.12,q.y*.13,q.z*1.12)+w1*1.8);
  float verticalB=ridgedFbm(vec3(q.x*1.78,q.y*.085,q.z*1.78)+w0*2.15);
  float fissures=smoothstep(.68,.93,verticalA);
  float flutes=smoothstep(.64,.90,verticalB);
  float radial=length(q.xz);
  float lower=1.-smoothstep(-4.9,-1.7,q.y);
  float undercut=lower*smoothstep(1.45,3.10,radial);
  float waterNotch=exp(-pow((q.y+3.55)*.72,2.))*smoothstep(1.20,3.00,radial);
  float crownBreak=smoothstep(3.7,6.9,q.y)*smoothstep(.68,.92,ridgedFbm(q*.68+w0*1.55));
  d+=uMacro*(macro+directional)*.50+uDetail*(mid+fine)*.22;
  d+=fissures*.15+flutes*.10+undercut*.22+waterNotch*.17+crownBreak*.075;
  return d*s*min(uWidth,uHeight);
}'''
source, count = re.subn(r"float mapRock\(vec3 wp\)\{.*?\}(?=float mapGround)", new_map, source, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("R2.3 mapRock replacement failed")

source = replace_once(
    source,
    'uniform float uKarstWidth;\nvec3 vWorldPos;',
    'uniform float uKarstWidth;\nuniform float uColorStrength;\nuniform float uBlueStrength;\nvec3 vWorldPos;',
    "material color uniforms",
)
source = replace_once(
    source,
    '  albedo = adjustSaturation(albedo, familySaturation);\n  albedo = clamp(albedo, vec3(0.004), vec3(1.0));',
    '  albedo = adjustSaturation(albedo, familySaturation * uColorStrength);\n  albedo *= mix(vec3(1.0), vec3(0.90, 1.025, 1.18), uBlueStrength);\n  albedo = clamp(albedo, vec3(0.004), vec3(1.0));',
    "V2.6 color boost",
)
source = replace_once(
    source,
    '"uKarstOverall","uKarstHeight","uKarstWidth","uLowColor"',
    '"uKarstOverall","uKarstHeight","uKarstWidth","uColorStrength","uBlueStrength","uLowColor"',
    "material locations",
)
source = replace_once(
    source,
    'const state={overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]};',
    'const state={overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,quality:.78,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]};',
    "state",
)
source = replace_once(
    source,
    'const ids=["overall","height","width","holeSize","cavity","macro","warp","detail","detailScale"];',
    'const ids=["overall","height","width","holeSize","cavity","macro","warp","detail","detailScale","colorStrength","blueStrength"];',
    "control ids",
)
source = replace_once(
    source,
    'Object.assign(state,{overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]})',
    'Object.assign(state,{overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,colorStrength:1.42,blueStrength:.32,quality:.78,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]})',
    "reset state",
)
source = replace_once(
    source,
    'document.getElementById("panelBtn").onclick=()=>document.getElementById("panel").classList.toggle("hide");',
    '''document.getElementById("panelBtn").onclick=()=>document.getElementById("panel").classList.toggle("hide");
document.getElementById("zoomIn").onclick=()=>{state.radius=Math.max(7.5,state.radius*.82);dirty=true};
document.getElementById("zoomOut").onclick=()=>{state.radius=Math.min(72,state.radius*1.22);dirty=true};
const qualityLevels=[{v:.58,n:"快速"},{v:.78,n:"标准"},{v:1.0,n:"精细"}];let qualityIndex=1;
document.getElementById("qualityBtn").onclick=e=>{qualityIndex=(qualityIndex+1)%qualityLevels.length;state.quality=qualityLevels[qualityIndex].v;e.currentTarget.textContent=qualityLevels[qualityIndex].n;targetW=0;targetH=0;dirty=true};''',
    "zoom and quality handlers",
)
source = replace_once(
    source,
    'function resize(){const dpr=Math.min(devicePixelRatio||1,1.25),w=Math.max(1,Math.floor(innerWidth*dpr)),h=Math.max(1,Math.floor(innerHeight*dpr));',
    'function resize(){const dpr=Math.min(devicePixelRatio||1,1.10)*state.quality,w=Math.max(1,Math.floor(innerWidth*dpr)),h=Math.max(1,Math.floor(innerHeight*dpr));',
    "adaptive resolution",
)
source = replace_once(
    source,
    ' set3(UM.uCamera,eye);set1(UM.uKarstOverall,state.overall);set1(UM.uKarstHeight,state.height);set1(UM.uKarstWidth,state.width);',
    ' set3(UM.uCamera,eye);set1(UM.uKarstOverall,state.overall);set1(UM.uKarstHeight,state.height);set1(UM.uKarstWidth,state.width);set1(UM.uColorStrength,state.colorStrength);set1(UM.uBlueStrength,state.blueStrength);',
    "color uniform binding",
)
source = replace_once(source, 'let first=true;', 'const startedAt=performance.now();let first=true;', "timer start")
source = replace_once(
    source,
    'if(first){first=false;window.__KARST_READY__=true;document.documentElement.dataset.karstReady="true"}',
    'if(first){first=false;const loadMs=Math.round(performance.now()-startedAt);window.__KARST_READY__=true;window.__KARST_METRICS__={firstFrameMs:loadMs,quality:state.quality};document.documentElement.dataset.karstReady="true";document.documentElement.dataset.firstFrameMs=String(loadMs);document.getElementById("badge").textContent=`首帧 ${loadMs} ms · 标准质量 · 强蓝灰 V2.6 · 滚轮/按钮缩放`}',
    "timer publish",
)
source = source.replace(
    'window.__KARST_DIAGNOSTICS__={renderer:"two-pass-exact-v26",material:"Brick Mother V2.6 stone-block unmodified fragment path"};',
    'window.__KARST_DIAGNOSTICS__={renderer:"two-pass-r23-adaptive",material:"Brick Mother V2.6 stone-block + controlled color gain",shape:"Palau karst fluting and undercut"};',
    1,
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(source, encoding="utf-8")
report = {
    "schema": "LANDSCAPE_SMALL_KARST_R23_FAST_KARST_COLOR",
    "source": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "output": str(OUT.relative_to(ROOT)),
    "outputSha256": sha256(source),
    "performance": {
        "defaultQualityScale": 0.78,
        "qualityScales": [0.58, 0.78, 1.0],
        "maxRaySteps": 88,
        "preserveDrawingBuffer": False,
        "aoSamples": 2,
    },
    "shape": {
        "singleSmallKarst": True,
        "verticalFluting": True,
        "waterlineUndercut": True,
        "crownBreakup": True,
        "holeSizeControl": [0.35, 1.85],
    },
    "color": {
        "source": "Brick Mother V2.6 stone-block",
        "defaultStrength": 1.42,
        "defaultBlueStrength": 0.32,
        "paletteReplaced": False,
    },
    "zoom": {"wheel": True, "buttons": True, "radiusRange": [7.5, 72]},
    "visualApproved": False,
}
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
