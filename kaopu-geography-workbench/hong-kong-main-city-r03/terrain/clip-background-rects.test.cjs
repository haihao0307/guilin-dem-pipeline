'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { clipTerrainOutsideRects: clip, rectanglesFromManifest } = require('./clip-background-rects.js');
const rect = (minX, minZ, maxX, maxZ) => ({ minX, minZ, maxX, maxZ });
const attrs = (x, z) => [x, 4 + 2*x - .5*z, z, .2 + x*.01, 1 + z*.02, .3 - x*.01 + z*.03, .5 + x*.01 + z*.02];
const mesh = (points, indices = [0, 1, 2]) => ({positions: Float64Array.from(points.flatMap(p=>attrs(...p))), indices});
const a2 = (a,b,c) => (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
function triAt(v, ind, i) { return Array.from(ind.slice(i,i+3), j=>[v[j*7],v[j*7+2]]); }
function polygonArea(p) { let a=0; for(let i=1;i+1<p.length;i++)a+=a2(p[0],p[i],p[i+1]);return Math.abs(a)/2; }
// Independent reference: retain only the inside of a rectangle, Sutherland-Hodgman.
function intersectionArea(triangle, r) {
  let p=triangle;
  for (const [axis,bound,ge] of [[0,r.minX,true],[0,r.maxX,false],[1,r.minZ,true],[1,r.maxZ,false]]) {
    const out=[];
    for(let i=0;i<p.length;i++) {
      const a=p[i], b=p[(i+1)%p.length], ina=ge?a[axis]>=bound:a[axis]<=bound, inb=ge?b[axis]>=bound:b[axis]<=bound;
      if(ina)out.push(a);
      if(ina!==inb){const t=(bound-a[axis])/(b[axis]-a[axis]);const q=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];q[axis]=bound;out.push(q);}
    }
    p=out;
  }
  return polygonArea(p);
}
function unionIntersectionArea(t, rs) {
  let total=0;
  for(let bits=1;bits<(1<<rs.length);bits++) {
    let r=rect(-Infinity,-Infinity,Infinity,Infinity),count=0;
    for(let j=0;j<rs.length;j++)if(bits&(1<<j)){
      r=rect(Math.max(r.minX,rs[j].minX),Math.max(r.minZ,rs[j].minZ),Math.min(r.maxX,rs[j].maxX),Math.min(r.maxZ,rs[j].maxZ));count++;
    }
    if(r.minX<r.maxX&&r.minZ<r.maxZ)total+=(count%2?1:-1)*intersectionArea(t,r);
  }
  return total;
}
function close(actual, expected, abs=1e-10, message='') {
  assert.ok(Math.abs(actual-expected)<=abs,`${message}: ${actual} != ${expected}; delta ${actual-expected}`);
}
function verify(input, rs, result=clip(input.positions,input.indices,rs,{traceSources:true}), tolerance=1e-9) {
  let before=0, expected=0, after=0;
  for(let i=0;i<input.indices.length;i+=3){const t=triAt(input.positions,input.indices,i),area=polygonArea(t);before+=area;expected+=area-unionIntersectionArea(t,rs);}
  for(let i=0;i<result.indices.length;i+=3) {
    const t=triAt(result.positions,result.indices,i),source=result.triangleSources[i/3],original=triAt(input.positions,input.indices,source*3);
    assert.ok(a2(...t)*a2(...original)>0,'Winding must match the original, with no zero area');
    after+=polygonArea(t);
    for(const r of rs)close(intersectionArea(t,r),0,tolerance,'No indexed output area inside a removed rectangle');
    for(let k=0;k<3;k++){
      const idx=result.indices[i+k],p=t[k],d=a2(...original),w1=a2(original[0],p,original[2])/d,w2=a2(original[0],original[1],p)/d;
      assert.ok(w1>=-1e-10&&w2>=-1e-10&&w1+w2<=1+1e-10,'Output remains within its source triangle');
      for(const component of [1,3,4,5,6]) {
        const ids=input.indices.slice(source*3,source*3+3),a=input.positions[ids[0]*7+component],b=input.positions[ids[1]*7+component],c=input.positions[ids[2]*7+component];
        close(result.positions[idx*7+component],a+w1*(b-a)+w2*(c-a),tolerance,'Original plane/normal/mask affine interpolation');
      }
    }
  }
  close(after,expected,tolerance*Math.max(1,input.indices.length/3),'Area conservation');
  close(result.stats.sourceAreaXZ,before,tolerance*Math.max(1,input.indices.length/3));
  close(result.stats.outputAreaXZ,after,tolerance*Math.max(1,input.indices.length/3));
  close(result.stats.removedAreaXZ,before-after,tolerance*Math.max(1,input.indices.length/3));
  assert.deepEqual(Array.from(result.positions.slice(0,input.positions.length)),Array.from(input.positions),'Old vertex prefix exactly preserved');
  return result;
}

