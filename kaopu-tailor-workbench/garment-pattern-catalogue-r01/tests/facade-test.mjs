import assert from 'node:assert/strict';
let started=0,terminated=0;
class MockWorker {constructor(){started++;this.dead=false;}postMessage(data){setTimeout(()=>{if(this.dead)return;const result=data.request.op==='officialOracleCm'?{pattern:{panels:{},stitches:[]}}:{validation:{analytic2DPass:!data.request.bad,errors:data.request.bad?[{code:'SAMPLED_SELF_INTERSECTION',panel:'bad-panel'}]:[]},requestValue:data.request.value};this.onmessage({data:{id:data.id,type:'result',result}});},5);}terminate(){this.dead=true;terminated++;}}
globalThis.Worker=MockWorker;
const m=await import('../browser/pattern-generator.mjs');assert.equal(started,0);const g=m.createPatternGenerator();assert.equal(started,0);
const out=await Promise.all([g.generatePattern({value:1}),g.generatePattern({value:2})]);assert.deepEqual(out.map(x=>x.requestValue),[1,2]);
await assert.rejects(g.generatePattern({bad:true}),e=>e.name==='PatternValidationError'&&e.diagnosticPattern.validation.errors[0].panel==='bad-panel');
assert.equal((await g.generatePattern({bad:true},{allowInvalidForDiagnostics:true})).validation.analytic2DPass,false);
assert.deepEqual(await g.generatePattern({op:'officialOracleCm'}),{pattern:{panels:{},stitches:[]}});
const c=new AbortController();const pending=g.generatePattern({value:3},{signal:c.signal});c.abort();await assert.rejects(pending);assert.equal(terminated,1);
assert.equal((await g.generatePattern({value:4})).requestValue,4);assert.equal(started,2);g.dispose();await assert.rejects(g.generatePattern({value:5}));assert.equal(terminated,2);
console.log('PASS: lazy worker, request identity, invalid-paper block, diagnostic opt-in, oracle path, cancel/restart/dispose. Mock only; not browser execution.');
