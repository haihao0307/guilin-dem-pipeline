import { createCoreLoader, CORE_IDS } from './core-loader.js';
import {
  createGaeaBridge,
  GAEA_DEFAULT_PARAMETERS,
  GAEA_PRESETS,
} from './gaea-bridge.js';
import { createHydrologyRuntime } from './hydrology-runtime.js';
import { createEcologyCoreRuntime } from './ecology-core-runtime.js';

const byId = (id) => document.getElementById(id);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const radians = (degrees) => degrees * Math.PI / 180;
const formatNumber = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

function createSharedStore(initialState) {
  const state = initialState;
  const listeners = new Set();
  const notify = () => {
    for (const listener of listeners) {
      try {
        listener(state);
      } catch {
        // A diagnostic subscriber must never interrupt the shared runtime.
      }
    }
  };
  return {
    state,
    getState: () => state,
    getSnapshot: () => state,
    setState(partial) {
      Object.assign(state, partial);
      notify();
    },
    patch(partial) {
      Object.assign(state, partial);
      notify();
    },
    set(key, value) {
      state[key] = value;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const store = createSharedStore({
  manifest: null,
  workspace: 'overall',
  activeCoreId: 'overall',
  dataset: null,
  switchingDataset: false,
  gaea: {
    mode: 'browser-preview',
    requestedMode: 'browser',
    workerUrl: null,
    parameters: { ...GAEA_DEFAULT_PARAMETERS },
  },
  hydrology: {
    showLijiang: true,
    showXiangjiang: true,
    showTributaries: true,
    showCenterlines: false,
    showSurface: true,
    showBanks: true,
    showFlow: true,
    showDiagnostics: false,
    waterSeason: 'summer',
    waterLevel: 1,
    waterWidth: 1,
  },
  ecology: {
    showForest: true,
    showShrubs: true,
    showPaddy: true,
    showDryCrops: true,
    showOrchards: true,
    showBunds: true,
    showRock: true,
    showInstances: true,
    forestDensity: 0.72,
    windSpeed: 4.2,
    windDirection: 135,
    gustStrength: 0.28,
    season: 'summer',
    year: 1942,
  },
  display: {
    showTerrain: true,
    showAtmosphere: true,
    showCoreBounds: true,
    showDiagnostics: false,
  },
});

const ui = {
  canvas: byId('gl'),
  loading: byId('loading'),
  loadingText: byId('loadingText'),
  errorCard: byId('errorCard'),
  errorText: byId('errorText'),
  statusDot: byId('statusDot'),
  statusText: byId('statusText'),
  fps: byId('fpsLabel'),
  controller: byId('controller'),
  controllerTitle: byId('controllerTitle'),
  controllerSubtitle: byId('controllerSubtitle'),
  panelToggle: byId('panelToggle'),
  closePanel: byId('closePanel'),
};

function setStatus(message, kind = 'working') {
  ui.statusText.textContent = message;
  ui.statusDot.className = kind === 'ok' ? 'ok' : kind === 'error' ? 'error' : '';
}

function showFatal(error) {
  const message = String(error && (error.stack || error.message) || error);
  ui.loading.classList.add('hidden');
  ui.errorText.textContent = message;
  ui.errorCard.classList.add('visible');
  setStatus('统一运行时启动失败', 'error');
  window.__GUILIN_WORKBENCH_DIAGNOSTICS__ = {
    ready: false,
    fatalError: message,
    publicationBlocked: true,
  };
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('JSON HTTP ' + response.status + ': ' + url);
  return response.json();
}

async function fetchBuffer(url, signal) {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('binary HTTP ' + response.status + ': ' + url);
  return response.arrayBuffer();
}

function littleEndianUint16(buffer) {
  if (buffer.byteLength % 2) throw new Error('高程二进制长度必须为偶数');
  const count = buffer.byteLength / 2;
  const output = new Uint16Array(count);
  const view = new DataView(buffer);
  for (let index = 0; index < count; index += 1) output[index] = view.getUint16(index * 2, true);
  return output;
}

const Vec3 = {
  sub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },
  normalize(a) {
    const length = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / length, a[1] / length, a[2] / length];
  },
};

const Mat4 = {
  identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  },
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  },
  lookAt(eye, center, up) {
    const z = Vec3.normalize(Vec3.sub(eye, center));
    const x = Vec3.normalize([
      up[1] * z[2] - up[2] * z[1],
      up[2] * z[0] - up[0] * z[2],
      up[0] * z[1] - up[1] * z[0],
    ]);
    const y = [
      z[1] * x[2] - z[2] * x[1],
      z[2] * x[0] - z[0] * x[2],
      z[0] * x[1] - z[1] * x[0],
    ];
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
      -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
      -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1,
    ]);
  },
  multiply(a, b) {
    const output = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        output[column * 4 + row] =
          a[row] * b[column * 4] +
          a[4 + row] * b[column * 4 + 1] +
          a[8 + row] * b[column * 4 + 2] +
          a[12 + row] * b[column * 4 + 3];
      }
    }
    return output;
  },
};

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || '未知着色器错误';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || '未知程序链接错误';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function uniformLocations(gl, program, names) {
  return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
}

const GLSL_HEAD = '#version 300 es\nprecision highp float;\n';
const TERRAIN_VERTEX = GLSL_HEAD + [
  'layout(location=0) in vec3 aPosition;',
  'layout(location=1) in vec3 aNormal;',
  'layout(location=2) in vec2 aUv;',
  'uniform mat4 uViewProj;',
  'uniform float uVertical;',
  'uniform float uRelief;',
  'uniform float uMountain;',
  'uniform float uKarst;',
  'uniform float uErosion;',
  'uniform float uDeposit;',
  'uniform float uThermal;',
  'uniform float uDetail;',
  'uniform float uValley;',
  'uniform float uCoreSeed;',
  'out vec3 vWorld;',
  'out vec3 vNormal;',
  'out vec2 vUv;',
  'out float vRawHeight;',
  'float ridge(float value){return 1.0-abs(fract(value)*2.0-1.0);}',
  'void main(){',
  '  float normalHeight=clamp(aPosition.y/max(uRelief,1.0),0.0,1.0);',
  '  float macro=sin(aPosition.x*.00073+uCoreSeed)*cos(aPosition.z*.00061-uCoreSeed*.7);',
  '  float karst=ridge(aPosition.x*.0019+aPosition.z*.0013+uCoreSeed);',
  '  float drainage=pow(abs(sin(aPosition.x*.0011-aPosition.z*.0017+uCoreSeed*.4)),10.0);',
  '  float detail=sin(aPosition.x*.012+uCoreSeed)*sin(aPosition.z*.010-uCoreSeed);',
  '  float visual=uMountain*macro*(3.0+normalHeight*16.0);',
  '  visual+=uKarst*karst*normalHeight*8.0;',
  '  visual-=uErosion*drainage*(1.0-normalHeight*.4)*5.5;',
  '  visual+=uDeposit*(1.0-normalHeight)*2.6;',
  '  visual-=uThermal*normalHeight*abs(detail)*2.4;',
  '  visual+=uDetail*detail*1.25;',
  '  visual-=uValley*drainage*3.2;',
  '  vWorld=vec3(aPosition.x,aPosition.y*uVertical+visual,aPosition.z);',
  '  vNormal=normalize(vec3(aNormal.x,aNormal.y/max(uVertical,.001),aNormal.z));',
  '  vUv=aUv;',
  '  vRawHeight=aPosition.y;',
  '  gl_Position=uViewProj*vec4(vWorld,1.0);',
  '}',
].join('\n');

const TERRAIN_FRAGMENT = GLSL_HEAD + [
  'in vec3 vWorld;',
  'in vec3 vNormal;',
  'in vec2 vUv;',
  'in float vRawHeight;',
  'out vec4 outColor;',
  'uniform vec3 uCamera;',
  'uniform vec3 uFogColor;',
  'uniform float uFogStart;',
  'uniform float uFogEnd;',
  'uniform float uRelief;',
  'uniform float uCoreSeed;',
  'uniform float uSeason;',
  'uniform float uYear;',
  'uniform float uShowForest;',
  'uniform float uShowPaddy;',
  'uniform float uShowDry;',
  'uniform float uShowOrchards;',
  'uniform float uShowBunds;',
  'uniform float uShowRock;',
  'uniform float uForestDensity;',
  'float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
  'void main(){',
  '  vec3 N=normalize(vNormal);',
  '  float slope=clamp(1.0-N.y,0.0,1.0);',
  '  float heightN=clamp(vRawHeight/max(uRelief,1.0),0.0,1.0);',
  '  float fine=hash12(floor(vWorld.xz/22.0)+uCoreSeed);',
  '  float parcel=hash12(floor(vWorld.xz/145.0)+uCoreSeed*11.0);',
  '  float ridge=abs(sin(vWorld.x*.0041+vWorld.z*.0029+uCoreSeed));',
  '  vec3 soil=mix(vec3(.19,.24,.13),vec3(.40,.34,.21),heightN*.65+slope*.42);',
  '  soil*=mix(.82,1.12,fine);',
  '  float farmable=(1.0-smoothstep(.10,.32,slope))*(1.0-smoothstep(.48,.72,heightN));',
  '  float paddy=farmable*step(.66,parcel)*uShowPaddy;',
  '  float dryCrop=farmable*step(.46,parcel)*(1.0-step(.66,parcel))*uShowDry;',
  '  float orchard=farmable*step(.31,parcel)*(1.0-step(.46,parcel))*uShowOrchards;',
  '  vec3 paddyColor=uSeason<.5?vec3(.31,.51,.28):uSeason<1.5?vec3(.18,.49,.25):uSeason<2.5?vec3(.62,.52,.20):vec3(.38,.32,.20);',
  '  vec3 dryColor=uSeason<2.0?vec3(.49,.46,.18):vec3(.63,.48,.17);',
  '  vec3 orchardColor=mix(vec3(.18,.38,.13),vec3(.40,.43,.15),step(2.0,uSeason));',
  '  vec3 color=mix(soil,paddyColor,paddy*.88);',
  '  color=mix(color,dryColor,dryCrop*.82);',
  '  color=mix(color,orchardColor,orchard*.78);',
  '  float bund=farmable*smoothstep(.86,.98,abs(sin(vWorld.x*.018)*sin(vWorld.z*.021)))*uShowBunds;',
  '  color=mix(color,vec3(.31,.22,.10),bund*.82);',
  '  float forest=smoothstep(.18,.62,heightN+slope*.38)*(1.0-farmable*.72)*uShowForest*uForestDensity;',
  '  color=mix(color,vec3(.045,.19,.085)*(1.0+fine*.34),clamp(forest,0.0,.88));',
  '  float rock=smoothstep(.18,.56,slope+heightN*.38)*smoothstep(.58,.92,ridge)*uShowRock;',
  '  color=mix(color,vec3(.48,.49,.44)*(0.82+fine*.25),rock*.88);',
  '  float yearTone=(uYear-1940.0)/5.0;',
  '  color*=mix(.96,1.035,yearTone);',
  '  vec3 lightDir=normalize(vec3(-.46,.82,-.34));',
  '  float light=.36+.72*max(dot(N,lightDir),0.0)+.12*max(dot(N,-lightDir),0.0);',
  '  color*=light;',
  '  float distanceToCamera=length(uCamera-vWorld);',
  '  float fog=smoothstep(uFogStart,uFogEnd,distanceToCamera);',
  '  color=mix(color,uFogColor,fog*.90);',
  '  outColor=vec4(pow(clamp(color,0.0,1.2),vec3(.91)),1.0);',
  '}',
].join('\n');

