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

const HYDROLOGY_SAMPLE_STEP_M = 120;
const HYDROLOGY_DRAPE_OFFSET_M = 2;

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
let hydrologyDebug = { sampled_vertices: 0, drape_offset_m: HYDROLOGY_DRAPE_OFFSET_M };

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

  const gx = THREE.MathUtils.clamp(
    ((x + worldWidth / 2) / worldWidth) * (width - 1),
    0,
    width - 1
  );
  const gy = THREE.MathUtils.clamp(
    ((z + worldDepth / 2) / worldDepth) * (height - 1),
    0,
    height - 1
  );

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
  return new THREE.Vector3(
    easting - centerX,
    0,
    centerY - northing
  );
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
    world.y = sampled.height + HYDROLOGY_DRAPE_OFFSET_M;
    points.push(world);
  }

  return points;
}

function featureSegments(features, system) {
  const vertices = [];
  let sampledVertices = 0;

  for (const feature of features) {
    if (feature.properties.system !== system) continue;
    const coordinates = feature.geometry.coordinates;
    for (let segmentIndex = 0; segmentIndex < coordinates.length - 1; segmentIndex += 1) {
      const draped = drapePair(coordinates[segmentIndex], coordinates[segmentIndex + 1]);
      let previous = null;
      for (const current of draped) {
        if (previous && current) {
          vertices.push(previous.x, previous.y, previous.z);
          vertices.push(current.x, current.y, current.z);
          sampledVertices += 2;
        }
        previous = current;
      }
    }
  }

  hydrologyDebug.sampled_vertices += sampledVertices;
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
      depthTest: true,
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
    const sampled = terrainSample(world.x, world.z);
    world.y = sampled.height + 4;

    const element = document.createElement('div');
    element.className = 'landmark-label';
    element.dataset.placeId = place.id;
    element.innerHTML = `<strong>${place.name}</strong><small>E ${place.lon.toFixed(6)}° · N ${place.lat.toFixed(6)}°</small>`;
    labelLayer.appendChild(element);
    labelObjects.push({
      place,
      world,
      element,
      easting,
      northing,
      terrainHeight: sampled.height,
      rasterRow: sampled.row,
      rasterCol: sampled.col,
    });
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

function publishCoordinateContract() {
  window.__XIAOGUI_COORDINATE_CONTRACT = {
    version: 'v2',
    world_axes: {
      x: 'east-positive',
      z: 'south-positive',
      north: 'negative-z',
    },
    source_raster: {
      row_0: 'north',
      row_last: 'south',
    },
    hydrology: hydrologyDebug,
    landmarks: Object.fromEntries(labelObjects.map(item => [
      item.place.id,
      {
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
      },
    ])),
  };
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

    camera = new THREE.PerspectiveCamera(44, 1, 50, 800000);
    camera.position.set(worldWidth * 0.55, 155000, worldDepth * 0.72);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
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
    publishCoordinateContract();

    $('source').textContent = manifest.source_mosaic;
    $('grid').textContent = `${manifest.source_grid[0]} × ${manifest.source_grid[1]}`;
    $('world').textContent = `${(worldWidth / 1000).toFixed(1)} × ${(worldDepth / 1000).toFixed(1)} km`;
    $('elevation').textContent = `${minElevation.toFixed(0)}…${maxElevation.toFixed(0)} m`;

    $('terrainToggle').addEventListener('change', event => {
      terrain.material.map = event.target.checked ? texture : null;
      terrain.material.needsUpdate = true;
    });
    $('wireToggle').addEventListener('change', event => { terrain.material.wireframe = event.target.checked; });
    $('hydrologyToggle').addEventListener('change', event => { hydrologyGroup.visible = event.target.checked; });
    $('labelsToggle').addEventListener('change', event => {
      labelLayer.style.display = event.target.checked ? 'block' : 'none';
    });
    document.querySelectorAll('[data-target]').forEach(button => {
      button.addEventListener('click', () => flyTo(button.dataset.target));
    });

    resize();
    window.addEventListener('resize', resize);
    window.__XIAOGUI_TERRAIN_READY = true;
    setStatus('三維地形與貼地 OSM 水系已載入', true);

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
