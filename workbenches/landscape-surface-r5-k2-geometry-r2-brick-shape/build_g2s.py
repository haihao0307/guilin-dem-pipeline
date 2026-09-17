from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r2/index.html"
OUT = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r2-brick-shape/index.html"
BUILD = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r2-brick-shape/build.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


raw = SRC.read_bytes()
source_sha = sha256(raw)
s = raw.decode("utf-8")
assert "R5.K2.G2 Real Geometry" in s
assert "Stronger Geometry + Tunable Microscope" in s
assert "function substrate(x,y,z)" in s

# Return to the user-approved G2 picture and change only the missing shape layer.
s = s.replace("R5.K2.G2 Real Geometry", "R5.K2.G2S Brick Shape Geometry", 1)
s = s.replace("水蚀岩壁 R5.K2.G2", "水蚀岩壁 R5.K2.G2S", 1)
s = s.replace("Stronger Geometry + Tunable Microscope", "Accepted G2 + Brick Mother Shape Field", 1)
s = s.replace("<label for=\"geo\">真实几何强度</label>", "<label for=\"geo\">Microscope 真实形体</label>", 1)

# Brick Mother lesson: a continuous multi-scale field is added to the final signed-distance
# geometry before mesh extraction. It is not a material, normal or whole-object domain warp.
shape_kernel = r'''
function brickShapeMicroscope(x,y,z,baseD){
  let surface=1-smooth(.20,1.55,Math.abs(baseD));
  let height=smooth(2.2,5.8,y)*(1-smooth(39.5,47.0,y));
  if(surface<=0||height<=0||er<=0)return 0;
  function mouthProtect(cx,cy,cz,rx,ry,rz){
    let q=Math.hypot((x-cx)/rx,(y-cy)/ry,(z-cz)/rz);
    let shell=1-smooth(.05,.28,Math.abs(q-1));
    let front=smooth(cz-2.4,cz+3.8,z);
    return shell*front;
  }
  let protect=1-Math.max(
    mouthProtect(-6,5.4,8.8,6.8,4.7,9),
    mouthProtect(12,7,8,10,3.7,8)
  );
  if(protect<=0)return 0;
  let w0=fbm(x*.029+3.1,y*.021-7.2,z*.027+5.4,c.seed+2003)-.5;
  let w1=fbm(x*.019-9.7,y*.033+2.8,z*.023-6.1,c.seed+2027)-.5;
  let w2=fbm(x*.037+12.4,y*.017-4.6,z*.031+8.9,c.seed+2053)-.5;
  let a=.92*w0+.37*w1*w2,ca=Math.cos(a),sa=Math.sin(a);
  let X=ca*x-sa*z+2.6*w1+.7*w2;
  let Z=sa*x+ca*z+2.3*w0-.6*w1;
  let Y=y+1.25*w2+.35*w0;
  let band=0;
  band+=.52*Math.cos(.43*X+.18*Y+.31*Z+.31);
  band+=.27*Math.cos(.79*X-.29*Y+.57*Z-1.07);
  band+=.135*Math.cos(1.31*X+.41*Y-.88*Z+.72);
  band+=.0675*Math.cos(2.07*X-.83*Y+1.43*Z-2.18);
  let fine=0;
  fine+=.50*Math.cos(1.54*X+.63*Y+.98*Z+.17);
  fine+=.25*Math.cos(2.78*X-1.03*Y+1.91*Z-1.63);
  fine+=.125*Math.cos(4.36*X+1.73*Y-3.11*Z+.91);
  let zone=.72+.50*(fbm(X*.041-2.7,Y*.027+6.8,Z*.037+1.9,c.seed+2081)-.5);
  let strength=clamp((c.geo-.6)/1.8,0,1);
  let amp=.16+.10*strength;
  let erode=Math.max(band,0);
  let signed=(.58*band+.18*fine+.22*c.concavity*erode)*zone;
  return er*surface*height*protect*amp*signed;
}
'''
anchor = "const events=EVENTS.map((e,i)=>({...e,center:e.center.slice(),half:e.half.slice(),dest:e.dest.slice(),spikeGuard:c.spikeGuard}));\n"
assert anchor in s
s = s.replace(anchor, anchor + shape_kernel, 1)

