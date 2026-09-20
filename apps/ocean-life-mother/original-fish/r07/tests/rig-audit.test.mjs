import assert from 'node:assert/strict';
import {auditGltfJson, scoreReferenceCandidate} from '../src/rig-audit.mjs';

const fixture = {
  nodes: [
    {name:'Armature'}, {name:'body_spine_01'}, {name:'tail_01'}, {name:'dorsal_fin'},
    {name:'anal_fin'}, {name:'pectoral_L'}, {name:'pelvic_L'}, {name:'jaw'},
    {name:'operculum_L'}, {name:'eye_L'}, {name:'cornea_L'}
  ],
  skins: [{joints:[0,1,2,3,4,5,6,7,8,9,10]}],
  meshes: [{},{},{}],
  materials: [{name:'Body'},{name:'Eye'},{name:'Cornea',alphaMode:'BLEND'}],
  accessors: [{max:[2.2]}],
  animations: [{name:'Swim',samplers:[{input:0}],channels:[
    {sampler:0,target:{node:1,path:'rotation'}},{sampler:0,target:{node:2,path:'rotation'}},
    {sampler:0,target:{node:3,path:'rotation'}},{sampler:0,target:{node:4,path:'rotation'}},
    {sampler:0,target:{node:5,path:'rotation'}},{sampler:0,target:{node:7,path:'rotation'}},
    {sampler:0,target:{node:8,path:'rotation'}}
  ]}]
};
const audit = auditGltfJson(fixture);
assert.equal(audit.uniqueJointCount, 11);
assert.equal(audit.animationCount, 1);
assert.equal(audit.channelCount, 7);
assert.equal(audit.semanticCoverage.tail, true);
assert.equal(audit.semanticCoverage.operculum, true);
assert.equal(audit.materialFlags.separateCorneaMaterial, true);
assert.equal(audit.materialFlags.alphaMaterialCount, 1);

const tuna = scoreReferenceCandidate({
  ...audit, uniqueJointCount:98, channelCount:291, animationCount:1, clipDurationSeconds:2.1667,
  semanticCoverageCount:9, typicalOriginalFish:true, marineRelevant:true,
  rightsRoute:'permissive-review', duplicateGeometryVerified:true, overSpecialized:false,
  provenanceHold:false, noRawBytes:true
});
const guppy = scoreReferenceCandidate({
  ...audit, uniqueJointCount:191, channelCount:760, animationCount:2, clipDurationSeconds:9.5,
  semanticCoverageCount:9, typicalOriginalFish:true, marineRelevant:false,
  rightsRoute:'permissive-review', duplicateGeometryVerified:false, overSpecialized:true,
  provenanceHold:false, noRawBytes:true
});
const trout = scoreReferenceCandidate({
  ...audit, uniqueJointCount:138, channelCount:0, animationCount:6, clipDurationSeconds:0,
  semanticCoverageCount:7, typicalOriginalFish:true, marineRelevant:false,
  rightsRoute:'permissive-review', duplicateGeometryVerified:false, overSpecialized:true,
  provenanceHold:false, noRawBytes:true
});
assert(guppy.rawCompletenessScore > tuna.rawCompletenessScore);
assert(trout.rawCompletenessScore > 40);
assert(tuna.baselineSuitabilityScore > guppy.baselineSuitabilityScore);
assert(tuna.baselineSuitabilityScore > trout.baselineSuitabilityScore);
console.log(JSON.stringify({tuna,guppy,trout}, null, 2));
console.log('Original Fish R07 rig audit: 12 assertions passed');