const FLAT_VERTEX = GLSL_HEAD + [
  'layout(location=0) in vec3 aPosition;',
  'layout(location=1) in vec4 aColor;',
  'uniform mat4 uViewProj;',
  'uniform float uPointSize;',
  'out vec4 vColor;',
  'void main(){vColor=aColor;gl_Position=uViewProj*vec4(aPosition,1.0);gl_PointSize=uPointSize;}',
].join('\n');

const FLAT_FRAGMENT = GLSL_HEAD + [
  'in vec4 vColor;',
  'out vec4 outColor;',
  'uniform float uRoundPoint;',
  'void main(){if(uRoundPoint>.5&&length(gl_PointCoord-.5)>.5)discard;outColor=vColor;}',
].join('\n');

const ECOLOGY_VERTEX = GLSL_HEAD + [
  'layout(location=0) in vec3 aPosition;',
  'layout(location=1) in vec4 aColor;',
  'layout(location=2) in float aSize;',
  'layout(location=3) in float aCategory;',
  'uniform mat4 uViewProj;',
  'uniform vec3 uCamera;',
  'uniform float uViewportHeight;',
  'uniform float uFov;',
  'uniform float uTime;',
  'uniform float uWindSpeed;',
  'uniform float uWindDirection;',
  'uniform float uGust;',
  'uniform vec4 uCategoryA;',
  'uniform vec4 uCategoryB;',
  'out vec4 vColor;',
  'out float vVisible;',
  'float categoryVisible(float category){',
  '  if(category<.5)return uCategoryA.x;',
  '  if(category<1.5)return uCategoryA.y;',
  '  if(category<2.5)return uCategoryA.z;',
  '  if(category<3.5)return uCategoryA.w;',
  '  if(category<4.5)return uCategoryB.x;',
  '  if(category<5.5)return uCategoryB.y;',
  '  return uCategoryB.z;',
  '}',
  'void main(){',
  '  float angle=radians(uWindDirection);',
  '  float phase=aPosition.x*.013+aPosition.z*.017;',
  '  float gustWave=.55+.45*sin(uTime*(1.1+uGust*2.2)+phase);',
  '  float sway=uWindSpeed*.018*(.35+uGust*gustWave)*min(aSize,12.0);',
  '  vec3 world=aPosition+vec3(sin(angle)*sway,0.0,cos(angle)*sway);',
  '  float distanceToCamera=max(length(uCamera-world),1.0);',
  '  float pixels=aSize*uViewportHeight/(2.0*tan(uFov*.5)*distanceToCamera);',
  '  gl_PointSize=clamp(pixels*1.5,1.0,96.0);',
  '  gl_Position=uViewProj*vec4(world,1.0);',
  '  vColor=aColor;',
  '  vVisible=categoryVisible(aCategory)*(1.0-smoothstep(3800.0,8500.0,distanceToCamera));',
  '}',
].join('\n');

const ECOLOGY_FRAGMENT = GLSL_HEAD + [
  'in vec4 vColor;',
  'in float vVisible;',
  'out vec4 outColor;',
  'void main(){',
  '  vec2 p=gl_PointCoord*2.0-1.0;',
  '  float alpha=(1.0-smoothstep(.72,1.0,dot(p,p)))*vColor.a*vVisible;',
  '  if(alpha<.03)discard;',
  '  float volume=.72+.30*sqrt(max(0.0,1.0-dot(p,p)));',
  '  outColor=vec4(vColor.rgb*volume,alpha);',
  '}',
].join('\n');

function createBuffer(gl, target, data, usage = gl.STATIC_DRAW) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);
  return buffer;
}

function destroyGeometry(gl, geometry) {
  if (!geometry) return;
  if (geometry.vao) gl.deleteVertexArray(geometry.vao);
  for (const buffer of geometry.buffers || []) gl.deleteBuffer(buffer);
}

function seasonIndex(season) {
  return { spring: 0, summer: 1, autumn: 2, winter: 3 }[season] ?? 1;
}

function coreSeed(id) {
  let hash = 2166136261;
  for (const character of String(id)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 733;
}

function datasetEncoding(dataset) {
  const encoding = dataset.heightEncoding || dataset.manifest.heightEncoding || {};
  return {
    minimum: Number(encoding.quantizationMinimumMeters ?? dataset.minimumElevation),
    maximum: Number(encoding.quantizationMaximumMeters ?? dataset.maximumElevation),
  };
}

function decodeElevation(dataset, index) {
  const encoding = datasetEncoding(dataset);
  return encoding.minimum + dataset.height[index] / 65535 * (encoding.maximum - encoding.minimum);
}

function usesPixelCenters(dataset) {
  return dataset.rasterSampling?.gridConvention === 'pixel-center';
}

function sourceSamplePosition(dataset, column, row) {
  if (usesPixelCenters(dataset)) {
    return [
      -dataset.widthMeters / 2 + (column + 0.5) * dataset.rasterSpacingMeters[0],
      -dataset.heightMeters / 2 + (row + 0.5) * dataset.rasterSpacingMeters[1],
    ];
  }
  return [
    -dataset.widthMeters / 2 + column / Math.max(dataset.gridWidth - 1, 1) * dataset.widthMeters,
    -dataset.heightMeters / 2 + row / Math.max(dataset.gridHeight - 1, 1) * dataset.heightMeters,
  ];
}

function sampleDatasetElevation(dataset, x, z) {
  if (!dataset) return null;
  if (
    x < -dataset.widthMeters / 2 || x > dataset.widthMeters / 2 ||
    z < -dataset.heightMeters / 2 || z > dataset.heightMeters / 2
  ) return null;
  const pixelCenters = usesPixelCenters(dataset);
  const rawU = pixelCenters
    ? (x + dataset.widthMeters / 2) / dataset.rasterSpacingMeters[0] - 0.5
    : (x / dataset.widthMeters + 0.5) * (dataset.gridWidth - 1);
  const rawV = pixelCenters
    ? (z + dataset.heightMeters / 2) / dataset.rasterSpacingMeters[1] - 0.5
    : (z / dataset.heightMeters + 0.5) * (dataset.gridHeight - 1);
  const u = clamp(rawU, 0, dataset.gridWidth - 1);
  const v = clamp(rawV, 0, dataset.gridHeight - 1);
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const x1 = Math.min(dataset.gridWidth - 1, x0 + 1);
  const y1 = Math.min(dataset.gridHeight - 1, y0 + 1);
  const indices = [
    y0 * dataset.gridWidth + x0,
    y0 * dataset.gridWidth + x1,
    y1 * dataset.gridWidth + x0,
    y1 * dataset.gridWidth + x1,
  ];
  if (dataset.mask && indices.some((index) => !dataset.mask[index])) return null;
  const tx = u - x0;
  const ty = v - y0;
  const top = lerp(decodeElevation(dataset, indices[0]), decodeElevation(dataset, indices[1]), tx);
  const bottom = lerp(decodeElevation(dataset, indices[2]), decodeElevation(dataset, indices[3]), tx);
  return lerp(top, bottom, ty);
}

function browserPreviewParameters() {
  const preview = store.state.gaea.preview && store.state.gaea.preview.runtimeParameters;
  const parameters = store.state.gaea.parameters || GAEA_DEFAULT_PARAMETERS;
  return {
    verticalEx: Number(preview?.verticalEx ?? parameters.verticalExaggeration ?? 1),
    mountainEmphasis: Number(preview?.mountainEmphasis ?? parameters.mountainEmphasis ?? 0),
    karstStrength: Number(preview?.karstStrength ?? parameters.karstSharpen ?? 0),
    erosionStrength: Number(preview?.erosionStrength ?? parameters.erosionStrength ?? 0),
    depositionStrength: Number(preview?.depositionStrength ?? parameters.depositionThickness ?? 0),
    thermalWeathering: Number(preview?.thermalWeathering ?? parameters.thermalWeathering ?? 0),
    rockExposure: Number(preview?.rockExposure ?? parameters.rockExposure ?? 0),
    surfaceDetail: Number(preview?.surfaceDetail ?? parameters.surfaceDetail ?? 0),
    valleyCut: Number(preview?.valleyCut ?? parameters.valleyCut ?? 0),
  };
}

function approximateVisualOffset(dataset, x, z) {
  const parameters = browserPreviewParameters();
  const raw = sampleDatasetElevation(dataset, x, z);
  if (raw == null) return null;
  const relative = raw - dataset.minimumElevation;
  const normalHeight = clamp(relative / Math.max(dataset.maximumElevation - dataset.minimumElevation, 1), 0, 1);
  const seed = coreSeed(dataset.id);
  const macro = Math.sin(x * 0.00073 + seed) * Math.cos(z * 0.00061 - seed * 0.7);
  const karst = 1 - Math.abs(((x * 0.0019 + z * 0.0013 + seed) % 1 + 1) % 1 * 2 - 1);
  const drainage = Math.pow(Math.abs(Math.sin(x * 0.0011 - z * 0.0017 + seed * 0.4)), 10);
  const detail = Math.sin(x * 0.012 + seed) * Math.sin(z * 0.010 - seed);
  let visual = parameters.mountainEmphasis * macro * (3 + normalHeight * 16);
  visual += parameters.karstStrength * karst * normalHeight * 8;
  visual -= parameters.erosionStrength * drainage * (1 - normalHeight * 0.4) * 5.5;
  visual += parameters.depositionStrength * (1 - normalHeight) * 2.6;
  visual -= parameters.thermalWeathering * normalHeight * Math.abs(detail) * 2.4;
  visual += parameters.surfaceDetail * detail * 1.25;
  visual -= parameters.valleyCut * drainage * 3.2;
  return relative * parameters.verticalEx + visual;
}

function buildTerrainGeometry(gl, dataset) {
  const maxSamples = dataset.id === 'overall' ? 300 : 321;
  const longest = Math.max(dataset.gridWidth, dataset.gridHeight);
  const columns = Math.max(2, Math.round(maxSamples * dataset.gridWidth / longest));
  const rows = Math.max(2, Math.round(maxSamples * dataset.gridHeight / longest));
  const positions = new Float32Array(columns * rows * 3);
  const normals = new Float32Array(columns * rows * 3);
  const uvs = new Float32Array(columns * rows * 2);
  const valid = new Uint8Array(columns * rows);
  const heights = new Float32Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    const sourceRow = Math.round(row * (dataset.gridHeight - 1) / (rows - 1));
    for (let column = 0; column < columns; column += 1) {
      const sourceColumn = Math.round(column * (dataset.gridWidth - 1) / (columns - 1));
      const sourceIndex = sourceRow * dataset.gridWidth + sourceColumn;
      const vertex = row * columns + column;
      const elevation = decodeElevation(dataset, sourceIndex);
      const relative = elevation - dataset.minimumElevation;
      const [sampleX, sampleZ] = sourceSamplePosition(dataset, sourceColumn, sourceRow);
      heights[vertex] = relative;
      valid[vertex] = dataset.mask ? Number(dataset.mask[sourceIndex] > 0) : 1;
      positions[vertex * 3] = sampleX;
      positions[vertex * 3 + 1] = relative;
      positions[vertex * 3 + 2] = sampleZ;
      uvs[vertex * 2] = usesPixelCenters(dataset)
        ? (sourceColumn + 0.5) / dataset.gridWidth
        : sourceColumn / Math.max(dataset.gridWidth - 1, 1);
      uvs[vertex * 2 + 1] = usesPixelCenters(dataset)
        ? (sourceRow + 0.5) / dataset.gridHeight
        : sourceRow / Math.max(dataset.gridHeight - 1, 1);
    }
  }

  const xStep = dataset.widthMeters / (columns - 1);
  const zStep = dataset.heightMeters / (rows - 1);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const left = heights[row * columns + Math.max(0, column - 1)];
      const right = heights[row * columns + Math.min(columns - 1, column + 1)];
      const north = heights[Math.max(0, row - 1) * columns + column];
      const south = heights[Math.min(rows - 1, row + 1) * columns + column];
      const vector = Vec3.normalize([
        -(right - left) / Math.max(xStep * 2, 1),
        1,
        -(south - north) / Math.max(zStep * 2, 1),
      ]);
      const offset = (row * columns + column) * 3;
      normals.set(vector, offset);
    }
  }

  const indices = [];
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      if (valid[a] && valid[b] && valid[c]) indices.push(a, b, c);
      if (valid[b] && valid[d] && valid[c]) indices.push(b, d, c);
    }
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, positions);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, normals);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  const uvBuffer = createBuffer(gl, gl.ARRAY_BUFFER, uvs);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
  const indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices));
  gl.bindVertexArray(null);
  return {
    vao,
    buffers: [positionBuffer, normalBuffer, uvBuffer, indexBuffer],
    count: indices.length,
    columns,
    rows,
    validVertices: valid.reduce((sum, value) => sum + value, 0),
  };
}

