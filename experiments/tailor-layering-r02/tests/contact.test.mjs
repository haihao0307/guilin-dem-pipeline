import test from 'node:test';
import assert from 'node:assert/strict';
import { LayerContact } from '../src/layer-contact.mjs';

const options = { contactMargin: 0, searchMargin: 0.02, maxCorrection: 0.1, cellSize: 0.05 };
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

function fixture({ pointMass = 1, triangleMass = [1, 1, 1], z = 0.002 } = {}) {
  return [
    { id: 'shirt', positions: new Float64Array([0.25, 0.25, z]), triangles: new Uint32Array(), inverseMass: new Float64Array([pointMass]), thickness: 0.01 },
    { id: 'coat', positions: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), triangles: new Uint32Array([0, 1, 2]), inverseMass: new Float64Array(triangleMass), thickness: 0.01 },
  ];
}

test('mass-weighted contact distributes reaction across both independent garments', () => {
  const [a, b] = fixture({ pointMass: 2, triangleMass: [1, 0.5, 0.25] });
  const initialA = a.positions.slice(), initialB = b.positions.slice();
  const bary = [0.5, 0.25, 0.25];
  const denominator = 2 + 0.5 ** 2 + 0.25 ** 2 * 0.5 + 0.25 ** 2 * 0.25;
  const multiplier = 0.008 / denominator;
  const out = new LayerContact(options).solve([a, b], { passes: 1 });
  near(a.positions[2] - initialA[2], 2 * multiplier);
  for (let i = 0; i < 3; i++) near(b.positions[i * 3 + 2] - initialB[i * 3 + 2], -b.inverseMass[i] * bary[i] * multiplier);
  near(out.maxCorrectedPenetration, 0.008);
  assert.equal(out.contactCount, 1);
  assert.equal(out.correctionCount, 1);
  assert.notEqual(a.positions.buffer, b.positions.buffer);
  const beforeSampleMutation = a.positions.slice();
  out.sampleContactPoints[0].pointA[2] = 99;
  assert.deepEqual(a.positions, beforeSampleMutation);
  assert.throws(() => new LayerContact(options).solve([a, { ...a, id: 'aliased' }]), /share mutable positions/);
});

test('fixed points remain fixed; fully immovable penetration is reported as residual', () => {
  const [a, b] = fixture({ pointMass: 0 });
  const initialA = a.positions.slice();
  new LayerContact(options).solve([a, b], { passes: 1 });
  assert.deepEqual(a.positions, initialA);
  assert.ok(b.positions.some((value, index) => index % 3 === 2 && value < 0));

  const fixed = fixture({ pointMass: 0, triangleMass: [0, 0, 0] });
  const out = new LayerContact(options).solve(fixed, { passes: 1 });
  assert.equal(out.correctionCount, 0);
  assert.equal(out.immovableContactCount, 1);
  assert.equal(out.residualCount, 1);
  near(out.residualMaxPenetration, 0.008);
});

test('previous surface side restores a shallow crossed vertex without global layer offsets', () => {
  const [a, b] = fixture({ triangleMass: [0, 0, 0], z: -0.002 });
  a.previous = new Float64Array([0.25, 0.25, 0.004]);
  const previousCopy = a.previous.slice();
  const out = new LayerContact(options).solve([a, b], { passes: 1 });
  near(a.positions[2], 0.01);
  assert.deepEqual(a.previous, previousCopy);
  assert.equal(out.residualCount, 0);
  assert.equal(out.continuousCollision, false);
  assert.equal(out.edgeEdgeCollision, true);
});

test('disabling or removing a garment produces no ghost collisions; reset clears side history', () => {
  const solver = new LayerContact(options), [a, b] = fixture({ triangleMass: [0, 0, 0] });
  solver.solve([a, b]);
  a.positions[2] = -0.002;
  const removed = solver.solve([a]);
  near(a.positions[2], -0.002);
  assert.equal(removed.contactCount, 0);
  assert.equal(removed.residualCount, 0);
  const disabled = solver.solve([a, { ...b, enabled: false }]);
  near(a.positions[2], -0.002);
  assert.equal(disabled.contactCount, 0);
  solver.reset();
  solver.solve([a, b], { passes: 1 });
  near(a.positions[2], -0.01);
});

