/* Control availability for the frozen R07 host. This module never changes a
 * shader, mesh, camera, light, preset or archive. A stored legacy recipe is not
 * evidence that the currently displayed material consumes that recipe. */
(() => {
  'use strict';
  const VERSION = 'LIP-CONTROL-CONTRACT-R01';
  const keys = Object.freeze(['wetness', 'upperWetness', 'lowerWetness']);
  const selectors = [
    'input[data-lip-key="wetness"]',
    'input[data-l19-kind="dna"][data-l19-key="upperWetness"]',
    'input[data-l19-kind="dna"][data-l19-key="lowerWetness"]'
  ];
  // Frozen ET19 preset values, not a conversion into the R07 wetness model.
  const presetWetness = Object.freeze({ natural: .35, dry: .15, moist: .74, reset: .35 });
  const startup = window.__LIP_CONTROL_CONTRACT__ = { version: VERSION, ready: false, errors: [] };

  function install() {
    const qa = window.__IDENTITY_QA__, viewer = qa?.viewer?.(), model = qa?.model?.();
    const controller = qa?.controller?.(), surface = window.headProceduralSkin;
    const workbench = window.lipWorkbench, lip = model?.lipStructure;
    const shell = document.querySelector('#control-shell'), panel = document.querySelector('#ps-controls');
    if (!window.__HEAD_PROC__?.ready || !window.__R05_PRESET_READY__ || !window.bodyProceduralSkin ||
        !viewer?.mesh || !lip?.anatomy || !workbench?.setDNA || !surface || !shell || !panel) return false;

    const material = surface.material(), reviewedCompile = material.onBeforeCompile;
    const nativeMaterial = viewer.skin.material, reviewedNativeCompile = nativeMaterial.onBeforeCompile;
    const restorers = [];
    let scheduled = false, disposed = false, restoreNotice = '';

    function report() {
      const settings = surface.settings();
      const gray = !!model.foldProfile?.settings?.gray;
      const active = viewer.mesh.material;
      let owner = 'unknown';
      if (settings.enabled && !gray && Array.isArray(active) && active.includes(material) &&
          material.onBeforeCompile === reviewedCompile && !window.lipRealism) owner = 'r07-program';
      else if ((!settings.enabled || gray) && active === nativeMaterial && viewer.skin.material === nativeMaterial &&
               nativeMaterial.onBeforeCompile === reviewedNativeCompile) owner = 'native-et19';
      const native = owner === 'native-et19';
      return {
        version: VERSION, owner,
        legacyWetness: { supported: native, keys: [...keys], values: {
          wetness: lip.settings.wetness,
          upperWetness: lip.anatomy.settings.upperWetness,
          lowerWetness: lip.anatomy.settings.lowerWetness
        }, consumer: native ? 'ET19 uLWet / uL19Wet' : null },
        currentWetness: { supported: owner === 'r07-program',
          value: owner === 'r07-program' ? settings.lipWetness : null,
          consumer: owner === 'r07-program' ? 'R07 psWet' : null },
        observation: gray ? 'gray-view' : owner === 'r07-program' && ![0, 2].includes(settings.diagnostic)
          ? 'diagnostic-channel-hides-wetness' : 'material-or-roughness',
        scope: 'wetness controls only; no numerical equivalence between ET19 and R07',
        restorePolicy: 'Archive restore and original undo restore a retained recipe; they are not live material-control edits.',
        visualImprovementClaimed: false
      };
    }

    function guard(patch, fields, current) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return;
      const changed = fields.filter(k => Object.hasOwn(patch, k) && !Object.is(patch[k], current[k]));
      if (!changed.length || report().legacyWetness.supported) return;
      const error = new Error('当前材质不支持旧湿润参数：' + changed.join('、') +
        '。原值仍保留；请使用当前唇部湿润，或切回原皮肤后调整。');
      error.code = 'LIP_CONTROL_INACTIVE';
      error.controls = changed;
      throw error;
    }
    function wrap(target, method, fields, current) {
      const original = target[method];
      const wrapped = function (...args) {
        guard(args[0], fields, current());
        return original.apply(this, args);
      };
      target[method] = wrapped;
      restorers.push(() => { if (target[method] === wrapped) target[method] = original; });
    }
    // Bottom setters cover the original UI's closures; public guards also stop
    // a rejected call before it can append to the original UI's undo history.
    wrap(lip, 'set', ['wetness'], () => lip.settings);
    wrap(lip.anatomy, 'set', ['upperWetness', 'lowerWetness'], () => lip.anatomy.settings);
    wrap(workbench, 'set', ['wetness'], () => lip.settings);
    wrap(workbench, 'setDNA', ['upperWetness', 'lowerWetness'], () => lip.anatomy.settings);
    const reset = workbench.reset;
    const guardedReset = function (...args) {
      guard({ wetness: presetWetness.reset }, ['wetness'], lip.settings);
      return reset.apply(this, args);
    };
    workbench.reset = guardedReset;
    restorers.push(() => { if (workbench.reset === guardedReset) workbench.reset = reset; });

    function noteText(r) {
      if (r.owner === 'r07-program') return '当前皮肤支持整体唇部湿润，不支持旧版的上下唇分别调整。旧值仍保留，切回原皮肤可继续使用。';
      if (r.owner === 'native-et19') return '当前为原皮肤：整体、上唇和下唇湿润均使用原版控制。程序皮肤的湿润值另行保留。';
      return '当前材质的湿润控制尚未核对。旧湿润控件已暂停，人物中的原值仍保留。';
    }
    function makeNote(id) {
      const box = document.createElement('div');
      box.id = id; box.className = 'lcc-note'; box.dataset.lccNote = '';
      const text = document.createElement('p'); text.dataset.lccMessage = ''; box.append(text);
      const button = document.createElement('button'); button.type = 'button';
      button.dataset.lccFocus = ''; button.textContent = '前往当前唇部湿润';
      button.onclick = () => {
        const input = document.querySelector('[data-ps="lipWetness"]');
        if (!report().currentWetness.supported || !input) return;
        for (let p = input.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
        input.scrollIntoView({ block: 'center', behavior: 'smooth' }); input.focus({ preventScroll: true });
      };
      box.append(button);
      const restored = document.createElement('p'); restored.dataset.lccRestoreMessage = '';
      restored.setAttribute('role', 'status'); restored.hidden = true; box.append(restored);
      return box;
    }
    const summary = makeNote('lcc-surface-note');
    panel.querySelector('.ps-buttons').after(summary);
    const style = document.createElement('style');
    style.textContent = '.lcc-note{padding:9px 11px;margin:9px 0;border:1px solid #586d72;border-radius:6px;background:#1c3036}.lcc-note p{margin:0 0 7px!important;font-size:12px!important;line-height:1.6}.lcc-note button{font-size:12px;min-height:34px}input[data-lcc-inactive="true"]{opacity:.42;cursor:not-allowed}label:has(input[data-lcc-inactive="true"])>span{color:#a8b3b8}';
    document.head.append(style);

    function textIfChanged(node, value) { if (node.textContent !== value) node.textContent = value; }
    function refresh() {
      scheduled = false; if (disposed) return;
      const r = report(), text = noteText(r), mother = document.querySelector('#lip19Mother');
      if (mother && !mother.querySelector('#lcc-legacy-note')) mother.querySelector('h3').after(makeNote('lcc-legacy-note'));
      for (const selector of selectors) for (const input of shell.querySelectorAll(selector)) {
        input.disabled = !r.legacyWetness.supported;
        const inactive = String(!r.legacyWetness.supported);
        if (input.dataset.lccInactive !== inactive) input.dataset.lccInactive = inactive;
        input.setAttribute('aria-describedby', mother ? 'lcc-legacy-note' : 'lcc-surface-note');
        if (input.title !== text) input.title = text;
      }
      for (const [action, wetness] of Object.entries(presetWetness)) {
        for (const button of shell.querySelectorAll('[data-lip-action="' + action + '"]')) {
          button.disabled = !r.legacyWetness.supported && !Object.is(wetness, lip.settings.wetness);
          button.title = button.disabled ? '此原版方案包含当前材质不支持的湿润变化。切回原皮肤后可使用。' : '';
        }
      }
      for (const button of shell.querySelectorAll('[data-lip-action="undo"]')) {
        textIfChanged(button, r.legacyWetness.supported ? '撤回修改' : '撤回原唇部配方');
        button.title = '恢复原唇部配方，包括保留的旧材质值；当前程序皮肤的整体湿润值不随它改变。';
      }
      const current = panel.querySelector('[data-ps="lipWetness"]');
      if (current) {
        current.dataset.lccCurrentWetness = '';
        current.disabled = !r.currentWetness.supported;
      }
      for (const note of shell.querySelectorAll('[data-lcc-note]')) {
        textIfChanged(note.querySelector('[data-lcc-message]'), text);
        note.querySelector('[data-lcc-focus]').hidden = !r.currentWetness.supported;
        const restored = note.querySelector('[data-lcc-restore-message]');
        textIfChanged(restored, restoreNotice); restored.hidden = !restoreNotice || r.legacyWetness.supported;
      }
      return r;
    }
    function schedule() {
      if (scheduled || disposed) return;
      scheduled = true; requestAnimationFrame(refresh);
    }
    // Observe existing UI updates, including closure-owned surface set/restore.
    // No polling, new render loop, or wrapper on the archive/renderer is needed.
    const observer = new MutationObserver(schedule);
    observer.observe(shell, { childList: true, subtree: true });
    controller.addEventListener('change', schedule);
    function capture(event) {
      const input = event.target;
      if (!selectors.some(s => input.matches?.(s)) || report().legacyWetness.supported) return;
      // Also reject synthetic events before the original debounced handler.
      event.stopImmediatePropagation(); event.preventDefault();
      const key = input.dataset.l19Key || input.dataset.lipKey;
      input.value = String(key === 'wetness' ? lip.settings[key] : lip.anatomy.settings[key]);
      refresh();
    }
    function captureClick(event) {
      const button = event.target.closest?.('[data-lip-action]');
      const action = button?.dataset.lipAction;
      if (action === 'undo' && !report().legacyWetness.supported) {
        restoreNotice = '撤销恢复的是原唇部配方；当前程序皮肤的整体湿润值不会随它改变。';
        schedule(); return;
      }
      if (!Object.hasOwn(presetWetness, action) || report().legacyWetness.supported ||
          Object.is(presetWetness[action], lip.settings.wetness)) return;
      // The old preset handler changes inspection state and pushes undo history
      // before reaching its setter. Reject before either of those side effects.
      event.stopImmediatePropagation(); event.preventDefault(); refresh();
    }
    shell.addEventListener('input', capture, true);
    shell.addEventListener('change', capture, true);
    shell.addEventListener('click', captureClick, true);
    window.lipControlContract = {
      ready: true, version: VERSION, report, refresh,
      setCurrentWetness(value) {
        if (!report().currentWetness.supported) {
          const e = new Error('当前未使用已核对的程序皮肤湿润控制。'); e.code = 'LIP_CONTROL_INACTIVE'; throw e;
        }
        const result = surface.set({ lipWetness: value }); schedule(); return result;
      }
    };
    refresh(); startup.ready = true;
    addEventListener('pageshow', () => { if (!disposed) schedule(); });
    addEventListener('pagehide', event => {
      // A bfcache return resumes this same document without rerunning scripts.
      if (event.persisted) return;
      disposed = true; observer.disconnect(); controller.removeEventListener('change', schedule);
      shell.removeEventListener('input', capture, true); shell.removeEventListener('change', capture, true);
      shell.removeEventListener('click', captureClick, true);
      restorers.reverse().forEach(f => f());
      startup.ready = false; window.lipControlContract.ready = false;
    });
    return true;
  }
  (async () => {
    const started = performance.now();
    while (performance.now() - started < 600000) {
      try { if (install()) return; }
      catch (e) { startup.errors.push(String(e)); console.error(VERSION, e); return; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    startup.errors.push('R07 host did not become ready; no substitute character or controls were created.');
  })();
})();
