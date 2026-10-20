/** Original transaction adapter. No measured interior or safety certification. */
import {defaultFloorConfig,buildFloors} from '../r04/floors.mjs';
import {defaultCirculationConfig,deriveCirculationProposal,buildCirculation,inspectCirculation} from './circulation.mjs';
import {defaultGuardConfig,deriveGuardProposal,buildGuards,inspectGuards,auditGuardGeometry} from './guards.mjs';
import {defaultDoorConfig,deriveDoorProposal,buildDoor,inspectDoor,sampleDoorSweep,auditDoorHostGeometry} from './door.mjs';
export function defaultInteriorConfig(){return {floors:defaultFloorConfig(),circulation:defaultCirculationConfig(),guards:defaultGuardConfig(),door:defaultDoorConfig()};}
const copy=v=>structuredClone(v);
export function deriveInterior(score,config,parent={enabled:true,visible:true}){
 const floors={...config.floors,enabled:config.floors.enabled&&parent.enabled,visible:config.floors.visible&&parent.visible};
 const circulation=deriveCirculationProposal(score,floors,config.circulation);
 const available=circulation.validation.activationReady;
 const guards=available?deriveGuardProposal(circulation,config.guards):null;
 const door=available?deriveDoorProposal(circulation.floorState,circulation.pairs[0],config.door):null;
 return {schema:'kaopu.bounded-interior-transaction/0.1',config:copy(config),parent:copy(parent),circulation,guards,door,
  interiorEvidence:'unknown',editableProposal:true,structuralSupportVerified:false,buildingComplianceVerified:false,
  navigationConnectionEnabled:false,circulationComplete:false,evacuationPermitted:false};
}
export function disposeInterior(group){group?.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(!m.userData.retainAcrossRebuild)m.dispose();});});}
export function buildInterior(THREE,score,state){
 const group=new THREE.Group();group.name='authored-r05-interior';let floors,circulation,guards,door,sweep=null,fixedHostAudit=null;
 try{
  floors=buildFloors(THREE,score,state.circulation.configWithOpenings);group.add(floors);
  circulation=buildCirculation(THREE,state.circulation);group.add(circulation);
  if(state.guards){guards=buildGuards(THREE,state.guards);group.add(guards);}
  if(state.door){door=buildDoor(THREE,state.door);group.add(door);}
  group.updateMatrixWorld(true);
  if(state.guards?.effectiveEnabled)auditGuardGeometry(THREE,state.guards,guards,[circulation,floors]);
  const obstacleMeshes=[];for(const g of [floors,circulation,guards])g?.traverse(o=>{if(o.isMesh)obstacleMeshes.push(o);});
  if(state.door?.effectiveEnabled){fixedHostAudit=auditDoorHostGeometry(THREE,door,obstacleMeshes);if(!fixedHostAudit.clear)throw Error('Fixed door partition/frame intersects '+fixedHostAudit.collisions[0]?.obstacleId+'; previous valid design retained');sweep=sampleDoorSweep(THREE,door,obstacleMeshes,{fromAngleDeg:0,toAngleDeg:100,stepDeg:1});if(!sweep.clear)throw Error('Door sweep intersects '+sweep.collisions[0]?.obstacleId+' at '+sweep.collisions[0]?.angleDeg+' degrees; previous valid design retained');}
  group.userData={state,refs:{floors,circulation,guards,door},sweep,fixedHostAudit,obstacleMeshes};
  return group;
 }catch(error){disposeInterior(group);throw error;}
}
export function inspectInterior(state,group=null){const refs=group?.userData.refs;return {schema:state.schema,config:copy(state.config),parent:copy(state.parent),interiorEvidence:'unknown',editableProposal:true,
 circulation:inspectCirculation(state.circulation,refs?.circulation??null),guards:state.guards?inspectGuards(state.guards,refs?.guards??null):null,
 door:state.door?inspectDoor(state.door,refs?.door??null):null,sweep:copy(group?.userData.sweep??null),fixedHostAudit:copy(group?.userData.fixedHostAudit??null),
 navigationConnectionEnabled:false,circulationComplete:false,evacuationPermitted:false,structuralSupportVerified:false,buildingComplianceVerified:false};}
