(() => {
'use strict';
const base = window.LandscapeMotherAppUi;
const appCore = window.LandscapeMotherAppCore;
if (!base || !appCore) throw new Error('Landscape Mother V2 UI dependencies are missing');

function setTier(name) {
  const renderer = appCore.state.renderer;
  if (!renderer) return;
  renderer.setQualityTier(name);
  document.querySelectorAll('[data-tier]').forEach(button => {
    button.classList.toggle('active', button.dataset.tier === name);
  });
  appCore.updateStatus();
  appCore.updateQa();
}

function setupUi() {
  base.setupUi();
  const initialTier = new URLSearchParams(location.search).get('tier') || 'review';
  document.querySelectorAll('[data-tier]').forEach(button => {
    button.classList.toggle('active', button.dataset.tier === initialTier);
    button.addEventListener('click', () => setTier(button.dataset.tier));
  });
  const canvas = appCore.elements.canvas;
  canvas.addEventListener('pointerdown', () => appCore.state.renderer?.beginInteraction());
  const endInteraction = () => appCore.state.renderer?.endInteraction();
  canvas.addEventListener('pointerup', endInteraction);
  canvas.addEventListener('pointercancel', endInteraction);
  canvas.addEventListener('pointerleave', event => {
    if (event.buttons === 0) endInteraction();
  });
  window.addEventListener('pointerup', endInteraction);
  window.addEventListener('keydown', event => {
    if (event.key === '1') setTier('preview');
    if (event.key === '2') setTier('review');
    if (event.key === '3') setTier('evidence');
  });
}

window.LandscapeMotherAppUi = Object.freeze({
  ...base,
  setupUi,
  setTier,
});
})();
