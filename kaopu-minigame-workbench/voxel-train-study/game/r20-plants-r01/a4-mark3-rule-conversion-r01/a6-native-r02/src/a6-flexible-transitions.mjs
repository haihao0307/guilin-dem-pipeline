/** Independent thin-wall endpoint-constrained inter-vehicle shrouds, native A6 R02.
 * Kinematic geometry deformation only: material loads/strain are not solved.
 * The underside remains open; original drawgear and the static adapter stay visible.
 */
import {transformA6Point} from './a6-coupling-motion.mjs';
import {createA6ShellSampler} from './a6-locomotive-shell.mjs';
import {A6_COACH_DEFAULTS,sampleA6CoachSurface} from './a6-coach-shell.mjs';
import {A6_TENDER_DEFAULTS,sampleTenderHalfWidth} from './a6-tender-shell.mjs';
import {A6Mesh,range,unit,sub,mul,cross,boundsOf,smooth} from './a6-shell-geometry.mjs';
const HEM=1.72,WALL=.016,END_GAP=.006;
const lerp=(a,b,t)=>a+(b-a)*t;
function endpoints(crownHeight,coachOffsetZ){
  const loco=createA6ShellSampler({topHeight:crownHeight}),ls=loco.sectionAt(12.10),tp={...A6_TENDER_DEFAULTS,crownHeight},cp={...A6_COACH_DEFAULTS,crownHeight};
  const tenderScale=1-tp.endSectionInset/(tp.width/2),pivot=(tp.bottom+crownHeight)/2;
  const tenderShoulder=pivot+(tp.sideTop-pivot)*tenderScale,tenderCrown=pivot+(crownHeight-pivot)*tenderScale;
  const make=(kind,z,shoulder,crown,side,roof)=>({kind,z,hem:HEM,shoulder,crown,side,roof,sectionCache:new Map()});
  const a=make('actual-locomotive-rear-section',12.10,ls.shoulder,ls.crown,(sign,y)=>[sign*loco.halfWidthAt(y,12.1),y,12.1],t=>loco.surfacePoint(12.1,Math.PI/2-t*Math.PI));
  const tenderEnd=z=>make('actual-rounded-tender-end-section',z,tenderShoulder,tenderCrown,(sign,y)=>[sign*sampleTenderHalfWidth(y,z,tp),y,z],t=>{
    const theta=t*Math.PI,baseY=tp.sideTop+(crownHeight-tp.sideTop)*Math.sin(theta);
    return [tp.width/2*Math.cos(theta)*tenderScale,pivot+(baseY-pivot)*tenderScale,z];
  });
  const local=-cp.bodyLength/2,coachTip=coachOffsetZ+local-cp.aeroInterfaceLength,coachScale=.975;
  const c=make('actual-coach-front-aero-tip',coachTip,1.60+(cp.sideTop-1.60)*coachScale,1.60+(crownHeight-1.60)*coachScale,(sign,y)=>{
    const q=sampleA6CoachSurface(cp,'side',local,1.60+(y-1.60)/coachScale,sign).point;
    return [q[0]*coachScale,y,coachTip];
  },t=>{const q=sampleA6CoachSurface(cp,'roof',local,t*Math.PI).point;return[q[0]*coachScale,1.60+(q[1]-1.60)*coachScale,coachTip];});
  return [{id:'locomotive-tender',from:a,to:tenderEnd(tp.zStart),folds:4},{id:'tender-coach',from:tenderEnd(tp.zStart+tp.length),to:c,folds:2}];
}
function sectionPoint(section,s){
  const key=s.toFixed(12);if(section.sectionCache.has(key))return section.sectionCache.get(key);
  const p=s<=.2?section.side(1,lerp(HEM,section.shoulder,s/.2)):
    s>=.8?section.side(-1,lerp(section.shoulder,HEM,(s-.8)/.2)):section.roof((s-.2)/.6);
  section.sectionCache.set(key,p);return p;
}

