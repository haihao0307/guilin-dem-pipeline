import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createShedRayCertificate, clipShedEligibleRects, SHED_GUARD_INTERVAL_BOUNDS as bounds, SHED_CERTIFICATE_CONTRACT as contract, SHED_CERTIFICATE_TESTING as math} from './ray-certificate.mjs';
import {compactMerge} from '../compact-trace-r01/merge.mjs';

const precision = {precision: 23, rangeMin: 127, rangeMax: 127};
const options = {
  width: 640, height: 426, precision,
  inverseProjection: [.6535507367722118,0,0,0,0,.4350197091640035,0,0,0,0,0,-6.2484375,0,0,-1,6.2515625],
  cameraToLocal: [.7425697235686509,0,-.6697687702776067,0,-.17857972351804344,.9637992629686623,-.19799056303087423,0,.6455226471529846,.2666289194762328,.7156881522783091,0,96,48,48.758249387543714,1],
};
const stone = {x:177,y:261,w:18,h:18}, iron = {x:177,y:245,w:18,h:18};
const F = Math.fround;
const bits = new DataView(new ArrayBuffer(4));
function neighbor(x, direction) {
  if (!Number.isFinite(x) || x === 0 || !direction) return x;
  bits.setFloat32(0,x); let n=bits.getUint32(0); n += (x>0)===(direction>0)?1:-1; bits.setUint32(0,n); return bits.getFloat32(0);
}
function scalarRay(o,x,y,{fma=false,perturb=0,reciprocal=false,reciprocalLength=false}={}) {
  const divide=(a,b)=>neighbor(F(a/b),perturb), a=o.cameraToLocal.map(F),b=o.inverseProjection.map(F);
  const dot=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s=fma?F(s+a[i]*b[i]):F(s+F(a[i]*b[i]));return s;};
  const m=[];for(let c=0;c<4;c++)for(let r=0;r<4;r++)m[c*4+r]=dot([0,1,2,3].map(k=>a[r+k*4]),b.slice(c*4,c*4+4));
  let ndc=[F(F(divide(F(x+.5),F(o.width))*2)-1),F(F(divide(F(y+.5),F(o.height))*2)-1)];if(o.flipY)ndc[1]=-ndc[1];
  const point=z=>{const v=[...ndc,z,1],p=[0,1,2,3].map(r=>dot([0,1,2,3].map(k=>m[r+k*4]),v));return p.slice(0,3).map(n=>divide(n,p[3]));};
  const ro=point(-1),far=point(1),delta=far.map((v,i)=>F(v-ro[i]));
  const squared=dot(delta,delta),inv=neighbor(F(1/Math.sqrt(squared)),perturb);
  const length=reciprocal?divide(1,inv):F(Math.sqrt(squared));
  const rd=delta.map(v=>reciprocalLength?F(v*divide(1,length)):reciprocal?F(v*inv):divide(v,length));
  return {ro,rd,length};
}
function boxF32(p) {
  const q=p.map((v,i)=>F(Math.abs(F(v-contract.center[i]))-contract.half[i]));
  const positive=q.map(v=>Math.max(v,0));
  const squared=positive.reduce((s,v)=>F(s+F(v*v)),0);
  return F(F(Math.sqrt(squared))+Math.min(Math.max(...q),0));
}
function pixels(rects) { const out=new Set();for(const r of rects)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){const key=x+','+y;assert(!out.has(key),'output rectangles must be disjoint');out.add(key);}return out; }

test('source lock: exact shed guard, constants, reset and sole group3 proxy remain authoritative',()=>{
  for(let i=3;i<=8;i++){
    const s=fs.readFileSync(new URL('../../generated/group-'+i+'.wgsl',import.meta.url),'utf8');
    for(const part of ['const SHED_HALF:f32=67.5;','const SHED_CENTER:f32=-77.5;','let shedBox=box(p-vec3<f32>(0,7,SHED_CENTER),vec3<f32>(34,8,SHED_HALF+2.2));','if(shedBox<2.){','stationCandidates.count=0u;stationCandidateOverflow=false;stationRawCandidateCount=0u;stationCandidateUpper=10000.;','var h=HitField(10000.,0u,p,0.,10000.,vec3<f32>(1.),0.);'])assert(s.includes(part),i+':'+part);
    assert.equal(s.includes('else{recordPart(p,shedBox,0u,p,0.);}'),i===3);
  }
  assert.equal(contract.half[2],69.69999694824219);
  assert(bounds.lo[2]<-149.2&&bounds.hi[2]>-5.8);
});

