import assert from 'node:assert/strict';
import {
  BLACK_BASS_R1_CARD,
  resampleProfile,
  buildCranialMesh,
  buildLowerJawMesh,
  transformJawPoint,
  buildMouthCavityMesh,
  buildMaxillaryMeshes,
  buildLipBand,
  buildLipMeshes,
  buildEyeMeshes,
  buildOperculumFlapMesh,
  buildOperculumEdgeMesh,
  buildCommissureMeshes,
  buildBlackBassHeadMouth
} from '../v07/blackBassFish-v07.js';

const finite=a=>a.every(Number.isFinite);
assert.equal(BLACK_BASS_R1_CARD.schema,'kaopu.fish.black-bass.head-mouth/0.7');
assert.equal(BLACK_BASS_R1_CARD.source.sha256,'c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64');
assert.equal(BLACK_BASS_R1_CARD.source.sourceMeshRuntimeDependency,false);
assert.equal(BLACK_BASS_R1_CARD.species.habitatIdentity,'freshwater');
assert(BLACK_BASS_R1_CARD.cranialProfile[0][0] < 0.25);
assert(BLACK_BASS_R1_CARD.cranialProfile[8][2] > 0.13);

const sampled=resampleProfile(BLACK_BASS_R1_CARD.jaw.envelope,4);
assert(sampled.length>BLACK_BASS_R1_CARD.jaw.envelope.length);
for(let i=1;i<sampled.length;i++)assert(sampled[i][0]>sampled[i-1][0]);

const cranium=buildCranialMesh({radialSegments:72,subdivisions:2});
assert(cranium.positions.length>0&&cranium.indices.length>0&&finite(cranium.positions));
assert(cranium.skippedFaceCount>0);

const rest=buildLowerJawMesh({mouthOpenRad:0,radialSegments:24});
const open=buildLowerJawMesh({mouthOpenRad:0.20,radialSegments:24});
assert(rest.positions.length>0&&rest.indices.length>0);
assert(open.positions.length===rest.positions.length);
assert(finite(rest.positions)&&finite(open.positions));
assert.deepEqual(transformJawPoint(BLACK_BASS_R1_CARD.jaw.hinge,0.20),[...BLACK_BASS_R1_CARD.jaw.hinge]);
const rs=rest.radialSegments;
const centroid=(mesh,ring)=>{const o=[0,0,0];for(let k=0;k<rs;k++){const i=3*(ring*rs+k);o[0]+=mesh.positions[i];o[1]+=mesh.positions[i+1];o[2]+=mesh.positions[i+2]}return o.map(v=>v/rs)};
const tip0=centroid(rest,rest.ringCount-1),tip1=centroid(open,open.ringCount-1),h=BLACK_BASS_R1_CARD.jaw.hinge;
assert(tip1[1]<tip0[1]);
assert(Math.abs(Math.hypot(tip0[1]-h[1],tip0[2]-h[2])-Math.hypot(tip1[1]-h[1],tip1[2]-h[2]))<1e-10);

const eyeRear=BLACK_BASS_R1_CARD.eyes.leftCenter[2]-BLACK_BASS_R1_CARD.eyes.observedExtents[2]/2;
assert(BLACK_BASS_R1_CARD.maxillary.rearAnchor[2]<eyeRear);

const cavity0=buildMouthCavityMesh({mouthOpenRad:0});
const cavityOpen=buildMouthCavityMesh({mouthOpenRad:0.3});
assert(cavity0.positions.length===cavityOpen.positions.length);
assert(Math.min(...cavityOpen.positions.filter((_,i)=>i%3===1))<Math.min(...cavity0.positions.filter((_,i)=>i%3===1)));

for(const mesh of Object.values(buildMaxillaryMeshes()))assert(mesh.positions.length>0&&finite(mesh.positions));
const lips0=buildLipMeshes({mouthOpenRad:0}),lipsOpen=buildLipMeshes({mouthOpenRad:0.2});
for(const mesh of Object.values(lips0))assert(mesh.positions.length>0&&finite(mesh.positions));
const minY=m=>Math.min(...m.positions.filter((_,i)=>i%3===1));
assert(minY(lipsOpen.lower)<minY(lips0.lower));
assert(Math.abs(minY(lipsOpen.upper)-minY(lips0.upper))<1e-12);
assert.equal(buildLipBand('upper').crossSegments,34);
for(const mesh of Object.values(buildEyeMeshes()))assert(mesh.positions.length>0&&finite(mesh.positions));
for(const side of[-1,1]){
  const op=buildOperculumFlapMesh(side),edge=buildOperculumEdgeMesh(side);
  assert(op.positions.length>0&&op.indices.length>0&&finite(op.positions));
  assert(edge.positions.length>0&&edge.indices.length>0&&finite(edge.positions));
  const xs=op.positions.filter((_,i)=>i%3===0);
  assert(side<0?Math.max(...xs)<0:Math.min(...xs)>0);
}
const comm=buildCommissureMeshes({mouthOpenRad:.2});
assert(finite(comm.left.positions)&&finite(comm.right.positions));

const built=buildBlackBassHeadMouth({jaw:{mouthOpenRad:99}});
assert.equal(built.parts.lowerJaw.mouthOpenRad,BLACK_BASS_R1_CARD.jaw.safeOpenRangeRad[1]);
assert.equal(built.sourceMeshRuntimeDependency,false);
assert.equal(built.acceptance.numeric,true);
assert.equal(built.acceptance.visual,false);
assert.deepEqual(Object.keys(built.parts),[
  'cranium','operculumFlapLeft','operculumFlapRight','operculumEdgeLeft','operculumEdgeRight',
  'lowerJaw','mouthCavity','eyeLeft','eyeRight','maxillaryLeft','maxillaryRight',
  'upperLip','lowerLip','commissureLeft','commissureRight'
]);
for(const [name,mesh] of Object.entries(built.parts)){
  assert(mesh.positions.length>0,`${name}:positions`);
  assert(mesh.indices.length>0,`${name}:indices`);
  assert(finite(mesh.positions),`${name}:finite`);
}
console.log('FISH-R1-T01 black-bass head/mouth kernel v0.7: 54 assertions passed');
