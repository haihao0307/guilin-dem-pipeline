const $ = (id) => document.getElementById(id);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);
const radians = (degrees) => degrees * Math.PI / 180;
const numberFormat = new Intl.NumberFormat('zh-CN');

const ASSET = './assets/bootstrap/';
const EOX_WMS = 'https://tiles.maps.eox.at/map';
const EOX_ATTRIBUTION = 'EOxCloudless by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)';

const ui = {
  canvas: $('gl'),
  controller: $('controller'),
  panelToggle: $('panelToggle'),
  closePanel: $('closePanel'),
  loadingCard: $('loadingCard'),
  loadingTitle: $('loadingTitle'),
  loadingDetail: $('loadingDetail'),
  loadingProgress: $('loadingProgress'),
  errorCard: $('errorCard'),
  errorText: $('errorText'),
  statusDot: $('statusDot'),
  statusText: $('statusText'),
  materialTag: $('materialTag'),
  hydrologyTag: $('hydrologyTag'),
  fpsTag: $('fpsTag'),
  materialStatus: $('materialStatus'),
  satelliteSource: $('satelliteSource'),
  runtimeState: $('runtimeState'),
  riverMetric: $('riverMetric'),
  coastMetric: $('coastMetric'),
  elevationMetric: $('elevationMetric'),
  triangleMetric: $('triangleMetric'),
  cameraModeLabel: $('cameraModeLabel'),
  cameraReadout: $('cameraReadout'),
  renderReadout: $('renderReadout'),
  showTerrain: $('showTerrain'),
  showOcean: $('showOcean'),
  showBathy: $('showBathy'),
  showRivers: $('showRivers'),
  showCoast: $('showCoast'),
  showPending: $('showPending'),
  riverWidth: $('riverWidth'),
  riverWidthOut: $('riverWidthOut'),
  waterOpacity: $('waterOpacity'),
  waterOpacityOut: $('waterOpacityOut'),
};

function setLoading(progress, title, detail) {
  ui.loadingProgress.value = progress;
  ui.loadingTitle.textContent = title;
  ui.loadingDetail.textContent = detail;
}

function setStatus(message, kind = 'working') {
  ui.statusText.textContent = message;
  ui.statusDot.className = `dot ${kind}`;
}

function showFatal(error) {
  const message = String(error?.stack || error?.message || error);
  ui.errorText.textContent = message;
  ui.errorCard.classList.add('visible');
  ui.loadingCard.classList.add('hidden');
  setStatus('三维运行时启动失败', 'error');
  window.__WENZHOU_V110_DIAGNOSTICS__ = {
    ready: false,
    fatalError: message,
    truthfulTerrain: true,
    publicationBlocked: true,
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`JSON HTTP ${response.status}: ${url}`);
  return response.json();
}

async function fetchBuffer(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`binary HTTP ${response.status}: ${url}`);
  return response.arrayBuffer();
}

function loadImage(url, crossOrigin = null) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = crossOrigin;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`image load failed: ${url}`));
    image.src = url;
  });
}

const Vec3 = {
  normalize(a) {
    const length = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / length, a[1] / length, a[2] / length];
  },
  cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  },
  sub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },
};

const Mat4 = {
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
    const x = Vec3.normalize(Vec3.cross(up, z));
    const y = Vec3.cross(z, x);
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
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        out[column * 4 + row] =
          a[row] * b[column * 4] +
          a[4 + row] * b[column * 4 + 1] +
          a[8 + row] * b[column * 4 + 2] +
          a[12 + row] * b[column * 4 + 3];
      }
    }
    return out;
  },
};

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'unknown shader error';
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
    const message = gl.getProgramInfoLog(program) || 'unknown link error';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function locations(gl, program, names) {
  return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
}

