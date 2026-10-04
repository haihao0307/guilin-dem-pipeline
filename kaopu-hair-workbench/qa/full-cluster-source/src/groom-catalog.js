/* Fourth catalog object only. Load after catalog-ui.js; the frozen groom module
 * remains isolated and starts only after an explicit selection. */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const home = byId('catalogHome');
  const header = document.querySelector('header');
  const platform = window.platform;
  if (!home || !platform || byId('catalogGroom')) return;

  const card = document.createElement('button');
  card.id = 'catalogGroom';
  card.className = 'catalog-card catalog-groom';
  card.type = 'button';
  card.dataset.catalogObject = 'groom';
  card.setAttribute('aria-label', '打开 Groom 梳理工作台');
  card.innerHTML = '<span class="catalog-preview"><img src="/*__GROOM_PREVIEW__*/" alt="工作台中实际渲染的发型、胡须与原创人头"></span><span class="catalog-card-copy"><span class="catalog-card-title">梳理 <span>Groom</span></span><span class="catalog-card-description">分区 · 导向 · 发束 · 胡须</span><span class="catalog-open">打开工作台</span></span>';
  home.querySelector('.catalog-grid').append(card);

  const toolbar = document.createElement('div');
  toolbar.id = 'groomToolbar';
  toolbar.innerHTML = '<div class="studio-title"><strong id="groomTitle" tabindex="-1">梳理工作台</strong><small>发型与胡须 · 实时 3D</small></div>';
  header.append(toolbar);
  const panel = document.createElement('section');
  panel.id = 'groomModule';
  panel.hidden = true;
  panel.setAttribute('aria-label', '梳理工作台');
  panel.innerHTML = '<div id="groomLoadStatus" class="groom-load-status" role="status" aria-live="polite"><p id="groomLoadMessage"></p><button id="groomRetry" type="button" hidden>重新载入</button></div>';
  home.after(panel);

  const errors = [];
  const previousSelect = platform.select;
  const previousModule = Object.getOwnPropertyDescriptor(platform, 'module').get;
  let selected = false, frame = null, status = 'idle', timer = 0, generation = 0;
  let savedState = null;
  const active = () => selected && !document.hidden;
  function api() {
    try { return frame?.contentWindow?.GroomStudy || null; }
    catch (_) { return null; }
  }
  function command(type) {
    const runtime = api();
    if (runtime && typeof runtime[type] === 'function') {
      runtime[type](); // Same-origin synchronous pause cancels RAF before hiding.
    } else if (frame?.contentWindow) {
      frame.contentWindow.postMessage({kaopuGroom: true, type}, location.origin === 'null' ? '*' : location.origin);
    }
  }
  function setStatus(next, message = '') {
    status = next;
    panel.dataset.status = next;
    panel.setAttribute('aria-busy', String(next === 'loading'));
    byId('groomLoadStatus').hidden = next === 'ready';
    byId('groomLoadMessage').textContent = message;
    byId('groomRetry').hidden = next !== 'error';
  }
  function size() {
    document.documentElement.style.setProperty('--groom-viewport-height', Math.floor(window.visualViewport?.height || innerHeight) + 'px');
    if (selected) {
      document.documentElement.style.setProperty('--groom-header-height', header.getBoundingClientRect().height + 'px');
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
    setStatus('error', '梳理未能载入：' + message + '。可返回首页，或重新载入');
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
    setStatus('loading', '正在载入梳理工作台…');
    frame = document.createElement('iframe');
    frame.id = 'groomFrame';
    frame.title = '发型与胡须完整工作台：画面、参数与保存工具';
    frame.setAttribute('aria-label', frame.title);
    frame.addEventListener('load', () => loaded(current));
    frame.addEventListener('error', () => { if (current === generation) fail('文件载入失败，请检查连接'); });
    // The online shell contains no groom HTML. Offline builds embed the exact
    // frozen document as inert string data, assigned to srcdoc only here.
    if (typeof window.GROOM_MODULE_HTML === 'string') frame.srcdoc = window.GROOM_MODULE_HTML;
    else frame.src = './houdini-groom-study/index.html';
    panel.append(frame);
    timer = setTimeout(() => { if (current === generation) fail('等待 3D 模块超时'); }, 60000);
  }
  function select(module) {
    if (module !== 'groom') {
      const wasGroom = selected;
      if (wasGroom) command('pause');
      selected = false;
      panel.hidden = true;
      const result = previousSelect.call(platform, module);
      if (wasGroom && module === 'home') card.focus({preventScroll: true});
      return result;
    }
    if (!selected) {
      // Existing home navigation stops Rabbit, Anemone and KuKo and closes all
      // drawers, without initializing another renderer or changing their state.
      previousSelect.call(platform, 'home');
      selected = true;
      document.body.dataset.module = 'groom';
      panel.hidden = false;
      window.dispatchEvent(new CustomEvent('platformchange', {detail: {module: 'groom'}}));
      byId('groomTitle').focus({preventScroll: true});
    }
    size();
    ensureFrame();
    reconcile();
  }
  Object.defineProperty(platform, 'module', {configurable: true, enumerable: true,
    get() { return selected ? 'groom' : previousModule.call(platform); }});
  platform.select = select;
  card.onclick = () => platform.select('groom');
  byId('groomRetry').onclick = () => {
    if (!selected) return;
    removeFrame(true);
    setStatus('idle');
    ensureFrame();
  };
  window.addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow || !event.data?.kaopuGroom || event.origin !== location.origin) return;
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
  window.groomCatalog = Object.freeze({
    get ready() { return status === 'ready'; },
    get status() { return status; },
    get errors() { return errors.slice(); },
    get stats() { return api()?.stats || null; },
    dispose
  });
  window.catalogUI.sync();
})();
