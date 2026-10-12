import {createStreamlinedShellMother} from './streamlined-shell-mother.mjs';
import {createExhaustMother} from './exhaust-mother.mjs';
import {createTenderMother} from './tender-mother.mjs';
import {createBackheadMother} from './backhead-mother.mjs';
import {createA6CabMother} from './a6-cab-mother.mjs';
import {integrateA6FairingFrame} from './a6-fairing-frame.mjs';
import {A6_DESIGN} from './a6-design-contract.mjs';
import {createFrameMother} from './frame-mother.mjs';
import {createRunningGearMother} from './running-gear-mother.mjs';
import {createCrewMother} from './crew-mother.mjs';
import {createBrandingMother} from './branding-mother.mjs';
import {createServiceFittingsMother} from './service-fittings-mother.mjs';
import {REBUILD_STATUS} from './structure-contract.mjs';
export function createNativeStructureCandidate(T,{branding=true}={}){
 const root=new T.Group();root.name='飞翔的香港人 A6版88号 / whole-vehicle candidate';
 const shell=createStreamlinedShellMother(T),frame=createFrameMother(T),tender=createTenderMother(T),cab=createA6CabMother(T,{shell}),backhead=createBackheadMother(T),gear=createRunningGearMother(T);
 integrateA6FairingFrame(T,frame);
 tender.root.position.x=frame.ports.tenderBodyCentreXM;backhead.root.position.set(-6.55,0,1.85);cab.root.add(backhead.root);
 const crew=createCrewMother(T);cab.root.add(crew.root);
 const exhaust=createExhaustMother(T,{mountSurfaceZM:(x,y)=>shell.surfaceZM(x+2.15,y)-3.71});exhaust.root.position.set(2.15,0,3.71);
 const fittings=createServiceFittingsMother(T,{shell,gear});const families={shell,exhaust,tender,cab,backhead,frame,gear,crew,fittings};root.add(fittings.root);for(const k of['shell','exhaust','tender','cab','frame','gear'])root.add(families[k].root);
 if(branding){families.branding=createBrandingMother(T,{shell,cab,tender});root.add(families.branding.root)}
 let lastDistance=0;function setBenchState({distanceM=0,speedMps=0,timeS=0,brake=0,crewView=null}={}){if(![distanceM,speedMps,timeS,brake].every(Number.isFinite))throw Error('FINITE_BENCH_INPUT_REQUIRED');gear.setPhysicsState({timeS,positionM:distanceM,rollingOriginPositionM:0,speedMps,wheelAngleRad:distanceM/1.016,wheelAngularSpeedRadS:speedMps/1.016,wheelAngularAccelerationRadS2:0,wheelRadiusM:1.016,initialMechanicalThetaRad:.25});gear.root.position.x=0;gear.setBrakePressure(brake);if(crewView)crew.update(crewView);lastDistance=distanceM;root.updateMatrixWorld(true);return{distanceM,brake,benchHoldsBodyAtOrigin:true,mechanicalState:gear.snapshot()}}
 function setPhysicsState(state){if(!Number.isFinite(state?.brakeFraction)||state.brakeFraction<0||state.brakeFraction>1)throw Error('FINITE_ACTUAL_BRAKE_FRACTION_REQUIRED');gear.setPhysicsState(state);gear.root.position.x=0;gear.setBrakePressure(state.brakeFraction);const readings=backhead.updateFromPhysics(state);crew.update({velocity:state.speedMps,station:{remaining:Math.abs(state.speedMps)<.01?0:99}});lastDistance=state.positionM;root.updateMatrixWorld(true);return{distanceM:lastDistance,brakeFraction:state.brakeFraction,pressureReadings:readings,mechanicalState:gear.snapshot(),benchHoldsBodyAtOrigin:true}}
 const ports={exhaust:exhaust.ports.map(p=>({...p,positionM:p.positionM.map((v,i)=>v+[2.15,0,3.71][i])})),crew:crew.anchor,backhead:cab.ports.find(x=>x.id==='cab.backhead-install'),frontBuffer:frame.ports.frontBuffer,rearBuffer:frame.ports.rearBuffer};
 root.userData={...REBUILD_STATUS,A6_DESIGN,motherFamilies:Object.keys(families),sourceTeacherAssetsLoaded:false,genericSteamTrainGeneratorCalled:false,materialGeometryUnifiedFamilies:['shell','exhaust','tender','cab','backhead','frame','brakes'],unresolved:['Detailed continuous swept collisions and all load paths remain under review','Two pressure gauges read existing absolute-pressure state; external hydraulic mates and other fluid states remain unbound','Original source fluid topology is not reconstructible from mesh names alone','Boiler internal steam/water phase, valve gear and exhaust manifold remain unresolved','Running gear retains existing designed wheel diameters, rods and phases; covered tender wheel centres still await shape review','Rendered mother output remains triangulated, not mesh-free completion']};setBenchState();return{root,families,ports,setBenchState,setPhysicsState,get distanceM(){return lastDistance},coverageStatus:root.userData};
}
