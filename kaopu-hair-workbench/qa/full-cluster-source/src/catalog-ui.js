/* Object directory and first-screen controls only. Load after rabbit-appearance.js.
 * Lifecycle belongs to platform.select(), which emits platformchange.
 * This module neither creates renderers nor changes model/material implementations.
 */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const header = document.querySelector('header');
  const home = document.createElement('main');
  home.id = 'catalogHome';
  home.className = 'catalog-home';
  home.setAttribute('aria-labelledby', 'catalogTitle');
  home.innerHTML = '<div class="catalog-intro"><p class="catalog-eyebrow">KAOPU / OBJECT STUDIO</p><h1 id="catalogTitle">选择一个对象开始</h1><p>打开工作台，观察细节，调整自己的作品</p></div><div class="catalog-grid">'+
    '<button id="catalogRabbit" class="catalog-card catalog-rabbit" type="button" data-catalog-object="rabbit" aria-label="打开 Rabbit 兔子工作台"><span class="catalog-preview"><img src="/*__RABBIT_PREVIEW__*/" alt="工作台中实际渲染的小兔子"></span><span class="catalog-card-copy"><span class="catalog-card-title">兔子 <span>Rabbit</span></span><span class="catalog-card-description">毛色 · 毛长 · 毛感 · 梳理</span><span class="catalog-open">打开工作台</span></span></button>'+
    '<button id="catalogAnemone" class="catalog-card catalog-anemone" type="button" data-catalog-object="anemone" aria-label="打开 Anemone 海葵工作台"><span class="catalog-preview"><img src="/*__ANEMONE_PREVIEW__*/" alt="工作台中实际渲染的整株海葵"></span><span class="catalog-card-copy"><span class="catalog-card-title">海葵 <span>Anemone</span></span><span class="catalog-card-description">自然色型 · 触手 · 实时水流</span><span class="catalog-open">打开工作台</span></span></button></div><p class="catalog-foot">选择对象后载入 3D · 随时返回首页切换</p>';
  header.after(home);

  const homeButton = document.createElement('button');
  homeButton.id = 'catalogHomeButton';
  homeButton.className = 'catalog-home-button';
  homeButton.type = 'button';
  homeButton.innerHTML = '<span aria-hidden="true">←</span> 首页';
  homeButton.setAttribute('aria-label', '返回对象首页');
  header.insertBefore(homeButton, header.firstChild);

  // Keep the legacy ID/handler for old integrations, outside every teacher menu.
  const legacyNav = document.createElement('div');
  legacyNav.id = 'catalogLegacyNav';
  legacyNav.hidden = true;
  legacyNav.append(byId('speciesRabbit'));
  home.append(legacyNav);
  byId('speciesRabbit').textContent = 'Rabbit · 兔子工作台';
  byId('rabbitBack').hidden = true;
  byId('rabbitControlsToggle').textContent = '更多';
  byId('rabbitControlsToggle').setAttribute('aria-label', '打开更多兔子调整与保存工具');
  byId('rabbitTeacherToggle').textContent = '老师';
  document.querySelector('#learningDrawer .drawer-content > p').textContent = '海葵的老师参考与学习基线';
  byId('learningDrawer').setAttribute('aria-label', '海葵的老师与学习基线');

  const workspace = document.querySelector('#rabbitModule .workspace');
  const actions = workspace.querySelector('.stage-tools');
  const quick = document.createElement('section');
  quick.id = 'rabbitQuickPanel';
  quick.className = 'rabbit-quick-panel';
  quick.setAttribute('aria-label', '兔子常用调整');
  quick.innerHTML = '<div class="rabbit-quick-heading"><strong>毛色与毛感</strong><span id="rabbitQuickStatus" role="status" aria-live="polite"></span></div>' +
    '<div id="rabbitQuickControls"></div><div class="rabbit-quick-footer"><p>粗细＝遮罩覆盖 · 疏密＝纹理重复</p><button id="rabbitAppearanceHelp" class="ghost" type="button">说明</button></div>' +
    '<div class="rabbit-zoom-presets"><span>镜头 <output id="rabbitQuickZoomValue" aria-live="polite" aria-atomic="true">100%</output></span><div class="rabbit-zoom-buttons" role="group" aria-label="兔子镜头缩放，100% 至 600%">' +
    '<button id="rabbitZoomOut" class="rabbit-zoom-step" type="button" data-rabbit-zoom-step="-1" aria-label="镜头缩小 100 个百分点" title="缩小 100 个百分点，最低 100%">−</button>' +
    '<div id="rabbitZoomPresets" role="group" aria-label="兔子镜头绝对缩放">' +
    '<button type="button" data-rabbit-zoom="1" aria-label="镜头缩放至 100%">100%</button>' +
    '<button type="button" data-rabbit-zoom="1.5" aria-label="镜头缩放至 150%">150%</button>' +
    '<button type="button" data-rabbit-zoom="2" aria-label="镜头缩放至 200%">200%</button></div>' +
    '<button id="rabbitZoomIn" class="rabbit-zoom-step" type="button" data-rabbit-zoom-step="1" aria-label="镜头放大 100 个百分点" title="放大 100 个百分点，最高 600%">+</button></div></div>';
  workspace.insertBefore(quick, actions);
  const quickControls = byId('rabbitQuickControls');
  quickControls.append(byId('rabbitAppearance'));
  byId('rabbitAppearance').querySelector('.section-title').hidden = true;

  // Preserve existing form nodes, IDs, handlers, ranges, and live readouts.
  // Longer explanations stay available in the existing advanced drawer.
  const explanations = document.createElement('section');
  explanations.id = 'rabbitAppearanceExplanation';
  explanations.className = 'section rabbit-appearance-explanation';
  explanations.innerHTML = '<div class="section-title">毛感调整说明</div>';
  for (const id of ['rabbitMaskWidthNote', 'rabbitVisualDensityNote']) {
    const note = byId(id);
    explanations.append(note);
    const control = byId(id.replace('Note', ''));
    control.setAttribute('aria-describedby', id);
    byId(control.id + 'Number').setAttribute('aria-describedby', id);
  }
  byId('inspector').insertBefore(explanations, byId('inspector').children[1]);
  byId('rabbitAppearanceHelp').onclick = () => {
    if (!byId('rabbitControlsDrawer').open) byId('rabbitControlsToggle').click();
    explanations.scrollIntoView({block: 'nearest'});
  };

  const colorControl = byId('furColor').closest('.control');
  colorControl.classList.add('rabbit-custom-color');
  // The first row pairs length with mask width; custom color remains on screen.
  byId('rabbitAppearanceControls').append(colorControl);
  byId('rabbitMaskWidth').closest('.control').classList.add('rabbit-width-control');
  byId('rabbitVisualDensity').closest('.control').classList.add('rabbit-density-control');
  const widthLabel = byId('rabbitMaskWidth').closest('.control').querySelector('label > span');
  const densityLabel = byId('rabbitVisualDensity').closest('.control').querySelector('label > span');
  widthLabel.textContent = '视觉粗细';
  densityLabel.textContent = '视觉疏密';
  byId('rabbitMaskWidth').setAttribute('aria-label', '遮罩视觉粗细');
  byId('rabbitVisualDensity').setAttribute('aria-label', '视觉疏密，纹理重复');

  let selected = null;
  let lastObject = 'rabbit';
  function sync(module = window.platform?.module || document.body.dataset.module || 'home') {
    const previous = selected;
    selected = module;
    if (module === 'rabbit' || module === 'anemone') lastObject = module;
    home.hidden = module !== 'home';
    homeButton.hidden = module === 'home';
    for (const card of home.querySelectorAll('[data-catalog-object]')) {
      card.setAttribute('aria-current', String(card.dataset.catalogObject === module));
    }
    const candidateReady = Boolean(window.workbench?.ready.candidate);
    const errors = window.workbench?.errors || [];
    const hasCandidateError = window.workbench?.startupStatus === 'error' || errors.some(error => !error.role || error.role === 'candidate');
    quickControls.inert = !candidateReady || hasCandidateError;
    quick.setAttribute('aria-busy', String(!candidateReady && !hasCandidateError));
    byId('rabbitQuickStatus').textContent = hasCandidateError ? '载入异常，请查看提示' : candidateReady ? '实时调整' : '正在载入兔子…';
    const size = window.workbench?.candidate.size || 1;
    byId('rabbitQuickZoomValue').textContent = Math.round(size * 100) + '%';
    for (const button of quick.querySelectorAll('[data-rabbit-zoom]')) {
      const current = Math.abs(Number(button.dataset.rabbitZoom) - size) < .000001;
      button.disabled = !candidateReady || hasCandidateError;
      button.classList.toggle('active', current);
      button.setAttribute('aria-pressed', String(current));
    }
    byId('rabbitZoomOut').disabled = !candidateReady || hasCandidateError || size <= 1;
    byId('rabbitZoomIn').disabled = !candidateReady || hasCandidateError || size >= 6;
    if (previous && previous !== module) {
      if (module === 'home') home.querySelector('[data-catalog-object="' + lastObject + '"]')?.focus({preventScroll: true});
      else {
        const title = document.querySelector(module === 'rabbit' ? '#rabbitToolbar .studio-title strong' : module === 'anemone' ? '#studioToolbar .studio-title strong' : '.kuko-heading h1');
        if (title) { title.tabIndex = -1; title.focus({preventScroll: true}); }
      }
    }
    return {module, candidateReady, zoom: size};
  }
  function select(module) { return window.platform.select(module); }
  homeButton.onclick = () => select('home');
  for (const card of home.querySelectorAll('[data-catalog-object]')) card.onclick = () => select(card.dataset.catalogObject);
  for (const button of quick.querySelectorAll('[data-rabbit-zoom]')) button.onclick = () => {
    // Absolute values. Repeating 150% leaves the camera at 1.5, never 2.25.
    window.rabbitUI.setCamera(Number(button.dataset.rabbitZoom));
    sync();
  };
  for (const button of quick.querySelectorAll('[data-rabbit-zoom-step]')) button.onclick = () => {
    // Add percentage points to the live camera value; never compound presets.
    const current = window.workbench.candidate.size;
    window.rabbitUI.setCamera(Math.max(1, Math.min(6, current + Number(button.dataset.rabbitZoomStep))));
    sync();
  };
  window.addEventListener('platformchange', event => sync(event.detail?.module));
  window.addEventListener('message', event => {
    const data = event.data;
    if (!data?.kaopu || !['candidate', 'teacher'].includes(data.role) || event.source !== byId(data.role + 'Frame').contentWindow) return;
    if (['ready', 'camera', 'error', 'gl-error'].includes(data.type)) sync();
  });
  // Existing handlers complete before bubbling reaches these synchronization hooks.
  document.addEventListener('input', event => { if (event.target.closest('#rabbitModule, #rabbitControlsDrawer')) sync(); });
  document.addEventListener('change', event => { if (event.target.closest('#rabbitModule, #rabbitControlsDrawer')) sync(); });
  document.addEventListener('click', event => {
    if (event.target.closest('#rabbitModule, #rabbitControlsDrawer')) queueMicrotask(() => sync());
  });
  // Programmatic imports finish without a DOM event; wrap only the UI sync hook.
  const previousUpdateUI = updateUI;
  updateUI = function (...args) { const result = previousUpdateUI(...args); sync(); return result; };
  window.catalogUI = Object.freeze({select, sync, get module() { return selected; }});
  sync();
})();
