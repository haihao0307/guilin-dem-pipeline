const cfg = {
  n: 11,
  spacing: 0.2,
  restZ: 1.2,
  predictedDrop: 0.7,
  bodyRadius: 0.9,
  clearance: 0.02,
  iterations: 160,
  stiffness: 0.9,
};

const idx = (x, y) => y * cfg.n + x;
const clone = (p) => p.map(v => ({...v}));
const length = (a) => Math.hypot(a.x, a.y, a.z);

const rest = [];
for (let y = 0; y < cfg.n; y++) {
  for (let x = 0; x < cfg.n; x++) {
    rest.push({
      x: (x - (cfg.n - 1) / 2) * cfg.spacing,
      y: (y - (cfg.n - 1) / 2) * cfg.spacing,
      z: cfg.restZ,
      pinned: y === cfg.n - 1,
    });
  }
}

const edges = [];
for (let y = 0; y < cfg.n; y++) {
  for (let x = 0; x < cfg.n; x++) {
    if (x + 1 < cfg.n) edges.push([idx(x, y), idx(x + 1, y), cfg.spacing]);
    if (y + 1 < cfg.n) edges.push([idx(x, y), idx(x, y + 1), cfg.spacing]);
  }
}

const predicted = clone(rest);
for (const p of predicted) if (!p.pinned) p.z -= cfg.predictedDrop;

function sdf(p, center = {x: 0, y: 0, z: 0}) {
  return Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z) - cfg.bodyRadius;
}

function projectContact(points, center = {x: 0, y: 0, z: 0}) {
  const target = cfg.bodyRadius + cfg.clearance;
  for (const p of points) {
    if (p.pinned) continue;
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const dz = p.z - center.z;
    const r = Math.hypot(dx, dy, dz);
    if (r < target) {
      const inv = r > 1e-12 ? target / r : 0;
      p.x = center.x + dx * inv;
      p.y = center.y + dy * inv;
      p.z = center.z + (r > 1e-12 ? dz * inv : target);
    }
  }
}

function solveDistances(points) {
  for (const [ia, ib, restLength] of edges) {
    const a = points[ia];
    const b = points[ib];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-12) continue;
    const error = d - restLength;
    const wa = a.pinned ? 0 : 1;
    const wb = b.pinned ? 0 : 1;
    const sum = wa + wb;
    if (!sum) continue;
    const s = cfg.stiffness * error / d;
    if (wa) {
      a.x += dx * s * wa / sum;
      a.y += dy * s * wa / sum;
      a.z += dz * s * wa / sum;
    }
    if (wb) {
      b.x -= dx * s * wb / sum;
      b.y -= dy * s * wb / sum;
      b.z -= dz * s * wb / sum;
    }
  }
}

function metrics(points) {
  const signed = points.map(p => sdf(p));
  const stretches = edges.map(([ia, ib, r]) => {
    const a = points[ia], b = points[ib];
    return Math.abs(Math.hypot(b.x-a.x, b.y-a.y, b.z-a.z) / r - 1);
  });
  return {
    penetratingVertices: signed.filter(v => v < -1e-9).length,
    minSignedDistance: Math.min(...signed),
    meanAbsoluteEdgeStrain: stretches.reduce((a,b) => a+b, 0) / stretches.length,
    maxAbsoluteEdgeStrain: Math.max(...stretches),
  };
}

const noContact = clone(predicted);

const projectionOnly = clone(predicted);
projectContact(projectionOnly);

const joint = clone(predicted);
for (let i = 0; i < cfg.iterations; i++) {
  solveDistances(joint);
  projectContact(joint);
}

const stalePose = clone(predicted);
const staleCenter = {x: 0.35, y: 0, z: 0};
for (let i = 0; i < cfg.iterations; i++) {
  solveDistances(stalePose);
  projectContact(stalePose, staleCenter);
}

const out = {
  probe: "N279_CLOTH_SDF_CONTACT_AND_EDGE_INVARIANT",
  config: cfg,
  bodyPoseVersion: "sphere-origin-r0.9-v1",
  cases: {
    noContact: metrics(noContact),
    projectionOnly: metrics(projectionOnly),
    jointDistanceAndContact: metrics(joint),
    staleBodyPoseControl: metrics(stalePose),
  },
};

out.gates = {
  projectionOnlyRemovesPenetration: out.cases.projectionOnly.penetratingVertices === 0,
  jointRemovesPenetration: out.cases.jointDistanceAndContact.penetratingVertices === 0,
  jointReducesMeanEdgeStrainByHalf:
    out.cases.jointDistanceAndContact.meanAbsoluteEdgeStrain <
    0.5 * out.cases.projectionOnly.meanAbsoluteEdgeStrain,
  stalePoseIsDetected: out.cases.staleBodyPoseControl.penetratingVertices > 0,
};

console.log(JSON.stringify(out, null, 2));