test('saved full-resolution pixel centers: stone halo excluded, crossing iron rays retained',()=>{
  const c=createShedRayCertificate(options),a=c.partitionRects([stone]),b=c.partitionRects([iron]);
  assert(c.qualified);assert.equal(a.totalPixels,324);assert.equal(a.excludedPixels,324);
  assert(b.eligiblePixels>=16&&b.eligiblePixels<324);
  for(const x of[192,193,194])assert(c.eligible(x,245));
  assert.equal(c.partitionRects([{x:193,y:256,w:1,h:1}]).excludedPixels,1);
  const first=math.rayIntervalsAt(options,177,261),crop=math.rayIntervalsAt({...options,width:18,height:18},0,0);
  assert.notDeepEqual(first.rd,crop.rd,'scissor must not replace the original viewport or pixel center');
});

test('snapshot/key includes f32 matrices, viewport and flip; later caller mutation cannot change a certificate',()=>{
  const o={...options,cameraToLocal:options.cameraToLocal.slice()},a=createShedRayCertificate(o),key=a.key;
  o.cameraToLocal[12]=-900;assert.equal(a.key,key);assert.equal(a.eligible(177,261),false);
  assert.notEqual(createShedRayCertificate(o).key,key);
  assert.notEqual(createShedRayCertificate({...options,flipY:1}).key,key);
  const same={...options,cameraToLocal:options.cameraToLocal.map(F),inverseProjection:options.inverseProjection.map(F)};
  assert.equal(createShedRayCertificate(same).key,key);
});

test('bad precision, nonfinite/huge matrices, zero w/direction fail closed',()=>{
  for(const override of [{precision:null},{precision:{...precision,precision:22}},{precision:{...precision,rangeMin:126}},{cameraToLocal:Array(16).fill(NaN)},{cameraToLocal:Array(16).fill(Infinity)},{cameraToLocal:Array(16).fill(4096)},{width:0}]){
    const c=createShedRayCertificate({...options,...override});assert.equal(c.qualified,false);assert.equal(c.eligible(177,261),true);
  }
  const zero=createShedRayCertificate({...options,inverseProjection:Array(16).fill(0)});assert(zero.qualified);assert(zero.eligible(177,261));assert.equal(zero.stats.uncertainPixels,1);
  const c=createShedRayCertificate({...options,precision:null});assert.deepEqual(c.partitionRects([stone]).rects,[stone]);
  assert(c.eligible(-1,0));assert(c.eligible(1.5,2));
});

test('slab proof retains touching, inside, parallel uncertainty and ranges outside its proof',()=>{
  const ray=(x,d=[0,1,0],length=10)=>({ro:[x,7,-77.5].map(v=>[v,v]),rd:d.map(v=>[v,v]),length:[length,length]});
  for(const x of[0,34,36,bounds.hi[0]])assert.equal(math.certifyMiss(ray(x)),false);
  assert.equal(math.certifyMiss(ray(36.1)),true);
  const uncertain=ray(36.1);uncertain.rd[0]=[-.1,.1];assert.equal(math.certifyMiss(uncertain),false);
  assert.equal(math.certifyMiss(ray(36.1,[0,1,0],8192)),false);
  const large=ray(36.1);large.ro[2]=[4096,4096];assert.equal(math.certifyMiss(large),false);
  const nan=ray(36.1);nan.rd[2]=[NaN,NaN];assert.equal(math.certifyMiss(nan),false);
  assert.equal(math.certifyMiss({ro:[[0,0],[7,7],[0,0]],rd:[[0,0],[0,0],[1,1]],length:[300,300]}),true,'back-facing ray never reaches shed');
});

