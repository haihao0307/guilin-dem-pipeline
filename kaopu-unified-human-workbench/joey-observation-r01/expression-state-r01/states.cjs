'use strict';
const assert=require('node:assert/strict');
const actions=Object.freeze({mouthSmileLeft:.25,mouthSmileRight:.25,cheekSquintLeft:.06,cheekSquintRight:.06,jawOpen:0});
function buildStates(original){
 assert.equal(original.state.owners.expression,'gnm');
 assert(original.state.gnm.expression.every(x=>x===0),'Requires frozen zero-expression R44');
 assert.deepEqual(original.state.anny.facialActions,{});
 const neutral=structuredClone(original),smile=structuredClone(original);
 neutral.state.owners.expression='anny';
 neutral.state.anny.facialActions=Object.fromEntries(Object.keys(actions).map(k=>[k,0]));
 smile.state.owners.expression='anny';smile.state.anny.facialActions={...actions};
 return [
  {id:'A-R44-original',archive:structuredClone(original)},
  {id:'C-Anny-owner-neutral',archive:neutral},
  {id:'B-Anny-soft-smile',archive:smile},
  {id:'F-R44-restored',archive:structuredClone(original)}
 ];
}
module.exports={actions,buildStates};
