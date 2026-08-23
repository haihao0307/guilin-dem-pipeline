export const ECOLOGY_CLAIM = 'deterministic-historical-reconstruction-preview';

export const ECOLOGY_CATEGORY = Object.freeze({
  forest: 0,
  shrub: 1,
  paddy: 2,
  dryCrops: 3,
  orchard: 4,
  bund: 5,
});

const CATEGORY_DEFINITIONS = Object.freeze([
  Object.freeze({ key: 'forest', stateKey: 'showForest', size: 9.5, windResponse: 1.0 }),
  Object.freeze({ key: 'shrub', stateKey: 'showShrubs', size: 2.1, windResponse: 0.78 }),
  Object.freeze({ key: 'paddy', stateKey: 'showPaddy', size: 0.62, windResponse: 0.92 }),
  Object.freeze({ key: 'dryCrops', stateKey: 'showDryCrops', size: 0.86, windResponse: 0.88 }),
  Object.freeze({ key: 'orchard', stateKey: 'showOrchards', size: 4.8, windResponse: 0.72 }),
  Object.freeze({ key: 'bund', stateKey: 'showBunds', size: 0.34, windResponse: 0.08 }),
]);

const CATEGORY_BY_KEY = new Map(CATEGORY_DEFINITIONS.map((definition) => [definition.key, definition]));
const SEASONS = new Set(['spring', 'summer', 'autumn', 'winter']);
const YEARS = new Set([1940, 1941, 1942, 1943, 1944, 1945]);
const EMPTY_FLOAT32 = new Float32Array(0);

const CORE_TARGETS = Object.freeze({
  'zhenbao-ding': Object.freeze({ forest: 10800, shrub: 3800, paddy: 2100, dryCrops: 1700, orchard: 1700, bund: 2500 }),
  'guilin-old-city': Object.freeze({ forest: 6200, shrub: 2800, paddy: 4300, dryCrops: 2400, orchard: 2600, bund: 3900 }),
  'yangtang-airfield': Object.freeze({ forest: 5200, shrub: 2500, paddy: 6100, dryCrops: 3600, orchard: 1900, bund: 4700 }),
  'yangshuo-county-seat': Object.freeze({ forest: 7800, shrub: 3200, paddy: 4100, dryCrops: 2200, orchard: 3000, bund: 3500 }),
  core: Object.freeze({ forest: 7600, shrub: 3100, paddy: 4000, dryCrops: 2500, orchard: 2300, bund: 3600 }),
  overall: Object.freeze({ forest: 1200, shrub: 450, paddy: 520, dryCrops: 360, orchard: 300, bund: 520 }),
});

const YEAR_DENSITY = Object.freeze({
  1940: 0.94,
  1941: 0.97,
  1942: 1.0,
  1943: 0.95,
  1944: 0.9,
  1945: 0.88,
});

const SEASON_PALETTES = Object.freeze({
  spring: Object.freeze({
    forest: [0.18, 0.39, 0.2], shrub: [0.31, 0.49, 0.24], paddy: [0.43, 0.68, 0.34],
    dryCrops: [0.57, 0.61, 0.31], orchard: [0.31, 0.47, 0.22], bund: [0.42, 0.34, 0.21],
  }),
  summer: Object.freeze({
    forest: [0.09, 0.29, 0.15], shrub: [0.18, 0.38, 0.18], paddy: [0.28, 0.57, 0.27],
    dryCrops: [0.46, 0.56, 0.25], orchard: [0.18, 0.37, 0.16], bund: [0.38, 0.31, 0.19],
  }),
  autumn: Object.freeze({
    forest: [0.19, 0.31, 0.16], shrub: [0.34, 0.4, 0.18], paddy: [0.64, 0.55, 0.22],
    dryCrops: [0.62, 0.48, 0.2], orchard: [0.39, 0.36, 0.15], bund: [0.43, 0.31, 0.18],
  }),
  winter: Object.freeze({
    forest: [0.14, 0.25, 0.16], shrub: [0.27, 0.32, 0.2], paddy: [0.43, 0.4, 0.25],
    dryCrops: [0.49, 0.42, 0.25], orchard: [0.28, 0.3, 0.18], bund: [0.39, 0.32, 0.23],
  }),
});

