const canvas = document.querySelector('#teacherCanvas');
const statusEl = document.querySelector('#status');
const errorEl = document.querySelector('#error');
const playButton = document.querySelector('#play');
const restartButton = document.querySelector('#restart');
const fullscreenButton = document.querySelector('#fullscreen');

const REFERENCE_WIDTH = 960;
const REFERENCE_HEIGHT = 540;
const EMBEDDED = window.parent !== window;
canvas.width = REFERENCE_WIDTH;
canvas.height = REFERENCE_HEIGHT;

let gl;
let program;
let startTime = performance.now();
let pauseStartedAt = startTime;
let accumulatedPause = 0;
let playing = !EMBEDDED;
let needsRender = true;
let frameCount = 0;
let lastFpsSample = performance.now();
let lastFpsFrame = 0;

function fail(message, detail = '') {
  errorEl.hidden = false;
  errorEl.textContent = detail ? `${message}\n${detail}` : message;
  statusEl.textContent = '未通过：WebGL2 / Shader 编译失败';
  throw new Error(detail || message);
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Unknown shader compiler error';
    gl.deleteShader(shader);
    fail('老师 Shader 编译失败。', log);
  }
  return shader;
}

function linkProgram(vertexSource, fragmentSource) {
  const vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  const linked = gl.createProgram();
  gl.attachShader(linked, vertex);
  gl.attachShader(linked, fragment);
  gl.linkProgram(linked);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(linked) || 'Unknown program linker error';
    gl.deleteProgram(linked);
    fail('老师 Shader 链接失败。', log);
  }
  return linked;
}

function updatePlaybackUi() {
  playButton.textContent = playing ? '暂停' : '继续';
  playButton.setAttribute('aria-pressed', playing ? 'false' : 'true');
  const mode = EMBEDDED ? '嵌入省算力' : '独立老师';
  statusEl.textContent = `老师锁定 · 960×540 · SPEED = iTime × 0.3 · ${playing ? '播放' : '暂停'} · ${mode}`;
}

function setPlaying(next) {
  const now = performance.now();
  const wanted = Boolean(next);
  if (wanted === playing) {
    needsRender = true;
    updatePlaybackUi();
    return;
  }
  if (wanted) {
    accumulatedPause += now - pauseStartedAt;
    playing = true;
  } else {
    pauseStartedAt = now;
    playing = false;
  }
  needsRender = true;
  updatePlaybackUi();
}

function restartTeacher() {
  const now = performance.now();
  startTime = now;
  accumulatedPause = 0;
  pauseStartedAt = now;
  needsRender = true;
}

async function boot() {
  gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  if (!gl) fail('当前浏览器没有可用的 WebGL2。');

  const teacherSource = await fetch('./teacher-original.glsl', { cache: 'no-store' }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }).catch((error) => fail('老师源码加载失败。', String(error)));

  const vertexSource = `#version 300 es
  precision highp float;
  const vec2 P[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  void main(){ gl_Position = vec4(P[gl_VertexID],0.0,1.0); }`;

  const fragmentSource = `#version 300 es
  precision highp float;
  precision highp int;
  uniform vec3 iResolution;
  uniform float iTime;
  out vec4 fragColor;
  ${teacherSource}
  void main(){ mainImage(fragColor, gl_FragCoord.xy); }`;

  program = linkProgram(vertexSource, fragmentSource);
  gl.useProgram(program);
  gl.viewport(0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 1);

  const resolutionLocation = gl.getUniformLocation(program, 'iResolution');
  const timeLocation = gl.getUniformLocation(program, 'iTime');
  gl.uniform3f(resolutionLocation, REFERENCE_WIDTH, REFERENCE_HEIGHT, 1);

  window.__kukoDay123Ready = true;
  window.KuKoDay123Teacher = {
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    restart: restartTeacher,
    getState: () => ({ playing, embedded: EMBEDDED, width: REFERENCE_WIDTH, height: REFERENCE_HEIGHT })
  };
  document.documentElement.dataset.ready = 'true';
  updatePlaybackUi();

  function draw(now) {
    if (playing || needsRender) {
      const elapsedMs = playing
        ? now - startTime - accumulatedPause
        : pauseStartedAt - startTime - accumulatedPause;
      gl.uniform1f(timeLocation, Math.max(0, elapsedMs) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frameCount += 1;
      needsRender = false;
    }

    if (playing && now - lastFpsSample > 1500) {
      const fps = ((frameCount - lastFpsFrame) * 1000) / (now - lastFpsSample);
      statusEl.textContent = `老师锁定 · 960×540 · SPEED = iTime × 0.3 · 播放 · ${fps.toFixed(1)} FPS`;
      lastFpsSample = now;
      lastFpsFrame = frameCount;
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

playButton.addEventListener('click', () => setPlaying(!playing));
restartButton.addEventListener('click', restartTeacher);

window.addEventListener('message', (event) => {
  if (event.source !== window.parent || !event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'KAOPU_KUKO_PLAY') setPlaying(Boolean(event.data.playing));
  if (event.data.type === 'KAOPU_KUKO_RESTART') restartTeacher();
});

fullscreenButton.addEventListener('click', async () => {
  const target = document.querySelector('#teacherFrame');
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await target.requestFullscreen();
  } catch (error) {
    errorEl.hidden = false;
    errorEl.textContent = `全屏请求失败：${String(error)}`;
  }
});

boot().catch((error) => {
  if (errorEl.hidden) {
    errorEl.hidden = false;
    errorEl.textContent = String(error?.stack || error);
  }
});
