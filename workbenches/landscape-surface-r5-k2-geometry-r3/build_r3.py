from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r2/index.html"
OUT = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r3/index.html"
BUILD = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r3/build.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


raw = SRC.read_bytes()
source_sha = sha256(raw)
s = raw.decode("utf-8")
assert "R5.K2.G2" in s and "microscopeGeometryR2" in s, "R5.K2.G2 source contract missing"

# Version labels
s = s.replace("R5.K2.G2 Real Geometry", "R5.K2.G3 Warped Microscope", 1)
s = s.replace("水蚀岩壁 R5.K2.G2", "水蚀岩壁 R5.K2.G3", 1)
s = s.replace("Stronger Geometry + Tunable Microscope", "Warped Microscope + Living Soil", 1)
s = s.replace("R5.K2.G2 在不可变 P0", "R5.K2.G3 在不可变 P0", 1)

# Recipe: add ground Microscope strength.
old = "const DEFAULT=Object.freeze({schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,geo:1.65,concavity:.85,spikeGuard:.95});"
new = "const DEFAULT=Object.freeze({schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,geo:1.65,concavity:.85,spikeGuard:.95,soilMicro:.80});"
assert old in s
s = s.replace(old, new, 1)

old = "if(!Number.isFinite(c.spikeGuard)||c.spikeGuard<0||c.spikeGuard>1)throw Error('尖刺抑制参数越界');return true}"
new = "if(!Number.isFinite(c.spikeGuard)||c.spikeGuard<0||c.spikeGuard>1)throw Error('尖刺抑制参数越界');if(!Number.isFinite(c.soilMicro)||c.soilMicro<0||c.soilMicro>1.5)throw Error('地面显微起伏越界');return true}"
assert old in s
s = s.replace(old, new, 1)

# Stronger, non-periodic domain warp in real geometry. Keep amplitude and safety gates unchanged.
detail_pattern = re.compile(r"function detailAt\(i\)\{.*?\}\nfunction capAt\(i\)", re.S)
detail_replacement = r'''function detailAt(i){
let k=i*3,x=P0[k],y=P0[k+1],z=P0[k+2],th=Math.atan2(z,x);
let w0=W.fbm(x*.024,y*.019,z*.023,seed+607)-.5,w1=W.fbm(x*.031+7.1,y*.026-3.7,z*.029+11.3,seed+613)-.5,w2=W.fbm(x*.018-9.4,y*.033+5.2,z*.027-4.8,seed+631)-.5;
let bend=warp*(.22*Math.sin(y*.109+w1*1.7)+.16*Math.sin(th*2.37+y*.047+w2*2.1)+.78*w0+.24*w1*w2),a=dir+bend,ca=Math.cos(a),sa=Math.sin(a),xr=ca*x-sa*z,zr=sa*x+ca*z;
let sx=xr+ell*(.52*w1+.16*Math.sin(y*.083+w2*2.4)),sy=y+ell*(.26*w2+.10*Math.sin(th*3.07+w0*2.2)),sz=zr+ell*(.48*w0+.14*Math.sin(y*.071+w1*2.7));
let turn=warp*(W.fbm(sx*.043,sy*.031,sz*.041,seed+653)-.5)*1.18,ct=Math.cos(turn),st=Math.sin(turn),tx=ct*sx-st*sz,tz=st*sx+ct*sz;
let broad=W.fbm(tx/ell,sy/(ell*1.87),tz/ell,seed+701)-.5;
let mid=W.fbm((tx+.19*sy)/(ell*.53)+3.7,(sy-.11*tz)/(ell*.99)-1.4,(tz+.17*tx)/(ell*.51)+6.1,seed+719)-.5;
let fine=W.fbm((tx-.13*tz)/(ell*.27)-5.2,(sy+.16*tx)/(ell*.59)+2.8,(tz-.09*sy)/(ell*.24)-3.1,seed+733)-.5;
let flow=W.fbm((tx+.21*sy)/(ell*.79)+11.0,sy/(ell*2.83),(tz-.18*sy)/(ell*.74)-7.0,seed+811)-.5;
let breakup=.78+.48*(W.fbm(tx*.032,sy*.021,tz*.029,seed+887)-.5),d=(.94*broad+.52*mid+.17*fine+.31*flow)*breakup,cavity=Math.max(0,d+.035+.025*w2),rim=Math.exp(-Math.abs(d-.025-.018*w1)*8.2);
return d*1.55-concavity*cavity*cavity*2.25+rim*.055-concavity*.055
}
function capAt(i)'''
s, n = detail_pattern.subn(detail_replacement, s, count=1)
assert n == 1, "geometry detailAt integration point missing"

