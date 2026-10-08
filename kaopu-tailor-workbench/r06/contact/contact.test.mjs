import {strict as assert} from 'node:assert';
import {SweptContact} from './swept-contact.mjs';
function lab(before,after,edges,triangles,weights){const ids=after.map((_,i)=>i);return{positions:after.map(p=>[...p]),_old:Float64Array.from(before.flat()),meshEdges:edges,triangles:triangles.map(ids=>({ids})),invMass:weights,offsets:new Map(),spec:{seams:[]},stitchGroups:{groupCount:ids.length,find:i=>i}};}
// VF crosses a fixed face entirely in one step; neither endpoint is near it.
const fixed=[[-.05,-.05,0],[.05,-.05,0],[0,.05,0]];
let l=lab([...fixed,[0,0,.02]],[...fixed,[0,0,-.02]],[[0,1],[1,2],[2,0]],[[0,1,2]],[0,0,0,1]);
let c=new SweptContact(l);c.rebuild();c.project();assert(l.positions[3][2]>=.00079);assert(c.sweptHits>0);assert.deepEqual(l.positions.slice(0,3),fixed);
// EE crossing has no triangles and no vertex-face event. Fixed edge stays fixed.
l=lab([[-.05,0,0],[.05,0,0],[0,.02,-.05],[0,.02,.05]],[[-.05,0,0],[.05,0,0],[0,-.02,-.05],[0,-.02,.05]],[[0,1],[2,3]],[],[0,0,1,1]);
c=new SweptContact(l);c.rebuild();c.project();assert(l.positions[2][1]>=.00079&&l.positions[3][1]>=.00079);assert(c.sweptHits>0);
// A nearby non-crossing primitive moving apart must not be attracted.
l=lab([...fixed,[0,0,.002]],[...fixed,[0,0,.003]],[[0,1],[1,2],[2,0]],[[0,1,2]],[0,0,0,1]);c=new SweptContact(l);c.rebuild();c.project();assert.equal(l.positions[3][2],.003);assert.equal(c.corrections,0);
console.log('swept VF, EE and separating-motion tests passed');
// Sweep through a thin SDF slab with both endpoint positions outside it.
l=lab([[0,0,.02]],[[0,0,-.02]],[],[],[1]);l.clearance=.0035;l.sdf={sample:(x,y,z,q)=>{q.set([Math.abs(z)-.0015,0,0,z>=0?1:-1,1]);return q;}};
c=new SweptContact(l);c.bodySweep();assert(l.positions[0][2]>=.0049);assert.equal(c.bodySweptHits,1);
console.log('swept body slab test passed');

// Independent JS reference compared with the optimized collision-only WASM path.
import {readFileSync} from 'node:fs';
import {FastSweptContact,configureContactWasm} from './fast-contact.mjs';
configureContactWasm(readFileSync(new URL('./contact-kernel.wasm',import.meta.url)));
for(const edgeOnly of [false,true]){
 const before=edgeOnly?[[-.05,0,0],[.05,0,0],[0,.02,-.05],[0,.02,.05]]:[...fixed,[0,0,.02]],after=edgeOnly?[[-.05,0,0],[.05,0,0],[0,-.02,-.05],[0,-.02,.05]]:[...fixed,[0,0,-.02]],edges=edgeOnly?[[0,1],[2,3]]:[[0,1],[1,2],[2,0]],triangles=edgeOnly?[]:[[0,1,2]],weights=edgeOnly?[0,0,1,1]:[0,0,0,1];
 const a=lab(before,after,edges,triangles,weights),b=lab(before,after,edges,triangles,weights),reference=new SweptContact(a),fast=new FastSweptContact(b);reference.rebuild();reference.project();fast.rebuild();fast.project();for(let i=0;i<a.positions.length;i++)for(let k=0;k<3;k++)assert(Math.abs(a.positions[i][k]-b.positions[i][k])<1e-10);assert(fast.sweptHits>0);
}
console.log('independent JS / f64 WASM swept VF and EE agreement passed');

