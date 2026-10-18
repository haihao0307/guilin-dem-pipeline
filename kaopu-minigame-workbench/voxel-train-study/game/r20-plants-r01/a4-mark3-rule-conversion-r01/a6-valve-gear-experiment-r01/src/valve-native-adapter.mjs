/** Full finite native geometry experiment; frozen R02 remains read-only. */
import {createValveConstraintModel,evaluateValveConstraints,validateValveConstraintCycle} from './valve-constraints.mjs';
import {mesh,cuboid,beam,cylinder,annulus,sector,eyeLink,finish} from './valve-native-primitives.mjs';
import {extrudedDieWithBore} from './valve-native-primitives.mjs';
const TAU=2*Math.PI;
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const norm=a=>Math.hypot(...a);
const angle=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
const rot=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const xyz=(x,p)=>[x,p[0],p[1]];
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function rigid(a,oldPivot,newPivot=oldPivot){
  if(Math.abs(a)<1e-14&&oldPivot.every((v,i)=>Math.abs(v-newPivot[i])<1e-14))return identity();
  const c=Math.cos(a),s=Math.sin(a);
  return [1,0,0,0,0,c,s,0,0,-s,c,0,newPivot[0]-oldPivot[0],newPivot[1]-c*oldPivot[1]+s*oldPivot[2],newPivot[2]-s*oldPivot[1]-c*oldPivot[2],1];
}
export const VALVE_NATIVE_DESIGN=Object.freeze({
  lowPlaneM:1.292,highPlaneM:1.342,plateDepthM:.035,
  expansionSlotHalfWidthM:.030,expansionDieHalfWidthM:.028,expansionDieHalfAngleRad:.024,
  liftingSlotHalfWidthM:.030,liftingDieHalfWidthM:.028,liftingDieHalfLengthM:.026,
  dieDepthM:.031,dieBoreRadiusM:.020,diePinRadiusM:.018,
  pinRunningRadialGapM:.002,designStatus:'explicit native design assumptions; no historical dimension claim',
});
function translated(part,delta){return {...part,positions:part.positions.map((v,i)=>v+delta[i%3]),normals:[...part.normals],uvs:[...part.uvs],indices:[...part.indices],metadata:{...part.metadata,experimentRevision:'rigid rest-placement correction',restTranslationM:delta}};}
function bounds(part){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<part.positions.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],part.positions[i+k]);max[k]=Math.max(max[k],part.positions[i+k]);}return{min,max};}
function maxRadius(part,pivot){let r=0;for(let i=0;i<part.positions.length;i+=3)r=Math.max(r,Math.hypot(part.positions[i+1]-pivot[1],part.positions[i+2]-pivot[2]));return r;}
function rectangleYZ(center,t,halfLength,halfWidth){const n=[-t[1],t[0]];return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>add(center,add(mul(t,a*halfLength),mul(n,b*halfWidth))));}
function curvedDieBoundary(center,r,theta,halfAngle,halfWidth){const out=[],N=24;for(let i=0;i<=N;i++)out.push(add(center,rot([r+halfWidth,0],theta-halfAngle+2*halfAngle*i/N)));for(let i=0;i<=N;i++)out.push(add(center,rot([r-halfWidth,0],theta+halfAngle-2*halfAngle*i/N)));return out;}

