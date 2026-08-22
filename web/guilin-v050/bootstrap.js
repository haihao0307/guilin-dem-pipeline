const errorCard = document.querySelector('#errorCard');
const errorText = document.querySelector('#errorText');
const loadingText = document.querySelector('#loadingText');

const SOURCE_REPLACEMENTS = [
  {
    find: 'state.showWater?.35*state.waterLevel:0',
    replace: '(state.showWater ? .35 * state.waterLevel : 0)',
    reason: 'fix invalid conditional expression in ground and water collision clearance',
  },
];

function showFatal(error) {
  console.error(error);
  if (errorText) errorText.textContent = error instanceof Error ? error.message : String(error);
  if (errorCard) errorCard.classList.add('show');
  if (loadingText) loadingText.textContent = '恢复候选启动失败，已阻止继续运行';
}

async function startRecoveryRuntime() {
  const response = await fetch('./runtime.js', { cache: 'no-store' });
  if (!response.ok) throw new Error(`runtime.js HTTP ${response.status}`);
  let source = await response.text();
  const applied = [];
  for (const replacement of SOURCE_REPLACEMENTS) {
    if (!source.includes(replacement.find)) continue;
    source = source.replaceAll(replacement.find, replacement.replace);
    applied.push(replacement.reason);
  }
  if (source.includes('state.showWater?.35*state.waterLevel:0')) {
    throw new Error('运行时相机碰撞表达式仍然无效');
  }
  window.__GUILIN_RECOVERY_BOOTSTRAP__ = {
    applied,
    publicationBlocked: true,
    source: 'web/guilin-v050/runtime.js',
  };
  const blob = new Blob([`${source}\n//# sourceURL=guilin-v050-runtime-recovered.js`], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

startRecoveryRuntime().catch(showFatal);
