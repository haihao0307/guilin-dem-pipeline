(() => {
'use strict';
const base = window.LandscapeMotherAppCore;
if (!base) throw new Error('Landscape Mother application core is missing');

function validateContract(contract) {
  base.validateContract(contract);
  base.assert(contract.version === '2.0.0', 'Landscape Mother V2 contract version mismatch');
  base.assert(contract.fieldGraph?.version === '1.0.0', 'procedural field graph version mismatch');
  base.assert(contract.knowledgeIntegration?.gaeaTerrainFieldGraph?.commit === '6ac47d984bfca8336a7c0f58d176ab8153db26cd', 'GAEA knowledge commit mismatch');
  base.assert(contract.knowledgeIntegration?.proceduralFieldMini?.archiveSha256 === 'd69ecd2677507db9342a1d66092a8d6cf4255141346b14cc4629303bf1c4f396', 'procedural field knowledge archive mismatch');
  const requiredSeeds = ['master', 'shape', 'warp', 'structure', 'damage', 'color', 'weather', 'micro'];
  for (const name of requiredSeeds) base.assert(Number.isInteger(contract.seedBank?.[name]), `seed channel ${name} is missing`);
  base.assert(contract.waterContinuity?.realCenterlineImmutable === true, 'real water centerline immutability is not enabled');
  base.assert(contract.runtimeTiers?.preview && contract.runtimeTiers?.review && contract.runtimeTiers?.evidence, 'Preview/Review/Evidence tiers are incomplete');
}

function updateStatus() {
  base.updateStatus();
  const renderer = base.state.renderer;
  const compiled = base.state.compiled;
  if (!renderer || !compiled) return;
  const suffix = [
    `字段图 ${compiled.receipt.fieldGraphVersion}`,
    `${renderer.effectiveQualityTier?.() || renderer.qualityTier || 'review'} 档`,
    `${(renderer.terrain?.activeTriangleCount || 0).toLocaleString()} 三角形`,
    `连续水面连接 ${renderer.water?.joinCount || 0}`,
  ].join(' · ');
  base.elements.status.textContent = `${base.elements.status.textContent} · ${suffix}`;
}

function updateQa() {
  const qa = base.updateQa();
  const renderer = base.state.renderer;
  const compiled = base.state.compiled;
  if (!qa || !renderer || !compiled) return qa;
  Object.assign(qa, {
    runtimeVersion: '2.0.0',
    fieldGraphVersion: compiled.receipt.fieldGraphVersion,
    fieldGraphHash: compiled.receipt.fieldGraphHash,
    fieldGraphPipeline: compiled.receipt.fieldPipeline,
    diagnosticFieldCount: compiled.receipt.diagnosticFieldCount,
    seedChannelCount: compiled.receipt.seedChannelCount,
    seedBank: compiled.receipt.seedBank,
    eventDeltaRangeM: compiled.receipt.eventDeltaRangeM,
    parentMaskRange: compiled.receipt.parentMaskRange,
    processMaskRange: compiled.receipt.processMaskRange,
    knowledgeArchiveSha256: compiled.knowledgeArchiveSha256,
    gaeaKnowledgeCommit: base.state.contract.knowledgeIntegration.gaeaTerrainFieldGraph.commit,
    qualityTier: renderer.qualityTier,
    effectiveQualityTier: renderer.effectiveQualityTier(),
    runtimeTierCount: Object.keys(window.LandscapeMotherRuntimeV2?.tiers || {}).length,
    evidenceTriangleCount: renderer.terrain?.triangleCount || 0,
    activeTriangleCount: renderer.terrain?.activeTriangleCount || 0,
    waterJoinCount: renderer.water?.joinCount || 0,
    waterVisualGapCount: renderer.water?.visualGapCount ?? null,
    riverContinuityPass: renderer.water?.continuityPass === true,
    sourceFieldImmutable: true,
    correlatedEventChannels: ['geometry', 'albedo', 'roughness', 'normal', 'ao'],
    truthApproved: false,
    visualApproved: false,
  });
  qa.passed = Boolean(
    qa.passed &&
    qa.runtimeVersion === '2.0.0' &&
    qa.fieldGraphVersion === '1.0.0' &&
    qa.diagnosticFieldCount >= 24 &&
    qa.seedChannelCount === 8 &&
    qa.runtimeTierCount === 3 &&
    qa.riverContinuityPass &&
    qa.waterVisualGapCount === 0 &&
    qa.knowledgeArchiveSha256 === 'd69ecd2677507db9342a1d66092a8d6cf4255141346b14cc4629303bf1c4f396'
  );
  window.__LANDSCAPE_MOTHER_QA__ = qa;
  document.body.dataset.ready = String(qa.passed);
  document.body.dataset.visualAcceptance = 'false';
  document.body.dataset.productionReady = 'false';
  return qa;
}

window.LandscapeMotherAppCore = Object.freeze({
  ...base,
  validateContract,
  updateStatus,
  updateQa,
});
})();
