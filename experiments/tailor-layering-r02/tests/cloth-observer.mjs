// Read-only traffic observation for the actual application cloth Worker.
// No synthetic messages, clocks, positions, visibility or readiness are sent.
export async function installClothObserver(context, {
  checkpointSteps = [0, 1, 6, 12, 18, 24, 60, 120, 240],
  checkpointLimit = 64,
} = {}) {
  if (!Array.isArray(checkpointSteps) || !checkpointSteps.every(step => Number.isInteger(step) && step >= 0)) {
    throw new TypeError('Checkpoint steps must be nonnegative integers');
  }
  if (!Number.isInteger(checkpointLimit) || checkpointLimit < 1) throw new RangeError('Invalid checkpoint limit');
  await context.addInitScript(({checkpointSteps, checkpointLimit}) => {
    if (globalThis.__KAOPU_CI_CLOTH_OBSERVER__) return;
    const observation = globalThis.__KAOPU_CI_CLOTH_OBSERVER__ = {
      pending: new Map(), requestCount: 0, responseCount: 0,
      latest: null, init: null, requests: [], responses: [], errors: [],
      snapshotCopies: 0, snapshotCopyMS: 0,
      checkpointSteps, checkpointLimit, checkpoints: [],
      checkpointGeneration: 0, droppedCheckpoints: 0, retainedCheckpointBytes: 0,
    };
    const snapshotBytes = value => {
      if (ArrayBuffer.isView(value)) return value.byteLength;
      if (Array.isArray(value)) return value.reduce((sum, entry) => sum + snapshotBytes(entry), 0);
      if (value && typeof value === 'object') return Object.values(value).reduce((sum, entry) => sum + snapshotBytes(entry), 0);
      return 0;
    };
    const known = new WeakSet();
    const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'postMessage');
    const original = descriptor.value;
    Object.defineProperty(Worker.prototype, 'postMessage', {...descriptor, value: function (...args) {
      const message = args[0];
      if (!known.has(this) && message?.type === 'init' && message.body?.positions && message.body?.faces && Array.isArray(message.rows)) {
        known.add(this);
        // Keep independent input bytes. This copy is not returned to the app.
        const began = performance.now();
        try {observation.init = structuredClone(message); observation.snapshotCopies++;}
        catch (error) {observation.errors.push({type: 'observer-init-copy', message: String(error)});}
        observation.snapshotCopyMS += performance.now() - began;
        this.addEventListener('message', event => {
          const data = event.data, request = observation.pending.get(data?.id);
          if (!request) return;
          observation.pending.delete(data.id);
          observation.responseCount++;
          // Preserve diagnostics only on the actual error reply. These are
          // rejected-step measurements; they do not replace the latest
          // successfully accepted geometry below or fabricate a snapshot.
          const errorDetails = data.error ? {workerStack: data.stack || null,
            diagnostics: data.diagnostics == null ? null : structuredClone(data.diagnostics)} : null;
          observation.responses.push({id: data.id, type: request.type,
            wallMS: performance.now(), elapsedMS: performance.now() - request.wallMS,
            error: data.error || null, ...(errorDetails || {}),
            audit: data.audit ? structuredClone(data.audit) : null});
          if (data.error) observation.errors.push({id: data.id, type: request.type, message: data.error, ...errorDetails});
          if (data.rows && data.audit) {
            // Retain the received object by reference; copying every geometry
            // would add an artificial per-step allocation to performance tests.
            // Readout below copies it only at an explicit checkpoint.
            observation.latest = data;
            const beginsGeneration = ['init', 'add', 'reset'].includes(request.type);
            if (beginsGeneration) observation.checkpointGeneration++;
            if (beginsGeneration || request.type === 'remove'
              || (request.type === 'step' && observation.checkpointSteps.includes(data.audit.completedSteps))) {
              // These received arrays remain owned by the real application.
              // Its native deformation path reads them; it never edits them.
              // Retaining a reference avoids per-frame geometry copies. The
              // bounded, explicit readout below copies only selected states.
              const bytes = snapshotBytes(data);
              observation.checkpoints.push({requestID: data.id, type: request.type,
                generation: observation.checkpointGeneration, retainedBytes: bytes,
                snapshot: data});
              observation.retainedCheckpointBytes += bytes;
              if (observation.checkpoints.length > checkpointLimit) {
                observation.retainedCheckpointBytes -= observation.checkpoints.shift().retainedBytes;
                observation.droppedCheckpoints++;
              }
            }
          }
        });
      }
      const tracked = known.has(this) && message && Number.isInteger(message.id);
      if (tracked) {
        const row = {id: message.id, type: message.type, wallMS: performance.now()};
        observation.pending.set(message.id, row);
        observation.requestCount++;
        observation.requests.push(row);
      }
      try {return Reflect.apply(original, this, args);}
      catch (error) {
        if (tracked) observation.pending.delete(message.id);
        throw error;
      }
    }});
  }, {checkpointSteps, checkpointLimit});
}

