import fs from 'node:fs';

const regression = JSON.parse(fs.readFileSync(new URL('../REGRESSION_CASES/CANDIDATE_FUNCTION_CLASS_SHARING_NOT_TOTAL_INSTANCE_COLLAPSE_001.json', import.meta.url), 'utf8'));

const replayEvidence = {
  smallBackup: {
    sha256: '60394ddb2518bad3f9c2978b812460c54c2eaafd0968396084bc04530721c7c4',
    manifestFilesVerified: 68,
    fullR08ParametersIncluded: false,
    standaloneSyntheticDefinitions: 20,
    standaloneSyntheticObjects: 10,
    standaloneSyntheticTypes: 14,
    standaloneExactEvaluations: 670
  },
  restoredSubject: {
    prerequisiteCheckpointSha256: '81fbd0166cb21d74deff6c86dc3079688302461c3bb90e70a58fe1b7b7cded0a',
    assemblySha256: '4fe3e7a84015e20f709d7788a01721d36ac2aa0735d5c27b30c2f1ba9195ad50',
    definitions: 5397,
    objects: 1462,
    types: 14
  },
  compatibility: {
    exactJetEvaluations: 217506,
    trimClassifications: 108989,
    numberComparisons: 3241815,
    exactNumberMismatches: 0,
    regularMismatches: 0,
    trimMismatches: 0,
    compiledSupported: 1186,
    compiledGuardedCore: 276,
    mixedBrandRejected: true
  },
  rerunRender: {
    mode: 'Node CPU, 800x600, same frozen R08 subject/camera/options',
    originalMs: 10697.055912,
    optimizedMs: 6434.036247,
    observedWallRatio: 1.662573150250392,
    repetitionsPerImplementation: 1,
    rgbaSha256: 'fecf8b56ca13511359c2e994cb93aaca2a24407680bfd518ff8f4302763612e8',
    depthSha256: 'bc892ea772093c0862a4274b86e9da5238e21d64cb95b0cd02e650a3ef729c1d',
    objectIdsSha256: '884a27768d1bcec3f853377cc3fedf35530156d91d68484bda49369141d1b427',
    arraysByteIdentical: true,
    changedRgbPixels: 0,
    inheritedGridCaps: 15,
    inheritedMaxTangentProbeErrorPx: 1.8526176419705027
  },
  boundaries: {
    accepted: 'bounded exact CPU evaluator implementation method for the frozen R08 subject',
    notAccepted: ['whole-car shape/completeness', 'source fidelity', 'optics', 'browser/phone/GPU/realtime performance', 'N221 WebGPU route', 'N222 total-instance collapse', 'removal of inherited display caps']
  }
};

function classify(input) {
  if (!input.baselineCheckpointDigest || !input.baselineAssemblyDigest || !input.baselineEvaluatorDigest || !input.candidateEvaluatorDigest) {
    return 'HOLD_EVALUATOR_BASELINE_SUBJECT_UNBOUND';
  }
  if (input.syntheticOnly && input.claimScope === 'WHOLE_R08') {
    return 'REJECT_SYNTHETIC_SMOKE_AS_WHOLE_SUBJECT_EQUIVALENCE';
  }
  if (input.claimScope === 'WEBGPU_RUNTIME_PROVEN' || input.claimScope === 'REALTIME_PROVEN' || input.claimScope === 'TOTAL_INSTANCE_COLLAPSE_PROVEN') {
    return 'REJECT_CPU_EVALUATOR_EQUIVALENCE_AS_GPU_OR_RUNTIME_ROUTE_PROOF';
  }
  const complete = input.fullDefinitionCoverage === true &&
    Number.isInteger(input.definitionTypes) && input.definitionTypes > 0 &&
    Number.isInteger(input.exactJetComparisons) && input.exactJetComparisons > 0 &&
    input.exactJetMismatches === 0 &&
    Number.isInteger(input.trimClassifications) && input.trimClassifications > 0 &&
    input.trimMismatches === 0 &&
    input.mixedBrandRejected === true &&
    input.renderArraysBound === true &&
    input.rgbaIdentical === true && input.depthIdentical === true && input.objectIdsIdentical === true &&
    Array.isArray(input.scopeExclusions) && input.scopeExclusions.includes('GPU') &&
    input.scopeExclusions.includes('total-instance-collapse') &&
    input.fallbackPolicy === 'fail-closed';
  if (!complete) return 'HOLD_EXACT_EVALUATOR_COMPATIBILITY_INCOMPLETE';
  return 'CANDIDATE_EXACT_EVALUATOR_OPTIMIZATION_BOUNDED_CPU_METHOD_PROVEN';
}

const fixtures = regression.cases.filter(x => x.kind === 'evaluatorImplementation');
const results = fixtures.map(f => {
  const actual = classify(f.input);
  return {id:f.id, expect:f.expect, actual, passed:actual===f.expect};
});
const evidenceChecks = [
  replayEvidence.smallBackup.fullR08ParametersIncluded === false,
  replayEvidence.restoredSubject.definitions === 5397,
  replayEvidence.restoredSubject.objects === 1462,
  replayEvidence.compatibility.exactNumberMismatches === 0,
  replayEvidence.compatibility.trimMismatches === 0,
  replayEvidence.compatibility.mixedBrandRejected === true,
  replayEvidence.rerunRender.arraysByteIdentical === true,
  replayEvidence.rerunRender.changedRgbPixels === 0,
  replayEvidence.boundaries.notAccepted.includes('browser/phone/GPU/realtime performance'),
  replayEvidence.boundaries.notAccepted.includes('N222 total-instance collapse')
];

const output = {
  caseId: regression.caseId,
  extension: 'N225_R08_EXACT_EVALUATOR_BOUNDED_CPU_METHOD',
  decision: 'ACCEPT_R08_EXACT_EVALUATOR_OPTIMIZATION_AS_BOUNDED_CPU_METHOD_CANDIDATE_NOT_RUNTIME_ROUTE',
  fixtureTotal: results.length,
  fixturePassed: results.filter(x=>x.passed).length,
  evidenceCheckTotal: evidenceChecks.length,
  evidenceCheckPassed: evidenceChecks.filter(Boolean).length,
  allPassed: results.every(x=>x.passed) && evidenceChecks.every(Boolean),
  replayEvidence,
  results,
  boundary: 'Exact-subject CPU method replay only. Timing is one shared-cloud observation and is not a performance gate. No production, browser, GPU, WebGPU, geometry-acceptance, adoption, or user-acceptance claim.'
};
console.log(JSON.stringify(output,null,2));
if(!output.allPassed) process.exitCode=1;

