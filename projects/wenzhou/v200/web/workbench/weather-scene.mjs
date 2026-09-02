const VOLUME_MIN_KM = Object.freeze([-19, -1, -16]);
const VOLUME_MAX_KM = Object.freeze([19, 13, 16]);
const WEATHER_SOURCE_VERSION = '1.1.0-hq';
const WORKER_SEED_DEFAULT = 4217;

export const WEATHER_PROFILES = Object.freeze({
  coast: Object.freeze({
    id: 'coast',
    label: '海岸层积云',
    kind: 'Sc',
    source: Object.freeze({ density: 0.70, count: 6, rain: 0.04, fog: 0.12, humidity: 83, instability: 0.22 }),
    windFromDeg: 270,
    windSpeedMps: 12,
    cloudSpeedMps: 12,
    hour: 16,
    horizontalScale: 7,
    centerM: Object.freeze([25000, 0]),
    densityScale: 0.92,
    fogDensityPerM: 0.0000013,
    cycloneSpin: 0,
    eyeRadius: 2.2,
    rainbandCurl: 1,
    stormRadius: 10
  }),
  rain: Object.freeze({
    id: 'rain',
    label: '阴天降雨云',
    kind: 'Ns',
    source: Object.freeze({ density: 1.12, count: 7, rain: 0.70, fog: 0.20, humidity: 97, instability: 0.18 }),
    windFromDeg: 270,
    windSpeedMps: 12,
    cloudSpeedMps: 12,
    hour: 16,
    horizontalScale: 7,
    centerM: Object.freeze([25000, 0]),
    densityScale: 1.08,
    fogDensityPerM: 0.0000038,
    cycloneSpin: 0,
    eyeRadius: 2.2,
    rainbandCurl: 1,
    stormRadius: 10
  }),
  typhoon: Object.freeze({
    id: 'typhoon',
    label: '台风组织云系',
    kind: 'Cb',
    source: Object.freeze({ density: 1.04, count: 7, rain: 0.88, fog: 0.18, humidity: 98, instability: 0.88 }),
    windFromDeg: 115,
    windSpeedMps: 32,
    cloudSpeedMps: 4,
    hour: 13.8,
    horizontalScale: 7,
    centerM: Object.freeze([65000, 15000]),
    densityScale: 1.06,
    fogDensityPerM: 0.0000032,
    cycloneSpin: 1.25,
    eyeRadius: 2.2,
    rainbandCurl: 1.15,
    stormRadius: 10.2
  })
});

const CLOUD_VERTEX = `#version 300 es
precision highp float;
void main(){
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`;

const CLOUD_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler3D;
out vec4 color;
uniform sampler3D uDensity;
uniform mat4 uVP;
uniform vec4 uViewport;
uniform vec3 uEye,uForward,uRight,uUp,uSun,uSunColor;
uniform vec3 uFieldMin,uFieldMax;
uniform vec2 uCenterM,uDriftSourceKm,uCloudVerticalM;
uniform float uHorizontalScale,uDensityScale,uTime,uRain,uFog,uLogFar,uCycloneSpin,uWeatherKind,uTanHalfFov,uAspect,uStepCount;

