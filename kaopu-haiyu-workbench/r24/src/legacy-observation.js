/* R24 observation adapter for the original native feather and function fish.
 * Requires the narrow generated-copy bridges from patch-legacy-{bundle,feather}.py.
 * Geometry, time, source inputs, and drag rotation remain owned by the originals.
 * The feather already has real normal-based lighting; only fish needs a shader.
 */
(() => {
  'use strict';
  const by = id => document.getElementById(id);
  const original = window.KaopuExperiment;
  const bridge = window.HaiyuLegacyFish;
  const featherBridge = window.HaiyuLegacyFeather;
  const canvas = by('expCanvas');
  const light = by('expLight');
  if (!original || !canvas || !light) return;

  const state = { active: false, kind: 'feather', fishNeutral: false, spinning: false };
  let spinFrame = 0, spinLast = null, pointerId = null;
  const cameraBridge = () => state.kind === 'fish' ? bridge : featherBridge;
  const initialCamera = () => state.kind === 'fish'
    ? { yaw: .4, pitch: .3, zoom: 1 }
    : { yaw: .58, pitch: .25, zoom: 1 };
  const tools = document.createElement('div');
  tools.id = 'expCameraTools';
  tools.className = 'scene-tools';
  tools.hidden = true;
  tools.setAttribute('role', 'group');
  tools.setAttribute('aria-label', '三维观察相机');
  const buttons = {};
  for (const [id, label, title] of [
    ['expSpin', '自动旋转', '自动环绕观察；不改变形态时间'],
    ['expManual', '手动', '停止自动旋转，可拖动画面或使用视角按钮'],
    ['expTopView', '顶视', '从上方观察'],
    ['expFrontView', '正视', '从正面观察'],
    ['expSideView', '侧视', '从侧面观察'],
    ['expBackView', '背视', '从背面观察'],
    ['expUp', '向上', '向上旋转视角'],
    ['expDown', '向下', '向下旋转视角'],
    ['expZoomIn', '放大', '放大观察'],
    ['expZoomOut', '缩小', '缩小观察']
  ]) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-controls', 'expCanvas');
    tools.append(button);
    buttons[id] = button;
  }
  const cameraStatus = document.createElement('span');
  cameraStatus.id = 'expCameraStatus';
  cameraStatus.className = 'quiet';
  tools.append(cameraStatus);
  canvas.parentElement.parentElement.insertBefore(tools, canvas.parentElement);

  function syncCamera() {
    const camera = cameraBridge()?.getCamera();
    buttons.expSpin.setAttribute('aria-pressed', String(state.spinning));
    buttons.expManual.setAttribute('aria-pressed', String(!state.spinning));
    const available = !!camera;
    for (const button of Object.values(buttons)) button.disabled = !available;
    cameraStatus.textContent = available
      ? `${state.spinning ? '自动环绕' : '手动观察'} · ${Math.round(camera.zoom * 100)}%`
      : '观察相机暂不可用';
    buttons.expZoomIn.disabled = !available || camera.zoom >= 2.25;
    buttons.expZoomOut.disabled = !available || camera.zoom <= .62;
    const panel = by('experiment');
    if (panel) {
      panel.dataset.cameraMode = state.spinning ? 'auto' : 'manual';
      panel.dataset.cameraAffectsGeneration = 'false';
    }
  }

  function stopSpin() {
    state.spinning = false;
    if (spinFrame) cancelAnimationFrame(spinFrame);
    spinFrame = 0;
    spinLast = null;
    syncCamera();
  }

  function spin(now) {
    spinFrame = 0;
    if (!state.active || !state.spinning || document.hidden) {
      stopSpin();
      return;
    }
    const current = cameraBridge()?.getCamera();
    if (!current) {
      stopSpin();
      return;
    }
    const elapsed = spinLast === null ? 0 : Math.min(.05, Math.max(0, (now - spinLast) / 1000));
    spinLast = now;
    cameraBridge().setCamera({ yaw: current.yaw + elapsed * .36 });
    // These bridges invalidate the view only. The original play buttons retain
    // exclusive ownership of time, geometry evaluation, and frame advancement.
    spinFrame = requestAnimationFrame(spin);
  }

  function setCamera(camera) {
    if (!state.active || !cameraBridge()) return;
    stopSpin();
    cameraBridge().cancelDrag();
    cameraBridge().setCamera(camera);
    syncCamera();
  }

  buttons.expSpin.addEventListener('click', () => {
    if (!state.active || !cameraBridge()) return;
    if (state.spinning) return stopSpin();
    cameraBridge().cancelDrag();
    state.spinning = true;
    spinLast = null;
    spinFrame = requestAnimationFrame(spin);
    syncCamera();
  });
  buttons.expManual.addEventListener('click', stopSpin);
  buttons.expTopView.addEventListener('click', () => setCamera({ yaw: 0, pitch: -Math.PI / 2 }));
  buttons.expFrontView.addEventListener('click', () => setCamera({ yaw: 0, pitch: 0 }));
  buttons.expSideView.addEventListener('click', () => setCamera({ yaw: Math.PI / 2, pitch: 0 }));
  buttons.expBackView.addEventListener('click', () => setCamera({ yaw: Math.PI, pitch: 0 }));
  for (const [id, field, update] of [
    ['expUp', 'pitch', value => value - Math.PI / 18],
    ['expDown', 'pitch', value => value + Math.PI / 18],
    ['expZoomIn', 'zoom', value => value * 1.15],
    ['expZoomOut', 'zoom', value => value / 1.15]
  ]) buttons[id].addEventListener('click', () => {
    const camera = cameraBridge()?.getCamera();
    if (camera) setCamera({ [field]: update(camera[field]) });
  });

  // Capture at the parent so R18's own target-level capture handler does not
  // bypass the shared reset/autorotation cancellation behavior.
  const reset = by('expView');
  reset?.parentElement.addEventListener('click', event => {
    if (!state.active || event.target !== reset) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setCamera(initialCamera());
  }, true);
  const normalize = v => {
    const length = Math.hypot(...v) || 1;
    return v.map(component => component / length);
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const warmDirection = normalize([-.78, .38, .58]);
  const coolDirection = normalize([.78, .20, .58]);
  const warmSpectrum = [1.45, .80, .43];
  const coolSpectrum = [.38, .77, 1.40];
  // Retain the original fish's teal material; the two lights supply the tint.
  const fishMaterial = [116, 171, 154];

  function viewNormal(normal, view, yaw, pitch) {
    const [x, y, z] = normalize(normal);
    if (view === 'top') return [x, z, y];
    if (view !== 'orbit') return [x, y, z];
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const xx = x * cy + z * sy, zz = -x * sy + z * cy;
    return [xx, y * cp - zz * sp, y * sp + zz * cp];
  }

  function shadeFish(normal, view, yaw, pitch) {
    let n = viewNormal(normal, view, yaw, pitch);
    // The original renderer shows both face sides; light the visible side.
    if (n[2] < 0) n = n.map(value => -value);
    if (state.fishNeutral) {
      const value = Math.round(103 + 93 * Math.max(0, n[2]));
      return `rgb(${value},${value},${value})`;
    }
    const warm = Math.max(0, dot(n, warmDirection));
    const cool = Math.max(0, dot(n, coolDirection));
    const rgb = fishMaterial.map((base, i) => Math.round(Math.min(255,
      base * (.25 + .90 * warm * warmSpectrum[i] + .75 * cool * coolSpectrum[i]))));
    return `rgb(${rgb.join(',')})`;
  }

  function syncFishLight() {
    light.hidden = false;
    light.textContent = state.fishNeutral ? '中性检查' : '冷暖光';
    light.setAttribute('aria-pressed', String(!state.fishNeutral));
    light.title = '左侧暖光 + 右侧冷光；再次点击切换中性结构检查';
    const panel = by('experiment');
    if (panel) {
      panel.dataset.lightMode = state.fishNeutral ? 'neutral' : 'warm-cool';
      panel.dataset.lightSource = 'face-normals';
      panel.dataset.cameraAffectsGeneration = 'false';
    }
  }

  window.HaiyuLegacyObservation = Object.freeze({
    shadeFish,
    getState: () => ({
      active: state.active,
      kind: state.kind,
      lightMode: state.kind === 'fish'
        ? (state.fishNeutral ? 'neutral' : 'warm-cool')
        : (light.getAttribute('aria-pressed') === 'true' ? 'warm-cool' : 'neutral'),
      fishBridgeAvailable: !!bridge,
      featherBridgeAvailable: !!featherBridge,
      spinning: state.spinning,
      camera: cameraBridge()?.getCamera() || null,
      cameraAffectsGeneration: false,
      fish: bridge?.getState() || null,
      feather: featherBridge?.getState() || null
    })
  });

  window.KaopuExperiment = {
    ...original,
    setActive(value, kind) {
      stopSpin();
      bridge?.cancelDrag();
      featherBridge?.cancelDrag();
      if (pointerId !== null && canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
      pointerId = null;
      state.active = !!value;
      state.kind = kind;
      if (value && kind === 'fish') state.fishNeutral = false;
      original.setActive(value, kind);
      tools.hidden = !value;
      if (!value) return;
      canvas.style.touchAction = 'none';
      canvas.style.cursor = 'grab';
      if (kind === 'feather') {
        // R18 configure() initializes its own warm/cool shader and drag camera.
        light.hidden = false;
        light.title = '暖主光 + 冷辅光；再次点击切换中性结构检查';
        const panel = by('experiment');
        if (panel) {
          delete panel.dataset.lightMode;
          delete panel.dataset.lightSource;
        }
      } else if (kind === 'fish' && bridge) {
        bridge.setSurface(true);
        syncFishLight();
        by('sceneHint').textContent = '拖动旋转 · 左暖右冷 · 相机与灯光只负责观察';
        canvas.setAttribute('aria-label', '原函数鱼与全部鱼鳍：拖动旋转，左暖右冷面光照');
        bridge.invalidate();
      }
      syncCamera();
    }
  };

  light.addEventListener('click', event => {
    if (!state.active || state.kind !== 'fish' || !bridge) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    state.fishNeutral = !state.fishNeutral;
    syncFishLight();
    bridge.invalidate();
  }, true);

  canvas.addEventListener('pointerdown', event => {
    if (!state.active) return;
    pointerId = event.pointerId;
    stopSpin();
  }, true);
  canvas.addEventListener('pointermove', () => { if (state.active) syncCamera(); });
  canvas.addEventListener('pointerup', () => { pointerId = null; });
  canvas.addEventListener('pointercancel', () => { pointerId = null; });
  canvas.addEventListener('wheel', event => {
    if (!state.active) return;
    stopSpin();
    // Native feather already owns wheel zoom. Fish gains the same range here.
    if (state.kind === 'fish' && bridge) {
      event.preventDefault();
      const camera = bridge.getCamera();
      bridge.setCamera({ zoom: camera.zoom * Math.exp(-event.deltaY * .001) });
    }
    syncCamera();
  }, { passive: false });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpin(); });
  window.addEventListener('blur', stopSpin);

  // Let the original handlers clear drag state even when capture is interrupted.
  canvas.addEventListener('lostpointercapture', () => {
    if (state.active) canvas.dispatchEvent(new Event('pointercancel'));
  });
})();