test('friction damps tangential relative displacement and preserves prior state', () => {
  const still = fixture({ triangleMass: [0, 0, 0] });
  const frictional = fixture({ triangleMass: [0, 0, 0] });
  for (const [a] of [still, frictional]) {
    a.previous = a.positions.slice();
    a.positions[0] += 0.003;
  }
  new LayerContact(options).solve(still, { passes: 1, friction: 0 });
  new LayerContact(options).solve(frictional, { passes: 1, friction: 1 });
  near(still[0].positions[0], 0.253);
  near(frictional[0].positions[0], 0.25);
  near(frictional[0].previous[0], 0.25);
});

test('surface contact responds where vertex-only distance would miss, with finite state and balanced displacement', () => {
  const a = { id: 'inner', positions: new Float32Array([0.2, 0.2, 0.002, 0.6, 0.2, 0.002, 0.2, 0.6, 0.002]), triangles: new Uint32Array([0, 1, 2]), thickness: 0.01 };
  const b = { id: 'outer', positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), triangles: new Uint32Array([0, 1, 2]), thickness: 0.01 };
  const solver = new LayerContact(options);
  const sumZ = () => [...a.positions, ...b.positions].reduce((sum, value, i) => sum + (i % 3 === 2 ? value : 0), 0);
  const before = sumZ();
  const first = solver.solve([a, b], { passes: 2 });
  assert.ok(first.contactCount > 0);
  near(sumZ(), before, 1e-8);
  assert.ok(b.positions.some((value, i) => i % 3 === 2 && value !== 0));
  for (let i = 0; i < 25; i++) {
    const result = solver.solve([a, b], { passes: 2 });
    assert.ok(Number.isFinite(result.residualMaxPenetration));
    assert.ok([...a.positions, ...b.positions].every(Number.isFinite));
  }
  const invalid = { ...a, id: 'invalid', positions: new Float64Array([NaN, 0, 0]), triangles: new Uint32Array() };
  assert.throws(() => solver.solve([invalid, b]), /nonfinite/);
  assert.throws(() => solver.solve([a, { ...b, id: a.id }]), /Duplicate/);
});

test('finite search neighbourhood deliberately makes no deep-intersection claim', () => {
  const [a, b] = fixture({ triangleMass: [0, 0, 0], z: -0.1 });
  a.previous = a.positions.slice();
  const out = new LayerContact(options).solve([a, b]);
  near(a.positions[2], -0.1);
  assert.equal(out.contactCount, 0);
  assert.match(out.residualScope, /bounded cross-garment/);
  assert.equal(out.continuousCollision, false);
});

test('a swept vertex crossing beyond the endpoint neighbourhood is corrected reciprocally', () => {
  const [a,b]=fixture({pointMass:0,triangleMass:[1,1,1],z:0});
  a.thickness=b.thickness=.004;
  b.previous=b.positions.slice();for(let j=2;j<b.positions.length;j+=3){b.previous[j]=-.020;b.positions[j]=.020;}
  const fixed=a.positions.slice(),initial=b.positions.slice();
  const solver=new LayerContact({contactMargin:0,searchMargin:.003,maxCorrection:.01});
  const out=solver.solve([a,b],{passes:8});
  assert.deepEqual(a.positions,fixed);
  assert.ok(b.positions.some((v,j)=>Math.abs(v-initial[j])>.001));
  assert.ok(out.sweptCrossingCount>0);
  assert.ok(out.residualMaxPenetration<1e-6);
  assert.equal(out.sweptVertexFace,true);
  assert.equal(out.continuousCollision,false);
});