old = "directionDeg:18,warp:.52,smoothing:.34,seed:config.seed"
new = "directionDeg:18,warp:.92,smoothing:.34,seed:config.seed"
assert old in s
s = s.replace(old, new, 1)

# Add bounded top-soil geometry. It runs before terrain support, so stones settle against final ground.
soil_kernel = r'''
function soilMicroscopeR1(mesh,options={}){
const W=World,P0=mesh.rest||mesh.positions,N0=mesh.N,I=mesh.indices,count=P0.length/3,clamp=W.clamp,smooth=W.smooth;
const strength=clamp(options.strength??.8,0,1.5),seed=options.seed??83,baseAmplitude=options.amplitude??.038;
function flipCount(P){let flips=0;for(let q=0;q<I.length;q+=3){let ia=I[q]*3,ib=I[q+1]*3,ic=I[q+2]*3,ux=P[ib]-P[ia],uy=P[ib+1]-P[ia+1],uz=P[ib+2]-P[ia+2],vx=P[ic]-P[ia],vy=P[ic+1]-P[ia+1],vz=P[ic+2]-P[ia+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,bux=P0[ib]-P0[ia],buy=P0[ib+1]-P0[ia+1],buz=P0[ib+2]-P0[ia+2],bvx=P0[ic]-P0[ia],bvy=P0[ic+1]-P0[ia+1],bvz=P0[ic+2]-P0[ia+2],bnx=buy*bvz-buz*bvy,bny=buz*bvx-bux*bvz,bnz=bux*bvy-buy*bvx;if(nx*bnx+ny*bny+nz*bnz<0)flips++}return flips}
const localScale=new Float32Array(count);localScale.fill(Infinity);
function safeMin(id,v){if(Number.isFinite(v)&&v>1e-8&&v<localScale[id])localScale[id]=v}
function edge(a,b){let A=a*3,B=b*3;return Math.hypot(P0[A]-P0[B],P0[A+1]-P0[B+1],P0[A+2]-P0[B+2])}
for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2],A=a*3,B=b*3,C=c*3,ab=edge(a,b),bc=edge(b,c),ca=edge(c,a),ux=P0[B]-P0[A],uy=P0[B+1]-P0[A+1],uz=P0[B+2]-P0[A+2],vx=P0[C]-P0[A],vy=P0[C+1]-P0[A+1],vz=P0[C+2]-P0[A+2],area2=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx);safeMin(a,Math.min(ab,ca,area2/Math.max(bc,1e-9)));safeMin(b,Math.min(ab,bc,area2/Math.max(ca,1e-9)));safeMin(c,Math.min(bc,ca,area2/Math.max(ab,1e-9)))}
for(let i=0;i<count;i++)if(!Number.isFinite(localScale[i]))localScale[i]=.75;
const gate=new Float32Array(count),raw=new Float32Array(count),sum=new Float64Array(count),w=new Uint16Array(count);
for(let i=0;i<count;i++){let k=i*3,x=P0[k],y=P0[k+1],z=P0[k+2],top=smooth(.30,.86,N0[k+1]),height=smooth(-6.2,-2.7,y)*(1-smooth(2.2,4.8,y)),edgeFade=smooth(-.02,.10,top*height),wx=W.fbm(x*.035,0,z*.035,seed+1103)-.5,wz=W.fbm(x*.041+9.7,0,z*.039-6.2,seed+1117)-.5,sx=x+2.1*wx,sz=z+1.8*wz,broad=W.fbm(sx*.18,0,sz*.16,seed+1129)-.5,mid=W.fbm(sx*.39+4.1,0,sz*.35-7.3,seed+1151)-.5,fine=W.fbm(sx*.71-5.4,0,sz*.63+2.8,seed+1163)-.5;gate[i]=edgeFade;raw[i]=strength*edgeFade*baseAmplitude*(.72*broad+.36*mid+.14*fine)}
function add(a,b){sum[a]+=raw[b];w[a]++}
for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2];add(a,b);add(a,c);add(b,a);add(b,c);add(c,a);add(c,b)}
const disp=new Float32Array(count);for(let i=0;i<count;i++){let v=w[i]?raw[i]*.64+(sum[i]/w[i])*.36:raw[i],cap=Math.max(1e-6,localScale[i]*.075);disp[i]=clamp(v,-cap,cap)}
function build(scale){let P=new Float32Array(P0),maxD=0,sum2=0,active=0;for(let i=0;i<count;i++){if(gate[i]<1e-5)continue;let k=i*3,off=disp[i]*scale;P[k+1]=P0[k+1]+off;maxD=Math.max(maxD,Math.abs(off));sum2+=off*off;active++}return{P,maxD,rms:Math.sqrt(sum2/Math.max(1,active)),active,flips:flipCount(P)}}
let chosen=null,effectiveScale=0;for(let scale of[1,.75,.5,.25,0]){let r=build(scale);if(r.flips===0){chosen=r;effectiveScale=scale;break}}if(!chosen)throw Error('Soil Microscope safety gate failed');
mesh.positions=chosen.P;mesh.N=W.normals(chosen.P,I);mesh.soilMicroscope={schema:'LANDSCAPE_SOIL_MICROSCOPE_R1',strength,baseAmplitudeM:baseAmplitude,effectiveScale,maxDisplacementM:chosen.maxD,rmsDisplacementM:chosen.rms,activeVertexCount:chosen.active,triangleFlipCount:chosen.flips,topSurfaceOnly:true,terrainSupportUsesDisplacedMesh:true,cameraAffectsGeometry:false};return mesh.soilMicroscope
}
'''
marker = "\nfunction generateScene(config,progress=()=>{}){"
assert marker in s
s = s.replace(marker, soil_kernel + marker, 1)