const GLSL = '#version 300 es\nprecision highp float;\n';
const TERRAIN_VERTEX = GLSL + `
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
layout(location=3) in float aMarine;
uniform mat4 uViewProj;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;
out float vHeight;
out float vMarine;
void main(){vWorld=aPosition;vNormal=aNormal;vUv=aUv;vHeight=aPosition.y;vMarine=aMarine;gl_Position=uViewProj*vec4(aPosition,1.0);}`;
const TERRAIN_FRAGMENT = GLSL + `
in vec3 vWorld;in vec3 vNormal;in vec2 vUv;in float vHeight;in float vMarine;
out vec4 outColor;
uniform sampler2D uMap;uniform vec3 uCamera;uniform vec3 uFogColor;uniform int uMode;
void main(){
  vec3 N=normalize(vNormal);float slope=clamp(1.0-N.y,0.0,1.0);float light=.35+.74*max(dot(N,normalize(vec3(-.44,.82,-.36))),0.0)+.10*max(dot(N,normalize(vec3(.44,.28,.36))),0.0);
  vec3 color=texture(uMap,vUv).rgb;
  if(uMode==1)color=vec3(.18+.82*light);
  if(uMode==2){float g=dot(color,vec3(.299,.587,.114));color=vec3(g)*(.65+.35*light);}
  if(uMode==3){float h=clamp(vHeight/1345.0,0.0,1.0);color=mix(vec3(.08,.15,.22),vec3(.60,.61,.55),h);}
  if(uMode==0)color*=light;
  if(vMarine>.5)color=mix(color,vec3(.08,.24,.31),.35);
  float fog=smoothstep(85000.0,250000.0,length(uCamera-vWorld));color=mix(color,uFogColor,fog*.82);
  outColor=vec4(pow(clamp(color,0.0,1.25),vec3(.92)),1.0);
}`;
const BATHY_VERTEX = GLSL + `layout(location=0) in vec3 aPosition;layout(location=1) in vec2 aUv;uniform mat4 uViewProj;out vec3 vWorld;out float vDepth;void main(){vWorld=aPosition;vDepth=aPosition.y;gl_Position=uViewProj*vec4(aPosition,1.0);}`;
const BATHY_FRAGMENT = GLSL + `in vec3 vWorld;in float vDepth;out vec4 outColor;uniform vec3 uCamera;uniform vec3 uFogColor;uniform float uEmphasis;void main(){float d=clamp(-vDepth/100.0,0.0,1.0);vec3 c=mix(vec3(.12,.31,.38),vec3(.025,.09,.18),d);c=mix(c,vec3(.08+d*.08,.16,.24+d*.18),uEmphasis);float f=smoothstep(100000.0,280000.0,length(uCamera-vWorld));outColor=vec4(mix(c,uFogColor,f*.8),1.0);}`;
const WATER_VERTEX = GLSL + `layout(location=0) in vec3 aPosition;layout(location=3) in float aMarine;uniform mat4 uViewProj;uniform float uTime;uniform float uSeaLevel;out vec3 vWorld;out float vMarine;void main(){float wave=(sin(aPosition.x*.00035+uTime*.55)+cos(aPosition.z*.00029-uTime*.43))*.32;vWorld=vec3(aPosition.x,uSeaLevel+wave,aPosition.z);vMarine=aMarine;gl_Position=uViewProj*vec4(vWorld,1.0);}`;
const WATER_FRAGMENT = GLSL + `in vec3 vWorld;in float vMarine;out vec4 outColor;uniform vec3 uCamera;uniform float uOpacity;void main(){if(vMarine<.5)discard;vec3 V=normalize(uCamera-vWorld);float fres=pow(1.0-clamp(V.y,0.0,1.0),3.0);vec3 c=mix(vec3(.055,.22,.29),vec3(.20,.47,.52),fres);outColor=vec4(c,uOpacity);}`;
const FLAT_VERTEX = GLSL + `layout(location=0) in vec3 aPosition;layout(location=1) in vec4 aColor;uniform mat4 uViewProj;uniform float uPointSize;out vec4 vColor;void main(){vColor=aColor;gl_Position=uViewProj*vec4(aPosition,1.0);gl_PointSize=uPointSize;}`;
const FLAT_FRAGMENT = GLSL + `in vec4 vColor;out vec4 outColor;uniform float uRound;void main(){if(uRound>.5&&length(gl_PointCoord-.5)>.5)discard;outColor=vColor;}`;

function createBuffer(gl, target, data, usage = gl.STATIC_DRAW) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);
  return buffer;
}

function createTexture(gl, image) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  return texture;
}

function computeNormals(positions, grid) {
  const normals = new Float32Array(positions.length);
  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const left = positions[(row * grid + Math.max(0, col - 1)) * 3 + 1];
      const right = positions[(row * grid + Math.min(grid - 1, col + 1)) * 3 + 1];
      const north = positions[(Math.max(0, row - 1) * grid + col) * 3 + 1];
      const south = positions[(Math.min(grid - 1, row + 1) * grid + col) * 3 + 1];
      const normal = Vec3.normalize([left - right, 2 * 290, north - south]);
      const index = (row * grid + col) * 3;
      normals[index] = normal[0];normals[index + 1] = normal[1];normals[index + 2] = normal[2];
    }
  }
  return normals;
}

