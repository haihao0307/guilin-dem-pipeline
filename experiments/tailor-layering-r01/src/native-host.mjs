import * as THREE from 'three';
import {MaterialLighting} from './upstream/lighting.mjs';
import {installCoverageAntialias} from './upstream/coverage-antialias.mjs';
import {installFacePassRouting} from './upstream/face-pass-routing.mjs';
import {modelIdentity} from './upstream/source-contract.mjs';
import {loadPerson as loadFrozenPerson} from './upstream/person/load-person.mjs';

// The original public runtime is initialized in this document by build.py.
// This adapter takes ownership of that exact viewer; it creates no second body.
const SOURCE_REVISION = 'd413d108704af47cf531ee8c25d93f682c3176e3';

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
  return state.errors.map(value => typeof value === 'string' ? value : value?.message || String(value)).join('；');
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
  await waitForNative(progress);
  const qa = window.__IDENTITY_QA__;
  const model = qa?.model?.();
  const viewer = qa?.viewer?.();
  if (!model?.positions || !model?.faces || !viewer?.canvas || !viewer?.renderer) {
    throw new Error('原生人物已经报告就绪，但没有完整模型与显示接口。');
  }
  if (viewer.renderer.getContext().isContextLost()) throw new Error('原生人物 WebGL 上下文已丢失。');

  window.lifelikeIdle?.pause?.(true);
  window.lifelikeIdle?.runtime?.()?.pause?.(true);
  await Promise.all([viewer.skin?.faceReady, viewer.skin?.naturalEyesReady]);
  progress({fraction: 0.84, phase: '核对人物与原衣片的身体版本'});

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

  // Reuse the canvas, scene, original skin, all geometry and the native controls.
  viewer.observer?.disconnect();
  stage.append(viewer.canvas);
  Object.assign(viewer.canvas.style, {display: 'block', width: '100%', height: '100%'});
  viewer.container = stage;
  viewer.onStatus = message => progress({fraction: 0.94, phase: String(message || '人物就绪')});
  viewer.observer = new ResizeObserver(() => viewer.resize());
  viewer.observer.observe(stage);

  // Transfer studio lighting exactly as in the retained MP05 platform adapter.
  viewer.setFoldLook = () => {};
  if (viewer.cineRig) {
    viewer.cineRig.group.visible = false;
    if (viewer.cineRig.U?.uCShadowEnable) viewer.cineRig.U.uCShadowEnable.value = 0;
  }
  if (viewer.foldLights?.group) viewer.foldLights.group.visible = false;
  installCoverageAntialias(viewer);
  installFacePassRouting(viewer);
  const lighting = new MaterialLighting(viewer);
  viewer.resize();
  viewer.view('three');
  viewer.render();

  const bodyPositions = yUp(model.positions);
  const oldBodyPositions = yUp(frozen.model.positions);
  const bodyFaces = Uint32Array.from(model.faces);
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
    sameNativeViewer: qa.viewer() === viewer,
    sameNativeModel: qa.model() === model,
    iframeCreated: false
  };
}
