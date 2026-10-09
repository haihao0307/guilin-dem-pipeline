import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import {AnnyModel} from '../../full/source/kaopu-anny-workbench/r02/src/AnnyModel.js';
import {createBoxingRig} from '../../full/boxing/Motion.mjs';
import {bakeNativePacket,createNativePacketPlayer} from '../native_packet.mjs';

const full=path.resolve(import.meta.dirname,'../../full');
const bytes=zlib.gunzipSync(Buffer.concat(Array.from({length:6},(_,i)=>fs.readFileSync(path.join(full,'assets/anny-all/anny-model-'+String(i).padStart(2,'0')+'.bin.part')))));
const model=new AnnyModel(JSON.parse(fs.readFileSync(path.join(full,'assets/anny-all/anny-model.json'))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const states=JSON.parse(fs.readFileSync(path.join(full,'research/characters-r02/ACCEPTED-STATES.json'))).states;
let totalFrames=0,maxReplayDifference=0,negativeChecks=0;
const rows=[];
for(let ci=0;ci<states.length;ci++) {
  const s=states[ci],rest=model.forward({phenotypes:s.phenotypes,localChanges:s.localChanges});
  const restMatrices=Array.from({length:104},(_,j)=>Array.from(rest.bonePoses.slice(j*16,j*16+16)));
  const names=model.boneLabels,parents=model.boneParents;
  const fingerprint=createHash('sha256').update(JSON.stringify({names:Array.from(names),parents:Array.from(parents),restMatrices})).digest('hex');
  const rig=createBoxingRig({names,parents,restMatrices,stature:s.measurements.heightCM/100,child:['child','teen'].includes(s.stage)});
  const evaluate=t=>rig.evaluate(t,{pairIndex:Math.floor(ci/2),fighter:ci%2,opponentStature:states[ci^1].measurements.heightCM/100});
  const packet=bakeNativePacket({evaluate,names,parents,restFingerprint:fingerprint,fps:30,frameCount:31,source:{kind:'self-authored-procedural',neuralInferenceExecuted:false,revision:'boxing-motion-r01'}});
  const decoded=JSON.parse(JSON.stringify(packet)); // Actual portable serialization round trip.
  const player=createNativePacketPlayer(decoded,{names,parents,restFingerprint:fingerprint});
  decoded.fps=3000; // A private snapshot must include timing, not just frame arrays.
  for(let frame=0;frame<31;frame++) {
    const replay=player.evaluate(frame/30),native=evaluate(frame/30);
    for(const key of ['posedMatrices','skinMatrices']) for(let j=0;j<104;j++) for(let k=0;k<16;k++) {
      maxReplayDifference=Math.max(maxReplayDifference,Math.abs(replay[key][j][k]-native[key][j][k]));
    }
    assert.deepEqual(replay.rootTranslation,Array.from(native.rootTranslation));
    assert.equal(replay.rootTranslationAlreadyInMatrices,true);
    totalFrames++;
  }
  assert.equal(player.evaluate(-100).frameIndex,0);
  assert.equal(player.evaluate(999).frameIndex,30);
  const snapshot=player.evaluate(0);snapshot.skinMatrices[0][3]=1234;
  assert.notEqual(player.evaluate(0).skinMatrices[0][3],1234);
  assert.throws(()=>player.evaluate(NaN),/finite/);negativeChecks++;
  decoded.fps=30;
  assert.throws(()=>createNativePacketPlayer(decoded,{names,parents,restFingerprint:'f'.repeat(64)}),/rest shape/);negativeChecks++;
  const bad=structuredClone(decoded);bad.skeleton.id='somaskel77';
  assert.throws(()=>createNativePacketPlayer(bad,{names,parents,restFingerprint:fingerprint}),/calibrated retarget/);negativeChecks++;
  for(const [mutate,pattern] of [
    [p=>{delete p.frames[0].rootTranslation;},/native root/],
    [p=>{p.frames[0].rootTranslation=[NaN,0,0];},/native root/],
    [p=>{p.sampling='linear';},/sampling/],
    [p=>{p.source.neuralInferenceExecuted=true;},/provenance/],
  ]) {
    const altered=structuredClone(decoded);mutate(altered);
    assert.throws(()=>createNativePacketPlayer(altered,{names,parents,restFingerprint:fingerprint}),pattern);negativeChecks++;
  }
  rows.push({id:s.id,frames:31,bones:104,restFingerprint:fingerprint});
}
assert.equal(maxReplayDifference,0);
const report={schema:'kaopu-native-packet-qa/1',testedAt:new Date().toISOString(),characters:states.length,frames:totalFrames,bonesPerFrame:104,negativeChecks,maxReplayDifference,
  inputs:Object.fromEntries(['boxing/Motion.mjs','research/characters-r02/ACCEPTED-STATES.json','source/kaopu-anny-workbench/r02/src/AnnyModel.js','assets/anny-all/anny-model.json'].map(p=>[p,createHash('sha256').update(fs.readFileSync(path.join(full,p))).digest('hex')])),
  annyModelDecompressedSha256:createHash('sha256').update(bytes).digest('hex'),
  neuralModelsExecuted:[],weightsDownloaded:[],note:'CPU numerical JSON round-trip of the existing procedural motion rig. No GPU framebuffer readback, rendering claim, SOMA-to-Anny retarget or research-model inference.',rows};
fs.writeFileSync(path.resolve(import.meta.dirname,'../NATIVE-PACKET-QA.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));