float hash31(vec3 p){
  p=fract(p*0.1031);
  p+=dot(p,p.yzx+33.33);
  return fract((p.x+p.y)*p.z);
}
float noise3(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  float n000=hash31(i+vec3(0,0,0)),n100=hash31(i+vec3(1,0,0));
  float n010=hash31(i+vec3(0,1,0)),n110=hash31(i+vec3(1,1,0));
  float n001=hash31(i+vec3(0,0,1)),n101=hash31(i+vec3(1,0,1));
  float n011=hash31(i+vec3(0,1,1)),n111=hash31(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z);
}
float fbm3(vec3 p){
  float v=0.0,a=0.57;
  v+=a*noise3(p);p=p*2.03+vec3(7.1,3.7,11.3);a*=0.47;
  v+=a*noise3(p);p=p*2.01+vec3(5.3,13.1,2.9);a*=0.47;
  v+=a*noise3(p);
  return v;
}
vec2 boxHit(vec3 ro,vec3 rd,vec3 b0,vec3 b1){
  vec3 inv=1.0/rd;
  vec3 t0=(b0-ro)*inv,t1=(b1-ro)*inv;
  vec3 lo=min(t0,t1),hi=max(t0,t1);
  return vec2(max(max(lo.x,lo.y),lo.z),min(min(hi.x,hi.y),hi.z));
}
vec2 rotate2(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
vec3 sourcePosition(vec3 worldP){
  vec3 q=vec3((worldP.x-uCenterM.x)/(1000.0*uHorizontalScale),worldP.y/1000.0,(worldP.z-uCenterM.y)/(1000.0*uHorizontalScale));
  q.xz-=uDriftSourceKm;
  if(uWeatherKind>1.5)q.xz=rotate2(q.xz,-uTime*0.00055*uCycloneSpin);
  vec3 extent=uFieldMax-uFieldMin;
  q.x=uFieldMin.x+mod(q.x-uFieldMin.x,extent.x);
  q.z=uFieldMin.z+mod(q.z-uFieldMin.z,extent.z);
  return q;
}
float rawDensityAt(vec3 worldP){
  vec3 q=sourcePosition(worldP);
  if(q.y<uFieldMin.y||q.y>uFieldMax.y)return 0.0;
  return texture(uDensity,(q-uFieldMin)/(uFieldMax-uFieldMin)).r*uDensityScale;
}
float densityAt(vec3 worldP){
  vec3 q=sourcePosition(worldP);
  if(q.y<uFieldMin.y||q.y>uFieldMax.y)return 0.0;
  vec3 uv=(q-uFieldMin)/(uFieldMax-uFieldMin);
  float base=texture(uDensity,uv).r;
  if(base<0.008)return 0.0;
  float edge=hash31(floor(q*4.1+vec3(uTime*0.018,0.0,-uTime*0.013)));
  float carved=base+(edge-0.50)*0.072*(1.0-base);
  return smoothstep(0.035,0.56,carved)*uDensityScale;
}
vec3 lightAt(vec3 p,vec3 rd,float d){
  float optical=0.0;
  for(int j=1;j<=2;j++)optical+=rawDensityAt(p+uSun*(float(j)*1450.0));
  float direct=exp(-optical*0.62);
  float silver=pow(max(dot(rd,uSun),0.0),6.0);
  vec3 ambient=mix(vec3(0.24,0.29,0.36),vec3(0.54,0.62,0.70),clamp((p.y-uCloudVerticalM.x)/max(1.0,uCloudVerticalM.y-uCloudVerticalM.x),0.0,1.0));
  vec3 lit=ambient+uSunColor*(0.28+0.72*direct)*(0.42+0.58*silver);
  if(uWeatherKind>0.5)lit*=mix(vec3(0.69,0.75,0.82),vec3(1.0),direct);
  return lit*(0.82+0.18*min(d,1.0));
}
float rainMask(vec2 uv){
  vec2 q=uv*vec2(310.0,48.0);
  q.x+=uTime*0.37+q.y*0.34;
  q.y+=uTime*11.0;
  vec2 cell=floor(q),f=fract(q);
  float gate=step(0.72,hash31(vec3(cell,19.0)));
  float line=pow(max(0.0,1.0-abs(f.x-0.5)*2.0),28.0)*(1.0-smoothstep(0.20,0.96,f.y));
  return gate*line*uRain;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-uViewport.xy)/uViewport.zw;
  if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))discard;
  vec2 ndc=uv*2.0-1.0;
  vec3 rd=normalize(uForward+uRight*(ndc.x*uAspect*uTanHalfFov)+uUp*(ndc.y*uTanHalfFov));
  vec3 b0=vec3(uCenterM.x+uFieldMin.x*uHorizontalScale*1000.0,uFieldMin.y*1000.0,uCenterM.y+uFieldMin.z*uHorizontalScale*1000.0);
  vec3 b1=vec3(uCenterM.x+uFieldMax.x*uHorizontalScale*1000.0,uFieldMax.y*1000.0,uCenterM.y+uFieldMax.z*uHorizontalScale*1000.0);
  vec2 hit=boxHit(uEye,rd,b0,b1);
  float begin=max(hit.x,0.0),end=hit.y;
  if(end<=begin)discard;
  float steps=max(12.0,uStepCount),ds=(end-begin)/steps;
  float jitter=hash31(vec3(gl_FragCoord.xy,fract(uTime*0.113)));
  float trans=1.0,first=-1.0,moment=0.0;
  vec3 accum=vec3(0.0);
  for(int i=0;i<64;i++){
    if(float(i)>=steps||trans<0.008)break;
    float t=begin+(float(i)+0.18+0.64*jitter)*ds;
    vec3 p=uEye+rd*t;
    float d=densityAt(p);
    if(d>0.002){
      if(first<0.0)first=t;
      float alpha=1.0-exp(-d*ds*0.00031);
      vec3 radiance=lightAt(p,rd,d);
      accum+=trans*alpha*radiance;
      moment+=trans*alpha*t;
      trans*=1.0-alpha;
    }
  }
  float alpha=1.0-trans;
  float rain=rainMask(uv)*(0.18+0.82*max(alpha,0.22));
  vec3 rainColor=vec3(0.68,0.77,0.86);
  vec3 linearColor=alpha>0.0001?accum/max(alpha,0.0001):rainColor;
  linearColor=mix(linearColor,rainColor,clamp(rain*1.7,0.0,0.72));
  alpha=max(alpha,rain*0.34);
  if(alpha<0.002)discard;
  float depthT=first>=0.0?first:begin+max(10.0,ds);
  vec4 clip=uVP*vec4(uEye+rd*depthT,1.0);
  float vd=1.0+clip.w;
  gl_FragDepth=log2(max(0.000001,vd))*uLogFar*0.5;
  float aerial=1.0-exp(-max(0.0,depthT)*uFog*0.34);
  linearColor=mix(linearColor,vec3(0.58,0.67,0.74),aerial);
  color=vec4(pow(clamp(linearColor,0.0,1.0),vec3(1.0/2.2)),clamp(alpha,0.0,0.97));
}`;

function annotate(source) {
  return source.split('\n').map((line, index) => `${String(index + 1).padStart(4, '0')} ${line}`).join('\n');
}

function compileShader(gl, type, source, label) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`${label} shader compile failed\n${gl.getShaderInfoLog(shader)}\n${annotate(source)}`);
  }
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, CLOUD_VERTEX, 'cloud vertex'));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, CLOUD_FRAGMENT, 'cloud fragment'));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`cloud program link failed\n${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

function normalize3(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function solarAt(hour) {
  const day = Math.max(0, Math.sin(Math.PI * (hour - 6) / 12));
  const elevation = Math.max(-0.08, day * 0.92);
  const azimuth = Math.PI * (hour - 6) / 12;
  const horizontal = Math.sqrt(Math.max(0, 1 - elevation * elevation));
  const direction = normalize3([Math.sin(azimuth) * horizontal, elevation, -Math.cos(azimuth) * horizontal]);
  const warm = 1 - Math.min(1, Math.max(0, elevation) * 1.8);
  const color = [1.0, 0.92 - warm * 0.16, 0.78 - warm * 0.24];
  return { direction, color, day };
}

function cloneProfile(id) {
  const base = WEATHER_PROFILES[id];
  if (!base) throw new Error(`unknown weather profile ${id}`);
  return {
    ...base,
    source: { ...base.source },
    centerM: [...base.centerM]
  };
}

function dimensions(quality) {
  const mobile = innerWidth < 700;
  if (quality === 'high') return mobile ? [128, 80, 104] : [224, 128, 192];
  return mobile ? [96, 64, 80] : [160, 96, 128];
}

function scanField(data, dims, horizontalScale) {
  const [nx, ny, nz] = dims;
  let minX = nx, minY = ny, minZ = nz, maxX = -1, maxY = -1, maxZ = -1, occupied = 0;
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      const row = (z * ny + y) * nx;
      for (let x = 0; x < nx; x++) {
        if (data[row + x] <= 7) continue;
        occupied++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }
  }
  if (!occupied) return null;
  const toAxis = (index, count, lo, hi) => lo + (index + 0.5) / count * (hi - lo);
  const x0 = toAxis(minX, nx, VOLUME_MIN_KM[0], VOLUME_MAX_KM[0]);
  const x1 = toAxis(maxX, nx, VOLUME_MIN_KM[0], VOLUME_MAX_KM[0]);
  const y0 = toAxis(minY, ny, VOLUME_MIN_KM[1], VOLUME_MAX_KM[1]);
  const y1 = toAxis(maxY, ny, VOLUME_MIN_KM[1], VOLUME_MAX_KM[1]);
  const z0 = toAxis(minZ, nz, VOLUME_MIN_KM[2], VOLUME_MAX_KM[2]);
  const z1 = toAxis(maxZ, nz, VOLUME_MIN_KM[2], VOLUME_MAX_KM[2]);
  return {
    occupiedVoxels: occupied,
    occupiedFraction: occupied / data.length,
    baseM: Math.round(y0 * 1000),
    topM: Math.round(y1 * 1000),
    eastWestKm: Number(((x1 - x0) * horizontalScale).toFixed(2)),
    northSouthKm: Number(((z1 - z0) * horizontalScale).toFixed(2)),
    sourceBoundsKm: [x0, y0, z0, x1, y1, z1]
  };
}

export function createWeatherScene(gl, options = {}) {
  if (!gl || typeof gl.texImage3D !== 'function' || typeof gl.createVertexArray !== 'function') throw new Error('Weather scene requires the main WebGL2 context');
  const workerUrl = options.workerUrl || './modules/weather-mother/field-worker.js';
  const program = createProgram(gl);
  const vao = gl.createVertexArray();
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, parameter, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, 1, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]));
  gl.bindTexture(gl.TEXTURE_3D, null);

  const locations = new Map();
  const uniform = name => {
    if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
    return locations.get(name);
  };
  const worker = new Worker(workerUrl);
  let job = 0;
  let resolver = null;
  let rejecter = null;
  let profile = cloneProfile('coast');
  const state = {
    schema: 'wenzhou-single-scene-weather-state-1',
    sourceRuntimeVersion: WEATHER_SOURCE_VERSION,
    caseId: 'coast',
    seed: WORKER_SEED_DEFAULT,
    quality: 'balanced',
    dimensions: dimensions('balanced'),
    ready: false,
    loading: false,
    playing: true,
    simulationSeconds: 0,
    timeScale: 1,
    frameCount: 0,
    loadMilliseconds: null,
    fieldMetrics: null,
    workerReceipt: null,
    errors: [],
    sameWebGLContext: true,
    sharedDepth: true,
    cloudPassUsesLogDepth: true,
    calibrated: false,
    visualApproved: false,
    productionApproved: false
  };

  worker.onerror = event => {
    const error = new Error(event.message || 'Weather field worker failed');
    state.errors.push(error.message);
    state.loading = false;
    if (rejecter) rejecter(error);
    resolver = rejecter = null;
  };
  worker.onmessage = event => {
    const message = event.data;
    if (message.id !== job || message.light || message.noise) return;
    if (message.error) {
      const error = new Error(message.error);
      state.errors.push(error.message);
      state.loading = false;
      if (rejecter) rejecter(error);
      resolver = rejecter = null;
      return;
    }
    const field = message.data;
    const dims = state.dimensions;
    if (!(field instanceof Uint8Array) || field.length !== dims[0] * dims[1] * dims[2]) {
      const error = new Error('Weather field dimensions do not match the requested volume');
      state.errors.push(error.message);
      state.loading = false;
      if (rejecter) rejecter(error);
      resolver = rejecter = null;
      return;
    }
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, dims[0], dims[1], dims[2], 0, gl.RED, gl.UNSIGNED_BYTE, field);
    gl.bindTexture(gl.TEXTURE_3D, null);
    const errorCode = gl.getError();
    if (errorCode !== gl.NO_ERROR) {
      const error = new Error(`Weather 3D texture upload failed with WebGL error ${errorCode}`);
      state.errors.push(error.message);
      state.loading = false;
      if (rejecter) rejecter(error);
      resolver = rejecter = null;
      return;
    }
    state.fieldMetrics = scanField(field, dims, profile.horizontalScale);
    state.workerReceipt = {
      id: message.id,
      kind: message.kind,
      lobes: message.lobes,
      borderMax: message.borderMax,
      supportSafe: message.supportSafe,
      seed: message.seed,
      spacingKm: message.spacing,
      occupancy: message.occupancy ? {
        size: message.occupancy.size,
        occupied: message.occupancy.occupied,
        total: message.occupancy.total
      } : null
    };
    state.ready = true;
    state.loading = false;
    state.loadMilliseconds = performance.now() - state.loadStartedAt;
    if (resolver) resolver(getState());
    resolver = rejecter = null;
  };

  function rebuild() {
    job++;
    state.ready = false;
    state.loading = true;
    state.loadStartedAt = performance.now();
    state.dimensions = dimensions(state.quality);
    const solar = solarAt(profile.hour);
    worker.postMessage({
      id: job,
      case: profile.id,
      kind: profile.kind,
      density: profile.source.density,
      count: profile.source.count,
      rain: profile.source.rain,
      fog: profile.source.fog,
      humidity: profile.source.humidity,
      instability: profile.source.instability,
      seed: state.seed >>> 0,
      dims: state.dimensions,
      min: [...VOLUME_MIN_KM],
      max: [...VOLUME_MAX_KM],
      sun: solar.direction,
      cycloneSpin: profile.cycloneSpin,
      eyeRadius: profile.eyeRadius,
      rainbandCurl: profile.rainbandCurl,
      stormRadius: profile.stormRadius
    });
    return new Promise((resolve, reject) => {
      resolver = resolve;
      rejecter = reject;
    });
  }

  function setCase(id) {
    profile = cloneProfile(id);
    state.caseId = id;
    state.simulationSeconds = 0;
    return rebuild();
  }

  function setSeed(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed must be an unsigned 32 bit integer');
    state.seed = seed >>> 0;
    return rebuild();
  }

  function setQuality(quality) {
    if (!['balanced', 'high'].includes(quality)) throw new RangeError('quality must be balanced or high');
    state.quality = quality;
    return rebuild();
  }

  function set(key, value) {
    if (!Number.isFinite(value)) throw new TypeError(`${key} must be finite`);
    if (key === 'windSpeedMps') profile.windSpeedMps = Math.max(0, Math.min(80, value));
    else if (key === 'cloudSpeedMps') profile.cloudSpeedMps = Math.max(0, Math.min(250, value));
    else if (key === 'windFromDeg') profile.windFromDeg = ((value % 360) + 360) % 360;
    else if (key === 'densityScale') profile.densityScale = Math.max(0.25, Math.min(2.2, value));
    else if (key === 'timeScale') state.timeScale = Math.max(0, Math.min(8, value));
    else throw new Error(`unsupported weather control ${key}`);
  }

  function update(deltaSeconds) {
    if (state.playing && Number.isFinite(deltaSeconds) && deltaSeconds > 0) state.simulationSeconds += Math.min(deltaSeconds, 0.25) * state.timeScale;
  }

  function values() {
    const angle = profile.windFromDeg * Math.PI / 180;
    const travelXZ = [-Math.sin(angle), Math.cos(angle)];
    const driftSourceKm = [
      travelXZ[0] * profile.cloudSpeedMps * state.simulationSeconds / (1000 * profile.horizontalScale),
      travelXZ[1] * profile.cloudSpeedMps * state.simulationSeconds / (1000 * profile.horizontalScale)
    ];
    const solar = solarAt(profile.hour);
    const fieldMetrics = state.fieldMetrics || { baseM: 1000, topM: 7000, eastWestKm: 0, northSouthKm: 0, occupiedVoxels: 0, occupiedFraction: 0 };
    return { travelXZ, driftSourceKm, solar, fieldMetrics };
  }

  function applyTerrainUniforms(locationsObject, mode) {
    const active = mode === 3 && state.ready;
    const current = values();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, texture);
    const call = (kind, name, ...args) => {
      const location = locationsObject[name];
      if (location !== null && location !== undefined) gl[kind](location, ...args);
    };
    call('uniform1i', 'uCloudDensity', 0);
    call('uniform1f', 'uWeatherEnabled', active ? 1 : 0);
    call('uniform2fv', 'uCloudCenterM', profile.centerM);
    call('uniform1f', 'uCloudHorizontalScale', profile.horizontalScale);
    call('uniform3fv', 'uCloudFieldMin', VOLUME_MIN_KM);
    call('uniform3fv', 'uCloudFieldMax', VOLUME_MAX_KM);
    call('uniform2fv', 'uCloudDriftSourceKm', current.driftSourceKm);
    call('uniform2fv', 'uCloudVerticalM', [current.fieldMetrics.baseM, current.fieldMetrics.topM]);
    call('uniform1f', 'uCloudDensityScale', profile.densityScale);
    call('uniform1f', 'uFogDensity', active ? profile.fogDensityPerM : 0);
    call('uniform1f', 'uWeatherKind', profile.id === 'coast' ? 0 : profile.id === 'rain' ? 1 : 2);
    call('uniform1f', 'uCycloneSpin', profile.cycloneSpin);
    call('uniform1f', 'uCloudTime', state.simulationSeconds);
    return current;
  }

  function draw({ vp, eye, target, viewport, mode, logFar }) {
    if (mode !== 3 || !state.ready) return false;
    const forward = normalize3([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
    let right = normalize3(cross(forward, [0, 1, 0]));
    if (Math.hypot(...right) < 0.01) right = [1, 0, 0];
    const up = normalize3(cross(right, forward));
    const current = values();
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.uniform1i(uniform('uDensity'), 0);
    gl.uniformMatrix4fv(uniform('uVP'), false, vp);
    gl.uniform4fv(uniform('uViewport'), viewport);
    gl.uniform3fv(uniform('uEye'), eye);
    gl.uniform3fv(uniform('uForward'), forward);
    gl.uniform3fv(uniform('uRight'), right);
    gl.uniform3fv(uniform('uUp'), up);
    gl.uniform3fv(uniform('uSun'), current.solar.direction);
    gl.uniform3fv(uniform('uSunColor'), current.solar.color);
    gl.uniform3fv(uniform('uFieldMin'), VOLUME_MIN_KM);
    gl.uniform3fv(uniform('uFieldMax'), VOLUME_MAX_KM);
    gl.uniform2fv(uniform('uCenterM'), profile.centerM);
    gl.uniform2fv(uniform('uDriftSourceKm'), current.driftSourceKm);
    gl.uniform2fv(uniform('uCloudVerticalM'), [current.fieldMetrics.baseM, current.fieldMetrics.topM]);
    gl.uniform1f(uniform('uHorizontalScale'), profile.horizontalScale);
    gl.uniform1f(uniform('uDensityScale'), profile.densityScale);
    gl.uniform1f(uniform('uTime'), state.simulationSeconds);
    gl.uniform1f(uniform('uRain'), profile.source.rain);
    gl.uniform1f(uniform('uFog'), profile.fogDensityPerM);
    gl.uniform1f(uniform('uLogFar'), logFar);
    gl.uniform1f(uniform('uCycloneSpin'), profile.cycloneSpin);
    gl.uniform1f(uniform('uWeatherKind'), profile.id === 'coast' ? 0 : profile.id === 'rain' ? 1 : 2);
    gl.uniform1f(uniform('uTanHalfFov'), Math.tan(Math.PI / 8));
    gl.uniform1f(uniform('uAspect'), viewport[2] / viewport[3]);
    gl.uniform1f(uniform('uStepCount'), state.quality === 'high' ? (innerWidth < 700 ? 20 : 28) : innerWidth < 700 ? 14 : 20);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
    gl.bindVertexArray(null);
    state.frameCount++;
    return true;
  }

  function getState() {
    const current = values();
    return {
      ...state,
      profile: {
        id: profile.id,
        label: profile.label,
        kind: profile.kind,
        source: { ...profile.source },
        windFromDeg: profile.windFromDeg,
        windSpeedMps: profile.windSpeedMps,
        cloudSpeedMps: profile.cloudSpeedMps,
        horizontalScale: profile.horizontalScale,
        centerM: [...profile.centerM],
        densityScale: profile.densityScale,
        fogDensityPerM: profile.fogDensityPerM,
        cycloneSpin: profile.cycloneSpin
      },
      clock: { simulationSeconds: state.simulationSeconds, timeScale: state.timeScale, playing: state.playing },
      wind: { fromDegrees: profile.windFromDeg, speedMps: profile.windSpeedMps, cloudSpeedMps: profile.cloudSpeedMps, travelXZ: current.travelXZ },
      solar: current.solar,
      fieldMetrics: state.fieldMetrics ? { ...state.fieldMetrics } : null,
      errors: [...state.errors]
    };
  }

  function dispose() {
    worker.terminate();
    gl.deleteTexture(texture);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  }

  return {
    setCase,
    setSeed,
    setQuality,
    set,
    update,
    applyTerrainUniforms,
    draw,
    getState,
    pause() { state.playing = false; },
    play() { state.playing = true; },
    dispose,
    rebuild
  };
}