test('outward intervals include separate/FMA arithmetic, division perturbation and three normalize lowerings',()=>{
  let count=0;
  for(const flipY of[0,1])for(const [x,y]of[[0,0],[639,425],[177,261],[194,245],[193,256],[319,212]]){
    const o={...options,flipY},range=math.rayIntervalsAt(o,x,y);
    for(const fma of[false,true])for(const lowering of[0,1,2])for(const perturb of[-1,0,1]){
      const r=scalarRay(o,x,y,{fma,reciprocal:lowering===1,reciprocalLength:lowering===2,perturb});
      for(const name of['ro','rd'])for(let k=0;k<3;k++)assert(r[name][k]>=range[name][k][0]&&r[name][k]<=range[name][k][1],`${name}[${k}]`);
      assert(r.length>=range.length[0]&&r.length<=range.length[1]);count++;
    }
  }
  assert.equal(count,216);
});

test('sampled f32 query points for every excluded halo ray never enter the original guard',()=>{
  const c=createShedRayCertificate(options);let checked=0;
  for(const rect of[stone,iron])for(let y=rect.y;y<rect.y+rect.h;y++)for(let x=rect.x;x<rect.x+rect.w;x++)if(!c.eligible(x,y)){
    for(const fma of[false,true]){
      const r=scalarRay(options,x,y,{fma});
      for(let k=0;k<=24;k++){const t=F(r.length*k/24),p=r.ro.map((v,i)=>fma?F(v+r.rd[i]*t):F(v+F(r.rd[i]*t)));assert(!(boxF32(p)<2));checked++;}
    }
  }
  assert(checked>20000);
});

test('rectangle partition is exact union with original pixel coordinates, overlaps and gaps',()=>{
  const c={width:12,height:9,eligible:(x,y)=>(x+y)%4!==0},rs=[{x:1,y:1,w:6,h:3},{x:4,y:2,w:5,h:4},{x:1,y:7,w:3,h:1}];
  const result=clipShedEligibleRects(rs,c),actual=pixels(result.rects),input=new Set();
  for(const r of rs)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)input.add(x+','+y);
  const expected=new Set([...input].filter(s=>c.eligible(...s.split(',').map(Number))));
  assert.deepEqual(actual,expected);assert.equal(result.totalPixels,input.size);assert.equal(result.eligiblePixels,expected.size);
  assert.deepEqual(clipShedEligibleRects([],c).rects,[]);
  assert.throws(()=>clipShedEligibleRects([{x:-1,y:0,w:2,h:1}],c));
});

test('one prefix copy preserves canonical compact ping-pong order, raw/overflow/invalidity and ties',()=>{
  const empty={a:[10000,0,10000,0],raw:0,overflow:false};
  for(const outside of[false,true])for(const invalid of[false,true])for(const overflow of[false,true]){
    const samples=Array.from({length:12},(_,i)=>({a:[i===2?.5:1,i+1,invalid&&i===2?NaN:1,0],raw:overflow?9:1,overflow:false}));
    if(outside)for(let i=4;i<=8;i++)samples[i]=empty;
    let reference=[10000,0,0,0];for(const s of samples)reference=compactMerge(reference,s.a,s.raw,s.overflow);
    const targets=[[10000,0,0,0],null];let previous=targets[0];
    for(let i=0;i<12;i++){
      if(i===4)targets[0]=targets[1].slice();
      const out=i%2;if(!(outside&&i>=4&&i<=8)){const s=samples[i];targets[out]=compactMerge(previous,s.a,s.raw,s.overflow);}
      previous=targets[out];
    }
    assert.deepEqual(previous,reference);
  }
  assert.deepEqual(compactMerge([10001,17,4,2],empty.a,0,false),[10000,0,4,0],'empty group is not arbitrary-input identity');
  assert.deepEqual(compactMerge([Infinity,17,4,2],empty.a,0,false),[10000,0,4,0]);
  assert.deepEqual(compactMerge([10000,17,96,2],empty.a,0,false),[10000,17,96,2],'strict ties retain invalidity and identity');
});
