#!/usr/bin/env node

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const UPSTREAM = {
  repository: "Meshcapade/difflocks",
  commit: "fcc73747dc60320c30228b6711000a53fc0c9d84",
  evidence: {
    readme: "6d995f0493423a259ba731ddf6e725b1b75ba7e8",
    inferenceCli: "544ff03c7b3fc83251429c14da4ffe4ba52e31a3",
    inferenceCore: "01da67ba5a2e103b3b6a47a89a31a36c0b37ecda",
    modelConfig: "38dba15b5512f6a01261d80df72e84dee0427ecc",
    requirements: "a0f77a1f122b358739f37c85ef1327b291470498",
    license: "37f7cc6870f9574f7d5b199d231365b6c81ba009",
    checkpointDownloader: "c357f3947c7f1ab3b3fbbe23b14acd10bb762395",
    datasetDownloader: "84292bda8d6926975882ad03548ff58100afba1e",
  },
};

// Source-contract facts transcribed from the pinned upstream files above.
// This probe audits whether the evidence is sufficient to enter an audition;
// it does not run the gated checkpoints or claim production quality.
const CONTRACT = {
  input: {
    count: 1,
    type: "RGB_IMAGE",
    faceRequired: true,
    largestDetectedFaceOnly: true,
    cropResolution: [770, 770],
  },
  generator: {
    type: "IMAGE_CONDITIONED_DIFFUSION",
    uses3DGaussianSplatting: false,
    outputIsProceduralFunctionGeometry: false,
    conditioning: "DINOv2 ViT-L/14 features",
    scalpTexture: { channels: 65, resolution: [256, 256] },
    strandLatentChannels: 64,
    densityChannels: 1,
    strandVertices: 256,
  },
  output: {
    primary: "NPZ_EXPLICIT_STRAND_POSITIONS",
    optional: ["BLEND", "ALEMBIC"],
    materialJson: true,
  },
  dataset: {
    samples: 40000,
    approximateStrandsPerSample: 100000,
    synthetic: true,
    generatedInBlender: true,
    authenticatedDownload: true,
  },
  runtime: {
    torch: "2.5.0",
    hardCodedCuda: true,
    bf16Autocast: true,
    customKernels: ["NATTEN", "FlashAttention-2"],
    dinov2TorchHubLoad: true,
    blenderVersion: "4.1.1",
    checkpointAuthenticatedDownload: true,
    fixedSeeds: [5, 5, 5],
    deterministicAlgorithmsEnforced: false,
  },
  rights: {
    scope: "NON_COMMERCIAL_SCIENTIFIC_RESEARCH_ONLY",
    commercialUseAllowed: false,
    redistributionAllowedWithoutPermission: false,
    derivativeWorksSameRestrictions: true,
  },
  knownBoundaries: [
    "NO_FACE_RETURNS_NONE",
    "CANONICAL_SCALP_BINDING_NOT_INTEGRATED",
    "CHECKPOINT_LOGIN_FAILURE_REPORTED",
    "V100_NO_FLASH_ATTENTION_FALLBACK_REPORTED",
    "OFFICIAL_EXAMPLE_GEOMETRY_MISMATCH_REPORTED",
    "PAPER_COLOR_MISMATCH_REPORTED",
    "LONG_HAIR_DISTRIBUTION_BIAS_REPORTED",
  ],
};

const checks = [
  ["source commit is pinned", /^[0-9a-f]{40}$/.test(UPSTREAM.commit)],
  ["all evidence blobs are pinned", Object.values(UPSTREAM.evidence).every((sha) => /^[0-9a-f]{40}$/.test(sha))],
  ["one RGB image is the inference contract", CONTRACT.input.count === 1 && CONTRACT.input.type === "RGB_IMAGE"],
  ["generator is image-conditioned diffusion", CONTRACT.generator.type === "IMAGE_CONDITIONED_DIFFUSION"],
  ["route excludes 3D Gaussian Splatting", CONTRACT.generator.uses3DGaussianSplatting === false],
  ["route excludes procedural function geometry at inference", CONTRACT.generator.outputIsProceduralFunctionGeometry === false],
  ["output is explicit strand positions", CONTRACT.output.primary === "NPZ_EXPLICIT_STRAND_POSITIONS"],
  ["scalp field splits 64 latent plus one density channel", CONTRACT.generator.scalpTexture.channels === CONTRACT.generator.strandLatentChannels + CONTRACT.generator.densityChannels],
  ["strand codec emits 256 vertices", CONTRACT.generator.strandVertices === 256],
  ["training data is synthetic and therefore carries domain-gap risk", CONTRACT.dataset.synthetic && CONTRACT.dataset.generatedInBlender],
  ["runtime is CUDA-specific", CONTRACT.runtime.hardCodedCuda && CONTRACT.runtime.bf16Autocast && CONTRACT.runtime.customKernels.length === 2],
  ["checkpoints are not anonymous artifacts", CONTRACT.runtime.checkpointAuthenticatedDownload && CONTRACT.dataset.authenticatedDownload],
  ["fixed seeds do not equal deterministic-algorithm enforcement", CONTRACT.runtime.fixedSeeds.length === 3 && !CONTRACT.runtime.deterministicAlgorithmsEnforced],
  ["license blocks direct production absorption", !CONTRACT.rights.commercialUseAllowed && !CONTRACT.rights.redistributionAllowedWithoutPermission],
  ["failure boundary set includes reproducibility and integration blockers", CONTRACT.knownBoundaries.length >= 7],
];

for (const [name, pass] of checks) assert.equal(pass, true, name);

const result = {
  probeId: "DIFFLOCKS-SINGLE-IMAGE-STRAND-CONTRACT-N211",
  generatedAt: "2026-10-29T19:43:00+08:00",
  upstream: UPSTREAM,
  contract: CONTRACT,
  checks: checks.map(([name, pass]) => ({ name, pass })),
  summary: { passed: checks.length, failed: 0, total: checks.length },
  disposition: {
    teacherStatus: "TEACHER_CANDIDATE",
    lifecycle: "RADAR_FOUND_TO_TEACHER_CANDIDATE",
    audition: false,
    rationale: "The pinned source proves a single-RGB to explicit-strand interface without 3DGS, but gated checkpoints, CUDA/BF16 dependencies, research-only rights, synthetic-data bias, and unresolved reproduction reports block adoption.",
    minimumNextTest: "Hair Mother must first confirm relevance and rights. Then run an isolated, non-commercial, exact-checkpoint audition with frozen seeds, official positive control, no-face/profile/occlusion/long-hair negatives, withheld side/back views, scalp-penetration and strand-geometry receipts, and an existing-head binding step.",
  },
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  const outputPath = fileURLToPath(new URL("./difflocks_single_image_strand_contract_result_n211.json", import.meta.url));
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`PASS ${checks.length}/${checks.length} -> ${outputPath}\n`);
}

