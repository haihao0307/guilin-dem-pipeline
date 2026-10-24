/** R12 focused physical counterexamples plus strict R11 delta guards.
 * Run with the retained ../building-mother-r11 sibling present.
 * The exhaustive sampled sweep is audit-space-r12/audit.py; neither is code or
 * fire certification, nor a survey of actual room uses, clearances or hinges.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCandidateStructure as beforeCandidate} from '../building-mother-r11/kcc-candidate-structure.mjs';
import {buildCandidateStructure,INSPECTION_ASSUMPTIONS} from './kcc-candidate-structure.mjs';
import {growBuilding} from './building-mother.mjs';
import {growBuilding as beforeGrowth} from '../building-mother-r11/building-mother.mjs';
import {queryCompleteSolid} from './complete-floor-system.mjs';
import {deriveMeasuredCase} from './kowloon-building-mother-r01/r07/cases.mjs';
import {profileFor} from './kowloon-building-mother-r01/r07/profiles.mjs';
import {controllerFor} from './kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs';
import {deriveCaseIntegration} from './kowloon-building-mother-r01/whole-building-facade-r01/host-integration.mjs';
import {lowriseLevelRevision} from './lowrise-level-revision.mjs';
import {queryAssemblyInside} from './kowloon-building-mother-r01/r07/assemblies.mjs';
let checks=0;const ok=(x,m)=>{assert(x,m);checks++;},equal=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const fields=m=>m.archetypes.flatMap(a=>a.primitives),inside=(m,p)=>m.archetypes.some(a=>queryAssemblyInside(a,p));
const allowedLeaves=new Set(['unit:A:internal:bedrooms-divider:leaf','unit:A:internal:bath-upper-door-host:leaf']);
for(const floor of [5,6,17,18,26])for(const rotationCandidate of ['plan-local','R0','R180']){
 const args={actualFloor:floor,assumptions:INSPECTION_ASSUMPTIONS,doorOpen:1,liftOpen:[1,1,1],rotationCandidate},old=beforeCandidate(args),now=buildCandidateStructure(args),P=fields(now.model),Q=fields(old.model),expected=floor<18?['B','C','E','F']:['E','F'];
 equal(now.layout,old.layout,'Every observed polygon, door point and actual floor label is unchanged');equal(now.portals,old.portals,'All original openings remain in their exact hosts');
 equal(now.doorThresholds.map(t=>t.unit),expected,'Only the reviewed existing door gaps receive thresholds');
 for(const q of Q){const p=P.find(p=>p.nodeId===q.nodeId);if(!p){ok(q.nodeId.endsWith(':leaf')&&!q.nodeId.startsWith('lift:'),'Only deferred ordinary door leaf removed');continue;}equal(p.objectId,q.objectId,'Old runtime object identity retained');if(!allowedLeaves.has(q.nodeId)&&!(now.observedWindows??[]).some(w=>w.wallId===q.nodeId))equal(p,q,'No unlisted geometry delta at '+q.nodeId);else if(allowedLeaves.has(q.nodeId)){equal([p.loops,p.range,p.semanticPartNodeId],[q.loops,q.range,q.semanticPartNodeId],'Only authored hinge pose changes; width/height/thickness/identity preserved');}}
 equal(P.filter(p=>!Q.some(q=>q.nodeId===p.nodeId)).map(p=>p.nodeId),expected.map(u=>'floor:door-threshold:'+u),'No unrelated new geometry');
 equal(now.model.levels,old.model.levels,'No invented storeys or actual elevation');
 ok(now.model.openingOwnership.validation.passed,'New geometry retains host/void/fill ownership');
 if(rotationCandidate==='plan-local')for(const t of now.doorThresholds){const p=t.doorPoint.map((v,k)=>(v+t.corePoint[k])/2),xz=[(p[0]-680)*INSPECTION_ASSUMPTIONS.metresPerViewPixel,(p[1]-515)*INSPECTION_ASSUMPTIONS.metresPerViewPixel];ok(!inside(old.model,[xz[0],-.015,xz[1]]),'The former support gap is a real analytic empty region');ok(inside(now.model,[xz[0],-.015,xz[1]]),'Door threshold closes that gap, not only a graph edge');}
 if(floor===6)ok(now.unresolvedSpaces.platformAccess.length===2&&now.unresolvedSpaces.platformAccess.every(p=>p.accessKnown===false),'Two platform access unknowns are retained, not hidden by new openings');
}
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),official=read('./kowloon-building-mother-r01/r07/sources/official-footprints.json'),openingEvidence=read('./evidence/lowrise-opening-proposal.json'),caseId='lowrise',profile=profileFor(caseId),source=deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/'+profile.modelId+'.score.json')),controller=controllerFor(caseId),whole=controller.derive(source,official,lowriseLevelRevision(source,official,openingEvidence).parameters),seed={caseId,source,model:deriveCaseIntegration(caseId,whole,source,official,{doorOpenT:1}).model,openingEvidence},old=beforeGrowth(seed).model,now=growBuilding(seed).model;
equal(now.levels,old.levels,'Exact actual/retained level records unchanged');equal(now.completeFloorSystem.mother.outline,old.completeFloorSystem.mother.outline,'Original outline unchanged');equal(now.completeFloorSystem.mother.core,old.completeFloorSystem.mother.core,'Stair core and hole unchanged');
for(const i of seed.model.instances)equal(now.instances.find(q=>q.id===i.id),old.instances.find(q=>q.id===i.id),'All retained seed instances unchanged');
for(const a of seed.model.archetypes)equal(now.archetypes.find(q=>q.id===a.id),old.archetypes.find(q=>q.id===a.id),'All retained seed archetypes unchanged');
ok(Math.abs(now.completeFloorSystem.mother.coverageAreaM2-old.completeFloorSystem.mother.coverageAreaM2)<1e-8,'Repartition adds no area');
const geometric=p=>Object.fromEntries(['kind','origin','u','v','w','loops','range','bounds','part','outer','inner','halfDepth'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));
function near(a,b,path=''){if(typeof a==='number'&&typeof b==='number'){assert(Math.abs(a-b)<1e-9,path);return;}if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.deepEqual(a,b,path);return;}assert.deepEqual(Object.keys(a),Object.keys(b),path);for(const k of Object.keys(a))near(a[k],b[k],path+'.'+k);}
for(const a of old.hostedComponents.apertures){const b=now.hostedComponents.apertures.find(x=>x.instanceId===a.instanceId);ok(b,'Old aperture retained');a.primitives.forEach(p=>{const q=b.primitives.find(q=>q.part===p.part&&q.objectId===p.objectId);if(!q){ok(a.kind==='door'&&p.part==='leaf'&&b.doorSystemDeferred,'Only deferred ordinary leaf absent');return;}near(geometric(p),geometric(q),a.host.nodeId);});checks++;}
for(const p of fields(old).filter(p=>p.nodeId.startsWith('complete-column:')||p.nodeId.startsWith('complete-beam:'))){const candidates=fields(now).filter(q=>q.nodeId===p.nodeId);ok(candidates.some(q=>JSON.stringify(geometric(q))===JSON.stringify(geometric(p))),'All physical column/beam geometry unchanged');}
const paths=[[[4.1,1.8],[4.1,-1.65]],[[-3.1,-.6],[-1.65,-.6],[-1.65,-1.9]],[[-3.1,-6.3],[-2.15,-6.3],[-2.15,-6.4]]];let bodySamples=0;
for(const level of now.levels){const y=level.elevation;ok(queryCompleteSolid(old,[4.1,y+1,-1.2]).inside&&!queryCompleteSolid(now,[4.1,y+1,-1.2]).inside,'The actual sealed south wall of the detached lobe is removed by adjacent-room reassignment');
 for(const path of paths)for(let k=1;k<path.length;k++){const a=path[k-1],b=path[k],N=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.04);for(let j=0;j<=N;j++){const x=a[0]+(b[0]-a[0])*j/N,z=a[1]+(b[1]-a[1])*j/N;ok(queryCompleteSolid(now,[x,y-.015,z],{includeApertures:false}).inside,'Continuous route support');for(const [dx,dz]of[[0,0],...Array.from({length:16},(_,i)=>[.25*Math.cos(i*Math.PI/8),.25*Math.sin(i*Math.PI/8)])])for(const h of[.1,.3,1,1.85]){ok(!queryCompleteSolid(now,[x+dx,y+h,z+dz]).inside,'Previously missed pocket has standing-body access '+JSON.stringify({p:[x+dx,y+h,z+dz],path,hit:queryCompleteSolid(now,[x+dx,y+h,z+dz])}));bodySamples++;}}}}
console.log(JSON.stringify({passed:true,checks,bodySamples,allowedKccChangedLeaves:[...allowedLeaves],newThresholdsOnly:true,retainedSourceAndLevelsUnchanged:true,wholeFloorSamplingReport:'audit-space-r12/reachability-report.json',unknowns:['6F platform access','rear-lift recess use and standing access','actual stair interlock'],safetyCertification:false},null,2));
