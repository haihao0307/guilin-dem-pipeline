from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r1/index.html"
OUT = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r2/index.html"
BUILD = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r2/build.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


raw = SRC.read_bytes()
source_sha = sha256(raw)
s = raw.decode("utf-8")
assert "R5.K2.G1" in s and "microscopeGeometryR1" in s, "R5.K2.G1 source contract missing"

old_default = "const DEFAULT=Object.freeze({schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1});"
new_default = "const DEFAULT=Object.freeze({schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,geo:1.45,concavity:.75,spikeGuard:.90});"
assert old_default in s
s = s.replace(old_default, new_default, 1)

old_validate = "function validate(c){if(c.schema!==DEFAULT.schema||c.core!==DEFAULT.core)throw Error('配方版本不匹配');if(!Number.isInteger(c.seed)||c.seed<1||c.seed>99999)throw Error('种子超出范围');if(!Number.isInteger(c.stage)||c.stage<0||c.stage>4)throw Error('阶段无效');for(let k of ['fracture','relief'])if(!Number.isFinite(c[k])||c[k]<0||c[k]>1.5)throw Error('生成参数无效');return true}"
new_validate = "function validate(c){if(c.schema!==DEFAULT.schema||c.core!==DEFAULT.core)throw Error('配方版本不匹配');if(!Number.isInteger(c.seed)||c.seed<1||c.seed>99999)throw Error('种子超出范围');if(!Number.isInteger(c.stage)||c.stage<0||c.stage>4)throw Error('阶段无效');for(let k of ['fracture','relief'])if(!Number.isFinite(c[k])||c[k]<0||c[k]>1.5)throw Error('生成参数无效');if(!Number.isFinite(c.geo)||c.geo<.6||c.geo>2.4)throw Error('真实几何强度越界');if(!Number.isFinite(c.concavity)||c.concavity<.2||c.concavity>1.25)throw Error('溶蚀凹陷偏置越界');if(!Number.isFinite(c.spikeGuard)||c.spikeGuard<0||c.spikeGuard>1)throw Error('尖刺抑制参数越界');return true}"
assert old_validate in s
s = s.replace(old_validate, new_validate, 1)

old_cut = "const planes=[(.8*u+.32*v+.65*Z)-e.half[0]*.99,(-.62*u-.22*v-.73*Z)-e.half[0]*1.06,(.50*u+.7*v-.4*Z)-e.half[0]*1.14,(-.63*u+.55*v+.3*Z)-e.half[0]*1.05];for(let p of planes)d=smax(d,p,.7);"
new_cut = "const planes=[(.8*u+.32*v+.65*Z)-e.half[0]*.99,(-.62*u-.22*v-.73*Z)-e.half[0]*1.06,(.50*u+.7*v-.4*Z)-e.half[0]*1.14,(-.63*u+.55*v+.3*Z)-e.half[0]*1.05],sg=clamp(e.spikeGuard??.9);for(let p of planes)d=smax(d,p,.72+.66*sg);let lowerCap=-v-e.half[1]*(.84-.16*sg);d=smax(d,lowerCap,.70+.78*sg);"
assert old_cut in s
s = s.replace(old_cut, new_cut, 1)

old_events = "const events=EVENTS.map((e,i)=>({...e,center:e.center.slice(),half:e.half.slice(),dest:e.dest.slice()}));"
new_events = "const events=EVENTS.map((e,i)=>({...e,center:e.center.slice(),half:e.half.slice(),dest:e.dest.slice(),spikeGuard:c.spikeGuard}));"
assert old_events in s
s = s.replace(old_events, new_events, 1)

