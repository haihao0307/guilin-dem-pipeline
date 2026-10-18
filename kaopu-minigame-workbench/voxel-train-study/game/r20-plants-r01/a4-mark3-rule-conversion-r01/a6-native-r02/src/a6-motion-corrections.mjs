import {buildLocomotiveMechanics, MECHANICS_DEFAULTS} from '../../student-native-r01/src/locomotive-mechanics.mjs';
import {box,rod} from './a6-geometry.mjs';

const translation=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
function translated(part,offset) {
  const positions=Array.from(part.positions,(v,i)=>v+offset[i%3]);
  return {...part,positions,metadata:{...part.metadata,a6R02DesignCorrection:true,sourceBufferUnchanged:true}};
}
function join(name,parts,original) {
  const positions=[],normals=[],uvs=[],indices=[];
  for(const part of parts){const o=positions.length/3;positions.push(...part.positions);normals.push(...part.normals);uvs.push(...part.uvs);for(const i of part.indices)indices.push(i+o);}
  return {name,material:original.material,positions,normals,uvs,indices,metadata:{...original.metadata,a6R02DesignCorrection:true,designStatus:'explicit-new-native-support-design',sourceBufferUnchanged:true,originalComponentPreservedInR01:true}};
}
function annulusZ(name,c,z0,z1,inner,outer,segments,material) {
  const positions=[],normals=[],uvs=[],indices=[];
  const point=(z,r,a)=>[c[0]+r*Math.cos(a),c[1]+r*Math.sin(a),z],normal=a=>[Math.cos(a),Math.sin(a),0];
  const face=(points,ns)=>{
    const o=positions.length/3;
    for(let i=0;i<4;i++){positions.push(...points[i]);normals.push(...ns[i]);uvs.push(i===0||i===3?0:1,i<2?0:1);}
    const a=points[1].map((v,i)=>v-points[0][i]),b=points[2].map((v,i)=>v-points[0][i]),cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],sign=cross.reduce((s,v,i)=>s+v*ns[0][i],0);
    if(sign>=0)indices.push(o,o+1,o+2,o,o+2,o+3);else indices.push(o,o+2,o+1,o,o+3,o+2);
  };
  for(let i=0;i<segments;i++){
    const a=2*Math.PI*i/segments,b=2*Math.PI*(i+1)/segments,na=normal(a),nb=normal(b);
    face([point(z0,outer,a),point(z1,outer,a),point(z1,outer,b),point(z0,outer,b)],[na,na,nb,nb]);
    face([point(z0,inner,a),point(z0,inner,b),point(z1,inner,b),point(z1,inner,a)],[na,nb,nb,na].map(n=>n.map(v=>-v)));
    for(const[z,sign]of[[z0,-1],[z1,1]])face([point(z,inner,a),point(z,outer,a),point(z,outer,b),point(z,inner,b)],Array(4).fill([0,0,sign]));
  }
  return {name,positions,normals,uvs,indices,material};
}
function workingCylinder(side,p,original) {
  const name=original.name,cc=side*p.cylinderHalfSeparation,h=p.cylinderHeight,front=p.cylinderZ-p.cylinderLength/2,rear=p.cylinderZ+p.cylinderLength/2,material=original.material,n=p.radialSegments,parts=[];
  parts.push(annulusZ(`${name}-working-bore`,[cc,h],front,rear,p.cylinderBore/2,p.cylinderRadius,n,material));
  parts.push(rod(`${name}-front-cover`,[cc,h,front-.025],[cc,h,front+.025],p.cylinderRadius+.025,material,{segments:n+1}));
  parts.push(annulusZ(`${name}-rear-cover-with-gland`,[cc,h],rear-.025,rear+.025,.040,p.cylinderRadius+.025,n,material));
  for(const z of[front,rear])for(let i=0;i<12;i++){
    const a=i*Math.PI/6,x=cc+(p.cylinderRadius+.012)*Math.cos(a),y=h+(p.cylinderRadius+.012)*Math.sin(a);
    parts.push(rod(`${name}-cover-bolt-${z}-${i}`,[x,y,z-.03],[x,y,z+.03],.012,material,{segments:7}));
  }
  parts.push(box(`${name}-valve-chest-support`,[cc,h+p.cylinderRadius+.075,p.cylinderZ],[.30,.15,p.cylinderLength*.8],material));
  const result=join(name,parts,original);result.metadata={...result.metadata,workingBoreM:p.cylinderBore,casingOuterRadiusM:p.cylinderRadius,wallThicknessM:p.cylinderRadius-p.cylinderBore/2,glandBoreRadiusM:.040,coverBoltCount:24,designAssumptions:'20.05 mm wall and 2 mm gland radial gap; not verified A4 engineering dimensions'};return result;
}
/** An above-wheel portal connects outboard guide/trunnion supports to the frame. */
function supportPortal(name,side,p,original,valve=false) {
  const z=valve?3.55:p.crossheadZ+.64,top=2.18,outer=valve?1.21:1.105,inner=p.frameHalfSeparation,material=original.material,parts=[];
  const block=(label,c,s)=>parts.push(box(`${name}-${label}`,c,s,material));
  const low=valve?1.58:p.cylinderHeight-.145;
  block('outboard-upright',[side*outer,(low+top)/2,z],[.07,top-low+.08,.10]);
  block('above-flange-bridge',[side*(outer+inner)/2,top,z],[outer-inner+.07,.08,.10]);
  block('inboard-frame-upright',[side*inner,(p.frameTop-.08+top)/2,z],[.07,top-(p.frameTop-.08)+.08,.10]);
  if(valve){
    // The original trunnion extends to x=1.19 m, entering this outboard saddle.
    block('trunnion-saddle',[side*1.19,1.58,z],[.09,.12,.14]);
  }else{
    const guideCenter=p.cylinderHalfSeparation;
    for(const sy of[-1,1])block(`slidebar-seat-${sy}`,[side*(outer+guideCenter)/2,p.cylinderHeight+sy*.145,z],[outer-guideCenter+.07,.045,.14]);
  }
  return join(name,parts,original);
}

