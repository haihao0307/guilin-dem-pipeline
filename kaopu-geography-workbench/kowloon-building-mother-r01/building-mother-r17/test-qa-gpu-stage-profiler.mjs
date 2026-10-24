import assert from 'node:assert/strict';
import {profileRendererGpu} from './qa-gpu-stage-profiler.mjs';
class FakeGL{
 constructor(options={}){Object.assign(this,{CURRENT_PROGRAM:1,CURRENT_QUERY:2,QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,ext:{TIME_ELAPSED_EXT:5,GPU_DISJOINT_EXT:6},program:null,active:null,queries:[],deleted:[],draws:0,disjoint:false,lost:false,...options})}
 getExtension(){return this.unsupported?null:this.ext}
 getParameter(key){if(key===this.CURRENT_PROGRAM)return this.program;if(key===this.ext.GPU_DISJOINT_EXT)return this.disjoint;throw Error('Unknown parameter')}
 isContextLost(){return this.lost}
 getQuery(target,key){assert.equal(target,this.ext.TIME_ELAPSED_EXT);assert.equal(key,this.CURRENT_QUERY);return this.active}
 createQuery(){if(this.allocationFails)return null;const q={id:this.queries.length,nanoseconds:0};this.queries.push(q);return q}
 beginQuery(target,q){assert.equal(target,this.ext.TIME_ELAPSED_EXT);assert.equal(this.active,null);this.active=q}
 endQuery(target){assert.equal(target,this.ext.TIME_ELAPSED_EXT);assert(this.active);this.active=null}
 useProgram(program){this.program=program}
 drawArrays(){this.draws++;if(this.active)this.active.nanoseconds=this.program.ns??1000000;if(this.loseAfterDraw)this.lost=true;if(this.disjointAfterDraw)this.disjoint=true}
 getQueryParameter(q,key){return key===this.QUERY_RESULT_AVAILABLE?!this.neverReady:q.nanoseconds}
 deleteQuery(q){this.deleted.push(q)}
 flush(){}
}
function renderer(options={}){
 const gl=new FakeGL(options),source={ns:1000000},shade={ns:2500000},present={ns:500000};
 return {gl,gpu:'mock-not-a-GPU',busy:false,stats:{frames:0},sourceProgram:source,shadeProgram:shade,presentProgram:present,programs:[source,shade,present],compileStats:[{name:'source'},{name:'semantic-flat-color-only'},{name:'frame-presentation'}]};
}
async function draw(r){for(const p of r.programs){r.gl.useProgram(p);r.gl.drawArrays(0,0,3)}r.stats.frames++}
function restored(r,before){assert.equal(r.gl.useProgram,before.useProgram);assert.equal(r.gl.drawArrays,before.drawArrays);assert(!Object.hasOwn(r.gl,'useProgram'));assert(!Object.hasOwn(r.gl,'drawArrays'));assert.equal(r.gl.active,null);assert.equal(r.gl.deleted.length,r.gl.queries.length)}
let checks=0;
{
 const r=renderer(),before={useProgram:r.gl.useProgram,drawArrays:r.gl.drawArrays},p=await profileRendererGpu(r,()=>draw(r));
 assert.equal(p.status,'complete');assert.equal(p.gpu.totalMs,4);assert.equal(p.stages.source.gpuMs,1);assert.equal(p.stages.shade.gpuMs,2.5);assert.equal(p.stages.present.gpuMs,.5);assert.equal(p.action.framesCompleted,1);assert.equal(p.coverage.drawCalls,3);restored(r,before);checks++;
}
for(const [options,status]of [[{unsupported:true},'unsupported'],[{disjointAfterDraw:true},'disjoint'],[{loseAfterDraw:true},'context_lost'],[{allocationFails:true},'partial']]){
 const r=renderer(options),before={useProgram:r.gl.useProgram,drawArrays:r.gl.drawArrays},p=await profileRendererGpu(r,()=>draw(r));
 assert.equal(p.status,status);assert.equal(p.gpu.valid,false);assert.equal(p.gpu.totalMs,null);assert(Object.values(p.stages).every(s=>s.gpuMs===null));assert.equal(r.gl.draws,3);assert.equal(p.action.completed,true);restored(r,before);checks++;
}
{
 const r=renderer(),before={useProgram:r.gl.useProgram,drawArrays:r.gl.drawArrays},p=await profileRendererGpu(r,()=>draw(r),{maxQueries:2});
 assert.equal(p.status,'partial');assert.equal(p.gpu.complete,false);assert.equal(p.gpu.totalMs,3.5);assert.equal(p.coverage.limitSkipped,1);assert.equal(p.stages.present.gpuMs,null);restored(r,before);checks++;
}
{
 const r=renderer({neverReady:true}),before={useProgram:r.gl.useProgram,drawArrays:r.gl.drawArrays},p=await profileRendererGpu(r,()=>draw(r),{timeoutMs:1,pollMs:0});
 assert.equal(p.status,'timeout');assert.equal(p.gpu.valid,false);assert.equal(p.coverage.timedOutQueries,3);restored(r,before);checks++;
}
{
 const r=renderer(),before={useProgram:r.gl.useProgram,drawArrays:r.gl.drawArrays},failure=Error('real render failed');
 await assert.rejects(profileRendererGpu(r,async()=>{await draw(r);throw failure}),error=>{assert.equal(error,failure);assert.equal(error.gpuProfile.status,'action_error');assert.equal(error.gpuProfile.action.completed,false);return true});restored(r,before);checks++;
}
{
 const r=renderer(),p=await profileRendererGpu(r,async()=>{await draw(r);throw Error('expected')},{throwOnActionError:false});assert.equal(p.status,'action_error');assert.equal(p.gpu.complete,false);checks++;
}
{
 const r=renderer(),external={external:true};r.gl.active=external;const p=await profileRendererGpu(r,()=>draw(r));
 assert.equal(p.status,'partial');assert.equal(p.coverage.activeQuerySkipped,3);assert.equal(r.gl.active,external);assert.equal(r.gl.queries.length,0);checks++;
}
{
 const r=renderer(),p=await profileRendererGpu(r,async()=>{const newProgram={ns:7000000};r.programs.push(newProgram);r.compileStats.push({name:'continuous-rail'});r.gl.useProgram(newProgram);r.gl.drawArrays(0,0,3)});assert.equal(p.stages.rail.gpuMs,7);assert.equal(p.status,'complete');checks++;
}
{
 const r=renderer();r.busy=true;await assert.rejects(profileRendererGpu(r,()=>draw(r)),/idle/);r.busy=false;
 const p=await profileRendererGpu(r,async()=>{await assert.rejects(profileRendererGpu(r,()=>draw(r)),/already active/)});assert.equal(p.status,'no_draws');checks++;
}
console.log({passed:true,checks,scope:'mock API lifecycle, aggregation, disjoint discard, unsupported, timeout, action errors, active-query protection, dynamic program mapping; not actual GPU timing'});