geometry_kernel = r'''function microscopeGeometryR2(mesh,options={}){
const W=World,Paccepted=mesh.rest,I=mesh.indices,count=Paccepted.length/3,clamp=W.clamp,smooth=W.smooth;
const strength=options.strength??1.45,concavity=options.concavity??.75,spikeGuard=options.spikeGuard??.90,baseAmp=Number.isFinite(options.amp)?options.amp:.34,requestedAmp=baseAmp*strength,ell=options.scale||5.2,requestedLayers=Math.max(1,Math.min(5,options.layers||3)),gridStep=Math.max(.05,options.gridStep||.5),minimumGeometryScale=gridStep*2,maxGeometryLayers=Math.max(1,1+Math.floor(Math.log2(Math.max(1,ell/minimumGeometryScale)))),layers=Math.min(requestedLayers,maxGeometryLayers),meshSafetyFraction=options.meshSafetyFraction??.16,dir=(options.directionDeg??18)*Math.PI/180,warp=options.warp??.48,smoothing=options.smoothing??.58,seed=options.seed??83;
let P0=new Float32Array(Paccepted),Naccepted=W.normals(Paccepted,I),N0=new Float32Array(Naccepted),minY=Infinity,maxY=-Infinity;
for(let i=0;i<count;i++){let y=Paccepted[i*3+1];minY=Math.min(minY,y);maxY=Math.max(maxY,y)}const span=Math.max(1e-6,maxY-minY);
function mouthProtect(x,y,z,cx,cy,cz,rx,ry,rz){let q=Math.hypot((x-cx)/rx,(y-cy)/ry,(z-cz)/rz),shell=1-smooth(.045,.28,Math.abs(q-1)),front=smooth(cz-2.0,cz+3.4,z);return shell*front}
function protectionGate(i){let k=i*3,x=Paccepted[k],y=Paccepted[k+1],z=Paccepted[k+2],ny=Math.abs(Naccepted[k+1]),t=(y-minY)/span,height=smooth(.105,.205,t)*(1-smooth(.835,.935,t)),wall=smooth(.055,.40,1-ny),cave=mouthProtect(x,y,z,-6,5.4,8.8,6.8,4.7,9),notch=mouthProtect(x,y,z,12,7,8,10,3.7,8);return clamp(height*wall*(1-Math.max(cave,notch)))}
const gate=new Float32Array(count);for(let i=0;i<count;i++)gate[i]=protectionGate(i);
function flipCount(P,Ref){let flips=0;for(let q=0;q<I.length;q+=3){let ia=I[q]*3,ib=I[q+1]*3,ic=I[q+2]*3,ux=P[ib]-P[ia],uy=P[ib+1]-P[ia+1],uz=P[ib+2]-P[ia+2],vx=P[ic]-P[ia],vy=P[ic+1]-P[ia+1],vz=P[ic+2]-P[ia+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,bux=Ref[ib]-Ref[ia],buy=Ref[ib+1]-Ref[ia+1],buz=Ref[ib+2]-Ref[ia+2],bvx=Ref[ic]-Ref[ia],bvy=Ref[ic+1]-Ref[ia+1],bvz=Ref[ic+2]-Ref[ia+2],bnx=buy*bvz-buz*bvy,bny=buz*bvx-bux*bvz,bnz=bux*bvy-buy*bvx;if(nx*bnx+ny*bny+nz*bnz<0)flips++}return flips}
function neighborAverages(P){let sx=new Float64Array(count),sy=new Float64Array(count),sz=new Float64Array(count),w=new Uint16Array(count);function add(a,b){let B=b*3;sx[a]+=P[B];sy[a]+=P[B+1];sz[a]+=P[B+2];w[a]++}for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2];add(a,b);add(a,c);add(b,a);add(b,c);add(c,a);add(c,b)}return{sx,sy,sz,w}}
let antiSpikeAdjustedVertices=0,maxAntiSpikeCorrectionM=0,antiSpikePasses=0;
for(let pass=0;pass<3;pass++){let av=neighborAverages(P0),Q=new Float32Array(P0),moved=0;for(let i=0;i<count;i++){if(gate[i]<.08||!av.w[i])continue;let k=i*3,ax=av.sx[i]/av.w[i],ay=av.sy[i]/av.w[i],az=av.sz[i]/av.w[i],depth=ay-P0[k+1],down=smooth(.04,.72,-N0[k+1]),tip=smooth(.10,.92,depth),f=spikeGuard*down*tip*(.50-pass*.07);if(f<=1e-5)continue;let nx=P0[k]+(ax-P0[k])*f*.20,ny=P0[k+1]+depth*f,nz=P0[k+2]+(az-P0[k+2])*f*.20,dr=Math.hypot(nx-P0[k],ny-P0[k+1],nz-P0[k+2]);Q[k]=nx;Q[k+1]=ny;Q[k+2]=nz;moved++;maxAntiSpikeCorrectionM=Math.max(maxAntiSpikeCorrectionM,dr)}if(!moved)break;if(flipCount(Q,P0)>0)break;P0=Q;N0=W.normals(P0,I);antiSpikeAdjustedVertices+=moved;antiSpikePasses++}
const localScale=new Float32Array(count);localScale.fill(Infinity);function edgeLen(a,b){let A=a*3,B=b*3;return Math.hypot(P0[A]-P0[B],P0[A+1]-P0[B+1],P0[A+2]-P0[B+2])}function safeMin(id,v){if(Number.isFinite(v)&&v>1e-8&&v<localScale[id])localScale[id]=v}
for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2],A=a*3,B=b*3,C=c*3,ab=edgeLen(a,b),bc=edgeLen(b,c),ca=edgeLen(c,a),ux=P0[B]-P0[A],uy=P0[B+1]-P0[A+1],uz=P0[B+2]-P0[A+2],vx=P0[C]-P0[A],vy=P0[C+1]-P0[A+1],vz=P0[C+2]-P0[A+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,area2=Math.hypot(nx,ny,nz);safeMin(a,Math.min(ab,ca,area2/Math.max(bc,1e-9)));safeMin(b,Math.min(ab,bc,area2/Math.max(ca,1e-9)));safeMin(c,Math.min(bc,ca,area2/Math.max(ab,1e-9)))}
let minLocalScale=Infinity,maxLocalScale=0;for(let i=0;i<count;i++){if(!Number.isFinite(localScale[i]))localScale[i]=gridStep;minLocalScale=Math.min(minLocalScale,localScale[i]);maxLocalScale=Math.max(maxLocalScale,localScale[i])}
function detailAt(i){let k=i*3,x=P0[k],y=P0[k+1],z=P0[k+2],th=Math.atan2(z,x),bend=warp*(.34*Math.sin(y*.13)+.21*Math.sin(th*2.1+y*.055)+.18*(W.fbm(x*.035,y*.025,z*.035,seed+607)-.5)),a=dir+bend,ca=Math.cos(a),sa=Math.sin(a),xr=ca*x-sa*z,zr=sa*x+ca*z,broad=W.fbm(xr/ell,y/(ell*1.9),zr/ell,seed+701)-.5,mid=W.fbm(xr/(ell*.5)+3.7,y/(ell*.96)-1.4,zr/(ell*.5)+6.1,seed+719)-.5,fine=W.fbm(xr/(ell*.25)-5.2,y/(ell*.56)+2.8,zr/(ell*.25)-3.1,seed+733)-.5,flow=W.fbm(xr/(ell*.72)+11.0,y/(ell*2.7),zr/(ell*.72)-7.0,seed+811)-.5,d=.94*broad+.52*mid+.17*fine+.31*flow,cavity=Math.max(0,d+.035),rim=Math.exp(-Math.abs(d-.025)*8.2);return d*1.34-concavity*cavity*cavity*1.92+rim*.046-concavity*.040}
function capAt(i){let down=smooth(.04,.72,-N0[i*3+1]);return Math.max(1e-6,localScale[i]*meshSafetyFraction*(1-.48*spikeGuard*down))}
function smoothDisplacement(src){let av=neighborAverages(src),out=new Float32Array(src);for(let i=0;i<count;i++){if(gate[i]<1e-7||!av.w[i]){out[i]=0;continue}let avg=av.sx[i]/av.w[i],v=src[i]*(1-smoothing)+avg*smoothing,down=smooth(.04,.72,-N0[i*3+1]);if(v>0)v*=1-.91*spikeGuard*down;out[i]=clamp(v,-capAt(i),capAt(i))}return out}
function build(A){let raw=new Float32Array(count),clippedVertexCount=0,minAppliedCap=Infinity,maxAppliedCap=0;for(let i=0;i<count;i++){if(gate[i]<1e-7)continue;let v=A*gate[i]*detailAt(i),down=smooth(.04,.72,-N0[i*3+1]);if(v>0)v*=1-.91*spikeGuard*down;let cap=capAt(i),c=clamp(v,-cap,cap);if(Math.abs(c-v)>1e-12)clippedVertexCount++;raw[i]=c;minAppliedCap=Math.min(minAppliedCap,cap);maxAppliedCap=Math.max(maxAppliedCap,cap)}let disp=smoothDisplacement(smoothDisplacement(raw)),P=new Float32Array(P0),sum2=0,maxD=0,protectedCount=0,protectedDrift=0;for(let i=0;i<count;i++){let k=i*3;if(gate[i]<1e-7){protectedCount++;continue}let off=clamp(disp[i],-capAt(i),capAt(i));P[k]=P0[k]+N0[k]*off;P[k+1]=P0[k+1]+N0[k+1]*off;P[k+2]=P0[k+2]+N0[k+2]*off;maxD=Math.max(maxD,Math.abs(off));sum2+=off*off}for(let i=0;i<count;i++)if(gate[i]<1e-7){let k=i*3;if(P[k]!==Paccepted[k]||P[k+1]!==Paccepted[k+1]||P[k+2]!==Paccepted[k+2])protectedDrift++}let flips=flipCount(P,P0);return{P,disp,maxD,rms:Math.sqrt(sum2/count),protectedCount,protectedDrift,flips,clippedVertexCount,minAppliedCap:Number.isFinite(minAppliedCap)?minAppliedCap:0,maxAppliedCap}}
let attempts=[requestedAmp,requestedAmp*.86,requestedAmp*.72,requestedAmp*.56,requestedAmp*.40,requestedAmp*.28,0],attemptReports=[],chosen=null,effectiveAmp=0;for(let A of attempts){let r=build(A);attemptReports.push({amplitudeM:A,maxDisplacementM:r.maxD,rmsDisplacementM:r.rms,triangleFlipCount:r.flips,protectedDriftCount:r.protectedDrift,clippedVertexCount:r.clippedVertexCount});if(r.flips===0&&r.protectedDrift===0){chosen=r;effectiveAmp=A;break}}if(!chosen)throw Error('Microscope R2 geometry safety gate failed');
let N=W.normals(chosen.P,I),maxNormal=0;for(let k=0;k<N.length;k+=3){let d=clamp(N0[k]*N[k]+N0[k+1]*N[k+1]+N0[k+2]*N[k+2],-1,1);maxNormal=Math.max(maxNormal,Math.acos(d)*180/Math.PI)}
mesh.positions=chosen.P;mesh.N=N;mesh.microscopeGeometry={schema:'LANDSCAPE_MICROSCOPE_GEOMETRY_R2',baseAmplitudeM:baseAmp,geometryStrength:strength,requestedAmplitudeM:requestedAmp,effectiveAmplitudeM:effectiveAmp,scaleM:ell,requestedLayers,effectiveLayers:layers,gridStepM:gridStep,minimumGeometryScaleM:minimumGeometryScale,finestGeometryScaleM:ell/Math.pow(2,layers-1),finerScalesRemainSurfaceOnly:layers<requestedLayers,meshSafetyFraction,minLocalMeshScaleM:minLocalScale,maxLocalMeshScaleM:maxLocalScale,clippedVertexCount:chosen.clippedVertexCount,minAppliedCapM:chosen.minAppliedCap,maxAppliedCapM:chosen.maxAppliedCap,attempts:attemptReports,concavity,spikeGuard,smoothing,directionDeg:(options.directionDeg??18),warp,maxDisplacementM:chosen.maxD,rmsDisplacementM:chosen.rms,maxNormalAngleDeg:maxNormal,protectedVertexCount:chosen.protectedCount,protectedDriftCount:chosen.protectedDrift,triangleFlipCount:chosen.flips,antiSpikeAdjustedVertices,maxAntiSpikeCorrectionM,antiSpikePasses,baseTriangleFlipCount:flipCount(P0,Paccepted),referenceDomain:'accepted R5.K2 P0 plus bounded anti-spike correction',cameraAffectsGeometry:false,timeAffectsStaticRock:false,fieldCoupled:false};return mesh.microscopeGeometry}
'''

