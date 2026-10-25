/* Pure analytic design/check helpers. No mutation of SCENE, renderers or files.
 * A candidate opening is derived from finite plate sections at actual frame
 * slabs; its margins and proposed bracket dimensions are explicitly inferred.
 * Neither geometric connectivity nor clearance is structural certification.
 */
'use strict';
const EPS=1e-12;
const unionRange=a=>a.length?[Math.min(...a.map(q=>q[0])),Math.max(...a.map(q=>q[1]))]:null;
const n=s=>Number(s.replace(/[()]/g,''));
function inspectFrameHosts(scene){
 const src=scene.sources.support;
 const lines=Object.fromEntries(src.split('\n').map(l=>[l.match(/^float (\w+)\(/)?.[1],l]));
 return ['left','right'].map(side=>{
  const id='frame/frame_plate_'+side,p=scene.parts.find(p=>p.id===id);if(!p)throw Error('Missing retained frame '+id);
  const queue=[p.glsl_function],seen=new Set;let base;
  while(queue.length){const name=queue.shift();if(seen.has(name))continue;seen.add(name);const line=lines[name]||'';if(line.includes('vec2 q=p.yz')){base=line;break;}queue.push(...[...line.matchAll(/(support_node_\d+)\(p\)/g)].map(m=>m[1]));}
  if(!base)throw Error('Retained analytic frame polygon unavailable');
  const polygonYZ=[...base.matchAll(/vec2 a=vec2\((.*?)\),b=vec2/g)].map(m=>m[1].split(',').map(n));
  const thick=base.match(/abs\(p\[0\]-(.*?)\)-([\d.eE+-]+)\);\}/);
  if(!thick||polygonYZ.length!==10)throw Error('Unexpected frame host expression');
  const x=n(thick[1]),halfThickness=n(thick[2]);
  return {id,side,x,halfThickness,slab:[x-halfThickness,x+halfThickness],innerFace:x-Math.sign(x)*halfThickness,polygonYZ,sourcePart:p.glsl_function,sourceStatus:p.status,baseSource:base,frontRectangle:{y:[.73,1.68],z:[3.65,6.10]},scope:'retained inferred analytic frame, not measured A4 steel'};
 });
}
function clipX(poly,lo,hi){
 for(const [edge,keep] of [[lo,(x,e)=>x>=e],[hi,(x,e)=>x<=e]]){
  const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ai=keep(a[0],edge),bi=keep(b[0],edge);if(ai)out.push(a);if(ai!==bi){const t=(edge-a[0])/(b[0]-a[0]);out.push([edge,a[1]+t*(b[1]-a[1])]);}}poly=out;if(!poly.length)break;
 }return poly;
}
function diskProjection(center,r,slab){
 const dx=Math.max(slab[0]-center[0],center[0]-slab[1],0);if(dx>r+EPS)return null;
 const h=Math.sqrt(Math.max(0,r*r-dx*dx));return [center[1]-h,center[1]+h];
}
function capsuleProjection(a,b,r,slab){
 const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),out=[];
 for(const p of [a,b]){const q=diskProjection(p,r,slab);if(q)out.push(q);}
 if(L){const nx=-dz/L*r,nz=dx/L*r;const poly=clipX([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],...slab);if(poly.length)out.push([Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[1]))]);}
 return unionRange(out);
}
function sectionBounds(part,slab){
 let z,exact=true;
 if(part.kind==='rod'){
  const ps=part.points.map(p=>[p[0],p[2]]),ranges=[],body=capsuleProjection(ps[0],ps[1],part.width,slab);if(body)ranges.push(body);
  for(const p of ps){const q=diskProjection(p,part.eye,slab);if(q)ranges.push(q);}z=unionRange(ranges);
  // The bores are strictly interior to their eyes. Disjoint eye neighbourhoods
  // guarantee removing the holes cannot remove any support extrema.
  exact=part.bore<part.eye&&ps.every((p,i)=>ps.every((q,j)=>i===j||Math.hypot(p[0]-q[0],p[1]-q[1])>2*part.eye));
 }else if(part.kind==='ring')z=diskProjection([part.center[0],part.center[2]],part.outer,slab);
 else if(part.kind==='spindle'){z=capsuleProjection(part.points[0].filter((_,i)=>i!==1),part.points[1].filter((_,i)=>i!==1),part.radius,slab);exact=false;}
 else throw Error('Unsupported analytic part '+part.kind);
 return z?{id:part.id,y:part.y.slice(),z,exactRectangularProjection:exact,scope:'minimum enclosing YZ rectangle of this pose at full frame thickness; not minimum-area arbitrary-profile cut'}:null;
}
function sectionAtPose(parts,host,options={}){
 const xExpansion=options.xExpansion||0,slab=[host.slab[0]-xExpansion,host.slab[1]+xExpansion],sections=[];
 for(const part of parts){const s=sectionBounds(part,slab);if(s)sections.push(s);}
 return {hostId:host.id,slab,sections,y:unionRange(sections.map(s=>s.y)),z:unionRange(sections.map(s=>s.z))};
}
function deriveApertures({hosts,partsAt,phases,clearanceY=.003,clearanceZ=.003,numericalPad=1e-6,certifiedCellDisplacement=null}){
 if(!phases?.length||phases.some(p=>!Number.isFinite(p)))throw Error('Finite phase samples required');
 if([clearanceY,clearanceZ,numericalPad].some(v=>!(v>=0)))throw Error('Nonnegative inferred margins required');
 const slots=hosts.map(host=>({host,sections:[],crossingPartIds:new Set,phaseWitnesses:{minZ:null,maxZ:null},maxCellDisplacement:0}));
 for(let i=0;i<phases.length;i++){
  const theta=phases[i],parts=partsAt(theta),d=certifiedCellDisplacement?certifiedCellDisplacement(i,theta):0;
  if(!(Number.isFinite(d)&&d>=0))throw Error('Invalid certified displacement bound');
  for(const s of slots){
   // If each material point moves by <=d from the sample over its covered cell,
   // expand the sample slab by d before projection, then expand YZ by d.
   // This is conservative even at a grazing frame-plane crossing.
   const q=sectionAtPose(parts,s.host,{xExpansion:d});if(!q.sections.length)continue;
   const b={y:[q.y[0]-d,q.y[1]+d],z:[q.z[0]-d,q.z[1]+d]};
   if(!s.sections.length||b.z[0]<Math.min(...s.sections.map(v=>v.z[0])))s.phaseWitnesses.minZ=theta;
   if(!s.sections.length||b.z[1]>Math.max(...s.sections.map(v=>v.z[1])))s.phaseWitnesses.maxZ=theta;
   s.sections.push(b);for(const r of q.sections)s.crossingPartIds.add(r.id);s.maxCellDisplacement=Math.max(s.maxCellDisplacement,d);
  }
 }
 return slots.map(s=>{
  if(!s.sections.length)return {hostId:s.host.id,required:false};
  const y=unionRange(s.sections.map(v=>v.y)),z=unionRange(s.sections.map(v=>v.z));
  const opening={y:[y[0]-clearanceY-numericalPad,y[1]+clearanceY+numericalPad],z:[z[0]-clearanceZ-numericalPad,z[1]+clearanceZ+numericalPad]};
  const r=s.host.frontRectangle,ligaments={below:opening.y[0]-r.y[0],above:r.y[1]-opening.y[1],behind:opening.z[0]-r.z[0],ahead:r.z[1]-opening.z[1]};
  return {hostId:s.host.id,required:true,frameSlab:s.host.slab,frameX:s.host.x,crossingPartIds:[...s.crossingPartIds],minimumRectangularEnvelope:{y,z},opening,inferredClearanceM:{Y:clearanceY,Z:clearanceZ},numericalPadM:numericalPad,phaseCount:phases.length,phaseWitnesses:s.phaseWitnesses,continuousCoverage:!!certifiedCellDisplacement,maxCellDisplacementM:s.maxCellDisplacement,ligaments,insideRetainedFrontRectangle:Object.values(ligaments).every(v=>v>0),structuralAcceptance:false,historicalDimensions:false,status:certifiedCellDisplacement?'conditional_continuous_bound_requires_valid_caller_cell_certificate':'finite_sample_envelope_only_not_continuous_motion_proof'};
 });
}
function openingScalar(slot,p){return Math.max(slot.opening.y[0]-p[1],p[1]-slot.opening.y[1],slot.opening.z[0]-p[2],p[2]-slot.opening.z[1]);}
function cutFrameScalar(original,slot,p){return Math.max(original,-openingScalar(slot,p));}
function slotGLSL(slot,name){const f=v=>{let s=v.toPrecision(17);return /[.eE]/.test(s)?s:s+'.0';};return `float ${name}(vec3 p){return max(max(${f(slot.opening.y[0])}-p.y,p.y-${f(slot.opening.y[1])}),max(${f(slot.opening.z[0])}-p.z,p.z-${f(slot.opening.z[1])}));}`;}
function proposedPivotSupport({hosts,pose,parts,design,apertures,choices={}}){
 const c={runningGap:.004,bridgeHeight:.040,bridgeDepth:.080,pinSeatRadialClearance:0,pinEndReserve:.006,sideBoltRadius:.006,sideBoltZOffset:.025,minimumInferredEdgeLigament:.015,...choices};
 if(Object.values(c).some(v=>!(Number.isFinite(v)&&v>=0)))throw Error('Nonnegative finite support choices required');
 const O=pose.pins.O,originalPin=parts.find(p=>p.id==='pin/O');if(!originalPin)throw Error('Explicit stack O pin required');
 const ymax=Math.max(...parts.filter(p=>p.id!=='pin/O').map(p=>p.y[1]));
 const bridgeHeight=Math.max(c.bridgeHeight,2*(c.sideBoltRadius+c.minimumInferredEdgeLigament)),bridgeDepth=Math.max(c.bridgeDepth,2*(c.sideBoltZOffset+c.sideBoltRadius+c.minimumInferredEdgeLigament));
 const bridgeY=[ymax+c.runningGap,ymax+c.runningGap+bridgeHeight],bridgeZ=[O[2]-bridgeDepth/2,O[2]+bridgeDepth/2];
 const left=hosts.find(h=>h.side==='left'),right=hosts.find(h=>h.side==='right');if(!left||!right)throw Error('Both retained frame plates required');
 const bridgeX=[left.innerFace,right.innerFace],pinRadius=originalPin.outer;
 if(O[0]-pinRadius<bridgeX[0]||O[0]+pinRadius>bridgeX[1])throw Error('Fixed pivot outside proposed stretcher');
 const contacts=hosts.map(h=>({hostId:h.id,planeX:h.innerFace,normal:[-Math.sign(h.x),0,0],y:bridgeY,z:bridgeZ,kind:'nominal side-face contact, not volumetric overlap',fasteners:[-1,1].map(s=>({axis:'X',center:[h.x,(bridgeY[0]+bridgeY[1])/2,O[2]+s*c.sideBoltZOffset],radius:c.sideBoltRadius,hostBoreExplicitlyRequired:true,lockingOrThreadDetailsVerified:false}))}));
 const socket={axis:'Y',centerXZ:[O[0],O[2]],radius:pinRadius+c.pinSeatRadialClearance,y:bridgeY,explicitMaterialRemoval:true};
 const extendedPin={...originalPin,y:[originalPin.y[0],bridgeY[1]+c.pinEndReserve],role:'proposed fixed pin extension into explicit support socket'};
 const checks=contacts.map(contact=>{const h=hosts.find(h=>h.id===contact.hostId),slot=apertures.find(a=>a.hostId===h.id&&a.required);const boltY=contact.fasteners[0].center[1];return {hostId:h.id,frameTopLigament:h.frontRectangle.y[1]-bridgeY[1],frameFrontLigament:h.frontRectangle.z[1]-bridgeZ[1],slotToBridgeGap:slot?bridgeY[0]-slot.opening.y[1]:null,boltHoleToSlotLigament:slot?boltY-c.sideBoltRadius-slot.opening.y[1]:null,insideFrame:bridgeY[0]>h.frontRectangle.y[0]&&bridgeY[1]<h.frontRectangle.y[1]&&bridgeZ[0]>h.frontRectangle.z[0]&&bridgeZ[1]<h.frontRectangle.z[1]};});
 return {label:'proposed_frame_connected_front_stretcher_and_fixed_O_socket',fixedPivot:O.slice(),existingAnchor:{hostIds:hosts.map(h=>h.id),existingSaddle:false,existingGresleyStretcher:false,existingDirectOPinMount:false},bridge:{kind:'box_with_explicit_Y_socket',x:bridgeX,y:bridgeY,z:bridgeZ},socket,contacts,extendedPin,choices:c,derivedDimensions:{bridgeHeight,bridgeDepth,formula:'max(requested minimum, bolt diameter/spacing plus twice inferred edge ligament)'},checks,clearanceAboveAllExistingMovingHardware:bridgeY[0]-ymax,pivotLoadPath:['main lever bushing','fixed extended O pin','socket in proposed front stretcher','explicit side fasteners and face contacts','retained left/right main frame plates'],inferred:true,historicalDimensions:false,wholeInterferenceVerified:false,structuralAcceptance:false,manufactureDetailsVerified:false,mandatoryFollowup:['Replace O pin rather than duplicate it.','Explicitly model shaft retention, bridge socket and frame fastener bores; do not silently overlap solids.','Recheck every moving and stationary neighbour in the whole scene.','Preserve original baseline and identify candidate-only changes.']};
}
module.exports={inspectFrameHosts,clipX,diskProjection,capsuleProjection,sectionBounds,sectionAtPose,deriveApertures,openingScalar,cutFrameScalar,slotGLSL,proposedPivotSupport};
