/** Never label the frozen default PNG as a newly edited source-parameter variant. */
export function previewIdentity(id, sessions) {
  return id.split('-').map(member => {
    const p = sessions.get(member);
    return [member, p?.binding?.parameterRequestSHA256 || null, p?.binding?.materialSHA256 || null];
  });
}
export function hasSessionVariant(id, sessions) {
  return previewIdentity(id, sessions).some(([, request]) => request !== null);
}
export function previewKey(id, sessions) { return JSON.stringify([id, previewIdentity(id, sessions)]); }
export function sessionStatus(id, sessions, inherited) {
  const p = sessions.get(id);
  if (!p?.record) return inherited;
  return {kind: p.record.staticGate?.passed ? 'static-pass' : 'needs-repair', hasResult: true,
    label: p.binding.parameterRequestSHA256 ? '当前参数变体 · ' + (p.record.staticGate?.passed ? '静态通过' : '需修复') : inherited.label,
    reason: p.record.staticGate?.passed ? '此参数结果通过静态检查；不是面料物理或动态穿着认证。' :
      '此参数的真实结果未通过：' + (p.record.staticGate?.failures?.join('、') || '缺少完整检查记录')};
}

/** Capturing a card must never destroy a valid native solver result. */
export function captureNativePreview({viewer,canvas,key,previews}) {
  const result={captured:false,cameraRestored:false};let saved=null;
  try {
    saved=viewer.cameraState();viewer.view('three');viewer.render();
    const url=canvas.toDataURL('image/png');
    if(typeof url!=='string'||!url.startsWith('data:image/png;')||url.length<30)throw Error('原渲染器未返回有效预览');
    previews.set(key,url);result.captured=true;
  } catch(error) {
    previews.delete(key);result.reason=error?.message||String(error);
  } finally {
    if(saved!==null){try{viewer.restoreCamera(saved);result.cameraRestored=true}catch(error){result.cameraRestoreError=error?.message||String(error);}}
  }
  return result;
}