pattern = re.compile(r"function microscopeGeometryR1\(mesh,options=\{\}\)\{.*?return mesh\.microscopeGeometry\}\n\nfunction generateScene", re.S)
assert pattern.search(s), "R1 geometry kernel boundary not found"
s = pattern.sub(geometry_kernel + "\nfunction generateScene", s, count=1)

old_call = "const geometryAmp=config.stage<2?0:config.stage===2?.12:config.stage===3?.18:.22;const geometryMicroscope=microscopeGeometryR1(main,{amp:geometryAmp,scale:2.6,layers:6,gridStep:step,meshSafetyFraction:.08,directionDeg:18,warp:.42,bias:.32});"
new_call = "const geometryAmp=config.stage<2?0:config.stage===2?.22:config.stage===3?.29:.34;const geometryMicroscope=microscopeGeometryR2(main,{amp:geometryAmp,strength:config.geo,concavity:config.concavity,spikeGuard:config.spikeGuard,scale:5.2,layers:3,gridStep:step,meshSafetyFraction:.16,directionDeg:18,warp:.48,smoothing:.58,seed:config.seed});"
assert old_call in s, "G1 geometry call not found"
s = s.replace(old_call, new_call, 1)

seed_anchor = '<div class="row"><label for="seed">固定种子</label><input id="seed" type="number" min="1" max="99999" value="83"></div>'
geometry_controls = '<div class="row"><label for="geo">真实几何强度</label><output id="geoOut">1.45</output></div><input id="geo" type="range" min=".6" max="2.4" step=".05" value="1.45"><div class="row"><label for="concavity">溶蚀凹陷偏置</label><output id="concavityOut">0.75</output></div><input id="concavity" type="range" min=".2" max="1.25" step=".05" value=".75"><div class="row"><label for="spikeGuard">向下尖刺抑制</label><output id="spikeGuardOut">0.90</output></div><input id="spikeGuard" type="range" min="0" max="1" step=".05" value=".90">' + seed_anchor
assert seed_anchor in s
s = s.replace(seed_anchor, geometry_controls, 1)