const DEFAULT_STATE = Object.freeze({
  activeCoreId: 'overall',
  showInstances: true,
  showForest: true,
  showShrubs: true,
  showPaddy: true,
  showDryCrops: true,
  showOrchards: true,
  showBunds: true,
  forestDensity: 0.72,
  season: 'summer',
  year: 1942,
  windDirection: 135,
  windSpeed: 4.2,
  gustStrength: 0.28,
  terrainRevision: 0,
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyCounts() {
  return { forest: 0, shrub: 0, paddy: 0, dryCrops: 0, orchard: 0, bund: 0, total: 0 };
}

function emptyRenderData(datasetId = null, state = DEFAULT_STATE, diagnostics = {}) {
  return Object.freeze({
    datasetId,
    activeCoreId: state.activeCoreId,
    positions: EMPTY_FLOAT32,
    colors: EMPTY_FLOAT32,
    sizes: EMPTY_FLOAT32,
    categories: EMPTY_FLOAT32,
    windVectors: EMPTY_FLOAT32,
    windPhases: EMPTY_FLOAT32,
    counts: Object.freeze(emptyCounts()),
    count: 0,
    channelVegetationCount: 0,
    excludedCandidateCount: diagnostics.excludedCandidateCount || 0,
    rootPinned: true,
    rootHeightSource: 'sampleHeight',
    rootTerrainRevision: state.terrainRevision,
    claim: ECOLOGY_CLAIM,
    nativeSurveyClaim: false,
    season: state.season,
    year: state.year,
    wind: Object.freeze({ directionDegrees: state.windDirection, speedMetersPerSecond: state.windSpeed, gustStrength: state.gustStrength }),
  });
}

function datasetManifest(dataset) {
  if (!dataset || typeof dataset !== 'object') return null;
  return dataset.manifest && typeof dataset.manifest === 'object' ? dataset.manifest : dataset;
}

function datasetIdentity(dataset) {
  const manifest = datasetManifest(dataset);
  if (!manifest) return 'none';
  const id = manifest.id || dataset.id || 'overall';
  const bounds = manifest.projectedBounds || manifest.bounds || dataset.projectedBounds || [];
  const origin = manifest.pixelOrigin || manifest.sourceMosaic?.pixelOrigin || [];
  return `${id}|${manifest.crs || dataset.crs || 'unknown'}|${bounds.join(',')}|${origin.join(',')}|${manifest.gridWidth || manifest.raster?.width || dataset.gridWidth || 0}x${manifest.gridHeight || manifest.raster?.height || dataset.gridHeight || 0}`;
}

function dimensions(dataset) {
  const manifest = datasetManifest(dataset) || {};
  const bounds = manifest.projectedBounds || manifest.bounds || dataset?.projectedBounds;
  const boundsWidth = Array.isArray(bounds) && bounds.length === 4 ? Number(bounds[2]) - Number(bounds[0]) : 0;
  const boundsHeight = Array.isArray(bounds) && bounds.length === 4 ? Number(bounds[3]) - Number(bounds[1]) : 0;
  const width = finiteNumber(dataset?.widthMeters, finiteNumber(manifest.widthMeters, boundsWidth || 10000));
  const height = finiteNumber(dataset?.heightMeters, finiteNumber(manifest.heightMeters, boundsHeight || 10000));
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

function elevationRange(dataset) {
  const manifest = datasetManifest(dataset) || {};
  const minimum = finiteNumber(dataset?.minElevation, finiteNumber(manifest.minimumElevation, finiteNumber(manifest.minimumElevationMeters, 0)));
  const maximum = finiteNumber(dataset?.maxElevation, finiteNumber(manifest.maximumElevation, finiteNumber(manifest.maximumElevationMeters, minimum + 1)));
  return { minimum, maximum: Math.max(minimum + 0.001, maximum) };
}

function sampleElevation(sampleHeight, x, z) {
  const sampled = sampleHeight(x, z);
  if (typeof sampled === 'number') return Number.isFinite(sampled) ? sampled : null;
  if (sampled && typeof sampled === 'object') {
    const value = sampled.elevationMeters ?? sampled.elevation ?? sampled.height;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }
  return null;
}

function sampleTerrain(sampleHeight, x, z, step) {
  const elevation = sampleElevation(sampleHeight, x, z);
  if (elevation === null) return null;
  const east = sampleElevation(sampleHeight, x + step, z);
  const north = sampleElevation(sampleHeight, x, z + step);
  if (east === null || north === null) return null;
  const slope = Math.hypot((east - elevation) / step, (north - elevation) / step);
  return { elevation, slope };
}

function normalizeState(previous, patch = {}) {
  const next = { ...previous, ...patch };
  next.activeCoreId = String(next.activeCoreId || previous.activeCoreId || 'overall');
  next.showInstances = next.showInstances !== false;
  for (const definition of CATEGORY_DEFINITIONS) next[definition.stateKey] = next[definition.stateKey] !== false;
  next.forestDensity = clamp(finiteNumber(next.forestDensity, DEFAULT_STATE.forestDensity), 0, 1);
  next.season = SEASONS.has(String(next.season).toLowerCase()) ? String(next.season).toLowerCase() : DEFAULT_STATE.season;
  next.year = YEARS.has(Number(next.year)) ? Number(next.year) : DEFAULT_STATE.year;
  next.windDirection = ((finiteNumber(next.windDirection, DEFAULT_STATE.windDirection) % 360) + 360) % 360;
  next.windSpeed = clamp(finiteNumber(next.windSpeed, DEFAULT_STATE.windSpeed), 0, 60);
  next.gustStrength = clamp(finiteNumber(next.gustStrength, DEFAULT_STATE.gustStrength), 0, 1);
  next.terrainRevision = Math.max(0, Math.trunc(finiteNumber(next.terrainRevision, previous.terrainRevision ?? 0)));
  return next;
}

function categoryTarget(datasetId, category) {
  const targetSet = CORE_TARGETS[datasetId] || (datasetId === 'overall' ? CORE_TARGETS.overall : CORE_TARGETS.core);
  return targetSet[category] || 0;
}

function categoryAccepts(category, terrain, normalizedElevation, moisture, pattern) {
  switch (category) {
    case 'forest':
      return terrain.slope <= 1.65 && normalizedElevation >= 0.06 && moisture >= 0.18 && pattern >= 0.12;
    case 'shrub':
      return terrain.slope <= 1.9 && normalizedElevation >= 0.04 && moisture >= 0.12;
    case 'paddy':
      return terrain.slope <= 0.12 && normalizedElevation <= 0.58 && moisture >= 0.38;
    case 'dryCrops':
      return terrain.slope <= 0.34 && normalizedElevation <= 0.78 && moisture >= 0.14 && moisture <= 0.82;
    case 'orchard':
      return terrain.slope <= 0.46 && normalizedElevation >= 0.04 && normalizedElevation <= 0.76 && pattern >= 0.22;
    case 'bund':
      return terrain.slope <= 0.22 && normalizedElevation <= 0.68;
    default:
      return false;
  }
}

function hydrologyRevision(hydrologyRuntime) {
  if (!hydrologyRuntime || typeof hydrologyRuntime.getDiagnostics !== 'function') return 'none';
  try {
    const diagnostics = hydrologyRuntime.getDiagnostics() || {};
    return [
      diagnostics.revision,
      diagnostics.datasetId || diagnostics.activeDatasetId,
      diagnostics.loaded,
      diagnostics.segmentCount || diagnostics.totalSegments,
      diagnostics.exclusionZoneCount,
    ].join('|');
  } catch (_error) {
    return 'diagnostics-error';
  }
}

export function createEcologyCoreRuntime({ onStatus, hydrologyRuntime } = {}) {
  let dataset = null;
  let datasetId = null;
  let identity = 'none';
  let state = { ...DEFAULT_STATE };
  let baseInstances = null;
  let baseKey = null;
  let renderCache = null;
  let cachedSampleHeight = null;
  let disposed = false;
  let generation = 0;
  let releasedDenseInstanceCount = 0;
  let excludedCandidateCount = 0;
  let lastError = null;
  let exclusionWarningEmitted = false;

  const emit = (type, detail = {}) => {
    if (typeof onStatus !== 'function') return;
    try {
      onStatus({ type, datasetId, activeCoreId: state.activeCoreId, claim: ECOLOGY_CLAIM, nativeSurveyClaim: false, ...detail });
    } catch (error) {
      console.warn('Guilin ecology onStatus callback failed', error);
    }
  };

  const ensureAvailable = () => {
    if (disposed) throw new Error('Guilin ecology runtime has been disposed');
  };

  function releaseDenseInstances(reason = 'manual-release') {
    const released = baseInstances?.count || 0;
    releasedDenseInstanceCount += released;
    baseInstances = null;
    baseKey = null;
    renderCache = null;
    cachedSampleHeight = null;
    if (released > 0) emit('dense-instances-released', { reason, released });
    return released;
  }

  function setDataset(nextDataset) {
    ensureAvailable();
    if (!nextDataset || typeof nextDataset !== 'object') throw new TypeError('Ecology dataset must be an object');
    const manifest = datasetManifest(nextDataset);
    const nextId = String(manifest?.id || nextDataset.id || 'overall');
    const nextIdentity = datasetIdentity(nextDataset);
    if (dataset && nextDataset !== dataset) releaseDenseInstances('dataset-switch');
    dataset = nextDataset;
    datasetId = nextId;
    identity = nextIdentity;
    state = normalizeState(state, { activeCoreId: nextId });
    lastError = null;
    emit('dataset-set', {
      densityPolicy: nextId === 'overall' ? 'overall-low-density-aggregate' : 'active-core-dense',
      identity,
    });
    return getDiagnostics();
  }

  function updateState(patch = {}) {
    ensureAvailable();
    const previousCore = state.activeCoreId;
    state = normalizeState(state, patch);
    if (state.activeCoreId !== previousCore) releaseDenseInstances('active-core-id-change');
    renderCache = null;
    emit('state-updated', { state: { ...state } });
    return { ...state };
  }

  function isLandExcluded(x, z, width, height) {
    if (!hydrologyRuntime || typeof hydrologyRuntime.isLandExcluded !== 'function') return false;
    const xNorm = x / width + 0.5;
    const zNorm = 0.5 - z / height;
    try {
      return Boolean(hydrologyRuntime.isLandExcluded(xNorm, zNorm, {
        x,
        z,
        dataset,
        manifest: datasetManifest(dataset),
      }));
    } catch (error) {
      lastError = error;
      if (!exclusionWarningEmitted) {
        exclusionWarningEmitted = true;
        emit('hydrology-exclusion-error', { error });
      }
      return false;
    }
  }

  function generateBaseInstances(sampleHeight) {
    if (!dataset) throw new Error('Set an ecology dataset before requesting render data');
    if (typeof sampleHeight !== 'function') throw new TypeError('getRenderData requires a sampleHeight(x, z) function');

    const manifest = datasetManifest(dataset) || {};
    const { width, height } = dimensions(dataset);
    const { minimum, maximum } = elevationRange(dataset);
    const activeId = state.activeCoreId || datasetId;
    const seedLabel = `${activeId}|${identity}|${manifest.sourceLineage?.lineageId || manifest.lineage || 'declared-manifest'}`;
    const generatedKey = `${seedLabel}|${hydrologyRevision(hydrologyRuntime)}|terrain:${state.terrainRevision}`;
    const margin = Math.max(10, Math.min(width, height) * 0.006);
    const terrainStep = Math.max(12.5, Math.min(75, Math.min(width, height) / 600));
    const bundSpacing = activeId === 'overall' ? 1200 : 140;
    const xz = [];
    const categories = [];
    const priorities = [];
    const scales = [];
    const variations = [];
    const phases = [];
    excludedCandidateCount = 0;

    for (const definition of CATEGORY_DEFINITIONS) {
      const category = definition.key;
      const target = categoryTarget(activeId, category);
      const random = mulberry32(fnv1a(`${seedLabel}|${category}`));
      const maximumAttempts = target * (category === 'paddy' || category === 'bund' ? 22 : 12);
      let accepted = 0;
      for (let attempt = 0; attempt < maximumAttempts && accepted < target; attempt += 1) {
        let x = (random() - 0.5) * Math.max(1, width - margin * 2);
        let z = (random() - 0.5) * Math.max(1, height - margin * 2);
        if (category === 'bund') {
          if (random() < 0.5) x = Math.round(x / bundSpacing) * bundSpacing + (random() - 0.5) * 4;
          else z = Math.round(z / bundSpacing) * bundSpacing + (random() - 0.5) * 4;
          x = clamp(x, -width / 2 + margin, width / 2 - margin);
          z = clamp(z, -height / 2 + margin, height / 2 - margin);
        }
        if (isLandExcluded(x, z, width, height)) {
          excludedCandidateCount += 1;
          continue;
        }
        const terrain = sampleTerrain(sampleHeight, x, z, terrainStep);
        if (!terrain) continue;
        const normalizedElevation = clamp((terrain.elevation - minimum) / (maximum - minimum), 0, 1);
        const broadPattern = 0.5 + 0.23 * Math.sin(x / Math.max(180, width / 19) + random() * 0.5)
          + 0.2 * Math.cos(z / Math.max(160, height / 23) - random() * 0.5);
        const moisture = clamp(0.68 - normalizedElevation * 0.46 - terrain.slope * 0.18 + broadPattern * 0.25, 0, 1);
        if (!categoryAccepts(category, terrain, normalizedElevation, moisture, broadPattern)) continue;

        xz.push(x, z);
        categories.push(ECOLOGY_CATEGORY[category]);
        priorities.push(random());
        scales.push(0.72 + random() * 0.62);
        variations.push(random() * 2 - 1);
        phases.push(random() * Math.PI * 2);
        accepted += 1;
      }
    }

    baseInstances = Object.freeze({
      xz: new Float32Array(xz),
      categories: new Float32Array(categories),
      priorities: new Float32Array(priorities),
      scales: new Float32Array(scales),
      variations: new Float32Array(variations),
      phases: new Float32Array(phases),
      count: categories.length,
      seed: fnv1a(seedLabel),
      seedLabel,
      terrainRevision: state.terrainRevision,
      width,
      height,
    });
    baseKey = generatedKey;
    generation += 1;
    renderCache = null;
    cachedSampleHeight = sampleHeight;
    emit('instances-generated', {
      count: baseInstances.count,
      excludedCandidateCount,
      generation,
      densityPolicy: activeId === 'overall' ? 'overall-low-density-aggregate' : 'active-core-dense',
    });
  }

  function renderSignature(currentState) {
    return [
      baseKey,
      currentState.activeCoreId,
      currentState.showInstances,
      ...CATEGORY_DEFINITIONS.map((definition) => currentState[definition.stateKey]),
      currentState.forestDensity.toFixed(4),
      currentState.season,
      currentState.year,
      currentState.windDirection.toFixed(2),
      currentState.windSpeed.toFixed(3),
      currentState.gustStrength.toFixed(4),
      currentState.terrainRevision,
      currentState.hydrologyRevision || currentState.waterWidth || '',
      hydrologyRevision(hydrologyRuntime),
    ].join('|');
  }

  function getRenderData(statePatch = {}, sampleHeight) {
    ensureAvailable();
    if (typeof statePatch === 'function' && sampleHeight === undefined) {
      sampleHeight = statePatch;
      statePatch = {};
    }
    state = normalizeState(state, statePatch || {});
    if (!dataset) return emptyRenderData(null, state);
    if (typeof sampleHeight !== 'function') throw new TypeError('getRenderData requires a sampleHeight(x, z) function');

    const requiredBaseKey = `${state.activeCoreId}|${identity}|${datasetManifest(dataset)?.sourceLineage?.lineageId || datasetManifest(dataset)?.lineage || 'declared-manifest'}|${hydrologyRevision(hydrologyRuntime)}|terrain:${state.terrainRevision}`;
    if (!baseInstances || baseKey !== requiredBaseKey || cachedSampleHeight !== sampleHeight) {
      if (baseInstances) releaseDenseInstances('terrain-or-hydrology-change');
      generateBaseInstances(sampleHeight);
    }

    const signature = renderSignature(state);
    if (renderCache?.signature === signature && cachedSampleHeight === sampleHeight) return renderCache.data;
    if (!state.showInstances || state.forestDensity <= 0) {
      const data = emptyRenderData(datasetId, state, { excludedCandidateCount });
      renderCache = { signature, data };
      return data;
    }

    const palette = SEASON_PALETTES[state.season];
    const yearFactor = YEAR_DENSITY[state.year];
    const yearTone = (state.year - 1942) * 0.008;
    const densityThreshold = clamp(state.forestDensity * yearFactor, 0, 1);
    const windRadians = state.windDirection * Math.PI / 180;
    const windX = Math.sin(windRadians);
    const windZ = Math.cos(windRadians);
    const normalizedWind = state.windSpeed / 18;
    const positions = [];
    const colors = [];
    const sizes = [];
    const categories = [];
    const windVectors = [];
    const windPhases = [];
    const counts = emptyCounts();

    for (let index = 0; index < baseInstances.count; index += 1) {
      const categoryIndex = Math.round(baseInstances.categories[index]);
      const definition = CATEGORY_DEFINITIONS[categoryIndex];
      if (!definition || !state[definition.stateKey]) continue;
      const categoryDensity = definition.key === 'bund' ? Math.min(1, densityThreshold * 1.08) : densityThreshold;
      if (baseInstances.priorities[index] > categoryDensity) continue;
      const x = baseInstances.xz[index * 2];
      const z = baseInstances.xz[index * 2 + 1];
      if (isLandExcluded(x, z, baseInstances.width, baseInstances.height)) continue;
      const rootHeight = sampleElevation(sampleHeight, x, z);
      if (rootHeight === null) continue;

      const variation = baseInstances.variations[index];
      const color = palette[definition.key];
      const colorShift = variation * 0.045 + yearTone;
      positions.push(x, rootHeight, z);
      colors.push(
        clamp(color[0] + colorShift, 0, 1),
        clamp(color[1] + colorShift * 0.72, 0, 1),
        clamp(color[2] + colorShift * 0.42, 0, 1),
      );
      sizes.push(definition.size * baseInstances.scales[index]);
      categories.push(categoryIndex);
      const phase = baseInstances.phases[index];
      const gust = 1 + Math.sin(phase) * state.gustStrength;
      const sway = normalizedWind * definition.windResponse * gust;
      windVectors.push(windX * sway, windZ * sway);
      windPhases.push(phase);
      counts[definition.key] += 1;
      counts.total += 1;
    }

    const data = Object.freeze({
      datasetId,
      activeCoreId: state.activeCoreId,
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
      sizes: new Float32Array(sizes),
      categories: new Float32Array(categories),
      windVectors: new Float32Array(windVectors),
      windPhases: new Float32Array(windPhases),
      counts: Object.freeze({ ...counts }),
      count: counts.total,
      channelVegetationCount: 0,
      excludedCandidateCount,
      rootPinned: true,
      rootHeightSource: 'sampleHeight',
      rootTerrainRevision: baseInstances.terrainRevision,
      claim: ECOLOGY_CLAIM,
      nativeSurveyClaim: false,
      densityPolicy: datasetId === 'overall' ? 'overall-low-density-aggregate' : 'active-core-dense',
      season: state.season,
      year: state.year,
      wind: Object.freeze({
        directionDegrees: state.windDirection,
        speedMetersPerSecond: state.windSpeed,
        gustStrength: state.gustStrength,
      }),
    });
    renderCache = { signature, data };
    cachedSampleHeight = sampleHeight;
    emit('render-data-ready', { count: counts.total, counts: { ...counts }, channelVegetationCount: 0 });
    return data;
  }

  function getDiagnostics() {
    return Object.freeze({
      ready: Boolean(dataset) && !disposed,
      disposed,
      datasetId,
      activeCoreId: state.activeCoreId,
      datasetIdentity: identity,
      densityPolicy: datasetId === 'overall' ? 'overall-low-density-aggregate' : 'active-core-dense',
      generatedInstanceCount: baseInstances?.count || 0,
      renderedInstanceCount: renderCache?.data?.count || 0,
      actualCounts: renderCache?.data?.counts || Object.freeze(emptyCounts()),
      channelVegetationCount: 0,
      excludedCandidateCount,
      hydrologyExclusionAvailable: Boolean(hydrologyRuntime && typeof hydrologyRuntime.isLandExcluded === 'function'),
      rootPinned: true,
      rootHeightSource: 'sampleHeight',
      rootTerrainRevision: baseInstances?.terrainRevision ?? null,
      releasedDenseInstanceCount,
      generation,
      season: state.season,
      year: state.year,
      windDirectionDegrees: state.windDirection,
      windSpeedMetersPerSecond: state.windSpeed,
      gustStrength: state.gustStrength,
      supportedSeasons: Object.freeze(['spring', 'summer', 'autumn', 'winter']),
      supportedYears: Object.freeze([1940, 1941, 1942, 1943, 1944, 1945]),
      claim: ECOLOGY_CLAIM,
      nativeSurveyClaim: false,
      lastError: lastError ? String(lastError.message || lastError) : null,
    });
  }

  function dispose() {
    if (disposed) return;
    releaseDenseInstances('dispose');
    dataset = null;
    datasetId = null;
    identity = 'none';
    disposed = true;
    emit('disposed');
  }

  return Object.freeze({
    setDataset,
    updateState,
    getRenderData,
    getDiagnostics,
    releaseDenseInstances,
    dispose,
  });
}
