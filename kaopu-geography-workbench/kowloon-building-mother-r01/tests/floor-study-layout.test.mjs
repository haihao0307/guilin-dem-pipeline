import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveMeasuredCase,queryCase} from '../r07/cases.mjs';
import {deriveWholeBuilding} from '../whole-building-r01/tower.mjs';
import {queryAssemblyInside,packAssemblyDescriptors} from '../r07/assemblies.mjs';
import {queryApertures,apertureOpeningDistance} from '../r07/apertures.mjs';
import {FLOOR_STUDY_SCHEMA,PLAN_A_TOPOLOGY,deriveFloorStudy,deriveEvidenceFloorPlan,deriveEvidencePlanModel,compilePlanATopology,validateFloorStudyRoutes} from '../whole-building-floor-study-r01/floor-layout.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const measured=deriveMeasuredCase(read('../../hk-three-buildings-r01/geometry/B359971994401063C0.score.json'));
const official=read('../r07/sources/official-footprints.json'),base=deriveWholeBuilding(measured,official),before=JSON.stringify({measured,base,official});
const unresolved={status:'orientation_ambiguous_not_as_built_registration',accepted:false,ambiguous:true,all20_candidates:[{candidate_id:'R0',scale_m_per_pixel:.013407147599905933,rms_m:.30861257232019107,A_tip_source_edge_vertex_pair:[4,3]},{candidate_id:'R180',scale_m_per_pixel:.01339880119752208,rms_m:.4951815491968588,A_tip_source_edge_vertex_pair:[14,13]}]};
const study=deriveEvidenceFloorPlan(base,measured,{registration:unresolved});
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,t)=>a.map(v=>v*t);
const world=(p,q)=>add(p.origin,add(mul(p.u,q[0]),add(mul(p.v,q[1]),mul(p.w,q[2]))));

test('ambiguous/missing registration cannot insert any geometry into measured mother',()=>{
 for(const registration of [undefined,unresolved,{...unresolved,accepted:true}]){const s=deriveFloorStudy(base,measured,{registration});assert.equal(s.model,base);assert.equal(s.status,'blocked_pending_plan_registration');assert.equal(s.archetypes.length,0);assert.equal(s.sourceMasks.length,0);}
 assert.equal(study.model,base);assert.equal(study.baseModel,base);assert.notEqual(study.evidenceModel,base);
 assert.equal(study.status,'unregistered_evidence_plan');assert.equal(study.enabled,false);assert.equal(study.evidenceEnabled,true);
 assert.equal(JSON.stringify({measured,base,official}),before);assert.equal(study.metadata.registrationAccepted,false);assert.equal(study.metadata.sourcePatchBinding,false);
 assert.equal(study.metadata.candidates.length,2);assert.equal(study.metadata.actualFloorLabel,null);
});

test('trace uses decoded original image domain, never thumbnail pixel scale',()=>{
 assert.deepEqual(PLAN_A_TOPOLOGY.imageSize,[3308,2339]);assert.deepEqual(PLAN_A_TOPOLOGY.traceReferenceImageSize,[1888,1334]);
 assert.ok(PLAN_A_TOPOLOGY.walls.find(w=>w.key==='entry-host').a[0]>1170);
 assert.equal(study.metadata.scaleMPerPixel,.013407147599905933);assert.equal(study.metadata.dimensionsNotOneToOneSurvey,true);
 const door=study.doors.find(d=>d.key==='entry');assert.ok(door.width>.84&&door.width<.85);
 assert.throws(()=>deriveEvidenceFloorPlan(base,measured,{scaleMPerPixel:.02349}),/original|approximate/);
});

test('one original scale, finite analytic fields only, renderer descriptor limits respected',()=>{
 assert.equal(study.schema,FLOOR_STUDY_SCHEMA);assert.equal(study.evidenceModel.levels.length,1);assert.equal(study.evidenceModel.levels[0].id,'evidence-plan');
 assert.equal(study.evidenceModel.levels[0].actualFloorLabel,null);assert.equal(study.evidenceModel.levels[0].elevationMpd,null);
 assert.equal(study.metadata.referenceFloorId,'T04');assert.equal(study.metadata.referenceFloorElevation,base.levels.find(l=>l.id==='T04').elevation);
 const ids=new Set();for(const a of study.evidenceModel.archetypes){assert.ok(a.primitives.length<=90);assert.equal(a.counts.modelTriangles,0);const packed=packAssemblyDescriptors(a);assert.ok(packed.data.length>0);for(const p of a.primitives){assert.equal(p.kind,'finite_polygon_prism');assert.ok(!ids.has(p.objectId));ids.add(p.objectId);assert.ok(p.planes.length>=5);}}
 assert.equal(ids.size,study.evidenceModel.counts.primitives);assert.equal(study.evidenceModel.counts.modelTriangles,0);
 assert.equal(study.evidenceModel.floorStudy.floorId,'evidence-plan');assert.equal(study.evidenceModel.floorStudy.apertures,study.apertures);assert.deepEqual(study.evidenceModel.floorStudy.frame,{X:[1,0,0],Z:[0,0,1]});
});