// Free material adjacent to a needle must still collide with the other panel.
l=lab([[0,0,0],[.004,0,0],[0,0,0],[0,.01,0],[.01,0,0]],[[0,0,0],[.004,0,0],[0,0,0],[0,.01,0],[.01,0,0]],[[0,1],[2,3],[3,4],[4,2]],[[2,3,4]],[1,1,1,1,1]);
l.offsets=new Map([['skirt',0],['band',2]]);l.spec.seams=[{a:{panelId:'skirt'},b:{panelId:'band'},stitchVertexPairs:[[0,0]]}];
c=new SweptContact(l);c.refreshTopology();assert(c.exclude([0],[2]));assert(!c.exclude([1],[2,3,4]));assert(c.exclude([2],[2,3,4]));
console.log('exact seam adjacency preserves free gathering collision candidates');

import {orderedSeams} from './seam-order.mjs';
const seam=(id,a,b)=>({id,a:{panelId:a,edge:'e2',reverse:false},b:{panelId:b,edge:'e1',reverse:true}});
const input=[seam('original-9','skirt','band'),seam('original-1','torso','band'),seam('original-5','a','b')], original=JSON.stringify(input);
assert.deepEqual(orderedSeams(input).map(s=>s.id),orderedSeams([...input].reverse()).map(s=>s.id));assert.equal(JSON.stringify(input),original);assert.equal(orderedSeams(input).length,input.length);
console.log('physical seam ordering is stable, source IDs and inputs preserved');

// Bucket reuse is permitted only while every swept primitive remains contained.
// Current bounds/candidates are recomputed even when spatial buckets are retained.
l=lab([...fixed,[0,0,.02]],[...fixed,[0,0,.02]],[[0,1],[1,2],[2,0]],[[0,1,2]],[0,0,0,1]);
c=new FastSweptContact(l);c.rebuild();const firstBuckets=c.cachedTB;c.project();
for(const p of l.positions)p[0]+=.001;c.rebuild();assert.equal(c.cachedTB,firstBuckets);assert.equal(c.bucketReuses,1);c.project();
for(const p of l.positions)p[0]+=.02;c.rebuild();assert.notEqual(c.cachedTB,firstBuckets);assert.equal(c.bucketRebuilds,2);
console.log('spatial bucket reuse requires conservative swept-box containment');

// Optimized stamp deduplication must preserve the reference candidate stream,
// including order, since sequential contact response is order-dependent.
for(const edgeOnly of [false,true]){
 const before=edgeOnly?[[-.05,0,0],[.05,0,0],[0,.02,-.05],[0,.02,.05]]:[...fixed,[0,0,.02]],after=edgeOnly?[[-.05,0,0],[.05,0,0],[0,-.02,-.05],[0,-.02,.05]]:[...fixed,[0,0,-.02]],edges=edgeOnly?[[0,1],[2,3]]:[[0,1],[1,2],[2,0]],triangles=edgeOnly?[]:[[0,1,2]],weights=edgeOnly?[0,0,1,1]:[0,0,0,1];
 const ll=lab(before,after,edges,triangles,weights),cc=new FastSweptContact(ll);cc.rebuild();cc.rows=[];cc.collecting=true;SweptContact.prototype.project.call(cc);const expected=cc.rows.slice();cc.rows=[];cc.collectCandidates();assert.deepEqual(cc.rows,expected);cc.collecting=false;
 cc.stamp=2147483646;cc.rows=[];cc.collectCandidates();assert.deepEqual(cc.rows,expected);
}
console.log('optimized candidate stream and stamp rollover match independent Set reference');

import {liftedSupportPosition} from './support-path.mjs';
const hold={start:[.177,1.502,-.25],target:[.176,1.535,.00846]},maxY=Math.max(hold.start[1],hold.target[1])+.08;
assert.deepEqual(liftedSupportPosition(hold,0),hold.start);assert.deepEqual(liftedSupportPosition(hold,4),hold.target);assert.deepEqual(liftedSupportPosition(hold,8),hold.target);
for(let j=0;j<=400;j++){const t=j/100,p=liftedSupportPosition(hold,t);assert(p.every(Number.isFinite));if(t>=1&&t<=3)assert.equal(p[1],maxY);if(t<1){assert.equal(p[0],hold.start[0]);assert.equal(p[2],hold.start[2]);}if(t>=3){assert.equal(p[0],hold.target[0]);assert.equal(p[2],hold.target[2]);}}
console.log('temporary support lifts before sweep, lowers to unchanged target, and stops at four seconds');
