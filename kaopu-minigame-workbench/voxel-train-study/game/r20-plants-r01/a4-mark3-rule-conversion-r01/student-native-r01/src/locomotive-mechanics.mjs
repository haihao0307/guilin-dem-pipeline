import { A4_DIMENSIONS } from './dimensions.mjs';

/**
 * Native, static A4 mechanical structure study. All vertices are generated from
 * component dimensions, cross-sections and instance placement. No teacher meshes,
 * sampled motion, point dictionaries or residual streams are runtime inputs.
 * x = lateral, y = height above nominal rail tread contact, z = rearwards.
 * The first leading axle is z=0. This is not an engineering or kinematic model.
 */
export const MECHANICS_VERSION = 'native-locomotive-mechanics/3-bogie-helical';
export const MECHANICS_DEFAULTS = Object.freeze({
  axisZ: Object.freeze([...A4_DIMENSIONS.axisZ]),
  driveDiameter: A4_DIMENSIONS.driveDiameter,
  leadingDiameter: A4_DIMENSIONS.leadingDiameter,
  trailingDiameter: A4_DIMENSIONS.trailingDiameter,
  wheelCenterHalfSeparation: .75,
  frameHalfSeparation: .51,
  framePlateThickness: .075,
  frameTop: 1.71,
  frameRailDepth: .25,
  frontFrameOverhang: .81,
  rearFrameOverhang: 1.22,
  axleRadius: .103,
  carryingAxleRadius: .077,
  axleboxWidth: .24,
  axleboxSize: .35,
  springLeaves: 7,
  springLeafThickness: .011,
  springWidth: .12,
  drivingSpringLeaves: A4_DIMENSIONS.driveSpringLeaves,
  drivingSpringWidth: A4_DIMENSIONS.driveSpringPlateWidth,
  drivingSpringLeafThickness: A4_DIMENSIONS.driveSpringPlateThickness,
  drivingSpringLength: A4_DIMENSIONS.driveSpringCentres,
  trailingSpringLeaves: A4_DIMENSIONS.trailingSpringLeaves,
  trailingSpringWidth: A4_DIMENSIONS.trailingSpringPlateWidth,
  trailingSpringLeafThickness: A4_DIMENSIONS.trailingSpringPlateThickness,
  trailingSpringLength: A4_DIMENSIONS.trailingSpringCentres,
  carryingSpringLength: .76,
  drivingSpringHeight: .42,
  springCamber: .085,
  crankRadius: A4_DIMENSIONS.drivingCrankRadius, // Derived from the documented 26 in piston stroke / 2.
  cylinderBore: A4_DIMENSIONS.cylinderBore, // Bore, NOT the outer casing diameter.
  cylinderStroke: A4_DIMENSIONS.cylinderStroke,
  couplingRodOffset: .177,
  mainRodOffset: .262,
  motionOffset: .36,
  cylinderHalfSeparation: 1.045,
  cylinderHeight: 1.346,
  cylinderRadius: .235,
  cylinderLength: .84,
  cylinderZ: 1.16,
  crossheadZ: 2.49,
  bogieFrameHeight: .83,
  bogieFrameDepth: .15,
  bogieSpringMeanRadius: .057,
  bogieSpringWireRadius: .009,
  bogieSpringTurns: 6,
  bogieSpringCenterlineRise: .222,
  bogieSpringLateralInset: .17,
  bogieSpringAxleZOffset: .10,
  bogieSpringSeatAboveAxle: .21,
  bogieSpringSeatThickness: .026,
  cartazziFrameHalfSeparation: 1.04,
  cartazziWedgeSlope: .14,
  brakeTreadClearance: .018,
  brakeShoeThickness: .048,
  brakeShoeHalfAngle: .205,
  carryingTyreWidth: .13,
  carryingFlangeHeight: .026,
  carryingFlangeWidth: .022,
  carryingRimDepth: .068,
  carryingSpokeCount: 10,
  radialSegments: 40,
  curveSegments: 14,
  includeCarryingWheels: true,
  includeTender: true,
  tenderWheelDiameter: 1.27,
  tenderAxleIntervals: Object.freeze([1.6002,1.6764,1.6002]),
  tenderFirstAxleGap: 2.784475,
  tenderFrameHalfSeparation: 1.04,
  tenderFrameTop: 1.52,
  tenderFrontFrameOverhang: .73,
  tenderRearFrameOverhang: 1.42,
  tenderSpringLength: .92
});

const SOURCES = Object.freeze({
  dimensions: A4_DIMENSIONS.source,
  bogieAndBrakes: 'https://sirnigelgresley.org.uk/overhaul-1522/overhaul-06.shtml',
  bogieBearers: 'https://www.sirnigelgresley.org.uk/overhaul-1522/overhaul-07.shtml',
  sixBrakeHangers: 'https://www.sirnigelgresley.org.uk/overhaul-1522/overhaul-08.shtml',
  cartazziInclines: 'https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-47/',
  cartazziHorns: 'https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-57/',
  cartazziSpringHangers: 'https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-49/',
  innerMotion: 'https://www.sirnigelgresley.org.uk/eng-reports/mob-eng-23-b.shtml',
  conjugatedGear: 'https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-58/'
});
const add = (a,b) => a.map((v,i) => v+b[i]);
const sub = (a,b) => a.map((v,i) => v-b[i]);
const mul = (a,s) => a.map(v => v*s);
const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function unit(a) { const l=Math.hypot(...a); if(l<1e-10||!Number.isFinite(l)) throw Error('Degenerate mechanical primitive'); return mul(a,1/l); }
const mid = (a,b) => mul(add(a,b),.5);
function mesh(name,material='blackPaint') { return {name,positions:[],normals:[],uvs:[],indices:[],material}; }
function vertex(m,p,n,uv) { const i=m.positions.length/3; m.positions.push(...p); m.normals.push(...n); m.uvs.push(...uv); return i; }
function quad(m,a,b,c,d,normals=null) {
  const n=unit(cross(sub(b,a),sub(c,a))), ns=normals??[n,n,n,n];
  const q=[a,b,c,d].map((p,i)=>vertex(m,p,ns[i],[[0,0],[1,0],[1,1],[0,1]][i]));
  if(dot(n,ns[0])>0) m.indices.push(q[0],q[1],q[2],q[0],q[2],q[3]);
  else m.indices.push(q[0],q[2],q[1],q[0],q[3],q[2]);
}
function triangle(m,a,b,c,n) {
  const ids=[a,b,c].map((p,i)=>vertex(m,p,n,[[.5,.5],[0,1],[1,1]][i]));
  if(dot(cross(sub(b,a),sub(c,a)),n)>0)m.indices.push(...ids);else m.indices.push(ids[0],ids[2],ids[1]);
}
function mergeInto(m,source) { const o=m.positions.length/3; m.positions.push(...source.positions); m.normals.push(...source.normals); m.uvs.push(...source.uvs); m.indices.push(...source.indices.map(i=>i+o)); return m; }
function basis(axis) { const w=unit(axis),u=unit(cross(Math.abs(w[1])<.85?[0,1,0]:[0,0,1],w)); return [u,cross(w,u),w]; }
function cuboid(m,center,size) {
  const [x,y,z]=center,[a,b,c]=size.map(v=>v/2), v=[[-a,-b,-c],[a,-b,-c],[a,b,-c],[-a,b,-c],[-a,-b,c],[a,-b,c],[a,b,c],[-a,b,c]].map(q=>[q[0]+x,q[1]+y,q[2]+z]);
  for(const ids of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]])quad(m,...ids.map(i=>v[i]));
}
function beam(m,a,b,width,height) {
  const [u,v]=basis(sub(b,a)),corners=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>add(p,add(mul(u,i*width/2),mul(v,j*height/2))));
  const q=[...corners(a),...corners(b)];
  for(const ids of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]])quad(m,...ids.map(i=>q[i]));
}
function cylinder(m,a,b,r,segments=32) {
  const [u,v,w]=basis(sub(b,a)),rad=t=>add(mul(u,Math.cos(t)),mul(v,Math.sin(t)));
  for(let i=0;i<segments;i++){
    const n0=rad(i*2*Math.PI/segments),n1=rad((i+1)*2*Math.PI/segments),a0=add(a,mul(n0,r)),a1=add(a,mul(n1,r)),b0=add(b,mul(n0,r)),b1=add(b,mul(n1,r));
    quad(m,a0,b0,b1,a1,[n0,n0,n1,n1]);triangle(m,a,a1,a0,mul(w,-1));triangle(m,b,b0,b1,w);
  }
}
function annulus(m,a,b,inner,outer,segments=32) {
  if(!(outer>inner&&inner>0))throw Error('Invalid annulus');
  const [u,v,w]=basis(sub(b,a)),rad=t=>add(mul(u,Math.cos(t)),mul(v,Math.sin(t)));
  for(let i=0;i<segments;i++){
    const n0=rad(i*2*Math.PI/segments),n1=rad((i+1)*2*Math.PI/segments),at=(p,r,n)=>add(p,mul(n,r));
    quad(m,at(a,outer,n0),at(b,outer,n0),at(b,outer,n1),at(a,outer,n1),[n0,n0,n1,n1]);
    quad(m,at(a,inner,n0),at(a,inner,n1),at(b,inner,n1),at(b,inner,n0),[mul(n0,-1),mul(n1,-1),mul(n1,-1),mul(n0,-1)]);
    quad(m,at(a,inner,n0),at(a,outer,n0),at(a,outer,n1),at(a,inner,n1),Array(4).fill(mul(w,-1)));
    quad(m,at(b,inner,n0),at(b,inner,n1),at(b,outer,n1),at(b,outer,n0),Array(4).fill(w));
  }
}
/** A ring sector about X, used for brake blocks and genuinely open link slots. */
function sector(m,center,xDepth,r0,r1,a0,a1,segments) {
  const at=(x,r,a)=>[center[0]+x,center[1]+r*Math.sin(a),center[2]+r*Math.cos(a)],rad=a=>[0,Math.sin(a),Math.cos(a)];
  for(let i=0;i<segments;i++){
    const a=a0+(a1-a0)*i/segments,b=a0+(a1-a0)*(i+1)/segments,lo=-xDepth/2,hi=xDepth/2;
    quad(m,at(lo,r1,a),at(hi,r1,a),at(hi,r1,b),at(lo,r1,b),[rad(a),rad(a),rad(b),rad(b)]);
    quad(m,at(lo,r0,a),at(lo,r0,b),at(hi,r0,b),at(hi,r0,a),[mul(rad(a),-1),mul(rad(b),-1),mul(rad(b),-1),mul(rad(a),-1)]);
    quad(m,at(lo,r0,a),at(lo,r1,a),at(lo,r1,b),at(lo,r0,b),Array(4).fill([-1,0,0]));
    quad(m,at(hi,r0,a),at(hi,r0,b),at(hi,r1,b),at(hi,r1,a),Array(4).fill([1,0,0]));
  }
  for(const [a,sign]of[[a0,-1],[a1,1]]){const n=[0,Math.cos(a)*sign,-Math.sin(a)*sign];quad(m,at(-xDepth/2,r0,a),at(xDepth/2,r0,a),at(xDepth/2,r1,a),at(-xDepth/2,r1,a),Array(4).fill(n));}
}
/** Continuous circular-section sweep along an analytic helix; no stacked tori.
 * All tube cross-sections are normal to the helix tangent. End caps close the wire.
 * This is a provisional round-wire stand-in; the documented Timmis section and
 * exact working spring/end profile still require an engineering drawing.
 */
