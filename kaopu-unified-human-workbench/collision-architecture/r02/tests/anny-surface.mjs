import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {loadLocal} from '../../../full/boxing/tests/load-model.mjs';
import {PRESETS,createPresetState} from '../../../full/ui/PresetCatalogueR2.mjs';
import {AnimatedHuman} from '../../../full/boxing/AnimatedHuman.mjs';
import {createBoxingRig} from '../../../full/boxing/Motion.mjs';
import * as THREE from '../../../full/source/registration-vendor/three.module.js';
import {SurfaceNarrowPhase,closestTriangle} from '../SurfaceNarrowPhase.mjs';
const {model,defaultState}=await loadLocal({allowNetwork:false}),results=[];
for(const index of [12,16,35]){
 const preset=PRESETS[index],state=createPresetState(preset.id,defaultState);model.compute(state);const h=new AnimatedHuman(model,state),motion=createBoxingRig({names:h.names,parents:h.rig.parents,restMatrices:h.rig.restMatrices,stature:h.height}),group=new THREE.Group();group.position.set(3,1+h.floorOffset,-5);group.rotation.y=.7;group.updateMatrixWorld(true);
 const start=performance.now(),surface=new SurfaceNarrowPhase(h);const buildMs=performance.now()-start,checks=[];
 for(const t of [0,.23,.55,1.1,1.9]){
  const pose=motion.evaluate(t,{pairIndex:Math.floor(index/2),fighter:index%2,opponentStature:1.75});h.animate(pose.skinMatrices);const snapshot=surface.snapshot(pose.skinMatrices,group.matrixWorld.elements);surface.setStep(snapshot,snapshot);let maxError=0;
  for(let v=0;v<h.N;v+=7){const p=h.sampleVertex(v),expected=new THREE.Vector3(p[0],p[2],-p[1]).applyMatrix4(group.matrixWorld),actual=surface.vertex(v,snapshot);maxError=Math.max(maxError,expected.distanceTo(new THREE.Vector3(...actual)));}assert.ok(maxError<1e-6);
  const torso=surface.triangleIds.find(id=>surface.triangleRegion[id]==='torso'&&h.positions[h.faces[id*3]*3+1]<-.03);const vertices=[0,1,2].map(k=>surface.vertex(h.faces[torso*3+k],snapshot)),center=vertices[0].map((v,k)=>(v+vertices[1][k]+vertices[2][k])/3),ab=new THREE.Vector3(...vertices[1]).sub(new THREE.Vector3(...vertices[0])),ac=new THREE.Vector3(...vertices[2]).sub(new THREE.Vector3(...vertices[0])),n=ab.cross(ac).normalize().toArray(),from=center.map((v,k)=>v+n[k]*.35),to=center.map((v,k)=>v-n[k]*.1);
  const castStart=performance.now(),hit=surface.cast({from,to,radius:.03});assert.ok(hit&&!hit.unresolved);const castMs=performance.now()-castStart,tri=hit.vertexIds.map(v=>surface.vertex(v,snapshot));assert.ok(closestTriangle(hit.contactPoint,...tri).distance<1e-9);checks.push({time:t,maxGpuCpuErrorM:maxError,castMs,hit,stats:{...surface.stats}});
 }
 results.push({presetId:preset.id,height:h.height,vertices:h.N,faces:h.faces.length/3,collisionTriangles:surface.triangleIds.length,nodes:surface.nodeCount,buildMs,checks});h.dispose();
}
console.log(JSON.stringify({passed:true,results},null,2));