old_surface = '<h4>表面 / 不改变宏观几何</h4><div class="row"><label for="scope">Microscope 壳层</label><output id="scopeOut">0.82</output></div><input id="scope" type="range" min="0" max="1.35" step=".05" value=".82"><small>显示壳层继续只改微法线与粗糙度；另有真实几何位移核只作用于主岩体非保护区，峰顶、峰脚和主洞口保持冻结。</small><div class="row"><label for="micro">Brick 微表面</label><output id="microOut">0.70</output></div><input id="micro" type="range" min="0" max="1.4" step=".05" value=".70"><div class="row"><label for="wet">湿润外观</label><output id="wetOut">0.00</output></div>'
new_surface = '<h4>表面 / 实时调节</h4><div class="row"><label for="scope">Microscope 壳层强度</label><output id="scopeOut">1.55</output></div><input id="scope" type="range" min=".6" max="3.0" step=".05" value="1.55"><div class="row"><label for="shellScale">壳层尺度</label><output id="shellScaleOut">0.82</output></div><input id="shellScale" type="range" min=".4" max="2.4" step=".05" value=".82"><div class="row"><label for="shellContrast">壳层对比</label><output id="shellContrastOut">1.65</output></div><input id="shellContrast" type="range" min=".5" max="3" step=".05" value="1.65"><div class="row"><label for="shellCoverage">壳层覆盖率</label><output id="shellCoverageOut">0.88</output></div><input id="shellCoverage" type="range" min=".15" max="1" step=".05" value=".88"><div class="row"><label for="shellDirection">壳层方向</label><output id="shellDirectionOut">18°</output></div><input id="shellDirection" type="range" min="-180" max="180" step="1" value="18"><small>真实几何负责米级与分米级形状；壳层只承担网格以下细节。峰顶、峰脚和主洞口继续冻结。</small><div class="row"><label for="micro">Breakaway / Brick 微表面</label><output id="microOut">1.80</output></div><input id="micro" type="range" min="1.4" max="4" step=".05" value="1.80"><div class="row"><label for="breakContrast">Breakaway 表面对比</label><output id="breakContrastOut">1.60</output></div><input id="breakContrast" type="range" min="1" max="3.5" step=".05" value="1.60"><div class="buttons"><button data-surface="soft">柔和</button><button data-surface="standard" class="active">标准</button><button data-surface="strong">强</button><button data-surface="extreme">极强</button></div><div class="row"><label for="wet">湿润外观</label><output id="wetOut">0.00</output></div>'
assert old_surface in s
s = s.replace(old_surface, new_surface, 1)