old = "const soil=W.mesh(soilField,[-55,-8,-46],[55,6,46],.75);soil.name='土体与风化基底';soil.kind=3;soil.event=0;TerrainSupport.orient(soil);soil.rest=soil.positions.slice();soil.N=W.normals(soil.positions,soil.indices);parts.push(soil);"
new = "const soil=W.mesh(soilField,[-55,-8,-46],[55,6,46],.75);soil.name='土体与风化基底';soil.kind=3;soil.event=0;TerrainSupport.orient(soil);soil.rest=soil.positions.slice();soil.N=W.normals(soil.positions,soil.indices);const soilMicroscope=soilMicroscopeR1(soil,{strength:config.soilMicro,seed:config.seed,amplitude:.038});parts.push(soil);"
assert old in s
s = s.replace(old, new, 1)

old = "const report={config:{...config},microscopeGeometry:geometryMicroscope,builtInMs:"
new = "const report={config:{...config},microscopeGeometry:geometryMicroscope,soilMicroscope,builtInMs:"
assert old in s
s = s.replace(old, new, 1)

# Reintroduce a stronger, continuous but non-repeating material-domain warp.
old_uniform = "uniform vec3 uEye;uniform float uExposure,uWet,uMicro,uScope,uShellScale,uShellContrast,uShellCoverage,uShellDirection,uBreakContrast;uniform int uMode,uSection,uSelect;uniform float uStage;"
new_uniform = "uniform vec3 uEye;uniform float uExposure,uWet,uMicro,uScope,uShellScale,uShellContrast,uShellCoverage,uShellDirection,uShellWarp,uShellBreakup,uBreakContrast,uGroundMicro;uniform int uMode,uSection,uSelect;uniform float uStage;"
assert old_uniform in s
s = s.replace(old_uniform, new_uniform, 1)