export function createValveNativeAdapter({baseModel}={}){
  if(!baseModel?.sourceMechanics?.motionDesign?.workingCylinders)throw Error('The corrected frozen R02 working-cylinder model is required');
  const p=baseModel.parameters;
  if(p.crossheadZ!==2.49||p.cylinderHeight!==1.016||p.crankRadius!==.3302||p.driveDiameter!==2.032||Math.abs(baseModel.rodLength-Math.hypot(3.3012,.3302))>1e-12)throw Error('R02 fixed chassis/main-rod interfaces must not change');
  const constraints=createValveConstraintModel(),reference=evaluateValveConstraints(constraints,0).joints,d=VALVE_NATIVE_DESIGN;
  const originals=new Map(baseModel.sourceMechanics.parts.map(part=>[part.name,part])),replacementParts={},supplementalParts=[],descriptors=[],corrections=[],allowedContacts=[];
  const note=(a,b,reason)=>allowedContacts.push({pair:[a,b],reason});
  const register=(name,build,{kind=null,plane=d.highPlaneM,side,extra={},replacement=true,metadata={}}={})=>{
    const m=mesh(name,'brushedMetal');build(m);
    const part=finish(m,{assembly:'experimental-outside-valve-gear',designStatus:d.designStatus,sourceRuntimeDependencies:[],sourceAnimationChannelsUsed:0,...metadata});
    if(replacement){if(!originals.has(name))throw Error(`Missing inherited component ${name}`);replacementParts[name]=part;corrections.push({name,kind:'explicit-same-name-native-finite-geometry-revision',oldVertexCount:originals.get(name).positions.length/3,newVertexCount:part.positions.length/3,oldGeometryRetainedIn:'../a6-native-r02',reason:metadata.reason??'Replace non-closing reference by solved joint/slot geometry; no old-mesh scaling'});}else supplementalParts.push(part);
    if(kind)descriptors.push({name,part,kind,side,plane,...extra});return part;
  };
  for(const side of[-1,1]){
    const low=side*d.lowPlaneM,high=side*d.highPlaneM,cc=side*p.cylinderHalfSeparation,
      at=(v,plane=low)=>xyz(plane,v),s=String(side),depth=d.plateDepthM;
    const pin=(m,point,a,b,r)=>cylinder(m,at(point,side*a),at(point,side*b),r,40);
    register(`return-crank-${s}`,m=>{
      eyeLink(m,at(reference.P),at(reference.E),{depth,width:.045,outerA:.078,outerB:.042,holeA:.050,holeB:.020});
      pin(m,reference.E,d.lowPlaneM-.0175,d.highPlaneM+.025,.020);
    },{side,plane:d.lowPlaneM,kind:'wheel',extra:{pivot:constraints.O},metadata:{endpoints:['P','E'],physicalLengthM:constraints.physicalReturnCrankLengthM,eccentricPitchRadiusM:.145,rootFit:'rigid keyed/press-fit design, no torque or key strength validation'}});
    register(`eccentric-rod-${s}`,m=>eyeLink(m,at(reference.E,high),at(reference.T,high),{depth,width:.035,outerA:.038,outerB:.038,holeA:.022,holeB:.022}),{side,plane:d.highPlaneM,kind:'link',extra:{a:'E',b:'T'},metadata:{endpoints:['E','T'],fixedLengthM:2.36}});
    register(`slotted-expansion-link-${s}`,m=>{
      const G=add(constraints.Q,constraints.curveCenter),R=constraints.slotRadiusM,theta=angle([0,0],mul(constraints.curveCenter,-1)),limits=constraints.dimensions.expansionSlotLimitsRad;
      for(const [r0,r1]of[[R-.05,R-d.expansionSlotHalfWidthM],[R+d.expansionSlotHalfWidthM,R+.05]])sector(m,at(G),depth,r0,r1,theta+limits[0],theta+limits[1],72);
      for(const e of limits)sector(m,at(G),depth,R-.05,R+.05,theta+e-.008,theta+e+.008,6);
      // A fork carries the fixed-axis bearing behind the working slot plane.
      // No shaft or solid cap crosses the finite D working channel.
      const fork=side*1.263,n=mul(constraints.curveCenter,-1/constraints.slotRadiusM);
      annulus(m,at(reference.Q,fork-.005),at(reference.Q,fork+.005),.038,.060,48);
      for(const sign of[-1,1]){const q=add(reference.Q,mul(n,sign*.0475));beam(m,at(q,fork),at(q),.015,.015);}
      const tailRoot=add(reference.Q,mul(sub(reference.T,reference.Q),.22));
      eyeLink(m,at(tailRoot),at(reference.T),{depth,width:.040,outerA:.055,outerB:.040,holeA:.010,holeB:.020});
      // Offset tail support avoids filling the D slot at its trunnion.
      beam(m,at(add(reference.Q,mul(n,.040))),at(tailRoot),depth,.04);
      pin(m,reference.T,d.lowPlaneM-.0175,d.highPlaneM+.025,.020);
    },{side,plane:d.lowPlaneM,kind:'rocker',extra:{pivot:constraints.Q},metadata:{slotRadiusM:constraints.slotRadiusM,slotHalfWidthM:d.expansionSlotHalfWidthM,workingAngularLimitsRad:constraints.dimensions.expansionSlotLimitsRad,forkBearingPlaneM:1.263,forkDepthM:.010,portalLateralGapM:.013,openSlot:true}});
    register(`expansion-link-trunnion-${s}`,m=>pin(m,reference.Q,1.235,1.272,.036),{side,metadata:{static:true,axis:'Q',bearingGapM:.002,rigidSeatDepthM:.010,reason:'Fixed shaft seated in retained portal, bearing fork separated 13 mm from portal and shaft stops 2.5 mm before slot plane'}});
    register(`radius-rod-${s}`,m=>{
      const t=reference.radiusRodDirection,n=[-t[1],t[0]],limits=constraints.dimensions.radiusRodSupportSlotLimitsM;
      eyeLink(m,at(reference.D,high),at(reference.A,high),{depth,width:.040,outerA:.038,outerB:.035,holeA:.018,holeB:.018});
      const pos=(u,v=0)=>add(reference.D,add(mul(t,u),mul(n,v)));
      for(const sign of[-1,1])beam(m,at(pos(limits[0],sign*.040),high),at(pos(limits[1],sign*.040),high),depth,.020);
      for(const u of limits)beam(m,at(pos(u,-.050),high),at(pos(u,.050),high),depth,.020);
      beam(m,at(pos(limits[1]+.010),high),at(pos(-.030),high),depth,.040);
      pin(m,reference.A,d.lowPlaneM-.025,d.highPlaneM+.0175,.018);
      pin(m,reference.D,d.lowPlaneM-.025,d.highPlaneM+.0175,.018);
    },{side,plane:d.highPlaneM,kind:'link',extra:{a:'D',b:'A'},metadata:{endpoints:['D','A'],fixedLengthM:constraints.radiusRodLengthM,openRearSupportSlot:true,supportSlotLimitsM:constraints.dimensions.radiusRodSupportSlotLimitsM,supportSlotHalfWidthM:.030}});
    register(`combination-lever-${s}`,m=>{
      eyeLink(m,at(reference.V),at(reference.A),{depth,width:.030,outerA:.043,outerB:.035,holeA:.027,holeB:.020});
      eyeLink(m,at(reference.V),at(reference.U),{depth,width:.040,outerA:.043,outerB:.038,holeA:.027,holeB:.022});
    },{side,plane:d.lowPlaneM,kind:'combination',metadata:{threeDistinctPins:['A','V','U'],upperArmM:.08,lowerArmM:.72}});
    register(`union-link-${s}`,m=>{
      eyeLink(m,at(reference.C,high),at(reference.U,high),{depth,width:.035,outerA:.038,outerB:.038,holeA:.022,holeB:.020});
      pin(m,reference.U,d.lowPlaneM-.025,d.highPlaneM+.0175,.020);
    },{side,plane:d.highPlaneM,kind:'link',extra:{a:'C',b:'U'},metadata:{endpoints:['C','U'],fixedLengthM:constraints.unionLengthM}});
    register(`valve-rod-crosshead-${s}`,m=>{
      cylinder(m,[cc,1.82,.59],[cc,1.82,reference.V[1]],.025,40);
      cuboid(m,at(reference.V,cc),[.13,.11,.18]);
      cylinder(m,at(reference.V,cc),at(reference.V,side*(d.lowPlaneM+.025)),.025,40);
    },{side,plane:p.cylinderHalfSeparation,kind:'valve',metadata:{guideHeightM:1.82,spindleRadiusM:.025,spindleForwardInterface:'Steam chest, Gresley link and valve port events remain unresolved; no false coupling is animated'}});
    const K=[1.95,3.85],J=[2.10,3.75];
    register(`reverser-lifting-link-${s}`,m=>{
      eyeLink(m,at(constraints.H),at(K),{depth,width:.035,outerA:.038,outerB:.046,holeA:.018,holeB:.027});
      eyeLink(m,at(K),at(J),{depth,width:.035,outerA:.046,outerB:.035,holeA:.027,holeB:.020});
      pin(m,constraints.H,d.lowPlaneM-.0175,d.highPlaneM+.025,.018);
      pin(m,J,d.lowPlaneM-.0175,d.highPlaneM+.025,.020);
    },{side,metadata:{fixedReverserSetting:true,pivotYZM:K,reachRodJointYZM:J,liftingDieCenterYZM:constraints.H,reason:'Three-pivot bellcrank supported on a real fixed shaft; H fixed during one wheel cycle'}});
    const reachName=`reverser-reach-rod-${s}`,oldReach=originals.get(reachName),newReach=translated(oldReach,[side*(d.highPlaneM-1.11),0,0]);
    replacementParts[reachName]=newReach;corrections.push({name:reachName,kind:'rigid-rest-placement',translationM:[side*(d.highPlaneM-1.11),0,0],reason:'Keep full original reach rod geometry and length; connect to the fixed-setting bellcrank J plane',oldGeometryRetainedIn:'../a6-native-r02'});
    register(`valve-experiment-crosshead-pin-${s}`,m=>pin(m,reference.C,1.242,d.highPlaneM+.025,.020),{side,plane:d.highPlaneM,kind:'crosshead',replacement:false,metadata:{joint:'actual R02 crosshead gudgeon to union-link C eye',radialRunningGapM:.002}});
    register(`valve-experiment-return-crank-pin-${s}`,m=>pin(m,reference.P,1.247,d.lowPlaneM+.025,.050),{side,plane:d.lowPlaneM,kind:'wheel',extra:{pivot:constraints.O},replacement:false,metadata:{joint:'rigid coaxial continuation of actual R02 main crankpin',rigidMount:true,eccentricRodLateralGapM:.0075}});
    const G=add(constraints.Q,constraints.curveCenter),thetaD=angle(G,reference.D);
    register(`valve-experiment-expansion-die-${s}`,m=>extrudedDieWithBore(m,{x:low,depth:d.dieDepthM,centerYZ:reference.D,outerBoundaryYZ:curvedDieBoundary(G,constraints.slotRadiusM,thetaD,d.expansionDieHalfAngleRad,d.expansionDieHalfWidthM),holeRadius:d.dieBoreRadiusM}),{side,plane:d.lowPlaneM,kind:'expansion-die',replacement:false,metadata:{finiteDie:true,trueThroughBore:true,radialHalfWidthM:d.expansionDieHalfWidthM,angularHalfLengthRad:d.expansionDieHalfAngleRad,nominalSlotRadialGapM:.002,pinRadiusM:.018,boreRadiusM:.020}});
    register(`valve-experiment-lifting-die-${s}`,m=>extrudedDieWithBore(m,{x:high,depth:d.dieDepthM,centerYZ:constraints.H,outerBoundaryYZ:rectangleYZ(constraints.H,reference.radiusRodDirection,d.liftingDieHalfLengthM,d.liftingDieHalfWidthM),holeRadius:d.dieBoreRadiusM}),{side,plane:d.highPlaneM,kind:'lifting-die',replacement:false,metadata:{finiteDie:true,trueThroughBore:true,halfLengthM:.026,halfWidthM:.028,pinRadiusM:.018,boreRadiusM:.020,nominalSlotWidthGapM:.002}});
    register(`valve-experiment-lifting-bearing-support-${s}`,m=>{
      beam(m,[side*1.21,1.95,3.55],[side*1.21,1.95,3.85],.060,.060);
      cylinder(m,at(K,side*1.21),at(K,side*(d.lowPlaneM+.025)),.025,40);
    },{side,replacement:false,metadata:{static:true,attachedTo:`expansion-link-frame-bracket-${s}`,nominalBearingGapM:.002,pivotYZM:K}});
    register(`valve-experiment-valve-crosshead-guide-${s}`,m=>{
      for(const sign of[-1,1])cuboid(m,[cc,1.82+sign*.085,2.375],[.090,.030,.55]);
      // Open end frames, not solid stops through which the spindle is animated.
      for(const z of[2.10,2.65])for(const sign of[-1,1]){
        cuboid(m,[cc+sign*.082,1.82,z],[.025,.20,.025]);
        cuboid(m,[cc,1.82+sign*.085,z],[.19,.030,.025]);
      }
      beam(m,[cc,1.92,2.65],[side*1.105,2.18,3.13],.060,.060);
    },{side,replacement:false,metadata:{static:true,guideHeightM:1.82,guideZRangeM:[2.10,2.65],verticalBlockFaceGapM:.015,attachedTo:`outside-motion-bracket-${s}`}});
    note(`valve-experiment-crosshead-pin-${s}`,`outside-crosshead-${s}`,'Rigid auxiliary gudgeon pin seated 20 mm inside the existing crosshead pin; not a free moving clearance');
    note(`valve-experiment-return-crank-pin-${s}`,`outside-main-rod-big-end-pin-${s}`,'Rigid coaxial 10 mm-overlap pin continuation, both attached to the same crank');
    note(`valve-experiment-return-crank-pin-${s}`,`return-crank-${s}`,'Rigid keyed/press-fit root of the return crank; exact nominal 50 mm bore/pin radius, not a bearing clearance claim');
    note(`expansion-link-trunnion-${s}`,`expansion-link-frame-bracket-${s}`,'Fixed shaft rigidly seated 10 mm in the existing portal post; this static mount is not a moving clearance or working bearing. The separate rotating fork has a real 38 mm bore around the 36 mm shaft and a 13 mm gap from the portal');
    note(`valve-experiment-lifting-bearing-support-${s}`,`expansion-link-frame-bracket-${s}`,'Rigid added support is physically seated on the retained portal outboard post');
    note(`valve-experiment-valve-crosshead-guide-${s}`,`outside-motion-bracket-${s}`,'Rigid valve-guide support physically seated on retained outside-motion portal');
  }
  const parts=baseModel.sourceMechanics.parts.map(p=>replacementParts[p.name]??p);
  if(parts.length!==338||new Set(parts.map(p=>p.name)).size!==338)throw Error('All 338 inherited names must remain exactly once');
  const movingPartNames=descriptors.map(d=>d.name),movingSet=new Set(movingPartNames),referencePoses={};
  const adapter={version:'a6-native-valve-adapter/1',baseModel,constraints,reference,design:d,mechanics:{...baseModel.sourceMechanics,parts},replacementParts,supplementalParts,descriptors,movingPartNames,staticPartTransforms:{},corrections,allowedContacts,referencePoses,
    totalInheritedComponents:338,totalSupplementalComponents:baseModel.supplementalParts.length+supplementalParts.length,fullVehicleApproval:false,actualA4ValveTiming:false,
    unresolvedSubsystems:['Inside motion and conjugated Gresley linkage are still static references.','Valve chest/ports, lap/lead/admission and steam events unresolved.','Cab reverser actuator is held at one declared setting; no control sweep or force/elasticity model.']};
  for(const desc of descriptors){
    const frame=frameFor(adapter,desc,reference,0);referencePoses[desc.name]=frame;
    // A whole-revolution reachable-set bound, not a sampled speed estimate.
    // Fixed-length chain limits guarantee every admissible pose lies within it.
    const r=maxRadius(desc.part,frame.pivot),bb=bounds(desc.part);let pivotRange;
    if(desc.kind==='wheel')pivotRange={min:constraints.O,max:constraints.O};
    else if(desc.kind==='rocker')pivotRange={min:constraints.Q,max:constraints.Q};
    else if(desc.kind==='lifting-die')pivotRange={min:constraints.H,max:constraints.H};
    else if(desc.kind==='crosshead'||desc.kind==='link'&&desc.a==='C')pivotRange={min:[1.016,baseModel.crossheadRangeM[0]],max:[1.016,baseModel.crossheadRangeM[1]]};
    else if(desc.kind==='link'&&desc.a==='E')pivotRange={min:constraints.O.map(v=>v-.145),max:constraints.O.map(v=>v+.145)};
    else if(desc.kind==='valve'||desc.kind==='combination'){
      const reach=constraints.unionLengthM+constraints.dimensions.combinationLowerArmM;
      pivotRange={min:[constraints.dimensions.valveHeightM,baseModel.crossheadRangeM[0]-reach],max:[constraints.dimensions.valveHeightM,baseModel.crossheadRangeM[1]+reach]};
    }else{
      // D is on a bounded arc through Q: |QD| = 2R*sin(|s|/2).
      // This bound allows arbitrary rocker rotation, not sampled extrema.
      const reach=2*constraints.slotRadiusM*Math.sin(Math.max(...constraints.dimensions.expansionSlotLimitsRad.map(Math.abs))/2);pivotRange={min:constraints.Q.map(v=>v-reach),max:constraints.Q.map(v=>v+reach)};
    }
    desc.continuousBounds={min:[bb.min[0],pivotRange.min[0]-r,pivotRange.min[1]-r],max:[bb.max[0],pivotRange.max[0]+r,pivotRange.max[1]+r]};
    desc.restBounds=bb;
  }
  adapter.staticParts=[...parts,...baseModel.supplementalParts,...supplementalParts].filter(p=>!movingSet.has(p.name)&&!baseModel.movingPartNames.includes(p.name));
  adapter.finiteSlotChecks=finiteSlotChecks(adapter,validateValveConstraintCycle(constraints));
  return adapter;
}
function frameFor(a,d,j,theta){
  const x=d.side*d.plane,to3=p=>xyz(x,p);
  if(d.kind==='wheel')return {angle:theta,pivot:to3(a.constraints.O)};
  if(d.kind==='rocker')return {angle:j.beta,pivot:to3(a.constraints.Q)};
  if(d.kind==='link')return {angle:angle(j[d.a],j[d.b]),pivot:to3(j[d.a])};
  if(d.kind==='combination')return {angle:j.combinationAngle,pivot:to3(j.V)};
  if(d.kind==='valve')return {angle:0,pivot:to3(j.V)};
  if(d.kind==='crosshead')return {angle:0,pivot:to3(j.C)};
  if(d.kind==='expansion-die')return {angle:j.beta+j.slotAngle,pivot:to3(j.D)};
  if(d.kind==='lifting-die')return {angle:angle(j.D,j.A),pivot:to3(a.constraints.H)};
  throw Error(`Unknown finite valve motion ${d.kind}`);
}
export function evaluateValveNativeAdapter(adapter,phaseRad){
  const solved=evaluateValveConstraints(adapter.constraints,phaseRad),partTransforms={};
  for(const desc of adapter.descriptors){const r=adapter.referencePoses[desc.name],q=frameFor(adapter,desc,solved.joints,solved.phaseRad);partTransforms[desc.name]=rigid(q.angle-r.angle,r.pivot,q.pivot);}
  return {...solved,partTransforms};
}
function finiteSlotChecks(a,report){
  const d=a.design,p=a.constraints.dimensions;
  // Include the solid end bridge half-width: +/-0.008 rad on expansion slot;
  // +/-10 mm along the rear support slot. Bore polygon clearance tested separately.
  return {expansionDieRadialGapM:d.expansionSlotHalfWidthM-d.expansionDieHalfWidthM,
    expansionDieAngularEndGapRad:report.minExpansionSlotMarginRad-d.expansionDieHalfAngleRad-.008,
    liftingDieSideGapM:d.liftingSlotHalfWidthM-d.liftingDieHalfWidthM,
    liftingDieEndGapM:report.minLiftingSlotMarginM-d.liftingDieHalfLengthM-.010,
    pinNominalRadialGapM:d.dieBoreRadiusM-d.diePinRadiusM,
    expansionDieAxialGapM:(d.plateDepthM-d.dieDepthM)/2,
    liftingDieAxialGapM:(d.plateDepthM-d.dieDepthM)/2,
    declaredSlotLimits:{expansionRad:p.expansionSlotLimitsRad,liftingM:p.radiusRodSupportSlotLimitsM},
    travelExtremaSampleCount:report.samples,continuousSlotTravelProof:false,
    status:'exact local section deductions from sampled-cycle travel extrema; not a continuous slot-travel proof'};
}
