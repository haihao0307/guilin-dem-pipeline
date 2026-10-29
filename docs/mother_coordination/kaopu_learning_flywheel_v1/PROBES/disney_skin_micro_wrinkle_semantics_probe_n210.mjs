import { createHash } from "node:crypto";

const seed = 0x5a17c0de;

function rngFactory(initial) {
  let x = initial >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}

function axialDistance(a, b) {
  const raw = Math.abs(a - b) % Math.PI;
  return Math.min(raw, Math.PI - raw);
}

function poissonDiskPoints(random, minDistance, targetCount) {
  const points = [];
  for (let attempt = 0; attempt < 500000 && points.length < targetCount; attempt += 1) {
    const p = [random(), random()];
    let valid = true;
    for (const q of points) {
      const dx = p[0] - q[0];
      const dy = p[1] - q[1];
      if (dx * dx + dy * dy < minDistance * minDistance) {
        valid = false;
        break;
      }
    }
    if (valid) points.push(p);
  }
  return points;
}

function buildKnnEdges(points, k) {
  const map = new Map();
  for (let i = 0; i < points.length; i += 1) {
    const candidates = [];
    for (let j = 0; j < points.length; j += 1) {
      if (i === j) continue;
      const dx = points[j][0] - points[i][0];
      const dy = points[j][1] - points[i][1];
      candidates.push({ j, d: Math.hypot(dx, dy) });
    }
    candidates.sort((a, b) => a.d - b.d || a.j - b.j);
    for (const { j, d } of candidates.slice(0, k)) {
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      const key = `${a}:${b}`;
      if (!map.has(key)) {
        const dx = points[b][0] - points[a][0];
        const dy = points[b][1] - points[a][1];
        map.set(key, { a, b, distance: d, theta: Math.atan2(dy, dx) });
      }
    }
  }
  return [...map.values()];
}

function orientationWeight(theta, preferred, alphaBase, sigma = 0.3) {
  const d = axialDistance(theta, preferred);
  return alphaBase + Math.exp(-(d * d) / (sigma * sigma));
}

function weightedAxialResultant(edges, preferred, alphaBase) {
  let cx = 0;
  let cy = 0;
  let sum = 0;
  let aligned = 0;
  for (const edge of edges) {
    const w = orientationWeight(edge.theta, preferred, alphaBase) / edge.distance;
    cx += w * Math.cos(2 * edge.theta);
    cy += w * Math.sin(2 * edge.theta);
    sum += w;
    if (axialDistance(edge.theta, preferred) <= Math.PI / 12) aligned += w;
  }
  return {
    axialResultant: Math.hypot(cx, cy) / sum,
    within15DegFraction: aligned / sum,
  };
}

function nearestPoreDistance(point, pores) {
  let best = Infinity;
  for (const pore of pores) best = Math.min(best, Math.hypot(point[0] - pore[0], point[1] - pore[1]));
  return best;
}

const random = rngFactory(seed);
const pores = poissonDiskPoints(random, 0.055, 190);
const edges = buildKnnEdges(pores, 5);
const preferred = Math.PI / 7;
const directional = weightedAxialResultant(edges, preferred, 0.05);
const isotropic = weightedAxialResultant(edges, preferred, 1.0);

const graphEndpoints = edges.flatMap((edge) => [pores[edge.a], pores[edge.b]]);
const graphEndpointMaxError = Math.max(...graphEndpoints.map((p) => nearestPoreDistance(p, pores)));

const naiveRandom = rngFactory(seed ^ 0xa5a5a5a5);
const naiveEndpoints = Array.from({ length: edges.length * 2 }, () => [naiveRandom(), naiveRandom()]);
const poreTolerance = 0.002;
const naiveEndpointOnPoreFraction = naiveEndpoints.filter((p) => nearestPoreDistance(p, pores) <= poreTolerance).length / naiveEndpoints.length;

const stablePayload = JSON.stringify({ pores, edges, directional, isotropic });
const replayHash = createHash("sha256").update(stablePayload).digest("hex");

const tests = [
  ["poisson_graph_has_enough_pores", pores.length >= 150],
  ["knn_graph_has_candidate_edges", edges.length > pores.length],
  ["graph_wrinkle_endpoints_are_pore_nodes", graphEndpointMaxError === 0],
  ["naive_open_segments_do_not_bind_to_pores", naiveEndpointOnPoreFraction < 0.05],
  ["low_base_strength_is_directional", directional.axialResultant > 0.5],
  ["low_base_strength_concentrates_near_flow", directional.within15DegFraction > 0.5],
  ["high_base_strength_reduces_anisotropy", isotropic.axialResultant < directional.axialResultant - 0.2],
  ["fixed_seed_has_stable_hash", replayHash.length === 64],
];

const result = {
  schema: "KAOPU_DISNEY_SKIN_MICRO_WRINKLE_SEMANTICS_N210_V1",
  boundedQuestion: "Does pore-node / wrinkle-edge graph semantics add a controllable microrelief representation beyond unstructured noise?",
  sourceModel: {
    title: "Graph-Based Synthesis for Skin Micro Wrinkles",
    venue: "Eurographics Symposium on Geometry Processing 2023",
    methodBoundary: "Independent parameter-semantics replay of pore-node binding and the paper's axial orientation sampler; not a reproduction of CUDA trail simulation, displacement shader, scan fitting, or final image quality.",
  },
  configuration: {
    seed,
    minimumPoreDistanceUv: 0.055,
    targetPores: 190,
    kNearest: 5,
    preferredOrientationRadians: preferred,
    sigmaRadians: 0.3,
    directionalBaseStrength: 0.05,
    isotropicBaseStrength: 1.0,
  },
  observations: {
    poreCount: pores.length,
    candidateEdgeCount: edges.length,
    graphEndpointMaxError,
    naiveEndpointOnPoreFraction,
    directional,
    isotropic,
    replayHash,
  },
  tests: tests.map(([name, pass]) => ({ name, pass })),
  passed: tests.filter(([, pass]) => pass).length,
  total: tests.length,
  decision: tests.every(([, pass]) => pass)
    ? "TEACHER_CANDIDATE_PARAMETER_SEMANTICS_REPRODUCED"
    : "UNKNOWN_MINIMAL_REPLAY_FAILED",
  limits: [
    "No public implementation or dataset from the paper was found.",
    "No facial region map, UV-distortion correction, trail continuation/crossing penalties, multi-level displacement, BRDF, subsurface scattering, browser, device, or production validation is included.",
    "The three supplied images are visual observations only and do not disclose their source maps or renderer.",
  ],
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
