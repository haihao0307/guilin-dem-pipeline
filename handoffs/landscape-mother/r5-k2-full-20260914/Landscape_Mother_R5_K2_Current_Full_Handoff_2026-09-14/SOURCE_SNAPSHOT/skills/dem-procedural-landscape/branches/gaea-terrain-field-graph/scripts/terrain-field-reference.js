/*
 * GAEA-inspired terrain field reference kernel
 * Version 1.0.0
 * No external dependencies.
 * Teaching and integration reference. It never replaces DEM truth.
 */
'use strict';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / Math.max(b - a, 1e-9));
  return t * t * (3 - 2 * t);
};

function hash32(n) {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}

function hash2(x, y, seed) {
  const n = hash32(
    Math.imul(x | 0, 0x1f123bb5) ^
    Math.imul(y | 0, 0x5f356495) ^
    (seed >>> 0)
  );
  return n / 4294967295;
}

function valueNoise2(x, y, seed = 1) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = x - xi;
  const ty = y - yi;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

function fbm2(x, y, seed = 1, octaves = 5, lacunarity = 2.03, gain = 0.5) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, y * freq, seed + i * 1013) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / Math.max(norm, 1e-9);
}

function ridged2(x, y, seed = 1, octaves = 5) {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise2(x * freq, y * freq, seed + i * 809) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    amp *= 0.48;
    freq *= 2.11;
  }
  return sum / Math.max(norm, 1e-9);
}

function deriveSeeds(master = 1) {
  const base = Math.max(1, Math.round(master)) >>> 0;
  const derive = (salt) => hash32(base ^ salt) || salt;
  return Object.freeze({
    master: base,
    shape: derive(101),
    warp: derive(211),
    geology: derive(307),
    erosion: derive(401),
    hydrologyVisual: derive(503),
    color: derive(601),
    microDetail: derive(701),
    ecology: derive(809)
  });
}

function domainWarp2(x, y, seed, strength = 0.25, scale = 0.7) {
  const wx = fbm2(x * scale, y * scale, seed + 17, 3) - 0.5;
  const wy = fbm2((x + 37.1) * scale, (y - 19.7) * scale, seed + 31, 3) - 0.5;
  return [x + wx * strength, y + wy * strength];
}

function autoLevel(v, low = 0.15, high = 0.85) {
  return clamp((v - low) / Math.max(high - low, 1e-9));
}

function clarity(v, amount = 1) {
  const t = clamp(v);
  const local = t * t * (3 - 2 * t);
  return clamp(t + (t - local) * amount * 1.35);
}

function combine(a, b, mode = 'blend', ratio = 0.5) {
  const t = clamp(ratio);
  switch (mode) {
    case 'add': return clamp(a + b * t);
    case 'subtract': return clamp(a - b * t);
    case 'multiply': return clamp(lerp(a, a * b, t));
    case 'max': return lerp(a, Math.max(a, b), t);
    case 'min': return lerp(a, Math.min(a, b), t);
    case 'screen': return lerp(a, 1 - (1 - a) * (1 - b), t);
    case 'difference': return lerp(a, Math.abs(a - b), t);
    default: return lerp(a, b, t);
  }
}

function separationMask(a, b, sharpness = 1) {
  return smoothstep(
    0.02,
    0.38 / Math.max(sharpness, 0.1),
    Math.abs(a - b)
  );
}

function clut5(t, colors) {
  if (!Array.isArray(colors) || colors.length !== 5) {
    throw new Error('clut5 requires five RGB colors');
  }
  const x = clamp(t) * 4;
  const i = Math.min(3, Math.floor(x));
  const f = x - i;
  return [
    lerp(colors[i][0], colors[i + 1][0], f),
    lerp(colors[i][1], colors[i + 1][1], f),
    lerp(colors[i][2], colors[i + 1][2], f)
  ];
}

function normalizedSplat(masks, sharpness = 2.5) {
  const weights = masks.map((v) => Math.pow(Math.max(v, 1e-6), sharpness));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((v) => v / total);
}

function sampleSlopeCurvature(sampleHeight, x, y, step) {
  const c = sampleHeight(x, y);
  const l = sampleHeight(x - step, y);
  const r = sampleHeight(x + step, y);
  const d = sampleHeight(x, y - step);
  const u = sampleHeight(x, y + step);
  const dx = (r - l) / (2 * step);
  const dy = (u - d) / (2 * step);
  const slope = Math.atan(Math.hypot(dx, dy));
  const curvature = (l + r + d + u - 4 * c) / (step * step);
  return { slope, curvature };
}

