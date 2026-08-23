/**
 * Guilin GAEA bridge.
 *
 * The browser preview and a real GAEA Worker deliberately have separate state.
 * This module never embeds or navigates to another page.  It only talks to the
 * shared store and, when configured, to a Worker that implements the protocol
 * documented by WORKER_PROTOCOL below.
 */

const MODULE_ID = 'guilin-gaea-bridge@1';
const WORKER_PROTOCOL = 'guilin-gaea-worker@1';
const HEALTH_TIMEOUT_MS = 5_000;
const BUILD_TIMEOUT_MS = 5 * 60_000;

export const GAEA_PARAMETER_LIMITS = Object.freeze({
  mountainEmphasis: [0, 2],
  karstSharpen: [0, 2],
  erosionStrength: [0, 2],
  depositionThickness: [0, 2],
  verticalExaggeration: [1, 3],
  thermalWeathering: [0, 2],
  rockExposure: [0, 2],
  surfaceDetail: [0, 2],
  valleyCut: [0, 2],
  forestDensity: [0, 1.5],
  treeSize: [0.4, 2],
  satelliteSaturation: [0, 2],
  canopyWeathering: [0, 1],
  paddyFlattening: [0, 1],
  bundStrength: [0, 2],
  colorfulFields: [0, 1],
  vegetableBlend: [0, 1],
  dryCropBlend: [0, 1],
  orchardBlend: [0, 1],
  windSpeed: [0, 1],
  windGust: [0, 1],
});

export const GAEA_DEFAULT_PARAMETERS = Object.freeze({
  mountainEmphasis: 1,
  karstSharpen: 1,
  erosionStrength: 1,
  depositionThickness: 0.45,
  verticalExaggeration: 1.6,
  thermalWeathering: 0.35,
  rockExposure: 1,
  surfaceDetail: 1,
  valleyCut: 0.5,
  forestDensity: 1,
  treeSize: 1,
  satelliteSaturation: 1,
  canopyWeathering: 0.25,
  paddyFlattening: 0.72,
  bundStrength: 1,
  colorfulFields: 0.35,
  vegetableBlend: 0.65,
  dryCropBlend: 0.7,
  orchardBlend: 0.65,
  windSpeed: 0.34,
  windGust: 0.18,
  season: 'summer',
});

export const GAEA_PRESETS = Object.freeze({
  'base-dem': Object.freeze({
    ...GAEA_DEFAULT_PARAMETERS,
    mountainEmphasis: 0,
    karstSharpen: 0,
    erosionStrength: 0,
    depositionThickness: 0,
    verticalExaggeration: 1,
    thermalWeathering: 0,
    rockExposure: 0,
    surfaceDetail: 0,
    valleyCut: 0,
  }),
  'guilin-1942': Object.freeze({ ...GAEA_DEFAULT_PARAMETERS }),
  'karst-enhanced': Object.freeze({
    ...GAEA_DEFAULT_PARAMETERS,
    mountainEmphasis: 1.28,
    karstSharpen: 1.55,
    erosionStrength: 1.18,
    thermalWeathering: 0.62,
    rockExposure: 1.5,
    surfaceDetail: 1.35,
    valleyCut: 0.8,
  }),
  'colorful-fields': Object.freeze({
    ...GAEA_DEFAULT_PARAMETERS,
    satelliteSaturation: 1.25,
    paddyFlattening: 0.9,
    bundStrength: 1.35,
    colorfulFields: 1,
    vegetableBlend: 1,
    dryCropBlend: 1,
    orchardBlend: 1,
    season: 'autumn',
  }),
});