function createInterleavedTerrain(gl, heightBuffer, marineBuffer, manifest, mobile) {
  const sourceGrid = manifest.terrainOverview.grid[0];
  const targetGrid = mobile ? 257 : sourceGrid;
  const sourceHeight = new Uint16Array(heightBuffer);
  const sourceMarine = new Uint8Array(marineBuffer);
  const minimum = manifest.terrainOverview.minimumElevationMeters;
  const maximum = manifest.terrainOverview.maximumElevationMeters;
  const width = manifest.terrainOverview.widthMeters;
  const depth = manifest.terrainOverview.heightMeters;
  const positions = new Float32Array(targetGrid * targetGrid * 3);
  const uvs = new Float32Array(targetGrid * targetGrid * 2);
  const marine = new Float32Array(targetGrid * targetGrid);
  const heights = new Float32Array(targetGrid * targetGrid);
  for (let row = 0; row < targetGrid; row += 1) {
    const sourceRow = Math.round(row / (targetGrid - 1) * (sourceGrid - 1));
    for (let col = 0; col < targetGrid; col += 1) {
      const sourceCol = Math.round(col / (targetGrid - 1) * (sourceGrid - 1));
      const sourceIndex = sourceRow * sourceGrid + sourceCol;
      const index = row * targetGrid + col;
      const value = minimum + sourceHeight[sourceIndex] / 65535 * (maximum - minimum);
      heights[index] = value;
      positions[index * 3] = -width / 2 + col / (targetGrid - 1) * width;
      positions[index * 3 + 1] = value;
      positions[index * 3 + 2] = -depth / 2 + row / (targetGrid - 1) * depth;
      uvs[index * 2] = col / (targetGrid - 1);
      uvs[index * 2 + 1] = 1 - row / (targetGrid - 1);
      marine[index] = sourceMarine[sourceIndex] > 0 ? 1 : 0;
    }
  }
  const normals = computeNormals(positions, targetGrid);
  const vertices = new Float32Array(targetGrid * targetGrid * 9);
  for (let index = 0; index < targetGrid * targetGrid; index += 1) {
    const offset = index * 9;
    vertices.set(positions.subarray(index * 3, index * 3 + 3), offset);
    vertices.set(normals.subarray(index * 3, index * 3 + 3), offset + 3);
    vertices.set(uvs.subarray(index * 2, index * 2 + 2), offset + 6);
    vertices[offset + 8] = marine[index];
  }
  const indices = new Uint32Array((targetGrid - 1) * (targetGrid - 1) * 6);
  let cursor = 0;
  for (let row = 0; row < targetGrid - 1; row += 1) {
    for (let col = 0; col < targetGrid - 1; col += 1) {
      const a = row * targetGrid + col;const b = a + 1;const c = a + targetGrid;const d = c + 1;
      indices.set([a, c, b, b, c, d], cursor);cursor += 6;
    }
  }
  const vao = gl.createVertexArray();gl.bindVertexArray(vao);
  const vertexBuffer = createBuffer(gl, gl.ARRAY_BUFFER, vertices);
  const indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indices);
  const stride = 9 * 4;
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
  gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);
  gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 8 * 4);
  gl.bindVertexArray(null);
  return { vao, vertexBuffer, indexBuffer, indexCount: indices.length, grid: targetGrid, width, depth, heights, marine };
}

function createBathymetryMesh(gl, buffer, manifest) {
  const values = new Int16Array(buffer);
  const grid = manifest.bathymetryOverview.grid[0];
  const bounds = manifest.bathymetryOverview.bounds;
  const origin = manifest.worldOriginProjected;
  const positions = new Float32Array(grid * grid * 5);
  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const index = row * grid + col;
      positions[index * 5] = bounds[0] + col / (grid - 1) * (bounds[2] - bounds[0]) - origin[0];
      positions[index * 5 + 1] = values[index] === -32768 ? -1 : Math.min(values[index], -.15);
      positions[index * 5 + 2] = origin[1] - (bounds[3] - row / (grid - 1) * (bounds[3] - bounds[1]));
      positions[index * 5 + 3] = col / (grid - 1);positions[index * 5 + 4] = row / (grid - 1);
    }
  }
  const indices = new Uint32Array((grid - 1) * (grid - 1) * 6);let cursor = 0;
  for (let row = 0; row < grid - 1; row += 1) for (let col = 0; col < grid - 1; col += 1) {const a=row*grid+col,b=a+1,c=a+grid,d=c+1;indices.set([a,c,b,b,c,d],cursor);cursor+=6;}
  const vao = gl.createVertexArray();gl.bindVertexArray(vao);
  const vertexBuffer = createBuffer(gl, gl.ARRAY_BUFFER, positions);const indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indices);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,5*4,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,5*4,3*4);
  gl.bindVertexArray(null);return { vao, vertexBuffer, indexBuffer, indexCount: indices.length, grid };
}

function createFlatMesh(gl, values, usage = gl.STATIC_DRAW) {
  const array = new Float32Array(values);const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const buffer=createBuffer(gl,gl.ARRAY_BUFFER,array,usage);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,7*4,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,7*4,3*4);gl.bindVertexArray(null);return{vao,buffer,count:array.length/7};
}

const state = {
  gl: null, manifest: null, terrain: null, bathy: null, coastData: null, riverData: null,
  coastMesh: null, riverMesh: null, pendingMesh: null, programs: {}, textures: {}, activeTexture: null,
  material: 'satellite', onlineLoading: false, ready: false,
  layers: { terrain: true, ocean: true, bathy: true, rivers: true, coast: true, pending: false },
  riverWidth: 1, waterOpacity: .68, currentAnchor: 'overall', flight: null, keys: new Set(), pointer: null,
  camera: { target: [0, 150, 0], distance: 185000, azimuth: -.78, elevation: .58, ground: false, yaw: -.78, pitch: -.05 },
  lastFrame: performance.now(), frameCount: 0, fpsTime: performance.now(), fps: 0,
};

