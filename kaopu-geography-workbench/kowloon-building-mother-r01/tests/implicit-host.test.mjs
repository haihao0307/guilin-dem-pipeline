import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SOURCE_MODEL_ID,SOURCE_COMMIT,createHostRecord,createHostFrame,defaultHostConfig,
  transformLocalToHost,transformHostToLocal,transformLocalToSurvey,validateHostDomain,deriveHostGraph,deriveHostGraphFromField} from '../r06/host.mjs';
import {deriveField} from '../r06/field.mjs';

const sourceText=await readFile(new URL('../../hk-three-buildings-r01/geometry/B359971994401063C0.score.json',import.meta.url),'utf8');
const source=JSON.parse(sourceText);
const near=(a,b,eps=1e-10)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const nearPoint=(a,b,eps)=>a.forEach((n,i)=>near(n,b[i],eps));
const enToLocal=p=>{const q=transformHostToLocal([p[0],0,-p[1]]);return [q[0],q[2]];};
const square=(x,z,r)=>[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]];

test('host is the unchanged identified source, not a generic footprint',()=>{
  const h=createHostRecord(),roof=source.reconstruction.operations.find(o=>o.id==='p000');
  assert.equal(h.modelId,SOURCE_MODEL_ID);assert.equal(h.source.commit,SOURCE_COMMIT);
  assert.equal(createHash('sha256').update(sourceText).digest('hex'),h.source.scoreSha256);
  assert.deepEqual(h.measuredExterior.footprintEastNorth,roof.loops[0]);assert.equal(roof.loops[0].length,20);
  near(h.measuredExterior.baseM,source.reconstruction.operations.find(o=>o.kind==='wallStrip').bottom);
  near(h.measuredExterior.roofM,roof.heightPlane[2]);
  assert.deepEqual(h.georeference.originEastingNorthingHeight,source.georeference.originEastingNorthingHeight);
  assert.equal(h.sourceExteriorMutated,false);
});

test('default field frame direction follows the actual p002 edge; location remains a design assumption',()=>{
  const f=createHostFrame(),edge=source.reconstruction.operations.find(o=>o.id==='p002').edge;
  const d=edge[1].map((n,i)=>n-edge[0][i]),l=Math.hypot(...d);
  nearPoint(f.zAxis,[d[0]/l,0,-d[1]/l]);nearPoint(f.origin,[3,3.40000191,8]);
  assert.match(f.locationEvidence,/not_measured/);assert.equal(f.scale,1);
});

test('source use, real interior and actual floor count remain unknown',()=>{
  const h=createHostRecord();assert.equal(h.measuredExterior.actualUse,'unknown');assert.equal(h.measuredExterior.floorCount,'unknown');
  assert.equal(h.interiorEvidence,'unknown');assert.equal(h.realInteriorVerified,false);
  assert.equal(h.buildingComplianceVerified,false);assert.equal(h.safetyOrStructuralCertification,false);
  assert.match(h.reservedServiceVoid.evidence,/not an observed core or lift/);
});

test('field-to-host and inverse are rigid, preserve lengths and recover material coordinates',()=>{
  const frames=[createHostFrame(),createHostFrame({originEastNorth:[-2,7],runEastNorth:[1,0]}),createHostFrame({originEastNorth:[7,-4],runEastNorth:[0,1]})];
  const points=[[0,0,0],[-1.2,0.5,2.3],[1.1,3.2,4.7]];
  for(const f of frames){for(const p of points)nearPoint(transformHostToLocal(transformLocalToHost(p,f),f),p);
    const a=transformLocalToHost(points[1],f),b=transformLocalToHost(points[2],f);
    near(Math.hypot(...a.map((n,i)=>n-b[i])),Math.hypot(...points[1].map((n,i)=>n-points[2][i])));}
});

test('host transforms reject scale and reflection rather than stretching material metres',()=>{
  const f=createHostFrame();assert.throws(()=>transformLocalToHost([1,2,3],{...f,scale:2}),/unit rigid/);
  assert.throws(()=>transformHostToLocal([1,2,3],{...f,xAxis:f.xAxis.map(n=>-n)}),/right-handed/);
  assert.throws(()=>transformHostToLocal([1,2,3],{...f,zAxis:[2,0,0]}),/unit rigid/);
});

