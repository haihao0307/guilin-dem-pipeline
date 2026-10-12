import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SOURCE_MATERIAL_ROLES,WATERFRONT_SOURCE_PARAMETERS,waterfrontSourceParts,stationWaterfrontPlan,stationWaterfrontMembers,waterfrontMemberBounds,stationWaterfrontBounds,stationWaterfrontFloorBounds,stationWaterfrontCoverageBounds,waterfrontMemberPoint,waterfrontMemberSample,createStationWaterfrontSampler,stationWaterfrontWGSL} from '../../native-station-waterfront.mjs';
import {STATION_SCORE} from '../../station-score.mjs';
import {scanWGSLIdentifiers} from '../wgsl-identifiers.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./waterfront-source-r02.json',import.meta.url),'utf8'));
const familyMap=JSON.parse(fs.readFileSync(new URL('./r02-to-r04-map.json',import.meta.url),'utf8'));
const close=(a,b,tol=2e-12)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>assert(Math.abs(x-b[i])<=tol,JSON.stringify({a,b})));};
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const parts=stationWaterfrontMembers(),plan=stationWaterfrontPlan(),find=id=>parts.find(m=>m.id===id);
let seed=168321;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);

test('72 exact original semantic children match the independent frozen expansion byte-for-data',()=>{
 assert.equal(fixture.parts.length,72);assert.deepEqual(WATERFRONT_SOURCE_PARAMETERS,fixture.parameters);
 assert.deepEqual(waterfrontSourceParts(),fixture.parts);assert.deepEqual(waterfrontSourceParts(fixture.parameters),fixture.parts);
 assert.equal(fixture.sourceCommit,'f31df978916876205355664593b0299f027188ad');assert.match(fixture.sourceSHA256,/^[a-f0-9]{64}$/);
 const families=['quay-ground','quay-seawall','quay-bollard','road','road-walk','road-marking','pier-deck','pier-pile'];
 const rows=familyMap.families.filter(x=>families.includes(x.family));assert.equal(rows.length,8);assert.equal(rows.reduce((s,x)=>s+x.oldCount,0),72);
 assert.deepEqual(new Set(rows.flatMap(x=>x.oldIds)),new Set(fixture.parts.map(x=>x.id)));
});

test('every original identity survives expanded whole-coast construction; extensions remain explicit',()=>{
 assert.equal(parts.length,128);assert.equal(new Set(parts.map(x=>x.id)).size,128);
 const original=parts.filter(m=>m.sourceId!==null);assert.equal(original.length,72);
 assert.deepEqual(new Set(original.map(m=>m.sourceId)),new Set(fixture.parts.map(m=>m.id)));
 for(const m of original){const s=fixture.parts.find(x=>x.id===m.sourceId);assert.deepEqual(m.sourceShape,s.shape);assert.deepEqual(m.sourceSurface,s.surface);assert.equal(m.materialRole,s.surface.role);}
 assert.equal(parts.filter(m=>m.id.startsWith('quay-bollard-')).length,71);
 assert.equal(parts.filter(m=>m.id.startsWith('road-line-')).length,40);
 assert.equal(parts.filter(m=>m.sourceId===null).length,56);
 for(const m of parts)assert(!/boat|hotel|U-pier/.test(m.id));
});