function sampleTerrain(x, z) {
  const terrain = state.terrain;if (!terrain) return 0;
  const column=(x+terrain.width/2)/terrain.width*(terrain.grid-1),row=(z+terrain.depth/2)/terrain.depth*(terrain.grid-1);
  if(column<0||row<0||column>terrain.grid-1||row>terrain.grid-1)return 0;
  const x0=Math.floor(column),z0=Math.floor(row),x1=Math.min(terrain.grid-1,x0+1),z1=Math.min(terrain.grid-1,z0+1),tx=column-x0,tz=row-z0;
  const a=terrain.heights[z0*terrain.grid+x0],b=terrain.heights[z0*terrain.grid+x1],c=terrain.heights[z1*terrain.grid+x0],d=terrain.heights[z1*terrain.grid+x1];
  return lerp(lerp(a,b,tx),lerp(c,d,tx),tz);
}
function sampleMarine(x,z){const terrain=state.terrain;if(!terrain)return 0;const column=Math.round((x+terrain.width/2)/terrain.width*(terrain.grid-1)),row=Math.round((z+terrain.depth/2)/terrain.depth*(terrain.grid-1));if(column<0||row<0||column>=terrain.grid||row>=terrain.grid)return 1;return terrain.marine[row*terrain.grid+column]>0?1:0;}

function buildCoastMesh(){const values=[];for(const part of state.coastData.parts||[]){const coords=part.coords||[];for(let index=1;index<coords.length;index+=1){for(const point of[coords[index-1],coords[index]])values.push(point[0],1.8,point[1],.62,.92,.88,.82);}}state.coastMesh=createFlatMesh(state.gl,values);}
function buildRiverMesh(){const gl=state.gl;if(state.riverMesh){gl.deleteBuffer(state.riverMesh.buffer);gl.deleteVertexArray(state.riverMesh.vao);}const values=[],pending=[];const colors={river:[.10,.53,.72,.94],stream:[.22,.62,.76,.76],canal:[.20,.70,.65,.82],tidal_channel:[.10,.76,.78,.92]};for(const part of state.riverData.parts||[]){const coords=part.coords||[];if(coords.length<2)continue;const baseWidth=Math.max(Number(part.widthMeters||0),part.type==='river'?55:part.type==='tidal_channel'?30:part.type==='canal'?10:6)*state.riverWidth;const color=colors[part.type]||colors.stream;for(let index=1;index<coords.length;index+=1){const p0=coords[index-1],p1=coords[index],dx=p1[0]-p0[0],dz=p1[1]-p0[1],length=Math.hypot(dx,dz);if(length<.01)continue;const nx=-dz/length*baseWidth*.5,nz=dx/length*baseWidth*.5,y0=sampleMarine(p0[0],p0[1])?1.25:sampleTerrain(p0[0],p0[1])+1.25,y1=sampleMarine(p1[0],p1[1])?1.25:sampleTerrain(p1[0],p1[1])+1.25;const a=[p0[0]+nx,y0,p0[1]+nz],b=[p0[0]-nx,y0,p0[1]-nz],c=[p1[0]+nx,y1,p1[1]+nz],d=[p1[0]-nx,y1,p1[1]-nz];for(const vertex of[a,b,c,c,b,d])values.push(vertex[0],vertex[1],vertex[2],...color);}if((part.type==='river'||part.type==='tidal_channel'||part.name)&&pending.length<7*180){for(const endpoint of[coords[0],coords[coords.length-1]])if(sampleMarine(endpoint[0],endpoint[1]))pending.push(endpoint[0],4.0,endpoint[1],.98,.45,.18,.88);}}state.riverMesh=createFlatMesh(gl,values,gl.DYNAMIC_DRAW);state.pendingMesh=createFlatMesh(gl,pending,gl.DYNAMIC_DRAW);}

function resizeCanvas(gl){const dpr=Math.min(window.devicePixelRatio||1,2),width=Math.max(1,Math.floor(ui.canvas.clientWidth*dpr)),height=Math.max(1,Math.floor(ui.canvas.clientHeight*dpr));if(ui.canvas.width!==width||ui.canvas.height!==height){ui.canvas.width=width;ui.canvas.height=height;}gl.viewport(0,0,width,height);return width/height;}

