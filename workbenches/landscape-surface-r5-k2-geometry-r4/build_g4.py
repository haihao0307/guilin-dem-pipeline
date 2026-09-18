from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r3/index.html"
OUT = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r4/index.html"
BUILD = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r4/build.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


raw = SRC.read_bytes()
source_sha = sha256(raw)
s = raw.decode("utf-8")
assert "R5.K2.G3" in s and "Warped Microscope + Living Soil" in s, "R5.K2.G3 source contract missing"

# Version labels: this round moves the Microscope into the source SDF before meshing.
s = s.replace("R5.K2.G3 Warped Microscope", "R5.K2.G4 Source-Coupled Form", 1)
s = s.replace("水蚀岩壁 R5.K2.G3", "水蚀岩壁 R5.K2.G4", 1)
s = s.replace("Warped Microscope + Living Soil", "Source SDF Microscope + Source Soil", 1)
s = s.replace("R5.K2.G3 在不可变 P0", "R5.K2.G4 先改写源隐式场，再提取真实网格；次级网格核仍以不可变 P0", 1)

# Recipe contract: add source-form controls. soilMicro is retained but redefined as source ground form.
old_default = "const DEFAULT=Object.freeze({schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,geo:1.65,concavity:.85,spikeGuard:.95,soilMicro:.80});"
new_default = "const DEFAULT=Object.freeze({schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,sourceForm:1.15,sourceScale:6.4,sourceWarp:1.30,sourceErosion:.90,geo:.80,concavity:.70,spikeGuard:.95,soilMicro:.85});"
assert old_default in s, "DEFAULT recipe block missing"
s = s.replace(old_default, new_default, 1)

old_validate_tail = "if(!Number.isFinite(c.spikeGuard)||c.spikeGuard<0||c.spikeGuard>1)throw Error('尖刺抑制参数越界');if(!Number.isFinite(c.soilMicro)||c.soilMicro<0||c.soilMicro>1.5)throw Error('地面显微起伏越界');return true}"
new_validate_tail = "if(!Number.isFinite(c.spikeGuard)||c.spikeGuard<0||c.spikeGuard>1)throw Error('尖刺抑制参数越界');if(!Number.isFinite(c.sourceForm)||c.sourceForm<0||c.sourceForm>2.4)throw Error('源形体强度越界');if(!Number.isFinite(c.sourceScale)||c.sourceScale<3||c.sourceScale>12)throw Error('源形体尺度越界');if(!Number.isFinite(c.sourceWarp)||c.sourceWarp<0||c.sourceWarp>2.5)throw Error('源形体 Warp 越界');if(!Number.isFinite(c.sourceErosion)||c.sourceErosion<0||c.sourceErosion>1.6)throw Error('源溶蚀偏置越界');if(!Number.isFinite(c.soilMicro)||c.soilMicro<0||c.soilMicro>1.5)throw Error('土壤源形体越界');return true}"
assert old_validate_tail in s, "validation tail missing"
s = s.replace(old_validate_tail, new_validate_tail, 1)