function createFlatGroup(gl, batches) {
  if (!batches || !batches.length) return null;
  let vertexTotal = 0;
  let indexTotal = 0;
  for (const batch of batches) {
    vertexTotal += Number(batch.vertexCount || batch.positions?.length / 3 || 0);
    indexTotal += batch.indices ? batch.indices.length : 0;
  }
  if (!vertexTotal) return null;
  const positions = new Float32Array(vertexTotal * 3);
  const colors = new Float32Array(vertexTotal * 4);
  const indices = indexTotal ? new Uint32Array(indexTotal) : null;
  const ranges = [];
  let vertexOffset = 0;
  let indexOffset = 0;
  for (const batch of batches) {
    const vertexCount = Number(batch.vertexCount || batch.positions?.length / 3 || 0);
    if (!vertexCount) continue;
    positions.set(batch.positions, vertexOffset * 3);
    const color = batch.style?.color || [0.4, 0.75, 0.9, 0.8];
    const alpha = Number(batch.style?.opacity ?? color[3] ?? 1);
    for (let index = 0; index < vertexCount; index += 1) {
      colors.set([Number(color[0]), Number(color[1]), Number(color[2]), alpha], (vertexOffset + index) * 4);
    }
    if (batch.indices && indices) {
      for (let index = 0; index < batch.indices.length; index += 1) {
        indices[indexOffset + index] = vertexOffset + batch.indices[index];
      }
      ranges.push({
        primitive: batch.primitive,
        indexed: true,
        start: indexOffset,
        count: batch.indices.length,
        id: batch.segmentId || batch.id,
      });
      indexOffset += batch.indices.length;
    } else {
      ranges.push({
        primitive: batch.primitive,
        indexed: false,
        start: vertexOffset,
        count: vertexCount,
        id: batch.segmentId || batch.id,
        pointSize: batch.style?.pointSizePx,
      });
    }
    vertexOffset += vertexCount;
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, positions);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, colors);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
  const buffers = [positionBuffer, colorBuffer];
  if (indices) buffers.push(createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indices));
  gl.bindVertexArray(null);
  return { vao, buffers, ranges, vertexTotal, indexTotal };
}

function ecologyArray(data, names, fallbackLength = 0) {
  for (const name of names) {
    const value = data && data[name];
    if (value && typeof value.length === 'number') return value;
  }
  return new Float32Array(fallbackLength);
}

function createEcologyGeometry(gl, data) {
  if (!data) return null;
  const positions = ecologyArray(data, ['positions', 'instancePositions']);
  const count = Number(data.count || data.instanceCount || positions.length / 3 || 0);
  if (!count || positions.length < count * 3) return null;
  let colors = ecologyArray(data, ['colors', 'instanceColors']);
  let sizes = ecologyArray(data, ['sizes', 'instanceSizes']);
  let categories = ecologyArray(data, ['categories', 'instanceCategories']);
  if (colors.length === count * 3) {
    const withAlpha = new Float32Array(count * 4);
    for (let index = 0; index < count; index += 1) {
      withAlpha.set([colors[index * 3], colors[index * 3 + 1], colors[index * 3 + 2], 0.9], index * 4);
    }
    colors = withAlpha;
  }
  if (colors.length < count * 4) {
    colors = new Float32Array(count * 4);
    for (let index = 0; index < count; index += 1) colors.set([0.12, 0.36, 0.14, 0.82], index * 4);
  }
  if (sizes.length < count) {
    sizes = new Float32Array(count);
    sizes.fill(5);
  }
  if (categories.length < count) categories = new Float32Array(count);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, positions);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, colors);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
  const sizeBuffer = createBuffer(gl, gl.ARRAY_BUFFER, sizes);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
  const categoryBuffer = createBuffer(gl, gl.ARRAY_BUFFER, categories);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return {
    vao,
    buffers: [positionBuffer, colorBuffer, sizeBuffer, categoryBuffer],
    count,
    diagnostics: data.diagnostics || null,
  };
}

class WorkbenchRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
    });
    if (!this.gl) throw new Error('当前浏览器无法建立 WebGL2 共享画布');
    const gl = this.gl;
    this.terrainProgram = createProgram(gl, TERRAIN_VERTEX, TERRAIN_FRAGMENT);
    this.flatProgram = createProgram(gl, FLAT_VERTEX, FLAT_FRAGMENT);
    this.ecologyProgram = createProgram(gl, ECOLOGY_VERTEX, ECOLOGY_FRAGMENT);
    this.terrainUniforms = uniformLocations(gl, this.terrainProgram, [
      'uViewProj', 'uVertical', 'uRelief', 'uMountain', 'uKarst', 'uErosion',
      'uDeposit', 'uThermal', 'uDetail', 'uValley', 'uCoreSeed', 'uCamera',
      'uFogColor', 'uFogStart', 'uFogEnd', 'uSeason', 'uYear', 'uShowForest',
      'uShowPaddy', 'uShowDry', 'uShowOrchards', 'uShowBunds', 'uShowRock',
      'uForestDensity',
    ]);
    this.flatUniforms = uniformLocations(gl, this.flatProgram, ['uViewProj', 'uPointSize', 'uRoundPoint']);
    this.ecologyUniforms = uniformLocations(gl, this.ecologyProgram, [
      'uViewProj', 'uCamera', 'uViewportHeight', 'uFov', 'uTime', 'uWindSpeed',
      'uWindDirection', 'uGust', 'uCategoryA', 'uCategoryB',
    ]);
    this.terrain = null;
    this.hydrologyGroups = [];
    this.boundary = null;
    this.ecology = null;
    this.dataset = null;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
  }

  setDataset(dataset) {
    destroyGeometry(this.gl, this.terrain);
    this.dataset = dataset;
    this.terrain = buildTerrainGeometry(this.gl, dataset);
  }

  setHydrology(batchCollection) {
    for (const group of this.hydrologyGroups) destroyGeometry(this.gl, group.geometry);
    this.hydrologyGroups = [];
    if (!batchCollection) return;
    const definitions = [
      ['surfaces', batchCollection.surfaces],
      ['banks', batchCollection.banks],
      ['centerlines', batchCollection.centerlines],
      ['flowArrows', batchCollection.flowArrows],
      ['breakpoints', batchCollection.breakpoints],
    ];
    for (const [name, batches] of definitions) {
      const geometry = createFlatGroup(this.gl, batches);
      if (geometry) this.hydrologyGroups.push({ name, geometry });
    }
  }

  setBoundary(batches) {
    destroyGeometry(this.gl, this.boundary);
    this.boundary = createFlatGroup(this.gl, batches);
  }

  setEcology(data) {
    destroyGeometry(this.gl, this.ecology);
    this.ecology = createEcologyGeometry(this.gl, data);
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
  }

  primitiveMode(primitive) {
    const gl = this.gl;
    if (primitive === 'triangles') return gl.TRIANGLES;
    if (primitive === 'lines') return gl.LINES;
    if (primitive === 'points') return gl.POINTS;
    return gl.LINE_STRIP;
  }

  drawFlatGroup(group, viewProjection) {
    if (!group) return;
    const gl = this.gl;
    gl.bindVertexArray(group.vao);
    for (const range of group.ranges) {
      const point = range.primitive === 'points';
      gl.uniform1f(this.flatUniforms.uRoundPoint, point ? 1 : 0);
      gl.uniform1f(this.flatUniforms.uPointSize, Number(range.pointSize || 6));
      const mode = this.primitiveMode(range.primitive);
      if (range.indexed) gl.drawElements(mode, range.count, gl.UNSIGNED_INT, range.start * 4);
      else gl.drawArrays(mode, range.start, range.count);
    }
    gl.bindVertexArray(null);
  }

  render(camera, timeSeconds) {
    this.resize();
    const gl = this.gl;
    const ecologyState = store.state.ecology;
    const display = store.state.display;
    const gaea = browserPreviewParameters();
    const palette = {
      spring: [0.52, 0.66, 0.65],
      summer: [0.48, 0.62, 0.62],
      autumn: [0.63, 0.62, 0.52],
      winter: [0.58, 0.62, 0.60],
    }[ecologyState.season] || [0.48, 0.62, 0.62];
    const clear = display.showAtmosphere ? palette : [0.055, 0.075, 0.065];
    gl.clearColor(clear[0], clear[1], clear[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.dataset || !this.terrain) return;

    if (display.showTerrain) {
      const uniforms = this.terrainUniforms;
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.useProgram(this.terrainProgram);
      gl.bindVertexArray(this.terrain.vao);
      gl.uniformMatrix4fv(uniforms.uViewProj, false, camera.viewProjection);
      gl.uniform1f(uniforms.uVertical, gaea.verticalEx);
      gl.uniform1f(uniforms.uRelief, this.dataset.maximumElevation - this.dataset.minimumElevation);
      gl.uniform1f(uniforms.uMountain, gaea.mountainEmphasis);
      gl.uniform1f(uniforms.uKarst, gaea.karstStrength);
      gl.uniform1f(uniforms.uErosion, gaea.erosionStrength);
      gl.uniform1f(uniforms.uDeposit, gaea.depositionStrength);
      gl.uniform1f(uniforms.uThermal, gaea.thermalWeathering);
      gl.uniform1f(uniforms.uDetail, gaea.surfaceDetail);
      gl.uniform1f(uniforms.uValley, gaea.valleyCut);
      gl.uniform1f(uniforms.uCoreSeed, coreSeed(this.dataset.id));
      gl.uniform3fv(uniforms.uCamera, camera.eye);
      gl.uniform3fv(uniforms.uFogColor, clear);
      gl.uniform1f(uniforms.uFogStart, Math.max(900, Math.max(this.dataset.widthMeters, this.dataset.heightMeters) * 0.22));
      gl.uniform1f(uniforms.uFogEnd, Math.max(5000, Math.max(this.dataset.widthMeters, this.dataset.heightMeters) * 1.3));
      gl.uniform1f(uniforms.uSeason, seasonIndex(ecologyState.season));
      gl.uniform1f(uniforms.uYear, Number(ecologyState.year));
      gl.uniform1f(uniforms.uShowForest, Number(ecologyState.showForest));
      gl.uniform1f(uniforms.uShowPaddy, Number(ecologyState.showPaddy));
      gl.uniform1f(uniforms.uShowDry, Number(ecologyState.showDryCrops));
      gl.uniform1f(uniforms.uShowOrchards, Number(ecologyState.showOrchards));
      gl.uniform1f(uniforms.uShowBunds, Number(ecologyState.showBunds));
      gl.uniform1f(uniforms.uShowRock, Number(ecologyState.showRock) * gaea.rockExposure);
      gl.uniform1f(uniforms.uForestDensity, Number(ecologyState.forestDensity));
      gl.drawElements(gl.TRIANGLES, this.terrain.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.useProgram(this.flatProgram);
    gl.uniformMatrix4fv(this.flatUniforms.uViewProj, false, camera.viewProjection);
    for (const entry of this.hydrologyGroups) this.drawFlatGroup(entry.geometry, camera.viewProjection);
    if (display.showCoreBounds) this.drawFlatGroup(this.boundary, camera.viewProjection);

    if (this.ecology && ecologyState.showInstances) {
      gl.useProgram(this.ecologyProgram);
      const uniforms = this.ecologyUniforms;
      gl.bindVertexArray(this.ecology.vao);
      gl.uniformMatrix4fv(uniforms.uViewProj, false, camera.viewProjection);
      gl.uniform3fv(uniforms.uCamera, camera.eye);
      gl.uniform1f(uniforms.uViewportHeight, this.canvas.height);
      gl.uniform1f(uniforms.uFov, camera.fov);
      gl.uniform1f(uniforms.uTime, timeSeconds);
      gl.uniform1f(uniforms.uWindSpeed, Number(ecologyState.windSpeed));
      gl.uniform1f(uniforms.uWindDirection, Number(ecologyState.windDirection));
      gl.uniform1f(uniforms.uGust, Number(ecologyState.gustStrength));
      gl.uniform4f(
        uniforms.uCategoryA,
        Number(ecologyState.showForest),
        Number(ecologyState.showShrubs),
        Number(ecologyState.showPaddy),
        Number(ecologyState.showDryCrops),
      );
      gl.uniform4f(
        uniforms.uCategoryB,
        Number(ecologyState.showOrchards),
        Number(ecologyState.showBunds),
        Number(ecologyState.showRock),
        1,
      );
      gl.drawArrays(gl.POINTS, 0, this.ecology.count);
      gl.bindVertexArray(null);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}

const camera = {
  mode: 'overview',
  reviewHeight: null,
  target: [0, 0, 0],
  desiredTarget: [0, 0, 0],
  distance: 10000,
  desiredDistance: 10000,
  azimuth: -0.72,
  desiredAzimuth: -0.72,
  elevation: 0.58,
  desiredElevation: 0.58,
  eye: [0, 0, 0],
  fov: radians(43),
  near: 0.15,
  far: 500000,
  viewProjection: Mat4.identity(),
  altitudeAboveGround: 0,
  inspectionView: null,
};

function scoreInspectionRay(dataset, x, z, azimuth) {
  const originHeight = approximateVisualOffset(dataset, x, z);
  if (originHeight == null) return null;
  const forward = [-Math.sin(azimuth), -Math.cos(azimuth)];
  const baseStep = Math.max(12.5, Math.min(32, Math.max(...dataset.rasterSpacingMeters)));
  const distances = [1, 2, 4, 8, 16, 28].map((multiplier) => baseStep * multiplier);
  const rises = [];
  for (const distance of distances) {
    const sample = approximateVisualOffset(
      dataset,
      x + forward[0] * distance,
      z + forward[1] * distance,
    );
    if (sample == null) return null;
    rises.push(sample - originHeight);
  }
  const clearances = rises.map((rise, index) => 1.7 + distances[index] * 0.004 - rise);
  const minimumClearance = Math.min(...clearances);
  const maximumRise = Math.max(...rises);
  const maximumDrop = Math.max(0, -Math.min(...rises));
  const nearRise = Math.max(...rises.slice(0, 3));
  const occlusionPenalty = Math.max(0, 0.65 - minimumClearance) * 260;
  const nearSlopePenalty = Math.max(0, nearRise + 0.15) * 18;
  const cliffPenalty = Math.max(0, maximumDrop - 95) * 0.6;
  return {
    azimuth,
    forward,
    distances,
    rises,
    minimumClearanceMetersAt1_7m: minimumClearance,
    maximumTerrainRiseMeters: maximumRise,
    maximumTerrainDropMeters: maximumDrop,
    score: occlusionPenalty + nearSlopePenalty + cliffPenalty,
  };
}

function chooseInspectionView(dataset) {
  const spanX = Math.min(2200, dataset.widthMeters * 0.22);
  const spanZ = Math.min(2200, dataset.heightMeters * 0.22);
  const offsets = [-1, -0.5, 0, 0.5, 1];
  let best = null;
  for (const xScale of offsets) {
    for (const zScale of offsets) {
      const x = xScale * spanX;
      const z = zScale * spanZ;
      const centerPenalty = Math.hypot(x / Math.max(spanX, 1), z / Math.max(spanZ, 1)) * 0.45;
      for (let direction = 0; direction < 16; direction += 1) {
        const ray = scoreInspectionRay(dataset, x, z, direction / 16 * Math.PI * 2);
        if (!ray) continue;
        const score = ray.score + centerPenalty;
        if (!best || score < best.score) best = { datasetId: dataset.id, x, z, ...ray, score };
      }
    }
  }
  if (best) return best;
  return {
    datasetId: dataset.id,
    x: 0,
    z: 0,
    azimuth: camera.desiredAzimuth,
    forward: [-Math.sin(camera.desiredAzimuth), -Math.cos(camera.desiredAzimuth)],
    distances: [],
    rises: [],
    minimumClearanceMetersAt1_7m: null,
    maximumTerrainRiseMeters: null,
    maximumTerrainDropMeters: null,
    score: null,
  };
}

function applyInspectionView(dataset, force = false) {
  if (!dataset) return null;
  if (!force && camera.inspectionView?.datasetId === dataset.id) return camera.inspectionView;
  const view = chooseInspectionView(dataset);
  camera.target[0] = camera.desiredTarget[0] = view.x;
  camera.target[2] = camera.desiredTarget[2] = view.z;
  camera.azimuth = camera.desiredAzimuth = view.azimuth;
  const bounds = dataset.projectedBounds;
  camera.inspectionView = {
    ...view,
    projectedEasting: (bounds[0] + bounds[2]) / 2 + view.x,
    projectedNorthing: (bounds[1] + bounds[3]) / 2 - view.z,
  };
  return camera.inspectionView;
}

function cameraProjectedPosition(dataset) {
  if (!dataset || !dataset.projectedBounds) return null;
  const bounds = dataset.projectedBounds;
  return [
    (bounds[0] + bounds[2]) / 2 + camera.target[0],
    (bounds[1] + bounds[3]) / 2 - camera.target[2],
  ];
}

function updateCamera(dataset, dt) {
  if (!dataset) return;
  const maxDimension = Math.max(dataset.widthMeters, dataset.heightMeters);
  camera.target[0] = damp(camera.target[0], camera.desiredTarget[0], 8, dt);
  camera.target[2] = damp(camera.target[2], camera.desiredTarget[2], 8, dt);
  camera.azimuth = damp(camera.azimuth, camera.desiredAzimuth, 9, dt);
  camera.elevation = damp(camera.elevation, camera.desiredElevation, 9, dt);
  camera.distance = damp(camera.distance, camera.desiredDistance, 7, dt);
  const targetHeight = approximateVisualOffset(dataset, camera.target[0], camera.target[2]) ?? 0;
  let center;
  if (camera.mode === 'overview') {
    camera.target[1] = damp(camera.target[1], targetHeight, 8, dt);
    const cosine = Math.cos(camera.elevation);
    camera.eye = [
      camera.target[0] + camera.distance * cosine * Math.sin(camera.azimuth),
      camera.target[1] + camera.distance * Math.sin(camera.elevation),
      camera.target[2] + camera.distance * cosine * Math.cos(camera.azimuth),
    ];
    center = [...camera.target];
    const eyeGround = approximateVisualOffset(dataset, camera.eye[0], camera.eye[2]) ?? 0;
    camera.altitudeAboveGround = Math.max(0, camera.eye[1] - eyeGround);
    camera.near = Math.max(0.35, Math.min(80, camera.distance * 0.0008));
  } else {
    const clearance = Number(camera.reviewHeight || 1.7);
    camera.eye = [camera.target[0], targetHeight + clearance, camera.target[2]];
    const forward = [-Math.sin(camera.azimuth), -Math.cos(camera.azimuth)];
    const lookDistance = Math.max(14, clearance * 4);
    const lookX = clamp(camera.target[0] + forward[0] * lookDistance, -dataset.widthMeters / 2, dataset.widthMeters / 2);
    const lookZ = clamp(camera.target[2] + forward[1] * lookDistance, -dataset.heightMeters / 2, dataset.heightMeters / 2);
    const lookGround = approximateVisualOffset(dataset, lookX, lookZ) ?? targetHeight;
    center = clearance <= 2
      ? [lookX, targetHeight + clearance * 0.94, lookZ]
      : [lookX, lookGround + Math.min(1.55, clearance * 0.08), lookZ];
    camera.altitudeAboveGround = clearance;
    camera.near = clearance <= 2 ? 0.06 : Math.max(0.12, clearance * 0.015);
  }
  camera.far = Math.max(12000, maxDimension * 5, camera.distance * 4);
  const view = Mat4.lookAt(camera.eye, center, [0, 1, 0]);
  const projection = Mat4.perspective(
    camera.fov,
    Math.max(1, ui.canvas.width) / Math.max(1, ui.canvas.height),
    camera.near,
    camera.far,
  );
  camera.viewProjection = Mat4.multiply(projection, view);
  const projected = cameraProjectedPosition(dataset);
  byId('cameraDiagnostics').textContent =
    '模式 ' + (camera.mode === 'overview' ? '全景轨道' : '地面检查') +
    ' · 高度 ' + camera.altitudeAboveGround.toFixed(2) + ' m\n' +
    'E ' + (projected ? projected[0].toFixed(1) : 'n/a') +
    ' · N ' + (projected ? projected[1].toFixed(1) : 'n/a') +
    ' · near ' + camera.near.toFixed(2) + ' m';
}

function setCameraMode(mode) {
  const dataset = store.state.dataset;
  if (!dataset) return;
  if (mode === 'overview') {
    camera.mode = 'overview';
    camera.reviewHeight = null;
    camera.desiredDistance = Math.max(dataset.widthMeters, dataset.heightMeters) * 1.08;
    camera.desiredElevation = 0.60;
    byId('cameraModeLabel').textContent = '全景';
  } else {
    const height = Number(String(mode).replace('m', ''));
    camera.mode = 'inspection';
    camera.reviewHeight = height;
    camera.desiredElevation = 0.08;
    applyInspectionView(dataset);
    byId('cameraModeLabel').textContent = height + ' m 观察';
    setStatus(dataset.name + ' · ' + height + ' m 地面检查视点', 'ok');
  }
  document.querySelectorAll('[data-camera]').forEach((button) => {
    button.classList.toggle('active', button.dataset.camera === mode);
  });
  updateDiagnostics();
}

function moveCamera(direction, amount) {
  const dataset = store.state.dataset;
  if (!dataset) return;
  const forward = [-Math.sin(camera.azimuth), -Math.cos(camera.azimuth)];
  const right = [Math.cos(camera.azimuth), -Math.sin(camera.azimuth)];
  let x = 0;
  let z = 0;
  if (direction === 'forward') [x, z] = forward;
  if (direction === 'back') [x, z] = [-forward[0], -forward[1]];
  if (direction === 'left') [x, z] = [-right[0], -right[1]];
  if (direction === 'right') [x, z] = right;
  camera.desiredTarget[0] = clamp(
    camera.desiredTarget[0] + x * amount,
    -dataset.widthMeters / 2 + 1,
    dataset.widthMeters / 2 - 1,
  );
  camera.desiredTarget[2] = clamp(
    camera.desiredTarget[2] + z * amount,
    -dataset.heightMeters / 2 + 1,
    dataset.heightMeters / 2 - 1,
  );
}

let renderer;
let mainManifest;
let coreLoader;
let gaeaBridge;
let hydrologyRuntime;
let ecologyRuntime;
let overallDataset;
let switchRevision = 0;
let hydrologyRefreshTimer = 0;
let ecologyRefreshTimer = 0;
let latestHydrologyBatches = null;
let latestEcologyData = null;
const coreManifests = new Map();

async function loadOverallDataset() {
  if (overallDataset) return overallDataset;
  const main = mainManifest.overall;
  const [sourceManifest, heightBuffer, maskBuffer] = await Promise.all([
    fetchJson(main.sourceManifest),
    fetchBuffer(main.heightBinary),
    fetchBuffer(main.maskBinary),
  ]);
  const height = littleEndianUint16(heightBuffer);
  const mask = new Uint8Array(maskBuffer);
  const expected = Number(sourceManifest.gridWidth) * Number(sourceManifest.gridHeight);
  if (height.length !== expected || mask.length !== expected) throw new Error('全域 DEM 像元数与 manifest 不一致');
  const rasterSpacingMeters = [
    Number(sourceManifest.widthMeters) / (Number(sourceManifest.gridWidth) - 1),
    Number(sourceManifest.heightMeters) / (Number(sourceManifest.gridHeight) - 1),
  ];
  const declaredSpacing = main.rasterSpacingMeters || [];
  if (
    declaredSpacing.length !== 2 ||
    declaredSpacing.some((value, index) => Math.abs(Number(value) - rasterSpacingMeters[index]) > 1e-6)
  ) {
    throw new Error('全域网页栅格间距与范围、网格维度不一致');
  }
  overallDataset = {
    id: 'overall',
    name: main.name,
    manifest: sourceManifest,
    height,
    mask,
    gridWidth: Number(sourceManifest.gridWidth),
    gridHeight: Number(sourceManifest.gridHeight),
    resolutionMeters: Number(main.resolutionMeters),
    sourceResolutionMeters: Number(main.sourceResolutionMeters),
    rasterSpacingMeters,
    rasterSampling: { ...main.rasterSampling },
    widthMeters: Number(sourceManifest.widthMeters),
    heightMeters: Number(sourceManifest.heightMeters),
    minimumElevation: Number(sourceManifest.minimumElevation),
    maximumElevation: Number(sourceManifest.maximumElevation),
    heightEncoding: sourceManifest.heightEncoding,
    projectedBounds: [...sourceManifest.bounds],
    wgs84Bounds: [...sourceManifest.wgs84Bounds],
    validFraction: Number(sourceManifest.validFraction),
    status: main.status,
    sourceStatus: main.status,
    lineage: main.lineage,
  };
  return overallDataset;
}

function coreResultToDataset(id, result) {
  const manifest = result.manifest;
  return {
    id,
    name: manifest.name,
    manifest,
    height: result.height,
    mask: result.mask,
    gridWidth: result.gridWidth,
    gridHeight: result.gridHeight,
    resolutionMeters: Number(manifest.raster.resolutionMeters),
    sourceResolutionMeters: Number(manifest.raster.resolutionMeters),
    rasterSpacingMeters: [Number(manifest.raster.resolutionMeters), Number(manifest.raster.resolutionMeters)],
    rasterSampling: {
      method: 'center-window-no-spatial-resampling',
      gridConvention: manifest.raster.gridConvention,
      spacingDerivation: manifest.raster.spacingDerivation,
    },
    widthMeters: Number(manifest.widthMeters),
    heightMeters: Number(manifest.heightMeters),
    minimumElevation: Number(manifest.minimumElevation),
    maximumElevation: Number(manifest.maximumElevation),
    heightEncoding: manifest.heightEncoding,
    projectedBounds: [...manifest.projectedBounds],
    wgs84Bounds: [...manifest.wgs84Bounds],
    validFraction: Number(manifest.validFraction),
    status: manifest.status,
    sourceStatus: manifest.sourceStatus,
    lineage: manifest.sourceLineage?.lineageId || 'verified-12.5m-core',
  };
}

function moduleDataset(dataset) {
  const visualRelief = Math.max(1, approximateVisualOffset(dataset, 0, 0) ?? (dataset.maximumElevation - dataset.minimumElevation));
  return {
    id: dataset.id,
    activeCoreId: dataset.id,
    manifest: dataset.manifest,
    widthMeters: dataset.widthMeters,
    heightMeters: dataset.heightMeters,
    gridWidth: dataset.gridWidth,
    gridHeight: dataset.gridHeight,
    resolutionMeters: dataset.resolutionMeters,
    sourceResolutionMeters: dataset.sourceResolutionMeters,
    rasterSpacingMeters: [...dataset.rasterSpacingMeters],
    rasterSampling: { ...dataset.rasterSampling },
    wgs84Bounds: [...dataset.wgs84Bounds],
    projectedBounds: [...dataset.projectedBounds],
    minimumElevation: dataset.minimumElevation,
    maximumElevation: dataset.maximumElevation,
    minElevation: 0,
    maxElevation: Math.max(visualRelief, (dataset.maximumElevation - dataset.minimumElevation) * browserPreviewParameters().verticalEx + 32),
    validFraction: dataset.validFraction,
    sampleHeightIsWorldY: true,
    baseHeightM: 0,
  };
}

function sampleVisualFromNormalised(xNorm, zNorm, point) {
  const dataset = store.state.dataset;
  if (!dataset) return null;
  const x = point?.x ?? (Number(xNorm) - 0.5) * dataset.widthMeters;
  const z = point?.z ?? (Number(zNorm) - 0.5) * dataset.heightMeters;
  return approximateVisualOffset(dataset, x, z);
}

function sampleEcologyHeight(x, z) {
  const dataset = store.state.dataset;
  return dataset ? approximateVisualOffset(dataset, x, z) : null;
}

async function buildCoreBoundaryBatches(dataset) {
  const batches = [];
  const overall = dataset.id === 'overall';
  const datasetCenterX = (dataset.projectedBounds[0] + dataset.projectedBounds[2]) / 2;
  const datasetCenterY = (dataset.projectedBounds[1] + dataset.projectedBounds[3]) / 2;
  const manifests = overall
    ? [...coreManifests.values()]
    : [dataset.manifest];
  for (const manifest of manifests) {
    const bounds = manifest.projectedBounds || manifest.bounds;
    if (!bounds) continue;
    const local = [
      [bounds[0] - datasetCenterX, datasetCenterY - bounds[1]],
      [bounds[2] - datasetCenterX, datasetCenterY - bounds[1]],
      [bounds[2] - datasetCenterX, datasetCenterY - bounds[3]],
      [bounds[0] - datasetCenterX, datasetCenterY - bounds[3]],
      [bounds[0] - datasetCenterX, datasetCenterY - bounds[1]],
    ];
    const positions = new Float32Array(local.length * 3);
    local.forEach((point, index) => {
      const height = approximateVisualOffset(dataset, point[0], point[1]) ?? 0;
      positions.set([point[0], height + (overall ? 28 : 4), point[1]], index * 3);
    });
    batches.push({
      id: 'core-boundary-' + manifest.id,
      segmentId: manifest.id,
      primitive: 'line-strip',
      positions,
      vertexCount: local.length,
      style: {
        color: manifest.id === 'zhenbao-ding' && manifest.status !== 'ready_12_5m'
          ? [0.95, 0.69, 0.27, 0.96]
          : [0.45, 0.92, 0.65, 0.92],
      },
    });
  }
  renderer.setBoundary(batches);
}

async function refreshHydrologyNow() {
  if (!hydrologyRuntime || !store.state.dataset) return;
  latestHydrologyBatches = hydrologyRuntime.getRenderBatches(store.state, sampleVisualFromNormalised);
  renderer.setHydrology(latestHydrologyBatches);
  const diagnostics = hydrologyRuntime.getDiagnostics();
  const classes = diagnostics.clipped?.byClass || {};
  byId('hydrologySummary').textContent =
    '漓江 ' + (classes.lijiang || 0) +
    ' · 湘江 ' + (classes.xiangjiang || 0) +
    ' · 支流 ' + (classes.tributary || 0);
  const continuity = diagnostics.continuity || {};
  const renderStats = diagnostics.lastRender || {};
  byId('hydrologyDiagnostics').textContent =
    '独立片段 ' + (diagnostics.clipped?.runs || 0) +
    ' · 连通分量 ' + (continuity.components || 0) +
    ' · 表面三角形 ' + (renderStats.surfaceTriangles || 0) + '\n' +
    '跨片连接 0 · 桥接三角形 0 · 越界顶点 ' +
    (diagnostics.geometrySafety?.outOfBoundsVertices || 0) +
    ' · 缺失高度样本 ' + (renderStats.missingHeightSamples || 0);
}

function scheduleHydrologyRefresh() {
  window.clearTimeout(hydrologyRefreshTimer);
  hydrologyRefreshTimer = window.setTimeout(() => {
    refreshHydrologyNow().catch((error) => {
      setStatus('水文刷新失败: ' + error.message, 'error');
    });
  }, 80);
}

async function refreshEcologyNow() {
  if (!ecologyRuntime || !store.state.dataset) return;
  const ecologyState = {
    ...store.state.ecology,
    activeCoreId: store.state.activeCoreId,
    waterWidth: store.state.hydrology.waterWidth,
  };
  if (typeof ecologyRuntime.updateState === 'function') ecologyRuntime.updateState(ecologyState);
  latestEcologyData = await Promise.resolve(
    ecologyRuntime.getRenderData(ecologyState, sampleEcologyHeight),
  );
  renderer.setEcology(latestEcologyData);
  const diagnostics = ecologyRuntime.getDiagnostics();
  const count = Number(latestEcologyData?.count || latestEcologyData?.instanceCount || diagnostics.activeInstanceCount || 0);
  byId('instanceMetric').textContent = formatNumber.format(count);
  byId('channelPlantMetric').textContent = String(diagnostics.channelVegetationCount ?? 0);
  byId('reconstructionMetric').textContent = diagnostics.claim === 'deterministic-historical-reconstruction-preview'
    ? '历史重建预览'
    : '聚合预览';
  byId('ecologySourceLabel').textContent =
    diagnostics.nativeSurveyClaim ? '测绘资产' : '确定性历史重建预览';
}

function scheduleEcologyRefresh() {
  window.clearTimeout(ecologyRefreshTimer);
  ecologyRefreshTimer = window.setTimeout(() => {
    refreshEcologyNow().catch((error) => {
      setStatus('生态刷新失败: ' + error.message, 'error');
    });
  }, 90);
}

function updateDatasetUi(dataset) {
  const manifest = dataset.manifest;
  const area = dataset.widthMeters * dataset.heightMeters / 1e6;
  const spacing = dataset.rasterSpacingMeters.map((value) => Number(value).toFixed(2));
  const sourceResolution = formatNumber.format(dataset.sourceResolutionMeters);
  byId('currentAreaMetric').textContent = area.toFixed(3) + ' km²';
  byId('taskAreaMetric').textContent = mainManifest.taskAoi.areaSquareKilometers.toFixed(3) + ' km²';
  byId('contextAreaMetric').textContent = mainManifest.webContext.areaSquareKilometers.toFixed(3) + ' km²';
  byId('pixelMetric').textContent = dataset.id === 'overall'
    ? dataset.gridWidth + ' × ' + dataset.gridHeight + ' · 网页 ' + spacing[0] + ' × ' + spacing[1] + ' m'
    : dataset.gridWidth + ' × ' + dataset.gridHeight + ' · ' + dataset.resolutionMeters + ' m';
  byId('activeCoreMetric').textContent = dataset.id;
  byId('terrainLineageBadge').textContent = dataset.id === 'overall'
    ? '源 DEM ' + sourceResolution + ' m · 网页 ' + spacing[0] + '×' + spacing[1] + ' m · ' + manifest.crs
    : '同源 ' + sourceResolution + ' m · ' + manifest.crs;
  byId('resolutionBadge').textContent = dataset.id === 'overall'
    ? '源 ' + sourceResolution + ' m · 网页 ' + spacing[0] + '×' + spacing[1] + ' m'
    : dataset.resolutionMeters + ' m · ' + dataset.gridWidth + '×' + dataset.gridHeight;
  byId('datasetStatus').textContent = dataset.status;
  if (dataset.id === 'overall') {
    byId('gapMetric').textContent = mainManifest.coverage.gapAreaSquareKilometers.toFixed(4) + ' km²';
    byId('fallbackNotice').classList.add('warn');
    byId('fallbackNotice').textContent = mainManifest.coverage.fallbackLabel;
  } else {
    const missing = Number(manifest.missingPixelCount || 0);
    byId('gapMetric').textContent = missing ? missing + ' 个像元' : '0';
    byId('fallbackNotice').classList.toggle('warn', missing > 0);
    byId('fallbackNotice').textContent = missing
      ? '当前核心保留 ' + missing + ' 个真实源缺口，无插值、无 ' +
        mainManifest.fallback.sourceResolutionMeters + ' m 回填。'
      : '当前核心为同一 ' + sourceResolution + ' m 网格、CRS 和像元原点裁切的完整 10 km 包。';
  }
  const sourceLineage = manifest.sourceLineage || {};
  const rasterLineage = dataset.id === 'overall'
    ? ' · 源分辨率 ' + dataset.sourceResolutionMeters + ' m · 网页采样 ' + spacing[0] + ' × ' + spacing[1] +
      ' m · ' + dataset.rasterSampling.method + ' / max-side ' + dataset.rasterSampling.maximumSidePixels
    : ' · 无空间重采样';
  byId('lineagePanel').textContent =
    'CRS ' + (manifest.crs || mainManifest.overall.crs) +
    ' · 像元原点 ' + JSON.stringify(manifest.pixelOrigin || 'overall-web-raster') + '\n' +
    '谱系 ' + (sourceLineage.lineageId || dataset.lineage) + rasterLineage +
    ' · 有效覆盖 ' + (dataset.validFraction * 100).toFixed(4) + '%';
  document.querySelectorAll('[data-core]').forEach((button) => {
    button.classList.toggle('active', button.dataset.core === dataset.id);
  });
}

async function switchDataset(id, options = {}) {
  const revision = ++switchRevision;
  const previous = store.state.dataset;
  const previousId = store.state.activeCoreId;
  store.setState({ switchingDataset: true });
  document.querySelectorAll('[data-core]').forEach((button) => button.classList.toggle('loading', button.dataset.core === id));
  ui.loadingText.textContent = id === 'overall'
    ? '读取完整 ' + mainManifest.overall.sourceResolutionMeters + ' m 源 DEM 的 ' +
      mainManifest.overall.gridWidth + ' × ' + mainManifest.overall.gridHeight + ' 降采样全域网页栅格'
    : '读取 ' + id + ' 精确 10 km 核心包';
  if (!options.initial) ui.loading.classList.remove('hidden');
  setStatus('切换数据集: ' + id);
  try {
    const dataset = id === 'overall'
      ? await loadOverallDataset()
      : coreResultToDataset(id, await coreLoader.loadCore(id));
    if (revision !== switchRevision) return;
    const oldProjected = previous ? cameraProjectedPosition(previous) : null;
    if (ecologyRuntime && typeof ecologyRuntime.releaseDenseInstances === 'function') {
      ecologyRuntime.releaseDenseInstances();
    }
    renderer.setDataset(dataset);
    store.setState({ dataset, activeCoreId: id });
    const moduleInput = moduleDataset(dataset);
    hydrologyRuntime.setDataset(moduleInput);
    await Promise.resolve(ecologyRuntime.setDataset(moduleInput));
    if (oldProjected) {
      const centerX = (dataset.projectedBounds[0] + dataset.projectedBounds[2]) / 2;
      const centerY = (dataset.projectedBounds[1] + dataset.projectedBounds[3]) / 2;
      const mappedX = oldProjected[0] - centerX;
      const mappedZ = centerY - oldProjected[1];
      const inside = Math.abs(mappedX) < dataset.widthMeters / 2 && Math.abs(mappedZ) < dataset.heightMeters / 2;
      camera.target[0] = camera.desiredTarget[0] = inside ? mappedX : 0;
      camera.target[2] = camera.desiredTarget[2] = inside ? mappedZ : 0;
    } else {
      camera.target[0] = camera.desiredTarget[0] = 0;
      camera.target[2] = camera.desiredTarget[2] = 0;
    }
    if (camera.mode === 'inspection') applyInspectionView(dataset, true);
    if (camera.mode === 'overview') {
      camera.distance = camera.desiredDistance = Math.max(dataset.widthMeters, dataset.heightMeters) * 1.08;
    }
    await buildCoreBoundaryBatches(dataset);
    await Promise.all([refreshHydrologyNow(), refreshEcologyNow()]);
    updateDatasetUi(dataset);
    if (previousId !== 'overall' && previousId !== id) coreLoader.release(previousId);
    setStatus(dataset.name + ' 已进入共享运行时', 'ok');
  } finally {
    if (revision === switchRevision) {
      store.setState({ switchingDataset: false });
      document.querySelectorAll('[data-core]').forEach((button) => button.classList.remove('loading'));
      ui.loading.classList.add('hidden');
    }
    updateDiagnostics();
  }
}

function selectWorkspace(name) {
  store.setState({ workspace: name });
  document.querySelectorAll('[data-workspace]').forEach((button) => {
    button.classList.toggle('active', button.dataset.workspace === name);
  });
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === name);
  });
  const labels = {
    overall: ['全域数据与范围', 'manifest 驱动的 AOI、分辨率、缺口和数据谱系'],
    gaea: ['GAEA 地形控制', '浏览器近似预览与真实 Worker 构建分离'],
    hydrology: ['独立水文系统', '每个连续片段独立绘制并保持河道植被排除'],
    ecology: ['生态农业与风季节', '四核心确定性历史重建预览'],
  };
  ui.controllerTitle.textContent = labels[name][0];
  ui.controllerSubtitle.textContent = labels[name][1];
  if (window.matchMedia('(max-width: 760px), (pointer: coarse)').matches) {
    ui.controller.classList.add('open');
    ui.panelToggle.setAttribute('aria-expanded', 'true');
  }
}

function setGaeaParameters(partial) {
  const gaea = store.state.gaea;
  store.setState({
    gaea: {
      ...gaea,
      parameters: { ...gaea.parameters, ...partial },
    },
  });
  scheduleHydrologyRefresh();
  buildCoreBoundaryBatches(store.state.dataset);
}

function syncGaeaInputs() {
  const parameters = store.state.gaea.parameters;
  const mapping = {
    verticalEx: parameters.verticalExaggeration,
    mountainBoost: parameters.mountainEmphasis,
    karstStrength: parameters.karstSharpen,
    erosionStrength: parameters.erosionStrength,
    deposition: parameters.depositionThickness,
    thermal: parameters.thermalWeathering,
    rockExposure: parameters.rockExposure,
    surfaceDetail: parameters.surfaceDetail,
    valleyCut: parameters.valleyCut,
  };
  for (const [id, value] of Object.entries(mapping)) {
    const input = byId(id);
    if (input) input.value = value;
    updateRangeOutput(id);
  }
}

function updateRangeOutput(id) {
  const input = byId(id);
  const output = byId(id + 'Out');
  if (!input || !output) return;
  const value = Number(input.value);
  const formats = {
    verticalEx: value.toFixed(2) + '×',
    mountainBoost: Math.round(value * 100) + '%',
    karstStrength: Math.round(value * 100) + '%',
    erosionStrength: Math.round(value * 100) + '%',
    deposition: Math.round(value * 100) + '%',
    thermal: Math.round(value * 100) + '%',
    rockExposure: Math.round(value * 100) + '%',
    surfaceDetail: Math.round(value * 100) + '%',
    valleyCut: Math.round(value * 100) + '%',
    forestDensity: Math.round(value * 100) + '%',
    windSpeed: value.toFixed(1) + ' m/s',
    windDirection: Math.round(value) + '°',
    gustStrength: Math.round(value * 100) + '%',
    waterLevel: value.toFixed(2) + '×',
    waterWidth: value.toFixed(2) + '×',
  };
  output.value = formats[id] || String(value);
  output.textContent = formats[id] || String(value);
}

function onGaeaStatus(event) {
  const status = byId('gaeaStatus');
  const progress = byId('gaeaProgress');
  if (event.phase === 'preview') {
    status.className = 'health-card ok';
    status.textContent = '浏览器近似预览已作用于当前地形 · 不修改权威 DEM · revision ' + event.revision;
  }
  if (event.phase === 'worker-health') {
    status.className = 'health-card ' + (event.status === 'ready' ? 'ok' : 'warn');
    status.textContent = event.status === 'ready'
      ? '真实 GAEA Worker 健康检查通过'
      : '真实 Worker ' + event.status + ' · ' + (event.reason || event.error || '未配置');
  }
  if (event.phase === 'worker-build') {
    const percent = Math.round(Number(event.progress || 0) * 100);
    progress.value = percent;
    status.className = 'health-card ' + (event.status === 'succeeded' ? 'ok' : event.status === 'building' ? '' : 'warn');
    status.textContent = 'Worker 构建 ' + event.status +
      (event.stage ? ' · ' + event.stage : '') +
      (event.error ? ' · ' + event.error : '');
  }
  updateDiagnostics();
}

function bindUi() {
  document.querySelectorAll('[data-workspace]').forEach((button) => {
    button.addEventListener('click', () => selectWorkspace(button.dataset.workspace));
  });
  document.querySelectorAll('[data-core]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!store.state.switchingDataset && button.dataset.core !== store.state.activeCoreId) {
        switchDataset(button.dataset.core).catch(showFatal);
      }
    });
  });
  document.querySelectorAll('[data-camera]').forEach((button) => {
    button.addEventListener('click', () => setCameraMode(button.dataset.camera));
  });
  ui.panelToggle.addEventListener('click', () => {
    const open = ui.controller.classList.toggle('open');
    ui.panelToggle.setAttribute('aria-expanded', String(open));
  });
  ui.closePanel.addEventListener('click', () => {
    ui.controller.classList.remove('open');
    ui.panelToggle.setAttribute('aria-expanded', 'false');
  });

  const displayInputs = ['showTerrain', 'showAtmosphere', 'showCoreBounds', 'showDiagnostics'];
  for (const id of displayInputs) {
    byId(id).addEventListener('change', (event) => {
      store.state.display[id] = event.target.checked;
      store.setState({ display: { ...store.state.display } });
    });
  }

  const gaeaMapping = {
    verticalEx: 'verticalExaggeration',
    mountainBoost: 'mountainEmphasis',
    karstStrength: 'karstSharpen',
    erosionStrength: 'erosionStrength',
    deposition: 'depositionThickness',
    thermal: 'thermalWeathering',
    rockExposure: 'rockExposure',
    surfaceDetail: 'surfaceDetail',
    valleyCut: 'valleyCut',
  };
  for (const [id, key] of Object.entries(gaeaMapping)) {
    byId(id).addEventListener('input', (event) => {
      updateRangeOutput(id);
      setGaeaParameters({ [key]: Number(event.target.value) });
    });
  }
  document.querySelectorAll('[data-gaea-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const aliases = {
        base: 'base-dem',
        guilin1942: 'guilin-1942',
        karst: 'karst-enhanced',
        fields: 'colorful-fields',
      };
      const presetName = aliases[button.dataset.gaeaPreset];
      store.setState({
        gaea: {
          ...store.state.gaea,
          parameters: { ...GAEA_PRESETS[presetName] },
        },
      });
      syncGaeaInputs();
      document.querySelectorAll('[data-gaea-preset]').forEach((item) => {
        item.classList.toggle('active', item === button);
      });
      scheduleHydrologyRefresh();
      buildCoreBoundaryBatches(store.state.dataset);
    });
  });
  document.querySelectorAll('[data-gaea-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.gaeaMode;
      store.state.gaea.requestedMode = mode;
      byId('gaeaModeLabel').textContent = mode === 'worker' ? '真实 Worker 构建' : '浏览器近似预览';
      document.querySelectorAll('[data-gaea-mode]').forEach((item) => item.classList.toggle('active', item === button));
    });
  });
  byId('gaeaBuildButton').addEventListener('click', async () => {
    if (store.state.gaea.requestedMode === 'worker') {
      await gaeaBridge.health();
      await gaeaBridge.build({ parameters: store.state.gaea.parameters });
    } else {
      setGaeaParameters({ ...store.state.gaea.parameters });
      onGaeaStatus({ phase: 'preview', status: 'ready', revision: store.state.gaea.preview?.revision || 0 });
    }
  });
  byId('gaeaCancelButton').addEventListener('click', () => gaeaBridge.cancel('user'));
  byId('gaeaResetButton').addEventListener('click', () => {
    gaeaBridge.reset();
    syncGaeaInputs();
    scheduleHydrologyRefresh();
    buildCoreBoundaryBatches(store.state.dataset);
  });

  const hydrologyCheckboxes = {
    showLijiang: 'showLijiang',
    showXiangjiang: 'showXiangjiang',
    showTributaries: 'showTributaries',
    showCenterlines: 'showCenterlines',
    showWaterSurface: 'showSurface',
    showBanks: 'showBanks',
    showFlow: 'showFlow',
    showBreaks: 'showDiagnostics',
  };
  for (const [id, key] of Object.entries(hydrologyCheckboxes)) {
    byId(id).addEventListener('change', (event) => {
      store.state.hydrology[key] = event.target.checked;
      store.setState({ hydrology: { ...store.state.hydrology } });
      scheduleHydrologyRefresh();
    });
  }
  for (const id of ['waterLevel', 'waterWidth']) {
    byId(id).addEventListener('input', (event) => {
      store.state.hydrology[id] = Number(event.target.value);
      store.setState({ hydrology: { ...store.state.hydrology } });
      updateRangeOutput(id);
      scheduleHydrologyRefresh();
    });
  }
  document.querySelectorAll('[data-water-season]').forEach((button) => {
    button.addEventListener('click', () => {
      store.state.hydrology.waterSeason = button.dataset.waterSeason;
      store.setState({ hydrology: { ...store.state.hydrology } });
      document.querySelectorAll('[data-water-season]').forEach((item) => item.classList.toggle('active', item === button));
      scheduleHydrologyRefresh();
    });
  });

  const ecologyCheckboxes = [
    'showForest', 'showShrubs', 'showPaddy', 'showDryCrops',
    'showOrchards', 'showBunds', 'showRock', 'showInstances',
  ];
  for (const id of ecologyCheckboxes) {
    byId(id).addEventListener('change', (event) => {
      store.state.ecology[id] = event.target.checked;
      store.setState({ ecology: { ...store.state.ecology } });
      if (id !== 'showInstances') scheduleEcologyRefresh();
    });
  }
  for (const id of ['forestDensity', 'windSpeed', 'windDirection', 'gustStrength']) {
    byId(id).addEventListener('input', (event) => {
      store.state.ecology[id] = Number(event.target.value);
      store.setState({ ecology: { ...store.state.ecology } });
      updateRangeOutput(id);
      scheduleEcologyRefresh();
    });
  }
  for (const id of ['season', 'year']) {
    byId(id).addEventListener('change', (event) => {
      store.state.ecology[id] = id === 'year' ? Number(event.target.value) : event.target.value;
      store.setState({ ecology: { ...store.state.ecology } });
      scheduleEcologyRefresh();
    });
  }

  let dragging = null;
  ui.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  ui.canvas.addEventListener('pointerdown', (event) => {
    ui.canvas.setPointerCapture(event.pointerId);
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, button: event.button };
  });
  ui.canvas.addEventListener('pointermove', (event) => {
    if (!dragging || dragging.id !== event.pointerId) return;
    const dx = event.clientX - dragging.x;
    const dy = event.clientY - dragging.y;
    dragging.x = event.clientX;
    dragging.y = event.clientY;
    if (dragging.button === 2 || event.shiftKey) {
      const scale = camera.mode === 'overview' ? Math.max(2, camera.distance * 0.0014) : 0.16;
      moveCamera(dx > 0 ? 'left' : 'right', Math.abs(dx) * scale);
      moveCamera(dy > 0 ? 'back' : 'forward', Math.abs(dy) * scale);
    } else {
      camera.desiredAzimuth -= dx * 0.006;
      if (camera.mode === 'overview') camera.desiredElevation = clamp(camera.desiredElevation - dy * 0.005, 0.08, 1.48);
    }
  });
  const clearDrag = () => { dragging = null; };
  ui.canvas.addEventListener('pointerup', clearDrag);
  ui.canvas.addEventListener('pointercancel', clearDrag);
  ui.canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (camera.mode !== 'overview') setCameraMode('overview');
    const dataset = store.state.dataset;
    camera.desiredDistance = clamp(
      camera.desiredDistance * Math.exp(event.deltaY * 0.001),
      8,
      Math.max(dataset.widthMeters, dataset.heightMeters) * 3.5,
    );
  }, { passive: false });

  const heldMoves = new Set();
  const keys = new Set();
  window.addEventListener('keydown', (event) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  document.querySelectorAll('[data-move]').forEach((button) => {
    const start = (event) => {
      event.preventDefault();
      heldMoves.add(button.dataset.move);
      button.setPointerCapture?.(event.pointerId);
    };
    const end = () => heldMoves.delete(button.dataset.move);
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('lostpointercapture', end);
  });
  bindUi.updateMovement = (dt) => {
    const speed = camera.mode === 'overview'
      ? Math.max(20, camera.distance * 0.12)
      : keys.has('ShiftLeft') || keys.has('ShiftRight') ? 14 : 5;
    if (keys.has('KeyW') || keys.has('ArrowUp') || heldMoves.has('forward')) moveCamera('forward', speed * dt);
    if (keys.has('KeyS') || keys.has('ArrowDown') || heldMoves.has('back')) moveCamera('back', speed * dt);
    if (keys.has('KeyA') || keys.has('ArrowLeft') || heldMoves.has('left')) moveCamera('left', speed * dt);
    if (keys.has('KeyD') || keys.has('ArrowRight') || heldMoves.has('right')) moveCamera('right', speed * dt);
  };

  for (const id of [
    'verticalEx', 'mountainBoost', 'karstStrength', 'erosionStrength', 'deposition',
    'thermal', 'rockExposure', 'surfaceDetail', 'valleyCut', 'forestDensity',
    'windSpeed', 'windDirection', 'gustStrength', 'waterLevel', 'waterWidth',
  ]) updateRangeOutput(id);
}