frame_pattern = re.compile(r"vec3 mmFrame\(vec3 rawQ\)\{.*?\n\}\nvec3 mmOrganicData", re.S)
frame_replacement = r'''vec3 mmFrame(vec3 rawQ){
  vec3 q=rawQ*.245;
  vec3 low=vec3(bmN(rawQ*.021+vec3(3.1,7.2,-2.4)),bmN(rawQ*.0187+vec3(-8.3,2.7,4.6)),bmN(rawQ*.0243+vec3(1.5,-6.4,9.1)))-.5;
  vec3 low2=vec3(bmN(rawQ*.0119+vec3(-13.7,6.2,18.1)),bmN(rawQ*.0141+vec3(9.8,-11.4,2.7)),bmN(rawQ*.0127+vec3(4.2,15.3,-8.9)))-.5;
  float zone=bmN(rawQ*.0137+vec3(17.1,-5.3,8.7)),zone2=bmN(rawQ*.0089+vec3(-21.4,13.2,5.6));
  vec3 axis=normalize(vec3(.41,.79,.46)+low*.92+low2*.38);
  q+=low*(.92+.86*uShellWarp)+low2*(.31+.44*uShellBreakup);
  q=mmRot(q,axis,(zone-.5)*(1.18+1.42*uShellWarp));
  vec3 warpA=vec3(bmN(q*.173+vec3(5.7,-3.9,2.6)),bmN(q*.149+vec3(-4.6,8.1,11.3)),bmN(q*.191+vec3(9.4,3.2,-7.5)))-.5;
  q+=warpA*(.54+1.26*uShellWarp)*(1.+.42*(zone2-.5));
  vec3 axis2=normalize(vec3(-.58,.37,.72)+low2*.88+warpA*.31);
  q=mmRot(q,axis2,(zone2-.5)*1.58*uShellWarp);
  vec3 warpB=vec3(bmN(q*.317+vec3(-7.2,12.1,4.9)),bmN(q*.283+vec3(10.8,-5.4,16.3)),bmN(q*.349+vec3(3.6,7.7,-14.2)))-.5;
  q+=warpB*(.27+.73*uShellWarp);
  float shear=(bmN(rawQ*.032+vec3(6.7,19.1,-11.4))-.5)*uShellBreakup;
  q.x+=sin(q.y*.53+q.z*.17+shear*2.1)*.21*uShellBreakup;
  q.y+=sin(q.z*.47-q.x*.13+zone*3.1)*.16*uShellBreakup;
  q.z+=sin(q.x*.49+q.y*.11-zone2*2.7)*.19*uShellBreakup;
  return q;
}
vec3 mmOrganicData'''
s, n = frame_pattern.subn(frame_replacement, s, count=1)
assert n == 1, "mmFrame integration point missing"

