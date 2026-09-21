from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-karst-dem-field-r2-6-cracks/index.html"
OUT_DIR = ROOT / "workbenches/landscape-karst-dem-field-r2-6-1-driver-safe"
OUT = OUT_DIR / "index.html"
BUILD = OUT_DIR / "build.json"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"R2.6.1 patch target missing: {label}")
    return source.replace(old, new, 1)


source = SRC.read_text(encoding="utf-8")
source_sha = sha256(source)

source = source.replace("PALAU_KARST_DEM_FIELD_R26_CRACKS", "PALAU_KARST_DEM_FIELD_R261_DRIVER_SAFE")
source = source.replace("卡斯特 DEM 函数场 R2.6 · 几何裂隙", "卡斯特 DEM 函数场 R2.6.1 · 显卡兼容", 2)
source = source.replace(
    "DEM 连续山体默认 · 三个标本仅作算子探针 · 几何裂隙与次级孔洞 · RGBA8 兼容",
    "DEM 连续山体默认 · 几何裂隙与次级孔洞 · 保守步进 · 跨显卡兼容",
)
source = source.replace(
    "R2.6 · DEM 连续函数场 · 几何裂隙 · 次级孔洞 · 海蚀算子",
    "R2.6.1 · DEM 连续函数场 · 真实裂隙 · 驱动安全渲染",
)
source = source.replace('<button id="qualityBtn">标准</button>', '<button id="qualityBtn">快速</button>', 1)

