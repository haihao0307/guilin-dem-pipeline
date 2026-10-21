import test from 'node:test';
import assert from 'node:assert/strict';
import {LayerContact} from '../src/layer-contact.mjs';
import {LayerContact as FrozenR02} from '../../tailor-layering-r02/src/layer-contact.mjs';
import {LiveFeatureBounds,separatedLiveVertexFace,separatedLiveEdges} from '../src/local-broadphase.mjs';

// TEST_FIXTURE_ONLY: these synthetic surfaces never enter the workbench.
const clone=rows=>rows.map(g=>({...g,positions:g.positions.slice(),previous:g.previous?.slice(),triangles:g.triangles.slice(),inverseMass:g.inverseMass?.slice()}));
const options={contactMargin:0,searchMargin:.02,maxCorrection:.004,cellSize:.025,cacheSkin:.008};
const withoutTimings=result=>{const {timings,...other}=result;return other;};
function same(legacy,optimized,a,b,settings={passes:2}) {
  const x=legacy.solve(a,settings),y=optimized.solve(b,settings);
  a.forEach((g,i)=>assert.deepEqual(g.positions,b[i].positions,`garment ${g.id}: byte-identical positions`));
  assert.deepEqual(withoutTimings(x),withoutTimings(y));
  assert.deepEqual([...legacy._sides],[...optimized._sides]);
  assert.deepEqual([...legacy._frameSides],[...optimized._frameSides]);
  assert.deepEqual([...legacy._edgeReferences],[...optimized._edgeReferences]);
  return [x,y];
}
function pointAndSquare(z=-.02) {
  return [
    {id:'point',positions:new Float64Array([.49,.49,z]),previous:new Float64Array([.49,.49,.02]),triangles:new Uint32Array(),thickness:.004},
    {id:'sheet',positions:new Float64Array([0,0,0,1,0,0,0,1,0,1,1,0]),triangles:new Uint32Array([0,1,2,1,3,2]),inverseMass:new Float64Array(4),thickness:.004},
  ];
}
function sheet(id,n,z) {
  const p=new Float64Array(n*n*3),t=[];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const k=(y*n+x)*3;p[k]=x*.01;p[k+1]=y*.01;p[k+2]=z;}
  for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){const k=y*n+x;t.push(k,k+1,k+n,k+1,k+n+1,k+n);}
  return {id,positions:p,triangles:new Uint32Array(t),thickness:.004};
}

test('OFF remains the frozen R02 trajectory and ON preserves the exact ordered result',()=>{
  const original=pointAndSquare(),a=clone(original),b=clone(original),c=clone(original);
  const legacy=new FrozenR02(options),off=new LayerContact({...options,optimizationEnabled:false}),on=new LayerContact(options);
  for(let step=0;step<18;step++){
    for(const rows of [a,b,c]){
      if(step){rows[0].previous=rows[0].positions.slice();rows[0].positions[0]+=.002;rows[0].positions[1]+=.001;rows[0].positions[2]-=.001;}
      if(step===4){rows[0].positions[0]=rows[0].positions[1]=.51;}
      if(step===9){rows[0].positions[0]=1.1;rows[0].positions[1]=.5;}
    }
    const reference=legacy.solve(a,{passes:1}),disabled=off.solve(b,{passes:1}),enabled=on.solve(c,{passes:1});
    assert.deepEqual(withoutTimings(disabled),withoutTimings(reference));
    assert.deepEqual(withoutTimings(enabled),withoutTimings(reference));
    a.forEach((g,i)=>{assert.deepEqual(g.positions,b[i].positions);assert.deepEqual(g.positions,c[i].positions);});
    assert.deepEqual([...legacy._sides],[...on._sides]);
  }
});

test('rejected safe regions reduce finite-feature tests without dropping candidate order',()=>{
  const original=[sheet('a',12,0),sheet('b',12,.012)],a=clone(original),b=clone(original);
  const [off,on]=same(new LayerContact({...options,optimizationEnabled:false}),new LayerContact(options),a,b);
  assert.equal(off.candidateCount,on.candidateCount);
  assert.ok(off.timings.vertexFaceTests>0&&off.timings.edgeEdgeTests>0);
  assert.equal(on.timings.vertexFaceTests,0);
  assert.equal(on.timings.edgeEdgeTests,0);
  assert.ok(on.timings.localBoundsRejectedVF>0&&on.timings.localBoundsRejectedEE>0);
});

