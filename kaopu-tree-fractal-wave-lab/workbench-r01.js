var clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const body = document.body;

function installVideoTeacherProof() {
  const style = document.createElement('style');
  style.textContent = `
    .proof-view{display:none;min-height:calc(100vh - 158px);border:1px solid var(--line);border-radius:9px;overflow:hidden;background:#08100f}
    .proof-toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid var(--line);background:#111918}
    .proof-toolbar button{border:1px solid #43534f;background:#17201f;color:#dce6e2;border-radius:7px;padding:8px 11px;min-height:38px;cursor:pointer}
    .proof-toolbar button.on{background:#3d564c;border-color:#91ad9f}
    .proof-toolbar .proof-spacer{flex:1}
    .proof-toolbar label{font-size:10px;color:#9eaca7;display:flex;align-items:center;gap:8px;min-width:190px}
    .proof-toolbar input{accent-color:var(--accent);width:150px}
    .proof-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;min-height:720px}
    .proof-stage{position:relative;min-height:720px;background:radial-gradient(circle at 50% 40%,#172724,#07100f 72%)}
    .proof-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
    .proof-caption{position:absolute;z-index:3;left:14px;top:14px;max-width:650px;font-size:10px;color:#aab8b3;pointer-events:none;text-shadow:0 1px 8px #000}
    .proof-caption b{display:block;font-size:14px;color:#f2f7f4;margin-bottom:3px}
    .proof-info{position:absolute;z-index:3;left:14px;bottom:12px;font-size:9px;color:#9eb0aa;pointer-events:none}
    .proof-panel{border-left:1px solid var(--line);background:#101817;padding:17px 18px 25px;overflow:auto}
    .proof-panel h2{font-size:15px;margin:0 0 5px}.proof-panel>p{font-size:10px;color:#96a39f;margin:0 0 13px}
    .proof-gate{border:1px solid #344540;border-radius:8px;background:#0e1615;padding:10px 11px;font-size:10px;color:#aebbb6;line-height:1.7}
    .proof-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:13px 0}.proof-metric{border:1px solid #30413d;border-radius:7px;padding:9px;background:#121b1a}.proof-metric b{display:block;font-size:15px}.proof-metric span{font-size:9px;color:#8f9d98}
    .proof-status{border-top:1px solid var(--line);padding-top:12px;font-size:10px;color:#a5b9b1;line-height:1.7}
    body[data-mode="videoproof"] .frames,body[data-mode="videoproof"] .map-view{display:none}
    body[data-mode="videoproof"] .proof-view{display:block}
    body[data-mode="videoproof"] .shell{grid-template-columns:1fr}
    body[data-mode="videoproof"] .side{display:none}
    body[data-mode="videoproof"] .workspace{padding:8px}
    @media(max-width:900px){.proof-layout{grid-template-columns:1fr}.proof-panel{border-left:0;border-top:1px solid var(--line)}.proof-stage{min-height:64svh}}
    @media(max-width:620px){.proof-toolbar{padding:8px}.proof-toolbar button{padding:7px 8px;font-size:11px}.proof-toolbar label{width:100%}.proof-toolbar input{flex:1}.proof-layout{min-height:620px}.proof-stage{min-height:58svh}.proof-panel{padding:14px}}
  `;
  document.head.appendChild(style);

  const toolbar = document.querySelector('.toolbar');
  const mapButton = toolbar?.querySelector('[data-mode="map"]');
  const proofButton = document.createElement('button');
  proofButton.dataset.mode = 'videoproof';
  proofButton.textContent = '视频老师验证';
  if (mapButton) toolbar.insertBefore(proofButton, mapButton);
  else toolbar?.appendChild(proofButton);

  const workspace = document.querySelector('.workspace');
  const proof = document.createElement('section');
  proof.className = 'proof-view';
  proof.id = 'videoTeacherProofView';
  proof.innerHTML = `
    <div class="proof-toolbar">
      <button data-proof-score="tree" class="on">树线解释</button>
      <button data-proof-score="coral">珊瑚解释</button>
      <span class="proof-spacer"></span>
      <button data-proof-stage="targets" class="on">① 目标包络</button>
      <button data-proof-stage="skeleton">② 阶段骨架</button>
      <button data-proof-stage="thickness">③ 厚度反传</button>
      <button data-proof-stage="surface">④ 末端表面</button>
      <button id="videoTeacherPlay">播放生长</button>
      <button id="videoTeacherFit">适配视野</button>
      <label>生长历史 <input id="videoTeacherGrowth" type="range" min="0" max="1" step=".005" value="1"><output id="videoTeacherGrowthValue">100%</output></label>
    </div>
    <div class="proof-layout">
      <div class="proof-stage" id="videoTeacherProofStage">
        <div class="proof-caption"><b>不是汇报“学会了”，而是把老师知识分层演奏出来</b>同一套引擎分别接受树线体积冠层与珊瑚近二维扇面 Score。目标包络、骨架、粗细和末端表面逐层出现，任何阶段都不允许大规模回头、打结或把点云直接连成枝条。</div>
        <div class="proof-info" id="videoTeacherProofInfo">正在建立老师验证…</div>
      </div>
      <aside class="proof-panel">
        <h2>Teacher Proof 验收</h2>
        <p>这一区直接长在原来的综合工作台里，不是另建工作台。老师视频只证明方法类别，不冒充原作者源码。</p>
        <div class="proof-gate">✓ 先定义 Target / Envelope<br>✓ 再生成有父子关系的阶段骨架<br>✓ 拓扑完成后才反传粗细<br>✓ 末端组织和统一材质最后加入<br>✓ 树与珊瑚共用乐器、分开 Score<br>✓ 相机只观察，不参与生成</div>
        <div class="proof-metrics">
          <div class="proof-metric"><b id="videoTeacherTargetValue">--</b><span>目标样本</span></div>
          <div class="proof-metric"><b id="videoTeacherSegmentValue">--</b><span>结构段</span></div>
          <div class="proof-metric"><b id="videoTeacherTerminalValue">--</b><span>末端组织区</span></div>
          <div class="proof-metric"><b>4</b><span>可独立验收阶段</span></div>
        </div>
        <div class="proof-status" id="videoTeacherProofStatus">等待老师演奏…</div>
      </aside>
    </div>`;
  workspace?.appendChild(proof);

  const moduleScript = document.createElement('script');
  moduleScript.type = 'module';
  moduleScript.src = './teacher-proof-r01.js';
  document.body.appendChild(moduleScript);
}

