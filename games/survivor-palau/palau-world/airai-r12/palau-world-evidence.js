(() => {
  'use strict';

  const manifest = window.__PALAU_R12_MANIFEST;
  const encoded = window.__PALAU_R12_GRID_PARTS || {};
  if (!manifest) throw new Error('PALAU_R12_MANIFEST_MISSING');

  const TYPE = {
    depthDm: Int16Array,
    uncertaintyDm: Uint16Array,
    nearestM: Uint16Array,
    qualityU8: Uint8Array,
    semanticU8: Uint8Array,
    supportU8: Uint8Array,
    landU8: Uint8Array,
    depareLowerDm: Int16Array,
    depareUpperDm: Int16Array,
    depareResidualDm: Uint16Array,
    semanticResidualDm: Uint16Array,
  };

  const NODATA = {
    depthDm: -32768,
    uncertaintyDm: 65535,
    nearestM: 65535,
    qualityU8: 255,
    semanticU8: 0,
    supportU8: 0,
    depareLowerDm: -32768,
    depareUpperDm: -32768,
    depareResidualDm: 65535,
    semanticResidualDm: 65535,
  };

  function decode(key) {
    const payload = encoded[key];
    const Ctor = TYPE[key];
    if (!payload || !Ctor) throw new Error(`PALAU_R12_PART_MISSING:${key}`);
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (bytes.byteOffset % Ctor.BYTES_PER_ELEMENT === 0) {
      return new Ctor(bytes.buffer, bytes.byteOffset, bytes.byteLength / Ctor.BYTES_PER_ELEMENT);
    }
    const copy = bytes.slice();
    return new Ctor(copy.buffer);
  }

  const arrays = {};
  for (const key of Object.keys(TYPE)) arrays[key] = decode(key);

  const [height, width] = manifest.grid.shape;
  const [west, south, east, north] = manifest.grid.projectedBoundsM;
  const resolution = manifest.grid.resolutionM;
  const expected = width * height;
  for (const [key, arr] of Object.entries(arrays)) {
    if (arr.length !== expected) throw new Error(`PALAU_R12_SHAPE_MISMATCH:${key}:${arr.length}:${expected}`);
  }

  const semanticNames = manifest.arraySemantics.semanticU8;
  const supportNames = manifest.arraySemantics.supportU8;

  function lonLatToUtm53(lonDeg, latDeg) {
    const a = 6378137.0;
    const eccSquared = 0.00669438;
    const eccPrimeSquared = eccSquared / (1 - eccSquared);
    const k0 = 0.9996;
    const lat = latDeg * Math.PI / 180;
    const lon = lonDeg * Math.PI / 180;
    const lonOrigin = 135 * Math.PI / 180;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    const tanLat = Math.tan(lat);
    const N = a / Math.sqrt(1 - eccSquared * sinLat * sinLat);
    const T = tanLat * tanLat;
    const C = eccPrimeSquared * cosLat * cosLat;
    const A = cosLat * (lon - lonOrigin);
    const e2 = eccSquared;
    const M = a * (
      (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * lat
      - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * lat)
      + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * lat)
      - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * lat)
    );
    const easting = k0 * N * (
      A + (1 - T + C) * A ** 3 / 6
      + (5 - 18 * T + T * T + 72 * C - 58 * eccPrimeSquared) * A ** 5 / 120
    ) + 500000.0;
    const northing = k0 * (
      M + N * tanLat * (
        A * A / 2
        + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24
        + (61 - 58 * T + T * T + 600 * C - 330 * eccPrimeSquared) * A ** 6 / 720
      )
    );
    return [easting, northing];
  }

  function projectedToGrid(x, y) {
    return {
      col: (x - west) / resolution - 0.5,
      row: (north - y) / resolution - 0.5,
    };
  }

  function gridIndex(row, col) {
    if (row < 0 || col < 0 || row >= height || col >= width) return -1;
    return row * width + col;
  }

  function nearestValue(key, rowF, colF) {
    const row = Math.round(rowF);
    const col = Math.round(colF);
    const i = gridIndex(row, col);
    if (i < 0) return null;
    const value = arrays[key][i];
    return value === NODATA[key] ? null : value;
  }

  function bilinearValue(key, rowF, colF, scale = 1) {
    const r0 = Math.floor(rowF);
    const c0 = Math.floor(colF);
    const fr = rowF - r0;
    const fc = colF - c0;
    let weighted = 0;
    let total = 0;
    for (let dr = 0; dr <= 1; dr++) {
      for (let dc = 0; dc <= 1; dc++) {
        const i = gridIndex(r0 + dr, c0 + dc);
        if (i < 0) continue;
        const raw = arrays[key][i];
        if (raw === NODATA[key]) continue;
        const w = (dr ? fr : 1 - fr) * (dc ? fc : 1 - fc);
        weighted += raw * scale * w;
        total += w;
      }
    }
    return total > 0 ? weighted / total : null;
  }

  function sampleProjected(x, y, t = 0) {
    const { row, col } = projectedToGrid(x, y);
    const inside = row >= -0.5 && col >= -0.5 && row <= height - 0.5 && col <= width - 0.5;
    const depthM = bilinearValue('depthDm', row, col, 0.1);
    const uncertaintyM = bilinearValue('uncertaintyDm', row, col, 0.1);
    const nearestEvidenceM = bilinearValue('nearestM', row, col, 1);
    const qualityRaw = bilinearValue('qualityU8', row, col, 1);
    const semanticCode = nearestValue('semanticU8', row, col);
    const supportClass = nearestValue('supportU8', row, col);
    const landRaw = nearestValue('landU8', row, col);
    const lowerM = bilinearValue('depareLowerDm', row, col, 0.1);
    const upperM = bilinearValue('depareUpperDm', row, col, 0.1);
    const depareResidualM = bilinearValue('depareResidualDm', row, col, 0.1);
    const semanticResidualM = bilinearValue('semanticResidualDm', row, col, 0.1);
    const valid = inside && depthM !== null;
    return {
      status: valid ? manifest.status : (inside ? 'NO_DATA' : 'OUTSIDE_AIRAI_R12_CORE'),
      valid,
      t,
      projected: { crs: manifest.grid.crs, xM: x, yM: y, row, col },
      bathymetry: valid ? {
        depthMChartDatum: depthM,
        seafloorRelativeToChartDatumM: -depthM,
        uncertaintyM,
        nearestEvidenceM,
        relativeEvidenceQuality: qualityRaw === null ? null : qualityRaw / 254,
        datum: manifest.verticalDatum,
      } : null,
      land: {
        isChartedLandArea: landRaw === 1,
        elevationM: null,
        rule: 'LNDARE is a horizontal mask only; accepted Palau DEM is absent, so land elevation is unknown.',
      },
      semantics: {
        code: semanticCode,
        name: semanticCode === null ? null : semanticNames[String(semanticCode)] || 'unknown',
        residualM: semanticResidualM,
        role: 'qualifier_not_depth_observation',
      },
      depare: {
        supportClass,
        supportName: supportClass === null ? null : supportNames[String(supportClass)] || 'unknown',
        lowerM,
        upperM,
        residualM: depareResidualM,
        role: 'charted_interval_evidence_not_depth_mutation',
      },
      world: {
        traditionalLOD: false,
        visualAcceptance: manifest.visualAcceptance,
        productionReady: manifest.productionReady,
        conductor: manifest.worldConductor,
      },
    };
  }

  function sample(lon, lat, t = 0) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new TypeError('PalauWorld.sample requires finite lon/lat');
    const [x, y] = lonLatToUtm53(lon, lat);
    const result = sampleProjected(x, y, t);
    result.wgs84 = { lon, lat };
    return result;
  }

  const api = {
    version: manifest.version,
    status: manifest.status,
    meta: manifest,
    grid: { arrays, width, height, west, south, east, north, resolution },
    vectors: window.__PALAU_R12_VECTORS || null,
    lonLatToUtm53,
    projectedToGrid,
    sampleProjected,
    sample,
    ready: Promise.resolve(true),
  };
  Object.freeze(api.grid);
  window.PalauWorld = api;
  window.dispatchEvent(new CustomEvent('palauworldready', { detail: api }));
})();
