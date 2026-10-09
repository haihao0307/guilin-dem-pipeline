import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadLocal} from '../../../full/boxing/tests/load-model.mjs';
import {PRESETS,createPresetState} from '../../../full/ui/PresetCatalogueR2.mjs';
import {AnimatedHuman} from '../../../full/boxing/AnimatedHuman.mjs';
import {createBoxingRig} from '../../../full/boxing/Motion.mjs';
import {createGlovePair} from '../../../full/boxing-r02/Gloves.mjs';
import * as THREE from '../../../full/source/registration-vendor/three.module.js';
import {surfaceFingerprint} from '../../r02/SurfaceFingerprint.mjs';
import {SurfaceNarrowPhase} from '../SurfaceNarrowPhase.mjs';
import {validateActualFixture} from '../Validation.mjs';
const {model,defaultState,assetReads}=await loadLocal({allowNetwork:false});if(global.gc)global.gc();const cases=[];
const presets=process.env.FAST_PRESET?process.env.FAST_PRESET.split(',').map(Number):[16,12,35];
for(const presetIndex of presets){
 const state=createPresetState(PRESETS[presetIndex].id,defaultState);model.compute(state);const human=new AnimatedHuman(model,state),surface=new SurfaceNarrowPhase(human),rig=createBoxingRig({names:human.names,parents:human.rig.parents,restMatrices:human.rig.restMatrices,stature:human.height}),gloves=createGlovePair({names:human.names,height:human.height,color:0xd8a047}),matrix=new THREE.Matrix4().makeTranslation(0,human.floorOffset,0),fingerprint=await surfaceFingerprint(human);
 for(const poseTime of [0,.55,1.1]){
  const pose=rig.evaluate(poseTime,{pairIndex:Math.floor(presetIndex/2),fighter:presetIndex%2,opponentStature:1.75});human.animate(pose.skinMatrices);
  const result=validateActualFixture({surface,pose,matrixWorld:matrix.elements,gloves,presetIndex,poseTime,orientForward:g=>g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1))});
  assert.ok(result.passed);assert.equal(result.geometry.vertices,25417);assert.equal(result.geometry.weightsTruncated,false);assert.deepEqual(result.geometry.gloveTriangles,[770,770]);assert.ok(result.geometry.cuffVertices.every(n=>n>0));
  cases.push({...result,shapeFingerprint:fingerprint,presetId:PRESETS[presetIndex].id});console.log(JSON.stringify({presetIndex,poseTime,passed:result.passed,summary:result.summary}));
 }
 human.dispose();gloves.forEach(g=>g.dispose());if(global.gc)global.gc();
 await fs.writeFile(new URL('./NODE-PARTIAL.json',import.meta.url),JSON.stringify({cases},null,2));
}
const files=['../SurfaceNarrowPhase.mjs','../MeshSurfaceContact.mjs','../FixedStepCollisionWorld.mjs','../Validation.mjs','../../r02/SurfaceNarrowPhase.mjs','../../r02/MeshSurfaceContact.mjs','../../r02/TriangleContact.mjs'];
const sourceSHA256=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await fs.readFile(new URL(p,import.meta.url))).digest('hex')])));
const report={schema:'r03-fast-relocated-node-actual-fixtures/1',createdAt:new Date().toISOString(),passed:true,presets,poses:[0,.55,1.1],caseCount:cases.length,comparisonCount:cases.length*4,actualAssetReadsVerified:assetReads.length,cases,sourceSHA256,limits:'Node validation only. Browser screenshot and timing QA is a separate required run. Uses existing real R02 human/rig/glove assets; no proxy geometry.'};
await fs.writeFile(new URL('./NODE-VALIDATION.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,cases:cases.length,comparisons:cases.length*4}));