# Source-coupled Microscope. This function is evaluated inside substrate(), before W.mesh extracts triangles.
source_kernel = r'''
function sourceMicroscopeOffset(x,y,z){
  const strength=c.sourceForm;if(strength<=0)return 0;
  const sc=c.sourceScale,warp=c.sourceWarp,erosion=c.sourceErosion;
  let w0=noise(x*.024+3.7,y*.018-7.1,z*.023+11.9,c.seed+1401)-.5;
  let w1=noise(x*.016-9.3,y*.029+4.8,z*.019-6.4,c.seed+1423)-.5;
  let w2=noise(x*.031+13.1,y*.014-2.6,z*.027+5.7,c.seed+1439)-.5;
  let ang=warp*(1.34*w0+.63*w1+.27*w0*w2),ca=Math.cos(ang),sa=Math.sin(ang);
  let rx=ca*x-sa*z+sc*(.72*w1+.18*w2),rz=sa*x+ca*z+sc*(.68*w0-.16*w2),ry=y+sc*(.34*w2+.12*w0-.09*w1);
  let qx=rx/sc,qy=ry/(sc*1.72),qz=rz/sc;
  let broad=noise(qx,qy,qz,c.seed+1451)-.5;
  let mid=noise(qx*2.07+4.3,qy*1.83-3.1,qz*2.13+7.7,c.seed+1471)-.5;
  let flow=noise((qx+.24*qy)*1.31+8.2,qy*.71-1.9,(qz-.19*qy)*1.27-5.4,c.seed+1487)-.5;
  let breakup=.76+.54*(noise(rx*.037-2.7,ry*.024+6.8,rz*.033+1.9,c.seed+1499)-.5);
  let f=(.76*broad+.33*mid+.24*flow)*breakup;
  let cavity=Math.max(0,f-.015+.035*w2),bulge=Math.max(0,-f-.075);
  let heightGate=smooth(-2.8,3.2,y)*(1-smooth(42.0,50.5,y));
  let zone=.78+.54*(noise(x*.028+17.2,y*.017-8.1,z*.026+3.9,c.seed+1511)-.5);
  return heightGate*zone*strength*(.94*f+erosion*2.15*cavity*cavity-.36*bulge*bulge);
}
function soilSourceOffset(x,z){
  const strength=c.soilMicro;if(strength<=0)return 0;
  let w0=noise(x*.041+5.2,0,z*.037-8.1,c.seed+1543)-.5;
  let w1=noise(x*.027-9.7,0,z*.031+3.4,c.seed+1559)-.5;
  let sx=x+2.7*w0+1.1*w1,sz=z+2.4*w1-.8*w0;
  let broad=noise(sx*.145,0,sz*.132,c.seed+1571)-.5;
  let mid=noise(sx*.33+4.7,0,sz*.29-6.2,c.seed+1583)-.5;
  let fine=noise(sx*.67-3.4,0,sz*.59+8.3,c.seed+1597)-.5;
  return strength*(.18*broad+.075*mid+.028*fine);
}
let sourceMax=0,sourceSum2=0,sourceCount=0;
for(let yy=4;yy<=42;yy+=3.8)for(let j=0;j<28;j++){let a=j*Math.PI/14,r=9+yy*.18+(j%3)*1.7,v=sourceMicroscopeOffset(-3+Math.cos(a)*r,yy,Math.sin(a)*r*.82);sourceMax=Math.max(sourceMax,Math.abs(v));sourceSum2+=v*v;sourceCount++}
let soilMax=0,soilSum2=0,soilCount=0;
for(let x=-48;x<=48;x+=6)for(let z=-40;z<=40;z+=5){let v=soilSourceOffset(x,z);soilMax=Math.max(soilMax,Math.abs(v));soilSum2+=v*v;soilCount++}
const sourceMicroscope={schema:'LANDSCAPE_SOURCE_FIELD_MICROSCOPE_R1',fieldCoupled:true,appliesBeforeMeshing:true,strength:c.sourceForm,scaleM:c.sourceScale,warp:c.sourceWarp,erosionBias:c.sourceErosion,maxSampleOffsetM:sourceMax,rmsSampleOffsetM:Math.sqrt(sourceSum2/Math.max(1,sourceCount)),sampleCount:sourceCount,changesSilhouette:true,changesCavityBoundary:true,changesCollisionField:true,cameraAffectsGeometry:false};
const soilMicroscope={schema:'LANDSCAPE_SOIL_SOURCE_FIELD_R2',fieldCoupled:true,appliesBeforeMeshing:true,strength:c.soilMicro,maxSampleOffsetM:soilMax,rmsSampleOffsetM:Math.sqrt(soilSum2/Math.max(1,soilCount)),sampleCount:soilCount,topographyFunction:'groundBed + soilSourceOffset',terrainSupportUsesSourceMesh:true,cameraAffectsGeometry:false};
'''
marker = "const events=EVENTS.map((e,i)=>({...e,center:e.center.slice(),half:e.half.slice(),dest:e.dest.slice(),spikeGuard:c.spikeGuard}));\n"
assert marker in s, "create() source insertion point missing"
s = s.replace(marker, marker + source_kernel, 1)