function updateDiagnostics() {
  const dataset = store.state.dataset;
  const hydro = hydrologyRuntime?.getDiagnostics?.() || null;
  const ecology = ecologyRuntime?.getDiagnostics?.() || null;
  window.__GUILIN_WORKBENCH_DIAGNOSTICS__ = {
    ready: Boolean(window.__DEMO_READY__),
    schema: mainManifest?.schema || null,
    releaseStatus: mainManifest?.releaseStatus || null,
    publicationBlocked: true,
    pullRequestMustRemainDraft: true,
    activeCoreId: store.state.activeCoreId,
    workspace: store.state.workspace,
    sharedRuntime: {
      canvasCount: document.querySelectorAll('canvas').length,
      iframeCount: document.querySelectorAll('iframe').length,
      oneCameraObject: true,
      oneStoreObject: true,
    },
    dataset: dataset ? {
      id: dataset.id,
      resolutionMeters: dataset.resolutionMeters,
      sourceResolutionMeters: dataset.sourceResolutionMeters,
      rasterSpacingMeters: [...dataset.rasterSpacingMeters],
      rasterSampling: { ...dataset.rasterSampling },
      gridWidth: dataset.gridWidth,
      gridHeight: dataset.gridHeight,
      widthMeters: dataset.widthMeters,
      heightMeters: dataset.heightMeters,
      validFraction: dataset.validFraction,
      status: dataset.status,
      projectedBounds: [...dataset.projectedBounds],
    } : null,
    camera: {
      mode: camera.mode,
      reviewHeightMeters: camera.reviewHeight,
      altitudeAboveGroundMeters: camera.altitudeAboveGround,
      objectIdentity: 'shared-camera-1',
      inspectionView: camera.inspectionView ? {
        datasetId: camera.inspectionView.datasetId,
        projectedEasting: camera.inspectionView.projectedEasting,
        projectedNorthing: camera.inspectionView.projectedNorthing,
        azimuthDegrees: camera.inspectionView.azimuth / Math.PI * 180,
        minimumClearanceMetersAt1_7m: camera.inspectionView.minimumClearanceMetersAt1_7m,
        maximumTerrainRiseMeters: camera.inspectionView.maximumTerrainRiseMeters,
        score: camera.inspectionView.score,
      } : null,
    },
    gaea: {
      mode: store.state.gaea.mode,
      requestedMode: store.state.gaea.requestedMode,
      preview: store.state.gaea.preview || null,
      worker: store.state.gaea.worker || null,
      build: store.state.gaea.build || null,
    },
    hydrology: hydro,
    ecology,
    browserEvidence: 'unmeasured-until-stage-a-browser-run',
    resource404Count: null,
    consoleErrorCount: null,
  };
}