test('survey anchor is exact EPSG:2326 east/north and HKPD height, not fabricated latitude',()=>{
  const h=createHostRecord(),p=transformLocalToSurvey([0,0,0]);
  nearPoint(p,[836007.8125,819935.3125,24.042000201015625],1e-8);
  assert.equal(h.georeference.horizontalCrs,'EPSG:2326');assert.equal(h.georeference.verticalDatum,'Hong Kong Principal Datum');
  const m=h.fieldToSurveyDisplayMatrixColumnMajor;
  nearPoint(m.slice(12,15),[p[0],p[2],-p[1]],1e-8);
});

test('default two-floor identity and FFL reproduce R05 authored dimensions',()=>{
  const g=deriveHostGraph();assert.deepEqual(g.floors.map(f=>f.id),['floor-001','floor-002']);
  near(g.floors[0].fflM,3.40000191);near(g.floors[1].fflM,6.60000191);near(g.dimensions.midFFLM,5.00000191);
  near(g.dimensions.width,2.6);near(g.dimensions.runLength,2.52);near(g.dimensions.totalLength,4.92);
  assert.equal(g.dimensions.risersPerFlight,10);assert.equal(g.dimensions.treadsPerFlight,9);near(g.dimensions.actualRiser,.16);
});

test('height and slab changes propagate by floor ID to stairs, partition and openings',()=>{
  const g=deriveHostGraph({floorHeight:3.6,slabThickness:.24}),node=id=>g.nodes.find(n=>n.id===id);
  near(g.floors[0].fflM,3.44000191);near(g.floors[1].fflM,7.04000191);
  near(node('stair-001-002').upperFFLM,g.floors[1].fflM);near(node('slab-002').topLocalY,3.6);
  near(node('floor-002:proposed-partition').baseFFLM,g.floors[1].fflM);
  near(node('floor-002:proposed-partition:door-opening').bottomLocalY,3.6);
  assert.equal(node('stair-001-002:upper-slab-opening').hostId,'slab-002');
  assert.deepEqual(g.floors.map(f=>f.id),deriveHostGraph().floors.map(f=>f.id));
});

test('semantic ownership and cross-floor references are separate, without a phantom lift',()=>{
  const g=deriveHostGraph(),ids=new Set(g.nodes.map(n=>n.id));assert.equal(ids.size,g.nodes.length);
  for(const n of g.nodes)if(n.ownerId)assert.ok(ids.has(n.ownerId));
  const rail=g.nodes.find(n=>n.kind==='continuous-rail-field');assert.equal(rail.ownerId,'stair-001-002');
  const core=g.nodes.find(n=>n.kind==='proposed-circulation-core');assert.deepEqual(core.referencedFloorIds,['floor-001','floor-002']);
  assert.equal(g.edges.filter(e=>e.kind==='references-floor').length,2);
  assert.ok(!g.nodes.some(n=>/elevator|lift/.test(n.kind)));
  assert.equal(g.scope.allHongKongBuildings,false);assert.equal(g.scope.coreCount,1);
  assert.equal(g.navigationEnabled,false);assert.equal(g.completeBuilding,false);
});

test('source-derived local crop has positive whole-domain margin',()=>{
  const a=validateHostDomain([[-1.6,-.6],[1.6,-.6],[1.6,5.2],[-1.6,5.2]]);
  assert.equal(a.valid,true);near(a.minimumExteriorBoundaryDistanceM,1.4342249207646058,1e-8);
  assert.ok(a.serviceReserveClearanceM>6.6);
  assert.match(a.basis,/not corner-only/);
});

test('concave footprint crossing is rejected even with every corner inside',()=>{
  const insidePoints=[[-9,2],[8,5],[4,-13]];
  for(const [e,n] of insidePoints)assert.equal(validateHostDomain(square(e,n,.001).map(enToLocal),undefined,{excludeServiceReserve:false}).valid,true);
  assert.throws(()=>validateHostDomain(insidePoints.map(enToLocal),undefined,{excludeServiceReserve:false}),/exact observed-derived footprint/);
});

test('domain cannot swallow the retained service reserve, even without edge crossings',()=>{
  assert.throws(()=>validateHostDomain(square(0,0,1.05).map(enToLocal)),/service reserve/);
});

