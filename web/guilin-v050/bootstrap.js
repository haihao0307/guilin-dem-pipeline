const errorCard = document.querySelector('#errorCard');
const errorText = document.querySelector('#errorText');
const loadingText = document.querySelector('#loadingText');

const SOURCE_REPLACEMENTS = [
  {
    find: 'state.showWater?.35*state.waterLevel:0',
    replace: '(state.showWater ? .35 * state.waterLevel : 0)',
    reason: 'fix invalid conditional expression in ground and water collision clearance',
  },
  {
    find: 'gl_PointSize=clamp(px*1.40,1.0,248.0)*keep;',
    replace: 'gl_PointSize=clamp(px*.78,1.0,72.0)*keep;',
    reason: 'cap far and medium canopy billboards before they become giant near-ground discs',
  },
  {
    find: 'vFade=keep*smoothstep(.65,2.1,px)*(1.0-smoothstep(2750.0,5200.0,dist));',
    replace: 'vFade=keep*smoothstep(.65,2.1,px)*smoothstep(70.0,220.0,dist)*(1.0-smoothstep(2750.0,5200.0,dist));',
    reason: 'fade medium-distance canopy billboards out before the ground-observer range',
  },
  {
    find: 'vAlpha=keep*(1.0-smoothstep(1200.0,3600.0,dist))*(1.0-shrub*.92);',
    replace: 'vAlpha=keep*smoothstep(35.0,120.0,dist)*(1.0-smoothstep(1200.0,3600.0,dist))*(1.0-shrub*.92);',
    reason: 'fade temporary line-trunk cues before immediate ground range',
  },
  {
    find: 'gl_PointSize=clamp(px,1.0,42.0)*keep;',
    replace: 'gl_PointSize=clamp(px,1.0,18.0)*keep;',
    reason: 'cap rice billboards pending bounded near-geometry replacement',
  },
  {
    find: 'vFade=keep*smoothstep(1.1,3.2,px)*(1.0-smoothstep(1150.0,2100.0,dist));',
    replace: 'vFade=keep*smoothstep(1.1,3.2,px)*smoothstep(4.0,16.0,dist)*(1.0-smoothstep(1150.0,2100.0,dist));',
    reason: 'fade rice billboards at immediate camera range',
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
    nearGeometryStatus: 'medium billboards and line trunks capped; procedural near geometry remains a release blocker',
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