organic_pattern = re.compile(r"vec3 mmOrganicData\(vec3 rawQ\)\{.*?\n\}\nvec3 mmControlledData", re.S)
organic_replacement = r'''vec3 mmOrganicData(vec3 rawQ){
  vec3 q=mmFrame(rawQ);
  float zone=bmN(rawQ*.0173+vec3(31.7,7.9,-13.1)),zone2=bmN(rawQ*.0107+vec3(-16.2,22.4,6.7));
  vec3 q1=mmRot(q,normalize(vec3(.63,.29,.72)),(zone-.5)*.92*uShellBreakup);
  vec3 q2=mmRot(q,normalize(vec3(-.37,.81,.46)),(zone2-.5)*1.13*uShellWarp);
  float a=bmN(q*vec3(.49,.61,.43)+vec3(2.1,11.7,-6.4));
  float b=bmN(q1*vec3(.91,1.03,.83)+vec3(-9.6,3.8,14.2));
  float c=bmN(q2*vec3(1.73,1.91,1.57)+vec3(7.4,-13.1,4.5));
  float d0=bmN((q1+q2*.17)*vec3(3.31,3.83,3.47)+vec3(19.2,5.6,-8.7));
  float e0=bmN((q2-q1*.11)*vec3(6.71,7.63,6.29)+vec3(-3.9,17.6,12.8));
  float f0=bmN((q+q2*.09)*vec3(13.07,15.31,12.19)+vec3(13.8,-9.2,21.7));
  float crossBand=bmN(vec3(q.x*.43+q.y*.17,q.y*.51-q.z*.13,q.z*.39+q.x*.19)+vec3(4.7,-8.1,12.6));
  float broad=.39*a+.31*b+.20*c+.10*crossBand;
  float mid=.31*b+.33*c+.24*d0+.12*crossBand;
  float fine=.39*d0+.34*e0+.19*f0+.08*crossBand;
  float threshold=.60+.075*(zone-.5)+.052*(zone2-.5)+.035*(crossBand-.5)*uShellBreakup;
  float cavity0=smoothstep(threshold,threshold+.105+.025*(zone2-.5),broad);
  float rim0=1.-smoothstep(.013,.068,abs(broad-threshold));
  float midGate=.665+.055*(zone-.5)-.034*(crossBand-.5);
  float cavity1=smoothstep(midGate,midGate+.145,mid)*(1.-cavity0*.55);
  float rim1=(1.-smoothstep(.012,.055,abs(mid-midGate)))*(1.-cavity0*.55);
  float pitLevel=.70+.06*(zone2-.5);
  float pit=smoothstep(pitLevel,pitLevel+.15,fine)*smoothstep(.24,.84,1.-mid);
  float poreRim=(1.-smoothstep(.010,.046,abs(fine-pitLevel)))*(1.-cavity0*.60);
  float nodule=smoothstep(.55,.83,d0)*smoothstep(.30,.78,broad)*(1.-cavity0);
  float lowShape=(broad-.5)*.19+(mid-.5)*.11+(crossBand-.5)*.055;
  float h=lowShape+.29*rim0-.46*cavity0+.145*rim1-.225*cavity1+.058*poreRim-.098*pit+.077*nodule;
  h=tanh(h*(1.68+.16*uShellBreakup));
  float cavity=clamp(cavity0*.84+cavity1*.50+pit*.25,0.,1.);
  float rim=clamp(rim0*.79+rim1*.51+poreRim*.18+nodule*.15,0.,1.);
  return vec3(h,cavity,rim);
}
vec3 mmControlledData'''
s, n = organic_pattern.subn(organic_replacement, s, count=1)
assert n == 1, "mmOrganicData integration point missing"