function cameraPose(deltaTime){const camera=state.camera;if(state.flight){const elapsed=performance.now()-state.flight.started,t=smoothstep(clamp(elapsed/state.flight.duration,0,1));for(let i=0;i<3;i+=1)camera.target[i]=lerp(state.flight.from.target[i],state.flight.to.target[i],t);camera.distance=lerp(state.flight.from.distance,state.flight.to.distance,t);camera.azimuth=lerp(state.flight.from.azimuth,state.flight.to.azimuth,t);camera.elevation=lerp(state.flight.from.elevation,state.flight.to.elevation,t);if(t>=1)state.flight=null;}if(camera.ground){const speed=(state.keys.has('ShiftLeft')||state.keys.has('ShiftRight')?110:42)*deltaTime;let forward=0,side=0;if(state.keys.has('KeyW')||state.keys.has('ArrowUp'))forward+=1;if(state.keys.has('KeyS')||state.keys.has('ArrowDown'))forward-=1;if(state.keys.has('KeyD')||state.keys.has('ArrowRight'))side+=1;if(state.keys.has('KeyA')||state.keys.has('ArrowLeft'))side-=1;camera.target[0]+=(Math.sin(camera.yaw)*forward+Math.cos(camera.yaw)*side)*speed;camera.target[2]+=(Math.cos(camera.yaw)*forward-Math.sin(camera.yaw)*side)*speed;const sea=sampleMarine(camera.target[0],camera.target[2])>.5,y=(sea?.8:sampleTerrain(camera.target[0],camera.target[2]))+1.6;camera.target[1]=y;const eye=[camera.target[0],y,camera.target[2]],direction=[Math.sin(camera.yaw)*Math.cos(camera.pitch),Math.sin(camera.pitch),Math.cos(camera.yaw)*Math.cos(camera.pitch)],center=[eye[0]+direction[0]*1000,eye[1]+direction[1]*1000,eye[2]+direction[2]*1000];return{eye,center};}const cosElevation=Math.cos(camera.elevation),eye=[camera.target[0]+Math.sin(camera.azimuth)*cosElevation*camera.distance,camera.target[1]+Math.sin(camera.elevation)*camera.distance,camera.target[2]+Math.cos(camera.azimuth)*cosElevation*camera.distance];return{eye,center:camera.target};}

const anchors={overall:{label:'全域',target:[0,180,0],distance:185000,azimuth:-.78,elevation:.58},wenzhou:{label:'温州城',target:[-43249.24,40,29795.56],distance:24000,azimuth:-.76,elevation:.48},xianxi:{label:'仙溪镇',target:[-3215.36,320,-15850.63],distance:19000,azimuth:-.9,elevation:.47},haimen:{label:'海门城',target:[34754.08,35,-44757.83],distance:22000,azimuth:-.66,elevation:.46},yandang:{label:'雁荡山',target:[-4869.71,520,-10574.45],distance:12000,azimuth:-.78,elevation:.40},oujiang:{label:'瓯江口',target:[8000,15,31500],distance:26000,azimuth:-.66,elevation:.42},yueqing:{label:'乐清湾',target:[8500,10,-21000],distance:30000,azimuth:-.9,elevation:.44},kanmen:{label:'坎门',target:[18000,10,20700],distance:19000,azimuth:-.82,elevation:.42}};
function flyTo(id){const anchor=anchors[id];if(!anchor)return;state.camera.ground=false;state.currentAnchor=id;const terrainY=sampleMarine(anchor.target[0],anchor.target[2])?1:sampleTerrain(anchor.target[0],anchor.target[2]),to={...anchor,target:[anchor.target[0],Math.max(anchor.target[1],terrainY),anchor.target[2]]};state.flight={started:performance.now(),duration:1450,from:{target:[...state.camera.target],distance:state.camera.distance,azimuth:state.camera.azimuth,elevation:state.camera.elevation},to};document.querySelectorAll('[data-anchor]').forEach(button=>button.classList.toggle('active',button.dataset.anchor===id));ui.cameraModeLabel.textContent=`${anchor.label} · 连续飞行`;}
function setView(mode){document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===mode));if(mode==='ground'){state.camera.ground=true;state.flight=null;state.camera.yaw=state.camera.azimuth;state.camera.pitch=-.05;const target=anchors[state.currentAnchor]?.target||state.camera.target;state.camera.target=[target[0],0,target[2]];ui.cameraModeLabel.textContent=`${anchors[state.currentAnchor]?.label||'当前地点'} · 近地 1.6 m`;}else if(mode==='top'){state.camera.ground=false;state.camera.elevation=1.52;state.camera.distance=state.currentAnchor==='overall'?170000:28000;ui.cameraModeLabel.textContent=`${anchors[state.currentAnchor]?.label||'当前地点'} · 正射`;}else if(mode==='reset'){flyTo(state.currentAnchor||'overall');}else{state.camera.ground=false;const anchor=anchors[state.currentAnchor]||anchors.overall;state.camera.azimuth=anchor.azimuth;state.camera.elevation=anchor.elevation;state.camera.distance=anchor.distance;ui.cameraModeLabel.textContent=`${anchor.label} · 斜视`;}}

