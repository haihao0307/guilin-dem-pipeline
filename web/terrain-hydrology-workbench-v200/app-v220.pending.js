import { TerrainRenderer } from './renderer.js?v=220';
import { initializeIntake } from './intake.js?v=210';

const response = await fetch('./manifest.json', { cache: 'no-store' });
if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
const manifest = await response.json();

let referencePayload = { demos: [] };
try {
  const referenceResponse = await fetch('./guilin-reference-demo.json', { cache: 'no-store' });
  if (referenceResponse.ok) referencePayload = await referenceResponse.json();
} catch (error) {
  console.warn('reference demo manifest unavailable', error);
}

const referenceDemos = new Map((referencePayload.demos || []).map((demo) => [demo.regionId, demo]));
const state = {
  manifest,
  referencePayload,
  referenceDemos,
  viewers: new Map(),
  cards: new Map(),
  focusViewer: null,
  activeRegion: null,
  activeReferenceDemo: null,
  ready: false,
  failures: [],
};
window.__TERRAIN_HYDROLOGY_WORKBENCH_V200__ = state;

function createRegionCard(region) {
  const fragment = document.getElementById('regionTemplate').content.cloneNode(true);
  const card = fragment.querySelector('.region-card');
  const demo = referenceDemos.get(region.id) || null;
  card.id = region.id;
  card.dataset.region = region.id;
  card.dataset.referenceDemo = demo ? 'true' : 'false';
  card.querySelector('[data-code]').textContent = region.code;
  card.querySelector('[data-title]').textContent = region.title;
  card.querySelector('[data-subtitle]').textContent = region.subtitle;
  card.querySelector('[data-truth-badge]').textContent = region.truthLabel;
  card.querySelector('[data-window]').textContent = `${region.world.widthMeters.toLocaleString('zh-CN')} m × ${region.world.heightMeters.toLocaleString('zh-CN')} m`;
  card.querySelector('[data-source]').textContent = region.sourceSummary;
  card.querySelector('[data-mesh]').textContent = `卡片 ${region.render.cardMesh}²，单独查看桌面 1025²，移动 513²，镜头中心自适应局部网格`;
  card.querySelector('[data-hydro]').textContent = region.hydrology.summary;
  card.querySelector('[data-intake-title]').textContent = `${region.title}参考资料`;
  card.querySelector('[data-path]').textContent = region.knowledgePath;
  const distance = card.querySelector('[data-distance]');
  const grid = card.querySelector('[data-grid]');
  const metrics = {
    set textContent(value) {
      const parts = value.split(' · ');
      distance.textContent = parts[0] || '';
      grid.textContent = parts.slice(1).join(' · ');
    },
  };
  const viewer = new TerrainRenderer(card.querySelector('[data-canvas]'), region, {
    readout: card.querySelector('[data-readout]'),
    metrics,
    fallback: card.querySelector('[data-fallback]'),
  });
  card.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
    viewer.setMode(button.dataset.mode);
    card.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
  }));
  card.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => viewer.configureCamera(button.dataset.view)));
  card.querySelector('[data-focus]').addEventListener('click', () => openFocus(region));
  const referenceButton = card.querySelector('[data-reference-demo]');
  if (demo) {
    referenceButton.hidden = false;
    referenceButton.addEventListener('click', () => openFocus(region, { initialMode: 'reference' }));
  }
  initializeIntake(card.querySelector('.region-intake'), region.id, region.knowledgePath);
  state.cards.set(region.id, card);
  state.viewers.set(region.id, viewer);
  return { card, viewer };
}

function populateReferencePanel(demo, visible) {
  const panel = document.getElementById('focusReferencePanel');
  const modeButton = document.getElementById('focusReferenceMode');
  if (!demo) {
    panel.hidden = true;
    modeButton.hidden = true;
    return;
  }
  modeButton.hidden = false;
  panel.hidden = !visible;
  panel.querySelector('[data-reference-title]').textContent = demo.title;
  panel.querySelector('[data-reference-window]').textContent = `${demo.window.widthMeters.toLocaleString('zh-CN')} m × ${demo.window.heightMeters.toLocaleString('zh-CN')} m · ${demo.window.crs}`;
  panel.querySelector('[data-reference-precision]').textContent = `真实高程 ${demo.rendering.truthSpacingMeters} m · 视觉三角约 ${demo.rendering.visualTriangleSpacingMeters.toFixed(2)} m · 候选微地形上限 ±${demo.rendering.microDeltaMaxMeters.toFixed(1)} m`;
  panel.querySelector('[data-reference-boundary]').textContent = '真实高程和批准水系保持只读。当前层只展示参考图约束的可逆形态与地表响应，尚未取得视觉批准。';
  const list = panel.querySelector('[data-reference-rules]');
  list.replaceChildren(...demo.rulesApplied.map((rule) => {
    const item = document.createElement('li');
    item.textContent = rule;
    return item;
  }));
}