function helicalWire(m,center,meanRadius,wireRadius,rise,turns,axialSteps,radialSteps=12) {
  const k=2*Math.PI*turns,L=Math.hypot(meanRadius*k,rise),by=meanRadius*k/L;
  const ring=(t,v)=>{
    const theta=k*t,phi=2*Math.PI*v,ct=Math.cos(theta),st=Math.sin(theta),cp=Math.cos(phi),sp=Math.sin(phi);
    const c=[center[0]+meanRadius*ct,center[1]+rise*t,center[2]+meanRadius*st],n=[ct,0,st],b=[rise/L*st,by,-rise/L*ct];
    const radial=add(mul(n,cp),mul(b,sp));
    const dt=add([-meanRadius*k*st,rise,meanRadius*k*ct],mul(add(mul([-k*st,0,k*ct],cp),mul([rise/L*k*ct,0,rise/L*k*st],sp)),wireRadius));
    const dv=mul(add(mul(n,-sp),mul(b,cp)),2*Math.PI*wireRadius);
    let normal=unit(cross(dt,dv));if(dot(normal,radial)<0)normal=mul(normal,-1);
    return {p:add(c,mul(radial,wireRadius)),n:normal};
  };
  for(let i=0;i<axialSteps;i++)for(let j=0;j<radialSteps;j++){
    const q=[ring(i/axialSteps,j/radialSteps),ring((i+1)/axialSteps,j/radialSteps),ring((i+1)/axialSteps,(j+1)/radialSteps),ring(i/axialSteps,(j+1)/radialSteps)];
    quad(m,...q.map(a=>a.p),q.map(a=>a.n));
  }
  for(const [t,sign]of[[0,-1],[1,1]]){
    const theta=k*t,c=[center[0]+meanRadius*Math.cos(theta),center[1]+rise*t,center[2]+meanRadius*Math.sin(theta)],n=mul(unit([-meanRadius*k*Math.sin(theta),rise,meanRadius*k*Math.cos(theta)]),sign);
    for(let j=0;j<radialSteps;j++)triangle(m,c,ring(t,j/radialSteps).p,ring(t,(j+1)/radialSteps).p,n);
  }
  return {verticalWireRadius:wireRadius*by,normalSection:true};
}
function tubePath(m,path,r,radial=10) {
  for(let i=0;i<path.length-1;i++)cylinder(m,path[i],path[i+1],r,radial);
}
/** A connecting link has a shank and two real open eyes, not painted circles. */
function eyeLink(m,a,b,width=.085,depth=.055) {
  if(Math.abs(a[0]-b[0])>1e-8)throw Error('Eye link must lie in one side plane');
  const direction=unit(sub(b,a)),eye=width*.82,hole=width*.37;
  if(Math.hypot(...sub(b,a))<eye*2)throw Error('Link too short');
  beam(m,add(a,mul(direction,eye*.72)),add(b,mul(direction,-eye*.72)),depth,width*.60);
  for(const c of[a,b])annulus(m,add(c,[-depth/2,0,0]),add(c,[depth/2,0,0]),hole,eye,24);
}
function leaf(m,x,y,z,length,width,thickness,camber,segments) {
  const lower=t=>y+camber*(2*t-1)**2, face=(...q)=>quad(m,...q.reverse());
  for(let i=0;i<segments;i++){
    const t=i/segments,u=(i+1)/segments,za=z+(t-.5)*length,zb=z+(u-.5)*length,ya=lower(t),yb=lower(u),lo=x-width/2,hi=x+width/2;
    face([lo,ya,za],[lo,yb,zb],[hi,yb,zb],[hi,ya,za]);
    face([lo,ya+thickness,za],[hi,ya+thickness,za],[hi,yb+thickness,zb],[lo,yb+thickness,zb]);
    face([lo,ya,za],[lo,ya+thickness,za],[lo,yb+thickness,zb],[lo,yb,zb]);
    face([hi,ya,za],[hi,yb,zb],[hi,yb+thickness,zb],[hi,ya+thickness,za]);
    if(i===0)face([lo,ya,za],[hi,ya,za],[hi,ya+thickness,za],[lo,ya+thickness,za]);
    if(i===segments-1)face([lo,yb,zb],[lo,yb+thickness,zb],[hi,yb+thickness,zb],[hi,yb,zb]);
  }
}
function wedge(m,x,y,z,width,height,length,slope) {
  const q=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*width/2,y+b*height/2+(b>0?a*width*slope/2:0),z+c*length/2]);
  for(const ids of[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]])quad(m,...ids.map(i=>q[i]));
}
function parse(options) {
  if(!options||typeof options!=='object'||Array.isArray(options))throw Error('Expected mechanical parameters');
  for(const key of Object.keys(options))if(!(key in MECHANICS_DEFAULTS))throw Error(`Unknown mechanical parameter ${key}`);
  const p={...MECHANICS_DEFAULTS,...options,axisZ:[...(options.axisZ??MECHANICS_DEFAULTS.axisZ)],tenderAxleIntervals:[...(options.tenderAxleIntervals??MECHANICS_DEFAULTS.tenderAxleIntervals)]};
  for(const[k,v]of Object.entries(p))if(typeof v==='number'&&(!Number.isFinite(v)||v<=0))throw Error(`Invalid positive parameter ${k}`);
  if(p.axisZ.length!==6||!p.axisZ.every(Number.isFinite)||p.axisZ[0]!==0||p.axisZ.some((v,i)=>i>0&&v<=p.axisZ[i-1]))throw Error('Expected ordered six-axle layout from z=0');
  for(const key of['radialSegments','curveSegments','springLeaves','drivingSpringLeaves','trailingSpringLeaves','bogieSpringTurns','carryingSpokeCount'])if(!Number.isInteger(p[key]))throw Error('Integer sampling required');
  if(p.radialSegments<16||p.radialSegments>128||p.curveSegments<6||p.curveSegments>64||p.springLeaves<3||p.springLeaves>24||p.drivingSpringLeaves<3||p.drivingSpringLeaves>24||p.trailingSpringLeaves<3||p.trailingSpringLeaves>24||p.bogieSpringTurns<3||p.bogieSpringTurns>12||p.carryingSpokeCount<6||p.carryingSpokeCount>24)throw Error('Sampling outside mechanical budget');
  if(typeof p.includeCarryingWheels!=='boolean'||typeof p.includeTender!=='boolean')throw Error('Wheel/tender inclusion flags must be boolean');
  if(p.tenderAxleIntervals.length!==3||!p.tenderAxleIntervals.every(v=>Number.isFinite(v)&&v>p.tenderWheelDiameter+.14))throw Error('Invalid tender axle intervals');
  if(p.tenderFrameHalfSeparation<=p.wheelCenterHalfSeparation+p.carryingTyreWidth||p.tenderFrameHalfSeparation>1.3||p.tenderFrameTop<=p.tenderWheelDiameter/2+.65||p.tenderFirstAxleGap<2||p.tenderFrontFrameOverhang>=p.tenderFirstAxleGap-p.rearFrameOverhang-.25)throw Error('Invalid tender/frame separation');
  const R=p.driveDiameter/2,small=Math.min(p.leadingDiameter,p.trailingDiameter)/2;
  if(p.frameHalfSeparation+p.axleboxWidth/2>=p.wheelCenterHalfSeparation-p.carryingTyreWidth/2||p.axleRadius>=p.axleboxSize*.38||p.carryingAxleRadius>=p.axleboxSize*.38||p.frameTop-p.frameRailDepth<=R+p.axleboxSize/2||p.framePlateThickness>=p.axleboxWidth||p.cartazziFrameHalfSeparation<=p.wheelCenterHalfSeparation+p.carryingTyreWidth||p.cartazziFrameHalfSeparation>1.3)throw Error('Invalid frame/bearing/wheel relationship');
  if(p.crankRadius<=p.axleRadius||p.crankRadius>=R*.65||p.couplingRodOffset<=.13||p.mainRodOffset<=p.couplingRodOffset+.065||p.motionOffset<=p.mainRodOffset+.065||p.cylinderRadius<=.1||p.crossheadZ<=p.cylinderZ+p.cylinderLength/2+.4||p.crossheadZ>=p.axisZ[2]-.3)throw Error('Invalid motion proportions');
  if(p.carryingRimDepth>=small*.4||p.carryingFlangeWidth>=p.carryingTyreWidth*.45||p.carryingFlangeHeight>=small*.15||p.brakeShoeHalfAngle>=.5||p.springCamber>=.2||p.drivingSpringHeight<.2||p.cartazziWedgeSlope>.4)throw Error('Invalid component cross-section');
  const coilEnvelope=p.bogieSpringMeanRadius+p.bogieSpringWireRadius;
  if(p.bogieSpringWireRadius>=p.bogieSpringMeanRadius*.32||p.bogieSpringCenterlineRise/p.bogieSpringTurns<=2*p.bogieSpringWireRadius+.003||p.bogieSpringLateralInset<=coilEnvelope+.085||p.bogieSpringLateralInset>=p.frameHalfSeparation-.10||p.bogieSpringAxleZOffset<.075||p.bogieSpringAxleZOffset+coilEnvelope>=p.axleboxSize*.54||p.bogieSpringSeatAboveAxle<=p.axleboxSize/2+.025)throw Error('Invalid bogie spring clearance or pitch');
  if(p.axisZ[1]-p.axisZ[0]<=p.leadingDiameter+.10||p.axisZ[3]-p.axisZ[2]<=p.driveDiameter+2*p.brakeTreadClearance+p.brakeShoeThickness||p.axisZ[4]-p.axisZ[3]<=p.driveDiameter+2*p.brakeTreadClearance+p.brakeShoeThickness)throw Error('Wheel/adjacent brake envelopes overlap');
  return p;
}

