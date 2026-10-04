/* Fifth catalog object only. Load after catalog-ui.js; the frozen feather module
 * remains isolated and starts only after an explicit selection. */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const home = byId('catalogHome');
  const header = document.querySelector('header');
  const platform = window.platform;
  if (!home || !platform || byId('catalogFeather')) return;

  const card = document.createElement('button');
  card.id = 'catalogFeather';
  card.className = 'catalog-card catalog-feather';
  card.type = 'button';
  card.dataset.catalogObject = 'feather';
  card.setAttribute('aria-label', '打开 Feather 羽毛工作台');
  card.innerHTML = '<span class="catalog-preview"><img src="/*__FEATHER_PREVIEW__*/" alt="工作台中实际渲染的羽轴、羽片和根部绒羽"></span><span class="catalog-card-copy"><span class="catalog-card-title">羽毛 <span>Feather</span></span><span class="catalog-card-description">羽轴 · 羽枝 · 细羽枝 · 风动</span><span class="catalog-open">打开工作台</span></span>';
  home.querySelector('.catalog-grid').append(card);

  const toolbar = document.createElement('div');
  toolbar.id = 'featherToolbar';
  toolbar.innerHTML = '<div class="studio-title"><strong id="featherTitle" tabindex="-1">羽毛工作台</strong><small>羽轴与细羽枝 · 实时 3D</small></div>';
  header.append(toolbar);
  const panel = document.createElement('section');
  panel.id = 'featherModule';
  panel.hidden = true;
  panel.setAttribute('aria-label', '羽毛工作台');
  panel.innerHTML = '<div id="featherLoadStatus" class="feather-load-status" role="status" aria-live="polite"><p id="featherLoadMessage"></p><button id="featherRetry" type="button" hidden>重新载入</button></div>';
  home.after(panel);

  const errors = [];
  const previousSelect = platform.select;
  const previousModule = Object.getOwnPropertyDescriptor(platform, 'module').get;
  let selected = false, frame = null, status = 'idle', timer = 0, generation = 0;
  let savedState = null;
  const active = () => selected && !document.hidden;
  function api() {
    try { return frame?.contentWindow?.FeatherStudy || null; }
    catch (_) { return null; }
  }
  function command(type) {
    const runtime = api();
    if (runtime && typeof runtime[type] === 'function') {
      runtime[type](); // Same-origin synchronous pause cancels RAF before hiding.
    } else if (frame?.contentWindow) {
      frame.contentWindow.postMessage({kaopuFeather: true, type}, location.origin === 'null' ? '*' : location.origin);
    }
  }
  function setStatus(next, message = '') {
    status = next;
    panel.dataset.status = next;
    panel.setAttribute('aria-busy', String(next === 'loading'));
    byId('featherLoadStatus').hidden = next === 'ready';
    byId('featherLoadMessage').textContent = message;
    byId('featherRetry').hidden = next !== 'error';
  }
  function size() {
    document.documentElement.style.setProperty('--feather-viewport-height', Math.floor(window.visualViewport?.height || innerHeight) + 'px');
    if (selected) {
      document.documentElement.style.setProperty('--feather-header-height', header.getBoundingClientRect().height + 'px');
      if (status === 'ready' && active()) command('resize');
    }
  }
  function removeFrame(preserveState) {
    clearTimeout(timer); timer = 0;
    generation++;
    if (!frame) return;
    const runtime = api();
    if (preserveState && runtime) {
      try { savedState = runtime.exportState(); } catch (_) { /* A failed context may no longer export. */ }
    }
    command('dispose');
    frame.remove(); frame = null;
  }
  function fail(message) {
    if (status === 'error') return;
    errors.push(String(message));
    removeFrame(true);
    setStatus('error', '羽毛未能载入：' + message + '。可返回首页，或重新载入');
  }
  function reconcile() {
    if (status !== 'ready') return;
    command(active() ? 'resume' : 'pause');
  }
  function loaded(current) {
    if (current !== generation || !frame || status === 'ready' || status === 'error') return;
    const runtime = api();
    if (!runtime?.ready) {
      fail(runtime?.errors?.join('；') || '没有收到 3D 模块的就绪确认');
      return;
    }
    clearTimeout(timer); timer = 0;
    // A selection can change while the document is loading. Pause first, before
    // restoring state, so a hidden late load cannot restart animation.
    command('pause');
    if (savedState) {
      try { runtime.importState(savedState); savedState = null; }
      catch (error) { fail(error.message); return; }
    }
    setStatus('ready');
    size();
    reconcile();
  }
  function ensureFrame() {
    if (frame || status === 'error') return;
    const current = ++generation;
    setStatus('loading', '正在载入羽毛工作台…');
    frame = document.createElement('iframe');
    frame.id = 'featherFrame';
    frame.title = '羽轴与细羽枝完整工作台：画面、参数与保存工具';
    frame.setAttribute('aria-label', frame.title);
    frame.addEventListener('load', () => loaded(current));
    frame.addEventListener('error', () => { if (current === generation) fail('文件载入失败，请检查连接'); });
    // The online shell contains no feather HTML. Offline builds embed the exact
    // frozen document as inert string data, assigned to srcdoc only here.
    if (typeof window.FEATHER_MODULE_HTML === 'string') frame.srcdoc = window.FEATHER_MODULE_HTML;
    else frame.src = './feather-study/index.html';
    panel.append(frame);
    timer = setTimeout(() => { if (current === generation) fail('等待 3D 模块超时'); }, 60000);
  }
  function select(module) {
    if (module !== 'feather') {
      const wasFeather = selected;
      if (wasFeather) command('pause');
      selected = false;
      panel.hidden = true;
      const result = previousSelect.call(platform, module);
      if (wasFeather && module === 'home') card.focus({preventScroll: true});
      return result;
    }
    if (!selected) {
      // Existing home navigation stops Rabbit, Anemone and KuKo and closes all
      // drawers, without initializing another renderer or changing their state.
      previousSelect.call(platform, 'home');
      selected = true;
      document.body.dataset.module = 'feather';
      panel.hidden = false;
      window.dispatchEvent(new CustomEvent('platformchange', {detail: {module: 'feather'}}));
      byId('featherTitle').focus({preventScroll: true});
    }
    size();
    ensureFrame();
    reconcile();
  }
  Object.defineProperty(platform, 'module', {configurable: true, enumerable: true,
    get() { return selected ? 'feather' : previousModule.call(platform); }});
  platform.select = select;
  card.onclick = () => platform.select('feather');
  byId('featherRetry').onclick = () => {
    if (!selected) return;
    removeFrame(true);
    setStatus('idle');
    ensureFrame();
  };
  window.addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow || !event.data?.kaopuFeather || event.origin !== location.origin) return;
    if (event.data.type === 'ready') loaded(generation);
    if (event.data.type === 'error') fail(event.data.message || '3D 模块运行异常');
  });
  document.addEventListener('visibilitychange', reconcile);
  window.addEventListener('resize', size);
  window.visualViewport?.addEventListener('resize', size);
  function dispose() { removeFrame(true); setStatus('idle'); }
  window.addEventListener('pagehide', dispose);
  window.addEventListener('unload', dispose);
  window.addEventListener('pageshow', event => { if (event.persisted && selected) { size(); ensureFrame(); } });
  window.featherCatalog = Object.freeze({
    get ready() { return status === 'ready'; },
    get status() { return status; },
    get errors() { return errors.slice(); },
    get stats() { return api()?.stats || null; },
    dispose
  });
  window.catalogUI.sync();
})();
