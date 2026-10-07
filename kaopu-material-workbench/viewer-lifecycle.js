'use strict';
// Lifecycle only. Resolution, sampling, geometry, shaders and materials are unchanged.
window.KAOPU_CREATE_LIFECYCLE = function (hooks) {
  const canvas = hooks.canvas, requests = new AbortController();
  let gl = null, extension = null, disposed = false, contextLost = false;
  let losses = 0, restores = 0, timer = 0, paused = false;
  const notify = (phase, extra = {}) => canvas.dispatchEvent(new CustomEvent('kaopu-renderer-state', { detail: { phase, ...extra } }));
  const visible = () => !document.hidden;
  function notice(message, retry = false) {
    const box = document.getElementById('error');
    box.replaceChildren(document.createTextNode(message)); box.hidden = false;
    if (retry) { const button = document.createElement('button'); button.type = 'button'; button.textContent = '恢复这张画面'; button.style.cssText = 'display:block;margin:14px auto 0;padding:10px 16px'; button.onclick = () => requestRebuild(true); box.append(button); }
  }
  function requestRebuild(manual = false) {
    if (disposed || !contextLost || !visible()) return;
    hooks.save();
    if (parent !== window && new URLSearchParams(location.search).get('embedded') === '1') {
      parent.postMessage({ type: 'kaopu-viewer', action: 'recover', manual }, location.origin);
    } else if (manual) location.reload();
    notice('图形资源暂不可用，当前参数已保存。可恢复这张画面。', true);
  }
  function scheduleRebuild() {
    clearTimeout(timer);
    if (!disposed && contextLost && visible()) timer = setTimeout(() => requestRebuild(false), 2400);
  }
  function lost(event) {
    event.preventDefault();
    if (disposed) return;
    contextLost = true; losses++; hooks.save(); hooks.pause(); hooks.setReady(false);
    // Every WebGL handle and cached uniform location is invalid after context loss.
    hooks.clearGPU(false);
    notice('图形资源中断，正在恢复画面；当前参数已保留。', true);
    notify('lost'); scheduleRebuild();
  }
  function restored() {
    if (disposed) return;
    clearTimeout(timer);
    try {
      contextLost = false; hooks.rebuildGPU(); hooks.setReady(true); hooks.redraw();
      if (gl.isContextLost()) { contextLost = true; hooks.setReady(false); scheduleRebuild(); return; }
      restores++; document.getElementById('error').hidden = true;
      notify('restored'); if (visible()) hooks.resume();
    } catch (error) {
      contextLost = true; hooks.setReady(false);
      notice('画面尚未恢复，当前参数已保存。', true); scheduleRebuild();
    }
  }
  function visibility() {
    if (disposed) return;
    if (!visible()) { paused = true; clearTimeout(timer); hooks.save(); hooks.pause(); }
    else { paused = false; if (contextLost) scheduleRebuild(); else { hooks.invalidate(); hooks.resume(); } }
  }
  function pagehide(event) { if (event.persisted) { hooks.save(); hooks.pause(); } else dispose(); }
  function pageshow(event) { if (event.persisted && !disposed) visibility(); }
  function dispose() {
    if (disposed) return { disposed: true };
    hooks.save(); disposed = true; clearTimeout(timer); requests.abort(); hooks.pause(); hooks.setReady(false);
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', pagehide); window.removeEventListener('pageshow', pageshow);
    window.KAOPU_VIEWER_BRIDGE?.dispose();
    try { hooks.clearGPU(true); } catch {}
    // Khronos recommends loseContext to halt and release the underlying GPU context.
    const hadContext = !!gl;
    if (gl && !gl.isContextLost() && extension) { try { extension.loseContext(); } catch {} }
    const released = !gl || gl.isContextLost();
    canvas.width = 1; canvas.height = 1; extension = null; gl = null;
    return { disposed: true, hadContext, released };
  }
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', pagehide); window.addEventListener('pageshow', pageshow);
  const api = {
    signal: requests.signal,
    get disposed() { return disposed; },
    bind(context) { if (disposed) return false; gl = context; extension = gl.getExtension('WEBGL_lose_context'); return true; },
    dispose,
    diagnostics: () => ({ disposed, contextLost, losses, restores, paused, hasContext: !!gl, contextIsLost: !!gl?.isContextLost(), restoreExtension: !!extension, canvasPixels: canvas.width * canvas.height }),
    // Explicit test hook; uses the real browser extension, not a synthetic DOM event.
    testLoseContext() { if (extension && gl && !gl.isContextLost()) { extension.loseContext(); return true; } return false; },
    testRestoreContext() { if (extension && gl?.isContextLost()) { extension.restoreContext(); return true; } return false; }
  };
  window.KAOPU_VIEWER_LIFECYCLE = api;
  return api;
};
