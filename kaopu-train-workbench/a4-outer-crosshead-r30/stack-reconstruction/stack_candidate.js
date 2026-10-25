/* Explicit INFERRED finite-thickness axial assembly study. No renderer/mesh.
 * Pure functions only. Retained plate profiles, XZ kinematic centres and spindle
 * axes are preserved. New axial dimensions are DERIVED from declared choices.
 * Nominal joint geometry is not a mounting, strength or historical proof.
 */
'use strict';
const RODS={
 two_to_one_lever:['A','C','O'], equal_lever:['B','E','C'],
 right_short_link:['R','A'], left_short_link:['L','B'], middle_short_link:['M','E']
};
const JOINTS={O:['two_to_one_lever'],R:['right_short_link'],L:['left_short_link'],
 A:['two_to_one_lever','right_short_link'],C:['two_to_one_lever','equal_lever'],
 B:['equal_lever','left_short_link'],E:['equal_lever','middle_short_link'],M:['middle_short_link']};
const CHOICES={
 surfaceClearance:.0005, axialRunningClearance:.0005,
 minimumSpacerThickness:.002, washerThickness:.002,
 retainerEnvelopeThickness:.003, shaftEndReserve:.0005,
 pinBearingRadialClearance:.00015, looseHardwareRadialClearance:.0003,
 hardwareLandBeyondBore:.0045
};
function inspect(scene,reference){
 const src=scene.sources.motion, lines=Object.fromEntries(Object.entries(reference.source));
 const profiles={rods:{},pins:{},spindles:{},sharedSpindleAliases:{},primitiveSources:{}};
 for(const name of ['mDisc','mFlatRod','mCapsule']){
  const m=src.match(new RegExp('float '+name+'\\([^]*?\\n}'));
  if(!m)throw Error('Missing primitive '+name);profiles.primitiveSources[name]=m[0];
 }
 for(const n of Object.keys(RODS)){
  const m=lines[n].match(/,(true|false),([^)]*)\);/);if(!m)throw Error('Cannot parse retained rod '+n);
  const [width,eye,bore,halfThickness]=m[2].split(',').map(Number);
  profiles.rods[n]={width,eye,bore,halfThickness,thickness:2*halfThickness,axis:1,joints:RODS[n],source:lines[n]};
 }
 for(const k of Object.keys(JOINTS)){
  const m=lines[k].match(/\),1,([^)]*)\);/);const [radius,halfLength]=m[1].split(',').map(Number);
  profiles.pins[k]={radius,halfLength,length:2*halfLength,axis:1,center:reference.pins[k],source:lines[k]};
 }
 for(const [k,n]of Object.entries({R:'right_valve_spindle',L:'left_valve_spindle',M:'middle_valve_spindle_inferred_horizontal'})){
  const m=src.match(new RegExp('float motion_valve_'+n+'\\(vec3 p\\) \\{ return mCapsule\\(([^\\n]+)\\); \\}'));
  if(!m)throw Error('Missing spindle '+n);
  const endpoints=[...m[1].matchAll(/vec3\(([^)]+)\)/g)].map(x=>x[1].split(',').map(Number));
  const radius=Number(m[1].slice(m[1].lastIndexOf(',')+1));
  profiles.spindles[k]={endpoints,radius,length:Math.hypot(...endpoints[1].map((v,i)=>v-endpoints[0][i])),source:m[0]};
 }
 for(const[k,side]of [['R','right'],['L','left']]){
  const m=src.match(new RegExp('float motion_valve_chest_'+side+'_shared_valve_spindle\\(vec3 p\\) \\{ return mPV\\(p-vec3\\(([^)]+)\\),([^)]*)\\); \\}'));
  if(!m)throw Error('Missing shared spindle '+side);
  const center=m[1].split(',').map(Number),[q,rear,front,part]=m[2].split(',').map(Number);
  if(part!==10||!src.includes('if(part==10)return mCylZ(p,.016,rearSpindle,frontSpindle);'))throw Error('Shared spindle profile changed');
  const ends=[[center[0],center[1],center[2]+rear],[center[0],center[1],center[2]+front]];
  const error=Math.max(...ends.flatMap((p,i)=>p.map((v,j)=>Math.abs(v-profiles.spindles[k].endpoints[i][j]))));
  profiles.sharedSpindleAliases[k]={id:'valve_chest/'+side+'_shared_valve_spindle',source:m[0],radius:.016,endpoints:ends,maxEndpointError:error,solidCylinderContainedInCapsule:error<1e-13&&profiles.spindles[k].radius===.016,throughYBorePresent:false};
 }
 const first=profiles.rods.two_to_one_lever;
 for(const p of Object.values(profiles.rods))for(const k of ['width','eye','bore','halfThickness'])if(p[k]!==first[k])throw Error('This minimal-stack derivation requires equal retained plate profiles');
 if(Object.values(profiles.pins).some(p=>p.radius!==profiles.pins.O.radius))throw Error('Unequal retained pin radii');
 return profiles;
}
function derive(profiles,reference,choices={},options={terminalEyes:false}){
 const p={...CHOICES,...choices};if(Object.values(p).some(v=>!(Number.isFinite(v)&&v>0)))throw Error('Positive finite choices required');
 const rod=profiles.rods.two_to_one_lever, t=rod.thickness,h=t/2,Y0=reference.planeY;
 const spindleRadius=Math.max(...Object.values(profiles.spindles).map(s=>s.radius));
 const end=p.axialRunningClearance+p.washerThickness+p.retainerEnvelopeThickness+p.shaftEndReserve;
 const lowGap=p.minimumSpacerThickness+2*p.axialRunningClearance;
 const highGap=Math.max(lowGap,2*end+p.surfaceClearance);
 const inputGap=options.terminalEyes?Math.max(p.surfaceClearance,lowGap):p.surfaceClearance;
 const shortY=Y0+spindleRadius+h+inputGap;
 const levels={short:shortY,equal:shortY-t-lowGap,main:shortY+t+highGap};
 const layer={two_to_one_lever:levels.main,equal_lever:levels.equal,right_short_link:levels.short,left_short_link:levels.short,middle_short_link:levels.short};
 const pinRadius=profiles.pins.O.radius;
 if(!(pinRadius+p.pinBearingRadialClearance<rod.bore))throw Error('No positive bushing wall within RETAINED bore');
 const hardwareOuter=rod.bore+p.hardwareLandBeyondBore;
 if(!(hardwareOuter<rod.eye))throw Error('Hardware land exceeds retained eye');
 const joints={};
 for(const [k,names]of Object.entries(JOINTS)){
  const input=['R','L','M'].includes(k);
  const plates=names.map(n=>({name:n,Y:layer[n],lower:layer[n]-h,upper:layer[n]+h}));
  if(input&&options.terminalEyes)plates.push({name:'input_terminal_eye_'+k,Y:Y0,lower:Y0-profiles.spindles[k].radius,upper:Y0+profiles.spindles[k].radius});
  plates.sort((a,b)=>a.Y-b.Y);
  const lower=plates[0].lower,upper=plates.at(-1).upper;
  const shaft=[input&&!options.terminalEyes?Y0-profiles.spindles[k].radius:lower-end,upper+end];
  const spacer=plates.length===2?[plates[0].upper+p.axialRunningClearance,plates[1].lower-p.axialRunningClearance]:null;
  joints[k]={partners:names,plates,shaftY:shaft,shaftLength:shaft[1]-shaft[0],shaftCenterY:(shaft[0]+shaft[1])/2,
   radius:pinRadius,spacerY:spacer,spacerLength:spacer?spacer[1]-spacer[0]:null,
   lowerRetention:!input||options.terminalEyes,upperRetention:true,
   attachment:input?(options.terminalEyes?'PROPOSED added terminal eye + explicit through-Y subtraction in original capsule AND every duplicate source field; separate bushing; manufacture/strength UNVERIFIED':'FAIL: retained solid spindle has no Y bore; pin/spindle volumetric intersection is NOT a bearing or support'):k==='O'?'Fixed pivot requires a frame-connected mount; no such mount or historical bracket is supplied':'Free coaxial pin with two independent rod bushings; end-retention envelopes supplied, locking details UNVERIFIED'};
 }
 return {label:options.terminalEyes?'INFERRED_three_level_with_EXPLICIT_terminal_eyes_v1':'INFERRED_three_level_UNCUT_terminal_failure_v1',options,units:'m',selectedClearances:p,retained:{planeY:Y0,plateThickness:t,halfThickness:h,width:rod.width,eye:rod.eye,bore:rod.bore,pinRadius,spindleRadius},
  formulas:{shortY:'Y0 + max(spindleRadius) + plateThickness/2 + inputFaceGap',equalY:'shortY - plateThickness - lowerFaceGap',mainY:'shortY + plateThickness + upperFaceGap',lowerFaceGap:'minimumSpacerThickness + 2*axialRunningClearance',endEnvelope:'axialRunningClearance + washerThickness + retainerEnvelopeThickness + shaftEndReserve',upperFaceGap:'max(lowerFaceGap, 2*endEnvelope + surfaceClearance)',spacerLength:'adjacent plate face gap - 2*axialRunningClearance',shaftExtent:'outer plate faces +/- endEnvelope; input lower endpoint = Y0 - original spindle radius'},
  derived:{inputFaceGap:inputGap,endEnvelope:end,lowerFaceGap:lowGap,upperFaceGap:highGap,levels,layer,hardwareOuter,bushingInner:pinRadius+p.pinBearingRadialClearance,bushingOuter:rod.bore,bushingWall:rod.bore-pinRadius-p.pinBearingRadialClearance,looseHardwareInner:pinRadius+p.looseHardwareRadialClearance},joints,
  unchanged:{XZPinPaths:true,spindleY:true,plateThickness:true,plateWidthsEyesAndBores:true,originalSpindleMaterial:!options.terminalEyes,officialAxleStations:true,originalBaseline:true},
  limitations:{historicalDimensions:false,frameMountKnown:false,endLockDetailModeled:false,inputTerminalFasteningVerified:false,inputBoreAbsent:!options.terminalEyes,middlePrismaticGuideKnown:false,structuralProof:false,wholeTrainAcceptance:false}};
}
function parts(design,profiles,pose){
 const out=[],d=design.derived,r=design.retained,c=design.selectedClearances,p=pose.pins;
 function ring(id,k,y,inner,outer,role,body=null){out.push({id,kind:'ring',joint:k,center:p[k],y,inner,outer,role,body});}
 for(const[n,ks]of Object.entries(RODS))out.push({id:'plate/'+n,kind:'rod',joints:ks,points:ks.map(k=>p[k]),y:[d.layer[n]-r.halfThickness,d.layer[n]+r.halfThickness],centerY:d.layer[n],halfThickness:r.halfThickness,width:r.width,eye:r.eye,bore:r.bore,role:'retained full-thickness plate',body:'plate/'+n});
 for(const[k,j]of Object.entries(design.joints)){
  if(design.options.terminalEyes&&['R','L','M'].includes(k))ring('terminal_eye/'+k,k,[r.planeY-profiles.spindles[k].radius,r.planeY+profiles.spindles[k].radius],r.bore,r.eye,'proposed added annular eye, united with EXPLICITLY drilled spindle','input_body/'+k);
  const body='pin/'+k;ring(body,k,j.shaftY,0,r.pinRadius,'pin shaft',body);
  for(const plate of j.plates)ring('bushing/'+k+'/'+plate.name,k,[plate.lower,plate.upper],d.bushingInner,d.bushingOuter,'plain bushing nominally seated in retained bore','plate/'+plate.name);
  if(j.spacerY)ring('spacer/'+k,k,j.spacerY,d.looseHardwareInner,d.hardwareOuter,'loose thrust spacer');
  for(const side of ['lower','upper'])if(j[side+'Retention']){
   const f=side==='lower'?j.plates[0].lower:j.plates.at(-1).upper,s=side==='lower'?-1:1;
   const range=(a,b)=>[f+s*a,f+s*b].sort((a,b)=>a-b);
   ring('washer/'+k+'/'+side,k,range(c.axialRunningClearance,c.axialRunningClearance+c.washerThickness),d.looseHardwareInner,d.hardwareOuter,'end thrust washer');
   ring('retainer/'+k+'/'+side,k,range(c.axialRunningClearance+c.washerThickness,c.axialRunningClearance+c.washerThickness+c.retainerEnvelopeThickness),r.pinRadius,d.hardwareOuter,'end-retention envelope, locking method unresolved',body);
  }
 }
 for(const[k,s]of Object.entries(profiles.spindles)){
  const front=p[k],rear=[front[0],r.planeY,front[2]-s.length];
  out.push({id:'spindle/'+k,kind:'spindle',joint:k,points:[rear,front],radius:s.radius,y:[r.planeY-s.radius,r.planeY+s.radius],role:'unmodified capsule, XZ translation only',body:'input_body/'+k,terminalBore:design.options.terminalEyes?r.bore:null});
 }
 return out;
}
function pointSegment2(p,a,b){const vx=b[0]-a[0],vz=b[2]-a[2],wx=p[0]-a[0],wz=p[2]-a[2],den=vx*vx+vz*vz,t=den?Math.max(0,Math.min(1,(wx*vx+wz*vz)/den)):0;return Math.hypot(wx-t*vx,wz-t*vz);}
function scalar(part,p){
 if(part.kind==='spindle'){
  const a=part.points[0],b=part.points[1],v=b.map((x,i)=>x-a[i]),w=p.map((x,i)=>x-a[i]),t=Math.max(0,Math.min(1,w.reduce((s,x,i)=>s+x*v[i],0)/v.reduce((s,x)=>s+x*x,0)));
  const original=Math.hypot(...w.map((x,i)=>x-t*v[i]))-part.radius;
  return part.terminalBore?Math.max(original,part.terminalBore-Math.hypot(p[0]-b[0],p[2]-b[2])):original;
 }
 const axial=Math.max(part.y[0]-p[1],p[1]-part.y[1]);
 if(part.kind==='ring'){const rr=Math.hypot(p[0]-part.center[0],p[2]-part.center[2]);return Math.max(rr-part.outer,part.inner?part.inner-rr:-Infinity,axial);}
 const [a,b]=part.points,rr=part.points.map(q=>Math.hypot(p[0]-q[0],p[2]-q[2]));
 return Math.max(Math.min(pointSegment2(p,a,b)-part.width,...rr.map(x=>x-part.eye)),-Math.min(...rr.map(x=>x-part.bore)),axial);
}
function bounds(part){
 const ps=part.kind==='ring'?[part.center]:part.points,r=part.kind==='ring'?part.outer:part.kind==='spindle'?part.radius:Math.max(part.width,part.eye);
 return [[Math.min(...ps.map(p=>p[0]))-r,part.y[0],Math.min(...ps.map(p=>p[2]))-r],[Math.max(...ps.map(p=>p[0]))+r,part.y[1],Math.max(...ps.map(p=>p[2]))+r]];
}
function pairRelation(a,b){
 const yg=Math.max(a.y[0]-b.y[1],b.y[0]-a.y[1]);if(yg>1e-12)return {type:'separated_axially',lowerBound:yg};
 if(yg>=-1e-12)return {type:'nominal_axial_boundary',lowerBound:0};
 if(a.kind==='ring'&&b.kind==='ring'&&a.joint===b.joint){
  const radial=Math.max(a.inner-b.outer,b.inner-a.outer);
  if(radial>=-1e-12)return {type:radial>1e-12?'coaxial_radial_clearance':'nominal_coaxial_boundary',lowerBound:Math.max(0,radial)};
  if(a.body&&a.body===b.body)return {type:'intended_one_pin_union',lowerBound:null};
 }
 if(a.kind==='rod'&&b.kind==='ring'&&a.joints.includes(b.joint)&&b.outer<=a.bore+1e-12)return {type:b.outer<a.bore-1e-12?'retained_bore_clearance':'nominal_bushing_seat',lowerBound:Math.max(0,a.bore-b.outer)};
 if(b.kind==='rod'&&a.kind==='ring')return pairRelation(b,a);
 if(a.kind==='spindle'&&b.kind==='ring'&&a.joint===b.joint){
  if(a.terminalBore&&b.outer<=a.terminalBore+1e-12)return {type:b.outer<a.terminalBore-1e-12?'EXPLICIT_terminal_bore_clearance':'nominal_terminal_bushing_seat',lowerBound:Math.max(0,a.terminalBore-b.outer)};
  if(a.terminalBore&&a.body===b.body)return {type:'proposed_eye_and_drilled_stem_union',lowerBound:null};
  if(!a.terminalBore&&b.role==='pin shaft')return {type:'FAIL_solid_spindle_has_no_pin_bore',lowerBound:-Math.min(a.radius,b.outer)};
 }
 if(b.kind==='spindle'&&a.kind==='ring')return pairRelation(b,a);
 const aa=bounds(a),bb=bounds(b),gap=Math.max(...[0,1,2].map(i=>Math.max(aa[0][i]-bb[1][i],bb[0][i]-aa[1][i])));
 return {type:gap>1e-12?'separated_enclosures':'UNRESOLVED_enclosure_overlap',lowerBound:gap};
}
module.exports={RODS,JOINTS,CHOICES,inspect,derive,parts,scalar,bounds,pairRelation};
