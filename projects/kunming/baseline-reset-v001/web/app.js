(() => {
  'use strict';
  const stage = document.getElementById('stage');
  const wrap = document.getElementById('imageWrap');
  const image = document.getElementById('demImage');
  const zoomInput = document.getElementById('zoom');
  const zoomValue = document.getElementById('zoomValue');
  const status = document.getElementById('status');
  const fitButton = document.getElementById('fit');
  const actualButton = document.getElementById('actual');
  const smoothButton = document.getElementById('smooth');
  const pixelButton = document.getElementById('pixel');

  const state = { scale: 1, x: 0, y: 0, dragging: false, px: 0, py: 0, mode: 'fit' };

  function render() {
    wrap.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    const pct = Math.round(state.scale * 100);
    zoomInput.value = Math.max(10, Math.min(1600, pct));
    zoomValue.textContent = `${pct}%`;
    status.textContent = `无损 PNG 预览已载入 · 568 × 780 预览像素 · 当前缩放 ${pct}% · 权威栅格 5892 × 8095 @ 12.5 m`;
  }

  function fit() {
    const margin = 48;
    const availableWidth = Math.max(120, stage.clientWidth - margin);
    const availableHeight = Math.max(120, stage.clientHeight - margin);
    state.scale = Math.min(availableWidth / image.naturalWidth, availableHeight / image.naturalHeight);
    state.x = -image.naturalWidth * state.scale / 2;
    state.y = -image.naturalHeight * state.scale / 2;
    state.mode = 'fit';
    fitButton.classList.add('active');
    actualButton.classList.remove('active');
    render();
  }

  function actual() {
    state.scale = 1;
    state.x = -image.naturalWidth / 2;
    state.y = -image.naturalHeight / 2;
    state.mode = 'actual';
    actualButton.classList.add('active');
    fitButton.classList.remove('active');
    render();
  }

  function setScale(nextScale, anchorX = stage.clientWidth / 2, anchorY = stage.clientHeight / 2) {
    const clamped = Math.max(0.1, Math.min(16, nextScale));
    const currentLeft = stage.clientWidth / 2 + state.x;
    const currentTop = stage.clientHeight / 2 + state.y;
    const imageX = (anchorX - currentLeft) / state.scale;
    const imageY = (anchorY - currentTop) / state.scale;
    state.x = anchorX - stage.clientWidth / 2 - imageX * clamped;
    state.y = anchorY - stage.clientHeight / 2 - imageY * clamped;
    state.scale = clamped;
    state.mode = 'manual';
    fitButton.classList.remove('active');
    actualButton.classList.toggle('active', Math.abs(state.scale - 1) < 0.001);
    render();
  }

  image.addEventListener('load', fit, { once: true });
  window.addEventListener('resize', () => { if (state.mode === 'fit') fit(); });

  stage.addEventListener('pointerdown', event => {
    state.dragging = true;
    state.px = event.clientX;
    state.py = event.clientY;
    stage.classList.add('dragging');
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', event => {
    if (!state.dragging) return;
    state.x += event.clientX - state.px;
    state.y += event.clientY - state.py;
    state.px = event.clientX;
    state.py = event.clientY;
    state.mode = 'manual';
    fitButton.classList.remove('active');
    render();
  });
  stage.addEventListener('pointerup', event => {
    state.dragging = false;
    stage.classList.remove('dragging');
    stage.releasePointerCapture(event.pointerId);
  });
  stage.addEventListener('wheel', event => {
    event.preventDefault();
    setScale(state.scale * Math.exp(-event.deltaY * 0.0012), event.clientX, event.clientY);
  }, { passive: false });

  zoomInput.addEventListener('input', () => setScale(Number(zoomInput.value) / 100));
  fitButton.addEventListener('click', fit);
  actualButton.addEventListener('click', actual);
  document.getElementById('reset').addEventListener('click', fit);
  document.getElementById('fullscreen').addEventListener('click', () => document.documentElement.requestFullscreen?.());
  smoothButton.addEventListener('click', () => {
    image.classList.remove('pixelated');
    smoothButton.classList.add('active');
    pixelButton.classList.remove('active');
  });
  pixelButton.addEventListener('click', () => {
    image.classList.add('pixelated');
    pixelButton.classList.add('active');
    smoothButton.classList.remove('active');
  });

  if (image.complete && image.naturalWidth) fit();
})();
