const body = document.body;
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const workbenchState = document.querySelector('#workbenchState');
const manifestStatus = document.querySelector('#manifestStatus');
const treeFrame = document.querySelector('#treeFrame');
const teacherFrame = document.querySelector('#teacherFrame');

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

function setMode(mode) {
  body.dataset.mode = mode;
  for (const button of modeButtons) {
    button.classList.toggle('on', button.dataset.mode === mode);
  }
  try { localStorage.setItem('kaopu-fractal-tree-mode', mode); } catch (_) {}
}

for (const button of modeButtons) {
  button.addEventListener('click', () => setMode(button.dataset.mode));
}

const storedMode = (() => {
  try { return localStorage.getItem('kaopu-fractal-tree-mode'); } catch (_) { return null; }
})();
if (storedMode && ['tree','teacher','compare','map'].includes(storedMode)) {
  setMode(storedMode);
} else if (matchMedia('(max-width: 980px)').matches) {
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

let manifestReady = false;
let treeReady = false;
let teacherReady = false;

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
  const parts = [
    treeReady ? '树母台已就绪' : '树母台加载中',
    teacherReady ? 'KuKo 老师已就绪' : 'KuKo 老师加载中',
    manifestReady ? '知识桥已登记' : '知识桥加载中'
  ];
  workbenchState.textContent = parts.join(' · ');
  const ready = treeReady && teacherReady && manifestReady;
  window.__fractalTreeWorkbenchReady = ready;
  document.documentElement.dataset.ready = ready ? 'true' : 'false';
}

treeFrame.addEventListener('load', updateReadyState);
teacherFrame.addEventListener('load', updateReadyState);
loadManifest().finally(updateReadyState);
setInterval(updateReadyState, 1000);
