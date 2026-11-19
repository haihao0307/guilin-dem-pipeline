import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveMeasuredCase, queryCase, intersectCaseRay } from '../r07/cases.mjs';
import { ASSEMBLY_SCHEMA, queryAssemblyInside, intersectAssemblyRay, packAssemblyDescriptors } from '../r07/assemblies.mjs';
import { profileFor } from '../r07/profiles.mjs';
import { controllerFor } from '../whole-building-r02/mother-system.mjs';
import { railPointAt } from '../r07/field.mjs';
import { queryStairRails, railToWorld } from '../whole-building-r01/rails.mjs';
import {
 GROUND_SYSTEM_SCHEMA, deriveGroundSystem, sourceLocalToMpd, mpdToSourceLocal,
 setGroundEnabled, setGroundVisibility, selectedGroundInstances,
 selectedGroundRails, queryGroundSystem, intersectGroundSystemRay,
 routeGroundSystem, validateGroundSystem, groundFieldHash,
} from '../whole-building-ground-r01/ground-system.mjs';

const ids=['lowrise','kcc','warehouse'];
const readJSON=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const official=readJSON('../r07/sources/official-footprints.json');
const measured=Object.fromEntries(ids.map(id=>[id,deriveMeasuredCase(readJSON('../../hk-three-buildings-r01/geometry/'+profileFor(id).modelId+'.score.json'))]));
const models=Object.fromEntries(ids.map(id=>[id,controllerFor(id).derive(measured[id],official)]));
const originals=Object.fromEntries(ids.map(id=>[id,JSON.stringify(models[id])]));
const sourceBefore=JSON.stringify({measured,official});
const sourceQueries=Object.fromEntries(ids.map(id=>[id,{point:queryCase(measured[id],[0,2,0]),ray:intersectCaseRay(measured[id],[0,100,0],[0,-1,0])}]));
const systems=Object.fromEntries(ids.map(id=>[id,deriveGroundSystem(models[id],official)]));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,t)=>a.map(v=>v*t);
const point=(s,x,y,z)=>add(s.origin,add(mul(s.X,x),add(mul(s.Y,y),mul(s.Z,z))));
const center=ring=>ring.reduce((p,q)=>add(p,mul(q,1/ring.length)),[0,0]);

for(const id of ids)test(id+' preserves old measured inputs, native model bytes, old aboveground fields and old source query exactly',()=>{
 const s=systems[id],base=models[id];
 assert.equal(s.schema,GROUND_SYSTEM_SCHEMA);
 assert.equal(s.baseModel,base);
 assert.equal(JSON.stringify(base),originals[id]);
 assert.equal(JSON.stringify({measured,official}),sourceBefore);
 assert.deepEqual({point:queryCase(measured[id],[0,2,0]),ray:intersectCaseRay(measured[id],[0,100,0],[0,-1,0])},sourceQueries[id]);
 for(const a of base.archetypes)assert.equal(s.model.archetypes.find(q=>q.id===a.id),a);
 for(const l of base.levels)assert.equal(s.model.levels.find(q=>q.id===l.id),l);
 assert.equal(s.model.sourceBinding,base.sourceBinding);
 assert.equal(s.model.sourceGeoreference,base.sourceGeoreference);
 assert.equal(s.model.interfaces.lifts,base.interfaces.lifts);
 assert.deepEqual(s.model.interfaces.stairs.slice(0,base.interfaces.stairs.length),base.interfaces.stairs);
 const changed=base.instances.filter(i=>s.model.instances.find(q=>q.id===i.id)!==i);
 assert.equal(changed.length,id==='warehouse'?1:0);
 for(const i of changed)assert.equal(i.id,s.additions.modifiedDesignHosts[0].instanceId);
 assert.equal(s.validation.sourceUnchanged,true);
});

