import assert from'node:assert/strict';
import fs from'node:fs';
import{buildCandidateStructure,INSPECTION_ASSUMPTIONS}from'./kcc-candidate-structure.mjs';
import{queryAssemblyInside,ASSEMBLY_SCHEMA,intersectAssemblyRay}from'./kowloon-building-mother-r01/r07/assemblies.mjs';
import{buildRegistry}from'./kowloon-building-mother-r01/whole-building-facade-r01/semantic-registry.mjs';
let checks=0;function ok(x,m){assert(x,m);checks++;}
for(const floor of[5,6,17,18,26])for(const rotationCandidate of['plan-local','R0','R180']){
 const q=buildCandidateStructure({actualFloor:floor,assumptions:INSPECTION_ASSUMPTIONS,doorOpen:1,liftOpen:[1,1,1],rotationCandidate}),primitives=q.model.archetypes.flatMap(a=>a.primitives);
 ok(!q.claims.registered&&!q.claims.actualHeights&&!q.claims.actualThickness,'candidate flags');ok(q.model.levels.length===1,'one actual labelled floor not new building');ok(q.model.levels[0].actualElevation===null,'no invented FFL');ok(primitives.filter(p=>p.nodeId.startsWith('lift:')&&p.nodeId.endsWith(':cabin-floor')).length===3,'three independent cabins');ok(new Set(primitives.map(p=>p.objectId)).size===primitives.length,'unique field IDs');ok(primitives.every(p=>p.kind==='finite_polygon_prism'),'analytic finite fields');
 for(const portal of q.portals){const p=primitives.find(p=>p.nodeId===portal.id),at=[0,1,2].map(k=>portal.origin[k]+portal.u[k]*(portal.lo+portal.hi)/2+portal.v[k]);ok(!queryAssemblyInside({schema:ASSEMBLY_SCHEMA,primitives:[p]},at),'real wall void');const above=at.map((v,k)=>v+portal.v[k]*(q.assumptions.doorHeight+.1-1));ok(queryAssemblyInside({schema:ASSEMBLY_SCHEMA,primitives:[p]},above),'lintel retained');}
 const registry=buildRegistry(q.model,{sourceModelId:q.model.sourceModelId,patches:[]});ok(new Set(registry.map(r=>r.objectId)).size===registry.length,'registered identity unique');ok(registry.filter(r=>r.classKey==='elevator').length>3,'lift classified');ok(registry.some(r=>r.classKey==='door'),'doors classified');
}
assert.throws(()=>buildCandidateStructure({actualFloor:5}),/Explicit/);assert.throws(()=>buildCandidateStructure({actualFloor:4,assumptions:INSPECTION_ASSUMPTIONS}),/Unsupported/);
const q=buildCandidateStructure({actualFloor:5,assumptions:INSPECTION_ASSUMPTIONS});const hit=q.model.archetypes.map(a=>intersectAssemblyRay(a,[0,20,0],[0,-1,0])).filter(h=>h.hit);ok(hit.length>0,'analytic rays can hit candidate');
fs.writeFileSync(new URL('./candidate-structure-test-results.json',import.meta.url),JSON.stringify({passed:true,checks,browserRender:'not_run',actualRegistration:false,sourceModelChanged:false},null,2));console.log({passed:true,checks});
