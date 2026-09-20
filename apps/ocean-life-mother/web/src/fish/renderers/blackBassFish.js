/**
 * FISH-R1-T01 — source-independent largemouth-bass head/mouth kernel.
 *
 * Coordinate frame:
 *   x: lateral, positive to fish right
 *   y: vertical, positive dorsal/up
 *   u: normalized longitudinal coordinate, tail=0, snout=1
 * All values below are normalized by the observed source body length.
 * The reference GLB is an observation input only; no source vertices,
 * texture pixels, skin tracks or source topology are embedded here.
 */

export const BLACK_BASS_R1_CARD = Object.freeze({
  schema: 'kaopu.fish.black-bass.head-mouth/0.2',
  taskId: 'FISH-R1-T01',
  species: Object.freeze({ scientific: 'Micropterus salmoides', common: 'Largemouth Bass', habitatIdentity: 'freshwater' }),
  source: Object.freeze({
    referenceId: 'FISH-REF-001',
    sha256: 'c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64',
    originalBytes: 18644040,
    sourceMeshRuntimeDependency: false,
    sourceTextureRuntimeDependency: false,
    sourceRigRuntimeDependency: false,
    sourceAnimationRuntimeDependency: false
  }),
  frame: Object.freeze({ unit: 'bodyLength', axes: Object.freeze({ x: 'lateral-right', y: 'dorsal-up', u: 'tail-to-snout' }) }),
  eyes: Object.freeze({
    leftCenter: Object.freeze([-0.0461234703, 0.0301874735, 0.8773876841]),
    rightCenter: Object.freeze([0.0459188562, 0.0301627850, 0.8773354142]),
    radii: Object.freeze([0.0092, 0.0228, 0.0223]),
    observedExtents: Object.freeze([0.0186357513, 0.0464652615, 0.0453004358])
  }),
  jaw: Object.freeze({
    hinge: Object.freeze([0.0, -0.0745099834, 0.8497990694]),
    observedTip: Object.freeze([0.0, -0.0118980916, 1.0]),
    // u, halfWidth, topY, bottomY; low-dimensional envelope only.
    envelope: Object.freeze([
      Object.freeze([0.680000000, 0.034000000, -0.080000000, -0.112000000]),
      Object.freeze([0.710000000, 0.042000000, -0.077000000, -0.108000000]),
      Object.freeze([0.740091081, 0.048752301, -0.074307736, -0.102761050]),
      Object.freeze([0.761557604, 0.064950643, -0.046707035, -0.100628629]),
      Object.freeze([0.783024128, 0.068574764, -0.039459786, -0.099138125]),
      Object.freeze([0.804490652, 0.068338397, -0.023820027, -0.097922537]),
      Object.freeze([0.825957175, 0.065607679, -0.014315152, -0.095198912]),
      Object.freeze([0.847423699, 0.061820079, -0.013729200, -0.092665877]),
      Object.freeze([0.868890223, 0.059180415, -0.010000000, -0.085723487]),
      Object.freeze([0.890356746, 0.057102907, -0.009000000, -0.081923318]),
      Object.freeze([0.911823270, 0.055861743, -0.006000000, -0.075100269]),
      Object.freeze([0.933289794, 0.049184799, -0.004000000, -0.067280988]),
      Object.freeze([0.954756318, 0.042624607, -0.003000000, -0.058016849]),
      Object.freeze([0.976222841, 0.032495912, -0.002500000, -0.044564112]),
      Object.freeze([0.997689365, 0.021792835, -0.004306105, -0.030513073])
    ]),
    safeOpenRangeRad: Object.freeze([0, 0.30])
  }),
  cranialProfile: Object.freeze([
    // u, halfWidth, topY, bottomY. The anterior bottom is a structural mouth-roof boundary.
    Object.freeze([0.598853392, 0.063175223, 0.015000000, -0.104206441]),
    Object.freeze([0.648707889, 0.064287707, 0.050000000, -0.106985601]),
    Object.freeze([0.698562385, 0.070032918, 0.090000000, -0.108000000]),
    Object.freeze([0.723489634, 0.072755607, 0.137176057, -0.105926437]),
    Object.freeze([0.748416882, 0.071344958, 0.136212337, -0.094974049]),
    Object.freeze([0.773344130, 0.071193502, 0.131206492, -0.078000000]),
    Object.freeze([0.798271379, 0.069251117, 0.121467561, -0.055000000]),
    Object.freeze([0.823198627, 0.065930123, 0.112726240, -0.035000000]),
    Object.freeze([0.848125875, 0.059816719, 0.100504168, -0.018000000]),
    Object.freeze([0.873053123, 0.052000000, 0.087764396, -0.010000000]),
    Object.freeze([0.897980372, 0.048000000, 0.075874435, -0.004000000]),
    Object.freeze([0.922907620, 0.047362796, 0.065020547, 0.000000000]),
    Object.freeze([0.947834868, 0.044249880, 0.044079214, 0.002000000]),
    Object.freeze([0.972762117, 0.033960949, 0.027862930, 0.003000000]),
    Object.freeze([0.997689365, 0.010000000, 0.015002765, -0.002000000])
  ]),
  cavityProfile: Object.freeze([
    Object.freeze([0.833, 0.050, -0.012, -0.052]),
    Object.freeze([0.862, 0.047, -0.008, -0.048]),
    Object.freeze([0.893, 0.043, -0.004, -0.041]),
    Object.freeze([0.925, 0.036, 0.000, -0.033]),
    Object.freeze([0.956, 0.026, 0.002, -0.023]),
    Object.freeze([0.986, 0.010, 0.003, -0.010])
  ]),
  maxillary: Object.freeze({
    rearAnchor: Object.freeze([0.0562, -0.0379, 0.8265]),
    frontAnchor: Object.freeze([0.0320, -0.0040, 0.9580]),
    evidence: 'engineering candidate constrained by institutional identification guidance; precise allowance not yet a biological measurement'
  }),
  evidenceBoundary: Object.freeze({
    sourceFileFacts: Object.freeze(['body bounds', 'eye volumes', 'jaw_22 bind pivot', 'jaw-weighted low-dimensional envelope']),
    naturalFacts: Object.freeze(['adult largemouth-bass upper jaw extends behind rear eye margin']),
    engineeringCandidates: Object.freeze(['anterior cranial mouth-roof boundary', 'maxillary posterior allowance', 'superellipse exponent']),
    visualAcceptance: false,
    productionReady: false
  })
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function rotateAboutHinge(point, hinge, angle) {
  const [x, y, u] = point;
  const [, hy, hu] = hinge;
  const dy = y - hy;
  const du = u - hu;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x, hy + dy * c - du * s, hu + dy * s + du * c];
}

function superellipsePoint(theta, halfWidth, topY, bottomY, exponent = 2.25) {
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const p = 2 / exponent;
  const x = Math.sign(sin) * Math.pow(Math.abs(sin), p) * halfWidth;
  const centerY = (topY + bottomY) * 0.5;
  const radiusY = cos >= 0 ? topY - centerY : centerY - bottomY;
  const y = centerY + Math.sign(cos) * Math.pow(Math.abs(cos), p) * radiusY;
  return [x, y];
}

function catmullRom(a, b, c, d, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}

export function resampleProfile(stations, subdivisions = 4) {
  if (!Number.isInteger(subdivisions) || subdivisions < 1) throw new Error('subdivisions');
  const out = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const p0 = stations[Math.max(0, i - 1)];
    const p1 = stations[i];
    const p2 = stations[i + 1];
    const p3 = stations[Math.min(stations.length - 1, i + 2)];
    for (let k = 0; k < subdivisions; k++) {
      const t = k / subdivisions;
      const row = p1.map((_, j) => catmullRom(p0[j], p1[j], p2[j], p3[j], t));
      row[1] = Math.max(row[1], 1e-5);
      if (row[2] <= row[3]) row[2] = row[3] + 1e-5;
      out.push(row);
    }
  }
  out.push([...stations.at(-1)]);
  return out;
}

