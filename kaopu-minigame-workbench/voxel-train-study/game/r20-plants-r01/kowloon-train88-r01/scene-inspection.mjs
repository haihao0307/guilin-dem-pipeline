import * as THREE from '../../../vendor/three.module.js';
import {VIEWS as STATION_VIEWS} from '../kowloon-station-r04/station-score.mjs';
import {STATION_RAY_BOUNDS} from './field-coverage.mjs';
import {BUREAU_RAY_BOUNDS} from '../bureau-train88-r01/field-coverage.mjs';
import {bureauView} from '../bureau-train88-r01/bureau-binding.mjs';
import {CAMERA_LIMITS} from '../camera-presets.mjs';
import {sceneCameraFrame} from './scene-camera-policy.mjs';
import {fitSharedSun} from './shared-sun-policy.mjs';
export function transformedBounds(bounds,frame){
 const points=[];for(const x of[bounds.lo[0],bounds.hi[0]])for(const y of[bounds.lo[1],bounds.hi[1]])for(const z of[bounds.lo[2],bounds.hi[2]])points.push(frame.toWorld([x,y,z]));
 return{min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i])))};
}
export function districtSceneView(id,view,route,{station,bureau}){
 const [owner,name]=id.split(':');let v,bounds;
 if(owner==='kowloon'){const f=station.binding.frame(view,route),source=STATION_VIEWS[name];if(!source)throw Error('Unknown station observation');v={eye:f.toWorld(source.eye),target:f.toWorld(source.target),cut:false};bounds=transformedBounds(STATION_RAY_BOUNDS,f);}
 else if(owner==='bureau'){v=bureauView(name,view,route);bounds=transformedBounds(BUREAU_RAY_BOUNDS,bureau.binding.frame(view,route));}
 else throw Error('Unknown scene owner');
 return sceneCameraFrame({...v,bounds,name:id},CAMERA_LIMITS);
}
export function createSharedSunDomain({atmosphere,station,bureau,trainBounds}){
 const sun=atmosphere.root.children.find(o=>o.isDirectionalLight&&o.castShadow),sky=atmosphere.root.children.find(o=>o.name==='Original procedural dawn sky');
 if(!sun)throw Error('Original host sun required');sun.updateWorldMatrix(true,false);sun.target.updateWorldMatrix(true,false);
 const direction=new THREE.Vector3().subVectors(sun.getWorldPosition(new THREE.Vector3()),sun.target.getWorldPosition(new THREE.Vector3())).normalize().toArray(),frustum=new THREE.Frustum(),clip=new THREE.Matrix4();
 const proof={method:'one original sun with conservative active-construction enclosure',direction,mapSize:sun.shadow.mapSize.toArray(),gpuVerified:false};let lastKey=null;
 return{proof,update(camera,view,route){
  // Keep the original analytic sky around the observer; its local direction field
  // is unchanged and it never participates in station/function intersections.
  if(sky)sky.position.copy(camera.position);
  clip.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(clip);
  const domains=[{name:'original-train',...trainBounds},{name:'kowloon',...transformedBounds(STATION_RAY_BOUNDS,station.binding.frame(view,route))},{name:'bureau',...transformedBounds(BUREAU_RAY_BOUNDS,bureau.binding.frame(view,route))}];
  const visible=domains.filter(b=>frustum.intersectsBox(new THREE.Box3(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max))));
  if(!visible.length){proof.domains=[];return false;}
  const key=JSON.stringify([visible,sun.shadow.mapSize.toArray()]);proof.domains=visible.map(b=>b.name);if(key===lastKey)return false;
  const fit=fitSharedSun({direction,bounds:visible,mapSize:sun.shadow.mapSize.toArray()});
  sun.position.fromArray(fit.position);sun.target.position.fromArray(fit.target);sun.shadow.camera.up.fromArray(fit.up);
  for(const k of['left','right','top','bottom','near','far'])sun.shadow.camera[k]=fit[k];
  sun.updateWorldMatrix(true,false);sun.target.updateWorldMatrix(true,false);sun.shadow.camera.updateProjectionMatrix();sun.shadow.updateMatrices(sun);
  Object.assign(proof,{fit,projection:Array.from(sun.shadow.camera.projectionMatrix.elements)});lastKey=key;return true;
 }};
}
