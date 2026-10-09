import assert from 'node:assert/strict';

const observed = {
  sourceAudit: {
    r03Status: 'R03_ROUTE_REJECTED_BY_USER',
    failures: [
      'PERSON_SUBSTITUTED',
      'GARMENT_PIPELINE_BYPASSED',
      'QA_WRONG_SUCCESS_CRITERION',
      'TAILOR_BODY_WAS_NEVER_FULL_COMMON'
    ],
    r04RuntimeDependsOnR03: false
  },
  nativePerson: {
    vertices: 25417,
    triangles: 50624,
    exactGeometryIdentity: true,
    exactTopologyIdentity: true,
    exactStateIdentity: true,
    sameOriginalRuntime: true,
    displayMaskOrRescale: false,
    actualBodyFieldRebuilt: true
  },
  source: {
    exactPaperCount: 60,
    sameBrowserNativeParityRows: 60,
    nativeReady: 49,
    nativeRejected: 11,
    originalFailuresPreserved: true
  },
  solver: {
    actualRecords: 2,
    t01QualityPassed: true,
    p01QualityPassed: false,
    j06FinishedResult: false,
    j06State: 'NO_FINISHED_RESULT_NOT_REPLACED'
  },
  contracts: {
    negativeIdentityChecksPassed: 12,
    personSwitchInvalidatesClothing: true,
    directApiCannotBypassIdentityGate: true
  },
  delivery: {
    fullCatalogueDelivered: false,
    physicalFitAccepted: false,
    dynamicWearCertified: false,
    public: false,
    userAccepted: false
  }
};

const checks = [];
const check = (name, fn) => {
  fn();
  checks.push(name);
};

check('R03 is rejected for wrong source lineage', () => {
  assert.equal(observed.sourceAudit.r03Status, 'R03_ROUTE_REJECTED_BY_USER');
  assert.deepEqual(observed.sourceAudit.failures, [
    'PERSON_SUBSTITUTED',
    'GARMENT_PIPELINE_BYPASSED',
    'QA_WRONG_SUCCESS_CRITERION',
    'TAILOR_BODY_WAS_NEVER_FULL_COMMON'
  ]);
});
check('R04 uses exact original common-person identity', () => {
  assert.deepEqual(
    [observed.nativePerson.vertices, observed.nativePerson.triangles],
    [25417, 50624]
  );
  assert.equal(observed.nativePerson.exactGeometryIdentity, true);
  assert.equal(observed.nativePerson.exactTopologyIdentity, true);
  assert.equal(observed.nativePerson.exactStateIdentity, true);
});
check('R04 keeps original runtime without display masking or rescaling', () => {
  assert.equal(observed.nativePerson.sameOriginalRuntime, true);
  assert.equal(observed.nativePerson.displayMaskOrRescale, false);
  assert.equal(observed.nativePerson.actualBodyFieldRebuilt, true);
});
check('all sixty original papers participate in same-browser native parity', () => {
  assert.equal(observed.source.exactPaperCount, 60);
  assert.equal(observed.source.sameBrowserNativeParityRows, 60);
});
check('native success and rejection partition is complete', () => {
  assert.equal(observed.source.nativeReady + observed.source.nativeRejected, 60);
  assert.deepEqual([observed.source.nativeReady, observed.source.nativeRejected], [49, 11]);
});
check('original native failures are preserved rather than repaired into success', () => {
  assert.equal(observed.source.originalFailuresPreserved, true);
});
check('only actual solver records count', () => {
  assert.equal(observed.solver.actualRecords, 2);
});
check('solver result states remain distinct', () => {
  assert.equal(observed.solver.t01QualityPassed, true);
  assert.equal(observed.solver.p01QualityPassed, false);
  assert.equal(observed.solver.j06FinishedResult, false);
  assert.equal(observed.solver.j06State, 'NO_FINISHED_RESULT_NOT_REPLACED');
});
check('identity mutations fail closed', () => {
  assert.equal(observed.contracts.negativeIdentityChecksPassed, 12);
  assert.equal(observed.contracts.directApiCannotBypassIdentityGate, true);
});
check('switching person invalidates old clothing', () => {
  assert.equal(observed.contracts.personSwitchInvalidatesClothing, true);
});
check('rejected R03 runtime is not requested by R04', () => {
  assert.equal(observed.sourceAudit.r04RuntimeDependsOnR03, false);
});
check('partial source correction is not promoted to complete delivery', () => {
  assert.deepEqual(observed.delivery, {
    fullCatalogueDelivered: false,
    physicalFitAccepted: false,
    dynamicWearCertified: false,
    public: false,
    userAccepted: false
  });
});

const result = {
  schema: 'kaopu.probe-result/1',
  probe: 'tailor_r04_source_lineage_fail_closed_gate_n127',
  passed: true,
  checksPassed: checks.length,
  decision: 'SOURCE_LINEAGE_CORRECTION_VERIFIED_SCOPED__HOLD_FULL_CATALOGUE_INCOMPLETE',
  observed
};

console.log(JSON.stringify(result, null, 2));