test('an unresolved swept impact is retained when another projection moves it beyond the search radius', () => {
  const [a,b]=fixture({triangleMass:[0,0,0],z:-.020});a.thickness=b.thickness=.004;
  a.previous=new Float64Array([.25,.25,.020]);
  const solver=new LayerContact({contactMargin:0,searchMargin:.003,maxCorrection:.002});
  const first=solver.solve([a,b],{passes:1,measureResidual:false});
  assert.ok(first.sweptCrossingCount>0);near(a.positions[2],-.018);
  a.positions[2]=-.030;a.previous=a.positions.slice();
  const copy=a.positions.slice(),measured=solver.measure([a,b]);
  near(measured.residualMaxPenetration,.034);assert.deepEqual(a.positions,copy);
  solver.solve([a,b],{passes:20});near(a.positions[2],.004);
  solver.reset();a.positions[2]=-.030;a.previous=a.positions.slice();
  assert.equal(solver.solve([a,b],{passes:2}).contactCount,0);
});

test('read-only measurement observes real residual without changing cloth or previous state', () => {
  const rows = fixture();
  rows[0].previous = rows[0].positions.slice();
  const before = rows.map(row => row.positions.slice());
  const previous = rows[0].previous.slice();
  const solver = new LayerContact(options);
  const out = solver.measure(rows);
  near(out.residualMaxPenetration, 0.008);
  assert.equal(out.residualCount, 1);
  assert.equal(out.correctionCount, 0);
  assert.equal(out.measurementOnly, true);
  rows.forEach((row, i) => assert.deepEqual(row.positions, before[i]));
  assert.deepEqual(rows[0].previous, previous);
});

test('an internal triangle diagonal preserves the material side during a shallow crossing', () => {
  const square={id:'square',positions:new Float64Array([0,0,0,1,0,0,0,1,0,1,1,0]),triangles:new Int32Array([0,1,2,1,3,2]),inverseMass:new Float64Array(4),thickness:.004};
  const point={id:'point',positions:new Float64Array([.5,.5,-.001]),previous:new Float64Array([.5,.5,.001]),triangles:new Int32Array(),inverseMass:new Float64Array([1]),thickness:.004};
  const solver=new LayerContact({contactMargin:0,searchMargin:.01,maxCorrection:.004});
  const result=solver.solve([point,square],{passes:2});
  near(point.positions[2],.004);
  assert.equal(result.residualCount,0);
});

test('adjacent triangle Voronoi regions do not create a fictitious diagonal obstacle', () => {
  const sheet={id:'sheet',positions:new Float64Array([0,0,0,.02,0,0,0,.02,0,.02,.02,0]),triangles:new Int32Array([0,1,2,1,3,2]),inverseMass:new Float64Array(4),thickness:.006};
  const point={id:'point',positions:new Float64Array([.012,.012,.002]),triangles:new Int32Array(),thickness:.006};
  const result=new LayerContact({contactMargin:0,searchMargin:.003,maxCorrection:.01}).solve([point,sheet],{passes:1});
  near(point.positions[0],.012);near(point.positions[1],.012);near(point.positions[2],.006);
  assert.equal(result.contactCount,1);
});

test('conservative broadphase reuse rebuilds for an independently moving source or target', () => {
  const cached=new LayerContact({...options,cacheSkin:.006}),fresh=new LayerContact({...options,cacheSkin:.006,broadphaseCache:false});
  const a=fixture({triangleMass:[0,0,0]}),b=fixture({triangleMass:[0,0,0]});
  for(let step=0;step<10;step++) {
    for(const rows of [a,b]){rows[0].previous=rows[0].positions.slice();rows[1].previous=rows[1].positions.slice();rows[0].positions[0]+=.001;rows[0].positions[2]-=.004;if(step===5)for(let j=2;j<rows[1].positions.length;j+=3)rows[1].positions[j]+=.02;}
    const ra=cached.solve(a,{passes:2}),rb=fresh.solve(b,{passes:2});
    a.forEach((row,i)=>row.positions.forEach((x,j)=>near(x,b[i].positions[j],1e-9)));
    near(ra.residualMaxPenetration,rb.residualMaxPenetration,1e-9);
    assert.equal(ra.residualCount,rb.residualCount);
  }
});

