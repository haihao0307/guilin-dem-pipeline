/**
 * FISH-R1-T01 — source-independent largemouth-bass head/mouth kernel.
 *
 * Coordinate frame:
 *   x: lateral, positive to fish right
 *   y: vertical, positive dorsal/up
 *   u: normalized longitudinal coordinate, tail=0, snout=1
 * All values below are normalized by the observed source body length.
 * The reference GLB is an observation input only; no source vertices,
 * texture pixels, skin tracks or topology are embedded here.
 */

export const BLACK_BASS_R1_CARD = Object.freeze({
  schema: 'kaopu.fish.black-bass.head-mouth/0.1',
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
    observedExtents: Object.freeze([0.0186357513, 0.0464652615, 0.0453004358])
  }),
  jaw: Object.freeze({
    hinge: Object.freeze([0.0, -0.0745099834, 0.8497990694]),
    observedTip: Object.freeze([0.0, -0.0118980916, 1.0]),
    // u, halfWidth, topY, bottomY; low-dimensional envelope only.
    envelope: Object.freeze([
      Object.freeze([0.795462675, 0.056679647, -0.068251508, -0.098388902]),
      Object.freeze([0.823549715, 0.064094626, -0.045697615, -0.095832982]),
      Object.freeze([0.849811098, 0.061875750, -0.025727729, -0.089990877]),
      Object.freeze([0.879723796, 0.058589566, -0.024857031, -0.085974430]),
      Object.freeze([0.907810836, 0.057466085, -0.020166495, -0.077070839]),
      Object.freeze([0.935897876, 0.049601713, -0.021992153, -0.067099939]),
      Object.freeze([0.963984917, 0.040304903, -0.011936992, -0.053646247]),
      Object.freeze([0.986454549, 0.029350957, -0.004072621, -0.036485065]),
      Object.freeze([0.999093717, 0.021739369, -0.004016447, -0.027412951])
    ]),
    safeOpenRangeRad: Object.freeze([0, 0.30])
  }),
  cranialProfile: Object.freeze([
    // u, halfWidth, topY, bottomY. Bottom is a candidate mouth-roof cut in the snout zone.
    Object.freeze([0.669070993, 0.065999865, 0.115898884, -0.091646326]),
    Object.freeze([0.725245074, 0.073976076, 0.115970376, -0.088277827]),
    Object.freeze([0.781419154, 0.071384445, 0.109002197, -0.083921907]),
    Object.freeze([0.837593235, 0.064168475, 0.093899361, -0.086001242]),
    Object.freeze([0.879723796, 0.058365278, 0.067447273, -0.080047750]),
    Object.freeze([0.899384724, 0.056735239, 0.054769728, -0.057578983]),
    Object.freeze([0.921854356, 0.055027258, 0.037287829, -0.039321913]),
    Object.freeze([0.955558805, 0.043773244, 0.022430631, -0.019661209]),
    Object.freeze([0.980837141, 0.032961272, 0.014383206, -0.007021759]),
    Object.freeze([0.999936328, 0.021764471, -0.004430060, -0.015447146])
  ]),
  maxillary: Object.freeze({
    // Qualitative natural constraint: posterior end must be behind the rear eye margin.
    rearAnchor: Object.freeze([0.0562, -0.0379, 0.8265]),
    frontAnchor: Object.freeze([0.0118, -0.0060, 0.9893]),
    evidence: 'engineering candidate constrained by institutional identification guidance; precise allowance not yet a biological measurement'
  }),
  evidenceBoundary: Object.freeze({
    sourceFileFacts: Object.freeze(['body bounds', 'eye volumes', 'jaw_22 bind pivot', 'jaw-weighted low-dimensional envelope']),
    naturalFacts: Object.freeze(['adult largemouth-bass upper jaw extends behind rear eye margin']),
    engineeringCandidates: Object.freeze(['cranial mouth-roof cut', 'maxillary posterior allowance', 'superellipse exponent']),
    visualAcceptance: false,
    productionReady: false
  })
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function rotateAboutHinge(point, hinge, angle) {
  const [x, y, u] = point;
  const [hx, hy, hu] = hinge;
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

/** Build a closed loft from [u, halfWidth, topY, bottomY] stations. */
export function loftProfile(stations, { radialSegments = 32, exponent = 2.25, transformPoint = null } = {}) {
  if (!Array.isArray(stations) || stations.length < 2) throw new Error('stations');
  if (!Number.isInteger(radialSegments) || radialSegments < 8) throw new Error('radialSegments');
  const positions = [];
  const indices = [];
  for (const station of stations) {
    const [u, halfWidth, topY, bottomY] = station;
    if (![u, halfWidth, topY, bottomY].every(Number.isFinite) || halfWidth <= 0 || topY <= bottomY) throw new Error('invalid station');
    for (let k = 0; k < radialSegments; k++) {
      const theta = (2 * Math.PI * k) / radialSegments;
      const [x, y] = superellipsePoint(theta, halfWidth, topY, bottomY, exponent);
      const p = transformPoint ? transformPoint([x, y, u]) : [x, y, u];
      positions.push(...p);
    }
  }
  const ringCount = stations.length;
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
    radialSegments: options.radialSegments ?? 40,
    exponent: options.exponent ?? 2.35
  });
}

export function transformJawPoint(point, mouthOpenRad = 0) {
  const [minOpen, maxOpen] = BLACK_BASS_R1_CARD.jaw.safeOpenRangeRad;
  const angle = clamp(mouthOpenRad, minOpen, maxOpen);
  return rotateAboutHinge(point, BLACK_BASS_R1_CARD.jaw.hinge, angle);
}

export function buildLowerJawMesh({ mouthOpenRad = 0, radialSegments = 36, exponent = 2.2 } = {}) {
  const [minOpen, maxOpen] = BLACK_BASS_R1_CARD.jaw.safeOpenRangeRad;
  const angle = clamp(mouthOpenRad, minOpen, maxOpen);
  const hinge = BLACK_BASS_R1_CARD.jaw.hinge;
  return {
    ...loftProfile(BLACK_BASS_R1_CARD.jaw.envelope, {
      radialSegments,
      exponent,
      transformPoint: point => transformJawPoint(point, angle)
    }),
    mouthOpenRad: angle,
    hinge: [...hinge]
  };
}

export function buildMouthCavityMesh({ radialSegments = 28 } = {}) {
  const stations = [
    [0.889, 0.0449, -0.0225, -0.0463],
    [0.9219, 0.0407, -0.0112, -0.0407],
    [0.9584, 0.0295, -0.0028, -0.0295],
    [0.9893, 0.0118, 0.0006, -0.0140]
  ];
  return loftProfile(stations, { radialSegments, exponent: 2.0 });
}

export function buildBlackBassHeadMouth(options = {}) {
  const cranial = buildCranialMesh(options.cranial ?? {});
  const lowerJaw = buildLowerJawMesh(options.jaw ?? {});
  const mouthCavity = buildMouthCavityMesh(options.cavity ?? {});
  return {
    schema: 'kaopu.fish.generated-parts/0.1',
    identity: 'Micropterus_salmoides_FISH_R1_T01',
    sourceMeshRuntimeDependency: false,
    parts: { cranial, lowerJaw, mouthCavity },
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