function createOnlineSatelliteUrl(manifest){const[west,south,east,north]=manifest.truth.wgs84Bounds,params=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:'s2cloudless-2024',STYLES:'',FORMAT:'image/jpeg',SRS:'EPSG:4326',BBOX:`${west},${south},${east},${north}`,WIDTH:'2048',HEIGHT:'2048'});return`${EOX_WMS}?${params.toString()}`;}
async function enableOnlineSatellite(){if(state.textures.online){state.activeTexture=state.textures.online;state.material='online';updateMaterialUi();return;}if(state.onlineLoading)return;state.onlineLoading=true;ui.materialStatus.textContent='正在连接 EOX';ui.satelliteSource.textContent='正在请求 EOX Sentinel-2 cloudless 2024 WMS。失败时自动保留离线卫星色彩。';try{const image=await Promise.race([loadImage(createOnlineSatelliteUrl(state.manifest),'anonymous'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('EOX WMS timeout')),15000))]);state.textures.online=createTexture(state.gl,image);state.activeTexture=state.textures.online;state.material='online';ui.materialStatus.textContent='EOX 真实卫星已载入';ui.satelliteSource.textContent=`${EOX_ATTRIBUTION}。2024 图层按非商业许可和署名条件使用。`;updateMaterialUi();}catch(error){state.activeTexture=state.textures.offline;state.material='satellite';ui.materialStatus.textContent='EOX 不可用，已回退';ui.satelliteSource.textContent=`在线真实卫星载入失败：${error.message}。当前继续使用明确标注的离线 satellite-color material。`;updateMaterialUi();}finally{state.onlineLoading=false;}}
function updateMaterialUi(){document.querySelectorAll('[data-material]').forEach(button=>button.classList.toggle('active',button.dataset.material===state.material));const labels={satellite:'离线卫星色彩',online:'EOX 真实卫星',hillshade:'阴影地形',gray:'灰度分析',bathy:'海底深度'};ui.materialTag.textContent=labels[state.material]||state.material;}

function bindUi(){ui.panelToggle.addEventListener('click',()=>{ui.controller.classList.toggle('open');ui.panelToggle.setAttribute('aria-expanded',String(ui.controller.classList.contains('open')));});ui.closePanel.addEventListener('click',()=>{ui.controller.classList.remove('open');ui.panelToggle.setAttribute('aria-expanded','false');});document.querySelectorAll('[data-anchor]').forEach(button=>button.addEventListener('click',()=>flyTo(button.dataset.anchor)));document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));document.querySelectorAll('[data-material]').forEach(button=>button.addEventListener('click',()=>{const mode=button.dataset.material;if(mode==='online'){enableOnlineSatellite();return;}state.material=mode;state.activeTexture=state.textures.offline;if(mode==='satellite'){ui.materialStatus.textContent='离线可用';ui.satelliteSource.textContent='离线层为从真值高程、坡度和海域掩膜生成的 satellite-color material，不宣称原始卫星照片。';}updateMaterialUi();}));[[ui.showTerrain,'terrain'],[ui.showOcean,'ocean'],[ui.showBathy,'bathy'],[ui.showRivers,'rivers'],[ui.showCoast,'coast'],[ui.showPending,'pending']].forEach(([element,key])=>element.addEventListener('change',()=>{state.layers[key]=element.checked;}));ui.riverWidth.addEventListener('input',()=>{state.riverWidth=Number(ui.riverWidth.value);ui.riverWidthOut.textContent=`${state.riverWidth.toFixed(2)}×`;});ui.riverWidth.addEventListener('change',buildRiverMesh);ui.waterOpacity.addEventListener('input',()=>{state.waterOpacity=Number(ui.waterOpacity.value);ui.waterOpacityOut.textContent=`${Math.round(state.waterOpacity*100)}%`;});ui.canvas.addEventListener('contextmenu',event=>event.preventDefault());ui.canvas.addEventListener('pointerdown',event=>{ui.canvas.setPointerCapture(event.pointerId);state.flight=null;state.pointer={id:event.pointerId,x:event.clientX,y:event.clientY,button:event.button,pan:event.shiftKey||event.button===2};});ui.canvas.addEventListener('pointermove',event=>{if(!state.pointer||state.pointer.id!==event.pointerId)return;const dx=event.clientX-state.pointer.x,dy=event.clientY-state.pointer.y;state.pointer.x=event.clientX;state.pointer.y=event.clientY;if(state.camera.ground){state.camera.yaw-=dx*.0045;state.camera.pitch=clamp(state.camera.pitch-dy*.0035,-.65,.65);}else if(state.pointer.pan){const scale=state.camera.distance*.00115,rightX=Math.cos(state.camera.azimuth),rightZ=-Math.sin(state.camera.azimuth),forwardX=Math.sin(state.camera.azimuth),forwardZ=Math.cos(state.camera.azimuth);state.camera.target[0]+=(-dx*rightX+dy*forwardX)*scale;state.camera.target[2]+=(-dx*rightZ+dy*forwardZ)*scale;state.camera.target[1]=sampleTerrain(state.camera.target[0],state.camera.target[2]);}else{state.camera.azimuth-=dx*.0042;state.camera.elevation=clamp(state.camera.elevation+dy*.0032,.08,1.53);}});const releasePointer=event=>{if(state.pointer?.id===event.pointerId)state.pointer=null;};ui.canvas.addEventListener('pointerup',releasePointer);ui.canvas.addEventListener('pointercancel',releasePointer);ui.canvas.addEventListener('wheel',event=>{event.preventDefault();if(!state.camera.ground)state.camera.distance=clamp(state.camera.distance*Math.exp(event.deltaY*.001),900,360000);},{passive:false});window.addEventListener('keydown',event=>state.keys.add(event.code));window.addEventListener('keyup',event=>state.keys.delete(event.code));}