old_uniform = "uniform vec3 uEye;uniform float uExposure,uWet,uMicro,uScope;uniform int uMode,uSection,uSelect;uniform float uStage;"
new_uniform = "uniform vec3 uEye;uniform float uExposure,uWet,uMicro,uScope,uShellScale,uShellContrast,uShellCoverage,uShellDirection,uBreakContrast;uniform int uMode,uSection,uSelect;uniform float uStage;"
assert old_uniform in s
s = s.replace(old_uniform, new_uniform, 1)

mm_anchor = "float mmSurface(vec3 rawQ){return mmOrganicData(rawQ).x;}"
mm_controlled = r'''vec3 mmControlledData(vec3 rawQ){
  float a=radians(uShellDirection),ca=cos(a),sa=sin(a);
  vec3 r=vec3(ca*rawQ.x-sa*rawQ.z,rawQ.y,sa*rawQ.x+ca*rawQ.z)*max(.2,uShellScale);
  vec3 m=mmOrganicData(r);
  float zone=bmN(rawQ*.031+vec3(23.7,-8.4,16.2));
  float edge=clamp(1.-uShellCoverage,0.,.85);
  float coverage=smoothstep(edge,min(1.,edge+.24),zone);
  m.x=tanh(m.x*uShellContrast)*coverage;
  m.y*=coverage;m.z*=coverage;
  return m;
}
float mmSurface(vec3 rawQ){return mmControlledData(rawQ).x;}'''
assert mm_anchor in s
s = s.replace(mm_anchor, mm_controlled, 1)

