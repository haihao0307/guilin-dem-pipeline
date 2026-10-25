/** QA-only live dispatch evidence. Does not change geometry, shaders, pixels,
 * renderer fence budgets. No extra draws, flush, finish, or waits are issued.
 * Timer queries and observation add overhead. A missing query result identifies
 * an unresolved command, not its cause (compilation, execution, or driver work).
 */
const activeContexts = new WeakSet();
const now = () => globalThis.performance?.now?.() ?? Date.now();
const text = error => String(error?.stack ?? error?.message ?? error);
const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
const stages = {source:'source', assembly:'assembly', 'continuous-rail':'rail',
  'hosted-aperture':'aperture', 'semantic-flat-color-only':'shade',
  'frame-presentation':'present', 'empty-field-initialization':'empty',
  'host-bound-elevator':'dynamic', 'bounded-structural-shadow':'shadow'};

export function captureRendererDiagnosticState(renderer, inspection = null) {
  return clone({
    backend: renderer.gpu ?? null, busy: renderer.busy, error: renderer.error ?? null,
    stats: renderer.stats, currentFrameStats: renderer.currentFrameStats ?? null,
    lifecycle: renderer.lifecycle?.snapshot?.() ?? null, compileStats: renderer.compileStats,
    options: renderer.options, revision: renderer.revision, requestRevision: renderer.requestRevision,
    canvas: {width: renderer.canvas?.width, height: renderer.canvas?.height},
    inspection: inspection ? {phase:inspection.phase, errors:inspection.errors,
      lastStats:inspection.lastStats, presentedFrames:inspection.presentedFrames,
      display:inspection.display, presentedDisplay:inspection.presentedDisplay,
      cameraFraming:inspection.cameraFraming, busy:inspection.busy} : null,
  });
}

/** Install before the first awaited render. snapshot({poll:true}) checks already
 * available queries ONCE, without waiting. stop() does the same then restores
 * all hooks. onSnapshot can persist evidence outside the page during an action.
 * Never combine with another draw-query profiler on this same context.
 */