old_substrate = "function substrate(x,y,z){let d=env(x,y,z);if(d>5||y< -5.6)return d;return d+(fbm(x*.091,y*.13,z*.107,c.seed)-.5)*4.5+1.1*detail(x*.44+3,y*.49,z*.48+7,4)}"
new_substrate = "function substrate(x,y,z){let d=env(x,y,z);if(d>5||y< -5.6)return d;d=d+(fbm(x*.091,y*.13,z*.107,c.seed)-.5)*4.5+1.1*detail(x*.44+3,y*.49,z*.48+7,4);return d+sourceMicroscopeOffset(x,y,z)}"
assert old_substrate in s, "substrate source coupling point missing"
s = s.replace(old_substrate, new_substrate, 1)

old_ground = "function groundBed(x,z){return -2.3+.36*Math.sin(x*.09+z*.04)+.28*Math.cos(z*.13-x*.03)+.5*(fbm(x*.07,0,z*.07,c.seed+330)-.5)}"
new_ground = "function groundBed(x,z){return -2.3+.36*Math.sin(x*.09+z*.04)+.28*Math.cos(z*.13-x*.03)+.5*(fbm(x*.07,0,z*.07,c.seed+330)-.5)+soilSourceOffset(x,z)}"
assert old_ground in s, "ground source coupling point missing"
s = s.replace(old_ground, new_ground, 1)

old_return = "return {config:c,bounds:env.bounds,joints:J,rock,rockBeforeDetach,sourceFragment,ground,groundBed,soilThickness,soilComponents,perimeter,events,erosion};"
new_return = "return {config:c,bounds:env.bounds,joints:J,rock,rockBeforeDetach,sourceFragment,ground,groundBed,soilThickness,soilComponents,perimeter,events,erosion,sourceMicroscope,soilMicroscope};"
assert old_return in s, "World.create return contract missing"
s = s.replace(old_return, new_return, 1)

# Remove the previous post-mesh soil displacement call. Ground shape now exists in groundBed before soil meshing.
post_soil_pattern = re.compile(
    r"const soil=W\.mesh\(soilField,\[-55,-8,-46\],\[55,6,46\],\.75\);soil\.name='土体与风化基底';soil\.kind=3;soil\.event=0;TerrainSupport\.orient\(soil\);soil\.rest=soil\.positions\.slice\(\);soil\.N=W\.normals\(soil\.positions,soil\.indices\);const soilMicroscope=soilMicroscopeR1\(soil,\{strength:config\.soilMicro,seed:config\.seed,amplitude:\.038\}\);parts\.push\(soil\);"
)
post_soil_replacement = "const soil=W.mesh(soilField,[-55,-8,-46],[55,6,46],.75);soil.name='土体与风化基底';soil.kind=3;soil.event=0;TerrainSupport.orient(soil);soil.rest=soil.positions.slice();soil.N=W.normals(soil.positions,soil.indices);const soilMicroscope=w.soilMicroscope;parts.push(soil);"
s, n = post_soil_pattern.subn(post_soil_replacement, s, count=1)
assert n == 1, "post-mesh soil Microscope call missing"

old_report = "const report={config:{...config},microscopeGeometry:geometryMicroscope,soilMicroscope,builtInMs:"
new_report = "const report={config:{...config},sourceMicroscope:w.sourceMicroscope,microscopeGeometry:geometryMicroscope,soilMicroscope,builtInMs:"
assert old_report in s, "scene report integration point missing"
s = s.replace(old_report, new_report, 1)

# The source field is now the dominant form control; keep the post-mesh geometry only as a secondary bounded layer.
old_geo_call = "const geometryMicroscope=microscopeGeometryR2(main,{amp:geometryAmp,strength:config.geo,concavity:config.concavity,spikeGuard:config.spikeGuard,scale:7.2,layers:3,gridStep:step,meshSafetyFraction:.22,directionDeg:18,warp:.92,smoothing:.34,seed:config.seed});"
new_geo_call = "const geometryMicroscope=microscopeGeometryR2(main,{amp:geometryAmp,strength:config.geo,concavity:config.concavity,spikeGuard:config.spikeGuard,scale:7.2,layers:3,gridStep:step,meshSafetyFraction:.18,directionDeg:18,warp:.78,smoothing:.42,seed:config.seed});"
assert old_geo_call in s, "secondary geometry call missing"
s = s.replace(old_geo_call, new_geo_call, 1)

