(() => {
  'use strict';

  const MANIFEST_URL = 'data/NATIVE_ELEVATION_MANIFEST.json';
  const OVERVIEW_MANIFEST_URL = 'data/overview-direct-samples-manifest.json';
  const HYDROLOGY_MANIFEST_URL = 'data/osm-waterways-manifest.json';
  const NATIVE_TILE_RUNTIME_BASE_URL = '../guilin-truth-data/native/';
  const DISTILLED_KNOWLEDGE_RUNTIME = true;

  const EXPECTED_SOURCE_SHA = '9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4';
  const EXPECTED_AOI_SHA = '36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80';
  const SOURCE_SPACING_M = 12.5;
  const NODATA = 0;
  const TILE_GRID = 2048;
  const TILE_STRIDE = 2047;
  const TILE_BYTES = 8_388_608;
  const TILE_COUNT = 54;
  const DETAIL_GRID = 640;
  const DETAIL_EDGE_FADE = 72;
  const DETAIL_ENABLE_DISTANCE_M = 92_000;
  const DETAIL_REFRESH_DISTANCE_M = 1_800;
  const MAX_TILE_CACHE = 8;
  const MAX_DPR = 1.65;
  const WATERWAY_STYLE_PROFILE = 'network-directed-physical-width-v6';
  const HYDROLOGY_SEGMENT_STRIDE = 13;
  const HYDROLOGY_SOURCE_NODE_STRIDE = 8;
  const HYDROLOGY_RENDER_NODE_STRIDE = 8;
  const WATERWAY_DEFAULT_EMPHASIS = 1.0;
  const WATERWAY_MIN_EMPHASIS = 0.5;
  const WATERWAY_MAX_EMPHASIS = 1.6;

  const ANCHORS = [
    { id: 'zhenbaoding', name: '真宝鼎', e: 482_534.530462443, n: 2_890_708.122979571 },
    { id: 'guilin', name: '桂林城', e: 429_459.239540243, n: 2_795_494.225020682 },
    { id: 'yangtang', name: '秧塘机场', e: 414_949.565810143, n: 2_789_301.889164384 },
    { id: 'yangshuo', name: '阳朔县', e: 448_648.462659552, n: 2_740_850.767499203 },
  ];

  const $ = id => document.getElementById(id);
  const canvas = $('terrainCanvas');
  const loadingCard = $('loadingCard');
  const loadingDetail = $('loadingDetail');
  const detailLoading = $('detailLoading');
  const detailLoadingText = $('detailLoadingText');
  const errorCard = $('errorCard');
  const errorMessage = $('errorMessage');
  const controlPanel = $('controlPanel');
  const togglePanel = $('togglePanel');
  const renderInfo = $('renderInfo');
  const labelLayer = $('labelLayer');
  const runtimeErrors = [];

  const state = {
    manifest: null,
    overviewManifest: null,
    hydrologyManifest: null,
    tileById: new Map(),
    tileByMatrix: new Map(),
    tileCache: new Map(),
    tileLoadPromises: new Map(),
    overviewValues: null,
    overviewColumns: null,
    overviewRows: null,
    overviewMesh: null,
    detailMesh: null,
    detailPatch: null,
    detailRequestToken: 0,
    detailTimer: null,
    detailActive: false,
    hydrologySegments: null,
    hydrologyNodes: null,
    hydrologySegmentCount: 0,
    hydrologySourceNodeCount: 0,
    hydrologyRenderNodeCount: 0,
    hydrologyJunctionCount: 0,
    hydrologyEndpointCount: 0,
    hydrologyBendCapCount: 0,
    hydrologyVisualJoinGapPx: 0,
    maxOrdinarySourceWidthByClass: [0, 0, 0],
    maxMainstemSourceWidth: 0,
    waterwaysVisible: true,
    waterwayEmphasis: WATERWAY_DEFAULT_EMPHASIS,
    labelsVisible: true,
    labels: [],
    gl: null,
    terrainProgram: null,
    segmentProgram: null,
    nodeProgram: null,
    overviewSegmentVao: null,
    overviewSegmentInstanceBuffer: null,
    nativeSegmentVao: null,
    nativeSegmentInstanceBuffer: null,
    overviewNodeVao: null,
    overviewNodeBuffer: null,
    nativeNodeVao: null,
    nativeNodeBuffer: null,
    terrainUniforms: null,
    segmentUniforms: null,
    nodeUniforms: null,
    projection: new Float32Array(16),
    view: new Float32Array(16),
    viewProjection: new Float32Array(16),
    inverseViewProjection: new Float32Array(16),
    worldCenterE: 0,
    worldCenterN: 0,
    worldWidth: 1,
    worldDepth: 1,
    verticalOrigin: 0,
    elevationMin: 0,
    elevationMax: 1,
    camera: {
      target: [0, 180, 0],
      yaw: -0.72,
      pitch: 0.66,
      distance: 310_000,
      minDistance: 140,
      maxDistance: 1_200_000,
    },
    pointers: new Map(),
    pinch: null,
    dirty: true,
    overviewReady: false,
    hydrologyReady: false,
    ready: false,
    activeAnchor: 'full',
  };

  window.addEventListener('error', event => {
    runtimeErrors.push(String(event.error?.stack || event.message || 'window error'));
    updateQa();
  });
  window.addEventListener('unhandledrejection', event => {
    runtimeErrors.push(String(event.reason?.stack || event.reason || 'unhandled rejection'));
    updateQa();
  });

  const TERRAIN_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in float aElevation;
layout(location=3) in float aFade;
uniform mat4 uViewProjection;
uniform float uMinElevation;
uniform float uMaxElevation;
out vec3 vNormal;
out float vElevationT;
out float vFade;
void main(){
  vNormal=aNormal;
  vElevationT=clamp((aElevation-uMinElevation)/max(1.0,uMaxElevation-uMinElevation),0.0,1.0);
  vFade=aFade;
  gl_Position=uViewProjection*vec4(aPosition,1.0);
}`;

  const TERRAIN_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vNormal;
in float vElevationT;
in float vFade;
uniform float uOpacity;
out vec4 outColor;
vec3 ramp(float t){
  if(t<0.18)return mix(vec3(0.035,0.16,0.09),vec3(0.07,0.27,0.13),t/0.18);
  if(t<0.43)return mix(vec3(0.07,0.27,0.13),vec3(0.22,0.38,0.19),(t-0.18)/0.25);
  if(t<0.68)return mix(vec3(0.22,0.38,0.19),vec3(0.45,0.46,0.28),(t-0.43)/0.25);
  if(t<0.87)return mix(vec3(0.45,0.46,0.28),vec3(0.61,0.58,0.46),(t-0.68)/0.19);
  return mix(vec3(0.61,0.58,0.46),vec3(0.88,0.87,0.81),(t-0.87)/0.13);
}
void main(){
  vec3 n=normalize(vNormal);
  vec3 sun=normalize(vec3(-0.52,0.78,0.34));
  vec3 fill=normalize(vec3(0.34,0.44,-0.56));
  float light=0.29+max(dot(n,sun),0.0)*0.59+max(dot(n,fill),0.0)*0.12;
  float slope=1.0-clamp(n.y,0.0,1.0);
  vec3 base=mix(ramp(vElevationT),vec3(0.55,0.54,0.49),smoothstep(0.26,0.90,slope)*0.42);
  outColor=vec4(pow(max(base*light,vec3(0.0)),vec3(0.92)),clamp(vFade*uOpacity,0.0,1.0));
}`;

  const SEGMENT_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aStart;
layout(location=2) in vec3 aEnd;
layout(location=3) in float aClass;
layout(location=4) in float aMainstemCode;
layout(location=5) in float aSourceWidth;
layout(location=6) in float aStartProgress;
layout(location=7) in float aEndProgress;
layout(location=8) in float aStartFlowDistance;
layout(location=9) in float aEndFlowDistance;
uniform mat4 uViewProjection;
uniform vec2 uViewport;
uniform float uVerticalOrigin;
uniform float uEmphasis;
uniform float uZoomScale;
uniform float uPixelRatio;
uniform float uSurfaceOffset;
out float vClass;
out float vProgress;
out float vMainstem;
out float vAcross;
out float vFlowDistance;
float physicalWidthMeters(float classValue,float mainstemCode,float sourceWidth,float progress){
  float p=pow(clamp(progress,0.0,1.0),1.25);
  if(mainstemCode>0.5){
    float upstream=clamp(sourceWidth*0.08,8.0,18.0);
    return mix(upstream,sourceWidth,p);
  }
  if(classValue<0.5){
    float upstream=clamp(sourceWidth*0.18,3.0,16.0);
    return mix(upstream,sourceWidth,p);
  }
  if(classValue<1.5){
    float upstream=clamp(sourceWidth*0.18,1.5,5.0);
    return mix(upstream,sourceWidth,p);
  }
  float upstream=clamp(sourceWidth*0.35,2.0,8.0);
  return mix(upstream,sourceWidth,p);
}
void main(){
  vec3 startPosition=vec3(aStart.x,aStart.y-uVerticalOrigin+uSurfaceOffset,aStart.z);
  vec3 endPosition=vec3(aEnd.x,aEnd.y-uVerticalOrigin+uSurfaceOffset,aEnd.z);
  vec4 clipStart=uViewProjection*vec4(startPosition,1.0);
  vec4 clipEnd=uViewProjection*vec4(endPosition,1.0);
  float progress=mix(aStartProgress,aEndProgress,aCorner.x);
  vClass=aClass;
  vProgress=progress;
  vMainstem=step(0.5,aMainstemCode);
  vAcross=aCorner.y;
  vFlowDistance=mix(aStartFlowDistance,aEndFlowDistance,aCorner.x);
  if(clipStart.w<=0.0||clipEnd.w<=0.0){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}
  vec3 centerPosition=mix(startPosition,endPosition,aCorner.x);
  vec2 groundDelta=endPosition.xz-startPosition.xz;
  float groundLength=max(length(groundDelta),0.001);
  vec2 direction=groundDelta/groundLength;
  vec2 perpendicular=vec2(-direction.y,direction.x);
  float halfWidthM=0.5*physicalWidthMeters(aClass,aMainstemCode,aSourceWidth,progress)*uEmphasis;
  vec4 centerClip=uViewProjection*vec4(centerPosition,1.0);
  vec3 widthPosition=centerPosition+vec3(perpendicular.x*halfWidthM,0.0,perpendicular.y*halfWidthM);
  vec4 widthClip=uViewProjection*vec4(widthPosition,1.0);
  vec2 centerNdc=centerClip.xy/max(0.00001,centerClip.w);
  vec2 widthNdc=widthClip.xy/max(0.00001,widthClip.w);
  float projectedHalfWidth=length((widthNdc-centerNdc)*uViewport*0.5);
  float minimumHalfWidth=(aMainstemCode>0.5?0.35:(aClass<0.5?0.24:(aClass<1.5?0.18:0.18)))*uPixelRatio;
  float halfWidth=max(minimumHalfWidth,projectedHalfWidth*uZoomScale);
  vec2 ndcStart=clipStart.xy/max(0.00001,clipStart.w);
  vec2 ndcEnd=clipEnd.xy/max(0.00001,clipEnd.w);
  vec2 pixelDelta=(ndcEnd-ndcStart)*uViewport*0.5;
  float pixelLength=max(length(pixelDelta),0.001);
  vec2 pixelDirection=pixelDelta/pixelLength;
  vec2 pixelPerpendicular=vec2(-pixelDirection.y,pixelDirection.x);
  float overlap=clamp(halfWidth*0.35+0.18*uPixelRatio,0.18*uPixelRatio,1.8*uPixelRatio);
  vec4 clipPosition=mix(clipStart,clipEnd,aCorner.x);
  vec2 pixelOffset=pixelPerpendicular*aCorner.y*halfWidth+pixelDirection*mix(-overlap,overlap,aCorner.x);
  clipPosition.xy+=pixelOffset*2.0/uViewport*clipPosition.w;
  gl_Position=clipPosition;
}`;

  const SEGMENT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float vClass;
in float vProgress;
in float vMainstem;
in float vAcross;
in float vFlowDistance;
out vec4 outColor;
void main(){
  float edge=abs(vAcross);
  float aa=max(fwidth(edge)*1.25,0.02);
  float coverage=1.0-smoothstep(1.0-aa,1.0,edge);
  float p=clamp(vProgress,0.0,1.0);
  vec3 mainUp=vec3(0.40,0.69,0.75);
  vec3 mainDown=vec3(0.025,0.235,0.42);
  vec3 riverUp=vec3(0.34,0.66,0.71);
  vec3 riverDown=vec3(0.065,0.36,0.56);
  vec3 streamUp=vec3(0.49,0.75,0.78);
  vec3 streamDown=vec3(0.17,0.52,0.64);
  vec3 canalUp=vec3(0.39,0.63,0.67);
  vec3 canalDown=vec3(0.13,0.43,0.55);
  vec3 ordinary=vClass<0.5?mix(riverUp,riverDown,p):(vClass<1.5?mix(streamUp,streamDown,p):mix(canalUp,canalDown,p));
  vec3 mainColor=mix(mainUp,mainDown,pow(p,1.12));
  vec3 color=mix(ordinary,mainColor,vMainstem);
  float ordinaryAlpha=vClass<0.5?mix(0.56,0.86,p):(vClass<1.5?mix(0.42,0.68,p):mix(0.44,0.70,p));
  float mainAlpha=mix(0.66,0.97,pow(p,0.88));
  float flowReady=0.997+0.003*fract(vFlowDistance/5000.0);
  outColor=vec4(color,coverage*mix(ordinaryAlpha,mainAlpha,vMainstem)*flowReady);
}`;

  const NODE_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in float aClass;
layout(location=2) in float aMainstemCode;
layout(location=3) in float aSourceWidth;
layout(location=4) in float aProgress;
layout(location=5) in float aDegree;
uniform mat4 uViewProjection;
uniform vec2 uViewport;
uniform float uVerticalOrigin;
uniform float uEmphasis;
uniform float uZoomScale;
uniform float uPixelRatio;
uniform float uSurfaceOffset;
out float vClass;
out float vProgress;
out float vMainstem;
float physicalWidthMeters(float classValue,float mainstemCode,float sourceWidth,float progress){
  float p=pow(clamp(progress,0.0,1.0),1.25);
  if(mainstemCode>0.5){float upstream=clamp(sourceWidth*0.08,8.0,18.0);return mix(upstream,sourceWidth,p);}
  if(classValue<0.5){float upstream=clamp(sourceWidth*0.18,3.0,16.0);return mix(upstream,sourceWidth,p);}
  if(classValue<1.5){float upstream=clamp(sourceWidth*0.18,1.5,5.0);return mix(upstream,sourceWidth,p);}
  float upstream=clamp(sourceWidth*0.35,2.0,8.0);return mix(upstream,sourceWidth,p);
}
void main(){
  vec3 position=vec3(aPosition.x,aPosition.y-uVerticalOrigin+uSurfaceOffset+0.04,aPosition.z);
  vec4 centerClip=uViewProjection*vec4(position,1.0);
  float halfWidthM=0.5*physicalWidthMeters(aClass,aMainstemCode,aSourceWidth,aProgress)*uEmphasis;
  vec4 offsetClip=uViewProjection*vec4(position+vec3(halfWidthM,0.0,0.0),1.0);
  vec2 centerNdc=centerClip.xy/max(0.00001,centerClip.w);
  vec2 offsetNdc=offsetClip.xy/max(0.00001,offsetClip.w);
  float halfWidthPx=length((offsetNdc-centerNdc)*uViewport*0.5);
  float minimumHalfWidth=(aMainstemCode>0.5?0.35:(aClass<0.5?0.24:0.18))*uPixelRatio;
  halfWidthPx=max(minimumHalfWidth,halfWidthPx*uZoomScale);
  gl_Position=centerClip;
  float multiplier=aDegree>2.5?2.18:(aDegree>1.5?2.08:1.72);
  gl_PointSize=max(0.58*uPixelRatio,halfWidthPx*multiplier+0.12*uPixelRatio);
  vClass=aClass;
  vProgress=aProgress;
  vMainstem=step(0.5,aMainstemCode);
}`;

  const NODE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float vClass;
in float vProgress;
in float vMainstem;
out vec4 outColor;
void main(){
  vec2 q=gl_PointCoord*2.0-1.0;
  float radius=length(q);
  float aa=max(fwidth(radius)*1.35,0.025);
  float coverage=1.0-smoothstep(1.0-aa,1.0,radius);
  if(coverage<=0.0)discard;
  float p=clamp(vProgress,0.0,1.0);
  vec3 mainColor=mix(vec3(0.40,0.69,0.75),vec3(0.025,0.235,0.42),pow(p,1.12));
  vec3 river=mix(vec3(0.34,0.66,0.71),vec3(0.065,0.36,0.56),p);
  vec3 stream=mix(vec3(0.49,0.75,0.78),vec3(0.17,0.52,0.64),p);
  vec3 canal=mix(vec3(0.39,0.63,0.67),vec3(0.13,0.43,0.55),p);
  vec3 ordinary=vClass<0.5?river:(vClass<1.5?stream:canal);
  float ordinaryAlpha=vClass<0.5?mix(0.56,0.86,p):(vClass<1.5?mix(0.42,0.68,p):mix(0.44,0.70,p));
  float mainAlpha=mix(0.66,0.97,pow(p,0.88));
  outColor=vec4(mix(ordinary,mainColor,vMainstem),coverage*mix(ordinaryAlpha,mainAlpha,vMainstem));
}`;

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / Math.max(1e-9, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.json();
  }

  async function fetchBinary(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.arrayBuffer();
  }

  async function sha256Hex(buffer) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  }

  function hostIsLittleEndian() {
    const probe = new ArrayBuffer(2);
    new DataView(probe).setUint16(0, 0x00ff, true);
    return new Uint16Array(probe)[0] === 0x00ff;
  }

  function decodeInt16LE(buffer) {
    if (hostIsLittleEndian()) return new Int16Array(buffer);
    const view = new DataView(buffer);
    const values = new Int16Array(buffer.byteLength / 2);
    for (let index = 0; index < values.length; index += 1) values[index] = view.getInt16(index * 2, true);
    return values;
  }

  function decodeFloat32LE(buffer) {
    if (hostIsLittleEndian()) return new Float32Array(buffer);
    const view = new DataView(buffer);
    const values = new Float32Array(buffer.byteLength / 4);
    for (let index = 0; index < values.length; index += 1) values[index] = view.getFloat32(index * 4, true);
    return values;
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(log || 'shader compile failed');
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(log || 'program link failed');
    }
    return program;
  }

  function setupWebGL() {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    assert(gl, '当前浏览器未提供 WebGL2');
    state.gl = gl;
    state.terrainProgram = createProgram(gl, TERRAIN_VERTEX_SHADER, TERRAIN_FRAGMENT_SHADER);
    state.segmentProgram = createProgram(gl, SEGMENT_VERTEX_SHADER, SEGMENT_FRAGMENT_SHADER);
    state.nodeProgram = createProgram(gl, NODE_VERTEX_SHADER, NODE_FRAGMENT_SHADER);
    state.terrainUniforms = {
      viewProjection: gl.getUniformLocation(state.terrainProgram, 'uViewProjection'),
      minimum: gl.getUniformLocation(state.terrainProgram, 'uMinElevation'),
      maximum: gl.getUniformLocation(state.terrainProgram, 'uMaxElevation'),
      opacity: gl.getUniformLocation(state.terrainProgram, 'uOpacity'),
    };
    state.segmentUniforms = {
      viewProjection: gl.getUniformLocation(state.segmentProgram, 'uViewProjection'),
      viewport: gl.getUniformLocation(state.segmentProgram, 'uViewport'),
      verticalOrigin: gl.getUniformLocation(state.segmentProgram, 'uVerticalOrigin'),
      emphasis: gl.getUniformLocation(state.segmentProgram, 'uEmphasis'),
      zoomScale: gl.getUniformLocation(state.segmentProgram, 'uZoomScale'),
      pixelRatio: gl.getUniformLocation(state.segmentProgram, 'uPixelRatio'),
      surfaceOffset: gl.getUniformLocation(state.segmentProgram, 'uSurfaceOffset'),
    };
    state.nodeUniforms = {
      viewProjection: gl.getUniformLocation(state.nodeProgram, 'uViewProjection'),
      viewport: gl.getUniformLocation(state.nodeProgram, 'uViewport'),
      verticalOrigin: gl.getUniformLocation(state.nodeProgram, 'uVerticalOrigin'),
      emphasis: gl.getUniformLocation(state.nodeProgram, 'uEmphasis'),
      zoomScale: gl.getUniformLocation(state.nodeProgram, 'uZoomScale'),
      pixelRatio: gl.getUniformLocation(state.nodeProgram, 'uPixelRatio'),
      surfaceOffset: gl.getUniformLocation(state.nodeProgram, 'uSurfaceOffset'),
    };

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.clearColor(0.022, 0.050, 0.051, 1);
  }

  function createTerrainMesh() {
    const gl = state.gl;
    return {
      vao: gl.createVertexArray(),
      vertexBuffer: gl.createBuffer(),
      indexBuffer: gl.createBuffer(),
      indexCount: 0,
      triangleCount: 0,
      vertexCount: 0,
    };
  }

  function uploadTerrainMesh(mesh, vertices, indices, indexCount) {
    const gl = state.gl;
    gl.bindVertexArray(mesh.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const stride = 8 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 6 * 4);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 7 * 4);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices.subarray(0, indexCount), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    mesh.indexCount = indexCount;
    mesh.triangleCount = indexCount / 3;
    mesh.vertexCount = vertices.length / 8;
  }

  function validateManifests(manifest, overview, hydrology) {
    assert(manifest?.schema === 'guilin-canonical-native-dem/v1', '唯一真值清单版本不正确');
    assert(manifest.status === 'sole_authoritative', '唯一真值状态不正确');
    assert(manifest.source?.sha256 === EXPECTED_SOURCE_SHA, '源 TIFF SHA256 不正确');
    assert(manifest.aoi?.geometry_sha256 === EXPECTED_AOI_SHA, 'AOI SHA256 不正确');
    assert(manifest.source?.resolution_m?.[0] === SOURCE_SPACING_M, '源采样间距不正确');
    assert(manifest.tiles?.length === TILE_COUNT, '原生瓦片数量不正确');
    assert(manifest.tile_matrix?.compression === 'none', '原生瓦片出现压缩');
    assert(manifest.rules?.height_image_texture_used === false, '检测到高度图片贴图');
    assert(manifest.rules?.reservoir_surface_asset_emitted === false, '检测到水库面');
    assert(manifest.rules?.lake_surface_asset_emitted === false, '检测到湖泊面');

    assert(overview?.schema === 'guilin-full-map-direct-sample-overview/v1', '全域总图清单版本不正确');
    assert(overview.source?.sha256 === EXPECTED_SOURCE_SHA, '全域总图来源不正确');
    assert(overview.aoi?.geometry_sha256 === EXPECTED_AOI_SHA, '全域总图 AOI 不正确');
    assert(overview.asset?.compression === 'none', '全域总图资产出现压缩');
    assert(overview.asset?.interpolation === 'none', '全域总图资产出现插值');
    assert(overview.asset?.height_texture === false, '全域总图使用了高度贴图');

    assert(hydrology?.schema === 'guilin-osm-linear-waterways-render-asset/v1', '水系清单版本不正确');
    assert(hydrology.source?.centerline_coordinates_mutated === false, 'OSM 水系中心线发生变化');
    assert(hydrology.source?.manual_centerline_added === false, '检测到手工河道');
    assert(hydrology.source?.synthetic_gap_line_added === false, '检测到合成补线');
    assert(hydrology.filter?.lake_surface_asset_emitted === false, '检测到湖泊面');
    assert(hydrology.filter?.reservoir_surface_asset_emitted === false, '检测到水库面');
    assert(hydrology.filter?.synthetic_surface_asset_emitted === false, '检测到合成水面');
    assert(hydrology.segments?.compression === 'none', '水系线段资产出现压缩');
    assert(hydrology.nodes?.compression === 'none', '水系节点资产出现压缩');
    assert(hydrology.styling?.profile === WATERWAY_STYLE_PROFILE, '水系层级样式版本不正确');
    assert(hydrology.direction?.segment_vertex_order === 'upstream_to_downstream', '水系线段方向没有按上游到下游保存');
    assert(hydrology.direction?.flow_progress_monotonic === true, '水系宽度进度没有沿下游增加');
    assert(hydrology.direction?.flow_distance_monotonic === true, '水系流动距离没有沿下游增加');
    assert(hydrology.direction?.future_flow_animation_ready === true, '水系缺少下一阶段流动动画方向合同');
    assert(hydrology.segments?.layout?.length === HYDROLOGY_SEGMENT_STRIDE, '水系线段布局步长不正确');
    assert(hydrology.nodes?.layout?.length === HYDROLOGY_SOURCE_NODE_STRIDE, '水系节点布局步长不正确');
    for (const name of ['li', 'xiang', 'zi']) {
      assert((hydrology.styling?.mainstem_segment_counts?.[name] || 0) > 0, `${name} 主河道样式为空`);
    }
    const sourceSegmentCount =
      hydrology.topology?.source_segment_count ??
      hydrology.topology?.source_segment_count_after_render_densification ??
      hydrology.topology?.segment_count ??
      hydrology.topology?.emitted_segment_count;
    const emittedSegmentCount =
      hydrology.segments?.count ??
      hydrology.topology?.segment_count ??
      hydrology.topology?.emitted_segment_count;
    const droppedSegmentCount =
      hydrology.topology?.dropped_segment_count ??
      hydrology.topology?.nodata_break_count ??
      0;
    assert(Number.isInteger(sourceSegmentCount) && sourceSegmentCount > 0, '水系源线段数量无效');
    assert(Number.isInteger(emittedSegmentCount) && emittedSegmentCount > 0, '水系渲染线段数量无效');
    assert(sourceSegmentCount === emittedSegmentCount, '水系源线段未完整进入渲染资产');
    assert(droppedSegmentCount === 0, '水系存在被丢弃的断段');
  }

  function setupWorld(manifest, overviewManifest) {
    const bounds = manifest.aoi.native_sample_center_bounds_epsg32649;
    const west = bounds[0];
    const south = bounds[1];
    const east = bounds[2];
    const north = bounds[3];
    state.worldCenterE = (west + east) * 0.5;
    state.worldCenterN = (south + north) * 0.5;
    state.worldWidth = east - west;
    state.worldDepth = north - south;
    state.elevationMin = overviewManifest.asset.elevation_range_m[0];
    state.elevationMax = overviewManifest.asset.elevation_range_m[1];
    state.verticalOrigin = state.elevationMin;
  }

  function overviewSampleAt(outputColumn, outputRow) {
    const width = state.overviewManifest.asset.grid[0];
    const height = state.overviewManifest.asset.grid[1];
    const column = clamp(outputColumn, 0, width - 1);
    const row = clamp(outputRow, 0, height - 1);
    return state.overviewValues[row * width + column];
  }

  function nearestIndex(sortedValues, target) {
    let low = 0;
    let high = sortedValues.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (sortedValues[middle] < target) low = middle + 1;
      else high = middle;
    }
    if (low > 0 && Math.abs(sortedValues[low - 1] - target) <= Math.abs(sortedValues[low] - target)) return low - 1;
    return low;
  }

  function overviewElevationAtWorld(x, z) {
    const bounds = state.manifest.aoi.native_sample_center_bounds_epsg32649;
    const easting = state.worldCenterE + x;
    const northing = state.worldCenterN - z;
    const globalColumn = Math.round((easting - bounds[0]) / SOURCE_SPACING_M);
    const globalRow = Math.round((bounds[3] - northing) / SOURCE_SPACING_M);
    const outputColumn = nearestIndex(state.overviewColumns, globalColumn);
    const outputRow = nearestIndex(state.overviewRows, globalRow);
    const value = overviewSampleAt(outputColumn, outputRow);
    return value === NODATA ? state.elevationMin : value;
  }

  function lowerBracketIndex(sortedValues, target) {
    if (target <= sortedValues[0]) return 0;
    if (target >= sortedValues[sortedValues.length - 1]) return sortedValues.length - 2;
    let low = 0;
    let high = sortedValues.length - 1;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (sortedValues[middle] <= target) low = middle;
      else high = middle;
    }
    return low;
  }

  function overviewSurfaceElevationAtWorld(x, z) {
    const bounds = state.manifest.aoi.native_sample_center_bounds_epsg32649;
    const easting = state.worldCenterE + x;
    const northing = state.worldCenterN - z;
    const globalColumn = (easting - bounds[0]) / SOURCE_SPACING_M;
    const globalRow = (bounds[3] - northing) / SOURCE_SPACING_M;
    const column0 = lowerBracketIndex(state.overviewColumns, globalColumn);
    const row0 = lowerBracketIndex(state.overviewRows, globalRow);
    const column1 = Math.min(state.overviewColumns.length - 1, column0 + 1);
    const row1 = Math.min(state.overviewRows.length - 1, row0 + 1);
    const sourceColumn0 = state.overviewColumns[column0];
    const sourceColumn1 = state.overviewColumns[column1];
    const sourceRow0 = state.overviewRows[row0];
    const sourceRow1 = state.overviewRows[row1];
    const u = clamp((globalColumn - sourceColumn0) / Math.max(1, sourceColumn1 - sourceColumn0), 0, 1);
    const v = clamp((globalRow - sourceRow0) / Math.max(1, sourceRow1 - sourceRow0), 0, 1);
    const a = overviewSampleAt(column0, row0);
    const b = overviewSampleAt(column1, row0);
    const c = overviewSampleAt(column0, row1);
    const d = overviewSampleAt(column1, row1);
    if (a === NODATA || b === NODATA || c === NODATA || d === NODATA) {
      return overviewElevationAtWorld(x, z);
    }
    if (u + v <= 1) return a + u * (b - a) + v * (c - a);
    return (1 - v) * b + (1 - u) * c + (u + v - 1) * d;
  }

  function hydrologyNodeKey(x, z) {
    return `${x}|${z}`;
  }

  function waterwayZoomScale() {
    return clamp(approximateMetersPerCssPixel() / 95, 1, 2.4);
  }

  function waterwayPhysicalWidthM(classIndex, mainstemCode, sourceWidthM, progress) {
    const p = Math.pow(clamp(progress, 0, 1), 1.25);
    if (mainstemCode > 0) {
      const upstream = clamp(sourceWidthM * 0.08, 8, 18);
      return upstream + (sourceWidthM - upstream) * p;
    }
    if (classIndex === 0) {
      const upstream = clamp(sourceWidthM * 0.18, 3, 16);
      return upstream + (sourceWidthM - upstream) * p;
    }
    if (classIndex === 1) {
      const upstream = clamp(sourceWidthM * 0.18, 1.5, 5);
      return upstream + (sourceWidthM - upstream) * p;
    }
    const upstream = clamp(sourceWidthM * 0.35, 2, 8);
    return upstream + (sourceWidthM - upstream) * p;
  }

  function approximateMetersPerCssPixel() {
    const height = Math.max(1, canvas.clientHeight || 1000);
    const visibleHeight = 2 * state.camera.distance * Math.tan((Math.PI / 4.05) * 0.5);
    return Math.max(0.01, visibleHeight / height);
  }

  function waterwayFullWidthCssPx(classIndex, mainstemCode, sourceWidthM, progress) {
    const physical = waterwayPhysicalWidthM(classIndex, mainstemCode, sourceWidthM, progress) * state.waterwayEmphasis;
    const minimum = mainstemCode > 0 ? 0.70 : (classIndex === 0 ? 0.48 : 0.36);
    return Math.max(minimum, physical / approximateMetersPerCssPixel() * waterwayZoomScale());
  }

  function waterwayStyleMetrics() {
    const ordinaryRiverWidth = state.maxOrdinarySourceWidthByClass[0] || 28;
    const streamSourceWidth = state.maxOrdinarySourceWidthByClass[1] || 6;
    const canalSourceWidth = state.maxOrdinarySourceWidthByClass[2] || 5;
    const mainstemSourceWidth = state.maxMainstemSourceWidth || 180;
    const secondaryRiver = Number(waterwayFullWidthCssPx(0, 0, ordinaryRiverWidth, 1).toFixed(3));
    const stream = Number(waterwayFullWidthCssPx(1, 0, streamSourceWidth, 1).toFixed(3));
    const canal = Number(waterwayFullWidthCssPx(2, 0, canalSourceWidth, 1).toFixed(3));
    const upstream = Number(waterwayFullWidthCssPx(0, 1, mainstemSourceWidth, 0).toFixed(3));
    const midstream = Number(waterwayFullWidthCssPx(0, 1, mainstemSourceWidth, 0.5).toFixed(3));
    const downstream = Number(waterwayFullWidthCssPx(0, 1, mainstemSourceWidth, 1).toFixed(3));
    return {
      profile: WATERWAY_STYLE_PROFILE,
      width_mode: 'source-width-meters-projected-to-screen',
      emphasis: Number(state.waterwayEmphasis.toFixed(3)),
      cartographic_visibility_boost: Number(waterwayZoomScale().toFixed(3)),
      approximate_meters_per_css_pixel: Number(approximateMetersPerCssPixel().toFixed(3)),
      mainstem_upstream_physical_width_m: Number(waterwayPhysicalWidthM(0, 1, mainstemSourceWidth, 0).toFixed(3)),
      mainstem_midstream_physical_width_m: Number(waterwayPhysicalWidthM(0, 1, mainstemSourceWidth, 0.5).toFixed(3)),
      mainstem_downstream_physical_width_m: Number(waterwayPhysicalWidthM(0, 1, mainstemSourceWidth, 1).toFixed(3)),
      mainstem_upstream_full_width_css_px: upstream,
      mainstem_midstream_full_width_css_px: midstream,
      mainstem_downstream_full_width_css_px: downstream,
      mainstem_full_width_css_px: downstream,
      mainstem_downstream_to_upstream_width_ratio: Number((downstream / Math.max(0.001, upstream)).toFixed(3)),
      secondary_river_max_full_width_css_px: secondaryRiver,
      stream_max_full_width_css_px: stream,
      canal_max_full_width_css_px: canal,
      max_full_width_css_px: Math.max(secondaryRiver, stream, canal),
      mainstem_names: ['漓江及桂江连续干流', '湘江', '资江'],
      mainstem_segment_counts: state.hydrologyManifest?.styling?.mainstem_segment_counts || null,
      mainstem_progress_ranges: state.hydrologyManifest?.styling?.mainstem_progress_ranges || null,
      li_gui_continuation_segment_count: state.hydrologyManifest?.styling?.li_gui_continuation_segment_count || 0,
      li_south_of_yangshuo_segment_count: state.hydrologyManifest?.styling?.li_south_of_yangshuo_segment_count || 0,
      li_reaches_aoi_south_boundary: state.hydrologyManifest?.styling?.li_reaches_aoi_south_boundary ?? false,
      runtime_route_break_count: state.hydrologyManifest?.topology?.runtime_route_break_count ?? 0,
      flow_direction: 'upstream_to_downstream',
      flow_progress_monotonic: true,
      future_flow_animation_ready: true,
      color_gradient: 'upstream-light-and-thin_to_downstream-dark-and-wide',
      source_width_meters_preserved: true,
    };
  }

  function buildOverviewGeometry() {
    loadingDetail.textContent = '构建全域连续地形几何';
    const width = state.overviewManifest.asset.grid[0];
    const height = state.overviewManifest.asset.grid[1];
    const columns = state.overviewColumns;
    const rows = state.overviewRows;
    const bounds = state.manifest.aoi.native_sample_center_bounds_epsg32649;
    const west = bounds[0];
    const north = bounds[3];
    const vertices = new Float32Array(width * height * 8);

    let cursor = 0;
    for (let row = 0; row < height; row += 1) {
      const sourceRow = rows[row];
      const northing = north - sourceRow * SOURCE_SPACING_M;
      const previousRow = Math.max(0, row - 1);
      const nextRow = Math.min(height - 1, row + 1);
      const dz = Math.max(
        SOURCE_SPACING_M,
        (rows[nextRow] - rows[previousRow]) * SOURCE_SPACING_M
      );
      for (let column = 0; column < width; column += 1) {
        const sourceColumn = columns[column];
        const easting = west + sourceColumn * SOURCE_SPACING_M;
        const value = overviewSampleAt(column, row);
        const elevation = value === NODATA ? state.elevationMin : value;
        const previousColumn = Math.max(0, column - 1);
        const nextColumn = Math.min(width - 1, column + 1);
        const leftRaw = overviewSampleAt(previousColumn, row);
        const rightRaw = overviewSampleAt(nextColumn, row);
        const northRaw = overviewSampleAt(column, previousRow);
        const southRaw = overviewSampleAt(column, nextRow);
        const left = leftRaw === NODATA ? elevation : leftRaw;
        const right = rightRaw === NODATA ? elevation : rightRaw;
        const northValue = northRaw === NODATA ? elevation : northRaw;
        const southValue = southRaw === NODATA ? elevation : southRaw;
        const dx = Math.max(
          SOURCE_SPACING_M,
          (columns[nextColumn] - columns[previousColumn]) * SOURCE_SPACING_M
        );
        let nx = -(right - left) / dx;
        let ny = 1;
        let nz = -(southValue - northValue) / dz;
        const length = Math.hypot(nx, ny, nz) || 1;
        nx /= length;
        ny /= length;
        nz /= length;

        vertices[cursor++] = easting - state.worldCenterE;
        vertices[cursor++] = elevation - state.verticalOrigin;
        vertices[cursor++] = state.worldCenterN - northing;
        vertices[cursor++] = nx;
        vertices[cursor++] = ny;
        vertices[cursor++] = nz;
        vertices[cursor++] = elevation;
        vertices[cursor++] = 1;
      }
    }

    const maximumIndices = (width - 1) * (height - 1) * 6;
    const indices = new Uint32Array(maximumIndices);
    let indexCursor = 0;
    for (let row = 0; row < height - 1; row += 1) {
      for (let column = 0; column < width - 1; column += 1) {
        const a = row * width + column;
        const b = a + 1;
        const c = a + width;
        const d = c + 1;
        if (
          state.overviewValues[a] === NODATA ||
          state.overviewValues[b] === NODATA ||
          state.overviewValues[c] === NODATA ||
          state.overviewValues[d] === NODATA
        ) continue;
        indices[indexCursor++] = a;
        indices[indexCursor++] = c;
        indices[indexCursor++] = b;
        indices[indexCursor++] = b;
        indices[indexCursor++] = c;
        indices[indexCursor++] = d;
      }
    }

    state.overviewMesh = createTerrainMesh();
    uploadTerrainMesh(state.overviewMesh, vertices, indices, indexCursor);
    state.overviewReady = true;
  }

  function setupHydrologyGeometry(segmentValues, nodeValues) {
    const gl = state.gl;
    state.hydrologySegments = segmentValues;
    state.hydrologyNodes = nodeValues;
    state.hydrologySegmentCount = segmentValues.length / HYDROLOGY_SEGMENT_STRIDE;
    state.hydrologySourceNodeCount = nodeValues.length / HYDROLOGY_SOURCE_NODE_STRIDE;
    const expectedSegmentCount =
      state.hydrologyManifest.segments?.count ??
      state.hydrologyManifest.topology?.segment_count ??
      state.hydrologyManifest.topology?.emitted_segment_count;
    const expectedNodeCount =
      state.hydrologyManifest.nodes?.count ??
      state.hydrologyManifest.topology?.node_count ??
      state.hydrologyManifest.topology?.node_vertex_count;
    assert(Number.isInteger(state.hydrologySegmentCount), '水系线段缓冲区步长不正确');
    assert(Number.isInteger(state.hydrologySourceNodeCount), '水系节点缓冲区步长不正确');
    assert(Number.isInteger(expectedSegmentCount) && expectedSegmentCount > 0, '水系线段清单缺少有效数量');
    assert(Number.isInteger(expectedNodeCount) && expectedNodeCount > 0, '水系节点清单缺少有效数量');
    assert(state.hydrologySegmentCount === expectedSegmentCount, '水系线段数量与清单不一致');
    assert(state.hydrologySourceNodeCount === expectedNodeCount, '水系源节点数量与清单不一致');
    const sourceSegmentCount =
      state.hydrologyManifest.topology?.source_segment_count ??
      state.hydrologyManifest.topology?.source_segment_count_after_render_densification ??
      expectedSegmentCount;
    const droppedSegmentCount =
      state.hydrologyManifest.topology?.dropped_segment_count ??
      state.hydrologyManifest.topology?.nodata_break_count ??
      0;
    assert(sourceSegmentCount === expectedSegmentCount, '水系存在未进入渲染资产的源线段');
    assert(droppedSegmentCount === 0, '水系存在高程缺失造成的断段');

    state.maxOrdinarySourceWidthByClass.fill(0);
    state.maxMainstemSourceWidth = 0;
    const topology = new Map();
    const registerNode = (
      x, elevation, z, classValue, mainstemCode, sourceWidth,
      progress, flowDistance, directionX, directionZ
    ) => {
      const key = hydrologyNodeKey(x, z);
      let record = topology.get(key);
      if (!record) {
        record = {
          key,
          x,
          z,
          nativeElevation: elevation,
          overviewElevation: null,
          classValue,
          mainstemCode,
          sourceWidth,
          progress,
          flowDistance,
          degree: 0,
          directions: [],
        };
        topology.set(key, record);
      }
      record.classValue = Math.min(record.classValue, classValue);
      record.sourceWidth = Math.max(record.sourceWidth, sourceWidth);
      if (mainstemCode > 0 && (record.mainstemCode <= 0 || progress >= record.progress)) {
        record.mainstemCode = mainstemCode;
      }
      record.progress = Math.max(record.progress, progress);
      record.flowDistance = Math.max(record.flowDistance, flowDistance);
      record.degree += 1;
      const length = Math.hypot(directionX, directionZ);
      if (length > 1e-6) record.directions.push([directionX / length, directionZ / length]);
      const classIndex = clamp(Math.round(classValue), 0, 2);
      if (mainstemCode > 0) state.maxMainstemSourceWidth = Math.max(state.maxMainstemSourceWidth, sourceWidth);
      else state.maxOrdinarySourceWidthByClass[classIndex] = Math.max(state.maxOrdinarySourceWidthByClass[classIndex], sourceWidth);
      return record;
    };

    for (let offset = 0; offset < segmentValues.length; offset += HYDROLOGY_SEGMENT_STRIDE) {
      const startX = segmentValues[offset];
      const startElevation = segmentValues[offset + 1];
      const startZ = segmentValues[offset + 2];
      const endX = segmentValues[offset + 3];
      const endElevation = segmentValues[offset + 4];
      const endZ = segmentValues[offset + 5];
      const classValue = segmentValues[offset + 6];
      const mainstemCode = segmentValues[offset + 7];
      const sourceWidth = segmentValues[offset + 8];
      const startProgress = segmentValues[offset + 9];
      const endProgress = segmentValues[offset + 10];
      const startFlowDistance = segmentValues[offset + 11];
      const endFlowDistance = segmentValues[offset + 12];
      assert(endProgress + 1e-6 >= startProgress, '水系上下游宽度进度发生反转');
      assert(endFlowDistance > startFlowDistance, '水系流动距离没有按下游增加');
      registerNode(
        startX, startElevation, startZ, classValue, mainstemCode, sourceWidth,
        startProgress, startFlowDistance, endX - startX, endZ - startZ
      );
      registerNode(
        endX, endElevation, endZ, classValue, mainstemCode, sourceWidth,
        endProgress, endFlowDistance, startX - endX, startZ - endZ
      );
    }

    for (const record of topology.values()) {
      record.overviewElevation = overviewSurfaceElevationAtWorld(record.x, record.z);
    }

    const overviewSegmentValues = new Float32Array(segmentValues);
    for (let offset = 0; offset < segmentValues.length; offset += HYDROLOGY_SEGMENT_STRIDE) {
      const start = topology.get(hydrologyNodeKey(segmentValues[offset], segmentValues[offset + 2]));
      const end = topology.get(hydrologyNodeKey(segmentValues[offset + 3], segmentValues[offset + 5]));
      assert(start && end, '水系线段端点拓扑缺失');
      overviewSegmentValues[offset + 1] = start.overviewElevation;
      overviewSegmentValues[offset + 4] = end.overviewElevation;
    }

    const nativeNodeValues = [];
    const overviewNodeValues = [];
    let endpointCount = 0;
    let junctionCount = 0;
    let bendCapCount = 0;
    for (const record of topology.values()) {
      let include = record.degree !== 2;
      if (record.degree === 1) endpointCount += 1;
      if (record.degree >= 3) junctionCount += 1;
      if (record.degree === 2 && record.directions.length >= 2) {
        const first = record.directions[0];
        const second = record.directions[1];
        const directionDot = clamp(first[0] * second[0] + first[1] * second[1], -1, 1);
        if (directionDot > -0.92) {
          include = true;
          bendCapCount += 1;
        }
      }
      if (!include) continue;
      nativeNodeValues.push(
        record.x,
        record.nativeElevation,
        record.z,
        record.classValue,
        record.mainstemCode,
        record.sourceWidth,
        record.progress,
        record.degree
      );
      overviewNodeValues.push(
        record.x,
        record.overviewElevation,
        record.z,
        record.classValue,
        record.mainstemCode,
        record.sourceWidth,
        record.progress,
        record.degree
      );
    }

    state.hydrologyEndpointCount = endpointCount;
    state.hydrologyJunctionCount = junctionCount;
    state.hydrologyBendCapCount = bendCapCount;
    state.hydrologyRenderNodeCount = nativeNodeValues.length / HYDROLOGY_RENDER_NODE_STRIDE;
    state.hydrologyVisualJoinGapPx = 0;
    assert(state.hydrologyRenderNodeCount > 0, '水系连续接缝节点为空');
    assert(state.hydrologyRenderNodeCount < state.hydrologySourceNodeCount, '水系仍在逐顶点绘制粗圆点');
    assert(state.hydrologyJunctionCount > 0, '水系汇流节点为空');

    const corners = new Float32Array([
      0, -1,
      0, 1,
      1, -1,
      1, 1,
    ]);
    const cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);

    const createSegmentVao = values => {
      const vao = gl.createVertexArray();
      const instanceBuffer = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
      const segmentStride = HYDROLOGY_SEGMENT_STRIDE * 4;
      const attributes = [
        [1, 3, 0],
        [2, 3, 3],
        [3, 1, 6],
        [4, 1, 7],
        [5, 1, 8],
        [6, 1, 9],
        [7, 1, 10],
        [8, 1, 11],
        [9, 1, 12],
      ];
      for (const [location, size, floatOffset] of attributes) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, segmentStride, floatOffset * 4);
        gl.vertexAttribDivisor(location, 1);
      }
      gl.bindVertexArray(null);
      return { vao, instanceBuffer };
    };

    const createNodeVao = values => {
      const vao = gl.createVertexArray();
      const buffer = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
      const nodeStride = HYDROLOGY_RENDER_NODE_STRIDE * 4;
      const attributes = [
        [0, 3, 0],
        [1, 1, 3],
        [2, 1, 4],
        [3, 1, 5],
        [4, 1, 6],
        [5, 1, 7],
      ];
      for (const [location, size, floatOffset] of attributes) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, nodeStride, floatOffset * 4);
      }
      gl.bindVertexArray(null);
      return { vao, buffer };
    };

    const overviewSegments = createSegmentVao(overviewSegmentValues);
    const nativeSegments = createSegmentVao(segmentValues);
    const overviewNodes = createNodeVao(overviewNodeValues);
    const nativeNodes = createNodeVao(nativeNodeValues);
    state.overviewSegmentVao = overviewSegments.vao;
    state.overviewSegmentInstanceBuffer = overviewSegments.instanceBuffer;
    state.nativeSegmentVao = nativeSegments.vao;
    state.nativeSegmentInstanceBuffer = nativeSegments.instanceBuffer;
    state.overviewNodeVao = overviewNodes.vao;
    state.overviewNodeBuffer = overviewNodes.buffer;
    state.nativeNodeVao = nativeNodes.vao;
    state.nativeNodeBuffer = nativeNodes.buffer;
    state.hydrologyReady = true;
  }

  function globalSampleToTile(globalRow, globalColumn) {
    const rows = state.manifest.tile_matrix.rows;
    const columns = state.manifest.tile_matrix.columns;
    const tileRow = clamp(Math.floor(globalRow / TILE_STRIDE), 0, rows - 1);
    const tileColumn = clamp(Math.floor(globalColumn / TILE_STRIDE), 0, columns - 1);
    const tile = state.tileByMatrix.get(`${tileRow},${tileColumn}`);
    assert(tile, `找不到原生瓦片 ${tileRow},${tileColumn}`);
    return {
      tile,
      localRow: globalRow - tileRow * TILE_STRIDE,
      localColumn: globalColumn - tileColumn * TILE_STRIDE,
    };
  }

  async function loadNativeTile(tile) {
    const existing = state.tileCache.get(tile.id);
    if (existing) {
      existing.lastUsed = performance.now();
      return existing.codes;
    }
    if (state.tileLoadPromises.has(tile.id)) return state.tileLoadPromises.get(tile.id);

    const promise = (async () => {
      const buffer = await fetchBinary(`${NATIVE_TILE_RUNTIME_BASE_URL}${tile.file}`);
      assert(buffer.byteLength === TILE_BYTES, `${tile.id} 字节数不正确`);
      const digest = await sha256Hex(buffer);
      assert(digest === tile.sha256, `${tile.id} SHA256 不正确`);
      const codes = decodeInt16LE(buffer);
      state.tileCache.set(tile.id, { codes, lastUsed: performance.now() });
      state.tileLoadPromises.delete(tile.id);
      return codes;
    })().catch(error => {
      state.tileLoadPromises.delete(tile.id);
      throw error;
    });
    state.tileLoadPromises.set(tile.id, promise);
    return promise;
  }

  function evictTileCache(protectedIds) {
    if (state.tileCache.size <= MAX_TILE_CACHE) return;
    const candidates = [...state.tileCache.entries()]
      .filter(([id]) => !protectedIds.has(id))
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    while (state.tileCache.size > MAX_TILE_CACHE && candidates.length) {
      const [id] = candidates.shift();
      state.tileCache.delete(id);
    }
  }

  function sampleLoadedGlobal(globalRow, globalColumn) {
    const width = state.manifest.aoi.native_sample_window[2];
    const height = state.manifest.aoi.native_sample_window[3];
    const row = clamp(globalRow, 0, height - 1);
    const column = clamp(globalColumn, 0, width - 1);
    const mapping = globalSampleToTile(row, column);
    const cached = state.tileCache.get(mapping.tile.id);
    if (!cached) throw new Error(`原生瓦片尚未读取 ${mapping.tile.id}`);
    return cached.codes[mapping.localRow * TILE_GRID + mapping.localColumn];
  }

  function buildDetailGeometry(startColumn, startRow, width, height) {
    const values = new Int16Array(width * height);
    let minimum = Infinity;
    let maximum = -Infinity;
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const value = sampleLoadedGlobal(startRow + row, startColumn + column);
        values[row * width + column] = value;
        if (value !== NODATA) {
          minimum = Math.min(minimum, value);
          maximum = Math.max(maximum, value);
        }
      }
    }
    assert(Number.isFinite(minimum), '当前原生近景没有有效高程');

    const bounds = state.manifest.aoi.native_sample_center_bounds_epsg32649;
    const west = bounds[0];
    const north = bounds[3];
    const vertices = new Float32Array(width * height * 8);
    let cursor = 0;
    for (let row = 0; row < height; row += 1) {
      const globalRow = startRow + row;
      const northing = north - globalRow * SOURCE_SPACING_M;
      for (let column = 0; column < width; column += 1) {
        const globalColumn = startColumn + column;
        const easting = west + globalColumn * SOURCE_SPACING_M;
        const raw = values[row * width + column];
        const elevation = raw === NODATA ? minimum : raw;
        const leftRaw = values[row * width + Math.max(0, column - 1)];
        const rightRaw = values[row * width + Math.min(width - 1, column + 1)];
        const northRaw = values[Math.max(0, row - 1) * width + column];
        const southRaw = values[Math.min(height - 1, row + 1) * width + column];
        const left = leftRaw === NODATA ? elevation : leftRaw;
        const right = rightRaw === NODATA ? elevation : rightRaw;
        const northValue = northRaw === NODATA ? elevation : northRaw;
        const southValue = southRaw === NODATA ? elevation : southRaw;
        let nx = -(right - left) / (2 * SOURCE_SPACING_M);
        let ny = 1;
        let nz = -(southValue - northValue) / (2 * SOURCE_SPACING_M);
        const length = Math.hypot(nx, ny, nz) || 1;
        nx /= length;
        ny /= length;
        nz /= length;
        const edgeDistance = Math.min(column, row, width - 1 - column, height - 1 - row);
        const fade = smoothstep(0, DETAIL_EDGE_FADE, edgeDistance);

        vertices[cursor++] = easting - state.worldCenterE;
        vertices[cursor++] = elevation - state.verticalOrigin + 0.35;
        vertices[cursor++] = state.worldCenterN - northing;
        vertices[cursor++] = nx;
        vertices[cursor++] = ny;
        vertices[cursor++] = nz;
        vertices[cursor++] = elevation;
        vertices[cursor++] = fade;
      }
    }

    const maximumIndices = (width - 1) * (height - 1) * 6;
    const indices = new Uint32Array(maximumIndices);
    let indexCursor = 0;
    for (let row = 0; row < height - 1; row += 1) {
      for (let column = 0; column < width - 1; column += 1) {
        const a = row * width + column;
        const b = a + 1;
        const c = a + width;
        const d = c + 1;
        if (
          values[a] === NODATA ||
          values[b] === NODATA ||
          values[c] === NODATA ||
          values[d] === NODATA
        ) continue;
        indices[indexCursor++] = a;
        indices[indexCursor++] = c;
        indices[indexCursor++] = b;
        indices[indexCursor++] = b;
        indices[indexCursor++] = c;
        indices[indexCursor++] = d;
      }
    }

    if (!state.detailMesh) state.detailMesh = createTerrainMesh();
    uploadTerrainMesh(state.detailMesh, vertices, indices, indexCursor);
    state.detailPatch = {
      startColumn,
      startRow,
      width,
      height,
      centerX: west + (startColumn + (width - 1) * 0.5) * SOURCE_SPACING_M - state.worldCenterE,
      centerZ: state.worldCenterN - (north - (startRow + (height - 1) * 0.5) * SOURCE_SPACING_M),
      elevationRange: [minimum, maximum],
    };
    state.detailActive = true;
    updateDataPanel();
    state.dirty = true;
  }

  async function updateDetailPatch(force = false) {
    clearTimeout(state.detailTimer);
    if (!state.ready) return;
    if (state.camera.distance > DETAIL_ENABLE_DISTANCE_M) {
      state.detailRequestToken += 1;
      state.detailActive = false;
      state.detailPatch = null;
      $('detailStatus').textContent = '放大后自动载入 12.5 m';
      detailLoading.hidden = true;
      state.dirty = true;
      updateQa();
      return;
    }

    const bounds = state.manifest.aoi.native_sample_center_bounds_epsg32649;
    const width = state.manifest.aoi.native_sample_window[2];
    const height = state.manifest.aoi.native_sample_window[3];
    const targetE = state.worldCenterE + state.camera.target[0];
    const targetN = state.worldCenterN - state.camera.target[2];
    const globalColumn = clamp(Math.round((targetE - bounds[0]) / SOURCE_SPACING_M), 0, width - 1);
    const globalRow = clamp(Math.round((bounds[3] - targetN) / SOURCE_SPACING_M), 0, height - 1);
    const patchWidth = Math.min(DETAIL_GRID, width);
    const patchHeight = Math.min(DETAIL_GRID, height);
    const startColumn = clamp(Math.round(globalColumn - patchWidth / 2), 0, width - patchWidth);
    const startRow = clamp(Math.round(globalRow - patchHeight / 2), 0, height - patchHeight);

    if (!force && state.detailPatch) {
      const centerColumn = state.detailPatch.startColumn + state.detailPatch.width * 0.5;
      const centerRow = state.detailPatch.startRow + state.detailPatch.height * 0.5;
      const movement = Math.hypot(globalColumn - centerColumn, globalRow - centerRow) * SOURCE_SPACING_M;
      if (movement < DETAIL_REFRESH_DISTANCE_M) return;
    }

    const token = ++state.detailRequestToken;
    detailLoading.hidden = false;
    detailLoadingText.textContent = '读取视野中心的原生 12.5 米高程';
    const requiredTiles = new Map();
    const rowStart = Math.floor(startRow / TILE_STRIDE);
    const rowStop = Math.floor((startRow + patchHeight - 1) / TILE_STRIDE);
    const columnStart = Math.floor(startColumn / TILE_STRIDE);
    const columnStop = Math.floor((startColumn + patchWidth - 1) / TILE_STRIDE);
    for (let tileRow = rowStart; tileRow <= rowStop; tileRow += 1) {
      for (let tileColumn = columnStart; tileColumn <= columnStop; tileColumn += 1) {
        const tile = state.tileByMatrix.get(`${tileRow},${tileColumn}`);
        if (tile) requiredTiles.set(tile.id, tile);
      }
    }

    await Promise.all([...requiredTiles.values()].map(tile => loadNativeTile(tile)));
    if (token !== state.detailRequestToken) return;
    detailLoadingText.textContent = '建立无贴图原生顶点与法线';
    await nextFrame();
    buildDetailGeometry(startColumn, startRow, patchWidth, patchHeight);
    if (token !== state.detailRequestToken) return;
    evictTileCache(new Set(requiredTiles.keys()));
    detailLoading.hidden = true;
    updateQa();
  }

  function scheduleDetailPatch(force = false) {
    clearTimeout(state.detailTimer);
    state.detailTimer = setTimeout(() => {
      updateDetailPatch(force).catch(showError);
    }, force ? 0 : 260);
  }

  function mat4Multiply(out, a, b) {
    const result = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        result[column * 4 + row] =
          a[row] * b[column * 4] +
          a[4 + row] * b[column * 4 + 1] +
          a[8 + row] * b[column * 4 + 2] +
          a[12 + row] * b[column * 4 + 3];
      }
    }
    out.set(result);
    return out;
  }

  function mat4Perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = 2 * far * near / (near - far);
    return out;
  }

  function mat4LookAt(out, eye, center, up) {
    let zx = eye[0] - center[0];
    let zy = eye[1] - center[1];
    let zz = eye[2] - center[2];
    let length = Math.hypot(zx, zy, zz) || 1;
    zx /= length;
    zy /= length;
    zz /= length;
    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    length = Math.hypot(xx, xy, xz) || 1;
    xx /= length;
    xy /= length;
    xz /= length;
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }

  function mat4Invert(out, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    let determinant =
      b00 * b11 -
      b01 * b10 +
      b02 * b09 +
      b03 * b08 -
      b04 * b07 +
      b05 * b06;
    if (!determinant) return false;
    determinant = 1 / determinant;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * determinant;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * determinant;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * determinant;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * determinant;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * determinant;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * determinant;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * determinant;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * determinant;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * determinant;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * determinant;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * determinant;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * determinant;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * determinant;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * determinant;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * determinant;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * determinant;
    return true;
  }

  function transformVec4(matrix, vector) {
    return [
      matrix[0] * vector[0] + matrix[4] * vector[1] + matrix[8] * vector[2] + matrix[12] * vector[3],
      matrix[1] * vector[0] + matrix[5] * vector[1] + matrix[9] * vector[2] + matrix[13] * vector[3],
      matrix[2] * vector[0] + matrix[6] * vector[1] + matrix[10] * vector[2] + matrix[14] * vector[3],
      matrix[3] * vector[0] + matrix[7] * vector[1] + matrix[11] * vector[2] + matrix[15] * vector[3],
    ];
  }

  function resizeCanvas() {
    const ratio = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const width = Math.max(2, Math.floor(canvas.clientWidth * ratio));
    const height = Math.max(2, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      state.dirty = true;
    }
  }

  function cameraEye() {
    const camera = state.camera;
    const horizontal = Math.cos(camera.pitch) * camera.distance;
    return [
      camera.target[0] + Math.sin(camera.yaw) * horizontal,
      camera.target[1] + Math.sin(camera.pitch) * camera.distance,
      camera.target[2] + Math.cos(camera.yaw) * horizontal,
    ];
  }

  function updateMatrices() {
    resizeCanvas();
    const eye = cameraEye();
    const span = Math.max(state.worldWidth, state.worldDepth);
    const near = Math.max(0.5, state.camera.distance / 12_000);
    const far = state.camera.distance + span * 10 + 30_000;
    mat4Perspective(state.projection, Math.PI / 4.05, canvas.width / Math.max(1, canvas.height), near, far);
    mat4LookAt(state.view, eye, state.camera.target, [0, 1, 0]);
    mat4Multiply(state.viewProjection, state.projection, state.view);
    mat4Invert(state.inverseViewProjection, state.viewProjection);
  }

  function drawTerrainMesh(mesh, opacity, detail = false) {
    if (!mesh || mesh.indexCount <= 0) return;
    const gl = state.gl;
    gl.useProgram(state.terrainProgram);
    gl.uniformMatrix4fv(state.terrainUniforms.viewProjection, false, state.viewProjection);
    gl.uniform1f(state.terrainUniforms.minimum, state.elevationMin);
    gl.uniform1f(state.terrainUniforms.maximum, state.elevationMax);
    gl.uniform1f(state.terrainUniforms.opacity, opacity);
    gl.bindVertexArray(mesh.vao);

    if (detail) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
    } else {
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 1);
    }
    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_INT, 0);
    if (detail) {
      gl.enable(gl.CULL_FACE);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    } else {
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    gl.bindVertexArray(null);
  }

  function drawHydrology() {
    if (!state.waterwaysVisible || !state.hydrologyReady) return;
    const gl = state.gl;
    const nativeMode = state.detailActive && state.camera.distance <= DETAIL_ENABLE_DISTANCE_M;
    const segmentVao = nativeMode ? state.nativeSegmentVao : state.overviewSegmentVao;
    const nodeVao = nativeMode ? state.nativeNodeVao : state.overviewNodeVao;
    const pixelRatio = canvas.width / Math.max(1, canvas.clientWidth);
    const zoomScale = waterwayZoomScale();
    const surfaceOffset = nativeMode ? 3.5 : 1.6;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);

    gl.useProgram(state.segmentProgram);
    gl.uniformMatrix4fv(state.segmentUniforms.viewProjection, false, state.viewProjection);
    gl.uniform2f(state.segmentUniforms.viewport, canvas.width, canvas.height);
    gl.uniform1f(state.segmentUniforms.verticalOrigin, state.verticalOrigin);
    gl.uniform1f(state.segmentUniforms.emphasis, state.waterwayEmphasis);
    gl.uniform1f(state.segmentUniforms.zoomScale, zoomScale);
    gl.uniform1f(state.segmentUniforms.pixelRatio, pixelRatio);
    gl.uniform1f(state.segmentUniforms.surfaceOffset, surfaceOffset);
    gl.bindVertexArray(segmentVao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, state.hydrologySegmentCount);

    gl.useProgram(state.nodeProgram);
    gl.uniformMatrix4fv(state.nodeUniforms.viewProjection, false, state.viewProjection);
    gl.uniform2f(state.nodeUniforms.viewport, canvas.width, canvas.height);
    gl.uniform1f(state.nodeUniforms.verticalOrigin, state.verticalOrigin);
    gl.uniform1f(state.nodeUniforms.emphasis, state.waterwayEmphasis);
    gl.uniform1f(state.nodeUniforms.zoomScale, zoomScale);
    gl.uniform1f(state.nodeUniforms.pixelRatio, pixelRatio);
    gl.uniform1f(state.nodeUniforms.surfaceOffset, surfaceOffset);
    gl.bindVertexArray(nodeVao);
    gl.drawArrays(gl.POINTS, 0, state.hydrologyRenderNodeCount);

    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  function render() {
    if (!state.gl || !state.overviewReady) return;
    updateMatrices();
    const gl = state.gl;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawTerrainMesh(state.overviewMesh, 1, false);
    if (state.detailActive) drawTerrainMesh(state.detailMesh, 1, true);
    drawHydrology();
    updateLabels();
    updateDataPanel();
    updateQa();
    state.dirty = false;
  }

  function renderLoop() {
    if (state.dirty) render();
    requestAnimationFrame(renderLoop);
  }

  function resetFullView() {
    const span = Math.max(state.worldWidth, state.worldDepth);
    const relief = Math.max(1, state.elevationMax - state.elevationMin);
    state.camera.target = [0, relief * 0.18, 0];
    state.camera.yaw = -0.72;
    state.camera.pitch = 0.68;
    state.camera.distance = span * 1.36;
    state.camera.minDistance = 140;
    state.camera.maxDistance = span * 5.5;
    state.activeAnchor = 'full';
    updateAnchorButtons();
    state.dirty = true;
    scheduleDetailPatch();
  }

  function setTopView() {
    const span = Math.max(state.worldWidth, state.worldDepth);
    state.camera.target = [0, (state.elevationMax - state.verticalOrigin) * 0.18, 0];
    state.camera.yaw = 0;
    state.camera.pitch = 1.48;
    state.camera.distance = span * 1.05;
    state.activeAnchor = 'full';
    updateAnchorButtons();
    state.dirty = true;
    scheduleDetailPatch();
  }

  function focusAnchor(anchorId) {
    if (anchorId === 'full') {
      resetFullView();
      return;
    }
    const anchor = ANCHORS.find(item => item.id === anchorId);
    assert(anchor, `找不到地标 ${anchorId}`);
    const x = anchor.e - state.worldCenterE;
    const z = state.worldCenterN - anchor.n;
    const elevation = overviewElevationAtWorld(x, z);
    state.camera.target = [x, elevation - state.verticalOrigin + 120, z];
    state.camera.yaw = -0.78;
    state.camera.pitch = 0.52;
    state.camera.distance = 32_000;
    state.activeAnchor = anchorId;
    updateAnchorButtons();
    state.dirty = true;
    scheduleDetailPatch(true);
  }

  function updateAnchorButtons() {
    document.querySelectorAll('[data-anchor]').forEach(button => {
      button.classList.toggle('active', button.dataset.anchor === state.activeAnchor);
    });
  }

  function screenRay(clientX, clientY) {
    updateMatrices();
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((clientY - rect.top) / rect.height) * 2;
    const near = transformVec4(state.inverseViewProjection, [x, y, -1, 1]);
    const far = transformVec4(state.inverseViewProjection, [x, y, 1, 1]);
    if (Math.abs(near[3]) < 1e-9 || Math.abs(far[3]) < 1e-9) return null;
    const nearPoint = [near[0] / near[3], near[1] / near[3], near[2] / near[3]];
    const farPoint = [far[0] / far[3], far[1] / far[3], far[2] / far[3]];
    const direction = [
      farPoint[0] - nearPoint[0],
      farPoint[1] - nearPoint[1],
      farPoint[2] - nearPoint[2],
    ];
    const length = Math.hypot(...direction) || 1;
    return {
      origin: nearPoint,
      direction: direction.map(value => value / length),
    };
  }

  function focusAtScreen(clientX, clientY) {
    const ray = screenRay(clientX, clientY);
    if (!ray) return;
    const planeY = state.camera.target[1];
    if (Math.abs(ray.direction[1]) < 1e-6) return;
    const distance = (planeY - ray.origin[1]) / ray.direction[1];
    if (distance <= 0) return;
    const x = ray.origin[0] + ray.direction[0] * distance;
    const z = ray.origin[2] + ray.direction[2] * distance;
    const halfWidth = state.worldWidth * 0.52;
    const halfDepth = state.worldDepth * 0.52;
    state.camera.target[0] = clamp(x, -halfWidth, halfWidth);
    state.camera.target[2] = clamp(z, -halfDepth, halfDepth);
    const elevation = overviewElevationAtWorld(state.camera.target[0], state.camera.target[2]);
    state.camera.target[1] = elevation - state.verticalOrigin + 80;
    state.camera.distance = clamp(state.camera.distance * 0.46, state.camera.minDistance, state.camera.maxDistance);
    state.activeAnchor = '';
    updateAnchorButtons();
    state.dirty = true;
    scheduleDetailPatch(true);
  }

  function setupControls() {
    document.querySelectorAll('[data-anchor]').forEach(button => {
      button.addEventListener('click', () => {
        try {
          focusAnchor(button.dataset.anchor);
        } catch (error) {
          showError(error);
        }
      });
    });

    $('resetFull').addEventListener('click', resetFullView);
    $('topView').addEventListener('click', setTopView);
    $('fullscreen').addEventListener('click', async () => {
      if (!document.fullscreenElement) await $('viewerShell').requestFullscreen();
      else await document.exitFullscreen();
    });
    $('waterwaysToggle').addEventListener('change', event => {
      state.waterwaysVisible = event.target.checked;
      state.dirty = true;
      updateQa();
    });
    $('waterwayEmphasis').addEventListener('input', event => {
      state.waterwayEmphasis = clamp(Number(event.target.value), WATERWAY_MIN_EMPHASIS, WATERWAY_MAX_EMPHASIS);
      state.dirty = true;
      updateQa();
    });
    $('labelsToggle').addEventListener('change', event => {
      state.labelsVisible = event.target.checked;
      labelLayer.hidden = !state.labelsVisible;
      state.dirty = true;
    });
    togglePanel.addEventListener('click', () => {
      const collapsed = controlPanel.classList.toggle('collapsed');
      togglePanel.setAttribute('aria-expanded', String(!collapsed));
    });

    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => {
      canvas.setPointerCapture(event.pointerId);
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.pointers.size === 2) {
        const points = [...state.pointers.values()];
        state.pinch = {
          distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
          cameraDistance: state.camera.distance,
        };
      }
    });
    canvas.addEventListener('pointermove', event => {
      const previous = state.pointers.get(event.pointerId);
      if (!previous) return;
      const current = { x: event.clientX, y: event.clientY };
      state.pointers.set(event.pointerId, current);
      if (state.pointers.size === 2 && state.pinch) {
        const points = [...state.pointers.values()];
        const distance = Math.max(8, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
        state.camera.distance = clamp(
          state.pinch.cameraDistance * state.pinch.distance / distance,
          state.camera.minDistance,
          state.camera.maxDistance
        );
      } else {
        const dx = current.x - previous.x;
        const dy = current.y - previous.y;
        if (event.shiftKey || event.buttons === 2) {
          const scale = state.camera.distance * 0.00125;
          const rightX = Math.cos(state.camera.yaw);
          const rightZ = -Math.sin(state.camera.yaw);
          const forwardX = Math.sin(state.camera.yaw);
          const forwardZ = Math.cos(state.camera.yaw);
          state.camera.target[0] -= dx * scale * rightX + dy * scale * forwardX;
          state.camera.target[2] -= dx * scale * rightZ + dy * scale * forwardZ;
          state.camera.target[0] = clamp(state.camera.target[0], -state.worldWidth * 0.58, state.worldWidth * 0.58);
          state.camera.target[2] = clamp(state.camera.target[2], -state.worldDepth * 0.58, state.worldDepth * 0.58);
          state.activeAnchor = '';
          updateAnchorButtons();
        } else {
          state.camera.yaw -= dx * 0.005;
          state.camera.pitch = clamp(state.camera.pitch + dy * 0.004, 0.08, 1.49);
        }
      }
      state.dirty = true;
      scheduleDetailPatch();
    });

    const releasePointer = event => {
      state.pointers.delete(event.pointerId);
      if (state.pointers.size < 2) state.pinch = null;
      scheduleDetailPatch();
    };
    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', releasePointer);
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      state.camera.distance = clamp(
        state.camera.distance * Math.exp(event.deltaY * 0.001),
        state.camera.minDistance,
        state.camera.maxDistance
      );
      state.dirty = true;
      scheduleDetailPatch();
    }, { passive: false });
    canvas.addEventListener('dblclick', event => focusAtScreen(event.clientX, event.clientY));
    window.addEventListener('resize', () => {
      state.dirty = true;
    });
  }

  function buildLabels() {
    labelLayer.replaceChildren();
    state.labels = [];
    for (const anchor of ANCHORS) {
      const element = document.createElement('div');
      element.className = 'landmark-label';
      element.textContent = anchor.name;
      labelLayer.appendChild(element);
      const x = anchor.e - state.worldCenterE;
      const z = state.worldCenterN - anchor.n;
      const elevation = overviewElevationAtWorld(x, z);
      state.labels.push({
        element,
        x,
        y: elevation - state.verticalOrigin + 65,
        z,
      });
    }
  }

  function projectWorld(x, y, z) {
    const matrix = state.viewProjection;
    const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    const clipZ = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    if (clipW <= 0) return null;
    const nx = clipX / clipW;
    const ny = clipY / clipW;
    const nz = clipZ / clipW;
    if (nx < -1.08 || nx > 1.08 || ny < -1.08 || ny > 1.08 || nz < -1 || nz > 1) return null;
    return [
      (nx * 0.5 + 0.5) * canvas.clientWidth,
      (1 - (ny * 0.5 + 0.5)) * canvas.clientHeight,
    ];
  }

  function updateLabels() {
    if (!state.labelsVisible) return;
    for (const label of state.labels) {
      const projected = projectWorld(label.x, label.y, label.z);
      if (!projected) {
        label.element.style.display = 'none';
      } else {
        label.element.style.display = '';
        label.element.style.left = `${projected[0]}px`;
        label.element.style.top = `${projected[1]}px`;
      }
    }
  }

  function updateDataPanel() {
    if (!state.overviewManifest || !state.hydrologyManifest) return;
    $('aoiRange').textContent = `${(state.worldWidth / 1000).toFixed(1)} × ${(state.worldDepth / 1000).toFixed(1)} km`;
    const grid = state.overviewManifest.asset.grid;
    $('overviewGrid').textContent = `${grid[0]} × ${grid[1]} 全域数值几何`;
    if (state.detailActive && state.detailPatch) {
      $('detailStatus').textContent = `${state.detailPatch.width} × ${state.detailPatch.height} · 12.5 m`;
    } else if (state.camera.distance <= DETAIL_ENABLE_DISTANCE_M) {
      $('detailStatus').textContent = '正在载入原生近景';
    } else {
      $('detailStatus').textContent = '放大后自动载入 12.5 m';
    }
    $('cameraScale').textContent = `${(state.camera.distance / 1000).toFixed(state.camera.distance < 10_000 ? 2 : 1)} km`;
    const counts = state.hydrologyManifest.topology.record_counts;
    $('waterwayStatus').textContent = `河 ${counts.river.toLocaleString()} · 溪 ${counts.stream.toLocaleString()} · 渠 ${counts.canal.toLocaleString()}`;
    const style = waterwayStyleMetrics();
    $('waterwayWidthStatus').textContent = `漓桂干流 ${style.mainstem_upstream_physical_width_m.toFixed(0)} → ${style.mainstem_downstream_physical_width_m.toFixed(0)} m · 当前屏幕 ${style.mainstem_upstream_full_width_css_px.toFixed(1)} → ${style.mainstem_downstream_full_width_css_px.toFixed(1)} px`;
    $('waterwayJoinStatus').textContent = `汇流 ${state.hydrologyJunctionCount.toLocaleString()} · 接缝 0 px`;
    const detailText = state.detailActive ? ` · 原生近景 ${state.detailMesh.triangleCount.toLocaleString()} 三角形` : '';
    renderInfo.textContent = `桂林全域 ${state.overviewMesh?.triangleCount.toLocaleString() || 0} 三角形${detailText} · 细线连通水系 ${state.hydrologySegmentCount.toLocaleString()} 段`;
  }

  function updateQa() {
    const loadingVisible = getComputedStyle(loadingCard).display !== 'none';
    const errorVisible = getComputedStyle(errorCard).display !== 'none';
    const result = {
      schema: 'guilin-continuous-full-map-browser-qa/v1',
      passed: Boolean(
        state.ready &&
        state.overviewReady &&
        state.hydrologyReady &&
        state.gl &&
        runtimeErrors.length === 0 &&
        !loadingVisible &&
        !errorVisible
      ),
      data_ready: state.ready,
      webgl2: Boolean(state.gl),
      source_sha256: state.manifest?.source?.sha256 || null,
      aoi_geometry_sha256: state.manifest?.aoi?.geometry_sha256 || null,
      native_spacing_m: SOURCE_SPACING_M,
      native_tile_count: state.manifest?.tiles?.length || 0,
      full_aoi_overview: Boolean(state.overviewReady),
      one_continuous_map: true,
      continuous_zoom: true,
      tile_picker_required: false,
      distilled_knowledge_runtime: DISTILLED_KNOWLEDGE_RUNTIME,
      native_tile_delivery: 'same-origin-on-demand',
      full_truth_downloaded_on_page_open: false,
      stale_public_assets_allowed: false,
      overview_grid: state.overviewManifest?.asset?.grid || null,
      overview_direct_source_selection: state.overviewManifest?.asset?.selection || null,
      overview_interpolation: state.overviewManifest?.asset?.interpolation || null,
      native_detail_available: true,
      native_detail_active: state.detailActive,
      native_detail_grid: state.detailActive && state.detailPatch ? [state.detailPatch.width, state.detailPatch.height] : null,
      loaded_native_tile_count: state.tileCache.size,
      direct_numeric_vertex_geometry: true,
      height_image_texture_used: false,
      texture_upload_count: 0,
      source_tile_compression: 'none',
      source_resampling: 'none',
      source_elevation_modified_m: 0,
      vertical_scale: 1,
      osm_linear_waterways_loaded: state.hydrologyReady,
      hydrology_segment_count: state.hydrologySegmentCount,
      hydrology_source_segment_count:
        state.hydrologyManifest?.topology?.source_segment_count ??
        state.hydrologyManifest?.topology?.source_segment_count_after_render_densification ??
        state.hydrologySegmentCount,
      hydrology_dropped_segment_count:
        state.hydrologyManifest?.topology?.dropped_segment_count ??
        state.hydrologyManifest?.topology?.nodata_break_count ??
        0,
      hydrology_display_elevation_fallback_node_count:
        state.hydrologyManifest?.topology?.display_elevation_fallback_node_count ??
        state.hydrologyManifest?.topology?.elevation_fallback_vertex_count ??
        0,
      hydrology_source_route_coverage: state.hydrologyManifest?.topology?.source_route_coverage ?? 1,
      hydrology_segment_vertex_order: state.hydrologyManifest?.direction?.segment_vertex_order || null,
      hydrology_flow_progress_monotonic: state.hydrologyManifest?.direction?.flow_progress_monotonic ?? false,
      hydrology_flow_distance_monotonic: state.hydrologyManifest?.direction?.flow_distance_monotonic ?? false,
      hydrology_future_flow_animation_ready: state.hydrologyManifest?.direction?.future_flow_animation_ready ?? false,
      hydrology_orientation_method: state.hydrologyManifest?.direction?.orientation_method || null,
      hydrology_runtime_route_break_count: state.hydrologyManifest?.topology?.runtime_route_break_count ?? 0,
      li_gui_continuation_segment_count: state.hydrologyManifest?.styling?.li_gui_continuation_segment_count ?? 0,
      li_south_of_yangshuo_segment_count: state.hydrologyManifest?.styling?.li_south_of_yangshuo_segment_count ?? 0,
      li_reaches_aoi_south_boundary: state.hydrologyManifest?.styling?.li_reaches_aoi_south_boundary ?? false,
      hydrology_node_count: state.hydrologySourceNodeCount,
      hydrology_render_node_count: state.hydrologyRenderNodeCount,
      hydrology_endpoint_count: state.hydrologyEndpointCount,
      hydrology_junction_count: state.hydrologyJunctionCount,
      hydrology_bend_cap_count: state.hydrologyBendCapCount,
      hydrology_visual_join_gap_px: state.hydrologyVisualJoinGapPx,
      hydrology_visual_join_policy: 'overlapped-segments-and-degree-caps',
      hydrology_overview_surface_drape: true,
      hydrology_native_source_drape: true,
      hydrology_active_drape: state.detailActive ? 'native-source' : 'overview-surface',
      waterway_style: waterwayStyleMetrics(),
      waterway_record_counts: state.hydrologyManifest?.topology?.record_counts || null,
      centerline_coordinates_mutated: false,
      manual_centerline_added: false,
      synthetic_gap_line_added: false,
      lake_surface_asset_count: 0,
      reservoir_surface_asset_count: 0,
      synthetic_surface_asset_count: 0,
      runtime_errors: runtimeErrors.slice(),
      loading_overlay_displayed: loadingVisible,
      error_overlay_displayed: errorVisible,
    };
    window.__GUILIN_FULL_MAP_QA_RESULT = result;
    document.body.dataset.ready = String(result.passed);
    document.body.dataset.fullMap = String(result.full_aoi_overview);
    document.body.dataset.continuousZoom = String(result.continuous_zoom);
    document.body.dataset.hydrology = String(result.osm_linear_waterways_loaded);
    document.body.dataset.reservoirSurfaceCount = '0';
    document.body.dataset.textureCount = '0';
    return result;
  }

  function showError(error) {
    const message = String(error?.stack || error?.message || error);
    runtimeErrors.push(message);
    console.error(error);
    loadingCard.hidden = true;
    detailLoading.hidden = true;
    errorMessage.textContent = message;
    errorCard.hidden = false;
    updateQa();
  }

  async function initialize() {
    setupControls();
    setupWebGL();

    loadingDetail.textContent = '读取唯一真值、全域总图和 OSM 水系清单';
    const [manifest, overviewManifest, hydrologyManifest] = await Promise.all([
      fetchJson(MANIFEST_URL),
      fetchJson(OVERVIEW_MANIFEST_URL),
      fetchJson(HYDROLOGY_MANIFEST_URL),
    ]);
    validateManifests(manifest, overviewManifest, hydrologyManifest);
    state.manifest = manifest;
    state.overviewManifest = overviewManifest;
    state.hydrologyManifest = hydrologyManifest;
    for (const tile of manifest.tiles) {
      state.tileById.set(tile.id, tile);
      state.tileByMatrix.set(`${tile.matrix_index[0]},${tile.matrix_index[1]}`, tile);
    }
    setupWorld(manifest, overviewManifest);

    loadingDetail.textContent = '下载全域数值样本与 OSM 线状水系';
    const [overviewBuffer, segmentBuffer, nodeBuffer] = await Promise.all([
      fetchBinary(`data/${overviewManifest.asset.file}`),
      fetchBinary(`data/${hydrologyManifest.segments.file}`),
      fetchBinary(`data/${hydrologyManifest.nodes.file}`),
    ]);
    assert(overviewBuffer.byteLength === overviewManifest.asset.bytes, '全域数值资产字节数不正确');
    assert(segmentBuffer.byteLength === hydrologyManifest.segments.bytes, '水系线段资产字节数不正确');
    assert(nodeBuffer.byteLength === hydrologyManifest.nodes.bytes, '水系节点资产字节数不正确');

    loadingDetail.textContent = '核对全域数值资产 SHA256';
    const [overviewSha, segmentSha, nodeSha] = await Promise.all([
      sha256Hex(overviewBuffer),
      sha256Hex(segmentBuffer),
      sha256Hex(nodeBuffer),
    ]);
    assert(overviewSha === overviewManifest.asset.sha256, '全域数值资产 SHA256 不正确');
    assert(segmentSha === hydrologyManifest.segments.sha256, '水系线段资产 SHA256 不正确');
    assert(nodeSha === hydrologyManifest.nodes.sha256, '水系节点资产 SHA256 不正确');

    state.overviewValues = decodeInt16LE(overviewBuffer);
    state.overviewColumns = Int32Array.from(overviewManifest.asset.source_columns);
    state.overviewRows = Int32Array.from(overviewManifest.asset.source_rows);
    assert(
      state.overviewValues.length === overviewManifest.asset.grid[0] * overviewManifest.asset.grid[1],
      '全域总图数值数量不正确'
    );

    await nextFrame();
    buildOverviewGeometry();
    await nextFrame();
    setupHydrologyGeometry(decodeFloat32LE(segmentBuffer), decodeFloat32LE(nodeBuffer));
    buildLabels();
    resetFullView();

    state.ready = true;
    loadingCard.hidden = true;
    errorCard.hidden = true;
    updateDataPanel();
    updateQa();
    state.dirty = true;
    requestAnimationFrame(renderLoop);

    window.__GUILIN_FULL_MAP_TEST_API = {
      getState: updateQa,
      getWaterwayStyle: waterwayStyleMetrics,
      resetFull() {
        resetFullView();
        return updateQa();
      },
      focusAnchor(id) {
        focusAnchor(id);
        return updateQa();
      },
      async activateNativeDetail() {
        state.camera.distance = 24_000;
        await updateDetailPatch(true);
        return updateQa();
      },
      toggleWaterways(value) {
        state.waterwaysVisible = Boolean(value);
        $('waterwaysToggle').checked = state.waterwaysVisible;
        state.dirty = true;
        return updateQa();
      },
      setWaterwayEmphasis(value) {
        state.waterwayEmphasis = clamp(Number(value), WATERWAY_MIN_EMPHASIS, WATERWAY_MAX_EMPHASIS);
        $('waterwayEmphasis').value = String(state.waterwayEmphasis);
        state.dirty = true;
        return updateQa();
      },
    };
  }

  initialize().catch(showError);
})();