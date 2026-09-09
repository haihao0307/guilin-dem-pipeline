import * as THREE from 'three';

const SEA_DISPLAY_DATUM_M = 0;
const SEA_WAVE_AMPLITUDE_M = 0.22;
const FLAG = Symbol.for('wenzhou.r3.2.sea-demo-installed');

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

function isTerrainCandidate(object) {
  return !!(
    object?.isMesh &&
    !object.userData?.wenzhouSeaDemo &&
    object.material?.alphaMap &&
    object.geometry?.attributes?.uv &&
    object.geometry?.attributes?.position
  );
}

export function installSeaDemo() {
  if (THREE.Object3D.prototype[FLAG]) return;
  THREE.Object3D.prototype[FLAG] = true;

  const originalAdd = THREE.Object3D.prototype.add;
  const reducedMotion = matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  let active = null;

  function writeCanvasState(visible) {
    const canvas = document.getElementById('terrain');
    if (!canvas) return;
    canvas.dataset.seaSurfaceKind = 'demonstration';
    canvas.dataset.seaDisplayDatumM = String(SEA_DISPLAY_DATUM_M);
    canvas.dataset.seaWaveAmplitudeM = String(SEA_WAVE_AMPLITUDE_M);
    canvas.dataset.seaVisible = String(visible);
  }

  function disposeActive() {
    if (!active) return;
    active.disposed = true;
    active.scene.remove(active.mesh);
    active.mesh.geometry?.dispose();
    active.mesh.material?.dispose();
    active = null;
  }

  function createForTerrain(scene, terrain) {
    if (active?.terrainUuid === terrain.uuid) return;
    disposeActive();
    terrain.geometry.computeBoundingBox();
    const geometry = buildSeaGeometry(terrain.geometry.boundingBox, window.innerWidth < 760 ? 40 : 72);
    const material = buildSeaMaterial(terrain.material.alphaMap);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.wenzhouSeaDemo = true;
    mesh.userData.kind = 'demonstration-environment-layer';
    mesh.userData.displayDatumM = SEA_DISPLAY_DATUM_M;
    mesh.userData.waveAmplitudeM = SEA_WAVE_AMPLITUDE_M;
    mesh.renderOrder = 1;

    const checkbox = document.getElementById('show-sea');
    mesh.visible = checkbox ? checkbox.checked : true;
    const layer = {
      scene,
      mesh,
      material,
      terrainUuid: terrain.uuid,
      disposed: false,
      loopStarted: false,
      renderer: null,
      camera: null,
      lastFrame: 0
    };
    active = layer;
    originalAdd.call(scene, mesh);
    writeCanvasState(mesh.visible);

    mesh.onBeforeRender = (renderer, renderScene, camera) => {
      if (layer.disposed) return;
      layer.renderer = renderer;
      layer.scene = renderScene;
      layer.camera = camera;
      material.uniforms.uTime.value = reducedMotion ? 0 : performance.now() * 0.001;
      if (layer.loopStarted || reducedMotion) return;
      layer.loopStarted = true;
      const tick = time => {
        if (layer.disposed) return;
        if (layer.mesh.visible && layer.renderer && layer.camera && time - layer.lastFrame >= 33) {
          layer.material.uniforms.uTime.value = time * 0.001;
          layer.renderer.render(layer.scene, layer.camera);
          layer.lastFrame = time;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
  }

  THREE.Object3D.prototype.add = function(...objects) {
    const result = originalAdd.apply(this, objects);
    if (this.isScene) {
      for (const object of objects) {
        if (isTerrainCandidate(object)) {
          createForTerrain(this, object);
          break;
        }
      }
    }
    return result;
  };

  const checkbox = document.getElementById('show-sea');
  if (checkbox && !checkbox.dataset.boundSeaDemo) {
    checkbox.dataset.boundSeaDemo = 'true';
    checkbox.addEventListener('change', () => {
      if (active) {
        active.mesh.visible = checkbox.checked;
        writeCanvasState(checkbox.checked);
        if (active.renderer && active.camera) active.renderer.render(active.scene, active.camera);
      } else {
        writeCanvasState(checkbox.checked);
      }
    });
  }
}