test('replacing a garment topology discards its prior contact side and candidate state', () => {
  const solver=new LayerContact(options),rows=fixture({triangleMass:[0,0,0]});
  solver.solve(rows,{passes:1});
  rows[0].positions[2]=-.002;rows[0].previous=rows[0].positions.slice();
  rows[1]={...rows[1],triangles:Uint32Array.from(rows[1].triangles)};
  solver.solve(rows,{passes:1});
  near(rows[0].positions[2],-.01);
});

test('an unresolved crossing cannot become a zero-residual wrong-side state on the next solver call', () => {
  const sheet={id:'sheet',positions:new Float64Array([0,0,0,1,0,0,0,1,0]),triangles:new Int32Array([0,1,2]),inverseMass:new Float64Array(3),thickness:.004};
  const point={id:'point',positions:new Float64Array([.25,.25,-.005]),previous:new Float64Array([.25,.25,.003]),triangles:new Int32Array(),inverseMass:new Float64Array([1]),thickness:.004};
  const solver=new LayerContact({contactMargin:0,searchMargin:.01,maxCorrection:.002});
  const first=solver.solve([point,sheet],{passes:1});
  near(point.positions[2],-.003);near(first.residualMaxPenetration,.007);
  point.previous=point.positions.slice();
  const second=solver.solve([point,sheet],{passes:2});
  assert.ok(point.positions[2]>0);
  near(second.residualMaxPenetration,.003);
  point.previous=point.positions.slice();
  solver.solve([point,sheet],{passes:2});
  near(point.positions[2],.004);
});

test('transactional rollback preserves unresolved crossing history and gives the same retry response', () => {
  const pair=fixture({triangleMass:[0,0,0],z:-.020}),[point]=pair;
  point.previous=new Float64Array([.25,.25,.020]);
  const solver=new LayerContact({...options,searchMargin:.003,maxCorrection:.002});
  solver.solve(pair,{passes:1});
  point.previous=point.positions.slice();
  const positions=pair.map(g=>g.positions.slice()),checkpoint=solver.checkpoint();
  const before=solver.measure(pair);
  assert.ok(checkpoint.sides.size>0,'fixture contains proven unresolved crossing provenance');
  const first=solver.solve(pair,{passes:2}),expected=pair.map(g=>g.positions.slice());
  solver.reset();
  pair.forEach((g,i)=>g.positions.set(positions[i]));
  solver.restore(checkpoint);
  const restored=solver.measure(pair);
  near(restored.residualMaxPenetration,before.residualMaxPenetration);
  assert.equal(restored.residualCount,before.residualCount);
  assert.deepEqual(restored.sampleContactPoints,before.sampleContactPoints);
  const retry=solver.solve(pair,{passes:2});
  pair.forEach((g,i)=>assert.deepEqual(g.positions,expected[i]));
  near(retry.residualMaxPenetration,first.residualMaxPenetration);
  assert.equal(retry.correctionCount,first.correctionCount);
  assert.throws(()=>new LayerContact(options).restore(checkpoint),/different solver/);
});

test('an unresolved crossing carries its material side across an internal triangle diagonal', () => {
  const sheet={id:'sheet',positions:new Float64Array([0,0,0,1,0,0,0,1,0,1,1,0]),triangles:new Int32Array([0,1,2,1,3,2]),inverseMass:new Float64Array(4),thickness:.004};
  const point={id:'point',positions:new Float64Array([.49,.49,-.020]),previous:new Float64Array([.49,.49,.020]),triangles:new Int32Array(),thickness:.004};
  const solver=new LayerContact({contactMargin:0,searchMargin:.003,maxCorrection:.002});
  solver.solve([point,sheet],{passes:1});near(point.positions[2],-.018);
  point.previous=point.positions.slice();point.positions[0]=point.positions[1]=.51;
  const result=solver.solve([point,sheet],{passes:1});
  near(point.positions[2],-.016);near(result.residualMaxPenetration,.020);
  point.previous=point.positions.slice();solver.solve([point,sheet],{passes:16});near(point.positions[2],.004);
});

