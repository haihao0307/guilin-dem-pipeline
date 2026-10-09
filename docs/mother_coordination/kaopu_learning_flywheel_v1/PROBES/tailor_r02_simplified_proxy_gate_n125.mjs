import assert from 'node:assert/strict';

const expectedPresetIds = [
  ...Array.from({length: 18}, (_, i) => `T${String(i + 1).padStart(2, '0')}`),
  ...Array.from({length: 10}, (_, i) => `P${String(i + 1).padStart(2, '0')}`),
  ...Array.from({length: 14}, (_, i) => `S${String(i + 1).padStart(2, '0')}`),
  ...Array.from({length: 12}, (_, i) => `D${String(i + 1).padStart(2, '0')}`),
  ...Array.from({length: 6}, (_, i) => `J${String(i + 1).padStart(2, '0')}`)
];

const observed = {
  subject: {
    pullRequest: 180,
    sourceSha: '4ca3569f763fc4dae361d905c8d4696f2f56709f',
    headSha: 'a9148f6860b9fa9f892b97456f4601c34ea95e04',
    workflowRun: 37896825675,
    workflowConclusion: 'success',
    publicVerified: true,
    thumbnailCount: 60,
    thumbnailRuntime: 'real-webgl-cached-images',
    activeDetailCanvasCount: 1,
    declaredMannequin: 'simple-plastic-r02'
  },
  implementation: {
    selectionInputs: ['category', 'style', 'design-overrides'],
    primitiveSignals: ['SphereGeometry', 'CylinderGeometry', 'ConeGeometry', 'BoxGeometry', 'authored-skirt-surface'],
    garmentBuilders: ['topGarment', 'skirtGarment', 'pantsGarment'],
    rendererConsumes: {
      paperAsset: false,
      recipeHash: false,
      geometryHash: false,
      panels: false,
      seams: false,
      actualSewnGarmentGeometry: false
    },
    paperTabSeparate: true,
    perMemberGarmentGeometryReceipts: []
  },
  qa: {
    assertsThumbnailCount: true,
    assertsWebGLDataUrl: true,
    assertsSingleActiveCanvas: true,
    assertsSeparatePaperTabLoads: true,
    assertsPaperTo3DGeometryDerivation: false,
    assertsUserVisualAcceptance: false
  },
  latestUserCorrection: {
    observedAfterR02Delivery: true,
    simplifiedVersionAccepted: false,
    generatedImageSubstituteAllowed: false,
    githubSourceChangeRequired: true
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
    row?.garmentGeometryDerivation === 'actual-preset-specific' &&
    row?.displayMannequinIdentity && row?.cameraAndRenderConfigIdentity &&
    /^sha256:[a-f0-9]{64}$/.test(row?.thumbnailDigest ?? '') &&
    row?.cardReadbackResult === 'pass'
  );
}

