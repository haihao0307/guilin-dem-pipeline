import * as T from '../../../vendor/three.module.js';
import {buildPreview} from './adapter.mjs';
import recipe from './recipe.mjs';
import design from './design.mjs';
import {A4_DIMENSIONS} from './dimensions.mjs';
import {TRACK,CONSIST} from '../metre-scale.mjs';
import {createSteamLocomotive as existingCrewSource} from '../steam-model.mjs';
export function createA4GameLocomotive(){
 const model=buildPreview(recipe,design,A4_DIMENSIONS),root=new T.Group(),frame=new T.Group();
 root.name='Flying Hongkonger 88 native A4';frame.name='SI to game floating origin';frame.rotation.x=-Math.PI/2;frame.position.y=TRACK.railHead;root.add(frame);frame.add(model.train);
 const bound=new T.Box3().setFromObject(root),frontOffset=CONSIST.frontX-bound.max.x;frame.position.x=frontOffset;
 const point=source=>new T.Vector3(...source).applyMatrix4(model.body.matrix).applyAxisAngle(new T.Vector3(1,0,0),-Math.PI/2).add(new T.Vector3(frontOffset,TRACK.railHead,0)).toArray();
 const p=model.nativeSource.spec.parameters,L=p.boilerLength,Y=p.boilerY,R=p.boilerRadius;
 const emitters={chimney:point([0,Y+R+.6,L/2-.8]),whistle:point([0,Y+R+.25,-2.1]),cylinderLeft:[frontOffset+3.2,TRACK.railHead+1.016,-design.cylinders[2].axisYM],cylinderRight:[frontOffset+3.2,TRACK.railHead+1.016,-design.cylinders[0].axisYM]};
 // Retain the actual game's existing original driver character and head animation.
 const old=existingCrewSource(),crewRoot=new T.Group();root.add(crewRoot);crewRoot.add(old.driverBody,old.crew.driverHead);
 const cabFloor=point([0,1.95*model.bodyScales.cabHeightFactor,-L/2-.5]),head=old.proof.placeholderDriver.position;
 crewRoot.position.set(cabFloor[0]-head[0],cabFloor[1]-old.proof.placeholderDriver.floorY,0);
 const wheels=model.wheels.map(w=>{const g=new T.Group();g.position.set(w.xM+frontOffset,TRACK.railHead+w.radiusM,-w.yM);g.userData={kind:w.driver?'driver':(+w.axle.split('-')[1]>=6?'tender':'guide'),radius:w.radiusM,nativeWheel:true,source:w.object.userData.sourceName};return g;});
 const bodyMotion={setEnabled(){},proof:{kind:'Rigid retained A4 shell; no fabricated suspension claim'}};
 function updatePhysics(s){model.setPhysicsState(s);frame.position.x=frontOffset-s.positionM;root.updateMatrixWorld(true);}
 function update(distance=0){const r=1.016;updatePhysics({timeS:0,positionM:distance,speedMps:0,wheelAngleRad:distance/r,wheelAngularSpeedRadS:0,wheelAngularAccelerationRadS2:0,wheelRadiusM:r,initialMechanicalThetaRad:.25,rollingOriginPositionM:0});}
 function fillSteamEmitters(out={}){for(const k of ['chimney','cylinderLeft','cylinderRight'])out[k]=emitters[k].slice();return out;}
 root.updateMatrixWorld(true);
 const proof={original:true,nativeA4:true,source:'Retained steam_train A4 native functions, existing rim/hub/spokes reused',dimensions:A4_DIMENSIONS,clearance:model.clearance,wheelArrangement:'4-6-2',driverRadius:1.016,leadingWheels:4,drivingWheels:6,trailingWheels:2,tenderWheels:8,count:20,wheels:20,driverDiameterM:2.032,driverAxleStationsM:model.axles.filter(a=>a.driver).map(a=>a.xM),emitters,placeholderDriver:{...old.proof.placeholderDriver,floorY:cabFloor[1]},metric: true,coordinateFrame:'SI physical travel; game scene floating origin',mechanismStatus:'88 three equal horizontal cylinders; inherited A4 appearance. Not historical A4 inclined inner cylinder valve gear.'};
 return {root,model,wheels,brakes:[],body:model.body,bodyMotion,proof,emitters,crew:old.crew,driverBody:old.driverBody,update,updatePhysics,updateCrew:old.updateCrew,updateBodyMotion(){},resetBodyMotion(){},transformBodyPoint:(p,out=[])=>{out.splice(0,3,...p);return out;},fillSteamEmitters,frontOffset,point};
}
