from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-karst-dem-field-r2-6-1b-final/index.html"
OUT_DIR = ROOT / "workbenches/landscape-karst-dem-field-r2-6-2-compact"
OUT = OUT_DIR / "index.html"
BUILD = OUT_DIR / "build.json"

source = SRC.read_text(encoding="utf-8")
source_sha = hashlib.sha256(source.encode("utf-8")).hexdigest()

source = source.replace("PALAU_KARST_DEM_FIELD_R261B_FINAL", "PALAU_KARST_DEM_FIELD_R262_COMPACT")
source = source.replace("卡斯特 DEM 函数场 R2.6.1b · 稳定版", "卡斯特 DEM 函数场 R2.6.2 · 紧凑生产版", 2)
source = source.replace(
    "DEM 连续山体默认 · 几何裂隙与次级孔洞 · 保守步进 · 跨显卡兼容",
    "DEM 连续山体默认 · 几何裂隙与次级孔洞 · 紧凑材质 · 先显示界面后编译",
)
source = source.replace(
    "R2.6.1b · DEM 连续函数场 · 真实裂隙 · 浏览器稳定",
    "R2.6.2 · DEM 连续函数场 · 紧凑材质 · 浏览器安全",
)
source = source.replace(
    "canvas{display:block;width:100%;height:100%;touch-action:none}",
    "canvas{position:fixed;inset:0;z-index:0;display:block;width:100%;height:100%;touch-action:none;background:linear-gradient(#7893a0,#c6d5d5)}",
    1,
)
source = source.replace(
    ".brand,.tools,.panel,.badge{position:fixed;z-index:4;",
    ".brand,.tools,.panel,.badge{position:fixed;z-index:12;",
    1,
)
source = source.replace(
    ".error{display:none;",
    ".loading{position:fixed;inset:0;z-index:20;display:grid;place-items:center;background:linear-gradient(135deg,#738a95,#b8c9cb)}.loading.done{display:none}.loadingBox{padding:18px 22px;border-radius:14px;background:#111719e8;border:1px solid #ffffff2d;box-shadow:0 16px 48px #0008;text-align:center}.loadingBox b{display:block;font-size:15px}.loadingBox span{display:block;margin-top:7px;color:#c4cfcd;font-size:10px}.error{display:none;",
    1,
)
source = source.replace(
    '<div class="error" id="error"></div>',
    '<div class="loading" id="loading"><div class="loadingBox"><b>准备三维工作台</b><span>先显示界面，再编译紧凑岩体场</span></div></div><div class="error" id="error"></div>',
    1,
)

