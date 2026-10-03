(() => {
'use strict';
const $ = id => document.getElementById(id);
const elements = {
  canvas: $('terrain'), loading: $('loading'), loadingText: $('loadingText'),
  errorBox: $('error'), errorText: $('errorText'), status: $('status'),
};
const runtimeErrors = [];
const state = {
  contract: null,
  dataManifest: null,
  compiled: null,
  renderer: null,
  pointers: new Map(),
  pinch: null,
  ready: false,
  sourceFilesVerified: false,
};
async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.json();
}
async function fetchBuffer(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.arrayBuffer();
}
async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function mobileRuntime() {
  const query = new URLSearchParams(location.search);
  if (query.get('quality') === 'desktop') return false;
  if (query.get('quality') === 'mobile') return true;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (coarse && Math.min(innerWidth, innerHeight) < 920);
}
function validateContract(contract) {
  assert(contract.schema === 'landscape-mother-kernel/v1', 'Landscape Mother contract schema mismatch');
  assert(contract.renderMode === 'interactive-webgl2-3d', 'render mode must be interactive WebGL2 3D');
  assert(contract.source.sourceTiffSha256 === '9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4', 'source TIFF identity mismatch');
  assert(contract.source.parentTileSha256 === '5408050e693e4a4679dd39fe96b473067dec515c23a7f53954c707e74e303215', 'parent tile identity mismatch');
  const rules = contract.rules;
  assert(rules.truthOverwrite === false, 'truth overwrite must remain false');
  assert(rules.sourceResampling === false, 'source resampling must remain false');
  assert(rules.syntheticGapFill === false, 'synthetic gap fill must remain false');
  assert(rules.verticalScale === 1, 'vertical scale must remain 1.0');
  assert(rules.proceduralMacroMountains === false, 'procedural macro mountains must remain disabled');
  assert(rules.materialTextureCount === 0 && rules.terrainImageTextureCount === 0, 'texture counts must remain zero');
  assert(rules.imageFileCount === 0 && rules.screenshotArtifactCount === 0, 'image counts must remain zero');
  assert(rules.plantLayerCount === 0 && rules.vegetationInstanceCount === 0, 'plant counts must remain zero');
  assert(rules.interactive3DRequired === true && rules.numericQaOnly === true, '3D and numeric QA gates are not enabled');
  assert(contract.approvals.visualAcceptance === false && contract.approvals.productionReady === false, 'approval flags changed');
}
function validateDataManifest(dataManifest, contract) {
  assert(dataManifest.schema === 'landscape-mother-sample-data/v1', 'sample data manifest schema mismatch');
  assert(dataManifest.sampleId === contract.id, 'sample ID mismatch');
  assert(dataManifest.truth.grid[0] === 81 && dataManifest.truth.grid[1] === 81, 'truth grid mismatch');
  assert(dataManifest.truth.spacingM === 12.5, 'truth spacing mismatch');
  assert(dataManifest.truth.sourcePixelWindowInteger === true, 'source pixel window is not integer');
  assert(dataManifest.truth.sourceNodeModified === false, 'source node modification flag changed');
  assert(dataManifest.hydrology.planimetryChanged === false, 'hydrology planimetry changed');
  assert(dataManifest.hydrology.manualWaterway === false && dataManifest.hydrology.syntheticWaterway === false, 'manual or synthetic waterway exists');
  const receipt = dataManifest.receipt;
  assert(receipt.sourceTiffSha256 === contract.source.sourceTiffSha256, 'data receipt source TIFF mismatch');
  assert(receipt.parentTileSha256 === contract.source.parentTileSha256, 'data receipt parent tile mismatch');
  assert(receipt.truthOverwrite === false && receipt.sourceResampling === false && receipt.syntheticGapFill === false, 'data receipt truth protection mismatch');
  assert(receipt.verticalScale === 1, 'data receipt vertical scale mismatch');
  assert(receipt.materialTextureCount === 0 && receipt.imageFileCount === 0 && receipt.plantLayerCount === 0, 'data receipt forbidden count is non-zero');
}
function updateMetrics() {
  const compiled = state.compiled;
  $('truthMetric').textContent = `${compiled.dataManifest.truth.grid[0]} × ${compiled.dataManifest.truth.grid[1]} · ${compiled.dataManifest.truth.spacingM} m`;
  $('renderMetric').textContent = `${compiled.grid} × ${compiled.grid} · ${compiled.spacing.toFixed(4)} m`;
  $('elevationMetric').textContent = `${compiled.minimum.toFixed(0)} 至 ${compiled.maximum.toFixed(0)} m`;
  $('surfaceMetric').textContent = `${compiled.receipt.surfaceRangeM[0].toFixed(2)} 至 +${compiled.receipt.surfaceRangeM[1].toFixed(2)} m`;
  $('fieldMetric').textContent = `${compiled.receipt.fieldRangeM[0].toFixed(2)} 至 +${compiled.receipt.fieldRangeM[1].toFixed(2)} m`;
  $('waterMetric').textContent = `${compiled.segments.length} 段`;
  $('packageMetric').textContent = `${((compiled.dataManifest.truth.bytes + compiled.dataManifest.hydrology.bytes) / 1024).toFixed(1)} KiB 数值资产`;
}
function updateStatus() {
  if (!state.renderer || !state.compiled) return;
  const names = ['Landscape Mother', '真实高程', '地貌结构', '田块关系', '湿度水系', '形成事件', '原始 / 合成对照'];
  const fps = state.renderer.averageFps();
  elements.status.textContent = `${names[state.renderer.mode]} · ${state.compiled.grid.toLocaleString()}² 三维网格 · 源节点误差 ${state.compiled.receipt.sourceNodeMaxErrorM.toExponential(1)} m · 宏观残差 ${state.compiled.receipt.macroBlurMaxAbsDeltaM.toFixed(3)} m${fps ? ` · ${fps.toFixed(1)} FPS` : ''}`;
}
function updateQa() {
  const compiled = state.compiled;
  const renderer = state.renderer;
  const qa = {
    schema: 'landscape-mother-browser-qa/v1',
    passed: Boolean(
      state.ready && state.sourceFilesVerified && renderer?.gl && compiled &&
      compiled.receipt.sourceNodeMaxErrorM <= state.contract.displacementBudget.sourceNodeMaxErrorM &&
      compiled.receipt.sourceCellMeanMaxAbsDeltaM <= state.contract.displacementBudget.sourceCellMeanAbsDeltaM &&
      compiled.receipt.macroBlurMaxAbsDeltaM <= state.contract.displacementBudget.macroBlurMaxAbsDeltaM &&
      compiled.receipt.peakShiftM <= state.contract.displacementBudget.peakShiftMaxM &&
      runtimeErrors.length === 0 && elements.loading.hidden && elements.errorBox.hidden
    ),
    sampleId: state.contract?.id || null,
    renderMode: 'interactive-webgl2-3d',
    webgl2Active: Boolean(renderer?.gl),
    sourceFilesVerified: state.sourceFilesVerified,
    truthGrid: compiled ? compiled.dataManifest.truth.grid.slice() : null,
    truthSpacingM: compiled?.dataManifest.truth.spacingM ?? null,
    renderGrid: compiled ? [compiled.grid, compiled.grid] : null,
    renderSpacingM: compiled?.spacing ?? null,
    subdivision: compiled?.subdivision ?? null,
    terrainVertexCount: renderer?.terrain.vertexCount ?? 0,
    terrainTriangleCount: renderer?.terrain.triangleCount ?? 0,
    sourceNodeMaxErrorM: compiled?.receipt.sourceNodeMaxErrorM ?? null,
    sourceCellMeanMaxAbsDeltaM: compiled?.receipt.sourceCellMeanMaxAbsDeltaM ?? null,
    macroBlurMaxAbsDeltaM: compiled?.receipt.macroBlurMaxAbsDeltaM ?? null,
    peakShiftM: compiled?.receipt.peakShiftM ?? null,
    surfaceRangeM: compiled?.receipt.surfaceRangeM ?? null,
    fieldRangeM: compiled?.receipt.fieldRangeM ?? null,
    paddyCoverage: compiled?.receipt.paddyCoverage ?? null,
    waterSegmentCount: compiled?.segments.length ?? 0,
    sourceResampling: false,
    truthOverwrite: false,
    syntheticGapFill: false,
    verticalScale: 1,
    proceduralMacroMountains: false,
    materialTextureCount: 0,
    terrainImageTextureCount: 0,
    imageFileCount: 0,
    screenshotArtifactCount: 0,
    plantLayerCount: 0,
    vegetationInstanceCount: 0,
    numericQaOnly: true,
    averageFps: renderer?.averageFps() ?? null,
    runtimeErrors: runtimeErrors.slice(),
    visualAcceptance: false,
    productionReady: false,
  };
  window.__LANDSCAPE_MOTHER_QA__ = qa;
  document.body.dataset.ready = String(qa.passed);
  document.body.dataset.visualAcceptance = 'false';
  document.body.dataset.productionReady = 'false';
  return qa;
}
function showError(error) {
  const message = String(error?.stack || error?.message || error);
  runtimeErrors.push(message);
  console.error(error);
  elements.loading.hidden = true;
  elements.errorText.textContent = message;
  elements.errorBox.hidden = false;
  updateQa();
}
window.addEventListener('error', event => {
  runtimeErrors.push(String(event.error?.stack || event.message || 'window error'));
  updateQa();
});
window.addEventListener('unhandledrejection', event => {
  runtimeErrors.push(String(event.reason?.stack || event.reason || 'unhandled rejection'));
  updateQa();
});
window.LandscapeMotherAppCore = Object.freeze({
  $, elements, runtimeErrors, state, fetchJson, fetchBuffer, sha256Hex, assert,
  mobileRuntime, validateContract, validateDataManifest, updateMetrics, updateStatus,
  updateQa, showError,
});
})();