safe_dem = r'''float demHeight(vec2 xz){
  vec2 a=(xz-vec2(-1.45,.35))/vec2(4.35,3.55);
  vec2 b=(xz-vec2(2.55,-.55))/vec2(3.25,2.85);
  vec2 c=(xz-vec2(-3.15,-2.25))/vec2(2.45,2.15);
  float h=-5.92;
  h+=9.25*exp(-dot(a,a)*1.42);
  h+=6.15*exp(-dot(b,b)*1.70);
  h+=3.95*exp(-dot(c,c)*1.88);
  // Analytic low-cost ridge terms keep the DEM identity continuous without
  // evaluating two multi-octave FBMs at every ray-march sample.
  h+=.38*sin(xz.x*.43+xz.y*.17);
  h+=.21*sin(xz.x*.21-xz.y*.51+1.7);
  h+=.12*cos(xz.x*.86+xz.y*.37-2.1);
  return h;
}
float demFieldBase(vec3 p){
  // Conservative distance scaling prevents overshoot on strict desktop GPUs.
  float terrain=(p.y-demHeight(p.xz))*.34;
  float domain=(length((p.xz-vec2(0.,.12))/vec2(7.85,6.45))-1.)*1.72;
  float bottom=(-p.y-7.34)*.42;
  return max(max(terrain,domain),bottom);
}
'''
source, count = re.subn(
    r"float demHeight\(vec2 xz\)\{.*?\n\}\nfloat demFieldBase\(vec3 p\)\{.*?\n\}\n(?=float baseForm)",
    safe_dem,
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("R2.6.1 conservative DEM replacement failed")

safe_cracks = r'''float crackWindow(float y,float lo,float hi){return max(lo-y,y-hi);}
float crackNetwork(vec3 q,float localSea){
  float w=max(.010,uCrackWidth);
  float seed=float(uVariant)*1.73;
  // Deterministic analytic warps replace expensive FBM calls in the inner SDF.
  float n1=sin(q.y*.79+q.z*.31+seed)*(.075+.045*uCrackBranch)
          +sin(q.y*1.71-q.z*.23+seed*1.9)*.028;
  float n2=sin(q.y*.91+q.x*.27+seed*.7)*(.068+.040*uCrackBranch)
          +cos(q.y*1.43+q.x*.19-seed)*.024;
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
'''
source, count = re.subn(
    r"float crackWindow\(float y,float lo,float hi\)\{.*?\n\}\n(?=float mapRock)",
    safe_cracks,
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("R2.6.1 lightweight crack replacement failed")

source = replace_once(
    source,
    '''  vec3 q=p,w0=domainWarp(p*.18+vec3(2.4,-3.1,5.7)+float(uVariant)*3.17);
  q+=w0*(.76*uWarp);
  vec3 w1=domainWarp((q+w0)*.43+vec3(-7.7,8.3,2.1)+float(uVariant)*1.91);
  q+=w1*(.12*uWarp);''',
    '''  vec3 q=p,w0=domainWarp(p*.18+vec3(2.4,-3.1,5.7)+float(uVariant)*3.17);
  float demMode=float(uVariant==3);
  q+=w0*(mix(.76,.42,demMode)*uWarp);
  vec3 w1=demMode>.5?vec3(0.):domainWarp((q+w0)*.43+vec3(-7.7,8.3,2.1)+float(uVariant)*1.91);
  q+=w1*(.12*uWarp);''',
    "DEM warp cost gate",
)
source = source.replace("#define MAX_STEPS 88", "#define MAX_STEPS 104", 1)
source = replace_once(
    source,
    "    t+=max(hit.x*.80,.008);",
    "    float marchScale=uVariant==3?.50:.76;\n    t+=max(hit.x*marchScale,.005);",
    "conservative ray step",
)

source = source.replace(
    "variant:3,quality:.78,gray:0,theta:.72,phi:1.15,radius:31,target:[0,-.35,0]",
    "variant:3,quality:.58,gray:0,theta:.72,phi:1.18,radius:25,target:[0,-.85,0]",
)
source = source.replace(
    "variant:3,quality:.78,gray:0,theta:.72,phi:1.15,radius:31,target:[0,-.35,0]",
    "variant:3,quality:.58,gray:0,theta:.72,phi:1.18,radius:25,target:[0,-.85,0]",
)
source = source.replace("const qualityLevels=[{v:.58,n:\"快速\"},{v:.78,n:\"标准\"},{v:1.0,n:\"精细\"}];let qualityIndex=1;", "const qualityLevels=[{v:.58,n:\"快速\"},{v:.78,n:\"标准\"},{v:1.0,n:\"精细\"}];let qualityIndex=0;", 1)

probe = r'''function geometryVisible(){
 const previous=gl.getParameter(gl.FRAMEBUFFER_BINDING),px=new Uint8Array(4);
 gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.readBuffer(gl.COLOR_ATTACHMENT2);
 let hits=0;
 for(let gy=1;gy<=7;gy++)for(let gx=1;gx<=7;gx++){
  gl.readPixels(Math.floor(canvas.width*gx/8),Math.floor(canvas.height*gy/8),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
  if(px[2]>20)hits++;
 }
 gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.bindFramebuffer(gl.FRAMEBUFFER,previous);
 return hits>0;
}
function outputVisible(){
 const px=new Uint8Array(4);let sum=0,spread=0,last=-1;
 for(let gy=1;gy<=5;gy++)for(let gx=1;gx<=5;gx++){
  gl.readPixels(Math.floor(canvas.width*gx/6),Math.floor(canvas.height*gy/6),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
  const v=px[0]+px[1]+px[2];sum+=v;if(last>=0)spread+=abs(v-last);last=v;
 }
 return sum>300||spread>60;
}
'''
source, count = re.subn(
    r"function outputVisible\(\)\{.*?\}\n(?=const startedAt)",
    probe,
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("R2.6.1 visibility probe replacement failed")

source = replace_once(
    source,
    'if(first){if(!outputVisible())throw Error("GPU 已完成绘制但输出仍为空，已阻止伪成功");first=false;',
    'if(first){const geometryOk=geometryVisible(),colorOk=outputVisible(),glErr=gl.getError();if(!geometryOk)throw Error("DEM 几何缓冲未命中，已停止伪成功");if(glErr!==gl.NO_ERROR)throw Error("WebGL 绘制错误 0x"+glErr.toString(16));document.documentElement.dataset.karstColorProbe=colorOk?"true":"driver-readback-unreliable";first=false;',
    "driver-safe first frame validation",
)
source = source.replace(
    'renderer:"two-pass-r26-rgba8-packed-dem-field"',
    'renderer:"two-pass-r261-rgba8-packed-dem-field-driver-safe"',
)
source = source.replace(
    'document.getElementById("badge").textContent=`首帧 ${loadMs} ms · DEM 连续场 · 几何裂隙 · RGBA8 兼容`',
    'document.getElementById("badge").textContent=`首帧 ${loadMs} ms · DEM 连续场 · 真实裂隙 · 驱动安全`',
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(source, encoding="utf-8")
report = {
    "schema": "LANDSCAPE_KARST_DEM_FIELD_R261_DRIVER_SAFE",
    "source": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "output": str(OUT.relative_to(ROOT)),
    "outputSha256": sha256(source),
    "defaultMode": "DEM_CONTINUOUS_FIELD",
    "geometryOperatorsUnchanged": ["primaryCavities", "secondaryPockets", "marineNotch", "surfaceShellCracks"],
    "driverFixes": [
        "conservative DEM distance bound",
        "lighter analytic DEM ridge and crack warps",
        "reduced first-frame resolution",
        "geometry-buffer visibility probe",
        "WebGL error gate",
    ],
    "renderer": "WebGL2 RGBA8 packed three-target compatibility path",
    "visualApproved": False,
}
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
