import * as THREE from 'three';

const SEA_DISPLAY_DATUM_M = 0;
const SEA_WAVE_AMPLITUDE_M = 0.22;
const FLAG = Symbol.for('wenzhou.r3.2.sea-demo-installed');

function findTerrain(scene) {
  let found = null;
  scene.traverse(object => {
    if (found || !object?.isMesh || object.userData?.wenzhouSeaDemo) return;
    const material = object.material;
    if (material?.alphaMap && object.geometry?.attributes?.uv && object.geometry?.attributes?.position) found = object;
  });
  return found;
}

function buildSeaGeometry(box, segments) {
  const minX = box.min.x, maxX = box.max.x, minZ = box.min.z, maxZ = box.max.z;
  const nx = segments, nz = segments;
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
  const uvs = new Float32Array((nx + 1) * (nz + 1) * 2);
  const indices = [];
  let p = 0, q = 0;
  for (let j = 0; j <= nz; j++) {
    const tz = j / nz;
    const z = THREE.MathUtils.lerp(minZ, maxZ, tz);
    for (let i = 0; i <= nx; i++) {
      const tx = i / nx;
      const x = THREE.MathUtils.lerp(minX, maxX, tx);
      positions[p++] = x;
      positions[p++] = SEA_DISPLAY_DATUM_M / 1000;
      positions[p++] = z;
      uvs[q++] = tx;
      uvs[q++] = 1 - tz;
    }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function buildSeaMaterial(landMask) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLandMask: { value: landMask },
      uTime: { value: 0 },
      uOpacity: { value: 0.78 }
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 p = position;
        float xm = p.x * 1000.0;
        float zm = p.z * 1000.0;
        float w1 = sin(xm * 0.035 + uTime * 0.85) * 0.00012;
        float w2 = sin(zm * 0.052 - uTime * 0.58) * 0.000065;
        float w3 = sin((xm + zm) * 0.11 + uTime * 1.25) * 0.000035;
        p.y += w1 + w2 + w3;
        vWave = (w1 + w2 + w3) * 1000.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uLandMask;
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        float land = texture2D(uLandMask, vUv).g;
        float sea = 1.0 - land;
        if (sea < 0.5) discard;
        float shimmer = 0.5 + 0.5 * sin(vUv.x * 1250.0 + vUv.y * 760.0 + uTime * 2.0);
        float band = clamp(0.5 + vWave * 1.8, 0.0, 1.0);
        vec3 deep = vec3(0.025, 0.20, 0.29);
        vec3 mid = vec3(0.05, 0.34, 0.43);
        vec3 light = vec3(0.20, 0.55, 0.62);
        vec3 color = mix(deep, mid, 0.45 + band * 0.25);
        color = mix(color, light, shimmer * 0.08);
        gl_FragColor = vec4(color, uOpacity * sea);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

export function installSeaDemo() {
  if (THREE.WebGLRenderer.prototype[FLAG]) return;
  THREE.WebGLRenderer.prototype[FLAG] = true;
  const originalRender = THREE.WebGLRenderer.prototype.render;
  let sea = null;
  let terrainUuid = null;
  let loopStarted = false;
  let activeRenderer = null, activeScene = null, activeCamera = null;
  let lastFrame = 0;
  const reducedMotion = matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  function ensureSea(scene) {
    const terrain = findTerrain(scene);
    if (!terrain) return null;
    if (sea && terrainUuid === terrain.uuid) return sea;
    if (sea) {
      scene.remove(sea);
      sea.geometry?.dispose();
      sea.material?.dispose();
    }
    terrain.geometry.computeBoundingBox();
    const segments = window.innerWidth < 760 ? 40 : 72;
    const geometry = buildSeaGeometry(terrain.geometry.boundingBox, segments);
    const material = buildSeaMaterial(terrain.material.alphaMap);
    sea = new THREE.Mesh(geometry, material);
    sea.userData.wenzhouSeaDemo = true;
    sea.userData.kind = 'demonstration-environment-layer';
    sea.userData.displayDatumM = SEA_DISPLAY_DATUM_M;
    sea.userData.waveAmplitudeM = SEA_WAVE_AMPLITUDE_M;
    sea.renderOrder = 1;
    terrainUuid = terrain.uuid;
    scene.add(sea);
    const checkbox = document.getElementById('show-sea');
    sea.visible = checkbox ? checkbox.checked : true;
    const canvas = document.getElementById('terrain');
    if (canvas) {
      canvas.dataset.seaSurfaceKind = 'demonstration';
      canvas.dataset.seaDisplayDatumM = String(SEA_DISPLAY_DATUM_M);
      canvas.dataset.seaWaveAmplitudeM = String(SEA_WAVE_AMPLITUDE_M);
      canvas.dataset.seaVisible = String(sea.visible);
    }
    return sea;
  }

  function updateToggle() {
    const checkbox = document.getElementById('show-sea');
    if (!checkbox) return;
    if (!checkbox.dataset.boundSeaDemo) {
      checkbox.dataset.boundSeaDemo = 'true';
      checkbox.addEventListener('change', () => {
        if (sea) sea.visible = checkbox.checked;
        const canvas = document.getElementById('terrain');
        if (canvas) canvas.dataset.seaVisible = String(checkbox.checked);
        if (activeRenderer && activeScene && activeCamera) originalRender.call(activeRenderer, activeScene, activeCamera);
      });
    }
  }

  function startLoop() {
    if (loopStarted) return;
    loopStarted = true;
    const tick = time => {
      if (activeRenderer && activeScene && activeCamera && sea?.visible && !reducedMotion && time - lastFrame >= 33) {
        sea.material.uniforms.uTime.value = time * 0.001;
        originalRender.call(activeRenderer, activeScene, activeCamera);
        lastFrame = time;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  THREE.WebGLRenderer.prototype.render = function(scene, camera) {
    activeRenderer = this; activeScene = scene; activeCamera = camera;
    updateToggle();
    const current = ensureSea(scene);
    if (current && reducedMotion) current.material.uniforms.uTime.value = 0;
    startLoop();
    return originalRender.call(this, scene, camera);
  };
}

installSeaDemo();
