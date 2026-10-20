import * as THREE from 'three';
import {MaterialLighting} from './upstream/lighting.mjs';
import {installCoverageAntialias} from './upstream/coverage-antialias.mjs';
import {installFacePassRouting} from './upstream/face-pass-routing.mjs';
import {modelIdentity} from './upstream/source-contract.mjs';
import {loadPerson as loadFrozenPerson} from './upstream/person/load-person.mjs';

// The original public runtime is initialized in this document by build.py.
// This adapter takes ownership of that exact viewer; it creates no second body.
const SOURCE_REVISION = 'd413d108704af47cf531ee8c25d93f682c3176e3';

// A render request made while transferring the canvas/lighting is not a new
// visual state that needs presenting. Keep the exact native draw closure, but
// defer presentation until the host application has built the complete outfit.
// The application can wrap this stable delegate before releasing the hold.
function deferNativeDrawing(viewer, bootTimings) {
  const nativeDraw = viewer.render.bind(viewer);
  let suspended = true;
  const stats = {deferredRequests: 0, nativeDrawCalls: 0, nativeDrawSubmitMS: 0,
    lastNativeDrawSubmitMS: null, firstNativeDrawSubmitMS: null, releasedAtMS: null};
  viewer.render = (...args) => {
    if (suspended) {stats.deferredRequests++; return;}
    const began = performance.now();
    try {return nativeDraw(...args);}
    finally {
      const elapsed = performance.now() - began;
      stats.nativeDrawCalls++;
      stats.nativeDrawSubmitMS += elapsed;
      stats.lastNativeDrawSubmitMS = elapsed;
      stats.firstNativeDrawSubmitMS ??= elapsed;
    }
  };
  const audit = () => ({...stats, suspended,
    policy: 'Hold intermediate preparation frames; the original native draw is unchanged',
    geometryChanged: false, materialsChanged: false,
    timingScope: 'CPU draw invocation including synchronous WebGL waits; GPU completion is reported by the original frame gate'});
  bootTimings.presentation = stats;
  return {
    release() {
      if (suspended) {suspended = false; stats.releasedAtMS = performance.now() - bootTimings.startedAt;}
      return audit();
    },
    suspended: () => suspended,
    audit
  };
}

function yUp(nativePositions) {
  const result = new Float32Array(nativePositions.length);
  for (let i = 0; i < nativePositions.length; i += 3) {
    result[i] = nativePositions[i];
    result[i + 1] = nativePositions[i + 2];
    result[i + 2] = -nativePositions[i + 1];
  }
  return result;
}

function sourceError() {
  const state = window.__LIP_P3__;
  if (!Array.isArray(state?.errors) || state.errors.length === 0) return null;
  return state.errors.map(value => typeof value === 'string' ? value : value?.message || value?.error?.message || (value?.target?.src ? '人物贴图载入失败：' + value.target.src : String(value))).join('；');
}

async function waitForNative(progress) {
  const began = performance.now();
  return new Promise((resolve, reject) => {
    let timer;
    const check = () => {
      try {
        if (window.platformReview?.ready?.()) {
          clearInterval(timer);
          resolve();
          return;
        }
        const failure = sourceError();
        if (failure) throw new Error('原生人物初始化失败：' + failure);
        const elapsed = performance.now() - began;
        if (elapsed > 120000) throw new Error('原生人物载入超过 120 秒，请检查资源后重新载入。');
        progress({fraction: Math.min(0.82, 0.08 + elapsed / 120000 * 0.74), phase: window.__LIP_P3__?.stage || '载入原生人物与皮肤'});
      } catch (error) {
        clearInterval(timer);
        reject(error);
      }
    };
    timer = setInterval(check, 200);
    check();
  });
}

