/** Read-only transfer of exact browser-exported refined native lip CSR.
 * This adds the same selected mouth surface used by ActorAdapter to the
 * complete canonical-body numerical fixture. It does not add or claim a
 * full head collision mesh, materials, tooth contacts or visual acceptance.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const CANONICAL_SHA='d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a';
const EXPECTED_SOURCE_HEAD='f93160826334077173b01721c511847b1828024e';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sample=(entries,matrices)=>{
  const p=[0,0,0];
  for(let k=0;k<entries.length;k+=8){const m=matrices[entries[k+3]],w=entries[k+4];
    for(let q=0;q<3;q++)p[q]+=w*(m[q*4]*entries[k]+m[q*4+1]*entries[k+1]+m[q*4+2]*entries[k+2]+m[q*4+3]);}
  return p;
};
export function attachExactNativeMouth(actor,file){
  assert(file,'Exact CI-exported refined mouth fixture is required');
  const bytes=fs.readFileSync(file),document=JSON.parse(bytes),f=document.fixtures.find(x=>x.actor===actor.id);
  assert.equal(document.canonicalSHA256,CANONICAL_SHA);assert.equal(document.sourceHead,EXPECTED_SOURCE_HEAD);
  assert.equal(document.mutation,false);assert(f,'Missing exact mouth for actor '+actor.id);
  assert.equal(f.schema,'native-refined-mouth-support-fixture/1');assert.equal(f.mutation,false);assert.equal(f.weightsTruncated,false);
  assert(f.sourceDisplayVertices>100000);assert.equal(f.sourceDisplayVertices,f.mouthSupport.originalDisplayVertices);
  assert.deepEqual(f.rig.names,actor.rig.names);assert.deepEqual(f.rig.parents,actor.rig.parents);
  let restMaximumErrorM=0,exportNativeMaximumErrorM=0,exportWorldMaximumErrorM=0;
  for(let j=0;j<actor.rig.count;j++)for(let k=0;k<16;k++){
    restMaximumErrorM=Math.max(restMaximumErrorM,Math.abs(f.rig.restMatrices[j][k]-actor.rig.rest[j][k]));
  }
  assert(restMaximumErrorM<1e-10,'Original full-body and refined-head rest skeletons must match exactly');
  assert(Math.abs(f.heightM-actor.binding.height)<1e-8);assert(Math.abs(f.floorOffsetM-actor.binding.floorOffset)<1e-8);
  for(const v of f.vertices){
    assert(v.entries.length>0&&v.entries.length%8===0);let weight=0;
    for(let k=0;k<v.entries.length;k+=8){assert(v.entries[k+3]>=0&&v.entries[k+3]<104);weight+=v.entries[k+4];}
    assert(Math.abs(weight-1)<1e-4);
    const p=sample(v.entries,f.currentSkinMatrices),nativeError=Math.hypot(...p.map((x,i)=>x-v.currentNative[i]));
    exportNativeMaximumErrorM=Math.max(exportNativeMaximumErrorM,nativeError);
    const d=[p[0],p[2],-p[1]],m=f.currentWorldMatrix,world=d.map((_,q)=>m[q]*d[0]+m[q+4]*d[1]+m[q+8]*d[2]+m[q+12]);
    exportWorldMaximumErrorM=Math.max(exportWorldMaximumErrorM,Math.hypot(...world.map((x,i)=>x-v.currentWorld[i])));
  }
  assert(exportNativeMaximumErrorM<1e-10);assert(exportWorldMaximumErrorM<1e-9);
  const byId=new Map(f.vertices.map(v=>[v.id,v]));assert(byId.has(f.mouthSupport.vertex));
  actor.poseTools.sampleMouth=()=>sample(byId.get(f.mouthSupport.vertex).entries,actor.rig.skinMatrices);
  actor.poseTools.mouthSupport=structuredClone(f.mouthSupport);
  actor.fixture.exactNativeMouth={sourceHead:document.sourceHead,canonicalSHA256:CANONICAL_SHA,
    artifactFile:file,artifactBytes:bytes.length,artifactSHA256:sha(bytes),sourceDisplayVertices:f.sourceDisplayVertices,
    support:structuredClone(f.mouthSupport),selectedVertices:f.vertices.map(v=>({id:v.id,csrInfluences:v.entries.length/8})),
    restMaximumErrorM,exportNativeMaximumErrorM,exportWorldMaximumErrorM,
    exactRefinedLipCSR:true,weightsTruncated:false,wholeHeadIncluded:false,visualAcceptance:false};
  return actor.fixture.exactNativeMouth;
}
