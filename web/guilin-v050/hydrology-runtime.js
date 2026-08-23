/**
 * Independent Guilin hydrology runtime.
 *
 * Geometry is retained per source LineString/MultiLineString part.  Clipping may
 * split a part into several runs, but runs are never reconnected across an
 * out-of-bounds gap.  Render batches are likewise emitted per run, which makes
 * cross-segment bridge triangles structurally impossible.
 */

const MODULE_ID = 'guilin-hydrology-runtime@1';
const EXACT_ENDPOINT_TOLERANCE_M = 2.5;
const NEAR_GAP_TOLERANCE_M = 50;
const BOUNDARY_TOLERANCE_NORM = 1e-7;
const CLIP_EPSILON = 1e-10;

export const HYDROLOGY_CLASSES = Object.freeze({
  lijiang: Object.freeze({ id: 1, label: '漓江', color: [0.22, 0.64, 0.82, 0.88] }),
  xiangjiang: Object.freeze({ id: 2, label: '湘江', color: [0.28, 0.72, 0.86, 0.88] }),
  tributary: Object.freeze({ id: 3, label: '主要支流', color: [0.35, 0.68, 0.77, 0.7] }),
});

export const DEFAULT_HYDROLOGY_SOURCE_URLS = Object.freeze({
  lijiang: Object.freeze([
    '../../DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/lijiang_osm.geojson',
    './assets/hydrology/lijiang_osm.geojson',
    '../assets/hydrology/lijiang_osm.geojson',
  ]),
  waterways: Object.freeze([
    '../../DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/waterways_osm.geojson',
    './assets/hydrology/waterways_osm.geojson',
    '../assets/hydrology/waterways_osm.geojson',
  ]),
});

const WATER_STAGE = Object.freeze({
  spring: Object.freeze({ widthMultiplier: 0.88, levelOffsetM: 0.24 }),
  summer: Object.freeze({ widthMultiplier: 1, levelOffsetM: 0.42 }),
  autumn: Object.freeze({ widthMultiplier: 0.8, levelOffsetM: 0.14 }),
  winter: Object.freeze({ widthMultiplier: 0.58, levelOffsetM: -0.18 }),
  flood: Object.freeze({ widthMultiplier: 1.28, levelOffsetM: 0.82 }),
});

function nowIso() {
  return new Date().toISOString();
}

function safeCall(callback, value) {
  if (typeof callback !== 'function') return;
  try {
    callback(value);
  } catch {
    // Status observers are deliberately isolated from geometry generation.
  }
}