export function buildLocomotiveMechanics(options={}) {
  const p=parse(options),parts=[],assemblyCounts={},axles=p.axisZ.map((z,i)=>({index:i,name:['leading-1','leading-2','driver-1','driver-2','driver-3','cartazzi'][i],z,y:(i<2?p.leadingDiameter:i===5?p.trailingDiameter:p.driveDiameter)/2,kind:i<2?'leading':i===5?'cartazzi':'driver'}));
  const make=(name,assembly,fn,material='blackPaint',extra={})=>{const m=mesh(name,material);fn(m);if(!m.indices.length)throw Error('Empty mechanical part');m.metadata={assembly,designStatus:'provisional-dimensional-study',motion:'static-unsolved',...extra};parts.push(m);assemblyCounts[assembly]=(assemblyCounts[assembly]??0)+1;return m;};
  const pin=(name,assembly,x,y,z,r=.034,length=.12)=>make(name,assembly,m=>cylinder(m,[x-length/2,y,z],[x+length/2,y,z],r,p.radialSegments),'brushedMetal');
  const bolt=(m,x,y,z,side=1,r=.018)=>cylinder(m,[x,y,z],[x+side*.025,y,z],r,6);
  const frameStart=-p.frontFrameOverhang,frameEnd=axles[5].z+p.rearFrameOverhang;
  const driverAxes=axles.filter(a=>a.kind==='driver');
  const tenderAxles=p.includeTender?Array.from({length:4},(_,i)=>({index:6+i,name:`tender-${i+1}`,z:axles[5].z+p.tenderFirstAxleGap+p.tenderAxleIntervals.slice(0,i).reduce((s,v)=>s+v,0),y:p.tenderWheelDiameter/2,kind:'tender'})):[];
  const tenderFrameStart=p.includeTender?tenderAxles[0].z-p.tenderFrontFrameOverhang:null,tenderFrameEnd=p.includeTender?tenderAxles[3].z+p.tenderRearFrameOverhang:null;

  // Split plate frames: the axlebox/horn apertures are actual spaces, not dark decals.
  for(const side of[-1,1]) {
    const x=side*p.frameHalfSeparation;
    make(`main-frame-${side}`,'underframe',m=>{
      cuboid(m,[x,p.frameTop-p.frameRailDepth/2,(frameStart+frameEnd)/2],[p.framePlateThickness,p.frameRailDepth,frameEnd-frameStart]);
      const spans=[frameStart,...driverAxes.flatMap(a=>[a.z-p.axleboxSize*.85,a.z+p.axleboxSize*.85]),frameEnd];
      for(let i=0;i<spans.length;i+=2){const z0=spans[i],z1=spans[i+1];if(z1>z0)cuboid(m,[x,1.20,(z0+z1)/2],[p.framePlateThickness,.53,z1-z0]);}
    });
    make(`frame-fasteners-${side}`,'underframe',m=>{for(let z=frameStart+.2;z<frameEnd;z+=.48)bolt(m,x+side*p.framePlateThickness/2,p.frameTop-.09,z,side);},'brushedMetal');
  }
  const crossStations=[frameStart+.15,axles[1].z+.55,...driverAxes.slice(1).map((a,i)=>(a.z+driverAxes[i].z)/2),axles[4].z+.90,frameEnd-.2];
  crossStations.forEach((z,i)=>make(`frame-cross-stretcher-${i}`,'underframe',m=>{cuboid(m,[0,p.frameTop-.16,z],[2*p.frameHalfSeparation,.22,.14]);for(const s of[-1,1])beam(m,[0,p.frameTop-.27,z],[s*p.frameHalfSeparation,p.frameTop-.27,z+.22],.08,.08);}));
  make('front-bufferbeam-structural-member','underframe',m=>cuboid(m,[0,p.frameTop-.24,frameStart],[2.42,.31,.15]));
  make('rear-dragbox-structural-member','underframe',m=>{cuboid(m,[0,p.frameTop-.22,frameEnd],[2.18,.34,.20]);for(const s of[-1,1])cuboid(m,[s*.35,p.frameTop-.24,frameEnd-.25],[.12,.28,.40]);});

  function axlebox(a,x,assembly,size=p.axleboxSize) {
    const r=a.kind==='driver'?p.axleRadius:p.carryingAxleRadius,depth=p.axleboxWidth,hole=r*1.13,wall=(size-2*hole)/2;
    make(`${a.name}-axlebox-${Math.sign(x)}`,assembly,m=>{
      cuboid(m,[x,a.y+hole+wall/2,a.z],[depth,wall,size]);cuboid(m,[x,a.y-hole-wall/2,a.z],[depth,wall,size]);
      for(const s of[-1,1])cuboid(m,[x,a.y,a.z+s*(hole+wall/2)],[depth,2*hole,wall]);
      cuboid(m,[x,a.y+size/2+.025,a.z],[depth*.90,.05,size*.75]);
      cuboid(m,[x,a.y-size/2-.025,a.z],[depth*.95,.05,size*.80]);
      for(const sy of[-1,1])for(const sz of[-1,1])bolt(m,x+Math.sign(x)*depth/2,a.y+sy*size*.35,a.z+sz*size*.35,Math.sign(x),.012);
    });
    make(`${a.name}-journal-bearing-${Math.sign(x)}`,assembly,m=>annulus(m,[x-depth*.54,a.y,a.z],[x+depth*.54,a.y,a.z],r*1.012,r*1.115,p.radialSegments),'brushedMetal');
    make(`${a.name}-oil-pot-${Math.sign(x)}`,assembly,m=>{cuboid(m,[x,a.y+size/2+.075,a.z],[depth*.5,.055,size*.3]);cylinder(m,[x,a.y+size/2+.10,a.z],[x,a.y+size/2+.12,a.z],.035,20);});
  }
  function horns(a,x,top,assembly) {
    const bottom=a.y-p.axleboxSize*.67;
    make(`${a.name}-horn-guides-${Math.sign(x)}`,assembly,m=>{
      for(const s of[-1,1]){cuboid(m,[x,(top+bottom)/2,a.z+s*p.axleboxSize*.64],[p.axleboxWidth*.58,top-bottom,p.axleboxSize*.20]);cuboid(m,[x,a.y,a.z+s*p.axleboxSize*.53],[p.axleboxWidth*.70,p.axleboxSize*1.12,.025]);}
      cuboid(m,[x,bottom-.025,a.z],[p.axleboxWidth*.68,.05,p.axleboxSize*1.5]);
    });
  }
  function spring(a,x,y,length,assembly,underslung=false) {
    const spec=a.kind==='driver'?{leaves:p.drivingSpringLeaves,width:p.drivingSpringWidth,thickness:p.drivingSpringLeafThickness,kind:'1935-coupled'}:a.kind==='cartazzi'?{leaves:p.trailingSpringLeaves,width:p.trailingSpringWidth,thickness:p.trailingSpringLeafThickness,kind:'1935-trailing'}:{leaves:p.springLeaves,width:p.springWidth,thickness:p.springLeafThickness,kind:'provisional-carrying-or-tender'};
    const primary=spec.kind!=='provisional-carrying-or-tender',pitch=spec.thickness;
    make(`${a.name}-leaf-spring-${Math.sign(x)}`,assembly,m=>{
      for(let i=0;i<spec.leaves;i++){
        const fraction=.48+.52*i/(spec.leaves-1);
        // Common curvature prevents shorter leaves from bulging into longer ones.
        // Individual blank lengths/camber remain provisional; full-length support
        // centres and each plate's material width/thickness are separately defined.
        leaf(m,x,y+i*pitch,a.z,length*fraction,spec.width,spec.thickness,p.springCamber*fraction*fraction,p.curveSegments);
      }
      cuboid(m,[x,y+spec.leaves*pitch/2,a.z],[spec.width+.035,spec.leaves*pitch+.035,.13]);
    },'blackPaint',{springPlateCount:spec.leaves,springPlateWidth:spec.width,springPlateThickness:spec.thickness,springSupportCentres:length,springDimensionEvidence:primary?'The Engineer 1935-09-27 p320 explicit table; editable defaults':'provisional; not inferred from coupled/trailing table',springKind:spec.kind});
    make(`${a.name}-spring-load-links-${Math.sign(x)}`,assembly,m=>{
      const endY=y+(spec.leaves-1)*pitch+p.springCamber,anchorY=underslung?a.y-p.axleboxSize*.57:endY+.23;
      for(const s of[-1,1]){const z=a.z+s*length/2;cylinder(m,[x,endY,z],[x,anchorY,z],.018,12);annulus(m,[x-.07,endY,z],[x+.07,endY,z],.023,.045,20);cuboid(m,[x,anchorY,z],[.18,.07,.13]);}
      if(underslung)cylinder(m,[x,y+spec.leaves*pitch,a.z],[x,a.y-p.axleboxSize/2,a.z],.026,16);
      else cuboid(m,[x,(a.y+p.axleboxSize/2+y)/2,a.z],[.11,Math.max(.025,y-a.y-p.axleboxSize/2),.13]);
    });
  }

  function bogieLoadSpring(a,side) {
    const springX=side*(p.frameHalfSeparation-p.bogieSpringLateralInset),springZ=a.z+p.bogieSpringAxleZOffset,R=p.bogieSpringMeanRadius,r=p.bogieSpringWireRadius,k=2*Math.PI*p.bogieSpringTurns;
    const verticalRadius=r*R*k/Math.hypot(R*k,p.bogieSpringCenterlineRise),lowerSeatBottom=a.y+p.bogieSpringSeatAboveAxle,lowerSeatTop=lowerSeatBottom+p.bogieSpringSeatThickness;
    const wireCenterY=lowerSeatTop+verticalRadius,wireTop=wireCenterY+p.bogieSpringCenterlineRise+verticalRadius,upperSeatTop=wireTop+p.bogieSpringSeatThickness,seatRadius=R+r+.020;
    const coilMin=[springX-R-r,lowerSeatTop,springZ-R-r],coilMax=[springX+R+r,wireTop,springZ+R+r];
    const clearance={bogieSideFrame:p.bogieSpringLateralInset-(R+r)-.105/2,mainFrame:p.bogieSpringLateralInset-(R+r)-p.framePlateThickness/2,wheelFlange:p.wheelCenterHalfSeparation-p.carryingTyreWidth/2-p.carryingFlangeWidth/2-(Math.abs(springX)+R+r),oilPot:p.frameHalfSeparation-p.axleboxWidth*.25-(Math.abs(springX)+R+r),axleboxCover:lowerSeatTop-(a.y+p.axleboxSize/2+.050),frontHornZ:p.axleboxSize*.54-(p.bogieSpringAxleZOffset+R+r),selfPitch:p.bogieSpringCenterlineRise/p.bogieSpringTurns-2*r};
    if(Object.values(clearance).some(v=>v<=0))throw Error('Bogie coil intersects checked local envelope');
    make(`${a.name}-helical-load-spring-${side}`,'leading-bogie',m=>helicalWire(m,[springX,wireCenterY,springZ],R,r,p.bogieSpringCenterlineRise,p.bogieSpringTurns,p.bogieSpringTurns*p.curveSegments*2,12),'brushedMetal',{springType:'helical',springTypeEvidence:'The Engineer 1935-09-27 p320 explicit bogie spring table',wireSection:'provisional circular; historical Timmis section not reconstructed',wireRadius:r,meanRadius:R,turns:p.bogieSpringTurns,centerlineRise:p.bogieSpringCenterlineRise,springInstallation:'four provisional axle-associated mounting stations, not an engineering placement claim',continuousSweep:true,coilEnvelope:{min:coilMin,max:coilMax},localClearanceMetres:clearance,clearanceScope:'static conservative component envelopes and axial pitch only; no full vehicle swept collision approval'});
    make(`${a.name}-spring-end-seats-${side}`,'leading-bogie',m=>{
      cylinder(m,[springX,lowerSeatBottom,springZ],[springX,lowerSeatTop,springZ],seatRadius,32);
      cylinder(m,[springX,wireTop,springZ],[springX,upperSeatTop,springZ],seatRadius,32);
      // Lower lug meets the axlebox top cover away from its oil-pot Z envelope.
      beam(m,[side*p.frameHalfSeparation,lowerSeatBottom+.005,springZ],[springX,lowerSeatBottom+.005,springZ],.040,.030);
      // Upper bridge stays above the wire, then descends inboard of the frame.
      const postX=side*(p.frameHalfSeparation-.075),bridgeY=upperSeatTop+.008,footY=p.bogieFrameHeight+p.bogieFrameDepth/2-.009;
      beam(m,[springX,bridgeY,springZ],[postX,bridgeY,springZ],.04,.016);
      beam(m,[postX,bridgeY,springZ],[postX,footY,springZ],.018,.04);
      beam(m,[postX,footY,springZ],[side*p.frameHalfSeparation,footY,springZ],.04,.018);
    },'blackPaint',{mountingDimensions:'provisional',lowerSeatTopY:lowerSeatTop,upperSeatBottomY:wireTop,contactRule:'wire vertical envelope touches both seats; support lugs retain an axlebox-to-bogie-frame load path'});
  }

  // Two plain coupled shafts and the middle crank axle, with journal geometry.
  for(const a of axles) {
    const assembly=a.kind==='driver'?'coupled-axles':a.kind==='leading'?'leading-bogie':'cartazzi',r=a.kind==='driver'?p.axleRadius:p.carryingAxleRadius;
    const half=a.kind==='cartazzi'?p.cartazziFrameHalfSeparation+.17:p.wheelCenterHalfSeparation+.04;
    make(`${a.name}-axle-shaft`,assembly,m=>{
      if(a.index===3){cylinder(m,[-half,a.y,a.z],[-.14,a.y,a.z],r,p.radialSegments);cylinder(m,[.14,a.y,a.z],[half,a.y,a.z],r,p.radialSegments);}
      else cylinder(m,[-half,a.y,a.z],[half,a.y,a.z],r,p.radialSegments);
    },'brushedMetal',{axleIndex:a.index,nominalCenter:[0,a.y,a.z],nominalTreadDiameter:2*a.y});
    const x=a.kind==='cartazzi'?p.cartazziFrameHalfSeparation:p.frameHalfSeparation;
    for(const side of[-1,1]){
      axlebox(a,side*x,assembly);
      horns(a,side*x,a.kind==='leading'?p.bogieFrameHeight:p.frameTop-p.frameRailDepth,assembly);
      if(a.kind==='driver')spring(a,side*x,p.drivingSpringHeight,p.drivingSpringLength,'coupled-suspension',true);
      if(a.kind==='leading')bogieLoadSpring(a,side);
    }
  }
  const middle=driverAxes[1],innerCrankY=middle.y+p.crankRadius;
  make('middle-crank-axle-webs','inner-motion',m=>{for(const x of[-.14,.14])beam(m,[x,middle.y,middle.z],[x,innerCrankY,middle.z],.085,.24);cylinder(m,[-.14,innerCrankY,middle.z],[.14,innerCrankY,middle.z],p.axleRadius*.82,p.radialSegments);},'brushedMetal');

  // Front bogie: an independent structural cradle, centre pin/bearing,
  // two side bearers, and two distinct side-control spring packages.
  const bz=(axles[0].z+axles[1].z)/2;
  for(const side of[-1,1])make(`bogie-side-frame-${side}`,'leading-bogie',m=>{
    cuboid(m,[side*p.frameHalfSeparation,p.bogieFrameHeight,bz],[.105,p.bogieFrameDepth,axles[1].z-axles[0].z+.66]);
    for(const z of[axles[0].z-.28,axles[1].z+.28])beam(m,[side*p.frameHalfSeparation,p.bogieFrameHeight,z],[side*p.frameHalfSeparation,.49,bz],.09,.09);
  });
  for(const [i,z]of[axles[0].z-.27,bz,axles[1].z+.27].entries())make(`bogie-cross-member-${i}`,'leading-bogie',m=>cuboid(m,[0,p.bogieFrameHeight-.06,z],[2*p.frameHalfSeparation,.16,.15]));
  make('bogie-central-bolster','leading-bogie',m=>{cuboid(m,[0,1.01,bz],[1.12,.18,.33]);cylinder(m,[0,1.10,bz],[0,1.25,bz],.20,p.radialSegments);cylinder(m,[0,.79,bz],[0,1.47,bz],.075,p.radialSegments);});
  make('bogie-bearing-plates','leading-bogie',m=>{for(const x of[-.40,0,.40])cylinder(m,[x,1.225,bz],[x,1.25,bz],x===0?.20:.115,p.radialSegments);},'brushedMetal');
  for(const [i,z]of[bz-.23,bz+.23].entries()){
    make(`bogie-side-control-spring-${i}`,'leading-bogie',m=>{
      const path=[],n=8*p.curveSegments;for(let j=0;j<=n;j++){const t=j/n,ang=t*2*Math.PI*8;path.push([-.40+.80*t,.62+.078*Math.sin(ang),z+.078*Math.cos(ang)]);}tubePath(m,path,.012,8);
    },'brushedMetal');
    make(`bogie-side-control-cups-${i}`,'leading-bogie',m=>{for(const s of[-1,1]){annulus(m,[s*.40,.62,z],[s*.44,.62,z],.027,.11,28);cylinder(m,[s*.40,.62,z],[s*.49,.62,z],.024,16);}cuboid(m,[0,.62,z],[.085,.23,.13]);});
  }

  // Cartazzi: outside fixed frame extensions and sliding/wedge interfaces.
  // Deliberately no kingpin or generic trailing-truck steering geometry.
  const tail=axles[5];
  for(const side of[-1,1]) {
    const x=side*p.cartazziFrameHalfSeparation;
    make(`cartazzi-frame-extension-${side}`,'cartazzi',m=>{
      beam(m,[side*p.frameHalfSeparation,1.24,axles[4].z+.85],[x,1.24,tail.z-.60],.10,.29);
      cuboid(m,[x,1.24,tail.z+.10],[.10,.26,1.48]);
      beam(m,[x,1.24,tail.z+.84],[side*p.frameHalfSeparation,1.37,frameEnd],.10,.22);
    });
    make(`cartazzi-inclined-bearing-pair-${side}`,'cartazzi',m=>{
      wedge(m,x,tail.y+.235,tail.z,.28,.07,.24,side*p.cartazziWedgeSlope);
      wedge(m,x,tail.y+.310,tail.z,.28,.07,.24,-side*p.cartazziWedgeSlope);
    },'brushedMetal');
    spring(tail,x,tail.y+.35,p.trailingSpringLength,'cartazzi');
    make(`cartazzi-spring-end-boxes-${side}`,'cartazzi',m=>{for(const s of[-1,1]){
      const z=tail.z+s*p.trailingSpringLength/2;cuboid(m,[x,1.25,z],[.22,.18,.22]);cylinder(m,[x,1.12,z],[x,1.37,z],.026,20);
    }});
    make(`cartazzi-rubber-spring-pads-${side}`,'cartazzi',m=>{for(const s of[-1,1])cylinder(m,[x,1.29,tail.z+s*p.trailingSpringLength/2],[x,1.34,tail.z+s*p.trailingSpringLength/2],.067,24);},'rubber');
  }

  // Corridor tender: four independent axle stations and outside bearing frames.
  // Rail-contact diameter and intervals are 1935 dimensions; frame/spring/rigging
  // proportions are explicitly provisional, including all mounting interfaces.
  if(p.includeTender){
    for(const side of[-1,1]){
      const x=side*p.tenderFrameHalfSeparation;
      make(`tender-main-frame-${side}`,'tender-underframe',m=>{
        cuboid(m,[x,p.tenderFrameTop-.13,(tenderFrameStart+tenderFrameEnd)/2],[.09,.26,tenderFrameEnd-tenderFrameStart]);
        const spans=[tenderFrameStart,...tenderAxles.flatMap(a=>[a.z-.24,a.z+.24]),tenderFrameEnd];
        for(let j=0;j<spans.length;j+=2)cuboid(m,[x,.99,(spans[j]+spans[j+1])/2],[.09,.52,spans[j+1]-spans[j]]);
      });
    }
    const ts=[tenderFrameStart+.08,...tenderAxles.slice(1).map((a,i)=>(a.z+tenderAxles[i].z)/2),tenderFrameEnd-.08];
    ts.forEach((z,i)=>make(`tender-cross-stretcher-${i}`,'tender-underframe',m=>{cuboid(m,[0,p.tenderFrameTop-.13,z],[2*p.tenderFrameHalfSeparation,.20,.15]);for(const side of[-1,1])beam(m,[0,p.tenderFrameTop-.24,z],[side*p.tenderFrameHalfSeparation,p.tenderFrameTop-.24,z+.25],.08,.07);}));
    make('tender-body-support-rails','tender-underframe',m=>{for(const side of[-1,1])cuboid(m,[side*.89,p.tenderFrameTop+.015,(tenderFrameStart+tenderFrameEnd)/2],[.19,.06,tenderFrameEnd-tenderFrameStart]);});
    for(const [i,z]of[tenderFrameStart,tenderFrameEnd].entries())make(`tender-end-dragbox-${i}`,'tender-underframe',m=>{cuboid(m,[0,1.30,z],[2.36,.33,.20]);for(const side of[-1,1])cuboid(m,[side*.27,1.17,z],[.12,.28,.30]);});
    for(const a of tenderAxles){
      make(`${a.name}-axle-shaft`,'tender-axles',m=>cylinder(m,[-p.tenderFrameHalfSeparation-.17,a.y,a.z],[p.tenderFrameHalfSeparation+.17,a.y,a.z],p.carryingAxleRadius,p.radialSegments),'brushedMetal',{axleIndex:a.index,nominalCenter:[0,a.y,a.z],nominalTreadDiameter:2*a.y});
      for(const side of[-1,1]){const x=side*p.tenderFrameHalfSeparation;axlebox(a,x,'tender-axles');horns(a,x,p.tenderFrameTop-.15,'tender-axles');spring(a,x,a.y+.285,p.tenderSpringLength,'tender-suspension');
        make(`${a.name}-spring-retainer-box-${side}`,'tender-suspension',m=>{for(const end of[-1,1]){const z=a.z+end*p.tenderSpringLength/2;cuboid(m,[x,1.25,z],[.20,.16,.18]);cylinder(m,[x,1.10,z],[x,1.37,z],.021,20);}});
      }
      const bz=a.z+a.y+p.brakeTreadClearance+p.brakeShoeThickness/2;
      for(const side of[-1,1]){const x=side*p.wheelCenterHalfSeparation;
        make(`${a.name}-brake-shoe-${side}`,'tender-brakes',m=>sector(m,[x,a.y,a.z],p.carryingTyreWidth*.84,a.y+p.brakeTreadClearance,a.y+p.brakeTreadClearance+p.brakeShoeThickness,-.23,.23,p.curveSegments));
        make(`${a.name}-brake-hanger-${side}`,'tender-brakes',m=>{eyeLink(m,[x,1.27,bz+.04],[x,.39,bz+.04],.08,.055);beam(m,[x,a.y,bz+.04],[x,a.y,bz-.01],.08,.08);},'brushedMetal');
        make(`${a.name}-brake-hanger-bracket-${side}`,'tender-brakes',m=>beam(m,[side*p.tenderFrameHalfSeparation,1.27,bz+.04],[x,1.27,bz+.04],.09,.08));
      }
      make(`${a.name}-brake-crossbeam`,'tender-brakes',m=>beam(m,[-p.wheelCenterHalfSeparation,.39,bz+.04],[p.wheelCenterHalfSeparation,.39,bz+.04],.07,.07));
    }
    const tbz=tenderAxles.map(a=>a.z+a.y+p.brakeTreadClearance+p.brakeShoeThickness/2+.04);
    for(const side of[-1,1])make(`tender-brake-pull-links-${side}`,'tender-brakes',m=>{for(let i=0;i<3;i++)eyeLink(m,[side*.30,.39,tbz[i]],[side*.30,.39,tbz[i+1]],.06,.035);},'brushedMetal');
    const tcZ=(tenderAxles[1].z+tenderAxles[2].z)/2;
    make('tender-brake-operating-shaft','tender-brakes',m=>{cylinder(m,[-.55,.68,tcZ],[.55,.68,tcZ],.04,28);for(const x of[-.3,.3]){eyeLink(m,[x,.68,tcZ],[x,.39,tcZ+.26],.08,.05);eyeLink(m,[x,.39,tcZ+.26],[x,.39,tbz[2]],.06,.035);}},'brushedMetal');
    for(const [i,x]of[-.52,0,.52].entries())make(`tender-vacuum-cylinder-${i}`,'tender-brakes',m=>{const r=x===0?.20:.14;cylinder(m,[x,.90,tcZ],[x,1.22,tcZ],r,p.radialSegments);for(const y of[.9,1.22])cylinder(m,[x,y-.015,tcZ],[x,y+.015,tcZ],r+.015,p.radialSegments);cylinder(m,[x,.68,tcZ],[x,.91,tcZ],.022,20);});
    // Main drawbar plus two safety links: vertical-axis pin eyes and supports.
    for(const [i,x]of[0,-.31,.31].entries())make(`locomotive-tender-draw-link-${i}`,'tender-drawgear',m=>{const a=[x,1.10,frameEnd-.04],b=[x,1.10,tenderFrameStart+.04],d=unit(sub(b,a)),r=i===0?.09:.065;beam(m,add(a,mul(d,r*.73)),add(b,mul(d,-r*.73)),i===0?.09:.06,.045);for(const c of[a,b]){annulus(m,add(c,[0,-.032,0]),add(c,[0,.032,0]),r*.4,r,28);cylinder(m,add(c,[0,-.09,0]),add(c,[0,.11,0]),r*.33,24);}},'brushedMetal');
    make('drawbar-interface-mounts','tender-drawgear',m=>{for(const z of[frameEnd-.04,tenderFrameStart+.04])for(const x of[0,-.31,.31]){cuboid(m,[x,1.22,z],[.18,.06,.22]);cuboid(m,[x,1.0,z],[.18,.06,.22]);}});
  }

  // Carrying wheels have independent tyres, hubs and editable spoke counts.
  if(p.includeCarryingWheels)for(const a of [...axles.filter(a=>a.kind!=='driver'),...tenderAxles])for(const side of[-1,1]){
    const x=side*p.wheelCenterHalfSeparation,R=a.y,w=p.carryingTyreWidth,inner=R-p.carryingRimDepth,wheelAssembly=a.kind==='tender'?'tender-wheels':'carrying-wheels';
    make(`${a.name}-wheel-${side}-tyre`,wheelAssembly,m=>{
      annulus(m,[x-w/2,a.y,a.z],[x+w/2,a.y,a.z],inner,R,p.radialSegments);
      const inward=x-side*w/2;annulus(m,[inward-side*p.carryingFlangeWidth/2,a.y,a.z],[inward+side*p.carryingFlangeWidth/2,a.y,a.z],R-.01,R+p.carryingFlangeHeight,p.radialSegments);
    },'brushedMetal',{axleIndex:a.index,nominalTreadDiameter:2*R});
    make(`${a.name}-wheel-${side}-centre`,wheelAssembly,m=>{
      annulus(m,[x-.09,a.y,a.z],[x+.09,a.y,a.z],p.carryingAxleRadius*.99,.13,p.radialSegments);
      for(let i=0;i<p.carryingSpokeCount;i++){const t=i*2*Math.PI/p.carryingSpokeCount,at=r=>[x,a.y+r*Math.sin(t),a.z+r*Math.cos(t)];beam(m,at(.125),at(inner+.01),.052,.045);}
    });
  }

  // Six brake hangers and blocks on the coupled wheels, three cross beams,
  // two brake shafts, two leading vacuum cylinders and one larger rear one.
  for(const a of driverAxes){
    const R=a.y,bz=a.z+R+p.brakeTreadClearance+p.brakeShoeThickness/2;
    for(const side of[-1,1]){
      const x=side*p.wheelCenterHalfSeparation;
      make(`${a.name}-brake-shoe-${side}`,'brakes',m=>sector(m,[x,a.y,a.z],p.carryingTyreWidth*.84,R+p.brakeTreadClearance,R+p.brakeTreadClearance+p.brakeShoeThickness,-p.brakeShoeHalfAngle,p.brakeShoeHalfAngle,p.curveSegments),'blackPaint');
      make(`${a.name}-brake-hanger-${side}`,'brakes',m=>{eyeLink(m,[x,1.60,bz+.055],[x,.69,bz+.055],.095,.07);beam(m,[x,a.y,bz+.055],[x,a.y,bz-.01],.10,.09);},'brushedMetal');
      pin(`${a.name}-brake-hanger-pin-${side}`,'brakes',x,1.60,bz+.055,.034,.16);
      make(`${a.name}-brake-hanger-bracket-${side}`,'brakes',m=>beam(m,[side*p.frameHalfSeparation,1.61,bz+.055],[x,1.61,bz+.055],.10,.09));
    }
    make(`${a.name}-brake-crossbeam`,'brakes',m=>beam(m,[-p.wheelCenterHalfSeparation,.69,bz+.055],[p.wheelCenterHalfSeparation,.69,bz+.055],.075,.09));
  }
  const brakeZ=driverAxes.map(a=>a.z+a.y+p.brakeTreadClearance+p.brakeShoeThickness/2+.055);
  for(const side of[-1,1])make(`brake-longitudinal-pull-${side}`,'brakes',m=>{
    for(let i=0;i<brakeZ.length-1;i++)eyeLink(m,[side*.30,.69,brakeZ[i]],[side*.30,.69,brakeZ[i+1]],.065,.04);
  },'brushedMetal');
  const shafts=[axles[2].z-.65,(axles[3].z+axles[4].z)/2];
  shafts.forEach((z,i)=>make(`brake-shaft-${i}`,'brakes',m=>{
    cylinder(m,[-.59,.84,z],[.59,.84,z],.043,p.radialSegments);
    for(const x of[-.30,.30])eyeLink(m,[x,.84,z],[x,.69,z+.28],.08,.06);
  },'brushedMetal'));
  for(const [i,c]of[[0,[-.28,1.06,shafts[0]]],[1,[.28,1.06,shafts[0]]],[2,[0,1.08,shafts[1]]]]){
    const r=i<2?.14:.235;
    make(`vacuum-brake-cylinder-${i}`,'brakes',m=>{cylinder(m,[c[0],c[1]-.16,c[2]],[c[0],c[1]+.16,c[2]],r,p.radialSegments);cylinder(m,[c[0],c[1]-.23,c[2]],[c[0],c[1]-.12,c[2]],.026,20);for(const dy of[-.16,.16])cylinder(m,[c[0],c[1]+dy-.012,c[2]],[c[0],c[1]+dy+.012,c[2]],r+.018,p.radialSegments);});
    make(`vacuum-brake-cylinder-support-${i}`,'brakes',m=>{for(const s of[-1,1])beam(m,[c[0]+s*r,c[1],c[2]],[c[0]+s*r,1.48,c[2]],.035,.045);});
  }
  make('brake-shaft-pull-links','brakes',m=>{
    for(const side of[-1,1]){eyeLink(m,[side*.30,.69,shafts[0]+.28],[side*.30,.69,brakeZ[0]],.06,.04);eyeLink(m,[side*.30,.69,shafts[1]+.28],[side*.30,.69,brakeZ[2]],.06,.04);}
  },'brushedMetal');

  // Outside motion. All pin positions are one explicit, unsolved static pose.
  // Wheel generators are owned by the caller and are intentionally not invoked.
  for(const side of[-1,1]) {
    const cx=side*(p.wheelCenterHalfSeparation+p.couplingRodOffset),mx=side*(p.wheelCenterHalfSeparation+p.mainRodOffset),vx=side*(p.wheelCenterHalfSeparation+p.motionOffset),cy=driverAxes[0].y+p.crankRadius;
    for(let i=0;i<2;i++)make(`coupling-rod-${side}-${i}`,'outside-motion',m=>eyeLink(m,[cx,cy,driverAxes[i].z],[cx,cy,driverAxes[i+1].z],.13,.055),'brushedMetal');
    driverAxes.forEach(a=>pin(`coupling-crank-pin-extension-${side}-${a.index}`,'outside-motion',side*(p.wheelCenterHalfSeparation+.20),cy,a.z,.043,.18));
    make(`outside-main-connecting-rod-${side}`,'outside-motion',m=>eyeLink(m,[mx,p.cylinderHeight,p.crossheadZ],[mx,cy,middle.z],.155,.073),'brushedMetal');
    pin(`outside-main-rod-big-end-pin-${side}`,'outside-motion',mx,cy,middle.z,.05,.23);
    const cc=side*p.cylinderHalfSeparation,front=p.cylinderZ-p.cylinderLength/2,rear=p.cylinderZ+p.cylinderLength/2;
    make(`outside-cylinder-${side}`,'cylinders',m=>{
      cylinder(m,[cc,p.cylinderHeight,front],[cc,p.cylinderHeight,rear],p.cylinderRadius,p.radialSegments);
      for(const z of[front,rear]){cylinder(m,[cc,p.cylinderHeight,z-.025],[cc,p.cylinderHeight,z+.025],p.cylinderRadius+.025,p.radialSegments);for(let i=0;i<12;i++){const a=i*Math.PI/6;cylinder(m,[cc+(p.cylinderRadius+.012)*Math.cos(a),p.cylinderHeight+(p.cylinderRadius+.012)*Math.sin(a),z-.03],[cc+(p.cylinderRadius+.012)*Math.cos(a),p.cylinderHeight+(p.cylinderRadius+.012)*Math.sin(a),z+.03],.012,6);}}
      cuboid(m,[cc,p.cylinderHeight+p.cylinderRadius+.075,p.cylinderZ],[.30,.15,p.cylinderLength*.8]);
    });
    make(`outside-piston-rod-${side}`,'outside-motion',m=>cylinder(m,[cc,p.cylinderHeight,rear],[cc,p.cylinderHeight,p.crossheadZ],.038,p.radialSegments),'brushedMetal');
    make(`outside-crosshead-${side}`,'outside-motion',m=>{cuboid(m,[cc,p.cylinderHeight,p.crossheadZ],[.18,.20,.30]);cylinder(m,[cc-side*.10,p.cylinderHeight,p.crossheadZ],[mx+side*.07,p.cylinderHeight,p.crossheadZ],.046,24);},'brushedMetal');
    make(`outside-slidebars-${side}`,'outside-motion',m=>{for(const s of[-1,1])cuboid(m,[cc,p.cylinderHeight+s*.145,(rear+p.crossheadZ+.66)/2],[.095,.055,p.crossheadZ+.66-rear]);},'brushedMetal');
    make(`outside-motion-bracket-${side}`,'outside-motion',m=>{cuboid(m,[cc,p.cylinderHeight,p.crossheadZ+.64],[.14,.39,.10]);beam(m,[cc,p.cylinderHeight+.20,p.crossheadZ+.64],[side*p.frameHalfSeparation,p.frameTop-.1,p.crossheadZ+.64],.10,.10);});
    const eccentric=[vx,cy+.22,middle.z-.20],lower=[vx,1.31,3.51],slider=[vx,1.72,3.54],combTop=[vx,1.94,p.crossheadZ-.23],combBottom=[vx,1.14,p.crossheadZ-.18];
    make(`return-crank-${side}`,'outside-valve-gear',m=>eyeLink(m,[vx,cy,middle.z],eccentric,.09,.05),'brushedMetal');
    make(`eccentric-rod-${side}`,'outside-valve-gear',m=>eyeLink(m,eccentric,lower,.075,.045),'brushedMetal');
    make(`slotted-expansion-link-${side}`,'outside-valve-gear',m=>{
      for(const r of[.825,.875])sector(m,[vx,1.58,2.70],.055,r-.012,r+.012,-.33,.33,p.curveSegments);
      for(const a of[-.33,.33])sector(m,[vx,1.58,2.70],.055,.813,.887,a-.018,a+.018,2);
    },'brushedMetal');
    pin(`expansion-link-trunnion-${side}`,'outside-valve-gear',vx,1.58,3.55,.036,.16);
    make(`expansion-link-frame-bracket-${side}`,'outside-valve-gear',m=>beam(m,[side*p.frameHalfSeparation,1.58,3.55],[vx,1.58,3.55],.09,.08));
    make(`radius-rod-${side}`,'outside-valve-gear',m=>eyeLink(m,slider,combTop,.06,.04),'brushedMetal');
    make(`combination-lever-${side}`,'outside-valve-gear',m=>eyeLink(m,combBottom,combTop,.07,.045),'brushedMetal');
    make(`union-link-${side}`,'outside-valve-gear',m=>eyeLink(m,[vx,p.cylinderHeight,p.crossheadZ],combBottom,.065,.04),'brushedMetal');
    make(`valve-rod-crosshead-${side}`,'outside-valve-gear',m=>{cylinder(m,[cc,1.94,front-.15],[cc,1.94,p.crossheadZ-.23],.025,24);cuboid(m,[cc,1.94,p.crossheadZ-.23],[.13,.11,.18]);cylinder(m,[cc,1.94,p.crossheadZ-.23],[vx,1.94,p.crossheadZ-.23],.026,20);},'brushedMetal');
    make(`reverser-lifting-link-${side}`,'outside-valve-gear',m=>eyeLink(m,slider,[vx,2.10,3.75],.06,.04),'brushedMetal');
    make(`reverser-reach-rod-${side}`,'outside-valve-gear',m=>eyeLink(m,[vx,2.10,3.75],[vx,2.10,tail.z-.4],.055,.035),'brushedMetal');
  }

  // Third cylinder and internal connecting mechanism: real separate generated
  // structures, kept static; cylinder slope and inside crank phase are provisional.
  const innerFront=[0,1.80,p.cylinderZ-.28],innerRear=[0,1.64,p.cylinderZ+.60],innerCrosshead=[0,1.57,p.crossheadZ+.12];
  make('inside-cylinder','cylinders',m=>{cylinder(m,innerFront,innerRear,p.cylinderRadius*.92,p.radialSegments);for(const c of[innerFront,innerRear])cylinder(m,add(c,[0,0,-.025]),add(c,[0,0,.025]),p.cylinderRadius*.99,p.radialSegments);});
  make('inside-piston-and-crosshead','inner-motion',m=>{cylinder(m,innerRear,innerCrosshead,.039,24);cuboid(m,innerCrosshead,[.22,.20,.31]);cylinder(m,add(innerCrosshead,[-.17,0,0]),add(innerCrosshead,[.17,0,0]),.045,24);},'brushedMetal');
  make('inside-slidebars-and-bracket','inner-motion',m=>{for(const s of[-1,1])beam(m,add(innerRear,[0,s*.15,.03]),add(innerCrosshead,[0,s*.15,.55]),.11,.05);cuboid(m,add(innerCrosshead,[0,0,.55]),[.36,.42,.11]);},'brushedMetal');
  make('inside-main-connecting-rod','inner-motion',m=>eyeLink(m,innerCrosshead,[0,innerCrankY,middle.z],.15,.15),'brushedMetal');
  make('inside-valve-chest-and-spindle','cylinders',m=>{cylinder(m,[0,2.08,p.cylinderZ-.30],[0,1.94,p.cylinderZ+.60],.12,p.radialSegments);cylinder(m,[0,2.09,.55],[0,2.01,p.cylinderZ+.20],.025,20);});
  make('gresley-conjugating-two-to-one-lever','conjugated-valve-gear',m=>{
    beam(m,[-p.cylinderHalfSeparation,1.94,.54],[p.cylinderHalfSeparation,1.94,.54],.065,.055);
    cylinder(m,[-p.cylinderHalfSeparation/3,1.86,.54],[-p.cylinderHalfSeparation/3,2.02,.54],.04,24);
  },'brushedMetal');
  make('gresley-conjugating-equal-lever','conjugated-valve-gear',m=>{
    beam(m,[-p.cylinderHalfSeparation/3,1.94,.34],[p.cylinderHalfSeparation/3,1.94,.34],.065,.055);
    cylinder(m,[0,1.88,.34],[0,2.03,.34],.032,24);
  },'brushedMetal');
  make('conjugating-valve-rod-links','conjugated-valve-gear',m=>{
    for(const s of[-1,1]){cylinder(m,[s*p.cylinderHalfSeparation,1.94,.54],[s*p.cylinderHalfSeparation,1.94,p.cylinderZ-.35],.023,20);cylinder(m,[s*p.cylinderHalfSeparation,1.89,.54],[s*p.cylinderHalfSeparation,1.99,.54],.027,20);}
    beam(m,[-p.cylinderHalfSeparation/3,1.94,.54],[-p.cylinderHalfSeparation/3,1.94,.34],.045,.045);
    beam(m,[0,1.94,.34],[0,2.09,.55],.045,.045);
  },'brushedMetal');

  const verifiedMatch=p.axisZ.every((z,i)=>z===A4_DIMENSIONS.axisZ[i])&&p.driveDiameter===A4_DIMENSIONS.driveDiameter&&p.leadingDiameter===A4_DIMENSIONS.leadingDiameter&&p.trailingDiameter===A4_DIMENSIONS.trailingDiameter&&p.tenderWheelDiameter===1.27&&p.tenderFirstAxleGap===2.784475&&p.tenderAxleIntervals.every((v,i)=>v===[1.6002,1.6764,1.6002][i]);
  const coverage=makeCoverage(parts,assemblyCounts,p);
  const parameters={...p,derived:{axles,tenderAxles,tenderFrameStart,tenderFrameEnd,frameStart,frameEnd,drivingCrankCenters:driverAxes.map(a=>[0,a.y+p.crankRadius,a.z]),brakeShaftZ:shafts,leadingBogieCenterZ:bz},status:{axlePositionsAndNominalDiameters:verifiedMatch?'dimensioned-primary-drawing':'user-edited-unverified',springDimensions:p.drivingSpringLeaves===A4_DIMENSIONS.driveSpringLeaves&&p.drivingSpringWidth===A4_DIMENSIONS.driveSpringPlateWidth&&p.drivingSpringLeafThickness===A4_DIMENSIONS.driveSpringPlateThickness&&p.drivingSpringLength===A4_DIMENSIONS.driveSpringCentres&&p.trailingSpringLeaves===A4_DIMENSIONS.trailingSpringLeaves&&p.trailingSpringWidth===A4_DIMENSIONS.trailingSpringPlateWidth&&p.trailingSpringLeafThickness===A4_DIMENSIONS.trailingSpringPlateThickness&&p.trailingSpringLength===A4_DIMENSIONS.trailingSpringCentres?'dimensioned-primary-table':'user-edited-unverified',cylinderBoreAndStroke:p.cylinderBore===A4_DIMENSIONS.cylinderBore&&p.cylinderStroke===A4_DIMENSIONS.cylinderStroke?'dimensioned-primary-table':'user-edited-unverified',crankRadius:p.crankRadius===p.cylinderStroke/2?'derived-half-stroke-simple-crank':'user-edited-independent',allOtherDimensions:'provisional-design',wheelCenterHalfSeparation:'provisional; not inferred from track gauge',pose:'same-phase static assembly study; not actual A4 phase'}};
  return {version:MECHANICS_VERSION,parts,parameters,evidence:{sources:SOURCES,sourceRuntimeDependencies:[],sourcePointBytes:0,sourceAnimationChannelsUsed:0,referenceAnimationChannels:71,units:'m',coordinates:'x lateral; y above rail tread contact; z rearwards from first leading axle',basis:'Primary Silver Link 1935 axle dimensions. Named teacher subtrees establish objects to account for, not mechanical semantics. SNG/NRM maintenance reports establish selected component functions, not 1935 dimensions or exact topology.',verifiedMatch,primaryTable:{source:SOURCES.dimensions,page:320,coupledSprings:{plates:A4_DIMENSIONS.driveSpringLeaves,widthMetres:A4_DIMENSIONS.driveSpringPlateWidth,plateThicknessMetres:A4_DIMENSIONS.driveSpringPlateThickness,supportCentresMetres:A4_DIMENSIONS.driveSpringCentres},trailingSprings:{plates:A4_DIMENSIONS.trailingSpringLeaves,widthMetres:A4_DIMENSIONS.trailingSpringPlateWidth,plateThicknessMetres:A4_DIMENSIONS.trailingSpringPlateThickness,supportCentresMetres:A4_DIMENSIONS.trailingSpringCentres},cylinders:{count:3,boreMetres:A4_DIMENSIONS.cylinderBore,strokeMetres:A4_DIMENSIONS.cylinderStroke,outerCasingDimensions:'unverified; not inferred from bore'},crankRadius:{metres:A4_DIMENSIONS.drivingCrankRadius,status:'derived: 26 in stroke / 2 for simple crank',motionSolved:false},bogieSpringType:{table:'helical',currentPrimarySuspension:'four continuous helical-wire forms; historical Timmis wire section, dimensions, turns and mounting remain provisional'}},engineeringValidated:false,kinematicsSolved:false,geometryRules:['closed planar plate/beam construction','analytic cylinders and annuli with open bores','parabolic laminated spring strips','continuous analytic helical primary load-spring tube sweeps','bounded helical bogie side-control spring paths','annular brake-block and expansion-link sectors','shared axlebox, horn, spring, rod-eye and pin constructors'],renderAssumptions:['All components are rigid and static.','No physics engine, adhesion, axle load, spring deflection or brake force has been solved.','No source animation is replayed.','No source mesh or residual is loaded.','Provisional wheel width, back-to-back, track contact, clearances and exact crank phases remain unresolved.']},coverage};
}

