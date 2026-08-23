export const CORE_IDS = Object.freeze([
  'zhenbao-ding',
  'guilin-old-city',
  'yangtang-airfield',
  'yangshuo-county-seat',
]);

const CORE_ID_SET = new Set(CORE_IDS);
const DEFAULT_BASE_URL = new URL('./assets/cores/', import.meta.url).href;
const HOST_IS_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

function abortError(message = 'Core DEM load was cancelled') {
  if (typeof DOMException === 'function') return new DOMException(message, 'AbortError');
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function assertCoreId(id) {
  if (!CORE_ID_SET.has(id)) {
    throw new RangeError(`Unknown Guilin core: ${String(id)}`);
  }
  return id;
}

function normalizeBaseUrl(baseUrl) {
  const resolved = new URL(baseUrl || DEFAULT_BASE_URL, import.meta.url);
  return resolved.href.endsWith('/') ? resolved.href : `${resolved.href}/`;
}

function manifestUrl(baseUrl, id) {
  return new URL(`${id}/manifest.json`, baseUrl).href;
}

function uint16LittleEndian(buffer) {
  if (buffer.byteLength % 2 !== 0) throw new Error('Core height binary has an odd byte length');
  if (HOST_IS_LITTLE_ENDIAN) return new Uint16Array(buffer);
  const source = new DataView(buffer);
  const values = new Uint16Array(buffer.byteLength / 2);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = source.getUint16(index * 2, true);
  }
  return values;
}

function validateManifest(manifest, expectedId) {
  if (!manifest || manifest.schemaVersion !== 'guilin-core-dem/v1') {
    throw new Error(`${expectedId}: unsupported core manifest schema`);
  }
  if (manifest.id !== expectedId) throw new Error(`${expectedId}: manifest ID mismatch`);
  if (manifest.crs !== 'EPSG:32649') throw new Error(`${expectedId}: unexpected core CRS`);
  if (manifest.raster?.width !== 800 || manifest.raster?.height !== 800) {
    throw new Error(`${expectedId}: core raster must be 800 by 800 pixels`);
  }
  if (manifest.raster?.resolutionMeters !== 12.5) {
    throw new Error(`${expectedId}: core raster must preserve 12.5 metre samples`);
  }
  if (manifest.widthMeters !== 10000 || manifest.heightMeters !== 10000) {
    throw new Error(`${expectedId}: core extent must be exactly 10 km by 10 km`);
  }
  if (!Array.isArray(manifest.projectedBounds) || manifest.projectedBounds.length !== 4) {
    throw new Error(`${expectedId}: projected bounds are missing`);
  }
  return manifest;
}

function forwardAbort(sourceSignal, controller) {
  if (!sourceSignal) return () => {};
  if (sourceSignal.aborted) {
    controller.abort(sourceSignal.reason);
    return () => {};
  }
  const abort = () => controller.abort(sourceSignal.reason);
  sourceSignal.addEventListener('abort', abort, { once: true });
  return () => sourceSignal.removeEventListener('abort', abort);
}

async function fetchChecked(url, signal, kind) {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`${kind} HTTP ${response.status}: ${url}`);
  return response;
}

