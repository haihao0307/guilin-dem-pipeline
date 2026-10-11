import {vertexShaderSource,fragmentShaderSource,hexToLinearRgb01,mat4Identity,mat4Inverse,transformPoint} from './original-core.mjs';
/* ===== renderer.js ===== */
function webGL1ShaderSources() {
  const vertex = vertexShaderSource
    .replace(/^#version 300 es\n/, '')
    .replace(/\bin\s+(vec[234]|float)\s+/g, 'attribute $1 ')
    .replace(/\bout\s+(vec[234]|float)\s+/g, 'varying $1 ');
  const fragment = fragmentShaderSource
    .replace(/^#version 300 es\n/, '')
    .replace('precision highp float;\n', '#extension GL_OES_standard_derivatives : enable\nprecision highp float;\n')
    .replace(/\bin\s+(vec[234]|float)\s+/g, 'varying $1 ')
    .replace(/\nout vec4 outColor;\n/, '\n')
    .replace(/\boutColor\b/g, 'gl_FragColor');
  return { vertex, fragment };
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader 编译失败: ${log}`);
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Shader 链接失败: ${log}`);
  }
  return program;
}

function getLocations(gl, program, names, getter) {
  const result = {};
  for (const name of names) result[name] = getter.call(gl, program, name);
  return result;
}