test('bad domain boundaries and exterior placements are rejected',()=>{
  assert.throws(()=>validateHostDomain([[0,0],[1,1],[0,1],[1,0]]),/simple/);
  assert.throws(()=>validateHostDomain([[0,0],[0,0],[1,0]]),/zero-length/);
  assert.throws(()=>deriveHostGraph({originEastNorth:[100,100]}),/observed-derived footprint/);
  assert.throws(()=>createHostFrame({runEastNorth:[0,0]}),/nonzero/);
});

test('bounded floor IDs and positive aperture remainder reject impossible relationships',()=>{
  assert.throws(()=>deriveHostGraph({upperFloorId:'floor-020'}),/bounded/);
  assert.throws(()=>deriveHostGraph({doorWidth:2,partitionWidth:2}),/positive side/);
  assert.throws(()=>deriveHostGraph({doorHeight:2.5}),/positive side and head/);
  assert.throws(()=>deriveHostGraph({slabThickness:.08}),/close the final riser/);
  assert.throws(()=>deriveHostGraph({unknown:1}),/Unknown host/);
});

test('record edits cannot mutate source constants or another derived model',()=>{
  const a=createHostRecord();a.measuredExterior.footprintEastNorth[0][0]=99;a.georeference.originEastingNorthingHeight[0]=0;
  const b=createHostRecord();near(b.measuredExterior.footprintEastNorth[0][0],-6.08203125);near(b.georeference.originEastingNorthingHeight[0],836004.8125);
  const c=defaultHostConfig();c.originEastNorth[0]=999;assert.equal(defaultHostConfig().originEastNorth[0],3);
});

test('host source has no rendering imports or per-object surface construction',async()=>{
  const code=await readFile(new URL('../r06/host.mjs',import.meta.url),'utf8');
  assert.ok(!/\bimport\b[^;]*\bthree\b/i.test(code));
  assert.ok(!/new\s+(?:THREE\.)?(?:Mesh|BufferGeometry|BoxGeometry|CylinderGeometry)|setAttribute\s*\(|setIndex\s*\(/.test(code));
});

test('field adapter maps every numeric hit ID to an existing semantic node',()=>{
  const g=deriveHostGraphFromField(deriveField()),ids=new Set(g.nodes.map(n=>n.id));
  for(const id of Object.values(g.fieldBindings))assert.ok(ids.has(id),id);
  assert.equal(g.fieldFootprint.kind,'exact_source_boundary');assert.equal(g.fieldFootprint.preservedServiceReserve,true);
  assert.equal(g.nodes.find(n=>n.id==='stair-001-002:mid-landing').localY,1.6);
});

test('field adapter retains explicit riser count and coupled floor height',()=>{
  const spec=deriveField({floorHeight:3.6,risersPerFlight:12}),g=deriveHostGraphFromField(spec);
  assert.equal(g.dimensions.risersPerFlight,12);near(g.dimensions.actualRiser,.15);
  near(g.dimensions.runLength,spec.dimensions.runLength);near(g.floors[1].localY,3.6);
});

test('field adapter rejects replaced source boundary or erased service reserve',()=>{
  const c=deriveField().config;
  const altered=structuredClone(c);altered.footprint2D[0][0]+=.01;
  assert.throws(()=>deriveHostGraphFromField(altered),/exact observed-derived p000/);
  const erased=structuredClone(c);erased.serviceVoid2D[0][0]+=.01;
  assert.throws(()=>deriveHostGraphFromField(erased),/existing authored service reserve/);
});

test('disabled wall and rail keep IDs but do not claim active dependent fields',()=>{
  const a=deriveHostGraphFromField(deriveField()),b=deriveHostGraphFromField(deriveField({wallEnabled:false,railsEnabled:false}));
  assert.deepEqual(a.nodes.map(n=>n.id),b.nodes.map(n=>n.id));
  for(const id of ['stair-001-002:continuous-rail','floor-002:proposed-partition','floor-002:proposed-partition:door-opening'])assert.equal(b.nodes.find(n=>n.id===id).effectiveEnabled,false);
  assert.equal(b.nodes.find(n=>n.id==='slab-002').effectiveEnabled,true);
});