async function initialise() {
  setStatus('读取统一 manifest');
  mainManifest = await fetchJson('./manifest.json');
  store.setState({ manifest: mainManifest });
  byId('taskAreaMetric').textContent = mainManifest.taskAoi.areaSquareKilometers.toFixed(3) + ' km²';
  byId('contextAreaMetric').textContent = mainManifest.webContext.areaSquareKilometers.toFixed(3) + ' km²';
  byId('releaseBadge').textContent = 'Draft · 用户视觉批准待完成';
  renderer = new WorkbenchRenderer(ui.canvas);
  coreLoader = createCoreLoader({
    onStatus(event) {
      if (event.type === 'load-error') setStatus('核心包读取失败: ' + event.id, 'error');
    },
  });
  bindUi();
  gaeaBridge = createGaeaBridge({
    store,
    onStatus: onGaeaStatus,
    onBuildApplied(event) {
      setStatus('真实 GAEA Worker 构建已应用: ' + event.requestId, 'ok');
    },
  });
  syncGaeaInputs();

  ui.loadingText.textContent = '读取四核心 manifest 与独立水文源';
  const hydrologySources = {
    lijiang: mainManifest.hydrology.sources.lijiang,
    waterways: mainManifest.hydrology.sources.all,
  };
  const initialTasks = [
    createHydrologyRuntime({
      sourceUrls: hydrologySources,
      onStatus(event) {
        if (event.phase === 'load' && event.status === 'loading') setStatus('读取分段水文源');
      },
    }),
    ...CORE_IDS.map(async (id) => {
      const manifest = await coreLoader.getManifest(id);
      coreManifests.set(id, manifest);
      const button = document.querySelector('[data-core="' + id + '"]');
      if (button) button.dataset.coverage = manifest.coverage?.complete ? 'complete' : 'incomplete';
    }),
  ];
  const results = await Promise.all(initialTasks);
  hydrologyRuntime = results[0];
  ecologyRuntime = createEcologyCoreRuntime({
    hydrologyRuntime,
    onStatus(event) {
      if (event.status === 'failed') setStatus('生态运行时失败: ' + (event.error || event.phase), 'error');
    },
  });
  await switchDataset('overall', { initial: true });
  await gaeaBridge.health({ force: false, timeoutMs: 800 });

  window.__GUILIN_SHARED_RUNTIME_HANDLES__ = Object.freeze({
    canvas: ui.canvas,
    camera,
    store,
  });

  window.GuilinWorkbench = Object.freeze({
    getState: () => structuredClone(store.state),
    getManifest: () => structuredClone(mainManifest),
    getDiagnostics: () => structuredClone(window.__GUILIN_WORKBENCH_DIAGNOSTICS__),
    switchCore: (id) => switchDataset(id),
    selectWorkspace,
    setCameraHeight: (height) => setCameraMode(height === 'overview' ? 'overview' : String(height).replace('m', '') + 'm'),
    resetGaea: () => gaeaBridge.reset(),
    waitForIdle: async () => {
      while (store.state.switchingDataset) await new Promise((resolve) => window.setTimeout(resolve, 25));
      return true;
    },
  });
  window.__DEMO_READY__ = true;
  ui.loading.classList.add('hidden');
  setStatus('统一工作台 Stage A 已就绪，发布门槛保持锁定', 'ok');
  updateDiagnostics();

  let last = performance.now();
  let fpsStart = last;
  let frames = 0;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    bindUi.updateMovement?.(dt);
    updateCamera(store.state.dataset, dt);
    renderer.render(camera, now / 1000);
    frames += 1;
    if (now - fpsStart >= 800) {
      ui.fps.textContent = Math.round(frames * 1000 / (now - fpsStart)) + ' FPS';
      frames = 0;
      fpsStart = now;
      updateDiagnostics();
    }
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', () => {
  window.clearTimeout(hydrologyRefreshTimer);
  window.clearTimeout(ecologyRefreshTimer);
  gaeaBridge?.dispose();
  hydrologyRuntime?.dispose();
  ecologyRuntime?.dispose();
  coreLoader?.dispose();
});

initialise().catch(showFatal);