controlled_pattern = re.compile(r"vec3 mmControlledData\(vec3 rawQ\)\{.*?\n\}\nfloat mmSurface", re.S)
controlled_replacement = r'''vec3 mmControlledData(vec3 rawQ){
  float a=radians(uShellDirection),ca=cos(a),sa=sin(a);
  vec3 r=vec3(ca*rawQ.x-sa*rawQ.z,rawQ.y,sa*rawQ.x+ca*rawQ.z)*max(.2,uShellScale);
  vec3 phase=vec3(bmN(rawQ*.0123+vec3(7.3,-11.9,4.1)),bmN(rawQ*.0109+vec3(-13.7,5.8,17.2)),bmN(rawQ*.0147+vec3(19.1,8.6,-6.4)))-.5;
  vec3 m0=mmOrganicData(r);
  vec3 r2=mmRot(r+phase*(.36+1.24*uShellBreakup),normalize(vec3(.51,.77,-.37)),(.35+uShellWarp)*phase.y);
  vec3 m1=mmOrganicData(r2*vec3(1.071,.947,1.113)+vec3(3.7,-5.1,8.9));
  float switchField=bmN(rawQ*.0097+vec3(-22.6,14.3,9.1));
  float blend=smoothstep(.31,.73,switchField)*clamp(uShellBreakup,0.,1.5)*.58;
  vec3 m=mix(m0,m1,blend);
  float zone=bmN(rawQ*.027+phase*.9+vec3(23.7,-8.4,16.2));
  float edge=clamp(1.-uShellCoverage,0.,.85);
  float coverage=smoothstep(edge,min(1.,edge+.24+.08*(phase.x-.5)),zone);
  m.x=tanh(m.x*uShellContrast)*coverage;
  m.y*=coverage;m.z*=coverage;
  return m;
}
float mmSurface'''
s, n = controlled_pattern.subn(controlled_replacement, s, count=1)
assert n == 1, "mmControlledData integration point missing"

# Ground shader Microscope: actual geometry handles silhouette; this adds sub-grid soil grain.
old = "float pores=smoothstep(.76,.85,noise(p*10.));albedo*=1.-pores*.16;albedo*=.90+.14*f;\nalbedo*=mix(1.,.73,uWet);rough=.99;"
new = '''float pores=smoothstep(.76,.85,noise(p*10.));albedo*=1.-pores*.16;albedo*=.90+.14*f;
if((d.x>2.5&&d.x<3.5)&&uMode==0&&uGroundMicro>0.){
float soilH=(noise(vec3(p.x*.72,p.y*.31,p.z*.67)+vec3(4.2,-7.1,11.3))-.5)*.012+(noise(vec3(p.x*1.61,p.y*.47,p.z*1.43)+vec3(-9.4,3.7,6.2))-.5)*.005;
vec3 dx=dFdx(p),dy=dFdy(p),r1=cross(dy,N),r2=cross(N,dx);float det=dot(dx,r1);if(abs(det)>1e-9){vec3 grad=(r1*dFdx(soilH)+r2*dFdy(soilH))/det;grad*=min(1.,.42/max(length(grad),.001));N=normalize(N-uGroundMicro*grad);}
}
albedo*=mix(1.,.73,uWet);rough=.99;'''
assert old in s
s = s.replace(old, new, 1)

# UI controls.
soil_ui_anchor = '<input id="spikeGuard" type="range" min="0" max="1" step=".05" value=".95">'
soil_ui = soil_ui_anchor + '<div class="row"><label for="soilMicro">地面显微起伏</label><output id="soilMicroOut">0.80</output></div><input id="soilMicro" type="range" min="0" max="1.5" step=".05" value=".80">'
assert soil_ui_anchor in s
s = s.replace(soil_ui_anchor, soil_ui, 1)

warp_ui_anchor = '<input id="shellDirection" type="range" min="-180" max="180" step="1" value="18">'
warp_ui = warp_ui_anchor + '<div class="row"><label for="shellWarp">壳层 Warp</label><output id="shellWarpOut">1.35</output></div><input id="shellWarp" type="range" min=".2" max="2.5" step=".05" value="1.35"><div class="row"><label for="shellBreakup">连续破除</label><output id="shellBreakupOut">0.90</output></div><input id="shellBreakup" type="range" min="0" max="1.5" step=".05" value=".90">'
assert warp_ui_anchor in s
s = s.replace(warp_ui_anchor, warp_ui, 1)

# Front-end recipe/view state.
old = "let recipe={schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,geo:1.65,concavity:.85,spikeGuard:.95};"
new = "let recipe={schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,geo:1.65,concavity:.85,spikeGuard:.95,soilMicro:.80};"
assert old in s
s = s.replace(old, new, 1)

