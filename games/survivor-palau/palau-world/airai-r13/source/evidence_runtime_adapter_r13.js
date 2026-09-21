(() => {
  'use strict';
  const VERSION = 'AIRAI_R13_EVIDENCE_BOUND_CORE_20260921';
  const OCEAN_SOURCE = 'OCEAN_MOTHER_R018_V0.3.6_UNIFIED';
  const raw = window.__AIRAI_R13_EVIDENCE__;
  if (!raw?.meta || !raw?.arrays) throw new Error('R13 runtime evidence payload missing');

  const decode = (text) => {
    const binary = atob(text);
    const output = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) output[i] = binary.charCodeAt(i);
    return output;
  };
  const littleEndian = (() => {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setUint16(0, 0x0102, true);
    return new Uint8Array(buffer)[0] === 2;
  })();
  const typed = (entry) => {
    const bytes = decode(entry.b64);
    if (entry.type === 'u8') return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const Type = entry.type === 'i16' ? Int16Array : Uint16Array;
    if (littleEndian && bytes.byteOffset % 2 === 0) {
      return new Type(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    }
    const output = new Type(bytes.byteLength / 2);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < output.length; i += 1) {
      output[i] = entry.type === 'i16'
        ? view.getInt16(i * 2, true)
        : view.getUint16(i * 2, true);
    }
    return output;
  };

  const arrays = {};
  for (const [name, entry] of Object.entries(raw.arrays)) arrays[name] = typed(entry);
  const meta = raw.meta;
  const cellCount = meta.width * meta.height;
  for (const [name, array] of Object.entries(arrays)) {
    if (array.length !== cellCount) throw new Error(`R13 array length mismatch: ${name}`);
  }

  const earthA = 6378137;
  const eccentricity = 0.00669438;
  const scale = 0.9996;
  const zone = 53;
  const lonOrigin = (zone - 1) * 6 - 180 + 3;

  const lonLatToUtm = (lon, lat) => {
    const latitude = lat * Math.PI / 180;
    const longitude = lon * Math.PI / 180;
    const origin = lonOrigin * Math.PI / 180;
    const prime = eccentricity / (1 - eccentricity);
    const n = earthA / Math.sqrt(1 - eccentricity * Math.sin(latitude) ** 2);
    const t = Math.tan(latitude) ** 2;
    const c = prime * Math.cos(latitude) ** 2;
    const x = Math.cos(latitude) * (longitude - origin);
    const meridian = earthA * (
      (1 - eccentricity / 4 - 3 * eccentricity ** 2 / 64 - 5 * eccentricity ** 3 / 256) * latitude
      - (3 * eccentricity / 8 + 3 * eccentricity ** 2 / 32 + 45 * eccentricity ** 3 / 1024) * Math.sin(2 * latitude)
      + (15 * eccentricity ** 2 / 256 + 45 * eccentricity ** 3 / 1024) * Math.sin(4 * latitude)
      - (35 * eccentricity ** 3 / 3072) * Math.sin(6 * latitude)
    );
    return [
      scale * n * (x + (1 - t + c) * x ** 3 / 6 + (5 - 18 * t + t ** 2 + 72 * c - 58 * prime) * x ** 5 / 120) + 500000,
      scale * (meridian + n * Math.tan(latitude) * (
        x ** 2 / 2 + (5 - t + 9 * c + 4 * c ** 2) * x ** 4 / 24
        + (61 - 58 * t + t ** 2 + 600 * c - 330 * prime) * x ** 6 / 720
      )),
    ];
  };

  const utmToLonLat = (easting, northing) => {
    const x = easting - 500000;
    const y = northing;
    const prime = eccentricity / (1 - eccentricity);
    const meridian = y / scale;
    const mu = meridian / (earthA * (1 - eccentricity / 4 - 3 * eccentricity ** 2 / 64 - 5 * eccentricity ** 3 / 256));
    const e1 = (1 - Math.sqrt(1 - eccentricity)) / (1 + Math.sqrt(1 - eccentricity));
    const phi = mu
      + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
      + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
      + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
      + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const n = earthA / Math.sqrt(1 - eccentricity * Math.sin(phi) ** 2);
    const t = Math.tan(phi) ** 2;
    const c = prime * Math.cos(phi) ** 2;
    const r = earthA * (1 - eccentricity) / (1 - eccentricity * Math.sin(phi) ** 2) ** 1.5;
    const d = x / (n * scale);
    const latitude = phi - (n * Math.tan(phi) / r) * (
      d ** 2 / 2
      - (5 + 3 * t + 10 * c - 4 * c ** 2 - 9 * prime) * d ** 4 / 24
      + (61 + 90 * t + 298 * c + 45 * t ** 2 - 252 * prime - 3 * c ** 2) * d ** 6 / 720
    );
    const longitude = (
      d - (1 + 2 * t + c) * d ** 3 / 6
      + (5 - 2 * c + 28 * t - 3 * c ** 2 + 8 * prime + 24 * t ** 2) * d ** 5 / 120
    ) / Math.cos(phi);
    return [lonOrigin + longitude * 180 / Math.PI, latitude * 180 / Math.PI];
  };

  const cellFor = (eastM, northM) => {
    const easting = meta.centerEastingM + eastM;
    const northing = meta.centerNorthingM + northM;
    const col = Math.floor((easting - meta.originWestM) / meta.resolutionM);
    const row = Math.floor((meta.originNorthM - northing) / meta.resolutionM);
    const inside = row >= 0 && row < meta.height && col >= 0 && col < meta.width;
    return {
      easting,
      northing,
      col,
      row,
      inside,
      index: inside ? row * meta.width + col : -1,
    };
  };
  const int16 = (array, index, multiplier = 0.1) => (
    array[index] === -32768 ? null : array[index] * multiplier
  );
  const uint16 = (array, index, multiplier = 1) => (
    array[index] === 65535 ? null : array[index] * multiplier
  );
  const currentTime = () => {
    const state = window.OceanMotherR018?.getState?.();
    return Number.isFinite(state?.physicalTime) ? state.physicalTime : 0;
  };

  const sample = (eastM, northM, time = currentTime(), observationBand = 'runtime') => {
    const cell = cellFor(Number(eastM), Number(northM));
    const ocean = window.OceanMotherR018;
    const water = ocean?.sampleWater?.(Number(eastM), Number(northM), Number(time)) ?? null;
    const wind = ocean?.sampleWind?.(Number(eastM), 0, Number(northM), Number(time)) ?? null;
    const calibrationBed = ocean?.sampleBed?.(Number(eastM), Number(northM)) ?? null;
    const [lon, lat] = utmToLonLat(cell.easting, cell.northing);

    if (!cell.inside) {
      return {
        version: VERSION,
        coordinates: {
          eastM,
          northM,
          utmEastingM: cell.easting,
          utmNorthingM: cell.northing,
          lon,
          lat,
        },
        worldTime: time,
        observationBand,
        terrain: { status: 'OUTSIDE_AIRAI_R13_EVIDENCE_CORE', heightM: null },
        reef: { status: 'OUTSIDE_AIRAI_R13_EVIDENCE_CORE', depthChartDatumM: null },
        ocean: water ? {
          status: 'BOUND_VERIFIED_RUNTIME',
          source: OCEAN_SOURCE,
          surfaceHeightM: water.eta,
          breaker: water.breaker,
          slopeEnergy: water.slopeEnergy,
          windVector: Array.from(wind),
          windMps: Math.hypot(...wind),
        } : { status: 'RUNTIME_PENDING' },
        verticalAlignment: {
          status: 'UNRESOLVED',
          reason: 'Ocean runtime zero is not asserted equivalent to S-57 local sounding datum.',
        },
        rendererCalibrationOnly: {
          legacyBedHeightM: calibrationBed,
          productionTerrain: false,
        },
      };
    }

    const index = cell.index;
    const hasCandidate = arrays.valid[index] === 1;
    const land = arrays.land[index] === 1;
    const depth = hasCandidate ? int16(arrays.depthDm, index) : null;
    const semanticCode = arrays.semantic[index];
    const supportCode = arrays.support[index];

    return {
      version: VERSION,
      coordinates: {
        eastM,
        northM,
        utmEastingM: cell.easting,
        utmNorthingM: cell.northing,
        lon,
        lat,
        row: cell.row,
        col: cell.col,
      },
      worldTime: time,
      observationBand,
      terrain: land ? {
        status: 'LAND_FOOTPRINT_BOUND_ELEVATION_UNAVAILABLE',
        land: true,
        heightM: null,
        source: 'NOAA ENC LNDARE',
        certainty: 'FOOTPRINT_ONLY_NO_DEM',
      } : {
        status: 'NO_LNDARE_AT_CELL',
        land: false,
        heightM: null,
        source: 'NOAA ENC LNDARE',
        certainty: 'NO_ELEVATION_BOUND',
      },
      reef: {
        status: land
          ? 'CANDIDATE_SUPPRESSED_BY_ENC_LNDARE'
          : hasCandidate
            ? 'EVIDENCE_BOUND_CANDIDATE_NOT_SURVEY_TRUTH'
            : 'NO_DATA_PRESERVED',
        depthChartDatumM: !land && hasCandidate ? depth : null,
        bedElevationChartDatumM: !land && hasCandidate ? -depth : null,
        uncertaintyM: !land && hasCandidate
          ? uint16(arrays.uncertaintyDm, index, 0.1)
          : null,
        nearestEvidenceM: !land && hasCandidate
          ? uint16(arrays.nearestM, index)
          : null,
        sourceQualityWeight: !land && hasCandidate
          ? arrays.qualityQ[index] / 254
          : null,
        semanticZone: meta.semanticNames[String(semanticCode)] || 'unknown',
        semanticCode,
        depareSupport: meta.supportNames[String(supportCode)] || 'unknown',
        supportCode,
        depareRangeM: {
          lower: int16(arrays.depareLowerDm, index),
          upper: int16(arrays.depareUpperDm, index),
          residual: uint16(arrays.depareResidualDm, index, 0.1),
        },
        datum: meta.datum,
        source: 'NOAA ENC SOUNDG + DEPCNT + M_QUAL; Allen semantic companion; DEPARE uncertainty conditioning',
        sampling: meta.sampling,
        candidateSuppressedByLandEvidence: land && hasCandidate,
      },
      ocean: water ? {
        status: 'BOUND_VERIFIED_RUNTIME',
        source: OCEAN_SOURCE,
        surfaceHeightM: water.eta,
        breaker: water.breaker,
        slopeEnergy: water.slopeEnergy,
        bandStrengths: Array.from(water.bandStrengths || []),
        windVector: Array.from(wind),
        windMps: Math.hypot(...wind),
      } : { status: 'RUNTIME_PENDING' },
      verticalAlignment: {
        status: 'UNRESOLVED',
        chartDatum: meta.datum,
        oceanModelZero: 'independent runtime zero',
        numericTransformApplied: false,
        mslEquivalenceAsserted: false,
      },
      rendererCalibrationOnly: {
        legacyBedHeightM: calibrationBed,
        productionTerrain: false,
        warning: 'Visible Ocean Mother calibration geometry is not Palau terrain truth.',
      },
    };
  };

  const sampleGeo = (lon, lat, time = currentTime(), observationBand = 'runtime') => {
    const [easting, northing] = lonLatToUtm(Number(lon), Number(lat));
    return sample(
      easting - meta.centerEastingM,
      northing - meta.centerNorthingM,
      time,
      observationBand,
    );
  };
  const sampleCell = (row, col, time = currentTime()) => {
    const easting = meta.originWestM + (Number(col) + 0.5) * meta.resolutionM;
    const northing = meta.originNorthM - (Number(row) + 0.5) * meta.resolutionM;
    return sample(
      easting - meta.centerEastingM,
      northing - meta.centerNorthingM,
      time,
      'grid-cell',
    );
  };

  const install = () => {
    const ocean = window.OceanMotherR018;
    if (!ocean?.qa?.ready) {
      requestAnimationFrame(install);
      return;
    }
    window.PalauWorld = Object.freeze({
      sample,
      sampleGeo,
      sampleCell,
      sampleOcean: sample,
      meta: Object.freeze({
        ...meta,
        sourceIdentity: OCEAN_SOURCE,
        terrainStatus: 'AIRAI_CORE_LANDAREA_FOOTPRINT_BOUND_ELEVATION_MISSING',
        traditionalLOD: false,
        oldCandidateAnchorLoaded: false,
        visualAcceptance: false,
        productionReady: false,
      }),
    });
    window.AiraiEvidenceR13 = Object.freeze({
      meta,
      arrays,
      soundings: raw.soundings,
      lonLatToUtm,
      utmToLonLat,
    });
    window.__PALAU_R13_QA__ = {
      version: VERSION,
      sourceModified: true,
      interactive3D: true,
      staticImageSubstitute: false,
      oceanSourceIdentity: OCEAN_SOURCE,
      frozenOceanRuntimeReady: true,
      evidencePayloadReady: true,
      validCandidateCells: meta.validCandidateCells,
      soundings: meta.soundings,
      datumCode: meta.datum.code,
      datumName: meta.datum.name,
      fullPalauTerrainStatus: meta.fullPalauTerrainStatus,
      storyRegionStatus: meta.storyRegionStatus,
      oldCandidateAnchorLoaded: false,
      traditionalLOD: false,
      visualAcceptance: false,
      productionReady: false,
    };
  };
  install();
})();