function setFocusMode(modeName) {
  if (!state.focusViewer) return;
  if (modeName === 'reference' && !state.activeReferenceDemo) return;
  state.focusViewer.setMode(modeName);
  document.querySelectorAll('[data-focus-mode]').forEach((item) => item.classList.toggle('active', item.dataset.focusMode === modeName));
  populateReferencePanel(state.activeReferenceDemo, modeName === 'reference');
}

async function openFocus(region, options = {}) {
  const dialog = document.getElementById('focusDialog');
  if (state.focusViewer) state.focusViewer.dispose();
  const demo = referenceDemos.get(region.id) || null;
  state.activeRegion = region.id;
  state.activeReferenceDemo = demo;
  const initialMode = options.initialMode === 'reference' && demo ? 'reference' : 'terrain';
  document.getElementById('focusTitle').textContent = initialMode === 'reference'
    ? `${demo.title} · 在线示范`
    : `${region.title} · 单独精细查看`;
  document.getElementById('focusLineage').textContent = initialMode === 'reference'
    ? `${region.truthLabel}。${demo.window.selectionReason} z_truth_m 保持只读。`
    : `${region.truthLabel}。${region.lineage}`;
  const canvas = document.getElementById('focusCanvas');
  const fallback = document.getElementById('focusFallback');
  canvas.hidden = false;
  fallback.hidden = true;
  populateReferencePanel(demo, initialMode === 'reference');
  dialog.showModal();
  const viewer = new TerrainRenderer(canvas, region, {
    focus: true,
    referenceDemo: demo,
    readout: document.getElementById('focusReadout'),
    metrics: document.getElementById('focusMetrics'),
    fallback,
  });
  state.focusViewer = viewer;
  await viewer.load();
  if (initialMode === 'reference') viewer.configureReferenceDemo(demo);
  setFocusMode(initialMode);
}

function closeFocus() {
  if (state.focusViewer) {
    state.focusViewer.dispose();
    state.focusViewer = null;
  }
  state.activeRegion = null;
  state.activeReferenceDemo = null;
  document.getElementById('focusReferencePanel').hidden = true;
  document.getElementById('focusDialog').close();
}

document.getElementById('closeFocus').addEventListener('click', closeFocus);
document.getElementById('focusDialog').addEventListener('cancel', (event) => {
  event.preventDefault();
  closeFocus();
});
document.querySelectorAll('[data-focus-mode]').forEach((button) => button.addEventListener('click', () => setFocusMode(button.dataset.focusMode)));
document.querySelectorAll('[data-focus-view]').forEach((button) => button.addEventListener('click', () => state.focusViewer?.configureCamera(button.dataset.focusView)));
window.addEventListener('keydown', (event) => {
  if (!state.focusViewer) return;
  if (event.key === '1') state.focusViewer.configureCamera('overview');
  if (event.key === '2') state.focusViewer.configureCamera('near');
  if (event.key === '3') state.focusViewer.configureCamera('ground');
  if (event.key === '4' && state.activeReferenceDemo) {
    state.focusViewer.configureReferenceDemo(state.activeReferenceDemo);
    setFocusMode('reference');
  }
  if (event.key === 'Escape') closeFocus();
});

initializeIntake(document.querySelector('.shared-intake'), 'shared', 'knowledge/terrain-hydrology/shared/inbox/');
const regionGrid = document.getElementById('regionGrid');
const creations = manifest.regions.map((region) => {
  const creation = createRegionCard(region);
  regionGrid.append(creation.card);
  return { region, ...creation };
});
const results = await Promise.allSettled(creations.map(async ({ region, viewer }) => {
  try {
    await viewer.load();
    return region.id;
  } catch (error) {
    state.failures.push({ region: region.id, message: error.message });
    state.cards.get(region.id).querySelector('[data-readout]').textContent = `载入失败：${error.message}`;
    throw error;
  }
}));
const failures = results.filter((result) => result.status === 'rejected');
if (failures.length) {
  document.getElementById('globalStatus').textContent = `${manifest.regions.length - failures.length}/${manifest.regions.length} 个地区载入完成`;
  document.getElementById('globalDetail').textContent = state.failures.map((item) => `${item.region}: ${item.message}`).join('；');
  document.documentElement.dataset.workbenchReady = 'partial';
} else {
  document.getElementById('globalStatus').textContent = '三地区真实地貌与桂林蒸馏示范已经载入';
  document.getElementById('globalDetail').textContent = '桂林可直接打开 1 km² 参考图约束示范区；三地区仍可旋转、缩放、诊断和上传资料';
  document.documentElement.dataset.workbenchReady = 'true';
  state.ready = true;
}
