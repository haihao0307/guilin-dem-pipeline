'use strict';

(async () => {
  const $ = id => document.getElementById(id);
  const copy = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const STORAGE_KEY = 'KAOPU_MATERIAL_STUDIES_R01';
  const VERSION = 'study-r01';
  const baseURL = new URL('./', document.currentScript.src);
  const canvas = $('canvas');
  const basis = copy(window.KAOPU_STUDY_BASIS);
  const studies = {
    '05': { mode: 1, title: '云状石灰', description: '连续噪声经过色阶映射，形成明暗云状分区。', formula: 'Noise → ColorRamp：m = smoothstep(a, b, 0.5 + 0.5 · fBm(p · s))' },
    '06': { mode: 2, title: '脏污混合', description: '大斑与细斑共同决定深浅材质的混合。', formula: 'Mix / Mask：m = ramp(fBm(p · s₁) + k · fBm(p · s₂))' },
    '07': { mode: 3, title: '晶格矿物', description: '细胞距离产生颗粒分区，边界染出晶格般的轮廓。', formula: 'Voronoi → Ramp：edge = ramp(F₂(p) − F₁(p))' },
    '08': { mode: 4, title: '层理岩', description: '噪声扭曲周期波纹，形成不规则的层状外观。', formula: 'Wave + Warp：m = ramp(sin((axis(p) + warpNoise(p)) · frequency))' },
    '09': { mode: 5, title: '磨损金属', description: '高频线条经噪声打断，划痕同时改变颜色、粗糙度与高光。', formula: 'Scratches：scratch = thinRamp(|sin(axis(p) · frequency + warp)|) × breakupNoise' },
    '10': { mode: 6, title: '方向风化', description: '高度方向渐变叠加噪声，模拟方向性的风化显色。', formula: 'Gradient + Noise → Ramp：m = ramp(axis(p) + noise(p))' }
  };
  const ids = ['05', '06', '07', '08', '09', '10'];
  const caseDefault = { lessonScale: 1, lessonAmount: 1, lessonSeed: 0, view: 0 };
  const cameraDefault = { yaw: 0, pitch: Math.atan2(.3, 1.5), distance: Math.hypot(.3, 1.5), lens: 1.7, target: [0, 0, 0], zoom: 1, pan: [0, 0] };
  const rigDefault = { keyTint: '#ffffff', fillTint: '#ffffff', keyPower: 1, fillPower: 1, keyAngles: [0, 0], fillAngles: [0, 0], background: '#44484d' };
  const qualityDefault = { width: 640, samples: 2, filter: 1, post: true };
  let states = Object.fromEntries(ids.map(id => [id, copy(caseDefault)]));
  let cameras = Object.fromEntries(ids.map(id => [id, copy(cameraDefault)]));
  let active = '05', rig = copy(rigDefault), quality = copy(qualityDefault), tab = 'study';
  let gl, ready = false, running = false, dirty = true, frames = 0, lastTick = 0, lastDraw = 0, fps = 0, lastPacket = null;
  let sceneTexture, sceneBuffer, bufferW = 0, bufferH = 0;
  const sources = {}, programs = new Map();
  const raw = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = hex => raw(hex).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const vector = (value, n) => Array.isArray(value) && value.length === n && value.every(finite);
  const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

  function normalizedState(value = {}) {
    return {
      lessonScale: finite(value.lessonScale) ? clamp(value.lessonScale, .35, 3) : 1,
      lessonAmount: finite(value.lessonAmount) ? clamp(value.lessonAmount, 0, 1) : 1,
      lessonSeed: finite(value.lessonSeed) ? Math.round(clamp(value.lessonSeed, 0, 99)) : 0,
      view: [0, 1, 2].includes(value.view) ? value.view : 0
    };
  }
  function normalizedCamera(value = {}) {
    const result = copy(cameraDefault);
    if (finite(value.yaw)) result.yaw = value.yaw % (Math.PI * 2);
    if (finite(value.pitch)) result.pitch = clamp(value.pitch, -1.35, 1.35);
    if (finite(value.zoom)) result.zoom = clamp(value.zoom, .35, 5);
    if (vector(value.pan, 2)) result.pan = value.pan.map(v => clamp(v, -5, 5));
    // Camera geometry remains the inherited observation setup.
    return result;
  }
  function normalizedRig(value = {}) {
    const result = copy(rigDefault);
    for (const key of ['keyTint', 'fillTint', 'background']) if (validColor(value[key])) result[key] = value[key];
    for (const key of ['keyPower', 'fillPower']) if (finite(value[key])) result[key] = clamp(value[key], 0, 2);
    for (const key of ['keyAngles', 'fillAngles']) if (vector(value[key], 2)) result[key] = [clamp(value[key][0], -2, 2), clamp(value[key][1], -1, 1)];
    return result;
  }
  function normalizedQuality(value = {}) {
    return { width: [480, 640, 960].includes(value.width) ? value.width : 640, samples: [1, 2].includes(value.samples) ? value.samples : 2, filter: 1, post: true };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.version === VERSION) {
      for (const id of ids) {
        states[id] = normalizedState(saved.states?.[id]);
        cameras[id] = normalizedCamera(saved.cameras?.[id]);
      }
      rig = normalizedRig(saved.rig);
      quality = normalizedQuality(saved.quality);
      if (ids.includes(saved.active)) active = saved.active;
    }
  } catch {
    $('storageStatus').textContent = '未能读取本地参数，本次使用默认值';
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, active, states, cameras, rig, quality }));
      $('storageStatus').textContent = '参数已保存在本浏览器 · 每个编号独立保存';
    } catch {
      $('storageStatus').textContent = '浏览器未允许保存，当前参数仅在本次页面中保留';
    }
  }
  function mark() { dirty = true; save(); }
  function fail(error) {
    $('error').textContent = '渲染未完成：' + (error.message || error);
    $('error').hidden = false;
    console.error(error);
    running = false;
    dirty = false;
    setRunning(false);
  }
  function setRunning(value) {
    running = Boolean(value);
    $('rotate').textContent = running ? '暂停旋转' : '自动旋转';
    $('rotate').setAttribute('aria-pressed', String(running));
  }
  function cameraUniform(camera) {
    const cp = Math.cos(camera.pitch);
    const origin = [Math.sin(camera.yaw) * cp, Math.sin(camera.pitch), Math.cos(camera.yaw) * cp].map((v, i) => v * camera.distance + camera.target[i]);
    return { uCameraOrigin: origin, uCameraTarget: camera.target, uCameraLens: camera.lens * Math.min(1, (canvas.width / canvas.height) / 1.3), uInspectZoom: camera.zoom, uInspectPan: camera.pan, uFilterStrength: quality.filter };
  }
  function uniforms() {
    const a = basis, state = states[active];
    const result = {
      iResolution: [canvas.width, canvas.height, 1], iTime: 0, iFrame: 0,
      ...cameraUniform(cameras[active]), uSharedRig: 1, uRigLook: 0,
      uKeyTint: raw(rig.keyTint), uFillTint: raw(rig.fillTint), uKeyPower: rig.keyPower, uFillPower: rig.fillPower,
      uKeyAngles: rig.keyAngles, uFillAngles: rig.fillAngles, uBackground: linear(rig.background),
      uHD: 1, uAASamples: quality.samples, uDetailZoom: cameras[active].zoom, uInteractive: 0,
      uYaw: a.yaw, uPitch: a.pitch, uIQK: a.k, uDisp: a.displacement, uTone: a.tone, uPlanes: a.planes,
      uChannel: state.view === 2 ? 2 : 0, uMethod: a.method, uLook: a.look,
      uShapeSeed: a.shapeSeed, uNoiseSeed: a.noiseSeed, uShapeScale: a.scale, uCutStrength: a.cut,
      uBaseRaw: a.base, uMineralLow: a.low, uMineralHigh: a.high, uPatinaColor: a.patina, uMicaTint: a.mica, uGrainColor: a.grain,
      uSurfaceView: state.view === 1 ? 1 : 0, uSpecularScale: a.specular, uMicro: a.micro,
      uSurfaceRough: a.surfaceRough, uSurfaceWet: a.surfaceWet, uMicaDark: a.micaDark, uMicaReflect: a.micaReflect,
      uLessonMode: studies[active].mode, uLessonScale: state.lessonScale, uLessonAmount: state.lessonAmount, uLessonSeed: state.lessonSeed
    };
    for (const [uniform, key] of [['uLayerOn', 'on'], ['uLayerStrength', 'strength'], ['uLayerScale', 'scale'], ['uLayerCover', 'cover'], ['uLayerSeed', 'seed']]) result[uniform] = a.layers.map(layer => key === 'on' ? Number(layer[key]) : layer[key]);
    return result;
  }
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function use(name) {
    if (!programs.has(name)) {
      const program = gl.createProgram();
      const vertex = compile(gl.VERTEX_SHADER, '#version 300 es\nprecision highp float;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}');
      const fragment = compile(gl.FRAGMENT_SHADER, sources[name]);
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      const fields = [];
      for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
        const uniform = gl.getActiveUniform(program, i);
        fields.push([uniform.name, uniform.type, gl.getUniformLocation(program, uniform.name)]);
      }
      programs.set(name, { program, fields });
    }
    const result = programs.get(name);
    gl.useProgram(result.program);
    return result;
  }
  function targetBuffer(width, height) {
    if (!sceneTexture) { sceneTexture = gl.createTexture(); sceneBuffer = gl.createFramebuffer(); }
    if (bufferW !== width || bufferH !== height) {
      bufferW = width; bufferH = height;
      gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneBuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTexture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('采样缓冲区未完成');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneBuffer);
  }
  function spatialPass(width, height) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const program = use('post.frag');
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    const weight = .2;
    for (const [name, , location] of program.fields) {
      if (name === 'uScene') gl.uniform1i(location, 0);
      if (name === 'uTexel') gl.uniform2f(location, 1 / width, 1 / height);
      if (name === 'uSpatialWeight') gl.uniform1f(location, weight);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return weight;
  }
  function draw() {
    if (!ready) return;
    const box = $('viewport').getBoundingClientRect();
    const ratio = Math.max(1, box.height) / Math.max(1, box.width);
    const scale = Math.min(1, Math.sqrt((9 / 16) / ratio));
    const width = Math.max(128, Math.round(quality.width * scale / 8) * 8);
    const height = Math.max(72, Math.round(width * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    targetBuffer(width, height);
    const program = use('iq-study.frag'), values = uniforms();
    gl.viewport(0, 0, width, height);
    for (const [name, type, location] of program.fields) {
      const value = values[name];
      if (value === undefined) continue;
      if (type === gl.FLOAT) gl.uniform1f(location, value);
      else if (type === gl.INT || type === gl.BOOL) gl.uniform1i(location, value);
      else if (type === gl.FLOAT_VEC2) gl.uniform2fv(location, value);
      else if (type === gl.FLOAT_VEC3) gl.uniform3fv(location, value);
      else if (type === gl.FLOAT_VEC4) gl.uniform4fv(location, value);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const postWeight = spatialPass(width, height), error = gl.getError();
    if (error) throw Error('WebGL ' + error);
    lastPacket = { case: active, program: 'iq-study.frag', uniforms: copy(values), running, postWeight };
    frames++; dirty = false;
    const now = performance.now();
    fps = lastDraw ? 1000 / (now - lastDraw) : 0;
    lastDraw = now;
    $('renderInfo').textContent = `${width} × ${height} · ${quality.samples * quality.samples} 次空间采样 · ${running ? Math.round(fps) + ' FPS · ' : ''}动静同路径`;
    $('zoomLabel').textContent = Math.round(cameras[active].zoom * 100) + '%';
    return copy(lastPacket);
  }
  function showTab(value) {
    tab = ['study', 'light', 'quality'].includes(value) ? value : 'study';
    document.querySelectorAll('.controlPage').forEach(element => { element.hidden = element.id !== tab; });
    document.querySelectorAll('[data-tab]').forEach(button => {
      button.classList.toggle('on', button.dataset.tab === tab);
      button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
    });
  }
  const get = (object, path) => path.split('.').reduce((value, key) => value[key], object);
  function set(object, path, value) {
    const keys = path.split('.'), key = keys.pop();
    keys.reduce((part, name) => part[name], object)[key] = value;
  }
  function slider(target, path, title, min, max, step, scope = 'state') {
    const object = scope === 'rig' ? rig : states[active];
    const label = document.createElement('label');
    label.className = 'control';
    label.innerHTML = `<span>${title}</span><input type="range" min="${min}" max="${max}" step="${step}" data-path="${path}" data-scope="${scope}" aria-label="${title}"><output></output>`;
    const input = label.querySelector('input'), output = label.querySelector('output');
    input.value = get(object, path);
    const update = () => { output.textContent = Number(input.value).toFixed(step === 1 ? 0 : 2); };
    update();
    input.oninput = () => { set(object, path, Number(input.value)); update(); mark(); };
    $(target).append(label);
  }
  function color(path, title) {
    const label = document.createElement('label');
    label.className = 'control';
    label.innerHTML = `<span>${title}</span><input type="color" aria-label="${title}" data-color="${path}"><output></output>`;
    const input = label.querySelector('input');
    input.value = rig[path];
    input.oninput = () => { rig[path] = input.value; mark(); };
    $('lightControls').append(label);
  }
  function build() {
    $('caseTitle').textContent = `${active} / ${studies[active].title}`;
    $('canvas').setAttribute('aria-label', `${active} ${studies[active].title}，实时三维材质样板`);
    $('studyDescription').textContent = studies[active].description;
    $('studyFormula').textContent = studies[active].formula;
    document.querySelectorAll('[data-case]').forEach(button => {
      const selected = button.dataset.case === active;
      button.classList.toggle('on', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $('studyControls').replaceChildren();
    slider('studyControls', 'lessonScale', '函数尺度', .35, 3, .01);
    slider('studyControls', 'lessonAmount', '样板混合量', 0, 1, .01);
    slider('studyControls', 'lessonSeed', '样板种子', 0, 99, 1);
    $('lightControls').replaceChildren();
    for (const [path, title] of [['keyTint', '主光乘色'], ['fillTint', '次光乘色'], ['background', '背景色']]) color(path, title);
    for (const args of [['keyPower', '主光强度', 0, 2, .01], ['fillPower', '次光强度', 0, 2, .01], ['keyAngles.0', '主光水平', -2, 2, .01], ['keyAngles.1', '主光俯仰', -1, 1, .01], ['fillAngles.0', '次光水平', -2, 2, .01], ['fillAngles.1', '次光俯仰', -1, 1, .01]]) slider('lightControls', ...args, 'rig');
    $('resolution').value = quality.width;
    $('samples').value = quality.samples;
    $('channel').value = states[active].view;
    showTab(tab);
  }
  function select(id, push = true) {
    id = String(id).padStart(2, '0');
    if (!ids.includes(id)) throw Error('未知样板编号：' + id);
    setRunning(false);
    active = id;
    build(); mark();
    if (push) {
      const url = new URL(location.href);
      url.searchParams.set('case', active);
      url.searchParams.delete('study');
      history.pushState({}, '', url);
    }
    return draw();
  }
  function zoom(factor) {
    cameras[active].zoom = clamp(cameras[active].zoom * factor, .35, 5);
    mark();
  }
  function requestedCase() {
    const params = new URLSearchParams(location.search);
    const id = params.get('case') || params.get('study');
    return ids.includes(id) ? id : active;
  }
  for (const button of document.querySelectorAll('[data-case]')) button.onclick = () => select(button.dataset.case);
  for (const button of document.querySelectorAll('[data-tab]')) button.onclick = () => showTab(button.dataset.tab);
  window.addEventListener('popstate', () => select(requestedCase(), false));
  $('rotate').onclick = () => { setRunning(!running); mark(); };
  $('cameraReset').onclick = () => { cameras[active] = copy(cameraDefault); setRunning(false); mark(); };
  $('zoomIn').onclick = () => zoom(1.2);
  $('zoomOut').onclick = () => zoom(1 / 1.2);
  $('resetMaterial').onclick = () => { states[active] = copy(caseDefault); build(); mark(); };
  $('toggleControls').onclick = () => {
    const hidden = document.body.classList.toggle('controlsHidden');
    $('toggleControls').textContent = hidden ? '显示控制室' : '收起控制室';
    $('toggleControls').setAttribute('aria-expanded', String(!hidden));
    dirty = true;
  };
  $('fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { $('storageStatus').textContent = '浏览器暂不支持全屏，可继续在当前页面观察'; }
  };
  document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? '退出全屏' : '全屏观察'; dirty = true; });
  $('resolution').onchange = event => { quality = normalizedQuality({ ...quality, width: Number(event.target.value) }); mark(); };
  $('samples').onchange = event => { quality = normalizedQuality({ ...quality, samples: Number(event.target.value) }); mark(); };
  $('channel').onchange = event => { states[active].view = Number(event.target.value); mark(); };
  $('rigReset').onclick = () => { rig = copy(rigDefault); build(); mark(); };
  $('keyOnly').onclick = () => { rig.keyPower = 1; rig.fillPower = 0; build(); mark(); };
  $('fillOnly').onclick = () => { rig.keyPower = 0; rig.fillPower = 1; build(); mark(); };
  $('bothLights').onclick = () => { rig.keyPower = 1; rig.fillPower = 1; build(); mark(); };
  const pointers = new Map();
  let drag = null, pinch = 0;
  canvas.addEventListener('pointerdown', event => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    const camera = cameras[active];
    drag = { x: event.clientX, y: event.clientY, yaw: camera.yaw, pitch: camera.pitch, pan: camera.pan.slice(), shift: event.shiftKey };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); drag = null; }
    setRunning(false); save();
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    const camera = cameras[active];
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) zoom(distance / pinch);
      pinch = distance;
      return;
    }
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (drag.shift) camera.pan = [clamp(drag.pan[0] - 2 * dx / canvas.clientHeight, -5, 5), clamp(drag.pan[1] + 2 * dy / canvas.clientHeight, -5, 5)];
    else { camera.yaw = (drag.yaw + dx * .006) % (Math.PI * 2); camera.pitch = clamp(drag.pitch + dy * .005, -1.35, 1.35); }
    mark();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => { pointers.delete(event.pointerId); drag = null; pinch = 0; });
  canvas.addEventListener('wheel', event => { event.preventDefault(); zoom(Math.exp(-event.deltaY * .001)); }, { passive: false });
  window.addEventListener('resize', () => { dirty = true; });
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); ready = false; fail(Error('图形上下文中断，请刷新恢复已保存参数')); });
  function tick(time) {
    const dt = Math.min((time - lastTick) / 1000, .05);
    lastTick = time;
    if (ready && !document.hidden) {
      if (running) { cameras[active].yaw = (cameras[active].yaw + dt * .16) % (Math.PI * 2); dirty = true; }
      if (dirty && time - lastDraw > 40) { try { draw(); } catch (error) { fail(error); } }
    }
    requestAnimationFrame(tick);
  }
  // Public QA identity is the numbered study. The shader mode mapping stays internal.
  window.KAOPU_STUDIES = {
    version: VERSION,
    get ready() { return ready; },
    select, draw,
    getState: () => copy({ active, states, cameras, rig, quality, running, frames, fps }),
    packet: () => copy(lastPacket),
    pixels: () => {
      if (!ready) return [];
      const data = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return Array.from(data);
    },
    glError: () => gl ? gl.getError() : null,
    setCamera: value => { cameras[active] = normalizedCamera({ ...cameras[active], ...value }); mark(); return draw(); },
    setQuality: value => { quality = normalizedQuality({ ...quality, ...value }); build(); mark(); return draw(); },
    setValues: value => { states[active] = normalizedState({ ...states[active], ...value }); build(); mark(); return draw(); },
    setRig: value => { rig = normalizedRig({ ...rig, ...value }); build(); mark(); return draw(); },
    stop: () => { setRunning(false); mark(); return draw(); }
  };
  build();
  try {
    await Promise.all(['iq-study.frag', 'post.frag'].map(async file => {
      const response = await fetch(new URL(file, baseURL), { cache: 'no-cache' });
      if (!response.ok) throw Error(file + ' HTTP ' + response.status);
      sources[file] = await response.text();
    }));
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) throw Error('WebGL2 未启动');
    gl.bindVertexArray(gl.createVertexArray());
    ready = true;
    select(requestedCase(), false);
    requestAnimationFrame(tick);
  } catch (error) { ready = false; fail(error); }
})();
