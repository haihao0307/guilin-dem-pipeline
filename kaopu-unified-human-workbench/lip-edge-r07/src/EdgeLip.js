/* R07 append-only controls and complete-person archive integration.
 *
 * R06's earlier window-capture listener owns the inherited head/body saves:
 *   #ps-controls [data-ps-action="save"]
 *   #ps-controls [data-fb-action="save"]
 * Its lexical save() uses the current controller.archive(), so those downloads
 * include lipEdge without another competing capture listener. Their inherited
 * filename remains lip-corner-r06-person.json; the new R07 button uses the R07
 * filename. Capture the concrete controller functions below, never the dynamic
 * cornerLip.archive/restore aliases, or the appended archive chain recurses.
 */
(function () {
  'use strict';
  const VERSION = 'LIP-EDGE-R07', SCHEMA = 'kaopu/lip-edge@1';
  const status = window.__LIP_EDGE__ = {
    version: VERSION, ready: false, errors: [], source: window.__LIP_EDGE_SOURCE__ || null
  };

  function boot() {
    const prior = window.cornerLip, solver = window.__LIP_EDGE_SOLVER__;
    const v = window.__IDENTITY_QA__?.viewer?.(), model = window.__IDENTITY_QA__?.model?.();
    const controller = window.__IDENTITY_QA__?.controller?.();
    if (!prior?.ready || !solver || !v?.startupFinalFrame) return false;
    if (prior.version !== 'LIP-CORNER-R06') throw Error('嘴唇 R07 需要固定的 R06 人物');
    for (const name of ['install', 'setEnabled', 'report', 'uninstall']) {
      if (typeof solver[name] !== 'function') throw Error('R07 求值接口缺失：' + name);
    }
    for (const name of ['compare', 'pose', 'view', 'report']) {
      if (typeof prior[name] !== 'function') throw Error('R06 控制接口缺失：' + name);
    }
    if (!model || typeof controller?.archive !== 'function' || typeof controller?.restore !== 'function' ||
        typeof v.render !== 'function' || typeof v.update !== 'function' || typeof solver.version !== 'string' || !solver.version) {
      throw Error('原人物控制器或 R07 实现标识缺失');
    }
    const shell = document.querySelector('#control-shell'), oldPanel = document.querySelector('#lc-controls');
    const heading = document.querySelector('header strong');
    if (!shell || !oldPanel || !heading || document.querySelector('#le-controls')) throw Error('原人物工作台界面缺失或 R07 已安装');

    const nativeCompare = prior.compare.bind(prior), nativePose = prior.pose.bind(prior), nativeView = prior.view.bind(prior);
    const priorArchive = controller.archive.bind(controller), priorRestore = controller.restore.bind(controller);
    const inheritedImplementations = {
      corner: window.__LIP_CORNER_SOLVER__?.version,
      motion: window.__LIP_MOTION_SOLVER__?.version,
      inner: window.__LIP_INNER_SHADER__?.version
    };
    if (Object.values(inheritedImplementations).some(x => typeof x !== 'string' || !x)) throw Error('配套 R06/R05/R04 实现标识缺失');
    const archiveAPIs = [window.fullCommonWorkbench, window.headProceduralSkin, window.bodyProceduralSkin,
      window.lipRealism, window.innerLip, window.motionLip, prior];
    if (archiveAPIs.some(api => !api || typeof api.archive !== 'function' || typeof api.restore !== 'function')) throw Error('完整人物存档接口缺失');
    let comparison = 'r07', lastView = 'oblique', restoring = false;

    function batch(label, fn) {
      const descriptor = Object.getOwnPropertyDescriptor(v, 'render'), original = v.render;
      let calls = 0;
      try {
        Object.defineProperty(v, 'render', { configurable: true, writable: true, value() { calls++; } });
        return fn();
      } finally {
        if (descriptor) Object.defineProperty(v, 'render', descriptor); else delete v.render;
        if (v.render !== original) throw Error('原人物渲染方法未恢复');
        status.lastBatch = { label, suppressedCalls: calls, renderRestored: true };
      }
    }
    async function batchAsync(label, fn) {
      const descriptor = Object.getOwnPropertyDescriptor(v, 'render'), original = v.render;
      let calls = 0;
      Object.defineProperty(v, 'render', { configurable: true, writable: true, value() { calls++; } });
      try { return await fn(); }
      finally {
        if (descriptor) Object.defineProperty(v, 'render', descriptor); else delete v.render;
        if (v.render !== original) throw Error('原人物渲染方法未恢复');
        status.lastBatch = { label, suppressedCalls: calls, renderRestored: true };
      }
    }
    function heldView(fn) {
      const camera = { position: v.camera.position.clone(), quaternion: v.camera.quaternion.clone(), target: v.orbit.target.clone() };
      const center = v.cineRig.center.clone(), exposure = v.renderer.toneMappingExposure, lights = [];
      v.scene.traverse(o => {
        if (o.isLight) lights.push({ o, position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone(),
          color: o.color.clone(), intensity: o.intensity, visible: o.visible, ground: o.groundColor?.clone(),
          target: o.target ? { position: o.target.position.clone(), quaternion: o.target.quaternion.clone(), scale: o.target.scale.clone() } : null });
      });
      try { return fn(); }
      finally {
        v.camera.position.copy(camera.position); v.camera.quaternion.copy(camera.quaternion); v.orbit.target.copy(camera.target);
        v.camera.updateMatrixWorld(true); v.cineRig.center.copy(center); v.renderer.toneMappingExposure = exposure;
        for (const s of lights) {
          const o = s.o; o.position.copy(s.position); o.quaternion.copy(s.quaternion); o.scale.copy(s.scale); o.color.copy(s.color);
          o.intensity = s.intensity; o.visible = s.visible; if (s.ground) o.groundColor.copy(s.ground);
          if (s.target) {
            o.target.position.copy(s.target.position); o.target.quaternion.copy(s.target.quaternion); o.target.scale.copy(s.target.scale);
            o.target.updateMatrixWorld(true);
          }
        }
        v.scene.updateMatrixWorld(true);
      }
    }
    function matchedR06(r = prior.report()) {
      return r.comparison === 'r06' && r.solver?.installed && r.solver.valid && r.solver.enabled &&
        r.motionComparison === 'r05' && r.motionSolver?.valid && r.motionSolver.enabled && r.innerComparison === 'r04';
    }
    function detach() { if (solver.report().installed) solver.uninstall(); }
    function idle() { if (restoring) throw Error('人物档案正在载入，请等待完成'); }
    function ensureR06() {
      if (!matchedR06()) {
        // R06 may need to rebuild its own native wrapper. Release our outer
        // owner first; never bypass the ancestor's material/ownership guards.
        detach(); nativeCompare('r06');
      }
      if (!matchedR06()) throw Error('当前人物参数不满足配套 R06 状态，R07 未启用');
    }
    function installEdge() {
      const s = solver.report();
      if (!s.installed || !s.valid) { detach(); solver.install(v, model); }
      const installed = solver.report();
      if (!installed.installed || !installed.valid || !matchedR06()) throw Error('R07 无法绑定当前 R06 人物：' + (installed.invalidationReason || '配套状态不一致'));
    }

    const panel = document.createElement('section'); panel.id = 'le-controls';
    panel.innerHTML = '<h2>嘴唇内缘 <small>R07 · 同一人物</small></h2>' +
      '<p>检查外唇到内缘的连续过渡。两版使用同一人物、动作、镜头和灯光。</p>' +
      '<div class="le-row"><button data-le-compare="r07">当前 R07</button><button data-le-compare="r06">前一版 R06</button></div>' +
      '<label class="le-caption">动作</label><div class="le-row"><button data-le-pose="neutral">自然闭口</button><button data-le-pose="jaw">张口检查</button><button data-le-pose="speak">说话姿态</button><button data-le-pose="pucker">噘嘴</button></div>' +
      '<label class="le-progress">动作进度 <output id="le-progress-label">100%</output><input id="le-progress" type="range" min="0" max="100" step="1" value="100"></label>' +
      '<label class="le-caption">视角</label><div class="le-row"><button data-le-view="macro">嘴部正面</button><button data-le-view="oblique">嘴部斜侧</button><button data-le-view="front">整脸正面</button><button data-le-view="bust">头颈同框</button></div>' +
      '<div class="le-row"><button data-le-action="save">保存完整人物</button><button data-le-action="load">载入人物档案</button><input id="le-file" type="file" accept="application/json,.json" hidden></div>' +
      '<p id="le-status" role="status"></p><details><summary>本次修改的范围</summary><p>本轮检查外唇到内缘的连续过渡。原有口角与动作状态随完整人物档案一起保存。</p></details>';
    const style = document.createElement('style');
    style.textContent = '#le-controls{padding:18px;color:#eee9df;background:#16262b;font:13px/1.55 system-ui;flex-shrink:0}#le-controls h2{font-size:21px;line-height:1.2;margin:0 0 10px}#le-controls h2 small{display:inline-block;font-size:12px;font-weight:400;color:#bbd4ce}#le-controls p{font-size:12px;color:#c0cdcc;margin:8px 0 12px}.le-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:7px 0 12px}.le-row button{min-height:36px;font-size:12px}.le-row button[aria-pressed="true"]{border-color:#d6c293;background:#354943;color:#fff2d7}.le-caption{display:block;font-size:11px;color:#b7c8c8;margin-top:12px}.le-progress{display:block;font-size:12px;margin:12px 0}.le-progress output{float:right;font-variant-numeric:tabular-nums}.le-progress input{display:block;width:100%;margin:10px 0}#le-status{border-top:1px solid #466064;padding-top:10px}#le-controls details{font-size:12px}#lc-controls[hidden]{display:none!important}@media(max-width:900px){#le-controls{padding:13px}#le-controls h2{font-size:18px}}';

    function sync() {
      let r = prior.report(), s = solver.report(), matched = matchedR06(r);
      if (restoring) return { r, s };
      // A report may already have disabled a stale binding. Remembering the
      // previous comparison still clears its evaluated effect, not just its UI.
      if ((comparison === 'r07' && (!s.installed || !s.enabled || !s.valid || !matched)) ||
          (s.installed && (!s.valid || !matched)) || (s.enabled && comparison !== 'r07')) {
        batch('remove R07 outside its matched R06 state', () => heldView(() => {
          detach(); comparison = matched ? 'r06' : 'inherited'; v.update();
        }));
        v.render(); r = prior.report(); s = solver.report(); matched = matchedR06(r);
      }
      if (comparison === 'r06' && !matched) comparison = 'inherited';
      for (const b of panel.querySelectorAll('[data-le-compare]')) b.setAttribute('aria-pressed', String(b.dataset.leCompare === comparison));
      for (const b of panel.querySelectorAll('[data-le-pose]')) b.setAttribute('aria-pressed', String(b.dataset.lePose === r.poseName));
      for (const b of panel.querySelectorAll('[data-le-view]')) b.setAttribute('aria-pressed', String(b.dataset.leView === lastView));
      const custom = r.poseName === 'custom', percent = Math.round(r.progress * 100);
      panel.querySelector('#le-progress').disabled = custom; panel.querySelector('#le-progress').value = percent;
      panel.querySelector('#le-progress-label').textContent = custom ? '自定义' : percent + '%';
      const name = { neutral: '自然闭口', jaw: '张口检查', speak: '说话姿态', pucker: '噘嘴', custom: '自定义动作' }[r.poseName];
      panel.querySelector('#le-status').textContent = ({ r07: '当前 R07', r06: '前一版 R06', inherited: '载入的历史人物／自定义参数' })[comparison] + ' · ' + name + (custom ? '' : ' · ' + percent + '%');
      return { r, s };
    }
    function describe({ r, s }) {
      return { version: VERSION, schema: SCHEMA, ready: status.ready, source: status.source, comparison, view: lastView,
        poseName: r.poseName, progress: r.progress, pose: window.lipWorkbench.pose(), implementation: solver.version, solver: s,
        cornerComparison: r.comparison, cornerSolver: r.solver, motionComparison: r.motionComparison, motionSolver: r.motionSolver,
        innerComparison: r.innerComparison, restoring, canonicalGeometryChanged: false, newMeshes: 0, newImageMaps: 0,
        lightingChangedByModule: false, visualAcceptance: false, productionReady: false,
        archiveIntegration: { fullPersonChain: true, newDownloadFilename: 'lip-edge-r07-person.json',
          inheritedHeadBodyDownloadFilename: 'lip-corner-r06-person.json', inheritedDownloadsUseCurrentArchive: true,
          competingWindowCaptureAdded: false } };
    }
    function report() { return describe(sync()); }
    function render() { const snapshot = sync(); v.render(); return describe(snapshot); }
    function compare(mode) {
      idle(); if (!['r07', 'r06'].includes(mode)) throw Error('无效嘴唇对照版本');
      try {
        batch('matched R07/R06 version switch', () => heldView(() => {
          ensureR06();
          if (mode === 'r07') {
            installEdge(); solver.setEnabled(true);
            const enabled = solver.report();
            if (!enabled.enabled || !enabled.valid || !matchedR06()) throw Error('R07 未能在合法 R06 状态下启用');
          } else if (solver.report().installed) solver.setEnabled(false);
          comparison = mode; v.update();
        }));
      } catch (error) {
        try {
          batch('clear failed R07 switch', () => heldView(() => { detach(); comparison = matchedR06() ? 'r06' : 'inherited'; v.update(); }));
          render();
        } catch (recoveryError) { throw new AggregateError([error, recoveryError], 'R07 切换与清理均失败'); }
        throw error;
      }
      return render();
    }
    function pose(name, amount = 1) {
      idle();
      if (!['neutral', 'jaw', 'speak', 'pucker'].includes(name) || !Number.isFinite(amount) || amount < 0 || amount > 1) throw Error('无效嘴唇动作或进度');
      // R05 remains the one owner of controlPose/progress and the native pose.
      try { nativePose(name, amount); return report(); }
      catch (error) {
        // A failed native evaluation may have written only part of the R07
        // result. Unwind our outer owner and evaluate the inherited person
        // once before rendering it; the original operation still rejects.
        try {
          batch('clear failed R07 pose evaluation', () => heldView(() => {
            detach(); comparison = matchedR06() ? 'r06' : 'inherited'; v.update();
          }));
          render();
        } catch (recoveryError) {
          throw new AggregateError([error, recoveryError], '动作求值与 R07 清理均失败');
        }
        throw error;
      }
    }
    function view(kind) {
      idle(); if (!['macro', 'oblique', 'front', 'bust'].includes(kind)) throw Error('无效观察视角');
      nativeView(kind); lastView = kind; return report();
    }
    function validateMatchedArchive(a) {
      const c = a.lipCorner, m = a.lipMotion, i = a.innerLip, b = a.lipRealism;
      if (c?.schema !== 'kaopu/lip-corner@1' || c.version !== 'LIP-CORNER-R06' || c.implementation !== inheritedImplementations.corner || c.comparison !== 'r06' ||
          m?.schema !== 'kaopu/lip-motion@1' || m.version !== 'LIP-MOTION-R05' || m.implementation !== inheritedImplementations.motion || m.comparison !== 'r05' ||
          i?.schema !== 'kaopu/lip-inner@1' || i.version !== 'LIP-INNER-R04' || i.implementation !== inheritedImplementations.inner || i.comparison !== 'r04' || i.diagnostic !== 0 ||
          b?.schema !== 'kaopu/lip-realism@1' || b.version !== 'LIP-REALISM-R02' || b.colourReview?.schema !== 'kaopu/lip-colour-review@1' ||
          b.colourReview.comparison !== 'r02' || b.colourReview.spatialColour !== false || b.settings?.diagnostic !== 0) {
        throw Error('R07 对照档案需要配套的 R06/R05/R04 人物状态，人物尚未更改');
      }
      if ((m.controlPose !== undefined || m.progress !== undefined) && !((m.controlPose === null && m.progress === null) ||
          (['neutral', 'jaw', 'speak', 'pucker'].includes(m.controlPose) && Number.isFinite(m.progress) && m.progress >= 0 && m.progress <= 1))) {
        throw Error('动作进度档案无效，人物尚未更改');
      }
    }
    function archive() {
      idle(); sync();
      const complete = priorArchive();
      if (comparison !== 'inherited') validateMatchedArchive(complete);
      return { ...complete, lipEdge: { schema: SCHEMA, version: VERSION, implementation: solver.version, comparison } };
    }
    async function restore(a) {
      idle();
      if (!a || typeof a !== 'object' || Array.isArray(a)) throw Error('人物档案格式无效');
      const has = Object.prototype.hasOwnProperty.call(a, 'lipEdge'), own = has ? a.lipEdge : undefined;
      if (has && (!own || typeof own !== 'object' || Array.isArray(own) || own.schema !== SCHEMA || own.version !== VERSION ||
          own.implementation !== solver.version || !['r07', 'r06', 'inherited'].includes(own.comparison))) {
        throw Error('此内缘档案不属于当前实现，人物尚未更改');
      }
      if (own && own.comparison !== 'inherited') validateMatchedArchive(a);
      const copy = structuredClone(a); delete copy.lipEdge;
      const previous = { comparison, enabled: solver.report().enabled };
      let failureCleanupCompleted = false;
      restoring = true;
      try {
        await batchAsync('restore complete person before rebuilding R07', async () => {
          detach();
          try { await priorRestore(copy); }
          catch (error) {
            try {
              if (matchedR06()) {
                if (previous.enabled) { installEdge(); solver.setEnabled(true); }
                comparison = previous.enabled ? 'r07' : previous.comparison === 'inherited' ? 'inherited' : 'r06';
              } else comparison = 'inherited';
              v.update();
              failureCleanupCompleted = true;
            } catch (recoveryError) { throw new AggregateError([error, recoveryError], '人物载入与 R07 恢复均失败'); }
            throw error;
          }
          try {
            comparison = matchedR06() ? (own ? own.comparison : 'r06') : 'inherited';
            if (comparison === 'r07') { installEdge(); solver.setEnabled(true); }
            v.update();
          } catch (error) {
            try { detach(); comparison = matchedR06() ? 'r06' : 'inherited'; v.update(); failureCleanupCompleted = true; }
            catch (recoveryError) { throw new AggregateError([error, recoveryError], '人物已载入，但 R07 绑定与清理均失败'); }
            throw error;
          }
        });
      } catch (error) {
        // batchAsync has restored native rendering. Draw only a successfully
        // recovered person; malformed archives never enter this mutation path.
        restoring = false;
        if (failureCleanupCompleted) {
          try { render(); }
          catch (renderError) { throw new AggregateError([error, renderError], '人物载入失败，恢复画面也未能渲染'); }
        }
        throw error;
      } finally { restoring = false; }
      const restored = render();
      if (own?.comparison === 'r07' && (restored.comparison !== 'r07' || !restored.solver.enabled || !restored.solver.valid)) throw Error('人物已载入，但 R07 未能恢复到配套状态');
      return restored;
    }
    const currentArchive = () => controller.archive(), currentRestore = a => controller.restore(a);
    function save() {
      const url = URL.createObjectURL(new Blob([JSON.stringify(currentArchive(), null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'lip-edge-r07-person.json';
      try { a.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
    function visibleError(error) {
      const message = String(error); status.errors.push(message); panel.querySelector('#le-status').textContent = message;
    }
    async function loadFile(input) {
      const file = input?.files?.[0]; if (!file) return;
      try { await currentRestore(JSON.parse(await file.text())); }
      catch (error) { visibleError(error); }
      finally { input.value = ''; }
    }

    // Prepare the actual inherited person before exposing a successful panel.
    try {
      batch('R07 binding and native startup', () => {
        window.lifelikeIdle?.pause?.(); window.lipWorkbench.stop?.();
        ensureR06(); nativePose('jaw', 1); nativeView('oblique'); compare('r07');
      });
    } catch (error) {
      try { batch('clear incomplete R07 startup', () => { detach(); v.update(); }); }
      catch (recoveryError) { throw new AggregateError([error, recoveryError], 'R07 初始化与清理均失败'); }
      throw error;
    }

    controller.archive = archive; controller.restore = restore;
    for (const api of archiveAPIs) { api.archive = currentArchive; api.restore = currentRestore; }
    shell.prepend(panel); oldPanel.hidden = true; document.head.append(style);
    // No new capture handler: the earlier R06 saves/loads already forward to
    // controller.archive/restore dynamically, including their existing inputs.
    panel.addEventListener('click', e => {
      const b = e.target.closest?.('button'); if (!b) return;
      try {
        if (b.dataset.leCompare) compare(b.dataset.leCompare);
        if (b.dataset.lePose) pose(b.dataset.lePose);
        if (b.dataset.leView) view(b.dataset.leView);
        if (b.dataset.leAction === 'save') save();
        if (b.dataset.leAction === 'load') panel.querySelector('#le-file').click();
      } catch (error) { visibleError(error); }
    });
    panel.querySelector('#le-progress').oninput = e => {
      try { const r = prior.report(); if (r.poseName === 'custom') { sync(); return; } pose(r.poseName, Number(e.target.value) / 100); }
      catch (error) { visibleError(error); }
    };
    panel.querySelector('#le-file').onchange = e => loadFile(e.target);
    function inheritedChange(e) {
      if (!panel.contains(e.target)) queueMicrotask(() => { try { sync(); } catch (error) { visibleError(error); } });
    }
    shell.addEventListener('change', inheritedChange); shell.addEventListener('click', inheritedChange);
    window.edgeLip = { version: VERSION, get ready() { return status.ready; }, compare, pose, view, report, archive: currentArchive, restore: currentRestore, save };
    document.title = 'KAOPU · 嘴唇内缘 R07'; heading.textContent = '人物总台 · 嘴唇 R07';
    document.documentElement.dataset.lipEdge = VERSION;
    document.documentElement.dataset.lipEdgeSource = status.source?.sourceCommit || 'local';
    status.ready = true; render(); return true;
  }

  const start = performance.now(), timer = setInterval(() => {
    try {
      if (boot()) { clearInterval(timer); return; }
      if (performance.now() - start > 300000) { clearInterval(timer); status.errors.push('原人物尚未就绪，R07 未启用'); }
    } catch (error) { clearInterval(timer); status.ready = false; status.errors.push(String(error)); console.error('LIP_EDGE_INIT', error); throw error; }
  }, 120);
  addEventListener('pagehide', () => clearInterval(timer), { once: true });
})();