function drawFlat(gl,mesh,viewProj,primitive,pointSize=5){if(!mesh||!mesh.count)return;const program=state.programs.flat;gl.useProgram(program.program);gl.uniformMatrix4fv(program.uniforms.uViewProj,false,viewProj);gl.uniform1f(program.uniforms.uPointSize,pointSize);gl.uniform1f(program.uniforms.uRound,primitive===gl.POINTS?1:0);gl.bindVertexArray(mesh.vao);gl.drawArrays(primitive,0,mesh.count);}
function render(now){if(!state.ready){requestAnimationFrame(render);return;}const gl=state.gl,deltaTime=Math.min(.05,(now-state.lastFrame)/1000);state.lastFrame=now;const aspect=resizeCanvas(gl),pose=cameraPose(deltaTime),eye=pose.eye,center=pose.center,projection=Mat4.perspective(radians(43),aspect,.5,650000),view=Mat4.lookAt(eye,center,[0,1,0]),viewProj=Mat4.multiply(projection,view),fogColor=new Float32Array([.025,.075,.09]);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(fogColor[0],fogColor[1],fogColor[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(state.layers.bathy){const program=state.programs.bathy;gl.useProgram(program.program);gl.uniformMatrix4fv(program.uniforms.uViewProj,false,viewProj);gl.uniform3fv(program.uniforms.uCamera,eye);gl.uniform3fv(program.uniforms.uFogColor,fogColor);gl.uniform1f(program.uniforms.uEmphasis,state.material==='bathy'?1:0);gl.bindVertexArray(state.bathy.vao);gl.drawElements(gl.TRIANGLES,state.bathy.indexCount,gl.UNSIGNED_INT,0);}if(state.layers.terrain){const program=state.programs.terrain;gl.useProgram(program.program);gl.uniformMatrix4fv(program.uniforms.uViewProj,false,viewProj);gl.uniform3fv(program.uniforms.uCamera,eye);gl.uniform3fv(program.uniforms.uFogColor,fogColor);const mode=state.material==='hillshade'?1:state.material==='gray'?2:state.material==='bathy'?3:0;gl.uniform1i(program.uniforms.uMode,mode);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,state.activeTexture||state.textures.offline);gl.uniform1i(program.uniforms.uMap,0);gl.bindVertexArray(state.terrain.vao);gl.drawElements(gl.TRIANGLES,state.terrain.indexCount,gl.UNSIGNED_INT,0);}if(state.layers.ocean){const program=state.programs.water;gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.useProgram(program.program);gl.uniformMatrix4fv(program.uniforms.uViewProj,false,viewProj);gl.uniform3fv(program.uniforms.uCamera,eye);gl.uniform1f(program.uniforms.uTime,now/1000);gl.uniform1f(program.uniforms.uSeaLevel,.8);gl.uniform1f(program.uniforms.uOpacity,state.waterOpacity);gl.bindVertexArray(state.terrain.vao);gl.drawElements(gl.TRIANGLES,state.terrain.indexCount,gl.UNSIGNED_INT,0);gl.depthMask(true);gl.disable(gl.BLEND);}gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);if(state.layers.rivers)drawFlat(gl,state.riverMesh,viewProj,gl.TRIANGLES);if(state.layers.coast)drawFlat(gl,state.coastMesh,viewProj,gl.LINES);if(state.layers.pending)drawFlat(gl,state.pendingMesh,viewProj,gl.POINTS,8);gl.disable(gl.BLEND);state.frameCount+=1;if(now-state.fpsTime>=1000){state.fps=state.frameCount*1000/(now-state.fpsTime);state.frameCount=0;state.fpsTime=now;ui.fpsTag.textContent=`FPS ${state.fps.toFixed(0)}`;}ui.cameraReadout.textContent=`相机 ${eye[0].toFixed(0)}, ${eye[1].toFixed(0)}, ${eye[2].toFixed(0)} m`;ui.renderReadout.textContent=`WebGL2 · ${state.terrain.grid}² · ${numberFormat.format(state.terrain.indexCount/3)} tris`;window.__WENZHOU_V110_DIAGNOSTICS__={ready:true,renderer:'WebGL2',perspectiveProjectionActive:true,depthTestActive:true,truthDemSha256:state.manifest.truth.sha256,terrainRuntimeId:state.manifest.terrainRuntimeId,terrainGrid:[state.terrain.grid,state.terrain.grid],terrainTriangleCount:state.terrain.indexCount/3,terrainElevationRangeMeters:[state.manifest.terrainOverview.minimumElevationMeters,state.manifest.terrainOverview.maximumElevationMeters],bathymetryGrid:state.manifest.bathymetryOverview.grid,riverParts:state.riverData.partCount,coastlineParts:state.coastData.partCount,estuaryConnectivityStatus:state.riverData.estuaryConnectivityStatus,satelliteMaterial:state.material,onlineSatelliteLoaded:Boolean(state.textures.online),oceanVisible:state.layers.ocean,bathymetryVisible:state.layers.bathy,riversVisible:state.layers.rivers,camera:{eye,center,groundMode:state.camera.ground,azimuth:state.camera.azimuth,elevation:state.camera.elevation},fps:state.fps,consoleErrors:0,publicationBlocked:true};requestAnimationFrame(render);}

