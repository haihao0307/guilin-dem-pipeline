import assert from 'node:assert/strict';

const expectedPresetIds = [
  ...Array.from({length: 18}, (_, i) => `T${String(i + 1).padStart(2, '0')}`),
  ...Array.from({length: 10}, (_, i) => `P${String(i + 1).padStart(2, '0')}`),
  ...Array.from({length: 14}, (_, i) => `S${String(i + 1).padStart(2, '0')}`),
  ...Array.from({length: 12}, (_, i) => `D${String(i + 1).padStart(2, '0')}`),
  ...Array.from({length: 6}, (_, i) => `J${String(i + 1).padStart(2, '0')}`)
];

const observed = {
  correction: {
    id: 'TAILOR-P01-3D-THUMBNAILS-20261009T1320+08',
    time: '2026-10-09T13:20:25+08:00',
    requires3DGarmentThumbnail: true,
    simplePlasticDisplayMannequinAllowed: true,
    realHumanRequired: false,
    interactiveWebGLPerCardRequired: false,
    paperThumbnailForbiddenAsSubstitute: true
  },
  preCorrectionRun: {
    id: 37881219569,
    headSha: '637ef1f9bad233cfed06e7d191fe15263b378bbc',
    completedAt: '2026-10-09T12:10:52+08:00',
    conclusion: 'success',
    assertedThumbnailType: 'paper',
    artifact: {
      id: 11595152743,
      digest: 'sha256:471a1cd516dede9e0b8d3b47de4af8378ec6a14d323552578d47b1df38372c8a'
    }
  },
  currentPublic: {
    ghPagesHead: '716631d614e9dc73eab7a1551f3e925da9adc485',
    indexBlob: '6e82c4bec45fa4ae3a7694317aca9c0a7b8072e5',
    appBlob: '6792673b3c8ec551b4b7cc585fe611ac5494fe0e',
    cardCount: 60,
    thumbnailType: 'paper-svg',
    paperSvgThumbnailCount: 60,
    threeDMemberReceipts: [],
    sourceSignals: {
      paperSVG: 3,
      WebGL: 0,
      THREE: 0,
      canvas: 0,
      mannequin: 0,
      modelViewer: 0
    },
    statement: '缩略图来自真实纸样，不是成衣照片'
  },
  boundaries: {
    physicalFitAccepted: false,
    dynamicWearCertified: false,
    physicalMobileDeviceTested: false,
    userAccepted: false
  }
};

function memberComplete(row) {
  return Boolean(
    row?.presetId && row?.designOrPaperIdentity && row?.garmentGeometryIdentity &&
    row?.displayMannequinIdentity && row?.cameraAndRenderConfigIdentity &&
    row?.thumbnailDigest && row?.cardReadbackResult === 'pass'
  );
}

function evaluate(receipt) {
  if (receipt.preCorrectionRun.completedAt >= receipt.correction.time ||
      receipt.preCorrectionRun.assertedThumbnailType !== 'paper') {
    return 'HOLD_OBSERVATION_FIXTURE_INVALID';
  }
  if (receipt.currentPublic.thumbnailType === 'paper-svg') {
    return 'REJECTED_WRONG_TARGET_PAPER_THUMBNAIL';
  }
  const rows = receipt.currentPublic.threeDMemberReceipts ?? [];
  if (rows.length !== expectedPresetIds.length ||
      expectedPresetIds.some(id => !rows.some(row => row.presetId === id))) {
    return 'HOLD_COLLECTION_MEMBER_COVERAGE_INCOMPLETE';
  }
  if (rows.some(row => !memberComplete(row))) {
    return 'HOLD_THREE_D_THUMBNAIL_IDENTITY_INCOMPLETE';
  }
  return 'THREE_D_PRESET_THUMBNAILS_VERIFIED_SCOPED';
}

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