function emitStatus(callback, phase, status, detail = {}) {
  safeCall(callback, {
    module: MODULE_ID,
    phase,
    status,
    timestamp: nowIso(),
    ...detail,
  });
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function distance2d(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function coordinateEqual(a, b, tolerance = 1e-8) {
  return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;
}

function pointEqual(a, b, tolerance = 1e-7) {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.z - b.z) <= tolerance;
}

function validLonLat(coordinate) {
  return Array.isArray(coordinate) &&
    coordinate.length >= 2 &&
    Number.isFinite(Number(coordinate[0])) &&
    Number.isFinite(Number(coordinate[1]));
}

function cleanCoordinates(coordinates) {
  const output = [];
  for (const coordinate of coordinates || []) {
    if (!validLonLat(coordinate)) continue;
    const point = [Number(coordinate[0]), Number(coordinate[1])];
    if (!output.length || !coordinateEqual(output[output.length - 1], point, 1e-12)) output.push(point);
  }
  return output;
}

function geometryParts(geometry) {
  if (!geometry || !geometry.type) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates || [];
  return [];
}

function combinedName(properties = {}) {
  return [properties.name, properties.nameZh, properties['name:zh'], properties.alt_name]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function classifyRiver(properties, sourceKind) {
  const name = combinedName(properties);
  const folded = name.toLowerCase().replace(/[\s_-]+/g, '');
  if (sourceKind === 'lijiang' || /漓江/.test(name) || /^(lijiang|liriver)$/.test(folded)) return 'lijiang';
  if (/湘江/.test(name) || /^(xiangjiang|xiangriver)$/.test(folded)) return 'xiangjiang';
  return 'tributary';
}

function parseWidthMeters(properties, riverClass) {
  const raw = properties?.width;
  if (raw != null) {
    const match = String(raw).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    const parsed = match ? Number(match[0]) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) return clamp(parsed, 2, 220);
  }
  if (riverClass === 'lijiang') return 82;
  if (riverClass === 'xiangjiang') return 68;
  const waterway = String(properties?.waterway || '').toLowerCase();
  if (waterway === 'river') return combinedName(properties) ? 32 : 24;
  if (waterway === 'canal') return 8;
  if (waterway === 'stream') return 7;
  if (waterway === 'drain') return 4;
  if (waterway === 'ditch') return 3;
  return 9;
}

function sourceFingerprint(properties, coordinates, partIndex) {
  if (properties?.osmId != null) {
    return `${properties.osmType || 'way'}:${properties.osmId}:part:${partIndex}`;
  }
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return `anonymous:${partIndex}:${first.join(',')}:${last.join(',')}:${coordinates.length}`;
}

function parseFeatureCollection(featureCollection, sourceKind, seenKeys, stats) {
  if (!featureCollection || featureCollection.type !== 'FeatureCollection' || !Array.isArray(featureCollection.features)) {
    throw new TypeError(`${sourceKind} source is not a GeoJSON FeatureCollection`);
  }
  const segments = [];
  featureCollection.features.forEach((feature, featureIndex) => {
    const geometry = feature?.geometry;
    const parts = geometryParts(geometry);
    if (!parts.length) {
      stats.ignoredGeometryTypes[geometry?.type || 'null'] =
        (stats.ignoredGeometryTypes[geometry?.type || 'null'] || 0) + 1;
      return;
    }
    parts.forEach((coordinates, partIndex) => {
      const clean = cleanCoordinates(coordinates);
      if (clean.length < 2) {
        stats.invalidParts += 1;
        return;
      }
      const properties = feature.properties || {};
      const fingerprint = sourceFingerprint(properties, clean, partIndex);
      if (seenKeys.has(fingerprint)) {
        stats.duplicatePartsSkipped += 1;
        return;
      }
      seenKeys.add(fingerprint);
      const riverClass = classifyRiver(properties, sourceKind);
      const id = `${sourceKind}:${fingerprint}`;
      segments.push({
        id,
        sourceKind,
        sourceFeatureIndex: featureIndex,
        sourcePartIndex: partIndex,
        sourceGeometryType: geometry.type,
        sourceOsmId: properties.osmId ?? null,
        name: combinedName(properties) || HYDROLOGY_CLASSES[riverClass].label,
        riverClass,
        widthMeters: parseWidthMeters(properties, riverClass),
        waterway: properties.waterway || null,
        properties: { ...properties },
        coordinates: clean,
      });
      stats.sourceParts += 1;
      stats.sourcePoints += clean.length;
      stats.classSourceParts[riverClass] += 1;
    });
  });
  return segments;
}

function isFeatureCollection(value) {
  return value && value.type === 'FeatureCollection' && Array.isArray(value.features);
}

function candidateList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function inferSourceKind(value, fallback = 'waterways') {
  if (value && typeof value === 'object' && value.kind) return value.kind;
  const label = String(value?.url || value || '').toLowerCase();
  return label.includes('lijiang') || label.includes('漓江') ? 'lijiang' : fallback;
}

function sourceDescriptors(sourceUrls) {
  const configured = sourceUrls || DEFAULT_HYDROLOGY_SOURCE_URLS;
  if (isFeatureCollection(configured)) {
    return [{ kind: 'waterways', candidates: [configured] }];
  }
  if (Array.isArray(configured)) {
    const grouped = { lijiang: [], waterways: [] };
    configured.forEach((entry, index) => {
      const kind = inferSourceKind(entry, index === 1 ? 'lijiang' : 'waterways');
      grouped[kind === 'lijiang' ? 'lijiang' : 'waterways'].push(entry);
    });
    return [
      { kind: 'lijiang', candidates: grouped.lijiang },
      { kind: 'waterways', candidates: grouped.waterways },
    ].filter((descriptor) => descriptor.candidates.length);
  }
  if (configured && typeof configured === 'object' && (
    configured.lijiang != null || configured.waterways != null || configured.all != null
  )) {
    return [
      { kind: 'lijiang', candidates: candidateList(configured.lijiang) },
      { kind: 'waterways', candidates: candidateList(configured.waterways ?? configured.all) },
    ].filter((descriptor) => descriptor.candidates.length);
  }
  if (configured && typeof configured === 'object' && (configured.url || configured.data)) {
    return [{ kind: inferSourceKind(configured), candidates: [configured] }];
  }
  throw new TypeError('sourceUrls must identify local lijiang and waterways GeoJSON sources');
}

async function readCandidate(candidate) {
  if (isFeatureCollection(candidate)) return { data: candidate, label: 'inline-geojson' };
  if (candidate && typeof candidate === 'object' && isFeatureCollection(candidate.data)) {
    return { data: candidate.data, label: candidate.url || candidate.label || 'inline-geojson' };
  }
  const url = typeof candidate === 'string' ? candidate : candidate?.url;
  if (!url) throw new TypeError('GeoJSON candidate has no URL or inline data');
  if (typeof fetch !== 'function') throw new Error('Fetch API is unavailable');
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { data: await response.json(), label: url };
}

async function readFirstSource(descriptor) {
  const failures = [];
  for (const candidate of descriptor.candidates) {
    try {
      const loaded = await readCandidate(candidate);
      return { kind: descriptor.kind, ...loaded, failures };
    } catch (error) {
      failures.push({ candidate: String(candidate?.url || candidate), error: String(error.message || error) });
    }
  }
  throw Object.assign(new Error(`${descriptor.kind} GeoJSON could not be loaded`), { failures });
}

function validateDataset(input) {
  if (!input || typeof input !== 'object') throw new TypeError('dataset is required');
  const widthMeters = Number(input.widthMeters);
  const heightMeters = Number(input.heightMeters);
  const bounds = input.wgs84Bounds;
  if (!Number.isFinite(widthMeters) || widthMeters <= 0) throw new TypeError('dataset.widthMeters must be positive');
  if (!Number.isFinite(heightMeters) || heightMeters <= 0) throw new TypeError('dataset.heightMeters must be positive');
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every((value) => Number.isFinite(Number(value)))) {
    throw new TypeError('dataset.wgs84Bounds must be [west,south,east,north]');
  }
  const [west, south, east, north] = bounds.map(Number);
  if (!(east > west) || !(north > south)) throw new RangeError('dataset.wgs84Bounds has an empty or wrapped extent');
  return {
    ...input,
    widthMeters,
    heightMeters,
    wgs84Bounds: [west, south, east, north],
  };
}

function lonLatToNormalised(coordinate, dataset) {
  const [west, south, east, north] = dataset.wgs84Bounds;
  return {
    xNorm: (coordinate[0] - west) / (east - west),
    zNorm: (coordinate[1] - south) / (north - south),
  };
}

