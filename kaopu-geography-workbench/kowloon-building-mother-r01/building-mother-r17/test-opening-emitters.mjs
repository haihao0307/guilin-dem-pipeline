import {buildCandidateStructure as buildRetainedCandidate} from '../building-mother-r11/kcc-candidate-structure.mjs';
import {integrateCompleteFloorSystem as integrateRetainedFloor} from '../building-mother-r11/complete-floor-system.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildCandidateStructure,INSPECTION_ASSUMPTIONS} from './kcc-candidate-structure.mjs';
import {integrateCompleteFloorSystem} from './complete-floor-system.mjs';
import {validateOpeningOwnership} from './opening-ownership.mjs';
import {deriveMeasuredCase} from './kowloon-building-mother-r01/r07/cases.mjs';
import {profileFor} from './kowloon-building-mother-r01/r07/profiles.mjs';
import {controllerFor} from './kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs';
import {deriveCaseIntegration} from './kowloon-building-mother-r01/whole-building-facade-r01/host-integration.mjs';
import {lowriseLevelRevision} from './lowrise-level-revision.mjs';
// Frozen geometry/old runtime identities captured immediately before ownership integration.
const BASELINE = {
  "capturedAt": "2026-10-24T01:20:04.991Z",
  "lowrise": "d2d76411d1b4f9ef62fccf194d55c68535698210bfce9055e6e92852f870a117",
  "candidates": {
    "5:plan-local": "d57509908bc19a943628d67889579a5e671cdc0a2618680a6464ff7dd2b0de46",
    "5:R0": "347a9853c7e76da1f8b3c178a1485899e59d268b8b0401bb08a6bdb3f7a6c856",
    "5:R180": "854769bbf6de894486bf90aba7c5065945856bd96c66716bb7bf790bfd177312",
    "6:plan-local": "9e4d25a03168c7d6edec26aea6422d7d8d882ff62f4d510c5c329092ea1484e7",
    "6:R0": "58e4f670c18cfddd8bc21873ece368e87cdc57bda5992f3eb550cc729c281b06",
    "6:R180": "fdd9c55b1dfc2fd5775e43f3be4190b956fcfabc203d40727402b1a7f0a92cf4",
    "17:plan-local": "481b91312b05ee6ea8ebe405eb94577e704c8bbb06c8a2c2643697fc9e5fb914",
    "17:R0": "8ce3b2e11ca4f0c27435933792a4a38d03455daa4af8f3ec30d9fe46d44177ef",
    "17:R180": "2bc4ccef3de72f0afc5545288e2040844051b557b5e781e541bd07ba159bc8ca",
    "18:plan-local": "9f2553e04c61c32f1339f6c4a48d0b93116642baced19b2e3d990f75f599e6fb",
    "18:R0": "3b1d8ccd0f1e8a6d9d220b03552af1d568f4ba84029ff8c57e118307817e048f",
    "18:R180": "306e792c39922cd9b20a3389ac2dc143ef0ed61b73bfc164548620fdb92fe493",
    "26:plan-local": "d76f8ae2320157377b2ad1ff08d9fd09db2d8caee093e0773d082acf25fc2538",
    "26:R0": "33cf047fe3e785eff0c48d20c0fce20562a15cb59095d69b97b5c0a136d142d5",
    "26:R180": "43f7b2c494619191f54966526e4205d25a576743d166247d0179782d138317d2"
  }
};
const digest=model=>createHash('sha256').update(JSON.stringify({archetypes:model.archetypes,instances:model.instances,apertures:model.hostedComponents?.apertures??[]},(key,value)=>key==='semanticPartNodeId'?undefined:value)).digest('hex');
let checks=0;
const ok=(condition,message)=>{assert(condition,message);checks++;};
function graphChecks(model){
 const ids=new Set(model.graph.nodes.map(n=>n.id));
 ok(ids.size===model.graph.nodes.length,'No duplicate semantic/runtime identity');
 ok(model.graph.edges.every(e=>ids.has(e.from)&&ids.has(e.to)),'Graph endpoints close');
 ok(model.openingOwnership.validation.passed&&validateOpeningOwnership(model.graph,model.openingOwnership.chains).passed,'Full emitted ownership validates');
}
const candidateCounts={};
for(const floor of[5,6,17,18,26])for(const rotationCandidate of['plan-local','R0','R180']){
 const q=buildCandidateStructure({actualFloor:floor,assumptions:INSPECTION_ASSUMPTIONS,doorOpen:1,liftOpen:[1,1,1],rotationCandidate}),model=q.model;
 ok(digest(buildRetainedCandidate({actualFloor:floor,assumptions:INSPECTION_ASSUMPTIONS,doorOpen:1,liftOpen:[1,1,1],rotationCandidate}).model)===BASELINE.candidates[floor+':'+rotationCandidate],'Retained R11 golden geometry remains unchanged; R12 permitted spatial changes checked separately');
 graphChecks(model);
 const primitives=model.archetypes.flatMap(a=>a.primitives),nodes=new Map(model.graph.nodes.map(n=>[n.id,n]));
 ok(model.openingOwnership.chains.length===q.portals.length+(q.observedWindows?.length??0),'Only real emitted portals create ownership chains');
 for(const chain of model.openingOwnership.chains){
  const host=nodes.get(chain.wallId),primitive=primitives.find(p=>p.nodeId===chain.wallId);
  ok(host.hostRole==='wall'&&host.type===primitive.semanticClass,'Host keeps old UI category, explicit wall role');
  ok(chain.infillId.startsWith('lift:')?chain.parts.length>0&&chain.parts.every(p=>p.type==='leaf'):chain.infillType==='window'?chain.parts.every(p=>p.type==='frame'):chain.parts.length===0,'Only lift leaves or explicit window interface frames; ordinary door leaves deferred');
  for(const part of chain.parts){const p=primitives.find(p=>p.nodeId===part.id)??model.hostedComponents?.apertures.flatMap(a=>a.primitives).find(p=>p.semanticPartNodeId===part.id);ok(p&&p.semanticPartNodeId===part.id&&p.objectId===part.objectId,'Candidate semantic binding preserves runtime primitive identity');ok(chain.infillType==='window'?nodes.get(part.id).type==='frame':nodes.get(part.id).type===p.semanticClass,'Existing leaf / explicit frame UI type retained');}
 }
 candidateCounts[floor+':'+rotationCandidate]=model.openingOwnership.chains.length;
}
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const official=read('./kowloon-building-mother-r01/r07/sources/official-footprints.json'),openingEvidence=read('./evidence/lowrise-opening-proposal.json'),caseId='lowrise',profile=profileFor(caseId),source=deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/'+profile.modelId+'.score.json')),controller=controllerFor(caseId),whole=controller.derive(source,official,lowriseLevelRevision(source,official,openingEvidence).parameters),integration=deriveCaseIntegration(caseId,whole,source,official,{doorOpenT:1}),lift=controller.liftVisuals(whole,controller.createLiftState(whole)),seed={...integration.model,archetypes:[...integration.model.archetypes,...lift.archetypes],instances:[...integration.model.instances,...lift.instances]},model=integrateCompleteFloorSystem(seed,source,{openingEvidence});
ok(digest(integrateRetainedFloor(seed,source,{openingEvidence}))===BASELINE.lowrise,'Retained R11 lowrise golden unchanged; R12 room-boundary correction tested separately');
graphChecks(model);
const chains=model.openingOwnership.chains,nodes=new Map(model.graph.nodes.map(n=>[n.id,n]));
ok(chains.filter(c=>c.infillType==='door').length===15&&chains.filter(c=>c.infillType==='window').length===7,'14 room interfaces plus entry; 3 north windows plus 4 east glazed-group interfaces attached');
for(const chain of chains){
 const aperture=model.hostedComponents.apertures.find(a=>a.host.nodeId===chain.infillId);
 ok(aperture&&aperture.primitives.every(p=>p.nodeId===chain.infillId),'Aperture primitive.nodeId and host.nodeId remain infill runtime ID');
 ok(chain.parts.length===aperture.primitives.filter(p=>['frame','leaf','glass'].includes(p.part)).length,'No invented aperture parts');
 for(const part of chain.parts){const p=aperture.primitives.find(p=>p.semanticPartNodeId===part.id);ok(p&&p.part===part.type&&p.objectId===part.objectId,'Semantic part binds actual generated field');}
 if(chain.infillType==='window'){
  const host=nodes.get(chain.wallId),original=seed.graph.nodes.find(n=>n.id===chain.wallId),infill=nodes.get(chain.infillId);
  ok(host.sourcePatchId===aperture.host.sourcePatchId&&host.evidence===original.evidence&&host.type===original.type,'Source patch host evidence and type not upgraded');
  ok(infill.designFloorBindingOnly===true&&infill.realFloorAssignment===null,'Window design-floor assignment remains unverified');
 }
}
console.log(JSON.stringify({passed:true,checks,retainedR11GoldenUnchanged:true,r12GeometryChangesVerifiedSeparately:true,lowriseChains:chains.length,lowriseRealParts:chains.reduce((sum,c)=>sum+c.parts.length,0),candidateCounts,sourceEvidenceUpgraded:false},null,2));