/**
 * Returns a complete 338-name R02 candidate without touching the R01 object or
 * file. All dimensional changes are explicit below; fixed wheel/axle/crank data
 * are untouched. Original part buffers are retained in originalMechanics.
 */
export function correctA6Mechanics(source=buildLocomotiveMechanics()) {
  if(source.motionCorrections)return {mechanics:source,corrections:source.motionCorrections,status:'existing R02 corrections retained; no repeated offsets',originalComponentCount:source.originalMechanics.parts.length,correctedComponentCount:source.parts.length};
  const p=source.parameters,options=Object.fromEntries(Object.keys(MECHANICS_DEFAULTS).map(key=>[key,p[key]]));
  const regenerated=buildLocomotiveMechanics({...options,cylinderHeight:p.driveDiameter/2,cylinderHalfSeparation:p.cylinderHalfSeparation+.010,cylinderRadius:.255});
  const original=new Map(source.parts.map(part=>[part.name,part])),next=new Map(source.parts.map(part=>[part.name,part])),corrections=[];
  const alignedPrefixes=['outside-cylinder-','outside-piston-rod-','outside-crosshead-','outside-slidebars-','outside-main-connecting-rod-'];
  for(const part of regenerated.parts)if(alignedPrefixes.some(prefix=>part.name.startsWith(prefix))) {
    next.set(part.name,{...part,metadata:{...part.metadata,a6R02DesignCorrection:true,sourceBufferUnchanged:true}});
    const rod=part.name.startsWith('outside-main-connecting-rod-');
    const side=part.name.endsWith('--1')?-1:1;
    corrections.push({part:part.name,kind:rod?'native-fixed-length-rod-regeneration':'native-outside-cylinder-family-revision',matrix:null,beforeCylinderHeightM:p.cylinderHeight,afterCylinderHeightM:p.driveDiameter/2,lateralCylinderShiftM:side*.010,reason:rod?'Regenerate the complete shank and open eyes between aligned crosshead and unchanged crankpin; cross-sections and sampling unchanged, no scaling.':'Move the complete outside cylinder/piston/crosshead/slidebar family to axle height and 10 mm outboard, yielding exact 2r=0.6604 m travel and room for a real 20.05 mm cylinder wall. Keep the main-rod gudgeon axis explicit.'});
  }
  const move=(name,offset,reason)=>{const part=next.get(name);if(!part)throw Error(`Missing correction component ${name}`);next.set(name,translated(part,offset));corrections.push({part:name,kind:'rigid-placement',matrix:translation(...offset),translationM:offset,reason});};
  for(const side of[-1,1]){
    const cylinderName=`outside-cylinder-${side}`;
    next.set(cylinderName,workingCylinder(side,regenerated.parameters,original.get(cylinderName)));
    corrections.push({part:cylinderName,kind:'native-working-bore-and-gland',matrix:null,documentedBoreM:p.cylinderBore,casingOuterRadiusM:.255,wallThicknessM:.255-p.cylinderBore/2,glandBoreRadiusM:.040,retainedCoverBolts:24,reason:'Replace the impossible 0.05 mm source casing wall and solid rear cap with an annular 469.9 mm bore and real rod gland hole. Retain both covers, all 24 cover bolts and valve-chest support; wall/clearances are explicit design assumptions.'});
    for(let driver=1;driver<=3;driver++){
      move(`driver-${driver}-brake-shoe-${side}`,[side*.016,0,0],'Move unchanged shoe 16 mm outboard from the flange to the tread/taper band; analytic minimum radial gap 10.72 mm, outer tyre overhang 0.6 mm. Candidate working fit, not sourced brake engineering.');
      move(`driver-${driver}-journal-bearing-${side}`,[-side*.006,0,0],'Move unchanged journal sleeve 6 mm inboard within its axlebox, clearing the 4.6 mm hub overlap with 1.4 mm axial gap; shaft/axlebox positions unchanged.');
    }
    move(`coupling-rod-${side}-0`,[side*.030,0,0],'Move front link outboard 30 mm; paired rear link moves inboard 30 mm. This leaves 5 mm between eyes, with original eye spacings, shapes and coaxial joints unchanged.');
    move(`coupling-rod-${side}-1`,[-side*.030,0,0],'Move rear link inboard 30 mm; its innermost face remains 4.5 mm outside the hub while the two coupling-eye planes have a 5 mm face gap.');
    move(`outside-main-connecting-rod-${side}`,[side*.180,0,0],'Place outside main rod beyond the revised crosshead body and guide bars; 10.5 mm lateral gap to crosshead body. Preserve complete newly aligned fixed-length rod, eyes and cross-sections.');
    const crossheadName=`outside-crosshead-${side}`,crosshead=next.get(crossheadName),h=regenerated.parameters.cylinderHeight;
    const pinExtension=rod(`${crossheadName}-gudgeon-extension`,[side*1.082,h,p.crossheadZ],[side*1.262,h,p.crossheadZ],.046,'brushedMetal',{segments:25});
    next.set(crossheadName,join(crossheadName,[crosshead,pinExtension],crosshead));
    corrections.push({part:crossheadName,kind:'native-gudgeon-pin-extension',matrix:null,lengthAddedM:.180,reason:'Retain the entire crosshead and its original pin, add a coaxial 180 mm gudgeon extension supporting the outboard main-rod eye. The rod articulates about this pin without crossing the piston rod or guide bars.'});
    const bigName=`outside-main-rod-big-end-pin-${side}`;
    next.set(bigName,{...rod(bigName,[side*.987,p.driveDiameter/2+p.crankRadius,p.axisZ[3]],[side*1.257,p.driveDiameter/2+p.crankRadius,p.axisZ[3]],.05,'brushedMetal',{segments:p.radialSegments+1}),metadata:{...original.get(bigName).metadata,a6R02DesignCorrection:true,designStatus:'new-coaxial-bearing-stack',sourceBufferUnchanged:true}});
    corrections.push({part:bigName,kind:'native-big-end-pin-stack',matrix:null,axialEndpointsAbsXM:[.987,1.257],lengthM:.270,reason:'Coaxial 270 mm pin connects the retained crank extension to the outboard main-rod eye. Its inboard face clears the front coupling-eye face by 2.5 mm; all crank radii are unchanged.'});
    for(const valve of[false,true]){
      const name=`${valve?'expansion-link-frame-bracket':'outside-motion-bracket'}-${side}`;
      next.set(name,supportPortal(name,side,regenerated.parameters,original.get(name),valve));
      corrections.push({part:name,kind:'native-support-path-redesign',matrix:null,bridgeCenterYM:2.18,reason:'Replace the provisional straight support crossing the front wheel with an outboard upright, bridge above the 2.060 m flange top, and inboard frame upright. Preserve component name/function and archived original; no wheel/axle movement or deletion.'});
    }
  }
  const mechanics={...regenerated,parameters:{...regenerated.parameters,mainRodOffset:p.mainRodOffset+.180},parts:source.parts.map(part=>next.get(part.name)),originalMechanics:source,motionCorrections:corrections,motionDesign:{workingCylinders:true,cylinderBoreM:p.cylinderBore,pistonRadialClearanceM:.002,pistonHeadThicknessM:.06,glandRadialClearanceM:.002,couplingRodPlaneOffsetsM:[p.couplingRodOffset+.030,p.couplingRodOffset-.030],mainRodOutboardShiftM:.180,unsupportedValveReferenceParameters:source.parameters},evidence:{...regenerated.evidence,a6R02DesignCorrections:true,engineeringValidated:false}};
  return {mechanics,corrections,status:'provisional R02 kinematic and support corrections; original preserved',fixedSourceDimensions:{driveDiameterM:p.driveDiameter,axisZM:[...p.axisZ],crankRadiusM:p.crankRadius,pistonStrokeM:p.cylinderStroke},originalComponentCount:source.parts.length,correctedComponentCount:mechanics.parts.length};
}