// Configure only the read-only observer's retention schedule. This neither
// sends a worker message nor changes application/solver state or timing.
export async function retainClothSteps(page, steps) {
  if (!Array.isArray(steps) || !steps.every(step => Number.isInteger(step) && step >= 0)) {
    throw new TypeError('Observed checkpoint steps must be nonnegative integers');
  }
  return page.evaluate(steps => {
    const observation = globalThis.__KAOPU_CI_CLOTH_OBSERVER__;
    if (!observation) throw new Error('The read-only cloth observer is not installed');
    observation.checkpointSteps = [...new Set([...observation.checkpointSteps, ...steps])].sort((a, b) => a - b);
    return observation.checkpointSteps;
  }, steps);
}

export async function readClothObservation(page, {geometry = false, initialInput = false, checkpoints = false} = {}) {
  return page.evaluate(({geometry, initialInput, checkpoints}) => {
    const source = globalThis.__KAOPU_CI_CLOTH_OBSERVER__;
    if (!source) throw new Error('The read-only cloth observer was not installed before navigation');
    function plain(value) {
      if (ArrayBuffer.isView(value)) return Array.from(value);
      if (Array.isArray(value)) return value.map(plain);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, plain(entry)]));
      return value;
    }
    const result = {pending: [...source.pending.values()], requestCount: source.requestCount,
      responseCount: source.responseCount, errors: source.errors.slice(),
      requests: source.requests.slice(), responses: source.responses.slice(),
      snapshotCopies: source.snapshotCopies, snapshotCopyMS: source.snapshotCopyMS,
      checkpointSteps: source.checkpointSteps, checkpointLimit: source.checkpointLimit,
      checkpointCount: source.checkpoints.length, checkpointGeneration: source.checkpointGeneration,
      droppedCheckpoints: source.droppedCheckpoints, retainedCheckpointBytes: source.retainedCheckpointBytes,
      audit: source.latest?.audit ? plain(source.latest.audit) : null};
    if (geometry || initialInput || checkpoints) {
      const began = performance.now();
      if (geometry) result.snapshot = source.latest ? plain(structuredClone(source.latest)) : null;
      if (initialInput) result.init = source.init ? plain(structuredClone(source.init)) : null;
      if (checkpoints) result.checkpoints = plain(structuredClone(source.checkpoints));
      result.checkpointCopyMS = performance.now() - began;
    }
    return result;
  }, {geometry, initialInput, checkpoints});
}

export async function waitForClothIdle(page, timeout = 90_000) {
  await page.waitForFunction(() => {
    const source = globalThis.__KAOPU_CI_CLOTH_OBSERVER__;
    if (!source || source.pending.size !== 0 || source.responseCount === 0) return false;
    if (source.errors.length) return true;
    const app = document.getElementById('layer-app');
    if (app?.dataset.status === 'error') return true;
    if (app?.dataset.ready !== 'true') return false;
    let published;
    try {published = JSON.parse(app.querySelector('#diagnostics')?.textContent || 'null');} catch {return false;}
    // Published diagnostics may be throttled. Await the completed response
    // itself and its application to the visible UI, including a last reply
    // arriving after the play button was changed to paused.
    return published?.physics?.completedSteps === source.latest?.audit?.completedSteps
      && published.physics.simulationSeconds === source.latest.audit.simulationSeconds
      && source.latest.rows.every(row => published.render?.demand?.latestSnapshotIDByGarment?.[row.id] === source.latest.id);
  }, null, {timeout, polling: 100});
  const state = await readClothObservation(page);
  if (state.errors.length) throw new Error('Actual cloth Worker failed: ' + state.errors.at(-1).message);
  return state;
}
