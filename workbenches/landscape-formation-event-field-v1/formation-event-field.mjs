const TAU = Math.PI * 2;

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / Math.max(1e-9, b - a));
  return t * t * (3 - 2 * t);
};
export const mix = (a, b, t) => a + (b - a) * t;

function hashInt(n) {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}

function hash2(ix, iz, seed = 1) {
  const h = hashInt(Math.imul(ix | 0, 0x1f123bb5) ^ Math.imul(iz | 0, 0x05491333) ^ (seed | 0));
  return h / 0xffffffff;
}

function valueNoise2(x, z, seed = 1) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx0 = x - ix, fz0 = z - iz;
  const fx = fx0 * fx0 * (3 - 2 * fx0);
  const fz = fz0 * fz0 * (3 - 2 * fz0);
  const a = mix(hash2(ix, iz, seed), hash2(ix + 1, iz, seed), fx);
  const b = mix(hash2(ix, iz + 1, seed), hash2(ix + 1, iz + 1, seed), fx);
  return mix(a, b, fz);
}

export function fbm2(x, z, seed = 1, octaves = 5) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x, z, seed + i * 1013);
    norm += amp;
    x = x * 2.031 + 17.17;
    z = z * 2.017 - 9.31;
    amp *= 0.5;
  }
  return sum / Math.max(norm, 1e-9);
}

export function ridgedFbm2(x, z, seed = 1, octaves = 5) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise2(x, z, seed + i * 1619) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    x = x * 2.043 - 11.7;
    z = z * 2.027 + 6.3;
    amp *= 0.52;
  }
  return sum / Math.max(norm, 1e-9);
}

export function turbulence2(x, z, seed = 1, octaves = 5) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = Math.abs(valueNoise2(x, z, seed + i * 1877) * 2 - 1);
    sum += amp * n;
    norm += amp;
    x = x * 2.019 + 3.9;
    z = z * 2.061 - 12.1;
    amp *= 0.5;
  }
  return sum / Math.max(norm, 1e-9);
}

export function worley2(x, z, seed = 1) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let f1 = Infinity, f2 = Infinity;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cz = iz + dz;
      const px = cx + hash2(cx, cz, seed);
      const pz = cz + hash2(cx, cz, seed + 7919);
      const d = Math.hypot(px - x, pz - z);
      if (d < f1) { f2 = f1; f1 = d; }
      else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, edge: f2 - f1 };
}

export function domainWarp2(x, z, seed = 1, scale = 0.012, strength = 18) {
  const a = fbm2(x * scale + 7.1, z * scale - 3.3, seed + 17, 4) - 0.5;
  const b = fbm2(x * scale - 11.7, z * scale + 9.2, seed + 31, 4) - 0.5;
  const c = fbm2(x * scale * 0.47 + 4.3, z * scale * 0.53 - 8.1, seed + 47, 3) - 0.5;
  return {
    x: x + strength * (0.84 * a + 0.26 * b * c),
    z: z + strength * (0.82 * b - 0.22 * a * c),
    magnitude: strength * Math.hypot(0.84 * a + 0.26 * b * c, 0.82 * b - 0.22 * a * c),
  };
}

// Integer harmonics guarantee theta=0 and theta=2π evaluate identically.
export function periodicAngularField(theta, y, seed = 1) {
  const p = (seed % 997) * 0.001;
  return 0.46 * Math.sin(theta * 2 + y * 0.071 + p)
    + 0.31 * Math.cos(theta * 5 - y * 0.043 + p * 2.1)
    + 0.23 * Math.sin(theta * 9 + y * 0.019 - p * 1.7);
}

export const DEFAULT_FORMATION_CONTROLS = Object.freeze({
  warpScale: 0.012,
  warpStrengthM: 18,
  fractureScale: 0.035,
  fractureStrength: 1,
  cavityScale: 0.018,
  cavityStrength: 1,
  sinkholeStrength: 0.75,
  collapseStrength: 0.9,
  flowStrength: 1,
  oxidationStrength: 1,
  geometryAmplitudeM: 6,
  detailAmplitudeM: 1.2,
});

