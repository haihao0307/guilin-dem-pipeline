/* R23 observation adapter for the original native feather and function fish.
 * Requires the narrow generated-bundle bridge from patch-legacy-bundle.py.
 * Geometry, time, source inputs, and drag rotation remain owned by the originals.
 * The feather already has real normal-based lighting; only fish needs a shader.
 */
(() => {
  'use strict';
  const by = id => document.getElementById(id);
  const original = window.KaopuExperiment;
  const bridge = window.HaiyuLegacyFish;
  const canvas = by('expCanvas');
  const light = by('expLight');
  if (!original || !canvas || !light) return;

  const state = { active: false, kind: 'feather', fishNeutral: false };
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
      cameraAffectsGeneration: false,
      fish: bridge?.getState() || null
    })
  });

  window.KaopuExperiment = {
    ...original,
    setActive(value, kind) {
      state.active = !!value;
      state.kind = kind;
      if (value && kind === 'fish') state.fishNeutral = false;
      original.setActive(value, kind);
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

  // Let the original handlers clear drag state even when capture is interrupted.
  canvas.addEventListener('lostpointercapture', () => {
    if (state.active) canvas.dispatchEvent(new Event('pointercancel'));
  });
})();
