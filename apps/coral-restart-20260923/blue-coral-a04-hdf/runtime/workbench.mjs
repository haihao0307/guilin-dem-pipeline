import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  createNeutralMaterial,
  reconstructCandidate,
  setCandidateDiagnosticColor,
  setCandidateRoughness,
  verifyNoTeacherAliasing,
} from './exact-field-decoder.mjs';
import { runSameCameraSilhouetteAudit } from './silhouette-audit.mjs';

const $ = (selector) => document.querySelector(selector);
const required = (selector) => {
  const element = $(selector);
  if (!element) throw new Error(`Missing workbench element ${selector}`);
  return element;
};

function decodeBase64(text) {
  const compact = text.replace(/\s+/g, '');
  const bytes = new Uint8Array(Math.floor(compact.length * 0.75));
  const block = 1024 * 1024;
  let written = 0;
  for (let start = 0; start < compact.length; start += block) {
    const end = Math.min(compact.length, start + block);
    const alignedEnd = end === compact.length ? end : end - ((end - start) % 4);
    const decoded = atob(compact.slice(start, alignedEnd));
    for (let i = 0; i < decoded.length; i += 1) bytes[written++] = decoded.charCodeAt(i);
    start = alignedEnd - block;
  }
  return bytes.slice(0, written);
}

async function gunzipBase64(text) {
  const compressed = decodeBase64(text);
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

function parseEmbeddedJson(id) {
  const node = required(`#${id}`);
  const value = JSON.parse(node.textContent);
  node.remove();
  return value;
}

async function loadTeacher(sourceGltf, sourceBinary, sourceTexture) {
  const gltf = structuredClone(sourceGltf);
  const binaryUrl = URL.createObjectURL(new Blob([sourceBinary], { type: 'application/octet-stream' }));
  gltf.buffers[0].uri = binaryUrl;
  gltf.images[0].uri = sourceTexture;
  const loader = new GLTFLoader();
  const teacher = await new Promise((resolve, reject) => {
    loader.parse(JSON.stringify(gltf), '', resolve, reject);
  });
  URL.revokeObjectURL(binaryUrl);
  return teacher;
}

function collectMeshes(root) {
  const meshes = [];
  root.traverse((object) => {
    if (object.isMesh) meshes.push(object);
  });
  return meshes;
}

function cloneTeacherMaterialState(meshes) {
  return meshes.map((mesh) => ({ mesh, material: mesh.material }));
}

function restoreTeacherMaterialState(state) {
  for (const item of state) item.mesh.material = item.material;
}

function createTeacherNeutralMaterial() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xa7b5b6,
    roughness: 0.86,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  material.name = 'Blue Coral A04 · teacher neutral diagnostic';
  return material;
}

