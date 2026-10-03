/* Isolated r04 integrated tissue/contact study host. Rendering never advances simulation.
 * Shape preparation and dynamic imports commit only after renderer validation.
 * No third-party runtime code; the frozen rabbit controller is not modified. */
(function () {
  'use strict';
  const C = AnemoneCore, O = AnemoneOptics;
  const el = id => document.getElementById(id);
  const MAX_STATE_BYTES = 2 * 1024 * 1024;
  const CAMERA_DEFAULTS = Object.freeze({azimuth: .25, elevation: .84, distance: 4.6});
  const OPTICS_DEFAULTS = Object.freeze({...O.DEFAULTS, shadowEnabled: true});
  const descriptors = [
    ['count', '触手数量', 120, 560, 20, 'Shape'],
    ['length', '相对触手长度', .35, 1.05, .01, 'Shape'],
    ['thickness', '触手半径', .015, .045, .001, 'Shape'],
    ['curvature', '放射引导弯曲', .5, 2.1, .05, 'Shape'],
    ['seed', '固定种子', 1, 9999, 1, 'Shape'],
    ['current', '水流强度', 0, 1, .01, 'Flow'],
    ['direction', '水流方向', -180, 180, 1, 'Flow'],
    ['frequency', '水流节奏', .08, .9, .01, 'Flow'],
    ['turbulence', '局部扰动', 0, .8, .01, 'Flow']
  ];
  const shapeKeys = descriptors.filter(d => d[5] === 'Shape').map(d => d[0]);
  const flowKeys = descriptors.filter(d => d[5] === 'Flow').map(d => d[0]);
  const parameterKeys = [...descriptors.map(d => d[0]), 'paused'];
  let renderer = null, params = {...C.DEFAULTS}, active = 'anemone';
  let requestedRabbit = false, animation = null, last = null, failed = false, canvasVisible = true;
  const errors = [];

  function message(text, rejected = false) {
    el('anemoneMessage').textContent = text;
    el('anemoneMessage').dataset.status = rejected ? 'rejected' : 'info';
  }
  function stopClock() {
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null;
    last = null;
  }
  function fatal(text) {
    failed = true;
    stopClock();
    errors.push(String(text));
    el('anemoneCapture').disabled = true;
    el('anemoneError').hidden = false;
    el('anemoneError').textContent = String(text);
    el('anemoneStatus').textContent = '3D 启动或运行异常';
  }
  function reject(error) {
    ui();
    message('未应用更改：' + error.message, true);
  }
  function act(fn) {
    try { return fn(); } catch (error) { reject(error); return undefined; }
  }
  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(label + '格式无效');
    return value;
  }
  function keys(value, allowed, label, complete = false) {
    object(value, label);
    if (Object.keys(value).some(k => !allowed.includes(k))) throw Error(label + '包含未知字段');
    if (complete && allowed.some(k => !Object.hasOwn(value, k))) throw Error(label + '字段不完整');
  }
  function validateParams(value, complete = true) {
    keys(value, parameterKeys, '海葵参数', complete);
    const next = C.validate(value);
    if (!Number.isInteger(value.count) || !Number.isInteger(value.seed)) throw Error('触手数量与种子必须是整数');
    return next;
  }
  function validateOptics(value, complete = true) {
    keys(value, Object.keys(OPTICS_DEFAULTS), '光学参数');
    // Original contact v2 states have no front-return fields. All original
    // optical fields remain mandatory; only the two additive fields default.
    if (complete && Object.keys(OPTICS_DEFAULTS).filter(k => !['frontReturn', 'frontReturnView'].includes(k)).some(k => !Object.hasOwn(value, k))) throw Error('光学参数字段不完整');
    return O.options(value);
  }
  function copyCamera(value) {
    return {...value, ...(value.target === undefined ? {} : {target: value.target.slice()})};
  }
  function validateCamera(value) {
    keys(value, [...Object.keys(CAMERA_DEFAULTS), 'target', 'preset'], '相机');
    if (Object.keys(CAMERA_DEFAULTS).some(k => !Object.hasOwn(value, k)) ||
        (value.target !== undefined && (!Array.isArray(value.target) || value.target.length !== 3 || !Array.from(value.target).every(v => Number.isFinite(v) && Math.abs(v) <= 5))) ||
        (value.preset !== undefined && value.preset !== 'macro-tip') ||
        !Number.isFinite(value.azimuth) || Math.abs(value.azimuth) > 1e4 ||
        !Number.isFinite(value.elevation) || value.elevation < .15 || value.elevation > 1.5 ||
        !Number.isFinite(value.distance) || value.distance < (value.target === undefined ? 2 : .25) || value.distance > 8) throw Error('相机参数越界');
    return copyCamera(value);
  }
  // Flow intent must be visible to the actual solver, not just to the renderer.
  function commitParams(next) {
    if (renderer) {
      renderer.setFlowState(next);
      params = renderer.state;
    } else params = next;
  }
  function ui() {
    if (renderer) {
      el('anemonePalette').value = renderer.optics.palette;
      el('anemoneLighting').value = renderer.optics.lighting;
      el('anemoneTransmission').checked = !!renderer.optics.transmission;
      el('anemoneDebug').value = renderer.optics.debug;
      el('anemoneFrontReturn').value = renderer.optics.frontReturn;
      el('anemoneFrontReturnValue').textContent = renderer.optics.frontReturn.toFixed(2);
      el('anemoneFrontReturnView').value = renderer.optics.frontReturnView;
      const macro = !!renderer.camera.target;
      el('anemoneMacroCamera').classList.toggle('active', macro);
      el('anemoneCamera').classList.toggle('active', !macro);
      el('anemoneCameraState').textContent = macro ? '组织微距 · 真实三维相机' : '全景 · 真实三维相机';
    }
    for (const [key] of descriptors) {
      el('anemone-' + key).value = params[key];
      el('anemone-number-' + key).value = params[key];
    }
    el('anemonePause').textContent = params.paused ? '▶ 继续水流' : 'Ⅱ 暂停水流';
    el('anemonePause').classList.toggle('active', params.paused);
    el('anemoneFlowIntent').textContent = params.paused
      ? '已暂停：水流参数只更新下一步意图，继续后才改变姿态。相机、材质与截图不推进求解。'
      : '水流参数在下一次离散步生效。每步使用实际经过时间（最多 0.1 秒）；受限时模拟时间可能减慢。';
  }
  const number = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '未测';
  const residual = value => Number.isFinite(value) ? value.toExponential(2) : '未测';
  function diagnostics() {
    if (!renderer) return;
    const m = renderer.metrics(), c = m.contact || {};
    const measured = c.finite === true && c.contactsChecked === true && c.bodyChecked === true;
    const passes = measured && c.rootError < 1e-7 && c.lengthRelative < .002 && c.arcRelative < .001 &&
      c.maxPenetration < .00045 && c.contactViolations === 0 && c.bodyPenetration < .00045 &&
      c.bendViolation < .01 && c.collarViolation < .005;
    const limited = !!(m.solverLimited || c.solverLimited);
    el('anemoneContactGate').textContent = !measured ? '尚未完成全量验算' : passes ? '当前姿态通过离散接触门槛' : '当前姿态未通过门槛';
    el('anemoneContactGate').dataset.valid = passes ? 'true' : 'false';
    el('anemoneSolverState').textContent = limited
      ? (c.accepted === false ? '求解受限 · 保留最近合法姿态' : '求解受限 · 已减小推进量')
      : ((m.steps ?? renderer.system.steps ?? 0) > 0 && c.accepted === true ? '离散步已接受' : '合法静态母本');
    el('anemoneRootResidual').textContent = residual(c.rootError);
    el('anemoneLengthResidual').textContent = number(c.lengthRelative * 100, 4) + '% / ' + number(c.arcRelative * 100, 4) + '%';
    el('anemoneCapsuleResidual').textContent = residual(c.maxPenetration) + ' · ' + (Number.isInteger(c.contactViolations) ? c.contactViolations : '未测') + ' 违规';
    el('anemoneBodyResidual').textContent = residual(c.bodyPenetration);
    el('anemoneStepCost').textContent = number(m.cpuSolveMsLast) + ' ms';
    el('anemoneSimTime').textContent = number(m.time ?? renderer.system.time, 3) + ' s';
    el('anemoneResidualDetails').textContent = '弯曲残差 ' + residual(c.bendViolation) + ' rad · 根颈残差 ' + residual(c.collarViolation) +
      ' rad · 目标偏差 RMS ' + residual(c.targetRms) + ' · 推进比例 ' + number(c.proposalScale ?? renderer.system.proposalScale, 4) +
      ' · 回退 ' + (renderer.system.fallbacks ?? c.fallbacks ?? 0) + ' 次';
    el('anemoneStats').textContent = renderer.roots.length + ' TENTACLES · ' +
      Math.round((renderer.tubeCount / 3 * renderer.roots.length + renderer.bodyCount / 3) / 1000) + 'K TRIANGLES';
    el('anemoneStatus').textContent = (params.paused ? '已暂停' : '离散接触实验') + (limited ? ' · 求解受限' : ' · WebGL 2');
  }
  function draw() {
    if (!renderer || active !== 'anemone' || failed) return;
    renderer.draw();
    if (!failed) diagnostics();
  }
  function schedule() {
    if (animation === null && active === 'anemone' && renderer && !params.paused && !failed && !document.hidden && canvasVisible) {
      animation = requestAnimationFrame(tick);
    }
  }
  function tick(now) {
    animation = null;
    if (active !== 'anemone' || !renderer || params.paused || failed || document.hidden || !canvasVisible) { last = null; return; }
    try {
      if (last !== null) {
        const dt = Math.min(.1, Math.max(0, (now - last) / 1000));
        if (dt > 0) renderer.advance(dt);
      }
      last = now;
      draw();
      schedule();
    } catch (error) { fatal(error.message); }
  }
  function initialize() {
    if (renderer || failed) return;
    try {
      renderer = new AnemoneRenderer(el('anemoneCanvas'));
      renderer.onError = fatal;
      commitParams(params);
      el('anemoneCapture').disabled = false;
      draw();
      schedule();
    } catch (error) { fatal(error.message); }
  }
  function requireRenderer() {
    initialize();
    if (!renderer || failed) throw Error('海葵渲染器尚不可用');
    return renderer;
  }
  function set(values) {
    try {
      keys(values, parameterKeys, '海葵参数');
      const next = validateParams({...params, ...values});
      const rebuild = shapeKeys.some(key => next[key] !== params[key]);
      const changedFlow = flowKeys.some(key => next[key] !== params[key]);
      const pauseChanged = next.paused !== params.paused;
      requireRenderer();
      if (rebuild) renderer.reset(next); // Atomic: rejected preparation leaves the old system intact.
      commitParams(next);
      if (rebuild || pauseChanged) stopClock();
      ui();
      draw();
      schedule();
      if (rebuild) message('新接触母本已通过验算，模拟时间归零。');
      else if (changedFlow) message(params.paused ? '水流意图已保存；继续后生效，暂停姿态保持不变。' : '水流意图已更新，将用于下一次离散接触步。');
      return {...params};
    } catch (error) { reject(error); throw error; }
  }
  function resetTime() {
    requireRenderer().reset(params);
    commitParams(params);
    stopClock();
    ui();
    draw();
    schedule();
    message('已重新构建合法静态母本，模拟时间为 0。');
  }
  function resetCamera() {
    requireRenderer().camera = {...CAMERA_DEFAULTS};
    ui();
    draw();
  }
  function macroCamera() {
    const r = requireRenderer();
    let pick = 0, best = Infinity;
    for (let i = 0; i < r.roots.length; i++) {
      const root = r.roots[i], d = (root.x - .35) ** 2 + (root.z - .8) ** 2;
      if (d < best) { best = d; pick = i; }
    }
    const offset = (pick * (C.SEGMENTS + 1) + 24) * 4;
    // Pick the actual validated/uploaded node, not a re-solved or invented pose.
    const target = Array.from(r.data.slice(offset, offset + 3));
    r.camera = validateCamera({azimuth: .25, elevation: .22, distance: .55, target, preset: 'macro-tip'});
    ui();
    draw();
  }
  function cameraPreset(name) {
    if (name === 'macro') macroCamera();
    else if (name === 'overview') resetCamera();
    else throw Error('Unknown camera preset');
  }
  function reset() {
    const next = validateParams({...C.DEFAULTS});
    requireRenderer().reset(next);
    commitParams(next);
    renderer.optics = {...OPTICS_DEFAULTS};
    renderer.camera = {...CAMERA_DEFAULTS};
    stopClock();
    ui();
    draw();
    schedule();
    message('形态、合法静态母本、材质与相机已完整重置。');
  }
  function snapshot() {
    requireRenderer();
    const dynamic = renderer.snapshotDynamic();
    return {
      format: 'kaopu-anemone-study', version: 2,
      reference: 'Wootton-Heteractis-magnifica-2012',
      params: {...params}, optics: {...renderer.optics}, camera: copyCamera(renderer.camera),
      time: dynamic.time, dynamic
    };
  }
  function boundedState(input) {
    let data = input, serialized;
    if (typeof input === 'string') {
      if (new TextEncoder().encode(input).byteLength > MAX_STATE_BYTES) throw Error('状态文件超过 2 MiB 上限');
      data = JSON.parse(input);
    } else {
      try { serialized = JSON.stringify(input); } catch (_) { throw Error('状态文件必须是可序列化的 JSON'); }
      if (typeof serialized !== 'string') throw Error('状态文件格式无效');
      if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES) throw Error('状态文件超过 2 MiB 上限');
    }
    return object(data, '状态文件');
  }
  function importState(input) {
    try {
      const data = boundedState(input);
      if (data.format !== 'kaopu-anemone-study') throw Error('请选择海葵工作台状态文件');
      if (data.version === 1) throw Error('v1 只有参数与时间，没有接触求解状态；本实验不支持导入，也不会用时间伪造姿态回放。');
      if (data.version !== 2) throw Error('只支持 v2 完整接触状态文件');
      keys(data, ['format', 'version', 'reference', 'params', 'optics', 'camera', 'time', 'dynamic'], '状态文件', true);
      if (data.reference !== 'Wootton-Heteractis-magnifica-2012') throw Error('状态文件摄影参考标识无效');
      const next = validateParams(data.params);
      const optics = validateOptics(data.optics);
      const camera = validateCamera(data.camera);
      object(data.dynamic, '动态求解状态');
      if (!Number.isFinite(data.time) || data.time < 0 || data.time > 1e6 || data.time !== data.dynamic.time) throw Error('模拟时间与动态状态不一致');
      // All host values are validated first. Renderer then validates both current
      // and previous full-body/capsule geometry in a detached system before commit.
      requireRenderer().restoreDynamic(next, data.dynamic);
      commitParams(next);
      renderer.optics = optics;
      renderer.camera = camera;
      stopClock();
      ui();
      draw();
      schedule();
      message('已恢复 v2 的当前姿态、前一姿态、求解状态、材质与相机。');
      return snapshot();
    } catch (error) { reject(error); throw error; }
  }
  function setOptics(values) {
    keys(values, Object.keys(OPTICS_DEFAULTS), '光学参数');
    const next = validateOptics({...requireRenderer().optics, ...values});
    renderer.optics = next;
    ui();
    draw();
    return {...next};
  }
  function advance(dt = 1 / 30) {
    requireRenderer();
    if (!params.paused) throw Error('显式测试步进前请先暂停水流');
    if (!Number.isFinite(dt) || dt <= 0 || dt > .1) throw Error('离散步长必须大于 0 且不超过 0.1 秒');
    const result = renderer.advance(dt);
    draw();
    return result;
  }
  function save(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function rabbitActive(on) {
    if (!on && (!window.workbench?.ready.teacher || !workbench.ready.candidate ||
      (workbench.frameStats.teacher?.frames || 0) < 2 || (workbench.frameStats.candidate?.frames || 0) < 2)) return;
    for (const role of ['teacher', 'candidate']) {
      const w = el(role + 'Frame').contentWindow;
      if (w) w.postMessage({kaopu: true, type: 'active', active: on && (role !== 'teacher' || !el('viewports').classList.contains('single'))}, '*');
    }
  }
  function select(module) {
    if (!['rabbit', 'anemone'].includes(module)) throw Error('Unknown module');
    stopClock();
    active = module;
    requestedRabbit = module === 'rabbit';
    document.body.dataset.module = module;
    el('speciesRabbit').classList.toggle('active', requestedRabbit);
    el('speciesAnemone').classList.toggle('active', !requestedRabbit);
    rabbitActive(requestedRabbit);
    if (!requestedRabbit) { initialize(); draw(); schedule(); }
    else for (const role of ['teacher', 'candidate']) el(role + 'Frame').contentWindow?.postMessage({kaopu: true, type: 'resize'}, '*');
  }

  for (const [key, label, min, max, step, group] of descriptors) {
    const div = document.createElement('div');
    div.className = 'control';
    div.innerHTML = `<label for="anemone-${key}"><span>${label}</span><input type="number" aria-label="海葵${label}数值" id="anemone-number-${key}" min="${min}" max="${max}" step="${step}"></label><input type="range" aria-label="海葵${label}" id="anemone-${key}" min="${min}" max="${max}" step="${step}">`;
    el('anemone' + group + 'Controls').append(div);
    const range = el('anemone-' + key), numeric = el('anemone-number-' + key);
    function change(event) {
      if (String(event.target.value).trim() === '') return ui();
      const value = Number(event.target.value);
      if (!Number.isFinite(value)) return ui();
      act(() => set({[key]: Number(C.clamp(Math.round(value / step) * step, min, max).toFixed(4))}));
    }
    // Shape dragging is an uncommitted preview. Preparation is expensive and
    // occurs only on change (pointer release or keyboard commit), never input.
    if (group === 'Shape') {
      range.addEventListener('input', event => {
        numeric.value = event.target.value;
        message('形态预览尚未提交；松开滑块后构建并验算新母本。');
      });
      range.addEventListener('change', change);
    } else range.addEventListener('input', change);
    numeric.addEventListener('change', change);
  }
  for (const [id, key] of [['anemonePalette', 'palette'], ['anemoneLighting', 'lighting'], ['anemoneDebug', 'debug']]) {
    el(id).onchange = event => act(() => setOptics({[key]: event.target.value}));
  }
  el('anemoneFrontReturn').oninput = event => act(() => setOptics({frontReturn: Number(event.target.value)}));
  el('anemoneFrontReturnView').onchange = event => act(() => setOptics({frontReturnView: event.target.value}));
  el('anemoneTransmission').onchange = event => act(() => setOptics({transmission: event.target.checked ? 1 : 0}));
  el('speciesRabbit').onclick = () => select('rabbit');
  el('speciesAnemone').onclick = () => select('anemone');
  el('anemonePause').onclick = () => act(() => set({paused: !params.paused}));
  el('anemoneResetTime').onclick = () => act(resetTime);
  el('anemoneCamera').onclick = () => act(resetCamera);
  el('anemoneMacroCamera').onclick = () => act(macroCamera);
  el('anemoneReset').onclick = () => act(reset);
  el('anemoneExport').onclick = () => act(() => {
    const data = JSON.stringify(snapshot());
    if (new TextEncoder().encode(data).byteLength > MAX_STATE_BYTES) throw Error('当前完整状态超过 2 MiB；未导出无法重新导入的文件');
    save(new Blob([data], {type: 'application/json'}), 'KAOPU-海葵接触状态-v2.json');
  });
  el('anemoneImport').onclick = () => el('anemoneImportFile').click();
  el('anemoneImportFile').onchange = async event => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > MAX_STATE_BYTES) throw Error('状态文件超过 2 MiB 上限');
      importState(await file.text());
    } catch (error) { reject(error); }
    finally { event.target.value = ''; }
  };
  el('anemoneCapture').disabled = true;
  el('anemoneCapture').onclick = () => act(() => {
    if (!renderer || failed || !renderer.frames) return;
    draw();
    if (!failed) el('anemoneCanvas').toBlob(blob => { if (blob) save(blob, 'KAOPU-海葵接触视图.png'); });
  });

  let pointer = null;
  const canvas = el('anemoneCanvas');
  canvas.addEventListener('pointerdown', event => {
    if (!renderer || failed) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    pointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    renderer.camera.azimuth -= (event.clientX - pointer.x) * .008;
    renderer.camera.elevation = C.clamp(renderer.camera.elevation + (event.clientY - pointer.y) * .006, .15, 1.5);
    pointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
    draw();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, () => { pointer = null; });
  canvas.addEventListener('wheel', event => {
    if (!renderer || failed) return;
    event.preventDefault();
    renderer.camera.distance = C.clamp(renderer.camera.distance + event.deltaY * (renderer.camera.target ? .0006 : .004), renderer.camera.target ? .25 : 2, 8);
    draw();
  }, {passive: false});
  new ResizeObserver(() => draw()).observe(canvas);
  if (typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver(entries => {
      const entry = entries.find(item => item.target === canvas);
      if (!entry) return;
      const visible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (visible === canvasVisible) return;
      canvasVisible = visible;
      stopClock();
      schedule();
    }, {threshold: 0}).observe(canvas);
  }
  document.addEventListener('visibilitychange', () => { stopClock(); schedule(); });
  window.addEventListener('message', event => {
    if (!event.data?.kaopu || !['ready', 'frame'].includes(event.data.type)) return;
    if (!requestedRabbit && window.workbench?.ready.teacher && workbench.ready.candidate &&
      workbench.frameStats.teacher?.frames >= 2 && workbench.frameStats.candidate?.frames >= 2) rabbitActive(false);
  });
  window.platform = {select, get module() { return active; }, get errors() { return errors.slice(); }};
  window.anemone = {
    get ready() { return !!renderer && !failed; }, get renderer() { return renderer; },
    get state() { return snapshot(); }, set, reset, importState, exportState: snapshot, cameraPreset,
    pause: (paused = true) => set({paused}), advance,
    seek: time => {
      if (time !== 0) throw Error('接触求解依赖历史姿态；只支持 seek(0) 重建静态母本，非零时间不能直接跳转。');
      return resetTime();
    },
    setOptics, metrics: () => renderer?.metrics(), pixels: () => renderer?.pixels(),
    get errors() { return errors.concat(renderer?.errors || []); }
  };
  ui();
  select('anemone');
  ui();
})();
