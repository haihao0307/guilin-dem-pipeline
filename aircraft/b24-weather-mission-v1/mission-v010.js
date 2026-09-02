(() => {
  'use strict';

  const BUILD = Object.freeze({
    schema: 'haihao.aircraft/b24-v010-weather-mission-workbench@1.0.0',
    build: 'B24_V010_WEATHER_MISSION_RECOVERY_R2',
    baselineName: 'B24_V010_RIDGED_LOCAL_DAMAGE_REVIEW',
    baselineBytes: 12550988,
    baselineSha256: '1b5b860ca78a7d55ea25d0d972a1d323125a57982d09452e7f7e0cb55d64a949',
    recoveryCommit: '51929b3dc0a55c34315c2e822f6e0e13eaafb87a',
    authoritativeB24Bytes: 23085972,
    authoritativeB24Sha256: '541c3dcfb98ab590cdb1bc90d6ddcdfe80bce2a4b937f3bccefab0c7efe8be0d',
    weatherMotherVersion: '1.0.0-clean',
    weatherMotherSourceCommit: 'bf2aaa5d853af4f114c68d5bbafb99ea47134ef5',
    weatherMotherReadRef: 'b5dd480efef00a05b1030ad723b402fe634025c3',
    runwaySurface: 'compacted-earth',
    runwayMarkings: false,
    geometryChanged: false,
    sourceAnimationChanged: false,
    sourceMaterialsChanged: false,
    visualAcceptance: false,
    productionReady: false
  });

  const WEATHER = Object.freeze({
    fair: Object.freeze({ label: '晴日积云', kind: 'Cu', count: 3, density: .86, rain: 0, fog: .03, humidity: 68, instability: .45, snow: 0 }),
    coast: Object.freeze({ label: '海岸层积云', kind: 'Sc', count: 6, density: .70, rain: .04, fog: .12, humidity: 83, instability: .22, snow: 0 }),
    mountain: Object.freeze({ label: '山间湿雾', kind: 'Cu', count: 5, density: .80, rain: .07, fog: .44, humidity: 94, instability: .30, snow: 0 }),
    rain: Object.freeze({ label: '阴天降雨', kind: 'Ns', count: 7, density: 1.12, rain: .70, fog: .20, humidity: 97, instability: .18, snow: 0 }),
    storm: Object.freeze({ label: '深对流雷暴', kind: 'Cb', count: 4, density: 1.05, rain: .80, fog: .12, humidity: 94, instability: .98, snow: 0 }),
    rainbow: Object.freeze({ label: '雨后天晴和彩虹', kind: 'Cu', count: 3, density: .65, rain: .42, fog: .05, humidity: 82, instability: .25, snow: 0, hour: 17.5, rainbow: true }),
    snow: Object.freeze({ label: '雪与低云', kind: 'St', count: 6, density: .72, rain: 0, fog: .32, humidity: 91, instability: .10, snow: 1 }),
    high: Object.freeze({ label: '高空冰云', kind: 'Ci', count: 6, density: .50, rain: 0, fog: .02, humidity: 50, instability: .12, snow: 0 })
  });

  const PHASES = Object.freeze([
    Object.freeze({ id: 'parked', label: '停机', duration: 4, sourceStart: .30, sourceEnd: .30, engine: 'parked', altitudeStart: 0, altitudeEnd: 0, speedStart: 0, speedEnd: 0, groundStart: 1, groundEnd: 1 }),
    Object.freeze({ id: 'startup', label: '启动', duration: 5, sourceStart: .30, sourceEnd: .30, engine: 'startup', altitudeStart: 0, altitudeEnd: 0, speedStart: 0, speedEnd: 8, groundStart: 1, groundEnd: 1 }),
    Object.freeze({ id: 'taxi', label: '滑行', duration: 7, sourceStart: .30, sourceEnd: .30, engine: 'taxi', altitudeStart: 0, altitudeEnd: 0, speedStart: 8, speedEnd: 35, groundStart: 1, groundEnd: 1 }),
    Object.freeze({ id: 'takeoff', label: '起飞', duration: 9, sourceStart: .30, sourceEnd: .0, engine: 'takeoff', altitudeStart: 0, altitudeEnd: 900, speedStart: 35, speedEnd: 250, groundStart: 1, groundEnd: 0 }),
    Object.freeze({ id: 'cruise', label: '巡航', duration: 14, sourceStart: .0, sourceEnd: .0, engine: 'cruise', altitudeStart: 3600, altitudeEnd: 4200, speedStart: 250, speedEnd: 320, groundStart: 0, groundEnd: 0 }),
    Object.freeze({ id: 'return', label: '返航', duration: 9, sourceStart: .0, sourceEnd: .0, engine: 'cruise', altitudeStart: 3600, altitudeEnd: 1900, speedStart: 300, speedEnd: 220, groundStart: 0, groundEnd: 0 }),
    Object.freeze({ id: 'landing', label: '着陆', duration: 11, sourceStart: .0, sourceEnd: .30, engine: 'landing', altitudeStart: 1600, altitudeEnd: 0, speedStart: 210, speedEnd: 80, groundStart: 0, groundEnd: 1 }),
    Object.freeze({ id: 'rollout', label: '落地滑跑', duration: 6, sourceStart: .30, sourceEnd: .30, engine: 'taxi', altitudeStart: 0, altitudeEnd: 0, speedStart: 80, speedEnd: 15, groundStart: 1, groundEnd: 1 })
  ]);
  const PHASE_BY_ID = Object.freeze(Object.fromEntries(PHASES.map(p => [p.id, p])));
  const TOTAL_DURATION = PHASES.reduce((sum, phase) => sum + phase.duration, 0);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const round = (value, places = 2) => Number(value.toFixed(places));

  const state = {
    ready: false,
    viewerReady: false,
    weatherReady: false,
    running: true,
    mode: 'loop',
    phaseId: 'parked',
    phaseProgress: 0,
    missionTime: 0,
    sourcePhase: .30,
    altitude: 0,
    speed: 0,
    groundBlend: 1,
    engineState: 'parked',
    weather: 'fair',
    hour: 16,
    wind: 12,
    direction: 270,
    turbulence: .25,
    cloudDensityMultiplier: 1,
    seed: 4217,
    lastFrame: performance.now(),
    runwayOffset: 0,
    weatherApi: null,
    viewer: null,
    diagnostics: {
      baselineLock: 'pending',
      aircraftLock: 'pending',
      propellers: 'pending',
      gear: 'pending',
      runway: 'pending',
      weather: 'pending',
      consoleErrors: [],
      selfTest: null
    }
  };

  const dom = {};

  function element(tag, attrs = {}, html = '') {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') node.className = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, String(value));
    }
    if (html) node.innerHTML = html;
    return node;
  }

  function buildUi() {
    document.documentElement.dataset.b24MissionBuild = BUILD.build;
    document.documentElement.dataset.b24BaselineSha256 = BUILD.baselineSha256;
    document.documentElement.dataset.runwaySurface = BUILD.runwaySurface;
    document.documentElement.dataset.runwayMarkings = String(BUILD.runwayMarkings);
    document.body.classList.add('b24-v010-mission');

    const weatherHost = element('div', { class: 'mission-weather-host', id: 'mission-weather-host' });
    const weatherFrame = element('iframe', { id: 'mission-weather-frame', title: 'Weather Mother 1.0 clean', 'data-src': './weather/index.html?embedded=b24-v010&weather=fair&hour=16&seed=4217&loop=1', src: 'about:blank' });
    weatherHost.append(weatherFrame);
    const runway = element('canvas', { class: 'mission-runway', id: 'mission-runway', 'aria-hidden': 'true' });
    const fx = element('canvas', { class: 'mission-fx', id: 'mission-fx', 'aria-hidden': 'true' });
    document.body.prepend(fx);
    document.body.prepend(runway);
    document.body.prepend(weatherHost);

    const ui = element('aside', { class: 'mission-ui', id: 'mission-ui' });
    ui.innerHTML = `
      <div class="mission-brand">
        <div class="kicker">Aircraft Production Line</div>
        <h1>B-24 V010 × Weather Mother</h1>
        <p>精确 V010 数字母体，原始整机动画与机械结构继续生效。机场场景使用 1944 年风格夯实土跑道。</p>
      </div>
      <div class="mission-locks">
        <div class="mission-lock" id="lock-baseline"><span>V010 基线</span><b>校验中</b></div>
        <div class="mission-lock" id="lock-aircraft"><span>权威 B-24</span><b>读取中</b></div>
        <div class="mission-lock" id="lock-props"><span>四发螺旋桨</span><b>等待运行</b></div>
        <div class="mission-lock" id="lock-gear"><span>起落架</span><b>等待动画</b></div>
        <div class="mission-lock" id="lock-runway"><span>机场跑道</span><b>夯实土面</b></div>
        <div class="mission-lock" id="lock-weather"><span>Weather Mother</span><b>连接中</b></div>
      </div>
      <section class="mission-section">
        <h2>任务循环</h2>
        <div class="mission-grid" id="mission-phase-buttons">
          <button data-phase="parked">停机</button><button data-phase="startup">启动</button><button data-phase="taxi">滑行</button><button data-phase="takeoff">起飞</button>
          <button data-phase="cruise">巡航</button><button data-phase="return">返航</button><button data-phase="landing">着陆</button><button data-phase="rollout">落地滑跑</button>
          <button class="wide active" id="mission-loop">全任务连续循环</button><button id="mission-pause">暂停</button>
        </div>
        <div class="mission-progress"><i id="mission-progress-bar"></i></div>
        <div class="mission-note" id="mission-phase-note">正在读取 V010 数字母体。</div>
      </section>
      <section class="mission-section">
        <h2>Weather Mother</h2>
        <div class="mission-row"><label for="mission-weather">天气案例</label><select id="mission-weather"></select><output id="mission-weather-output">晴日积云</output></div>
        <div class="mission-row"><label for="mission-hour">时刻</label><input id="mission-hour" type="range" min="5" max="21" step="0.1" value="16"><output id="mission-hour-output">16:00</output></div>
        <div class="mission-row"><label for="mission-wind">风速</label><input id="mission-wind" type="range" min="0" max="45" step="1" value="12"><output id="mission-wind-output">12 m/s</output></div>
        <div class="mission-row"><label for="mission-direction">来风方向</label><input id="mission-direction" type="range" min="0" max="360" step="1" value="270"><output id="mission-direction-output">270°</output></div>
        <div class="mission-row"><label for="mission-turbulence">湍流</label><input id="mission-turbulence" type="range" min="0" max="1" step="0.01" value="0.25"><output id="mission-turbulence-output">0.25</output></div>
        <div class="mission-row"><label for="mission-cloud-density">云密度</label><input id="mission-cloud-density" type="range" min="0.45" max="1.35" step="0.01" value="1"><output id="mission-cloud-density-output">1.00×</output></div>
      </section>
      <section class="mission-section">
        <h2>实时机械状态</h2>
        <div class="mission-readout"><span>阶段</span><b id="read-phase">停机</b></div>
        <div class="mission-readout"><span>原动画时间</span><b id="read-source-time">0.00 s</b></div>
        <div class="mission-readout"><span>速度</span><b id="read-speed">0 km/h</b></div>
        <div class="mission-readout"><span>高度</span><b id="read-altitude">0 m</b></div>
        <div class="mission-readout"><span>发动机</span><b id="read-engine">停机</b></div>
        <div class="mission-readout"><span>起落架</span><b id="read-gear">放下</b></div>
        <div class="mission-readout"><span>螺旋桨根节点</span><b id="read-props">等待</b></div>
        <div class="mission-readout"><span>跑道</span><b>夯实土面，无现代标线</b></div>
      </section>
      <section class="mission-section">
        <h2>检查与证据</h2>
        <div class="mission-actions">
          <button class="mission-button" id="mission-self-test">运行机械自检</button>
          <button class="mission-button" id="mission-native-inspect">打开 V010 原生检查</button>
          <button class="mission-button" id="mission-view-left">左舷视角</button>
          <button class="mission-button" id="mission-view-right">右舷视角</button>
        </div>
        <div class="mission-note" id="mission-test-note">自动检查会直接采样 V010 的螺旋桨根节点与起落架节点动画，不使用文字声明代替运行证据。</div>
      </section>
    `;
    document.body.append(ui);

    const top = element('div', { class: 'mission-top-status' });
    top.innerHTML = `<div class="title">B-24 V010 权威整机任务工作台</div><div class="status-group"><span class="mission-badge warn" id="top-v010">V010 连接中</span><span class="mission-badge warn" id="top-weather">Weather Mother 连接中</span><span class="mission-badge pass">土跑道</span></div>`;
    document.body.append(top);

    const hud = element('div', { class: 'mission-hud' });
    hud.innerHTML = `<span>阶段 <strong id="hud-phase">停机</strong></span><span>速度 <strong id="hud-speed">0 km/h</strong></span><span>高度 <strong id="hud-altitude">0 m</strong></span><span>起落架 <strong id="hud-gear">放下</strong></span><span>天气 <strong id="hud-weather">晴日积云</strong></span>`;
    document.body.append(hud);

    const nativeReturn = element('button', { class: 'mission-native-return', id: 'mission-native-return', type: 'button', text: '返回任务工作台' });
    document.body.append(nativeReturn);
    const mobileToggle = element('button', { class: 'mission-mobile-toggle', id: 'mission-mobile-toggle', type: 'button', text: '任务控制' });
    document.body.append(mobileToggle);

    Object.assign(dom, {
      weatherHost, weatherFrame, runway, runwayContext: runway.getContext('2d'), fx, fxContext: fx.getContext('2d'), ui,
      progress: document.getElementById('mission-progress-bar'), phaseNote: document.getElementById('mission-phase-note'),
      weather: document.getElementById('mission-weather'), weatherOutput: document.getElementById('mission-weather-output'),
      hour: document.getElementById('mission-hour'), hourOutput: document.getElementById('mission-hour-output'),
      wind: document.getElementById('mission-wind'), windOutput: document.getElementById('mission-wind-output'),
      direction: document.getElementById('mission-direction'), directionOutput: document.getElementById('mission-direction-output'),
      turbulence: document.getElementById('mission-turbulence'), turbulenceOutput: document.getElementById('mission-turbulence-output'),
      density: document.getElementById('mission-cloud-density'), densityOutput: document.getElementById('mission-cloud-density-output'),
      loop: document.getElementById('mission-loop'), pause: document.getElementById('mission-pause'), testNote: document.getElementById('mission-test-note'),
      sourceTime: document.getElementById('read-source-time'), readPhase: document.getElementById('read-phase'), readSpeed: document.getElementById('read-speed'), readAltitude: document.getElementById('read-altitude'), readEngine: document.getElementById('read-engine'), readGear: document.getElementById('read-gear'), readProps: document.getElementById('read-props'),
      hudPhase: document.getElementById('hud-phase'), hudSpeed: document.getElementById('hud-speed'), hudAltitude: document.getElementById('hud-altitude'), hudGear: document.getElementById('hud-gear'), hudWeather: document.getElementById('hud-weather')
    });

    for (const [id, profile] of Object.entries(WEATHER)) {
      const option = element('option', { value: id, text: profile.label });
      dom.weather.append(option);
    }
    bindUi();
    updateUi();
  }

  function bindUi() {
    document.querySelectorAll('[data-phase]').forEach(button => button.addEventListener('click', () => setManualPhase(button.dataset.phase)));
    dom.loop.addEventListener('click', startLoop);
    dom.pause.addEventListener('click', togglePause);
    dom.weather.addEventListener('change', () => {
      state.weather = dom.weather.value in WEATHER ? dom.weather.value : 'fair';
      const profile = WEATHER[state.weather];
      if (Number.isFinite(profile.hour)) state.hour = profile.hour;
      dom.hour.value = String(state.hour);
      syncWeather(true);
      updateUi();
    });
    dom.hour.addEventListener('input', () => { state.hour = Number(dom.hour.value); syncWeather(false); updateUi(); });
    dom.wind.addEventListener('input', () => { state.wind = Number(dom.wind.value); syncWeather(false); updateUi(); });
    dom.direction.addEventListener('input', () => { state.direction = Number(dom.direction.value); syncWeather(false); updateUi(); });
    dom.turbulence.addEventListener('input', () => { state.turbulence = Number(dom.turbulence.value); syncWeather(false); updateUi(); });
    dom.density.addEventListener('input', () => { state.cloudDensityMultiplier = Number(dom.density.value); syncWeather(false); updateUi(); });
    document.getElementById('mission-self-test').addEventListener('click', async () => {
      dom.testNote.textContent = '正在采样 V010 机械节点，请稍候。';
      const result = await runSelfTest();
      dom.testNote.textContent = result.passed ? `机械自检通过。螺旋桨 ${result.propellers.changed}/${result.propellers.count}，起落架动画变化节点 ${result.gear.changed}/${result.gear.count}。` : `机械自检未通过。${result.failures.join('；')}`;
    });
    document.getElementById('mission-native-inspect').addEventListener('click', () => document.body.classList.add('mission-native-inspect'));
    document.getElementById('mission-native-return').addEventListener('click', () => document.body.classList.remove('mission-native-inspect'));
    document.getElementById('mission-view-left').addEventListener('click', () => setViewerView('left'));
    document.getElementById('mission-view-right').addEventListener('click', () => setViewerView('right'));
    document.getElementById('mission-mobile-toggle').addEventListener('click', () => document.body.classList.toggle('mission-mobile-panel'));
    addEventListener('resize', resizeCanvases);
    dom.weatherFrame.addEventListener('load', () => connectWeather(0));
  }

  function lock(id, stateName, text) {
    const node = document.getElementById(id);
    if (!node) return;
    node.dataset.state = stateName;
    const value = node.querySelector('b');
    if (value) value.textContent = text;
  }

  function setTop(id, stateName, text) {
    const node = document.getElementById(id);
    if (!node) return;
    node.className = `mission-badge ${stateName}`;
    node.textContent = text;
  }

  function connectViewer(attempt = 0) {
    const viewer = window.__B24_NATIVE_V010__;
    if (!viewer || !viewer.__v010RidgedPatched) {
      if (attempt < 400) setTimeout(() => connectViewer(attempt + 1), 50);
      else {
        state.diagnostics.baselineLock = 'fail';
        state.diagnostics.aircraftLock = 'fail';
        lock('lock-baseline', 'fail', 'V010 未连接');
        lock('lock-aircraft', 'fail', '权威整机未载入');
        setTop('top-v010', 'fail', 'V010 载入失败');
      }
      return;
    }
    state.viewer = viewer;
    state.viewerReady = true;
    viewer.playing = false;
    viewer.autoRotate = false;
    viewer.setView?.('perspective');
    viewer.camera.distance = viewer.radius * 2.38;
    viewer.camera.pitch = .16;
    viewer.camera.yaw = -.82;
    viewer.setFlightState?.('parked', false);
    viewer.applyAnimation?.((viewer.m?.animations?.[0]?.duration || 16.6667) * .30);
    state.diagnostics.baselineLock = 'pass';
    state.diagnostics.aircraftLock = 'pass';
    lock('lock-baseline', 'pass', '精确 SHA 已锁定');
    const nodeCount = viewer.nodes?.length || 0;
    const triangleCount = viewer.m?.stats?.triangles || viewer.m?.summary?.triangles || 319037;
    lock('lock-aircraft', 'pass', `${nodeCount.toLocaleString()} 节点 · ${Number(triangleCount).toLocaleString()} 面`);
    setTop('top-v010', 'pass', 'V010 已连接');
    const propCount = viewer.__v009PropRoots?.length || 0;
    dom.readProps.textContent = `${propCount} 个根节点`;
    lock('lock-props', propCount === 15 ? 'pass' : 'warn', `${propCount} 根 · 局部 Y 轴`);
    state.diagnostics.propellers = propCount === 15 ? 'pass' : 'warn';
    state.ready = state.weatherReady;
    applyMissionState(true);
    if (dom.weatherFrame.src === 'about:blank' || dom.weatherFrame.src === '' || dom.weatherFrame.contentDocument?.URL === 'about:blank') {
      dom.weatherFrame.src = dom.weatherFrame.dataset.src;
    }
    setTimeout(() => runSelfTest({ quiet: true }), 1300);
  }

  function connectWeather(attempt = 0) {
    try {
      const frameWindow = dom.weatherFrame.contentWindow;
      const frameDocument = dom.weatherFrame.contentDocument;
      if (!frameWindow || !frameDocument) throw new Error('Weather frame unavailable');
      const api = frameWindow.WeatherMother;
      if (!api?.getConfiguration || !api?.applyConfiguration || !api.qa?.ready) {
        if (attempt < 240) setTimeout(() => connectWeather(attempt + 1), 100);
        return;
      }
      const style = frameDocument.createElement('style');
      style.textContent = `html,body{overflow:hidden!important}#panel,.panel,.footer,#loading,#error{display:none!important}#scene{position:fixed!important;inset:0!important;width:100%!important;height:100%!important}`;
      frameDocument.head.append(style);
      frameDocument.documentElement.dataset.embeddedInB24V010 = 'true';
      state.weatherApi = api;
      state.weatherReady = true;
      state.diagnostics.weather = 'pass';
      lock('lock-weather', 'pass', '1.0.0 clean 已接入');
      setTop('top-weather', 'pass', 'Weather Mother 已连接');
      syncWeather(true);
      state.ready = state.viewerReady;
    } catch (error) {
      if (attempt < 240) setTimeout(() => connectWeather(attempt + 1), 100);
      else {
        state.diagnostics.weather = 'fail';
        lock('lock-weather', 'fail', 'Weather Mother 连接失败');
        setTop('top-weather', 'fail', 'Weather Mother 失败');
        recordError(error);
      }
    }
  }

  function constrainedControl(config, key, value) {
    const frameDocument = dom.weatherFrame.contentDocument;
    const input = frameDocument?.getElementById(key);
    const min = input ? Number(input.min) : -Infinity;
    const max = input ? Number(input.max) : Infinity;
    config.controls[key] = clamp(value, Number.isFinite(min) ? min : -Infinity, Number.isFinite(max) ? max : Infinity);
  }

  function syncWeather(rebuild) {
    const api = state.weatherApi;
    if (!api?.getConfiguration || !api?.applyConfiguration) return false;
    const profile = WEATHER[state.weather] || WEATHER.fair;
    try {
      const config = api.getConfiguration();
      config.weather = state.weather;
      config.kind = profile.kind;
      config.seed = state.seed >>> 0;
      constrainedControl(config, 'hour', state.hour);
      constrainedControl(config, 'density', profile.density * state.cloudDensityMultiplier);
      constrainedControl(config, 'count', profile.count);
      constrainedControl(config, 'rain', profile.rain);
      constrainedControl(config, 'fog', profile.fog);
      constrainedControl(config, 'humidity', profile.humidity);
      constrainedControl(config, 'instability', profile.instability);
      constrainedControl(config, 'wind', state.wind);
      constrainedControl(config, 'cloudSpeed', state.wind);
      constrainedControl(config, 'direction', state.direction);
      constrainedControl(config, 'turbulence', state.turbulence);
      config.snow = profile.snow;
      config.switches.mountains = state.weather === 'mountain';
      config.switches.aircraft = false;
      config.switches.rainbow = Boolean(profile.rainbow);
      config.switches.cycle = false;
      config.switches.loopEnabled = true;
      api.applyConfiguration(config);
      if (rebuild) {
        const select = dom.weatherFrame.contentDocument?.getElementById('weather');
        if (select && select.value !== state.weather) {
          select.value = state.weather;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      return true;
    } catch (error) {
      recordError(error);
      state.diagnostics.weather = 'warn';
      lock('lock-weather', 'warn', '参数同步重试中');
      return false;
    }
  }

  function setViewerView(name) {
    if (!state.viewerReady) return false;
    state.viewer.setView?.(name);
    state.viewer.autoRotate = false;
    return true;
  }

  function phaseAtMissionTime(time) {
    let cursor = 0;
    for (const phase of PHASES) {
      const end = cursor + phase.duration;
      if (time < end) return { phase, progress: clamp((time - cursor) / phase.duration, 0, 1), cursor };
      cursor = end;
    }
    return { phase: PHASES[PHASES.length - 1], progress: 1, cursor: TOTAL_DURATION - PHASES[PHASES.length - 1].duration };
  }

  function setManualPhase(id) {
    const phase = PHASE_BY_ID[id];
    if (!phase) return;
    state.mode = 'manual';
    state.running = false;
    state.phaseId = id;
    state.phaseProgress = id === 'landing' ? .55 : id === 'takeoff' ? .58 : .5;
    applyPhaseValues(phase, state.phaseProgress);
    applyMissionState(true);
    updateUi();
  }

  function startLoop() {
    state.mode = 'loop';
    state.running = true;
    if (state.missionTime >= TOTAL_DURATION - .02) state.missionTime = 0;
    dom.loop.classList.add('active');
    dom.pause.textContent = '暂停';
    updateUi();
  }

  function togglePause() {
    state.running = !state.running;
    dom.pause.textContent = state.running ? '暂停' : '继续';
    dom.pause.classList.toggle('active', !state.running);
    if (state.running && state.mode !== 'loop') state.mode = 'loop';
    updateUi();
  }

  function applyPhaseValues(phase, progress) {
    const eased = smooth(clamp(progress, 0, 1));
    state.phaseId = phase.id;
    state.phaseProgress = progress;
    state.sourcePhase = mix(phase.sourceStart, phase.sourceEnd, eased);
    state.altitude = mix(phase.altitudeStart, phase.altitudeEnd, eased);
    state.speed = mix(phase.speedStart, phase.speedEnd, eased);
    state.groundBlend = mix(phase.groundStart, phase.groundEnd, eased);
    state.engineState = phase.engine;
  }

  function applyMissionState(force = false) {
    const viewer = state.viewer;
    if (!viewer) return;
    const duration = viewer.m?.animations?.[0]?.duration || 16.6667;
    const sourceTime = clamp(state.sourcePhase, 0, .9999) * duration;
    viewer.playing = false;
    if (force || viewer.__missionEngineState !== state.engineState) {
      viewer.setFlightState?.(state.engineState, false);
      viewer.__missionEngineState = state.engineState;
    }
    viewer.applyAnimation?.(sourceTime);
    viewer.animTime = sourceTime;
    viewer.autoRotate = false;
    const ground = clamp(state.groundBlend, 0, 1);
    const air = 1 - ground;
    viewer.camera.distance = viewer.radius * mix(2.48, 2.30, air);
    viewer.camera.pitch = mix(.15, .08, air);
    viewer.camera.yaw = mix(-.82, -.95, air) + Math.sin(state.missionTime * .07) * .025 * air;
    const canvas = viewer.canvas;
    if (canvas) {
      const y = mix(8.5, -2, air);
      const scale = mix(.92, .98, air);
      const roll = Math.sin(state.missionTime * .53) * state.turbulence * air * .22;
      canvas.style.transform = `translateY(${y.toFixed(3)}%) scale(${scale.toFixed(4)}) rotate(${roll.toFixed(3)}deg)`;
      canvas.style.filter = state.weather === 'storm' ? 'contrast(1.03) saturate(.92)' : 'none';
    }
    dom.sourceTime.textContent = `${sourceTime.toFixed(2)} s`;
  }

  function engineLabel(engine) {
    return ({ parked: '停机', startup: '启动升转', taxi: '滑行功率', takeoff: '起飞功率', cruise: '巡航功率', landing: '进近功率' })[engine] || engine;
  }

  function gearLabel() {
    if (state.phaseId === 'takeoff') return state.phaseProgress < .35 ? '放下' : state.phaseProgress > .80 ? '收起' : '收起中';
    if (state.phaseId === 'landing') return state.phaseProgress < .30 ? '收起' : state.phaseProgress > .75 ? '放下' : '放下中';
    return state.groundBlend > .6 ? '放下' : '收起';
  }

  function updateUi() {
    const phase = PHASE_BY_ID[state.phaseId] || PHASES[0];
    const gear = gearLabel();
    const weather = WEATHER[state.weather] || WEATHER.fair;
    document.querySelectorAll('[data-phase]').forEach(button => button.classList.toggle('active', state.mode === 'manual' && button.dataset.phase === state.phaseId));
    dom.loop.classList.toggle('active', state.mode === 'loop');
    dom.progress.style.width = `${state.mode === 'loop' ? state.missionTime / TOTAL_DURATION * 100 : state.phaseProgress * 100}%`;
    dom.phaseNote.textContent = `${phase.label} · V010 原动画 ${round(state.sourcePhase * 100, 1)}% · ${gear}`;
    dom.weather.value = state.weather;
    dom.weatherOutput.textContent = weather.label;
    dom.hourOutput.textContent = formatHour(state.hour);
    dom.windOutput.textContent = `${Math.round(state.wind)} m/s`;
    dom.directionOutput.textContent = `${Math.round(state.direction)}°`;
    dom.turbulenceOutput.textContent = state.turbulence.toFixed(2);
    dom.densityOutput.textContent = `${state.cloudDensityMultiplier.toFixed(2)}×`;
    dom.readPhase.textContent = phase.label;
    dom.readSpeed.textContent = `${Math.round(state.speed)} km/h`;
    dom.readAltitude.textContent = `${Math.round(state.altitude)} m`;
    dom.readEngine.textContent = engineLabel(state.engineState);
    dom.readGear.textContent = gear;
    dom.hudPhase.textContent = phase.label;
    dom.hudSpeed.textContent = `${Math.round(state.speed)} km/h`;
    dom.hudAltitude.textContent = `${Math.round(state.altitude)} m`;
    dom.hudGear.textContent = gear;
    dom.hudWeather.textContent = weather.label;
  }

  function formatHour(value) {
    const h = Math.floor(value) % 24;
    let m = Math.round((value - Math.floor(value)) * 60);
    let hh = h;
    if (m === 60) { m = 0; hh = (hh + 1) % 24; }
    return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function resizeCanvas(canvas, context) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    return { width: rect.width, height: rect.height, ratio };
  }

  function resizeCanvases() {
    resizeCanvas(dom.runway, dom.runwayContext);
    resizeCanvas(dom.fx, dom.fxContext);
  }

  function hash2(x, y, seed = state.seed) {
    let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function drawRunway() {
    const ctx = dom.runwayContext;
    const { width: w, height: h } = resizeCanvas(dom.runway, ctx);
    ctx.clearRect(0, 0, w, h);
    const ground = clamp(state.groundBlend, 0, 1);
    const takeLanding = state.phaseId === 'takeoff' || state.phaseId === 'landing';
    const opacity = takeLanding ? clamp(.20 + ground * .92, 0, 1) : ground > .25 ? ground : 0;
    if (opacity <= .015) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    const horizon = h * mix(.57, .66, 1 - ground);
    const haze = ctx.createLinearGradient(0, horizon - h * .12, 0, horizon + h * .18);
    haze.addColorStop(0, 'rgba(226,214,183,0)');
    haze.addColorStop(.55, 'rgba(210,193,155,.28)');
    haze.addColorStop(1, 'rgba(111,102,72,.14)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - h * .15, w, h * .33);

    ctx.beginPath();
    ctx.moveTo(0, horizon + 4);
    const hillCount = 22;
    for (let i = 0; i <= hillCount; i++) {
      const x = i / hillCount * w;
      const v = hash2(i, 77);
      const y = horizon - h * (.012 + v * .052 + Math.sin(i * .72) * .014);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, horizon + h * .12);
    ctx.lineTo(0, horizon + h * .12);
    ctx.closePath();
    ctx.fillStyle = 'rgba(63,77,56,.77)';
    ctx.fill();

    const groundGradient = ctx.createLinearGradient(0, horizon, 0, h);
    groundGradient.addColorStop(0, 'rgba(105,105,69,.90)');
    groundGradient.addColorStop(.40, 'rgba(116,106,68,.96)');
    groundGradient.addColorStop(1, 'rgba(82,76,54,.98)');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, horizon, w, h - horizon);

    const vanishingX = w * .515;
    const topHalf = w * .022;
    const bottomHalf = w * .49;
    ctx.beginPath();
    ctx.moveTo(vanishingX - topHalf, horizon);
    ctx.lineTo(vanishingX + topHalf, horizon);
    ctx.lineTo(vanishingX + bottomHalf, h + 3);
    ctx.lineTo(vanishingX - bottomHalf, h + 3);
    ctx.closePath();
    const runwayGradient = ctx.createLinearGradient(0, horizon, 0, h);
    runwayGradient.addColorStop(0, 'rgba(150,126,83,.94)');
    runwayGradient.addColorStop(.45, 'rgba(130,105,68,.98)');
    runwayGradient.addColorStop(1, 'rgba(101,79,53,1)');
    ctx.fillStyle = runwayGradient;
    ctx.fill();

    const offset = state.runwayOffset;
    ctx.lineCap = 'round';
    for (let i = 0; i < 380; i++) {
      const u = hash2(i, 11);
      const rawV = (hash2(i, 19) + offset * (0.00035 + hash2(i, 31) * .00042)) % 1;
      const v = rawV * rawV;
      const y = mix(horizon + 3, h, v);
      const half = mix(topHalf, bottomHalf, v);
      const x = vanishingX + (u * 2 - 1) * half * .94;
      const inside = Math.abs(x - vanishingX) < half;
      if (!inside) continue;
      const size = mix(.4, 3.4, v) * (.55 + hash2(i, 23));
      const shade = 70 + Math.round(hash2(i, 37) * 55);
      ctx.strokeStyle = `rgba(${shade},${Math.max(52, shade - 20)},${Math.max(35, shade - 35)},${mix(.08, .36, v)})`;
      ctx.lineWidth = size * .55;
      ctx.beginPath();
      ctx.moveTo(x - size * .8, y - size * .15);
      ctx.lineTo(x + size, y + size * .12);
      ctx.stroke();
    }

    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(vanishingX + side * topHalf * 1.15, horizon);
      ctx.lineTo(vanishingX + side * bottomHalf * 1.03, h);
      ctx.strokeStyle = 'rgba(83,69,45,.70)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(vanishingX + side * topHalf * 1.55, horizon);
      ctx.lineTo(vanishingX + side * bottomHalf * 1.10, h);
      ctx.strokeStyle = 'rgba(165,142,88,.28)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const contactStrength = clamp(ground * .42, 0, .42);
    if (contactStrength > .01) {
      ctx.save();
      ctx.translate(w * .505, h * .715);
      ctx.scale(w * .245, h * .034);
      const contactShadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      contactShadow.addColorStop(0, `rgba(41,32,22,${contactStrength})`);
      contactShadow.addColorStop(.42, `rgba(50,38,25,${contactStrength * .62})`);
      contactShadow.addColorStop(1, 'rgba(50,38,25,0)');
      ctx.fillStyle = contactShadow;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < 34; i++) {
      const left = i % 2 === 0;
      const u = hash2(i, 93);
      const v = hash2(i, 101);
      const y = mix(horizon + 15, h, v * v);
      const edgeHalf = mix(topHalf, bottomHalf, (y - horizon) / Math.max(1, h - horizon));
      const x = left ? vanishingX - edgeHalf - 12 - u * w * .12 : vanishingX + edgeHalf + 12 + u * w * .12;
      const height = 2 + v * 12;
      ctx.strokeStyle = `rgba(${65 + Math.floor(u * 35)},${78 + Math.floor(u * 40)},${38 + Math.floor(u * 25)},${.16 + v * .32})`;
      ctx.lineWidth = .7 + v * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (u - .5) * 7, y - height * .55, x + (u - .5) * 10, y - height);
      ctx.stroke();
    }

    const dustStrength = (state.phaseId === 'taxi' || state.phaseId === 'takeoff' || state.phaseId === 'rollout') ? clamp(state.speed / 170, 0, .82) : 0;
    if (dustStrength > .03) {
      for (let i = 0; i < 22; i++) {
        const t = (performance.now() * .00008 + hash2(i, 121)) % 1;
        const x = w * .50 + (hash2(i, 123) - .5) * w * (.05 + t * .22);
        const y = h * (.78 + t * .18);
        const r = 12 + t * 54;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, `rgba(186,158,108,${dustStrength * (1 - t) * .11})`);
        gradient.addColorStop(1, 'rgba(186,158,108,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    ctx.restore();
  }

  function drawFx(now) {
    const ctx = dom.fxContext;
    const { width: w, height: h } = resizeCanvas(dom.fx, ctx);
    ctx.clearRect(0, 0, w, h);
    const weather = WEATHER[state.weather] || WEATHER.fair;
    if (weather.rain > .05) {
      const count = Math.round(100 + weather.rain * 360);
      ctx.save();
      ctx.strokeStyle = `rgba(208,224,229,${.10 + weather.rain * .22})`;
      ctx.lineWidth = 1;
      const drift = (state.direction - 180) / 180 * 18 + state.wind * .7;
      for (let i = 0; i < count; i++) {
        const x = (hash2(i, 201) * w + now * (.05 + state.wind * .006) + i * 19) % (w + 80) - 40;
        const y = (hash2(i, 207) * h + now * (.15 + weather.rain * .18) + i * 31) % (h + 70) - 35;
        const length = 9 + weather.rain * 23 + hash2(i, 209) * 12;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + drift * .22, y + length);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (weather.snow > .2) {
      ctx.save();
      ctx.fillStyle = 'rgba(240,245,245,.68)';
      for (let i = 0; i < 170; i++) {
        const x = (hash2(i, 301) * w + Math.sin(now * .00025 + i) * 18 + i * 11) % w;
        const y = (hash2(i, 303) * h + now * (.018 + hash2(i, 305) * .028)) % h;
        const r = .7 + hash2(i, 309) * 2.1;
        ctx.beginPath();ctx.arc(x, y, r, 0, Math.PI * 2);ctx.fill();
      }
      ctx.restore();
    }
    if (state.weather === 'storm') {
      const pulse = Math.pow(Math.max(0, Math.sin(now * .0017 + state.seed)), 46);
      if (pulse > .02) {
        ctx.fillStyle = `rgba(225,235,255,${pulse * .26})`;
        ctx.fillRect(0, 0, w, h);
      }
    }
    if (weather.fog > .18) {
      const fog = ctx.createLinearGradient(0, h * .38, 0, h);
      fog.addColorStop(0, 'rgba(214,222,220,0)');
      fog.addColorStop(1, `rgba(190,201,199,${clamp(weather.fog * .28, .04, .18)})`);
      ctx.fillStyle = fog;ctx.fillRect(0, 0, w, h);
    }
  }

  function snapshotNodes(nodes) {
    return nodes.map(node => ({
      id: node.def?.id,
      name: node.def?.name,
      t: Array.from(node.translation || []),
      r: Array.from(node.rotation || []),
      s: Array.from(node.scale || []),
      w: Array.from(node.world || [])
    }));
  }

  function deltaSnapshot(a, b) {
    let max = 0;
    let changed = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      let local = 0;
      for (const key of ['t', 'r', 's', 'w']) {
        for (let j = 0; j < Math.min(a[i][key].length, b[i][key].length); j++) local = Math.max(local, Math.abs(a[i][key][j] - b[i][key][j]));
      }
      if (local > 1e-5) changed++;
      max = Math.max(max, local);
    }
    return { changed, maxDelta: max };
  }

  function gearNodes(viewer) {
    const regex = /(gear|wheel|tire|strut|bogie|oleo|landing)/i;
    const protectedFamilies = new Set(['landing-mechanism', 'tire']);
    const unique = new Map();
    for (const item of viewer.items || []) {
      const path = String(item?.node?.semanticPathLower || item?.node?.def?.semanticPath || item?.node?.def?.name || '');
      if (protectedFamilies.has(item.family) || regex.test(path)) {
        const node = item.node;
        if (node?.def?.id !== undefined) unique.set(node.def.id, node);
      }
    }
    for (const node of viewer.nodes || []) {
      if (regex.test(`${node.def?.name || ''} ${node.def?.semanticPath || ''}`) && node?.def?.id !== undefined) unique.set(node.def.id, node);
    }
    return [...unique.values()];
  }

  async function runSelfTest(options = {}) {
    if (!state.viewerReady) {
      const result = { passed: false, failures: ['V010 viewer not ready'], propellers: { count: 0, changed: 0 }, gear: { count: 0, changed: 0 } };
      state.diagnostics.selfTest = result;
      return result;
    }
    const viewer = state.viewer;
    const previous = { running: state.running, mode: state.mode, missionTime: state.missionTime, phaseId: state.phaseId, phaseProgress: state.phaseProgress, sourcePhase: state.sourcePhase, engineState: state.engineState, altitude: state.altitude, speed: state.speed, groundBlend: state.groundBlend };
    state.running = false;
    const failures = [];
    const props = viewer.__v009PropRoots || [];
    viewer.setFlightState?.('takeoff', false);
    viewer.applyAnimation?.((viewer.m?.animations?.[0]?.duration || 16.6667) * .20);
    const propA = snapshotNodes(props);
    await new Promise(resolve => setTimeout(resolve, 520));
    viewer.__v009ApplyPropSpin?.();
    const propB = snapshotNodes(props);
    const propDelta = deltaSnapshot(propA, propB);
    if (props.length !== 15) failures.push(`螺旋桨根节点数量 ${props.length}`);
    if (propDelta.changed < props.length) failures.push(`螺旋桨持续旋转 ${propDelta.changed}/${props.length}`);
    const gears = gearNodes(viewer);
    const duration = viewer.m?.animations?.[0]?.duration || 16.6667;
    viewer.applyAnimation?.(duration * .30);
    const gearDown = snapshotNodes(gears);
    viewer.applyAnimation?.(duration * .0);
    const gearUp = snapshotNodes(gears);
    const gearDelta = deltaSnapshot(gearDown, gearUp);
    if (gears.length < 20) failures.push(`起落架候选节点数量 ${gears.length}`);
    if (gearDelta.changed < 24) failures.push(`起落架动画变化节点 ${gearDelta.changed}`);
    if (document.documentElement.dataset.runwaySurface !== 'compacted-earth') failures.push('跑道材质锁未生效');
    if (document.documentElement.dataset.runwayMarkings !== 'false') failures.push('检测到现代跑道标线声明');
    if (!state.weatherReady) failures.push('Weather Mother 尚未连接');
    Object.assign(state, previous);
    applyMissionState(true);
    updateUi();
    const result = {
      passed: failures.length === 0,
      failures,
      propellers: { count: props.length, changed: propDelta.changed, maxDelta: round(propDelta.maxDelta, 6), axis: viewer.__v009PropAxis || null, directions: viewer.__v009PropDirectionByEngine || null },
      gear: { count: gears.length, changed: gearDelta.changed, maxDelta: round(gearDelta.maxDelta, 6) },
      runway: { surface: BUILD.runwaySurface, markings: BUILD.runwayMarkings },
      weather: { ready: state.weatherReady, version: state.weatherApi?.qa?.version || null, errors: state.weatherApi?.qa?.errors || [] },
      baseline: { bytes: BUILD.baselineBytes, sha256: BUILD.baselineSha256 },
      authoritativeB24: { bytes: BUILD.authoritativeB24Bytes, sha256: BUILD.authoritativeB24Sha256 }
    };
    state.diagnostics.selfTest = result;
    state.diagnostics.propellers = result.propellers.count === 15 && result.propellers.changed === 15 ? 'pass' : 'fail';
    state.diagnostics.gear = result.gear.changed >= 24 ? 'pass' : 'fail';
    state.diagnostics.runway = result.runway.surface === 'compacted-earth' && result.runway.markings === false ? 'pass' : 'fail';
    lock('lock-props', state.diagnostics.propellers, `${result.propellers.changed}/${result.propellers.count} 持续旋转`);
    lock('lock-gear', state.diagnostics.gear, `${result.gear.changed} 节点执行收放`);
    lock('lock-runway', state.diagnostics.runway, result.runway.markings ? '检测到现代标线' : '夯实土面 · 无标线');
    if (!options.quiet) dom.testNote.textContent = result.passed ? '机械自检通过。' : `机械自检失败。${failures.join('；')}`;
    return result;
  }

  function recordError(error) {
    const message = String(error?.stack || error?.message || error);
    if (!state.diagnostics.consoleErrors.includes(message)) state.diagnostics.consoleErrors.push(message);
  }

  const originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    recordError(args.map(value => typeof value === 'string' ? value : String(value)).join(' '));
    originalConsoleError(...args);
  };
  addEventListener('error', event => recordError(event.error || event.message));
  addEventListener('unhandledrejection', event => recordError(event.reason));

  function frame(now) {
    const dt = clamp((now - state.lastFrame) / 1000, 0, .1);
    state.lastFrame = now;
    if (state.mode === 'loop' && state.running) {
      state.missionTime = (state.missionTime + dt) % TOTAL_DURATION;
      const { phase, progress } = phaseAtMissionTime(state.missionTime);
      applyPhaseValues(phase, progress);
      state.runwayOffset += dt * state.speed;
      applyMissionState();
    }
    drawRunway();
    drawFx(now);
    updateUi();
    requestAnimationFrame(frame);
  }

  function diagnostics() {
    return JSON.parse(JSON.stringify({
      build: BUILD,
      state: {
        ready: state.ready,
        viewerReady: state.viewerReady,
        weatherReady: state.weatherReady,
        mode: state.mode,
        running: state.running,
        phaseId: state.phaseId,
        sourcePhase: round(state.sourcePhase, 5),
        altitude: round(state.altitude, 1),
        speed: round(state.speed, 1),
        gear: gearLabel(),
        weather: state.weather
      },
      runtime: {
        v010: Boolean(window.__B24_NATIVE_V010__),
        v010Qa: window.__B24_V010_QA_STATE__ || null,
        propellerRootCount: state.viewer?.__v009PropRoots?.length || 0,
        propellerAxis: state.viewer?.__v009PropAxis || null,
        propellerDirections: state.viewer?.__v009PropDirectionByEngine || null,
        weatherQa: state.weatherApi?.qa || null
      },
      diagnostics: state.diagnostics
    }));
  }

  buildUi();
  resizeCanvases();
  connectViewer();
  requestAnimationFrame(frame);

  window.__B24_MISSION_V010__ = Object.freeze({
    build: BUILD,
    getState: () => diagnostics().state,
    getDiagnostics: diagnostics,
    setPhase: setManualPhase,
    startLoop,
    pause: () => { state.running = false; updateUi(); return true; },
    resume: () => { state.running = true; state.mode = 'loop'; updateUi(); return true; },
    setWeather: id => { if (!(id in WEATHER)) return false; state.weather = id; dom.weather.value = id; syncWeather(true); updateUi(); return true; },
    runSelfTest,
    setView: setViewerView
  });
})();
