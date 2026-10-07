/* Layout only: no renderer, camera, model, light or parameter state is touched. */
(() => {
  'use strict';
  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-wb-toggle]');
    if (!toggle) return;
    const workspace = toggle.closest('.wb-workspace');
    if (!workspace) return;
    const collapsed = workspace.classList.toggle('wb-controls-collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.textContent = collapsed ? '展开参数' : '收起参数';
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  });
})();
