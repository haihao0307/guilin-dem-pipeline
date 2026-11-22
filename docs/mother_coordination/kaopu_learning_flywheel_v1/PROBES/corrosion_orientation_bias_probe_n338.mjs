import { createHash } from "node:crypto";

const PI = Math.PI;
const delta = 1.0;
const kappa = 2.0;
const m = 3;
const h = delta / m;
const cDelta = 8 / (PI * delta ** 4);

function intersect(cx, cy, n = 200) {
  const sub = h / n;
  const x0 = cx - 0.5 * h + 0.5 * sub;
  const y0 = cy - 0.5 * h + 0.5 * sub;
  let count = 0, sx = 0, sy = 0;
  for (let a = 0; a < n; a++) {
    const x = x0 + a * sub;
    for (let b = 0; b < n; b++) {
      const y = y0 + b * sub;
      if (x * x + y * y <= delta * delta) {
        count++; sx += x; sy += y;
      }
    }
  }
  return { area: count * sub * sub, x: count ? sx / count : cx, y: count ? sy / count : cy };
}

function nodes(mode) {
  const out = [];
  const radius = Math.ceil(delta / h) + 1;
  const half = 0.5 * h;
  for (let i = -radius; i <= radius; i++) {
    for (let j = -radius; j <= radius; j++) {
      const cx = i * h, cy = j * h;
      if (mode === "FA") {
        if (cx * cx + cy * cy <= delta * delta) out.push({ x: cx, y: cy, w: h * h });
        continue;
      }
      const min = Math.hypot(Math.max(0, Math.abs(cx) - half), Math.max(0, Math.abs(cy) - half));
      const max = Math.hypot(Math.abs(cx) + half, Math.abs(cy) + half);
      if (min > delta) continue;
      if (max <= delta) {
        out.push({ x: cx, y: cy, w: h * h });
        continue;
      }
      const cut = intersect(cx, cy);
      if (cut.area <= 0) continue;
      out.push(mode === "PA_HHB"
        ? { x: cx, y: cy, w: cut.area }
        : { x: cut.x, y: cut.y, w: cut.area });
    }
  }
  return out;
}

function sweep(mode) {
  const ns = nodes(mode);
  const values = [];
  for (let degree = 0; degree <= 90; degree++) {
    const theta = degree * PI / 180;
    const kx = kappa * Math.cos(theta);
    const ky = kappa * Math.sin(theta);
    values.push(cDelta * ns.reduce((sum, n) => sum + n.w * (1 - Math.cos(kx * n.x + ky * n.y)), 0));
  }
  const min = Math.min(...values), max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { mode, min, max, mean, normalizedOrientationSpread: (max - min) / mean };
}

const rows = ["FA", "PA_HHB", "PA_AC"].map(sweep);
const reduction = rows[0].normalizedOrientationSpread / rows[2].normalizedOrientationSpread;
const result = {
  taskId: "N338-CORROSION-ORIENTATION-KERNEL-AUDITION",
  subject: {
    repository: "Hereon-InstituteMS/nonlocal-kks",
    commit: "842ad95346b31c8aadeaf15e7489bc9bcc2f022b",
    quadratureBlob: "71d1af1130c7add8b701b1466566df69196d3686"
  },
  parameters: { delta, kappa, m, angles: "0..90 degrees inclusive", boundarySubsamplesPerAxis: 200 },
  rows,
  paAcVsFaSpreadReduction: reduction,
  falsifier: "PA_AC normalized orientation spread must be lower than FA and at least 20x smaller at the pinned parameters.",
  passed: rows[2].normalizedOrientationSpread < rows[0].normalizedOrientationSpread && reduction >= 20,
  scope: "2D operator-level synthetic audition only; not 3D corrosion geometry or production validation"
};
result.resultDigest = createHash("sha256").update(JSON.stringify(result)).digest("hex");
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
