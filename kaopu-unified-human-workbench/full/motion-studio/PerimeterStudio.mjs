import * as THREE from '../source/registration-vendor/three.module.js';
import {PRESETS,createPresetState} from '../ui/PresetCatalogueR2.mjs';
import {createR02ArenaScene} from '../arena-scene-r01/R02ArenaScene.mjs';
import {createPerimeterActivityGroup} from '../activity-perimeter-r01/PerimeterActivityGroup.mjs';
/** One original canvas, 18 accepted R02 rings + three full native activity actors. */
export async function createPerimeterStudio({root,model,defaults,onProgress,signal}){
 const saved=structuredClone(model.state);let arenas,perimeter;
 try{
  arenas=await createR02ArenaScene({root,model,states:PRESETS.map(p=>({...p,state:createPresetState(p.id,defaults)})),onProgress:p=>onProgress?.(`装配原18台：${p.completed}/36个完整人物`),signal});
  const sources={};for(const[key,file]of Object.entries({walk:'CMU-WALK-SOURCE.json',run:'16_57-SOURCE.json',jump:'16_01-SOURCE.json'})){const response=await fetch(new URL('../activity-r01/'+file,import.meta.url),{signal});if(!response.ok)throw Error('Captured source HTTP '+response.status);sources[key]=await response.json();}
  const ids=['r02-child-male-tall-slim','r02-adult-female-rounded','r02-senior-male-sturdy'];
  const states=ids.map((id,i)=>{const p=PRESETS.find(p=>p.id===id);return{...p,state:createPresetState(id,defaults),activity:['walk','run','jump'][i],...(i===0?{activityProgram:'walk-round-trip/1'}:{})};});
  perimeter=await createPerimeterActivityGroup({root,model,states,sources,arenaBounds:arenas.arenaBounds,signal,onProgress:p=>onProgress?.(`校验场外全身活动范围：${p.completed}/3`)});
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 }catch(e){perimeter?.dispose();arenas?.dispose();throw e;}finally{model.compute(saved);}
 let time=0;const actors=[...arenas.actors,...perimeter.actors];
 const bounds=boxes=>{const b=new THREE.Box3();for(const x of boxes){b.expandByPoint(new THREE.Vector3(...x.min));b.expandByPoint(new THREE.Vector3(...x.max));}return b;};
 const api={actors,arenas,perimeter,duration:perimeter.duration,update(t){if(!Number.isFinite(t)||t<0)throw Error('Finite nonnegative studio time required');time=t;arenas.update(time);perimeter.update(time);},reset(){time=0;arenas.update(0);perimeter.reset();},view(viewer,focus='perimeter',angle='three'){
  const boxes=focus==='all'?[...arenas.arenaBounds,...perimeter.plan.zones.map(z=>z.zone)]:focus==='perimeter'?perimeter.plan.zones.map(z=>z.sweep):focus.startsWith('p')?[perimeter.plan.zones[Number(focus.slice(1))].sweep]:[arenas.arenaBounds[Number(focus)]];
  const box=bounds(boxes),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),direction=new THREE.Vector3(...(angle==='side'?[1,.4,.1]:angle==='rear'?[-.3,.5,-1]:angle==='front'?[0,.35,1]:[.25,focus==='all'?.85:.4,1])).normalize();
  const right=new THREE.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right),tanV=Math.tan(viewer.camera.fov*Math.PI/360),tanH=tanV*viewer.camera.aspect;let distance=1;for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).sub(center),depth=p.dot(direction);distance=Math.max(distance,depth+Math.abs(p.dot(right))/tanH,depth+Math.abs(p.dot(up))/tanV);}distance*=1.08;
  viewer.camera.far=260;viewer.camera.position.copy(center).addScaledVector(direction,distance);viewer.orbit.target.copy(center);viewer.camera.zoom=1;viewer.camera.updateProjectionMatrix();viewer.orbit.update();viewer.render();
 },diagnostics(){return{time,duration:perimeter.duration,fullActors:39,totalVertices:actors.reduce((n,a)=>n+a.human.N,0),arenas:arenas.diagnostics(),perimeter:perimeter.diagnostics(),clock:'monotonic 120Hz arena clock; one walk/rest/turn round trip; original run and jump hold their finite ends',performance:'software-browser FPS is not hardware performance'};},dispose(){perimeter.dispose();arenas.dispose();}};
 api.reset();return api;
}
