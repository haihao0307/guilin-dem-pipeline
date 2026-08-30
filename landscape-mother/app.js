(() => {
'use strict';
const {
  elements, state, fetchJson, fetchBuffer, sha256Hex, assert, mobileRuntime,
  validateContract, validateDataManifest, updateMetrics, updateStatus, updateQa, showError,
} = window.LandscapeMotherAppCore;
const { setupUi, setMode, setView, setTier } = window.LandscapeMotherAppUi;

function loop(now) {
  if (state.renderer && state.renderer.dirty) {
    state.renderer.render(now);
    updateStatus();
    updateQa();
  }
  requestAnimationFrame(loop);
}

async function initialize() {
  setupUi();
  elements.loadingText.textContent = '读取 Landscape Mother V2 合同与字段知识索引';
  const [contract, dataManifest] = await Promise.all([
    fetchJson('./contract.json'),
    fetchJson('./data/sample-manifest.json'),
  ]);
  validateContract(contract);
  validateDataManifest(dataManifest, contract);
  state.contract = contract;
  state.dataManifest = dataManifest;

  elements.loadingText.textContent = '核对原生高程窗口与真实水系 SHA256';
  const [truthBuffer, waterBuffer] = await Promise.all([
    fetchBuffer(`./data/${dataManifest.truth.file}`),
    fetchBuffer(`./data/${dataManifest.hydrology.file}`),
  ]);
  assert(truthBuffer.byteLength === dataManifest.truth.bytes, 'truth byte count mismatch');
  assert(waterBuffer.byteLength === dataManifest.hydrology.bytes, 'hydrology byte count mismatch');
  const [truthSha, waterSha] = await Promise.all([
    sha256Hex(truthBuffer),
    sha256Hex(waterBuffer),
  ]);
  assert(truthSha === dataManifest.truth.sha256, 'truth SHA256 mismatch');
  assert(waterSha === dataManifest.hydrology.sha256, 'hydrology SHA256 mismatch');
  state.sourceFilesVerified = true;

  elements.loadingText.textContent = '编译连续字段图与真值保持型高密度网格';
  state.compiled = window.LandscapeMotherKernel.compile({
    contract,
    dataManifest,
    truthBuffer,
    waterBuffer,
    mobile: mobileRuntime(),
  });

  elements.loadingText.textContent = '编译结构综合色彩、连续水面与自适应 LOD';
  state.renderer = new window.LandscapeMotherRenderer.LandscapeMotherRenderer(
    elements.canvas,
    state.compiled,
  );
  state.renderer.setView('overview');
  updateMetrics();
  elements.loading.hidden = true;
  elements.errorBox.hidden = true;
  state.ready = true;
  updateQa();
  updateStatus();

  window.__LANDSCAPE_MOTHER_TEST_API__ = {
    getState: updateQa,
    setMode(mode) {
      setMode(mode);
      state.renderer.render(performance.now());
      return updateQa();
    },
    setView(view) {
      setView(view);
      state.renderer.render(performance.now());
      return updateQa();
    },
    setQualityTier(name) {
      setTier(name);
      state.renderer.render(performance.now());
      return updateQa();
    },
    setDetail(value) {
      state.renderer.detailMix = value ? 1 : 0;
      document.getElementById('detailToggle').checked = Boolean(value);
      state.renderer.dirty = true;
      return updateQa();
    },
    setWater(value) {
      state.renderer.showWater = Boolean(value);
      document.getElementById('waterToggle').checked = Boolean(value);
      state.renderer.dirty = true;
      return updateQa();
    },
    signature() {
      return state.renderer.signature();
    },
    orbit(dx, dy) {
      state.renderer.orbit(dx, dy);
      state.renderer.render(performance.now());
      return updateQa();
    },
    zoom(delta) {
      state.renderer.zoom(delta);
      state.renderer.render(performance.now());
      return updateQa();
    },
    interaction(active) {
      if (active) state.renderer.beginInteraction();
      else state.renderer.endInteraction();
      state.renderer.render(performance.now());
      return updateQa();
    },
  };
  requestAnimationFrame(loop);
}

initialize().catch(showError);
})();
