import * as THREE from '../../vendor/three.module.js';
import * as Instrument from './street/instrument.mjs';
export const STREET_PLACEMENT=Object.freeze({stationIndex:0,offset:27,groundY:.0805,loadRadius:240,unloadRadius:280,exclusionStart:6,exclusionEnd:39,halfWidth:24,observerSide:1});
export const streetOffset=(distance,target=0)=>target+STREET_PLACEMENT.offset-distance;
export const streetToGame=([x,y,z],distance=0,target=0)=>[x+streetOffset(distance,target),y+STREET_PLACEMENT.groundY,z];
export const streetExclusion=(distance,target=0)=>({minX:target+6-distance,maxX:target+39-distance,minZ:-24,maxZ:24});
export function createStreetDistrict({score=null,scoreURL=new URL('./street/first-street.score.json',import.meta.url),onChange=()=>{},instrument=Instrument,loadText=async url=>{const r=await fetch(url);if(!r.ok)throw new Error('Street Score HTTP '+r.status);return r.text();}}={}){
 const root=new THREE.Group();root.name='KST1 function-generated near street';root.position.y=STREET_PLACEMENT.groundY;
 // Keep the host's point-light program key stable before, during and after a
 // street visit. Intensity zero preserves the slots without emitting light.
 const lightSlots=Array.from({length:2},(_,index)=>{
  const light=new THREE.PointLight(0xffcf8c,0,3.8,2);
  light.name='KST1-persistent-shop-light-'+index;light.userData.streetLightSlot=index;
  light.castShadow=false;light.position.set(0,-1000,0);light.updateMatrix();light.matrixAutoUpdate=false;
  root.add(light);return light;
 });
 const proof={version:'r17-kst1',schema:Instrument.SCHEMA,instrument:Instrument.INSTRUMENT_ID,abi:Instrument.ABI,status:'score-loading',ready:false,loadCount:0,unloadCount:0,active:false,lightingSlots:lightSlots.length,lightingActive:0,externalMesh:false,externalImageTextures:false,clock:'Session.view.elapsed',placement:{...STREET_PLACEMENT},gpuVerified:false};
 root.userData.proof=proof;let parsed=null,handle=null,closed=false,failed=false,latest=null;
 function notify(){onChange(proof);}
 function darkenLights(){for(const light of lightSlots)light.intensity=0;proof.lightingActive=0;}
 function stageLights(candidate,emitters){
  candidate.root.traverse(object=>{if(object.isLight)emitters.push(object);});
  if(emitters.length>lightSlots.length)throw new Error('Street exceeds its two point-light slots');
  if(candidate.root.matrixAutoUpdate)candidate.root.updateMatrix();
  return emitters.map(source=>{
   if(!source.isPointLight||source.parent!==candidate.root||source.castShadow||source.layers.mask!==1)
    throw new Error('Unsupported street light ownership or shadow/layer configuration');
   if(source.matrixAutoUpdate)source.updateMatrix();
   // Both roots are siblings after adoption. Retain the complete relative
   // matrix, including any authored root transform, rather than re-deriving it.
   const matrix=new THREE.Matrix4().multiplyMatrices(candidate.root.matrix,source.matrix);
   const color=source.color.clone(),intensity=source.visible&&candidate.root.visible?source.intensity:0;
   if(![...matrix.elements,...color.toArray(),intensity,source.distance,source.decay].every(Number.isFinite))
    throw new Error('Nonfinite street light output');
   return{source,matrix,color,intensity,distance:source.distance,decay:source.decay,layers:source.layers.mask};
  });
 }
 function buildHandle(view,offset){
  let candidate=null;const emitters=[],released=new Set();
  const releaseSource=source=>{source.removeFromParent();if(!released.has(source)){released.add(source);source.dispose();}};
  try{
   candidate=instrument.build(parsed,{timeSeconds:view.elapsed,wetness:parsed.appearance.wetness,originOffset:[offset,STREET_PLACEMENT.groundY,0]});
   const staged=stageLights(candidate,emitters),metrics=instrument.measure(candidate);
   for(const {source}of staged)releaseSource(source);
   root.add(candidate.root);
   for(let i=0;i<staged.length;i++){
    const value=staged[i],slot=lightSlots[i];
    slot.matrix.copy(value.matrix);slot.matrix.decompose(slot.position,slot.quaternion,slot.scale);slot.matrixWorldNeedsUpdate=true;
    slot.color.copy(value.color);slot.intensity=value.intensity;slot.distance=value.distance;slot.decay=value.decay;slot.layers.mask=value.layers;
   }
   handle=candidate;proof.loadCount++;proof.active=true;proof.status='active';proof.metrics=metrics;
   proof.lightingActive=lightSlots.filter(light=>light.intensity!==0).length;
   proof.liveResources={geometries:metrics.geometries,materials:metrics.materials};
  }catch(error){
   darkenLights();handle=null;
   const cleanupErrors=[];
   for(const source of emitters)try{releaseSource(source);}catch(e){cleanupErrors.push(String(e));}
   if(candidate){candidate.root.removeFromParent();try{instrument.dispose(candidate);}catch(e){cleanupErrors.push(String(e));}}
   failed=true;proof.active=false;proof.status='error';proof.error=String(error);proof.liveResources={geometries:0,materials:0};
   if(cleanupErrors.length)proof.cleanupError=cleanupErrors.join('; ');
  }
  notify();
 }
 function unload(){
  darkenLights();if(!handle)return;
  const previous=handle;handle=null;
  try{instrument.dispose(previous);}finally{
   previous.root.removeFromParent();proof.unloadCount++;proof.active=false;proof.status='released';proof.liveResources={geometries:0,materials:0};notify();
  }
 }
 function sync(){if(closed||!parsed||!latest)return;const {view,route}=latest,target=route?.[0]?.target??0,offset=streetOffset(view.distance,target);root.position.x=offset;
  if(Math.abs(offset)>STREET_PLACEMENT.unloadRadius){unload();return;}
  if(!handle&&!failed&&Math.abs(offset)<=STREET_PLACEMENT.loadRadius){
   buildHandle(view,offset);
  }
  if(handle){instrument.update(handle,view.elapsed,{wetness:parsed.appearance.wetness,railDistance:view.distance,originOffset:[offset,STREET_PLACEMENT.groundY,0]});proof.elapsed=handle.state.time;proof.offset=offset;}
 }
 const ready=(async()=>{try{parsed=instrument.parseScore(score??await loadText(scoreURL));if(closed)return proof;proof.ready=true;proof.status='score-ready';proof.scoreBytes=new TextEncoder().encode(JSON.stringify(parsed)).length;sync();notify();return proof;}catch(e){if(closed)return proof;proof.status='error';proof.error=String(e);notify();return proof;}})();
 return{root,proof,ready,update(view,route){if(closed)return;latest={view,route};sync();},snapshot(){return handle?instrument.snapshot(handle):null;},get handle(){return handle;},dispose(){if(closed)return;closed=true;try{unload();}finally{for(const light of lightSlots)light.dispose();root.removeFromParent();root.clear();parsed=null;latest=null;proof.status='disposed';proof.ready=false;proof.lightingSlots=0;}}};
}
