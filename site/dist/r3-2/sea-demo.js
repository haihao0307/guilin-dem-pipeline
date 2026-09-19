import * as THREE from 'three';

const SEA_DISPLAY_DATUM_M = 0;
const SEA_WAVE_AMPLITUDE_M = 0.22;
const SEA_SURFACE_OPACITY = 0.62;
const SEA_VISUAL_STYLE = 'low-frequency-cross-ripple-r2';
const FLAG = Symbol.for('wenzhou.r3.2.sea-demo-r2-installed');

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
      uOpacity: { value: SEA_SURFACE_OPACITY }
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 p = position;
        const float TAU = 6.28318530718;
        float w1 = sin((uv.x * 5.0 + uv.y * 2.0) * TAU + uTime * 0.18) * 0.000090;
        float w2 = sin((uv.x * -3.0 + uv.y * 4.0) * TAU - uTime * 0.13) * 0.000075;
        float w3 = sin((uv.x * 8.0 + uv.y * 7.0) * TAU + uTime * 0.23) * 0.000055;
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
        const float TAU = 6.28318530718;
        float r1 = sin((vUv.x * 13.0 + vUv.y * 7.0) * TAU + uTime * 0.19);
        float r2 = sin((vUv.x * -9.0 + vUv.y * 11.0) * TAU - uTime * 0.14);
        float ripple = 0.5 + 0.25 * r1 + 0.25 * r2;
        float softGlint = smoothstep(0.72, 0.98, ripple);
        float band = clamp(0.5 + vWave * 1.35, 0.0, 1.0);
        vec3 deep = vec3(0.020, 0.185, 0.265);
        vec3 mid = vec3(0.045, 0.315, 0.390);
        vec3 light = vec3(0.180, 0.490, 0.525);
        vec3 color = mix(deep, mid, 0.50 + band * 0.18);
        color = mix(color, light, softGlint * 0.035);
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
    !object.userData?.wenzhouNg51IslandRelief &&
    !object.userData?.wenzhouNg51Bathymetry &&
    !object.userData?.wenzhouFullBathymetry &&
    !object.userData?.wenzhouSurfaceEvidence &&
    !object.userData?.wenzhouLandcoverEvidence &&
    !object.userData?.wenzhouSoilContextEvidence &&
    !object.userData?.wenzhouOsmEvidence &&
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
    canvas.dataset.seaSurfaceOpacity = String(SEA_SURFACE_OPACITY);
    canvas.dataset.seaSurfaceVisualStyle = SEA_VISUAL_STYLE;
    canvas.dataset.seaSurfaceOwnerRole = 'canonical-terrain-candidate';
    canvas.dataset.seaVisible = String(visible);
  }

  function publishState(terrain, mesh, visible) {
    window.__wenzhouSeaSurface = {
      schema: 'wenzhou-sea-surface-display/v2',
      ready: true,
      terrainUuid: terrain.uuid,
      meshUuid: mesh.uuid,
      ownerRole: 'canonical-terrain-candidate',
      visualStyle: SEA_VISUAL_STYLE,
      opacity: SEA_SURFACE_OPACITY,
      displayDatumM: SEA_DISPLAY_DATUM_M,
      waveAmplitudeM: SEA_WAVE_AMPLITUDE_M,
      waveCoordinateSpace: 'normalized-patch-uv',
      decorativeLayerExclusion: true,
      visible
    };
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
    mesh.userData.visualStyle = SEA_VISUAL_STYLE;
    mesh.userData.ownerTerrainUuid = terrain.uuid;
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
    publishState(terrain, mesh, mesh.visible);

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
        if (window.__wenzhouSeaSurface) window.__wenzhouSeaSurface.visible = checkbox.checked;
        if (active.renderer && active.camera) active.renderer.render(active.scene, active.camera);
      } else {
        writeCanvasState(checkbox.checked);
      }
    });
  }
}
