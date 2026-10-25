import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveMeasuredCase} from './kowloon-building-mother-r01/r07/cases.mjs';
import {profileFor} from './kowloon-building-mother-r01/r07/profiles.mjs';
import {controllerFor} from './kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs';
import {deriveCaseIntegration} from './kowloon-building-mother-r01/whole-building-facade-r01/host-integration.mjs';
import {growBuilding} from './building-mother.mjs';
import {attachKccUnitDoors} from './kcc-unit-doors.mjs';
import {lowriseLevelRevision} from './lowrise-level-revision.mjs';
import {prepareBuildingLifts} from './lift-runtime.mjs';
import {composeBuildingScene} from './unified-scene.mjs';
import {intersectAperturesRay} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {buildHostApertureIndex,hostWallBounds,hostRayInterval,queryHostRay} from './host-aperture-index.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),official=read('./kowloon-building-mother-r01/r07/sources/official-footprints.json'),openingEvidence=read('./evidence/lowrise-opening-proposal.json');
const entries=['lowrise','kcc','warehouse'].map(caseId=>{
 const source=deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/'+profileFor(caseId).modelId+'.score.json')),controller=controllerFor(caseId),whole=controller.derive(source,official,caseId==='lowrise'?lowriseLevelRevision(source,official,openingEvidence).parameters:{}),integration=deriveCaseIntegration(caseId,whole,source,official,{doorOpenT:1}),lift=controller.liftVisuals(whole,controller.createLiftState(whole));
 const model=growBuilding({caseId,source,model:{...integration.model,archetypes:[...integration.model.archetypes,...lift.archetypes],instances:[...integration.model.instances,...lift.instances]},openingEvidence},caseId==='lowrise'?{dimensions:{ordinaryDoorSystem:'shared-function'}}:{}).model;
 return {caseId,source,controller,whole,model};
});
const reservedInstanceIds=entries.flatMap(e=>(e.model.hostedComponents?.apertures??[]).map(a=>a.instanceId)),ke=entries.find(e=>e.caseId==='kcc');ke.model=attachKccUnitDoors(ke.model,{reservedInstanceIds});
const scene=composeBuildingScene(prepareBuildingLifts(entries).entries),before=JSON.stringify(scene),{apertures,sourceMasks}=scene.model.hostedComponents,args={source:scene.source,apertures,sourceMasks,hostPatchIds:[...new Set(apertures.filter(a=>a.caseId==='kcc'&&a.rederiveFunction==='deriveKccRecessedWindow').map(a=>a.host.sourcePatchId))],wallDepthRange:[-.26,0]},index=buildHostApertureIndex(args),group=index.groups[0],patch=scene.source.patches[group.sourcePatchIndex];
import {analyzeHostWallCoverage,withHostWallCoverageSpecialization} from './host-wall-coverage-specialization.mjs';
import {deriveHostWallField,hostWorld} from './host-wall-field.mjs';
import {buildHostWallGLSL,HOST_WALL_MAIN} from './host-wall-gpu.mjs';
import {withHostLocalEndpointTrace} from './host-local-endpoint-trace.mjs';
import {withHostWindowRows} from './host-window-rows.mjs';
import {apertureUnionPositiveNeighbour} from './kowloon-building-mother-r01/r07/apertures.mjs';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),mul=(a,t)=>a.map(v=>v*t),functionBody=(s,name)=>{let i=s.indexOf(name+'(');assert(i>=0);const start=s.indexOf('{',i);let end=start+1,depth=1;for(;depth;end++){if(s[end]==='{')depth++;else if(s[end]==='}')depth--;}return s.slice(start,end);};
let certificates=[],wallQueries=0,fullCovered=0,fullEmpty=0,metadataFallbacks=0;const hosts=[];
for(const group of index.groups){const h=deriveHostWallField({patch:scene.source.patches[group.sourcePatchIndex],apertures,masks:sourceMasks});hosts.push(h);const started=performance.now(),cert=analyzeHostWallCoverage(h),wallMs=performance.now()-started;assert(cert.eligible,JSON.stringify(cert));certificates.push({sourcePatchId:h.sourcePatchId,windows:cert.windows,sharpParts:cert.sharpParts,supportCorners:cert.supportCorners,minimumClearance:cert.minimumClearance,minimumGuardedClearance:cert.minimumGuardedClearance,wallMs});
 const original=withHostLocalEndpointTrace(buildHostWallGLSL(h),h)+HOST_WALL_MAIN,special=withHostWallCoverageSpecialization(original,h),rows=withHostWindowRows(special);assert.notEqual(special,original);assert(rows.includes('hostSelectWindowRows('));
 for(const name of['aperturePlanInterval','apertureIntervals','apertureRectDistance','apertureOutwardCovered','hostWallCovers','apertureTraceRayFiltered','hostConvexGlassCap'])assert.equal(functionBody(special,name),functionBody(original,name),name+' must not change');
 assert.equal(functionBody(special,'hostWallSharpIntervals').replaceAll('hostWallSharpPlanInterval(','aperturePlanInterval('),functionBody(original,'apertureIntervals'),'Only the called plan specialization changes; interval operations retain exact sequence');
 assert.equal(functionBody(special,'hostWallSharpPlanInterval'),'{vec2 q=o.xy-r.xy;return apertureBox2(q,d.xy,r.zw);}');assert(functionBody(special,'hostInfillCovers').includes('if(apertureRecord(1+9*k+2).w==6.)continue;'));assert(!functionBody(special,'hostInfillCovers').includes('apertureIntervals('));assert(functionBody(original,'hostInfillCovers').includes('apertureIntervals('));assert.throws(()=>withHostWallCoverageSpecialization(special,h),/unwrapped/);
 for(const w of h.windows){const sharp={...w.infill,primitives:w.infill.primitives.filter(p=>p.part!=='glass')},compare=(q,n)=>{const point=hostWorld(h,q),normal=n[0]?mul(h.u,n[0]):n[1]?mul(h.v,n[1]):mul(h.n,n[2]),full=apertureUnionPositiveNeighbour(w.infill,point,normal,{epsilon:2e-6}),fast=apertureUnionPositiveNeighbour(sharp,point,normal,{epsilon:2e-6});assert.equal(fast,full,'Skipping glass must not change wall-boundary reverse coverage');wallQueries++;if(full)fullCovered++;else fullEmpty++;};
  for(const axis of[0,1])for(const side of[-1,1])for(const f of[0,.1,.5,.9,1])for(const z of[h.depth[0],(h.depth[0]+h.depth[1])/2,h.depth[1]]){const q=[(w.hole[0]+w.hole[2])/2,(w.hole[1]+w.hole[3])/2,z],other=1-axis;q[axis]=w.hole[axis+(side>0?2:0)];q[other]=w.hole[other]+f*(w.hole[other+2]-w.hole[other]);const n=[0,0,0];n[axis]=-side;compare(q,n);}
  for(const side of[-1,1])for(const x of[w.hole[0]-.01,w.hole[0],w.hole[2],w.hole[2]+.01])for(const y of[w.hole[1]-.01,w.hole[1],w.hole[3],w.hole[3]+.01])compare([x,y,side>0?h.depth[1]:h.depth[0]],[0,0,side]);
 }
}
assert(fullCovered>0&&fullEmpty>0);
const base=hosts[0],original=withHostLocalEndpointTrace(buildHostWallGLSL(base),base)+HOST_WALL_MAIN;
for(const mutate of[
 h=>h.windows[0].infill.primitives[0].outer.radius=.00001,
 h=>h.windows[0].infill.primitives[1].inner.radius=.00001,
 h=>h.windows[0].infill.primitives[3].outer.radius=.00001,
 h=>{const p=h.windows[0].infill.primitives[2];p.origin=p.origin.map((v,k)=>v+h.u[k]*.05)},
 h=>{const p=h.windows[0].infill.primitives[2];p.origin=p.origin.map((v,k)=>v+h.v[k]*.05)},
 h=>h.windows[0].infill.primitives[2].u=[2,0,0],
 h=>h.windows[0].hole[0]+=1,
 h=>h.windows[0].infill.primitives.pop(),
 h=>h.u=[NaN,0,0]
]){const bad=structuredClone(base);mutate(bad);assert.equal(analyzeHostWallCoverage(bad).eligible,false);assert.equal(withHostWallCoverageSpecialization(original,bad),original,'Uncertified shape must keep byte-for-byte generic coverage');metadataFallbacks++;}
const changedRadius=structuredClone(base);changedRadius.windows[0].infill.primitives[2].outer.radius=.005;assert(analyzeHostWallCoverage(changedRadius).eligible,'Glass is not made sharp; its nonzero radius is irrelevant to enclosing-support separation');
const report={passed:true,scope:'Wall reverse-coverage support proof and CPU regressions only; actual GPU/whole-image equivalence pending',sceneParts:index.primitiveCount,certificates,wallQueries,fullCovered,fullEmpty,metadataFallbacks,glassRoundedPlanUntouched:true,primaryTraceAndOrdinaryUnionUntouched:true,sharpIntervalsSameOperationOrder:true,gpuValidated:false};fs.writeFileSync(new URL('./r17-host-wall-coverage-test.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
const {withSharpHostWallCoverage,sharpHostWallCoverageContract}=await import('./host-wall-coverage-specialization.mjs');
const all=sharpHostWallCoverageContract(hosts);assert(all.eligible);assert.equal(all.hosts.length,6);assert.equal(all.variantKey,'sharp-wall-coverage-v1');assert.notEqual(withSharpHostWallCoverage(original,hosts),original);
const oneBad=hosts.map(h=>structuredClone(h));oneBad[5].windows[0].infill.primitives[0].outer.radius=.001;assert.equal(sharpHostWallCoverageContract(oneBad).eligible,false);assert.equal(sharpHostWallCoverageContract(oneBad).variantKey,'generic-wall-coverage-v1');assert.equal(withSharpHostWallCoverage(original,oneBad),original,'One invalid host must disable the shared-program specialization for all');assert.equal(withSharpHostWallCoverage(original,[]),original);report.allSharedProgramHostsValidated=true;report.sharedProgramFallbackPassed=true;fs.writeFileSync(new URL('./r17-host-wall-coverage-test.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,allSharedProgramHostsValidated:true,sharedProgramFallbackPassed:true,minimumGuardedClearance:all.minimumGuardedClearance}));