/** Build a closed loft from [u, halfWidth, topY, bottomY] stations. */
export function loftProfile(stations, { radialSegments = 32, exponent = 2.25, transformPoint = null, subdivisions = 4 } = {}) {
  if (!Array.isArray(stations) || stations.length < 2) throw new Error('stations');
  if (!Number.isInteger(radialSegments) || radialSegments < 8) throw new Error('radialSegments');
  const sampled = resampleProfile(stations, subdivisions);
  const positions = [];
  const indices = [];
  for (const station of sampled) {
    const [u, halfWidth, topY, bottomY] = station;
    if (![u, halfWidth, topY, bottomY].every(Number.isFinite) || halfWidth <= 0 || topY <= bottomY) throw new Error('invalid station');
    for (let k = 0; k < radialSegments; k++) {
      const theta = (2 * Math.PI * k) / radialSegments;
      const [x, y] = superellipsePoint(theta, halfWidth, topY, bottomY, exponent);
      const p = transformPoint ? transformPoint([x, y, u]) : [x, y, u];
      positions.push(...p);
    }
  }
  const ringCount = sampled.length;
  for (let i = 0; i < ringCount - 1; i++) {
    for (let k = 0; k < radialSegments; k++) {
      const a = i * radialSegments + k;
      const b = i * radialSegments + ((k + 1) % radialSegments);
      const c = (i + 1) * radialSegments + ((k + 1) % radialSegments);
      const d = (i + 1) * radialSegments + k;
      indices.push(a, b, c, a, c, d);
    }
  }
  return { positions, indices, ringCount, radialSegments };
}