function evaluate(receipt) {
  const impl = receipt.implementation;
  const consumesActualGeometry = Object.values(impl.rendererConsumes).some(Boolean);
  const rows = impl.perMemberGarmentGeometryReceipts ?? [];
  if (!consumesActualGeometry && impl.primitiveSignals.length > 0) {
    return 'REJECTED_CREATIVE_SUBSTITUTE_SIMPLIFIED_PROXY_GARMENT';
  }
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

check('binds the exact PR180 production subject', () => {
  assert.equal(observed.subject.pullRequest, 180);
  assert.match(observed.subject.sourceSha, /^[a-f0-9]{40}$/);
  assert.match(observed.subject.headSha, /^[a-f0-9]{40}$/);
});
check('preserves the real public WebGL technical success', () => {
  assert.equal(observed.subject.workflowConclusion, 'success');
  assert.equal(observed.subject.publicVerified, true);
  assert.equal(observed.subject.thumbnailRuntime, 'real-webgl-cached-images');
});
check('preserves all sixty generated card renders', () => {
  assert.equal(expectedPresetIds.length, 60);
  assert.equal(observed.subject.thumbnailCount, 60);
});
check('binds the simplified primitive construction path', () => {
  assert.deepEqual(observed.implementation.garmentBuilders, ['topGarment', 'skirtGarment', 'pantsGarment']);
  assert.ok(observed.implementation.primitiveSignals.includes('CylinderGeometry'));
});
check('proves the renderer does not consume actual paper or sewn garment geometry', () => {
  assert.equal(Object.values(observed.implementation.rendererConsumes).some(Boolean), false);
});
check('does not treat a separate paper tab as a paper-to-3D derivation receipt', () => {
  assert.equal(observed.implementation.paperTabSeparate, true);
  assert.equal(observed.qa.assertsPaperTo3DGeometryDerivation, false);
});
check('binds the post-delivery user rejection of the simplified version', () => {
  assert.equal(observed.latestUserCorrection.observedAfterR02Delivery, true);
  assert.equal(observed.latestUserCorrection.simplifiedVersionAccepted, false);
});
check('rejects the real PR180 subject as a simplified proxy garment', () => {
  assert.equal(evaluate(observed), 'REJECTED_CREATIVE_SUBSTITUTE_SIMPLIFIED_PROXY_GARMENT');
});
check('keeps WebGL and public-byte success as scoped evidence rather than deleting it', () => {
  assert.equal(observed.subject.publicVerified, true);
  assert.equal(observed.qa.assertsWebGLDataUrl, true);
});
check('rejects sixty distinct images when garment geometry receipts are still absent', () => {
  const proxy = structuredClone(observed);
  proxy.implementation.rendererConsumes.paperAsset = true;
  assert.equal(evaluate(proxy), 'HOLD_COLLECTION_MEMBER_COVERAGE_INCOMPLETE');
});
check('allows scoped pass only for sixty actual preset-specific derivation receipts', () => {
  const actual = structuredClone(observed);
  actual.implementation.rendererConsumes.actualSewnGarmentGeometry = true;
  actual.implementation.perMemberGarmentGeometryReceipts = expectedPresetIds.map((presetId, i) => ({
    presetId,
    designOrPaperIdentity: `paper:${presetId}`,
    garmentGeometryIdentity: `garment:${presetId}`,
    garmentGeometryDerivation: 'actual-preset-specific',
    displayMannequinIdentity: 'mannequin:simple-plastic-v2',
    cameraAndRenderConfigIdentity: 'camera:catalogue-v2',
    thumbnailDigest: `sha256:${i.toString(16).padStart(64, '0')}`,
    cardReadbackResult: 'pass'
  }));
  assert.equal(evaluate(actual), 'THREE_D_PRESET_THUMBNAILS_VERIFIED_SCOPED');
});
check('does not promote thumbnail evidence into physics device or user acceptance', () => {
  assert.deepEqual(observed.boundaries, {
    physicalFitAccepted: false,
    dynamicWearCertified: false,
    physicalMobileDeviceTested: false,
    userAccepted: false
  });
});

const result = {
  schema: 'kaopu.learning-probe-result/1',
  probe: 'tailor-r02-simplified-proxy-gate-n125',
  pass: true,
  checksPassed: checks.length,
  checksTotal: 12,
  checks,
  decision: 'REJECTED_CREATIVE_SUBSTITUTE_SIMPLIFIED_PROXY_GARMENT',
  preservedTechnicalState: 'WEBGL_PROXY_CABINET_VERIFIED_SCOPED',
  currentContractState: 'SIXTY_ACTUAL_GARMENT_THUMBNAILS_NOT_ESTABLISHED',
  causalState: 'REAL_WEBGL_BUT_CATEGORY_STYLE_PRIMITIVES_NOT_ACTUAL_PRESET_GARMENT_GEOMETRY',
  novelty: 'NO_NOVELTY_EXISTING_N124_REGRESSION_UPDATED_WITH_REAL_COUNTEREXAMPLE',
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
