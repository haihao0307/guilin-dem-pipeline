#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const round = (v) => Math.round(v * 1e6) / 1e6;
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function sampleHypothesis(seed) {
  const random = rng(seed);
  const amplitude = (random() * 2 - 1) * 0.085;
  const secondary = (random() * 2 - 1) * 0.04;
  const phase = random() * Math.PI * 2;
  const strands = [];
  for (let s = 0; s < 8; s += 1) {
    const points = [];
    for (let i = 0; i < 41; i += 1) {
      const t = i / 40;
      const x = -0.07 + s * 0.02 + 0.009 * Math.sin(Math.PI * t + s * 0.23);
      const y = 0.11 * (1 - t) + 0.006 * Math.cos(2 * Math.PI * t + s * 0.17);
      const observedZ = 0.012 * Math.sin(2 * Math.PI * t + s * 0.31);
      const hiddenWeight = smoothstep(0.55, 1.0, t);
      const posteriorDelta = hiddenWeight * (amplitude + secondary * Math.sin(Math.PI * t + phase + s * 0.11));
      points.push({
        x,
        y,
        z: observedZ + posteriorDelta,
        evidence: t <= 0.55 ? "OBSERVED_FRONT" : "OCCLUDED",
      });
    }
    strands.push(points);
  }
  return { seed, strands };
}

const flatten = (h) => h.strands.flat();
const frontProjection = (h) => flatten(h).map((p) => [round(p.x), round(p.y)]);
const sideProjection = (h) => flatten(h).map((p) => [round(p.z), round(p.y)]);

function regionVariance(hypotheses, evidence) {
  const arrays = hypotheses.map((h) => flatten(h).filter((p) => p.evidence === evidence));
  const count = arrays[0].length;
  let sumVariance = 0;
  for (let i = 0; i < count; i += 1) {
    const zs = arrays.map((a) => a[i].z);
    const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
    sumVariance += zs.reduce((acc, z) => acc + (z - mean) ** 2, 0) / zs.length;
  }
  return sumVariance / count;
}

function promotionGate({ coverage, hypothesisCount, fixedSeedRepeatable, occludedVarianceM2, hiddenClaim }) {
  if (coverage === "FRONT_ONLY" && hiddenClaim === "CURRENT_TRUTH" && hypothesisCount === 1) {
    return "REJECT_SINGLE_SAMPLE_PROMOTED_AS_UNIQUE_TRUTH";
  }
  if (coverage === "FRONT_ONLY" && hiddenClaim === "CURRENT_TRUTH" && fixedSeedRepeatable) {
    return "REJECT_REPEATABILITY_MISUSED_AS_EPISTEMIC_CERTAINTY";
  }
  if (coverage === "FRONT_ONLY" && occludedVarianceM2 > 0 && hiddenClaim === "INFERRED_PRIOR_CANDIDATE") {
    return "HOLD_POSTERIOR_AMBIGUITY_DISCLOSED";
  }
  if (coverage === "FRONT_PLUS_WITHHELD" && hiddenClaim === "REFERENCE_MATCH") {
    return "PASS_REQUIRES_EXTERNAL_VIEW_MATCH";
  }
  return "HOLD_INCOMPLETE_UNCERTAINTY_RECEIPT";
}

const seeds = [1, 2, 3, 4, 5, 6, 7];
const ensemble = seeds.map(sampleHypothesis);
const repeatSeed5 = [sampleHypothesis(5), sampleHypothesis(5), sampleHypothesis(5)];

const frontHashes = ensemble.map((h) => hash(frontProjection(h)));
const sideHashes = ensemble.map((h) => hash(sideProjection(h)));
const repeatFullHashes = repeatSeed5.map((h) => hash(flatten(h).map((p) => [round(p.x), round(p.y), round(p.z)])));
const observedVarianceM2 = regionVariance(ensemble, "OBSERVED_FRONT");
const occludedVarianceM2 = regionVariance(ensemble, "OCCLUDED");