# UI: insert source-form controls and make ground semantics explicit.
source_controls = "<div class=\"row\"><label for=\"sourceForm\">源形体强度</label><output id=\"sourceFormOut\">1.15</output></div><input id=\"sourceForm\" type=\"range\" min=\"0\" max=\"2.4\" step=\".05\" value=\"1.15\"><div class=\"row\"><label for=\"sourceScale\">源形体尺度</label><output id=\"sourceScaleOut\">6.40 m</output></div><input id=\"sourceScale\" type=\"range\" min=\"3\" max=\"12\" step=\".1\" value=\"6.4\"><div class=\"row\"><label for=\"sourceWarp\">源形体 Warp</label><output id=\"sourceWarpOut\">1.30</output></div><input id=\"sourceWarp\" type=\"range\" min=\"0\" max=\"2.5\" step=\".05\" value=\"1.30\"><div class=\"row\"><label for=\"sourceErosion\">源溶蚀偏置</label><output id=\"sourceErosionOut\">0.90</output></div><input id=\"sourceErosion\" type=\"range\" min=\"0\" max=\"1.6\" step=\".05\" value=\".90\"><div class=\"buttons\"><button data-form=\"off\">原始形体</button><button data-form=\"standard\" class=\"active\">源形体</button><button data-form=\"strong\">强形体</button></div>"
relief_anchor = "<input id=\"relief\" type=\"range\" min=\"0\" max=\"1.5\" step=\".05\" value=\"1\">"
assert relief_anchor in s, "relief UI anchor missing"
s = s.replace(relief_anchor, relief_anchor + source_controls, 1)

s = s.replace("<label for=\"geo\">真实几何强度</label>", "<label for=\"geo\">次级网格修饰</label>", 1)
s = s.replace("<output id=\"geoOut\">1.65</output>", "<output id=\"geoOut\">0.80</output>", 1)
s = s.replace("<input id=\"geo\" type=\"range\" min=\".8\" max=\"2.4\" step=\".05\" value=\"1.65\">", "<input id=\"geo\" type=\"range\" min=\".6\" max=\"1.8\" step=\".05\" value=\".80\">", 1)
s = s.replace("<output id=\"concavityOut\">0.85</output>", "<output id=\"concavityOut\">0.70</output>", 1)
s = s.replace("<input id=\"concavity\" type=\"range\" min=\".2\" max=\"1.25\" step=\".05\" value=\".85\">", "<input id=\"concavity\" type=\"range\" min=\".2\" max=\"1.25\" step=\".05\" value=\".70\">", 1)
s = s.replace("<label for=\"soilMicro\">地面显微起伏</label>", "<label for=\"soilMicro\">土壤源形体</label>", 1)
s = s.replace("<output id=\"soilMicroOut\">0.80</output>", "<output id=\"soilMicroOut\">0.85</output>", 1)
s = s.replace("<input id=\"soilMicro\" type=\"range\" min=\"0\" max=\"1.5\" step=\".05\" value=\".80\">", "<input id=\"soilMicro\" type=\"range\" min=\"0\" max=\"1.5\" step=\".05\" value=\".85\">", 1)
s = s.replace("阶段与开度用于机制示意，无地质年数映射。", "源形体参数会改写 rock/ground 隐式场并重新提取网格；不是材质图案。阶段与开度无地质年数映射。", 1)

# App recipe and validation contract.
old_recipe = "let recipe={schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,geo:1.65,concavity:.85,spikeGuard:.95,soilMicro:.80};"
new_recipe = "let recipe={schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,sourceForm:1.15,sourceScale:6.4,sourceWarp:1.30,sourceErosion:.90,geo:.80,concavity:.70,spikeGuard:.95,soilMicro:.85};"
assert old_recipe in s, "app recipe block missing"
s = s.replace(old_recipe, new_recipe, 1)