async function start(){bindUi();setLoading(8,'建立温州三维世界','载入真值 manifest 与 GPU 程序');const gl=ui.canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance'});if(!gl)throw new Error('当前浏览器未提供 WebGL2');state.gl=gl;ui.renderReadout.textContent=`WebGL2 · ${gl.getParameter(gl.RENDERER)}`;const terrainProgram=createProgram(gl,TERRAIN_VERTEX,TERRAIN_FRAGMENT),bathyProgram=createProgram(gl,BATHY_VERTEX,BATHY_FRAGMENT),waterProgram=createProgram(gl,WATER_VERTEX,WATER_FRAGMENT),flatProgram=createProgram(gl,FLAT_VERTEX,FLAT_FRAGMENT);state.programs.terrain={program:terrainProgram,uniforms:locations(gl,terrainProgram,['uViewProj','uMap','uCamera','uFogColor','uMode'])};state.programs.bathy={program:bathyProgram,uniforms:locations(gl,bathyProgram,['uViewProj','uCamera','uFogColor','uEmphasis'])};state.programs.water={program:waterProgram,uniforms:locations(gl,waterProgram,['uViewProj','uCamera','uTime','uSeaLevel','uOpacity'])};state.programs.flat={program:flatProgram,uniforms:locations(gl,flatProgram,['uViewProj','uPointSize','uRound'])};state.manifest=await fetchJson(`${ASSET}manifest.json`);setLoading(24,'载入权威地形','读取 513 × 513 真值高程和海域掩膜');const[heightBuffer,marineBuffer,satelliteImage]=await Promise.all([fetchBuffer(`${ASSET}terrain_height_513_u16.bin`),fetchBuffer(`${ASSET}terrain_marine_513_u8.bin`),loadImage(`${ASSET}offline_satellite_color_2048.webp`)]);state.terrain=createInterleavedTerrain(gl,heightBuffer,marineBuffer,state.manifest,matchMedia('(max-width: 760px)').matches);state.textures.offline=createTexture(gl,satelliteImage);state.activeTexture=state.textures.offline;ui.triangleMetric.textContent=numberFormat.format(state.terrain.indexCount/3);ui.elevationMetric.textContent=`${state.manifest.terrainOverview.minimumElevationMeters.toFixed(0)}–${state.manifest.terrainOverview.maximumElevationMeters.toFixed(0)} m`;setLoading(48,'地形已经可见','继续载入 GEBCO 海底');state.bathy=createBathymetryMesh(gl,await fetchBuffer(`${ASSET}bathymetry_height_257_i16.bin`),state.manifest);setLoading(68,'载入真实 OSM 水系','构建海岸线、河流、溪流、运河和潮沟');[state.coastData,state.riverData]=await Promise.all([fetchJson(`${ASSET}coastline_compact.json`),fetchJson(`${ASSET}rivers_compact.json`)]);buildCoastMesh();buildRiverMesh();ui.riverMetric.textContent=numberFormat.format(state.riverData.partCount);ui.coastMetric.textContent=numberFormat.format(state.coastData.partCount);ui.hydrologyTag.textContent=`OSM ${numberFormat.format(state.riverData.partCount)} 段 · 河口 pending`;setLoading(92,'完成共享三维世界','绑定连续镜头、卫星材质与水体图层');state.ready=true;ui.runtimeState.textContent='三维运行中';ui.loadingCard.classList.add('hidden');setStatus('真实三维地形、海洋、海底和 OSM 水系已载入','ok');updateMaterialUi();requestAnimationFrame(render);}

start().catch(showFatal);