test('shared -250mm datum restores quay/road/sidewalk heights and preserves thin source sections',()=>{
 assert.equal(plan.verticalOffset,-.25);close([plan.quayTop,plan.wallTop,plan.roadTop,plan.walkTop,plan.bollardY],[-.18,-.4,-.22,.15,.25]);
 const q=waterfrontMemberBounds(find('quay-ground'));close(q.min,[48,-.58,-175]);close(q.max,[60,-.18,26]);
 const wall=waterfrontMemberBounds(find('quay-seawall'));close(wall.min,[59.425,-2.9,-175]);close(wall.max,[60.175,-.4,26]);
 const road=waterfrontMemberBounds(find('station-road'));close(road.min,[-58,-.34,-175]);close(road.max,[-43,-.22,26]);
 const walk=waterfrontMemberBounds(find('station-road-walk'));close(walk.min,[-43,-.25,-175]);close(walk.max,[-38.2,.15,26]);
 assert.equal(find('quay-ground').shape.size[1],.4);assert.equal(find('quay-seawall').shape.size[1],2.5);assert.equal(find('station-road').shape.size[1],.12);assert.equal(find('station-road-walk').shape.size[0],4.8);
 // Siding sleeper bottom=-.165; source quay top=-.18 leaves 15mm nominal gap.
 assert(-.11-.055-q.max[1]>.0149);assert(q.max[1]+.00091<-.11-.055);
 const bollards=parts.filter(m=>m.id.startsWith('quay-bollard-'));for(let i=0;i<bollards.length;i++){const b=bollards[i];assert.equal(b.shape.radius,.11);assert.equal(b.shape.radiusTop,.09);assert.equal(b.shape.segments,12);assert.equal(b.shape.height,1);assert.equal(b.center[0],59.3);assert.equal(b.center[1],.25);if(i)assert(Math.abs(b.center[2]-bollards[i-1].center[2]-2.8)<1e-12);assert(b.center[2]>=-175&&b.center[2]<=26);}
});

test('straight 24x6m pier meets current public deck, supported by all 12 original piles without toe/cap gaps',()=>{
 const deck=find('pier-deck'),b=waterfrontMemberBounds(deck);close(b.min,[60,.51,10]);close(b.max,[84,.85,16]);
 assert.equal(b.max[1],.85);assert.equal(STATION_SCORE.site.passengerWalk.z,13);assert(STATION_SCORE.site.passengerWalk.endX>b.min[0]);
 const piles=parts.filter(m=>m.id.startsWith('pier-pile-'));assert.equal(piles.length,12);
 for(const m of piles){assert.equal(m.shape.radius,.27);assert.equal(m.shape.radiusTop,.27);assert.equal(m.shape.height,4);assert.equal(m.shape.segments,32);assert([62,66,70,74,78,82].includes(m.center[0]));assert([10.7,15.3].includes(m.center[2]));const pb=waterfrontMemberBounds(m);assert(Math.abs(pb.max[1]-.53)<1e-12);assert(Math.abs(pb.min[1]+3.47)<1e-12);assert(Math.abs(pb.max[1]-b.min[1]-.02)<1e-12);assert(pb.max[1]<b.max[1]);assert.equal(m.waterContact,1);}
 assert(plan.authoredChanges.some(x=>x.includes('20mm underside embed')));
});

test('proper per-family material frames roundtrip metre coordinates, without mirrored road surface',()=>{
 for(const m of parts){assert(Math.abs(dot(cross(m.frame[0],m.frame[1]),m.frame[2])-1)<1e-12);const q=[.015,-.031,.024],p=waterfrontMemberPoint(m,q);close(waterfrontMemberSample(m,p).q,q,1e-11);}
 const road=find('station-road');assert.deepEqual(road.frame,[[0,0,1],[0,1,0],[-1,0,0]]);assert.deepEqual(road.extent,[100.5,.06,7.5]);
 assert.equal(SOURCE_MATERIAL_ROLES.road.role,'coal');assert.equal(SOURCE_MATERIAL_ROLES.road.id,18);assert.equal(SOURCE_MATERIAL_ROLES.road.color,'#68726a');assert.equal(SOURCE_MATERIAL_ROLES.road.metalness,.05);assert.equal(SOURCE_MATERIAL_ROLES.road.roughness,.92);
 assert.equal(SOURCE_MATERIAL_ROLES['paint-cream'].id,7);assert.equal(SOURCE_MATERIAL_ROLES['paint-cream'].seed,187);assert.equal(SOURCE_MATERIAL_ROLES['paint-cream'].color,'#e5dac0');assert.equal(SOURCE_MATERIAL_ROLES['paint-cream'].roughness,.34);
 assert.equal(find('quay-ground').materialId,17);assert.equal(find('quay-seawall').materialId,2);assert.equal(parts.find(m=>m.materialRole==='cast-iron').materialId,3);
});

