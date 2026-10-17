import * as T from 'three';
import {RoomEnvironment} from '../../a4-a6-source-comparison-r03/vendor/RoomEnvironment.mjs';
import {buildA6LocomotiveShell} from './src/a6-locomotive-shell.mjs';
import {buildA6CoachShell} from './src/a6-coach-shell.mjs';
import {buildA6TenderShell} from './src/a6-tender-shell.mjs';
import {buildA6StaticCoupling} from './src/a6-static-coupling.mjs';
import {buildLocomotiveMechanics} from '../student-native-r01/src/locomotive-mechanics.mjs';
import {buildMark3Mechanics} from '../student-native-r01/src/coach-mechanics.mjs';
import {buildDrivingWheel} from '../student-native-r01/src/driving-wheel.mjs';
import {batchNativeParts} from '../student-native-r01/src/render-batching.mjs';
import {A4_DIMENSIONS} from '../student-native-r01/src/dimensions.mjs';
import {createA6Branding} from './src/a6-branding.mjs';
import {createA6MaterialLibrary} from './src/a6-materials.mjs';
import {SHELL_LIMITS, DEFAULT_SHELL_PARAMETERS, CONNECTED_LAYOUT, createViewState, selectView, selectFocus, setViewZoom, orbitView, baselineMetresPerPixel, createRebuildQueue, validateShellParameters, createRenderQueue} from './interaction.mjs';

const qa = window.NATIVE_QA;
const stage = document.querySelector('#stage');
const status = document.querySelector('#status');
const mode = document.querySelector('#mode');
const zoomInput = document.querySelector('#zoom');
const parameterDetails = document.querySelector('#parameter-details');
const wideLayout = matchMedia('(min-width: 701px)');
parameterDetails.open = wideLayout.matches;
wideLayout.addEventListener('change', event => { parameterDetails.open = event.matches; });
const panels = [], mechanicalGroups = [], gestureResetters = [];
const state = createViewState();
let structureOnly = false, requestedParameters = {...DEFAULT_SHELL_PARAMETERS}, shellParameters = {...DEFAULT_SHELL_PARAMETERS};
let renderedSize = '', lastBuildError = false;
const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.debug.onShaderError = (gl, program) => window.fail(Error('SHADER ' + gl.getProgramInfoLog(program)));
stage.append(renderer.domElement);
const studio = new RoomEnvironment(), pmrem = new T.PMREMGenerator(renderer);
const environment = pmrem.fromScene(studio, 0.04).texture;
studio.dispose(); pmrem.dispose();
const materialLibrary = createA6MaterialLibrary(T), materialCache = new Map();
const recipes = new Set(['paint', 'blackPaint', 'glass', 'rubber', 'brushedMetal', 'interior', 'dark-iron', 'trim-brass', 'polished-rod-steel', 'skin', 'uniform', 'seat', 'lamp', 'gold', 'red']);

