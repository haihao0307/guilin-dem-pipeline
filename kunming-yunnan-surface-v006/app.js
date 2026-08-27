const canvas = document.getElementById('terrain');
canvas.style.touchAction = 'none';
const fallback = document.getElementById('fallback');
const fallbackImage = document.getElementById('fallbackImage');
const statusEl = document.getElementById('status');
document.documentElement.dataset.viewer = 'loading';

const manifest = await fetch('manifest.json?v=6', { cache: 'no-store' }).then(async response => {
  if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
  return response.json();
});

const truth = manifest.authoritativeDem;
const worldWidth = truth.widthMeters;
const worldDepth = truth.heightMeters;
const minElevation = truth.elevation.min;
const maxElevation = truth.elevation.max;
const meanElevation = truth.elevation.mean;
const elevationSpan = maxElevation - minElevation;

document.getElementById('riverCount').textContent = manifest.hydrology.mainWaterwayFeatures.toLocaleString('zh-CN');
document.getElementById('lakeCount').textContent = manifest.hydrology.displayedWaterAreaFeatures.toLocaleString('zh-CN');

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法载入 ${src}`));
    image.src = src;
  });
}

function startFallback(message) {
  document.documentElement.dataset.viewer = 'fallback';
  canvas.hidden = true;
  fallback.hidden = false;
  document.documentElement.dataset.viewer = 'fallback';
  document.documentElement.dataset.orientation = 'east-positive-x_north-negative-z';
  statusEl.textContent = `${message} · 已切换二维云南卫星图式预览`;
  let scale = 1;
  let x = 0;
  let y = 0;
  let dragging = false;
  let px = 0;
  let py = 0;
  function fit() {
    scale = Math.min(innerWidth / fallbackImage.naturalWidth, innerHeight / fallbackImage.naturalHeight) * 0.92;
    x = 0;
    y = 0;
    draw();
  }
  function draw() {
    fallbackImage.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`;
    fallbackImage.style.transformOrigin = 'center';
  }
  fallbackImage.onload = fit;
  if (fallbackImage.complete && fallbackImage.naturalWidth) fit();
  fallback.addEventListener('pointerdown', event => {
    dragging = true;
    px = event.clientX;
    py = event.clientY;
    fallback.setPointerCapture(event.pointerId);
  });
  fallback.addEventListener('pointermove', event => {
    if (!dragging) return;
    x += event.clientX - px;
    y += event.clientY - py;
    px = event.clientX;
    py = event.clientY;
    draw();
  });
  fallback.addEventListener('pointerup', event => {
    dragging = false;
    fallback.releasePointerCapture(event.pointerId);
  });
  fallback.addEventListener('wheel', event => {
    event.preventDefault();
    scale = Math.max(0.1, Math.min(14, scale * Math.exp(-event.deltaY * 0.001)));
    draw();
  }, { passive: false });
}

const gl = canvas.getContext('webgl2', {
  antialias: true,
  alpha: false,
  depth: true,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance'
});

if (!gl) {
  startFallback('浏览器没有提供 WebGL2');
} else {
  try {
    await start3D(gl);
    document.documentElement.dataset.viewer = 'ready';
  } catch (error) {
    console.error(error);
    startFallback(`三维载入失败：${error.message}`);
  }
}