function addLighting(scene) {
  scene.background = new THREE.Color(0x0e161b);
  scene.add(new THREE.HemisphereLight(0xddeff2, 0x182128, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(2.8, -3.7, 4.6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9bc4db, 1.1);
  fill.position.set(-4, 1.5, 2.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe1d0ad, 0.7);
  rim.position.set(1, 4, -2.5);
  scene.add(rim);
}

function normalizePair(teacherRoot, candidateRoot) {
  teacherRoot.updateMatrixWorld(true);
  candidateRoot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(teacherRoot);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = 2.4 / Math.max(size.x, size.y, size.z);
  for (const root of [teacherRoot, candidateRoot]) {
    root.scale.setScalar(scale);
    root.position.copy(center).multiplyScalar(-scale);
    root.updateMatrixWorld(true);
  }
  return { center, sourceSize: size, scale };
}

function hslColor(hueOffset, saturation, lightness, warmth) {
  const color = new THREE.Color();
  color.setHSL((((196 + hueOffset) % 360) + 360) % 360 / 360, saturation, lightness);
  color.r = THREE.MathUtils.clamp(color.r + warmth * 0.16, 0, 1);
  color.g = THREE.MathUtils.clamp(color.g + warmth * 0.035, 0, 1);
  color.b = THREE.MathUtils.clamp(color.b - warmth * 0.16, 0, 1);
  return color;
}

function createWorkbench({ packageJson, manifest, objectGraph, teacher, candidate }) {
  const canvas = required('#coralCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setScissorTest(true);

  const teacherScene = new THREE.Scene();
  const candidateScene = new THREE.Scene();
  addLighting(teacherScene);
  addLighting(candidateScene);
  teacherScene.add(teacher.scene);
  candidateScene.add(candidate.root);

  const normalization = normalizePair(teacher.scene, candidate.root);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  camera.position.set(3.25, -4.25, 2.85);
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.minDistance = 1.2;
  controls.maxDistance = 12;

  const teacherMeshes = collectMeshes(teacher.scene);
  const teacherOriginalMaterials = cloneTeacherMaterialState(teacherMeshes);
  const teacherNeutralMaterial = createTeacherNeutralMaterial();
  const teacherHeatMaterial = new THREE.MeshBasicMaterial({ color: 0x00d9ff, side: THREE.DoubleSide, transparent: true, opacity: 0.48, depthWrite: false });
  const candidateHeatMaterial = new THREE.MeshBasicMaterial({ color: 0xff3c87, side: THREE.DoubleSide, transparent: true, opacity: 0.48, depthWrite: false });
  const candidateNormalMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
  const candidateBaseMaterial = candidate.material;
  let lastSilhouetteAudit = null;

  const state = {
    mode: 'compare',
    mobilePanel: 'candidate',
    hue: 0,
    saturation: 0.18,
    lightness: 0.66,
    warmth: 0,
    roughness: 0.82,
  };

  const presets = {
    hero: [3.25, -4.25, 2.85],
    front: [0, -5.2, 0],
    back: [0, 5.2, 0],
    left: [-5.2, 0, 0],
    right: [5.2, 0, 0],
    top: [0.001, 0, 5.2],
    bottom: [0.001, 0, -5.2],
  };

  function applyMode() {
    restoreTeacherMaterialState(teacherOriginalMaterials);
    for (const mesh of candidate.meshes) mesh.material = candidateBaseMaterial;
    teacher.scene.visible = true;
    candidate.root.visible = true;
    if (state.mode === 'neutral') {
      for (const mesh of teacherMeshes) mesh.material = teacherNeutralMaterial;
    } else if (state.mode === 'difference' || state.mode === 'overlay') {
      for (const mesh of teacherMeshes) mesh.material = teacherHeatMaterial;
      for (const mesh of candidate.meshes) mesh.material = candidateHeatMaterial;
    } else if (state.mode === 'normals') {
      for (const mesh of candidate.meshes) mesh.material = candidateNormalMaterial;
    } else if (state.mode === 'teacher') {
      candidate.root.visible = false;
    } else if (state.mode === 'candidate') {
      teacher.scene.visible = false;
    }
  }

  function updateCandidateMaterial() {
    const color = hslColor(state.hue, state.saturation, state.lightness, state.warmth);
    setCandidateDiagnosticColor(candidate, color);
    setCandidateRoughness(candidate, state.roughness);
  }

  function setView(name) {
    const position = presets[name] || presets.hero;
    camera.position.fromArray(position);
    camera.up.set(0, 0, 1);
    controls.target.set(0, 0, 0);
    controls.update();
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  }

  function drawScene(scene, x, y, width, height) {
    renderer.setViewport(x, y, width, height);
    renderer.setScissor(x, y, width, height);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  function drawOverlay(x, y, width, height) {
    renderer.setViewport(x, y, width, height);
    renderer.setScissor(x, y, width, height);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.autoClear = true;
    renderer.render(teacherScene, camera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(candidateScene, camera);
    renderer.autoClear = true;
  }

  function render() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const pixelWidth = Math.max(1, Math.round(width * renderer.getPixelRatio()));
    const pixelHeight = Math.max(1, Math.round(height * renderer.getPixelRatio()));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) renderer.setSize(width, height, false);
    renderer.clear();
    const mobile = width < 680;
    const single = ['teacher', 'candidate', 'overlay'].includes(state.mode);
    if (state.mode === 'overlay') {
      drawOverlay(0, 0, canvas.width, canvas.height);
    } else if (single) {
      drawScene(state.mode === 'teacher' ? teacherScene : candidateScene, 0, 0, canvas.width, canvas.height);
    } else if (mobile) {
      const half = Math.floor(canvas.height / 2);
      drawScene(teacherScene, 0, half, canvas.width, canvas.height - half);
      drawScene(candidateScene, 0, 0, canvas.width, half);
    } else {
      const half = Math.floor(canvas.width / 2);
      drawScene(teacherScene, 0, 0, half, canvas.height);
      drawScene(candidateScene, half, 0, canvas.width - half, canvas.height);
    }
  }

  function audit() {
    const noAliasing = verifyNoTeacherAliasing(candidate, teacherMeshes);
    return {
      version: packageJson.version,
      stage: packageJson.stage,
      webgl2: renderer.capabilities.isWebGL2,
      sourceCloneUsed: false,
      gltfLoaderUsedForCandidate: false,
      allSourceAccessorsDecoded: candidate.audit.allSourceAccessorsDecoded,
      decodedAccessorCount: candidate.audit.decodedAccessorCount,
      surfaceCount: candidate.audit.surfaceCount,
      vertexRecordCount: candidate.audit.vertexRecordCount,
      triangleCount: candidate.audit.triangleCount,
      separateTypedArrays: candidate.audit.separateTypedArrays,
      separateArrayBuffers: candidate.audit.separateArrayBuffers,
      separateGpuBuffers: candidate.audit.separateGpuBuffers,
      teacherGeometryAliasCount: noAliasing.geometryAliasCount,
      teacherBufferAliasCount: noAliasing.bufferAliasCount,
      noTeacherAliasing: noAliasing.passed,
      sameScaleSameCameraCompare: true,
      silhouetteAudit: lastSilhouetteAudit,
      meshSimplification: false,
      decimation: false,
      remeshing: false,
      voxelization: false,
      marchingCubes: false,
      structureGrammarUnlocked: false,
      finalGenerator: false,
      productionReady: false,
      normalization: {
        sourceSize: normalization.sourceSize.toArray(),
        scale: normalization.scale,
      },
    };
  }

  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach((other) => other.classList.toggle('active', other === button));
      applyMode();
    });
  });
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));

  const sliders = {
    hue: ['#hue', '#hueValue', (value) => `${value}°`, (value) => Number(value)],
    saturation: ['#saturation', '#saturationValue', (value) => `${value}%`, (value) => Number(value) / 100],
    lightness: ['#lightness', '#lightnessValue', (value) => `${value}%`, (value) => Number(value) / 100],
    warmth: ['#warmth', '#warmthValue', (value) => value, (value) => Number(value) / 100],
    roughness: ['#roughness', '#roughnessValue', (value) => `${value}%`, (value) => Number(value) / 100],
  };
  for (const [key, [inputSelector, outputSelector, format, convert]] of Object.entries(sliders)) {
    const input = required(inputSelector);
    const output = required(outputSelector);
    input.addEventListener('input', () => {
      state[key] = convert(input.value);
      output.textContent = format(input.value);
      updateCandidateMaterial();
    });
  }

  required('#resetMaterial').addEventListener('click', () => {
    const values = { hue: 0, saturation: 18, lightness: 66, warmth: 0, roughness: 82 };
    for (const [key, value] of Object.entries(values)) {
      const input = required(sliders[key][0]);
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
  });
  required('#runAudit').addEventListener('click', () => {
    const result = audit();
    required('#auditOutput').textContent = JSON.stringify(result, null, 2);
    window.__CORAL_AUDIT__ = result;
  });
  required('#runSilhouetteAudit').addEventListener('click', () => {
    const output = required('#auditOutput');
    output.textContent = '正在执行四视角同相机轮廓核验……';
    lastSilhouetteAudit = runSameCameraSilhouetteAudit({
      renderer,
      camera,
      controls,
      teacherScene,
      candidateScene,
      teacherMeshes,
      candidateMeshes: candidate.meshes,
      presets,
    });
    const result = audit();
    output.textContent = JSON.stringify(result, null, 2);
    window.__CORAL_AUDIT__ = result;
    window.__CORAL_SILHOUETTE__ = lastSilhouetteAudit;
  });

  applyMode();
  updateCandidateMaterial();
  setView('hero');
  const loop = () => {
    controls.update();
    render();
    requestAnimationFrame(loop);
  };
  loop();

  const initialAudit = audit();
  required('#auditOutput').textContent = JSON.stringify(initialAudit, null, 2);
  window.__CORAL_AUDIT__ = initialAudit;
  window.coralA04 = {
    audit,
    render,
    setView,
    runSilhouetteAudit() {
      lastSilhouetteAudit = runSameCameraSilhouetteAudit({
        renderer,
        camera,
        controls,
        teacherScene,
        candidateScene,
        teacherMeshes,
        candidateMeshes: candidate.meshes,
        presets,
      });
      window.__CORAL_SILHOUETTE__ = lastSilhouetteAudit;
      window.__CORAL_AUDIT__ = audit();
      return structuredClone(lastSilhouetteAudit);
    },
    setMode(mode) {
      state.mode = mode;
      applyMode();
    },
    getPackage: () => structuredClone(packageJson),
    getManifest: () => structuredClone(manifest),
    getObjectGraph: () => structuredClone(objectGraph),
    candidate,
    teacher,
  };
  window.__CORAL_READY__ = true;
}