old = "shellCoverage:.88,shellDirection:18,micro:1.80"
new = "shellCoverage:.88,shellDirection:18,shellWarp:1.35,shellBreakup:.90,micro:1.80"
assert old in s
s = s.replace(old, new, 1)

old = "'uShellCoverage','uShellDirection','uBreakContrast'"
new = "'uShellCoverage','uShellDirection','uShellWarp','uShellBreakup','uBreakContrast','uGroundMicro'"
assert old in s
s = s.replace(old, new, 1)

old = "Object.keys(newRecipe).sort().join(',')!=='concavity,core,fracture,geo,relief,schema,seed,spikeGuard,stage'"
new = "Object.keys(newRecipe).sort().join(',')!=='concavity,core,fracture,geo,relief,schema,seed,soilMicro,spikeGuard,stage'"
assert old in s
s = s.replace(old, new, 1)

old = "newRecipe.spikeGuard<0||newRecipe.spikeGuard>1)throw Error('几何调节参数越界');"
new = "newRecipe.spikeGuard<0||newRecipe.spikeGuard>1||!Number.isFinite(newRecipe.soilMicro)||newRecipe.soilMicro<0||newRecipe.soilMicro>1.5)throw Error('几何调节参数越界');"
assert old in s
s = s.replace(old, new, 1)

old = "gl.uniform1f(U.uShellDirection,state.shellDirection);gl.uniform1f(U.uBreakContrast,state.breakContrast);"
new = "gl.uniform1f(U.uShellDirection,state.shellDirection);gl.uniform1f(U.uShellWarp,state.shellWarp);gl.uniform1f(U.uShellBreakup,state.shellBreakup);gl.uniform1f(U.uBreakContrast,state.breakContrast);gl.uniform1f(U.uGroundMicro,recipe.soilMicro);"
assert old in s
s = s.replace(old, new, 1)

old = "['scope','shellScale','shellContrast','shellCoverage','micro','breakContrast','wet','exposure']"
new = "['scope','shellScale','shellContrast','shellCoverage','shellWarp','shellBreakup','micro','breakContrast','wet','exposure']"
assert s.count(old) >= 2
s = s.replace(old, new, 2)

old = "['fracture','relief','geo','concavity','spikeGuard']"
new = "['fracture','relief','geo','concavity','spikeGuard','soilMicro']"
assert s.count(old) >= 2
s = s.replace(old, new, 2)

old = "'breakContrast,exposure,grass,micro,mode,phi,radius,scope,section,selected,shellContrast,shellCoverage,shellDirection,shellScale,target,theta,wet'"
new = "'breakContrast,exposure,grass,micro,mode,phi,radius,scope,section,selected,shellBreakup,shellContrast,shellCoverage,shellDirection,shellScale,shellWarp,target,theta,wet'"
assert old in s
s = s.replace(old, new, 1)

old = "for(let k of ['theta','phi','radius','scope','shellScale','shellContrast','shellCoverage','shellDirection','micro','breakContrast','wet','exposure'])"
new = "for(let k of ['theta','phi','radius','scope','shellScale','shellContrast','shellCoverage','shellDirection','shellWarp','shellBreakup','micro','breakContrast','wet','exposure'])"
assert old in s
s = s.replace(old, new, 1)

old = "v.shellDirection<-180||v.shellDirection>180||v.micro<1.4"
new = "v.shellDirection<-180||v.shellDirection>180||v.shellWarp<.2||v.shellWarp>2.5||v.shellBreakup<0||v.shellBreakup>1.5||v.micro<1.4"
assert old in s
s = s.replace(old, new, 1)