test('ground datum is an approximate component-base annotation, not source-local zero or an actual entrance',()=>{
 for(const [id,mpd] of [['lowrise',26],['kcc',8],['warehouse',4]]) {
  const s=systems[id];
  near(s.datum.workingMpd,mpd);
  near(s.datum.localY,mpd-models[id].sourceGeoreference.originEastingNorthingHeight[2]);
  near(s.datum.designEntryMpd,mpd+models[id].config.slabThickness);
  assert.notEqual(s.datum.sourceOriginMpd,mpd);
  assert.equal(s.datum.actualEntranceMpd,null);
  assert.equal(s.datum.actualTerrainMpd,null);
  assert.equal(s.datum.approximate,true);
  assert.equal(s.datum.annotationOnly,true);
  for(const y of [-100,-12.1,0,4.6,100])near(mpdToSourceLocal(s,sourceLocalToMpd(s,y)),y);
  for(const elevation of [0,8,26,90.9])near(sourceLocalToMpd(s,mpdToSourceLocal(s,elevation)),elevation);
  assert.match(s.datum.evidence,/not_surveyed_terrain_or_actual_entrance/);
 }
 const edited=deriveGroundSystem(models.kcc,official,{workDatumMpd:8.75});
 near(edited.datum.localY,8.75-edited.datum.sourceOriginMpd);
 assert.deepEqual(edited.additions.instances,systems.kcc.additions.instances);
 assert.equal(edited.baseModel,models.kcc);
 assert.throws(()=>sourceLocalToMpd(systems.kcc,NaN),/Finite/);
 assert.throws(()=>mpdToSourceLocal(systems.kcc,Infinity),/Finite/);
});

test('only official basement records create B levels; lowrise G/F is not B1',()=>{
 assert.deepEqual(ids.map(id=>systems[id].metadata.officialBasementCount),[null,1,2]);
 assert.deepEqual(systems.lowrise.basementFloorIds,[]);
 assert.deepEqual(systems.kcc.basementFloorIds,['B1']);
 assert.deepEqual(systems.warehouse.basementFloorIds,['B1','B2']);
 assert.equal(systems.lowrise.model,models.lowrise);
 assert.equal(systems.lowrise.metadata.designDepthM,null);
 assert.match(systems.lowrise.metadata.groundFloorLabelNote,/not B1/);
 assert.equal(models.lowrise.levels[0].actualFloorLabel,'G/F');
 for(const id of ['kcc','warehouse']) {
  const s=systems[id],ground=models[id].levels[0];
  assert.deepEqual(s.groundVisibleFloorIds,s.basementFloorIds.concat(models[id].levels.slice(0,2).map(l=>l.id)));
  s.additions.levels.forEach((l,i)=>{
   near(l.elevation,ground.elevation-(i+1)*3.2);
   near(l.elevationMpd,ground.elevationMpd-(i+1)*3.2);
   near(l.fflM,sourceLocalToMpd(s,l.localY));
   assert.equal(l.actualFFLMpd,null);assert.equal(l.actualFloorLabel,null);
  });
  assert.equal(s.metadata.actualDepthM,null);
  assert.equal(s.metadata.actualOutline,null);
  assert.equal(s.metadata.actualBasementFFLMpd,null);
  assert.equal(s.metadata.actualLiftServesBasement,null);
  assert.equal(s.metadata.structuralOrFireSafetyCertification,false);
  assert.equal(s.metadata.liftFutureInterface.enabled,false);
  for(const lift of s.model.interfaces.lifts)assert.ok(lift.servedFloorIds.every(f=>!/^B\d+$/.test(f)));
 }
});

test('depth edits rebuild bounded stair fields and reject nonfinite, low, tall or oversized core geometry',()=>{
 for(const id of ['kcc','warehouse']) {
  const edited=deriveGroundSystem(models[id],official,{basementDepth:3.4});
  assert.equal(edited.metadata.designDepthM,3.4);
  near(edited.additions.stairs[0].rise,3.4);
  near(edited.additions.levels[0].elevation,models[id].levels[0].elevation-3.4);
  assert.equal(edited.metadata.actualDepthM,null);
  assert.notDeepEqual(edited.additions.archetypes.find(a=>a.stair).primitives,systems[id].additions.archetypes.find(a=>a.stair).primitives);
  for(const depth of [NaN,Infinity,-1,0,2.4,3.8,100])assert.throws(()=>deriveGroundSystem(models[id],official,{basementDepth:depth}),/depth|domain|headroom|aperture/);
 }
 assert.throws(()=>deriveGroundSystem(models.kcc,official,{bogus:true}),/Unknown/);
 assert.throws(()=>deriveGroundSystem(models.kcc,official,{enabled:'false'}),/boolean/);
 assert.throws(()=>deriveGroundSystem(models.kcc,official,{workDatumMpd:999}),/datum/);
});