check('binds exactly 60 expected preset members', () => {
  assert.equal(expectedPresetIds.length, 60);
  assert.equal(new Set(expectedPresetIds).size, 60);
});
check('binds the successful pre-correction run and immutable artifact', () => {
  assert.equal(observed.preCorrectionRun.id, 37881219569);
  assert.equal(observed.preCorrectionRun.conclusion, 'success');
  assert.match(observed.preCorrectionRun.artifact.digest, /^sha256:[a-f0-9]{64}$/);
});
check('proves the successful run predates the user correction', () => {
  assert.ok(observed.preCorrectionRun.completedAt < observed.correction.time);
  assert.equal(observed.preCorrectionRun.assertedThumbnailType, 'paper');
});
check('binds the current public subject and paper-only implementation', () => {
  assert.equal(observed.currentPublic.paperSvgThumbnailCount, 60);
  assert.equal(observed.currentPublic.thumbnailType, 'paper-svg');
  assert.equal(observed.currentPublic.sourceSignals.WebGL, 0);
  assert.equal(observed.currentPublic.sourceSignals.mannequin, 0);
});
check('keeps the real current subject rejected only for the corrected target', () => {
  assert.equal(evaluate(observed), 'REJECTED_WRONG_TARGET_PAPER_THUMBNAIL');
});
check('preserves old scoped paper success as a separate state', () => {
  assert.equal(observed.preCorrectionRun.conclusion, 'success');
  assert.equal(observed.preCorrectionRun.assertedThumbnailType, 'paper');
});
check('rejects a partial 3D collection', () => {
  const partial = structuredClone(observed);
  partial.currentPublic.thumbnailType = '3d-render';
  partial.currentPublic.threeDMemberReceipts = expectedPresetIds.slice(0, 59).map(presetId => ({presetId}));
  assert.equal(evaluate(partial), 'HOLD_COLLECTION_MEMBER_COVERAGE_INCOMPLETE');
});
check('rejects 60 members missing derivation identity', () => {
  const incomplete = structuredClone(observed);
  incomplete.currentPublic.thumbnailType = '3d-render';
  incomplete.currentPublic.threeDMemberReceipts = expectedPresetIds.map(presetId => ({presetId}));
  assert.equal(evaluate(incomplete), 'HOLD_THREE_D_THUMBNAIL_IDENTITY_INCOMPLETE');
});
check('allows static rendered thumbnails without requiring per-card WebGL', () => {
  assert.equal(observed.correction.interactiveWebGLPerCardRequired, false);
  assert.equal(observed.correction.simplePlasticDisplayMannequinAllowed, true);
});
check('allows scoped pass only for synthetic 60 of 60 traceable 3D members', () => {
  const allPass = structuredClone(observed);
  allPass.currentPublic.thumbnailType = '3d-render';
  allPass.currentPublic.threeDMemberReceipts = expectedPresetIds.map(presetId => ({
    presetId,
    designOrPaperIdentity: `design:${presetId}`,
    garmentGeometryIdentity: `geometry:${presetId}`,
    displayMannequinIdentity: 'mannequin:simple-plastic-v1',
    cameraAndRenderConfigIdentity: 'render:catalogue-front-v1',
    thumbnailDigest: `sha256:${presetId.toLowerCase().padEnd(64, '0')}`,
    cardReadbackResult: 'pass'
  }));
  assert.equal(evaluate(allPass), 'THREE_D_PRESET_THUMBNAILS_VERIFIED_SCOPED');
});

const result = {
  schema: 'kaopu.learning-probe-result/1',
  probe: 'tailor-p01-3d-thumbnail-correction-n124',
  pass: true,
  checksPassed: checks.length,
  checksTotal: 10,
  checks,
  decision: 'REJECTED_WRONG_TARGET_PAPER_THUMBNAIL',
  priorContractState: 'PAPER_PRESET_LIBRARY_VERIFIED_SCOPED_PRE_CORRECTION',
  currentContractState: 'NO_NEW_3D_THUMBNAIL_ARTIFACT',
  causalState: 'PAPER_CONTRACT_PASSED_BEFORE_3D_THUMBNAIL_CORRECTION_CURRENT_PUBLIC_STILL_PAPER_ONLY',
  novelty: 'NEW_USER_CORRECTION_REGRESSION_TAILOR_ONLY_NO_GLOBAL_RULE_CHANGE',
  observed,
  lifecycle: {
    POSTED: true,
    ACKNOWLEDGED: false,
    IMPLEMENTED: true,
    'GATE-RUN': true,
    ADOPTED: false,
    'USER-ACCEPTED': false
  }
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