# Surface presets now include warp/breakup.
old_presets = "const surfacePresets={soft:{scope:.85,shellScale:1.15,shellContrast:.85,shellCoverage:.62,micro:1.4,breakContrast:1.05},standard:{scope:1.55,shellScale:.82,shellContrast:1.65,shellCoverage:.88,micro:1.8,breakContrast:1.6},strong:{scope:2.15,shellScale:.67,shellContrast:2.15,shellCoverage:.94,micro:2.55,breakContrast:2.25},extreme:{scope:2.75,shellScale:.54,shellContrast:2.75,shellCoverage:1,micro:3.45,breakContrast:3.10}};"
new_presets = "const surfacePresets={soft:{scope:.85,shellScale:1.15,shellContrast:.85,shellCoverage:.62,shellWarp:.70,shellBreakup:.35,micro:1.4,breakContrast:1.05},standard:{scope:1.55,shellScale:.82,shellContrast:1.65,shellCoverage:.88,shellWarp:1.35,shellBreakup:.90,micro:1.8,breakContrast:1.6},strong:{scope:2.15,shellScale:.67,shellContrast:2.15,shellCoverage:.94,shellWarp:1.75,shellBreakup:1.15,micro:2.55,breakContrast:2.25},extreme:{scope:2.75,shellScale:.54,shellContrast:2.75,shellCoverage:1,shellWarp:2.15,shellBreakup:1.40,micro:3.45,breakContrast:3.10}};"
assert old_presets in s
s = s.replace(old_presets, new_presets, 1)

old = "spikeGuard:+$('#spikeGuard').value,seed:+$('#seed').value"
new = "spikeGuard:+$('#spikeGuard').value,soilMicro:+$('#soilMicro').value,seed:+$('#seed').value"
assert old in s
s = s.replace(old, new, 1)

old = "shellCoverage:.88,shellDirection:18,micro:1.80"
new = "shellCoverage:.88,shellDirection:18,shellWarp:1.35,shellBreakup:.90,micro:1.80"
assert old in s
s = s.replace(old, new, 1)

# Keep the visible geometry slider inside the validated range.
s = s.replace('id="geo" type="range" min=".8" max="2.8"', 'id="geo" type="range" min=".8" max="2.4"', 1)

# Build metadata.
assert "uShellWarp" in s and "soilMicroscopeR1" in s and "soilMicro" in s
OUT.parent.mkdir(parents=True, exist_ok=True)
out = s.encode("utf-8")
OUT.write_bytes(out)

build = {
    "schema": "LANDSCAPE_R5_K2_G3_WARPED_MICROSCOPE_SOIL_R1",
    "date": "2026-09-17",
    "sourcePath": "workbenches/landscape-surface-r5-k2-geometry-r2/index.html",
    "sourceSha256": source_sha,
    "candidatePath": "workbenches/landscape-surface-r5-k2-geometry-r3/index.html",
    "candidateSha256": sha256(out),
    "candidateBytes": len(out),
    "geometry": {
        "macroReplacement": False,
        "mainWarp": 0.92,
        "mainWarpMethod": "three low-frequency offset fields + local rotation + cross-coupled non-integer bands",
        "amplitudeAndSafety": "unchanged from accepted G2",
        "protectedRegionsPreserved": True
    },
    "surface": {
        "shellWarpDefault": 1.35,
        "shellBreakupDefault": 0.90,
        "method": "two-stage vector warp, position-dependent rotations, anisotropic bands, independent phase blending",
        "goal": "remove visible horizontal/vertical continuity and repeated cavity rows"
    },
    "soil": {
        "defaultStrength": 0.80,
        "range": [0.0, 1.5],
        "baseAmplitudeM": 0.038,
        "topSurfaceOnly": True,
        "terrainSupportUsesDisplacedMesh": True,
        "subGridShaderResponse": True
    },
    "cameraAffectsGeometry": False,
    "timeAffectsStaticRock": False,
    "geometryFieldCoupled": False,
    "visualApproved": False,
    "productionReady": False
}
BUILD.write_text(json.dumps(build, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(build, ensure_ascii=False))