const PARAMETER_ALIASES = Object.freeze({
  mountain: 'mountainEmphasis',
  mountainStrength: 'mountainEmphasis',
  karst: 'karstSharpen',
  karstStrength: 'karstSharpen',
  erosion: 'erosionStrength',
  deposition: 'depositionThickness',
  verticalEx: 'verticalExaggeration',
  verticalScale: 'verticalExaggeration',
  thermal: 'thermalWeathering',
  rock: 'rockExposure',
  detail: 'surfaceDetail',
  riverCut: 'valleyCut',
  forest: 'forestDensity',
  wind: 'windSpeed',
  gust: 'windGust',
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function nowIso() {
  return new Date().toISOString();
}

function safeCall(callback, value) {
  if (typeof callback !== 'function') return undefined;
  try {
    return callback(value);
  } catch (error) {
    // UI callbacks must not be able to break the worker state machine.
    return error;
  }
}

function copyParameters(parameters) {
  return { ...parameters };
}

function normaliseSeason(value) {
  const aliases = {
    0: 'spring',
    1: 'summer',
    2: 'autumn',
    3: 'winter',
    wet: 'summer',
    harvest: 'autumn',
    fallow: 'winter',
  };
  const resolved = aliases[value] ?? String(value || '').toLowerCase();
  return ['spring', 'summer', 'autumn', 'winter'].includes(resolved) ? resolved : 'summer';
}

function normaliseParameters(input = {}) {
  const values = { ...GAEA_DEFAULT_PARAMETERS };
  for (const [rawKey, rawValue] of Object.entries(input || {})) {
    const key = PARAMETER_ALIASES[rawKey] || rawKey;
    if (key === 'season') {
      values.season = normaliseSeason(rawValue);
      continue;
    }
    if (!(key in GAEA_PARAMETER_LIMITS)) continue;
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) continue;
    const [minimum, maximum] = GAEA_PARAMETER_LIMITS[key];
    values[key] = clamp(numeric, minimum, maximum);
  }
  return values;
}

function parameterSignature(parameters) {
  return Object.keys(GAEA_DEFAULT_PARAMETERS)
    .map((key) => `${key}:${parameters[key]}`)
    .join('|');
}

function browserPreview(parameters, revision) {
  return {
    mode: 'browser-preview',
    approximation: true,
    authoritativeElevationChanged: false,
    status: 'ready',
    revision,
    generatedAt: nowIso(),
    parameters: copyParameters(parameters),
    runtimeParameters: {
      verticalEx: parameters.verticalExaggeration,
      mountainEmphasis: parameters.mountainEmphasis,
      karstStrength: parameters.karstSharpen,
      erosionStrength: parameters.erosionStrength,
      depositionStrength: parameters.depositionThickness,
      thermalWeathering: parameters.thermalWeathering,
      rockExposure: parameters.rockExposure,
      surfaceDetail: parameters.surfaceDetail,
      valleyCut: parameters.valleyCut,
      forestDensity: parameters.forestDensity,
      treeSize: parameters.treeSize,
      satelliteSaturation: parameters.satelliteSaturation,
      canopyWeathering: parameters.canopyWeathering,
      paddyFlattening: parameters.paddyFlattening,
      bundStrength: parameters.bundStrength,
      cropBlend: {
        colorfulFields: parameters.colorfulFields,
        vegetable: parameters.vegetableBlend,
        dryCrop: parameters.dryCropBlend,
        orchard: parameters.orchardBlend,
      },
      wind: parameters.windSpeed,
      windGust: parameters.windGust,
      season: parameters.season,
    },
  };
}

function createStoreAdapter(store) {
  if (!store || (typeof store !== 'object' && typeof store !== 'function')) {
    throw new TypeError('createGaeaBridge requires a shared store');
  }

  const read = () => {
    if (typeof store.getState === 'function') return store.getState() || {};
    if (typeof store.getSnapshot === 'function') return store.getSnapshot() || {};
    if (store.state && typeof store.state === 'object') return store.state;
    return store;
  };

  const patch = (partial) => {
    if (typeof store.setState === 'function') {
      store.setState(partial);
      return;
    }
    if (typeof store.patch === 'function') {
      store.patch(partial);
      return;
    }
    if (typeof store.set === 'function') {
      for (const [key, value] of Object.entries(partial)) store.set(key, value);
      return;
    }
    const target = read();
    Object.assign(target, partial);
  };

  const subscribe = (listener) => {
    if (typeof store.subscribe !== 'function') return () => {};
    const unsubscribe = store.subscribe(listener);
    return typeof unsubscribe === 'function' ? unsubscribe : () => {};
  };

  return { read, patch, subscribe, source: store };
}

function configuredWorker(adapter) {
  const root = adapter.read();
  const gaea = root.gaea || {};
  const factory =
    gaea.workerFactory ||
    root.gaeaWorkerFactory ||
    adapter.source.createGaeaWorker ||
    adapter.source.workerFactory;
  const url =
    gaea.workerUrl ||
    gaea.worker?.url ||
    root.gaeaWorkerUrl ||
    root.workerUrls?.gaea ||
    adapter.source.gaeaWorkerUrl ||
    null;
  return {
    factory: typeof factory === 'function' ? factory : null,
    url: typeof url === 'string' && url.trim() ? url.trim() : null,
    options: gaea.workerOptions || root.gaeaWorkerOptions || { type: 'module', name: 'guilin-gaea-worker' },
  };
}

function resolveBuildRequest(request, rootParameters) {
  if (typeof request === 'string') {
    return {
      parameters: normaliseParameters(GAEA_PRESETS[request] || rootParameters),
      preset: request,
      input: undefined,
      transfer: [],
      metadata: {},
    };
  }
  const isEnvelope = request && (
    Object.hasOwn(request, 'parameters') ||
    Object.hasOwn(request, 'input') ||
    Object.hasOwn(request, 'transfer') ||
    Object.hasOwn(request, 'preset')
  );
  const envelope = isEnvelope ? request : { parameters: request };
  const presetParameters = envelope.preset ? GAEA_PRESETS[envelope.preset] : null;
  return {
    parameters: normaliseParameters(envelope.parameters || presetParameters || rootParameters),
    preset: envelope.preset || null,
    input: envelope.input,
    transfer: Array.isArray(envelope.transfer) ? envelope.transfer : [],
    metadata: envelope.metadata && typeof envelope.metadata === 'object' ? { ...envelope.metadata } : {},
  };
}

/**
 * Create the GAEA browser-preview/Worker bridge.
 *
 * Worker protocol, all messages include `protocol: guilin-gaea-worker@1`:
 *   request  {type:'gaea:health'|'gaea:build'|'gaea:cancel', requestId, ...}
 *   response {type:'gaea:health'|'gaea:progress'|'gaea:result'|'gaea:error',
 *             requestId, progress?, result?, error?}
 */
export function createGaeaBridge({ store, onStatus, onBuildApplied } = {}) {
  const adapter = createStoreAdapter(store);
  let disposed = false;
  let writingStore = false;
  let worker = null;
  let workerConfigKey = '';
  let requestSequence = 0;
  let previewRevision = 0;
  let lastParameterSignature = '';
  let lastCommitRevision;
  let activeBuildId = null;
  const pending = new Map();

  const readGaea = () => adapter.read().gaea || {};

  function writeGaea(partial) {
    if (disposed) return readGaea();
    const current = readGaea();
    const next = { ...current, ...partial };
    writingStore = true;
    try {
      adapter.patch({ gaea: next });
    } finally {
      writingStore = false;
    }
    return next;
  }

  function emit(phase, status, detail = {}) {
    const payload = {
      module: MODULE_ID,
      phase,
      status,
      timestamp: nowIso(),
      ...detail,
    };
    safeCall(onStatus, payload);
    return payload;
  }

  function setPreview(parameters, reason = 'parameters') {
    const normalised = normaliseParameters(parameters);
    const signature = parameterSignature(normalised);
    if (signature === lastParameterSignature && readGaea().preview) return readGaea().preview;
    lastParameterSignature = signature;
    previewRevision += 1;
    const preview = browserPreview(normalised, previewRevision);
    writeGaea({
      mode: readGaea().mode === 'gaea-worker' ? 'gaea-worker' : 'browser-preview',
      parameters: normalised,
      preview,
    });
    emit('preview', 'ready', {
      reason,
      revision: preview.revision,
      approximation: true,
      authoritativeElevationChanged: false,
      runtimeParameters: preview.runtimeParameters,
    });
    return preview;
  }

  function workerUnavailable(reason, error = null) {
    const detail = {
      status: 'unavailable',
      available: false,
      reason,
      checkedAt: nowIso(),
      error: error ? String(error.message || error) : null,
    };
    writeGaea({ worker: detail });
    emit('worker-health', 'unavailable', detail);
    return { ok: false, ...detail };
  }

  function workerFailure(reason, error) {
    const detail = {
      status: 'failed',
      available: false,
      reason,
      checkedAt: nowIso(),
      error: String(error?.message || error || reason),
    };
    writeGaea({ worker: detail });
    emit('worker-health', 'failed', detail);
    return { ok: false, ...detail };
  }

  function clearPending(requestId, result) {
    const entry = pending.get(requestId);
    if (!entry) return false;
    pending.delete(requestId);
    clearTimeout(entry.timer);
    entry.resolve(result);
    return true;
  }

  function failAllPending(reason, error) {
    for (const [requestId, entry] of pending) {
      clearTimeout(entry.timer);
      entry.resolve({
        ok: false,
        status: 'failed',
        requestId,
        reason,
        error: String(error?.message || error || reason),
      });
    }
    pending.clear();
    activeBuildId = null;
  }

  function terminateWorker(reason = 'reset') {
    if (!worker) return;
    try {
      worker.terminate();
    } catch {
      // A worker that already terminated needs no further handling.
    }
    worker = null;
    workerConfigKey = '';
    failAllPending(reason, reason);
  }

  async function applyWorkerResult(data, requestId) {
    const result = data.result ?? data.output ?? data.payload ?? null;
    const completedAt = nowIso();
    const buildState = {
      status: 'succeeded',
      requestId,
      progress: 1,
      completedAt,
      resultMetadata: data.metadata || null,
      authoritative: true,
    };
    writeGaea({ mode: 'gaea-worker', build: buildState });
    let callbackError = null;
    if (typeof onBuildApplied === 'function') {
      try {
        await onBuildApplied({
          module: MODULE_ID,
          protocol: WORKER_PROTOCOL,
          requestId,
          result,
          metadata: data.metadata || null,
          parameters: readGaea().parameters,
          completedAt,
        });
      } catch (error) {
        callbackError = error;
      }
    }
    if (callbackError) {
      const failed = {
        ...buildState,
        status: 'failed',
        error: `build-result-apply-failed: ${callbackError.message || callbackError}`,
      };
      writeGaea({ build: failed });
      emit('worker-build', 'failed', failed);
      clearPending(requestId, { ok: false, ...failed });
    } else {
      emit('worker-build', 'succeeded', buildState);
      clearPending(requestId, { ok: true, ...buildState, result });
    }
    if (activeBuildId === requestId) activeBuildId = null;
  }

  function handleWorkerMessage(event) {
    if (disposed) return;
    const data = event?.data || {};
    const type = String(data.type || data.event || '').toLowerCase();
    const explicitRequestId = data.requestId || data.id || null;
    const requestId = explicitRequestId || activeBuildId;

    if (['gaea:progress', 'build-progress', 'progress'].includes(type)) {
      if (!requestId || requestId !== activeBuildId) return;
      const rawProgress = Number(data.progress ?? data.percent ?? 0);
      const progress = clamp(rawProgress > 1 ? rawProgress / 100 : rawProgress, 0, 1);
      const buildState = {
        ...(readGaea().build || {}),
        status: 'building',
        requestId,
        progress,
        stage: data.stage || data.message || null,
        updatedAt: nowIso(),
      };
      writeGaea({ build: buildState });
      emit('worker-build', 'building', buildState);
      return;
    }

    if (['gaea:health', 'health', 'pong', 'ready'].includes(type)) {
      const healthRequestId = explicitRequestId ||
        [...pending.entries()].find(([, entry]) => entry.kind === 'health')?.[0] ||
        null;
      const healthState = {
        status: 'ready',
        available: true,
        protocol: data.protocol || WORKER_PROTOCOL,
        workerVersion: data.version || data.workerVersion || null,
        capabilities: data.capabilities || [],
        checkedAt: nowIso(),
      };
      writeGaea({ worker: healthState });
      emit('worker-health', 'ready', healthState);
      if (healthRequestId) clearPending(healthRequestId, { ok: true, ...healthState });
      return;
    }

    if (['gaea:result', 'gaea:complete', 'build-complete', 'result', 'complete'].includes(type)) {
      if (!requestId || !pending.has(requestId)) return;
      void applyWorkerResult(data, requestId);
      return;
    }

    if (['gaea:error', 'build-error', 'error', 'failed'].includes(type)) {
      const errorMessage = String(data.error?.message || data.error || data.message || 'GAEA Worker build failed');
      if (requestId && pending.has(requestId)) {
        const failed = {
          status: 'failed',
          requestId,
          progress: readGaea().build?.progress || 0,
          error: errorMessage,
          failedAt: nowIso(),
        };
        writeGaea({ build: failed });
        emit('worker-build', 'failed', failed);
        clearPending(requestId, { ok: false, ...failed });
        if (activeBuildId === requestId) activeBuildId = null;
      } else {
        workerFailure('worker-reported-error', errorMessage);
      }
    }
  }

  function handleWorkerError(event) {
    const error = event?.error || new Error(event?.message || 'GAEA Worker error');
    workerFailure('worker-runtime-error', error);
    failAllPending('worker-runtime-error', error);
    terminateWorker('worker-runtime-error');
  }

  function ensureWorker() {
    if (disposed) return { ok: false, reason: 'disposed' };
    const config = configuredWorker(adapter);
    if (!config.factory && !config.url) return workerUnavailable('worker-not-configured');
    if (!config.factory && typeof globalThis.Worker !== 'function') {
      return workerUnavailable('worker-api-unavailable');
    }
    const key = `${config.url || 'factory'}|${JSON.stringify(config.options || {})}`;
    if (worker && workerConfigKey === key) return { ok: true, worker };
    if (worker) terminateWorker('worker-configuration-changed');
    try {
      worker = config.factory
        ? config.factory({ protocol: WORKER_PROTOCOL, module: MODULE_ID })
        : new globalThis.Worker(config.url, config.options);
      if (!worker || typeof worker.postMessage !== 'function') {
        throw new TypeError('worker factory did not return a Worker-compatible object');
      }
      workerConfigKey = key;
      if (typeof worker.addEventListener === 'function') {
        worker.addEventListener('message', handleWorkerMessage);
        worker.addEventListener('error', handleWorkerError);
        worker.addEventListener('messageerror', handleWorkerError);
      } else {
        worker.onmessage = handleWorkerMessage;
        worker.onerror = handleWorkerError;
      }
      return { ok: true, worker };
    } catch (error) {
      worker = null;
      workerConfigKey = '';
      return workerFailure('worker-start-failed', error);
    }
  }

  function waitForWorker(requestId, kind, timeoutMs) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        const timeoutResult = {
          ok: false,
          status: 'failed',
          requestId,
          reason: `${kind}-timeout`,
          error: `${kind} timed out after ${timeoutMs} ms`,
        };
        if (kind === 'health') workerFailure('worker-health-timeout', timeoutResult.error);
        if (kind === 'build') {
          const failed = { ...timeoutResult, failedAt: nowIso(), progress: readGaea().build?.progress || 0 };
          writeGaea({ build: failed });
          emit('worker-build', 'failed', failed);
          if (activeBuildId === requestId) activeBuildId = null;
        }
        resolve(timeoutResult);
      }, timeoutMs);
      pending.set(requestId, { kind, timer, resolve });
    });
  }

  async function health({ force = true, timeoutMs = HEALTH_TIMEOUT_MS } = {}) {
    if (disposed) return { ok: false, status: 'unavailable', reason: 'disposed' };
    const existing = readGaea().worker;
    if (!force && existing?.status === 'ready' && worker) return { ok: true, ...existing };
    const ensured = ensureWorker();
    if (!ensured.ok) return { ok: false, status: ensured.status || 'unavailable', reason: ensured.reason };
    const requestId = `health-${Date.now()}-${++requestSequence}`;
    const checking = { status: 'checking', available: null, requestId, checkedAt: nowIso() };
    writeGaea({ worker: checking });
    emit('worker-health', 'checking', checking);
    const response = waitForWorker(requestId, 'health', Math.max(250, Number(timeoutMs) || HEALTH_TIMEOUT_MS));
    try {
      worker.postMessage({ type: 'gaea:health', protocol: WORKER_PROTOCOL, requestId });
    } catch (error) {
      clearPending(requestId, workerFailure('worker-health-send-failed', error));
    }
    return response;
  }

  async function build(request = {}) {
    if (disposed) return { ok: false, status: 'unavailable', reason: 'disposed' };
    const currentParameters = normaliseParameters(readGaea().parameters || GAEA_DEFAULT_PARAMETERS);
    const buildRequest = resolveBuildRequest(request, currentParameters);
    const preview = setPreview(buildRequest.parameters, buildRequest.preset ? `preset:${buildRequest.preset}` : 'build');
    const ensured = ensureWorker();
    if (!ensured.ok) {
      const failureStatus = ensured.status === 'failed' ? 'failed' : 'unavailable';
      const unavailable = {
        status: failureStatus,
        requestId: null,
        progress: 0,
        reason: ensured.reason || 'worker-unavailable',
        previewRevision: preview.revision,
        approximationStillActive: true,
        failedAt: nowIso(),
      };
      writeGaea({ mode: 'browser-preview', build: unavailable });
      emit('worker-build', failureStatus, unavailable);
      return { ok: false, ...unavailable, preview };
    }
    if (activeBuildId) cancel('superseded');
    const requestId = `build-${Date.now()}-${++requestSequence}`;
    activeBuildId = requestId;
    const buildState = {
      status: 'building',
      requestId,
      progress: 0,
      stage: 'queued',
      startedAt: nowIso(),
      preset: buildRequest.preset,
      authoritative: false,
    };
    writeGaea({ mode: 'gaea-worker', parameters: buildRequest.parameters, build: buildState });
    emit('worker-build', 'building', buildState);
    const response = waitForWorker(requestId, 'build', BUILD_TIMEOUT_MS);
    const message = {
      type: 'gaea:build',
      protocol: WORKER_PROTOCOL,
      requestId,
      parameters: buildRequest.parameters,
      input: buildRequest.input,
      metadata: buildRequest.metadata,
    };
    try {
      worker.postMessage(message, buildRequest.transfer);
    } catch (error) {
      const failed = {
        status: 'failed',
        requestId,
        progress: 0,
        error: String(error.message || error),
        failedAt: nowIso(),
      };
      writeGaea({ build: failed });
      emit('worker-build', 'failed', failed);
      clearPending(requestId, { ok: false, ...failed });
      activeBuildId = null;
    }
    return response;
  }

  function cancel(reason = 'user') {
    if (!activeBuildId) return { ok: false, status: 'idle', reason: 'no-active-build' };
    const requestId = activeBuildId;
    try {
      worker?.postMessage({ type: 'gaea:cancel', protocol: WORKER_PROTOCOL, requestId, reason });
    } catch {
      // Local cancellation remains valid if the worker stopped first.
    }
    const cancelled = {
      status: 'cancelled',
      requestId,
      progress: readGaea().build?.progress || 0,
      reason,
      cancelledAt: nowIso(),
      approximationStillActive: true,
    };
    writeGaea({ mode: 'browser-preview', build: cancelled });
    emit('worker-build', 'cancelled', cancelled);
    clearPending(requestId, { ok: false, ...cancelled });
    activeBuildId = null;
    return { ok: true, ...cancelled };
  }

  function reset() {
    if (disposed) return { ok: false, status: 'unavailable', reason: 'disposed' };
    if (activeBuildId) cancel('reset');
    if (worker) {
      try {
        worker.postMessage({
          type: 'gaea:reset',
          protocol: WORKER_PROTOCOL,
          requestId: `reset-${Date.now()}-${++requestSequence}`,
        });
      } catch {
        // Termination below is the definitive local reset fallback.
      }
    }
    terminateWorker('reset');
    lastParameterSignature = '';
    const preview = setPreview(GAEA_DEFAULT_PARAMETERS, 'reset');
    const config = configuredWorker(adapter);
    const unavailableReason = !config.factory && !config.url
      ? 'worker-not-configured'
      : typeof globalThis.Worker !== 'function' && !config.factory
        ? 'worker-api-unavailable'
        : null;
    const workerState = unavailableReason
      ? { status: 'unavailable', available: false, reason: unavailableReason, checkedAt: nowIso() }
      : { status: 'idle', available: null, reason: 'health-not-checked', checkedAt: null };
    const buildState = { status: 'idle', requestId: null, progress: 0, authoritative: false };
    writeGaea({
      mode: 'browser-preview',
      parameters: copyParameters(GAEA_DEFAULT_PARAMETERS),
      preview,
      worker: workerState,
      build: buildState,
    });
    emit('reset', 'ready', { previewRevision: preview.revision, worker: workerState });
    return { ok: true, status: 'ready', preview, worker: workerState, build: buildState };
  }

  function synchroniseFromStore() {
    if (disposed || writingStore) return;
    const gaea = readGaea();
    const parameters = normaliseParameters(gaea.parameters || GAEA_DEFAULT_PARAMETERS);
    const signature = parameterSignature(parameters);
    if (signature !== lastParameterSignature) setPreview(parameters, 'store-update');
    if (
      gaea.autoBuildOnCommit === true &&
      gaea.commitRevision != null &&
      gaea.commitRevision !== lastCommitRevision
    ) {
      lastCommitRevision = gaea.commitRevision;
      void build({ parameters, metadata: { reason: 'parameter-commit', commitRevision: gaea.commitRevision } });
    }
  }

  const unsubscribe = adapter.subscribe(synchroniseFromStore);

  const initial = readGaea();
  const initialParameters = normaliseParameters(initial.parameters || GAEA_DEFAULT_PARAMETERS);
  setPreview(initialParameters, 'initialise');
  const initialConfig = configuredWorker(adapter);
  const initialUnavailableReason = !initialConfig.factory && !initialConfig.url
    ? 'worker-not-configured'
    : !initialConfig.factory && typeof globalThis.Worker !== 'function'
      ? 'worker-api-unavailable'
      : null;
  if (initialUnavailableReason) {
    const unavailable = {
      status: 'unavailable',
      available: false,
      reason: initialUnavailableReason,
      checkedAt: nowIso(),
    };
    writeGaea({
      mode: 'browser-preview',
      worker: unavailable,
      build: initial.build || { status: 'idle', requestId: null, progress: 0, authoritative: false },
    });
    emit('worker-health', 'unavailable', unavailable);
  } else if (!initial.worker) {
    writeGaea({
      worker: { status: 'idle', available: null, reason: 'health-not-checked', checkedAt: null },
      build: initial.build || { status: 'idle', requestId: null, progress: 0, authoritative: false },
    });
  }

  function dispose() {
    if (disposed) return;
    if (activeBuildId) cancel('dispose');
    terminateWorker('dispose');
    unsubscribe();
    disposed = true;
    emit('lifecycle', 'disposed');
  }

  return { health, build, cancel, reset, dispose };
}