async function start() {
  const status = required('#status');
  try {
    const packageJson = parseEmbeddedJson('canonicalPackage');
    const manifest = parseEmbeddedJson('accessorManifest');
    const objectGraph = parseEmbeddedJson('objectGraph');
    const sourceGltf = parseEmbeddedJson('sourceGltf');
    const sourceTexture = required('#sourceTexture').textContent.trim();
    const sourceBinaryPromise = gunzipBase64(required('#sourceBinaryGzip').textContent);
    const fieldPayloadPromise = gunzipBase64(required('#fieldPayloadGzip').textContent);
    const [sourceBinary, fieldPayload] = await Promise.all([sourceBinaryPromise, fieldPayloadPromise]);
    const teacher = await loadTeacher(sourceGltf, sourceBinary, sourceTexture);
    const candidate = reconstructCandidate({
      packageJson,
      manifest,
      objectGraph,
      payload: fieldPayload,
      material: createNeutralMaterial(),
    });
    createWorkbench({ packageJson, manifest, objectGraph, teacher, candidate });
    status.remove();
  } catch (error) {
    console.error(error);
    status.classList.add('failed');
    status.textContent = `A04 启动失败：${error instanceof Error ? error.message : String(error)}`;
    window.__CORAL_READY__ = false;
    window.__CORAL_STARTUP_ERROR__ = String(error?.stack || error);
  }
}

start();
