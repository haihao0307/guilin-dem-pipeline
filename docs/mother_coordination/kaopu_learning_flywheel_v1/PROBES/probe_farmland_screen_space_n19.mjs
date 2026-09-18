import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.KAOPU_FARMLAND_R27_ROOT;
if (!root) throw new Error('KAOPU_FARMLAND_R27_ROOT is required');

const round27 = path.join(root, 'farmland-object-dna/research/r045-autonomous-rebuild/round-27');
const round26 = path.join(root, 'farmland-object-dna/research/r045-autonomous-rebuild/round-26');
const K = await import(pathToFileURL(path.join(round27, 'r045_round27_kernel.mjs')));
const B = await import(pathToFileURL(path.join(round26, 'r045_round26_kernel.mjs')));
const audit = fs.readFileSync(path.join(round27, 'r045_round27_audit.html'), 'utf8');

const cameraLiteral = 'camera([322,154,360],[0,18,-52],770)';
const canvasLiteral = 'can.width=650;can.height=650';
const gridLiteral = 'nx=52,nz=62';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
const camera = (pos, target, f) => { const fw = norm(sub(target, pos)); const rt = norm(cross(fw, [0, 1, 0])); const up = norm(cross(rt, fw)); return { pos, fw, rt, up, f }; };
const project = (P, C, w, h) => { const v = sub(P, C.pos); const d = dot(v, C.fw); if (d <= 1) return null; return [w / 2 + dot(v, C.rt) * C.f / d, h / 2 - dot(v, C.up) * C.f / d, d]; };
const CAM = camera([322, 154, 360], [0, 18, -52], 770);
const LIGHT = norm([-.48, .78, -.39]);
const W = 650, H = 650;

function percentile(values, p) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  const q = (a.length - 1) * p;
  const lo = Math.floor(q), hi = Math.ceil(q), t = q - lo;
  return a[lo] * (1 - t) + a[hi] * t;
}

function distribution(values) {
  return {
    count: values.length,
    min: values.length ? Math.min(...values) : null,
    p50: percentile(values, .5),
    p95: percentile(values, .95),
    max: values.length ? Math.max(...values) : null,
    mean: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
  };
}

function fractions(values, limits) {
  return Object.fromEntries(limits.map(limit => [String(limit), values.filter(v => v < limit).length / (values.length || 1)]));
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; s /= 100; l /= 100;
  if (s === 0) return [l, l, l];
  const hue = (p, q, t0) => { let t = t0; if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)];
}

function styleAt(M, x, z) {
  const y = M.height(x, z), gr = M.gradient(x, z), n = norm([-gr.dx, 1, -gr.dz]);
  const illum = clamp(.5 + .5 * dot(n, LIGHT), 0, 1);
  const elev = clamp((y + 4) / 95, 0, 1), hue = 94 - elev * 39, sat = 29 + elev * 9;
  const lit = clamp(24 + elev * 20 + illum * 23, 23, 69);
  return { y, gr, n, illum, hsl: [hue, sat, lit], rgb: hslToRgb(hue, sat, lit) };
}

function screenDelta(x, z, scale = 1) {
  const y0 = B.height(x, z), d = K.transitionDelta(x, z);
  const p0 = project([x, y0, z], CAM, W, H), p1 = project([x, y0 + scale * d, z], CAM, W, H);
  return { d, pixels: Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) };
}

const vertexPixels = [], vertexDeltas = [], vertexAmplified = [];
const x0 = -230, x1 = 230, z0 = -315, z1 = 205, nx = 52, nz = 62;
const dx = (x1 - x0) / nx, dz = (z1 - z0) / nz;
for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
  const x = x0 + i * dx, z = z0 + j * dz, q = screenDelta(x, z);
  if (Math.abs(q.d) > .003) {
    vertexPixels.push(q.pixels); vertexDeltas.push(Math.abs(q.d)); vertexAmplified.push(screenDelta(x, z, 10).pixels);
  }
}

const densePixels = [], denseDeltas = [];
for (let x = -230; x <= 230; x += 6) for (let z = -30; z <= 82; z += 4) {
  const q = screenDelta(x, z);
  if (Math.abs(q.d) > .003) { densePixels.push(q.pixels); denseDeltas.push(Math.abs(q.d)); }
}

const cellAngles = [], cellIllum = [], cellRgb = [], cellAreas = [];
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const xa = x0 + i * dx, za = z0 + j * dz, xb = xa + dx, zb = za + dz;
  const x = (xa + xb) / 2, z = (za + zb) / 2;
  if (Math.abs(K.transitionDelta(x, z)) <= .003) continue;
  const a = styleAt(B, x, z), b = styleAt(K, x, z);
  cellAngles.push(Math.acos(clamp(dot(a.n, b.n), -1, 1)) * 180 / Math.PI);
  cellIllum.push(Math.abs(b.illum - a.illum));
  cellRgb.push(Math.hypot(...b.rgb.map((v, k) => (v - a.rgb[k]) * 255)));
  const corners = [[xa, B.height(xa, za), za], [xb, B.height(xb, za), za], [xb, B.height(xb, zb), zb], [xa, B.height(xa, zb), zb]].map(P => project(P, CAM, W, H));
  let area = 0; for (let k = 0; k < 4; k++) area += corners[k][0] * corners[(k + 1) % 4][1] - corners[(k + 1) % 4][0] * corners[k][1];
  cellAreas.push(Math.abs(area) / 2);
}