test('editable proposed footprint stays bounded, preserves the official ring, and must include stairs plus access',()=>{
 const s=systems.warehouse,rings=structuredClone(s.metadata.proposedOutlineLocal);
 const sameOutline=deriveGroundSystem(models.warehouse,official,{basementOutlineLocal:rings});
 assert.deepEqual(sameOutline.metadata.proposedOutlineLocal,rings);
 assert.equal(sameOutline.metadata.actualOutline,null);
 assert.equal(JSON.stringify({measured,official}),sourceBefore);
 assert.throws(()=>deriveGroundSystem(models.warehouse,official,{basementOutlineLocal:[[[0,0],[1,0],[1,1],[0,1]]]}),/excludes stair/);
 assert.throws(()=>deriveGroundSystem(models.warehouse,official,{basementOutlineLocal:[[[0,0],[1000,0],[1000,1000],[0,1000]]]}),/leaves official/);
 assert.throws(()=>deriveGroundSystem(models.warehouse,official,{basementOutlineLocal:[[[0,0],[1,1],[0,1],[1,0]]]}),/Degenerate|Self-intersecting/);
 assert.throws(()=>deriveGroundSystem(models.lowrise,official,{basementOutlineLocal:[[[0,0],[1,0],[1,1]]]}),/unknown/);
});

for(const id of ['kcc','warehouse'])test(id+' has genuine exact stair treads, upper slab holes, continuous rails and supported corridors',()=>{
 const s=systems[id],model=s.model;
 for(const stair of s.additions.stairs) {
  const layout=stair.layout,lower=model.levels.find(l=>l.id===stair.fromFloorId),upper=model.levels.find(l=>l.id===stair.toFloorId);
  near(stair.path[0][1],lower.elevation);near(stair.path.at(-1)[1],upper.elevation);
  assert.deepEqual(stair.joins.lower,stair.path[0]);assert.deepEqual(stair.joins.upper,stair.path.at(-1));
  const a=model.archetypes.find(a=>a.id===stair.archetypeId);
  const n=layout.risersPerFlight,h=stair.rise/2,x=(layout.centerGap+layout.flightWidth)/2;
  for(let k=0;k<n;k++)for(const side of [-1,1]) {
   const p=point(layout,side*x,(side<0?0:h)+h*(k+1)/n,side<0?layout.runLength*(k+.5)/n:layout.runLength*(1-(k+.5)/n));
   assert.equal(queryAssemblyInside(a,add(p,[0,-.012,0])),true);
   const world=add(p,[0,stair.lowerElevation,0]);
   assert.equal(intersectGroundSystemRay(s,add(world,[0,.005,0]),[0,1,0],{maxDistance:model.config.minimumHeadroom-.01}).hit,false);
  }
  const upperI=model.instances.find(i=>i.floorId===upper.id&&i.kind==='floor'),upperA=model.archetypes.find(a=>a.id===upperI.archetypeId),plate=upperA.primitives.find(p=>p.nodeId==='floor:slab');
  assert.ok(upperA.holes.stair);
  const c=center(upperA.holes.stair),slabOnly={schema:ASSEMBLY_SCHEMA,primitives:[plate]};
  assert.equal(queryAssemblyInside(slabOnly,[c[0],-.08,c[1]]),false);
  assert.equal(intersectAssemblyRay(slabOnly,[c[0],.1,c[1]],[0,-1,0],{maxDistance:.5}).hit,false);
  const front=point(layout,0,-.08,-.25);
  assert.equal(queryAssemblyInside(slabOnly,front),true,'slab beside hole remains physical');
 }
 for(const r of s.additions.rails.instances) {
  for(const support of r.supports) {
   assert.equal(queryGroundSystem(s,support.startWorld).inside,true);
   near(support.handrailContact.distance,0);
   assert.ok(support.endWorld[1]>support.startWorld[1]);
  }
  for(let k=0;k<=50;k++) {
   const local=railPointAt(r.template.path,r.template.path.length*k/50).point;
   assert.ok(queryStairRails(r,railToWorld(local,r.frame)).distance<0,'exact continuous tube centerline');
  }
 }
 for(const c of s.additions.corridors)for(let k=0;k<=10;k++) {
  const p=add(c.points[0],mul(sub(c.points[1],c.points[0]),k/10));
  assert.equal(queryGroundSystem(s,add(p,[0,-.01,0])).inside,true);
 }
 // The deepest receiving slab is solid, not an invented aperture to B3/B2.
 const bottom=s.additions.levels.at(-1),bottomA=model.archetypes.find(a=>a.id===bottom.archetypeId),layout=s.additions.stairs[0].layout;
 assert.equal(bottomA.holes.stair,null);
 assert.equal(queryAssemblyInside(bottomA,point(layout,0,-.08,layout.runLength/2)),true);
 assert.ok(model.archetypes.every(a=>a.primitives.every(p=>p.kind==='finite_polygon_prism')));
 for(const a of s.additions.archetypes)assert.ok(packAssemblyDescriptors(a).data.length>0);
 assert.equal(model.counts.modelTriangles,0);assert.equal(model.counts.modelVertexBuffers,0);
 assert.equal(validateGroundSystem(s).headroomRaysPassed,true);
});