old_tail = "let notch=(Math.sqrt(((x-12)/10)**2+((y-7)/3.7)**2+((z-8)/8)**2)-1)*3.7+.18*detail(x*.84,y*.78,z*.92,3);d=Math.max(d,-notch);\n}return d;\n}\nfunction rock(x,y,z)"
new_tail = "let notch=(Math.sqrt(((x-12)/10)**2+((y-7)/3.7)**2+((z-8)/8)**2)-1)*3.7+.18*detail(x*.84,y*.78,z*.92,3);d=Math.max(d,-notch);\n}d+=brickShapeMicroscope(x,y,z,d);return d;\n}\nfunction rock(x,y,z)"
assert old_tail in s
s = s.replace(old_tail, new_tail, 1)

old_return = "return {config:c,bounds:env.bounds,joints:J,rock,rockBeforeDetach,sourceFragment,ground,groundBed,soilThickness,soilComponents,perimeter,events,erosion};"
report_block = r'''
let brickMax=0,brickSum2=0,brickCount=0;
for(let yy=6;yy<=38;yy+=4)for(let j=0;j<32;j++){
  let a=j*Math.PI/16,r=12+yy*.17+(j%3)*1.25;
  let xx=-3+Math.cos(a)*r,zz=Math.sin(a)*r*.82;
  let v=brickShapeMicroscope(xx,yy,zz,0);
  brickMax=Math.max(brickMax,Math.abs(v));brickSum2+=v*v;brickCount++;
}
const brickShapeMicroscopeReport={
  schema:'LANDSCAPE_BRICK_SHAPE_FIELD_R1',
  sourceMethod:'Brick Mother R2.14.2 continuous face-to-edge SDF field',
  appliesBeforeMeshing:true,
  wholeObjectDomainWarp:false,
  materialOnly:false,
  maxSampleOffsetM:brickMax,
  rmsSampleOffsetM:Math.sqrt(brickSum2/Math.max(1,brickCount)),
  sampleCount:brickCount,
  preservesAcceptedMacro:true,
  protectsPeakFootAndMainMouths:true,
  cameraAffectsGeometry:false
};
'''
assert old_return in s
s = s.replace(old_return, report_block + "\nreturn {config:c,bounds:env.bounds,joints:J,rock,rockBeforeDetach,sourceFragment,ground,groundBed,soilThickness,soilComponents,perimeter,events,erosion,brickShapeMicroscope:brickShapeMicroscopeReport};", 1)

old_scene_report = "const report={config:{...config},microscopeGeometry:geometryMicroscope,builtInMs:"
new_scene_report = "const report={config:{...config},brickShapeMicroscope:w.brickShapeMicroscope,microscopeGeometry:geometryMicroscope,builtInMs:"
assert old_scene_report in s
s = s.replace(old_scene_report, new_scene_report, 1)

info_anchor = "<p>R5 冻结这份水蚀石灰岩的宏观岩体、洞口、峰脚、土体和落石几何。"
assert info_anchor in s
s = s.replace(
    info_anchor,
    "<p><b>G2S 只补最后一层：</b>保留用户认可的 G2 山体、洞口、材质、相机与地面；仅把 Brick Mother 的连续多尺度形体场写入最终岩体 SDF，再提取真实三角网格。没有新增整山 Warp，没有重做宏观形态。</p>" + info_anchor,
    1,
)

raw_out = s.encode("utf-8")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(raw_out)

build = {
    "schema": "LANDSCAPE_R5_K2_G2S_BRICK_SHAPE_V1",
    "date": "2026-09-17",
    "sourcePath": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "candidatePath": str(OUT.relative_to(ROOT)),
    "candidateSha256": sha256(raw_out),
    "candidateBytes": len(raw_out),
    "frozen": [
        "G2 macro silhouette",
        "G2 cave and notch system",
        "G2 camera and lighting",
        "G2 material and shader defaults",
        "G2 ground and loose stones",
    ],
    "onlyChange": {
        "schema": "LANDSCAPE_BRICK_SHAPE_FIELD_R1",
        "method": "continuous warped multi-scale scalar field added to final rock SDF before W.mesh",
        "sourceLesson": "Brick Mother R2.14.2 face-to-edge geometry field",
        "wholeObjectWarp": False,
        "newMaterialEffect": False,
        "newFeatureSystem": False,
    },
    "visualApproved": False,
    "productionReady": False,
}
BUILD.write_text(json.dumps(build, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(build, ensure_ascii=False))
