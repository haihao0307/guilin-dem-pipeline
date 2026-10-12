import assert from 'node:assert/strict';
import {growthDirection as source} from './r14/GroomTopology.js';
import {growthDirection as adapted} from './r14/AppearanceFlowR54.js';
import {validateRecipe} from './r14/LengthKernel.js';
const d=validateRecipe({style:'side-flow'}),root=[.02,.38,.05];
assert.deepEqual(adapted(root,root,d),source(root,root,d),'No change at actual emergence');
for(const r of [[.02,.31,.06],[.02,.38,-.03]])for(let j=0;j<5;j++){
 const p=[r[0],r[1],r[2]+j*.01];assert.deepEqual(adapted(p,r,d),source(p,r,d),'Low/rear source field unchanged');
}
for(const sign of [-1,1]){
 const r=[sign*.02,.38,.05],p=[r[0],r[1],r[2]+.04],v=adapted(p,r,d);assert(v[2]<-.8,'Front top middle sweeps back');assert(Math.abs(Math.hypot(...v)-1)<1e-12);
}
for(let i=0;i<200;i++){
 const a=.002+i*.0001,p=[root[0],root[1],root[2]+a],q=[root[0],root[1],root[2]+a+.000001],v=adapted(p,root,d),w=adapted(q,root,d);assert(v.every(Number.isFinite));assert(Math.hypot(...v.map((x,k)=>x-w[k]))<.002,'Smooth root-to-mid-shaft transition');
}
console.log('R54 field: exact root/low/rear preservation, backward top field and continuous transition passed');
