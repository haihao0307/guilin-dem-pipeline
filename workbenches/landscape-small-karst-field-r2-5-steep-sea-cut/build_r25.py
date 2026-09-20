from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-small-karst-field-r2-4-three-sea-erosion/index.html"
OUT_DIR = ROOT / "workbenches/landscape-small-karst-field-r2-5-steep-sea-cut"
OUT = OUT_DIR / "index.html"
BUILD = OUT_DIR / "build.json"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"R2.5 patch target missing: {label}")
    return source.replace(old, new, 1)


source = SRC.read_text(encoding="utf-8")
source_sha = sha256(source)

source = source.replace("帕劳海蚀卡斯特 R2.4 · 三形态", "帕劳海蚀卡斯特 R2.5 · 下部陡切")
source = source.replace("LANDSCAPE MOTHER · PALAU SEA-EROSION SET", "LANDSCAPE MOTHER · PALAU LOWER SEA-CUT")
source = source.replace(
    "三种独立形态 · 自然海蚀收腰 · 潮位湿痕 · V2.6 材质保留",
    "三种独立形态 · 下部陡切海蚀层 · 窄颈下行 · 底脚平缓外展",
)
source = source.replace(
    "P1 高瘦 / P2 宽厚 / P3 偏心双体 · 海蚀线可调 · 强蓝灰 V2.6",
    "R2.5 · 海蚀层下移 · 陡切窄颈 · 底脚自然外展 · 三形态",
)
source = replace_once(
    source,
    'data-transfer="PALAU_KARST_R24_THREE_SEA_EROSION"',
    'data-transfer="PALAU_KARST_R25_STEEP_LOWER_SEA_CUT"',
    "transfer identity",
)
source = source.replace(
    "潮位线会随岩面噪声自然起伏，不形成机械水平圆环。",
    "切层位于岩体下部：先陡切入内，再形成窄颈向下，底脚随后平缓外展；仍保留不规则水位扰动。",
)
source = source.replace('min="-4.60" max="-2.20" step=".01" value="-3.55"', 'min="-5.20" max="-2.80" step=".01" value="-4.08"', 1)
source = source.replace("seaLevel:-3.55", "seaLevel:-4.08")
source = source.replace("seaNotch:1.18", "seaNotch:1.38")
source = source.replace('value="1.18"', 'value="1.38"', 1)

new_map = r'''float mapRock(vec3 wp){
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

  // Palau lower sea-cut profile: steep inward lip, sustained narrow neck,
  // then a gradual outward flare toward the submerged foot.  The height is
  // perturbed in plan so the cut never becomes a mechanical horizontal ring.
  float seaNoise=(fbmValueFast(vec3(q.x*.38,q.z*.38,4.1+float(uVariant)*2.7))-.5)*.34;
  seaNoise+=sin(q.x*.57+q.z*.33+float(uVariant)*1.17)*.075;
  seaNoise+=(valueNoise3(vec3(q.x*.92,q.z*.92,11.3+float(uVariant)))-.5)*.08;
  float localSea=uSeaLevel+seaNoise;
  float yRel=q.y-localSea;
  float exposure=smoothstep(1.00,3.18,radial);
  float az=atan(q.z,q.x);
  float azBreak=.70+.20*sin(az*3.0+float(uVariant)*1.43)+.10*sin(az*7.0-float(uVariant)*.87);
  azBreak*=.76+.24*fbmValueFast(vec3(q.x*.66,q.z*.66,8.7+float(uVariant)*2.1));

  // A very short transition creates the visibly steep sea-cut edge.
  float steepLip=smoothstep(-.54,-.10,yRel)*(1.0-smoothstep(-.015,.065,yRel));
  // The neck remains cut back while descending below the lip.
  float neck=smoothstep(-2.25,-1.48,yRel)*(1.0-smoothstep(-.16,-.02,yRel));
  float cut=(steepLip*.62+neck*.42)*exposure*azBreak*uSeaNotch;
  // Below the neck the base returns outward slowly instead of ending as a pin.
  float baseFlare=(1.0-smoothstep(-2.62,-1.58,yRel))*exposure;
  float flareVariation=.70+.30*fbmValueFast(vec3(q.x*.48,q.z*.48,15.1+float(uVariant)));

  float crownBreak=smoothstep(3.7,6.9,q.y)*smoothstep(.68,.92,ridgedFbm(q*.68+w0*1.55));
  d+=uMacro*macro*.49+uDetail*(mid+fine)*.21;
  d+=fissures*.14+flutes*.095+crownBreak*.07;
  d+=cut*.50;
  d-=baseFlare*flareVariation*.23*uSeaNotch;
  return d*s*min(uWidth,uHeight);
}'''
source, count = re.subn(
    r"float mapRock\(vec3 wp\)\{.*?\}(?=\s*float mapGround)",
    new_map,
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("R2.5 mapRock replacement failed")

source = source.replace(
    'renderer:"two-pass-r24-three-sea-erosion"',
    'renderer:"two-pass-r25-steep-lower-sea-cut"',
)
source = source.replace(
    'shape:"three Palau karst variants with irregular sea notch"',
    'shape:"three Palau karst variants with steep lower sea-cut, descending neck and base flare"',
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(source, encoding="utf-8")
report = {
    "schema": "LANDSCAPE_PALAU_KARST_R25_STEEP_LOWER_SEA_CUT",
    "source": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "output": str(OUT.relative_to(ROOT)),
    "outputSha256": sha256(source),
    "variants": ["P1 高瘦礁塔", "P2 宽厚岩岛", "P3 偏心双体"],
    "seaCut": {
        "defaultLevel": -4.08,
        "defaultStrength": 1.38,
        "steepInwardLip": True,
        "descendingNarrowNeck": True,
        "gradualBaseFlare": True,
        "irregularPlanHeight": True,
    },
    "material": "Brick Mother V2.6 / R2.3 controlled blue-colour gain retained",
    "visualApproved": False,
}
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
