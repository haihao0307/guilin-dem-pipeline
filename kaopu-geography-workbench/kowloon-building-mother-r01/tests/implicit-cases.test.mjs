import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{deriveMeasuredCase,queryCase,caseNormal,patchDistance,buildCaseGLSL,intersectCaseRay,traceCase,CASE_PROFILES}from'../r06/cases.mjs';
const ids=['B367642137201063C0','B359971994401063C0','B369121858401063C0'];
const scores=ids.map(id=>JSON.parse(readFileSync(new URL(`../../hk-three-buildings-r01/geometry/${id}.score.json`,import.meta.url))));
const specs=scores.map(s=>deriveMeasuredCase(s));const close=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(a,t)=>a.map(x=>x*t),sub=(a,b)=>a.map((x,i)=>x-b[i]);
const point=(p,q)=>add(p.origin,add(mul(p.u,q[0]),mul(p.v,q[1])));
function sourceBoundary(op){if(op.kind==='wallStrip'){const[a,b]=op.edge;return[[a[0],op.bottom,-a[1]],[b[0],op.bottom,-b[1]],[b[0],op.top,-b[1]],[a[0],op.top,-a[1]]];}if(op.kind==='wallProfile')return op.loops.flat().map(([s,h])=>[op.origin[0]+op.tangent[0]*s+op.horizontalDriftPerHeight[0]*h,h,-op.origin[1]-op.tangent[1]*s-op.horizontalDriftPerHeight[1]*h]);const[a,b,c]=op.heightPlane;return op.loops.flat().map(([x,z])=>[x,a*x+b*z+c,-z]);}
let seed=19;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const randPoint=s=>s.bounds.min.map((x,i)=>x-5+rnd()*(s.bounds.max[i]-x+10));
test('all176/21/28 original planar patches survive without source mutation',()=>{for(let i=0;i<3;i++){const before=JSON.stringify(scores[i]),s=deriveMeasuredCase(scores[i]);assert.equal(s.patches.length,[176,21,28][i]);assert.deepEqual(s.patches.map(p=>p.sourcePatchId),scores[i].reconstruction.operations.map(p=>p.id));assert.equal(JSON.stringify(scores[i]),before);assert.equal(s.reconstruction.groundClosureAdded,false);assert.equal(s.reconstruction.wallThicknessAdded,false);assert.equal(s.reconstruction.interiorGenerated,false);assert.equal(s.fieldKind,'measured-surface');}});
test('every source boundary control preserves its original3D location and zero distance',()=>{let count=0;for(let k=0;k<3;k++)for(let j=0;j<specs[k].patches.length;j++){const patch=specs[k].patches[j],expected=sourceBoundary(scores[k].reconstruction.operations[j]),actual=patch.loops.flat().map(q=>point(patch,q));assert.equal(expected.length,actual.length);for(let n=0;n<expected.length;n++){actual[n].forEach((v,a)=>close(v,expected[n][a],2e-8));close(patchDistance(patch,expected[n]),0,2e-8);count++;}}assert.equal(count,904);});
test('all patch frames are orthonormal and preserve metre distances including drifting walls',()=>{for(const s of specs)for(const p of s.patches){close(Math.hypot(...p.u),1);close(Math.hypot(...p.v),1);close(Math.hypot(...p.n),1);close(dot(p.u,p.v),0);close(dot(p.u,p.n),0);close(dot(p.v,p.n),0);const at=point(p,p.loops[0][0]);close(patchDistance(p,add(at,mul(p.n,.123))),.123,1e-7);}});
test('lowrise tilted and complex profile surfaces are retained, not a generic extrusion',()=>{const s=specs[0];assert.equal(s.sourceRoleCounts.wallProfile,78);assert.equal(s.sourceRoleCounts.roofPlane,27);assert.equal(s.sourceRoleCounts.undersidePlane,16);assert.ok(s.patches.filter(p=>p.sourceKind==='wallProfile').some(p=>Math.abs(p.n[1])>.001));assert.ok(s.patches.some(p=>p.loops[0].length>=38));});
test('warehouse source roof is horizontal and hole in parapet ring remains a hole',()=>{const s=specs[2],p=s.patches[0];assert.equal(p.sourceHoleCount,1);assert.equal(s.profile.correctedRoofInterpretation,'source_roof_planes_are_horizontal_not_sloped');for(const op of scores[2].reconstruction.operations.filter(o=>o.kind==='roofPlane')){close(op.heightPlane[0],0);close(op.heightPlane[1],0);}const q=[0,scores[2].reconstruction.operations[0].heightPlane[2],0];assert.ok(patchDistance(p,q)>20);const h=queryCase(s,q);assert.equal(h.sourcePatchId,'p001');close(h.distance,.24800110,1e-7);});
test('unsigned field does not invent occupancy or close the tower base',()=>{const s=specs[1],h=queryCase(s,[0,20,0]);assert.equal(h.inside,null);assert.ok(h.distance>1);assert.equal(s.distanceContract.occupancy,'undefined_no_invented_closed_volume');const ray=intersectCaseRay(s,[0,10,0],[0,-1,0]);assert.equal(ray.hit,false);});
test('BVH conservative pruning matches exhaustive nearest surface and IDs at900 random points',()=>{let evaluations=0;for(const s of specs)for(let i=0;i<300;i++){const p=randPoint(s),a=queryCase(s,p),b=queryCase(s,p,{accelerated:false});close(a.distance,b.distance,1e-12);assert.equal(a.objectId,b.objectId);assert.equal(a.materialRole,b.materialRole);assert.deepEqual(a.normal,b.normal);assert.ok(a.patchEvaluations<=s.patches.length);evaluations+=a.patchEvaluations;}assert.ok(evaluations<300*225*.5);});
test('BVH contains every child and leaf boundary without excluding thin plane patches',()=>{for(const s of specs){assert.equal(s.nodes.length,2*s.patches.length-1);for(let i=0;i<s.nodes.length;i++){const n=s.nodes[i];assert.ok(n.skip>i&&n.skip<=s.nodes.length);if(n.patchIndex>=0){const p=s.patches[n.patchIndex];for(const q of p.loops.flat().map(q=>point(p,q)))for(let a=0;a<3;a++){assert.ok(q[a]>=n.min[a]-1e-8);assert.ok(q[a]<=n.max[a]+1e-8);}}}}});
test('exact unsigned surface union remains sampled1-Lipschitz',()=>{for(const s of specs)for(let i=0;i<300;i++){const p=randPoint(s),v=[rnd()-.5,rnd()-.5,rnd()-.5],q=add(p,v);assert.ok(Math.abs(queryCase(s,p).distance-queryCase(s,q).distance)<=Math.hypot(...v)+1e-7);}});
test('analytic ray intersection agrees with exhaustive plane tests and never reports budget miss',()=>{for(const s of specs){const center=s.bounds.min.map((x,i)=>(x+s.bounds.max[i])/2);for(let i=0;i<180;i++){const p=randPoint(s),dir=sub(center,p),a=intersectCaseRay(s,p,dir),b=intersectCaseRay(s,p,dir,{accelerated:false});assert.equal(a.hit,b.hit);if(a.hit){close(a.t,b.t,1e-8);assert.equal(a.objectId,b.objectId);close(queryCase(s,a.point).distance,0,1e-7);}assert.ok(a.patchTests<=s.patches.length);}}});
test('analytic ray passes through warehouse roof ring to real lower roof',()=>{const h=intersectCaseRay(specs[2],[0,40,0],[0,-1,0]);assert.equal(h.sourcePatchId,'p001');close(h.point[1],33.82499695);});
test('analytic normals remain available exactly on unsigned zero set',()=>{for(const s of specs){const h=intersectCaseRay(s,[s.bounds.max[0]+10,s.bounds.max[1]+10,s.bounds.max[2]+10],[-1,-1,-1]);if(h.hit){const n=caseNormal(s,h.point);close(Math.hypot(...n),1);assert.ok(n.every(Number.isFinite));}}});
test('surface distance reference marcher reaches real tower wall but does not classify interior',()=>{const h=traceCase(specs[1],[40,20,0],[-1,0,0],{maxDistance:100});assert.equal(h.hit,true);assert.equal(h.inside,null);assert.ok(h.sourceKind.startsWith('wall'));});
test('source-aware case facts are separate and floor numbers are not summed or copied',()=>{assert.equal(CASE_PROFILES[ids[0]].storeys.officialPart,2);assert.equal(CASE_PROFILES[ids[1]].storeys.officialPart,24);assert.equal(CASE_PROFILES[ids[1]].storeys.ownerWholeBuilding,28);assert.equal(CASE_PROFILES[ids[2]].storeys.officialPart,12);assert.equal(CASE_PROFILES[ids[2]].storeys.additionPermitted,false);assert.notEqual(CASE_PROFILES[ids[0]].part,CASE_PROFILES[ids[2]].part);});
test('unknown cases, unsupported operations and source-scale changes reject explicitly',()=>{const s=structuredClone(scores[0]);s.objectId='arbitrary-box';assert.throws(()=>deriveMeasuredCase(s));const t=structuredClone(scores[0]);t.edits.scaleEast=2;assert.throws(()=>deriveMeasuredCase(t),/preserves/);const u=structuredClone(scores[0]);u.reconstruction.operations[0].kind='mesh';assert.throws(()=>deriveMeasuredCase(u),/Unsupported/);assert.throws(()=>deriveMeasuredCase(scores[0],{floorCount:99}),/Unknown/);});
test('same source produces deterministicfield without renderobject construction',()=>{for(const s of specs){const glsl=buildCaseGLSL(s);assert.equal(glsl,buildCaseGLSL(s));assert.ok(glsl.includes('caseTraceRay'));assert.ok(glsl.includes('caseBVHLinks'));assert.ok(!/attribute|layout\s*\(location|sampler3D|texture\(/.test(glsl));assert.ok(!/new\s+THREE|BufferGeometry|triangulateShape|drawElements|createBuffer|MarchingCubes/.test(glsl));}const source=readFileSync(new URL('../r06/cases.mjs',import.meta.url),'utf8');assert.ok(!/import.*three|new\s+THREE|BufferGeometry|triangulateShape|createBuffer|drawElements/.test(source));});
// An independent finite-polygon ray oracle. It does not call queryCase,
// patchDistance, patchContains, or the BVH traversal being tested.
function oracleRay(spec,origin,direction,maxDistance=10000){
 const norm=Math.hypot(...direction),rd=direction.map(v=>v/norm);let best=null;
 function inLoop(q,loop){let crossings=0;for(let j=0;j<loop.length;j++){const a=loop[j],b=loop[(j+1)%loop.length];if((a[1]<=q[1]&&b[1]>q[1])||(b[1]<=q[1]&&a[1]>q[1])){const x=a[0]+(q[1]-a[1])*(b[0]-a[0])/(b[1]-a[1]);if(x>q[0])crossings++;}}return crossings%2===1;}
 function onBoundary(q,loops){return loops.some(loop=>loop.some((a,j)=>{const b=loop[(j+1)%loop.length],dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/d)):0;return Math.hypot(q[0]-a[0]-dx*t,q[1]-a[1]-dy*t)<=1e-8;}));}
 for(let k=0;k<spec.patches.length;k++){
  const patch=spec.patches[k],den=dot(rd,patch.n);if(Math.abs(den)<1e-12)continue;
  const t=dot(sub(patch.origin,origin),patch.n)/den;if(t<0||t>maxDistance||(best&&t>best.t))continue;
  const p=add(origin,mul(rd,t)),rel=sub(p,patch.origin),uv=[dot(rel,patch.u),dot(rel,patch.v)];
  const inDomain=inLoop(uv,patch.loops[0])&&!patch.loops.slice(1).some(loop=>inLoop(uv,loop));
  if((inDomain||onBoundary(uv,patch.loops))&&(!best||t<best.t||(t===best.t&&k<best.index)))best={t,index:k,objectId:patch.objectId,point:p};
 }
 return best;
}
function compareOracle(spec,ro,rd,options={}){
 const expected=oracleRay(spec,ro,rd,options.maxDistance),actual=intersectCaseRay(spec,ro,rd,options);
 assert.equal(actual.hit,!!expected,JSON.stringify({ro,rd,actual,expected}));
 if(expected){close(actual.t,expected.t,1e-8);assert.equal(actual.objectId,expected.objectId);assert.deepEqual(actual.local,actual.point);assert.equal(actual.materialRole,spec.patches[expected.index].materialRole);}
 return actual;
}
const testCase=operations=>{const source=structuredClone(scores[0]);source.reconstruction.operations=operations;return deriveMeasuredCase(source);};
const square=[[-2,-2],[2,-2],[2,2],[-2,2]];
test('analytic source rays match independent oracle from outside and inside bounds',()=>{
 for(const spec of specs)for(let i=0;i<160;i++){
  const ro=i%2?spec.sourceBounds.min.map((v,a)=>v+rnd()*(spec.sourceBounds.max[a]-v)):randPoint(spec);
  compareOracle(spec,ro,[rnd()-.5,rnd()-.5,rnd()-.5]);
 }
});
test('both faces, zero-distance starts, parallel and grazing rays have explicit finite-domain semantics',()=>{
 const spec=testCase([{id:'plane',kind:'roofPlane',heightPlane:[0,0,0],loops:[square]}]);
 for(const sign of [-1,1]){const h=compareOracle(spec,[0,sign,0],[0,-sign,0]);assert.equal(h.hit,true);close(h.t,1);assert.equal(h.normal[1],1);}
 assert.equal(compareOracle(spec,[0,0,0],[0,1,0],{maxDistance:0}).t,0);
 assert.equal(compareOracle(spec,[0,1,0],[1,0,0]).hit,false);
 // A coplanar ray has no isolated transversal intersection. It is not turned
 // into an invented solid occupancy or an arbitrary coplanar hit.
 assert.equal(compareOracle(spec,[0,0,0],[1,0,0]).hit,false);
 const grazing=compareOracle(spec,[0,1e-8,0],[1,-1e-8,0]);assert.equal(grazing.hit,true);close(grazing.t,1);
 assert.equal(compareOracle(spec,[0,1,0],[0,-1,0],{maxDistance:.5}).hit,false);
});
test('finite polygon holes pass rays, retain both boundary sides, and ignore winding orientation',()=>{
 const hole=[[-.5,-.5],[-.5,.5],[.5,.5],[.5,-.5]];
 for(const reversed of [false,true]){const spec=testCase([{id:'ring',kind:'roofPlane',heightPlane:[0,0,0],loops:[reversed?square.toReversed():square,reversed?hole.toReversed():hole]}]);
  for(const y of [-1,1])for(const [x,z,hit] of [[0,0,false],[1,0,true],[.5,0,true],[2,0,true],[2.01,0,false]])assert.equal(compareOracle(spec,[x,y,z],[0,-y,0]).hit,hit);
 }
});
test('exact coincident source patches retain stable lowest-index material and ID tie semantics',()=>{
 const spec=testCase([{id:'first',kind:'roofPlane',heightPlane:[0,0,0],loops:[square]},{id:'second',kind:'roofPlane',heightPlane:[0,0,0],loops:[square]}]);spec.patches[1].materialRole=3;
 for(const y of [-1,1]){const h=compareOracle(spec,[0,y,0],[0,-y,0]);assert.equal(h.objectId,1000);assert.equal(h.sourcePatchId,'first');assert.equal(h.materialRole,1);}
});
test('generated hot source ray path is bounded and constant, without full-field re-query',()=>{
 for(const spec of specs){const source=buildCaseGLSL(spec),start=source.indexOf('// Exact polygon crossing'),end=source.indexOf('float mapDistance',start),ray=source.slice(start,end);
  assert.equal((ray.match(/void caseRayPatch\d+\(/g)||[]).length,spec.patches.length);
  assert.equal((ray.match(/caseRayPatch\d+\(ro,rd,t,h,best\)/g)||[]).length,spec.patches.length);
  assert.doesNotMatch(ray,/caseOrigins\[|caseRanges\[|caseEdges\[|caseBVHLinks\[|mapField\(|casePatchDistance\(/);
  assert.match(ray,/caseRayBoundsStatic/);assert.match(ray,/bvec3 parallel/);
  assert.ok((ray.match(/nodeVisits\+\+/g)||[]).length<spec.nodes.length);
  assert.ok(source.length<spec.counts.boundaryCoordinates*550+12000,'Bound generated shader size per source boundary');
 }
});
test('source boundary and edge-midpoint rays preserve accelerated/exhaustive hit parity',()=>{
 for(const spec of specs)for(const patch of spec.patches)for(const loop of patch.loops)for(let i=0;i<loop.length;i++){
  const a=loop[i],b=loop[(i+1)%loop.length];for(const uv of [a,[(a[0]+b[0])/2,(a[1]+b[1])/2]])for(const sign of [-1,1]){
   const at=point(patch,uv),ro=add(at,mul(patch.n,sign*.03125)),rd=mul(patch.n,-sign);
   const actual=intersectCaseRay(spec,ro,rd),expected=intersectCaseRay(spec,ro,rd,{accelerated:false});
   assert.equal(actual.hit,expected.hit,patch.sourcePatchId);if(actual.hit){close(actual.t,expected.t,1e-8);assert.equal(actual.objectId,expected.objectId,patch.sourcePatchId);}
  }
 }
});
