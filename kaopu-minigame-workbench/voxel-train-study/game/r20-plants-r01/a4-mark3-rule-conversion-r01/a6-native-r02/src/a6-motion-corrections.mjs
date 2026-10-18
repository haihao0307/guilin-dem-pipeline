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
  const regenerated=buildLocomotiveMechanics({...options,cylinderHeight:p.driveDiameter/2});
  const original=new Map(source.parts.map(part=>[part.name,part])),next=new Map(source.parts.map(part=>[part.name,part])),corrections=[];
  const alignedPrefixes=['outside-cylinder-','outside-piston-rod-','outside-crosshead-','outside-slidebars-','outside-main-connecting-rod-'];
  for(const part of regenerated.parts)if(alignedPrefixes.some(prefix=>part.name.startsWith(prefix))) {
    next.set(part.name,{...part,metadata:{...part.metadata,a6R02DesignCorrection:true,sourceBufferUnchanged:true}});
    const rod=part.name.startsWith('outside-main-connecting-rod-');
    corrections.push({part:part.name,kind:rod?'native-fixed-length-rod-regeneration':'rigid-cylinder-axis-alignment',matrix:rod?null:translation(0,p.driveDiameter/2-p.cylinderHeight,0),beforeCylinderHeightM:p.cylinderHeight,afterCylinderHeightM:p.driveDiameter/2,reason:rod?'Regenerate the complete shank and open eyes between aligned crosshead and unchanged crankpin; cross-sections and sampling unchanged, no scaling.':'Move the complete outside cylinder/piston/crosshead/slidebar family together onto the axle height, yielding exact 2r=0.6604 m travel. Source height was explicitly provisional.'});
  }
  const move=(name,offset,reason)=>{const part=next.get(name);if(!part)throw Error(`Missing correction component ${name}`);next.set(name,translated(part,offset));corrections.push({part:name,kind:'rigid-placement',matrix:translation(...offset),translationM:offset,reason});};
  for(const side of[-1,1]){
    for(let driver=1;driver<=3;driver++){
      move(`driver-${driver}-brake-shoe-${side}`,[side*.016,0,0],'Move unchanged shoe 16 mm outboard from the flange to the tread/taper band; analytic minimum radial gap 10.72 mm, outer tyre overhang 0.6 mm. Candidate working fit, not sourced brake engineering.');
      move(`driver-${driver}-journal-bearing-${side}`,[-side*.006,0,0],'Move unchanged journal sleeve 6 mm inboard within its axlebox, clearing the 4.6 mm hub overlap with 1.4 mm axial gap; shaft/axlebox positions unchanged.');
    }
    move(`coupling-rod-${side}-0`,[side*.030,0,0],'Move front link outboard 30 mm; paired rear link moves inboard 30 mm. This leaves 5 mm between eyes, with original eye spacings, shapes and coaxial joints unchanged.');
    move(`coupling-rod-${side}-1`,[-side*.030,0,0],'Move rear link inboard 30 mm; its innermost face remains 4.5 mm outside the hub while the two coupling-eye planes have a 5 mm face gap.');
    move(`outside-main-connecting-rod-${side}`,[side*.180,0,0],'Place outside main rod beyond the crosshead body and guide bars; 20.5 mm lateral gap to crosshead body. Preserve complete newly aligned fixed-length rod, eyes and cross-sections.');
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
  const mechanics={...regenerated,parameters:{...regenerated.parameters,mainRodOffset:p.mainRodOffset+.180},parts:source.parts.map(part=>next.get(part.name)),originalMechanics:source,motionCorrections:corrections,motionDesign:{couplingRodPlaneOffsetsM:[p.couplingRodOffset+.030,p.couplingRodOffset-.030],mainRodOutboardShiftM:.180,unsupportedValveReferenceParameters:source.parameters},evidence:{...regenerated.evidence,a6R02DesignCorrections:true,engineeringValidated:false}};
  return {mechanics,corrections,status:'provisional R02 kinematic and support corrections; original preserved',fixedSourceDimensions:{driveDiameterM:p.driveDiameter,axisZM:[...p.axisZ],crankRadiusM:p.crankRadius,pistonStrokeM:p.cylinderStroke},originalComponentCount:source.parts.length,correctedComponentCount:mechanics.parts.length};
}