export function buildCranialMesh(options = {}) {
  return loftProfile(BLACK_BASS_R1_CARD.cranialProfile, {
    radialSegments: options.radialSegments ?? 48,
    exponent: options.exponent ?? 2.45,
    subdivisions: options.subdivisions ?? 4
  });
}

export function transformJawPoint(point, mouthOpenRad = 0) {
  const [minOpen, maxOpen] = BLACK_BASS_R1_CARD.jaw.safeOpenRangeRad;
  const angle = clamp(mouthOpenRad, minOpen, maxOpen);
  return rotateAboutHinge(point, BLACK_BASS_R1_CARD.jaw.hinge, angle);
}

export function buildLowerJawMesh({ mouthOpenRad = 0, radialSegments = 44, exponent = 2.30, subdivisions = 4 } = {}) {
  const [minOpen, maxOpen] = BLACK_BASS_R1_CARD.jaw.safeOpenRangeRad;
  const angle = clamp(mouthOpenRad, minOpen, maxOpen);
  const hinge = BLACK_BASS_R1_CARD.jaw.hinge;
  return {
    ...loftProfile(BLACK_BASS_R1_CARD.jaw.envelope, {
      radialSegments,
      exponent,
      subdivisions,
      transformPoint: point => transformJawPoint(point, angle)
    }),
    mouthOpenRad: angle,
    hinge: [...hinge]
  };
}

export function buildMouthCavityMesh({ radialSegments = 36, subdivisions = 4 } = {}) {
  return loftProfile(BLACK_BASS_R1_CARD.cavityProfile, { radialSegments, exponent: 2.1, subdivisions });
}

export function buildEllipsoidMesh(center, radii, { latitudeSegments = 18, longitudeSegments = 28 } = {}) {
  const positions = [];
  const indices = [];
  for (let iy = 0; iy <= latitudeSegments; iy++) {
    const v = iy / latitudeSegments;
    const phi = Math.PI * v;
    for (let ix = 0; ix < longitudeSegments; ix++) {
      const u = ix / longitudeSegments;
      const theta = 2 * Math.PI * u;
      positions.push(
        center[0] + radii[0] * Math.sin(phi) * Math.cos(theta),
        center[1] + radii[1] * Math.cos(phi),
        center[2] + radii[2] * Math.sin(phi) * Math.sin(theta)
      );
    }
  }
  for (let iy = 0; iy < latitudeSegments; iy++) {
    for (let ix = 0; ix < longitudeSegments; ix++) {
      const nx = (ix + 1) % longitudeSegments;
      const a = iy * longitudeSegments + ix;
      const b = iy * longitudeSegments + nx;
      const c = (iy + 1) * longitudeSegments + nx;
      const d = (iy + 1) * longitudeSegments + ix;
      indices.push(a, b, c, a, c, d);
    }
  }
  return { positions, indices };
}

function buildSideRibbon(side, centerlineYU, halfHeights, lateralOffsets, thickness = 0.0018) {
  const positions = [];
  const indices = [];
  const n = centerlineYU.length;
  const index = (shell, edge, i) => ((shell * 2 + edge) * n + i);
  for (let shell = 0; shell < 2; shell++) {
    for (let edge = 0; edge < 2; edge++) {
      for (let i = 0; i < n; i++) {
        const [y, u] = centerlineYU[i];
        const x = side * (lateralOffsets[i] + (shell ? 1 : -1) * thickness * 0.5);
        positions.push(x, y + (edge ? 1 : -1) * halfHeights[i], u);
      }
    }
  }
  for (let shell = 0; shell < 2; shell++) {
    for (let i = 0; i < n - 1; i++) {
      const a = index(shell, 0, i), b = index(shell, 0, i + 1), c = index(shell, 1, i + 1), d = index(shell, 1, i);
      indices.push(a, b, c, a, c, d);
    }
  }
  for (let edge = 0; edge < 2; edge++) {
    for (let i = 0; i < n - 1; i++) {
      const a = index(0, edge, i), b = index(0, edge, i + 1), c = index(1, edge, i + 1), d = index(1, edge, i);
      indices.push(a, b, c, a, c, d);
    }
  }
  for (const i of [0, n - 1]) {
    const a = index(0, 0, i), b = index(0, 1, i), c = index(1, 1, i), d = index(1, 0, i);
    indices.push(a, b, c, a, c, d);
  }
  return { positions, indices };
}