function boundedRenderHeight(
  zTruth,
  deltaRaw,
  confidence,
  protectedMask,
  budgetDown,
  budgetUp
) {
  const allowed = clamp(confidence) * (1 - clamp(protectedMask));
  const delta = clamp(deltaRaw, -Math.abs(budgetDown), Math.abs(budgetUp));
  return zTruth + delta * allowed;
}

function evaluateVisualFields(worldX, worldY, seedBank, settings = {}) {
  const scale = settings.worldScale ?? 0.001;
  const x = worldX * scale;
  const y = worldY * scale;
  const [qx, qy] = domainWarp2(
    x,
    y,
    seedBank.warp,
    settings.warpStrength ?? 0.28,
    0.72
  );

  const ruggedA = ridged2(qx * 3.2, qy * 3.2, seedBank.geology, 5);
  const ruggedB = ridged2(qx * 1.65, qy * 1.65, seedBank.geology + 37, 4);
  const rugged = clarity(ruggedA * 0.68 + ruggedB * 0.32, 0.7);

  const strataPhase =
    (qy + qx * (settings.strataTilt ?? 0.16)) *
    (settings.strataFrequency ?? 5.2) *
    Math.PI * 2;
  const strataGate = autoLevel(
    fbm2(qx * 2.2, qy * 2.2, seedBank.geology + 101, 3),
    0.28,
    0.82
  );
  const strata = smoothstep(
    0.52,
    0.92,
    (1 - Math.abs(Math.sin(strataPhase))) * strataGate
  );

  const microBase = ridged2(
    qx * 18,
    qy * 18,
    seedBank.microDetail,
    3
  );
  const microGate = autoLevel(
    fbm2(qx * 5.4, qy * 5.4, seedBank.erosion, 3),
    0.42,
    0.88
  );
  const microErosion = smoothstep(0.62, 0.94, microBase) * microGate;

  const rockPatch = autoLevel(
    fbm2(qx * 2.6, qy * 2.6, seedBank.geology + 211, 4),
    0.30,
    0.80
  );
  const cavity = clamp(
    microErosion * 0.45 +
    (1 - rugged) * 0.30 +
    (1 - rockPatch) * 0.20
  );
  const protrusion = clamp(
    rugged * 0.62 +
    strata * 0.16 +
    rockPatch * 0.22
  );
  const separation = separationMask(rugged, rockPatch, 1.1);

  // Visual runoff proxy only. Real hydrology must come from DEM processing.
  const visualFlow = smoothstep(
    0.56,
    0.86,
    fbm2(qx * 2.1, qy * 0.65, seedBank.hydrologyVisual, 4)
  ) * cavity;

  const rockMap = clamp(
    rugged * 0.48 +
    protrusion * 0.28 +
    separation * 0.24
  );
  const wetness = clamp(visualFlow * 0.58 + cavity * 0.42);
  const soil = clamp(
    (1 - rockMap) * 0.62 +
    (1 - protrusion) * 0.18 +
    wetness * 0.20
  );
  const exposure = clamp(
    protrusion * 0.55 +
    separation * 0.20 +
    (1 - wetness) * 0.25
  );

  return {
    rugged,
    strata,
    microErosion,
    rockMap,
    visualFlow,
    cavity,
    protrusion,
    separation,
    wetness,
    soil,
    exposure
  };
}

function shadeTerrainColor(fields, palette) {
  const masks = [
    fields.rockMap,
    fields.wetness,
    fields.soil,
    fields.exposure
  ];
  const weights = normalizedSplat(
    masks,
    palette.sharpness ?? 2.5
  );
  const colors = [
    palette.rock,
    palette.wet,
    palette.soil,
    palette.exposed
  ];
  return colors[0].map((_, channel) =>
    weights.reduce(
      (sum, weight, index) =>
        sum + weight * colors[index][channel],
      0
    )
  );
}

const api = {
  clamp,
  lerp,
  smoothstep,
  valueNoise2,
  fbm2,
  ridged2,
  deriveSeeds,
  domainWarp2,
  autoLevel,
  clarity,
  combine,
  separationMask,
  clut5,
  normalizedSplat,
  sampleSlopeCurvature,
  boundedRenderHeight,
  evaluateVisualFields,
  shadeTerrainColor
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.TerrainFieldReference = api;
}
