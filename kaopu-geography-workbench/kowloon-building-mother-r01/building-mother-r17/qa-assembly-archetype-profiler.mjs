/** QA only: attribute the existing assembly draw commands by their actual
 * descriptor texture, not by camera, draw order, bounds, or guessed geometry.
 * Does not alter render options, uniforms, textures, shaders, or frame budgets.
 * Timer queries add overhead; their sum is not an uninstrumented frame time.
 */
const activeContexts = new WeakSet();
const now = () => globalThis.performance?.now?.() ?? Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const errorText = error => String(error?.stack ?? error?.message ?? error);
const trackedUniforms = ['assemblyDescriptors', 'uInstanceCount'];
const hookNames = ['useProgram', 'activeTexture', 'bindTexture', 'getUniformLocation', 'uniform1i', 'uniform1iv', 'drawArrays'];

function shapeCounts(primitives) {
 if (!Array.isArray(primitives) || primitives.some(p => !Array.isArray(p.loops) || p.loops.some(l => !Array.isArray(l)) || !Array.isArray(p.planes)))
  return {primitives:null, edges:null, planes:null, maxEdgesPerPrimitive:null};
 const edges = primitives.map(p => p.loops.reduce((n, l) => n + l.length, 0));
 return {primitives:primitives.length, edges:edges.reduce((a, b) => a + b, 0), planes:primitives.reduce((n, p) => n + p.planes.length, 0), maxEdgesPerPrimitive:Math.max(0, ...edges)};
}
function catalogFor(renderer) {
 const catalog = new Map();
 for (const archetype of renderer.archetypes ?? []) {
  const modelMatches = (renderer.model?.archetypes ?? []).filter(a => a.id === archetype.id);
  // This exactly mirrors setModel's coreTexture construction. Do not assume
  // the full spec is the core texture's source when the model is unavailable.
  const coreSource = modelMatches.length === 1 ? modelMatches[0].primitives : null;
  const core = Array.isArray(coreSource) && coreSource.every(p => typeof p.nodeId === 'string')
   ? coreSource.filter(p => !p.nodeId.includes('-partition')) : null;
  for (const [variant, property, primitives] of [['full','texture',archetype.spec?.primitives], ['core','coreTexture',core]]) {
   const texture = archetype[property];
   if (!texture) continue;
   const entry = {archetype, id:archetype.id, variant, property, texture, spec:archetype.spec, primitiveSource:archetype.spec?.primitives, coreSource,
    counts:shapeCounts(primitives), metadataSource:variant === 'full' ? 'renderer.archetypes[].spec' : 'renderer.model.archetypes[].primitives excluding -partition'};
   if (!catalog.has(texture)) catalog.set(texture, []);
   catalog.get(texture).push(entry);
  }
 }
 return catalog;
}
function summaryBase() {
 return {drawCalls:0, timedDraws:0, completedQueries:0, gpuMs:null, drawCallWallMs:0,
  instances:{sum:0,min:null,max:null,unknownDraws:0,histogram:{}}, byInstanceCount:[]};
}
function countInstance(row, count) {
 const instances = row.instances;
 if (count === null) { instances.unknownDraws++; return; }
 instances.sum += count; instances.min = instances.min === null ? count : Math.min(instances.min,count);
 instances.max = instances.max === null ? count : Math.max(instances.max,count);
 instances.histogram[count] = (instances.histogram[count] ?? 0) + 1;
}

/**
 * Browser / page.evaluate:
 * const {profileAssemblyArchetypes} = await import('./qa-assembly-archetype-profiler.mjs');
 * return await profileAssemblyArchetypes(semanticInspection.renderer,
 *   () => semanticInspection.render(), {label:'whole-native-warm'});
 *
 * Start idle and await a finite render, not a running journey loop. Stop other
 * elapsed-query/disjoint observers first: this capture requires exclusive timer
 * observation. A detected foreign elapsed query is never ended or replaced;
 * timing is disabled for the capture without reading its disjoint status.
 * queryTimeoutMs only bounds reading these queries AFTER the action. It does
 * not change the renderer's 60 s initial / 20 s hot-frame limits. No gl.finish,
 * gl.flush, extra draw, framebuffer readback, or additional fence is issued.
 * Action errors rethrow with error.assemblyGpuProfile unless disabled below.
 */