function geometry(part) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(part.positions, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(part.normals, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(part.uvs, 2));
  g.setIndex(Array.from(part.indices));
  return g;
}
function disposeGroup(group) {
  group?.removeFromParent();
  group?.traverse(object => object.geometry?.dispose());
  for (const material of group?.userData.ownedMaterials ?? []) material.dispose();
  // Cached immutable materials are shared with the unchanged mechanical groups.
  group?.clear();
}
function buildGroup(result, name, transform = null) {
  const group = new T.Group(); group.name = name;
  if (transform) {
    group.position.fromArray(transform.position);
    if (transform.mirror) group.rotation.y = Math.PI;
  }
  group.updateMatrixWorld(true);
  try {
    for (const part of batchNativeParts(result.parts)) {
      const mesh = new T.Mesh(geometry(part));
      mesh.name = part.name;
      mesh.userData.nativeComponents = part.components;
      group.add(mesh); mesh.updateMatrixWorld(true);
      const recipe = part.material === 'windowReveal' ? 'blackPaint' : part.material;
      if (!recipes.has(recipe)) throw Error('UNKNOWN_MATERIAL ' + part.material);
      const matrix = mesh.matrixWorld.toArray(), cacheKey = JSON.stringify([recipe, matrix]);
      if (!materialCache.has(cacheKey)) materialCache.set(cacheKey, materialLibrary.create(recipe, {restMatrix: matrix, units: 'm'}));
      const made = materialCache.get(cacheKey);
      mesh.material.dispose(); // Dispose the constructor's temporary default material.
      mesh.material = made.material ?? made;
      mesh.userData.nativeMaterial = {recipe, restMatrix: matrix};
    }
  } catch (error) { disposeGroup(group); throw error; }
  return group;
}
function scene() {
  const result = new T.Scene();
  result.background = new T.Color('#e9e7e0'); result.environment = environment;
  result.add(new T.HemisphereLight(0xffffff, 0x626b62, 1.25));
  const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(-8, 14, -4); result.add(sun);
  return result;
}
function addMechanical(root, result, name, transform = null) {
  const group = buildGroup(result, name, transform);
  group.userData.lockedMechanical = true;
  root.add(group); mechanicalGroups.push(group);
  return group;
}
function heightMetrics(results) {
  const names = {loco: 'a6-continuous-body-with-open-canopy-and-wheel-arches', tender: 'tender-continuous-closed-skin', coach: 'shell-roof'};
  return Object.fromEntries(Object.entries(results).map(([key, result]) => {
    let bodyCrownM = -Infinity, overallHeightM = -Infinity, highestComponent = null;
    for (const part of result.parts) for (let i = 1; i < part.positions.length; i += 3) {
      const y = part.positions[i];
      if (part.name === names[key]) bodyCrownM = Math.max(bodyCrownM, y);
      if (y > overallHeightM) { overallHeightM = y; highestComponent = part.name; }
    }
    return [key, {bodyCrownM, overallHeightM, highestComponent, bodyComponent: names[key], units: 'm'}];
  }));
}
const coachTransform = Object.freeze({position: Object.freeze([0, 0, CONNECTED_LAYOUT.coachOffsetZ])});
const loco = buildA6LocomotiveShell({topHeight: shellParameters.commonRoofHeight, cabShift: -shellParameters.cabForwardShift});
const coach = buildA6CoachShell({crownHeight: shellParameters.commonRoofHeight});
const tender = buildA6TenderShell({crownHeight: shellParameters.commonRoofHeight});
const wheel = buildDrivingWheel(), locomotiveMechanics = buildLocomotiveMechanics(), coachMechanics = buildMark3Mechanics();
const connectedScene = scene();
const staticCoupling = buildA6StaticCoupling({coachOffsetZ: CONNECTED_LAYOUT.coachOffsetZ});
const staticCouplingGroup = buildGroup(staticCoupling, 'a6-new-provisional-static-connection');
staticCouplingGroup.userData.newDesignConnection = true;
// World-coordinate design adapter, added once; deliberately excluded from frozen mechanicalGroups.
connectedScene.add(staticCouplingGroup);
let locomotiveShellGroup = buildGroup(loco, 'editable-a6-locomotive-shell');
let tenderGroup = buildGroup(tender, 'editable-a6-tender-shell');
let coachGroup = buildGroup(coach, 'editable-a6-coach-shell', coachTransform);
let brandingGroup = createA6Branding(T, {loco, tender, materialLibrary});
const currentResults = {loco, tender, coach};
connectedScene.add(locomotiveShellGroup, tenderGroup, coachGroup, brandingGroup);
addMechanical(connectedScene, locomotiveMechanics, 'locked-locomotive-mechanics');
addMechanical(connectedScene, coachMechanics, 'locked-coach-mechanics', coachTransform);
for (const z of A4_DIMENSIONS.driveAxisIndices.map(i => A4_DIMENSIONS.axisZ[i])) for (const side of [-1, 1]) {
  addMechanical(connectedScene, wheel, `locked-drive-wheel-${z}-${side}`, {position: [side * 0.75, A4_DIMENSIONS.driveDiameter / 2, z], mirror: side < 0});
}
connectedScene.updateMatrixWorld(true);
panels.push({id: 'train', scene: connectedScene, camera: new T.OrthographicCamera(), element: document.getElementById('train'), bounds: new T.Box3().setFromObject(connectedScene, true)});
// Capture ONCE, before editing/hiding. Shell changes cannot refit or move this baseline.
const baselineBounds = Object.freeze(panels.map(panel => Object.freeze({min: Object.freeze(panel.bounds.min.toArray()), max: Object.freeze(panel.bounds.max.toArray())})));
const sharedY = (Math.min(0, baselineBounds[0].min[1]) + baselineBounds[0].max[1]) / 2;
const freezeTarget = group => {
  const centre = new T.Box3().setFromObject(group, true).getCenter(new T.Vector3());
  centre.y = sharedY;
  return Object.freeze(centre.toArray());
};
const focusTargets = Object.freeze({train: freezeTarget(connectedScene), locomotive: freezeTarget(locomotiveShellGroup), coach: freezeTarget(coachGroup)});
let qaCaptureTarget = null;
const labels = {side: '正侧', front: '正前', top: '顶面'}, focusLabels = {train: '全列', locomotive: '机车', coach: '车厢'};