function normalizedColor(value, fallback = [0.25, 0.25, 0.25]) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return value;
  return fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function meshOrigin(model) {
  return [model?.[12] ?? 0, model?.[13] ?? 0, model?.[14] ?? 0];
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function resolveReliefPolicy({ preset, settings = {}, geometry, cameraPosition, model }) {
  const relief = preset.relief;
  const controls = preset.controls;
  const distance = distance3(cameraPosition, meshOrigin(model));
  let mode = settings.reliefMode ?? 'auto';
  if (mode === 'auto') {
    if (distance <= relief.autoInspectionDistanceM) mode = 'inspection';
    else if (distance <= relief.autoCloseDistanceM) mode = 'close';
    else mode = 'building';
  }

  const quality = mode === 'inspection' ? 3 : mode === 'close' ? 2 : 1;
  const supportsMacro = Boolean(
    geometry?.metadata?.supportsMacroDisplacement ||
    (geometry?.metadata?.type === 'cylinder-member' && (geometry?.bounds?.axialSegments ?? 1) > 1)
  );
  const reliefScale = clamp(
    (controls.reliefScale ?? 1) * (settings.reliefStrength ?? 1),
    0,
    1.6
  );
  const parallaxStrength = clamp(settings.parallaxStrength ?? 1, 0, 1.5);
  const macroMm = mode === 'inspection' && supportsMacro
    ? clamp(relief.macroDisplacementMm, 0, relief.maxMacroDisplacementMm)
    : 0;
  const parallaxMm = quality >= 2
    ? clamp(relief.parallaxMm * parallaxStrength, 0, relief.maxParallaxMm)
    : 0;
  const microMm = clamp(relief.microReliefMm, 0, relief.maxMicroReliefMm);
  const parallaxSteps = mode === 'inspection'
    ? relief.parallaxStepsInspection
    : mode === 'close'
      ? relief.parallaxStepsClose
      : 0;

  return Object.freeze({
    mode,
    distance,
    quality,
    parallaxSteps,
    macroM: macroMm / 1000,
    parallaxM: parallaxMm / 1000,
    microM: microMm / 1000,
    reliefScale,
    textureScale: controls.textureScale ?? 1,
    grainContrast: clamp((controls.grainContrast ?? 0.17) * (settings.textureContrast ?? 1), 0.04, 0.36),
    detailFineness: clamp((controls.detailFineness ?? 1) * (settings.fineness ?? 1), 0.45, 1.65)
  });
}

function set1f(gl, location, value) {
  if (location !== null && location !== undefined) gl.uniform1f(location, value);
}

function set1i(gl, location, value) {
  if (location !== null && location !== undefined) gl.uniform1i(location, value);
}

function set2fv(gl, location, value) {
  if (location !== null && location !== undefined) gl.uniform2fv(location, value);
}

function set3fv(gl, location, value) {
  if (location !== null && location !== undefined) gl.uniform3fv(location, value);
}

function orderedSceneMeshes(scene) {
  if (Array.isArray(scene?.meshes)) {
    const opaqueEnvironment = scene.meshes.filter((item) => !item.transparent && item.groupId === 'environment');
    const shadows = scene.meshes.filter((item) => item.transparent && item.material?.shadowDisc);
    const opaqueMembers = scene.meshes.filter((item) => !item.transparent && item.groupId !== 'environment');
    const otherTransparent = scene.meshes.filter((item) => item.transparent && !item.material?.shadowDisc);
    return [...opaqueEnvironment, ...shadows, ...opaqueMembers, ...otherTransparent];
  }

  return [
    ...(scene?.groundMeshes ?? []),
    ...(scene?.shadowMeshes ?? []),
    ...(scene?.solidMeshes ?? []),
    ...(scene?.woodMeshes ?? [])
  ];
}

class WebGLTimberRenderer {
  constructor(canvas) {
    const contextOptions = {
      antialias: true,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance'
    };
    let gl = canvas.getContext('webgl2', contextOptions);
    this.isWebGL2 = Boolean(gl);
    if (!gl) gl = canvas.getContext('webgl', contextOptions) ?? canvas.getContext('experimental-webgl', contextOptions);
    if (!gl) throw new Error('当前浏览器无法建立 WebGL 上下文');

    this.canvas = canvas;
    this.gl = gl;
    this.contextLabel = this.isWebGL2 ? 'WebGL2' : 'WebGL1 fallback';
    this.geometryCache = new WeakMap();

    if (this.isWebGL2) {
      this.createVertexArray = () => gl.createVertexArray();
      this.bindVertexArray = (vao) => gl.bindVertexArray(vao);
      this.uintIndexSupported = true;
    } else {
      const derivatives = gl.getExtension('OES_standard_derivatives');
      const vaoExtension = gl.getExtension('OES_vertex_array_object');
      this.uintIndexSupported = Boolean(gl.getExtension('OES_element_index_uint'));
      if (!derivatives || !vaoExtension) {
        throw new Error('WebGL1 回退需要 OES_standard_derivatives 与 OES_vertex_array_object');
      }
      this.createVertexArray = () => vaoExtension.createVertexArrayOES();
      this.bindVertexArray = (vao) => vaoExtension.bindVertexArrayOES(vao);
    }

    const sources = this.isWebGL2
      ? { vertex: vertexShaderSource, fragment: fragmentShaderSource }
      : webGL1ShaderSources();
    this.program = createProgram(gl, sources.vertex, sources.fragment);
    this.attributes = getLocations(gl, this.program, [
      'a_position', 'a_normal', 'a_grainPosition', 'a_grainNormal', 'a_surfaceClass'
    ], gl.getAttribLocation);
    this.uniforms = getLocations(gl, this.program, [
      'u_model', 'u_view', 'u_projection',
      'u_cameraPosition', 'u_cameraLocalPosition', 'u_cameraGrainPosition',
      'u_lightDirection', 'u_lightColor', 'u_skyColor', 'u_groundColor',
      'u_seed', 'u_ringFrequency', 'u_ringScale', 'u_ringWarp',
      'u_fiberFrequency', 'u_fineFiberFrequency', 'u_poreFrequency',
      'u_fiberStrength', 'u_colorBias', 'u_roughness', 'u_angleOffset', 'u_pithOffset',
      'u_textureScale', 'u_grainContrast', 'u_detailFineness',
      'u_macroDisplacementM', 'u_microReliefM', 'u_parallaxM', 'u_reliefScale',
      'u_shapeMode', 'u_memberRadius', 'u_roundGrainFlip', 'u_reliefQuality', 'u_parallaxSteps',
      'u_clearcoat', 'u_clearcoatRoughness', 'u_specularLevel',
      'u_distanceFadeStart', 'u_distanceFadeEnd',
      'u_toolPhase', 'u_crackPhase', 'u_knotPhase',
      'u_darkGrainColor', 'u_lightGrainColor', 'u_agedSurfaceColor',
      'u_weatheredColor', 'u_freshCutColor', 'u_cavityColor', 'u_solidColor',
      'u_isWood', 'u_alpha', 'u_shadowDisc', 'u_selected', 'u_debugMode'
    ], gl.getUniformLocation);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.clearColor(0.047, 0.053, 0.05, 1);
  }

  uploadGeometry(geometry) {
    if (this.geometryCache.has(geometry)) return this.geometryCache.get(geometry);
    const gl = this.gl;
    const vao = this.createVertexArray();
    this.bindVertexArray(vao);

    const bindAttribute = (location, data, size) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
      return buffer;
    };

    const vertexCount = geometry.positions.length / 3;
    const buffers = [
      bindAttribute(this.attributes.a_position, geometry.positions, 3),
      bindAttribute(this.attributes.a_normal, geometry.normals, 3),
      bindAttribute(this.attributes.a_grainPosition, geometry.grainPositions ?? geometry.positions, 3),
      bindAttribute(this.attributes.a_grainNormal, geometry.grainNormals ?? geometry.normals, 3),
      bindAttribute(this.attributes.a_surfaceClass, geometry.surfaceClasses ?? new Float32Array(vertexCount), 1)
    ];

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
    this.bindVertexArray(null);

    const indexType = geometry.indices instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
    if (indexType === gl.UNSIGNED_INT && !this.uintIndexSupported) {
      throw new Error('当前 WebGL1 环境不支持 32 位索引');
    }

    const uploaded = { vao, buffers, indexBuffer, count: geometry.indices.length, type: indexType };
    this.geometryCache.set(geometry, uploaded);
    return uploaded;
  }

  resize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * pixelRatio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
    return { width, height, aspect: width / height };
  }

  beginFrame(clear = [0.047, 0.053, 0.05, 1]) {
    const gl = this.gl;
    gl.clearColor(clear[0], clear[1], clear[2], clear[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  draw(mesh, frame) {
    const gl = this.gl;
    const gpu = this.uploadGeometry(mesh.geometry);
    const material = mesh.material ?? {};
    const preset = frame.preset;
    const settings = frame.settings ?? {};
    const isWood = mesh.kind === 'wood' || material.kind === 'wood';
    const alpha = material.alpha ?? material.opacity ?? 1;
    const shadowDisc = mesh.kind === 'shadow' || material.shadowDisc ? 1 : 0;
    const model = mesh.model ?? mat4Identity();
    const policy = resolveReliefPolicy({
      preset,
      settings,
      geometry: mesh.geometry,
      cameraPosition: frame.cameraPosition,
      model
    });

    if (alpha < 1) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
    }

    gl.useProgram(this.program);
    this.bindVertexArray(gpu.vao);
    gl.uniformMatrix4fv(this.uniforms.u_model, false, model);
    gl.uniformMatrix4fv(this.uniforms.u_view, false, frame.view);
    gl.uniformMatrix4fv(this.uniforms.u_projection, false, frame.projection);
    set3fv(gl, this.uniforms.u_cameraPosition, frame.cameraPosition);
    let cameraLocal = frame.cameraPosition;
    try {
      cameraLocal = transformPoint(mat4Inverse(model), frame.cameraPosition);
    } catch {
      cameraLocal = frame.cameraPosition;
    }
    set3fv(gl, this.uniforms.u_cameraLocalPosition, cameraLocal);
    const grainOffset = mesh.geometry?.metadata?.grainOffset ?? material.grainOffset ?? [0, 0, 0];
    const cameraGrain = [
      cameraLocal[0] + (grainOffset[0] ?? 0),
      cameraLocal[1] + (grainOffset[1] ?? 0),
      cameraLocal[2] + (grainOffset[2] ?? 0)
    ];
    set3fv(gl, this.uniforms.u_cameraGrainPosition, cameraGrain);
    set3fv(gl, this.uniforms.u_lightDirection, frame.lightDirection ?? [-0.48, 0.86, 0.27]);
    set3fv(gl, this.uniforms.u_lightColor, frame.lightColor ?? [1.0, 0.91, 0.78]);
    set3fv(gl, this.uniforms.u_skyColor, frame.skyColor ?? [0.34, 0.39, 0.36]);
    set3fv(gl, this.uniforms.u_groundColor, frame.groundColor ?? [0.12, 0.105, 0.09]);

    set1f(gl, this.uniforms.u_seed, material.seed01 ?? 0.5);
    set1f(gl, this.uniforms.u_ringFrequency, preset.grain.ringFrequency);
    set1f(gl, this.uniforms.u_ringScale, material.ringScale ?? 1);
    set1f(gl, this.uniforms.u_ringWarp, preset.grain.ringWarp * (material.warpScale ?? 1));
    set1f(gl, this.uniforms.u_fiberFrequency, preset.grain.fiberFrequency * (material.fiberScale ?? 1));
    set1f(gl, this.uniforms.u_fineFiberFrequency, preset.grain.fineFiberFrequency);
    set1f(gl, this.uniforms.u_poreFrequency, preset.grain.poreFrequency);
    set1f(gl, this.uniforms.u_fiberStrength, preset.grain.fiberStrength);
    set1f(gl, this.uniforms.u_colorBias, material.colorBias ?? 0);
    set1f(gl, this.uniforms.u_roughness, material.roughness ?? 0.84);
    set1f(gl, this.uniforms.u_angleOffset, material.angleOffset ?? 0);
    set2fv(gl, this.uniforms.u_pithOffset, material.pithOffset ?? [0, 0]);
    set1f(gl, this.uniforms.u_textureScale, policy.textureScale);
    set1f(gl, this.uniforms.u_grainContrast, clamp(policy.grainContrast + (material.contrastBias ?? 0) * 0.10, 0.04, 0.38));
    set1f(gl, this.uniforms.u_detailFineness, clamp(policy.detailFineness * (material.detailScale ?? 1), 0.45, 1.75));
    set1f(gl, this.uniforms.u_macroDisplacementM, isWood ? policy.macroM : 0);
    set1f(gl, this.uniforms.u_microReliefM, isWood ? policy.microM : 0);
    set1f(gl, this.uniforms.u_parallaxM, isWood ? policy.parallaxM : 0);
    set1f(gl, this.uniforms.u_reliefScale, (material.reliefScale ?? material.reliefBias ?? 1) * policy.reliefScale);
    const geometryType = mesh.geometry?.metadata?.type ?? '';
    const inferredRound = geometryType === 'cylinder-member';
    set1f(gl, this.uniforms.u_shapeMode, material.shapeMode === 'round' || material.shapeMode === 1 || inferredRound ? 1 : 0);
    set1f(gl, this.uniforms.u_memberRadius, material.memberRadius ?? mesh.geometry?.bounds?.radius ?? 0.35);
    set1f(gl, this.uniforms.u_roundGrainFlip, Number(material.roundGrainFlip ?? 1) < 0 ? -1 : 1);
    set1f(gl, this.uniforms.u_reliefQuality, isWood ? policy.quality : 0);
    set1f(gl, this.uniforms.u_parallaxSteps, isWood ? policy.parallaxSteps : 0);
    set1f(gl, this.uniforms.u_clearcoat, preset.surface.clearcoat ?? 0);
    set1f(gl, this.uniforms.u_clearcoatRoughness, preset.surface.clearcoatRoughness ?? 1);
    set1f(gl, this.uniforms.u_specularLevel, preset.surface.specular ?? 0.18);
    set1f(gl, this.uniforms.u_distanceFadeStart, preset.relief.distanceFadeStartM ?? 7);
    set1f(gl, this.uniforms.u_distanceFadeEnd, preset.relief.distanceFadeEndM ?? 22);
    set1f(gl, this.uniforms.u_toolPhase, material.toolPhase ?? 0);
    set1f(gl, this.uniforms.u_crackPhase, material.crackPhase ?? 0);
    set1f(gl, this.uniforms.u_knotPhase, material.knotPhase ?? 0);

    set3fv(gl, this.uniforms.u_darkGrainColor, hexToLinearRgb01(preset.colors.darkGrain));
    set3fv(gl, this.uniforms.u_lightGrainColor, hexToLinearRgb01(preset.colors.lightGrain));
    set3fv(gl, this.uniforms.u_agedSurfaceColor, hexToLinearRgb01(preset.colors.agedSurface));
    set3fv(gl, this.uniforms.u_weatheredColor, hexToLinearRgb01(preset.colors.weatheredSurface));
    set3fv(gl, this.uniforms.u_freshCutColor, hexToLinearRgb01(preset.colors.freshCut));
    set3fv(gl, this.uniforms.u_cavityColor, hexToLinearRgb01(preset.colors.cavity));
    set3fv(gl, this.uniforms.u_solidColor, normalizedColor(material.color));
    set1f(gl, this.uniforms.u_isWood, isWood ? 1 : 0);
    set1f(gl, this.uniforms.u_alpha, alpha);
    set1f(gl, this.uniforms.u_shadowDisc, shadowDisc);
    const selected = mesh.id === frame.selectedId || mesh.groupId === frame.selectedGroup;
    set1f(gl, this.uniforms.u_selected, selected ? 1 : 0);
    set1i(gl, this.uniforms.u_debugMode, isWood ? (frame.debugMode ?? 0) : 0);

    gl.drawElements(gl.TRIANGLES, gpu.count, gpu.type, 0);
    this.bindVertexArray(null);

    if (alpha < 1) {
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  }
}

class TimberRenderer {
  constructor(canvas) {
    this.renderer = new WebGLTimberRenderer(canvas);
    this.scene = null;
    this.debugMode = 0;
    this.selectedGroup = null;
  }

  setScene(scene) {
    this.scene = scene;
  }

  get contextLabel() {
    return this.renderer.contextLabel;
  }

  setDebugMode(mode) {
    this.debugMode = Math.max(0, Math.min(4, Number(mode) || 0));
  }

  setSelectedGroup(groupId) {
    this.selectedGroup = groupId || null;
  }

  resize() {
    return this.renderer.resize().aspect;
  }

  render(camera) {
    if (!this.scene) return;
    this.scene.update?.();
    const settings = this.scene.settings ?? {};
    const frame = {
      view: camera.view,
      projection: camera.projection,
      cameraPosition: camera.position,
      preset: this.scene.preset,
      settings,
      debugMode: this.debugMode,
      selectedGroup: this.selectedGroup ?? this.scene.selectedGroup ?? null,
      lightDirection: [-0.48, 0.86, 0.27],
      lightColor: [1.0, 0.91, 0.78],
      skyColor: [0.34, 0.39, 0.36],
      groundColor: [0.12, 0.105, 0.09]
    };

    this.renderer.beginFrame();
    for (const item of orderedSceneMeshes(this.scene)) {
      this.renderer.draw(item, frame);
    }
  }
}



export {WebGLTimberRenderer};
