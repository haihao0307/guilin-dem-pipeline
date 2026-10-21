/* R08 controls and complete-person archive integration on the fixed R06 host.
 * The new layer owns only its declared surface shader. R05 remains the owner
 * of pose/progress; R06 retains its native corner correction. Existing save
 * handlers forward to controller.archive(), including the real R06, head,
 * body and older lip buttons. No competing save capture is installed here.
 */
(function () {
  'use strict';
  const VERSION = 'LIP-SURFACE-R08', SCHEMA = 'kaopu/lip-surface@1';
  const status = window.__LIP_SURFACE__ = {
    version: VERSION, ready: false, errors: [], source: window.__LIP_SURFACE_SOURCE__ || null
  };

  function boot() {
    const prior = window.cornerLip, material = window.__LIP_SURFACE_MATERIAL__;
    const v = window.__IDENTITY_QA__?.viewer?.(), model = window.__IDENTITY_QA__?.model?.();
    const controller = window.__IDENTITY_QA__?.controller?.();
    if (!prior?.ready || !material || !v?.startupFinalFrame) return false;
    if (prior.version !== 'LIP-CORNER-R06' || material.version !== 'native-lip-surface@1') throw Error('嘴唇 R08 需要配套的 R06 人物与表面实现');
    for (const name of ['install', 'setMode', 'report', 'shaderEvidence', 'uninstall']) {
      if (typeof material[name] !== 'function') throw Error('嘴唇表面接口缺失：' + name);
    }
    for (const name of ['compare', 'pose', 'view', 'report']) {
      if (typeof prior[name] !== 'function') throw Error('R06 人物控制接口缺失：' + name);
    }
    if (!model || typeof controller?.archive !== 'function' || typeof controller?.restore !== 'function' ||
        typeof v.render !== 'function' || typeof v.update !== 'function') throw Error('完整人物控制器缺失');
    const shell = document.querySelector('#control-shell'), oldPanel = document.querySelector('#lc-controls');
    const heading = document.querySelector('header strong');
    if (!shell || !oldPanel || !heading || document.querySelector('#ls-controls')) throw Error('人物工作台界面缺失或 R08 已安装');

    const nativeCompare = prior.compare.bind(prior), nativePose = prior.pose.bind(prior), nativeView = prior.view.bind(prior);
    // Capture the concrete implementations before updating dynamic aliases.
    const priorArchive = controller.archive.bind(controller), priorRestore = controller.restore.bind(controller);
    const inheritedImplementations = {
      corner: window.__LIP_CORNER_SOLVER__?.version,
      motion: window.__LIP_MOTION_SOLVER__?.version,
      inner: window.__LIP_INNER_SHADER__?.version
    };
    if (Object.values(inheritedImplementations).some(x => typeof x !== 'string' || !x)) throw Error('配套嘴唇实现标识缺失');
    const archiveAPIs = [window.fullCommonWorkbench, window.headProceduralSkin, window.bodyProceduralSkin,
      window.lipRealism, window.innerLip, window.motionLip, prior];
    if (archiveAPIs.some(api => !api || typeof api.archive !== 'function' || typeof api.restore !== 'function')) throw Error('完整人物存档接口缺失');
    let comparison = 'r06', lastView = 'macro', restoring = false, reconciling = false;

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
    function idle() { if (restoring) throw Error('人物档案正在载入，请等待完成'); }
    function materialValid(s = material.report()) {
      return s.installed && s.valid && s.hooksStable && s.materialSameObject;
    }
    function matchedR06(r = prior.report()) {
      const inner = window.innerLip.report(), base = window.lipRealism.report();
      return r.comparison === 'r06' && r.solver?.installed && r.solver.valid && r.solver.enabled &&
        r.motionComparison === 'r05' && r.motionSolver?.valid && r.motionSolver.enabled && r.innerComparison === 'r04' &&
        inner.diagnostic === 0 && base.comparison === 'r02' &&
        window.lipRealism.settings().diagnostic === 0;
    }
    function requireMaterial() {
      const s = material.report();
      if (!materialValid(s)) throw Error('嘴唇表面已被其他编辑改变，请重新打开对应版本');
      return s;
    }
    function closeSurface() {
      const before = material.report();
      if (before.installed) {
        if (materialValid(before)) material.setMode('r06');
        else material.uninstall();
      }
      const after = material.report();
      if (after.installed && after.mode !== 'r06') throw Error('嘴唇表面未能安全关闭');
      return after;
    }
    function ensureR06() {
      requireMaterial();
      if (!matchedR06()) nativeCompare('r06');
      if (!matchedR06()) throw Error('当前人物参数不满足 R06 状态，本轮表面未启用');
    }

    const panel = document.createElement('section'); panel.id = 'ls-controls';
    panel.innerHTML = '<h2>嘴唇质感 <small>R08 · 同一人物</small></h2>' +
      '<p>观察唇色层次与唇缘过渡。切换版本时保持同一动作、镜头和灯光。</p>' +
      '<div class="ls-row"><button data-ls-compare="r08">本轮质感 R08</button><button data-ls-compare="r06">原版 R06</button></div>' +
      '<label class="ls-caption">动作</label><div class="ls-row"><button data-ls-pose="neutral">自然闭口</button><button data-ls-pose="jaw">张口检查</button><button data-ls-pose="speak">说话姿态</button><button data-ls-pose="pucker">噘嘴</button></div>' +
      '<label class="ls-progress">动作进度 <output id="ls-progress-label">100%</output><input id="ls-progress" type="range" min="0" max="100" step="1" value="100"></label>' +
      '<label class="ls-caption">视角</label><div class="ls-row"><button data-ls-view="macro">嘴部正面</button><button data-ls-view="oblique">嘴部斜侧</button><button data-ls-view="front">整脸正面</button><button data-ls-view="bust">头颈同框</button></div>' +
      '<div class="ls-row"><button data-ls-action="save">保存完整人物</button><button data-ls-action="load">载入人物档案</button><input id="ls-file" type="file" accept="application/json,.json" hidden></div>' +
      '<p id="ls-status" role="status"></p><details><summary>关于这次调整</summary><p>本轮调整外唇的颜色组织与唇缘过渡。选择不同动作与视角，可以比较它们在同一个人物上的表现。</p></details>';
    const style = document.createElement('style');
    style.textContent = '#ls-controls{padding:18px;color:#eee9df;background:#16262b;font:13px/1.55 system-ui;flex-shrink:0}#ls-controls h2{font-size:21px;line-height:1.2;margin:0 0 10px}#ls-controls h2 small{display:inline-block;font-size:12px;font-weight:400;color:#bbd4ce}#ls-controls p{font-size:12px;color:#c0cdcc;margin:8px 0 12px}.ls-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:7px 0 12px}.ls-row button{min-height:36px;font-size:12px}.ls-row button[aria-pressed="true"]{border-color:#d6c293;background:#354943;color:#fff2d7}.ls-caption{display:block;font-size:11px;color:#b7c8c8;margin-top:12px}.ls-progress{display:block;font-size:12px;margin:12px 0}.ls-progress output{float:right;font-variant-numeric:tabular-nums}.ls-progress input{display:block;width:100%;margin:10px 0}#ls-status{border-top:1px solid #466064;padding-top:10px}#ls-controls details{font-size:12px}#lc-controls[hidden]{display:none!important}@media(max-width:900px){#ls-controls{padding:13px}#ls-controls h2{font-size:18px}}';

    function sync() {
      let r = prior.report(), s = material.report();
      if (!restoring && !reconciling) {
        const matched = matchedR06(r), badOwner = s.installed && !materialValid(s);
        const wrongMode = comparison === 'r08' ? s.mode !== 'r08' : s.mode !== 'r06';
        if (badOwner || (comparison === 'r08' && (!matched || !materialValid(s) || wrongMode)) ||
            (comparison !== 'r08' && s.installed && wrongMode)) {
          reconciling = true;
          try {
            closeSurface();
            comparison = matched && materialValid() ? 'r06' : 'inherited';
            // Removing a lost material owner also invalidates R06's original
            // binding. Clear any previously evaluated correction through the
            // unchanged native update; never leave a stale solved frame.
            if (badOwner) batch('clear stale inherited binding after material owner loss', () => heldView(() => v.update()));
            v.render();
          } finally { reconciling = false; }
          r = prior.report(); s = material.report();
        }
        if (comparison === 'r06' && !matchedR06(r)) comparison = 'inherited';
      }
      for (const b of panel.querySelectorAll('[data-ls-compare]')) b.setAttribute('aria-pressed', String(b.dataset.lsCompare === comparison));
      for (const b of panel.querySelectorAll('[data-ls-pose]')) b.setAttribute('aria-pressed', String(b.dataset.lsPose === r.poseName));
      for (const b of panel.querySelectorAll('[data-ls-view]')) b.setAttribute('aria-pressed', String(b.dataset.lsView === lastView));
      const custom = r.poseName === 'custom', percent = Number.isFinite(r.progress) ? Math.round(r.progress * 100) : 0;
      panel.querySelector('#ls-progress').disabled = custom; panel.querySelector('#ls-progress').value = percent;
      panel.querySelector('#ls-progress-label').textContent = custom ? '自定义' : percent + '%';
      const name = { neutral: '自然闭口', jaw: '张口检查', speak: '说话姿态', pucker: '噘嘴', custom: '自定义动作' }[r.poseName] || '当前动作';
      panel.querySelector('#ls-status').textContent = ({ r08: '本轮质感 R08', r06: '原版 R06', inherited: '历史人物／自定义参数' })[comparison] + ' · ' + name + (custom ? '' : ' · ' + percent + '%');
      return { r, s };
    }
    function describe({ r, s }) {
      return { version: VERSION, schema: SCHEMA, ready: status.ready && materialValid(s), source: status.source, comparison, view: lastView,
        poseName: r.poseName, progress: r.progress, pose: window.lipWorkbench.pose(), implementation: material.version, material: s,
        cornerComparison: r.comparison, cornerSolver: r.solver, motionComparison: r.motionComparison, motionSolver: r.motionSolver,
        innerComparison: r.innerComparison, restoring, canonicalGeometryChanged: false, nativeEvaluatedGeometryChangedByModule: false,
        newMeshes: 0, newImageMaps: 0, lightingChangedByModule: false, visualAcceptance: false, productionReady: false,
        archiveIntegration: { fullPersonChain: true, newDownloadFilename: 'lip-surface-r08-person.json',
          inheritedHeadBodyDownloadFilename: 'lip-corner-r06-person.json', inheritedDownloadsUseCurrentArchive: true,
          competingWindowCaptureAdded: false } };
    }
    function report() { return describe(sync()); }
    function render() { const snapshot = sync(); v.render(); return describe(snapshot); }
    function compare(mode) {
      idle(); if (!['r08', 'r06'].includes(mode)) throw Error('无效嘴唇对照版本');
      try {
        batch('matched R08/R06 surface switch', () => heldView(() => {
          ensureR06(); material.setMode(mode); comparison = mode;
          if (!materialValid() || !matchedR06()) throw Error('嘴唇表面与 R06 人物状态不一致');
        }));
      } catch (error) {
        try { closeSurface(); comparison = matchedR06() && materialValid() ? 'r06' : 'inherited'; render(); }
        catch (recoveryError) { throw new AggregateError([error, recoveryError], '嘴唇切换与关闭均失败'); }
        throw error;
      }
      return render();
    }
    function pose(name, amount = 1) {
      idle();
      if (!['neutral', 'jaw', 'speak', 'pucker'].includes(name) || !Number.isFinite(amount) || amount < 0 || amount > 1) throw Error('无效嘴唇动作或进度');
      nativePose(name, amount); return report();
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
        throw Error('此嘴唇档案需要配套的 R06/R05/R04 人物状态，人物尚未更改');
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
      return { ...complete, lipSurface: { schema: SCHEMA, version: VERSION, implementation: material.version, comparison } };
    }
    async function restore(a) {
      idle();
      if (!a || typeof a !== 'object' || Array.isArray(a)) throw Error('人物档案格式无效');
      if (Object.prototype.hasOwnProperty.call(a, 'lipEdge')) throw Error('此档案包含 R07 内缘实现，请在原 R07 工作台载入；人物尚未更改');
      const has = Object.prototype.hasOwnProperty.call(a, 'lipSurface'), own = has ? a.lipSurface : undefined;
      if (has && (!own || typeof own !== 'object' || Array.isArray(own) || own.schema !== SCHEMA || own.version !== VERSION ||
          own.implementation !== material.version || !['r08', 'r06', 'inherited'].includes(own.comparison))) {
        throw Error('此表面档案不属于当前实现，人物尚未更改');
      }
      if (own && own.comparison !== 'inherited') validateMatchedArchive(a);
      const copy = structuredClone(a); delete copy.lipSurface;
      restoring = true;
      let cleaned = false;
      try {
        await batchAsync('restore complete person and surface selection', async () => {
          requireMaterial(); material.setMode('r06'); comparison = 'inherited';
          // R06 restore rebuilds its own binding while the stable shader owner
          // remains installed. A legacy archive keeps its actual old version.
          await priorRestore(copy);
          requireMaterial();
          const matched = matchedR06();
          if (own && own.comparison !== 'inherited' && !matched) throw Error('人物已载入，但配套 R06 状态未能恢复');
          comparison = matched ? (own ? own.comparison : 'r06') : 'inherited';
          material.setMode(comparison === 'r08' ? 'r08' : 'r06');
        });
      } catch (error) {
        try { closeSurface(); comparison = matchedR06() && materialValid() ? 'r06' : 'inherited'; cleaned = true; }
        catch (recoveryError) { throw new AggregateError([error, recoveryError], '人物载入与嘴唇表面关闭均失败'); }
        throw error;
      } finally {
        restoring = false;
        if (cleaned) render();
      }
      const restored = render();
      if (own?.comparison === 'r08' && (restored.comparison !== 'r08' || restored.material.mode !== 'r08' || !restored.material.valid)) throw Error('人物已载入，但本轮表面未能恢复');
      return restored;
    }
    const currentArchive = () => controller.archive(), currentRestore = a => controller.restore(a);
    function save() {
      const url = URL.createObjectURL(new Blob([JSON.stringify(currentArchive(), null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'lip-surface-r08-person.json';
      try { a.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
    function visibleError(error) {
      const message = String(error); status.errors.push(message); panel.querySelector('#ls-status').textContent = message;
    }
    async function loadFile(input) {
      const file = input?.files?.[0]; if (!file) return;
      try { await currentRestore(JSON.parse(await file.text())); }
      catch (error) { visibleError(error); }
      finally { input.value = ''; }
    }

    // Bind the original corner solver to the stable declared shader wrapper.
    // This uses the ancestor's public rebind path, not a weakened guard.
    try {
      batch('R08 stable material owner and native startup', () => {
        window.lifelikeIdle?.pause?.(); window.lipWorkbench.stop?.();
        material.install(v, model); material.setMode('r06');
        nativeCompare('r06');
        requireMaterial(); if (!matchedR06()) throw Error('R06 人物未能绑定本轮表面');
        nativePose('neutral', 1); nativeView('macro');
        material.setMode('r08'); comparison = 'r08';
      });
    } catch (error) {
      try { closeSurface(); }
      catch (recoveryError) { throw new AggregateError([error, recoveryError], '嘴唇初始化与关闭均失败'); }
      throw error;
    }

    controller.archive = archive; controller.restore = restore;
    for (const api of archiveAPIs) { api.archive = currentArchive; api.restore = currentRestore; }
    shell.prepend(panel); oldPanel.hidden = true; document.head.append(style);

    const oldComparisonSelector = '[data-lc-compare],[data-lm-compare],[data-li-compare],[data-lr-comparison],[data-lr-mode]';
    const oldMaterialActionSelector = '#lr-controls [data-lr-action="seed"],#lr-controls [data-lr-action="reset"],#ps-controls [data-ps-action="compare"],#ps-controls [data-ps-action="reset"],#ps-controls [data-ps-action="seed"],#ps-controls [data-fb-action="defaults"],#ps-controls [data-fb-action="legacy"]';
    // No save/load interception. The existing R06 handlers already dispatch
    // through the current controller. Prepare only actual old version edits.
    shell.addEventListener('click', e => {
      const button = e.target.closest?.('button');
      if (!button || panel.contains(button) || !button.matches(oldComparisonSelector + ',' + oldMaterialActionSelector)) return;
      try {
        idle();
        batch('prepare inherited surface/version edit', () => heldView(() => {
          closeSurface(); comparison = 'inherited';
          if (button.matches('#li-controls [data-li-compare="r02"]')) {
            const cornerSolver = window.__LIP_CORNER_SOLVER__;
            if (cornerSolver.report().installed) cornerSolver.setEnabled(false);
            // Settle R05's lexical archive mode before the original R02
            // handler runs. Disabling the solver alone is insufficient.
            window.motionLip.compare('r04');
          }
        }));
      } catch (error) { visibleError(error); }
    }, true);
    function prepareMaterialInput(e) {
      const input = e.target;
      if (panel.contains(input) || !input.matches?.('#lr-controls [data-lr],#lr-preset,#lr-diagnostic,#li-channel,#ps-controls [data-ps],#ps-diagnostic,#ps-controls [data-fb],#fb-audit')) return;
      try { idle(); closeSurface(); comparison = 'inherited'; }
      catch (error) { visibleError(error); }
    }
    shell.addEventListener('input', prepareMaterialInput, true);
    shell.addEventListener('change', prepareMaterialInput, true);
    panel.addEventListener('click', e => {
      const b = e.target.closest?.('button'); if (!b) return;
      try {
        if (b.dataset.lsCompare) compare(b.dataset.lsCompare);
        if (b.dataset.lsPose) pose(b.dataset.lsPose);
        if (b.dataset.lsView) view(b.dataset.lsView);
        if (b.dataset.lsAction === 'save') save();
        if (b.dataset.lsAction === 'load') panel.querySelector('#ls-file').click();
      } catch (error) { visibleError(error); }
    });
    panel.querySelector('#ls-progress').oninput = e => {
      try { const r = prior.report(); if (r.poseName === 'custom') { sync(); return; } pose(r.poseName, Number(e.target.value) / 100); }
      catch (error) { visibleError(error); }
    };
    panel.querySelector('#ls-file').onchange = e => loadFile(e.target);
    function inheritedChange(e) {
      if (!panel.contains(e.target)) queueMicrotask(() => { try { sync(); } catch (error) { visibleError(error); } });
    }
    shell.addEventListener('change', inheritedChange); shell.addEventListener('click', inheritedChange);
    window.surfaceLip = { version: VERSION, get ready() { return status.ready && materialValid(); }, compare, pose, view, report,
      archive: currentArchive, restore: currentRestore, save, shaderEvidence: () => material.shaderEvidence() };
    document.title = 'KAOPU · 嘴唇质感 R08'; heading.textContent = '人物总台 · 嘴唇 R08';
    document.documentElement.dataset.lipSurface = VERSION;
    document.documentElement.dataset.lipSurfaceSource = status.source?.sourceCommit || 'local';
    render(); status.ready = true; return true;
  }
  const start = performance.now(), timer = setInterval(() => {
    try {
      if (boot()) { clearInterval(timer); return; }
      if (performance.now() - start > 300000) { clearInterval(timer); status.errors.push('原人物尚未就绪，嘴唇 R08 未启用'); }
    } catch (error) { clearInterval(timer); status.errors.push(String(error)); console.error('LIP_SURFACE_INIT', error); }
  }, 120);
  addEventListener('pagehide', () => clearInterval(timer), { once: true });
})();
