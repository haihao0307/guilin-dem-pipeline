import assert from 'node:assert/strict';
import {profileAssemblyArchetypes} from './qa-assembly-archetype-profiler.mjs';
const methods=['useProgram','activeTexture','bindTexture','getUniformLocation','uniform1i','uniform1iv','drawArrays'];
class FakeGL {
 constructor(options={}) {
  Object.assign(this,{CURRENT_PROGRAM:1,CURRENT_QUERY:2,QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,ACTIVE_TEXTURE:5,TEXTURE_BINDING_2D:6,TEXTURE0:100,TEXTURE_2D:200,
   ext:{TIME_ELAPSED_EXT:10,GPU_DISJOINT_EXT:11,QUERY_COUNTER_BITS_EXT:12},program:null,unit:100,textures:new Map(),uniforms:new Map(),active:null,queries:[],deleted:[],draws:[],calls:[],disjoint:false,disjointReads:0,counterBits:64,lost:false,...options});
 }
 getExtension(name) { assert.equal(name,'EXT_disjoint_timer_query_webgl2');return this.unsupported?null:this.ext; }
 getParameter(key) {
  if(key===this.CURRENT_PROGRAM)return this.program;if(key===this.ACTIVE_TEXTURE)return this.unit;if(key===this.TEXTURE_BINDING_2D)return this.textures.get(this.unit)??null;
  if(key===this.ext.GPU_DISJOINT_EXT){this.disjointReads++;return this.disjoint;}throw Error('Unknown getParameter '+key);
 }
 isContextLost() { return this.lost; }
 getUniformLocation(program,name) { return {program,name}; } // Fresh wrapper each call, like WebGL may provide.
 getUniform(program,location) { assert.equal(program,location.program);return this.uniforms.get(program)?.get(location.name)??0; }
 useProgram(program) { this.calls.push(['useProgram',program]);this.program=program;return 'program-result'; }
 activeTexture(unit) { this.calls.push(['activeTexture',unit]);this.unit=unit;return 'active-texture-result'; }
 bindTexture(target,texture) { this.calls.push(['bindTexture',target,texture]);if(target===this.TEXTURE_2D)this.textures.set(this.unit,texture);return 'bind-result'; }
 setUniform(location,value) { if(!location)return;if(location.program!==this.program)throw Error('Mock rejects cross-program uniform');if(!this.uniforms.has(this.program))this.uniforms.set(this.program,new Map());this.uniforms.get(this.program).set(location.name,value); }
 uniform1i(location,value) { this.calls.push(['uniform1i',location.program,location.name,value]);this.setUniform(location,value);return 'uniform-result'; }
 uniform1iv(...args) { const [location,values,offset=0]=args;this.calls.push(['uniform1iv',location.program,location.name,[...values],args.length,offset]);this.setUniform(location,values[offset]);return 'uniform-array-result'; }
 getQuery(target,key) { assert.equal(target,this.ext.TIME_ELAPSED_EXT);if(key===this.ext.QUERY_COUNTER_BITS_EXT)return this.counterBits;assert.equal(key,this.CURRENT_QUERY);return this.active; }
 createQuery() { if(this.allocationFails)return null;const q={id:this.queries.length,nanoseconds:0};this.queries.push(q);return q; }
 beginQuery(target,q) { assert.equal(target,this.ext.TIME_ELAPSED_EXT);assert.equal(this.active,null);this.active=q; }
 endQuery(target) { assert.equal(target,this.ext.TIME_ELAPSED_EXT);assert(this.active);if(this.endFailsOnce){this.endFailsOnce=false;throw Error('Mock endQuery failure');}this.active=null; }
 drawArrays(...args) {
  this.calls.push(['drawArrays',...args]);this.draws.push({program:this.program,texture:this.textures.get(this.TEXTURE0),count:this.uniforms.get(this.program)?.get('uInstanceCount')??null,args});
  if(this.active)this.active.nanoseconds=(this.textures.get(this.TEXTURE0)?.ns??1000000)*(this.uniforms.get(this.program)?.get('uInstanceCount')??1);
  if(this.disjointAfterDraw)this.disjoint=true;if(this.loseAfterDraw)this.lost=true;if(this.throwDraw)throw Error('Mock draw failure');return 'draw-result';
 }
 getQueryParameter(q,key) { if(key===this.QUERY_RESULT_AVAILABLE)return !this.neverReady;if(this.badResult)return NaN;return q.nanoseconds; }
 deleteQuery(q) { this.deleted.push(q); }
 flush() { throw Error('Profiler must not add flush'); }
 finish() { throw Error('Profiler must not finish'); }
}
const primitive=(nodeId,...loops)=>({nodeId,loops:loops.map(n=>Array.from({length:n},(_,i)=>[i,i%2])),planes:Array(2+loops.reduce((n,e)=>n+e,0)).fill({})});
function renderer(options={}) {
 const gl=new FakeGL(options),assembly={name:'assembly'},source={name:'source'},rail={name:'rail'},shade={name:'shade'},present={name:'present'};
 const a={id:'kcc::tower',primitives:[primitive('slab',4,3),primitive('room-partition',8)]},b={id:'warehouse::ornament',primitives:[primitive('front',68)]};
 const r={gl,gpu:'mock-not-actual-GPU',busy:false,stats:{frames:0},assemblyProgram:assembly,programs:[assembly,source,rail,shade,present],compileStats:[{name:'assembly'},{name:'source'},{name:'continuous-rail'},{name:'shade'},{name:'present'}],
  model:{archetypes:[a,b]},archetypes:[a,b].map((a,i)=>({id:a.id,spec:a,texture:{ns:(i+1)*1e6},coreTexture:{ns:(i+1)*.5e6}})),uniformLocations:new WeakMap()};
 r.uniform=(program,name)=>{let map=r.uniformLocations.get(program);if(!map){map=new Map();r.uniformLocations.set(program,map);}if(!map.has(name))map.set(name,gl.getUniformLocation(program,name));return map.get(name);};
 return r;
}
function bindAssembly(r,index=0,count=1,variant='full',{sampler=0,array=false}={}) {
 const g=r.gl,p=r.assemblyProgram;g.useProgram(p);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,r.archetypes[index][variant==='core'?'coreTexture':'texture']);g.uniform1i(r.uniform(p,'assemblyDescriptors'),sampler);
 if(array)g.uniform1iv(r.uniform(p,'uInstanceCount'),new Int32Array([99,count]),1);else g.uniform1i(r.uniform(p,'uInstanceCount'),count);
}
function drawAssembly(r,...args) { bindAssembly(r,...args);assert.equal(r.gl.drawArrays(4,0,3),'draw-result'); }
function before(r) { return Object.fromEntries(methods.map(name=>[name,{method:r.gl[name],descriptor:Object.getOwnPropertyDescriptor(r.gl,name)}])); }
function restored(r,old,{external=null}={}) {
 for(const name of methods){assert.equal(r.gl[name],old[name].method,name+' restored');assert.deepEqual(Object.getOwnPropertyDescriptor(r.gl,name),old[name].descriptor,name+' own descriptor restored');}
 assert.equal(r.gl.active,external);assert.equal(r.gl.deleted.length,r.gl.queries.length);assert.equal(new Set(r.gl.deleted).size,r.gl.queries.length);
}
async function mixed(r) {
 for(const p of [r.programs[1],r.programs[3]]) {r.gl.useProgram(p);r.gl.activeTexture(r.gl.TEXTURE0);r.gl.bindTexture(r.gl.TEXTURE_2D,{notAssembly:true});r.gl.drawArrays(4,0,3);}
 drawAssembly(r,0,2);drawAssembly(r,0,3);drawAssembly(r,0,1,'core');drawAssembly(r,1,4,'full',{array:true});
 r.gl.useProgram(r.programs[2]);r.gl.uniform1i(r.uniform(r.programs[2],'uInstanceCount'),29);r.gl.drawArrays(4,0,3);
 r.gl.useProgram(r.programs[4]);r.gl.drawArrays(4,0,3);r.stats.frames++;
}
let checks=0;
{
 const r=renderer(),old=before(r),report=await profileAssemblyArchetypes(r,()=>mixed(r));
 assert.equal(report.status,'complete');assert.equal(report.gpu.totalMs,13.5);assert.equal(report.coverage.allDrawCalls,8);assert.equal(report.coverage.assemblyDrawCalls,4);assert.equal(report.coverage.nonAssemblyDrawCalls,4);assert.equal(r.gl.queries.length,4);assert.equal(report.action.framesCompleted,1);
 const full=report.archetypes.find(x=>x.archetypeId==='kcc::tower'&&x.variant==='full'),core=report.archetypes.find(x=>x.variant==='core'),warehouse=report.archetypes.find(x=>x.archetypeId==='warehouse::ornament');
 assert.equal(full.gpuMs,5);assert.equal(full.drawCalls,2);assert.equal(full.primitives,2);assert.equal(full.edges,15);assert.equal(full.planes,19);assert.equal(full.instances.sum,5);assert.deepEqual(full.instances.histogram,{'2':1,'3':1});assert.deepEqual(full.byInstanceCount.map(x=>[x.instanceCount,x.gpuMs]),[[2,2],[3,3]]);
 assert.equal(core.primitives,1);assert.equal(core.edges,7);assert.equal(core.planes,9);assert.equal(core.gpuMs,.5);assert.equal(warehouse.edges,68);assert.equal(warehouse.gpuMs,8);assert.equal(report.attributionComplete,true);restored(r,old);checks++;
}
{
 // Same objects, same submitted calls/arguments/state before and during hooks.
 const r=renderer();await mixed(r);const plain=r.gl.calls.slice(),draws=r.gl.draws.slice();r.gl.calls=[];r.gl.draws=[];
 await profileAssemblyArchetypes(r,()=>mixed(r));assert.deepEqual(r.gl.calls,plain);assert.deepEqual(r.gl.draws,draws);checks++;
}
for(const [options,status] of [[{unsupported:true},'unsupported'],[{disjointAfterDraw:true},'disjoint'],[{loseAfterDraw:true},'context_lost'],[{allocationFails:true},'partial'],[{badResult:true},'instrumentation_error']]) {
 const r=renderer(options),old=before(r),report=await profileAssemblyArchetypes(r,()=>mixed(r));
 assert.equal(report.status,status);assert.equal(report.gpu.valid,false);assert.equal(report.gpu.totalMs,null);assert.equal(r.gl.draws.length,8);assert(report.archetypes.every(x=>x.gpuMs===null&&x.byInstanceCount.every(b=>b.gpuMs===null)));restored(r,old);checks++;
}
{
 const r=renderer(),old=before(r),report=await profileAssemblyArchetypes(r,()=>mixed(r),{maxQueries:2});
 assert.equal(report.status,'partial');assert.equal(report.gpu.totalMs,5);assert.equal(report.coverage.limitSkipped,2);restored(r,old);checks++;
}
{
 const r=renderer({neverReady:true}),old=before(r),report=await profileAssemblyArchetypes(r,()=>mixed(r),{queryTimeoutMs:0});
 assert.equal(report.status,'timeout');assert.equal(report.coverage.pendingQueries,4);assert.equal(report.gpu.valid,false);restored(r,old);checks++;
}
{
 const r=renderer(),old=before(r),external={nanoseconds:0};r.gl.active=external;
 const report=await profileAssemblyArchetypes(r,()=>mixed(r));assert.equal(report.status,'timer_conflict');assert.equal(report.coverage.activeQuerySkipped,4);assert.equal(r.gl.disjointReads,0);assert.equal(r.gl.queries.length,0);restored(r,old,{external});checks++;
}
for(const [setup,reason] of [
 [r=>{r.gl.bindTexture(r.gl.TEXTURE_2D,{sameNameButUnknown:'kcc::tower'});},'unregistered-texture'],
 [r=>{r.gl.uniform1i(r.uniform(r.assemblyProgram,'assemblyDescriptors'),6);},'sampler-not-unit-0'],
 [r=>{r.gl.bindTexture(r.gl.TEXTURE_2D,null);},'unit-0-unbound'],
 [r=>{r.archetypes[0].texture={};},'catalog-changed-during-action'],
]) {
 const r=renderer(),old=before(r),report=await profileAssemblyArchetypes(r,()=>{bindAssembly(r);setup(r);r.gl.drawArrays(4,0,3);});
 assert.equal(report.status,'complete');assert.equal(report.attributionComplete,false);assert.equal(report.archetypes.length,0);assert.equal(report.unknown[0].reason,reason);assert.equal(report.unknown[0].drawCalls,1);assert(report.unknown[0].gpuMs>0);restored(r,old);checks++;
}
{
 const r=renderer();r.archetypes[1].texture=r.archetypes[0].texture;
 const report=await profileAssemblyArchetypes(r,()=>drawAssembly(r));assert.equal(report.unknown[0].reason,'ambiguous-texture-ownership');checks++;
}
{
 const r=renderer();bindAssembly(r,0,7); // Preexisting cache/GL uniforms and binding; no setters in action.
 const report=await profileAssemblyArchetypes(r,()=>{r.gl.drawArrays(4,0,3)});assert.equal(report.archetypes[0].instances.sum,7);assert.equal(report.archetypes[0].gpuMs,7);checks++;
}
{
 const r=renderer();bindAssembly(r,0,7);r.gl.activeTexture(r.gl.TEXTURE0+6);
 const report=await profileAssemblyArchetypes(r,()=>r.gl.drawArrays(4,0,3));assert.equal(report.unknown[0].reason,'unit-0-binding-unobserved');checks++;
}
{
 const r=renderer(),report=await profileAssemblyArchetypes(r,()=>{bindAssembly(r,0,2);r.gl.activeTexture(r.gl.TEXTURE0+6);r.gl.bindTexture(r.gl.TEXTURE_2D,{});r.gl.drawArrays(4,0,3);});
 assert.equal(report.attributionComplete,true);assert.equal(report.archetypes[0].instances.sum,2);checks++;
}
{
 const r=renderer(),report=await profileAssemblyArchetypes(r,()=>{r.assemblyProgram={name:'replacement'};drawAssembly(r,1,3);});assert.equal(report.archetypes[0].archetypeId,'warehouse::ornament');assert.equal(report.archetypes[0].gpuMs,6);checks++;
}
{
 const r=renderer(),report=await profileAssemblyArchetypes(r,()=>{bindAssembly(r,0,33);r.gl.drawArrays(4,0,3);});assert.equal(report.archetypes[0].instances.unknownDraws,1);assert.equal(report.archetypes[0].byInstanceCount[0].instanceCount,'unknown');checks++;
}
{
 const r=renderer(),old=before(r),failure=Error('Render stopped');
 await assert.rejects(profileAssemblyArchetypes(r,async()=>{drawAssembly(r);throw failure;}),error=>{assert.equal(error,failure);assert.equal(error.assemblyGpuProfile.status,'action_error');assert.equal(error.assemblyGpuProfile.gpu.complete,false);assert.equal(error.assemblyGpuProfile.archetypes[0].gpuMs,1);return true;});restored(r,old);checks++;
}
{
 const r=renderer({throwDraw:true}),old=before(r),report=await profileAssemblyArchetypes(r,()=>drawAssembly(r),{throwOnActionError:false});assert.equal(report.status,'action_error');assert.match(report.action.error,/Mock draw failure/);restored(r,old);checks++;
}
{
 const r=renderer(),old=before(r),report=await profileAssemblyArchetypes(r,async()=>{drawAssembly(r);r.busy=true;});assert.equal(report.status,'partial');assert.equal(report.action.completed,false);restored(r,old);checks++;
}
{
 const r=renderer();r.busy=true;await assert.rejects(profileAssemblyArchetypes(r,()=>mixed(r)),/idle/);r.busy=false;
 const report=await profileAssemblyArchetypes(r,async()=>{await assert.rejects(profileAssemblyArchetypes(r,()=>mixed(r)),/already active/);});assert.equal(report.status,'no_assembly_draws');checks++;
}
{
 const r=renderer();Object.defineProperty(r.gl,'drawArrays',{value:r.gl.drawArrays,configurable:true,writable:false});const old=before(r);
 const report=await profileAssemblyArchetypes(r,()=>mixed(r));assert.equal(report.status,'instrumentation_error');assert.equal(r.gl.draws.length,8);restored(r,old);checks++;
}
{
 const r=renderer();Object.defineProperty(r.gl,'bindTexture',{value:r.gl.bindTexture.bind(r.gl),writable:true,enumerable:false,configurable:true});const old=before(r);
 await profileAssemblyArchetypes(r,()=>mixed(r));restored(r,old);checks++;
}
for (const value of [null,undefined,0,false,'']) {
 const r=renderer(),old=before(r);
 await assert.rejects(profileAssemblyArchetypes(r,()=>{throw value;}),error=>{assert.equal(error.assemblyGpuProfile.status,'action_error');return true;});restored(r,old);checks++;
}
{
 const r=renderer(),old=before(r);Object.defineProperty(r.archetypes[0].spec.primitives[0],'loops',{get(){throw Error('Bad diagnostic metadata');}});
 const report=await profileAssemblyArchetypes(r,()=>mixed(r));assert.equal(report.status,'instrumentation_error');assert.equal(r.gl.draws.length,8);restored(r,old);checks++;
}
{
 const r=renderer(),old=before(r),external={nanoseconds:0};let beforeForeign;
 const report=await profileAssemblyArchetypes(r,()=>{drawAssembly(r);beforeForeign=r.gl.disjointReads;r.gl.active=external;drawAssembly(r);});
 assert.equal(report.status,'timer_conflict');assert.equal(report.gpu.totalMs,null);assert.equal(report.coverage.completedQueries,0);assert.equal(report.coverage.activeQuerySkipped,1);assert.equal(r.gl.disjointReads,beforeForeign);restored(r,old,{external});checks++;
}
{
 const r=renderer({counterBits:0}),old=before(r),report=await profileAssemblyArchetypes(r,()=>mixed(r));
 assert.equal(report.status,'unsupported');assert.equal(report.extension.available,true);assert.equal(report.extension.timerSupported,false);assert.equal(report.gpu.totalMs,null);assert.equal(r.gl.disjointReads,0);assert.equal(r.gl.queries.length,0);restored(r,old);checks++;
}
{
 const r=renderer({endFailsOnce:true}),old=before(r),report=await profileAssemblyArchetypes(r,()=>mixed(r));assert.equal(report.status,'instrumentation_error');assert.equal(report.gpu.totalMs,null);restored(r,old);checks++;
}
console.log(JSON.stringify({passed:true,checks,scope:'Mock WebGL identity attribution, full/core counts, uniform tracking, timer lifecycle, normal pass forwarding and exact hook restoration. Not actual GPU timing or performance proof.'},null,2));
