const PBRT_COMMIT = "b4ce9687e6c695f5582997c61b0c66cf064bdb4a";
const F13_COMMIT = "2175d53de12a44dbedb989d3e8b34837f6315dcb";

function pbrtLongitudinalVariances(betaM) {
  const v0 = Math.pow(0.726 * betaM + 0.812 * betaM ** 2 + 3.7 * betaM ** 20, 2);
  return [v0, 0.25 * v0, 4 * v0];
}

function pbrtAzimuthalScale(betaN) {
  return Math.sqrt(Math.PI / 8) *
    (0.265 * betaN + 1.194 * betaN ** 2 + 5.372 * betaN ** 22);
}

function pbrtSigmaAFromMelanin(eumelanin, pheomelanin) {
  const eu = [0.419, 0.697, 1.37];
  const ph = [0.187, 0.4, 1.05];
  return eu.map((v, i) => eumelanin * v + pheomelanin * ph[i]);
}

function f13OpticalControls(roughness, absorptionPreset) {
  const longitudinalBase = Math.sqrt(roughness ** 2 + 0.20 ** 2);
  return {
    scalarRoughness: roughness,
    longitudinalWidths: [longitudinalBase, longitudinalBase * 0.65, longitudinalBase * 1.8],
    azimuthalWidths: [0.70, 0.70, 0.85],
    absorptionPreset
  };
}

function classifyTeacher(x) {
  if (!x.provenanceBound || !x.maintenanceBound || !x.runnableCode ||
      !x.testsPresent || !x.licenseBound) return "UNKNOWN";
  if (!x.directlyRelevant || !x.novelKnowledge) return "NO_NOVELTY";
  if (x.requiresClosedDependency || x.integrationRiskUnbounded) return "REJECTED";
  return "TEACHER_CANDIDATE";
}

const betaM = 0.38;
const lowBetaN = 0.20;
const highBetaN = 0.80;
const f13Low = f13OpticalControls(0.38, "brown");
const f13High = f13OpticalControls(0.38, "brown");
const pbrtLow = {
  betaM,
  betaN: lowBetaN,
  longitudinalVariances: pbrtLongitudinalVariances(betaM),
  azimuthalScale: pbrtAzimuthalScale(lowBetaN)
};
const pbrtHigh = {
  betaM,
  betaN: highBetaN,
  longitudinalVariances: pbrtLongitudinalVariances(betaM),
  azimuthalScale: pbrtAzimuthalScale(highBetaN)
};

const teacherBase = {
  provenanceBound: true,
  maintenanceBound: true,
  runnableCode: true,
  testsPresent: true,
  licenseBound: true,
  directlyRelevant: true,
  novelKnowledge: true,
  requiresClosedDependency: false,
  integrationRiskUnbounded: false
};

const cases = [
  ["source-unbound", {...teacherBase, provenanceBound: false}, "UNKNOWN"],
  ["maintenance-unbound", {...teacherBase, maintenanceBound: false}, "UNKNOWN"],
  ["no-runnable-code", {...teacherBase, runnableCode: false}, "UNKNOWN"],
  ["tests-unbound", {...teacherBase, testsPresent: false}, "UNKNOWN"],
  ["license-unbound", {...teacherBase, licenseBound: false}, "UNKNOWN"],
  ["not-directly-relevant", {...teacherBase, directlyRelevant: false}, "NO_NOVELTY"],
  ["semantics-already-covered", {...teacherBase, novelKnowledge: false}, "NO_NOVELTY"],
  ["closed-runtime-required", {...teacherBase, requiresClosedDependency: true}, "REJECTED"],
  ["bounded-source-only-audition", teacherBase, "TEACHER_CANDIDATE"]
].map(([id, input, expected]) => {
  const actual = classifyTeacher(input);
  return {id, expected, actual, pass: actual === expected};
});