function normalisedToWorld(xNorm, zNorm, dataset, coordinate = null) {
  if (typeof dataset.worldFromWgs84 === 'function' && coordinate) {
    const world = dataset.worldFromWgs84(coordinate, { xNorm, zNorm });
    if (Array.isArray(world) && world.length >= 2) return { x: finite(world[0]), z: finite(world[1]) };
    if (world && Number.isFinite(Number(world.x)) && Number.isFinite(Number(world.z))) {
      return { x: Number(world.x), z: Number(world.z) };
    }
  }
  if (typeof dataset.worldFromNormalised === 'function') {
    const world = dataset.worldFromNormalised(xNorm, zNorm);
    if (Array.isArray(world) && world.length >= 2) return { x: finite(world[0]), z: finite(world[1]) };
    if (world && Number.isFinite(Number(world.x)) && Number.isFinite(Number(world.z))) {
      return { x: Number(world.x), z: Number(world.z) };
    }
  }
  return {
    x: (xNorm - 0.5) * dataset.widthMeters,
    // Raster rows are north-to-south: north is -Z in the shared terrain space.
    z: (0.5 - zNorm) * dataset.heightMeters,
  };
}

function coordinateToPoint(coordinate, dataset) {
  const normalised = lonLatToNormalised(coordinate, dataset);
  const world = normalisedToWorld(normalised.xNorm, normalised.zNorm, dataset, coordinate);
  return {
    lon: coordinate[0],
    lat: coordinate[1],
    xNorm: normalised.xNorm,
    zNorm: normalised.zNorm,
    x: world.x,
    z: world.z,
  };
}

// Liang-Barsky clipping against the unit square.  A returned edge is always a
// subset of one original source edge; it never introduces an inter-part join.
function clipEdgeToUnit(a, b) {
  const dx = b.xNorm - a.xNorm;
  const dz = b.zNorm - a.zNorm;
  let t0 = 0;
  let t1 = 1;
  const constraints = [
    [-dx, a.xNorm],
    [dx, 1 - a.xNorm],
    [-dz, a.zNorm],
    [dz, 1 - a.zNorm],
  ];
  for (const [p, q] of constraints) {
    if (Math.abs(p) <= CLIP_EPSILON) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) {
      if (ratio > t1) return null;
      if (ratio > t0) t0 = ratio;
    } else {
      if (ratio < t0) return null;
      if (ratio < t1) t1 = ratio;
    }
  }
  const interpolate = (t) => ({
    lon: a.lon + (b.lon - a.lon) * t,
    lat: a.lat + (b.lat - a.lat) * t,
    xNorm: clamp(a.xNorm + dx * t, 0, 1),
    zNorm: clamp(a.zNorm + dz * t, 0, 1),
  });
  return { start: interpolate(t0), end: interpolate(t1), t0, t1 };
}

function completeWorldPoint(point, dataset) {
  const world = normalisedToWorld(point.xNorm, point.zNorm, dataset, [point.lon, point.lat]);
  return { ...point, x: world.x, z: world.z };
}

function clipSegmentRuns(segment, dataset) {
  const sourcePoints = segment.coordinates.map((coordinate) => coordinateToPoint(coordinate, dataset));
  const runs = [];
  let current = [];
  const flush = () => {
    if (current.length >= 2) {
      const deduplicated = [current[0]];
      for (let index = 1; index < current.length; index += 1) {
        if (!pointEqual(deduplicated[deduplicated.length - 1], current[index])) deduplicated.push(current[index]);
      }
      if (deduplicated.length >= 2) runs.push(deduplicated);
    }
    current = [];
  };

  for (let index = 0; index < sourcePoints.length - 1; index += 1) {
    const clipped = clipEdgeToUnit(sourcePoints[index], sourcePoints[index + 1]);
    if (!clipped) {
      flush();
      continue;
    }
    const start = completeWorldPoint(clipped.start, dataset);
    const end = completeWorldPoint(clipped.end, dataset);
    if (!current.length) {
      current.push(start, end);
    } else if (pointEqual(current[current.length - 1], start, 1e-5)) {
      current.push(end);
    } else {
      // The source part left the dataset and later re-entered.  Keep two runs.
      flush();
      current.push(start, end);
    }
    if (clipped.t1 < 1 - CLIP_EPSILON) flush();
  }
  flush();

  return runs.map((points, runIndex) => ({
    ...segment,
    id: `${segment.id}:clip:${runIndex}`,
    sourceSegmentId: segment.id,
    clipRunIndex: runIndex,
    points,
  }));
}

function isBoundaryPoint(point) {
  return point.xNorm <= BOUNDARY_TOLERANCE_NORM ||
    point.xNorm >= 1 - BOUNDARY_TOLERANCE_NORM ||
    point.zNorm <= BOUNDARY_TOLERANCE_NORM ||
    point.zNorm >= 1 - BOUNDARY_TOLERANCE_NORM;
}

class DisjointSet {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = new Uint8Array(size);
  }

  find(value) {
    let root = value;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[value] !== value) {
      const next = this.parent[value];
      this.parent[value] = root;
      value = next;
    }
    return root;
  }

  union(a, b) {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) return;
    if (this.rank[rootA] < this.rank[rootB]) [rootA, rootB] = [rootB, rootA];
    this.parent[rootB] = rootA;
    if (this.rank[rootA] === this.rank[rootB]) this.rank[rootA] += 1;
  }
}

function endpointKey(x, z, cellSize) {
  return `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`;
}

function nearbyGridRecords(grid, point, cellSize) {
  const cellX = Math.floor(point.x / cellSize);
  const cellZ = Math.floor(point.z / cellSize);
  const records = [];
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      records.push(...(grid.get(`${cellX + dx},${cellZ + dz}`) || []));
    }
  }
  return records;
}