export function evaluateFormationEventField(sample, controls = {}) {
  const c = { ...DEFAULT_FORMATION_CONTROLS, ...controls };
  const {
    x = 0,
    z = 0,
    baseHeight = 0,
    slope = 0,
    curvature = 0,
    drainage = 0,
    cliff = 0,
    lithology = 1,
    exposure = 0.5,
    protectedTruthMask = 0,
    neutralGeometry = false,
    seed = 83,
  } = sample;

  const warp = domainWarp2(x, z, seed, c.warpScale, c.warpStrengthM);
  const wx = warp.x, wz = warp.z;
  const slopeGate = smoothstep(0.22, 0.72, slope);
  const cliffGate = clamp01(0.72 * cliff + 0.45 * slopeGate);
  const limestone = clamp01(lithology);
  const concave = smoothstep(0.02, 0.55, -curvature);
  const convex = smoothstep(0.04, 0.58, curvature);

  const ridge = ridgedFbm2(wx * c.fractureScale, wz * c.fractureScale, seed + 101, 5);
  const turb = turbulence2(wx * c.fractureScale * 0.67, wz * c.fractureScale * 0.71, seed + 113, 4);
  const theta = Math.atan2(wz, wx);
  const angular = periodicAngularField(theta, baseHeight, seed + 127) * 0.5 + 0.5;
  const fracture = clamp01(
    smoothstep(0.67, 0.94, ridge * 0.58 + turb * 0.20 + angular * 0.22)
    * (0.32 + 0.68 * cliffGate)
    * c.fractureStrength
  );

  const cells = worley2(wx * c.cavityScale, wz * c.cavityScale, seed + 211);
  const cellPocket = 1 - smoothstep(0.16, 0.48, cells.f1);
  const cellEdge = 1 - smoothstep(0.018, 0.16, cells.edge);
  const cavityCandidate = clamp01(cellPocket * 0.56 + cellEdge * 0.17 + fracture * 0.42 + concave * 0.22);
  const cavity = clamp01(
    smoothstep(0.48, 0.86, cavityCandidate)
    * cliffGate * limestone * c.cavityStrength
  );

  const lowWarp = domainWarp2(x, z, seed + 271, c.warpScale * 0.28, c.warpStrengthM * 0.44);
  const sinkField = fbm2(lowWarp.x * 0.0065, lowWarp.z * 0.0065, seed + 277, 5);
  const lowSlope = 1 - smoothstep(0.17, 0.45, slope);
  const sinkhole = clamp01(
    smoothstep(0.64, 0.87, sinkField * 0.64 + concave * 0.36)
    * lowSlope * limestone * (0.35 + 0.65 * drainage)
    * c.sinkholeStrength
  );

  const collapse = clamp01(
    smoothstep(0.30, 0.78, cavity * 0.60 + fracture * 0.26 + convex * 0.23)
    * (0.38 + 0.62 * cliffGate)
    * c.collapseStrength
  );

  const flowField = fbm2(wx * 0.014 + baseHeight * 0.006, wz * 0.014, seed + 307, 4);
  const wetFlow = clamp01(
    (0.58 * drainage + 0.24 * concave + 0.18 * flowField)
    * (0.46 + 0.54 * c.flowStrength)
  );
  const deposition = clamp01((wetFlow * 0.62 + (1 - slopeGate) * 0.38) * (0.4 + 0.6 * drainage));
  const rockExposure = clamp01(exposure * (0.42 + 0.58 * slopeGate) * (1 - wetFlow * 0.28));
  const oxidation = clamp01(
    (0.48 * rockExposure + 0.24 * convex + 0.28 * fbm2(wx * 0.022, wz * 0.022, seed + 401, 4))
    * (1 - wetFlow * 0.48) * c.oxidationStrength
  );

  const microscope = (fbm2(wx * 0.11, wz * 0.11, seed + 503, 5) - 0.5) * 2;
  const eventCut = cavity * 1.15 + collapse * 0.92 + fracture * 0.34 + sinkhole * 1.28;
  const eventLift = rockExposure * ridge * 0.22;
  let heightDelta = c.geometryAmplitudeM * (eventLift - eventCut)
    + c.detailAmplitudeM * microscope * (0.28 + 0.72 * rockExposure);
  if (neutralGeometry || protectedTruthMask > 0.5) heightDelta = 0;

  const cavityDark = clamp01(cavity * 0.75 + fracture * 0.18 + wetFlow * 0.28);
  const paleDeposit = clamp01(deposition * 0.52 + (1 - oxidation) * rockExposure * 0.18);
  const roughness = clamp01(0.54 + fracture * 0.21 + collapse * 0.14 + microscope * 0.05 - wetFlow * 0.17);
  const ao = clamp01(0.15 + cavityDark * 0.72 + concave * 0.13);

  return {
    warpedX: wx,
    warpedZ: wz,
    warpMagnitudeM: warp.magnitude,
    fracture,
    cavity,
    sinkhole,
    collapse,
    wetFlow,
    deposition,
    rockExposure,
    oxidation,
    microscope,
    heightDelta,
    material: {
      cavityDark,
      paleDeposit,
      roughness,
      ao,
      wetness: wetFlow,
      oxidation,
    },
  };
}

export function evaluateGrid({ size = 65, spanM = 320, seed = 83, controls = {}, neutralGeometry = false } = {}) {
  const values = new Float32Array(size * size * 8);
  let maxAbsDelta = 0, eventPixels = 0;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i / (size - 1) - 0.5) * spanM;
      const z = (j / (size - 1) - 0.5) * spanM;
      const r = Math.hypot(x, z);
      const baseHeight = 72 * Math.exp(-Math.pow(r / 86, 2)) + 31 * Math.exp(-Math.pow(Math.hypot(x - 78, z + 54) / 48, 2));
      const slope = clamp01(r / 105);
      const curvature = 0.4 * Math.cos(r * 0.045) - 0.12;
      const drainage = clamp01(1 - Math.abs(x + 0.34 * z) / 120);
      const cliff = smoothstep(0.38, 0.82, slope);
      const v = evaluateFormationEventField({ x, z, baseHeight, slope, curvature, drainage, cliff, lithology: 1, exposure: 0.72, neutralGeometry, seed }, controls);
      const k = (j * size + i) * 8;
      values[k] = baseHeight;
      values[k + 1] = v.heightDelta;
      values[k + 2] = v.fracture;
      values[k + 3] = v.cavity;
      values[k + 4] = v.collapse;
      values[k + 5] = v.wetFlow;
      values[k + 6] = v.oxidation;
      values[k + 7] = v.material.roughness;
      maxAbsDelta = Math.max(maxAbsDelta, Math.abs(v.heightDelta));
      if (v.fracture + v.cavity + v.collapse > 0.2) eventPixels++;
    }
  }
  return { size, spanM, values, maxAbsDelta, eventPixels };
}

export const FormationEventFieldV1 = Object.freeze({
  version: '1.0.0-candidate',
  fields: ['fracture', 'cavity', 'sinkhole', 'collapse', 'wetFlow', 'deposition', 'rockExposure', 'oxidation'],
  geometryChannels: ['heightDelta'],
  materialChannels: ['cavityDark', 'paleDeposit', 'roughness', 'ao', 'wetness', 'oxidation'],
  periodicMapping: 'integer-harmonic',
  truthProtection: 'exact-height-delta-zero-when-protected',
});
