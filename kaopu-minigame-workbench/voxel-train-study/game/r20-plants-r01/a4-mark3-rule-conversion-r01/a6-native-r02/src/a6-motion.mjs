import {A4_DIMENSIONS} from '../../student-native-r01/src/dimensions.mjs';

/**
 * Rigid, metre-space motion adapter for the original native component buffers.
 * This solves a DESIGN CANDIDATE crank/coupling/main-rod loop, not A4 valve timing.
 * No source mesh is replaced, sampled, stretched, or used as an animation cache.
 */
export const A6_MOTION_VERSION = 'a6-native-motion/2.0';
export const A6_MOTION_STATUS = 'design-kinematic-candidate; actual A4 crank phases unresolved';
const TAU = 2 * Math.PI, EPS = 1e-10;
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const distance = (a, b) => Math.hypot(...sub(a, b));
const identity = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
const translation = (v) => [1,0,0,0, 0,1,0,0, 0,0,1,0, ...v,1];
const pairKey = (a, b) => [a, b].sort().join('|');
function finite(value, name) { if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`); return value; }
function phase(value) { finite(value, 'phaseRad'); const v = ((value % TAU) + TAU) % TAU; return v < EPS || TAU-v < EPS ? 0 : v; }
function rotateX(a) { const c = Math.cos(a), s = Math.sin(a); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; }
export function transformA6Point(matrix, point) {
  const [x,y,z] = point;
  return [matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12], matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13], matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14]];
}
function multiply(a, b) {
  const r = Array(16).fill(0);
  for (let col=0; col<4; col++) for (let row=0; row<4; row++) for (let k=0; k<4; k++) r[col*4+row] += a[k*4+row]*b[col*4+k];
  return r;
}
function aroundX(angle, oldPivot, newPivot=oldPivot) {
  if (!angle && oldPivot.every((v, i) => v === newPivot[i])) return identity();
  return multiply(translation(newPivot), multiply(rotateX(angle), translation(oldPivot.map(v => -v))));
}
function boundsOf(positions, matrix=null) {
  const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  for (let i=0; i<positions.length; i+=3) {
    const p=matrix ? transformA6Point(matrix, [positions[i],positions[i+1],positions[i+2]]) : [positions[i],positions[i+1],positions[i+2]];
    for (let k=0; k<3; k++) { min[k]=Math.min(min[k],p[k]); max[k]=Math.max(max[k],p[k]); }
  }
  return {min,max};
}
const overlap = (a,b,epsilon=0) => a.min.every((v,k) => v <= b.max[k]+epsilon && a.max[k]+epsilon >= b.min[k]);
function joinedWheelGeometry(parts) {
  const positions=[], indices=[];
  for (const part of parts) { const offset=positions.length/3; positions.push(...part.positions); for (const i of part.indices) indices.push(i+offset); }
  return {positions,indices};
}
function validateMesh(p) {
  if (!p || typeof p.name!=='string' || !p.positions?.length || p.positions.length%3 || !p.indices?.length || p.indices.length%3) throw Error('Expected complete named indexed native meshes');
  if (!p.positions.every(Number.isFinite) || !p.indices.every(i=>Number.isInteger(i)&&i>=0&&i<p.positions.length/3)) throw Error(`Invalid mesh ${p.name}`);
}
function pistonExtension(side,p,length) {
  const positions=[],normals=[],uvs=[],indices=[],x=side*p.cylinderHalfSeparation,y=p.cylinderHeight,z1=p.cylinderZ+p.cylinderLength/2,z0=z1-length,r=.038,n=p.radialSegments;
  const vertex=(point,normal,uv)=>{const i=positions.length/3;positions.push(...point);normals.push(...normal);uvs.push(...uv);return i;};
  for(let i=0;i<n;i++){
    const a=TAU*i/n,b=TAU*(i+1)/n,na=[Math.cos(a),Math.sin(a),0],nb=[Math.cos(b),Math.sin(b),0];
    const points=[[x+r*na[0],y+r*na[1],z0],[x+r*nb[0],y+r*nb[1],z0],[x+r*nb[0],y+r*nb[1],z1],[x+r*na[0],y+r*na[1],z1]];
    const q=points.map((point,k)=>vertex(point,k===0||k===3?na:nb,[k===0||k===3?i/n:(i+1)/n,k<2?0:1]));indices.push(q[0],q[1],q[2],q[0],q[2],q[3]);
    for(const [z,sign]of [[z0,-1],[z1,1]]){const normal=[0,0,sign],q=[vertex([x,y,z],normal,[.5,.5]),vertex([x+r*na[0],y+r*na[1],z],normal,[.5+.5*na[0],.5+.5*na[1]]),vertex([x+r*nb[0],y+r*nb[1],z],normal,[.5+.5*nb[0],.5+.5*nb[1]])];indices.push(q[0],q[sign<0?2:1],q[sign<0?1:2]);}
  }
  return {name:`a6-piston-rod-hidden-extension-${side}`,material:'brushedMetal',positions,normals,uvs,indices,metadata:{assembly:'a6-outside-piston-design-extension',designStatus:'new-native-design-candidate',lengthM:length,radiusM:r,motion:'rigidly-joined-to-original-piston-rod',sourceGeometryChanged:false}};
}

/** Caller supplies the unchanged buildLocomotiveMechanics/buildDrivingWheel results. */
export function createA6MotionModel({mechanics, wheel}={}) {
  if (!mechanics?.parameters || !wheel?.parameters) throw new TypeError('Original mechanics and wheel results are required');
  const p=mechanics.parameters, wp=wheel.parameters;
  const fixed = p.driveDiameter===2.032 && wp.treadDiameter===2.032 && p.crankRadius===.3302 && wp.crankRadius===.3302 && p.axisZ.length===6 && p.axisZ.every((v,i)=>v===A4_DIMENSIONS.axisZ[i]);
  if (!fixed) throw Error('A6 R02 locks 2.032 m wheels, 0.3302 m crank radius, and the original six axle stations');
  mechanics.parts.forEach(validateMesh); wheel.parts.forEach(validateMesh);
  const byName = new Map(mechanics.parts.map(part => [part.name,part]));
  if (byName.size!==mechanics.parts.length) throw Error('Duplicate mechanical component names');
  const radius=p.crankRadius, axleY=p.driveDiameter/2, axes=A4_DIMENSIONS.driveAxisIndices.map(index=>({index,z:p.axisZ[index],y:axleY}));
  const referencePinY=axleY+radius, middle=axes[1];
  const rodLength=Math.hypot(middle.z-p.crossheadZ,referencePinY-p.cylinderHeight);
  const maxOffset=Math.abs(axleY-p.cylinderHeight)+radius;
  if (rodLength<=maxOffset) throw Error('Slider-crank has a singular or unreachable phase');
  const minProjection=Math.sqrt(rodLength*rodLength-maxOffset*maxOffset);
  const sliderSpeedBound=radius*(1+maxOffset/minProjection);
  const crossheadRange=[middle.z-Math.sqrt((rodLength+radius)**2-(p.cylinderHeight-axleY)**2),middle.z-Math.sqrt((rodLength-radius)**2-(p.cylinderHeight-axleY)**2)];
  const pistonExtensionLength=.42,rear=p.cylinderZ+p.cylinderLength/2,front=p.cylinderZ-p.cylinderLength/2;
  const pistonFrontRange=crossheadRange.map(z=>rear-pistonExtensionLength+z-p.crossheadZ);
  const pistonEngagement={extensionLengthM:pistonExtensionLength,originalRodLengthM:p.crossheadZ-rear,totalRigidRodLengthM:p.crossheadZ-rear+pistonExtensionLength,cylinderAxialEnvelopeM:[front,rear],forwardRodEndRangeM:pistonFrontRange,minimumRearCoverEngagementM:rear-pistonFrontRange[1],minimumFrontCoverClearanceM:pistonFrontRange[0]-front,sourceRodAloneMaximumGapM:crossheadRange[1]-p.crossheadZ,status:'axial-engagement-design-check; gland/piston-head/cylinder-bore geometry unresolved'};
  if(pistonEngagement.minimumRearCoverEngagementM<=0||pistonEngagement.minimumFrontCoverClearanceM<=0)throw Error('Piston extension does not stay inside the original cylinder axial envelope');
  const supplementalParts=[-1,1].map(side=>pistonExtension(side,p,pistonExtensionLength));
  for(const part of supplementalParts)byName.set(part.name,part);
  const descriptors=[];
  const requirePart = (name, kind, extra={}) => {
    if (!byName.has(name)) throw Error(`Missing original component ${name}`);
    descriptors.push({name,kind,part:byName.get(name),...extra});
  };
  for (const side of [-1,1]) {
    for(let i=0;i<2;i++) requirePart(`coupling-rod-${side}-${i}`,'coupling',{side,from:i,to:i+1,speedBound:radius});
    for(const axis of axes) requirePart(`coupling-crank-pin-extension-${side}-${axis.index}`,'pin',{side,axleIndex:axis.index,speedBound:radius});
    const pivot=[side*(p.wheelCenterHalfSeparation+p.mainRodOffset),p.cylinderHeight,p.crossheadZ];
    const rod=byName.get(`outside-main-connecting-rod-${side}`);
    if (!rod) throw Error('Missing outside main rod');
    let farthest=0; for(let i=0;i<rod.positions.length;i+=3) farthest=Math.max(farthest,distance(rod.positions.slice(i,i+3),pivot));
    requirePart(`outside-main-connecting-rod-${side}`,'main-rod',{side,pivot,speedBound:sliderSpeedBound+farthest*radius/minProjection});
    requirePart(`outside-main-rod-big-end-pin-${side}`,'pin',{side,axleIndex:middle.index,speedBound:radius});
    requirePart(`outside-crosshead-${side}`,'crosshead',{side,speedBound:sliderSpeedBound});
    requirePart(`outside-piston-rod-${side}`,'crosshead',{side,speedBound:sliderSpeedBound});
    requirePart(`a6-piston-rod-hidden-extension-${side}`,'crosshead',{side,speedBound:sliderSpeedBound});
  }
  const movingPartNames=descriptors.map(d=>d.name), movingSet=new Set(movingPartNames);
  const fixedReferenceSupports=new Set(['inside-slidebars-and-bracket',...[-1,1].flatMap(s=>[`expansion-link-frame-bracket-${s}`,`expansion-link-trunnion-${s}`])]);
  const unsupportedPartNames=mechanics.parts.filter(part=>['inner-motion','outside-valve-gear','conjugated-valve-gear'].includes(part.metadata?.assembly)&&!fixedReferenceSupports.has(part.name)).map(part=>part.name);
  const wheelGeometry=joinedWheelGeometry(wheel.parts);
  let wheelSpeedBound=0; for(let i=0;i<wheelGeometry.positions.length;i+=3) wheelSpeedBound=Math.max(wheelSpeedBound,Math.hypot(wheelGeometry.positions[i+1],wheelGeometry.positions[i+2]));
  const wheelInstances=axes.flatMap(axis=>[-1,1].map(side=>({name:`locked-drive-wheel-${axis.z}-${side}`,axleIndex:axis.index,side,center:[side*p.wheelCenterHalfSeparation,axleY,axis.z],speedBound:wheelSpeedBound})));
  const blockers=[
    {id:'historical-phase',status:'unresolved',parts:[],reason:'The source has both outside cranks in the same top pose. It provides no verified A4 side/inside phase relation. This candidate keeps that reference and must not be described as historical A4 timing.'},
    {id:'piston-gland',status:'axial-engagement-solved; engineering-interface-unresolved',parts:[-1,1].flatMap(s=>[`outside-piston-rod-${s}`,`a6-piston-rod-hidden-extension-${s}`,`outside-cylinder-${s}`]),reason:'A new 0.42 m native hidden extension stays inside the source cylinder axial envelope throughout the stroke and preserves the original rod. Source cylinder caps have no gland bore, no internal piston head or real working bore; intended rod penetration through the cap is declared, not counted as free-clearance proof.'},
    {id:'outside-valve-loop',status:'static-reference-not-actuated',parts:mechanics.parts.filter(x=>x.metadata?.assembly==='outside-valve-gear').map(x=>x.name),reason:'Return crank/eccentric/expansion-link/die-block/radius/union/combination/reverser joints have no consistent solved source loop. They retain the source pose; moving wheel/crosshead attachment gaps are explicitly reported.'},
    {id:'inside-motion',status:'static-reference-not-actuated',parts:mechanics.parts.filter(x=>x.metadata?.assembly==='inner-motion').map(x=>x.name),reason:'Inside cylinder, piston and slidebar directions are not collinear in the source. Actual inner crank phase and usable slide constraint remain unresolved. Crank webs and inside rod are not independently spun.'},
    {id:'conjugated-valves',status:'static-reference-not-actuated',parts:mechanics.parts.filter(x=>x.metadata?.assembly==='conjugated-valve-gear').map(x=>x.name),reason:'No verified three-cylinder valve constraint graph or complete fulcrum topology exists; no decorative valve animation is substituted.'},
    {id:'rolling-and-loads',status:'not-solved',parts:[],reason:'Fixed-axle, stationary rig only. Carrying/tender/coach wheel rolling, translation along rail, buffers, drawgear, brake actuation, suspension loads, forces and compliance are not actuated or validated.'}
  ];
  return {version:A6_MOTION_VERSION,status:A6_MOTION_STATUS,units:'m',sourceMechanics:mechanics,sourceWheel:wheel,parameters:p,axes,radius,axleY,rodLength,referencePinY,minProjection,sliderSpeedBound,descriptors,movingPartNames,unsupportedPartNames,wheelInstances,wheelGeometry,supplementalParts,pistonEngagement,crossheadRangeM:crossheadRange,staticParts:mechanics.parts.filter(part=>!movingSet.has(part.name)),blockers,
    referencePhaseRad:0,sidePhaseOffsetsRad:{'-1':0,'1':0},sourceGeometryMutated:false,allMechanismsSolved:false,
    supportedSubsystem:'six driver wheel instances; four coupling links; six crank extensions; two outside main rods, big-end pins, crossheads and rigid extended piston rods',
    exclusions:['Unsupported reference mechanisms are preserved but are not working joints.','Static-static intersections and within-one-wheel original self intersections are outside this motion screen.','No source animation channels, force dynamics, elasticity, manufacturing fits or historical timing are used.']};
}

/** Deterministic pure evaluation. Matrices are column-major; no incremental drift. */
export function evaluateA6Motion(model, phaseRad=0) {
  const theta=phase(phaseRad),p=model.parameters,r=model.radius,c=Math.cos(theta),s=Math.sin(theta);
  const pinY=model.axleY+r*c,dy=pinY-model.referencePinY,dz=r*s;
  const offset=pinY-p.cylinderHeight;
  const crossheadZ=theta===0?p.crossheadZ:model.axes[1].z+dz-Math.sqrt(model.rodLength**2-offset**2);
  const slide=crossheadZ-p.crossheadZ;
  const oldDirection=[0,model.referencePinY-p.cylinderHeight,model.axes[1].z-p.crossheadZ];
  const newDirection=[0,offset,model.axes[1].z+dz-crossheadZ];
  const rodAngle=theta===0?0:Math.atan2(newDirection[2],newDirection[1])-Math.atan2(oldDirection[2],oldDirection[1]);
  const partTransforms={};
  for(const d of model.descriptors) partTransforms[d.name]=d.kind==='main-rod'?aroundX(rodAngle,d.pivot,add(d.pivot,[0,0,slide])):translation(d.kind==='crosshead'?[0,0,slide]:[0,dy,dz]);
  const wheelTransforms=model.wheelInstances.map(instance=>{
    const mirror=instance.side<0?[-1,0,0,0, 0,1,0,0, 0,0,-1,0, 0,0,0,1]:identity();
    return {...instance,matrix:multiply(translation(instance.center),multiply(rotateX(theta),mirror)),angleRad:theta};
  });
  const joints=[],residuals={maximumRodLengthErrorM:0,maximumJointErrorM:0,maximumAxisErrorM:0};
  for(const side of [-1,1]) {
    const cx=side*(p.wheelCenterHalfSeparation+p.couplingRodOffset),mx=side*(p.wheelCenterHalfSeparation+p.mainRodOffset),cc=side*p.cylinderHalfSeparation;
    const crankPins=model.axes.map(a=>({axleIndex:a.index,center:[cx,pinY,a.z+dz],wheelCenter:[side*p.wheelCenterHalfSeparation,model.axleY,a.z]}));
    const crosshead=[mx,p.cylinderHeight,crossheadZ],mainPin=[mx,pinY,model.axes[1].z+dz];
    const links=[];
    for(let i=0;i<2;i++) {
      const linkX=side*(p.wheelCenterHalfSeparation+(model.sourceMechanics.motionDesign?.couplingRodPlaneOffsetsM[i]??p.couplingRodOffset));
      const name=`coupling-rod-${side}-${i}`,a=[linkX,...crankPins[i].center.slice(1)],b=[linkX,...crankPins[i+1].center.slice(1)],L=model.axes[i+1].z-model.axes[i].z;
      const attachmentErrors=[[linkX,model.referencePinY,model.axes[i].z],[linkX,model.referencePinY,model.axes[i+1].z]].map((q,k)=>distance(transformA6Point(partTransforms[name],q),k?b:a));
      links.push({name,a,b,lengthM:L,currentLengthM:distance(a,b),attachmentErrorsM:attachmentErrors});
    }
    const name=`outside-main-connecting-rod-${side}`;
    const mainErrors=distance(transformA6Point(partTransforms[name],[mx,p.cylinderHeight,p.crossheadZ]),crosshead);
    const bigError=distance(transformA6Point(partTransforms[name],[mx,model.referencePinY,model.axes[1].z]),mainPin);
    links.push({name,a:crosshead,b:mainPin,lengthM:model.rodLength,currentLengthM:distance(crosshead,mainPin),attachmentErrorsM:[mainErrors,bigError]});
    for(const link of links) {residuals.maximumRodLengthErrorM=Math.max(residuals.maximumRodLengthErrorM,Math.abs(link.currentLengthM-link.lengthM));residuals.maximumJointErrorM=Math.max(residuals.maximumJointErrorM,...link.attachmentErrorsM);}
    const worldPin=transformA6Point(wheelTransforms.find(w=>w.side===side&&w.axleIndex===3).matrix,[0,r,0]);
    residuals.maximumJointErrorM=Math.max(residuals.maximumJointErrorM,Math.hypot(worldPin[1]-mainPin[1],worldPin[2]-mainPin[2]));
    joints.push({side,crankPins,crosshead:{center:[cc,p.cylinderHeight,crossheadZ],gudgeon:crosshead,sliderAxis:[0,0,1],translationM:slide},links});
  }
  return {version:A6_MOTION_VERSION,status:A6_MOTION_STATUS,phaseRad:theta,phaseDegrees:theta*180/Math.PI,partTransforms,wheelTransforms,joints,residuals,
    unsupportedInterfaceGaps:[-1,1].flatMap(side=>[
      {id:`union-link-to-crosshead-${side}`,distanceM:Math.abs(slide),status:'static-reference-blocker'},
      {id:`return-crank-to-wheel-${side}`,distanceM:Math.hypot(dy,dz),status:'static-reference-blocker'}
    ]),pistonEngagement:model.pistonEngagement,blockers:model.blockers,allMechanismsSolved:false};
}

export function validateA6MotionCycle(model,{samples=720,toleranceM=1e-9}={}) {
  if(!Number.isInteger(samples)||samples<8||samples>14400)throw Error('Cycle samples must be an integer from 8 through 14400');
  if(!Number.isFinite(toleranceM)||toleranceM<=0)throw Error('Positive tolerance required');
  const first=evaluateA6Motion(model,0),last=evaluateA6Motion(model,TAU);
  let maxRod=0,maxJoint=0,maxAxis=0,maxRigid=0,maxClosure=0,minSlide=Infinity,maxSlide=-Infinity,maxGap=0;
  for(let i=0;i<=samples;i++){
    const pose=evaluateA6Motion(model,TAU*i/samples);
    maxRod=Math.max(maxRod,pose.residuals.maximumRodLengthErrorM);maxJoint=Math.max(maxJoint,pose.residuals.maximumJointErrorM);
    const z=pose.joints[0].crosshead.center[2];minSlide=Math.min(minSlide,z);maxSlide=Math.max(maxSlide,z);
    maxGap=Math.max(maxGap,...pose.unsupportedInterfaceGaps.map(g=>g.distanceM));
    for(const w of pose.wheelTransforms) maxAxis=Math.max(maxAxis,distance(transformA6Point(w.matrix,[0,0,0]),w.center));
    for(const m of [...Object.values(pose.partTransforms),...pose.wheelTransforms.map(w=>w.matrix)]){
      const u=m.slice(0,3),v=m.slice(4,7),w=m.slice(8,11);
      maxRigid=Math.max(maxRigid,Math.abs(dot(u,u)-1),Math.abs(dot(v,v)-1),Math.abs(dot(w,w)-1),Math.abs(dot(u,v)),Math.abs(dot(u,w)),Math.abs(dot(v,w)),Math.abs(dot(u,cross(v,w))-1));
    }
  }
  for(const name of model.movingPartNames) first.partTransforms[name].forEach((v,i)=>{maxClosure=Math.max(maxClosure,Math.abs(v-last.partTransforms[name][i]));});
  first.wheelTransforms.forEach((w,k)=>w.matrix.forEach((v,i)=>{maxClosure=Math.max(maxClosure,Math.abs(v-last.wheelTransforms[k].matrix[i]));}));
  return {schema:'a6-motion-cycle-validation/1',status:A6_MOTION_STATUS,scope:'Supported rigid crank/coupling/main-rod loop only',samples: samples+1,intervalDegrees:360/samples,toleranceM,
    maximumRodLengthErrorM:maxRod,maximumJointErrorM:maxJoint,maximumAxisErrorM:maxAxis,maximumRigidMatrixError:maxRigid,cycleClosureError:maxClosure,
    crossheadRangeM:model.crossheadRangeM,sampledCrossheadRangeM:[minSlide,maxSlide],crossheadTravelM:model.crossheadRangeM[1]-model.crossheadRangeM[0],documentedPistonStrokeM:model.parameters.cylinderStroke,pistonEngagement:model.pistonEngagement,
    strokeErrorM:(model.crossheadRangeM[1]-model.crossheadRangeM[0])-model.parameters.cylinderStroke,
    strokeCaveat:model.parameters.cylinderHeight===model.axleY?'R02 outside cylinder/guide assembly is aligned to axle height; exact analytic travel equals documented 26-inch stroke. Placement and rod length are still explicit design candidates.':'Original outside slider is vertically offset from the axle. Its candidate travel need not equal the source 26-inch piston stroke; cylinder placement and rod geometry are provisional.',
    maximumUnsupportedInterfaceGapM:maxGap,supportedLoopPass:[maxRod,maxJoint,maxAxis,maxRigid,maxClosure].every(v=>v<=toleranceM),allMechanismsSolved:false,fullVehicleApproval:false,blockers:model.blockers};
}

function transformedPositions(positions,matrix) {
  if(!matrix)return positions;
  const out=new Float64Array(positions.length);
  for(let i=0;i<positions.length;i+=3)out.set(transformA6Point(matrix,[positions[i],positions[i+1],positions[i+2]]),i);
  return out;
}
function trianglesOf(body,matrix) {
  const p=transformedPositions(body.positions,matrix),triangles=[];
  for(let i=0;i<body.indices.length;i+=3){const points=Array.from(body.indices.slice(i,i+3),n=>Array.from(p.slice(n*3,n*3+3)));triangles.push({points,bounds:boundsOf(points.flat()),index:i/3});}
  return triangles;
}
function bvh(tris) {
  const box={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(const t of tris)for(let k=0;k<3;k++){box.min[k]=Math.min(box.min[k],t.bounds.min[k]);box.max[k]=Math.max(box.max[k],t.bounds.max[k]);}
  if(tris.length<=12)return {box,tris};
  const spans=box.max.map((v,k)=>v-box.min[k]),axis=spans.indexOf(Math.max(...spans));
  tris.sort((a,b)=>(a.bounds.min[axis]+a.bounds.max[axis])-(b.bounds.min[axis]+b.bounds.max[axis]));
  const middle=Math.floor(tris.length/2);return {box,left:bvh(tris.slice(0,middle)),right:bvh(tris.slice(middle))};
}
/** Triangle SAT includes in-plane axes, so disjoint coplanar triangles are not hits. */
export function trianglesIntersectA6(a,b,epsilon=1e-9) {
  const edges=p=>[sub(p[1],p[0]),sub(p[2],p[1]),sub(p[0],p[2])],ea=edges(a),eb=edges(b),na=cross(ea[0],ea[1]),nb=cross(eb[0],eb[1]);
  if(Math.hypot(...na)<1e-14||Math.hypot(...nb)<1e-14)return false;
  const axes=[na,nb,...ea.flatMap(x=>eb.map(y=>cross(x,y))),...ea.map(e=>cross(na,e)),...eb.map(e=>cross(nb,e))];
  for(const axis of axes){const length=Math.hypot(...axis);if(length<1e-14)continue;const pa=a.map(p=>dot(p,axis)/length),pb=b.map(p=>dot(p,axis)/length);if(Math.max(...pa)<Math.min(...pb)-epsilon||Math.max(...pb)<Math.min(...pa)-epsilon)return false;}
  return true;
}
function firstIntersection(a,b,counter) {
  if(!overlap(a.box,b.box,1e-9))return null;
  if(a.tris&&b.tris){for(const x of a.tris)for(const y of b.tris)if(overlap(x.bounds,y.bounds,1e-9)){counter.tests++;if(trianglesIntersectA6(x.points,y.points))return {triangleA:x.index,triangleB:y.index};}return null;}
  if(a.tris)return firstIntersection(a,b.left,counter)||firstIntersection(a,b.right,counter);
  if(b.tris)return firstIntersection(a.left,b,counter)||firstIntersection(a.right,b,counter);
  return firstIntersection(a.left,b.left,counter)||firstIntersection(a.left,b.right,counter)||firstIntersection(a.right,b.left,counter)||firstIntersection(a.right,b.right,counter);
}

/**
 * Conservative CONTINUOUS sweep screening, not just screenshots at sample angles.
 * At each interval midpoint, every original vertex is transformed exactly. The
 * resulting AABB is padded by a proven vertex-speed bound * half interval angle.
 * Thus disjoint boxes exclude collision throughout that interval. Overlap is an
 * unresolved candidate, unless a sampled original-triangle surface witness exists.
 * No finite mesh, proxy envelope or sampled witness is called an engineering pass.
 */
export function screenA6SweptInterference(model,{stepDegrees=5,obstacles=[],narrowPhase=true}={}) {
  if(!Number.isFinite(stepDegrees)||stepDegrees<=0||stepDegrees>45)throw Error('stepDegrees must be in (0,45]');
  if(!Array.isArray(obstacles))throw Error('obstacles must be an array of original world-coordinate meshes');
  const intervals=Math.ceil(360/stepDegrees),h=TAU/intervals,half=h/2,staticBodies=[];
  for(const part of [...model.staticParts,...obstacles]) {validateMesh(part);staticBodies.push({name:part.name,positions:part.positions,indices:part.indices,bounds:boundsOf(part.positions),unsupported:model.unsupportedPartNames.includes(part.name)});}
  const allNames=[...model.movingPartNames,...model.wheelInstances.map(w=>w.name),...staticBodies.map(x=>x.name)];
  if(new Set(allNames).size!==allNames.length)throw Error('Collision body names must be unique, including supplied obstacles');
  const moving=model.descriptors.map(d=>({name:d.name,positions:d.part.positions,indices:d.part.indices,speedBound:d.speedBound}));
  moving.push(...model.wheelInstances.map(w=>({name:w.name,...model.wheelGeometry,speedBound:w.speedBound,wheel:true})));
  const candidates=new Map(),staticTrees=new Map(),counter={tests:0};let intervalPairTests=0;
  const allowedPairs=new Map();
  // Shaft/wheel interference is an intentional hub fit, not a swept free clearance.
  for(const w of model.wheelInstances){
    const axis=model.axes.find(a=>a.index===w.axleIndex),shaft=`driver-${axis.index-1}-axle-shaft`,extension=`coupling-crank-pin-extension-${w.side}-${w.axleIndex}`;
    allowedPairs.set(pairKey(w.name,shaft),'Original coaxial wheel-hub/axle-shaft assembly fit; no working-fit tolerance validation');
    allowedPairs.set(pairKey(w.name,extension),'Coaxial rigid crankpin extension and wheel crankpin belong to the same rotating crank assembly');
  }
  for(const side of [-1,1]){
    const rod=`outside-piston-rod-${side}`,extension=`a6-piston-rod-hidden-extension-${side}`,cylinder=`outside-cylinder-${side}`,crosshead=`outside-crosshead-${side}`;
    allowedPairs.set(pairKey(rod,extension),'Rigid butt joint between original rod and explicit native extension; both lengths fixed');
    allowedPairs.set(pairKey(rod,crosshead),'Rigid original piston-rod/crosshead attachment');
    allowedPairs.set(pairKey(rod,cylinder),'Intended axial rod/gland interface. Original end cap lacks a gland bore; this is an unresolved geometry interface, NOT a clearance pass');
    allowedPairs.set(pairKey(extension,cylinder),'Internal rod axial engagement; source cylinder is a capped outer form, with no working bore or piston geometry');
    allowedPairs.set(pairKey(`coupling-crank-pin-extension-${side}-3`,`outside-main-rod-big-end-pin-${side}`),'Coaxial rigid middle crankpin/big-end pin stack; separate moving rod eyes remain checked');
  }
  const allowedContacts=[...allowedPairs].map(([key,reason])=>({pair:key.split('|'),reason}));
  const consider=(a,b,interval,angle,trees)=>{
    intervalPairTests++;
    if(!overlap(a.swept??a.bounds,b.swept??b.bounds))return;
    const key=pairKey(a.name,b.name);if(allowedPairs.has(key))return;
    let record=candidates.get(key);
    if(!record){record={pair:[a.name,b.name],firstIntervalDegrees:[interval*360/intervals,(interval+1)*360/intervals],lastIntervalDegrees:null,intervalCount:0,sampledSurfaceWitness:null,sampledPosesTested:0,involvesUnsupportedReference:!!(a.unsupported||b.unsupported)};candidates.set(key,record);}
    record.intervalCount++;record.lastIntervalDegrees=[interval*360/intervals,(interval+1)*360/intervals];
    if(narrowPhase&&!record.sampledSurfaceWitness&&overlap(a.bounds,b.bounds)){
      const tree=body=>{const cache=body.matrix?trees:staticTrees;if(!cache.has(body.name))cache.set(body.name,bvh(trianglesOf(body,body.matrix)));return cache.get(body.name);};
      const hit=firstIntersection(tree(a),tree(b),counter);record.sampledPosesTested++;
      if(hit)record.sampledSurfaceWitness={phaseDegrees:angle*180/Math.PI,...hit,meaning:'Original mesh surfaces intersect or touch at this sampled pose. Not a penetration-depth or structural failure measurement.'};
    }
  };
  for(let i=0;i<intervals;i++){
    const angle=(i+.5)*h,pose=evaluateA6Motion(model,angle),wheelMatrices=new Map(pose.wheelTransforms.map(w=>[w.name,w.matrix])),trees=new Map();
    const dynamic=moving.map(body=>{
      const matrix=body.wheel?wheelMatrices.get(body.name):pose.partTransforms[body.name],bounds=boundsOf(body.positions,matrix),padding=body.speedBound*half+1e-9;
      return {...body,matrix,bounds,swept:{min:bounds.min.map((v,k)=>v-(k?padding:0)),max:bounds.max.map((v,k)=>v+(k?padding:0))}};
    });
    for(let a=0;a<dynamic.length;a++){for(const b of staticBodies)consider(dynamic[a],b,i,angle,trees);for(let b=a+1;b<dynamic.length;b++)consider(dynamic[a],dynamic[b],i,angle,trees);}
  }
  const list=[...candidates.values()].sort((a,b)=>Number(!!b.sampledSurfaceWitness)-Number(!!a.sampledSurfaceWitness)||a.pair.join('|').localeCompare(b.pair.join('|')));
  return {schema:'a6-swept-interference-screen/1',status:list.length?'open-interference-candidates':'screened-clear-in-declared-scope',phaseRangeDegrees:[0,360],intervals,intervalDegrees:360/intervals,
    method:'Exact original-vertex midpoint AABBs plus analytic speed-bound padding over every continuous angular interval; optional exact original-triangle sampled surface intersection witnesses.',
    geometrySource:'All original vertices and triangles; no mesh decimation or collision mesh substitution',movingBodyCount:moving.length,staticBodyCount:staticBodies.length,additionalObstacleCount:obstacles.length,intervalPairTests,triangleTests:counter.tests,
    candidateCount:list.length,sampledSurfaceWitnessCount:list.filter(x=>x.sampledSurfaceWitness).length,candidates:list,allowedContacts,
    continuousBroadPhaseComplete:true,continuousTriangleNarrowPhaseComplete:false,fullVehicleApproval:false,allMechanismsSolved:false,
    exclusions:[...model.exclusions,'Within-one-rigid-body triangles are not self-tested.','Declared axle/hub contact pairs are excluded from free-clearance tests and listed.','Bodies not supplied as obstacles, including shells/coach/rails, are not covered.','Triangle surface tests detect intersection/touching, not full solid containment; no witness means unresolved, never clear.','No continuous exact triangle-triangle time-of-impact solver or collision-response physics.'],blockers:model.blockers};
}