s = s.replace("float field=bmSum(mq*(family==5?36.:family==6?38.4:33.6));", "float field=bmSum(mq*(family==5?36.:family==6?38.4:33.6))*uBreakContrast;", 1)
s = s.replace("vec3 mmData=mmOrganicData(q),mmFineData=mmOrganicData(q*1.37+vec3(2.9,-1.7,4.1));float mmLo=mmData.x,mmFine=mmFineData.x;float shell=(d.x<2.5?1.:0.)*uScope;float height=field*.011+(grain-.5)*.0042+shell*(mmLo*.0072+mmFine*.0026);", "vec3 mmData=mmControlledData(q),mmFineData=mmControlledData(q*1.37+vec3(2.9,-1.7,4.1));float mmLo=mmData.x,mmFine=mmFineData.x;float shell=(d.x<2.5?1.:0.)*uScope;float height=field*.0125+(grain-.5)*.0048*uBreakContrast+shell*(mmLo*.0132+mmFine*.0058);", 1)
s = s.replace("if(uMode==3){frag=vec4(normalize(n0)*.5+.5,1.);return;}if(uMode==4){frag=vec4(mix(vec3(.22,.25,.22),vec3(.19,.66,.89),clamp(e.z,0.,1.)),1.);return;}if(uMode==5){vec3 m=mmOrganicData(q);float v=clamp(.50+.33*m.x-.23*m.y+.18*m.z,0.,1.);frag=vec4(vec3(v),1.);return;}", "if(uMode==3){frag=vec4(normalize(n0)*.5+.5,1.);return;}if(uMode==4){frag=vec4(mix(vec3(.22,.25,.22),vec3(.19,.66,.89),clamp(e.z,0.,1.)),1.);return;}if(uMode==5){vec3 m=mmControlledData(q);float v=clamp(.50+.42*m.x-.28*m.y+.23*m.z,0.,1.);frag=vec4(vec3(v),1.);return;}", 1)

s = s.replace("let recipe={schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1};", "let recipe={schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1,geo:1.45,concavity:.75,spikeGuard:.90};", 1)
s = s.replace("let state={theta:.50,phi:1.26,radius:116,target:[-3,20,0],mode:0,section:false,scope:.82,micro:.70,wet:0,exposure:1.08,grass:true,selected:0}", "let state={theta:.50,phi:1.26,radius:116,target:[-3,20,0],mode:0,section:false,scope:1.55,shellScale:.82,shellContrast:1.65,shellCoverage:.88,shellDirection:18,micro:1.80,breakContrast:1.60,wet:0,exposure:1.08,grass:true,selected:0}", 1)
old_u = "for(let k of ['uVP','uEye','uExposure','uWet','uMicro','uScope','uMode','uSection','uSelect','uStage'])"
new_u = "for(let k of ['uVP','uEye','uExposure','uWet','uMicro','uScope','uShellScale','uShellContrast','uShellCoverage','uShellDirection','uBreakContrast','uMode','uSection','uSelect','uStage'])"
assert old_u in s
s = s.replace(old_u, new_u, 1)

old_build_validation = "async function build(newRecipe){if(!newRecipe||Object.keys(newRecipe).sort().join(',')!=='core,fracture,relief,schema,seed,stage')throw Error('配方含缺失或未支持字段');if(!newRecipe||newRecipe.core!==recipe.core||newRecipe.schema!==recipe.schema)throw Error('配方版本不匹配');if(!Number.isInteger(newRecipe.stage)||newRecipe.stage<0||newRecipe.stage>4)throw Error('阶段无效');for(let k of ['fracture','relief'])if(!Number.isFinite(newRecipe[k])||newRecipe[k]<0||newRecipe[k]>1.5)throw Error('参数无效');if(!Number.isInteger(newRecipe.seed)||newRecipe.seed<1||newRecipe.seed>99999)throw Error('种子无效');"
new_build_validation = "async function build(newRecipe){if(!newRecipe||Object.keys(newRecipe).sort().join(',')!=='concavity,core,fracture,geo,relief,schema,seed,spikeGuard,stage')throw Error('配方含缺失或未支持字段');if(!newRecipe||newRecipe.core!==recipe.core||newRecipe.schema!==recipe.schema)throw Error('配方版本不匹配');if(!Number.isInteger(newRecipe.stage)||newRecipe.stage<0||newRecipe.stage>4)throw Error('阶段无效');for(let k of ['fracture','relief'])if(!Number.isFinite(newRecipe[k])||newRecipe[k]<0||newRecipe[k]>1.5)throw Error('参数无效');if(!Number.isFinite(newRecipe.geo)||newRecipe.geo<.6||newRecipe.geo>2.4||!Number.isFinite(newRecipe.concavity)||newRecipe.concavity<.2||newRecipe.concavity>1.25||!Number.isFinite(newRecipe.spikeGuard)||newRecipe.spikeGuard<0||newRecipe.spikeGuard>1)throw Error('几何调节参数越界');if(!Number.isInteger(newRecipe.seed)||newRecipe.seed<1||newRecipe.seed>99999)throw Error('种子无效');"
assert old_build_validation in s
s = s.replace(old_build_validation, new_build_validation, 1)

old_draw = "gl.uniform1f(U.uMicro,state.micro);gl.uniform1f(U.uScope,state.scope);gl.uniform1f(U.uStage,recipe.stage);"
new_draw = "gl.uniform1f(U.uMicro,state.micro);gl.uniform1f(U.uScope,state.scope);gl.uniform1f(U.uShellScale,state.shellScale);gl.uniform1f(U.uShellContrast,state.shellContrast);gl.uniform1f(U.uShellCoverage,state.shellCoverage);gl.uniform1f(U.uShellDirection,state.shellDirection);gl.uniform1f(U.uBreakContrast,state.breakContrast);gl.uniform1f(U.uStage,recipe.stage);"
assert old_draw in s
s = s.replace(old_draw, new_draw, 1)

