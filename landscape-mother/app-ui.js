(() => {
'use strict';
const { $, elements, state, updateStatus } = window.LandscapeMotherAppCore;
function setMode(mode) {
  state.renderer.setMode(mode);
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.mode) === Number(mode));
  });
  $('compareLabels').hidden = Number(mode) !== 6;
  updateStatus();
}
function setView(view) {
  state.renderer.setView(view);
  updateStatus();
}
function setupUi() {
  $('modeGrid').addEventListener('click', event => {
    const button = event.target.closest('[data-mode]');
    if (button) setMode(Number(button.dataset.mode));
  });
  document.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });
  $('detailToggle').addEventListener('change', event => {
    state.renderer.detailMix = event.target.checked ? 1 : 0;
    state.renderer.dirty = true;
  });
  $('waterToggle').addEventListener('change', event => {
    state.renderer.showWater = event.target.checked;
    state.renderer.dirty = true;
  });
  for (const [inputId, property, outputId] of [
    ['materialDetail', 'materialDetail', 'materialDetailOut'],
    ['colorRichness', 'colorRichness', 'colorRichnessOut'],
  ]) {
    $(inputId).addEventListener('input', event => {
      state.renderer[property] = Number(event.target.value);
      $(outputId).value = Number(event.target.value).toFixed(2);
      state.renderer.dirty = true;
    });
  }
  $('collapse').addEventListener('click', () => {
    const collapsed = $('controls').classList.toggle('collapsed');
    $('collapse').textContent = collapsed ? '展开' : '收起';
    $('collapse').setAttribute('aria-expanded', String(!collapsed));
  });
  const canvas = elements.canvas;
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointerdown', event => {
    canvas.setPointerCapture(event.pointerId);
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pointers.size === 2) {
      const points = [...state.pointers.values()];
      state.pinch = {
        distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
        cameraDistance: state.renderer.camera.distance,
      };
    }
  });
  canvas.addEventListener('pointermove', event => {
    const previous = state.pointers.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    state.pointers.set(event.pointerId, current);
    if (state.pointers.size === 2 && state.pinch) {
      const points = [...state.pointers.values()];
      const distance = Math.max(8, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
      state.renderer.camera.distance = Math.max(
        state.renderer.camera.minDistance,
        Math.min(
          state.renderer.camera.maxDistance,
          state.pinch.cameraDistance * state.pinch.distance / distance,
        ),
      );
      state.renderer.dirty = true;
    } else {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      if (event.shiftKey || event.buttons === 2) state.renderer.pan(dx, dy);
      else state.renderer.orbit(dx, dy);
    }
  });
  const release = event => {
    state.pointers.delete(event.pointerId);
    if (state.pointers.size < 2) state.pinch = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    state.renderer.zoom(event.deltaY);
  }, { passive: false });
  window.addEventListener('resize', () => { if (state.renderer) state.renderer.dirty = true; });
  window.addEventListener('keydown', event => {
    if (event.key === 'r' || event.key === 'R') setView('overview');
    if (event.code === 'Space') {
      event.preventDefault();
      setMode(state.renderer.mode === 1 ? 0 : 1);
    }
  });
}
window.LandscapeMotherAppUi = Object.freeze({ setupUi, setMode, setView });
})();
