import {installBranding} from './native-a4/branding/install.mjs';
import * as THREE from '../../vendor/three.module.js';
import {Blocks} from './heritage.mjs';
import {createA4GameLocomotive} from './native-a4/game-locomotive.mjs';
import {createFullSizeCoach,COACH_BODY_MOTION_SPEC} from './coach-model.mjs';
import {TRACK,COACH_DIMENSIONS,COACH_LAYOUT,CONSIST} from './metre-scale.mjs';

export const WHEEL_RADIUS=COACH_DIMENSIONS.wheelRadius,RAIL_HEAD=TRACK.railHead;
export {COACH_BODY_MOTION_SPEC};

export function createGameTrain({legacy=false,bodyMotion={}}={}){
  // The preserved R14 page owns legacy geometry. Never load an old-size train
  // into this metre-dimensioned candidate or depend on an unpublished R16 tree.
  if(legacy)throw new Error('R17 supports only the metre-dimensioned train. Open the preserved R14 entry for legacy mode.');
  const root=new THREE.Group();root.name='Flying Hongkonger 88 native A4, tender and two metre-dimensioned passenger coaches';
  const inherited=createA4GameLocomotive({bodyMotion});root.add(inherited.root);
  const coaches=COACH_LAYOUT.map((spec,index)=>createFullSizeCoach(spec,index,{bodyMotion}));for(const coach of coaches)root.add(coach.root);
  const links=new Blocks();let previousRear=CONSIST.tenderRearX;
  for(const spec of COACH_LAYOUT){const front=spec.x+COACH_DIMENSIONS.overBuffers/2;links.box((previousRear+front)/2,TRACK.railHead+1.05,0,previousRear-front+.04,.13,.18,0x353b37);previousRear=spec.x-COACH_DIMENSIONS.overBuffers/2;}
  const couplers=new THREE.Mesh(links.geometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75,metalness:.25}));couplers.name='Shared intervehicle coupling links';couplers.castShadow=couplers.receiveShadow=true;root.add(couplers);
  const wheels=[...inherited.wheels,...coaches.flatMap(c=>c.wheels)],brakes=[...(inherited.brakes||[]),...coaches.flatMap(c=>c.brakes)];
  const transformCoachPoint=(index,point,out=[])=>coaches[index]?coaches[index].transformBodyPoint(point,out):(out[0]=point[0],out[1]=point[1],out[2]=point[2],out);
  function transformPassengerPoint(point,out=[]){const index=COACH_LAYOUT.findIndex(spec=>Math.abs(point[0]-spec.x)<=COACH_BODY_MOTION_SPEC.localHalfLength);return transformCoachPoint(index,point,out);}
  function resetBodyMotion(view={}){inherited.resetBodyMotion(view);for(const coach of coaches)coach.resetBodyMotion(view);}
  function setBodyMotionEnabled(value){inherited.bodyMotion.setEnabled(value);for(const coach of coaches)coach.bodyMotion.setEnabled(value);}
  const coachBodyMotionProof={kind:'Artistic coach-body micro-motion, not measured suspension physics',parameters:COACH_BODY_MOTION_SPEC,coaches:coaches.map((coach,index)=>Object.assign(coach.bodyMotion.proof,{pivot:[COACH_LAYOUT[index].x,COACH_BODY_MOTION_SPEC.pivotHeight,0]})),moving:'Floors, seats, sidewalls, doors, glazing, roofs, steps and train-local passenger anchors',fixed:'Dimensioned underframes, bogies, wheel axes, brakes, buffers and coupling links',extraDrawCalls:2};
  const proof={...inherited.proof,coachBodyMotion:coachBodyMotionProof,bodyMotionExtraDrawCalls:3,existingVehicles:2,addedCoaches:2,count:wheels.length,wheels:wheels.length,wheelRadius:WHEEL_RADIUS,railHead:RAIL_HEAD,wheelProfile:'48-sided full-size running tread and inboard flange; distance/radius rotation',inherited:inherited.proof,metreScale:true,coaches:coaches.map(c=>c.proof)};
  function update(view,{interior=false,dt=0}={}){
    const pressure=view.brake?1:['doors-opening','unloading','boarding','ready-depart','doors-closing'].includes(view.phase)?.75:view.throttle<0?-.3*view.throttle:0;
    if(view.physics)inherited.updatePhysics(view.physics);else inherited.update(view.distance);inherited.updateCrew(view);inherited.updateBodyMotion(view,dt);
    for(const coach of coaches){coach.updateHardware(view.distance,pressure);coach.updateBodyMotion(view,dt);coach.updateDoors(Math.max(0,Math.min(1,Number(view.door)||0)));coach.roof.material.opacity=interior?.22:1;coach.roof.material.depthWrite=!interior;coach.roof.castShadow=coach.ventMesh.castShadow=!interior;}
  }
  const result={root,coaches,transformCoachPoint,transformPassengerPoint,resetBodyMotion,setBodyMotionEnabled,wheels,brakes,steam:inherited,proof,update};installBranding(result);return result;
}
