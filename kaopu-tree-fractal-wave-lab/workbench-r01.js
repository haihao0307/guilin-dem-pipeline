const body = document.body;
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const workbenchState = document.querySelector('#workbenchState');
const manifestStatus = document.querySelector('#manifestStatus');
const treeFrame = document.querySelector('#treeFrame');
const teacherFrame = document.querySelector('#teacherFrame');
const liftFrame = document.querySelector('#liftFrame');

const teachers = {
  C: {
    name: 'tree()', total: 2187, depth: 7, br: 3,
    labels: [
      '0 · posR + 短步进：左转声部',
      '1 · wind0 + negR：带相位的右转声部',
      '2 · wind1 + 直行：带相位的长步进声部'
    ]
  },
  L: {
    name: 'treeL()', total: 729, depth: 6, br: 3,
    labels: [
      '0 · wind0 + negR：带相位的右转声部',
      '1 · posR：左转长步进声部',
      '2 · wind1 + negR：第二相位右转声部'
    ]
  },
  R: {
    name: 'treeR()', total: 1024, depth: 5, br: 4,
    labels: [
      '0 · posR：左转短步进声部',
      '1 · wind0 + negR：第一相位右转声部',
      '2 · wind1 + 直行：第二相位长步进声部',
      '3 · posR 包夹位移：第四分枝声部'
    ]
  }
};

let currentMode = body.dataset.mode || 'tree';
let manifestReady = false;
let treeReady = false;
let teacherReady = false;
let liftReady = false;

function setTeacherPlayback(playing) {
  try {
    teacherFrame.contentWindow?.postMessage({
      type: 'KAOPU_KUKO_PLAY',
      playing: Boolean(playing)
    }, location.origin);
  } catch (_) {}
}

function applyPlaybackPolicy() {
  // Teacher-only mode may animate. Tree, compare and map keep the exact teacher
  // frame visible but frozen, so the heavy shader does not compete with the 3D tree.
  setTeacherPlayback(currentMode === 'teacher');
}

function setMode(mode) {
  currentMode = mode;
  body.dataset.mode = mode;
  for (const button of modeButtons) {
    button.classList.toggle('on', button.dataset.mode === mode);
  }
  applyPlaybackPolicy();
  try { localStorage.setItem('kaopu-fractal-tree-mode', mode); } catch (_) {}
  updateReadyState();
}

for (const button of modeButtons) {
  button.addEventListener('click', () => setMode(button.dataset.mode));
}

const storedMode = (() => {
  try { return localStorage.getItem('kaopu-fractal-tree-mode'); } catch (_) { return null; }
})();
if (storedMode && ['tree','teacher','compare','lift','map'].includes(storedMode)) {
  setMode(storedMode);
} else {
  setMode('tree');
}

const teacherSelect = document.querySelector('#teacherSelect');
const branchIndex = document.querySelector('#branchIndex');
const branchValue = document.querySelector('#branchValue');
const teacherMeta = document.querySelector('#teacherMeta');
const pathDigits = document.querySelector('#pathDigits');
const decoderNote = document.querySelector('#decoderNote');

function decodePath(config, c) {
  const digits = [];
  let off = config.total;
  for (let i = 1; i <= config.depth; i += 1) {
    off = Math.floor(off / config.br);
    const dec = Math.floor(c / off);
    const path = dec - config.br * Math.floor(dec / config.br);
    digits.push(path);
  }
  return digits;
}

function digitClass(config, digit) {
  const text = config.labels[digit] || '';
  if (text.includes('wind')) return 'digit wind';
  if (text.includes('转') || text.includes('posR') || text.includes('negR')) return 'digit turn';
  return 'digit';
}

function renderDecoder() {
  const config = teachers[teacherSelect.value];
  branchIndex.max = String(config.total - 1);
  const c = Math.min(Number(branchIndex.value), config.total - 1);
  branchIndex.value = String(c);
  branchValue.textContent = String(c);
  teacherMeta.textContent = `BR ${config.br} · DEPTH ${config.depth} · TOTAL ${config.total}`;
  const digits = decodePath(config, c);
  pathDigits.replaceChildren(...digits.map((digit, index) => {
    const el = document.createElement('span');
    el.className = digitClass(config, digit);
    el.textContent = String(digit);
    el.title = `第 ${index + 1} 层：${config.labels[digit]}`;
    return el;
  }));
  const explanation = digits.map((digit, index) => `${index + 1}层→${config.labels[digit]}`).join('；');
  decoderNote.textContent = `${config.name} 的枝号 ${c} 被解码为 [${digits.join(', ')}]。${explanation}。这证明我们已把老师的路径寻址拆成可调用声部；它仍然只是二维老师的语法地址，不冒充三维枝条半径或受力。`;
}

teacherSelect.addEventListener('change', () => {
  branchIndex.value = '0';
  renderDecoder();
});
branchIndex.addEventListener('input', renderDecoder);
renderDecoder();

async function loadManifest() {
  try {
    const response = await fetch('./INTEGRATION_MANIFEST_R01.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    manifestReady = manifest.schema === 'KAOPU.fractal-wave.tree-workbench/1';
    manifestStatus.textContent = manifestReady
      ? `综合清单已加载：${manifest.learnedVoices.length} 个 KuKo 声部，${manifest.treeKnowledgeKept.length} 条树生命知识。`
      : '综合清单格式不匹配。';
  } catch (error) {
    manifestStatus.textContent = `综合清单加载失败：${String(error)}`;
  }
}

function childReady(frame, marker) {
  try {
    return Boolean(frame.contentWindow && frame.contentWindow[marker]);
  } catch (_) {
    return false;
  }
}

function updateReadyState() {
  treeReady = childReady(treeFrame, '__treeReady');
  teacherReady = childReady(teacherFrame, '__kukoDay123Ready');
  liftReady = childReady(liftFrame, '__kuko3dLiftReady');
  if (teacherReady) applyPlaybackPolicy();
  const teacherMotion = currentMode === 'teacher' ? '老师动画开启' : '老师冻结帧省算力';
  const parts = [
    treeReady ? '树母台已就绪' : '树母台加载中',
    teacherReady ? `KuKo 老师已就绪（${teacherMotion}）` : 'KuKo 老师加载中',
    liftReady ? '三维 Lift 已就绪' : '三维 Lift 加载中',
    manifestReady ? '知识桥已登记' : '知识桥加载中'
  ];
  workbenchState.textContent = parts.join(' · ');
  const ready = treeReady && teacherReady && liftReady && manifestReady;
  window.__fractalTreeWorkbenchReady = ready;
  window.FractalWaveTreeWorkbenchR01 = {
    setMode,
    decodePath: (teacherId, branchId) => decodePath(teachers[teacherId], branchId),
    getState: () => ({ mode: currentMode, treeReady, teacherReady, liftReady, manifestReady })
  };
  document.documentElement.dataset.ready = ready ? 'true' : 'false';
}

treeFrame.addEventListener('load', updateReadyState);
teacherFrame.addEventListener('load', () => {
  updateReadyState();
  applyPlaybackPolicy();
});
liftFrame.addEventListener('load', updateReadyState);
loadManifest().finally(updateReadyState);
setInterval(updateReadyState, 1000);