old_keys = "'concavity,core,fracture,geo,relief,schema,seed,soilMicro,sourceErosion,sourceForm,sourceScale,sourceWarp,spikeGuard,stage'"
# G3 does not yet have source keys; replace its current exact key contract.
current_keys = "'concavity,core,fracture,geo,relief,schema,seed,soilMicro,spikeGuard,stage'"
assert current_keys in s, "build recipe key contract missing"
s = s.replace(current_keys, old_keys, 1)

old_build_validation = "if(!Number.isFinite(newRecipe.geo)||newRecipe.geo<.6||newRecipe.geo>2.4||!Number.isFinite(newRecipe.concavity)||newRecipe.concavity<.2||newRecipe.concavity>1.25||!Number.isFinite(newRecipe.spikeGuard)||newRecipe.spikeGuard<0||newRecipe.spikeGuard>1||!Number.isFinite(newRecipe.soilMicro)||newRecipe.soilMicro<0||newRecipe.soilMicro>1.5)throw Error('几何调节参数越界');"
new_build_validation = "if(!Number.isFinite(newRecipe.geo)||newRecipe.geo<.6||newRecipe.geo>1.8||!Number.isFinite(newRecipe.concavity)||newRecipe.concavity<.2||newRecipe.concavity>1.25||!Number.isFinite(newRecipe.spikeGuard)||newRecipe.spikeGuard<0||newRecipe.spikeGuard>1||!Number.isFinite(newRecipe.sourceForm)||newRecipe.sourceForm<0||newRecipe.sourceForm>2.4||!Number.isFinite(newRecipe.sourceScale)||newRecipe.sourceScale<3||newRecipe.sourceScale>12||!Number.isFinite(newRecipe.sourceWarp)||newRecipe.sourceWarp<0||newRecipe.sourceWarp>2.5||!Number.isFinite(newRecipe.sourceErosion)||newRecipe.sourceErosion<0||newRecipe.sourceErosion>1.6||!Number.isFinite(newRecipe.soilMicro)||newRecipe.soilMicro<0||newRecipe.soilMicro>1.5)throw Error('源形体或次级几何参数越界');"
assert old_build_validation in s, "app build validation block missing"
s = s.replace(old_build_validation, new_build_validation, 1)

# Sync and input handlers: recipe parameters rebuild geometry.
old_sync_loop = "for(let k of ['fracture','relief','geo','concavity','spikeGuard','soilMicro']){$('#'+k).value=recipe[k];$('#'+k+'Out').textContent=recipe[k].toFixed(2)}"
new_sync_loop = "for(let k of ['fracture','relief','sourceForm','sourceWarp','sourceErosion','geo','concavity','spikeGuard','soilMicro']){$('#'+k).value=recipe[k];$('#'+k+'Out').textContent=recipe[k].toFixed(2)}$('#sourceScale').value=recipe.sourceScale;$('#sourceScaleOut').textContent=recipe.sourceScale.toFixed(2)+' m'"
assert old_sync_loop in s, "sync recipe loop missing"
s = s.replace(old_sync_loop, new_sync_loop, 1)

old_input_loop = "for(let k of ['fracture','relief','geo','concavity','spikeGuard','soilMicro'])$('#'+k).oninput=e=>$('#'+k+'Out').textContent=(+e.target.value).toFixed(2);"
new_input_loop = "for(let k of ['fracture','relief','sourceForm','sourceWarp','sourceErosion','geo','concavity','spikeGuard','soilMicro'])$('#'+k).oninput=e=>$('#'+k+'Out').textContent=(+e.target.value).toFixed(2);$('#sourceScale').oninput=e=>$('#sourceScaleOut').textContent=(+e.target.value).toFixed(2)+' m';const formPresets={off:{sourceForm:0,sourceScale:6.4,sourceWarp:0,sourceErosion:0},standard:{sourceForm:1.15,sourceScale:6.4,sourceWarp:1.30,sourceErosion:.90},strong:{sourceForm:1.90,sourceScale:7.2,sourceWarp:1.75,sourceErosion:1.25}};$$('[data-form]').forEach(b=>b.onclick=()=>{let p=formPresets[b.dataset.form];for(let k of Object.keys(p)){$('#'+k).value=p[k];let out=$('#'+k+'Out');if(out)out.textContent=k==='sourceScale'?p[k].toFixed(2)+' m':p[k].toFixed(2)}$$('[data-form]').forEach(x=>x.classList.toggle('active',x===b))});"
assert old_input_loop in s, "geometry input loop missing"
s = s.replace(old_input_loop, new_input_loop, 1)