old_sync = "function sync(){$('#seedLabel').textContent='种子 '+recipe.seed;for(let k of ['scope','micro','wet','exposure']){$('#'+k).value=state[k];$('#'+k+'Out').textContent=state[k].toFixed(2)}for(let k of ['fracture','relief']){$('#'+k).value=recipe[k];$('#'+k+'Out').textContent=recipe[k].toFixed(2)}"
new_sync = "function sync(){$('#seedLabel').textContent='种子 '+recipe.seed;for(let k of ['scope','shellScale','shellContrast','shellCoverage','micro','breakContrast','wet','exposure']){$('#'+k).value=state[k];$('#'+k+'Out').textContent=state[k].toFixed(2)}$('#shellDirection').value=state.shellDirection;$('#shellDirectionOut').textContent=Math.round(state.shellDirection)+'°';for(let k of ['fracture','relief','geo','concavity','spikeGuard']){$('#'+k).value=recipe[k];$('#'+k+'Out').textContent=recipe[k].toFixed(2)}"
assert old_sync in s
s = s.replace(old_sync, new_sync, 1)

old_restore = "if(!v||Object.keys(v).sort().join(',')!=='exposure,grass,micro,mode,phi,radius,scope,section,selected,target,theta,wet')throw Error('视图字段无效');"
new_restore = "if(!v||Object.keys(v).sort().join(',')!=='breakContrast,exposure,grass,micro,mode,phi,radius,scope,section,selected,shellContrast,shellCoverage,shellDirection,shellScale,target,theta,wet')throw Error('视图字段无效');"
assert old_restore in s
s = s.replace(old_restore, new_restore, 1)
old_numbers = "for(let k of ['theta','phi','radius','scope','micro','wet','exposure'])if(!Number.isFinite(v[k]))throw Error('显示参数无效');if(v.phi<.04||v.phi>3.10||v.radius<2||v.radius>1000||v.scope<0||v.scope>1.35||v.micro<0||v.micro>1.4||v.wet<0||v.wet>1||v.exposure<.65||v.exposure>1.5||!Number.isInteger(v.mode)||v.mode<0||v.mode>5||typeof v.section!=='boolean'||typeof v.grass!=='boolean')throw Error('显示参数越界');"
new_numbers = "for(let k of ['theta','phi','radius','scope','shellScale','shellContrast','shellCoverage','shellDirection','micro','breakContrast','wet','exposure'])if(!Number.isFinite(v[k]))throw Error('显示参数无效');if(v.phi<.04||v.phi>3.10||v.radius<2||v.radius>1000||v.scope<.6||v.scope>3||v.shellScale<.4||v.shellScale>2.4||v.shellContrast<.5||v.shellContrast>3||v.shellCoverage<.15||v.shellCoverage>1||v.shellDirection<-180||v.shellDirection>180||v.micro<1.4||v.micro>4||v.breakContrast<1||v.breakContrast>3.5||v.wet<0||v.wet>1||v.exposure<.65||v.exposure>1.5||!Number.isInteger(v.mode)||v.mode<0||v.mode>5||typeof v.section!=='boolean'||typeof v.grass!=='boolean')throw Error('显示参数越界');"
assert old_numbers in s
s = s.replace(old_numbers, new_numbers, 1)

old_controls = "for(let k of ['scope','micro','wet','exposure'])$('#'+k).oninput=e=>{state[k]=+e.target.value;$('#'+k+'Out').textContent=state[k].toFixed(2);dirty=true};for(let k of ['fracture','relief'])$('#'+k).oninput=e=>$('#'+k+'Out').textContent=(+e.target.value).toFixed(2);"
new_controls = "for(let k of ['scope','shellScale','shellContrast','shellCoverage','micro','breakContrast','wet','exposure'])$('#'+k).oninput=e=>{state[k]=+e.target.value;$('#'+k+'Out').textContent=state[k].toFixed(2);dirty=true};$('#shellDirection').oninput=e=>{state.shellDirection=+e.target.value;$('#shellDirectionOut').textContent=Math.round(state.shellDirection)+'°';dirty=true};for(let k of ['fracture','relief','geo','concavity','spikeGuard'])$('#'+k).oninput=e=>$('#'+k+'Out').textContent=(+e.target.value).toFixed(2);const surfacePresets={soft:{scope:.85,shellScale:1.15,shellContrast:.85,shellCoverage:.62,micro:1.4,breakContrast:1.05},standard:{scope:1.55,shellScale:.82,shellContrast:1.65,shellCoverage:.88,micro:1.8,breakContrast:1.6},strong:{scope:2.15,shellScale:.67,shellContrast:2.15,shellCoverage:.94,micro:2.55,breakContrast:2.25},extreme:{scope:2.75,shellScale:.54,shellContrast:2.75,shellCoverage:1,micro:3.45,breakContrast:3.10}};$$('[data-surface]').forEach(b=>b.onclick=()=>{Object.assign(state,surfacePresets[b.dataset.surface]);$$('[data-surface]').forEach(x=>x.classList.toggle('active',x===b));sync()});"
assert old_controls in s
s = s.replace(old_controls, new_controls, 1)