const decisions = {
  deterministicRuntimeGate: new Set(repeatFullHashes).size === 1 ? "PASS_FIXED_SEED_REPEATABLE" : "FAIL_NON_REPEATABLE",
  singleSampleTruthGate: promotionGate({ coverage: "FRONT_ONLY", hypothesisCount: 1, fixedSeedRepeatable: true, occludedVarianceM2: 0, hiddenClaim: "CURRENT_TRUTH" }),
  repeatabilityTruthGate: promotionGate({ coverage: "FRONT_ONLY", hypothesisCount: 3, fixedSeedRepeatable: true, occludedVarianceM2: 0, hiddenClaim: "CURRENT_TRUTH" }),
  ensembleGate: promotionGate({ coverage: "FRONT_ONLY", hypothesisCount: ensemble.length, fixedSeedRepeatable: false, occludedVarianceM2, hiddenClaim: "INFERRED_PRIOR_CANDIDATE" }),
};

const checks = [
  ["seed 5 is byte-stable in the synthetic sampler", new Set(repeatFullHashes).size === 1],
  ["all seeds preserve the same front projection", new Set(frontHashes).size === 1],
  ["different seeds expose multiple side hypotheses", new Set(sideHashes).size === seeds.length],
  ["observed-front ensemble variance is numerically zero", observedVarianceM2 < 1e-20],
  ["occluded ensemble variance is nonzero", occludedVarianceM2 > 1e-8],
  ["fixed-seed runtime repeatability passes", decisions.deterministicRuntimeGate === "PASS_FIXED_SEED_REPEATABLE"],
  ["one sample cannot be promoted as unique truth", decisions.singleSampleTruthGate === "REJECT_SINGLE_SAMPLE_PROMOTED_AS_UNIQUE_TRUTH"],
  ["repeating one seed is not epistemic certainty", decisions.repeatabilityTruthGate === "REJECT_REPEATABILITY_MISUSED_AS_EPISTEMIC_CERTAINTY"],
  ["multi-seed ambiguity is disclosed but not resolved", decisions.ensembleGate === "HOLD_POSTERIOR_AMBIGUITY_DISCLOSED"],
  ["an external withheld view remains necessary for truth promotion", promotionGate({ coverage: "FRONT_PLUS_WITHHELD", hypothesisCount: 7, fixedSeedRepeatable: false, occludedVarianceM2, hiddenClaim: "REFERENCE_MATCH" }) === "PASS_REQUIRES_EXTERNAL_VIEW_MATCH"],
];
for (const [name, pass] of checks) assert.equal(pass, true, name);

const result = {
  probeId: "DIFFLOCKS-SINGLE-SEED-UNCERTAINTY-N213",
  generatedAt: "2026-10-30T03:37:00+08:00",
  upstreamEvidence: {
    repository: "Meshcapade/difflocks",
    commit: "fcc73747dc60320c30228b6711000a53fc0c9d84",
    inferenceBlob: "544ff03c7b3fc83251429c14da4ffe4ba52e31a3",
    fixedSeeds: { torch: 5, numpy: 5, pythonRandom: 5 },
    inferenceSamplesPerInvocation: 1,
    authorIssueStatement: "The model is a diffusion one so it is slightly stochastic and can give slightly different results depending on the seed.",
  },
  fixtureOnly: true,
  seeds,
  hashes: { frontHashes, sideHashes, repeatSeed5: repeatFullHashes },
  metrics: {
    hypothesisCount: ensemble.length,
    observedVarianceM2,
    occludedVarianceM2,
    occludedStdMm: Math.sqrt(occludedVarianceM2) * 1000,
  },
  decisions,
  checks: checks.map(([name, pass]) => ({ name, pass })),
  summary: { passed: checks.length, failed: 0, total: checks.length },
  boundary: [
    "Synthetic posterior replay only; no DiffLocks checkpoint was run.",
    "Fixed-seed repeatability is an execution property, not proof that occluded geometry is uniquely determined or correct.",
    "Multi-seed variation can reveal ambiguity but cannot select reference truth without independent evidence.",
  ],
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  const outputPath = fileURLToPath(new URL("./difflocks_single_seed_uncertainty_result_n213.json", import.meta.url));
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`PASS ${checks.length}/${checks.length} -> ${outputPath}\n`);
}

