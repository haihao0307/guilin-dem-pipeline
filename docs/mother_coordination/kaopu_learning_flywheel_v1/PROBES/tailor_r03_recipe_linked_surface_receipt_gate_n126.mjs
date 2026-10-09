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
    pullRequest: 181,
    baseSha: 'a9148f6860b9fa9f892b97456f4601c34ea95e04',
    headSha: '5078d8aa9487b1b2c37d67701737ff963c7bd3cd',
    sourceSha: 'ae2332f583e1bd756ea0083088796c327854e05b',
    validationRun: 37908255289,
    publicRun: 37909309435,
    pagesRun: 37909744414,
    publicVerified: true,
    publicCheckCount: 21,
    publicBytesChecked: 90,
    originalCount: 60,
    combinationCount: 432
  },
  implementation: {
    branchBaseIsRejectedR02Head: true,
    runtimeImportsR02GarmentGeometry: false,
    sourcePaperIdentityPresent: true,
    sourceRecipeIdentityPresent: true,
    sourceDesignValuesConsumedByRenderer: true,
    continuousClippedShells: true,
    closedPrimitiveGarments: false,
    originalMannequinTopologyPreserved: true,
    mannequinVertices: 13718,
    mannequinTriangles: 27420,
    actualPaperPanelsOrSeamsConsumedByRenderer: false,
    actualSewnGarmentGeometryConsumedByRenderer: false
  },
  qa: {
    allOriginalThumbnailsRendered: true,
    distinctThumbnailCount: 60,
    distinctOriginalGeometrySignatures: 60,
    allCombinationGeometriesBuilt: true,
    everyPresetHasConnectedShell: true,
    publicCardReadbackAggregate: true,
    // PUBLIC_REPORT contains one id/vertex/triangle/signature row per original,
    // but does not join those rows to the remaining required receipt identities.
    perMemberRows: expectedPresetIds.map(presetId => ({
      presetId,
      aggregateReportHasGeometryMetrics: true
    }))
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
  if (!impl.sourceDesignValuesConsumedByRenderer || !impl.continuousClippedShells || impl.closedPrimitiveGarments) {
    return 'REJECTED_CREATIVE_SUBSTITUTE_SIMPLIFIED_PROXY_GARMENT';
  }
  const rows = receipt.qa.perMemberRows ?? [];
  if (rows.length !== expectedPresetIds.length || expectedPresetIds.some(id => !rows.some(row => row.presetId === id))) {
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

check('binds the exact PR181 production subject', () => {
  assert.equal(observed.subject.pullRequest, 181);
  assert.match(observed.subject.headSha, /^[a-f0-9]{40}$/);
  assert.match(observed.subject.sourceSha, /^[a-f0-9]{40}$/);
});
check('preserves the three successful workflow scopes', () => {
  assert.equal(observed.subject.publicVerified, true);
  assert.equal(observed.subject.publicCheckCount, 21);
  assert.equal(observed.subject.publicBytesChecked, 90);
});
check('preserves all sixty originals and 432 source-linked combinations', () => {
  assert.equal(observed.subject.originalCount, 60);
  assert.equal(observed.subject.combinationCount, 432);
});
check('proves the renderer now consumes preset design values', () => {
  assert.equal(observed.implementation.sourcePaperIdentityPresent, true);
  assert.equal(observed.implementation.sourceRecipeIdentityPresent, true);
  assert.equal(observed.implementation.sourceDesignValuesConsumedByRenderer, true);
});
check('proves R03 no longer uses closed primitive garments', () => {
  assert.equal(observed.implementation.branchBaseIsRejectedR02Head, true);
  assert.equal(observed.implementation.runtimeImportsR02GarmentGeometry, false);
  assert.equal(observed.implementation.continuousClippedShells, true);
  assert.equal(observed.implementation.closedPrimitiveGarments, false);
});
check('preserves the actual mannequin topology fact', () => {
  assert.equal(observed.implementation.mannequinVertices, 13718);
  assert.equal(observed.implementation.mannequinTriangles, 27420);
});
check('preserves aggregate visual and geometry coverage', () => {
  assert.equal(observed.qa.distinctThumbnailCount, 60);
  assert.equal(observed.qa.distinctOriginalGeometrySignatures, 60);
  assert.equal(observed.qa.everyPresetHasConnectedShell, true);
});
check('does not confuse recipe-linked display surfaces with sewn paper-panel geometry', () => {
  assert.equal(observed.implementation.actualPaperPanelsOrSeamsConsumedByRenderer, false);
  assert.equal(observed.implementation.actualSewnGarmentGeometryConsumedByRenderer, false);
});
check('holds the real PR181 subject because per-member receipts are incomplete', () => {
  assert.equal(evaluate(observed), 'HOLD_THREE_D_THUMBNAIL_IDENTITY_INCOMPLETE');
});
check('aggregate unique signatures alone cannot satisfy the member receipt', () => {
  assert.equal(observed.qa.perMemberRows.every(memberComplete), false);
});
check('allows a scoped pass when the same sixty members carry complete immutable receipts', () => {
  const complete = structuredClone(observed);
  complete.qa.perMemberRows = expectedPresetIds.map((presetId, i) => ({
    presetId,
    designOrPaperIdentity: `paper-sha256:${i.toString(16).padStart(64, '1')}`,
    garmentGeometryIdentity: `geometry-sha256:${i.toString(16).padStart(64, '2')}`,
    garmentGeometryDerivation: 'actual-preset-specific',
    displayMannequinIdentity: 'mannequin:anny-display-pose-r03',
    cameraAndRenderConfigIdentity: 'renderer:r03.4-pcf-catalogue',
    thumbnailDigest: `sha256:${i.toString(16).padStart(64, '3')}`,
    cardReadbackResult: 'pass'
  }));
  assert.equal(evaluate(complete), 'THREE_D_PRESET_THUMBNAILS_VERIFIED_SCOPED');
});
check('keeps physics device and user acceptance outside this gate', () => {
  assert.deepEqual(observed.boundaries, {
    physicalFitAccepted: false,
    dynamicWearCertified: false,
    physicalMobileDeviceTested: false,
    userAccepted: false
  });
});

const result = {
  schema: 'kaopu.learning-probe-result/1',
  probe: 'tailor-r03-recipe-linked-surface-receipt-gate-n126',
  pass: true,
  checksPassed: checks.length,
  checksTotal: 12,
  checks,
  decision: 'HOLD_THREE_D_THUMBNAIL_IDENTITY_INCOMPLETE',
  preservedTechnicalState: 'RECIPE_LINKED_CONTINUOUS_SURFACE_CABINET_PUBLIC_VERIFIED_SCOPED',
  supersededFailureState: 'REJECTED_CREATIVE_SUBSTITUTE_SIMPLIFIED_PROXY_GARMENT',
  currentContractState: 'SIXTY_ACTUAL_GARMENT_THUMBNAIL_RECEIPTS_INCOMPLETE',
  novelty: 'NO_NEW_GLOBAL_RULE_EXISTING_N124_CASE_UPDATED_WITH_R03_BOUNDARY_RESULT',
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
