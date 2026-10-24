/** R05 connected-case geometric candidate only. No structural capacity claim.
 * Requires the unchanged published R04 reference model and its imports.
 * Default: ../building-rule-sketch-r04/sketch-model.mjs. Override with R04_MODEL (file URL
 * or URL relative to this file). The fixed SHA prevents a moving baseline.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {growSketch} from './sketch-model.mjs';
import {ASSEMBLY_SCHEMA,queryAssemblyInside,packAssemblyDescriptors} from './kowloon-building-mother-r01/r07/assemblies.mjs';
import {validateSupportProgram} from './frame-growth.mjs';

let checks=0,generations=0;
const ok=(value,label)=>{assert(value,label);checks++;};
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const near=(a,b,label)=>ok(Math.abs(a-b)<1e-8,label);
const all=q=>q.model.archetypes.flatMap(a=>a.primitives);
const inside=(primitives,point)=>queryAssemblyInside({schema:ASSEMBLY_SCHEMA,primitives},point);
const sha=value=>createHash('sha256').update(value).digest('hex');
const baselineURL=new URL(process.env.R04_MODEL??'../building-rule-sketch-r04/sketch-model.mjs',import.meta.url);
const baselineSHA='98c7379735a53b0557569c9f361eb06b1bf25f8fbc9c5f756eecfda35df42770';
eq(sha(fs.readFileSync(baselineURL)),baselineSHA,'comparison uses fixed R04 source, not the candidate itself');
const {growSketch:baseline}=await import(baselineURL);
const overlap=(a,b)=>[0,1,2].every(k=>Math.min(a.bounds.max[k],b.bounds.max[k])-Math.max(a.bounds.min[k],b.bounds.min[k])>1e-8);
const fitsColumn=(beam,column)=>Math.abs((beam.bounds.min[2]+beam.bounds.max[2]-column.bounds.min[2]-column.bounds.max[2])/2)<1e-8&&beam.bounds.min[2]>=column.bounds.min[2]-1e-8&&beam.bounds.max[2]<=column.bounds.max[2]+1e-8;
const coverage=(landing,beam)=>Math.min(landing.bounds.max[2],beam.bounds.max[2])-Math.max(landing.bounds.min[2],beam.bounds.min[2]);
const immutablePrimitive=p=>Object.fromEntries(Object.entries(p).filter(([key])=>!['loops','bounds','planes'].includes(key)));

function compare(args){
 const old=baseline(args),q=growSketch(args),A=all(old),P=all(q),byId=id=>P.find(p=>p.nodeId===id),oldById=id=>A.find(p=>p.nodeId===id),connected=q.parameters.caseId==='connected';generations++;
 ok(q.checks.passed,'candidate passes every existing generator check');
 eq(q.checks.platformJunctionScope,'connected_case_only','scope is explicit');
 eq(q.checks.centeredPlatformJunctionApplicable,connected,'legacy cases are not claimed as fixed');
 eq(q.checks.centeredPlatformJunction,connected?true:null,'not-applicable is distinct from a successful centered check');
 eq(q.checks.platformJunctionCapacityVerified,false,'no capacity or safe-bearing certification');
 ok(validateSupportProgram(q.supportProgram).passed,'support DAG remains valid');
 eq(P.length,A.length,'no invented patch, bracket or extra member');
 eq(q.levels,old.levels,'floor elevations unchanged');
 eq(q.grid,old.grid,'column grid unchanged');
 eq(q.portals,old.portals,'all opening definitions and door states unchanged');
 eq(q.routes,old.routes,'all stair, room, entry and lift route coordinates unchanged');
 eq(q.graph.edges,old.graph.edges,'ownership and dependency topology unchanged');
 eq(q.counts,old.counts,'component and room counts unchanged');
 eq(q.source,old.source,'measured-source placeholder and bounds unchanged');
 const allowed=new Set(connected?q.stair.connections.flatMap(c=>[c.landingId,c.landingSupport.beamId]):[]);
 for(const p of P){const before=oldById(p.nodeId);ok(!!before,'every candidate primitive already existed in R04');if(!allowed.has(p.nodeId))eq(p,before,'unrelated primitive remains byte-equivalent: '+p.nodeId);else eq(immutablePrimitive(p),immutablePrimitive(before),'changed member retains section height, identity, material and ownership');}
 if(q.stair){eq(q.stair.flights,old.stair.flights,'waists and treads unchanged');eq(q.stair.handrails,old.stair.handrails,'continuous handrail geometry, posts and joints unchanged');}
 if(!connected){eq(P,A,'single-cell and single-bay complete geometry remains unchanged');eq(q.stair,old.stair,'legacy stair and support metadata unchanged');return q;}
 for(const c of q.stair.connections){
  const oldC=old.stair.connections.find(s=>s.id===c.id);
  eq(c.handrailCirculationProof,oldC.handrailCirculationProof,'continuous turn-envelope proof unchanged');
  eq(c.upperHole,oldC.upperHole,'accepted upper slab hole unchanged');
  eq(c.landingSupport.junction.scope,'connected_case_only','junction owns a bounded case scope');
  eq(c.landingSupport.junction.coverageMeaning,'geometric_overlap_only_not_safe_bearing_length','0.125 m cannot be mistaken for a safe bearing value');
  eq(c.landingSupport.junction.capacityVerified,false,'capacity remains unverified');
  if(q.parameters.stage<6)continue;
  const landing=byId(c.landingId),beam=byId(c.landingSupport.beamId),beforeLanding=oldById(c.landingId),beforeBeam=oldById(c.landingSupport.beamId),wall=byId(c.landingRearContact.wallId),top=c.baseElevation+c.height/2;
  near((beam.bounds.min[2]+beam.bounds.max[2])/2,5,'platform beam is centered on the rear column grid');
  eq([beam.bounds.min[0],beam.bounds.max[0]],[0,4],'beam still spans to both existing column centers');
  eq([beam.bounds.min[2],beam.bounds.max[2]],[4.875,5.125],'beam width remains 0.25 m, with no arbitrary thickening');
  near(beam.bounds.max[1]-beam.bounds.min[1],.32,'beam depth remains 0.32 m');
  eq(beam.range,beforeBeam.range,'beam vertical position remains exactly unchanged');
  eq(landing.range,beforeLanding.range,'platform vertical position and thickness remain exactly unchanged');
  near(landing.bounds.max[1],top,'platform top equals its half-storey datum');
  near(landing.bounds.min[1],top-.16,'platform underside remains 0.16 m below top');
  near(beam.bounds.max[1],landing.bounds.min[1],'platform underside and beam top share one exact plane');
  eq(landing.bounds.max[2],5,'structural platform end stops at column axis, not beam outer face');
  near(coverage(landing,beam),.125,'platform has 0.125 m of geometric beam coverage');
  near(c.landingSupport.junction.platformEmbedDepth,.06,'platform embeds 0.06 m beyond wall inner face');
  eq(c.landingRearContact.visibleContactPlane,4.94,'visible wall contact remains at 4.94');
  eq(c.landingRearContact.structuralEndPlane,5,'structural embed endpoint is separately identified');
  eq(c.landingRearContact.wallOuterPlane,5.06,'wall outside face is retained');
  ok(landing.bounds.max[2]<c.landingRearContact.wallOuterPlane,'no new platform ledge emerges through the outside wall');
  near(beam.bounds.max[2]-c.landingRearContact.wallOuterPlane,.065,'frame beam face projection is disclosed, not confused with platform projection');
  near(c.landingSupport.exposedBeam.right,1.35,'right exposed beam remains the route to its column');
  near(c.landingSupport.exposedBeam.rightClearToColumnFace,1.21,'clear exposed length to column inner face is explicit');
  for(const id of c.landingSupport.columnIds){const column=byId(id),oldColumn=oldById(id);ok(fitsColumn(beam,column),'beam axis and full width projection fit the actual column');ok(overlap(beam,column),'beam has real positive-volume intersection with its column');ok(overlap(beforeBeam,oldColumn)&&!fitsColumn(beforeBeam,oldColumn),'reject old eccentric node even though its AABBs overlap');near((oldColumn.bounds.min[2]+oldColumn.bounds.max[2]-beforeBeam.bounds.min[2]-beforeBeam.bounds.max[2])/2,.185,'old eccentricity is exactly 0.185 m');near(Math.min(beforeBeam.bounds.max[2],oldColumn.bounds.max[2])-Math.max(beforeBeam.bounds.min[2],oldColumn.bounds.min[2]),.08,'old 0.08 m sliver overlap is not accepted as centered support');}
  const unembedded={...landing,bounds:{min:landing.bounds.min,max:[landing.bounds.max[0],landing.bounds.max[1],4.94]}};
  near(coverage(unembedded,beam),.065,'moving only the beam would leave only 0.065 m coverage');ok(Math.abs(coverage(unembedded,beam)-.125)>1e-8,'reject beam-only move that omits the platform embed');
  for(const x of[.65,1.6,2.45]){const y=landing.bounds.min[1],z=4.9375;ok(inside([beam],[x,y-.001,z])&&inside([landing],[x,y+.001,z]),'geometric platform/beam contact has material on both sides');if(wall)ok(inside([landing],[x,top-.08,4.939])&&inside([wall],[x,top-.08,4.941]),'visible contact is retained rather than dropping the old wall-joint check');}
 }
 if(q.parameters.stage===7){
  for(const portal of q.portals.filter(p=>p.openingType==='window'))for(const u of[.1,.3,.5,.7,.9])for(const v of[.1,.3,.5,.7,.9])for(const depth of[-.045,0,.045]){const point=portal.origin.map((x,k)=>x+portal.u[k]*(portal.lo+u*portal.width)+portal.v[k]*(portal.sill+v*portal.height)+portal.w[k]*depth);ok(!inside(P,point),'connected-case entire window void remains clear of the new beam and embedded platform');}
  const walkable=P.filter(p=>['floor','stair','elevator'].includes(p.semanticClass));
  for(const route of q.routes.filter(r=>r.type==='stair'))for(let k=1;k<route.waypoints.length;k++){const a=route.waypoints[k-1],b=route.waypoints[k];if(Math.abs(a[1]-b[1])>1e-8)continue;for(const t of[.2,.5,.8]){const point=a.map((x,j)=>x+(b[j]-x)*t);ok(inside(walkable,[point[0],point[1]-.025,point[2]]),'unchanged stair route retains real underfoot support');for(const h of[.05,.9,1.95])ok(!inside(P,[point[0],point[1]+h,point[2]]),'platform-node change creates no route obstruction');}}
 }
 for(const a of q.model.archetypes)ok(packAssemblyDescriptors(a).data.every(Number.isFinite),'candidate packs finite analytic descriptors');
 return q;
}

for(let storeys=2;storeys<=8;storeys++)for(const [groundHeight,typicalHeight]of[[3.6,3],[4,3.4],[2.6,2.6],[5,5]])compare({caseId:'connected',storeys,groundHeight,typicalHeight,liftLevel:storeys-1,liftOpen:1});
for(const storeys of[2,4,8])for(let stage=1;stage<=7;stage++)compare({caseId:'connected',storeys,stage});
for(let storeys=2;storeys<=8;storeys++)compare({caseId:'vertical',storeys});
for(let stage=1;stage<=7;stage++)compare({caseId:'cell',stage});
compare({caseId:'connected',storeys:4,windowSill:0,windowWidth:1.8});
compare({caseId:'connected',storeys:4,liftAttached:false,roofVisible:false});
const initial=JSON.stringify(growSketch({storeys:4}));growSketch({storeys:8,groundHeight:4,typicalHeight:3.4});eq(JSON.stringify(growSketch({storeys:4})),initial,'height/storey edits roll back deterministically');
eq(sha(fs.readFileSync(baselineURL)),baselineSHA,'fixed R04 source remains unmodified');
console.log(JSON.stringify({passed:true,checks,generations,scope:'connected_case_only',storeys:[2,3,4,5,6,7,8],platformBeamAxisZ:5,beamProjection:[4.875,5.125],columnProjection:[4.86,5.14],platformStructuralEndZ:5,visibleWallContactZ:4.94,platformBeamCoverage:.125,platformEmbedDepth:.06,platformOutsideWall:false,exposedBeamPreserved:true,legacySingleBayUnchanged:true,acceptedSlabsWindowsRailsRoutesUnchanged:true,oldEccentricCounterexampleRejected:true,capacityVerified:false,baselineSHA},null,2));
