(() => {
  'use strict';

  const MANIFEST_URL = 'data/NATIVE_ELEVATION_MANIFEST.json';
  const EXPECTED_SCHEMA = 'guilin-canonical-native-dem/v1';
  const EXPECTED_SOURCE_SHA = '9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4';
  const EXPECTED_AOI_SHA = '36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80';
  const EXPECTED_TILE_COUNT = 54;
  const EXPECTED_TILE_BYTES = 8_388_608;
  const TILE_GRID = 2048;
  const WINDOW_GRID = 512;
  const WINDOW_STEP = 384;
  const SOURCE_SPACING_M = 12.5;
  const NODATA = 0;
  const MAX_DPR = 1.6;

  const $ = id => document.getElementById(id);
  const canvas = $('terrainCanvas');
  const loadingCard = $('loadingCard');
  const loadingDetail = $('loadingDetail');
  const errorCard = $('errorCard');
  const errorMessage = $('errorMessage');
  const controlPanel = $('controlPanel');
  const togglePanel = $('togglePanel');
  const renderInfo = $('renderInfo');
  const runtimeErrors = [];

  const state = {
    manifest: null,
    tileById: new Map(),
    anchorById: new Map(),
    currentTile: null,
    currentAnchor: null,
    currentTileSha: null,
    codes: null,
    window: { x: 0, y: 0, width: WINDOW_GRID, height: WINDOW_GRID },
    worldWidth: (WINDOW_GRID - 1) * SOURCE_SPACING_M,
    worldDepth: (WINDOW_GRID - 1) * SOURCE_SPACING_M,
    elevationMin: 0,
    elevationMax: 1,
    gl: null,
    program: null,
    vao: null,
    vertexBuffer: null,
    indexBuffer: null,
    indexCount: 0,
    validTriangleCount: 0,
    uniforms: {},
    projection: new Float32Array(16),
    view: new Float32Array(16),
    viewProjection: new Float32Array(16),
    dirty: true,
    qaReady: false,
    frameCount: 0,
    fps: 0,
    fpsStart: performance.now(),
    pointers: new Map(),
    pinch: null,
    loadToken: 0,
    camera: { target: [0, 250, 0], yaw: -0.78, pitch: 0.52, distance: 9500, minDistance: 100, maxDistance: 80000 },
  };

  window.addEventListener('error', event => { runtimeErrors.push(String(event.error?.stack || event.message || 'window error')); updateQa(); });
  window.addEventListener('unhandledrejection', event => { runtimeErrors.push(String(event.reason?.stack || event.reason || 'unhandled rejection')); updateQa(); });

  const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in float aElevation;
uniform mat4 uViewProjection;
uniform float uMinElevation;
uniform float uMaxElevation;
out vec3 vNormal;
out float vElevationT;
void main(){vNormal=aNormal;vElevationT=clamp((aElevation-uMinElevation)/max(1.0,uMaxElevation-uMinElevation),0.0,1.0);gl_Position=uViewProjection*vec4(aPosition,1.0);}`;

  const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vNormal;
in float vElevationT;
out vec4 outColor;
vec3 ramp(float t){if(t<0.20)return mix(vec3(0.035,0.18,0.10),vec3(0.08,0.30,0.15),t/0.20);if(t<0.45)return mix(vec3(0.08,0.30,0.15),vec3(0.24,0.40,0.20),(t-0.20)/0.25);if(t<0.70)return mix(vec3(0.24,0.40,0.20),vec3(0.48,0.48,0.29),(t-0.45)/0.25);if(t<0.88)return mix(vec3(0.48,0.48,0.29),vec3(0.61,0.58,0.46),(t-0.70)/0.18);return mix(vec3(0.61,0.58,0.46),vec3(0.86,0.85,0.79),(t-0.88)/0.12);}
void main(){vec3 n=normalize(vNormal);vec3 sun=normalize(vec3(-0.52,0.78,0.34));vec3 fill=normalize(vec3(0.35,0.45,-0.55));float light=0.30+max(dot(n,sun),0.0)*0.58+max(dot(n,fill),0.0)*0.12;float slope=1.0-clamp(n.y,0.0,1.0);vec3 base=mix(ramp(vElevationT),vec3(0.57,0.56,0.51),smoothstep(0.28,0.88,slope)*0.45);outColor=vec4(pow(max(base*light,vec3(0.0)),vec3(0.92)),1.0);}`;

  function assert(condition, message) { if (!condition) throw new Error(message); }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  async function fetchJson(url) { const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw new Error(`${url} HTTP ${response.status}`); return response.json(); }
  async function fetchBinary(url) { const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw new Error(`${url} HTTP ${response.status}`); return response.arrayBuffer(); }
  async function sha256Hex(buffer) { const digest = await crypto.subtle.digest('SHA-256', buffer); return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join(''); }

  function decodeInt16LE(buffer) {
    assert(buffer.byteLength === EXPECTED_TILE_BYTES, `瓦片字节数不正确：${buffer.byteLength}`);
    const probe = new ArrayBuffer(2); new DataView(probe).setUint16(0, 0x00ff, true);
    if (new Uint16Array(probe)[0] === 0x00ff) return new Int16Array(buffer);
    const view = new DataView(buffer); const result = new Int16Array(buffer.byteLength / 2);
    for (let i = 0; i < result.length; i += 1) result[i] = view.getInt16(i * 2, true);
    return result;
  }

  function validateManifest(manifest) {
    assert(manifest?.schema === EXPECTED_SCHEMA, '唯一真值清单版本不正确');
    assert(manifest.status === 'sole_authoritative', '唯一真值状态不正确');
    assert(manifest.canonical_identity?.sole_guilin_dem_truth === true, '唯一真值身份缺失');
    assert(manifest.source?.sha256 === EXPECTED_SOURCE_SHA, '源 TIFF SHA256 不正确');
    assert(manifest.aoi?.geometry_sha256 === EXPECTED_AOI_SHA, 'AOI SHA256 不正确');
    assert(manifest.source?.resolution_m?.[0] === 12.5 && manifest.source?.resolution_m?.[1] === 12.5, '源像元间距不正确');
    assert(manifest.source?.dtype === 'int16' && manifest.source?.nodata === NODATA, '源数据编码不正确');
    assert(manifest.tiles?.length === EXPECTED_TILE_COUNT, '原生瓦片数量不正确');
    assert(manifest.tile_matrix?.compression === 'none' && manifest.tile_matrix?.resampling === 'none' && manifest.tile_matrix?.quantization === 'none', '原生瓦片存储合同不正确');
    assert(manifest.rules?.source_resampling === false && manifest.rules?.source_reencoding === false && manifest.rules?.source_recompression === false, '源数据被变换');
    assert(manifest.rules?.gap_fill_applied === false && manifest.rules?.fallback_30m_used === false, '禁止补洞或回退');
    assert(manifest.rules?.source_elevation_modified_m === 0 && manifest.rules?.vertical_scale === 1, '高程或垂直比例不正确');
    assert(manifest.rules?.height_image_texture_used === false && manifest.rules?.direct_numeric_vertex_geometry === true, '几何生成路线不正确');
    assert(manifest.rules?.legacy_procedural_terrain_runtime_allowed === false, '旧程序地形路线未关闭');
    for (const tile of manifest.tiles) {
      assert(tile.stored_bytes === EXPECTED_TILE_BYTES, `${tile.id} 字节数不正确`);
      assert(tile.compression === 'none' && tile.resampling === 'none' && tile.quantization === 'none', `${tile.id} 存储合同不正确`);
      assert(tile.source_elevation_modified_m === 0, `${tile.id} 高程被修改`);
    }
  }

  function compileShader(gl, type, source) { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'shader compile failed'); return shader; }
  function createProgram(gl, vertexSource, fragmentSource) { const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource); const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource); const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'program link failed'); return program; }

  function setupWebGL() {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    assert(gl, '当前浏览器未提供 WebGL2');
    state.gl = gl; state.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    state.uniforms = { viewProjection: gl.getUniformLocation(state.program, 'uViewProjection'), minElevation: gl.getUniformLocation(state.program, 'uMinElevation'), maxElevation: gl.getUniformLocation(state.program, 'uMaxElevation') };
    state.vao = gl.createVertexArray(); state.vertexBuffer = gl.createBuffer(); state.indexBuffer = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); gl.clearColor(0.025, 0.055, 0.06, 1);
  }

  function sourceValue(x, y, fallback) { const value = state.codes[y * TILE_GRID + x]; return value === NODATA ? fallback : value; }
  function buildGeometry() {
    const { x, y, width, height } = state.window;
    const vertexCount = width * height;
    const vertices = new Float32Array(vertexCount * 7);
    let minimum = Infinity, maximum = -Infinity;
    for (let row = 0; row < height; row += 1) for (let col = 0; col < width; col += 1) { const elevation = state.codes[(y + row) * TILE_GRID + x + col]; if (elevation !== NODATA) { minimum = Math.min(minimum, elevation); maximum = Math.max(maximum, elevation); } }
    assert(Number.isFinite(minimum), '当前窗口没有有效高程');
    state.elevationMin = minimum; state.elevationMax = maximum;
    const halfWidth = (width - 1) * SOURCE_SPACING_M * 0.5; const halfDepth = (height - 1) * SOURCE_SPACING_M * 0.5;
    let cursor = 0;
    for (let row = 0; row < height; row += 1) {
      const sy = y + row;
      for (let col = 0; col < width; col += 1) {
        const sx = x + col; const elevation = state.codes[sy * TILE_GRID + sx]; const value = elevation === NODATA ? minimum : elevation;
        const left = sourceValue(Math.max(0, sx - 1), sy, value); const right = sourceValue(Math.min(TILE_GRID - 1, sx + 1), sy, value);
        const north = sourceValue(sx, Math.max(0, sy - 1), value); const south = sourceValue(sx, Math.min(TILE_GRID - 1, sy + 1), value);
        let nx = -(right - left) / (2 * SOURCE_SPACING_M); let ny = 1; let nz = -(south - north) / (2 * SOURCE_SPACING_M); const length = Math.hypot(nx, ny, nz) || 1; nx /= length; ny /= length; nz /= length;
        vertices[cursor++] = col * SOURCE_SPACING_M - halfWidth; vertices[cursor++] = value - minimum; vertices[cursor++] = row * SOURCE_SPACING_M - halfDepth;
        vertices[cursor++] = nx; vertices[cursor++] = ny; vertices[cursor++] = nz; vertices[cursor++] = value;
      }
    }
    const maxIndices = (width - 1) * (height - 1) * 6; const indices = new Uint32Array(maxIndices); let indexCursor = 0; let validCells = 0;
    for (let row = 0; row < height - 1; row += 1) {
      const sy = y + row;
      for (let col = 0; col < width - 1; col += 1) {
        const sx = x + col;
        const e0 = state.codes[sy * TILE_GRID + sx], e1 = state.codes[sy * TILE_GRID + sx + 1], e2 = state.codes[(sy + 1) * TILE_GRID + sx], e3 = state.codes[(sy + 1) * TILE_GRID + sx + 1];
        if (e0 === NODATA || e1 === NODATA || e2 === NODATA || e3 === NODATA) continue;
        const a = row * width + col, b = a + 1, c = a + width, d = c + 1;
        indices[indexCursor++] = a; indices[indexCursor++] = c; indices[indexCursor++] = b; indices[indexCursor++] = b; indices[indexCursor++] = c; indices[indexCursor++] = d; validCells += 1;
      }
    }
    const gl = state.gl; gl.bindVertexArray(state.vao); gl.bindBuffer(gl.ARRAY_BUFFER, state.vertexBuffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const stride = 7 * 4; gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 6 * 4);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.indexBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices.subarray(0, indexCursor), gl.STATIC_DRAW); gl.bindVertexArray(null);
    state.indexCount = indexCursor; state.validTriangleCount = validCells * 2; state.worldWidth = (width - 1) * SOURCE_SPACING_M; state.worldDepth = (height - 1) * SOURCE_SPACING_M; updateDataPanel(); state.dirty = true;
  }

  function centeredWindow(tile) { const [validWidth, validHeight] = tile.valid_grid; const width = Math.min(WINDOW_GRID, validWidth), height = Math.min(WINDOW_GRID, validHeight); return { x: Math.max(0, Math.floor((validWidth - width) / 2)), y: Math.max(0, Math.floor((validHeight - height) / 2)), width, height }; }
  function anchorWindow(tile, anchor) { const [validWidth, validHeight] = tile.valid_grid; const [west, , , north] = tile.source_sample_center_bounds_epsg32649; const col = Math.round((anchor.e - west) / SOURCE_SPACING_M); const row = Math.round((north - anchor.n) / SOURCE_SPACING_M); const width = Math.min(WINDOW_GRID, validWidth), height = Math.min(WINDOW_GRID, validHeight); return { x: clamp(Math.round(col - width / 2), 0, validWidth - width), y: clamp(Math.round(row - height / 2), 0, validHeight - height), width, height }; }
  function moveWindow(dx, dy) { if (!state.currentTile) return; const [validWidth, validHeight] = state.currentTile.valid_grid; state.currentAnchor = null; state.window.x = clamp(state.window.x + dx, 0, validWidth - state.window.width); state.window.y = clamp(state.window.y + dy, 0, validHeight - state.window.height); buildGeometry(); resetCamera(); updateButtons(); updateQa(); }

  async function loadTile(tileId, anchorId = null) {
    const token = ++state.loadToken; const tile = state.tileById.get(tileId); assert(tile, `找不到瓦片 ${tileId}`); loadingCard.hidden = false; errorCard.hidden = true; loadingDetail.textContent = `${tile.id} · 校验 8,388,608 字节`;
    const buffer = await fetchBinary(`data/${tile.file}`); if (token !== state.loadToken) return; assert(buffer.byteLength === EXPECTED_TILE_BYTES, `${tile.id} 字节数不一致`); const digest = await sha256Hex(buffer); if (token !== state.loadToken) return; assert(digest === tile.sha256, `${tile.id} SHA256 不一致`);
    state.currentTile = tile; state.currentTileSha = digest; state.codes = decodeInt16LE(buffer); state.currentAnchor = anchorId ? state.anchorById.get(anchorId) : null; state.window = state.currentAnchor ? anchorWindow(tile, state.currentAnchor) : centeredWindow(tile); buildGeometry(); resetCamera(); state.qaReady = true; loadingCard.hidden = true; updateButtons(); updateQa();
  }
  async function selectAnchor(anchorId) { const anchor = state.anchorById.get(anchorId); assert(anchor, `找不到地标 ${anchorId}`); await loadTile(state.manifest.anchor_tile_map[anchorId], anchorId); }

  function updateButtons() { document.querySelectorAll('[data-anchor]').forEach(button => button.classList.toggle('active', button.dataset.anchor === state.currentAnchor?.id)); document.querySelectorAll('[data-tile]').forEach(button => button.classList.toggle('active', button.dataset.tile === state.currentTile?.id)); }
  function updateDataPanel() { if (!state.currentTile) return; $('tileId').textContent = state.currentTile.id; $('tileMatrix').textContent = `第 ${state.currentTile.matrix_index[0] + 1} 行 · 第 ${state.currentTile.matrix_index[1] + 1} 列`; $('windowInfo').textContent = `x ${state.window.x} · y ${state.window.y} · ${state.window.width}²`; $('worldInfo').textContent = `${(state.worldWidth / 1000).toFixed(2)} km × ${(state.worldDepth / 1000).toFixed(2)} km`; $('elevationInfo').textContent = `${state.elevationMin.toFixed(0)} 至 ${state.elevationMax.toFixed(0)} m`; }
  function buildTileGrid() { const grid = $('tileGrid'); grid.replaceChildren(); const tiles = [...state.tileById.values()].sort((a,b) => a.matrix_index[0]-b.matrix_index[0] || a.matrix_index[1]-b.matrix_index[1]); for (const tile of tiles) { const button = document.createElement('button'); button.type='button'; button.dataset.tile=tile.id; button.textContent=`${tile.matrix_index[0]+1}-${tile.matrix_index[1]+1}`; button.title=tile.id; button.addEventListener('click',()=>loadTile(tile.id).catch(showError)); grid.appendChild(button); } }

  function mat4Multiply(out,a,b){const r=new Float32Array(16);for(let c=0;c<4;c+=1)for(let row=0;row<4;row+=1)r[c*4+row]=a[row]*b[c*4]+a[4+row]*b[c*4+1]+a[8+row]*b[c*4+2]+a[12+row]*b[c*4+3];out.set(r);return out;}
  function mat4Perspective(out,fovy,aspect,near,far){const f=1/Math.tan(fovy/2);out.fill(0);out[0]=f/aspect;out[5]=f;out[10]=(far+near)/(near-far);out[11]=-1;out[14]=2*far*near/(near-far);return out;}
  function mat4LookAt(out,eye,center,up){let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2],l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;out[0]=xx;out[1]=yx;out[2]=zx;out[3]=0;out[4]=xy;out[5]=yy;out[6]=zy;out[7]=0;out[8]=xz;out[9]=yz;out[10]=zz;out[11]=0;out[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);out[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);out[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);out[15]=1;return out;}
  function resizeCanvas(){const ratio=Math.min(MAX_DPR,window.devicePixelRatio||1),width=Math.max(2,Math.floor(canvas.clientWidth*ratio)),height=Math.max(2,Math.floor(canvas.clientHeight*ratio));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;state.dirty=true;}}
  function cameraEye(){const c=state.camera,h=Math.cos(c.pitch)*c.distance;return[c.target[0]+Math.sin(c.yaw)*h,c.target[1]+Math.sin(c.pitch)*c.distance,c.target[2]+Math.cos(c.yaw)*h];}
  function resetCamera(){const relief=Math.max(1,state.elevationMax-state.elevationMin),span=Math.max(state.worldWidth,state.worldDepth);state.camera={target:[0,relief*0.22,0],yaw:-0.78,pitch:0.52,distance:span*1.18,minDistance:80,maxDistance:span*8};state.dirty=true;}
  function updateMatrices(){resizeCanvas();const eye=cameraEye(),span=Math.max(state.worldWidth,state.worldDepth),near=Math.max(.5,state.camera.distance/8000),far=state.camera.distance+span*8+4000;mat4Perspective(state.projection,Math.PI/4.1,canvas.width/Math.max(1,canvas.height),near,far);mat4LookAt(state.view,eye,state.camera.target,[0,1,0]);mat4Multiply(state.viewProjection,state.projection,state.view);}
  function render(timestamp){if(!state.gl||!state.currentTile||state.indexCount<=0)return;updateMatrices();const gl=state.gl;gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(state.program);gl.uniformMatrix4fv(state.uniforms.viewProjection,false,state.viewProjection);gl.uniform1f(state.uniforms.minElevation,state.elevationMin);gl.uniform1f(state.uniforms.maxElevation,state.elevationMax);gl.bindVertexArray(state.vao);gl.drawElements(gl.TRIANGLES,state.indexCount,gl.UNSIGNED_INT,0);gl.bindVertexArray(null);state.frameCount+=1;const elapsed=timestamp-state.fpsStart;if(elapsed>=750){state.fps=state.frameCount*1000/elapsed;state.frameCount=0;state.fpsStart=timestamp;}renderInfo.textContent=`512² 原生数值顶点 · ${state.validTriangleCount.toLocaleString()} 三角形 · 直接顶点缓冲区 · ${state.fps.toFixed(1)} FPS`;state.dirty=false;updateQa();}
  function loop(timestamp){if(state.dirty)render(timestamp);requestAnimationFrame(loop);}

  function updateQa(){const loadingVisible=getComputedStyle(loadingCard).display!=='none',errorVisible=getComputedStyle(errorCard).display!=='none';const result={schema:'guilin-single-truth-browser-qa/v1',passed:Boolean(state.qaReady&&state.gl&&state.currentTile&&state.currentTileSha===state.currentTile.sha256&&state.validTriangleCount>100000&&runtimeErrors.length===0&&!loadingVisible&&!errorVisible),data_ready:Boolean(state.qaReady&&state.currentTile),webgl2:Boolean(state.gl),source_sha256:state.manifest?.source?.sha256||null,aoi_geometry_sha256:state.manifest?.aoi?.geometry_sha256||null,source_resolution_m:12.5,tile_count:state.manifest?.tiles?.length||0,current_tile_id:state.currentTile?.id||null,current_tile_sha256_verified:Boolean(state.currentTile&&state.currentTileSha===state.currentTile.sha256),render_grid:[WINDOW_GRID,WINDOW_GRID],source_window:[state.window.x,state.window.y,state.window.width,state.window.height],vertex_spacing_m:12.5,direct_numeric_vertex_geometry:true,height_image_texture_used:false,texture_upload_count:0,valid_triangle_count:state.validTriangleCount,vertical_scale:1,resampling:'none',tile_compression:'none',gap_fill_applied:false,fallback_30m_used:false,source_elevation_modified_m:0,legacy_procedural_runtime_allowed:false,runtime_errors:runtimeErrors.slice(),loading_overlay_displayed:loadingVisible,error_overlay_displayed:errorVisible,render_status:renderInfo.textContent};window.__GUILIN_SINGLE_TRUTH_QA=result;document.body.dataset.ready=String(result.passed);document.body.dataset.textureCount='0';document.body.dataset.tileCount=String(result.tile_count);document.body.dataset.directNumericGeometry='true';return result;}

  function setupControls(){document.querySelectorAll('[data-anchor]').forEach(button=>button.addEventListener('click',()=>selectAnchor(button.dataset.anchor).catch(showError)));$('moveNorth').addEventListener('click',()=>moveWindow(0,-WINDOW_STEP));$('moveSouth').addEventListener('click',()=>moveWindow(0,WINDOW_STEP));$('moveWest').addEventListener('click',()=>moveWindow(-WINDOW_STEP,0));$('moveEast').addEventListener('click',()=>moveWindow(WINDOW_STEP,0));$('centerWindow').addEventListener('click',()=>{if(!state.currentTile)return;state.currentAnchor=null;state.window=centeredWindow(state.currentTile);buildGeometry();resetCamera();updateButtons();});$('resetCamera').addEventListener('click',resetCamera);$('fullscreen').addEventListener('click',()=>document.fullscreenElement?document.exitFullscreen():$('viewerShell').requestFullscreen());togglePanel.addEventListener('click',()=>{const collapsed=controlPanel.classList.toggle('collapsed');togglePanel.setAttribute('aria-expanded',String(!collapsed));});canvas.addEventListener('contextmenu',event=>event.preventDefault());canvas.addEventListener('pointerdown',event=>{canvas.setPointerCapture(event.pointerId);state.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(state.pointers.size===2){const points=[...state.pointers.values()];state.pinch={distance:Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),cameraDistance:state.camera.distance};}});canvas.addEventListener('pointermove',event=>{const previous=state.pointers.get(event.pointerId);if(!previous)return;const current={x:event.clientX,y:event.clientY};state.pointers.set(event.pointerId,current);if(state.pointers.size===2&&state.pinch){const points=[...state.pointers.values()],distance=Math.max(8,Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y));state.camera.distance=clamp(state.pinch.cameraDistance*state.pinch.distance/distance,state.camera.minDistance,state.camera.maxDistance);}else{const dx=current.x-previous.x,dy=current.y-previous.y;if(event.shiftKey||event.buttons===2){const scale=state.camera.distance*.0014,rightX=Math.cos(state.camera.yaw),rightZ=-Math.sin(state.camera.yaw),forwardX=Math.sin(state.camera.yaw),forwardZ=Math.cos(state.camera.yaw);state.camera.target[0]-=dx*scale*rightX+dy*scale*forwardX;state.camera.target[2]-=dx*scale*rightZ+dy*scale*forwardZ;}else{state.camera.yaw-=dx*.005;state.camera.pitch=clamp(state.camera.pitch+dy*.004,.08,1.42);}}state.dirty=true;});const release=event=>{state.pointers.delete(event.pointerId);if(state.pointers.size<2)state.pinch=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('wheel',event=>{event.preventDefault();state.camera.distance=clamp(state.camera.distance*Math.exp(event.deltaY*.001),state.camera.minDistance,state.camera.maxDistance);state.dirty=true;},{passive:false});window.addEventListener('resize',()=>{state.dirty=true;});}
  function showError(error){const message=String(error?.stack||error?.message||error);runtimeErrors.push(message);console.error(error);loadingCard.hidden=true;errorMessage.textContent=message;errorCard.hidden=false;updateQa();}

  async function initialize(){setupControls();setupWebGL();const manifest=await fetchJson(MANIFEST_URL);validateManifest(manifest);state.manifest=manifest;for(const tile of manifest.tiles){state.tileById.set(tile.id,tile);for(const anchor of tile.anchors||[])state.anchorById.set(anchor.id,anchor);}buildTileGrid();const requested=new URLSearchParams(location.search).get('anchor')||'guilin';const anchor=state.anchorById.has(requested)?requested:state.anchorById.keys().next().value;await selectAnchor(anchor);requestAnimationFrame(loop);window.__GUILIN_SINGLE_TRUTH_TEST_API={async selectTile(tileId){await loadTile(tileId);state.dirty=true;await new Promise(resolve=>requestAnimationFrame(resolve));return updateQa();},async selectAnchor(anchorId){await selectAnchor(anchorId);state.dirty=true;await new Promise(resolve=>requestAnimationFrame(resolve));return updateQa();},moveWindow(dx,dy){moveWindow(dx,dy);return updateQa();},resetCamera(){resetCamera();return updateQa();},getState(){return updateQa();}};updateQa();}
  initialize().catch(showError);
})();