const output = {
  schema: "kaopu.teacher-audition-probe/1",
  run: "N208_PBRT_V4_HAIR_OPTICS_PARAMETER_SEMANTICS",
  sourceSubjects: {
    kaopu: `haihao0307/guilin-dem-pipeline@${F13_COMMIT}:kaopu-hair-workbench/foundation/f13/src/FiberOptics.mjs`,
    teacher: `mmp/pbrt-v4@${PBRT_COMMIT}:src/pbrt/bxdfs.h,src/pbrt/bxdfs.cpp,src/pbrt/bsdfs_test.cpp`
  },
  boundedQuestion: "Does PBRT v4 know a reproducible hair-optics parameter/test separation that F13 cannot currently express with one roughness scalar and four hand-authored absorption presets?",
  semanticReplay: {
    fixedLongitudinalRoughness: betaM,
    lowAzimuthalRoughness: {pbrt: pbrtLow, f13: f13Low},
    highAzimuthalRoughness: {pbrt: pbrtHigh, f13: f13High},
    pbrtAzimuthalScaleChange: pbrtHigh.azimuthalScale - pbrtLow.azimuthalScale,
    f13AzimuthalWidthsChange: f13High.azimuthalWidths.map((v, i) => v - f13Low.azimuthalWidths[i]),
    melaninExamples: {
      eumelaninOnly: pbrtSigmaAFromMelanin(1, 0),
      pheomelaninOnly: pbrtSigmaAFromMelanin(0, 1),
      equalMixture: pbrtSigmaAFromMelanin(0.5, 0.5)
    },
    structuralGapConfirmed:
      pbrtHigh.azimuthalScale !== pbrtLow.azimuthalScale &&
      f13High.azimuthalWidths.every((v, i) => v === f13Low.azimuthalWidths[i])
  },
  cases,
  summary: {passed: cases.filter(x => x.pass).length, total: cases.length},
  decision: "TEACHER_CANDIDATE",
  boundedNovelty: [
    "Independent beta_m and beta_n parameter semantics instead of one scalar roughness.",
    "Cuticle tilt alpha and an explicit p>=3 residual term instead of only fixed lobe shifts.",
    "Eumelanin/pheomelanin concentrations mapped to absorption instead of color-name presets.",
    "Executable white-furnace, sampling-weight, and sampling-consistency tests."
  ],
  nonAdoptionBoundary: [
    "Do not import PBRT's path tracer, CUDA/OptiX route, scene format, or full renderer.",
    "Do not claim real-time performance, browser parity, visual improvement, or USER-ACCEPTED.",
    "Apache-2.0 source may inform a clean-room scoped audition; any copied code still requires license notice and review."
  ],
  proposedMinimumFalsifiableTrial: {
    mother: "Hair",
    implementation: "CPU reference evaluator or isolated shader lab only",
    frozenInputs: ["tangent", "viewDirection", "lightDirection", "eta", "h", "sigmaA", "betaM", "betaN", "alpha"],
    requiredChecks: [
      "betaN sweep changes azimuthal width while betaM remains fixed",
      "betaM sweep changes longitudinal width while betaN remains fixed",
      "melanin concentrations deterministically map to sigmaA",
      "finite output over the frozen angle grid",
      "white-furnace error bound declared before the run",
      "comparison against retained F13 under identical lighting"
    ]
  },
  lifecycle: {
    RADAR_FOUND: true,
    TEACHER_CANDIDATE: true,
    AUDITION: false,
    PROBATION: false,
    ACTIVE_TEACHER: false,
    POSTED: false,
    ACKNOWLEDGED: false,
    IMPLEMENTED: false,
    GATE_RUN: true,
    ADOPTED: false,
    USER_ACCEPTED: false
  }
};

if (output.summary.passed !== output.summary.total ||
    !output.semanticReplay.structuralGapConfirmed) process.exitCode = 1;
console.log(JSON.stringify(output, null, 2));