test('moving around a true free boundary releases history without a later ghost side', () => {
  const sheet={id:'sheet',positions:new Float64Array([0,0,0,1,0,0,0,1,0]),triangles:new Int32Array([0,1,2]),inverseMass:new Float64Array(3),thickness:.004};
  const point={id:'point',positions:new Float64Array([.006,.25,-.003]),previous:new Float64Array([.006,.25,.003]),triangles:new Int32Array(),thickness:.004};
  const solver=new LayerContact({contactMargin:0,searchMargin:.003,maxCorrection:.001});
  solver.solve([point,sheet],{passes:1});near(point.positions[2],-.002);
  point.previous=point.positions.slice();point.positions[0]=-.006;
  const outside=solver.solve([point,sheet],{passes:1});assert.equal(outside.contactCount,0);assert.equal(outside.residualCount,0);
  point.previous=point.positions.slice();point.positions[0]=.006;
  solver.solve([point,sheet],{passes:1});near(point.positions[2],-.003);
});

function crossingEdges(z=.002) {
  return [
    {id:'a',positions:new Float64Array([-1,0,z,1,0,z,-1,-1,z]),triangles:new Uint32Array([0,1,2]),thickness:.01,inverseMass:new Float64Array([1,2,4])},
    {id:'b',positions:new Float64Array([0,-1,0,0,1,0,1,1,0]),triangles:new Uint32Array([0,1,2]),thickness:.01,inverseMass:new Float64Array([2,3,1])},
  ];
}

test('edge interiors collide when no garment vertex projects into the other triangle', () => {
  const rows=crossingEdges(),solver=new LayerContact(options);
  const centre=()=>[0,1,2].map(d=>rows.reduce((sum,g)=>sum+Array.from(g.inverseMass).reduce((s,w,i)=>s+g.positions[i*3+d]/w,0),0));
  const before=centre(),copies=rows.map(g=>g.positions.slice());
  const measured=solver.measure(rows);
  assert.equal(measured.edgeEdgeContactCount,4);assert.equal(measured.contactCount,4);near(measured.residualMaxPenetration,.008);
  rows.forEach((g,i)=>assert.deepEqual(g.positions,copies[i]));
  const solved=solver.solve(rows,{passes:12});
  assert.ok(solved.edgeEdgeContactCount>0);assert.ok(solved.residualMaxPenetration<1e-6);
  centre().forEach((v,d)=>near(v,before[d],1e-9));
  rows.forEach((g,i)=>assert.ok(g.positions.some((x,j)=>Math.abs(x-copies[i][j])>.0001)));
});

test('swept edge interiors recover a 40 mm side crossing and respect fixed endpoints', () => {
  const rows=crossingEdges(-.020),[a,b]=rows;
  a.thickness=b.thickness=.004;a.previous=a.positions.slice();for(let i=2;i<a.previous.length;i+=3)a.previous[i]=.020;
  b.inverseMass.fill(0);b.previous=b.positions.slice();const fixed=b.positions.slice();
  const solver=new LayerContact({contactMargin:0,searchMargin:.003,maxCorrection:.005});
  const first=solver.solve(rows,{passes:1});assert.ok(first.sweptCrossingCount>0);assert.ok(first.residualMaxPenetration>0);
  a.previous=a.positions.slice();solver.solve(rows,{passes:24});
  assert.deepEqual(b.positions,fixed);assert.ok(solver.measure(rows).residualMaxPenetration<1e-6);
  assert.ok(a.positions.every(Number.isFinite));
  const copy=a.positions.slice();solver.solve([a],{passes:1});assert.deepEqual(a.positions,copy);
  assert.equal(solver.measure([a]).contactCount,0);
});