test('road paint is a finite connected .4mm ingredient with shared owner, no preserved 3mm air gap',()=>{
 const road=find('station-road'),marks=parts.filter(m=>m.ingredientOf==='station-road'),sample=createStationWaterfrontSampler({}, {exhaustive:true});assert.equal(marks.length,40);
 for(const m of marks){assert.equal(m.owner,road.member);assert.equal(m.seed,187);const b=waterfrontMemberBounds(m);assert(Math.abs(b.max[1]-plan.roadTop-.0004)<1e-12);assert(Math.abs(plan.roadTop-b.min[1]-.0002)<1e-12);assert.equal(m.shape.size[2],2.5);assert.equal(m.shape.size[0],.12);
  // Actual connected zero set, with original cream ownership at its outer top.
  const top=[m.center[0],b.max[1],m.center[2]],h=sample(top);assert(Math.abs(h.d)<1e-12);assert.equal(h.id,7);assert.equal(h.seed,187);assert.equal(h.owner,road.member);
  for(let i=0;i<=8;i++){const p=[m.center[0],plan.roadTop-.00025+i*.000075,m.center[2]];assert(sample(p).d<=1e-12);}
 }
 const gap=[road.center[0],plan.roadTop,marks[0].center[2]+2.5],h=sample(gap);assert.equal(h.id,18);assert.equal(h.owner,road.member);assert(Math.abs(h.d)<1e-12);
 const old=fixture.parts.find(m=>m.id.startsWith('road-line-'));assert(Math.abs(old.shape.center[1]-old.shape.size[1]/2-.03-.003)<1e-12);
});

test('each child gets actual point, local q and material state before min; nominal nearest can lose',()=>{
 const p=[-50.5,plan.roadTop+.0005,-172],raw=createStationWaterfrontSampler({}, {exhaustive:true})(p);assert.equal(raw.id,7);
 const calls=[],callback=(h,point,m)=>{assert.deepEqual(point,p);calls.push(m.id);assert.deepEqual(h.q,waterfrontMemberSample(m,point).q);return h.baseD+(h.id===7?.002:h.id===18?-.002:0);};
 const full=createStationWaterfrontSampler({}, {materialDistance:callback,exhaustive:true})(p);assert.equal(calls.length,128);assert.equal(full.id,18);assert(full.d<0);assert(full.d<raw.d+.002);
 const fast=createStationWaterfrontSampler({}, {materialDistance:callback})(p);assert.equal(fast.id,full.id);assert(Math.abs(fast.d-full.d)<1e-12);assert.equal(fast.owner,find('station-road').member);
 assert.throws(()=>createStationWaterfrontSampler({}, {materialDistance:h=>h.d+.04,exhaustive:true})(p),/bound exceeded/);
});

test('bounded native row search matches exhaustive surface winners under varying child states',()=>{
 const materialDistance=(h,p,m)=>h.baseD+(m.materialId===7||m.materialId===18?0:.003*Math.sin(m.member*.67+h.q[0]*3+p[1]*7));
 const fast=createStationWaterfrontSampler({}, {materialDistance}),full=createStationWaterfrontSampler({}, {materialDistance,exhaustive:true});
 let actual=0;
 for(let i=0;i<3200;i++){const m=parts[i%parts.length],q=m.extent.map(x=>(random()*2-1)*x),face=i%3;q[face]=m.extent[face]*(random()<.5?-1:1)+(random()-.5)*.018;const p=waterfrontMemberPoint(m,q),a=fast(p),b=full(p);assert(a.d<=b.d+1e-9,JSON.stringify({p,a,b}));if(a.id!==0){actual++;assert(Math.abs(a.d-b.d)<1e-9);assert.equal(a.id,b.id);}}
 assert(actual>2500);for(const p of[[140,40,60],[-100,12,-230],[70,-10,-80]]){const a=fast(p),b=full(p);assert.equal(a.id,0);assert(a.d>0);for(const m of parts){for(const side of[-1,1]){const point=waterfrontMemberPoint(m,[0,side*m.extent[1],0]);assert(a.d<=Math.hypot(...p.map((x,k)=>x-point[k]))+1e-9);}}}
});