export async function loadNativeHost({stage, progress = () => {}} = {}) {
  if (!(stage instanceof HTMLElement)) throw new TypeError('人物视窗容器不存在。');
  const bootTimings = {startedAt: performance.now(), phases: []};
  // Available even if an expensive native initialization has not returned yet.
  window.__LAYER_NATIVE_TIMINGS__ = bootTimings;
  const mark = (phase, began) => bootTimings.phases.push({phase,
    durationMS: performance.now() - began, elapsedMS: performance.now() - bootTimings.startedAt});
  let began = performance.now();
  await waitForNative(progress);
  mark('wait-original-platform-ready', began);
  const qa = window.__IDENTITY_QA__;
  const model = qa?.model?.();
  const viewer = qa?.viewer?.();
  if (!model?.positions || !model?.faces || !viewer?.canvas || !viewer?.renderer) {
    throw new Error('原生人物已经报告就绪，但没有完整模型与显示接口。');
  }
  if (viewer.renderer.getContext().isContextLost()) throw new Error('原生人物 WebGL 上下文已丢失。');
  const presentation = deferNativeDrawing(viewer, bootTimings);

  began = performance.now();
  window.lifelikeIdle?.pause?.(true);
  window.lifelikeIdle?.runtime?.()?.pause?.(true);
  await Promise.all([viewer.skin?.faceReady, viewer.skin?.naturalEyesReady]);
  mark('pause-original-idle-and-await-skin', began);
  progress({fraction: 0.84, phase: '核对人物与原衣片的身体版本'});

  began = performance.now();
  const lockURL = new URL('./upstream/SOURCE_LOCK.json', import.meta.url);
  const [identity, frozen, lockResponse] = await Promise.all([
    modelIdentity(model),
    loadFrozenPerson(),
    fetch(lockURL)
  ]);
  if (!lockResponse.ok) throw new Error('服装来源锁读取失败：' + lockResponse.status);
  const lock = await lockResponse.json();
  const groundShift = lock.person?.groundShiftM;
  if (!Number.isFinite(groundShift)) throw new Error('服装来源锁缺少有效的人物坐标偏移。');
  if (identity.topologySHA256 !== frozen.manifest.topologySHA256 || model.positions.length !== frozen.model.positions.length) {
    throw new Error('新旧人物拓扑不同，原衣片的对应关系不能复用。');
  }
  mark('verify-native-and-frozen-body-identities', began);

  // Reuse the canvas, scene, original skin, all geometry and the native controls.
  began = performance.now();
  viewer.observer?.disconnect();
  stage.append(viewer.canvas);
  Object.assign(viewer.canvas.style, {display: 'block', width: '100%', height: '100%'});
  viewer.container = stage;
  viewer.onStatus = message => progress({fraction: 0.94, phase: String(message || '人物就绪')});
  viewer.observer = new ResizeObserver(() => viewer.resize());
  viewer.observer.observe(stage);
  mark('move-original-canvas-and-reconnect-resize', began);

  // Transfer studio lighting exactly as in the retained MP05 platform adapter.
  viewer.setFoldLook = () => {};
  if (viewer.cineRig) {
    viewer.cineRig.group.visible = false;
    if (viewer.cineRig.U?.uCShadowEnable) viewer.cineRig.U.uCShadowEnable.value = 0;
  }
  if (viewer.foldLights?.group) viewer.foldLights.group.visible = false;
  began = performance.now();
  installCoverageAntialias(viewer);
  installFacePassRouting(viewer);
  mark('install-original-face-render-adapters', began);
  began = performance.now();
  const lighting = new MaterialLighting(viewer);
  mark('construct-original-eb1-lighting', began);
  began = performance.now();
  viewer.resize();
  viewer.view('three');
  mark('configure-final-viewport-with-presentation-held', began);

  began = performance.now();
  const bodyPositions = yUp(model.positions);
  const oldBodyPositions = yUp(frozen.model.positions);
  const bodyFaces = Uint32Array.from(model.faces);
  mark('copy-native-body-in-garment-coordinates', began);
  bootTimings.hostPreparedMS = performance.now() - bootTimings.startedAt;
  progress({fraction: 1, phase: '原生人物、原皮肤与 EB1 灯光已接入'});
  return {
    model,
    viewer,
    lighting,
    identity,
    bodyPositions,
    bodyFaces,
    oldBodyPositions,
    groundShift,
    THREE,
    sourceRevision: SOURCE_REVISION,
    sourcePersonIdentity: frozen.manifest,
    sourceLock: lock,
    releaseRender: presentation.release,
    renderSuspended: presentation.suspended,
    renderAudit: presentation.audit,
    bootTimings,
    sameNativeViewer: qa.viewer() === viewer,
    sameNativeModel: qa.model() === model,
    iframeCreated: false
  };
}