test('edge candidate skin reuse agrees with fresh broadphase after both garments move', () => {
  const rows=crossingEdges(),freshRows=crossingEdges();
  const cached=new LayerContact({...options,cacheSkin:.006}),fresh=new LayerContact({...options,cacheSkin:.006,broadphaseCache:false});
  for(let step=0;step<5;step++){
    for(const scene of [rows,freshRows])for(let g=0;g<scene.length;g++){scene[g].previous=scene[g].positions.slice();for(let k=0;k<scene[g].positions.length;k+=3){scene[g].positions[k]+=(g===0?.002:-.001);scene[g].positions[k+2]+=(g===0?-.003:.002);}}
    const a=cached.solve(rows,{passes:2}),b=fresh.solve(freshRows,{passes:2});
    rows.forEach((g,i)=>g.positions.forEach((x,j)=>near(x,freshRows[i].positions[j],1e-8)));
    near(a.residualMaxPenetration,b.residualMaxPenetration,1e-8);
  }
});

test('an edge frame may reverse through parallel disjoint edges without reversing separation', () => {
  const theta=Math.PI/9,c=Math.cos(theta),s=Math.sin(theta);
  const rows=[
    {id:'a',positions:new Float64Array([-1,0,.001,1,0,.001,-1,-1,.001]),triangles:new Uint32Array([0,1,2]),thickness:.004},
    {id:'b',positions:new Float64Array([-c,-s,0,c,s,0,-s,c,0]),triangles:new Uint32Array([0,1,2]),inverseMass:new Float64Array(3),thickness:.004},
  ];
  rows.forEach(g=>g.previous=g.positions.slice());
  const solver=new LayerContact({contactMargin:0,searchMargin:.003,maxCorrection:.0001});solver.solve(rows,{passes:1});
  rows.forEach(g=>g.previous=g.positions.slice());rows[1].positions.set([-c,s,0,c,-s,0,s,c,0]);
  const first=solver.measure(rows),edge=first.sampleContactPoints.find(x=>x.kind==='edge-edge'&&x.edgeA.join(',')==='0,1'&&x.edgeB.join(',')==='0,1');
  assert.ok(edge);assert.ok(edge.normal[2]>.99);assert.ok(edge.residualPenetration<.004);
  const before=rows[0].positions.slice();solver.solve(rows,{passes:1});
  assert.ok(rows[0].positions[2]>=before[2]);assert.ok(rows[0].positions[5]>=before[5]);
});

test('a free-boundary release expires even when explicit previous does not advance again', () => {
  const sheet={id:'sheet',positions:new Float64Array([0,0,0,1,0,0,0,1,0]),triangles:new Uint32Array([0,1,2]),inverseMass:new Float64Array(3),thickness:.004};
  const point={id:'point',positions:new Float64Array([.006,.25,-.003]),previous:new Float64Array([.006,.25,.003]),triangles:new Uint32Array(),thickness:.004};
  const solver=new LayerContact({contactMargin:0,searchMargin:.003,maxCorrection:.001});solver.solve([point,sheet],{passes:1});
  point.previous=point.positions.slice();point.positions[0]=-.006;solver.solve([point,sheet],{passes:1});
  point.positions[0]=.006;solver.solve([point,sheet],{passes:1});near(point.positions[2],-.003);
});