function makeCoverage(parts,assemblyCounts,p){
  const entries=[
    {id:'underframe',represented:['two split plate frames','open driving-axle horn spaces','six cross stretchers','front structural beam','rear dragbox structure','frame fasteners'],missing:['A4-specific frame outline, cut-outs and thickness drawings','cylinder saddle and boiler/ashpan load interfaces','verified dragbox/coupling load path']},
    {id:'leading-bogie',represented:['two leading shafts/four journal boxes','four horns and four continuous helical load-spring forms with separate end seats','two side frames/three cross members','centre pin/bolster','three bearing plates','two side-control spring/cup/stop assemblies'],missing:['historical Timmis wire cross-section, wire dimensions/turn count and actual primary spring placement; type is now helical','actual side-control linkage and clearances','loaded bearing-disc heights','bolster and equalisation dimensions','1935-versus-modern front frame details']},
    {id:'carrying-wheels',represented:p.includeCarryingWheels?[`four leading wheels at ${p.leadingDiameter} m nominal tread`,`two Cartazzi wheels at ${p.trailingDiameter} m nominal tread`,'separate open spoked centres and flanged tyres']:[],missing:p.includeCarryingWheels?['verified spoke count, web profiles, tyre width/flange and back-to-back']:['carrying wheels disabled; caller must supply all six']},
    {id:'coupled-axles',represented:['three shafts with middle crank axle gap','six axleboxes with bearing sleeves/oil pots','six horn guides/stays'],missing:['six driving wheels are externally owned and must be supplied by caller','shaft/journal fits and crank-axle engineering dimensions','middle crank angular phase and strength']},
    {id:'coupled-suspension',represented:['six underslung laminated spring packs','centre load hangers, end hangers and brackets'],missing:['teacher suspension pieces are not proven one-to-one component semantics','verified spring rates, camber, individual leaf lengths and load path; plate count/width/thickness/support centres now sourced','whether any inter-axle compensation applies; none invented']},
    {id:'cartazzi',represented:['single carrying axle','outside fixed frame extensions','two journal boxes/horns/stays','paired inclined bearing representations','two leaf packs/four end spring boxes and rubber pads'],missing:['true offset/inclined horn faces and lateral travel limits','inclined-plane contact compatibility','Spenser-box internal construction and loaded state','not a pivoted generic trailing truck']},
    {id:'brakes',represented:['six coupled-wheel arcuate shoes/hangers','three crossbeams','two brake shafts and pull links','two small leading vacuum cylinders and one larger inter-driver cylinder','cylinder support brackets'],missing:['teacher wheel-group names do not establish exact brake component identity','cylinder-piston-to-shaft lever topology and stroke','vacuum pipe/circuit, valves and cabin control','verified rigging leverage/clearances/force','no unsupported brakes added to bogie or Cartazzi carrying wheels']},
    {id:'outside-motion',represented:['two coupling links per side with real open eyes','main connecting rods','crank-pin extensions','crossheads/piston rods','paired slidebars and motion brackets'],missing:['crankpin shoulder/bearing/cotter detail','true crank phases and rod lengths','swept-clearance and closed-loop joint constraints']},
    {id:'outside-valve-gear',represented:['return cranks/eccentric rods','open slotted expansion links','radius rods/combination levers/union links','valve spindle crossheads','reverser reach/lifting rods'],missing:['reversing shaft, lifting arm geometry and die-block working fit','valve event timing, travel, cutoff and constraint solution','complete bearing fasteners and lubrication','named source group correspondence is not a one-to-one reconstruction claim']},
    {id:'cylinders',represented:['two outside cylinders/bolted covers/valve-chest support blocks','inclined middle cylinder','middle valve chest'],missing:['teacher tank/cylinder groups require exact semantic reconciliation','outside valve chest bore and complete steam-port passages','saddle casting, drains, relief valves and steam pipes','1935 cylinder inclination/dimensions']},
    {id:'inner-motion',represented:['middle crank webs/pin','middle connecting rod','inside piston/crosshead/slidebars'],missing:['teacher inner motion identity and complete visibility must be independently reconciled','correct middle cylinder crank phase and connecting-rod clearance','working gudgeon/big-end bearing stack']},
    {id:'conjugated-valve-gear',represented:['separate 2:1 cross lever','equal lever','valve rod links/fulcrum pins'],missing:['actual plan-view layout and every fulcrum/link joint','3-cylinder conjugated motion constraints and thermal effects','teacher source correspondence']}
    ,{id:'tender-underframe',represented:p.includeTender?['two outside bearing frames','four axle apertures per side','five cross stretchers','two end dragboxes','body support rails']:[],missing:['verified frame silhouette/plate thickness','matching tender body configuration and structural mounting']}
    ,{id:'tender-axles',represented:p.includeTender?['four shafts','eight axleboxes/bearing sleeves/oil pots','eight horn guides/stays']:[],missing:['journal, bearing and axle engineering dimensions','wheelset fits and lateral travel']}
    ,{id:'tender-suspension',represented:p.includeTender?['eight leaf-spring packs','centre/end load interfaces','sixteen spring retainer boxes']:[],missing:['verified spring rates and load distribution','all rubber spring/buckle box internals and working clearances']}
    ,{id:'tender-wheels',represented:p.includeTender&&p.includeCarryingWheels?[`eight spoked wheels with ${p.tenderWheelDiameter} m nominal tread`]:[],missing:['verified spoke count and tyre/flange/back-to-back','caller must supply tender wheels if disabled']}
    ,{id:'tender-brakes',represented:p.includeTender?['eight shoes/hangers','four crossbeams','longitudinal pulls','operating shaft','three vacuum-cylinder forms']:[],missing:['1935-specific rigging/handbrake/cylinder placement','complete vacuum circuit and mechanical ratio/stroke constraints']}
    ,{id:'tender-drawgear',represented:p.includeTender?['main drawbar and two safety links','vertical pin eyes and interface supports']:[],missing:['verified drawbar pin stations, profiles, slack and forces','buffers and compliant/rubbing interfaces','coupling articulation constraint solution']}
  ];
  for(const e of entries){e.partNames=parts.filter(p=>p.metadata.assembly===e.id).map(p=>p.name);e.generatedPartCount=e.partNames.length;e.status=e.generatedPartCount?'static-structural-representation-with-open-items':'not-generated';e.dimensionStatus='provisional except declared wheelbase/nominal diameters, coupled/Cartazzi spring table dimensions, cylinder bore/stroke and derived half-stroke crank radius';}
  return {schema:'native-locomotive-functional-coverage/1',complete:false,mechanicalReconstructionComplete:false,kinematicsSolved:false,scope:'Locomotive six-axle underframe and optional four-axle corridor tender mechanical structure; no coach mechanics. All assemblies still have explicit engineering/reconciliation gaps.',assemblyCounts,entries,unresolvedInterface:'Teacher structure at locomotive/tender interface requires independent semantic dissection; no silent merge into Cartazzi.',outOfScopeSourceFunctions:['buffers/couplers and train draw gear detailed mechanism','external/cab steam, water, lubricating and vacuum piping and controls','boiler/firebox/ashpan working internals','coach chassis','decorative fasteners and ancillary equipment outside above structures'],gates:{nativeGeneration:true,sourceRuntimeGeometry:false,driverWheelsDuplicated:false,sourceAnimationPlayback:false,allMechanicalFunctionsComplete:false,completeCandidateAllowed:false}};
}
