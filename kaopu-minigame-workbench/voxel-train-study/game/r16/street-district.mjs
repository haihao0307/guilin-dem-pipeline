import * as THREE from '../../vendor/three.module.js';
import * as Instrument from './street/instrument.mjs';
export const STREET_PLACEMENT=Object.freeze({stationIndex:0,offset:27,groundY:.0805,loadRadius:240,unloadRadius:280,exclusionStart:6,exclusionEnd:39,halfWidth:24,observerSide:1});
export const streetOffset=(distance,target=0)=>target+STREET_PLACEMENT.offset-distance;
export const streetToGame=([x,y,z],distance=0,target=0)=>[x+streetOffset(distance,target),y+STREET_PLACEMENT.groundY,z];
export const streetExclusion=(distance,target=0)=>({minX:target+6-distance,maxX:target+39-distance,minZ:-24,maxZ:24});
export function createStreetDistrict({score=null,scoreURL=new URL('./street/first-street.score.json',import.meta.url),onChange=()=>{},instrument=Instrument,loadText=async url=>{const r=await fetch(url);if(!r.ok)throw new Error('Street Score HTTP '+r.status);return r.text();}}={}){
 const root=new THREE.Group();root.name='KST1 function-generated near street';root.position.y=STREET_PLACEMENT.groundY;
 const proof={version:'r16-kst1',schema:Instrument.SCHEMA,instrument:Instrument.INSTRUMENT_ID,abi:Instrument.ABI,status:'score-loading',ready:false,loadCount:0,unloadCount:0,active:false,externalMesh:false,externalImageTextures:false,clock:'Session.view.elapsed',placement:{...STREET_PLACEMENT},gpuVerified:false};
 root.userData.proof=proof;let parsed=null,handle=null,closed=false,failed=false,latest=null;
 function notify(){onChange(proof);}
 function unload(){if(!handle)return;instrument.dispose(handle);handle=null;proof.unloadCount++;proof.active=false;proof.status='released';proof.liveResources={geometries:0,materials:0};notify();}
 function sync(){if(closed||!parsed||!latest)return;const {view,route}=latest,target=route?.[0]?.target??0,offset=streetOffset(view.distance,target);root.position.x=offset;
  if(Math.abs(offset)>STREET_PLACEMENT.unloadRadius){unload();return;}
  if(!handle&&!failed&&Math.abs(offset)<=STREET_PLACEMENT.loadRadius){
   try{handle=instrument.build(parsed,{timeSeconds:view.elapsed,wetness:parsed.appearance.wetness,originOffset:[offset,STREET_PLACEMENT.groundY,0]});root.add(handle.root);proof.loadCount++;proof.active=true;proof.status='active';proof.metrics=instrument.measure(handle);proof.liveResources={geometries:proof.metrics.geometries,materials:proof.metrics.materials};notify();}
   catch(e){failed=true;proof.status='error';proof.error=String(e);notify();return;}
  }
  if(handle){instrument.update(handle,view.elapsed,{wetness:parsed.appearance.wetness,railDistance:view.distance,originOffset:[offset,STREET_PLACEMENT.groundY,0]});proof.elapsed=handle.state.time;proof.offset=offset;}
 }
 const ready=(async()=>{try{parsed=instrument.parseScore(score??await loadText(scoreURL));if(closed)return proof;proof.ready=true;proof.status='score-ready';proof.scoreBytes=new TextEncoder().encode(JSON.stringify(parsed)).length;sync();notify();return proof;}catch(e){proof.status='error';proof.error=String(e);notify();return proof;}})();
 return{root,proof,ready,update(view,route){if(closed)return;latest={view,route};sync();},snapshot(){return handle?instrument.snapshot(handle):null;},get handle(){return handle;},dispose(){if(closed)return;closed=true;unload();root.removeFromParent();root.clear();parsed=null;latest=null;proof.status='disposed';proof.ready=false;}};
}
