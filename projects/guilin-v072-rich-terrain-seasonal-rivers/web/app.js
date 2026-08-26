import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const statusNode = $('status');
const viewer = $('viewer');
const labelLayer = $('labelLayer');

const LANDMARKS = [
  { id: 'yangshuo', name: '陽朔縣', lon: 110.4920133, lat: 24.7815129 },
  { id: 'yangtang', name: '秧塘機場', lon: 110.15569, lat: 25.21753 },
  { id: 'guilin', name: '桂林城', lon: 110.2994, lat: 25.2742 },
  { id: 'zhenbaoding', name: '真寶鼎', lon: 110.82528, lat: 26.13556 },
];

const SEASON_PRESETS = {
  winter: { label: '冬季枯水', width: 0.66, depth: 0.32, color: '#42b69d' },
  spring: { label: '春季平水', width: 0.92, depth: 0.55, color: '#45c4b5' },
  summer: { label: '夏季豐水', width: 1.38, depth: 0.88, color: '#348e73' },
  autumn: { label: '秋季回落', width: 0.82, depth: 0.46, color: '#3fa9aa' },
};

const HYDROLOGY_SAMPLE_STEP_M = 180;
const HYDROLOGY_DRAPE_OFFSET_M = 1.6;

let manifest;
let heightValues;
let validMask;
let scene;
let camera;
let renderer;
let controls;
let terrain;
let terrainMaterial;
let terrainShader = null;
let terrainTexture;
let terrainNormal;
let terrainRoughness;
let hydrologyGroup;
let riverMaterials = {};
let labelObjects = [];
let worldWidth;
let worldDepth;
let minElevation;
let maxElevation;
let animationTarget = null;
let currentSeason = 'spring';
let hydrologyDebug = {
  sampled_points: 0,
  ribbon_vertices: 0,
  ribbon_triangles: 0,
  drape_offset_m: HYDROLOGY_DRAPE_OFFSET_M,
  centerline_policy: 'immutable OSM coordinates',
  width_policy: 'lateral ribbon only',
};

function setStatus(text, ok = false) {
  statusNode.textContent = text;
  statusNode.classList.toggle('ok', ok);
}

function decodeHeights(buffer, meta, range) {
  const values = new Uint16Array(buffer);
  const expected = meta.width * meta.height;
  if (values.length !== expected) throw new Error(`高度数据长度异常：${values.length} / ${expected}`);
  const [minimum, maximum] = range;
  const span = maximum - minimum;
  const heights = new Float32Array(values.length);
  const mask = new Uint8Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const code = values[index];
    if (code === meta.nodata_code) {
      heights[index] = minimum;
      mask[index] = 0;
    } else {
      heights[index] = minimum + (code / 65534) * span;
      mask[index] = 1;
    }
  }
  return { heights, mask };
}

function terrainSample(x, z) {
  const width = manifest.height.width;
  const height = manifest.height.height;
  const gx = THREE.MathUtils.clamp(((x + worldWidth / 2) / worldWidth) * (width - 1), 0, width - 1);
  const gy = THREE.MathUtils.clamp(((z + worldDepth / 2) / worldDepth) * (height - 1), 0, height - 1);
  const col = Math.min(width - 2, Math.max(0, Math.floor(gx)));
  const row = Math.min(height - 2, Math.max(0, Math.floor(gy)));
  const fu = gx - col;
  const fv = gy - row;
  const a = row * width + col;
  const d = a + 1;
  const b = a + width;
  const c = b + 1;
  let indices;
  let weights;
  if (fu + fv <= 1) {
    indices = [a, d, b];
    weights = [1 - fu - fv, fu, fv];
  } else {
    indices = [b, c, d];
    weights = [1 - fu, fu + fv - 1, 1 - fv];
  }
  if (indices.some(index => validMask[index] === 0)) {
    return { valid: false, height: minElevation, row, col };
  }
  const sampledHeight = (
    heightValues[indices[0]] * weights[0]
    + heightValues[indices[1]] * weights[1]
    + heightValues[indices[2]] * weights[2]
  );
  return { valid: true, height: sampledHeight, row, col };
}

function utmFromLonLat(lon, lat) {
  return proj4('EPSG:4326', 'EPSG:32649', [lon, lat]);
}

function worldFromUtm(easting, northing) {
  const [centerX, centerY] = manifest.center_epsg32649;
  return new THREE.Vector3(easting - centerX, 0, centerY - northing);
}

