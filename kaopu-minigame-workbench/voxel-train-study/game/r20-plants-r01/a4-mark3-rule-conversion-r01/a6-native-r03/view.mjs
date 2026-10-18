import * as T from 'three';
import {RoomEnvironment} from '../../a4-a6-source-comparison-r03/vendor/RoomEnvironment.mjs';
import {buildA6LocomotiveShell} from './src/a6-locomotive-shell.mjs';
import {buildA6CoachShell} from './src/a6-coach-shell.mjs';
import {buildA6TenderShell} from './src/a6-tender-shell.mjs';
import {createA6MotionModel, evaluateA6Motion, validateA6MotionCycle, screenA6SweptInterference} from './src/a6-motion.mjs';
import {createValveNativeAdapter,evaluateValveNativeAdapter} from '../a6-valve-gear-experiment-r01/src/valve-native-adapter.mjs';
import {correctA6Mechanics} from './src/a6-motion-corrections.mjs';
import {createPlayback} from './src/a6-playback.mjs';
import {buildA6CouplingMotion,solveA6CouplingPose} from './src/a6-coupling-motion.mjs';
import {buildA6FlexibleTransitions} from './src/a6-flexible-transitions.mjs';
import {buildLocomotiveMechanics} from '../student-native-r01/src/locomotive-mechanics.mjs';
import {buildMark3Mechanics} from '../student-native-r01/src/coach-mechanics.mjs';
import {buildDrivingWheel} from '../student-native-r01/src/driving-wheel.mjs';
import {batchNativeParts} from '../student-native-r01/src/render-batching.mjs';
import {A4_DIMENSIONS} from '../student-native-r01/src/dimensions.mjs';
import {createA6Branding} from './src/a6-branding.mjs';
import {bindA6RestAttributes} from './src/a6-causal-coating.mjs';
import {createA6MaterialLibrary} from './src/a6-materials.mjs';
import {SHELL_LIMITS, DEFAULT_SHELL_PARAMETERS, CONNECTED_LAYOUT, createViewState, selectView, enterSideInspection, selectFocus, setViewZoom, orbitView, baselineMetresPerPixel, createRebuildQueue, validateShellParameters, createRenderQueue} from './interaction.mjs';

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
let renderedSize = '', lastBuildError = false, layoutRetries = 0, layoutRetryTimer = null;
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