const amplificationRatios = vertexPixels.map((v, i) => vertexAmplified[i] / (v || 1));
const checks = [];
const add = (name, pass, value, limit) => checks.push({ name, pass: Boolean(pass), value, limit });
add('fixed_source_version', K.VERSION === 'R045.27' && B.VERSION === 'R045.26', { before: B.VERSION, after: K.VERSION }, 'R045.26 -> R045.27');
add('audit_camera_literal_locked', audit.includes(cameraLiteral), cameraLiteral, 'exact audit camera literal present');
add('audit_canvas_locked', audit.includes(canvasLiteral), canvasLiteral, '650 x 650 internal canvas');
add('audit_mesh_grid_locked', audit.includes(gridLiteral), gridLiteral, '52 x 62 cells');
add('visual_acceptance_remains_false', K.snapshot.visualAcceptance === false, K.snapshot.visualAcceptance, false);
add('active_render_vertices_exist', vertexPixels.length > 50, vertexPixels.length, '>50 vertices with |delta| > 0.003 m');
add('render_vertex_motion_is_subpixel', Math.max(...vertexPixels) < .5, distribution(vertexPixels), 'all active fixed-view mesh vertices move <0.5 px');
add('dense_peak_motion_is_subpixel', Math.max(...densePixels) < .5, distribution(densePixels), 'all dense support samples move <0.5 px');
add('most_active_vertices_move_under_tenth_pixel', fractions(vertexPixels, [.1])['0.1'] > .9, fractions(vertexPixels, [.1]), '>90% move <0.1 px');
add('tenfold_amplitude_control_is_live', percentile(amplificationRatios, .5) > 9.9 && percentile(amplificationRatios, .5) < 10.1, distribution(amplificationRatios), 'median projection response approximately 10x');
add('normal_response_exists', Math.max(...cellAngles) > .01, distribution(cellAngles), 'non-zero fixed-grid normal change');
add('renderer_style_response_exists', Math.max(...cellRgb) > .01, distribution(cellRgb), 'non-zero per-cell HSL/RGB style change');
add('plan_diagnostic_normalizes_amplitude', audit.includes('Math.abs(d)/(mx||1)') && audit.includes('.08+.72*a'), true, 'plan panel divides by this round maximum before coloring');

const result = {
  schema: 'kaopu.probe.farmland-screen-space-n19/1',
  source: {
    repository: 'haihao0307/guilin-dem-pipeline',
    commit: '4b53e5e84b8973884827ed81abad0c0f16148b14',
    implementationCommit: '8c57582b58b9c1b0eee2ee9c5bacdbe35cb441b5',
    camera: { position: [322, 154, 360], target: [0, 18, -52], focalPixels: 770, canvas: [650, 650] },
    mesh: { cells: [52, 62], worldStepMeters: [dx, dz] }
  },
  passed: checks.every(c => c.pass),
  gateCount: checks.length,
  passedCount: checks.filter(c => c.pass).length,
  checks,
  metrics: {
    activeRenderVertices: vertexPixels.length,
    renderVertexElevationDeltaMeters: distribution(vertexDeltas),
    renderVertexMotionPixels: distribution(vertexPixels),
    renderVertexMotionFractionsBelowPixels: fractions(vertexPixels, [.05, .1, .25, .5, 1]),
    denseSupportMotionPixels: distribution(densePixels),
    denseSupportElevationDeltaMeters: distribution(denseDeltas),
    tenfoldAmplitudeProjectionRatio: distribution(amplificationRatios),
    activeRenderCells: cellAngles.length,
    renderCellNormalAngleDegrees: distribution(cellAngles),
    renderCellIlluminationDelta: distribution(cellIllum),
    renderCellRgbEuclidean8: distribution(cellRgb),
    renderCellProjectedAreaPixels2: distribution(cellAreas)
  },
  interpretationBoundary: [
    'pixel displacement is a geometric screen-space diagnostic, not a human just-noticeable-difference threshold',
    'per-cell RGB delta replays the audit renderer style formula, not a calibrated display or perceptual metric',
    'the amplitude-normalized plan panel demonstrates support and sign, not fixed-view salience',
    'human visual acceptance remains the Mother receipt and is not inferred from this probe'
  ]
};

const out = process.env.KAOPU_N19_OUTPUT || new URL('./farmland_screen_space_result_n19.json', import.meta.url);
fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 2;
