'use strict';

/* Stone Money Island shoreline core R01.
 * Deterministic source-independent beach/lagoon geometry for the first wake-up-bay cell.
 * Candidate dimensions are explicit; this is not a measured Palau reconstruction.
 * Positive signed distance is landward. Elevation is metres relative to mean shoreline datum.
 */

const VERSION = 'smi-shoreline-core/0.1';
const EPS = 1e-9;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Candidate reef-protected cross-shore control points.
// They are deliberately gentle and monotone from reef-flat water to upper dry sand.
const PROFILE = Object.freeze([
  Object.freeze({ d: -24, y: -1.15 }),
  Object.freeze({ d: -16, y: -0.92 }),
  Object.freeze({ d: -8,  y: -0.55 }),
  Object.freeze({ d: -3,  y: -0.24 }),
  Object.freeze({ d:  0,  y:  0.00 }),
  Object.freeze({ d:  4,  y:  0.24 }),
  Object.freeze({ d: 10,  y:  0.58 }),
  Object.freeze({ d: 18,  y:  1.02 }),
  Object.freeze({ d: 24,  y:  1.30 }),
]);

function pchipSlopes(points) {
  const n = points.length;
  const h = new Array(n - 1);
  const delta = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = points[i + 1].d - points[i].d;
    delta[i] = (points[i + 1].y - points[i].y) / h[i];
    if (!(h[i] > 0) || !(delta[i] >= 0)) throw new Error('profile must be strictly ordered and monotone');
  }
  const m = new Array(n).fill(0);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] <= EPS || delta[i] <= EPS) {
      m[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    }
  }
  return Object.freeze(m);
}

const SLOPES = pchipSlopes(PROFILE);

function profileElevation(distance) {
  if (!Number.isFinite(distance)) throw new TypeError('finite signed distance required');
  if (distance <= PROFILE[0].d) return PROFILE[0].y + SLOPES[0] * (distance - PROFILE[0].d);
  if (distance >= PROFILE[PROFILE.length - 1].d) {
    const i = PROFILE.length - 1;
    return PROFILE[i].y + SLOPES[i] * (distance - PROFILE[i].d);
  }
  let i = 0;
  while (i + 1 < PROFILE.length && distance > PROFILE[i + 1].d) i++;
  const a = PROFILE[i], b = PROFILE[i + 1], h = b.d - a.d, t = (distance - a.d) / h;
  const h00 = (2 * t ** 3 - 3 * t ** 2 + 1);
  const h10 = (t ** 3 - 2 * t ** 2 + t);
  const h01 = (-2 * t ** 3 + 3 * t ** 2);
  const h11 = (t ** 3 - t ** 2);
  return h00 * a.y + h10 * h * SLOPES[i] + h01 * b.y + h11 * h * SLOPES[i + 1];
}

function profileSlope(distance) {
  const e = 1e-3;
  return (profileElevation(distance + e) - profileElevation(distance - e)) / (2 * e);
}

function createShoreline(options = {}) {
  const origin = options.origin || [9, 0];
  const outwardNormal = options.outwardNormal || [-1, 0];
  const nLen = Math.hypot(outwardNormal[0], outwardNormal[1]);
  if (!Array.isArray(origin) || origin.length !== 2 || !origin.every(Number.isFinite)) throw new TypeError('finite vec2 origin required');
  if (!Array.isArray(outwardNormal) || outwardNormal.length !== 2 || !outwardNormal.every(Number.isFinite) || nLen <= EPS) throw new TypeError('finite non-zero vec2 normal required');
  const outward = [outwardNormal[0] / nLen, outwardNormal[1] / nLen];
  const landward = [-outward[0], -outward[1]];
  const tangent = [-outward[1], outward[0]];
  const seaLevel = Number.isFinite(options.seaLevel) ? options.seaLevel : 0;

  function signedDistance(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new TypeError('finite x/z required');
    return (x - origin[0]) * landward[0] + (z - origin[1]) * landward[1];
  }

  function shoreAt(x, z) {
    const d = signedDistance(x, z);
    return {
      signedDistance: d,
      tangent: [...tangent],
      outwardNormal: [...outward],
      exposure: 'reef_protected_lagoon',
      beachSlope: profileSlope(d),
      elevation: seaLevel + profileElevation(d),
    };
  }

  function substrateAt(x, z) {
    const d = signedDistance(x, z);
    let materialClass, porosity, roughness, erodibility;
    if (d < -17) { materialClass = 'reef_flat_candidate'; porosity = 0.18; roughness = 0.72; erodibility = 0.05; }
    else if (d < -7) { materialClass = 'sand_rubble_candidate'; porosity = 0.30; roughness = 0.48; erodibility = 0.20; }
    else if (d < 5) { materialClass = 'white_sand_candidate'; porosity = 0.38; roughness = 0.24; erodibility = 0.56; }
    else { materialClass = 'upper_white_sand_candidate'; porosity = 0.40; roughness = 0.28; erodibility = 0.44; }
    return { elevation: seaLevel + profileElevation(d), materialClass, porosity, roughness, erodibility };
  }

  function wetnessAt(x, z, state = {}) {
    const d = signedDistance(x, z);
    const now = Number.isFinite(state.worldTime) ? state.worldTime : 0;
    const last = Number.isFinite(state.lastInundationTime) ? state.lastInundationTime : -Infinity;
    const age = Math.max(0, now - last);
    const recent = Number.isFinite(age) ? Math.exp(-age / 42) : 0;
    const tidalBias = clamp(1 - Math.max(0, d) / 5.5, 0, 1);
    const waterContent = clamp(Math.max(recent, tidalBias * 0.52), 0, 1);
    return { waterContent, lastInundationTime: last, dryingRate: 1 / 42, opticalDarkening: 0.34 * waterContent };
  }

  function landingAt(x, z) {
    const shore = shoreAt(x, z);
    const substrate = substrateAt(x, z);
    const safe = shore.signedDistance >= -1.2 && shore.signedDistance <= 4.8 && substrate.materialClass === 'white_sand_candidate';
    return { safe, signedDistance: shore.signedDistance, elevation: substrate.elevation, materialClass: substrate.materialClass };
  }

  return { version: VERSION, origin: [...origin], seaLevel, shoreAt, substrateAt, wetnessAt, landingAt, profileElevation, profileSlope };
}

module.exports = { VERSION, PROFILE, profileElevation, profileSlope, createShoreline };
