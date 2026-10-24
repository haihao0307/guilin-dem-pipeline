/** R06 is a separate inspection-color + hosted-window demonstration, not design certification. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {growSketch} from './sketch-model.mjs';
import {growSketch as growR05} from '../building-rule-sketch-r05/sketch-model.mjs';
import {buildRegistry,packRegistry,CLASSES,HANDRAIL_PART_ROLES} from './kowloon-building-mother-r01/whole-building-facade-r01/semantic-registry.mjs';
import {ASSEMBLY_SCHEMA,queryAssemblyInside,packAssemblyDescriptors} from './kowloon-building-mother-r01/r07/assemblies.mjs';

const root=path.dirname(fileURLToPath(import.meta.url)),base=path.resolve(root,'../building-rule-sketch-r05');
let assertions=0,generations=0,defaultSummary=null,minimumBeamClearance=Infinity;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);assertions++;};
const ok=(x,label)=>{assert.ok(x,label);assertions++;};
const near=(a,b,label)=>ok(Math.abs(a-b)<1e-8,label);
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const baselineFiles=JSON.parse(fs.readFileSync(path.join(base,'MANIFEST.json'))).files.map(f=>f.path);
const originalHashes=new Map(baselineFiles.map(p=>[p,sha(path.join(base,p))]));
eq(originalHashes.get('sketch-model.mjs'),'6a82a95e3c32b1bab473fe6d45cba4790280ac012bfe5f4adbb9768fa36d223a','fixed accepted R05 model');
const all=q=>q.model.archetypes.flatMap(a=>a.primitives);
const inside=(ps,p)=>queryAssemblyInside({schema:ASSEMBLY_SCHEMA,primitives:ps},p);
const overlaps=(a,b)=>[0,1,2].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>1e-8);
const stripGeometry=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['loops','planes'].includes(k)));
const options=[];
for(const caseId of ['connected','vertical'])for(let storeys=2;storeys<=8;storeys++)for(const [groundHeight,typicalHeight] of [[3.6,3],[2.6,2.6],[5,5]])options.push({caseId,storeys,groundHeight,typicalHeight,roofVisible:false});
for(let stage=1;stage<=7;stage++)options.push({caseId:'connected',storeys:4,stage},{caseId:'cell',stage});
options.push({caseId:'connected',storeys:4,windowSill:0,windowWidth:1.8},{caseId:'connected',storeys:4,liftAttached:false},{caseId:'connected',storeys:4,liftLevel:3,liftOpen:1});
const floors=Array.from({length:4},(_,i)=>'teaching-sketch:connected:L'+i);
options.push({caseId:'connected',storeys:4,liftRuntime:{y:4.8,current:floors[1],carDoor:0,landingDoors:Object.fromEntries(floors.map(id=>[id,0])),motion:true,state:'moving'}});

for(const args of options){
 const before=growR05(args),q=growSketch(args),P=all(q),A=all(before),oldById=new Map(A.map(p=>[p.nodeId,p]));generations++;
 const oldPortalIds=new Set(before.portals.map(p=>p.id)),added=q.portals.filter(p=>!oldPortalIds.has(p.id)),addedIds=new Set(added.map(p=>p.id)),hostIds=new Set(added.map(p=>p.hostId));
 eq(added.length,args.caseId==='connected'?q.levels.length:0,'one added window per connected floor, none in old prototypes');
 eq(new Set(q.portals.map(p=>p.id)).size,q.portals.length,'all old/new opening IDs distinct');
 eq(q.counts.windows,before.counts.windows+added.length,'exact added window count');
 eq(q.counts.totalPrimitives,before.counts.totalPrimitives,'window is a void in existing wall, no extra member');
 eq(q.checks,before.checks,'all existing geometric and support checks retained');
 ok(q.checks.passed,'original model checks pass');
 eq(q.routes,before.routes,'all stair, entry, room and lift paths unchanged');
 eq(q.stair,before.stair,'whole accepted stair, rails, landing and platform-support configuration unchanged');
 eq(q.portals.filter(p=>oldPortalIds.has(p.id)),before.portals,'all existing windows and doors retain their exact definitions');
 eq(q.graph.edges.filter(e=>['supportedBy','dependsOn'].includes(e.type)),before.graph.edges.filter(e=>['supportedBy','dependsOn'].includes(e.type)),'no support path is cut or reparented');
 const normalized=structuredClone(q),N=all(normalized);
 for(const p of N){
  const old=oldById.get(p.nodeId);
  ok(!!old,'no new physical geometry IDs');
  if(p.semanticClass==='handrail'){
   const n=q.graph.nodes.find(n=>n.id===p.nodeId);eq(p.partRole,n.partRole,'explicit rail metadata agrees with original construction role');ok(HANDRAIL_PART_ROLES.includes(p.partRole),'recognized rail role');
   p.semanticClass='stair';delete p.partRole;
  }
  if(hostIds.has(p.nodeId)){
   eq(stripGeometry(p),stripGeometry(old),'side-wall bounds/frame/thickness/ID/material remain exact');
   eq(p.loops[0],old.loops[0],'original wall outer contour retained');
   eq(p.loops.length,2,'one enclosed window loop, not a wall replacement');
   p.loops=structuredClone(old.loops);p.planes=structuredClone(old.planes);
  }
  eq(p,old,'all geometry except the named window loops exactly unchanged');
  if(!hostIds.has(p.nodeId))eq(packAssemblyDescriptors({schema:ASSEMBLY_SCHEMA,primitives:[p]}),packAssemblyDescriptors({schema:ASSEMBLY_SCHEMA,primitives:[old]}),'unchanged analytic GPU geometry descriptor');
 }
 // Normalize only the explicitly allowed delta, then compare the ENTIRE result.
 normalized.graph.nodes=normalized.graph.nodes.filter(n=>!addedIds.has(n.id));
 for(const n of normalized.graph.nodes)if(hostIds.has(n.id))delete n.hostRole;
 normalized.graph.edges=normalized.graph.edges.filter(e=>!addedIds.has(e.from));
 normalized.supportProgram.nodes=normalized.graph.nodes;normalized.supportProgram.edges=normalized.graph.edges;
 normalized.supportProgram.validation.generationOrder=normalized.supportProgram.validation.generationOrder.filter(id=>!addedIds.has(id));
 normalized.portals=normalized.portals.filter(p=>!addedIds.has(p.id));
 normalized.model.openingOwnership.emptyOpenings=normalized.model.openingOwnership.emptyOpenings.filter(p=>!addedIds.has(p.openingId));
 normalized.model.openingOwnership.validation.emptyOpeningCount-=added.length;
 normalized.counts.windows-=added.length;normalized.counts.openings-=added.length;
 if(normalized.counts.visibleByClass.handrail){normalized.counts.visibleByClass.stair+=normalized.counts.visibleByClass.handrail;delete normalized.counts.visibleByClass.handrail;}
 eq(normalized,before,'complete result differs only in rail classification and the specified hosted windows');

 for(const aperture of added){
  const level=q.levels.find(l=>l.id===aperture.floorId),host=P.find(p=>p.nodeId===aperture.hostId),slabId=level.nodeId+':slab';
  eq(aperture.id,aperture.hostId+':opening','stable opening identity derived from unique floor wall host');
  eq(aperture.openingType,'window','explicit window, not a doorway');eq(aperture.role,'window','explicit role');
  eq(aperture.width,1,'fixed teaching width');eq(aperture.height,1,'fixed teaching height');eq(aperture.sill,.9,'sill retained above floor');
  eq(aperture.leafIds,[],'no invented window leaf');eq(aperture.infillId,null,'open host void, no glass/infill');ok(aperture.empty,'explicit empty aperture');
  for(const relation of ['ownedBy','hostedBy','voids'])eq(q.graph.edges.filter(e=>e.from===aperture.id&&e.type===relation).map(e=>e.to),[aperture.hostId],'one correct '+relation+' wall');
  eq(q.graph.edges.filter(e=>e.from===aperture.hostId&&e.type==='supportedBy').map(e=>e.to),[slabId],'existing wall supported on its own slab');
  if(!host){ok(q.parameters.stage<7,'new window does not bypass stage reveal');continue;}
  const lo=aperture.lo,hi=aperture.hi;near(lo,.95,'window lower host coordinate');near(hi,1.95,'window upper host coordinate');
  eq(host.loops[1],[[lo,.9],[hi,.9],[hi,1.9],[lo,1.9]],'exact rectangular hole through the analytic prism');
  eq(host.range,[-.06,.06],'entire original 0.12 m host thickness cut');
  const voidBounds={min:[7.94,level.elevation+.9,3.05],max:[8.06,level.elevation+1.9,4.05]};
  // Exact continuous bound proof: the opening is the explicit rectangular
  // prism hole; every OTHER solid's conservative AABB is disjoint from it.
  for(const p of P)if(p.nodeId!==host.nodeId)ok(!overlaps(voidBounds,p.bounds),'whole opening prism clear of other solid: '+p.nodeId);
  for(const fx of [.01,.25,.5,.75,.99])for(const fy of [.01,.25,.5,.75,.99])for(const depth of [-.059,0,.059]){
   const p=aperture.origin.map((v,k)=>v+aperture.u[k]*(aperture.lo+fx)+aperture.v[k]*(aperture.sill+fy)+aperture.w[k]*depth);
   ok(!inside(P,p),'new window is actually empty throughout host thickness');
   ok(inside([oldById.get(host.nodeId)],p),'negative control: same point was solid wall in R05');
  }
  for(const [u,v]of [[lo-.1,1.4],[hi+.1,1.4],[1.45,.8],[1.45,2.0]]){
   const point=host.origin.map((x,k)=>x+host.u[k]*u+host.v[k]*v);ok(inside([host],point),'window jamb/sill/head wall remains present');
  }
  const beamUnder=level.elevation+level.height-.16-.32,clearance=beamUnder-voidBounds.max[1];
  ok(clearance>=.22-1e-8,'minimum-height side beam remains clear above window');minimumBeamClearance=Math.min(minimumBeamClearance,clearance);
  near(4.86-voidBounds.max[2],.81,'rear column remains separated by 0.81 m');
  ok(voidBounds.min[2]-2.36>=.69-1e-8,'window remains behind lift/back-wall envelope');
  ok(voidBounds.min[0]-4>=3.94-1e-8,'R05 landing beam remains separated from new side window');
 }
 const records=buildRegistry(q.model,q.source),packed=packRegistry(records),rails=records.filter(r=>r.classKey==='handrail'),stairs=records.filter(r=>r.classKey==='stair');
 for(let i=0;i<records.length;i++)if(['handrail','stair'].includes(records[i].classKey)){
  const color=records[i].classKey==='handrail'?'#536477':'#d0b8cb';eq(records[i].color,color,'actual class palette');
  eq(Array.from(packed.data.slice(i*4+1,i*4+4)),color.slice(1).match(/../g).map(x=>Math.fround(parseInt(x,16)/255)),'real packed semantic RGB');
 }
 if(args.caseId==='connected'&&args.storeys===4&&args.groundHeight===3.6)defaultSummary={storeys:4,addedWindows:added.length,totalWindows:q.counts.windows,railFields:rails.length,stairFields:stairs.length,windowIds:added.map(p=>p.id),windowSize:[1,1],sill:.9,sideWindowBoundsPerFloor:{x:[7.94,8.06],z:[3.05,4.05],yAboveFloor:[.9,1.9]}};
}
eq(CLASSES.slice(0,10).map(c=>c.key),['UNKNOWN','wall','column','beam','stair','floor','roof','elevator','door','window'],'old semantic indices preserved');eq(CLASSES[10].key,'handrail','new class only appended');
const html=fs.readFileSync(path.join(root,'sketches.html'),'utf8');
eq((html.match(/href="\.\.\/building-rule-sketch-r04\/index\.html"/g)??[]).length,2,'both old prototype entries still link to R04');
ok(html.includes('深灰蓝：扶手 / 接头 / 立柱'),'visible legend matches actual renderer palette');
// Verify all relative module imports in the copied runtime closure resolve.
for(const file of baselineFiles.filter(p=>p.endsWith('.mjs'))){
 const body=fs.readFileSync(path.join(root,file),'utf8');
 for(const m of body.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.[^'"]+\.mjs)['"]/g))ok(fs.existsSync(path.resolve(root,path.dirname(file),m[1])),'complete local runtime module closure: '+file+' → '+m[1]);
}
for(const [file,digest]of originalHashes)eq(sha(path.join(base,file)),digest,'R05 remains read-only: '+file);
console.log(JSON.stringify({passed:true,assertions,generations,defaultFourStorey:defaultSummary,minimumWindowToSideBeamClearance:minimumBeamClearance,geometryScope:'only named right-wall window loops; all frame/slab/landing/stair/lift geometry unchanged',supportTopology:'unchanged',R05Unchanged:true,browserQA:'not run, as instructed',published:false},null,2));