test('all six plan units and shared core remain in one evidence floor, only A interiors elaborated',()=>{
 assert.equal(study.rooms.length,8);for(const name of ['A','B','C','D','E','F'])assert.ok(study.graph.nodes.find(n=>n.id.endsWith(':unit-'+name)));
 assert.equal(study.corePorts.length,3);assert.equal(study.evidenceModel.interfaces.lifts.length,0);assert.equal(study.evidenceModel.interfaces.stairs.length,0);
 assert.equal(study.metadata.otherFiveUnitInteriorsNotInvented,true);
 const ids=new Set(study.graph.nodes.map(n=>n.id));assert.equal(ids.size,study.graph.nodes.length);for(const e of study.graph.edges){assert.ok(ids.has(e.from),e.from);assert.ok(ids.has(e.to),e.to);}
 const seen=new Set([study.graph.nodes.find(n=>n.type==='shared-circulation').id]);let changed=true;while(changed){changed=false;for(const e of study.graph.edges.filter(e=>e.type==='walksTo'))for(const [from,to]of [[e.from,e.to],[e.to,e.from]])if(seen.has(from)&&!seen.has(to)){seen.add(to);changed=true;}}
 for(const room of study.rooms)assert.ok(seen.has(room.id));assert.ok(seen.has(study.graph.nodes.find(n=>n.type==='evidence-hosted-window').id));
});

test('doors cut true three-dimensional finite hosts instead of painting over walls',()=>{
 for(const d of study.doors){const center=add(d.center,[0,1,0]);assert.equal(queryAssemblyInside(study.evidenceArchetype,center),false,d.key+' door opening');assert.equal(queryAssemblyInside(study.evidenceArchetype,add(d.center,[0,2.3,0])),true,d.key+' lintel');const a=study.apertures.find(a=>a.host.nodeId===d.id+':host');assert.ok(a);assert.equal(a.kind,'door');assert.equal(a.config.openT,1);assert.equal(a.config.thresholdHeight,0);assert.ok(apertureOpeningDistance(a,center)<0);}
});

test('source window remains explicitly unregistered and has one actual analytic host aperture',()=>{
 const w=study.windowBinding;assert.equal(w.sourcePatchId,null);assert.equal(w.actualPhotoPatchKnown,false);assert.equal(study.sourceMasks.length,0);assert.equal(w.outlineEdge,41);
 const a=study.apertures.find(a=>a.instanceId===101);assert.ok(a);assert.equal(a.kind,'window');assert.equal(a.host.emitWall,false);assert.equal(queryAssemblyInside(study.evidenceArchetype,w.center),false);
 const testPoint=add(w.center,[0,-.75,0]);assert.equal(queryAssemblyInside(study.evidenceArchetype,testPoint),true);
 assert.equal(a.config.hingeOrSlider,'hinge-left');assert.ok(a.config.openT>0);assert.equal(study.metadata.actualWindowPositionKnown,false);
});

test('all evidence lobby-to-room and window paths are supported and avoid walls and opened leaves',()=>{
 assert.equal(study.validation.valid,true,JSON.stringify(study.validation.routeFailures));assert.equal(study.paths.length,9);
 const v=validateFloorStudyRoutes(study);assert.equal(v.valid,true);assert.ok(v.samples>1000);
 for(const path of study.paths){assert.ok(path.points.every(p=>Math.abs(p[1])<1e-9));for(const p of path.points)assert.equal(queryApertures(study.apertures,add(p,[0,1.25,0])).inside,false,path.roomKey);}
});

test('finish fields stand 8 mm above slab, new material roles do not rewrite old roles',()=>{
 const floors=study.evidenceArchetype.primitives.filter(p=>p.nodeId.startsWith('study-floor:'));assert.equal(floors.length,8);for(const p of floors){assert.deepEqual(p.range,[0,.008]);assert.equal(p.materialRole,10);}
 for(const a of study.apertures)for(const p of a.primitives)assert.equal(p.materialRole,p.part==='glass'?6:p.part==='host'?11:p.part==='leaf'&&a.kind==='door'?14:13);
 assert.equal(JSON.stringify({measured,base,official}),before);
});

test('renderer convenience API exposes full evidence study without modifying native floor elevations',()=>{
 const model=deriveEvidencePlanModel(base,measured,{registration:unresolved});assert.equal(model.placementMode,'UNREGISTERED_evidence_plan_NOT_part_of_measured_mother');assert.equal(model.floorStudy.metadata.registrationAccepted,false);assert.equal(model.floorStudy.validation.valid,true);assert.equal(base.levels.length,28);assert.equal(base.levels.find(l=>l.id==='T04').actualFloorLabel,null);assert.equal(JSON.stringify({measured,base,official}),before);
});