export function installRendererDispatchDiagnostics(renderer, {
  inspection = null, label = 'before-first-frame', pollMs = 250, emitMs = 2000,
  maxQueries = 32768, maxDrawRecords = 65536, onSnapshot = null,
} = {}) {
  if (!renderer?.gl) throw new TypeError('Renderer with WebGL2 context required');
  if (renderer.busy) throw Error('Install dispatch diagnostics only while renderer is idle');
  if (activeContexts.has(renderer.gl)) throw Error('Dispatch diagnostics already installed');
  if (![pollMs, emitMs].every(x => Number.isFinite(x) && x >= 0) ||
      ![maxQueries, maxDrawRecords].every(x => Number.isInteger(x) && x > 0 && x <= 131072))
    throw new RangeError('Invalid bounded diagnostic options');
  const gl = renderer.gl, started = now(), framesAtInstall = renderer.stats?.frames ?? null;
  const methods = ['useProgram', 'drawArrays', 'fenceSync', 'clientWaitSync'];
  const originals = Object.fromEntries(methods.map(k => [k, gl[k]]));
  const descriptors = Object.fromEntries(methods.map(k => [k, Object.getOwnPropertyDescriptor(gl,k)]));
  const programs = [], programMap = new Map(), draws = [], queries = [], fences = [], fenceMap = new Map();
  const errors = [], markers = [{label, atMs:0, nextDraw:1}];
  let ext = null, current = null, disjoint = false, contextLost = false, timerFailed = false;
  let stopped = false, timer = null, drawCount = 0, lastEmit = -Infinity, emitting = 0;
  const recordError = error => { if (errors.length < 64) errors.push(text(error)); };
  const restore = () => { for (const key of methods) {
    if (descriptors[key]) Object.defineProperty(gl,key,descriptors[key]); else delete gl[key];
  }};
  const checkValidity = () => {
    try {
      contextLost ||= gl.isContextLost?.() === true;
      if (ext && !contextLost) disjoint ||= !!gl.getParameter(ext.GPU_DISJOINT_EXT);
    } catch (error) { timerFailed = true; recordError(error); }
  };
  const poll = () => {
    if (stopped) return;
    checkValidity();
    if (!ext || contextLost || disjoint || timerFailed) return;
    for (const entry of queries) {
      if (entry.done) continue;
      try {
        if (!gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE)) continue;
        const ns = gl.getQueryParameter(entry.query, gl.QUERY_RESULT);
        if (!Number.isFinite(ns) || ns < 0) throw Error('Invalid elapsed query result');
        entry.done = true; entry.ns = ns; entry.draw.queryStatus = 'complete';
        entry.draw.gpuMs = ns / 1e6;
      } catch (error) { timerFailed = true; recordError(error); break; }
    }
    // A disjoint event invalidates ALL previous measurements, not just pending ones.
    checkValidity();
  };
  const timingValid = () => !!ext && !disjoint && !contextLost && !timerFailed;
  const drawSummary = entry => entry ? {...entry, gpuMs:timingValid() ? entry.gpuMs : null} : null;
  const snapshot = ({poll:readAvailable = false} = {}) => {
    if (readAvailable) poll();
    const valid = timingValid(), available = queries.filter(q => q.done).length;
    let prefix = 0, prefixMs = 0;
    if (valid) for (const entry of draws) {
      if (entry.queryStatus !== 'complete') break;
      prefix++; prefixMs += entry.gpuMs;
    }
    const unresolved = draws[prefix] ?? null;
    const programReports = programs.map(p => {
      const records = queries.filter(q => q.draw.programIndex === p.programIndex);
      const complete = records.filter(q => q.done);
      return {...p, firstDraw:drawSummary(draws[p.firstDrawOrdinal-1]),
        availableQueries:complete.length, pendingQueries:records.length-complete.length,
        availableGpuMs:valid && complete.length ? complete.reduce((n,q)=>n+q.ns/1e6,0) : null};
    });
    return clone({schemaVersion:1, label, elapsedMs:now()-started, stopped,
      framesAtInstall, observedFromFreshRenderer:framesAtInstall === 0,
      notice:'First draw means first observed in this capture. Query times include instrumentation overhead. Unresolved queries do not prove JIT or shader execution is the cause. No extra GPU wait or fence budget is added.',
      extension:{name:'EXT_disjoint_timer_query_webgl2', available:!!ext},
      timing:{valid, disjoint, contextLost, instrumentationFailed:timerFailed,
        allocatedQueries:queries.length, availableQueries:available,
        pendingQueries:queries.length-available,
        completedPrefix:{draws:prefix, throughDraw:prefix || null, gpuMs:valid && prefix ? prefixMs : null,
          firstUnresolved:drawSummary(unresolved), allObservedDrawsComplete:valid && prefix === drawCount}},
      programs:programReports, markers, draws:{observed:drawCount, recorded:draws.length,
        truncated:drawCount > draws.length, last:drawSummary(draws.at(-1)), recent:draws.slice(-24).map(drawSummary)},
      fences:{observed:fences.length, recent:fences.slice(-16)},
      renderer:captureRendererDiagnosticState(renderer,inspection), errors,
    });
  };
  const emit = (force = false) => {
    if (!onSnapshot || (!force && (emitting || now()-lastEmit < emitMs))) return;
    lastEmit = now(); emitting++;
    try { Promise.resolve(onSnapshot(snapshot())).catch(recordError).finally(()=>{emitting--;}); }
    catch (error) { recordError(error); emitting--; }
  };
  const describe = program => {
    let p = programMap.get(program);
    if (p) return p;
    const compiledIndex = renderer.programs?.indexOf(program) ?? -1;
    const name = renderer.compileStats?.[compiledIndex]?.name ?? (program ? 'unregistered-program' : 'no-program');
    p = {programIndex:programs.length, compiledIndex, name,
      stage:name.startsWith('integrated-host-wall:') ? 'host' : stages[name] ?? 'other',
      firstDrawOrdinal:drawCount, firstDrawAtMs:now()-started,
      firstDrawFramesCompleted:renderer.stats?.frames ?? null, draws:0, drawCallWallMs:0};
    programMap.set(program,p); programs.push(p); return p;
  };
  activeContexts.add(gl);
  try {
    try { ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); current = gl.getParameter(gl.CURRENT_PROGRAM); }
    catch (error) { timerFailed=true; recordError(error); }
    checkValidity();
    gl.useProgram = function(program) { const value=originals.useProgram.call(gl,program); current=program; return value; };
    gl.drawArrays = function(...args) {
      drawCount++;
      const p=describe(current), first=p.draws === 0; p.draws++;
      const entry={ordinal:drawCount, programIndex:p.programIndex, name:p.name, stage:p.stage,
        label, submittedAtMs:now()-started, returnedAtMs:null, drawCallWallMs:null,
        queryStatus:!ext?'unsupported':!timingValid()?'invalid-timing':'not-started', gpuMs:null};
      const retained=draws.length < maxDrawRecords;
      if (retained) draws.push(entry);
      // Persist identity BEFORE the first potentially blocking driver call and
      // before beginning a GPU query, so serialization is outside that query.
      if(first) emit(true);
      let query=null, begun=false;
      if (retained && timingValid()) try {
        if (queries.length >= maxQueries) entry.queryStatus='query-limit';
        else if (gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)) entry.queryStatus='external-query-active';
        else {
          query=gl.createQuery(); entry.queryStatus=query?'pending':'allocation-failed';
          if(query) { gl.beginQuery(ext.TIME_ELAPSED_EXT,query); begun=true; queries.push({query,draw:entry,done:false,ns:null}); }
        }
      } catch (error) {
        timerFailed=true; entry.queryStatus='instrumentation-error'; recordError(error);
        if(query&&!begun) try {gl.deleteQuery(query);} catch(error){recordError(error);}
      }
      const t=now();
      try { return originals.drawArrays.apply(gl,args); }
      finally {
        entry.returnedAtMs=now()-started; entry.drawCallWallMs=now()-t; p.drawCallWallMs+=entry.drawCallWallMs;
        if(begun) try {gl.endQuery(ext.TIME_ELAPSED_EXT);} catch(error){timerFailed=true;recordError(error);}
      }
    };
    gl.fenceSync = function(...args) {
      const value=originals.fenceSync.apply(gl,args);
      const record={ordinal:fences.length+1, label, firstDraw:(fences.at(-1)?.throughDraw ?? 0)+1,
        throughDraw:drawCount, submittedAtMs:now()-started, polls:0, lastPollAtMs:null,
        lastStatus:null, completedAtMs:null, framesCompleted:renderer.stats?.frames ?? null,
        tilesSubmitted:renderer.currentFrameStats?.tilesSubmitted ?? null};
      fences.push(record); if(value) fenceMap.set(value,record); emit(true); return value;
    };
    gl.clientWaitSync = function(sync,...args) {
      const result=originals.clientWaitSync.call(gl,sync,...args), record=fenceMap.get(sync);
      if(record) {record.polls++;record.lastPollAtMs=now()-started;
        record.lastStatus=result === gl.TIMEOUT_EXPIRED?'timeout-expired':result === gl.ALREADY_SIGNALED?'already-signaled':result === gl.CONDITION_SATISFIED?'condition-satisfied':result === gl.WAIT_FAILED?'wait-failed':String(result);
        if(result === gl.ALREADY_SIGNALED || result === gl.CONDITION_SATISFIED) record.completedAtMs=now()-started;
      }
      return result;
    };
    for(const key of methods) if(gl[key] === originals[key]) throw Error('Cannot wrap WebGL method '+key);
    if(pollMs > 0) timer=setInterval(()=>{poll();emit();},pollMs);
    emit(true);
  } catch(error) {restore();activeContexts.delete(gl);throw error;}
  return {
    snapshot,
    mark(nextLabel) {if(stopped)throw Error('Diagnostics already stopped');label=String(nextLabel);markers.push({label,atMs:now()-started,nextDraw:drawCount+1});emit(true);},
    stop() {
      if(!stopped) {
        if(timer!==null) clearInterval(timer);
        poll(); stopped=true; restore(); activeContexts.delete(gl);
        for(const q of queries) try {gl.deleteQuery(q.query);} catch(error){recordError(error);}
      }
      return snapshot();
    },
  };
}
