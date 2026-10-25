import assert from 'node:assert/strict';
import {captureRendererDiagnosticState,installRendererDispatchDiagnostics} from './qa-renderer-dispatch-diagnostics.mjs';

class FakeGL {
  constructor(options={}) {Object.assign(this,{CURRENT_PROGRAM:1,CURRENT_QUERY:2,
    QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,TIMEOUT_EXPIRED:10,ALREADY_SIGNALED:11,
    CONDITION_SATISFIED:12,WAIT_FAILED:13,ext:{TIME_ELAPSED_EXT:5,GPU_DISJOINT_EXT:6},
    program:null,active:null,queries:[],deleted:[],draws:0,disjoint:false,lost:false,
    waitResult:10,...options});}
  getExtension(){return this.unsupported?null:this.ext;}
  getParameter(k){if(k===this.CURRENT_PROGRAM)return this.program;if(k===this.ext.GPU_DISJOINT_EXT)return this.disjoint;throw Error('Unknown parameter');}
  isContextLost(){return this.lost;}
  useProgram(p){this.program=p;}
  getQuery(t,k){assert.equal(t,this.ext.TIME_ELAPSED_EXT);assert.equal(k,this.CURRENT_QUERY);return this.active;}
  createQuery(){if(this.noAllocation)return null;const q={ready:false,ns:0};this.queries.push(q);return q;}
  beginQuery(t,q){assert.equal(t,this.ext.TIME_ELAPSED_EXT);assert.equal(this.active,null);this.active=q;}
  endQuery(t){assert.equal(t,this.ext.TIME_ELAPSED_EXT);assert(this.active);this.active=null;}
  drawArrays(){this.draws++;if(this.active)this.active.ns=this.program.ns;if(this.throwDraw)throw this.throwDraw;}
  getQueryParameter(q,k){if(this.throwQuery)throw Error('query failed');return k===this.QUERY_RESULT_AVAILABLE?q.ready:q.ns;}
  deleteQuery(q){this.deleted.push(q);}
  fenceSync(){return {};}
  clientWaitSync(){return this.waitResult;}
  flush(){throw Error('Diagnostics must not flush');}
  finish(){throw Error('Diagnostics must not finish');}
}
function renderer(options={}) {
  const gl=new FakeGL(options),programs=[{ns:1e6},{ns:2e6},{ns:3e6}];
  return {gl,programs,compileStats:[{name:'source'},{name:'integrated-host-wall:local-endpoint-rows:sharp-wall-coverage-v1'},{name:'semantic-flat-color-only'}],stats:{frames:0},busy:false,
    currentFrameStats:{tilesSubmitted:1,passCounts:{source:1,host:1,shade:1}},
    options:{eye:[1,2,3],fov:1,hostWindowRows:true},canvas:{width:1002,height:527},
    lifecycle:{snapshot:()=>({state:'waiting',maxWaitMs:20000,maxInitializationMs:60000})}};
}
function draw(r,i=0){r.gl.useProgram(r.programs[i]);r.gl.drawArrays(4,0,3);}
function install(r,options={}){return installRendererDispatchDiagnostics(r,{pollMs:0,...options});}
function restored(r){for(const k of ['useProgram','drawArrays','fenceSync','clientWaitSync'])assert(!Object.hasOwn(r.gl,k),k);assert.equal(r.gl.active,null);assert.equal(r.gl.deleted.length,r.gl.queries.length);}
let checks=0;
{
  const r=renderer(),original=JSON.stringify(r.options),emitted=[],d=install(r,{onSnapshot:s=>emitted.push(s)});
  draw(r,0);draw(r,1);draw(r,2);
  const f=r.gl.fenceSync();r.gl.clientWaitSync(f);r.gl.waitResult=r.gl.CONDITION_SATISFIED;r.gl.clientWaitSync(f);
  assert.deepEqual(emitted.filter(s=>s.programs.length).slice(0,3).map(s=>s.programs.at(-1).firstDraw.returnedAtMs),[null,null,null]);
  r.gl.queries.forEach(q=>q.ready=true);const s=d.snapshot({poll:true});
  assert.deepEqual(s.programs.map(p=>p.stage),['source','host','shade']);
  assert.deepEqual(s.programs.map(p=>p.firstDrawOrdinal),[1,2,3]);
  assert.equal(s.timing.completedPrefix.draws,3);assert.equal(s.timing.completedPrefix.gpuMs,6);assert(s.timing.completedPrefix.allObservedDrawsComplete);
  assert.equal(s.fences.recent[0].throughDraw,3);assert.equal(s.fences.recent[0].firstDraw,1);
  assert.equal(s.fences.recent[0].polls,2);assert.equal(s.fences.recent[0].lastStatus,'condition-satisfied');
  assert.equal(s.renderer.canvas.width,1002);assert.equal(s.renderer.lifecycle.maxWaitMs,20000);assert.equal(s.renderer.lifecycle.maxInitializationMs,60000);
  assert.equal(JSON.stringify(r.options),original);assert(s.observedFromFreshRenderer);d.stop();d.stop();restored(r);checks++;
}
{
  const r=renderer(),d=install(r);draw(r,0);draw(r,1);draw(r,2);r.gl.queries[0].ready=true;r.gl.queries[2].ready=true;
  const s=d.snapshot({poll:true});assert.equal(s.timing.availableQueries,2);assert.equal(s.timing.completedPrefix.draws,1);assert.equal(s.timing.completedPrefix.firstUnresolved.ordinal,2);assert.equal(s.timing.completedPrefix.firstUnresolved.stage,'host');assert.equal(s.programs[2].availableGpuMs,3);
  d.mark('warm');r.stats.frames=1;draw(r,0);assert.equal(d.snapshot().draws.last.label,'warm');assert.equal(d.snapshot().markers[1].nextDraw,4);d.stop();restored(r);checks++;
}
for(const failure of ['disjoint','lost','throwQuery']) {
  const r=renderer(),d=install(r);draw(r);r.gl.queries[0].ready=true;assert.equal(d.snapshot({poll:true}).timing.completedPrefix.gpuMs,1);
  if(failure==='throwQuery')draw(r,1); // Only pending queries need another GL read.
  r.gl[failure]=true;const s=d.snapshot({poll:true});assert.equal(s.timing.valid,false);assert.equal(s.timing.completedPrefix.gpuMs,null);assert.equal(s.draws.last.gpuMs,null);assert.equal(s.programs[0].availableGpuMs,null);
  d.stop();restored(r);checks++;
}
for(const [options,status] of [[{unsupported:true},'unsupported'],[{noAllocation:true},'allocation-failed']]) {
  const r=renderer(options),d=install(r);draw(r);const s=d.snapshot({poll:true});assert.equal(s.timing.completedPrefix.draws,0);assert.equal(s.timing.completedPrefix.firstUnresolved.queryStatus,status);assert.equal(s.programs[0].availableGpuMs,null);d.stop();restored(r);checks++;
}
{
  const r=renderer(),other={};r.gl.active=other;const d=install(r);draw(r);assert.equal(r.gl.active,other);assert.equal(d.snapshot().draws.last.queryStatus,'external-query-active');assert.equal(r.gl.queries.length,0);d.stop();r.gl.active=null;restored(r);checks++;
}
{
  const r=renderer(),d=install(r,{maxQueries:1});draw(r);draw(r,1);r.gl.queries[0].ready=true;const s=d.snapshot({poll:true});assert.equal(s.timing.completedPrefix.draws,1);assert.equal(s.timing.completedPrefix.firstUnresolved.queryStatus,'query-limit');d.stop();restored(r);checks++;
}
{
  const r=renderer(),d=install(r,{maxDrawRecords:1});draw(r);draw(r,1);r.gl.queries[0].ready=true;const s=d.snapshot({poll:true});assert(s.draws.truncated);assert.equal(s.draws.observed,2);assert.equal(s.draws.recorded,1);assert.equal(s.timing.completedPrefix.allObservedDrawsComplete,false);assert.equal(s.programs[1].firstDraw,null);d.stop();restored(r);checks++;
}
{
  const failure=Error('renderer draw failed'),r=renderer({throwDraw:failure}),d=install(r);assert.throws(()=>draw(r),error=>error===failure);assert.equal(r.gl.active,null);r.error={phase:'frame',reason:'timeout'};const s=d.snapshot();assert.equal(s.renderer.error.reason,'timeout');assert.equal(s.draws.observed,1);d.stop();restored(r);checks++;
}
{
  const r=renderer();r.stats.frames=5;r.busy=true;assert.throws(()=>install(r),/idle/);r.busy=false;
  const d=install(r);assert.throws(()=>install(r),/already installed/);assert.equal(d.snapshot().observedFromFreshRenderer,false);d.stop();assert.throws(()=>d.mark('late'),/stopped/);checks++;
}
{
  const r=renderer(),inspection={phase:'rendering',errors:[],presentedFrames:0},s=captureRendererDiagnosticState(r,inspection);r.currentFrameStats.tilesSubmitted=20;r.options.eye[0]=9;inspection.phase='error';assert.equal(s.currentFrameStats.tilesSubmitted,1);assert.equal(s.options.eye[0],1);assert.equal(s.inspection.phase,'rendering');checks++;
}
{
  const r=renderer(),seen=[],d=installRendererDispatchDiagnostics(r,{pollMs:1,emitMs:0,onSnapshot:s=>seen.push(s)});draw(r);r.gl.queries[0].ready=true;
  await new Promise(resolve=>setTimeout(resolve,20));assert(seen.some(s=>s.timing.completedPrefix.draws===1));d.stop();restored(r);checks++;
}
console.log({passed:true,checks,scope:'Mock query lifecycle, live prefix, first dispatch evidence, disjoint invalidation, restore, no extra GPU wait, and untouched renderer options/budgets. Not actual GPU timing.'});