function setStatus(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
function syncControls() {
  for (const name of ['side', 'front', 'top']) document.getElementById(name).setAttribute('aria-pressed', String(!state.free && state.view === name));
  document.getElementById('free').setAttribute('aria-pressed', String(state.free));
  document.getElementById('structure').setAttribute('aria-pressed', String(structureOnly));
  for (const name of Object.keys(focusLabels)) document.getElementById(`focus-${name}`).setAttribute('aria-pressed', String(state.focus === name));
  zoomInput.value = String(state.zoom);
  document.querySelector('#zoom-value').value = `${state.zoom.toFixed(2)}×`;
  mode.textContent = state.free ? '自由观察 · 正交旋转 · 不用于尺寸验收' : `正交观察 · ${labels[state.view]} · ${focusLabels[state.focus]}中心 · 同一米制空间`;
  mode.classList.toggle('free-mode', state.free);
  for (const panel of panels) panel.element.classList.toggle('is-free', state.free);
}
function syncParameterInputs() {
  for (const key of Object.keys(SHELL_LIMITS)) for (const id of [key, `${key}-value`]) {
    const input = document.getElementById(id);
    input.value = String(requestedParameters[key]);
    input.setAttribute('aria-invalid', 'false');
  }
}
function requestRender() { return frameQueue.request(); }
// Public render is queue-only too: setters and rebuilds cannot bypass backpressure.
function render() { return requestRender(); }
function drawFrame() {
  const sw = stage.clientWidth, sh = stage.clientHeight;
  if (!sw || !sh) return;
  const sizeKey = `${sw}x${sh}`;
  if (sizeKey !== renderedSize) { renderer.setSize(sw, sh, false); renderedSize = sizeKey; }
  const base = stage.getBoundingClientRect(), rectangles = panels.map(panel => panel.element.getBoundingClientRect());
  const baseScale = baselineMetresPerPixel(baselineBounds, rectangles, state.view), scale = baseScale / state.zoom;
  renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
  panels.forEach((panel, index) => {
    const r = rectangles[index], camera = panel.camera, centre = new T.Vector3().fromArray(qaCaptureTarget ?? focusTargets[state.focus]);
    camera.left = -r.width * scale / 2; camera.right = r.width * scale / 2;
    camera.top = r.height * scale / 2; camera.bottom = -r.height * scale / 2;
    camera.near = 0.01; camera.far = 500; camera.up.set(0, 1, 0);
    if (!state.free) {
      if (state.view === 'side') camera.position.copy(centre).add(new T.Vector3(-70, 0, 0));
      else if (state.view === 'front') camera.position.copy(centre).add(new T.Vector3(0, 0, -70));
      else { camera.position.copy(centre).add(new T.Vector3(0, 70, 0)); camera.up.set(0, 0, 1); }
    } else {
      camera.position.copy(centre).add(new T.Vector3(Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch), Math.cos(state.yaw) * Math.cos(state.pitch)).multiplyScalar(70));
      if (Math.abs(Math.cos(state.pitch)) < 1e-5) camera.up.set(0, 0, 1);
    }
    camera.lookAt(centre); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    camera.userData.metresPerPixel = scale;
    renderer.setViewport(r.left - base.left, sh - (r.bottom - base.top), r.width, r.height);
    renderer.setScissor(r.left - base.left, sh - (r.bottom - base.top), r.width, r.height);
    renderer.render(panel.scene, camera);
    panel.element.querySelector('.scale-label').textContent = `${state.free ? '观察比例' : '正交比例'} ${(scale * 1000).toFixed(2)} mm / CSS px · ${state.zoom.toFixed(2)}×`;
  });
  Object.assign(qa, {view: state.view, freeMode: state.free, metresPerPixel: scale, baseMetresPerPixel: baseScale, scales: panels.map(panel => panel.camera.userData.metresPerPixel), dimensionAcceptanceMode: !state.free});
  return {...state, structureOnly, shellRevision: qa.shellRevision, metresPerPixel: scale};
}
const frameQueue = createRenderQueue({draw: drawFrame, gl: renderer.getContext(), onError: window.fail});
function resetGestures() { gestureResetters.forEach(reset => reset()); }
function setView(name) { qaCaptureTarget = null; selectView(state, name); resetGestures(); syncControls(); render(); return {...state}; }
function setFocus(name) { qaCaptureTarget = null; selectFocus(state, name); resetGestures(); syncControls(); render(); return {...state}; }
function setFreeMode(value) {
  if (typeof value !== 'boolean') throw new TypeError('自由观察模式必须是布尔值');
  if (value) state.free = true; else selectView(state, state.view);
  resetGestures(); syncControls(); render(); return {...state};
}
function setZoom(value) { setViewZoom(state, value); syncControls(); render(); return state.zoom; }
function showStructure(value) {
  structureOnly = !!value;
  locomotiveShellGroup.visible = tenderGroup.visible = coachGroup.visible = brandingGroup.visible = !structureOnly;
  qa.structureOnly = structureOnly; syncControls(); render();
}
const yieldTurn = () => new Promise(resolve => setTimeout(resolve, 0));
function disposeShellBuild(artifact) { disposeGroup(artifact.locoGroup); disposeGroup(artifact.tenderGroup); disposeGroup(artifact.coachGroup); disposeGroup(artifact.brandingGroup); }
const rebuildQueue = createRebuildQueue({
  async build(parameters) {
    const artifact = {};
    try {
      await yieldTurn();
      const roofChanged = parameters.commonRoofHeight !== shellParameters.commonRoofHeight;
      if (roofChanged || parameters.cabForwardShift !== shellParameters.cabForwardShift) {
        artifact.loco = buildA6LocomotiveShell({topHeight: parameters.commonRoofHeight, cabShift: -parameters.cabForwardShift});
        artifact.locoGroup = buildGroup(artifact.loco, 'editable-a6-locomotive-shell');
      }
      await yieldTurn();
      if (roofChanged) {
        artifact.tender = buildA6TenderShell({crownHeight: parameters.commonRoofHeight});
        artifact.tenderGroup = buildGroup(artifact.tender, 'editable-a6-tender-shell');
        await yieldTurn();
        artifact.coach = buildA6CoachShell({crownHeight: parameters.commonRoofHeight});
        artifact.coachGroup = buildGroup(artifact.coach, 'editable-a6-coach-shell', coachTransform);
      }
      if (artifact.locoGroup || artifact.tenderGroup) artifact.brandingGroup = createA6Branding(T, {loco: artifact.loco ?? currentResults.loco, tender: artifact.tender ?? currentResults.tender, materialLibrary});
      return artifact;
    } catch (error) { disposeShellBuild(artifact); throw error; }
  },
  commit(artifact, parameters, revision) {
    if (artifact.locoGroup) {
      const previous = locomotiveShellGroup; locomotiveShellGroup = artifact.locoGroup;
      locomotiveShellGroup.visible = !structureOnly; connectedScene.add(locomotiveShellGroup); disposeGroup(previous);
      currentResults.loco = artifact.loco; qa.locoParameters = artifact.loco.parameters; qa.locoEvidence = artifact.loco.evidence;
    }
    if (artifact.tenderGroup) {
      const previous = tenderGroup; tenderGroup = artifact.tenderGroup;
      tenderGroup.visible = !structureOnly; connectedScene.add(tenderGroup); disposeGroup(previous);
      currentResults.tender = artifact.tender; qa.tenderParameters = artifact.tender.parameters;
    }
    if (artifact.coachGroup) {
      const previous = coachGroup; coachGroup = artifact.coachGroup;
      coachGroup.visible = !structureOnly; connectedScene.add(coachGroup); disposeGroup(previous);
      currentResults.coach = artifact.coach; qa.coachParameters = artifact.coach.parameters;
    }
    if (artifact.brandingGroup) {
      const previous = brandingGroup; brandingGroup = artifact.brandingGroup;
      brandingGroup.visible = !structureOnly; connectedScene.add(brandingGroup); disposeGroup(previous);
    }
    connectedScene.updateMatrixWorld(true);
    shellParameters = {...parameters}; qa.shellRevision = revision; qa.heightMetrics = heightMetrics(currentResults);
    // Deliberately no bounds recomputation, fit, recenter, camera reset or mechanical regeneration.
    render();
    return {...shellParameters};
  },
  dispose: disposeShellBuild,
  onBusy(busy) {
    qa.busy = busy; stage.setAttribute('aria-busy', String(busy));
    if (busy) { lastBuildError = false; setStatus('正在更新外壳；机械与相机保持不变…'); }
    else if (!lastBuildError) setStatus('原生结构已就绪。外壳修改不自动取景；全列机械与轮轴保持固定。');
  },
  onError(error) { lastBuildError = true; requestedParameters = {...shellParameters}; syncParameterInputs(); window.fail(error); },
});
async function setShellParameters(patch) {
  requestedParameters = validateShellParameters(patch, requestedParameters);
  syncParameterInputs();
  return rebuildQueue.enqueue(requestedParameters);
}
async function reset() {
  setView('side'); setFocus('train'); showStructure(false);
  return setShellParameters(DEFAULT_SHELL_PARAMETERS);
}
function reportInputError(error, input) { input?.setAttribute('aria-invalid', 'true'); setStatus(error.message || String(error), true); }
for (const key of Object.keys(SHELL_LIMITS)) {
  const range = document.getElementById(key), number = document.getElementById(`${key}-value`);
  range.addEventListener('input', () => { setShellParameters({[key]: Number(range.value)}).catch(error => reportInputError(error, range)); });
  number.addEventListener('change', () => {
    if (!number.value.trim()) { reportInputError(new Error('请输入范围内的数值'), number); return; }
    setShellParameters({[key]: Number(number.value)}).catch(error => reportInputError(error, number));
  });
  number.addEventListener('keydown', event => { if (event.key === 'Enter') { number.dispatchEvent(new Event('change')); number.blur(); } });
}
for (const name of ['side', 'front', 'top']) document.getElementById(name).onclick = () => setView(name);
document.getElementById('free').onclick = () => setFreeMode(!state.free);
document.getElementById('structure').onclick = () => showStructure(!structureOnly);
for (const name of Object.keys(focusLabels)) document.getElementById(`focus-${name}`).onclick = () => setFocus(name);
document.getElementById('zoom-in').onclick = () => setZoom(state.zoom * 1.25);
document.getElementById('zoom-out').onclick = () => setZoom(state.zoom / 1.25);
document.getElementById('reset').onclick = () => reset().catch(window.fail);
zoomInput.addEventListener('input', () => { setViewZoom(state, Number(zoomInput.value)); syncControls(); requestRender(); });

