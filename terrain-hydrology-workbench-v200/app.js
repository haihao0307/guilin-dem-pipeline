import { TerrainRenderer } from './renderer.js?v=210';
import { initializeIntake } from './intake.js?v=210';

const response = await fetch('./manifest.json', { cache: 'no-store' });
if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
const manifest = await response.json();

const state = { manifest, viewers: new Map(), cards: new Map(), focusViewer: null, activeRegion: null, ready: false, failures: [] };
window.__TERRAIN_HYDROLOGY_WORKBENCH_V200__ = state;

function createRegionCard(region) {
  const fragment = document.getElementById('regionTemplate').content.cloneNode(true);
  const card = fragment.querySelector('.region-card');
  card.id = region.id;
  card.dataset.region = region.id;
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
  initializeIntake(card.querySelector('.region-intake'), region.id, region.knowledgePath);
  state.cards.set(region.id, card);
  state.viewers.set(region.id, viewer);
  return { card, viewer };
}

async function openFocus(region) {
  const dialog = document.getElementById('focusDialog');
  if (state.focusViewer) state.focusViewer.dispose();
  state.activeRegion = region.id;
  document.getElementById('focusTitle').textContent = `${region.title} · 单独精细查看`;
  document.getElementById('focusLineage').textContent = `${region.truthLabel}。${region.lineage}`;
  const canvas = document.getElementById('focusCanvas');
  const fallback = document.getElementById('focusFallback');
  canvas.hidden = false;
  fallback.hidden = true;
  dialog.showModal();
  const viewer = new TerrainRenderer(canvas, region, {
    focus: true,
    readout: document.getElementById('focusReadout'),
    metrics: document.getElementById('focusMetrics'),
    fallback,
  });
  state.focusViewer = viewer;
  document.querySelectorAll('[data-focus-mode]').forEach((button) => button.classList.toggle('active', button.dataset.focusMode === 'terrain'));
  await viewer.load();
}

function closeFocus() {
  if (state.focusViewer) {
    state.focusViewer.dispose();
    state.focusViewer = null;
  }
  state.activeRegion = null;
  document.getElementById('focusDialog').close();
}

document.getElementById('closeFocus').addEventListener('click', closeFocus);
document.getElementById('focusDialog').addEventListener('cancel', (event) => {
  event.preventDefault();
  closeFocus();
});
document.querySelectorAll('[data-focus-mode]').forEach((button) => button.addEventListener('click', () => {
  state.focusViewer?.setMode(button.dataset.focusMode);
  document.querySelectorAll('[data-focus-mode]').forEach((item) => item.classList.toggle('active', item === button));
}));
document.querySelectorAll('[data-focus-view]').forEach((button) => button.addEventListener('click', () => state.focusViewer?.configureCamera(button.dataset.focusView)));
window.addEventListener('keydown', (event) => {
  if (!state.focusViewer) return;
  if (event.key === '1') state.focusViewer.configureCamera('overview');
  if (event.key === '2') state.focusViewer.configureCamera('near');
  if (event.key === '3') state.focusViewer.configureCamera('ground');
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
  document.getElementById('globalStatus').textContent = '三地区高精度真实地貌与近地连续显示已经载入';
  document.getElementById('globalDetail').textContent = '可旋转、连续缩放、查看自适应近地网格，并导出包含原图字节的知识包';
  document.documentElement.dataset.workbenchReady = 'true';
  state.ready = true;
}
