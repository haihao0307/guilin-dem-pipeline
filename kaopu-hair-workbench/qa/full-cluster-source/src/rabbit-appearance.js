/* Bounded candidate appearance controls; load after host.js and rabbit-ui.js. */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const palettes = [
    {id: 'cream', name: '原色 · 暖米', hex: '#e3d1a6', rgb: [.89, .82, .65]},
    {id: 'ivory', name: '象牙白', hex: '#eee6d3'},
    {id: 'silver', name: '银灰', hex: '#a7afb3'},
    {id: 'graphite', name: '石墨黑', hex: '#373d43'},
    {id: 'honey', name: '蜂蜜棕', hex: '#b97b3f'},
    {id: 'chestnut', name: '栗棕', hex: '#72452f'},
    {id: 'lavender', name: '柔紫 · 艺术', hex: '#8870a7'},
    {id: 'teal', name: '青绿 · 艺术', hex: '#368f86'}
  ].map(p => Object.freeze({...p, rgb: Object.freeze(p.rgb || [1, 3, 5].map(i => parseInt(p.hex.slice(i, i + 2), 16) / 255))}));
  const section = document.createElement('section');
  section.id = 'rabbitAppearance';
  section.className = 'section rabbit-appearance';
  section.setAttribute('aria-label', '毛色与毛感');
  section.innerHTML = '<div class="section-title">毛色与毛感 <span>工作副本</span></div>' +
    '<div id="rabbitFurPalette" class="rabbit-fur-palette" role="group" aria-label="兔子毛色"></div>' +
    '<p id="rabbitColorName" class="control-note" aria-live="polite"></p>' +
    '<div id="rabbitAppearanceControls"></div>';
  const inspector = byId('inspector');
  inspector.insertBefore(section, inspector.querySelector('.section'));
  const paletteHost = byId('rabbitFurPalette');
  for (const palette of palettes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.rabbitColor = palette.id;
    button.className = 'rabbit-color-choice';
    button.setAttribute('aria-label', palette.name + '毛色');
    button.setAttribute('aria-pressed', 'false');
    const swatch = document.createElement('span');
    swatch.className = 'rabbit-color-chip';
    swatch.style.backgroundColor = palette.hex;
    swatch.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = palette.name;
    button.append(swatch, label);
    button.onclick = () => setPalette(palette.id);
    paletteHost.append(button);
  }
  // Reuse the original length and custom-color controls and their event handlers.
  // All original parameters and teacher defaults keep their existing meaning.
  const controls = byId('rabbitAppearanceControls');
  controls.append(byId('range-hairLength').closest('.control'));
  const colorControl = byId('furColor').closest('.control');
  colorControl.querySelectorAll('[data-color]').forEach(button => { button.hidden = true; });
  controls.append(colorControl);
  function addRange(id, label, min, max, step, note, onEdit) {
    const wrap = document.createElement('div');
    wrap.className = 'control';
    wrap.innerHTML = '<label for="' + id + '"><span>' + label + '</span>' +
      '<input id="' + id + 'Number" type="number" min="' + min + '" max="' + max + '" step="' + step + '" aria-label="' + label + '数值"></label>' +
      '<div class="slider-row"><input id="' + id + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" aria-label="' + label + '"></div>' +
      '<p class="control-note" id="' + id + 'Note">' + note + '</p>';
    controls.append(wrap);
    for (const [controlId, event] of [[id, 'input'], [id + 'Number', 'change']]) {
      byId(controlId).addEventListener(event, e => {
        const value = Number(e.target.value);
        if (!Number.isFinite(value)) return sync();
        const bounded = Math.min(Number(e.target.max), Math.max(Number(e.target.min), Math.round(value / step) * step));
        onEdit(Number(bounded.toFixed(4)));
      });
    }
  }
  addRange('rabbitMaskWidth', '遮罩视觉粗细', .5, 1.8, .05,
    '1× 保留老师原遮罩；细 ← → 粗。仅调整现有毛束边缘的透明覆盖，不是几何直径。', setWidth);
  addRange('rabbitVisualDensity', '视觉疏密 · 纹理重复', .5, 2.5, .05,
    '以老师纹理比例为 1×，联动 Shell / Fin 纹理重复。疏 ← → 密，不改变毛囊数量或 Shell 层数。', setDensity);
  const densityStatus = document.createElement('output');
  densityStatus.id = 'rabbitDensityValue';
  densityStatus.className = 'control-note';
  byId('rabbitVisualDensityNote').append(document.createElement('br'), densityStatus);

  function getWidth() { return candidate.maskWidth === undefined ? 1 : candidate.maskWidth; }
  function clearPresetHighlight() {
    document.querySelectorAll('[data-preset]').forEach(button => button.classList.remove('active'));
  }
  function setWidth(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < .5 || value > 1.8) throw Error('遮罩视觉粗细必须在 0.5–1.8 之间');
    candidate.maskWidth = value;
    post('candidate', 'apply', {values: {maskWidth: value}});
    clearPresetHighlight();
    updateUI();
    return value;
  }
  function densityLimits() {
    const reference = meshDefaults(candidate.mesh);
    return {reference, max: candidate.mesh === 'cloth' ? 1.3 : 2.5};
  }
  function setDensity(value) {
    const {reference, max} = densityLimits();
    if (typeof value !== 'number' || !Number.isFinite(value) || value < .5 || value > max) throw Error('视觉疏密超出当前模型范围');
    const values = {
      shellTextureSize: Number((reference.shellTextureSize * value).toFixed(4)),
      finTextureSize: Number((reference.finTextureSize * value).toFixed(4))
    };
    Object.assign(candidate, values);
    post('candidate', 'apply', {values});
    clearPresetHighlight();
    updateUI();
    return value;
  }
  function setPalette(id) {
    const palette = palettes.find(item => item.id === id);
    if (!palette) throw Error('未知毛色');
    if (candidate.mesh === 'cloth') return false;
    edit('furColor', palette.rgb.slice());
    return true;
  }
  function sync() {
    if (candidate.maskWidth === undefined) candidate.maskWidth = 1;
    const width = getWidth();
    byId('rabbitMaskWidth').value = width;
    byId('rabbitMaskWidthNumber').value = fmt(width);
    const {reference, max} = densityLimits();
    const shellRatio = candidate.shellTextureSize / reference.shellTextureSize;
    const finRatio = candidate.finTextureSize / reference.finTextureSize;
    const linked = Math.abs(shellRatio - finRatio) < .0002 && shellRatio >= .5 && shellRatio <= max;
    for (const id of ['rabbitVisualDensity', 'rabbitVisualDensityNumber']) {
      byId(id).max = max;
      byId(id).value = linked ? Number(shellRatio.toFixed(4)) : id.endsWith('Number') ? '' : Math.min(max, Math.max(.5, shellRatio));
      byId(id).setAttribute('aria-valuetext', linked ? fmt(shellRatio) + '倍纹理重复' : 'Shell 与 Fin 已分别调整');
    }
    byId('rabbitDensityValue').textContent = linked ? fmt(shellRatio) + '× · Shell ' + fmt(candidate.shellTextureSize) + ' / Fin ' + fmt(candidate.finTextureSize) : '已分别调整 · Shell ' + fmt(candidate.shellTextureSize) + ' / Fin ' + fmt(candidate.finTextureSize);
    let selected = null;
    for (const palette of palettes) {
      const active = candidate.mesh !== 'cloth' && palette.rgb.every((value, i) => Math.abs(candidate.furColor[i] - value) < .00001);
      const button = paletteHost.querySelector('[data-rabbit-color="' + palette.id + '"]');
      button.disabled = candidate.mesh === 'cloth';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      if (active) selected = palette;
    }
    byId('rabbitColorName').textContent = candidate.mesh === 'cloth' ? '布片沿用原始纹理颜色' : (selected?.name || '自选毛色') + ' · 可继续微调颜色';
    const changed = Object.keys(defaults).filter(key => !['angles', 'size', 'lightPos', 'combRadius'].includes(key) && JSON.stringify(candidate[key]) !== JSON.stringify(baseline[key])).length + (width !== 1 ? 1 : 0);
    byId('changedStats').textContent = changed + ' PARAMETERS';
    byId('candidateTag').textContent = combed ? '已梳理 · GPU 方向已改变' : changed ? '参数实验 · ' + changed + ' 项已修改' : '与老师相同 · 基线对照';
  }

  // Replace the lexical validator so both the original file-input handler and
  // the public workbench.importState method validate the complete new state
  // before the original importer can switch meshes or reset GPU grooming.
  const originalValidate = validateImport;
  validateImport = function (data) {
    const input = structuredClone(data);
    if (input?.format !== 'kaopu-seddi-workbench' || ![1, 2].includes(input.version) || input.sourceCommit !== WORKBENCH_BUNDLE.commit) {
      throw Error('请选择本版工作台导出的参数 JSON');
    }
    if (!input.state || typeof input.state !== 'object' || Array.isArray(input.state)) throw Error('无效模型参数');
    const width = input.version === 1 ? 1 : input.state.maskWidth;
    if (typeof width !== 'number' || !Number.isFinite(width) || width < .5 || width > 1.8) throw Error('遮罩视觉粗细必须在 0.5–1.8 之间');
    const keys = Object.keys(defaults);
    if (input.version === 2 && Object.keys(input.state).some(key => !keys.includes(key) && key !== 'maskWidth')) throw Error('参数包含未知状态字段');
    const state = Object.fromEntries(keys.map(key => [key, input.state[key]]));
    originalValidate({...input, version: 1, state});
    return {...state, maskWidth: width};
  };
  const originalExport = exportState;
  exportState = function () {
    const data = originalExport();
    data.version = 2;
    data.state.maskWidth = getWidth();
    data.notes = 'GPU combed normals are not serialized; import resets combing. maskWidth is a candidate-only visual alpha-mask remap, not geometric strand diameter. Texture repetition controls visual density, not follicle count.';
    return data;
  };
  workbench.exportState = exportState;
  const originalUpdateUI = updateUI;
  updateUI = function (...args) { const result = originalUpdateUI(...args); sync(); return result; };
  const originalResetAll = resetAll;
  resetAll = function (...args) {
    const result = originalResetAll(...args);
    candidate.maskWidth = 1;
    post('candidate', 'apply', {values: {maskWidth: 1}});
    sync();
    return result;
  };
  workbench.resetAll = resetAll;
  const originalLoadMesh = loadMesh;
  loadMesh = function (...args) {
    if (!loadedMesh.candidate || (workbench.teacherStarted && !loadedMesh.teacher)) return originalLoadMesh(...args);
    const result = originalLoadMesh(...args);
    candidate.maskWidth = 1;
    post('candidate', 'apply', {values: {maskWidth: 1}});
    sync();
    return result;
  };
  workbench.loadMesh = loadMesh;
  // The existing API wrapper still reaches the original importer, which calls
  // the replaced lexical validator and updateUI above. No second import path.
  window.rabbitAppearance = Object.freeze({setWidth, getWidth, setDensity, setPalette, sync, validateImport, palettes: Object.freeze(palettes)});
  updateUI();
})();