old_apply = "$('#apply').onclick=()=>{build({...recipe,fracture:+$('#fracture').value,relief:+$('#relief').value,seed:+$('#seed').value}).catch(e=>toast(e.message));"
new_apply = "$('#apply').onclick=()=>{build({...recipe,fracture:+$('#fracture').value,relief:+$('#relief').value,geo:+$('#geo').value,concavity:+$('#concavity').value,spikeGuard:+$('#spikeGuard').value,seed:+$('#seed').value}).catch(e=>toast(e.message));"
assert old_apply in s
s = s.replace(old_apply, new_apply, 1)

old_reset = "$('#reset').onclick=()=>{state={...state,scope:.82,micro:.70,wet:0,exposure:1.08,mode:0,section:false,grass:true,selected:0};"
new_reset = "$('#reset').onclick=()=>{state={...state,scope:1.55,shellScale:.82,shellContrast:1.65,shellCoverage:.88,shellDirection:18,micro:1.80,breakContrast:1.60,wet:0,exposure:1.08,mode:0,section:false,grass:true,selected:0};"
assert old_reset in s
s = s.replace(old_reset, new_reset, 1)

old_setmaterial = "setMaterial(o){for(let k of ['scope','micro','wet','exposure'])if(k in o)state[k]=o[k];sync()}"
new_setmaterial = "setMaterial(o){for(let k of ['scope','shellScale','shellContrast','shellCoverage','shellDirection','micro','breakContrast','wet','exposure'])if(k in o)state[k]=o[k];sync()}"
assert old_setmaterial in s
s = s.replace(old_setmaterial, new_setmaterial, 1)

s = s.replace("R5.K2.G1", "R5.K2.G2", 3)
s = s.replace("Organic Microscope + Real Geometry", "Stronger Geometry + Tunable Microscope", 1)
s = s.replace("R5.K2.G1 在不可变 P0 上增加受门控的真实顶点位移", "R5.K2.G2 在认可主形上增加网格带宽内的三档真实几何、局部尖刺抑制与可调壳层", 1)

assert "microscopeGeometryR2" in s
assert "uShellContrast" in s
assert "id=\"geo\"" in s
assert "data-surface=\"extreme\"" in s

OUT.parent.mkdir(parents=True, exist_ok=True)
out = s.encode("utf-8")
OUT.write_bytes(out)

build = {
    "schema": "LANDSCAPE_R5_K2_G2_STRONGER_GEOMETRY_TUNING_V1",
    "date": "2026-09-17",
    "sourcePath": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "candidatePath": str(OUT.relative_to(ROOT)),
    "candidateSha256": sha256(out),
    "candidateBytes": len(out),
    "geometry": {
        "defaultStrength": 1.45,
        "defaultConcavity": 0.75,
        "defaultSpikeGuard": 0.90,
        "baseAmplitudeM": 0.34,
        "nominalAmplitudeM": 0.493,
        "scaleM": 5.2,
        "requestedLayers": 3,
        "expectedEffectiveLayers": 3,
        "meshSafetyFraction": 0.16,
        "smoothing": 0.58,
        "downwardNeedlePolicy": "rounded breakaway cutter + three bounded one-ring tip suppression passes + outward displacement suppression on downward normals",
    },
    "surface": {
        "scopeDefault": 1.55,
        "scopeRange": [0.6, 3.0],
        "microDefault": 1.8,
        "microRange": [1.4, 4.0],
        "breakContrastDefault": 1.6,
        "breakContrastRange": [1.0, 3.5],
        "controls": ["shellScale", "shellContrast", "shellCoverage", "shellDirection", "breakContrast", "surfacePresets"],
    },
    "macroGeometryReplacement": False,
    "cameraAffectsGeometry": False,
    "timeAffectsStaticRock": False,
    "geometryFieldCoupled": False,
    "visualApproved": False,
    "productionReady": False,
}
BUILD.write_text(json.dumps(build, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(build, ensure_ascii=False))