const flexRestCache=new Map();
function attachFlexRest(result){
 const key=result.parameters.crownHeight+':'+result.parameters.coachOffsetZ;
 if(!flexRestCache.has(key)){flexRestCache.set(key,buildA6FlexibleTransitions({crownHeight:result.parameters.crownHeight,coachOffsetZ:result.parameters.coachOffsetZ}));if(flexRestCache.size>3)flexRestCache.delete(flexRestCache.keys().next().value);}
 const original=new Map(flexRestCache.get(key).parts.map(p=>[p.name,p]));
 for(const p of result.parts){const rest=original.get(p.name);if(!rest||rest.positions.length!==p.positions.length)throw Error('Flexible rest topology mismatch');p.restPositions=rest.positions;p.restNormals=rest.normals;}
 return result;
}
function geometry(part) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(part.positions, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(part.normals, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(part.uvs, 2));
  g.setIndex(Array.from(part.indices));
  if(part.restPositions){g.setAttribute('a6RestPosition',new T.Float32BufferAttribute(part.restPositions,3));g.setAttribute('a6RestNormal',new T.Float32BufferAttribute(part.restNormals,3));}
  return g;
}
function disposeGroup(group) {
  group?.removeFromParent();
  group?.traverse(object => object.geometry?.dispose());
  for (const material of group?.userData.ownedMaterials ?? []) material.dispose();
  // Cached immutable materials are shared with the unchanged mechanical groups.
  group?.clear();
}
function buildGroup(result, name, transform = null, movingNames = []) {
  const group = new T.Group(); group.name = name;
  if (transform) {
    group.position.fromArray(transform.position);
    if (transform.mirror) group.rotation.y = Math.PI;
  }
  group.updateMatrixWorld(true);
  try {
    const moving = new Set(movingNames);
    const renderParts = [...batchNativeParts(result.parts.filter(p => !moving.has(p.name)&&!p.restPositions)), ...result.parts.filter(p => moving.has(p.name)||p.restPositions)];
    for (const part of renderParts) {
      const mesh = new T.Mesh(geometry(part));
      mesh.name = part.name;
      mesh.userData.nativeComponents = part.components ?? [{name:part.name,vertexStart:0,vertexCount:part.positions.length/3,indexStart:0,indexCount:part.indices.length}];
      group.add(mesh); mesh.updateMatrixWorld(true);
      const recipe = part.material === 'windowReveal' ? 'blackPaint' : part.material;
      if (!recipes.has(recipe)) throw Error('UNKNOWN_MATERIAL ' + part.material);
      const matrix = mesh.matrixWorld.toArray(), cacheKey = JSON.stringify([recipe, matrix,!!part.restPositions]);
      if (!materialCache.has(cacheKey)) materialCache.set(cacheKey, materialLibrary.create(recipe, {restMatrix: matrix, units: 'm'}));
      const made = materialCache.get(cacheKey);
      mesh.material.dispose(); // Dispose the constructor's temporary default material.
      mesh.material = made.material ?? made;
      if(part.restPositions&&recipe==='paint'&&!mesh.material.userData.a6RestAttributes)bindA6RestAttributes(mesh.material);
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
function addMechanical(root, result, name, transform = null, movingNames = []) {
  const group = buildGroup(result, name, transform, movingNames);
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
let flexibleTransitions = attachFlexRest(buildA6FlexibleTransitions({crownHeight: shellParameters.commonRoofHeight, coachOffsetZ: CONNECTED_LAYOUT.coachOffsetZ}));
const wheel = buildDrivingWheel(), originalLocomotiveMechanics = buildLocomotiveMechanics(), correctedMechanics = correctA6Mechanics(originalLocomotiveMechanics), locomotiveMechanics = correctedMechanics.mechanics, coachMechanics = buildMark3Mechanics();
const motionModel = createA6MotionModel({mechanics:locomotiveMechanics,wheel});
const valveAdapter = createValveNativeAdapter({baseModel:motionModel});
const connectedScene = scene();
const staticCoupling = buildA6CouplingMotion({coachOffsetZ:CONNECTED_LAYOUT.coachOffsetZ});
const staticCouplingGroup = new T.Group();staticCouplingGroup.name='a6-new-two-pin-connection';
const couplingBodies=Object.fromEntries(Object.entries(staticCoupling.partsByBody).map(([key,parts])=>[key,buildGroup({parts},'connection-'+key)]));
staticCouplingGroup.add(...Object.values(couplingBodies));
staticCouplingGroup.userData.newDesignConnection=true;connectedScene.add(staticCouplingGroup);
let couplingPose=solveA6CouplingPose({coachOffsetZ:CONNECTED_LAYOUT.coachOffsetZ});
let locomotiveShellGroup = buildGroup(loco, 'editable-a6-locomotive-shell');
let tenderGroup = buildGroup(tender, 'editable-a6-tender-shell');
let coachGroup = buildGroup(coach, 'editable-a6-coach-shell', coachTransform);
let flexibleTransitionGroup = buildGroup(flexibleTransitions, 'editable-a6-flexible-transitions');
let brandingGroup = createA6Branding(T, {loco, tender, materialLibrary});
const currentResults = {loco, tender, coach};
connectedScene.add(locomotiveShellGroup, tenderGroup, coachGroup, flexibleTransitionGroup, brandingGroup);
const locoMechanicalGroup = addMechanical(connectedScene, {...valveAdapter.mechanics,parts:[...valveAdapter.mechanics.parts,...(motionModel.supplementalParts ?? []),...valveAdapter.supplementalParts]}, 'locked-locomotive-mechanics', null, [...new Set([...motionModel.movingPartNames,...valveAdapter.movingPartNames,...Object.keys(motionModel.staticPartTransforms ?? {}),...Object.keys(valveAdapter.staticPartTransforms ?? {})])]);
const coachMechanicalGroup = addMechanical(connectedScene, coachMechanics, 'locked-coach-mechanics', coachTransform);
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
  mode.textContent = state.free ? '侧向审阅 · 水平±20° / 俯仰±15° · 禁止轴向斜看' : `正交观察 · ${labels[state.view]} · ${focusLabels[state.focus]}中心 · 同一米制空间`;
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
  if (sw < 2 || sh < 2) {
    qa.viewport = {valid: false, width: sw, height: sh};
    if (++layoutRetries > 8) throw new Error('Viewport remained degenerate after bounded layout retries; no new view was drawn');
    clearTimeout(layoutRetryTimer); layoutRetryTimer = setTimeout(requestRender, 125);
    return {skipped: 'degenerate-layout', viewport: {...qa.viewport}};
  }
  layoutRetries = 0; clearTimeout(layoutRetryTimer); layoutRetryTimer = null;
  const sizeKey = `${sw}x${sh}`;
  if (sizeKey !== renderedSize) { renderer.setSize(sw, sh, false); renderedSize = sizeKey; }
  // One scene fills the stage. CSS panel DOMRects can transiently collapse during
  // a screenshot/layout transaction; never substitute a 1px measuring viewport.
  const viewport = {width: sw, height: sh}, rectangles = [viewport];
  const baseScale = baselineMetresPerPixel(baselineBounds, rectangles, state.view), scale = baseScale / state.zoom;
  qa.viewport = {valid: true, width: sw, height: sh, drawingBufferWidth: renderer.domElement.width, drawingBufferHeight: renderer.domElement.height};
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
    renderer.setViewport(0, 0, sw, sh);
    renderer.setScissor(0, 0, sw, sh);
    renderer.render(panel.scene, camera);
    panel.element.querySelector('.scale-label').textContent = `${state.free ? '观察比例' : '正交比例'} ${(scale * 1000).toFixed(2)} mm / CSS px · ${state.zoom.toFixed(2)}×`;
  });
  Object.assign(qa, {view: state.view, freeMode: state.free, metresPerPixel: scale, baseMetresPerPixel: baseScale, scales: panels.map(panel => panel.camera.userData.metresPerPixel), dimensionAcceptanceMode: !state.free});
  return {...state, structureOnly, shellRevision: qa.shellRevision, motionPhase: playback.state.phase, metresPerPixel: scale, viewport: {...qa.viewport}};
}
const frameQueue = createRenderQueue({draw: drawFrame, gl: renderer.getContext(), onError: window.fail});
function evaluatedCombinedMotion(phase){
  const core=evaluateA6Motion(motionModel,phase);
  return {...core,blockers:core.blockers.map(b=>b.id==='outside-valve-loop'?{...b,status:'finite-fixed-setting-constraint-candidate',parts:valveAdapter.movingPartNames,reason:'Outside finite linkage is driven by fixed-length and two-slot constraints; actual steam events, historical phases, full reverser travel and loads remain unresolved.'}:b)};
}
let currentMotionPose = evaluatedCombinedMotion(0);
let currentValvePose = evaluateValveNativeAdapter(valveAdapter,0);
const movingMeshes = new Map(locoMechanicalGroup.children.map(mesh => [mesh.name,mesh]));
const wheelGroupsByName = new Map(mechanicalGroups.map(group=>[group.name,group]));
function applyMotion(phase) {
  currentMotionPose = evaluatedCombinedMotion(phase);
  currentValvePose = evaluateValveNativeAdapter(valveAdapter,phase);
  for (const [name,matrix] of Object.entries({...motionModel.staticPartTransforms,...currentMotionPose.partTransforms,...valveAdapter.staticPartTransforms,...currentValvePose.partTransforms})) {
    const mesh = movingMeshes.get(name); if (!mesh) throw Error('Missing moving component '+name);
    mesh.matrixAutoUpdate=false;mesh.matrix.fromArray(matrix);mesh.matrixWorldNeedsUpdate=true;
  }
  for(const entry of currentMotionPose.wheelTransforms){const group=wheelGroupsByName.get(entry.name);group.matrixAutoUpdate=false;group.matrix.fromArray(entry.matrix);group.matrixWorldNeedsUpdate=true;}
  connectedScene.updateMatrixWorld(true);
  document.querySelector('#motion-status').textContent=`相位 ${currentMotionPose.phaseDegrees.toFixed(1)}° · ${playback.state.playing?'播放中':'暂停'} · 外侧配气闭链候选；内缸/实际配气事件未解`;
}
const playback = createPlayback({apply:applyMotion,requestRender,isRenderPending:()=>frameQueue.pending});
applyMotion(0);
function pauseMotion(){playback.pause();document.querySelector('#motion-status').textContent=`相位 ${playback.state.phaseDegrees.toFixed(1)}° · 暂停 · 外侧配气闭链候选；内缸/实际配气事件未解`;}
function applyCoupling(yaw){
  pauseMotion();couplingPose=solveA6CouplingPose({coachOffsetZ:CONNECTED_LAYOUT.coachOffsetZ,coachYawDeg:yaw});
  for(const group of [coachGroup,coachMechanicalGroup]){group.position.fromArray(couplingPose.transforms.coach.position);group.rotation.y=couplingPose.transforms.coach.yawRad;}
  for(const [key,tkey] of [['fixed','fixed'],['drawbar','drawbar'],['coach','coachDesign']]){const t=couplingPose.transforms[tkey];couplingBodies[key].position.fromArray(t.position);couplingBodies[key].rotation.y=t.yawRad;}
  const priorTransition=flexibleTransitionGroup;
  flexibleTransitions=attachFlexRest(buildA6FlexibleTransitions({crownHeight:shellParameters.commonRoofHeight,coachOffsetZ:CONNECTED_LAYOUT.coachOffsetZ,couplingPose}));
  flexibleTransitionGroup=buildGroup(flexibleTransitions,'editable-a6-flexible-transitions');flexibleTransitionGroup.visible=!structureOnly;connectedScene.add(flexibleTransitionGroup);disposeGroup(priorTransition);
  connectedScene.updateMatrixWorld(true);document.querySelector('#connection-angle').value=String(yaw);document.querySelector('#connection-angle-value').value=yaw.toFixed(1)+'°';
  document.querySelector('#connection-status').textContent=yaw===0?'连接台架复位；完整列车功能仍未验证。':'销接闭合误差 '+couplingPose.closureErrorM.toExponential(2)+' m。护罩两端随动；仅在报告角度内检查，非可运行弯道认证。';
  requestRender();return couplingPose;
}
document.querySelector('#connection-angle').oninput=e=>{document.querySelector('#connection-angle-value').value=Number(e.target.value).toFixed(1)+'°（松手求解）';};
document.querySelector('#connection-angle').onchange=e=>{const v=Number(e.target.value);document.querySelector('#connection-status').textContent='正在生成端点约束护罩…';setTimeout(()=>{try{applyCoupling(v);}catch(error){window.fail(error);}},0);};
document.querySelector('#check-connection').onclick=async()=>{pauseMotion();showStructure(true);setView('side');qaCaptureTarget=[0,1.1,20.5];setZoom(6);try{const r=await fetch('./qa/COUPLING_SWEEP_PUBLIC.json');if(!r.ok)throw Error('连接报告HTTP '+r.status);displayCheck({pose:couplingPose,currentShellParameters:{...shellParameters},testedShellParameters:{commonRoofHeight:4.03,cabForwardShift:0},currentShellMatchesTested:shellParameters.commonRoofHeight===4.03&&shellParameters.cabForwardShift===0,sweep:await r.json(),warning:'护罩按关节端点变形，不隐藏碰撞；偏航检查不是整列轨道运行；报告仅绑定默认4.03m冠高和默认驾驶舱。'});}catch(e){displayCheck({error:e.message,pose:couplingPose});}};
function displayCheck(value){const box=document.querySelector('#check-results');box.hidden=false;box.textContent=JSON.stringify(value,null,2);}
document.querySelector('#motion-play').onclick=()=>playback.play();
document.querySelector('#motion-pause').onclick=()=>{pauseMotion();applyMotion(playback.state.phase);};
document.querySelector('#motion-step').onclick=()=>playback.step();
document.querySelector('#motion-reset').onclick=()=>playback.reset();
document.querySelector('#motion-speed').oninput=e=>{playback.setSpeed(Number(e.target.value));document.querySelector('#motion-speed-value').value=e.target.value+'°/s';};
document.querySelector('#coating-wear').oninput=e=>{materialLibrary.setCoatingWear(Number(e.target.value));document.querySelector('#coating-value').value=e.target.value;requestRender();};
document.querySelector('#check-motion').onclick=async()=>{pauseMotion();displayCheck({status:'正在读取固定参数周期扫查结果…'});try{const r=await fetch('./qa/MOTION_SWEEP_PUBLIC.json');if(!r.ok)throw Error('周期报告HTTP '+r.status);const vr=await fetch('../a6-valve-gear-experiment-r01/docs/FINITE_VALVE_SWEEP_LATEST.json');if(!vr.ok)throw Error('配气报告HTTP '+vr.status);displayCheck({priorR02CoreLoop:validateA6MotionCycle(motionModel),currentValvePose:{residualM:currentValvePose.residualM,checks:currentValvePose.checks},valveSweep:await vr.json(),priorR02Baseline:await r.json(),note:'新配气与旧R02基线分开。报告绑定默认外壳；内缸/真实配气事件与工程安全未验。'});}catch(e){displayCheck({error:e.message});}};
addEventListener('blur',()=>pauseMotion());

function resetGestures() { gestureResetters.forEach(reset => reset()); }
function setView(name) { qaCaptureTarget = null; selectView(state, name); resetGestures(); syncControls(); render(); return {...state}; }
function setFocus(name) { qaCaptureTarget = null; selectFocus(state, name); resetGestures(); syncControls(); render(); return {...state}; }
function setFreeMode(value) {
  if (typeof value !== 'boolean') throw new TypeError('自由观察模式必须是布尔值');
  if (value) enterSideInspection(state); else selectView(state, state.view);
  resetGestures(); syncControls(); render(); return {...state};
}
function setZoom(value) { setViewZoom(state, value); syncControls(); render(); return state.zoom; }
function showStructure(value) {
  structureOnly = !!value;
  locomotiveShellGroup.visible = tenderGroup.visible = coachGroup.visible = flexibleTransitionGroup.visible = brandingGroup.visible = !structureOnly;
  qa.structureOnly = structureOnly; syncControls(); render();
}
const yieldTurn = () => new Promise(resolve => setTimeout(resolve, 0));
function disposeShellBuild(artifact) { disposeGroup(artifact.locoGroup); disposeGroup(artifact.tenderGroup); disposeGroup(artifact.coachGroup); disposeGroup(artifact.brandingGroup); disposeGroup(artifact.flexibleTransitionGroup); }
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
        await yieldTurn();
        artifact.flexibleTransitions = attachFlexRest(buildA6FlexibleTransitions({crownHeight: parameters.commonRoofHeight, coachOffsetZ: CONNECTED_LAYOUT.coachOffsetZ, couplingPose}));
        artifact.flexibleTransitionGroup = buildGroup(artifact.flexibleTransitions, 'editable-a6-flexible-transitions');
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
    if (artifact.flexibleTransitionGroup) {
      const previous = flexibleTransitionGroup; flexibleTransitionGroup = artifact.flexibleTransitionGroup;
      flexibleTransitions = artifact.flexibleTransitions;
      flexibleTransitionGroup.visible = !structureOnly; connectedScene.add(flexibleTransitionGroup); disposeGroup(previous);
    }
    if (artifact.brandingGroup) {
      const previous = brandingGroup; brandingGroup = artifact.brandingGroup;
      brandingGroup.visible = !structureOnly; connectedScene.add(brandingGroup); disposeGroup(previous);
    }
    const ct=couplingPose.transforms.coach;coachGroup.position.fromArray(ct.position);coachGroup.rotation.y=ct.yawRad;
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
    else if (!lastBuildError) setStatus('原生结构已就绪。外壳修改不自动取景；轮径轴位保持锁定；运动姿态由动态按钮控制。');
  },
  onError(error) { lastBuildError = true; requestedParameters = {...shellParameters}; syncParameterInputs(); window.fail(error); },
});
async function setShellParameters(patch) {
  requestedParameters = validateShellParameters(patch, requestedParameters);
  syncParameterInputs();
  return rebuildQueue.enqueue(requestedParameters);
}
async function reset() {
  playback.reset();applyCoupling(0);
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
  ready: true, busy: false, applyCoupling, renderer, panels, render, playback, motionModel, valveAdapter, evaluateMotion: phase=>{playback.setPhase(phase);return currentMotionPose;}, requestRender, setView, setFocus, setFreeMode, setZoom, setShellParameters, reset, showStructure,
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
  mechanicalCorrections: [...correctedMechanics.corrections,...valveAdapter.corrections],
  mechanicalCoverage: {locomotive: locomotiveMechanics.coverage, coach: coachMechanics.checklist},
  newDesignTransitionParts: flexibleTransitions.parts.length,
  staticCouplingGroup, staticCouplingEvidence: staticCoupling.evidence, newDesignConnectionParts: staticCoupling.parts.length,
  mechanicalPartCounts: {locomotive: locomotiveMechanics.parts.length, coach: coachMechanics.parts.length, nativeWheelInstances: 6, componentsPerWheel: wheel.parts.length},
  supplementalMechanicalParts: (motionModel.supplementalParts?.length ?? 0)+valveAdapter.supplementalParts.length,
  valveMechanicalPartNames: valveAdapter.mechanics.parts.map(p=>p.name), valveMovingPartNames: valveAdapter.movingPartNames,
  missingMechanical: ['inside/Gresley motion, actual valve events, left/right phase and force/load validation', 'unverified detailed mechanical dimensions and mounting', 'coach interior equipment and seating', 'coupler functional design'],
  nativeComponentCount: (motionModel.supplementalParts?.length ?? 0) + valveAdapter.supplementalParts.length + flexibleTransitions.parts.length + staticCoupling.parts.length + loco.parts.length + tender.parts.length + coach.parts.length + 6 * wheel.parts.length + locomotiveMechanics.parts.length + coachMechanics.parts.length,
  locoEvidence: loco.evidence, coachInterfaces: coach.interfaces, tenderInterfaces: tender.interfaces,
  brandingMode: 'existing-authored-outline-master',
  materialMode: 'native-master', physicalApproval: false, visualApproval: false,
});
Object.defineProperties(qa, {
  couplingPose: {get: () => couplingPose},
  motionPose: {get: () => currentMotionPose},
  valvePose: {get: () => currentValvePose},
  coatingState: {get: () => materialLibrary.getCoatingState()},
  state: {get: () => ({...state, structureOnly, busy: qa.busy})},
  shellParameters: {get: () => ({...shellParameters})},
  requestedShellParameters: {get: () => ({...requestedParameters})},
  flexibleTransitionGroup: {get: () => flexibleTransitionGroup},
  flexibleTransitionParameters: {get: () => flexibleTransitions.parameters},
  flexibleTransitionInterfaces: {get: () => flexibleTransitions.interfaces},
  brandingGroup: {get: () => brandingGroup},
  shellGroups: {get: () => [locomotiveShellGroup, tenderGroup, coachGroup, flexibleTransitionGroup]},
  rebuildState: {get: () => rebuildQueue.state},
  renderPending: {get: () => frameQueue.pending},
  renderStats: {get: () => frameQueue.stats},
  frameStats: {get: () => frameQueue.stats},
});
syncControls(); syncParameterInputs(); render();
stage.setAttribute('aria-busy', 'false');
setStatus('A6 连编原生结构已就绪。默认全列正侧；可展开动态演示与连接检查；外壳编辑不改轴位或观察比例。');