export function buildMaxillaryMeshes() {
  const centerline = [[-0.036, 0.821], [-0.031, 0.842], [-0.025, 0.868], [-0.018, 0.897], [-0.010, 0.928], [-0.004, 0.958]];
  const halfHeights = [0.0060, 0.0060, 0.0055, 0.0048, 0.0038, 0.0025];
  const lateral = [0.057, 0.060, 0.059, 0.054, 0.045, 0.032];
  return {
    left: buildSideRibbon(-1, centerline, halfHeights, lateral, 0.0020),
    right: buildSideRibbon(1, centerline, halfHeights, lateral, 0.0020)
  };
}

export function buildLipMeshes() {
  const u = [0.835, 0.865, 0.900, 0.935, 0.965, 0.990, 0.998];
  const lateral = [0.060, 0.058, 0.054, 0.046, 0.034, 0.019, 0.011];
  const upper = [-0.017, -0.011, -0.006, -0.002, 0.001, 0.000, -0.002].map((y, i) => [y, u[i]]);
  const lower = [-0.020, -0.018, -0.014, -0.010, -0.008, -0.009, -0.011].map((y, i) => [y, u[i]]);
  const upperH = [0.0030, 0.0030, 0.0028, 0.0025, 0.0022, 0.0018, 0.0013];
  const lowerH = [0.0034, 0.0033, 0.0030, 0.0027, 0.0024, 0.0020, 0.0014];
  return {
    upperLeft: buildSideRibbon(-1, upper, upperH, lateral, 0.0018),
    upperRight: buildSideRibbon(1, upper, upperH, lateral, 0.0018),
    lowerLeft: buildSideRibbon(-1, lower, lowerH, lateral, 0.0019),
    lowerRight: buildSideRibbon(1, lower, lowerH, lateral, 0.0019)
  };
}

export function buildEyeMeshes() {
  const radii = BLACK_BASS_R1_CARD.eyes.radii;
  return {
    left: buildEllipsoidMesh(BLACK_BASS_R1_CARD.eyes.leftCenter, radii),
    right: buildEllipsoidMesh(BLACK_BASS_R1_CARD.eyes.rightCenter, radii)
  };
}

export function buildBlackBassHeadMouth(options = {}) {
  const cranium = buildCranialMesh(options.cranium ?? {});
  const lowerJaw = buildLowerJawMesh(options.jaw ?? {});
  const mouthCavity = buildMouthCavityMesh(options.cavity ?? {});
  const eyes = buildEyeMeshes();
  const maxillary = buildMaxillaryMeshes();
  const lips = buildLipMeshes();
  return {
    schema: 'kaopu.fish.generated-parts/0.2',
    identity: 'Micropterus_salmoides_FISH_R1_T01',
    sourceMeshRuntimeDependency: false,
    parts: {
      cranium,
      lowerJaw,
      mouthCavity,
      eyeLeft: eyes.left,
      eyeRight: eyes.right,
      maxillaryLeft: maxillary.left,
      maxillaryRight: maxillary.right,
      upperLipLeft: lips.upperLeft,
      upperLipRight: lips.upperRight,
      lowerLipLeft: lips.lowerLeft,
      lowerLipRight: lips.lowerRight
    },
    anchors: {
      eyes: [
        [...BLACK_BASS_R1_CARD.eyes.leftCenter],
        [...BLACK_BASS_R1_CARD.eyes.rightCenter]
      ],
      jawHinge: [...BLACK_BASS_R1_CARD.jaw.hinge],
      maxillaryRear: [...BLACK_BASS_R1_CARD.maxillary.rearAnchor]
    },
    acceptance: { numeric: false, visual: false, user: false }
  };
}
