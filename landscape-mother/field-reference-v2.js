(() => {
'use strict';

/*
 * Landscape Mother V2 runtime adaptation of the user-provided
 * PROCEDURAL_FIELD_KNOWLEDGE_MINI_V1.0_2026-08-30/field_reference.js.
 * The preserved source remains under knowledge/terrain-hydrology/shared/inbox.
 */

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function smoothstep(a, b, v) {
  const t = clamp((v - a) / Math.max(b - a, 1e-9));
  return t * t * (3 - 2 * t);
}

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
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise2(x * frequency, y * frequency, seed + i * 1013) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / Math.max(norm, 1e-9);
}

function ridged2(x, y, seed = 1, octaves = 5) {
  let sum = 0;
  let amplitude = 0.55;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    const n = 1 - Math.abs(valueNoise2(x * frequency, y * frequency, seed + i * 809) * 2 - 1);
    sum += n * n * amplitude;
    norm += amplitude;
    amplitude *= 0.48;
    frequency *= 2.11;
  }
  return sum / Math.max(norm, 1e-9);
}

function deriveSeeds(master = 1) {
  const base = Math.max(1, Math.round(master)) >>> 0;
  const derive = salt => hash32(base ^ salt) || salt;
  return Object.freeze({
    master: base,
    shape: derive(101),
    warp: derive(211),
    structure: derive(307),
    damage: derive(401),
    color: derive(503),
    weather: derive(601),
    micro: derive(701),
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
  return smoothstep(0.02, 0.38 / Math.max(sharpness, 0.1), Math.abs(a - b));
}

function clut5(t, colors) {
  if (!Array.isArray(colors) || colors.length !== 5) throw new Error('clut5 requires five RGB colors');
  const x = clamp(t) * 4;
  const i = Math.min(3, Math.floor(x));
  const f = x - i;
  return [
    lerp(colors[i][0], colors[i + 1][0], f),
    lerp(colors[i][1], colors[i + 1][1], f),
    lerp(colors[i][2], colors[i + 1][2], f),
  ];
}

function normalizedSplat(masks, sharpness = 2.5) {
  const raw = masks.map(v => Math.pow(Math.max(v, 1e-6), sharpness));
  const total = raw.reduce((sum, v) => sum + v, 0) || 1;
  return raw.map(v => v / total);
}

function evaluateFields(worldX, worldY, seedBank, settings = {}) {
  const scale = settings.worldScale ?? 0.001;
  const x = worldX * scale;
  const y = worldY * scale;
  const [qx, qy] = domainWarp2(
    x, y, seedBank.warp,
    settings.warpStrength ?? 0.28,
    settings.warpScale ?? 0.72,
  );
  const macro = fbm2(qx * 1.2, qy * 1.2, seedBank.shape, 4);
  const structureA = ridged2(qx * 3.2, qy * 3.2, seedBank.structure, 5);
  const structureB = ridged2(qx * 1.65, qy * 1.65, seedBank.structure + 37, 4);
  const structure = clarity(structureA * 0.68 + structureB * 0.32, 0.7);
  const micro = ridged2(qx * 18, qy * 18, seedBank.micro, 3);
  const weather = autoLevel(
    fbm2(qx * 2.1, qy * 0.65, seedBank.weather, 4),
    0.34, 0.84,
  );
  const cavity = clamp((1 - structure) * 0.45 + micro * 0.25);
  const protrusion = clamp(structure * 0.72 + macro * 0.28);
  const separation = separationMask(structure, macro, 1.1);
  const colorDriver = clarity(
    autoLevel(
      macro * 0.34 +
      structure * 0.28 +
      cavity * 0.14 +
      weather * 0.14 +
      separation * 0.10,
      0.18, 0.84,
    ),
    settings.colorClarity ?? 0.8,
  );
  return { macro, structure, micro, weather, cavity, protrusion, separation, colorDriver };
}

window.ProceduralFieldReference = Object.freeze({
  clamp, lerp, smoothstep, hash32, hash2, valueNoise2, fbm2, ridged2, deriveSeeds,
  domainWarp2, autoLevel, clarity, combine, separationMask, clut5,
  normalizedSplat, evaluateFields,
});
})();