test('every reciprocal correction refits incident features before the next visit',()=>{
  const original=[sheet('a',6,0),sheet('b',6,.001)],a=clone(original),b=clone(original);
  const off=new LayerContact({...options,optimizationEnabled:false}),on=new LayerContact(options);
  for(let step=0;step<10;step++){
    if(step)for(const rows of [a,b])for(const g of rows){g.previous=g.positions.slice();for(let k=2;k<g.positions.length;k+=3)g.positions[k]+=(g.id==='a'?1:-1)*.0003;}
    const [,result]=same(off,on,a,b,{passes:3,friction:.2});
    if(result.correctionCount)assert.ok(result.timings.localBoundsRefitFaces>0&&result.timings.localBoundsRefitEdges>0);
  }
});

test('swept edge crossings and retained unresolved sides survive the optimization switch',()=>{
  const original=[
    {id:'a',positions:new Float64Array([-.03,0,-.02,.03,0,-.02,0,-.03,-.02]),previous:new Float64Array([-.03,0,.02,.03,0,.02,0,-.03,.02]),triangles:new Uint32Array([0,1,2]),thickness:.004},
    {id:'b',positions:new Float64Array([0,-.03,0,0,.03,0,.03,0,0]),triangles:new Uint32Array([0,1,2]),inverseMass:new Float64Array(3),thickness:.004},
  ];
  const a=clone(original),b=clone(original),off=new LayerContact({...options,optimizationEnabled:false}),on=new LayerContact(options);
  let crossings=0;
  for(let step=0;step<8;step++){
    if(step)for(const rows of [a,b])for(const g of rows)g.previous=g.positions.slice();
    if(step===2)on.setOptimizationEnabled(false);
    if(step===4)on.setOptimizationEnabled(true);
    const [r]=same(off,on,a,b,{passes:1});crossings+=r.sweptCrossingCount;
  }
  assert.ok(crossings>0);
  assert.throws(()=>on.setOptimizationEnabled(1),/boolean/);
});

test('measurement and rollback preserve geometry and contact provenance',()=>{
  const original=pointAndSquare(),a=clone(original),b=clone(original),off=new LayerContact({...options,optimizationEnabled:false}),on=new LayerContact(options);
  same(off,on,a,b,{passes:1});
  const saveA=off.checkpoint(),saveB=on.checkpoint(),positions=a.map(g=>g.positions.slice());
  const mA=off.measure(a),mB=on.measure(b);assert.deepEqual(withoutTimings(mA),withoutTimings(mB));
  same(off,on,a,b,{passes:4});
  a.forEach((g,i)=>{g.positions.set(positions[i]);b[i].positions.set(positions[i]);});
  off.restore(saveA);on.restore(saveB);same(off,on,a,b,{passes:4});
});

test('live-bound refit has a negative control for stale triangle and edge boxes',()=>{
  const point={count:1,positions:new Float64Array([0,0,0]),previous:new Float64Array([0,0,0]),triangles:new Uint32Array(),topology:{edgeVertices:new Uint32Array(),vertexFaces:[[]]}};
  const triangle={count:3,positions:new Float64Array([2,0,0,2,1,0,2,0,1]),previous:new Float64Array([2,0,0,2,1,0,2,0,1]),triangles:new Uint32Array([0,1,2]),topology:{edgeVertices:new Uint32Array([0,1,1,2,0,2]),vertexFaces:[[0],[0],[0]]}};
  const a=new LiveFeatureBounds(point),b=new LiveFeatureBounds(triangle);
  assert.equal(separatedLiveVertexFace(a,0,b,0,.01),true);
  triangle.positions[0]=0;
  assert.equal(separatedLiveVertexFace(a,0,b,0,.01),true,'negative control: a stale box would incorrectly reject the moved feature');
  b.refitVertex(0);
  assert.equal(separatedLiveVertexFace(a,0,b,0,.01),false);
  assert.equal(separatedLiveEdges(b,0,b,2,.01),false);
  assert.ok(b.points[0]===0&&b.faces[0]===0&&b.edges[0]===0);
});