test('migration across a sharp internal fold preserves the destination facet’s independently established side', () => {
  const settings={cellSize:.025,contactMargin:0,searchMargin:.003,maxCorrection:.0001,sampleLimit:20};
  const sheet={id:'sheet',positions:new Float64Array([-.02,0,0,.02,0,0,0,.02,0,0,.02,.01]),triangles:new Int32Array([0,1,2,1,0,3]),inverseMass:new Float64Array(4),thickness:.0075};
  const point={id:'point',positions:new Float64Array([0,.002,.006]),triangles:new Int32Array(),inverseMass:new Float64Array([0]),thickness:.0075};
  const rows=[point,sheet];rows.forEach(g=>g.previous=g.positions.slice());
  const solver=new LayerContact(settings);solver.solve(rows,{passes:1});
  point.previous=point.positions.slice();point.positions.set([0,-.001,.008]);
  const before=rows.map(g=>g.positions.slice()),history=solver.measure(rows),fresh=new LayerContact(settings).measure(rows);
  near(history.residualMaxPenetration,0);near(fresh.residualMaxPenetration,0);
  rows.forEach((g,i)=>assert.deepEqual(g.positions,before[i]));
});

test('an unresolved unsigned free-edge proximity never seeds a later interior material side', () => {
 for(const advancePrevious of [false,true]){
  const settings={contactMargin:0,searchMargin:.003,maxCorrection:.001};
  const sheet={id:'sheet',positions:new Float64Array([0,0,0,1,0,0,0,1,0]),triangles:new Uint32Array([0,1,2]),inverseMass:new Float64Array(3),thickness:.0075};
  const point={id:'point',positions:new Float64Array([.25,-.006,-.003]),triangles:new Uint32Array(),inverseMass:new Float64Array([0]),thickness:.0075};
  const rows=[point,sheet];rows.forEach(g=>g.previous=g.positions.slice());
  point.previous.set([.25,-.007,-.004]);
  const solver=new LayerContact(settings),first=solver.solve(rows,{passes:1});assert.ok(first.residualMaxPenetration>0);
  if(advancePrevious)point.previous=point.positions.slice();point.positions.set([.25,.001,.008]);
  // At the only z=0 point of this linear path y is still -4.09 mm, outside
  // the actual open edge. This is a legal passage around it, not a face hit.
  const before=point.positions.slice(),result=solver.solve(rows,{passes:1});
  near(result.residualMaxPenetration,0);assert.equal(result.sweptCrossingCount,0);assert.deepEqual(point.positions,before);
 }
});

test('an internal-vertex pseudonormal reversal without a finite crossing cannot create a directed constraint', () => {
  const sheet={id:'sheet',positions:new Float64Array([0,0,0,.02,0,.02,0,.02,.02,-.02,0,.02,0,-.02,.02]),
    triangles:new Uint32Array([0,1,2,0,2,3,0,3,4,0,4,1]),inverseMass:new Float64Array(5),thickness:.004};
  const point={id:'point',positions:new Float64Array([0,0,-.003]),triangles:new Uint32Array(),inverseMass:new Float64Array([0]),thickness:.004};
  const rows=[point,sheet],solver=new LayerContact({contactMargin:0,searchMargin:.003,maxCorrection:.001});
  for(const row of rows)row.previous=row.positions.slice();
  const first=solver.solve(rows,{passes:1});near(first.residualMaxPenetration,.001);
  assert.equal(first.sweptCrossingCount,0);
  for(const row of rows)row.previous=row.positions.slice();
  sheet.positions[7]=-.02;sheet.positions[13]=.02;point.positions[2]=-.006;
  // The center has four incident faces and no free edge. Its average normal
  // reverses, but every actual triangle remains in z>=0 while the point stays
  // strictly below z=0. Individual triangles never degenerate. The fan may
  // overlap itself during this isolating probe; self collision is not tested.
  for(let i=2;i<sheet.positions.length;i+=3){assert.ok(sheet.previous[i]>=0);assert.ok(sheet.positions[i]>=0);}
  assert.ok(point.previous[2]<0&&point.positions[2]<0);
  const before=rows.map(row=>row.positions.slice()),measured=solver.measure(rows),solved=solver.solve(rows,{passes:1});
  assert.equal(measured.residualMaxPenetration,0);
  assert.equal(solved.residualMaxPenetration,0);
  assert.equal(solved.sweptCrossingCount,0);
  rows.forEach((row,i)=>assert.deepEqual(row.positions,before[i]));
});