function makeSampler(pair,crownHeight,couplingPose=null){
  const z0=pair.from.z+END_GAP,z1=pair.to.z-END_GAP,sampleCache=new Map();
  function outer(t,s){
    const a=sectionPoint(pair.from,s),b=sectionPoint(pair.to,s),u=smooth(t),baseCrown=lerp(pair.from.crown,pair.to.crown,u),e=Math.sin(Math.PI*t)**2;
    const fold=1-.008*e*(.5-.5*Math.cos(2*Math.PI*pair.folds*t)),baseY=lerp(a[1],b[1],u),roofWeight=Math.max(0,(baseY-HEM)/(baseCrown-HEM))**3;
    const rest=[lerp(a[0],b[0],u)*fold,HEM+(baseY-HEM)*fold+e*(crownHeight-baseCrown)*roofWeight,lerp(z0,z1,t)];
    if(!couplingPose||pair.id!=='tender-coach')return rest;
    const moved=transformA6Point(rest,couplingPose.transforms.coachDesign);
    // Zero slope in blend weight at both rims: front remains tangent to the
    // fixed tender and rear inherits the complete coach rigid transform.
    return rest.map((v,i)=>v+u*(moved[i]-v));
  }
  function point(t,s,inside=false){
    const p=outer(t,s);if(!inside)return p;
    const h=1e-5,s0=Math.max(0,s-h),s1=Math.min(1,s+h),t0=Math.max(0,t-h),t1=Math.min(1,t+h),ds=sub(outer(t,s1),outer(t,s0)),dt=sub(outer(t1,s),outer(t0,s)),n=unit(cross(ds,dt));
    return sub(p,mul(n,WALL));
  }
  function sample(t,s,inside=false){
    const cacheKey=`${t.toFixed(12)}:${s.toFixed(12)}:${inside}`;if(sampleCache.has(cacheKey))return sampleCache.get(cacheKey);
    const h=1e-5,t0=Math.max(0,t-h),t1=Math.min(1,t+h),s0=Math.max(0,s-h),s1=Math.min(1,s+h),ds=sub(point(t,s1,inside),point(t,s0,inside)),dt=sub(point(t1,s,inside),point(t0,s,inside));
    const result={point:point(t,s,inside),normal:mul(unit(cross(ds,dt)),inside?-1:1),uv:[t*(z1-z0),s*6]};sampleCache.set(cacheKey,result);return result;
  }
  function diagnostics(){let minLongitudinalDerivative=Infinity,minJacobian=Infinity,maxWallThicknessError=0;for(let i=0;i<=16;i++)for(let j=0;j<=24;j++){const t=i/16,s=j/24,h=1e-4,t0=Math.max(0,t-h),t1=Math.min(1,t+h),s0=Math.max(0,s-h),s1=Math.min(1,s+h),dt=mul(sub(outer(t1,s),outer(t0,s)),1/(t1-t0)),ds=mul(sub(outer(t,s1),outer(t,s0)),1/(s1-s0));minLongitudinalDerivative=Math.min(minLongitudinalDerivative,dt[2]);minJacobian=Math.min(minJacobian,Math.hypot(...cross(ds,dt)));maxWallThicknessError=Math.max(maxWallThicknessError,Math.abs(Math.hypot(...sub(point(t,s),point(t,s,true)))-WALL));}return {sampleCount:17*25,minLongitudinalDerivative,minJacobian,maxWallThicknessError,localFoldDetected:minLongitudinalDerivative<=0||minJacobian<1e-8,scope:'sampled parametric regularity and normal-inset thickness; not global self-intersection or material-strain certification'};}
  return {point,sample,z0,z1,diagnostics,articulated:!!couplingPose&&pair.id==='tender-coach'};
}
function wallPart(pair,sampler,t0,t1,material,label){
  const mesh=new A6Mesh(`a6-flexible-${pair.id}-${label}`,material,'flexible-transition-shroud',{
    assembly:'independent-flexible-looking-shroud',staticDesign:!sampler.articulated,articulationValidated:false,endpointKinematicGeometrySolved:sampler.articulated,originalMechanicalComponent:false,
    openUnderside:true,hemY:HEM,wallThicknessM:WALL,thicknessMeaning:'cross-section normal inset; not a certified material gauge',
    construction:'smoothly morphed U-section with shallow corrugations, true 3D normal-inset inner wall and sealed perimeter; articulated pair uses exact endpoint-transform blend',
    isRigidWeldedConnection:false,hiddenWithExteriorShell:true,interface:pair.id
  });
  const steps=Math.max(3,Math.ceil((t1-t0)*56)),ts=range(t0,t1,steps),ss=[...range(0,.2,16).slice(0,-1),...range(.2,.8,64).slice(0,-1),...range(.8,1,16)];
  for(const inside of [false,true])for(let i=0;i<ts.length-1;i++)for(let j=0;j<ss.length-1;j++)mesh.quad([sampler.sample(ts[i],ss[j],inside),sampler.sample(ts[i+1],ss[j],inside),sampler.sample(ts[i+1],ss[j+1],inside),sampler.sample(ts[i],ss[j+1],inside)]);
  for(const [t,sign]of [[t0,-1],[t1,1]])for(let j=0;j<ss.length-1;j++){const q=[sampler.point(t,ss[j]),sampler.point(t,ss[j+1]),sampler.point(t,ss[j+1],true),sampler.point(t,ss[j],true)];mesh.quad(q.map((point,i)=>{let normal=unit(cross(sub(q[1],q[0]),sub(q[3],q[0])));if(normal[2]*sign<0)normal=mul(normal,-1);return {point,normal,uv:[[0,0],[1,0],[1,WALL],[0,WALL]][i]};}));}
  for(const s of [0,1])for(let i=0;i<ts.length-1;i++){const q=[sampler.point(ts[i],s),sampler.point(ts[i+1],s),sampler.point(ts[i+1],s,true),sampler.point(ts[i],s,true)],n=unit(cross(sub(q[1],q[0]),sub(q[3],q[0])));if(n[1]>0)for(let k=0;k<3;k++)n[k]*=-1;mesh.quad(q.map((point,j)=>({point,normal:n,uv:[[0,0],[1,0],[1,WALL],[0,WALL]][j]})));}
  return mesh.finish();
}
export function buildA6FlexibleTransitions(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected flexible transition parameters');
  for(const key of Object.keys(input))if(!['crownHeight','coachOffsetZ','couplingPose'].includes(key))throw new RangeError(`Unknown flexible transition parameter: ${key}`);
  const crownHeight=input.crownHeight??4.03,coachOffsetZ=input.coachOffsetZ??32.34,couplingPose=input.couplingPose??null;
  if(couplingPose&&(couplingPose.schema!=='kaopu.a6-planar-coupling-pose/1.0'||couplingPose.parameters.coachOffsetZ!==coachOffsetZ||!couplingPose.transforms?.coachDesign?.position?.every(Number.isFinite)||!Number.isFinite(couplingPose.transforms.coachDesign.yawRad)))throw new RangeError('Expected a solved coupling pose with matching rest offset');
  if(!Number.isFinite(crownHeight)||crownHeight<3.98||crownHeight>4.15||!Number.isFinite(coachOffsetZ)||coachOffsetZ<32.15||coachOffsetZ>32.60)throw new RangeError('Flexible transition outside current static design range');
  const pairs=endpoints(crownHeight,coachOffsetZ),parts=[],interfaces=[];
  for(const pair of pairs){
    const sampler=makeSampler(pair,crownHeight,couplingPose),halfSeam=.012/(sampler.z1-sampler.z0);
    if(sampler.z1<=sampler.z0+.10)throw new RangeError('Insufficient transition space');
    parts.push(wallPart(pair,sampler,0,.5-halfSeam,'paint','forward-flex-panel'),wallPart(pair,sampler,.5-halfSeam,.5+halfSeam,'rubber','recessed-soft-seam'),wallPart(pair,sampler,.5+halfSeam,1,'paint','rear-flex-panel'));
    interfaces.push({id:pair.id,fromActualShellZ:pair.from.z,toActualShellZ:pair.to.z,generatedZ:[sampler.z0,sampler.z1],endFaceGapM:END_GAP,endpointSectionKinds:[pair.from.kind,pair.to.kind],endpointCrowns:[pair.from.crown,pair.to.crown],commonCrownParameter:crownHeight,hemY:HEM,openUnderside:true,foldCount:pair.folds,normalInsetWallM:WALL,staticAppearanceOnly:!sampler.articulated,endpointKinematicGeometrySolved:sampler.articulated,articulationValidated:false,endpointBlend:'quintic smooth position blend; exact fixed front and coach-transformed rear rims',rearEndpointTransform:sampler.articulated?couplingPose.transforms.coachDesign:null,deformationDiagnostics:sampler.diagnostics()});
  }
  return {schema:'kaopu.a6-native-flexible-transition/2.0',parts,parameters:{crownHeight,coachOffsetZ,coachYawDeg:couplingPose?.parameters.coachYawDeg??0},bounds:boundsOf(parts),interfaces,
    metadata:{purpose:'Visible independent streamlined upper/side transitions with endpoint-constrained tender-coach deformation',provisional:true,staticDesign:!couplingPose,endpointKinematicGeometrySolved:!!couplingPose,articulationValidated:false,originalMechanicsChanged:false,keepOriginalLinksVisible:true,sourcePointOrResidualBytes:0,reference:'Actual first side/three-quarter render gap review; endpoint shapes sampled from native generators',limitations:'Endpoint-constrained surface geometry only. Material strain, flex fatigue, loads, operating turns and coupler compatibility are not certified. Actual-mesh interference must be checked per pose.'}};
}