installVideoTeacherProof();

const modeButtons = [...document.querySelectorAll('[data-mode]')];
const workbenchState = document.querySelector('#workbenchState');
const manifestStatus = document.querySelector('#manifestStatus');
const treeFrame = document.querySelector('#treeFrame');
const teacherFrame = document.querySelector('#teacherFrame');
const liftFrame = document.querySelector('#liftFrame');
const nativeFrame = document.querySelector('#nativeFrame');
const native3Frame = document.querySelector('#native3Frame');

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

let currentMode = body.dataset.mode || 'videoproof';
let manifestReady = false;
let treeReady = false;
let teacherReady = false;
let liftReady = false;
let nativeReady = false;
let native3Ready = false;
let videoProofReady = false;

function setTeacherPlayback(playing) {
  try {
    teacherFrame.contentWindow?.postMessage({
      type: 'KAOPU_KUKO_PLAY',
      playing: Boolean(playing)
    }, location.origin);
  } catch (_) {}
}

function applyPlaybackPolicy() {
  setTeacherPlayback(currentMode === 'teacher');
}

function setMode(mode) {
  currentMode = mode;
  body.dataset.mode = mode;
  for (const button of modeButtons) {
    button.classList.toggle('on', button.dataset.mode === mode);
  }
  applyPlaybackPolicy();
  try { localStorage.setItem('kaopu-fractal-tree-mode-r03-proof', mode); } catch (_) {}
  updateReadyState();
}

for (const button of modeButtons) {
  button.addEventListener('click', () => setMode(button.dataset.mode));
}

const storedMode = (() => {
  try { return localStorage.getItem('kaopu-fractal-tree-mode-r03-proof'); } catch (_) { return null; }
})();
if (storedMode && ['tree','teacher','compare','lift','native','native3','nativecompare3','videoproof','map'].includes(storedMode)) {
  setMode(storedMode);
} else {
  setMode('videoproof');
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
      ? `综合清单已加载：${manifest.learnedVoices.length} 个声部，${manifest.treeKnowledgeKept.length} 条树生命知识；视频老师验证已登记。`
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
  nativeReady = childReady(nativeFrame, '__native3dR02Ready');
  native3Ready = childReady(native3Frame, '__native3dR03Ready');
  videoProofReady = Boolean(window.__videoTeacherProofReady);
  if (teacherReady) applyPlaybackPolicy();
  const teacherMotion = currentMode === 'teacher' ? '老师动画开启' : '老师冻结帧省算力';
  const parts = [
    videoProofReady ? '视频老师验证已就绪' : '视频老师验证加载中',
    treeReady ? '树母台已就绪' : '树母台加载中',
    teacherReady ? `KuKo 老师已就绪（${teacherMotion}）` : 'KuKo 老师加载中',
    liftReady ? '三维 Lift 已就绪' : '三维 Lift 加载中',
    nativeReady ? 'Native 3D R02 已就绪' : 'Native 3D R02 加载中',
    native3Ready ? 'Native 3D R03 总台已就绪' : 'Native 3D R03 加载中',
    manifestReady ? '知识桥已登记' : '知识桥加载中'
  ];
  workbenchState.textContent = parts.join(' · ');
  const ready = treeReady && teacherReady && liftReady && nativeReady && native3Ready && videoProofReady && manifestReady;
  window.__fractalTreeWorkbenchReady = ready;
  const api = {
    setMode,
    decodePath: (teacherId, branchId) => decodePath(teachers[teacherId], branchId),
    setVideoTeacherStage: stage => window.VideoTeacherProofR01?.setStage(stage),
    setVideoTeacherScore: score => window.VideoTeacherProofR01?.setScore(score),
    getState: () => ({ mode: currentMode, treeReady, teacherReady, liftReady, nativeReady, native3Ready, videoProofReady, manifestReady, videoProof: window.VideoTeacherProofR01?.getState?.() || null })
  };
  window.FractalWaveTreeWorkbenchR01 = api;
  window.FractalWaveTreeWorkbenchR03 = api;
  document.documentElement.dataset.ready = ready ? 'true' : 'false';
}

treeFrame.addEventListener('load', updateReadyState);
teacherFrame.addEventListener('load', () => {
  updateReadyState();
  applyPlaybackPolicy();
});
liftFrame.addEventListener('load', updateReadyState);
nativeFrame.addEventListener('load', updateReadyState);
native3Frame.addEventListener('load', updateReadyState);
loadManifest().finally(updateReadyState);
setInterval(updateReadyState, 700);
