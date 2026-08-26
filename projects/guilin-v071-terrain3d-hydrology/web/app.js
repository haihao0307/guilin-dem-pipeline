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

let manifest;
let heightValues;
let validMask;
let scene;
let camera;
let renderer;
let controls;
let terrain;
let hydrologyGroup;
let labelObjects = [];
let worldWidth;
let worldDepth;
let minElevation;
let maxElevation;
let animationTarget = null;

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

function sampleHeight(x, z) {
  const width = manifest.height.width;
  const height = manifest.height.height;
  const u = THREE.MathUtils.clamp((x + worldWidth / 2) / worldWidth, 0, 1);
  const v = THREE.MathUtils.clamp((worldDepth / 2 - z) / worldDepth, 0, 1);
  const col = Math.min(width - 1, Math.max(0, Math.round(u * (width - 1))));
  const row = Math.min(height - 1, Math.max(0, Math.round(v * (height - 1))));
  const index = row * width + col;
  return validMask[index] ? heightValues[index] : minElevation;
}

function utmFromLonLat(lon, lat) {
  return proj4('EPSG:4326', 'EPSG:32649', [lon, lat]);
}

function worldFromUtm(easting, northing) {
  const [centerX, centerY] = manifest.center_epsg32649;
  return new THREE.Vector3(easting - centerX, 0, northing - centerY);
}

function buildTerrain(texture) {
  const width = manifest.height.width;
  const height = manifest.height.height;
  const geometry = new THREE.PlaneGeometry(worldWidth, worldDepth, width - 1, height - 1);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const index = row * width + col;
      positions.setY(index, heightValues[index]);
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function featureSegments(features, system) {
  const vertices = [];
  for (const feature of features) {
    if (feature.properties.system !== system) continue;
    const points = feature.geometry.coordinates
      .map(([lon, lat]) => {
        const [easting, northing] = utmFromLonLat(lon, lat);
        const world = worldFromUtm(easting, northing);
        if (Math.abs(world.x) > worldWidth / 2 || Math.abs(world.z) > worldDepth / 2) return null;
        world.y = sampleHeight(world.x, world.z) + (system === 'other' ? 22 : 34);
        return world;
      })
      .filter(Boolean);
    for (let index = 0; index < points.length - 1; index += 1) {
      vertices.push(points[index].x, points[index].y, points[index].z);
      vertices.push(points[index + 1].x, points[index + 1].y, points[index + 1].z);
    }
  }
  return new Float32Array(vertices);
}

function addHydrology(data) {
  const group = new THREE.Group();
  const styles = {
    li: { color: 0x58f2ff, opacity: 1.0 },
    xiang: { color: 0x72a7ff, opacity: 1.0 },
    other: { color: 0x4f9db2, opacity: 0.43 },
  };
  for (const system of ['other', 'li', 'xiang']) {
    const positions = featureSegments(data.features, system);
    if (!positions.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: styles[system].color,
      transparent: true,
      opacity: styles[system].opacity,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.renderOrder = system === 'other' ? 2 : 3;
    group.add(lines);
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
    world.y = sampleHeight(world.x, world.z) + 55;
    const element = document.createElement('div');
    element.className = 'landmark-label';
    element.dataset.placeId = place.id;
    element.innerHTML = `<strong>${place.name}</strong><small>Lon ${place.lon.toFixed(6)} · Lat ${place.lat.toFixed(6)}</small><small>UTM49N E ${easting.toFixed(1)} · N ${northing.toFixed(1)}</small>`;
    labelLayer.appendChild(element);
    labelObjects.push({ place, world, element });
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

async function boot() {
  try {
    proj4.defs('EPSG:32649', '+proj=utm +zone=49 +datum=WGS84 +units=m +no_defs +type=crs');
    const [manifestResponse, heightResponse, texture, hydrologyResponse] = await Promise.all([
      fetch('./data/terrain_manifest.json', { cache: 'no-store' }),
      fetch('./data/terrain_height_u16.bin', { cache: 'no-store' }),
      new THREE.TextureLoader().loadAsync('./data/terrain_texture.webp'),
      fetch('./data/osm_hydrology.geojson', { cache: 'no-store' }),
    ]);
    if (!manifestResponse.ok || !heightResponse.ok || !hydrologyResponse.ok) throw new Error('三维资产读取失败');
    manifest = await manifestResponse.json();
    const decoded = decodeHeights(await heightResponse.arrayBuffer(), manifest.height, manifest.elevation_range_m);
    heightValues = decoded.heights;
    validMask = decoded.mask;
    [worldWidth, worldDepth] = manifest.world_size_m;
    [minElevation, maxElevation] = manifest.elevation_range_m;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07110c);
    scene.fog = new THREE.FogExp2(0x07110c, 0.0000042);

    camera = new THREE.PerspectiveCamera(44, 1, 10, 1200000);
    camera.position.set(worldWidth * 0.55, 155000, worldDepth * 0.72);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    viewer.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 450, 0);
    controls.minDistance = 4000;
    controls.maxDistance = 600000;
    controls.maxPolarAngle = Math.PI * 0.49;

    scene.add(new THREE.HemisphereLight(0xeef7ff, 0x22382c, 1.8));
    const sun = new THREE.DirectionalLight(0xfff4d6, 2.4);
    sun.position.set(-80000, 140000, 90000);
    scene.add(sun);

    terrain = buildTerrain(texture);
    hydrologyGroup = addHydrology(await hydrologyResponse.json());
    addLandmarks();

    $('source').textContent = manifest.source_mosaic;
    $('grid').textContent = `${manifest.source_grid[0]} × ${manifest.source_grid[1]}`;
    $('world').textContent = `${(worldWidth / 1000).toFixed(1)} × ${(worldDepth / 1000).toFixed(1)} km`;
    $('elevation').textContent = `${minElevation.toFixed(0)}…${maxElevation.toFixed(0)} m`;

    $('terrainToggle').addEventListener('change', event => { terrain.material.map = event.target.checked ? texture : null; terrain.material.needsUpdate = true; });
    $('wireToggle').addEventListener('change', event => { terrain.material.wireframe = event.target.checked; });
    $('hydrologyToggle').addEventListener('change', event => { hydrologyGroup.visible = event.target.checked; });
    $('labelsToggle').addEventListener('change', event => { labelLayer.style.display = event.target.checked ? 'block' : 'none'; });
    document.querySelectorAll('[data-target]').forEach(button => button.addEventListener('click', () => flyTo(button.dataset.target)));

    resize();
    window.addEventListener('resize', resize);
    window.__XIAOGUI_TERRAIN_READY = true;
    setStatus('三維地形與 OSM 水系已載入', true);

    function frame(now) {
      requestAnimationFrame(frame);
      animateFlight(now);
      controls.update();
      updateLabels();
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    setStatus(error.message || String(error), false);
  }
}

boot();
