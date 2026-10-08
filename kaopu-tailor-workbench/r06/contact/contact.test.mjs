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
