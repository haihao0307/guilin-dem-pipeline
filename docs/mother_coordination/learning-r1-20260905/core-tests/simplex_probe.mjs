/*
 * CPU study: 4D numeric core adapted from Jonas Wagner's simplex-noise.ts
 * Source commit: 6bfff874f5f0efed6375a9bf27fbd39b3cec6b4e
 * Source blob: 188e62a399bd5393d9f5c0fe34becd9a15921b2f
 * Read via GitHub connector; transcribed subset with TypeScript annotations
 * removed and formatting shortened. This is NOT a build of the full package.
 * Tests and recipe wrapper below are this study's code, not the upstream API.
 * Based on Stefan Gustavson's algorithm and Peter Eastman's optimisations.
 * Copyright (c) 2024 Jonas Wagner
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import assert from 'node:assert/strict';

const F4 = (Math.sqrt(5) - 1) / 4;
const G4 = (5 - Math.sqrt(5)) / 20;
const fastFloor = x => Math.floor(x) | 0;
const grad4 = new Float64Array([
  0,1,1,1, 0,1,1,-1, 0,1,-1,1, 0,1,-1,-1,
  0,-1,1,1, 0,-1,1,-1, 0,-1,-1,1, 0,-1,-1,-1,
  1,0,1,1, 1,0,1,-1, 1,0,-1,1, 1,0,-1,-1,
  -1,0,1,1, -1,0,1,-1, -1,0,-1,1, -1,0,-1,-1,
  1,1,0,1, 1,1,0,-1, 1,-1,0,1, 1,-1,0,-1,
  -1,1,0,1, -1,1,0,-1, -1,-1,0,1, -1,-1,0,-1,
  1,1,1,0, 1,1,-1,0, 1,-1,1,0, 1,-1,-1,0,
  -1,1,1,0, -1,1,-1,0, -1,-1,1,0, -1,-1,-1,0
]);
function buildPermutationTable(random) {
  const p = new Uint8Array(512);
  for (let i=0; i<256; i++) p[i]=i;
  for (let i=0; i<255; i++) {
    const r=i+~~(random()*(256-i));
    const aux=p[i]; p[i]=p[r]; p[r]=aux;
  }
  for (let i=256; i<512; i++) p[i]=p[i-256];
  return p;
}
function createNoise4D(random=Math.random) {
  const perm=buildPermutationTable(random);
  const gx=new Float64Array(perm).map(v=>grad4[(v%32)*4]);
  const gy=new Float64Array(perm).map(v=>grad4[(v%32)*4+1]);
  const gz=new Float64Array(perm).map(v=>grad4[(v%32)*4+2]);
  const gw=new Float64Array(perm).map(v=>grad4[(v%32)*4+3]);
  return function noise4D(x,y,z,w) {
    let n0,n1,n2,n3,n4;
    const s=(x+y+z+w)*F4;
    const i=fastFloor(x+s), j=fastFloor(y+s), k=fastFloor(z+s), l=fastFloor(w+s);
    const t=(i+j+k+l)*G4;
    const x0=x-(i-t), y0=y-(j-t), z0=z-(k-t), w0=w-(l-t);
    let rx=0,ry=0,rz=0,rw=0;
    if(x0>y0) rx++; else ry++;
    if(x0>z0) rx++; else rz++;
    if(x0>w0) rx++; else rw++;
    if(y0>z0) ry++; else rz++;
    if(y0>w0) ry++; else rw++;
    if(z0>w0) rz++; else rw++;
    const i1=rx>=3?1:0, j1=ry>=3?1:0, k1=rz>=3?1:0, l1=rw>=3?1:0;
    const i2=rx>=2?1:0, j2=ry>=2?1:0, k2=rz>=2?1:0, l2=rw>=2?1:0;
    const i3=rx>=1?1:0, j3=ry>=1?1:0, k3=rz>=1?1:0, l3=rw>=1?1:0;
    const x1=x0-i1+G4,y1=y0-j1+G4,z1=z0-k1+G4,w1=w0-l1+G4;
    const x2=x0-i2+2*G4,y2=y0-j2+2*G4,z2=z0-k2+2*G4,w2=w0-l2+2*G4;
    const x3=x0-i3+3*G4,y3=y0-j3+3*G4,z3=z0-k3+3*G4,w3=w0-l3+3*G4;
    const x4=x0-1+4*G4,y4=y0-1+4*G4,z4=z0-1+4*G4,w4=w0-1+4*G4;
    const ii=i&255,jj=j&255,kk=k&255,ll=l&255;
    let t0=.6-x0*x0-y0*y0-z0*z0-w0*w0;
    if(t0<0) n0=0; else {
      const gi=ii+perm[jj+perm[kk+perm[ll]]]; t0*=t0;
      n0=t0*t0*(gx[gi]*x0+gy[gi]*y0+gz[gi]*z0+gw[gi]*w0);
    }
    let t1=.6-x1*x1-y1*y1-z1*z1-w1*w1;
    if(t1<0) n1=0; else {
      const gi=ii+i1+perm[jj+j1+perm[kk+k1+perm[ll+l1]]]; t1*=t1;
      n1=t1*t1*(gx[gi]*x1+gy[gi]*y1+gz[gi]*z1+gw[gi]*w1);
    }
    let t2=.6-x2*x2-y2*y2-z2*z2-w2*w2;
    if(t2<0) n2=0; else {
      const gi=ii+i2+perm[jj+j2+perm[kk+k2+perm[ll+l2]]]; t2*=t2;
      n2=t2*t2*(gx[gi]*x2+gy[gi]*y2+gz[gi]*z2+gw[gi]*w2);
    }
    let t3=.6-x3*x3-y3*y3-z3*z3-w3*w3;
    if(t3<0) n3=0; else {
      const gi=ii+i3+perm[jj+j3+perm[kk+k3+perm[ll+l3]]]; t3*=t3;
      n3=t3*t3*(gx[gi]*x3+gy[gi]*y3+gz[gi]*z3+gw[gi]*w3);
    }
    let t4=.6-x4*x4-y4*y4-z4*z4-w4*w4;
    if(t4<0) n4=0; else {
      const gi=ii+1+perm[jj+1+perm[kk+1+perm[ll+1]]]; t4*=t4;
      n4=t4*t4*(gx[gi]*x4+gy[gi]*y4+gz[gi]*z4+gw[gi]*w4);
    }
    return 27*(n0+n1+n2+n3+n4);
  };
}

// Isolated study wrapper, not a production implementation.
function hash32(text) {
  let h=2166136261;
  for(const c of new TextEncoder().encode(text)) h=Math.imul(h^c,16777619)>>>0;
  return h || 1;
}
function random32(seed) {
  let s=seed>>>0 || 1;
  return () => {s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};
}
const recipe=Object.freeze({version:'simplex-study-1',seed:'wenzhou-synthetic-only',period:12,radius:1.2});
function field(id, r=recipe) {
  return createNoise4D(random32(hash32(JSON.stringify([r.version,r.seed,id]))));
}
const points=Array.from({length:64},(_,i)=>[(i%8-3.4)*.193,(Math.floor(i/8)-2.2)*.271,.317,.113]);
const values=n=>points.map(p=>n(...p));
const maxDiff=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
const results=[];
function check(name, fn) {results.push({name,...fn(),passed:true});}

check('seeded_replay_and_read_only_order',()=>{
 const n=field('fine'), a=values(n), b=values(field('fine',JSON.parse(JSON.stringify(recipe))));
 assert.deepEqual(a,b);
 const reversed=points.toReversed().map(p=>n(...p)).reverse(); assert.deepEqual(a,reversed);
 return {positions:64,rebuildMaxDifference:0,reorderedQueryMaxDifference:0};
});
check('channel_initialization_order',()=>{
 const init=ids=>Object.fromEntries(ids.map(id=>[id,field(id)]));
 const a=init(['swell','foam']),b=init(['foam','swell']);
 assert.deepEqual(values(a.swell),values(b.swell)); assert.deepEqual(values(a.foam),values(b.foam));
 function shared(ids){const rng=random32(17);return Object.fromEntries(ids.map(id=>[id,createNoise4D(rng)]));}
 const c=shared(['swell','foam']),d=shared(['foam','swell']);
 const wrong=maxDiff(values(c.swell),values(d.swell)); assert(wrong>.01);
 return {stableChannelComparisons:128,sharedStreamOrderCounterexampleMaxDifference:wrong};
});
check('sixteen_layers_preserve_first_eight_components',()=>{
 const build=n=>Array.from({length:n},(_,i)=>({id:`detail/${i}`,amplitude:.75**i,frequency:.125*2**i,n:field(`detail/${i}`)}));
 const a=build(8),b=build(16); let count=0;
 for(let i=0;i<8;i++) for(const p of points){
   const av=a[i].amplitude*a[i].n(...p.map(v=>v*a[i].frequency));
   const bv=b[i].amplitude*b[i].n(...p.map(v=>v*b[i].frequency)); assert.equal(av,bv);count++;
 }
 const denom8=a.reduce((s,l)=>s+l.amplitude,0),denom16=b.reduce((s,l)=>s+l.amplitude,0);
 const oldWeightRatio=denom8/denom16; assert(oldWeightRatio<.92);
 return {componentComparisons:count,activeCountNormalizationOldWeightRatio:oldWeightRatio,
  note:'Preserves named components, not a proof of disjoint spectral bands or whole surface invariance.'};
});
const n=field('loop');
function loop(x,y,t,r=recipe){
 if(!Number.isFinite(r.period)||r.period<=0||!Number.isFinite(t)) throw new RangeError('finite time and positive period required');
 const a=2*Math.PI*t/r.period;return n(x,y,r.radius*Math.cos(a),r.radius*Math.sin(a));
}
check('circle_loop_and_nonperiodic_linear_slice',()=>{
 let seam=0,slopeSeam=0,linear=0;
 for(const [x,y] of points){
   for(const t of [0,.37,2.9,6]) seam=Math.max(seam,Math.abs(loop(x,y,t)-loop(x,y,t+12)));
   const dt=1e-5, derivative=t=>(loop(x,y,t+dt)-loop(x,y,t-dt))/(2*dt);
   slopeSeam=Math.max(slopeSeam,Math.abs(derivative(0)-derivative(12)));
   linear=Math.max(linear,Math.abs(n(x,y,.317,0)-n(x,y,.317,1)));
 }
 assert(seam<1e-11);assert(slopeSeam<1e-7);assert(linear>.01);
 return {periodicValueComparisons:256,maxLoopSeam:seam,maxFiniteDifferenceSlopeSeam:slopeSeam,linearSliceEndDifference:linear};
});
check('spatial_tiling_and_mirror_counterexample',()=>{
 const Lx=8,Ly=5,R=1.1;
 const tile=(x,y)=>n(R*Math.cos(2*Math.PI*x/Lx),R*Math.sin(2*Math.PI*x/Lx),R*Math.cos(2*Math.PI*y/Ly),R*Math.sin(2*Math.PI*y/Ly));
 // Study equivalent of the incomplete one-trig-per-axis embedding. No MoonBit run.
 const folded=(x,y)=>n(Math.cos(2*Math.PI*x/Lx),Math.sin(2*Math.PI*y/Ly),0,.317);
 let seam=0,foldMirror=0,torusMirror=0;
 for(const [x,y] of points){
   seam=Math.max(seam,Math.abs(tile(x,y)-tile(x+Lx,y)),Math.abs(tile(x,y)-tile(x,y+Ly)));
   foldMirror=Math.max(foldMirror,Math.abs(folded(x,y)-folded(Lx-x,y)));
   torusMirror=Math.max(torusMirror,Math.abs(tile(x,y)-tile(Lx-x,y)));
 }
 assert(seam<1e-11);assert(foldMirror<1e-11);assert(torusMirror>.01);
 return {spatialEdgeComparisons:128,maxPeriodSeam:seam,oneTrigPerAxisMirrorDifference:foldMirror,fullEmbeddingMirrorDifference:torusMirror};
});
check('input_contract',()=>{
 function validated(...p){if(p.length!==4||p.some(v=>!Number.isFinite(v)||Math.abs(v)>2**20))throw new RangeError('study input limit');return n(...p);}
 for(const p of [[NaN,0,0,0],[Infinity,0,0,0],[2**31,0,0,0],[0,0,0]])assert.throws(()=>validated(...p),RangeError);
 assert.throws(()=>loop(.1,.2,1,{...recipe,period:0}),RangeError);
 assert.throws(()=>loop(.1,.2,1,{...recipe,period:-1}),RangeError);
 return {invalidInputCasesRejected:6,note:'2^20 is an imposed study-coordinate cap; not an upstream bound proof.'};
});
console.log(JSON.stringify({date:'2026-09-06',runtime:process.version,kernel:'transcribed and shortened 4D subset with MIT notice',groups:results.length,results,
 limits:['No full-package build or upstream test suite','No MoonBit execution or cross-language equivalence','No WebGL/WebGPU/browser or visual test','No physical ocean or geographic reconstruction','32-bit channel hash may collide; no independence proof','No compression or performance claim','Production code unchanged']},null,2));