export async function profileAssemblyArchetypes(renderer, action, {
 label='assembly-native-render', queryTimeoutMs=1000, pollMs=8, maxQueries=4096, throwOnActionError=true
}={}) {
 if (!renderer?.gl || typeof action !== 'function') throw new TypeError('Renderer and awaited render action required');
 if (!Number.isFinite(queryTimeoutMs) || queryTimeoutMs < 0 || !Number.isFinite(pollMs) || pollMs < 0 || !Number.isInteger(maxQueries) || maxQueries < 1 || maxQueries > 65536)
  throw new RangeError('Invalid bounded query collection options');
 const gl = renderer.gl;
 if (activeContexts.has(gl)) throw Error('Assembly profiler already active for this context');
 if (renderer.busy) throw Error('Start assembly profiling only after the renderer is idle');
 const start = now(), framesBefore = renderer.stats?.frames ?? null, errors=[], queries=[], allocatedQueries=new Set(), rows=new Map(), unknownRows=new Map();
 const originals = Object.fromEntries(hookNames.map(name => [name,gl[name]]));
 const descriptors = Object.fromEntries(hookNames.map(name => [name,Object.getOwnPropertyDescriptor(gl,name)]));
 const report = {schemaVersion:1,label,backend:renderer.gpu ?? null,status:'pending',
  extension:{name:'EXT_disjoint_timer_query_webgl2',available:false,counterBits:null,timerSupported:false,conflictingElapsedQuery:false}, action:{completed:false,error:null,wallMs:null,framesCompleted:null},
  gpu:{valid:false,complete:false,totalMs:null,unit:'milliseconds'},
  coverage:{allDrawCalls:0,nonAssemblyDrawCalls:0,assemblyDrawCalls:0,attributedDraws:0,unknownDraws:0,timedDraws:0,completedQueries:0,limitSkipped:0,activeQuerySkipped:0,allocationSkipped:0,pendingQueries:0},
  archetypes:[],unknown:[],errors,
  notice:'Only assembly draw commands are timed. GPU sums include instrumentation effects, not full or uninstrumented frame time. Primitive/edge counts describe the bound template, NOT actual polygon visits. Instance sums count submitted instance slots across tiles, NOT unique scene instances. full/core variants are separate. Unknown texture identity is never guessed.'};
 let catalog, ext=null, timerSupported=false, current=null, activeUnit=null, unit0, actionError=null, hasActionError=false, timerConflict=false, disjoint=false, lost=false, instrumentationFailed=false, timedOut=false;
 const installed = new Set(), programStates=new Map(), uniformLocations=new Map();
 function fail(error) { instrumentationFailed=true; errors.push(errorText(error)); }
 function contextLost() { try { return gl.isContextLost?.() === true; } catch(error) { fail(error); return true; } }
 function checkDisjoint() {
  if (!timerSupported || timerConflict) return;
  try {
   // Reading DISJOINT consumes context-wide observation state. Do not touch
   // another active timer's state, even when our own draws would be skipped.
   if (gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)) {
    timerConflict=true;report.extension.conflictingElapsedQuery=true;return;
   }
   if (gl.getParameter(ext.GPU_DISJOINT_EXT)) disjoint=true;
  } catch(error) { fail(error); }
 }
 function restore() {
  for (const name of [...installed].reverse()) try {
   if (descriptors[name]) Object.defineProperty(gl,name,descriptors[name]); else delete gl[name];
   installed.delete(name);
  } catch(error) { fail(error); }
 }
 function closeOwnActiveQuery() {
  if (!ext || !allocatedQueries.size) return;
  try { const active=gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY);if (allocatedQueries.has(active)) gl.endQuery(ext.TIME_ELAPSED_EXT); }
  catch(error) { fail(error); }
 }
 function assemblyProgram(program) { return !!program && program === renderer.assemblyProgram; }
 function programState(program) {
  if (programStates.has(program)) return programStates.get(program);
  const state={assemblyDescriptors:null,uInstanceCount:null}; programStates.set(program,state);
  for (const name of trackedUniforms) {
   const cached=renderer.uniformLocations?.get(program)?.get(name);
   if (cached != null) uniformLocations.set(cached,{program,name});
   const location=cached ?? originals.getUniformLocation.call(gl,program,name);
   if (location != null) {
    uniformLocations.set(location,{program,name});
    const value=gl.getUniform(program,location);
    if (Number.isInteger(value)) state[name]=value;
   }
  }
  return state;
 }
 function observeUniform(location,value) {
  if (!assemblyProgram(current) || location == null) return;
  let tag=uniformLocations.get(location);
  if (!tag) for (const name of trackedUniforms) if (renderer.uniformLocations?.get(current)?.get(name) === location) {
   tag={program:current,name}; uniformLocations.set(location,tag); break;
  }
  if (tag?.program === current) programState(current)[tag.name]=Number.isInteger(value) ? value : null;
 }
 function attribution() {
  const state=programState(current), count=Number.isInteger(state.uInstanceCount) && state.uInstanceCount >= 0 && state.uInstanceCount <= 32 ? state.uInstanceCount : null;
  let reason=null, owner=null;
  if (state.assemblyDescriptors !== 0) reason=state.assemblyDescriptors === null ? 'sampler-unit-unknown' : 'sampler-not-unit-0';
  else if (unit0 === undefined) reason='unit-0-binding-unobserved';
  else if (!unit0) reason='unit-0-unbound';
  else {
   const owners=catalog.get(unit0) ?? [];
   if (!owners.length) reason='unregistered-texture';
   else if (owners.length !== 1) reason='ambiguous-texture-ownership';
   else {
    owner=owners[0];
    if (!(renderer.archetypes ?? []).includes(owner.archetype) || owner.archetype.id !== owner.id || owner.archetype[owner.property] !== unit0 || owner.archetype.spec !== owner.spec || owner.archetype.spec?.primitives !== owner.primitiveSource)
     reason='catalog-changed-during-action';
    if (owner.variant === 'core') {
     const models=(renderer.model?.archetypes ?? []).filter(a => a.id === owner.id);
     if (models.length !== 1 || models[0].primitives !== owner.coreSource) reason='core-catalog-changed-or-unavailable';
    }
    if (typeof owner.id !== 'string' || !owner.id) reason='archetype-id-unknown';
   }
  }
  const map=reason ? unknownRows : rows, key=reason ?? owner;
  if (!map.has(key)) map.set(key,reason ? {reason,...summaryBase()} : {archetypeId:owner.id,variant:owner.variant,...owner.counts,metadataSource:owner.metadataSource,...summaryBase()});
  const row=map.get(key), countKey=count === null ? 'unknown' : count;
  let bin=row.byInstanceCount.find(b => b.instanceCount === countKey);
  if (!bin) { bin={instanceCount:countKey,drawCalls:0,timedDraws:0,completedQueries:0,gpuMs:null}; row.byInstanceCount.push(bin); }
  row.drawCalls++; bin.drawCalls++; countInstance(row,count);
  report.coverage[reason ? 'unknownDraws' : 'attributedDraws']++;
  return {row,bin};
 }
 activeContexts.add(gl);
 try {
  try { catalog=catalogFor(renderer); } catch(error) { fail(error); catalog=new Map(); }
  lost=contextLost();
  if (!lost) try {
   ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'); report.extension.available=!!ext;
   if (ext) {
    const bits=gl.getQuery(ext.TIME_ELAPSED_EXT,ext.QUERY_COUNTER_BITS_EXT);report.extension.counterBits=bits;
    if (!Number.isInteger(bits) || bits < 0) throw Error('Invalid elapsed-query counter bit count');
    timerSupported=bits > 0;report.extension.timerSupported=timerSupported;
   }
   current=gl.getParameter(gl.CURRENT_PROGRAM); activeUnit=gl.getParameter(gl.ACTIVE_TEXTURE);
   if (activeUnit === gl.TEXTURE0) unit0=gl.getParameter(gl.TEXTURE_BINDING_2D);
   if (assemblyProgram(current)) programState(current);
   checkDisjoint();
  } catch(error) { fail(error); }
  const observe = fn => { try { fn(); } catch(error) { fail(error); } };
  const hooks={
   useProgram:function(program) { const result=originals.useProgram.call(gl,program); observe(() => {current=program;if (assemblyProgram(program)) programState(program);}); return result; },
   activeTexture:function(unit) { const result=originals.activeTexture.call(gl,unit); activeUnit=unit; return result; },
   bindTexture:function(target,texture) { const result=originals.bindTexture.call(gl,target,texture); if (target === gl.TEXTURE_2D && activeUnit === gl.TEXTURE0) unit0=texture; return result; },
   getUniformLocation:function(program,name) { const location=originals.getUniformLocation.call(gl,program,name); if (location != null && trackedUniforms.includes(name)) uniformLocations.set(location,{program,name}); return location; },
   uniform1i:function(location,value) { const result=originals.uniform1i.call(gl,location,value); observe(() => observeUniform(location,value)); return result; },
   uniform1iv:function(...args) { const [location,values,offset=0]=args,result=originals.uniform1iv.apply(gl,args); observe(() => observeUniform(location,values?.[offset])); return result; },
   drawArrays:function(...args) {
    report.coverage.allDrawCalls++;
    if (!assemblyProgram(current)) { report.coverage.nonAssemblyDrawCalls++; return originals.drawArrays.apply(gl,args); }
    report.coverage.assemblyDrawCalls++;
    let target=null,query=null,begun=false;
    observe(() => { target=attribution(); });
    if (timerSupported && !disjoint && !instrumentationFailed && !contextLost() && target) {
     checkDisjoint();
     if (timerConflict) report.coverage.activeQuerySkipped++;
     else if (!disjoint && !instrumentationFailed) {
      if (queries.length >= maxQueries) report.coverage.limitSkipped++;
      else try {
       if (gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)) { timerConflict=true;report.extension.conflictingElapsedQuery=true;report.coverage.activeQuerySkipped++; }
       else {
        query=gl.createQuery();
        if (!query) report.coverage.allocationSkipped++;
        else {
         allocatedQueries.add(query);
         gl.beginQuery(ext.TIME_ELAPSED_EXT,query); begun=true;
         queries.push({query,...target,done:false,nanoseconds:null}); target.row.timedDraws++;target.bin.timedDraws++;report.coverage.timedDraws++;
        }
       }
      } catch(error) { fail(error); }
     }
    }
    const submitted=now();
    try { return originals.drawArrays.apply(gl,args); }
    finally {
     if (target) target.row.drawCallWallMs+=now()-submitted;
     if (begun) try { gl.endQuery(ext.TIME_ELAPSED_EXT); } catch(error) { fail(error); }
    }
   }
  };
  try {
   for (const name of hookNames) {
    // Include this name before assignment so even a partial installation is restored.
    installed.add(name); gl[name]=hooks[name];
    if (gl[name] !== hooks[name]) throw Error('Cannot temporarily hook WebGL method '+name);
   }
  } catch(error) { fail(error); restore(); }
  const actionStart=now();
  try { await action(); report.action.completed=!renderer.busy; if (renderer.busy) report.action.error='Action returned while renderer was still busy; await the completed render'; }
  catch(error) { hasActionError=true; actionError=error; report.action.error=errorText(error); }
  finally { report.action.wallMs=now()-actionStart; restore(); closeOwnActiveQuery(); }
  report.action.framesCompleted=Number.isFinite(framesBefore) && Number.isFinite(renderer.stats?.frames) ? renderer.stats.frames-framesBefore : null;
  const waitStart=now(), deadline=waitStart+queryTimeoutMs;
  while (true) {
   lost=contextLost(); checkDisjoint();
   if (!timerSupported || timerConflict || lost || disjoint || instrumentationFailed) break;
   for (const record of queries) {
    if (record.done) continue;
    if (gl.getQueryParameter(record.query,gl.QUERY_RESULT_AVAILABLE)) {
     const value=gl.getQueryParameter(record.query,gl.QUERY_RESULT);
     if (!Number.isFinite(value) || value < 0) { fail(Error('Invalid GPU timer result')); break; }
     record.done=true; record.nanoseconds=value;
    }
   }
   if (instrumentationFailed || queries.every(q => q.done)) break;
   if (now() >= deadline) { timedOut=true; break; }
   await sleep(pollMs);
  }
  report.queryWaitWallMs=now()-waitStart; lost=contextLost(); checkDisjoint();
  // Any disjoint/context-loss/observation failure invalidates the ENTIRE timing
  // capture, including results read before the failure. Counts remain useful.
  if (!timerConflict && !lost && !disjoint && !instrumentationFailed) for (const record of queries) if (record.done) {
   for (const entry of [record.row,record.bin]) { entry.completedQueries++;entry.gpuMs=(entry.gpuMs ?? 0)+record.nanoseconds/1e6; }
   report.coverage.completedQueries++;
  }
  report.coverage.pendingQueries=queries.filter(q => !q.done).length;
  report.gpu.valid=report.coverage.completedQueries > 0;
  if (report.gpu.valid) report.gpu.totalMs=[...rows.values(),...unknownRows.values()].reduce((n,row) => n+(row.gpuMs ?? 0),0);
  report.gpu.complete=report.gpu.valid && report.coverage.completedQueries === report.coverage.assemblyDrawCalls && report.action.completed && !timedOut;
  report.status=hasActionError ? 'action_error' : lost ? 'context_lost' : disjoint ? 'disjoint' : timerConflict ? 'timer_conflict' : instrumentationFailed ? 'instrumentation_error' : !timerSupported ? 'unsupported' : timedOut ? 'timeout' : !report.coverage.assemblyDrawCalls ? 'no_assembly_draws' : report.gpu.complete ? 'complete' : 'partial';
 } catch(error) { fail(error); report.status='instrumentation_error'; }
 finally {
  restore();closeOwnActiveQuery();
  for (const query of allocatedQueries) try { gl.deleteQuery(query); } catch(error) { fail(error); }
  if (instrumentationFailed || lost || disjoint || timerConflict) {
   report.gpu={valid:false,complete:false,totalMs:null,unit:'milliseconds'}; report.coverage.completedQueries=0;
   for (const row of [...rows.values(),...unknownRows.values()]) for (const entry of [row,...row.byInstanceCount]) { entry.gpuMs=null;entry.completedQueries=0; }
   if (!hasActionError && !lost && !disjoint) report.status=timerConflict ? 'timer_conflict' : 'instrumentation_error';
  }
  report.archetypes=[...rows.values()].sort((a,b) => (b.gpuMs ?? -1)-(a.gpuMs ?? -1) || b.drawCalls-a.drawCalls);
  report.unknown=[...unknownRows.values()]; report.attributionComplete=report.coverage.unknownDraws === 0 && !instrumentationFailed;
  report.totalWallMs=now()-start; activeContexts.delete(gl);
 }
 if (hasActionError && throwOnActionError) {
  const error=actionError instanceof Error ? actionError : new Error(String(actionError));
  try { error.assemblyGpuProfile=report; } catch {}
  throw error;
 }
 return report;
}