async function start3D(gl) {
  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const desktopHigh = maxTexture >= 8192 && (navigator.deviceMemory || 8) >= 8 && innerWidth >= 1100;
  const surfacePath = desktopHigh ? 'assets/surface_yunnan_v006.png' : 'assets/surface_yunnan_v006_2048.png';
  const qaRenderMode=new URLSearchParams(location.search).has('qa');
  const [meshCols,meshRows]=qaRenderMode?[160,220]:(desktopHigh?[640,879]:[448,615]);

  statusEl.textContent = `正在载入 ${desktopHigh ? '4096 级' : '2048 级'}云南高原精细地表、静态水系与高程纹理…`;
  const [heightImage, surfaceImage, waterMaskImage, flowImage, waterLevelImage] = await Promise.all([
    loadImage('assets/height_rg16.png'),
    loadImage(surfacePath),
    loadImage('assets/osm_water_mask_v006.png'),
    loadImage('assets/osm_flow_direction_v004.png'),
    loadImage('assets/osm_water_level_rg16_v004.png')
  ]);

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = heightImage.width;
  heightCanvas.height = heightImage.height;
  const heightContext = heightCanvas.getContext('2d', { willReadFrequently: true });
  heightContext.drawImage(heightImage, 0, 0);
  const heightPixels = heightContext.getImageData(0, 0, heightCanvas.width, heightCanvas.height).data;

  function decodePixel(ix, iy) {
    const x = Math.max(0, Math.min(heightCanvas.width - 1, ix));
    const y = Math.max(0, Math.min(heightCanvas.height - 1, iy));
    const index = (y * heightCanvas.width + x) * 4;
    return ((heightPixels[index] << 8) | heightPixels[index + 1]) / 65535;
  }

  function sampleHeight(u, v) {
    const x = Math.max(0, Math.min(heightCanvas.width - 1, u * (heightCanvas.width - 1)));
    const y = Math.max(0, Math.min(heightCanvas.height - 1, v * (heightCanvas.height - 1)));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(heightCanvas.width - 1, x0 + 1);
    const y1 = Math.min(heightCanvas.height - 1, y0 + 1);
    const tx = x - x0;
    const ty = y - y0;
    const a = decodePixel(x0, y0);
    const b = decodePixel(x1, y0);
    const c = decodePixel(x0, y1);
    const d = decodePixel(x1, y1);
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  }

  function groundY(x, z) {
    const u = Math.max(0, Math.min(1, x / worldWidth + 0.5));
    const v = Math.max(0, Math.min(1, z / worldDepth + 0.5));
    return minElevation + sampleHeight(u, v) * elevationSpan - meanElevation;
  }

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'shader compile');
    }
    return shader;
  }

  function makeProgram(vertexSource, fragmentSource) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'program link');
    }
    return program;
  }

  function imageTexture(image, unit) {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    return texture;
  }

  const vertexShader = `#version 300 es
precision highp float;
layout(location=0) in vec2 aUV;
uniform sampler2D uHeight;
uniform sampler2D uWaterMask;
uniform sampler2D uWaterLevel;
uniform mat4 uMVP;
uniform vec2 uWorldSize;
uniform float uMinElevation;
uniform float uElevationSpan;
uniform float uMeanElevation;
out vec2 vUV;
out vec3 vWorld;
float decodeHeight(vec4 c){
  float hi=floor(c.r*255.0+0.5);
  float lo=floor(c.g*255.0+0.5);
  return (hi*256.0+lo)/65535.0;
}
void main(){
  float elevation=uMinElevation+decodeHeight(texture(uHeight,aUV))*uElevationSpan;
  vec4 maskTex=texture(uWaterMask,aUV);
  vec4 levelTex=texture(uWaterLevel,aUV);
  float lakeInterior=smoothstep(.42,.90,maskTex.b)*smoothstep(.20,.80,levelTex.b);
  float waterElevation=uMinElevation+decodeHeight(levelTex)*uElevationSpan+.35;
  elevation=mix(elevation,waterElevation,lakeInterior);
  vec3 p=vec3((aUV.x-.5)*uWorldSize.x,elevation-uMeanElevation,(aUV.y-.5)*uWorldSize.y);
  vUV=aUV;
  vWorld=p;
  gl_Position=uMVP*vec4(p,1.0);
}`;

  const fragmentShader = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vWorld;