function buildTerrain(texture, normalMap, roughnessMap) {
  const width = manifest.height.width;
  const height = manifest.height.height;
  const geometry = new THREE.PlaneGeometry(worldWidth, worldDepth, width - 1, height - 1);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      positions.setY(row * width + col, heightValues[row * width + col]);
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(12, renderer.capabilities.getMaxAnisotropy());
  normalMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.colorSpace = THREE.NoColorSpace;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    normalMap,
    roughnessMap,
    normalScale: new THREE.Vector2(1.35, 1.35),
    roughness: 0.88,
    metalness: 0.0,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uColorRichness = { value: Number($('colorRichness').value) };
    shader.uniforms.uReliefContrast = { value: Number($('karstDetail').value) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uColorRichness;\nuniform float uReliefContrast;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         float terrainLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
         diffuseColor.rgb = mix(vec3(terrainLuma), diffuseColor.rgb, uColorRichness);
         float terrainContrast = mix(0.94, 1.20, clamp(uReliefContrast / 2.5, 0.0, 1.0));
         diffuseColor.rgb = (diffuseColor.rgb - 0.5) * terrainContrast + 0.5;
         diffuseColor.rgb = max(diffuseColor.rgb, vec3(0.0));`
      );
    terrainShader = shader;
  };
  material.customProgramCacheKey = () => 'xiaogui-v072-rich-terrain';

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  scene.add(mesh);
  terrainMaterial = material;
  return mesh;
}

function insideWorld(world) {
  return Math.abs(world.x) <= worldWidth / 2 && Math.abs(world.z) <= worldDepth / 2;
}

function drapePair(startLonLat, endLonLat) {
  const [startE, startN] = utmFromLonLat(startLonLat[0], startLonLat[1]);
  const [endE, endN] = utmFromLonLat(endLonLat[0], endLonLat[1]);
  const start = worldFromUtm(startE, startN);
  const end = worldFromUtm(endE, endN);
  const distance = Math.hypot(end.x - start.x, end.z - start.z);
  const steps = Math.max(1, Math.ceil(distance / HYDROLOGY_SAMPLE_STEP_M));
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const x = THREE.MathUtils.lerp(start.x, end.x, t);
    const z = THREE.MathUtils.lerp(start.z, end.z, t);
    const world = new THREE.Vector3(x, 0, z);
    if (!insideWorld(world)) {
      points.push(null);
      continue;
    }
    const sampled = terrainSample(x, z);
    if (!sampled.valid) {
      points.push(null);
      continue;
    }
    world.y = sampled.height;
    points.push(world);
  }
  return points;
}

function contiguousRuns(feature) {
  const coordinates = feature.geometry.coordinates;
  const runs = [];
  let current = [];
  for (let segmentIndex = 0; segmentIndex < coordinates.length - 1; segmentIndex += 1) {
    const draped = drapePair(coordinates[segmentIndex], coordinates[segmentIndex + 1]);
    if (segmentIndex > 0) draped.shift();
    for (const point of draped) {
      if (point) {
        current.push(point);
      } else if (current.length >= 2) {
        runs.push(current);
        current = [];
      } else {
        current = [];
      }
    }
  }
  if (current.length >= 2) runs.push(current);
  return runs;
}

function addRibbonRun(run, halfWidth, positions, offsets, alongs, indices) {
  let distanceAlong = 0;
  const baseIndex = positions.length / 3;
  for (let index = 0; index < run.length; index += 1) {
    const previous = run[Math.max(0, index - 1)];
    const next = run[Math.min(run.length - 1, index + 1)];
    const tangentX = next.x - previous.x;
    const tangentZ = next.z - previous.z;
    const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
    const perpX = -tangentZ / tangentLength;
    const perpZ = tangentX / tangentLength;
    if (index > 0) distanceAlong += run[index].distanceTo(run[index - 1]);
    for (const side of [-1, 1]) {
      positions.push(run[index].x, run[index].y, run[index].z);
      offsets.push(perpX * halfWidth * side, 0, perpZ * halfWidth * side);
      alongs.push(distanceAlong);
    }
  }
  for (let index = 0; index < run.length - 1; index += 1) {
    const a = baseIndex + index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
}

function buildRiverGeometry(features, system) {
  const positions = [];
  const offsets = [];
  const alongs = [];
  const indices = [];
  const widths = [];
  let sampledPoints = 0;

  for (const feature of features) {
    if (feature.properties.system !== system) continue;
    const baseWidth = Number(feature.properties.base_width_m) || 20;
    widths.push(baseWidth);
    for (const run of contiguousRuns(feature)) {
      sampledPoints += run.length;
      addRibbonRun(run, baseWidth / 2, positions, offsets, alongs, indices);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('riverOffset', new THREE.Float32BufferAttribute(offsets, 3));
  geometry.setAttribute('riverAlong', new THREE.Float32BufferAttribute(alongs, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  hydrologyDebug.sampled_points += sampledPoints;
  hydrologyDebug.ribbon_vertices += positions.length / 3;
  hydrologyDebug.ribbon_triangles += indices.length / 3;
  hydrologyDebug[`${system}_width_m`] = {
    min: widths.length ? Math.min(...widths) : 0,
    max: widths.length ? Math.max(...widths) : 0,
    mean: widths.length ? widths.reduce((sum, value) => sum + value, 0) / widths.length : 0,
  };
  return geometry;
}

function createRiverMaterial(system) {
  const systemTint = {
    li: new THREE.Color('#d8fff7'),
    xiang: new THREE.Color('#d8e6ff'),
    other: new THREE.Color('#9fcbd1'),
  }[system];
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uWidthScale: { value: Number($('riverWidth').value) },
      uDepth: { value: Number($('riverDepth').value) },
      uColor: { value: new THREE.Color($('riverColor').value) },
      uSystemTint: { value: systemTint },
      uOpacity: { value: 0.78 },
      uSurfaceOffset: { value: HYDROLOGY_DRAPE_OFFSET_M },
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute vec3 riverOffset;
      attribute float riverAlong;
      uniform float uWidthScale;
      uniform float uSurfaceOffset;
      varying float vAlong;
      void main() {
        vec3 riverPosition = position + riverOffset * uWidthScale;
        riverPosition.y += uSurfaceOffset;
        vAlong = riverAlong;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(riverPosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uSystemTint;
      uniform float uDepth;
      uniform float uOpacity;
      uniform float uTime;
      varying float vAlong;
      void main() {
        vec3 shallowColor = mix(uColor, vec3(0.46, 0.88, 0.78), 0.22);
        vec3 deepColor = uColor * vec3(0.50, 0.62, 0.66);
        vec3 waterColor = mix(shallowColor, deepColor, clamp(uDepth, 0.0, 1.0));
        waterColor *= uSystemTint;
        float wave = sin(vAlong * 0.008 + uTime * 0.9) * 0.018
                   + sin(vAlong * 0.021 - uTime * 0.55) * 0.010;
        waterColor += wave;
        gl_FragColor = vec4(waterColor, uOpacity);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.toneMapped = true;
  return material;
}

function addHydrology(data) {
  const group = new THREE.Group();
  for (const system of ['other', 'li', 'xiang']) {
    const geometry = buildRiverGeometry(data.features, system);
    if (!geometry.getAttribute('position').count) continue;
    const material = createRiverMaterial(system);
    riverMaterials[system] = material;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = system === 'other' ? 2 : 3;
    group.add(mesh);
  }
  scene.add(group);
  $('liCount').textContent = String(data.feature_counts.li);
  $('xiangCount').textContent = String(data.feature_counts.xiang);
  $('otherCount').textContent = String(data.feature_counts.other);
  return group;
}

function addLandmarks() {
  for (const place of LANDMARKS) {
    const [easting, northing] = utmFromLonLat(place.lon, place.lat);
    const world = worldFromUtm(easting, northing);
    const sampled = terrainSample(world.x, world.z);
    world.y = sampled.height + 4;
    const element = document.createElement('div');
    element.className = 'landmark-label';
    element.dataset.placeId = place.id;
    element.innerHTML = `<strong>${place.name}</strong><small>E ${place.lon.toFixed(6)}° · N ${place.lat.toFixed(6)}°</small>`;
    labelLayer.appendChild(element);
    labelObjects.push({ place, world, element, easting, northing, terrainHeight: sampled.height, rasterRow: sampled.row, rasterCol: sampled.col });
  }
}

function updateLabels() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;
  for (const item of labelObjects) {
    const projected = item.world.clone().project(camera);
    const visible = projected.z > -1 && projected.z < 1;
    item.element.style.display = visible ? 'block' : 'none';
    if (!visible) continue;
    item.element.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
    item.element.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
  }
}

function flyTo(targetId) {
  let target = new THREE.Vector3(0, (minElevation + maxElevation) * 0.25, 0);
  let distance = Math.max(worldWidth, worldDepth) * 0.82;
  if (targetId !== 'overview') {
    const item = labelObjects.find(entry => entry.place.id === targetId);
    if (!item) return;
    target = item.world.clone();
    distance = 30000;
  }
  const direction = new THREE.Vector3(0.55, 0.65, 0.75).normalize();
  animationTarget = {
    startTime: performance.now(),
    duration: 950,
    fromPosition: camera.position.clone(),
    toPosition: target.clone().add(direction.multiplyScalar(distance)),
    fromTarget: controls.target.clone(),
    toTarget: target,
  };
}

function animateFlight(now) {
  if (!animationTarget) return;
  const t = Math.min(1, (now - animationTarget.startTime) / animationTarget.duration);
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  camera.position.lerpVectors(animationTarget.fromPosition, animationTarget.toPosition, eased);
  controls.target.lerpVectors(animationTarget.fromTarget, animationTarget.toTarget, eased);
  if (t >= 1) animationTarget = null;
}

function resize() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function updateTerrainControls() {
  const colorRichness = Number($('colorRichness').value);
  const detailStrength = Number($('karstDetail').value);
  $('colorRichnessValue').textContent = `${colorRichness.toFixed(2)}×`;
  $('karstDetailValue').textContent = `${detailStrength.toFixed(2)}×`;
  if (terrainShader) {
    terrainShader.uniforms.uColorRichness.value = colorRichness;
    terrainShader.uniforms.uReliefContrast.value = detailStrength;
  }
  if (terrainMaterial) {
    terrainMaterial.normalScale.set(detailStrength, detailStrength);
    terrainMaterial.needsUpdate = true;
  }
  publishRenderContract();
}

function updateRiverControls() {
  const width = Number($('riverWidth').value);
  const depth = Number($('riverDepth').value);
  const color = $('riverColor').value;
  $('riverWidthValue').textContent = `${width.toFixed(2)}×`;
  $('riverDepthValue').textContent = `${Math.round(depth * 100)}%`;
  $('riverColorValue').textContent = color.toUpperCase();
  for (const material of Object.values(riverMaterials)) {
    material.uniforms.uWidthScale.value = width;
    material.uniforms.uDepth.value = depth;
    material.uniforms.uColor.value.set(color);
    material.uniforms.uOpacity.value = 0.62 + depth * 0.28;
  }
  hydrologyDebug.width_scale = width;
  hydrologyDebug.depth_visual = depth;
  hydrologyDebug.color = color;
  publishRiverContract();
}

function applySeason(name) {
  const preset = SEASON_PRESETS[name];
  if (!preset) return;
  currentSeason = name;
  $('riverWidth').value = String(preset.width);
  $('riverDepth').value = String(preset.depth);
  $('riverColor').value = preset.color;
  document.querySelectorAll('[data-season]').forEach(button => button.classList.toggle('active', button.dataset.season === name));
  $('seasonName').textContent = preset.label;
  updateRiverControls();
}

function publishCoordinateContract() {
  window.__XIAOGUI_COORDINATE_CONTRACT = {
    version: 'v3',
    world_axes: { x: 'east-positive', z: 'south-positive', north: 'negative-z' },
    source_raster: { row_0: 'north', row_last: 'south' },
    landmarks: Object.fromEntries(labelObjects.map(item => [item.place.id, {
      lon: item.place.lon,
      lat: item.place.lat,
      easting: item.easting,
      northing: item.northing,
      x: item.world.x,
      y: item.world.y,
      z: item.world.z,
      terrain_height: item.terrainHeight,
      raster_row: item.rasterRow,
      raster_col: item.rasterCol,
    }])),
  };
}

function publishRenderContract() {
  window.__XIAOGUI_RENDER_CONTRACT = {
    version: 'v0.7.2',
    source_elevation_modified_m: 0,
    vertical_scale: 1,
    color_richness: Number($('colorRichness').value),
    karst_detail_normal_scale: Number($('karstDetail').value),
    texture_file: manifest?.texture?.file,
    normal_file: manifest?.normal?.file,
    roughness_file: manifest?.roughness?.file,
    karst_detail_file: manifest?.karst_detail?.file,
  };
}

function publishRiverContract() {
  window.__XIAOGUI_RIVER_CONTRACT = {
    version: 'v0.7.2',
    season: currentSeason,
    centerline_geometry_mutated: false,
    controls: {
      width_scale: Number($('riverWidth').value),
      depth_visual: Number($('riverDepth').value),
      color: $('riverColor').value,
    },
    geometry: hydrologyDebug,
  };
}

async function boot() {
  try {
    proj4.defs('EPSG:32649', '+proj=utm +zone=49 +datum=WGS84 +units=m +no_defs +type=crs');
    const loader = new THREE.TextureLoader();
    const [manifestResponse, heightResponse, texture, normalMap, roughnessMap, hydrologyResponse] = await Promise.all([
      fetch('./data/terrain_manifest.json', { cache: 'no-store' }),
      fetch('./data/terrain_height_u16.bin', { cache: 'no-store' }),
      loader.loadAsync('./data/terrain_texture.webp'),
      loader.loadAsync('./data/terrain_normal.png'),
      loader.loadAsync('./data/terrain_roughness.webp'),
      fetch('./data/osm_hydrology.geojson', { cache: 'no-store' }),
    ]);
    if (!manifestResponse.ok || !heightResponse.ok || !hydrologyResponse.ok) throw new Error('三維資產讀取失敗');

    manifest = await manifestResponse.json();
    const decoded = decodeHeights(await heightResponse.arrayBuffer(), manifest.height, manifest.elevation_range_m);
    heightValues = decoded.heights;
    validMask = decoded.mask;
    [worldWidth, worldDepth] = manifest.world_size_m;
    [minElevation, maxElevation] = manifest.elevation_range_m;
    terrainTexture = texture;
    terrainNormal = normalMap;
    terrainRoughness = roughnessMap;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07110c);
    scene.fog = new THREE.FogExp2(0x07110c, 0.0000042);

    camera = new THREE.PerspectiveCamera(44, 1, 50, 800000);
    camera.position.set(worldWidth * 0.55, 155000, worldDepth * 0.72);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    viewer.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 450, 0);
    controls.minDistance = 3500;
    controls.maxDistance = 600000;
    controls.maxPolarAngle = Math.PI * 0.49;

    scene.add(new THREE.HemisphereLight(0xeef7ff, 0x20382b, 1.75));
    const sun = new THREE.DirectionalLight(0xfff0cf, 2.55);
    sun.position.set(-80000, 140000, 90000);
    scene.add(sun);

    terrain = buildTerrain(texture, normalMap, roughnessMap);
    hydrologyGroup = addHydrology(await hydrologyResponse.json());
    addLandmarks();

    $('source').textContent = manifest.source_mosaic;
    $('grid').textContent = `${manifest.source_grid[0]} × ${manifest.source_grid[1]}`;
    $('world').textContent = `${(worldWidth / 1000).toFixed(1)} × ${(worldDepth / 1000).toFixed(1)} km`;
    $('elevation').textContent = `${minElevation.toFixed(0)}…${maxElevation.toFixed(0)} m`;
    $('meshGrid').textContent = `${manifest.height.width} × ${manifest.height.height}`;
    $('textureGrid').textContent = `${manifest.texture.width} × ${manifest.texture.height}`;

    $('terrainToggle').addEventListener('change', event => {
      terrain.material.map = event.target.checked ? terrainTexture : null;
      terrain.material.needsUpdate = true;
    });
    $('wireToggle').addEventListener('change', event => { terrain.material.wireframe = event.target.checked; });
    $('hydrologyToggle').addEventListener('change', event => { hydrologyGroup.visible = event.target.checked; });
    $('labelsToggle').addEventListener('change', event => { labelLayer.style.display = event.target.checked ? 'block' : 'none'; });
    $('colorRichness').addEventListener('input', updateTerrainControls);
    $('karstDetail').addEventListener('input', updateTerrainControls);
    $('riverWidth').addEventListener('input', () => { currentSeason = 'custom'; $('seasonName').textContent = '自訂'; updateRiverControls(); });
    $('riverDepth').addEventListener('input', () => { currentSeason = 'custom'; $('seasonName').textContent = '自訂'; updateRiverControls(); });
    $('riverColor').addEventListener('input', () => { currentSeason = 'custom'; $('seasonName').textContent = '自訂'; updateRiverControls(); });
    document.querySelectorAll('[data-season]').forEach(button => button.addEventListener('click', () => applySeason(button.dataset.season)));
    document.querySelectorAll('[data-target]').forEach(button => button.addEventListener('click', () => flyTo(button.dataset.target)));

    updateTerrainControls();
    applySeason('spring');
    publishCoordinateContract();
    publishRenderContract();
    publishRiverContract();

    resize();
    window.addEventListener('resize', resize);
    window.__XIAOGUI_TERRAIN_READY = true;
    setStatus('豐富地表、峰叢細節與季節河道已載入', true);

    function frame(now) {
      requestAnimationFrame(frame);
      animateFlight(now);
      controls.update();
      updateLabels();
      for (const material of Object.values(riverMaterials)) material.uniforms.uTime.value = now * 0.001;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    setStatus(error.message || String(error), false);
  }
}

boot();