function bindPanelControls(element) {
  const pointers = new Map();
  const resetPointers = () => {
    const ids = [...pointers.keys()]; pointers.clear(); element.classList.remove('is-dragging');
    for (const id of ids) if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
  };
  gestureResetters.push(resetPointers);
  element.addEventListener('pointerdown', event => {
    if (!state.free || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); element.focus({preventScroll: true});
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    element.setPointerCapture(event.pointerId); element.classList.add('is-dragging');
  });
  const distance = () => { const points = [...pointers.values()]; return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); };
  element.addEventListener('pointermove', event => {
    if (!state.free || !pointers.has(event.pointerId)) return;
    event.preventDefault();
    const previous = pointers.get(event.pointerId), before = distance();
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if (pointers.size >= 2) {
      const after = distance(); if (before > 1 && after > 1) setViewZoom(state, state.zoom * after / before);
    } else orbitView(state, event.clientX - previous.x, event.clientY - previous.y);
    syncControls(); requestRender();
  });
  const release = event => { pointers.delete(event.pointerId); if (!pointers.size) element.classList.remove('is-dragging'); };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(name, release);
  element.addEventListener('wheel', event => {
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
    setViewZoom(state, state.zoom * Math.exp(-pixels * 0.0015)); syncControls(); requestRender();
  }, {passive: false});
  element.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === '+' || event.key === '=') setViewZoom(state, state.zoom * 1.1);
    else if (event.key === '-') setViewZoom(state, state.zoom / 1.1);
    else if (event.key === 'Escape' && state.free) { setFreeMode(false); event.preventDefault(); return; }
    else if (state.free && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      orbitView(state, event.key === 'ArrowLeft' ? -15 : event.key === 'ArrowRight' ? 15 : 0, event.key === 'ArrowUp' ? -15 : event.key === 'ArrowDown' ? 15 : 0);
    } else return;
    event.preventDefault(); syncControls(); requestRender();
  });
}
panels.forEach(panel => bindPanelControls(panel.element));
addEventListener('blur', resetGestures);
addEventListener('resize', requestRender);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(requestRender).observe(stage);
Object.assign(qa, {
  ready: true, busy: false, renderer, panels, render, requestRender, setView, setFocus, setFreeMode, setZoom, setShellParameters, reset, showStructure,
  setCoach: (parameters = {}) => {
    if (Object.keys(parameters).some(key => key !== 'roofTop')) return Promise.reject(new RangeError('Only the linked common roof height is exposed'));
    return setShellParameters({commonRoofHeight: parameters.roofTop ?? DEFAULT_SHELL_PARAMETERS.commonRoofHeight});
  },
  // Screenshot QA helper only; never linked to a public control or an edit callback.
  setCaptureTarget: target => {
    if (!Array.isArray(target) || target.length !== 3 || !target.every(Number.isFinite)) throw new TypeError('Capture target must be three finite metre coordinates');
    qaCaptureTarget = [...target]; render();
  },
  connectedLayout: CONNECTED_LAYOUT, focusTargets, heightMetrics: heightMetrics(currentResults),
  baselineBounds, mechanicalGroups, shellParameterLimits: SHELL_LIMITS, shellRevision: 0, structureOnly,
  locoParameters: loco.parameters, tenderParameters: tender.parameters, coachParameters: coach.parameters,
  sourceGeometryRequests: 0, geometryGeneration: 'native-curves-and-surfaces',
  wheelDiameter: wheel.nominalTreadDiameter, driveAxisZ: A4_DIMENSIONS.driveAxisIndices.map(i => A4_DIMENSIONS.axisZ[i]),
  mechanicalCoverage: {locomotive: locomotiveMechanics.coverage, coach: coachMechanics.checklist},
  staticCouplingGroup, staticCouplingEvidence: staticCoupling.evidence, newDesignConnectionParts: staticCoupling.parts.length,
  mechanicalPartCounts: {locomotive: locomotiveMechanics.parts.length, coach: coachMechanics.parts.length, nativeWheelInstances: 6, componentsPerWheel: wheel.parts.length},
  missingMechanical: ['motion constraints and force/clearance validation', 'unverified detailed mechanical dimensions and mounting', 'coach interior equipment and seating', 'coupler functional design'],
  nativeComponentCount: staticCoupling.parts.length + loco.parts.length + tender.parts.length + coach.parts.length + 6 * wheel.parts.length + locomotiveMechanics.parts.length + coachMechanics.parts.length,
  locoEvidence: loco.evidence, coachInterfaces: coach.interfaces, tenderInterfaces: tender.interfaces,
  brandingMode: 'existing-authored-outline-master',
  materialMode: 'native-master', physicalApproval: false, visualApproval: false,
});
Object.defineProperties(qa, {
  state: {get: () => ({...state, structureOnly, busy: qa.busy})},
  shellParameters: {get: () => ({...shellParameters})},
  requestedShellParameters: {get: () => ({...requestedParameters})},
  brandingGroup: {get: () => brandingGroup},
  shellGroups: {get: () => [locomotiveShellGroup, tenderGroup, coachGroup]},
  rebuildState: {get: () => rebuildQueue.state},
  renderPending: {get: () => frameQueue.pending},
  renderStats: {get: () => frameQueue.stats},
  frameStats: {get: () => frameQueue.stats},
});
syncControls(); syncParameterInputs(); render();
stage.setAttribute('aria-busy', 'false');
setStatus('A6 连编原生结构已就绪。默认全列正侧；车顶联调、驾驶室前后微调均不改机械、比例或观察中心。');