export function createCoreLoader({ baseUrl = DEFAULT_BASE_URL, onStatus } = {}) {
  const resolvedBaseUrl = normalizeBaseUrl(baseUrl);
  const manifests = new Map();
  const cache = new Map();
  const inFlight = new Map();
  let activeId = null;
  let disposed = false;

  const emit = (type, detail = {}) => {
    if (typeof onStatus !== 'function') return;
    try {
      onStatus({ type, activeId, ...detail });
    } catch (error) {
      console.warn('Guilin core-loader onStatus callback failed', error);
    }
  };

  const ensureAvailable = () => {
    if (disposed) throw new Error('Guilin core loader has been disposed');
  };

  async function getManifest(id, { signal } = {}) {
    ensureAvailable();
    assertCoreId(id);
    if (signal?.aborted) throw abortError();
    if (manifests.has(id)) return manifests.get(id);
    const url = manifestUrl(resolvedBaseUrl, id);
    emit('manifest-load-start', { id, url });
    try {
      const response = await fetchChecked(url, signal, 'core manifest');
      const manifest = validateManifest(await response.json(), id);
      manifests.set(id, manifest);
      emit('manifest-loaded', { id, url, manifest });
      return manifest;
    } catch (error) {
      emit(error?.name === 'AbortError' ? 'manifest-load-aborted' : 'manifest-load-error', { id, url, error });
      throw error;
    }
  }

  async function loadCore(id, { signal } = {}) {
    ensureAvailable();
    assertCoreId(id);
    if (signal?.aborted) throw abortError();

    if (cache.has(id)) {
      const previousId = activeId;
      activeId = id;
      if (previousId && previousId !== id) emit('switch', { id, previousId, cached: true });
      emit('cache-hit', { id });
      return cache.get(id);
    }
    if (inFlight.has(id)) return inFlight.get(id).promise;

    for (const [pendingId, pending] of inFlight) {
      if (pendingId !== id) pending.controller.abort(abortError(`Switched from ${pendingId} to ${id}`));
    }
    const previousId = activeId;
    activeId = id;
    if (previousId && previousId !== id) emit('switch', { id, previousId, cached: false });

    const controller = new AbortController();
    const detachAbort = forwardAbort(signal, controller);
    const promise = (async () => {
      emit('load-start', { id });
      try {
        const manifest = await getManifest(id, { signal: controller.signal });
        const base = manifestUrl(resolvedBaseUrl, id);
        const heightUrl = new URL(manifest.heightBinary, base).href;
        const maskUrl = new URL(manifest.maskBinary, base).href;
        const [heightResponse, maskResponse] = await Promise.all([
          fetchChecked(heightUrl, controller.signal, 'core height'),
          fetchChecked(maskUrl, controller.signal, 'core mask'),
        ]);
        const [heightBuffer, maskBuffer] = await Promise.all([
          heightResponse.arrayBuffer(),
          maskResponse.arrayBuffer(),
        ]);
        if (controller.signal.aborted) throw abortError();

        const height = uint16LittleEndian(heightBuffer);
        const mask = new Uint8Array(maskBuffer);
        const gridWidth = Number(manifest.raster.width);
        const gridHeight = Number(manifest.raster.height);
        const expectedPixels = gridWidth * gridHeight;
        if (height.length !== expectedPixels) {
          throw new Error(`${id}: expected ${expectedPixels} height samples, received ${height.length}`);
        }
        if (mask.length !== expectedPixels) {
          throw new Error(`${id}: expected ${expectedPixels} mask samples, received ${mask.length}`);
        }

        const result = Object.freeze({
          manifest,
          height,
          heights: height,
          mask,
          width: gridWidth,
          gridWidth,
          gridHeight,
          heightPixels: gridHeight,
          minElevation: Number(manifest.minimumElevation),
          maxElevation: Number(manifest.maximumElevation),
          widthMeters: Number(manifest.widthMeters),
          heightMeters: Number(manifest.heightMeters),
          wgs84Bounds: Object.freeze([...manifest.wgs84Bounds]),
          centerProjected: Object.freeze([...manifest.centerProjected]),
          sourceStatus: manifest.sourceStatus || manifest.status,
        });
        cache.set(id, result);
        emit('loaded', { id, result });
        return result;
      } catch (error) {
        const cancelled = controller.signal.aborted || error?.name === 'AbortError';
        emit(cancelled ? 'load-aborted' : 'load-error', { id, error });
        if (cancelled && error?.name !== 'AbortError') throw abortError();
        throw error;
      } finally {
        detachAbort();
        inFlight.delete(id);
      }
    })();
    inFlight.set(id, { controller, promise });
    return promise;
  }

  function release(id) {
    assertCoreId(id);
    const pending = inFlight.get(id);
    if (pending) pending.controller.abort(abortError(`Released ${id}`));
    inFlight.delete(id);
    manifests.delete(id);
    const released = cache.delete(id);
    if (activeId === id) activeId = null;
    emit('released', { id, released });
    return released;
  }

  function dispose() {
    if (disposed) return;
    for (const pending of inFlight.values()) pending.controller.abort(abortError('Core loader disposed'));
    inFlight.clear();
    manifests.clear();
    cache.clear();
    activeId = null;
    disposed = true;
    emit('disposed');
  }

  return Object.freeze({ loadCore, getManifest, release, dispose });
}
