#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const round = (v) => Math.round(v * 1e6) / 1e6;
const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function makeHair(hiddenDepthDelta) {
  const strands = [];
  for (let s = 0; s < 8; s += 1) {
    const points = [];
    for (let i = 0; i < 41; i += 1) {
      const t = i / 40;
      const x = -0.07 + s * 0.02 + 0.009 * Math.sin(Math.PI * t + s * 0.23);
      const y = 0.11 * (1 - t) + 0.006 * Math.cos(2 * Math.PI * t + s * 0.17);
      const visibleDepth = 0.012 * Math.sin(2 * Math.PI * t + s * 0.31);
      const hiddenWeight = smoothstep(0.55, 1.0, t);
      const z = visibleDepth + hiddenDepthDelta * hiddenWeight;
      points.push({ x, y, z, evidence: t <= 0.55 ? "OBSERVED_FRONT" : "OCCLUDED" });
    }
    strands.push(points);
  }
  return strands;
}

function flatten(hair) {
  return hair.flat();
}

function projection(hair, view) {
  return flatten(hair).map((p) => {
    if (view === "FRONT_ORTHO") return [round(p.x), round(p.y)];
    if (view === "SIDE_ORTHO") return [round(p.z), round(p.y)];
    throw new Error(`unknown view ${view}`);
  });
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function rms3d(a, b, evidence = null) {
  const pa = flatten(a).filter((p) => evidence === null || p.evidence === evidence);
  const pb = flatten(b).filter((p) => evidence === null || p.evidence === evidence);
  assert.equal(pa.length, pb.length);
  const mse = pa.reduce((sum, p, i) => {
    const q = pb[i];
    return sum + (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2;
  }, 0) / pa.length;
  return Math.sqrt(mse);
}

function provenanceGate({ coverage, hiddenClaim, frontMatch, sideMatch = null }) {
  if (!frontMatch) return "REJECT_FRONT_REFERENCE_MISMATCH";
  if (coverage === "FRONT_ONLY" && hiddenClaim === "CURRENT_TRUTH") {
    return "REJECT_OCCLUDED_PRIOR_PROMOTED_AS_REFERENCE_TRUTH";
  }
  if (coverage === "FRONT_ONLY" && hiddenClaim === "INFERRED_PRIOR_CANDIDATE") {
    return "HOLD_OCCLUDED_GEOMETRY_UNVERIFIED";
  }
  if (coverage === "FRONT_PLUS_SIDE" && sideMatch === false) {
    return "REJECT_WITHHELD_VIEW_MISMATCH";
  }
  if (coverage === "FRONT_PLUS_SIDE" && sideMatch === true && hiddenClaim === "REFERENCE_MATCH") {
    return "PASS_MULTIVIEW_REFERENCE_BOUND";
  }
  return "HOLD_INCOMPLETE_PROVENANCE_RECEIPT";
}

const reference = makeHair(0);
const priorA = makeHair(0.08);
const priorB = makeHair(-0.06);

const hashes = {
  referenceFront: digest(projection(reference, "FRONT_ORTHO")),
  priorAFront: digest(projection(priorA, "FRONT_ORTHO")),
  priorBFront: digest(projection(priorB, "FRONT_ORTHO")),
  referenceSide: digest(projection(reference, "SIDE_ORTHO")),
  priorASide: digest(projection(priorA, "SIDE_ORTHO")),
  priorBSide: digest(projection(priorB, "SIDE_ORTHO")),
};

const frontMatches = {
  priorA: hashes.priorAFront === hashes.referenceFront,
  priorB: hashes.priorBFront === hashes.referenceFront,
};

const sideMatches = {
  priorA: hashes.priorASide === hashes.referenceSide,
  priorB: hashes.priorBSide === hashes.referenceSide,
};

const metrics = {
  totalPointsPerHair: flatten(reference).length,
  observedFrontPoints: flatten(reference).filter((p) => p.evidence === "OBSERVED_FRONT").length,
  occludedPoints: flatten(reference).filter((p) => p.evidence === "OCCLUDED").length,
  priorAObservedRmsM: rms3d(reference, priorA, "OBSERVED_FRONT"),
  priorBOccludedRmsM: rms3d(reference, priorB, "OCCLUDED"),
  priorAOccludedRmsM: rms3d(reference, priorA, "OCCLUDED"),
};

const cases = [
  ["front projection is identical for reference and prior A", frontMatches.priorA],
  ["front projection is identical for reference and prior B", frontMatches.priorB],
  ["side projection exposes prior A difference", !sideMatches.priorA],
  ["side projection exposes prior B difference", !sideMatches.priorB],
  ["observed region is unchanged in 3D", metrics.priorAObservedRmsM === 0],
  ["occluded prior A is materially different", metrics.priorAOccludedRmsM > 0.02],
  ["occluded prior B is materially different", metrics.priorBOccludedRmsM > 0.015],
  ["front-only truth claim is rejected", provenanceGate({ coverage: "FRONT_ONLY", hiddenClaim: "CURRENT_TRUTH", frontMatch: true }) === "REJECT_OCCLUDED_PRIOR_PROMOTED_AS_REFERENCE_TRUTH"],
  ["front-only disclosed prior is held, not promoted", provenanceGate({ coverage: "FRONT_ONLY", hiddenClaim: "INFERRED_PRIOR_CANDIDATE", frontMatch: true }) === "HOLD_OCCLUDED_GEOMETRY_UNVERIFIED"],
  ["withheld side mismatch rejects the candidate", provenanceGate({ coverage: "FRONT_PLUS_SIDE", hiddenClaim: "REFERENCE_MATCH", frontMatch: true, sideMatch: false }) === "REJECT_WITHHELD_VIEW_MISMATCH"],
  ["matching multiview evidence can pass", provenanceGate({ coverage: "FRONT_PLUS_SIDE", hiddenClaim: "REFERENCE_MATCH", frontMatch: true, sideMatch: true }) === "PASS_MULTIVIEW_REFERENCE_BOUND"],
];

for (const [name, pass] of cases) assert.equal(pass, true, name);

const result = {
  probeId: "HAIR-SINGLE-VIEW-OCCLUDED-PROVENANCE-N212",
  generatedAt: "2026-10-29T23:42:00+08:00",
  taskMode: "REPLICATION_LOCKED",
  creativeAuthorization: false,
  fixtureOnly: true,
  method: "Three strand sets share exactly the same x/y centerlines, hence the same orthographic front projection. Only the z coordinates of the marked OCCLUDED tail differ. A side projection exposes the ambiguity.",
  hashes,
  frontMatches,
  sideMatches,
  metrics,
  decisions: {
    naiveFrontOnlyGatePriorA: frontMatches.priorA ? "PASS" : "REJECT",
    naiveFrontOnlyGatePriorB: frontMatches.priorB ? "PASS" : "REJECT",
    provenanceAwareTruthClaim: provenanceGate({ coverage: "FRONT_ONLY", hiddenClaim: "CURRENT_TRUTH", frontMatch: true }),
    provenanceAwareDisclosedPrior: provenanceGate({ coverage: "FRONT_ONLY", hiddenClaim: "INFERRED_PRIOR_CANDIDATE", frontMatch: true }),
    withheldSidePriorA: provenanceGate({ coverage: "FRONT_PLUS_SIDE", hiddenClaim: "REFERENCE_MATCH", frontMatch: true, sideMatch: sideMatches.priorA }),
  },
  checks: cases.map(([name, pass]) => ({ name, pass })),
  summary: { passed: cases.length, failed: 0, total: cases.length },
  boundary: [
    "Synthetic observability counterexample only; it is not a DiffLocks quality measurement.",
    "It proves non-identifiability under a front projection, not that every generated backside is wrong.",
    "A plausible learned prior may be useful as an explicitly labeled candidate, but cannot be promoted as reference truth without additional evidence or user authorization.",
  ],
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  const outputPath = fileURLToPath(new URL("./single_view_hair_occluded_provenance_result_n212.json", import.meta.url));
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`PASS ${cases.length}/${cases.length} -> ${outputPath}\n`);
}