test('browser global and CommonJS expose the same explicit API',()=>{
  const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'clip-background-rects.js'),'utf8'),context);
  assert.equal(typeof context.HKBackgroundRectClip.clipTerrainOutsideRects,'function');
  assert.equal(context.HKBackgroundRectClip.STRIDE,7);
});
test('no cuts creates independent arrays and preserves every source value and index',()=>{
  const input=mesh([[0,0],[0,10],[10,0]]);input.positions[3]=-0;
  const result=verify(input,[]);assert.deepEqual(Array.from(result.indices),input.indices);
  result.positions[1]=999;result.indices[0]=2;assert.equal(input.positions[1],4);assert.equal(input.indices[0],0);
});
test('bbox overlap without actual triangle intersection is preserved byte for byte',()=>{
  const input=mesh([[0,0],[0,10],[10,0]]),result=verify(input,[rect(7,7,9,9)]);
  assert.deepEqual(Array.from(result.indices),input.indices);assert.equal(result.stats.appendedVertices,0);assert.equal(result.stats.clippedTriangles,0);
});
for(const [name,r] of [
  ['one edge crossing',rect(3,-2,6,12)],['internal rectangle',rect(1,1,3,3)],
  ['covers triangle',rect(-1,-1,12,12)],['shares a full source edge',rect(0,-2,12,0)],
  ['touches one vertex',rect(10,0,12,2)],['collinear diagonal corner',rect(5,5,8,8)],
  ['exact enclosing half-open boundary',rect(0,0,10,10)],['thin strict interior',rect(2,2,2+1e-8,4)],
  ['source edge lies on rectangle boundary',rect(0,2,5,4)]
])test(name,()=>{for(const ids of [[0,1,2],[2,1,0]])verify(mesh([[0,0],[0,10],[10,0]],ids),[r]);});
test('4 adjacent rectangles subtract a union without duplicate coverage at shared edges',()=>{
  const input=mesh([[-5,-5],[-5,20],[20,-5]]),rs=[rect(0,0,4,4),rect(4,0,8,4),rect(0,4,4,8),rect(4,4,8,8)];verify(input,rs);
  const result=verify(input,[rect(0,0,8,8)]);close(clip(input.positions,input.indices,rs).stats.outputAreaXZ,result.stats.outputAreaXZ);
});
test('overlapping, duplicate and nested rectangles are a union and idempotent',()=>{
  const input=mesh([[-5,-5],[-5,25],[25,-5]]),rs=[rect(0,0,6,6),rect(3,3,8,8),rect(0,0,6,6),rect(1,1,2,2)];
  const result=verify(input,rs),again=clip(result.positions,result.indices,rs);
  assert.deepEqual(again.indices,result.indices);assert.deepEqual(again.positions,result.positions);
});
test('zero-area source/fan triangles are filtered, both source windings remain legal',()=>{
  const input=mesh([[0,0],[1,1],[2,2],[0,5],[5,0]],[0,1,2,0,3,4,4,3,0]);
  const result=verify(input,[rect(1,0,3,2)]);assert.ok(result.stats.droppedDegenerateTriangles>=1);assert.equal(result.stats.droppedRoundoffTriangles,0);
});
test('Float32 input, masks and unnormalized normals remain untouched and linearly interpolated',()=>{
  const input=mesh([[0,0],[0,10],[10,0]]);input.positions=Float32Array.from(input.positions);input.positions[6]=0;input.positions[13]=2;input.positions[20]=1;
  const v=Buffer.from(input.positions.buffer).toString('hex'),ind=JSON.stringify(input.indices);const result=verify(input,[rect(2,1,7,6)]);
  assert.equal(Buffer.from(input.positions.buffer).toString('hex'),v);assert.equal(JSON.stringify(input.indices),ind);
  assert.ok(Array.from(result.positions).filter((_,i)=>i%7===6).some(v=>v>0&&v<1));
});
test('large world offsets and exact-boundary cuts retain local-area precision',()=>{
  const input=mesh([[837400,819830],[837400,819860],[837430,819830]]);verify(input,[rect(837405,819833,837421,819849)],undefined,1e-6);
});
test('deterministic fuzz: conservation, winding, containment, attributes and union subtraction',()=>{
  let seed=0x9451abcd;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let n=0;n<600;n++){
    let points=Array.from({length:3},()=>[random()*40-20,random()*40-20]);if(Math.abs(a2(...points))<.01){n--;continue;}
    const rs=Array.from({length:4},()=>{const x=random()*30-15,z=random()*30-15;return rect(x,z,x+.1+random()*10,z+.1+random()*10);});
    verify(mesh(points),rs,undefined,1e-8);
  }
});
test('manifest conversion uses explicit source coordinates, not cell-center extents',()=>{
  const m={coordinateReference:{mapOrigin:[834000,827000]},patches:[{id:'n',bounds_epsg2326:[837400,819830,838000,820500]}]};
  assert.deepEqual(rectanglesFromManifest(m),[rect(3400,6500,4000,7170)]);
});
test('invalid shape, bounds, indices and nonfinite clipped attributes fail closed',()=>{
  const input=mesh([[0,0],[0,10],[10,0]]);
  assert.throws(()=>clip([0,0,0],[0,1,2],[]),/stride/);
  assert.throws(()=>clip(input.positions,[0,1],[]),/complete/);
  assert.throws(()=>clip(input.positions,[0,1,999],[]),/index/);
  assert.throws(()=>clip(input.positions,input.indices,[rect(1,1,1,2)]),/Rectangle/);
  input.positions[1]=NaN;assert.throws(()=>clip(input.positions,input.indices,[rect(2,1,7,6)]),/finite/);
});

module.exports={rect,polygonArea,intersectionArea,triAt};