test('warehouse modifies exactly one DESIGN slab, records fingerprints, and changes no walls or official outline',()=>{
 const s=systems.warehouse,changes=s.additions.modifiedDesignHosts;
 assert.equal(changes.length,1);
 const h=changes[0],oldA=models.warehouse.archetypes.find(a=>a.id===h.oldArchetypeId),newA=s.model.archetypes.find(a=>a.id===h.newArchetypeId);
 const oldPlate=oldA.primitives.find(p=>p.nodeId==='floor:slab'),newPlate=newA.primitives.find(p=>p.nodeId==='floor:slab');
 assert.equal(h.primitiveId,'floor:slab');assert.notEqual(h.oldHash,h.newHash);
 assert.equal(h.oldHash,groundFieldHash(oldPlate));assert.equal(h.newHash,groundFieldHash(newPlate));
 assert.deepEqual(newA.primitives.slice(1),oldA.primitives.slice(1));
 assert.deepEqual(newPlate.loops.slice(0,-1),oldPlate.loops);
 assert.deepEqual(newPlate.loops[0],models.warehouse.sourceBinding.podiumFootprint);
 assert.deepEqual(newPlate.range,oldPlate.range);assert.deepEqual(newPlate.bounds,oldPlate.bounds);
 const c=center(newA.holes.stair),y=models.warehouse.levels[0].elevation-.05,p=[c[0],y,c[1]],nativeI=models.warehouse.instances.find(i=>i.id===h.instanceId),newI=s.model.instances.find(i=>i.id===h.instanceId);
 assert.equal(controllerFor('warehouse').query(models.warehouse,p,{instances:[nativeI]}).inside,true);
 assert.equal(queryGroundSystem(s,p,{instances:[newI]}).inside,false);
 assert.equal(JSON.stringify(models.warehouse),originals.warehouse);
});

test('hide keeps physical fields, apertures and graph; disabling restores exact base; both are reversible',()=>{
 const s=systems.warehouse,hidden=setGroundVisibility(s,false);
 assert.equal(hidden.model,s.model);assert.equal(hidden.additions,s.additions);
 assert.equal(hidden.model.graph,s.model.graph);
 assert.ok(selectedGroundInstances(hidden).every(i=>!i.groundExtension));
 assert.ok(selectedGroundRails(hidden).every(r=>!r.groundExtension));
 assert.equal(selectedGroundInstances(hidden,{includeHidden:true}).length,s.model.instances.length);
 const p=add(s.additions.corridors[0].points[0],[0,-.05,0]);
 assert.equal(queryGroundSystem(hidden,p).inside,true);
 assert.equal(queryGroundSystem(hidden,p,{visibleOnly:true}).inside,false);
 assert.deepEqual(selectedGroundInstances(setGroundVisibility(hidden,true)),selectedGroundInstances(s));
 const disabled=setGroundEnabled(hidden,false);
 assert.equal(disabled.model,s.baseModel);
 assert.equal(JSON.stringify(disabled.model),originals.warehouse);
 assert.equal(disabled.designModel,s.designModel);
 assert.equal(disabled.metadata.officialBasementCount,2);
 assert.throws(()=>routeGroundSystem(disabled,'B1'),/disabled/);
 const on=setGroundEnabled(disabled,true);
 assert.equal(on.model,s.designModel);assert.equal(on.visible,false);
 assert.equal(setGroundVisibility(on,true).model,s.model);
 const initiallyOff=deriveGroundSystem(models.warehouse,official,{enabled:false});
 assert.equal(initiallyOff.model,models.warehouse);
 assert.equal(initiallyOff.designModel.interfaces.stairs.length,s.designModel.interfaces.stairs.length);
});