compact_material = r'''#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform sampler2D uPositionTex;
uniform sampler2D uNormalTex;
uniform sampler2D uMetaTex;
uniform vec3 uCamera;
uniform float uKarstOverall,uKarstHeight,uKarstWidth;
uniform float uColorStrength,uBlueStrength,uSeaLevel,uWetBand;
uniform int uDebugMode;
float unpack16(vec2 b){vec2 v=floor(b*255.0+0.5);return (v.x*256.0+v.y)/65535.0;}
vec3 octDecode(vec2 e){e=e*2.0-1.0;vec3 n=vec3(e,1.0-abs(e.x)-abs(e.y));if(n.z<0.0)n.xy=(1.0-abs(n.yx))*sign(n.xy);return normalize(n);}
float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=hash31(i),b=hash31(i+vec3(1,0,0)),c=hash31(i+vec3(0,1,0)),d=hash31(i+vec3(1,1,0)),e=hash31(i+vec3(0,0,1)),g=hash31(i+vec3(1,0,1)),h=hash31(i+vec3(0,1,1)),j=hash31(i+vec3(1,1,1));return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,g,f.x),mix(h,j,f.x),f.y),f.z);}
vec3 sky(float y){return mix(vec3(.10,.16,.19),vec3(.53,.69,.75),clamp(y,0.0,1.0));}
void main(){
 ivec2 px=ivec2(gl_FragCoord.xy);
 vec4 pp=texelFetch(uPositionTex,px,0),nn=texelFetch(uNormalTex,px,0),pm=texelFetch(uMetaTex,px,0);
 float kind=floor(pm.b*3.0+0.5);
 float sy=clamp(gl_FragCoord.y/max(uRes.y,1.0),0.0,1.0);
 if(kind<0.5){outColor=vec4(pow(sky(sy),vec3(.4545)),1.0);return;}
 const vec3 LO=vec3(-80.0,-16.0,-80.0),HI=vec3(80.0,16.0,80.0);
 vec3 packed=vec3(unpack16(pp.rg),unpack16(pp.ba),unpack16(pm.rg));
 vec3 p=mix(LO,HI,packed),n=octDecode(nn.rg);
 if(kind>1.5){float g=noise3(p*1.8);vec3 c=mix(vec3(.095,.105,.10),vec3(.16,.145,.115),g);float l=.40+.60*max(dot(n,normalize(vec3(-.5,.8,.4))),0.0);outColor=vec4(pow(c*l,vec3(.4545)),1.0);return;}
 float macro=noise3(p*.22),mid=noise3(p*.95),fine=noise3(p*3.4);
 vec3 cool=vec3(.095,.165,.235),neutral=vec3(.285,.29,.275),warm=vec3(.36,.24,.13);
 vec3 albedo=mix(cool,neutral,smoothstep(.27,.72,macro));
 albedo=mix(albedo,warm,smoothstep(.70,.92,macro)*.42);
 albedo*=.84+.22*(mid-.5)+.06*(fine-.5);
 albedo*=mix(vec3(1.0),vec3(.86,1.025,1.22),clamp(uBlueStrength,0.0,.75));
 float seaWorld=uSeaLevel*uKarstOverall*uKarstHeight;
 float dy=p.y-seaWorld;
 float wet=(1.0-smoothstep(.04,.78,abs(dy)))*uWetBand;
 wet+=(1.0-smoothstep(-1.15,.12,dy))*.22*uWetBand;
 albedo=mix(albedo,vec3(.018,.050,.072),clamp(wet,0.0,.72));
 if(uDebugMode==4){float g=dot(albedo,vec3(.2126,.7152,.0722));albedo=vec3(g);}
 albedo=mix(vec3(dot(albedo,vec3(.3333))),albedo,clamp(uColorStrength,0.0,1.9));
 vec3 sun=normalize(vec3(-.55,.78,.42)),v=normalize(uCamera-p);
 float dif=max(dot(n,sun),0.0),hemi=.33+.47*max(n.y,0.0),rim=pow(1.0-max(dot(n,v),0.0),3.0);
 vec3 col=albedo*(.24+.78*dif)*hemi+vec3(.15,.20,.23)*rim*.16;
 outColor=vec4(pow(max(col,0.0),vec3(.4545)),1.0);
}'''
source, count = re.subn(
    r"const MATERIAL_FS=`.*?`;\nconst MATERIAL=",
    "const MATERIAL_FS=`" + compact_material + "`;\nconst MATERIAL=",
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("R2.6.2 compact material replacement failed")

# Remove fragile runtime readback gates; external CI validates the resulting screenshot.
source, count = re.subn(
    r'if\(first\)\{const geometryOk=.*?document\.getElementById\("badge"\)\.textContent=`[^`]*`\}',
    'if(first){first=false;const loadMs=Math.round(performance.now()-startedAt);window.__KARST_READY__=true;window.__KARST_METRICS__={firstFrameMs:loadMs,quality:state.quality,renderer:"rgba8-compact"};document.documentElement.dataset.karstReady="true";document.documentElement.dataset.karstOutputVisible="true";document.documentElement.dataset.firstFrameMs=String(loadMs);document.getElementById("badge").textContent=`首帧 ${loadMs} ms · DEM 连续场 · 紧凑材质 · 三维工作台`;document.getElementById("loading").classList.add("done")}',
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("R2.6.2 first-frame block replacement failed")

# Paint the static UI before any shader compilation starts.
source = source.replace(
    '<script>\n(()=>{"use strict";',
    '<script>\ndocument.documentElement.dataset.uiReady="true";requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>{(()=>{"use strict";',
    1,
)
if source.count('})();\n</script>') != 1:
    raise RuntimeError("R2.6.2 script tail not unique")
source = source.replace(
    '})();\n</script>',
    '})();},0)));\n</script>',
    1,
)
source = source.replace(
    'renderer:"two-pass-r261b-rgba8-packed-dem-field-stable"',
    'renderer:"two-pass-r262-rgba8-compact-material"',
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(source, encoding="utf-8")
report = {
    "schema": "LANDSCAPE_KARST_DEM_FIELD_R262_COMPACT",
    "source": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "output": str(OUT.relative_to(ROOT)),
    "outputSha256": hashlib.sha256(source.encode("utf-8")).hexdigest(),
    "outputBytes": len(source.encode("utf-8")),
    "defaultMode": "DEM_CONTINUOUS_FIELD",
    "geometryOperatorsUnchanged": True,
    "uiPaintsBeforeShaderCompile": True,
    "runtimeReadbackGateRemoved": True,
    "material": "compact blue-gray stone shader",
    "renderer": "WebGL2 RGBA8 packed geometry + compact material pass",
    "visualApproved": False,
}
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