out vec4 outColor;
uniform sampler2D uHeight;
uniform sampler2D uSurface;
uniform sampler2D uWaterMask;
uniform sampler2D uFlow;
uniform vec2 uTexel;
uniform vec2 uWorldSize;
uniform float uMinElevation;
uniform float uElevationSpan;
uniform float uTime;
uniform float uRichness;
uniform float uMoisture;
uniform float uRock;
uniform float uWaterColor;
uniform float uHydroDetail;
uniform float uRiverWidth;
uniform float uFlowSpeed;
uniform float uWave;
uniform int uMode;
uniform int uShowRivers;
uniform int uShowLakes;
float decodeHeight(vec4 c){
  float hi=floor(c.r*255.0+0.5);
  float lo=floor(c.g*255.0+0.5);
  return (hi*256.0+lo)/65535.0;
}
float heightAt(vec2 uv){
  return decodeHeight(texture(uHeight,clamp(uv,vec2(0.0),vec2(1.0))))*uElevationSpan+uMinElevation;
}
vec3 elevationPalette(float t){
  vec3 a=vec3(.16,.31,.20);
  vec3 b=vec3(.38,.50,.25);
  vec3 c=vec3(.62,.52,.31);
  vec3 d=vec3(.58,.49,.43);
  vec3 e=vec3(.88,.88,.86);
  if(t<.22)return mix(a,b,t/.22);
  if(t<.54)return mix(b,c,(t-.22)/.32);
  if(t<.82)return mix(c,d,(t-.54)/.28);
  return mix(d,e,(t-.82)/.18);
}
vec3 saturation(vec3 c,float amount){
  float l=dot(c,vec3(.299,.587,.114));
  return mix(vec3(l),c,amount);
}
void main(){
  float center=heightAt(vUV);
  float dx=(heightAt(vUV+vec2(uTexel.x,0.0))-heightAt(vUV-vec2(uTexel.x,0.0)))/(2.0*uTexel.x*uWorldSize.x);
  float dz=(heightAt(vUV+vec2(0.0,uTexel.y))-heightAt(vUV-vec2(0.0,uTexel.y)))/(2.0*uTexel.y*uWorldSize.y);
  vec3 normal=normalize(vec3(-dx,1.0,-dz));
  vec3 light=normalize(vec3(-.55,.76,.36));
  float diffuse=max(dot(normal,light),0.0);
  float illumination=.62+.42*diffuse;
  float t=clamp((center-uMinElevation)/uElevationSpan,0.0,1.0);
  float slope=clamp(1.0-normal.y,0.0,1.0);
  float flatTerrain=clamp(1.0-slope*2.0,0.0,1.0);
  vec3 surface=texture(uSurface,vUV).rgb;
  vec3 color=surface*(.90+.15*diffuse);
  if(uMode==0){
    vec3 yunnan=saturation(surface,.92+.22*uRichness);
    float valleyGreen=clamp((1.0-t)*flatTerrain*(.25+.75*uMoisture),0.0,1.0);
    yunnan=mix(yunnan,vec3(.14,.29,.14),valleyGreen*.08*uMoisture);
    float exposedRock=clamp(slope*.76+(t-.62)*.72,0.0,1.0);
    yunnan=mix(yunnan,vec3(.31,.27,.23),exposedRock*.08*uRock);
    color=yunnan*(.90+.12*diffuse);
  }else if(uMode==1){
    color=surface*(.92+.12*diffuse);
  }else if(uMode==2){
    color=elevationPalette(t)*illumination;
  }else{
    color=mix(vec3(.18,.23,.20),surface,.42)*(.82+.18*diffuse);
  }

  vec4 waterMask=texture(uWaterMask,vUV);
  float widthCurve=pow(clamp(uRiverWidth,0.0,1.0),1.70);
  float mainThreshold=mix(.996,.42,widthCurve);
  float minorThreshold=mix(.998,.65,widthCurve);
  float mainRiver=smoothstep(mainThreshold,min(1.0,mainThreshold+.003),waterMask.r);
  float minorRiver=smoothstep(minorThreshold,min(1.0,minorThreshold+.003),waterMask.g)*uHydroDetail;
  float river=uShowRivers==1?max(mainRiver,minorRiver):0.0;
  float lake=uShowLakes==1?smoothstep(.22,.82,waterMask.b):0.0;
  float water=max(river,lake);
  vec3 deep=mix(vec3(.035,.16,.20),vec3(.055,.27,.31),uWaterColor);
  vec3 shallow=mix(vec3(.10,.28,.30),vec3(.16,.40,.42),uWaterColor);
  vec3 staticWater=mix(deep,shallow,.18+.20*lake);
  float opacity=mix(.42,.66,uWaterColor);
  color=mix(color,staticWater,water*opacity);
  outColor=vec4(clamp(color,0.0,1.0),1.0);
}`;

  const program = makeProgram(vertexShader, fragmentShader);
  gl.useProgram(program);
  statusEl.textContent = `正在建立三维网格 ${meshCols} × ${meshRows}…`;
  await new Promise(resolve => requestAnimationFrame(resolve));

  const vertices = new Float32Array(meshCols * meshRows * 2);
  let cursor = 0;
  for (let row = 0; row < meshRows; row++) {
    for (let col = 0; col < meshCols; col++) {
      vertices[cursor++] = col / (meshCols - 1);
      vertices[cursor++] = row / (meshRows - 1);
    }
  }

  const indexCount = (meshCols - 1) * (meshRows - 1) * 6;
  const indices = new Uint32Array(indexCount);
  cursor = 0;
  for (let row = 0; row < meshRows - 1; row++) {
    for (let col = 0; col < meshCols - 1; col++) {
      const a = row * meshCols + col;
      const b = a + 1;
      const c = a + meshCols;
      const d = c + 1;
      indices[cursor++] = a;
      indices[cursor++] = c;
      indices[cursor++] = b;
      indices[cursor++] = b;
      indices[cursor++] = c;
      indices[cursor++] = d;
    }
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  imageTexture(heightImage, 0);
  imageTexture(surfaceImage, 1);
  imageTexture(waterMaskImage, 2);
  imageTexture(flowImage, 3);
  imageTexture(waterLevelImage, 4);

  const uniform = name => gl.getUniformLocation(program, name);
  gl.uniform1i(uniform('uHeight'), 0);
  gl.uniform1i(uniform('uSurface'), 1);
  gl.uniform1i(uniform('uWaterMask'), 2);
  gl.uniform1i(uniform('uFlow'), 3);
  gl.uniform1i(uniform('uWaterLevel'), 4);
  gl.uniform2f(uniform('uWorldSize'), worldWidth, worldDepth);
  gl.uniform2f(uniform('uTexel'), 1 / heightImage.width, 1 / heightImage.height);
  gl.uniform1f(uniform('uMinElevation'), minElevation);
  gl.uniform1f(uniform('uElevationSpan'), elevationSpan);
  gl.uniform1f(uniform('uMeanElevation'), meanElevation);

  function identity() {
    const matrix = new Float32Array(16);
    matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1;
    return matrix;
  }
  function perspective(output, fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    output.fill(0);
    output[0] = f / aspect;
    output[5] = f;
    output[10] = (far + near) * nf;
    output[11] = -1;
    output[14] = 2 * far * near * nf;
    return output;
  }
  function lookAt(output, eye, center, up) {
    let zx = eye[0] - center[0];
    let zy = eye[1] - center[1];
    let zz = eye[2] - center[2];
    let length = Math.hypot(zx, zy, zz) || 1;
    zx /= length; zy /= length; zz /= length;
    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    length = Math.hypot(xx, xy, xz) || 1;
    xx /= length; xy /= length; xz /= length;
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;
    output[0] = xx; output[1] = yx; output[2] = zx; output[3] = 0;
    output[4] = xy; output[5] = yy; output[6] = zy; output[7] = 0;
    output[8] = xz; output[9] = yz; output[10] = zz; output[11] = 0;
    output[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    output[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    output[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    output[15] = 1;
    return output;
  }
  function multiply(output, a, b) {
    const result = new Float32Array(16);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        result[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
      }
    }
    output.set(result);
    return output;
  }

  const params = {
    mode: 0,
    richness: 0.78,
    moisture: 0.58,
    rock: 0.64,
    waterColor: 0.42,
    hydroDetail: 0.00,
    riverWidth: 0.04,
    flowSpeed: 0.00,
    wave: 0.00,
    showRivers: true,
    showLakes: true
  };

  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', () => {
      params.mode = Number(button.dataset.mode);
      document.querySelectorAll('[data-mode]').forEach(other => other.classList.toggle('active', other === button));
    });
  });

  function bindRange(id, key, outputId) {
    const input = document.getElementById(id);
    const output = document.getElementById(outputId);
    input.addEventListener('input', () => {
      params[key] = Number(input.value) / 100;
      output.textContent = `${input.value}%`;
    });
  }
  bindRange('richness', 'richness', 'richnessOut');
  bindRange('moisture', 'moisture', 'moistureOut');
  bindRange('rock', 'rock', 'rockOut');
  bindRange('waterColor', 'waterColor', 'waterColorOut');
  bindRange('hydroDetail', 'hydroDetail', 'hydroDetailOut');
  bindRange('riverWidth', 'riverWidth', 'riverWidthOut');

  document.getElementById('toggleRivers').addEventListener('click', event => {
    params.showRivers = !params.showRivers;
    event.currentTarget.classList.toggle('active', params.showRivers);
    event.currentTarget.textContent = params.showRivers ? '河道开启' : '河道关闭';
  });
  document.getElementById('toggleLakes').addEventListener('click', event => {
    params.showLakes = !params.showLakes;
    event.currentTarget.classList.toggle('active', params.showLakes);
    event.currentTarget.textContent = params.showLakes ? '湖泊开启' : '湖泊关闭';
  });

  const camera = { yaw: 0.0, pitch: 0.72, distance: 104000, x: 0, z: 0 };
  const compassNeedle = document.getElementById('compassNeedle');
  const fovRadians = Math.PI / 4;
  const rotateSpeed = 0.86;
  document.documentElement.dataset.buttonlessCamera = 'disabled';
  if (qaRenderMode) window.__KUNMING_V005_QA_CAMERA__ = camera;
  let dragging = false;
  let panning = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointerdown', event => {
    dragging = true;
    panning = event.button === 2 || event.shiftKey;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (panning) {
      const targetDistance = camera.distance * Math.tan(fovRadians / 2);
      const panX = 2 * dx * targetDistance / Math.max(1, canvas.clientHeight);
      const panY = 2 * dy * targetDistance / Math.max(1, canvas.clientHeight);
      const rightX = Math.cos(camera.yaw);
      const rightZ = -Math.sin(camera.yaw);
      const backwardX = Math.sin(camera.yaw);
      const backwardZ = Math.cos(camera.yaw);
      camera.x -= panX * rightX + panY * backwardX;
      camera.z -= panX * rightZ + panY * backwardZ;
      camera.x = Math.max(-worldWidth / 2, Math.min(worldWidth / 2, camera.x));
      camera.z = Math.max(-worldDepth / 2, Math.min(worldDepth / 2, camera.z));
    } else {
      const height = Math.max(1, canvas.clientHeight);
      camera.yaw -= 2 * Math.PI * dx / height * rotateSpeed;
      camera.pitch = Math.max(0.035, Math.min(1.555, camera.pitch + 2 * Math.PI * dy / height * rotateSpeed));
    }
  });
  function endPointer(event) {
    dragging = false;
    panning = false;
    canvas.classList.remove('dragging');
    if (event && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    camera.distance = Math.max(1.6, Math.min(240000, camera.distance * Math.exp(event.deltaY * 0.0011)));
  }, { passive: false });

  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(innerWidth * ratio));
    const height = Math.max(1, Math.floor(innerHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  const startTime = performance.now();
  function render() {
    resize();
    const targetY = groundY(camera.x, camera.z);
    const cosPitch = Math.cos(camera.pitch);
    const sinPitch = Math.sin(camera.pitch);
    const eye = [
      camera.x + camera.distance * cosPitch * Math.sin(camera.yaw),
      targetY + camera.distance * sinPitch,
      camera.z + camera.distance * cosPitch * Math.cos(camera.yaw)
    ];
    const near = Math.max(0.05, Math.min(40, camera.distance * 0.00035));
    const far = Math.max(350000, camera.distance * 4 + 250000);
    const projection = identity();
    const view = identity();
    const mvp = identity();
    perspective(projection, fovRadians, canvas.width / canvas.height, near, far);
    lookAt(view, eye, [camera.x, targetY, camera.z], [0, 1, 0]);
    multiply(mvp, projection, view);

    gl.clearColor(0.79, 0.84, 0.85, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(program);
    gl.uniformMatrix4fv(uniform('uMVP'), false, mvp);
    gl.uniform1f(uniform('uTime'), (performance.now() - startTime) / 1000);
    gl.uniform1f(uniform('uRichness'), params.richness);
    gl.uniform1f(uniform('uMoisture'), params.moisture);
    gl.uniform1f(uniform('uRock'), params.rock);
    gl.uniform1f(uniform('uWaterColor'), params.waterColor);
    gl.uniform1f(uniform('uHydroDetail'), params.hydroDetail);
    gl.uniform1f(uniform('uRiverWidth'), params.riverWidth);
    gl.uniform1f(uniform('uFlowSpeed'), params.flowSpeed);
    gl.uniform1f(uniform('uWave'), params.wave);
    gl.uniform1i(uniform('uMode'), params.mode);
    gl.uniform1i(uniform('uShowRivers'), params.showRivers ? 1 : 0);
    gl.uniform1i(uniform('uShowLakes'), params.showLakes ? 1 : 0);
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);

    const sampleX = Math.max(-worldWidth / 2, Math.min(worldWidth / 2, eye[0]));
    const sampleZ = Math.max(-worldDepth / 2, Math.min(worldDepth / 2, eye[2]));
    const elevationGround = groundY(sampleX, sampleZ);
    const clearance = Math.max(0, eye[1] - elevationGround);
    if (compassNeedle) compassNeedle.style.transform = `rotate(${camera.yaw}rad)`;
    statusEl.textContent = `V006 · 云南高原精细地表 · 静态水面 · ${desktopHigh ? '4096 级色彩' : '2048 级色彩'} · ${manifest.hydrology.clippedWaterwayFeatures.toLocaleString('zh-CN')} 条 OSM 水路线 · ${manifest.hydrology.clippedWaterAreaFeatures.toLocaleString('zh-CN')} 个水体面 · 镜头离地约 ${clearance.toFixed(clearance < 100 ? 1 : 0)} m`;
    requestAnimationFrame(render);
  }
  document.documentElement.dataset.viewer = 'ready';
  document.documentElement.dataset.orientation = 'east-positive-x_north-negative-z';
  document.documentElement.dataset.controls = 'orbit-standard';
  render();
}