old_apply = "build({...recipe,fracture:+$('#fracture').value,relief:+$('#relief').value,geo:+$('#geo').value,concavity:+$('#concavity').value,spikeGuard:+$('#spikeGuard').value,soilMicro:+$('#soilMicro').value,seed:+$('#seed').value})"
new_apply = "build({...recipe,fracture:+$('#fracture').value,relief:+$('#relief').value,sourceForm:+$('#sourceForm').value,sourceScale:+$('#sourceScale').value,sourceWarp:+$('#sourceWarp').value,sourceErosion:+$('#sourceErosion').value,geo:+$('#geo').value,concavity:+$('#concavity').value,spikeGuard:+$('#spikeGuard').value,soilMicro:+$('#soilMicro').value,seed:+$('#seed').value})"
assert old_apply in s, "apply recipe block missing"
s = s.replace(old_apply, new_apply, 1)

# Keep the surface shader secondary by default so the real silhouette is readable.
s = s.replace("scope:1.55,shellScale:.82,shellContrast:1.65,shellCoverage:.88,shellDirection:18,shellWarp:1.35,shellBreakup:.90,micro:1.80,breakContrast:1.60", "scope:1.05,shellScale:.94,shellContrast:1.20,shellCoverage:.78,shellDirection:18,shellWarp:1.10,shellBreakup:.72,micro:1.45,breakContrast:1.25", 1)
s = s.replace("scope:1.55,shellScale:.82,shellContrast:1.65,shellCoverage:.88,shellDirection:18,shellWarp:1.35,shellBreakup:.90,micro:1.80,breakContrast:1.60", "scope:1.05,shellScale:.94,shellContrast:1.20,shellCoverage:.78,shellDirection:18,shellWarp:1.10,shellBreakup:.72,micro:1.45,breakContrast:1.25", 1)

# Explain the actual contract in the information panel.
info_anchor = "<p><b>层级：</b>"
assert info_anchor in s
s = s.replace(info_anchor, "<p><b>G4 核心：</b>源形体 Microscope 直接写入 substrate() 和 groundBed()，随后由固定网格重新提取实体；关闭材质、切换灰模或剖面时仍可看见轮廓、凹坑边界和地面高程变化。次级壳层不再承担形体证明。</p>" + info_anchor, 1)

raw_out = s.encode("utf-8")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(raw_out)

build = {
    "schema": "LANDSCAPE_R5_K2_G4_SOURCE_COUPLED_FORM_V1",
    "date": "2026-09-17",
    "sourcePath": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "candidatePath": str(OUT.relative_to(ROOT)),
    "candidateSha256": sha256(raw_out),
    "candidateBytes": len(raw_out),
    "sourceGeometry": {
        "schema": "LANDSCAPE_SOURCE_FIELD_MICROSCOPE_R1",
        "fieldCoupled": True,
        "applicationPoint": "substrate() before erosionField and before W.mesh",
        "defaultStrength": 1.15,
        "defaultScaleM": 6.4,
        "defaultWarp": 1.30,
        "defaultErosionBias": 0.90,
        "controls": ["sourceForm", "sourceScale", "sourceWarp", "sourceErosion"],
        "affects": ["silhouette", "cavity boundary", "cross-section", "collision/SDF", "water/occlusion source field"],
    },
    "soilGeometry": {
        "schema": "LANDSCAPE_SOIL_SOURCE_FIELD_R2",
        "fieldCoupled": True,
        "applicationPoint": "groundBed() before soilField and before W.mesh",
        "defaultStrength": 0.85,
        "postMeshDisplacementRemoved": True,
        "terrainSupportUsesSourceMesh": True,
    },
    "secondaryGeometry": {
        "schema": "LANDSCAPE_MICROSCOPE_GEOMETRY_R2",
        "role": "bounded secondary detail only",
        "defaultStrength": 0.80,
        "fieldCoupled": False,
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