test('four expanded floor bounds include road ingredient, and complete draw bounds include underwater pile toes',()=>{
 const bounds=stationWaterfrontBounds(),floors=stationWaterfrontFloorBounds();assert.equal(floors.length,4);assert.deepEqual(new Set(floors.map(b=>b.id)),new Set(['quay-ground','station-road','station-road-walk','pier-deck']));
 close(bounds.min,[-58.03001,-3.50001,-175.03001]);close(bounds.max,[84.03001,.88001,26.03001]);
 for(const m of parts){const b=waterfrontMemberBounds(m,.03001);for(let k=0;k<3;k++){assert(b.min[k]>=bounds.min[k]-1e-12);assert(b.max[k]<=bounds.max[k]+1e-12);}if(m.floor){const f=floors.find(f=>f.owner===m.owner);assert(f);for(let k=0;k<3;k++){assert(b.min[k]>=f.min[k]-1e-12);assert(b.max[k]<=f.max[k]+1e-12);}}}
 const skip=createStationWaterfrontSampler({}, {exhaustive:true})([-50.5,plan.roadTop,-172],true);assert(![7,17,18].includes(skip.id));
});

test('WGSL is compact analytic construction with pre-union callback and id0-only bounds',()=>{
 const code=stationWaterfrontWGSL({materialDistance:'stationWaterfrontPhysicalDistance'});assert.deepEqual(scanWGSLIdentifiers(code),[]);
 assert(code.includes('h.d=stationWaterfrontPhysicalDistance(h,p)'));assert(code.includes('completeStationWaterfront(p:vec3<f32>,skipFloor:bool)'));assert(code.includes('if(c.d<h.d){h=c;}'));
 assert(code.includes('memberCone(q,0.11,0.09,1.,12u)'));assert(code.includes('memberCone(q,0.27,0.27,4.,32u)'));assert(code.includes('StationWaterfrontHit(1e5,1e5,0u'));
 assert(code.includes('if(bound>.15)'));assert(code.includes('stationWaterfrontWaterContact(member:f32)'));
 for(const token of['textureSample','sampler','vertexBuffer','BufferGeometry','THREE.','U-pier'])assert(!code.includes(token));assert(code.length<12000);
});

test('bad dimensions and callback identifiers fail instead of silently widening geometry',()=>{
 assert.throws(()=>stationWaterfrontPlan({verticalOffset:NaN}));assert.throws(()=>stationWaterfrontPlan({paintThickness:.008}));assert.throws(()=>stationWaterfrontPlan({paintEmbed:0}));assert.throws(()=>stationWaterfrontBounds({},-.1));assert.throws(()=>stationWaterfrontFloorBounds({},-.1));assert.throws(()=>stationWaterfrontWGSL({materialDistance:'invalid()'}));
 const shifted=stationWaterfrontPlan({verticalOffset:0,pierTop:1});assert.equal(shifted.roadTop,.03);assert.equal(shifted.quayTop,.07);assert.equal(shifted.pierTop,1);
});


test('derived per-family coverage covers all members without filling unrelated site or planned pier arms',()=>{
 const coverage=stationWaterfrontCoverageBounds();assert.equal(coverage.length,9);
 for(const m of parts){const b=waterfrontMemberBounds(m,.03001);assert(coverage.some(c=>b.min.every((x,k)=>x>=c.min[k]-1e-12)&&b.max.every((x,k)=>x<=c.max[k]+1e-12)),m.id);}
 assert(coverage.every(b=>b.max[0]<85));assert(!coverage.some(b=>[103,2,28].every((x,k)=>x>=b.min[k]&&x<=b.max[k])));
 assert(!coverage.some(b=>[-84,0,-46].every((x,k)=>x>=b.min[k]&&x<=b.max[k])));
 const site=structuredClone(STATION_SCORE.site);site.shoreX=66;site.quayFront=31;site.quayBack=-181;site.road.front=31;site.road.back=-181;site.passengerWalk.z=17;
 const adapted=stationWaterfrontPlan({site}),m=stationWaterfrontMembers({site});assert.equal(adapted.pierZ,17);assert.equal(adapted.pierStart,66);close(waterfrontMemberBounds(m.find(x=>x.id==='quay-ground')).max,[66,-.18,31]);
});