function buildEndpointDiagnostics(runs) {
  const endpoints = [];
  runs.forEach((run, runIndex) => {
    endpoints.push({
      ...run.points[0],
      runIndex,
      runId: run.id,
      riverClass: run.riverClass,
      end: 'start',
    });
    endpoints.push({
      ...run.points[run.points.length - 1],
      runIndex,
      runId: run.id,
      riverClass: run.riverClass,
      end: 'end',
    });
  });

  const grid = new Map();
  for (const endpoint of endpoints) {
    const key = `${endpoint.riverClass}:${endpointKey(endpoint.x, endpoint.z, NEAR_GAP_TOLERANCE_M)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(endpoint);
  }
  const searchNearby = (endpoint) => {
    const classGrid = new Map();
    // nearbyGridRecords expects coordinate-only keys.  Build a tiny view over
    // the existing class-prefixed grid without losing class isolation.
    const cellX = Math.floor(endpoint.x / NEAR_GAP_TOLERANCE_M);
    const cellZ = Math.floor(endpoint.z / NEAR_GAP_TOLERANCE_M);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const key = `${cellX + dx},${cellZ + dz}`;
        classGrid.set(key, grid.get(`${endpoint.riverClass}:${key}`) || []);
      }
    }
    return nearbyGridRecords(classGrid, endpoint, NEAR_GAP_TOLERANCE_M);
  };

  const sets = new DisjointSet(runs.length);
  const records = [];
  const summary = {
    connectedEndpoints: 0,
    nearGapEndpoints: 0,
    openEndpoints: 0,
    boundaryEndpoints: 0,
    byClass: {},
  };
  for (const key of Object.keys(HYDROLOGY_CLASSES)) {
    summary.byClass[key] = {
      runs: runs.filter((run) => run.riverClass === key).length,
      components: 0,
      connectedEndpoints: 0,
      nearGapEndpoints: 0,
      openEndpoints: 0,
      boundaryEndpoints: 0,
    };
  }

  for (const endpoint of endpoints) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const candidate of searchNearby(endpoint)) {
      if (candidate === endpoint) continue;
      if (candidate.runId === endpoint.runId && candidate.end === endpoint.end) continue;
      const gapMeters = distance2d(endpoint, candidate);
      if (gapMeters < nearestDistance) {
        nearest = candidate;
        nearestDistance = gapMeters;
      }
    }
    let kind;
    if (nearest && nearestDistance <= EXACT_ENDPOINT_TOLERANCE_M) {
      kind = 'connected';
      sets.union(endpoint.runIndex, nearest.runIndex);
      summary.connectedEndpoints += 1;
      summary.byClass[endpoint.riverClass].connectedEndpoints += 1;
    } else if (isBoundaryPoint(endpoint)) {
      kind = 'boundary-exit';
      summary.boundaryEndpoints += 1;
      summary.byClass[endpoint.riverClass].boundaryEndpoints += 1;
    } else if (nearest && nearestDistance <= NEAR_GAP_TOLERANCE_M) {
      kind = 'near-gap';
      summary.nearGapEndpoints += 1;
      summary.byClass[endpoint.riverClass].nearGapEndpoints += 1;
    } else {
      kind = 'open-end';
      summary.openEndpoints += 1;
      summary.byClass[endpoint.riverClass].openEndpoints += 1;
    }
    records.push({
      ...endpoint,
      kind,
      gapMeters: Number.isFinite(nearestDistance) ? nearestDistance : null,
      nearestRunId: nearest?.runId || null,
    });
  }

  for (const riverClass of Object.keys(HYDROLOGY_CLASSES)) {
    const roots = new Set();
    runs.forEach((run, index) => {
      if (run.riverClass === riverClass) roots.add(sets.find(index));
    });
    summary.byClass[riverClass].components = roots.size;
  }
  summary.components = Object.values(summary.byClass).reduce((total, item) => total + item.components, 0);
  return { records, summary };
}

function segmentLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += distance2d(points[index - 1], points[index]);
  return length;
}

function buildExclusionIndex(runs, dataset) {
  const cellSize = clamp(Math.min(dataset.widthMeters, dataset.heightMeters) / 96, 30, 250);
  const cells = new Map();
  const edges = [];
  let estimatedAreaM2 = 0;
  let maximumHalfWidthM = 0;

  for (const run of runs) {
    const halfWidthM = run.widthMeters * WATER_STAGE.flood.widthMultiplier * 0.5 + Math.max(4, run.widthMeters * 0.16);
    maximumHalfWidthM = Math.max(maximumHalfWidthM, halfWidthM);
    for (let index = 1; index < run.points.length; index += 1) {
      const a = run.points[index - 1];
      const b = run.points[index];
      const lengthM = distance2d(a, b);
      if (lengthM <= 1e-6) continue;
      const edge = {
        id: edges.length,
        runId: run.id,
        riverClass: run.riverClass,
        a,
        b,
        halfWidthM,
      };
      edges.push(edge);
      estimatedAreaM2 += lengthM * halfWidthM * 2;
      const minCellX = Math.floor((Math.min(a.x, b.x) - halfWidthM) / cellSize);
      const maxCellX = Math.floor((Math.max(a.x, b.x) + halfWidthM) / cellSize);
      const minCellZ = Math.floor((Math.min(a.z, b.z) - halfWidthM) / cellSize);
      const maxCellZ = Math.floor((Math.max(a.z, b.z) + halfWidthM) / cellSize);
      for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
        for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
          const key = `${cellX},${cellZ}`;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push(edge);
        }
      }
    }
  }
  return {
    cellSize,
    cells,
    edges,
    maximumHalfWidthM,
    estimatedAreaKm2: estimatedAreaM2 / 1e6,
    estimatedCoverageFraction: clamp(estimatedAreaM2 / (dataset.widthMeters * dataset.heightMeters), 0, 1),
  };
}

function distancePointToEdge(point, edge) {
  const dx = edge.b.x - edge.a.x;
  const dz = edge.b.z - edge.a.z;
  const denominator = dx * dx + dz * dz;
  const t = denominator > 0
    ? clamp(((point.x - edge.a.x) * dx + (point.z - edge.a.z) * dz) / denominator, 0, 1)
    : 0;
  const nearestX = edge.a.x + dx * t;
  const nearestZ = edge.a.z + dz * t;
  return Math.hypot(point.x - nearestX, point.z - nearestZ);
}

function hydrologyState(state = {}) {
  const nested = state.hydrology && typeof state.hydrology === 'object' ? state.hydrology : {};
  const value = (keys, fallback) => {
    for (const key of keys) {
      if (nested[key] != null) return nested[key];
      if (state[key] != null) return state[key];
    }
    return fallback;
  };
  const bool = (keys, fallback = true) => Boolean(value(keys, fallback));
  const rawSeason = value(['waterSeason', 'season'], 'summer');
  const seasonAliases = {
    0: 'summer',
    1: 'flood',
    2: 'autumn',
    3: 'winter',
    wet: 'summer',
    rain: 'flood',
    harvest: 'autumn',
    fallow: 'winter',
  };
  const season = seasonAliases[rawSeason] || String(rawSeason || 'summer').toLowerCase();
  return {
    showLijiang: bool(['showLijiang', 'lijiang', 'namedHydrology'], true),
    showXiangjiang: bool(['showXiangjiang', 'xiangjiang', 'namedHydrology'], true),
    showTributaries: bool(['showTributaries', 'tributaries'], true),
    showCenterlines: bool(['showCenterlines', 'centerlines'], true),
    showSurface: bool(['showSurface', 'showWater', 'surface'], true),
    showBanks: bool(['showBanks', 'banks'], true),
    showFlow: bool(['showFlow', 'flow'], true),
    showDiagnostics: bool(['showDiagnostics', 'hydrologyDiagnostics', 'diagnostics'], true),
    season: WATER_STAGE[season] ? season : 'summer',
    waterLevel: clamp(finite(value(['waterLevel'], 1), 1), 0.15, 1.5),
    waterWidth: clamp(finite(value(['waterWidth'], 1), 1), 0.4, 2),
    verticalExaggeration: clamp(finite(value(['verticalExaggeration', 'verticalEx'], 1), 1), 0.1, 5),
  };
}

function classVisible(run, state) {
  if (run.riverClass === 'lijiang') return state.showLijiang;
  if (run.riverClass === 'xiangjiang') return state.showXiangjiang;
  return state.showTributaries;
}

function sampleWorldHeight(point, sampleHeight, state, dataset, missingCounter) {
  let sampled = typeof sampleHeight === 'function'
    ? sampleHeight(point.xNorm, point.zNorm, point)
    : dataset.baseHeightM ?? 0;
  if (sampled && typeof sampled === 'object') sampled = sampled.height ?? sampled.elevation ?? sampled.y;
  const number = Number(sampled);
  if (!Number.isFinite(number)) {
    missingCounter.count += 1;
    return finite(dataset.baseHeightM, 0);
  }
  if (typeof dataset.heightTransform === 'function') {
    const transformed = dataset.heightTransform(number, state, point);
    return Number.isFinite(Number(transformed)) ? Number(transformed) : number;
  }
  return dataset.sampleHeightIsWorldY ? number : number * state.verticalExaggeration;
}

function pointsWithHeight(run, state, sampleHeight, dataset, missingCounter) {
  const stage = WATER_STAGE[state.season];
  const levelOffsetM = stage.levelOffsetM + (state.waterLevel - 1) * 0.72;
  return run.points.map((point) => ({
    ...point,
    terrainY: sampleWorldHeight(point, sampleHeight, state, dataset, missingCounter),
  })).map((point) => ({ ...point, waterY: point.terrainY + levelOffsetM }));
}

function tangentAt(points, index) {
  const before = points[Math.max(0, index - 1)];
  const after = points[Math.min(points.length - 1, index + 1)];
  let x = after.x - before.x;
  let z = after.z - before.z;
  let length = Math.hypot(x, z);
  if (length <= 1e-9 && index + 1 < points.length) {
    x = points[index + 1].x - points[index].x;
    z = points[index + 1].z - points[index].z;
    length = Math.hypot(x, z);
  }
  if (length <= 1e-9) return { x: 1, z: 0 };
  return { x: x / length, z: z / length };
}

function surfaceBatch(run, points, widthMeters, style) {
  const positions = new Float32Array(points.length * 2 * 3);
  const uvs = new Float32Array(points.length * 2 * 2);
  const indices = new Uint32Array((points.length - 1) * 6);
  let distanceM = 0;
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    distanceM += distance2d(points[index - 1], points[index]);
    distances.push(distanceM);
  }
  const halfWidth = widthMeters / 2;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const tangent = tangentAt(points, index);
    const normalX = -tangent.z;
    const normalZ = tangent.x;
    const positionOffset = index * 6;
    positions[positionOffset] = point.x + normalX * halfWidth;
    positions[positionOffset + 1] = point.waterY;
    positions[positionOffset + 2] = point.z + normalZ * halfWidth;
    positions[positionOffset + 3] = point.x - normalX * halfWidth;
    positions[positionOffset + 4] = point.waterY;
    positions[positionOffset + 5] = point.z - normalZ * halfWidth;
    const uvOffset = index * 4;
    const u = distanceM > 0 ? distances[index] / distanceM : 0;
    uvs[uvOffset] = u;
    uvs[uvOffset + 1] = 0;
    uvs[uvOffset + 2] = u;
    uvs[uvOffset + 3] = 1;
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    const vertex = index * 2;
    const offset = index * 6;
    indices[offset] = vertex;
    indices[offset + 1] = vertex + 1;
    indices[offset + 2] = vertex + 2;
    indices[offset + 3] = vertex + 1;
    indices[offset + 4] = vertex + 3;
    indices[offset + 5] = vertex + 2;
  }
  return {
    id: `${run.id}:surface`,
    segmentId: run.id,
    sourceSegmentId: run.sourceSegmentId,
    riverClass: run.riverClass,
    name: run.name,
    primitive: 'triangles',
    positions,
    uvs,
    indices,
    vertexCount: points.length * 2,
    triangleCount: (points.length - 1) * 2,
    widthMeters,
    style,
  };
}

function lineBatch(run, points, suffix, yOffsetM, style) {
  const positions = new Float32Array(points.length * 3);
  for (let index = 0; index < points.length; index += 1) {
    positions[index * 3] = points[index].x;
    positions[index * 3 + 1] = points[index].waterY + yOffsetM;
    positions[index * 3 + 2] = points[index].z;
  }
  return {
    id: `${run.id}:${suffix}`,
    segmentId: run.id,
    sourceSegmentId: run.sourceSegmentId,
    riverClass: run.riverClass,
    name: run.name,
    primitive: 'line-strip',
    positions,
    vertexCount: points.length,
    style,
  };
}

function bankBatches(run, points, widthMeters, style) {
  const left = new Float32Array(points.length * 3);
  const right = new Float32Array(points.length * 3);
  const halfWidth = widthMeters / 2;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const tangent = tangentAt(points, index);
    const normalX = -tangent.z;
    const normalZ = tangent.x;
    const offset = index * 3;
    left[offset] = point.x + normalX * halfWidth;
    left[offset + 1] = point.waterY + 0.08;
    left[offset + 2] = point.z + normalZ * halfWidth;
    right[offset] = point.x - normalX * halfWidth;
    right[offset + 1] = point.waterY + 0.08;
    right[offset + 2] = point.z - normalZ * halfWidth;
  }
  const base = {
    segmentId: run.id,
    sourceSegmentId: run.sourceSegmentId,
    riverClass: run.riverClass,
    name: run.name,
    primitive: 'line-strip',
    vertexCount: points.length,
    style,
  };
  return [
    { ...base, id: `${run.id}:bank:left`, side: 'left', positions: left },
    { ...base, id: `${run.id}:bank:right`, side: 'right', positions: right },
  ];
}

function pointAlong(points, targetDistance) {
  let traversed = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const length = distance2d(a, b);
    if (traversed + length >= targetDistance && length > 0) {
      const t = (targetDistance - traversed) / length;
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        waterY: a.waterY + (b.waterY - a.waterY) * t,
        direction: { x: (b.x - a.x) / length, z: (b.z - a.z) / length },
      };
    }
    traversed += length;
  }
  return null;
}

function flowBatch(run, points, widthMeters, style) {
  const lengthM = segmentLength(points);
  const spacing = run.riverClass === 'tributary' ? 160 : 280;
  if (lengthM < Math.min(40, spacing * 0.4)) return null;
  const directionSign = points[0].terrainY + 0.12 >= points[points.length - 1].terrainY ? 1 : -1;
  const arrowLength = clamp(widthMeters * 0.72, 5, 28);
  const arrowWidth = arrowLength * 0.34;
  const values = [];
  let arrowCount = 0;
  for (let distance = Math.min(spacing * 0.5, lengthM * 0.5); distance < lengthM; distance += spacing) {
    const sampleDistance = directionSign > 0 ? distance : lengthM - distance;
    const point = pointAlong(points, sampleDistance);
    if (!point) continue;
    const dirX = point.direction.x * directionSign;
    const dirZ = point.direction.z * directionSign;
    const tailX = point.x - dirX * arrowLength * 0.5;
    const tailZ = point.z - dirZ * arrowLength * 0.5;
    const headX = point.x + dirX * arrowLength * 0.5;
    const headZ = point.z + dirZ * arrowLength * 0.5;
    const normalX = -dirZ;
    const normalZ = dirX;
    const wingBaseX = headX - dirX * arrowLength * 0.42;
    const wingBaseZ = headZ - dirZ * arrowLength * 0.42;
    const y = point.waterY + 0.14;
    values.push(
      tailX, y, tailZ, headX, y, headZ,
      headX, y, headZ, wingBaseX + normalX * arrowWidth, y, wingBaseZ + normalZ * arrowWidth,
      headX, y, headZ, wingBaseX - normalX * arrowWidth, y, wingBaseZ - normalZ * arrowWidth,
    );
    arrowCount += 1;
  }
  if (!arrowCount) return null;
  return {
    id: `${run.id}:flow`,
    segmentId: run.id,
    sourceSegmentId: run.sourceSegmentId,
    riverClass: run.riverClass,
    name: run.name,
    primitive: 'lines',
    positions: new Float32Array(values),
    vertexCount: values.length / 3,
    arrowCount,
    directionBasis: directionSign > 0 ? 'source-order' : 'terrain-endpoint-reversed',
    style,
  };
}

function breakpointBatches(records, sampleHeight, state, dataset) {
  const batches = [];
  const missingCounter = { count: 0 };
  for (const record of records) {
    if (record.kind === 'connected') continue;
    const height = sampleWorldHeight(record, sampleHeight, state, dataset, missingCounter);
    const color = record.kind === 'near-gap'
      ? [1, 0.7, 0.18, 1]
      : record.kind === 'boundary-exit'
        ? [0.55, 0.72, 0.78, 0.85]
        : [1, 0.25, 0.22, 1];
    batches.push({
      id: `${record.runId}:break:${record.end}`,
      segmentId: record.runId,
      riverClass: record.riverClass,
      primitive: 'points',
      positions: new Float32Array([record.x, height + 0.85, record.z]),
      vertexCount: 1,
      kind: record.kind,
      gapMeters: record.gapMeters,
      nearestRunId: record.nearestRunId,
      style: { color, pointSizePx: record.kind === 'open-end' ? 9 : 6 },
    });
  }
  return { batches, missingSamples: missingCounter.count };
}

function cloneDiagnostics(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/**
 * Load local named-waterway sources and create a renderer-neutral runtime.
 *
 * setDataset requires at least:
 *   {widthMeters, heightMeters, wgs84Bounds:[west,south,east,north]}
 *
 * getRenderBatches returns local-metre Float32Array batches.  The host renderer
 * applies its shared camera/view-projection matrices; this module creates no
 * second canvas or camera.
 */
export async function createHydrologyRuntime({ sourceUrls, onStatus } = {}) {
  let disposed = false;
  let dataset = null;
  let runs = [];
  let endpointDiagnostics = { records: [], summary: {} };
  let exclusionIndex = null;
  let geometryRevision = 0;
  let lastRenderStats = null;
  const exclusionQueries = { total: 0, excluded: 0 };
  const loadStats = {
    sourceParts: 0,
    sourcePoints: 0,
    duplicatePartsSkipped: 0,
    invalidParts: 0,
    ignoredGeometryTypes: {},
    classSourceParts: { lijiang: 0, xiangjiang: 0, tributary: 0 },
    loadedSources: [],
    failedSources: [],
  };

  emitStatus(onStatus, 'load', 'loading');
  const descriptors = sourceDescriptors(sourceUrls);
  const settled = await Promise.allSettled(descriptors.map((descriptor) => readFirstSource(descriptor)));
  const loaded = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      loaded.push(result.value);
      loadStats.loadedSources.push({
        kind: result.value.kind,
        url: result.value.label,
        fallbackFailures: result.value.failures,
      });
    } else {
      const failure = {
        kind: descriptors[index].kind,
        error: String(result.reason?.message || result.reason),
        attempts: result.reason?.failures || [],
      };
      loadStats.failedSources.push(failure);
      emitStatus(onStatus, 'load', 'source-failed', failure);
    }
  });
  if (!loaded.length) {
    emitStatus(onStatus, 'load', 'failed', { failures: loadStats.failedSources });
    throw new Error('No Guilin hydrology GeoJSON source could be loaded');
  }

  // Parse the dedicated Li River source first so duplicate OSM ways in the
  // general waterways collection cannot replace its traceable named records.
  loaded.sort((a, b) => (a.kind === 'lijiang' ? -1 : 1) - (b.kind === 'lijiang' ? -1 : 1));
  const seenKeys = new Set();
  const sourceSegments = [];
  for (const source of loaded) {
    sourceSegments.push(...parseFeatureCollection(source.data, source.kind, seenKeys, loadStats));
  }
  if (!sourceSegments.length) {
    emitStatus(onStatus, 'load', 'failed', { reason: 'no-linestring-parts' });
    throw new Error('Hydrology sources contain no valid LineString or MultiLineString parts');
  }
  emitStatus(onStatus, 'load', 'ready', {
    sourceParts: sourceSegments.length,
    sourcePoints: loadStats.sourcePoints,
    classes: { ...loadStats.classSourceParts },
    duplicatePartsSkipped: loadStats.duplicatePartsSkipped,
    partial: loadStats.failedSources.length > 0,
  });

  function setDataset(input) {
    if (disposed) throw new Error('Hydrology runtime is disposed');
    dataset = validateDataset(input);
    const clipped = [];
    for (const segment of sourceSegments) clipped.push(...clipSegmentRuns(segment, dataset));
    runs = clipped;
    endpointDiagnostics = buildEndpointDiagnostics(runs);
    exclusionIndex = buildExclusionIndex(runs, dataset);
    geometryRevision += 1;
    exclusionQueries.total = 0;
    exclusionQueries.excluded = 0;
    lastRenderStats = null;
    const points = runs.reduce((total, run) => total + run.points.length, 0);
    const status = {
      revision: geometryRevision,
      sourceParts: sourceSegments.length,
      clippedRuns: runs.length,
      clippedPoints: points,
      classes: Object.fromEntries(Object.keys(HYDROLOGY_CLASSES).map((key) => [
        key,
        runs.filter((run) => run.riverClass === key).length,
      ])),
      components: endpointDiagnostics.summary.byClass,
      crossSegmentConnections: 0,
      bridgeTriangles: 0,
      outOfBoundsVertices: 0,
      exclusionEdges: exclusionIndex.edges.length,
    };
    emitStatus(onStatus, 'dataset', 'ready', status);
    return { ...status };
  }

  function getRenderBatches(sharedState = {}, sampleHeight) {
    if (disposed) throw new Error('Hydrology runtime is disposed');
    if (!dataset) throw new Error('setDataset(dataset) must be called before getRenderBatches');
    const state = hydrologyState(sharedState);
    const stage = WATER_STAGE[state.season];
    const widthScale = stage.widthMultiplier * state.waterWidth * clamp(0.72 + state.waterLevel * 0.28, 0.45, 1.42);
    const centerlines = [];
    const surfaces = [];
    const banks = [];
    const flowArrows = [];
    const missingCounter = { count: 0 };
    let surfaceTriangles = 0;
    let outOfBoundsVertices = 0;

    for (const run of runs) {
      if (!classVisible(run, state)) continue;
      for (const point of run.points) {
        if (point.xNorm < -1e-8 || point.xNorm > 1 + 1e-8 || point.zNorm < -1e-8 || point.zNorm > 1 + 1e-8) {
          outOfBoundsVertices += 1;
        }
      }
      const points = pointsWithHeight(run, state, sampleHeight, dataset, missingCounter);
      const classStyle = HYDROLOGY_CLASSES[run.riverClass];
      const widthMeters = run.widthMeters * widthScale;
      if (state.showCenterlines) {
        centerlines.push(lineBatch(run, points, 'centerline', 0.12, {
          color: classStyle.color,
          lineWidthPx: run.riverClass === 'tributary' ? 1 : 1.6,
        }));
      }
      if (state.showSurface) {
        const surface = surfaceBatch(run, points, widthMeters, {
          color: classStyle.color,
          opacity: run.riverClass === 'tributary' ? 0.62 : 0.8,
          waterStage: state.season,
        });
        surfaces.push(surface);
        surfaceTriangles += surface.triangleCount;
      }
      if (state.showBanks) {
        banks.push(...bankBatches(run, points, widthMeters, {
          color: run.riverClass === 'tributary' ? [0.72, 0.58, 0.31, 0.72] : [0.82, 0.65, 0.35, 0.86],
          lineWidthPx: 1,
        }));
      }
      if (state.showFlow) {
        const flow = flowBatch(run, points, widthMeters, {
          color: [0.78, 0.94, 1, 0.9],
          lineWidthPx: 1.2,
        });
        if (flow) flowArrows.push(flow);
      }
    }

    const breakpointResult = state.showDiagnostics
      ? breakpointBatches(
        endpointDiagnostics.records.filter((record) => {
          const run = runs[record.runIndex];
          return run && classVisible(run, state);
        }),
        sampleHeight,
        state,
        dataset,
      )
      : { batches: [], missingSamples: 0 };
    missingCounter.count += breakpointResult.missingSamples;

    lastRenderStats = {
      revision: geometryRevision,
      waterStage: state.season,
      waterLevel: state.waterLevel,
      waterWidth: state.waterWidth,
      widthMultiplier: widthScale,
      levelOffsetM: stage.levelOffsetM + (state.waterLevel - 1) * 0.72,
      centerlineBatches: centerlines.length,
      surfaceBatches: surfaces.length,
      bankBatches: banks.length,
      flowBatches: flowArrows.length,
      breakpointBatches: breakpointResult.batches.length,
      surfaceTriangles,
      crossSegmentConnections: 0,
      bridgeTriangles: 0,
      outOfBoundsVertices,
      missingHeightSamples: missingCounter.count,
    };
    emitStatus(onStatus, 'render-batches', 'ready', lastRenderStats);
    return {
      module: MODULE_ID,
      revision: geometryRevision,
      coordinateSpace: 'local-meters',
      waterStage: state.season,
      centerlines,
      surfaces,
      banks,
      flowArrows,
      breakpoints: breakpointResult.batches,
      stats: { ...lastRenderStats },
    };
  }

  function isLandExcluded(xNorm, zNorm) {
    if (disposed || !dataset || !exclusionIndex) return false;
    const normalisedX = Number(xNorm);
    const normalisedZ = Number(zNorm);
    exclusionQueries.total += 1;
    if (!Number.isFinite(normalisedX) || !Number.isFinite(normalisedZ) ||
        normalisedX < 0 || normalisedX > 1 || normalisedZ < 0 || normalisedZ > 1) return false;
    const world = normalisedToWorld(normalisedX, normalisedZ, dataset);
    const cellX = Math.floor(world.x / exclusionIndex.cellSize);
    const cellZ = Math.floor(world.z / exclusionIndex.cellSize);
    const candidates = exclusionIndex.cells.get(`${cellX},${cellZ}`) || [];
    const seen = new Set();
    for (const edge of candidates) {
      if (seen.has(edge.id)) continue;
      seen.add(edge.id);
      if (distancePointToEdge(world, edge) <= edge.halfWidthM) {
        exclusionQueries.excluded += 1;
        return true;
      }
    }
    return false;
  }

  function getDiagnostics() {
    const datasetSummary = dataset ? {
      widthMeters: dataset.widthMeters,
      heightMeters: dataset.heightMeters,
      wgs84Bounds: [...dataset.wgs84Bounds],
    } : null;
    return cloneDiagnostics({
      module: MODULE_ID,
      disposed,
      loadedAt: loadStats.loadedSources.length ? nowIso() : null,
      dataset: datasetSummary,
      revision: geometryRevision,
      source: {
        ...loadStats,
        ignoredGeometryTypes: { ...loadStats.ignoredGeometryTypes },
        classSourceParts: { ...loadStats.classSourceParts },
      },
      clipped: {
        runs: runs.length,
        points: runs.reduce((total, run) => total + run.points.length, 0),
        byClass: Object.fromEntries(Object.keys(HYDROLOGY_CLASSES).map((key) => [
          key,
          runs.filter((run) => run.riverClass === key).length,
        ])),
      },
      continuity: endpointDiagnostics.summary,
      geometrySafety: {
        sourcePartsRemainIndependent: true,
        clipRunsRemainIndependent: true,
        crossSegmentConnections: 0,
        bridgeTriangles: 0,
        outOfBoundsVertices: lastRenderStats?.outOfBoundsVertices ?? 0,
      },
      plantExclusion: exclusionIndex ? {
        edgeCount: exclusionIndex.edges.length,
        maximumHalfWidthM: exclusionIndex.maximumHalfWidthM,
        estimatedAreaKm2: exclusionIndex.estimatedAreaKm2,
        estimatedCoverageFraction: exclusionIndex.estimatedCoverageFraction,
        queryCount: exclusionQueries.total,
        excludedQueryCount: exclusionQueries.excluded,
      } : null,
      lastRender: lastRenderStats,
    });
  }

  function dispose() {
    if (disposed) return;
    runs = [];
    endpointDiagnostics = { records: [], summary: {} };
    exclusionIndex = null;
    dataset = null;
    lastRenderStats = null;
    disposed = true;
    emitStatus(onStatus, 'lifecycle', 'disposed');
  }

  return { setDataset, getRenderBatches, isLandExcluded, getDiagnostics, dispose };
}