test('routes descend real stairs, keep every graph endpoint, and never extend existing lifts',()=>{
 for(const id of ['kcc','warehouse']) {
  const s=systems[id],base=models[id],nodeIds=new Set(s.model.graph.nodes.map(n=>n.id));
  assert.equal(nodeIds.size,s.model.graph.nodes.length);
  for(const e of s.model.graph.edges)assert.ok(nodeIds.has(e.from)&&nodeIds.has(e.to));
  for(const r of s.additions.rails.instances)for(const a of r.supports)assert.ok(nodeIds.has(a.ownerId));
  for(const target of s.basementFloorIds) {
   const r=routeGroundSystem(s,target);
   assert.equal(r.fromFloorId,base.levels[0].id);assert.equal(r.targetFloorId,target);
   assert.equal(r.actualRouteVerified,false);assert.equal(r.requiresLiftArrival,false);
   assert.equal(r.segments.filter(seg=>seg.kind==='stairs').length,Number(target.slice(1)));
   for(const seg of r.segments.filter(seg=>seg.kind==='stairs')) {
    assert.equal(seg.descending,true);assert.ok(seg.points[0][1]>seg.points.at(-1)[1]);
    assert.deepEqual(seg.points,structuredClone(s.additions.stairs.find(t=>t.id===seg.stairId).path).reverse());
   }
   near(r.points.at(-1)[1],s.additions.levels.find(l=>l.id===target).elevation);
   for(let k=1;k<r.segments.length;k++)assert.deepEqual(r.segments[k-1].points.at(-1),r.segments[k].points[0],'route is spatially continuous');
   assert.throws(()=>routeGroundSystem(s,target,{mode:'lift'}),/No lift service/);
   assert.throws(()=>routeGroundSystem(s,target,{mode:'freight'}),/No lift service/);
  }
  for(const mode of controllerFor(id).capabilities.routeModes)assert.deepEqual(routeGroundSystem(s,base.levels.at(-1).id,{mode}),controllerFor(id).route(base,base.levels.at(-1).id,{mode}));
  const state=controllerFor(id).createLiftState(base);
  assert.throws(()=>controllerFor(id).targetLift(base,state,'B1'),/Unserved|does not serve/);
 }
});

test('exact query and ray discover underground slabs that old native model intentionally lacks',()=>{
 for(const id of ['kcc','warehouse']) {
  const s=systems[id],l=s.additions.levels.at(-1),p=add(s.additions.corridors.at(-1).points[0],[0,-.05,0]);
  assert.equal(queryGroundSystem(s,p).inside,true);
  assert.equal(controllerFor(id).query(models[id],p).inside,false);
  const hit=intersectGroundSystemRay(s,add(p,[0,.55,0]),[0,-1,0],{floorIds:[l.id],maxDistance:1});
  assert.equal(hit.hit,true);near(hit.point[1],l.elevation);
  assert.equal(hit.floorId,l.id);
  assert.equal(queryGroundSystem(s,p,{floorIds:[models[id].levels[0].id]}).inside,false);
 }
 assert.throws(()=>queryGroundSystem(systems.kcc,[0,NaN,0]),/Finite/);
 assert.throws(()=>intersectGroundSystemRay(systems.kcc,[0,0,0],[0,0,0]),/Valid/);
});

test('combined query/ray retain native graph identities and current dynamic lift fields',()=>{
 for(const id of ['kcc','warehouse']) {
  const s=systems[id],base=models[id],c=controllerFor(id);
  let state=c.createLiftState(base);state=c.targetLift(base,state,base.levels.at(-1).id);state=c.advanceLift(base,state,1);
  const visual=c.liftVisuals(base,state),car=visual.instances.find(i=>i.kind==='lift-car');
  const carA=[...base.archetypes,...visual.archetypes].find(a=>a.id===car.archetypeId),plate=carA.primitives.find(p=>p.nodeId.includes('floor'));
  const q=center(plate.loops[0]),local=add(plate.origin,add(mul(plate.u,q[0]),add(mul(plate.v,q[1]),mul(plate.w,(plate.range[0]+plate.range[1])/2))));
  const p=add(local,car.translation),native=c.query(base,p,{liftState:state}),extended=queryGroundSystem(s,p,{liftState:state});
  assert.equal(native.inside,true);assert.equal(extended.inside,true);
  assert.equal(extended.nodeId,native.nodeId);assert.equal(extended.instanceId,native.instanceId);
  near(extended.distance,native.distance);
  const rayOrigin=add(p,[0,.5,0]),nativeRay=c.ray(base,rayOrigin,[0,-1,0],{liftState:state,maxDistance:1}),extendedRay=intersectGroundSystemRay(s,rayOrigin,[0,-1,0],{liftState:state,maxDistance:1});
  assert.equal(extendedRay.hit,true);assert.equal(extendedRay.nodeId,nativeRay.nodeId);near(extendedRay.t,nativeRay.t);
  const top=base.levels.at(-1),plan=id==='kcc'?[0,0]:[-13,-5],floorPoint=[plan[0],top.elevation-.05,plan[1]],oldFloor=c.query(base,floorPoint),newFloor=queryGroundSystem(s,floorPoint);
  assert.equal(newFloor.nodeId,oldFloor.nodeId);assert.equal(newFloor.instanceId,oldFloor.instanceId);near(newFloor.distance,oldFloor.distance);
 }
});
